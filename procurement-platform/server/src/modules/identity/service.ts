import {
  AccountType,
  AdminActionType,
  AuditSeverity,
  PublicPageKey,
  RiskLevel,
  TrustTier,
  VerificationStatus,
  type Prisma
} from '@prisma/client';
import { isValidTanzaniaLocation, type PermissionName, type ScreeningStatus, type TanzaniaLocationSelection } from '@procurex/shared';
import { assertPermission, computeAccessContext } from '../../security/accessPolicy.js';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { ModuleRepository, type SessionWithUser, type UserWithDefaultOrg, type VerificationWithUser } from './repository.js';
import { createIdentityNotifications, type DeliveryReceipt, type IdentityNotificationProvider } from './notifications.js';
import { ProductionRegistryProvider, isRegistryProviderFailure, type RegistryProvider } from './registryProviders.js';
import { DeterministicScreeningProvider, type ScreeningProvider } from './screeningProviders.js';
import {
  MailboxlayerEmailValidationProvider,
  isEmailValidationProviderFailure,
  type EmailValidationProvider,
  type EmailValidationResult
} from './emailValidation.js';
import {
  SendchampNumberInsightProvider,
  isPhoneValidationProviderFailure,
  type PhoneValidationProvider,
  type PhoneValidationResult
} from './phoneValidation.js';
import {
  moduleDefinition,
  type AdminVerificationDto,
  type AuthSessionDto,
  type ModuleStatus,
  type RegistryRecordDto,
  type SessionUserDto,
  type SigningCredentialStatusDto,
  type VerificationProfileDto
} from './types.js';
import {
  createEncryptedSigningCredential,
  signCanonicalPayloadHash,
  signatureStatusDto,
  validateRepeatedKeyphrase
} from './signing.js';

const scrypt = promisify(scryptCallback);
const phoneOtpPurpose = 'PHONE_OTP';
const emailActivationPurpose = 'EMAIL_ACTIVATION';
const passwordResetPurpose = 'PASSWORD_RESET';
const sessionDays = 7;
const maxChallengeAttempts = 5;
const phoneOtpMinutes = 10;
const activationMinutes = 60;
const passwordResetMinutes = 30;
const resendCooldownSeconds = 30;
const passwordResetRequestedMessage = 'If an account exists for this email, password reset instructions have been sent.';

type RegistrationStartInput = {
  email: string;
  phone: string;
  location?: TanzaniaLocationSelection;
};

type LegalAcceptanceInput = {
  termsAccepted: true;
  privacyAccepted: true;
  termsVersionId?: string;
  privacyVersionId?: string;
  source: string;
  ipAddress?: string;
  userAgent?: string;
};

type VerificationPayloadInput = {
  entityType?: 'individual' | 'company' | 'business';
  businessRegistrationSource?: 'tin' | 'brela';
  registrySource?: string;
  registryNumber?: string;
  registryVerified?: boolean;
  registryRecordId?: string;
  signatureName?: string;
  signatureTitle?: string;
  signatureConsent?: boolean;
  signatureKeyphrase?: string;
  signatureConsentVersion?: string;
  signatureConsentTitle?: string;
  location?: TanzaniaLocationSelection;
  profile?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
};

type RegistryLookupInput = {
  entityType: 'individual' | 'company' | 'business';
  businessRegistrationSource?: 'tin' | 'brela';
  registryNumber: string;
};

type RegistrySource = 'TRA' | 'BRELA';

type AuthAuditContext = {
  ipAddress?: string;
  userAgent?: string;
};

type AuthAuditInput = AuthAuditContext & {
  userId?: string | null;
  ownerOrgId?: string | null;
  entityRef?: string | null;
  severity?: AuditSeverity;
  target?: string;
  details?: Record<string, unknown>;
};

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');

  if (!digits) return trimmed;
  if (trimmed.startsWith('+')) return `+${digits}`;
  if (digits.startsWith('255')) return `+${digits}`;
  if (digits.startsWith('0') && digits.length === 10) return `+255${digits.slice(1)}`;
  if (/^[67]\d{8}$/.test(digits)) return `+255${digits}`;
  return `+${digits}`;
}

function assertValidE164Phone(phone: string) {
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) {
    throw requestError('Phone number must use a valid international format.', 400);
  }
}

function challengeResendAvailableAt(createdAt: Date, seconds = 30) {
  return new Date(createdAt.getTime() + seconds * 1000).toISOString();
}

function assertResendAvailable(createdAt: Date) {
  if (createdAt.getTime() + resendCooldownSeconds * 1000 > Date.now()) {
    throw requestError('Please wait before requesting another code.', 429);
  }
}

function displayNameFromEmail(email: string) {
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function randomCode(length = 6) {
  const max = 10 ** length;
  return String(Math.floor(Math.random() * max)).padStart(length, '0');
}

function randomToken(bytes = 32) {
  return randomBytes(bytes).toString('base64url');
}

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

async function verifyPassword(password: string, stored?: string | null) {
  if (!stored?.startsWith('scrypt:')) return false;

  const [, salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const derived = (await scrypt(password, salt, 64)) as Buffer;
  const storedBuffer = Buffer.from(hash, 'hex');
  return storedBuffer.length === derived.length && timingSafeEqual(storedBuffer, derived);
}

function metadataObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function metadataArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object' && !Array.isArray(item))) : [];
}

function inputJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function assertValidTanzaniaLocation(location: unknown, required: true): TanzaniaLocationSelection;
function assertValidTanzaniaLocation(location: unknown, required?: false): TanzaniaLocationSelection | undefined;
function assertValidTanzaniaLocation(location: unknown, required = false): TanzaniaLocationSelection | undefined {
  if (location === undefined || location === null) {
    if (required) throw requestError('Select a valid Tanzania region, district, and ward/shehia.', 400);
    return undefined;
  }
  if (!isValidTanzaniaLocation(location)) {
    throw requestError('Select a valid Tanzania region, district, and ward/shehia.', 400);
  }
  return location;
}

function userLocation(user: { metadata?: unknown }) {
  const location = metadataObject(user.metadata).location;
  return isValidTanzaniaLocation(location) ? location : undefined;
}

function supportedLanguage(value: unknown): 'en' | 'sw' {
  return value === 'sw' ? 'sw' : 'en';
}

function preferenceDto(preference?: { preferredLanguage: string; timezone: string } | null) {
  return {
    preferredLanguage: supportedLanguage(preference?.preferredLanguage),
    timezone: preference?.timezone ?? 'Africa/Dar_es_Salaam'
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function deliveryMetadata(receipt: DeliveryReceipt) {
  return {
    provider: receipt.provider,
    messageId: receipt.messageId,
    deliveredAt: new Date().toISOString()
  };
}

function emailValidationMetadata(result: EmailValidationResult) {
  return {
    provider: result.provider,
    configured: result.configured,
    accepted: result.accepted,
    reasons: result.reasons,
    score: result.score,
    didYouMean: result.didYouMean,
    checks: result.checks
  };
}

function phoneValidationMetadata(result: PhoneValidationResult) {
  return {
    provider: result.provider,
    configured: result.configured,
    accepted: result.accepted,
    reasons: result.reasons,
    checks: result.checks,
    providerMetadata: result.providerMetadata ? inputJson(result.providerMetadata) : undefined
  };
}

function devChallengeMetadata(receipt: DeliveryReceipt, code: string) {
  return receipt.provider === 'dev-console' ? { devCode: code } : {};
}

function devCodeFromReceipt(receipt: DeliveryReceipt, code: string) {
  return receipt.provider === 'dev-console' ? code : undefined;
}

function appPublicUrl() {
  const raw = process.env.APP_PUBLIC_URL || 'http://localhost:5173';
  try {
    return new URL(raw).toString().replace(/\/$/, '');
  } catch {
    return 'http://localhost:5173';
  }
}

function passwordResetActionUrl(challengeId: string, code: string) {
  const url = new URL('/forgot-password', `${appPublicUrl()}/`);
  url.searchParams.set('challengeId', challengeId);
  url.hash = `code=${encodeURIComponent(code)}`;
  return url.toString();
}

function toSessionUser(user: UserWithDefaultOrg): SessionUserDto {
  const membership = user.memberships[0];
  const organization = membership?.organization;
  const capabilities = organization?.capabilities.map((item) => item.capability) ?? [];
  const access = accessForUser({
    accountType: user.accountType,
    verificationStatus: user.verificationStatus,
    capabilities,
    trustTier: organization?.supplierProfile?.trustTier,
    riskLevel: organization?.supplierProfile?.riskLevel,
    latestScreeningStatus: user.screeningChecks?.[0]?.status
  });
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    accountType: user.accountType,
    verificationStatus: user.verificationStatus,
    organization: organization?.name ?? '',
    organizationId: organization?.id,
    capabilities,
    permissions: access.permissions,
    trustTier: access.trustTier,
    riskLevel: access.riskLevel,
    featureGates: access.featureGates,
    screeningStatus: access.screeningStatus,
    preferences: preferenceDto(user.preference),
    location: userLocation(user)
  };
}

function toSessionUserFromSession(session: SessionWithUser): SessionUserDto {
  const organization = session.organization ?? session.user.memberships[0]?.organization;
  const capabilities = organization?.capabilities.map((item) => item.capability) ?? [];
  const access = accessForUser({
    accountType: session.user.accountType,
    verificationStatus: session.user.verificationStatus,
    capabilities,
    trustTier: organization?.supplierProfile?.trustTier,
    riskLevel: organization?.supplierProfile?.riskLevel,
    latestScreeningStatus: session.user.screeningChecks?.[0]?.status
  });
  return {
    id: session.user.id,
    email: session.user.email,
    phone: session.user.phone,
    displayName: session.user.displayName,
    accountType: session.user.accountType,
    verificationStatus: session.user.verificationStatus,
    organization: organization?.name ?? '',
    organizationId: organization?.id,
    capabilities,
    permissions: access.permissions,
    trustTier: access.trustTier,
    riskLevel: access.riskLevel,
    featureGates: access.featureGates,
    screeningStatus: access.screeningStatus,
    preferences: preferenceDto(session.user.preference),
    location: userLocation(session.user)
  };
}

function toProfileDto(profile: {
  id: string;
  status: VerificationStatus;
  registrySource: string | null;
  registryNumber: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
  updatedAt: Date;
}): VerificationProfileDto {
  return {
    id: profile.id,
    status: profile.status,
    registrySource: profile.registrySource,
    registryNumber: profile.registryNumber,
    payload: metadataObject(profile.payload),
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString()
  };
}

function registrySourceFor(input: RegistryLookupInput) {
  if (input.entityType === 'company') return 'BRELA';
  if (input.entityType === 'business' && input.businessRegistrationSource === 'brela') return 'BRELA';
  return 'TRA';
}

function localRegistryMocksEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.APP_ENV !== 'production';
}

function localTemporaryAuthCodesEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.APP_ENV !== 'production';
}

