import {
  AccountType,
  AdminActionType,
  AuditSeverity,
  PublicPageKey,
  VerificationStatus,
  type Prisma
} from '@prisma/client';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { ModuleRepository, type SessionWithUser, type UserWithDefaultOrg, type VerificationWithUser } from './repository.js';
import { ProductionIdentityNotifications, type DeliveryReceipt, type IdentityNotificationProvider } from './notifications.js';
import {
  moduleDefinition,
  type AdminVerificationDto,
  type AuthSessionDto,
  type ModuleStatus,
  type RegistryRecordDto,
  type SessionUserDto,
  type VerificationProfileDto
} from './types.js';

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

type RegistrationStartInput = {
  email: string;
  phone: string;
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
  profile?: Record<string, unknown>;
  documents?: Record<string, unknown>[];
};

type RegistryLookupInput = {
  entityType: 'individual' | 'company' | 'business';
  businessRegistrationSource?: 'tin' | 'brela';
  registryNumber: string;
};

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

function inputJson(value: Record<string, unknown>): Prisma.InputJsonObject {
  return value as Prisma.InputJsonObject;
}

function deliveryMetadata(receipt: DeliveryReceipt) {
  return {
    provider: receipt.provider,
    messageId: receipt.messageId,
    deliveredAt: new Date().toISOString()
  };
}

function toSessionUser(user: UserWithDefaultOrg): SessionUserDto {
  const membership = user.memberships[0];
  const organization = membership?.organization;
  return {
    id: user.id,
    email: user.email,
    phone: user.phone,
    displayName: user.displayName,
    accountType: user.accountType,
    verificationStatus: user.verificationStatus,
    organization: organization?.name,
    organizationId: organization?.id,
    capabilities: organization?.capabilities.map((item) => item.capability) ?? []
  };
}