function localEmailValidationFallback(): EmailValidationResult {
  return {
    provider: 'local-temporary-code',
    configured: false,
    accepted: true,
    reasons: ['Email validation unavailable; using local temporary activation code.'],
    score: 1,
    checks: {
      formatValid: true,
      mxFound: false,
      smtpCheck: false,
      disposable: false,
      role: false,
      free: false
    }
  };
}

function localRegistryMockPayload(input: RegistryLookupInput & { source: RegistrySource; registryNumber: string }) {
  const fetchedAt = new Date().toISOString();

  if (input.source === 'TRA' && ['1234567890', '1098765432', '555666777'].includes(input.registryNumber)) {
    const businessLike = input.entityType === 'business';
    const traRecordMap: Record<string, {
      individualName: string;
      businessName: string;
      registeredOn: string;
      taxOffice: string;
      location: string;
      activities: string[];
    }> = {
      '1234567890': {
        individualName: 'Asha Juma Mwinyi',
        businessName: 'Asha Juma Trading Enterprise',
        registeredOn: '2026-06-18',
        taxOffice: 'Ilala Tax Region',
        location: 'Dar es Salaam, Tanzania',
        activities: ['General supplies', 'Procurement services']
      },
      '1098765432': {
        individualName: 'Neema Ally Msuya',
        businessName: 'Neema Fresh Logistics',
        registeredOn: '2025-11-03',
        taxOffice: 'Arusha Tax Region',
        location: 'Arusha, Tanzania',
        activities: ['Cold chain logistics', 'Agricultural produce distribution']
      },
      '555666777': {
        individualName: 'Baraka Hassan Mrema',
        businessName: 'Mwanza Medical Supplies',
        registeredOn: '2024-08-21',
        taxOffice: 'Mwanza Tax Region',
        location: 'Mwanza, Tanzania',
        activities: ['Medical consumables', 'Hospital equipment distribution']
      }
    };
    const traRecord = traRecordMap[input.registryNumber];
    if (!traRecord) return null;
    const name = businessLike ? traRecord.businessName : traRecord.individualName;
    return {
      source: 'TRA' as const,
      registryNumber: input.registryNumber,
      entityType: input.entityType,
      name,
      status: 'MATCHED',
      confidence: 100,
      payload: {
        tin: input.registryNumber,
        taxpayerName: name,
        taxpayerType: businessLike ? 'Sole proprietor business' : 'Individual taxpayer',
        registrationStatus: 'Active',
        registeredOn: traRecord.registeredOn,
        taxOffice: traRecord.taxOffice,
        location: traRecord.location,
        localDevelopmentRecord: true,
        mockIdentifier: true,
        provider: 'LOCAL_TRA_MOCK',
        fetchedAt,
        businessActivities: businessLike ? traRecord.activities : [],
        summaryRows: [
          ['TIN', input.registryNumber],
          ['Taxpayer name', name],
          ['Taxpayer type', businessLike ? 'Business with TIN' : 'Individual'],
          ['Status', 'Active'],
          ['Tax office', traRecord.taxOffice]
        ]
      }
    };
  }

  if (input.source === 'BRELA' && ['987654321', 'BRN-2024-001', 'BN-778899'].includes(input.registryNumber)) {
    const businessLike = input.entityType === 'business';
    const brelaRecordMap: Record<string, {
      companyName: string;
      businessName: string;
      date: string;
      office: string;
      taxpayerTin: string;
      directors: string[];
      activities: string[];
    }> = {
      '987654321': {
        companyName: 'Local Test Supplies Limited',
        businessName: 'Local Test Supplies Business Name',
        date: '2026-06-18',
        office: 'Dar es Salaam, Tanzania',
        taxpayerTin: '1234567890',
        directors: ['Asha Juma Mwinyi', 'John Joseph Mrema'],
        activities: ['General supplies', 'Procurement services']
      },
      'BRN-2024-001': {
        companyName: 'Kilimanjaro Works Limited',
        businessName: 'Kilimanjaro Works',
        date: '2024-04-12',
        office: 'Moshi, Tanzania',
        taxpayerTin: '1098765432',
        directors: ['Neema Ally Msuya', 'Peter Elia Mosha'],
        activities: ['Civil works', 'Facilities maintenance']
      },
      'BN-778899': {
        companyName: 'Zanzibar Digital Services Limited',
        businessName: 'Zanzibar Digital Services',
        date: '2025-02-07',
        office: 'Mjini Magharibi, Tanzania',
        taxpayerTin: '555666777',
        directors: ['Fatma Said Kombo', 'Ali Hamad Omar'],
        activities: ['Software services', 'ICT equipment supply']
      }
    };
    const brelaRecord = brelaRecordMap[input.registryNumber];
    if (!brelaRecord) return null;
    const name = businessLike ? brelaRecord.businessName : brelaRecord.companyName;
    return {
      source: 'BRELA' as const,
      registryNumber: input.registryNumber,
      entityType: input.entityType,
      name,
      status: 'MATCHED',
      confidence: 100,
      payload: {
        registrationNumber: input.registryNumber,
        companyName: name,
        entityCategory: businessLike ? 'Registered business name' : 'Private limited company',
        incorporationDate: brelaRecord.date,
        registrationStatus: 'Active',
        principalOffice: brelaRecord.office,
        taxpayerTin: brelaRecord.taxpayerTin,
        localDevelopmentRecord: true,
        mockIdentifier: true,
        provider: 'LOCAL_BRELA_MOCK',
        fetchedAt,
        directors: businessLike ? [brelaRecord.directors[0]] : brelaRecord.directors,
        businessActivities: brelaRecord.activities,
        summaryRows: [
          ['Registered name', name],
          ['BRELA number', input.registryNumber],
          ['Entity category', businessLike ? 'Business name' : 'Company'],
          ['Status', 'Active'],
          ['Principal office', brelaRecord.office]
        ]
      }
    };
  }

  return null;
}

function registryPayload(record: {
  id: string;
  source: string;
  registryNumber: string;
  entityType: string;
  name: string;
  status: string;
  confidence: number;
  payload: Prisma.JsonValue;
}): RegistryRecordDto {
  return {
    id: record.id,
    source: record.source,
    registryNumber: record.registryNumber,
    entityType: record.entityType,
    name: record.name,
    status: record.status,
    confidence: record.confidence,
    payload: metadataObject(record.payload)
  };
}

function screeningStatus(value: unknown): ScreeningStatus {
  return value === 'CLEAR' || value === 'REVIEW' || value === 'BLOCKED' ? value : 'NOT_RUN';
}

function accessForUser(input: {
  accountType: AccountType;
  verificationStatus: VerificationStatus;
  capabilities: string[];
  trustTier?: TrustTier | null;
  riskLevel?: RiskLevel | null;
  latestScreeningStatus?: string | null;
}) {
  return computeAccessContext({
    accountType: input.accountType,
    verificationStatus: input.verificationStatus,
    capabilities: input.capabilities,
    trustTier: input.trustTier ?? undefined,
    riskLevel: input.riskLevel ?? undefined,
    screeningStatus: screeningStatus(input.latestScreeningStatus)
  });
}

export class ModuleService {
  constructor(
    private readonly repository = new ModuleRepository(),
    private readonly notifications: IdentityNotificationProvider = createIdentityNotifications(),
    private readonly registryProvider: RegistryProvider = new ProductionRegistryProvider(),
    private readonly screeningProvider: ScreeningProvider = new DeterministicScreeningProvider(),
    private readonly emailValidationProvider: EmailValidationProvider = new MailboxlayerEmailValidationProvider(),
    private readonly phoneValidationProvider: PhoneValidationProvider = new SendchampNumberInsightProvider()
  ) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  private trustEvaluation(input: {
    verificationStatus: VerificationStatus;
    screeningStatus: ScreeningStatus;
    registryConfidence?: number | null;
    hasDocuments?: boolean;
    hasCompleteProfile?: boolean;
    cleanActivity?: boolean;
    reviewReasons?: string[];
  }) {
    const reasons = [...(input.reviewReasons ?? [])];
    if (input.screeningStatus === 'BLOCKED') reasons.push('Screening result is blocked.');
    if (input.screeningStatus === 'REVIEW') reasons.push('Screening result requires review.');

    if (input.verificationStatus !== VerificationStatus.APPROVED || input.screeningStatus === 'BLOCKED') {
      return {
        trustTier: TrustTier.UNVERIFIED,
        riskLevel: input.screeningStatus === 'BLOCKED' ? RiskLevel.CRITICAL : input.screeningStatus === 'REVIEW' ? RiskLevel.HIGH : RiskLevel.MEDIUM,
        score: input.screeningStatus === 'BLOCKED' ? 5 : 25,
        reasons
      };
    }

    let score = 40;
    score += input.screeningStatus === 'CLEAR' ? 20 : 0;
    score += (input.registryConfidence ?? 0) >= 95 ? 5 : 0;
    score += input.hasCompleteProfile ? 10 : 0;
    score += input.hasDocuments ? 10 : 0;
    score += input.cleanActivity ? 15 : 0;

    const trustTier =
      score >= 90 ? TrustTier.GOLD :
      score >= 75 ? TrustTier.SILVER :
      score >= 60 ? TrustTier.BRONZE :
      TrustTier.VERIFIED;

    return {
      trustTier,
      riskLevel: input.screeningStatus === 'CLEAR' ? RiskLevel.LOW : RiskLevel.MEDIUM,
      score,
      reasons
    };
  }

  private async persistTrustEvaluation(input: {
    userId: string;
    organizationId?: string | null;
    verificationProfileId?: string | null;
    evaluation: ReturnType<ModuleService['trustEvaluation']>;
  }) {
    const reasons = input.evaluation.reasons as Prisma.InputJsonArray;
    if (input.organizationId) {
      return this.repository.upsertSupplierTrust({
        organizationId: input.organizationId,
        userId: input.userId,
        verificationProfileId: input.verificationProfileId,
        trustTier: input.evaluation.trustTier,
        riskLevel: input.evaluation.riskLevel,
        score: input.evaluation.score,
        reasons
      });
    }

    await this.repository.createTrustTierHistory({
      userId: input.userId,
      verificationProfileId: input.verificationProfileId,
      nextTier: input.evaluation.trustTier,
      riskLevel: input.evaluation.riskLevel,
      score: input.evaluation.score,
      reasons
    });
    return null;
  }

  private async runScreening(input: {
    userId: string;
    verificationProfileId?: string | null;
    organizationId?: string | null;
    registry: {
      source: string;
      registryNumber: string;
      entityType: string;
      name: string;
      status: string;
      confidence: number;
      payload: Prisma.JsonValue;
    };
    duplicateApprovedRegistryCount: number;
  }) {
    const result = await this.screeningProvider.screen({
      userId: input.userId,
      registrySource: input.registry.source,
      registryNumber: input.registry.registryNumber,
      entityType: input.registry.entityType,
      name: input.registry.name,
      registryStatus: input.registry.status,
      registryConfidence: input.registry.confidence,
      duplicateApprovedRegistryCount: input.duplicateApprovedRegistryCount,
      payload: metadataObject(input.registry.payload)
    });

    await this.repository.createScreeningCheck({
      userId: input.userId,
      verificationProfileId: input.verificationProfileId,
      organizationId: input.organizationId,
      provider: result.provider,
      status: result.status,
      reasons: result.reasons as Prisma.InputJsonArray,
      providerMetadata: inputJson(result.providerMetadata)
    });

    return result;
  }

  async recordAuthEvent(event: string, input: AuthAuditInput = {}) {
    await this.repository.createAuditEvent({
      actorUserId: input.userId ?? undefined,
      ownerOrgId: input.ownerOrgId ?? undefined,
      event,
      entityType: 'identity_auth',
      entityRef: input.entityRef ?? undefined,
      severity: input.severity ?? AuditSeverity.INFO,
      payload: inputJson({
        ...(input.details ?? {}),
        ...(input.target ? { targetHash: sha256(input.target) } : {}),
        ...(input.ipAddress ? { ipHash: sha256(input.ipAddress) } : {}),
        ...(input.userAgent ? { userAgentHash: sha256(input.userAgent) } : {})
      })
    });
  }

  private async validateAuthEmailDelivery(input: {
    email: string;
    userId?: string | null;
    entityRef?: string | null;
    purpose: 'registration_start' | 'email_activation' | 'password_reset';
    audit?: AuthAuditContext;
    unavailableMessage?: string;
  }) {
    let emailValidation: EmailValidationResult;
    try {
      emailValidation = await this.emailValidationProvider.validate({ email: input.email });
    } catch (error) {
      await this.recordAuthEvent(`identity.auth.${input.purpose}.email_validation_failed`, {
        ...input.audit,
        userId: input.userId,
        entityRef: input.entityRef,
        target: input.email,
        severity: AuditSeverity.ERROR,
        details: { provider: 'mailboxlayer', providerError: error instanceof Error ? error.message : 'Email validation failed.' }
      });
      if (isEmailValidationProviderFailure(error)) {
        throw requestError(input.unavailableMessage ?? 'Could not verify this email address. Please try again later.', 502);
      }
      throw error;
    }

    if (!emailValidation.accepted) {
      await this.recordAuthEvent(`identity.auth.${input.purpose}.email_validation_rejected`, {
        ...input.audit,
        userId: input.userId,
        entityRef: input.entityRef,
        target: input.email,
        severity: AuditSeverity.WARNING,
        details: emailValidationMetadata(emailValidation)
      });
      throw requestError(emailValidation.didYouMean ? `Email address could not be verified. Did you mean ${emailValidation.didYouMean}?` : 'Email address could not be verified.', 400);
    }

    return emailValidation;
  }

  private async validateAuthPhoneDelivery(input: {
    phone: string;
    userId?: string | null;
    entityRef?: string | null;
    purpose: 'registration_start' | 'phone_otp_resend';
    audit?: AuthAuditContext;
  }) {
    let phoneValidation: PhoneValidationResult;
    try {
      phoneValidation = await this.phoneValidationProvider.validate({ phone: input.phone });
    } catch (error) {
      await this.recordAuthEvent(`identity.auth.${input.purpose}.phone_validation_failed`, {
        ...input.audit,
        userId: input.userId,
        entityRef: input.entityRef,
        target: input.phone,
        severity: AuditSeverity.ERROR,
        details: {
          provider: 'sendchamp-number-insight',
          providerError: error instanceof Error ? error.message : 'Phone validation failed.'
        }
      });
      if (isPhoneValidationProviderFailure(error)) {
        throw requestError('Could not verify this phone number. Please try again later.', 502);
      }
      throw error;
    }

    if (!phoneValidation.accepted) {
      await this.recordAuthEvent(`identity.auth.${input.purpose}.phone_validation_rejected`, {
        ...input.audit,
        userId: input.userId,
        entityRef: input.entityRef,
        target: input.phone,
        severity: AuditSeverity.WARNING,
        details: phoneValidationMetadata(phoneValidation)
      });
      throw requestError('Phone number could not be verified.', 400);
    }

    return phoneValidation;
  }

  async startRegistration(input: RegistrationStartInput, audit?: AuthAuditContext) {
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    const location = assertValidTanzaniaLocation(input.location);
    assertValidE164Phone(phone);

    const existing = await this.repository.findUserByEmail(email);

    if (existing?.passwordHash) {
      throw requestError('An account already exists for this email.', 409);
    }

    const existingPhoneUser = await this.repository.findUserByPhone(phone);
    if (existingPhoneUser && existingPhoneUser.id !== existing?.id) {
      throw requestError('An account already exists for this phone number.', 409);
    }

    const phoneValidation = await this.validateAuthPhoneDelivery({ phone, purpose: 'registration_start', audit });
    const emailValidation = await this.validateAuthEmailDelivery({ email, purpose: 'registration_start', audit });

    let user = await this.repository.upsertRegistrationUser({
      email,
      phone,
      displayName: existing?.displayName ?? displayNameFromEmail(email)
    });
    if (location) {
      user = await this.repository.updateUser(user.id, {
        metadata: inputJson({
          ...metadataObject(user.metadata),
          location
        })
      });
    }
    const { challenge, devCode } = await this.createPhoneOtpChallenge(user.id, phone, email, audit, phoneValidation);
    await this.recordAuthEvent('identity.auth.registration_started', {
      ...audit,
      userId: user.id,
      entityRef: challenge.id,
      target: email,
      details: {
        phoneHash: sha256(phone),
        phoneValidation: phoneValidationMetadata(phoneValidation),
        emailValidation: emailValidationMetadata(emailValidation)
      }
    });

    return {
      user: toSessionUser(user),
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableAt: challengeResendAvailableAt(challenge.createdAt, resendCooldownSeconds),
      maxAttempts: maxChallengeAttempts,
      ...(devCode ? { devCode } : {})
    };
  }

  private async createPhoneOtpChallenge(userId: string, phone: string, email: string, audit?: AuthAuditContext, phoneValidation?: PhoneValidationResult) {
    await this.repository.replacePendingChallenges({ userId, purpose: phoneOtpPurpose, target: phone });
    const code = randomCode();
    const challenge = await this.repository.createChallenge({
      userId,
      purpose: phoneOtpPurpose,
      target: phone,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + phoneOtpMinutes * 60 * 1000),
      metadata: {
        email,
        delivery: { channel: 'sms', status: 'pending' },
        ...(phoneValidation ? { phoneValidation: phoneValidationMetadata(phoneValidation) } : {})
      }
    });