function toSessionUserFromSession(session: SessionWithUser): SessionUserDto {
  const organization = session.organization ?? session.user.memberships[0]?.organization;
  return {
    id: session.user.id,
    email: session.user.email,
    phone: session.user.phone,
    displayName: session.user.displayName,
    accountType: session.user.accountType,
    verificationStatus: session.user.verificationStatus,
    organization: organization?.name,
    organizationId: organization?.id,
    capabilities: organization?.capabilities.map((item) => item.capability) ?? []
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

export class ModuleService {
  constructor(
    private readonly repository = new ModuleRepository(),
    private readonly notifications: IdentityNotificationProvider = new ProductionIdentityNotifications()
  ) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
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

  async startRegistration(input: RegistrationStartInput, audit?: AuthAuditContext) {
    const email = normalizeEmail(input.email);
    const phone = normalizePhone(input.phone);
    assertValidE164Phone(phone);

    const existing = await this.repository.findUserByEmail(email);

    if (existing?.passwordHash) {
      throw requestError('An account already exists for this email.', 409);
    }

    const existingPhoneUser = await this.repository.findUserByPhone(phone);
    if (existingPhoneUser && existingPhoneUser.id !== existing?.id) {
      throw requestError('An account already exists for this phone number.', 409);
    }

    const user = await this.repository.upsertRegistrationUser({
      email,
      phone,
      displayName: existing?.displayName ?? displayNameFromEmail(email)
    });
    const challenge = await this.createPhoneOtpChallenge(user.id, phone, email, audit);
    await this.recordAuthEvent('identity.auth.registration_started', {
      ...audit,
      userId: user.id,
      entityRef: challenge.id,
      target: email,
      details: { phoneHash: sha256(phone) }
    });

    return {
      user: toSessionUser(user),
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableAt: challengeResendAvailableAt(challenge.createdAt, resendCooldownSeconds),
      maxAttempts: maxChallengeAttempts
    };
  }

  private async createPhoneOtpChallenge(userId: string, phone: string, email: string, audit?: AuthAuditContext) {
    await this.repository.replacePendingChallenges({ userId, purpose: phoneOtpPurpose, target: phone });
    const code = randomCode();
    const challenge = await this.repository.createChallenge({
      userId,
      purpose: phoneOtpPurpose,
      target: phone,
      codeHash: sha256(code),
      expiresAt: new Date(Date.now() + phoneOtpMinutes * 60 * 1000),
      metadata: { email, delivery: { channel: 'sms', status: 'pending' } }
    });

    try {
      const receipt = await this.notifications.sendPhoneOtp({ to: phone, code, expiresInMinutes: phoneOtpMinutes });
      await this.repository.updateChallenge(challenge.id, {
        metadata: inputJson({
          ...metadataObject(challenge.metadata),
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

    return challenge;
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

    await this.repository.updateChallenge(existing.id, { status: 'REPLACED', consumedAt: new Date() });
    const next = await this.createPhoneOtpChallenge(existing.user.id, existing.target, existing.user.email, audit);
    await this.recordAuthEvent('identity.auth.phone_otp_resent', {
      ...audit,
      userId: existing.user.id,
      entityRef: next.id,
      target: existing.target,
      details: { previousChallengeId: existing.id }
    });
    return {
      challengeId: next.id,
      expiresAt: next.expiresAt.toISOString(),
      resendAvailableAt: challengeResendAvailableAt(next.createdAt, resendCooldownSeconds),
      maxAttempts: maxChallengeAttempts
    };
  }

  private async createActivationChallenge(userId: string, email: string, metadata: Record<string, unknown>, audit?: AuthAuditContext) {
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
      await this.repository.updateChallenge(activation.id, {
        metadata: inputJson({
          ...metadataObject(activation.metadata),
          delivery: {
            channel: 'email',
            status: 'sent',
            ...deliveryMetadata(receipt)
          }
        })
      });
      await this.recordAuthEvent('identity.auth.email_activation_delivery_succeeded', {
        ...audit,
        userId,
        entityRef: activation.id,
        target: email,
        details: { provider: receipt.provider, messageId: receipt.messageId }
      });
    } catch (error) {
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

    return activation;
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
    const next = await this.createActivationChallenge(existing.user.id, existing.user.email, {
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
      resendAvailableAt: challengeResendAvailableAt(next.createdAt, resendCooldownSeconds)
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

    const consumed = await this.repository.consumeChallenge(challenge.id);
    const user = consumed.user;
    if (!user) throw requestError('OTP challenge is not linked to a user.', 400);

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

    const activation = await this.createActivationChallenge(user.id, user.email, { phoneChallengeId: challenge.id }, audit);

    return {
      activationChallengeId: activation.id,
      expiresAt: activation.expiresAt.toISOString(),
      resendAvailableAt: challengeResendAvailableAt(activation.createdAt, resendCooldownSeconds)
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
      expiresAt: expiresAt.toISOString()
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
        message: 'If an account exists for this email, password reset instructions have been sent.'
      };
    }

    await this.recordAuthEvent('identity.auth.password_reset_requested', {
      ...audit,
      userId: user.id,
      target: email,
      details: { accountFound: true }
    });
    const challenge = await this.createPasswordResetChallenge(user.id, email, audit);

    return {
      ok: true,
      message: 'If an account exists for this email, password reset instructions have been sent.',
      challengeId: challenge.id,
      expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableAt: challengeResendAvailableAt(challenge.createdAt, resendCooldownSeconds)
    };
  }

  private async createPasswordResetChallenge(userId: string, email: string, audit?: AuthAuditContext) {
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
      const receipt = await this.notifications.sendPasswordReset({ to: email, code, expiresInMinutes: passwordResetMinutes });
      await this.repository.updateChallenge(challenge.id, {
        metadata: inputJson({
          ...metadataObject(challenge.metadata),
          delivery: {
            channel: 'email',
            status: 'sent',
            ...deliveryMetadata(receipt)
          }
        })
      });
      await this.recordAuthEvent('identity.auth.password_reset_delivery_succeeded', {
        ...audit,
        userId,
        entityRef: challenge.id,
        target: email,
        details: { provider: receipt.provider, messageId: receipt.messageId }
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
      message: 'If an account exists for this email, password reset instructions have been sent.',
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

  async registryLookup(input: RegistryLookupInput) {
    const source = registrySourceFor(input);
    const registryNumber = input.registryNumber.trim();
    const record = await this.repository.findRegistryRecord(source, registryNumber);

    if (!record || record.entityType !== input.entityType) {
      throw requestError('No matching registry record was found.', 404);
    }

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

  async saveVerificationDraft(token: string | undefined, input: VerificationPayloadInput) {
    const { user } = await this.requireSession(token);
    const existing = await this.repository.latestVerificationProfile(user.id);
    const payload = inputJson({
      ...metadataObject(existing?.payload),
      ...input,
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
    return toProfileDto(profile);
  }

  async updateProfile(token: string | undefined, input: { profile: Record<string, unknown>; documents?: Record<string, unknown>[] }) {
    const { user } = await this.requireSession(token);
    const existing = await this.repository.latestVerificationProfile(user.id);
    const payload = inputJson({
      ...metadataObject(existing?.payload),
      profile: input.profile,
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

    return toProfileDto(profile);
  }

  async submitVerification(token: string | undefined, input: Required<Pick<VerificationPayloadInput, 'entityType' | 'registrySource' | 'registryNumber' | 'registryVerified' | 'registryRecordId' | 'signatureName' | 'signatureConsent'>> & VerificationPayloadInput) {
    const { user } = await this.requireSession(token);
    const fullUser = await this.repository.findUserById(user.id);
    if (!fullUser) throw requestError('Current user was not found.', 404);

    const registry = await this.repository.findRegistryRecord(input.registrySource, input.registryNumber);
    if (!registry || registry.id !== input.registryRecordId) {
      throw requestError('Registry record must be fetched before submitting verification.', 409);
    }

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

    const autoApproved = reviewReasons.length === 0;
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

    const payload = inputJson({
      ...input,
      registryRecord: registryPayload(registry),
      verifiedName: registry.name,
      reviewReasons,
      autoApproved,
      submittedAt: new Date().toISOString()
    });

    const profile = await this.repository.upsertVerificationProfile({
      userId: fullUser.id,
      organizationId: organization?.id ?? user.organizationId,
      status,
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
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
      payload: { reviewReasons, autoApproved }
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

    await this.repository.updateUser(profile.userId, {
      verificationStatus: nextStatus,
      displayName: decision === 'approve' ? String(registryRecord.name || payload.verifiedName || profile.user.displayName) : profile.user.displayName
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

  private adminVerificationDto(profile: VerificationWithUser): AdminVerificationDto {
    const dto = toProfileDto(profile);
    const payload = metadataObject(profile.payload);
    const reviewReasons = Array.isArray(payload.reviewReasons)
      ? payload.reviewReasons.map((reason) => String(reason))
      : [];

    return {
      ...dto,
      user: toSessionUser(profile.user),
      reviewReasons
    };
  }
}