    try {
      const receipt = await this.notifications.sendPhoneOtp({ to: phone, code, expiresInMinutes: phoneOtpMinutes });
      const devCode = devCodeFromReceipt(receipt, code);
      await this.repository.updateChallenge(challenge.id, {
        metadata: inputJson({
          ...metadataObject(challenge.metadata),
          ...devChallengeMetadata(receipt, code),
          delivery: {
            channel: 'sms',
            status: 'sent',
            ...deliveryMetadata(receipt)
          }
        })
      });
      await this.recordAuthEvent('identity.auth.phone_otp_delivery_succeeded', {
        ...audit,
        userId,
        entityRef: challenge.id,
        target: phone,
        details: { provider: receipt.provider, messageId: receipt.messageId }
      });
      return { challenge, devCode };
    } catch (error) {
      await this.markChallengeDeliveryFailed(challenge.id, challenge.metadata, error);
      await this.recordAuthEvent('identity.auth.phone_otp_delivery_failed', {
        ...audit,
        userId,
        entityRef: challenge.id,
        target: phone,
        severity: AuditSeverity.ERROR
      });
      throw requestError('Could not send verification SMS. Please try again later.', 502);
    }
  }

  async resendOtp(challengeId: string, audit?: AuthAuditContext) {
    const existing = await this.repository.findChallenge(challengeId);
    if (!existing || existing.purpose !== phoneOtpPurpose) {
      throw requestError('OTP challenge was not found.', 404);
    }
    if (existing.status !== 'PENDING' || existing.expiresAt < new Date()) {
      throw requestError('OTP challenge is no longer valid.', 410);
    }
    if (!existing.user) throw requestError('OTP challenge is not linked to a user.', 400);
    assertResendAvailable(existing.createdAt);

    const phoneValidation = await this.validateAuthPhoneDelivery({
      phone: existing.target,
      userId: existing.user.id,
      entityRef: existing.id,
      purpose: 'phone_otp_resend',
      audit
    });
    await this.repository.updateChallenge(existing.id, { status: 'REPLACED', consumedAt: new Date() });
    const { challenge: next, devCode } = await this.createPhoneOtpChallenge(existing.user.id, existing.target, existing.user.email, audit, phoneValidation);
    await this.recordAuthEvent('identity.auth.phone_otp_resent', {
      ...audit,
      userId: existing.user.id,
      entityRef: next.id,
      target: existing.target,
      details: { previousChallengeId: existing.id, phoneValidation: phoneValidationMetadata(phoneValidation) }
    });
    return {
      challengeId: next.id,
      expiresAt: next.expiresAt.toISOString(),
      resendAvailableAt: challengeResendAvailableAt(next.createdAt, resendCooldownSeconds),
      maxAttempts: maxChallengeAttempts,
      ...(devCode ? { devCode } : {})
    };
  }

  private async createActivationChallenge(userId: string, email: string, metadata: Record<string, unknown>, audit?: AuthAuditContext) {
    let emailValidation: EmailValidationResult;
    try {
      emailValidation = await this.validateAuthEmailDelivery({
        email,
        userId,
        purpose: 'email_activation',
        audit,
        unavailableMessage: 'Could not verify this email address. Please try again later.'
      });
    } catch (error) {
      if (!localTemporaryAuthCodesEnabled() || (error as Error & { status?: number }).status !== 502) throw error;
      emailValidation = localEmailValidationFallback();
    }
    await this.repository.replacePendingChallenges({ userId, purpose: emailActivationPurpose, target: email });
    const activationCode = randomToken(8);
    const activation = await this.repository.createChallenge({
      userId,
      purpose: emailActivationPurpose,
      target: email,
      codeHash: sha256(activationCode),
      expiresAt: new Date(Date.now() + activationMinutes * 60 * 1000),
      metadata: {
        ...metadata,
        delivery: { channel: 'email', status: 'pending' }
      }
    });

    try {
      const receipt = await this.notifications.sendEmailActivation({
        to: email,
        code: activationCode,
        expiresInMinutes: activationMinutes
      });
      const devCode = devCodeFromReceipt(receipt, activationCode) ?? (localTemporaryAuthCodesEnabled() ? activationCode : undefined);
      await this.repository.updateChallenge(activation.id, {
        metadata: inputJson({
          ...metadataObject(activation.metadata),
          ...(devCode ? { devCode } : {}),
          delivery: {
            channel: 'email',
            status: 'sent',
            ...deliveryMetadata(receipt),
            emailValidation: emailValidationMetadata(emailValidation)
          }
        })
      });
      await this.recordAuthEvent('identity.auth.email_activation_delivery_succeeded', {
        ...audit,
        userId,
        entityRef: activation.id,
        target: email,
        details: { provider: receipt.provider, messageId: receipt.messageId, emailValidation: emailValidationMetadata(emailValidation) }
      });
      return { challenge: activation, devCode };
    } catch (error) {
      if (localTemporaryAuthCodesEnabled()) {
        const fallbackActivation = await this.repository.updateChallenge(activation.id, {
          metadata: inputJson({
            ...metadataObject(activation.metadata),
            devCode: activationCode,
            delivery: {
              channel: 'email',
              status: 'sent',
              provider: 'local-temporary-code',
              emailValidation: emailValidationMetadata(emailValidation)
            }
          })
        });
        await this.recordAuthEvent('identity.auth.email_activation_delivery_succeeded', {
          ...audit,
          userId,
          entityRef: activation.id,
          target: email,
          details: {
            provider: 'local-temporary-code',
            fallbackReason: error instanceof Error ? error.message : 'Email delivery failed.',
            emailValidation: emailValidationMetadata(emailValidation)
          }
        });
        return { challenge: fallbackActivation, devCode: activationCode };
      }
      await this.markChallengeDeliveryFailed(activation.id, activation.metadata, error);
      await this.recordAuthEvent('identity.auth.email_activation_delivery_failed', {
        ...audit,
        userId,
        entityRef: activation.id,
        target: email,
        severity: AuditSeverity.ERROR
      });
      throw requestError('Could not send activation email. Please try again later.', 502);
    }
  }

  async resendActivation(challengeId: string, audit?: AuthAuditContext) {
    const existing = await this.repository.findChallenge(challengeId);
    if (!existing || existing.purpose !== emailActivationPurpose) {
      throw requestError('Activation challenge was not found.', 404);
    }
    if (existing.status !== 'PENDING' || existing.expiresAt < new Date()) {
      throw requestError('Activation challenge is no longer valid.', 410);
    }
    if (!existing.user) throw requestError('Activation challenge is not linked to a user.', 400);
    assertResendAvailable(existing.createdAt);

    await this.repository.updateChallenge(existing.id, { status: 'REPLACED', consumedAt: new Date() });
    const { challenge: next, devCode } = await this.createActivationChallenge(existing.user.id, existing.user.email, {
      ...metadataObject(existing.metadata),
      previousChallengeId: existing.id
    }, audit);
    await this.recordAuthEvent('identity.auth.email_activation_resent', {
      ...audit,
      userId: existing.user.id,
      entityRef: next.id,
      target: existing.user.email,
      details: { previousChallengeId: existing.id }
    });
    return {
      activationChallengeId: next.id,
      expiresAt: next.expiresAt.toISOString(),
      resendAvailableAt: challengeResendAvailableAt(next.createdAt, resendCooldownSeconds),
      ...(devCode ? { devCode } : {})
    };
  }

  async verifyOtp(challengeId: string, code: string, audit?: AuthAuditContext) {
    const challenge = await this.repository.findChallenge(challengeId);
    if (!challenge || challenge.purpose !== phoneOtpPurpose) {
      throw requestError('OTP challenge was not found.', 404);
    }
    if (challenge.status !== 'PENDING' || challenge.expiresAt < new Date()) {
      throw requestError('OTP challenge is no longer valid.', 410);
    }
    if (challenge.attempts >= maxChallengeAttempts) {
      throw requestError('Too many OTP attempts. Please request a new code.', 429);
    }
    if (challenge.codeHash !== sha256(code)) {
      await this.repository.incrementChallengeAttempts(challenge.id);
      await this.recordAuthEvent('identity.auth.phone_otp_failed_attempt', {
        ...audit,
        userId: challenge.userId,
        entityRef: challenge.id,
        target: challenge.target,
        severity: AuditSeverity.WARNING
      });
      throw requestError('OTP code is incorrect.', 400);
    }
    if (!challenge.user) throw requestError('OTP challenge is not linked to a user.', 400);

    const user = challenge.user;
    const { challenge: activation, devCode } = await this.createActivationChallenge(user.id, user.email, { phoneChallengeId: challenge.id }, audit);
    await this.repository.consumeChallenge(challenge.id);

    const userMetadata = metadataObject(user.metadata);
    await this.repository.updateUser(user.id, {
      metadata: inputJson({
        ...userMetadata,
        phoneVerified: true,
        phoneVerifiedAt: new Date().toISOString()
      })
    });

    await this.recordAuthEvent('identity.auth.phone_otp_verified', {
      ...audit,
      userId: user.id,
      entityRef: challenge.id,
      target: challenge.target
    });

    return {
      activationChallengeId: activation.id,
      expiresAt: activation.expiresAt.toISOString(),
      resendAvailableAt: challengeResendAvailableAt(activation.createdAt, resendCooldownSeconds),
      ...(devCode ? { devCode } : {})
    };
  }

  async activateEmail(challengeId: string, code: string, audit?: AuthAuditContext) {
    const challenge = await this.repository.findChallenge(challengeId);
    if (!challenge || challenge.purpose !== emailActivationPurpose) {
      throw requestError('Activation challenge was not found.', 404);
    }
    if (challenge.status !== 'PENDING' || challenge.expiresAt < new Date()) {
      throw requestError('Activation challenge is no longer valid.', 410);
    }
    if (challenge.attempts >= maxChallengeAttempts) {
      throw requestError('Too many activation attempts. Please request a new activation email.', 429);
    }
    if (challenge.codeHash !== sha256(code)) {
      await this.repository.incrementChallengeAttempts(challenge.id);
      await this.recordAuthEvent('identity.auth.email_activation_failed_attempt', {
        ...audit,
        userId: challenge.userId,
        entityRef: challenge.id,
        target: challenge.target,
        severity: AuditSeverity.WARNING
      });
      throw requestError('Activation code is incorrect.', 400);
    }
    if (!challenge.user) throw requestError('Activation challenge is not linked to a user.', 400);

    const consumed = await this.repository.consumeChallenge(challenge.id);
    const user = consumed.user;
    if (!user) throw requestError('Activation challenge is not linked to a user.', 400);

    const userMetadata = metadataObject(user.metadata);
    const updated = await this.repository.updateUser(user.id, {
      metadata: inputJson({
        ...userMetadata,
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString()
      })
    });

    await this.recordAuthEvent('identity.auth.email_activated', {
      ...audit,
      userId: user.id,
      entityRef: challenge.id,
      target: user.email
    });

    return { user: toSessionUser(updated) };
  }

  async setPassword(emailInput: string, password: string, legalAcceptance?: LegalAcceptanceInput, audit?: AuthAuditContext) {
    const email = normalizeEmail(emailInput);
    const user = await this.repository.findUserByEmail(email);
    if (!user) throw requestError('Account was not found.', 404);
    if (!legalAcceptance) throw requestError('Terms and privacy acceptance is required.', 400);

    const metadata = metadataObject(user.metadata);
    if (!metadata.phoneVerified || !metadata.emailVerified) {
      throw requestError('Verify phone and email before setting a password.', 409);
    }

    const passwordHash = await hashPassword(password);
    const updated = await this.repository.updateUser(user.id, { passwordHash });
    await this.repository.upsertPasswordAccount(updated.id, updated.email);
    await this.recordLegalAcceptance(updated.id, legalAcceptance);
    await this.recordAuthEvent('identity.auth.password_set', {
      ...audit,
      userId: updated.id,
      target: updated.email
    });

    return { user: toSessionUser(updated) };
  }

  private async recordLegalAcceptance(userId: string, input: LegalAcceptanceInput) {
    if (!input.termsAccepted || !input.privacyAccepted) {
      throw requestError('Terms and privacy acceptance is required.', 400);
    }

    const [termsVersion, privacyVersion] = await Promise.all([
      input.termsVersionId
        ? this.repository.findPublicPageVersionById(input.termsVersionId)
        : this.repository.findCurrentPublicPageVersion(PublicPageKey.TERMS_AND_CONDITIONS),
      input.privacyVersionId
        ? this.repository.findPublicPageVersionById(input.privacyVersionId)
        : this.repository.findCurrentPublicPageVersion(PublicPageKey.PRIVACY_POLICY)
    ]);

    if (!termsVersion || termsVersion.pageKey !== PublicPageKey.TERMS_AND_CONDITIONS) {
      throw requestError('Current Terms and Conditions version was not found.', 409);
    }
    if (!privacyVersion || privacyVersion.pageKey !== PublicPageKey.PRIVACY_POLICY) {
      throw requestError('Current Privacy Policy version was not found.', 409);
    }

    await this.repository.createUserPolicyAcceptance({
      userId,
      termsVersionId: termsVersion.id,
      privacyVersionId: privacyVersion.id,
      source: input.source,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      payload: inputJson({
        termsVersion: termsVersion.version,
        privacyVersion: privacyVersion.version,
        acceptedAt: new Date().toISOString()
      })
    });
  }

  async signIn(emailInput: string, password: string, audit?: AuthAuditContext): Promise<AuthSessionDto> {
    const email = normalizeEmail(emailInput);
    const user = await this.repository.findUserByEmail(email);
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      await this.recordAuthEvent('identity.auth.sign_in_failed', {
        ...audit,
        userId: user?.id,
        target: email,
        severity: AuditSeverity.WARNING
      });
      throw requestError('Invalid email or password.', 401);
    }

    const token = randomToken();
    const expiresAt = new Date(Date.now() + sessionDays * 24 * 60 * 60 * 1000);
    const isFirstSignIn = !(await this.repository.hasPriorSession(user.id));
    const session = await this.repository.createSession({
      userId: user.id,
      organizationId: user.memberships[0]?.organization.id,
      tokenHash: sha256(token),
      expiresAt
    });

    await this.recordAuthEvent('identity.auth.sign_in_succeeded', {
      ...audit,
      userId: user.id,
      ownerOrgId: user.memberships[0]?.organization.id,
      entityRef: session.id,
      target: email
    });

    return {
      token,
      user: toSessionUserFromSession(session),
      expiresAt: expiresAt.toISOString(),
      isFirstSignIn
    };
  }

  async forgotPassword(emailInput: string, audit?: AuthAuditContext) {
    const email = normalizeEmail(emailInput);
    const user = await this.repository.findUserByEmail(email);

    if (!user?.passwordHash) {
      await this.recordAuthEvent('identity.auth.password_reset_requested', {
        ...audit,
        target: email,
        details: { accountFound: false }
      });
      return {
        ok: true,
        message: passwordResetRequestedMessage
      };
    }

    await this.recordAuthEvent('identity.auth.password_reset_requested', {
      ...audit,
      userId: user.id,
      target: email,
      details: { accountFound: true }
    });
    try {
      await this.createPasswordResetChallenge(user.id, email, audit);
    } catch (error) {
      await this.recordAuthEvent('identity.auth.password_reset_request_suppressed_failure', {
        ...audit,
        userId: user.id,
        target: email,
        severity: AuditSeverity.ERROR,
        details: { error: error instanceof Error ? error.message : 'Password reset request failed.' }
      });
    }

    return {
      ok: true,
      message: passwordResetRequestedMessage
    };
  }

  private async createPasswordResetChallenge(userId: string, email: string, audit?: AuthAuditContext) {
    const emailValidation = await this.validateAuthEmailDelivery({
      email,
      userId,
      purpose: 'password_reset',
      audit,
      unavailableMessage: 'Could not send password reset email. Please try again later.'
    });
    await this.repository.replacePendingChallenges({ userId, purpose: passwordResetPurpose, target: email });
    const code = randomCode();
    const challenge = await this.repository.createChallenge({
      userId,
      purpose: passwordResetPurpose,
      target: email,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + passwordResetMinutes * 60 * 1000),
      metadata: {
        email,
        delivery: { channel: 'email', status: 'pending' }
      }
    });

    try {
      const receipt = await this.notifications.sendPasswordReset({
        to: email,
        code,
        expiresInMinutes: passwordResetMinutes,
        actionUrl: passwordResetActionUrl(challenge.id, code)
      });
      await this.repository.updateChallenge(challenge.id, {
        metadata: inputJson({
          ...metadataObject(challenge.metadata),
          ...devChallengeMetadata(receipt, code),
          delivery: {
            channel: 'email',
            status: 'sent',
            ...deliveryMetadata(receipt),
            emailValidation: emailValidationMetadata(emailValidation)
          }
        })
      });
      await this.recordAuthEvent('identity.auth.password_reset_delivery_succeeded', {
        ...audit,
        userId,
        entityRef: challenge.id,
        target: email,
        details: { provider: receipt.provider, messageId: receipt.messageId, emailValidation: emailValidationMetadata(emailValidation) }
      });
    } catch (error) {
      await this.markChallengeDeliveryFailed(challenge.id, challenge.metadata, error);
      await this.recordAuthEvent('identity.auth.password_reset_delivery_failed', {
        ...audit,
        userId,
        entityRef: challenge.id,
        target: email,
        severity: AuditSeverity.ERROR
      });
      throw requestError('Could not send password reset email. Please try again later.', 502);
    }

    return challenge;
  }

  async resendResetCode(challengeId: string, audit?: AuthAuditContext) {
    const existing = await this.repository.findChallenge(challengeId);
    if (!existing || existing.purpose !== passwordResetPurpose) {
      throw requestError('Password reset request was not found.', 404);
    }
    if (existing.status !== 'PENDING' || existing.expiresAt < new Date()) {
      throw requestError('Password reset request is no longer valid.', 410);
    }
    if (!existing.user) throw requestError('Password reset request is not linked to a user.', 400);
    assertResendAvailable(existing.createdAt);

    await this.repository.updateChallenge(existing.id, { status: 'REPLACED', consumedAt: new Date() });
    const next = await this.createPasswordResetChallenge(existing.user.id, existing.target, audit);
    await this.recordAuthEvent('identity.auth.password_reset_resent', {
      ...audit,
      userId: existing.user.id,
      entityRef: next.id,
      target: existing.target,
      details: { previousChallengeId: existing.id }
    });
    return {
      ok: true,
      message: passwordResetRequestedMessage,
      challengeId: next.id,
      expiresAt: next.expiresAt.toISOString(),
      resendAvailableAt: challengeResendAvailableAt(next.createdAt, resendCooldownSeconds)
    };
  }

  private async markChallengeDeliveryFailed(challengeId: string, metadata: unknown, error: unknown) {
    const existingDelivery = metadataObject(metadataObject(metadata).delivery);
    await this.repository.updateChallenge(challengeId, {
      status: 'DELIVERY_FAILED',
      consumedAt: new Date(),
      metadata: inputJson({
        ...metadataObject(metadata),
        delivery: {
          ...existingDelivery,
          status: 'failed',
          failedAt: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Delivery failed.'
        }
      })
    });
  }

  async resetPassword(challengeId: string, code: string, password: string, audit?: AuthAuditContext) {
    const challenge = await this.repository.findChallenge(challengeId);
    if (!challenge || challenge.purpose !== passwordResetPurpose) {
      throw requestError('Password reset request was not found.', 404);
    }
    if (challenge.status !== 'PENDING' || challenge.expiresAt < new Date()) {
      throw requestError('Password reset request is no longer valid.', 410);
    }
    if (challenge.attempts >= maxChallengeAttempts) {
      throw requestError('Too many password reset attempts. Please request a new code.', 429);
    }
    if (challenge.codeHash !== sha256(code)) {
      await this.repository.incrementChallengeAttempts(challenge.id);
      await this.recordAuthEvent('identity.auth.password_reset_failed_attempt', {
        ...audit,
        userId: challenge.userId,
        entityRef: challenge.id,
        target: challenge.target,
        severity: AuditSeverity.WARNING
      });
      throw requestError('Password reset code is incorrect.', 400);
    }
    if (!challenge.user) throw requestError('Password reset request is not linked to a user.', 400);

    const consumed = await this.repository.consumeChallenge(challenge.id);
    const user = consumed.user;
    if (!user) throw requestError('Password reset request is not linked to a user.', 400);

    const passwordHash = await hashPassword(password);
    const updated = await this.repository.updateUser(user.id, { passwordHash });
    await this.repository.upsertPasswordAccount(updated.id, updated.email);
    await this.repository.revokeSessionsForUser(updated.id);
    await this.recordAuthEvent('identity.auth.password_reset_succeeded', {
      ...audit,
      userId: updated.id,
      entityRef: challenge.id,
      target: updated.email
    });

    return {
      ok: true,
      user: toSessionUser(updated)
    };
  }

  async sessionFromToken(token: string) {
    const session = await this.repository.findActiveSession(sha256(token));
    if (!session) throw requestError('Session is invalid or expired.', 401);
    return {
      user: toSessionUserFromSession(session),
      expiresAt: session.expiresAt.toISOString()
    };
  }

  async accessMe(token?: string) {
    const session = await this.requireSession(token);
    return session.user;
  }

  async preferences(token?: string) {
    const { user } = await this.requireSession(token);
    const preference = await this.repository.findPreference(user.id);
    return preferenceDto(preference);
  }

  async updatePreferences(token: string | undefined, input: { preferredLanguage: 'en' | 'sw'; timezone?: string }, audit?: AuthAuditContext) {
    const { user } = await this.requireSession(token);
    const previous = await this.repository.findPreference(user.id);
    const preference = await this.repository.upsertPreference({
      userId: user.id,
      preferredLanguage: input.preferredLanguage,
      timezone: input.timezone,
      metadata: inputJson({
        updatedFrom: 'account_menu',
        updatedAt: new Date().toISOString()
      })
    });

    if (previous?.preferredLanguage !== preference.preferredLanguage) {
      await this.recordAuthEvent('identity.preferences.language_changed', {
        ...audit,
        userId: user.id,
        ownerOrgId: user.organizationId,
        entityRef: preference.id,
        details: {
          previousLanguage: previous?.preferredLanguage ?? 'en',
          preferredLanguage: preference.preferredLanguage
        }
      });
    }

    return preferenceDto(preference);
  }

  async recordAccountActivity(token: string | undefined, event: 'identity.profile.opened' | 'communication.messages.opened' | 'support.help.opened', audit?: AuthAuditContext) {
    const { user } = await this.requireSession(token);
    await this.recordAuthEvent(event, {
      ...audit,
      userId: user.id,
      ownerOrgId: user.organizationId,
      details: { source: 'account_menu' }
    });
    return { ok: true };
  }

  async signOut(token: string, audit?: AuthAuditContext) {
    const tokenHash = sha256(token);
    const session = await this.repository.findActiveSession(tokenHash);
    await this.repository.revokeSession(tokenHash);
    await this.recordAuthEvent('identity.auth.sign_out', {
      ...audit,
      userId: session?.user.id,
      ownerOrgId: session?.organization?.id,
      entityRef: session?.id
    });
    return { ok: true };
  }

  async requireSession(token?: string) {
    if (!token) throw requestError('Authentication is required.', 401);
    return this.sessionFromToken(token);
  }

  async requireAdmin(token?: string) {
    const session = await this.requireSession(token);
    if (session.user.accountType !== AccountType.ADMIN) {
      throw requestError('Admin access is required.', 403);
    }
    return session;
  }

  async requirePermission(token: string | undefined, permission: PermissionName) {
    const session = await this.requireSession(token);
    assertPermission(session.user, permission);
    return session;
  }

  private async localRegistryMock(input: RegistryLookupInput & { source: RegistrySource; registryNumber: string }) {
    if (!localRegistryMocksEnabled()) return null;

    const mock = localRegistryMockPayload(input);
    if (!mock) return null;

    return this.repository.upsertRegistryRecord({
      source: mock.source,
      registryNumber: mock.registryNumber,
      entityType: mock.entityType,
      name: mock.name,
      status: mock.status,
      confidence: mock.confidence,
      payload: inputJson(mock.payload)
    });
  }

  async registryLookup(input: RegistryLookupInput, audit?: AuthAuditContext) {
    const source = registrySourceFor(input) as RegistrySource;
    const registryNumber = input.registryNumber.trim();
    let record;

    try {
      const provided = await this.registryProvider.lookup({
        source,
        entityType: input.entityType,
        businessRegistrationSource: input.businessRegistrationSource,
        registryNumber
      });
      if (provided) {
        record = await this.repository.upsertRegistryRecord({
          source: provided.source,
          registryNumber: provided.registryNumber,
          entityType: provided.entityType,
          name: provided.name,
          status: provided.status,
          confidence: provided.confidence,
          payload: inputJson({
            ...provided.payload,
            fetchedAt: new Date().toISOString(),
            provider: provided.source
          })
        });
      }
    } catch (error) {
      await this.recordAuthEvent('identity.verification.registry_lookup_failed', {
        ...audit,
        severity: AuditSeverity.WARNING,
        target: registryNumber,
        details: { source, reason: 'provider_failure' }
      });
      if (isRegistryProviderFailure(error)) {
        throw requestError(`${source} registry lookup is not available right now.`, 502);
      }
      throw error;
    }

    if (!record) {
      record = await this.localRegistryMock({ ...input, source, registryNumber });
    }

    if (!record && localRegistryMocksEnabled()) {
      record = await this.repository.findRegistryRecord(source, registryNumber);
    }

    if (!record || record.entityType !== input.entityType) {
      await this.recordAuthEvent('identity.verification.registry_lookup_failed', {
        ...audit,
        severity: AuditSeverity.WARNING,
        target: registryNumber,
        details: { source, reason: 'not_found' }
      });
      throw requestError('No matching registry record was found.', 404);
    }

    await this.recordAuthEvent('identity.verification.registry_lookup_succeeded', {
      ...audit,
      target: registryNumber,
      entityRef: record.id,
      details: { source, confidence: record.confidence }
    });

    return registryPayload(record);
  }

  async getVerificationMe(token?: string) {
    const { user } = await this.requireSession(token);
    const profile = await this.repository.latestVerificationProfile(user.id);
    return {
      user,
      verification: profile ? toProfileDto(profile) : null
    };
  }

  async getSignatureStatus(token?: string): Promise<SigningCredentialStatusDto> {
    const { user } = await this.requireSession(token);
    const credential = await this.repository.findActiveSigningCredential(user.id);
    return signatureStatusDto(credential);
  }

  async requestSignature(token: string | undefined, input: { keyphrase: string; repeatedKeyphrase: string }, audit?: AuthAuditContext): Promise<SigningCredentialStatusDto> {
    const { user } = await this.requireSession(token);
    validateRepeatedKeyphrase(input.keyphrase, input.repeatedKeyphrase);

    const existing = await this.repository.findActiveSigningCredential(user.id);
    if (existing) throw requestError('A digital signature keyphrase is already active. Revoke it before requesting a new signature.', 409);

    const encrypted = await createEncryptedSigningCredential(input.keyphrase);
    const credential = await this.repository.createSigningCredential({
      userId: user.id,
      publicKeyPem: encrypted.publicKeyPem,
      keyFingerprint: encrypted.keyFingerprint,
      encryptedPrivateKey: encrypted.encryptedPrivateKey,
      kdfMetadata: inputJson(encrypted.kdfMetadata),
      encryptionMetadata: inputJson(encrypted.encryptionMetadata),
      providerMetadata: inputJson(encrypted.providerMetadata)
    });

    await this.recordAuthEvent('identity.signature.requested', {
      ...audit,
      userId: user.id,
      entityRef: credential.id,
      details: { keyFingerprint: credential.keyFingerprint }
    });

    return signatureStatusDto(credential);
  }

  async testSignature(token: string | undefined, input: { keyphrase: string }, audit?: AuthAuditContext) {
    const { user } = await this.requireSession(token);
    const credential = await this.repository.findActiveSigningCredential(user.id);
    if (!credential) throw requestError('Create a digital signature keyphrase before signing.', 409);

    const canonicalPayload = canonicalJson({
      purpose: 'SIGNATURE_TEST',
      userId: user.id,
      issuedAt: new Date().toISOString()
    });
    const canonicalPayloadHash = sha256(canonicalPayload);
    const signed = await signCanonicalPayloadHash(credential, input.keyphrase, canonicalPayloadHash);

    await this.recordAuthEvent('identity.signature.tested', {
      ...audit,
      userId: user.id,
      entityRef: credential.id,
      details: { keyFingerprint: credential.keyFingerprint }
    });

    return {
      ok: true,
      canonicalPayloadHash,
      signatureHash: signed.signatureHash,
      providerMetadata: signed.providerMetadata
    };
  }

  async revokeSignature(token: string | undefined, audit?: AuthAuditContext): Promise<SigningCredentialStatusDto> {
    const { user } = await this.requireSession(token);
    await this.repository.revokeActiveSigningCredential(user.id);
    await this.recordAuthEvent('identity.signature.revoked', {
      ...audit,
      userId: user.id
    });
    return signatureStatusDto(null);
  }

  async saveVerificationDraft(token: string | undefined, input: VerificationPayloadInput, audit?: AuthAuditContext) {
    const { user } = await this.requireSession(token);
    const existing = await this.repository.latestVerificationProfile(user.id);
    assertValidTanzaniaLocation(input.location);
    const { signatureKeyphrase: _signatureKeyphrase, ...safeInput } = input;
    const payload = inputJson({
      ...metadataObject(existing?.payload),
      ...safeInput,
      savedAt: new Date().toISOString()
    });

    const profile = await this.repository.upsertVerificationProfile({
      userId: user.id,
      organizationId: user.organizationId,
      status: VerificationStatus.DRAFT,
      registrySource: input.registrySource ?? existing?.registrySource,
      registryNumber: input.registryNumber ?? existing?.registryNumber,
      payload
    });

    await this.repository.updateUser(user.id, { verificationStatus: VerificationStatus.DRAFT });
    await this.repository.createVerificationHistory({
      verificationProfileId: profile.id,
      userId: user.id,
      organizationId: user.organizationId,
      status: VerificationStatus.DRAFT,
      registrySource: profile.registrySource,
      registryNumber: profile.registryNumber,
      event: 'draft_saved',
      payload
    });
    await this.recordAuthEvent('identity.verification.draft_saved', {
      ...audit,
      userId: user.id,
      ownerOrgId: user.organizationId,
      entityRef: profile.id
    });
    return toProfileDto(profile);
  }

  async updateProfile(token: string | undefined, input: { profile: Record<string, unknown>; documents?: Record<string, unknown>[] }) {
    const { user } = await this.requireSession(token);
    const existing = await this.repository.latestVerificationProfile(user.id);
    const profileInput = { ...input.profile };
    if (profileInput.location !== undefined) {
      profileInput.location = assertValidTanzaniaLocation(profileInput.location);
    }
    const payload = inputJson({
      ...metadataObject(existing?.payload),
      profile: profileInput,
      documents: input.documents ?? metadataObject(existing?.payload).documents ?? [],
      profileSavedAt: new Date().toISOString()
    });
    const profile = await this.repository.upsertVerificationProfile({
      userId: user.id,
      organizationId: user.organizationId,
      status: existing?.status ?? VerificationStatus.DRAFT,
      registrySource: existing?.registrySource,
      registryNumber: existing?.registryNumber,
      payload
    });

    await this.repository.createVerificationHistory({
      verificationProfileId: profile.id,
      userId: user.id,
      organizationId: user.organizationId,
      status: profile.status,
      registrySource: profile.registrySource,
      registryNumber: profile.registryNumber,
      event: 'profile_updated',
      payload
    });
    await this.recordAuthEvent('identity.verification.profile_updated', {
      userId: user.id,
      ownerOrgId: user.organizationId,
      entityRef: profile.id
    });

    return toProfileDto(profile);
  }

  async submitVerification(
    token: string | undefined,
    input: Required<Pick<VerificationPayloadInput, 'entityType' | 'registrySource' | 'registryNumber' | 'registryVerified' | 'registryRecordId' | 'signatureName' | 'signatureConsent'>> & VerificationPayloadInput,
    audit?: AuthAuditContext
  ) {
    const { user } = await this.requireSession(token);
    const fullUser = await this.repository.findUserById(user.id);
    if (!fullUser) throw requestError('Current user was not found.', 404);

    const registry = await this.repository.findRegistryRecord(input.registrySource, input.registryNumber);
    if (!registry || registry.id !== input.registryRecordId) {
      throw requestError('Registry record must be fetched before submitting verification.', 409);
    }

    const signingCredential = await this.repository.findActiveSigningCredential(fullUser.id);
    if (!signingCredential) throw requestError('Create a digital signature keyphrase before submitting verification.', 409);
    if (!input.signatureKeyphrase) throw requestError('Digital signature keyphrase is required.', 409);
    const location = assertValidTanzaniaLocation(input.location, true);

    const userMetadata = metadataObject(fullUser.metadata);
    const duplicateCount = await this.repository.countApprovedRegistryDuplicates({
      userId: fullUser.id,
      registrySource: registry.source,
      registryNumber: registry.registryNumber
    });

    const reviewReasons: string[] = [];
    if (!userMetadata.phoneVerified) reviewReasons.push('Phone number is not verified.');
    if (!userMetadata.emailVerified) reviewReasons.push('Email address is not activated.');
    if (!input.registryVerified) reviewReasons.push('Registry information was not confirmed.');
    if (registry.status !== 'MATCHED' || registry.confidence < 90) reviewReasons.push('Registry confidence requires admin review.');
    if (!input.signatureConsent) reviewReasons.push('Digital signature consent is missing.');
    if (duplicateCount > 0) reviewReasons.push('Another approved account already uses this registry number.');

    const screening = await this.runScreening({
      userId: fullUser.id,
      registry,
      duplicateApprovedRegistryCount: duplicateCount
    });
    for (const reason of screening.reasons) {
      if (!reviewReasons.includes(reason)) reviewReasons.push(reason);
    }

    const autoApproved = reviewReasons.length === 0 && screening.status === 'CLEAR';
    const status = autoApproved ? VerificationStatus.APPROVED : VerificationStatus.PENDING;
    const organization = autoApproved
      ? await this.repository.createOrUpdateVerifiedOrganization({
          userId: fullUser.id,
          organizationName: registry.name,
          entityType: input.entityType,
          registrySource: registry.source,
          registryNumber: registry.registryNumber
        })
      : null;

    const { signatureKeyphrase: _signatureKeyphrase, ...safeInput } = input;
    const basePayload = {
      ...safeInput,
      location,
      registryRecord: registryPayload(registry),
      verifiedName: registry.name,
      reviewReasons,
      autoApproved,
      screening: {
        provider: screening.provider,
        status: screening.status,
        reasons: screening.reasons,
        providerMetadata: screening.providerMetadata
      },
      submittedAt: new Date().toISOString()
    };

    let profile = await this.repository.upsertVerificationProfile({
      userId: fullUser.id,
      organizationId: organization?.id ?? user.organizationId,
      status,
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      payload: inputJson(basePayload)
    });

    const signedPayload = {
      verificationProfileId: profile.id,
      userId: fullUser.id,
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      registryRecordId: registry.id,
      entityType: input.entityType,
      signerName: input.signatureName.trim(),
      signerTitle: input.signatureTitle?.trim() ?? '',
      consentVersion: input.signatureConsentVersion ?? '2026.06.06',
      consentTitle: input.signatureConsentTitle ?? 'ProcureX identity verification signature consent',
      signatureCredentialId: signingCredential.id,
      keyFingerprint: signingCredential.keyFingerprint,
      signedAt: new Date().toISOString()
    };
    const canonicalPayload = canonicalJson(signedPayload);
    const canonicalPayloadHash = sha256(canonicalPayload);
    const signed = await signCanonicalPayloadHash(signingCredential, input.signatureKeyphrase, canonicalPayloadHash);
    const signature = await this.repository.createDigitalSignature({
      verificationProfileId: profile.id,
      userId: fullUser.id,
      organizationId: organization?.id ?? user.organizationId,
      signerName: signedPayload.signerName,
      signerTitle: signedPayload.signerTitle || null,
      consentVersion: signedPayload.consentVersion,
      consentTitle: signedPayload.consentTitle,
      canonicalPayloadHash,
      signatureHash: signed.signatureHash,
      metadata: inputJson({
        ...(audit?.ipAddress ? { ipHash: sha256(audit.ipAddress) } : {}),
        ...(audit?.userAgent ? { userAgentHash: sha256(audit.userAgent) } : {})
      }),
      providerMetadata: inputJson({
        ...signed.providerMetadata,
        signatureCredentialId: signingCredential.id
      }),
      blockchainMetadata: inputJson({ anchorStatus: 'PENDING_IMPLEMENTATION' })
    });

    const payload = inputJson({
      ...basePayload,
      digitalSignature: {
        id: signature.id,
        status: signature.status,
        signedAt: signature.signedAt.toISOString(),
        canonicalPayloadHash: signature.canonicalPayloadHash,
        signatureHash: signature.signatureHash,
        keyFingerprint: signingCredential.keyFingerprint,
        consentVersion: signature.consentVersion,
        consentTitle: signature.consentTitle,
        blockchainAnchorStatus: 'PENDING_IMPLEMENTATION'
      }
    });

    profile = await this.repository.upsertVerificationProfile({
      userId: fullUser.id,
      organizationId: organization?.id ?? user.organizationId,
      status,
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      payload
    });

    const trustEvaluation = this.trustEvaluation({
      verificationStatus: status,
      screeningStatus: screening.status,
      registryConfidence: registry.confidence,
      hasCompleteProfile: Boolean(metadataObject(payload.profile).displayName || metadataObject(payload).verifiedName),
      hasDocuments: metadataArray(metadataObject(payload).documents).length > 0,
      reviewReasons
    });
    await this.persistTrustEvaluation({
      userId: fullUser.id,
      organizationId: organization?.id ?? user.organizationId,
      verificationProfileId: profile.id,
      evaluation: trustEvaluation
    });

    await this.repository.createVerificationHistory({
      verificationProfileId: profile.id,
      userId: fullUser.id,
      organizationId: organization?.id ?? user.organizationId,
      status,
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      event: 'verification_submitted',
      payload
    });

    await this.repository.updateUser(fullUser.id, {
      displayName: registry.name,
      verificationStatus: status,
      metadata: inputJson({
        ...userMetadata,
        entityType: input.entityType,
        registrySource: registry.source,
        registryNumber: registry.registryNumber,
        verifiedName: registry.name
      })
    });

    await this.repository.createAuditEvent({
      actorUserId: fullUser.id,
      ownerOrgId: organization?.id ?? user.organizationId,
      event: autoApproved ? 'identity.verification.auto_approved' : 'identity.verification.submitted_for_review',
      entityType: 'verification_profile',
      entityRef: profile.id,
      severity: autoApproved ? AuditSeverity.INFO : AuditSeverity.WARNING,
      payload: { reviewReasons, autoApproved, signatureId: signature.id }
    });

    await this.repository.createAuditEvent({
      actorUserId: fullUser.id,
      ownerOrgId: organization?.id ?? user.organizationId,
      event: `identity.screening.${screening.status.toLowerCase()}`,
      entityType: 'screening_check',
      severity: screening.status === 'BLOCKED' ? AuditSeverity.CRITICAL : screening.status === 'REVIEW' ? AuditSeverity.WARNING : AuditSeverity.INFO,
      payload: { provider: screening.provider, reasons: screening.reasons }
    });

    await this.repository.createAuditEvent({
      actorUserId: fullUser.id,
      ownerOrgId: organization?.id ?? user.organizationId,
      event: 'identity.verification.signature_created',
      entityType: 'digital_signature',
      entityRef: signature.id,
      severity: AuditSeverity.INFO,
      payload: { verificationProfileId: profile.id, canonicalPayloadHash }
    });

    if (autoApproved) {
      await this.repository.createAdminAction({
        actorUserId: fullUser.id,
        ownerOrgId: organization?.id ?? user.organizationId,
        actionType: AdminActionType.APPROVE,
        entityType: 'verification_profile',
        entityRef: profile.id,
        summary: 'Verification auto-approved by deterministic approval checks.'
      });
    }

    const refreshedUser = await this.repository.findUserById(fullUser.id);
    return {
      user: refreshedUser ? toSessionUser(refreshedUser) : user,
      verification: toProfileDto(profile),
      autoApproved,
      reviewReasons
    };
  }

  async listAdminVerifications(token: string | undefined, status?: VerificationStatus) {
    await this.requireAdmin(token);
    const profiles = await this.repository.listVerificationProfiles(status);
    return profiles.map((profile) => this.adminVerificationDto(profile));
  }

  async decideAdminVerification(token: string | undefined, profileId: string, decision: 'approve' | 'reject', note?: string) {
    const admin = await this.requireAdmin(token);
    const profile = await this.repository.findVerificationProfileById(profileId);
    if (!profile) throw requestError('Verification profile was not found.', 404);

    const payload = metadataObject(profile.payload);
    const registryRecord = metadataObject(payload.registryRecord);
    const entityType = String(payload.entityType || 'business');
    let organizationId = profile.organizationId ?? undefined;
    const nextStatus = decision === 'approve' ? VerificationStatus.APPROVED : VerificationStatus.REJECTED;

    if (decision === 'approve') {
      const organization = await this.repository.createOrUpdateVerifiedOrganization({
        userId: profile.userId,
        organizationName: String(registryRecord.name || payload.verifiedName || profile.user.displayName),
        entityType,
        registrySource: profile.registrySource || String(registryRecord.source || 'TRA'),
        registryNumber: profile.registryNumber || String(registryRecord.registryNumber || '')
      });
      organizationId = organization.id;
    }

    const updatedPayload = inputJson({
      ...payload,
      adminDecision: decision,
      adminDecisionNote: note ?? '',
      adminDecisionAt: new Date().toISOString(),
      adminDecisionBy: admin.user.id
    });
    await this.repository.updateVerificationStatus(profile.id, nextStatus, updatedPayload, organizationId ?? null);
    await this.repository.createVerificationHistory({
      verificationProfileId: profile.id,
      userId: profile.userId,
      organizationId: organizationId ?? null,
      status: nextStatus,
      registrySource: profile.registrySource,
      registryNumber: profile.registryNumber,
      event: `admin_${decision}`,
      payload: updatedPayload
    });

    await this.repository.updateUser(profile.userId, {
      verificationStatus: nextStatus,
      displayName: decision === 'approve' ? String(registryRecord.name || payload.verifiedName || profile.user.displayName) : profile.user.displayName
    });

    const screening = metadataObject(payload.screening);
    const trustEvaluation = this.trustEvaluation({
      verificationStatus: nextStatus,
      screeningStatus: screeningStatus(screening.status),
      registryConfidence: typeof registryRecord.confidence === 'number' ? registryRecord.confidence : undefined,
      hasCompleteProfile: Boolean(metadataObject(payload.profile).displayName || payload.verifiedName),
      hasDocuments: metadataArray(payload.documents).length > 0,
      reviewReasons: decision === 'reject' ? ['Admin rejected verification.'] : []
    });
    await this.persistTrustEvaluation({
      userId: profile.userId,
      organizationId,
      verificationProfileId: profile.id,
      evaluation: trustEvaluation
    });

    await this.repository.createAdminAction({
      actorUserId: admin.user.id,
      ownerOrgId: organizationId,
      actionType: decision === 'approve' ? AdminActionType.APPROVE : AdminActionType.RETURN,
      entityType: 'verification_profile',
      entityRef: profile.id,
      summary: note ?? `Admin ${decision} verification.`
    });

    await this.repository.createAuditEvent({
      actorUserId: admin.user.id,
      ownerOrgId: organizationId,
      event: `identity.verification.admin_${decision}`,
      entityType: 'verification_profile',
      entityRef: profile.id,
      severity: decision === 'approve' ? AuditSeverity.INFO : AuditSeverity.WARNING,
      payload: { note: note ?? '' }
    });

    const refreshedProfile = await this.repository.findVerificationProfileById(profile.id);
    if (!refreshedProfile) throw requestError('Verification profile was not found after update.', 404);
    return this.adminVerificationDto(refreshedProfile);
  }

  async rescreenAdminVerification(token: string | undefined, profileId: string) {
    const admin = await this.requireAdmin(token);
    const profile = await this.repository.findVerificationProfileById(profileId);
    if (!profile) throw requestError('Verification profile was not found.', 404);
    const payload = metadataObject(profile.payload);
    const registryRecord = metadataObject(payload.registryRecord);
    const registrySource = profile.registrySource || String(registryRecord.source || '');
    const registryNumber = profile.registryNumber || String(registryRecord.registryNumber || '');
    const registry = registrySource && registryNumber ? await this.repository.findRegistryRecord(registrySource, registryNumber) : null;
    if (!registry) throw requestError('Registry record was not found for this verification.', 409);

    const duplicateCount = await this.repository.countApprovedRegistryDuplicates({
      userId: profile.userId,
      registrySource: registry.source,
      registryNumber: registry.registryNumber
    });
    const screening = await this.runScreening({
      userId: profile.userId,
      verificationProfileId: profile.id,
      organizationId: profile.organizationId,
      registry,
      duplicateApprovedRegistryCount: duplicateCount
    });
    const reviewReasons = Array.isArray(payload.reviewReasons) ? payload.reviewReasons.map((reason) => String(reason)) : [];
    for (const reason of screening.reasons) {
      if (!reviewReasons.includes(reason)) reviewReasons.push(reason);
    }
    const nextStatus = profile.status === VerificationStatus.APPROVED && screening.status !== 'CLEAR' ? VerificationStatus.PENDING : profile.status;
    const updatedPayload = inputJson({
      ...payload,
      reviewReasons,
      screening: {
        provider: screening.provider,
        status: screening.status,
        reasons: screening.reasons,
        providerMetadata: screening.providerMetadata,
        rescreenedAt: new Date().toISOString(),
        rescreenedBy: admin.user.id
      }
    });

    await this.repository.updateVerificationStatus(profile.id, nextStatus, updatedPayload, profile.organizationId);
    await this.repository.updateUser(profile.userId, { verificationStatus: nextStatus });
    const trustEvaluation = this.trustEvaluation({
      verificationStatus: nextStatus,
      screeningStatus: screening.status,
      registryConfidence: registry.confidence,
      hasCompleteProfile: Boolean(metadataObject(updatedPayload.profile).displayName || metadataObject(updatedPayload).verifiedName),
      hasDocuments: metadataArray(metadataObject(updatedPayload).documents).length > 0,
      reviewReasons
    });
    await this.persistTrustEvaluation({
      userId: profile.userId,
      organizationId: profile.organizationId,
      verificationProfileId: profile.id,
      evaluation: trustEvaluation
    });

    await this.repository.createAuditEvent({
      actorUserId: admin.user.id,
      ownerOrgId: profile.organizationId,
      event: 'identity.verification.admin_rescreen',
      entityType: 'verification_profile',
      entityRef: profile.id,
      severity: screening.status === 'BLOCKED' ? AuditSeverity.CRITICAL : screening.status === 'REVIEW' ? AuditSeverity.WARNING : AuditSeverity.INFO,
      payload: { screeningStatus: screening.status, reasons: screening.reasons }
    });

    const refreshedProfile = await this.repository.findVerificationProfileById(profile.id);
    if (!refreshedProfile) throw requestError('Verification profile was not found after rescreen.', 404);
    return this.adminVerificationDto(refreshedProfile);
  }

  private adminVerificationDto(profile: VerificationWithUser): AdminVerificationDto {
    const dto = toProfileDto(profile);
    const payload = metadataObject(profile.payload);
    const reviewReasons = Array.isArray(payload.reviewReasons)
      ? payload.reviewReasons.map((reason) => String(reason))
      : [];

    return {
      ...dto,
      user: toSessionUser(profile.user),
      reviewReasons,
      screeningStatus: toSessionUser(profile.user).screeningStatus,
      trustTier: toSessionUser(profile.user).trustTier,
      riskLevel: toSessionUser(profile.user).riskLevel
    };
  }
}
