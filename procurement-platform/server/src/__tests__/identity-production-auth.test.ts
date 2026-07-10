import { AccountType, PublicPageKey, PublicPageStatus, RiskLevel, TrustTier, VerificationStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModuleService } from '../modules/identity/service.js';
import type { EmailValidationProvider, EmailValidationResult } from '../modules/identity/emailValidation.js';
import type { PhoneValidationProvider, PhoneValidationResult } from '../modules/identity/phoneValidation.js';
import type { RegistryLookupRequest, RegistryProvider, RegistryProviderRecord } from '../modules/identity/registryProviders.js';

class FakeIdentityRepository {
  users = new Map<string, any>();
  usersByEmail = new Map<string, any>();
  challenges = new Map<string, any>();
  registry = new Map<string, any>();
  sessions = new Map<string, any>();
  publicPages = new Map<string, any>();
  acceptances: any[] = [];
  auditEvents: any[] = [];
  profiles: any[] = [];
  history: any[] = [];
  signatures: any[] = [];
  signingCredentials: any[] = [];
  trustHistory: any[] = [];
  screeningChecks: any[] = [];
  preferences = new Map<string, any>();
  id = 0;

  nextId(prefix: string) {
    this.id += 1;
    return `${prefix}-${this.id}`;
  }

  findUserByEmail(email: string) {
    return Promise.resolve(this.usersByEmail.get(email.toLowerCase()) ?? null);
  }

  findUserByPhone(phone: string) {
    return Promise.resolve(Array.from(this.users.values()).find((user) => user.phone === phone) ?? null);
  }

  findUserById(id: string) {
    return Promise.resolve(this.users.get(id) ?? null);
  }

  findPreference(userId: string) {
    return Promise.resolve(this.preferences.get(userId) ?? null);
  }

  findActiveSigningCredential(userId: string) {
    return Promise.resolve(this.signingCredentials.find((credential) => credential.userId === userId && credential.status === 'ACTIVE') ?? null);
  }

  createSigningCredential(input: Record<string, unknown>) {
    const credential = {
      id: this.nextId('signing-credential'),
      status: 'ACTIVE',
      revokedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...input
    };
    this.signingCredentials.push(credential);
    return Promise.resolve(credential);
  }

  revokeActiveSigningCredential(userId: string) {
    let count = 0;
    for (const credential of this.signingCredentials) {
      if (credential.userId === userId && credential.status === 'ACTIVE') {
        credential.status = 'REVOKED';
        credential.revokedAt = new Date();
        count += 1;
      }
    }
    return Promise.resolve({ count });
  }

  upsertPreference(input: { userId: string; preferredLanguage?: string; timezone?: string; metadata?: Record<string, unknown> }) {
    const preference =
      this.preferences.get(input.userId) ??
      {
        id: this.nextId('preference'),
        userId: input.userId,
        preferredLanguage: 'en',
        timezone: 'Africa/Dar_es_Salaam',
        metadata: {},
        createdAt: new Date()
      };
    Object.assign(preference, input, { updatedAt: new Date() });
    this.preferences.set(input.userId, preference);
    const user = this.users.get(input.userId);
    if (user) user.preference = preference;
    return Promise.resolve(preference);
  }

  upsertRegistrationUser(input: { email: string; phone: string; displayName: string }) {
    const email = input.email.toLowerCase();
    const existing = this.usersByEmail.get(email);
    if (existing) {
      existing.phone = input.phone;
      existing.displayName = input.displayName;
      return Promise.resolve(existing);
    }

    const user = {
      id: this.nextId('user'),
      email,
      phone: input.phone,
      displayName: input.displayName,
      passwordHash: null,
      accountType: AccountType.USER,
      verificationStatus: VerificationStatus.NOT_STARTED,
      metadata: {},
      screeningChecks: [],
      memberships: []
    };
    this.users.set(user.id, user);
    this.usersByEmail.set(email, user);
    return Promise.resolve(user);
  }

  updateUser(id: string, data: Record<string, unknown>) {
    const user = this.users.get(id);
    Object.assign(user, data);
    return Promise.resolve(user);
  }

  createChallenge(input: Record<string, unknown>) {
    const challenge = {
      id: this.nextId('challenge'),
      status: 'PENDING',
      attempts: 0,
      consumedAt: null,
      createdAt: new Date(),
      ...input
    };
    this.challenges.set(challenge.id, challenge);
    return Promise.resolve(challenge);
  }

  findChallenge(id: string) {
    const challenge = this.challenges.get(id);
    if (!challenge) return Promise.resolve(null);
    return Promise.resolve({
      ...challenge,
      user: challenge.userId ? this.users.get(challenge.userId) : null
    });
  }

  incrementChallengeAttempts(id: string) {
    const challenge = this.challenges.get(id);
    challenge.attempts += 1;
    return Promise.resolve(challenge);
  }

  updateChallenge(id: string, data: Record<string, unknown>) {
    const challenge = this.challenges.get(id);
    Object.assign(challenge, data);
    return Promise.resolve(challenge);
  }

  replacePendingChallenges(input: { userId?: string | null; purpose: string; target: string; exceptId?: string }) {
    for (const challenge of this.challenges.values()) {
      if (
        challenge.status === 'PENDING' &&
        challenge.purpose === input.purpose &&
        challenge.target === input.target &&
        (!input.userId || challenge.userId === input.userId) &&
        (!input.exceptId || challenge.id !== input.exceptId)
      ) {
        challenge.status = 'REPLACED';
        challenge.consumedAt = new Date();
      }
    }
    return Promise.resolve({});
  }

  consumeChallenge(id: string) {
    const challenge = this.challenges.get(id);
    challenge.status = 'CONSUMED';
    challenge.consumedAt = new Date();
    return Promise.resolve({
      ...challenge,
      user: challenge.userId ? this.users.get(challenge.userId) : null
    });
  }

  upsertPasswordAccount() {
    return Promise.resolve({});
  }

  findCurrentPublicPageVersion(pageKey: PublicPageKey) {
    return Promise.resolve(
      this.publicPages.get(pageKey) ?? {
        id: `${pageKey}-version`,
        pageKey,
        version: '2026.06.06',
        status: PublicPageStatus.PUBLISHED
      }
    );
  }

  findPublicPageVersionById(id: string) {
    return Promise.resolve(Array.from(this.publicPages.values()).find((page) => page.id === id) ?? null);
  }

  createUserPolicyAcceptance(input: Record<string, unknown>) {
    const acceptance = { id: this.nextId('acceptance'), ...input, acceptedAt: new Date() };
    this.acceptances.push(acceptance);
    return Promise.resolve(acceptance);
  }

  createSession(input: { userId: string; organizationId?: string; tokenHash: string; expiresAt: Date }) {
    const user = this.users.get(input.userId);
    const organization = user.memberships[0]?.organization;
    const session = {
      id: this.nextId('session'),
      ...input,
      status: 'ACTIVE',
      createdAt: new Date(),
      user,
      organization
    };
    this.sessions.set(input.tokenHash, session);
    return Promise.resolve(session);
  }

  hasPriorSession(userId: string) {
    return Promise.resolve(Array.from(this.sessions.values()).some((session) => session.userId === userId));
  }

  findActiveSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    return Promise.resolve(session?.status === 'ACTIVE' && session.expiresAt > new Date() ? session : null);
  }

  revokeSession(tokenHash: string) {
    const session = this.sessions.get(tokenHash);
    if (session) session.status = 'REVOKED';
    return Promise.resolve({ count: session ? 1 : 0 });
  }

  revokeSessionsForUser(userId: string) {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.status === 'ACTIVE') {
        session.status = 'REVOKED';
        count += 1;
      }
    }
    return Promise.resolve({ count });
  }

  findRegistryRecord(source: string, registryNumber: string) {
    return Promise.resolve(this.registry.get(`${source}:${registryNumber}`) ?? null);
  }

  upsertRegistryRecord(input: {
    source: string;
    registryNumber: string;
    entityType: string;
    name: string;
    status: string;
    confidence: number;
    payload?: Record<string, unknown>;
  }) {
    const key = `${input.source}:${input.registryNumber}`;
    const record =
      this.registry.get(key) ??
      {
        id: this.nextId('registry'),
        createdAt: new Date()
      };

    Object.assign(record, {
      source: input.source,
      registryNumber: input.registryNumber,
      entityType: input.entityType,
      name: input.name,
      status: input.status,
      confidence: input.confidence,
      payload: input.payload ?? {},
      updatedAt: new Date()
    });
    this.registry.set(key, record);
    return Promise.resolve(record);
  }

  upsertDevRegistryRecord(input: { source: string; registryNumber: string; entityType: string; name: string; payload?: Record<string, unknown> }) {
    const key = `${input.source}:${input.registryNumber}`;
    const existing = this.registry.get(key);
    const record =
      existing ??
      {
        id: this.nextId('registry'),
        source: input.source,
        registryNumber: input.registryNumber,
        entityType: input.entityType,
        name: input.name,
        status: 'MATCHED',
        confidence: 100,
        payload: input.payload ?? {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

    Object.assign(record, {
      entityType: input.entityType,
      name: input.name,
      status: 'MATCHED',
      confidence: 100,
      payload: input.payload ?? {}
    });
    this.registry.set(key, record);
    return Promise.resolve(record);
  }

  latestVerificationProfile(userId: string) {
    return Promise.resolve(this.profiles.find((profile) => profile.userId === userId) ?? null);
  }

  countApprovedRegistryDuplicates(input: { userId: string; registrySource: string; registryNumber: string }) {
    return Promise.resolve(
      this.profiles.filter(
        (profile) =>
          profile.userId !== input.userId &&
          profile.status === VerificationStatus.APPROVED &&
          profile.registrySource === input.registrySource &&
          profile.registryNumber === input.registryNumber
      ).length
    );
  }

  createOrUpdateVerifiedOrganization(input: { userId: string; organizationName: string; entityType: string; registrySource: string; registryNumber: string }) {
    const organization = {
      id: this.nextId('org'),
      name: input.organizationName,
      buyerProfile: {
        procuringType: input.entityType === 'individual' ? 'Verified individual buyer' : 'Verified procuring entity',
        payload: {
          entityType: input.entityType,
          registrySource: input.registrySource,
          registryNumber: input.registryNumber
        }
      },
      supplierProfile: {
        trustTier: TrustTier.UNVERIFIED,
        riskLevel: RiskLevel.MEDIUM
      },
      capabilities: [{ capability: 'BUYER' }, { capability: 'SUPPLIER' }]
    };
    const user = this.users.get(input.userId);
    user.memberships = [{ status: 'ACTIVE', isDefault: true, organization }];
    return Promise.resolve(organization);
  }

  createScreeningCheck(input: Record<string, unknown> & { userId: string }) {
    const check = { id: this.nextId('screening'), ...input, createdAt: new Date() };
    this.screeningChecks.push(check);
    const user = this.users.get(input.userId);
    if (user) {
      user.screeningChecks = [check, ...(user.screeningChecks ?? [])];
    }
    return Promise.resolve(check);
  }

  latestScreeningCheckForUser(userId: string) {
    return Promise.resolve(this.screeningChecks.filter((check) => check.userId === userId).at(-1) ?? null);
  }

  upsertSupplierTrust(input: { organizationId: string; trustTier: TrustTier; riskLevel: RiskLevel; score: number; reasons: unknown[]; userId?: string | null; verificationProfileId?: string | null }) {
    const organization = Array.from(this.users.values())
      .flatMap((user) => user.memberships.map((membership: any) => membership.organization))
      .find((item) => item.id === input.organizationId);
    if (organization) {
      organization.supplierProfile = {
        trustTier: input.trustTier,
        riskLevel: input.riskLevel
      };
    }
    const history = { id: this.nextId('trust'), ...input, nextTier: input.trustTier, createdAt: new Date() };
    this.trustHistory.push(history);
    return Promise.resolve(organization?.supplierProfile ?? null);
  }

  createTrustTierHistory(input: Record<string, unknown>) {
    const history = { id: this.nextId('trust'), ...input, createdAt: new Date() };
    this.trustHistory.push(history);
    return Promise.resolve(history);
  }

  upsertVerificationProfile(input: Record<string, unknown>) {
    let profile = this.profiles.find((item) => item.userId === input.userId);
    if (!profile) {
      profile = {
        id: this.nextId('profile'),
        createdAt: new Date(),
        updatedAt: new Date()
      };
      this.profiles.push(profile);
    }
    Object.assign(profile, input, { updatedAt: new Date() });
    return Promise.resolve(profile);
  }

  createVerificationHistory(input: Record<string, unknown>) {
    const history = { id: this.nextId('history'), ...input, createdAt: new Date() };
    this.history.push(history);
    return Promise.resolve(history);
  }

  createDigitalSignature(input: Record<string, unknown>) {
    const signature = {
      id: this.nextId('signature'),
      status: 'SIGNED',
      signedAt: new Date(),
      createdAt: new Date(),
      ...input
    };
    this.signatures.push(signature);
    return Promise.resolve(signature);
  }

  findVerificationProfileById(id: string) {
    const profile = this.profiles.find((item) => item.id === id);
    if (!profile) return Promise.resolve(null);
    return Promise.resolve({
      ...profile,
      user: this.users.get(profile.userId)
    });
  }

  updateVerificationStatus(id: string, status: VerificationStatus, payload: Record<string, unknown>, organizationId?: string | null) {
    const profile = this.profiles.find((item) => item.id === id);
    Object.assign(profile, {
      status,
      payload,
      ...(organizationId !== undefined ? { organizationId } : {}),
      updatedAt: new Date()
    });
    return Promise.resolve({
      ...profile,
      user: this.users.get(profile.userId)
    });
  }

  createAuditEvent(input: Record<string, unknown>) {
    const event = { id: this.nextId('audit'), ...input, createdAt: new Date() };
    this.auditEvents.push(event);
    return Promise.resolve(event);
  }

  createAdminAction() {
    return Promise.resolve({});
  }
}

class FakeIdentityNotifications {
  phoneOtps: Array<{ to: string; code: string }> = [];
  activations: Array<{ to: string; code: string; actionUrl?: string }> = [];
  resets: Array<{ to: string; code: string; actionUrl?: string }> = [];
  failNext = false;

  private maybeFail() {
    if (!this.failNext) return;
    this.failNext = false;
    throw new Error('delivery unavailable');
  }

  sendPhoneOtp(input: { to: string; code: string }) {
    this.maybeFail();
    this.phoneOtps.push(input);
    return Promise.resolve({ provider: 'fake-sms', messageId: `sms-${this.phoneOtps.length}` });
  }

  sendEmailActivation(input: { to: string; code: string; actionUrl?: string }) {
    this.maybeFail();
    this.activations.push(input);
    return Promise.resolve({ provider: 'fake-email', messageId: `activation-${this.activations.length}` });
  }

  sendPasswordReset(input: { to: string; code: string; actionUrl?: string }) {
    this.maybeFail();
    this.resets.push(input);
    return Promise.resolve({ provider: 'fake-email', messageId: `reset-${this.resets.length}` });
  }
}

class FakeDevConsoleIdentityNotifications extends FakeIdentityNotifications {
  sendPhoneOtp(input: { to: string; code: string }) {
    this.phoneOtps.push(input);
    return Promise.resolve({ provider: 'dev-console', messageId: `dev-sms-${this.phoneOtps.length}` });
  }

  sendEmailActivation(input: { to: string; code: string; actionUrl?: string }) {
    this.activations.push(input);
    return Promise.resolve({ provider: 'dev-console', messageId: `dev-activation-${this.activations.length}` });
  }
}

class FakeWhatsAppIdentityNotifications extends FakeIdentityNotifications {
  sendPhoneOtp(input: { to: string; code: string }) {
    this.phoneOtps.push(input);
    return Promise.resolve({ provider: 'meta-whatsapp', messageId: `wamid-${this.phoneOtps.length}` });
  }
}

class FakeRegistryProvider implements RegistryProvider {
  records = new Map<string, RegistryProviderRecord>();
  failNext = false;

  lookup(input: RegistryLookupRequest) {
    if (this.failNext) {
      this.failNext = false;
      const error = new Error('provider unavailable') as Error & { providerFailure?: true };
      error.providerFailure = true;
      return Promise.reject(error);
    }

    return Promise.resolve(this.records.get(`${input.source}:${input.registryNumber}`) ?? null);
  }
}

class FakeEmailValidationProvider implements EmailValidationProvider {
  calls: string[] = [];
  result: EmailValidationResult = {
    provider: 'fake-email-validation',
    configured: true,
    accepted: true,
    reasons: [],
    score: 0.97,
    checks: {
      formatValid: true,
      mxFound: true,
      smtpCheck: true,
      disposable: false,
      role: false,
      free: false
    }
  };
  failNext = false;

  validate(input: { email: string }) {
    this.calls.push(input.email);
    if (this.failNext) {
      this.failNext = false;
      const error = new Error('mailboxlayer unavailable') as Error & { providerFailure?: true };
      error.providerFailure = true;
      return Promise.reject(error);
    }
    return Promise.resolve(this.result);
  }
}

class FakePhoneValidationProvider implements PhoneValidationProvider {
  calls: string[] = [];
  result: PhoneValidationResult = {
    provider: 'fake-phone-validation',
    configured: true,
    accepted: true,
    reasons: [],
    checks: {
      valid: true,
      reachable: true
    },
    providerMetadata: {
      type: 'basic'
    }
  };
  failNext = false;

  validate(input: { phone: string }) {
    this.calls.push(input.phone);
    if (this.failNext) {
      this.failNext = false;
      const error = new Error('beem phone validation unavailable') as Error & { providerFailure?: true };
      error.providerFailure = true;
      return Promise.reject(error);
    }
    return Promise.resolve(this.result);
  }
}

function resetChallengeIdFromEmail(input: { actionUrl?: string }) {
  if (!input.actionUrl) throw new Error('Expected reset email to include an action URL.');
  const url = new URL(input.actionUrl);
  return url.searchParams.get('challengeId') ?? '';
}

function makeService(
  repository = new FakeIdentityRepository(),
  notifications = new FakeIdentityNotifications(),
  registryProvider?: RegistryProvider,
  emailValidationProvider: EmailValidationProvider = new FakeEmailValidationProvider(),
  phoneValidationProvider: PhoneValidationProvider = new FakePhoneValidationProvider()
) {
  return {
    repository,
    notifications,
    registryProvider,
    emailValidationProvider,
    phoneValidationProvider,
    service: new ModuleService(repository as any, notifications, registryProvider, undefined, emailValidationProvider, phoneValidationProvider)
  };
}

function legalAcceptance() {
  return {
    termsAccepted: true,
    privacyAccepted: true,
    source: 'registration',
    ipAddress: '127.0.0.1',
    userAgent: 'vitest'
  } as const;
}

const testLocation = {
  region: 'Dar es Salaam',
  district: 'Ilala',
  ward: 'Kariakoo'
} as const;

async function requestSignatureForSession(service: ModuleService, token: string, keyphrase = 'Signing123') {
  await service.requestSignature(token, { keyphrase, repeatedKeyphrase: keyphrase });
  return keyphrase;
}

const originalNodeEnv = process.env.NODE_ENV;
const originalAppEnv = process.env.APP_ENV;

describe('identity production auth', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.APP_ENV = 'test';
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;

    if (originalAppEnv === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = originalAppEnv;
  });

  it('sends phone OTP by SMS and rejects a fallback OTP', async () => {
    const { repository, notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'new-user@example.test', phone: '+255 700 000 001' });

    expect(notifications.phoneOtps).toHaveLength(1);
    expect(notifications.phoneOtps[0]).toMatchObject({ to: '+255700000001' });
    expect(repository.challenges.get(registration.challengeId).metadata.delivery).toMatchObject({
      channel: 'sms',
      provider: 'fake-sms',
      messageId: 'sms-1',
      status: 'sent'
    });
    expect(registration).not.toHaveProperty('devCode');
    expect(repository.challenges.get(registration.challengeId).codeHash).not.toBe(notifications.phoneOtps[0].code);
    await expect(service.verifyOtp(registration.challengeId, '000000')).rejects.toMatchObject({ status: 400 });
  });

  it('records WhatsApp delivery metadata when phone OTP is sent through Meta WhatsApp', async () => {
    const { repository, notifications, service } = makeService(new FakeIdentityRepository(), new FakeWhatsAppIdentityNotifications());
    const registration = await service.startRegistration({ email: 'whatsapp-user@example.test', phone: '+255700000023' });

    expect(notifications.phoneOtps).toHaveLength(1);
    expect(repository.challenges.get(registration.challengeId).metadata.delivery).toMatchObject({
      channel: 'whatsapp',
      provider: 'meta-whatsapp',
      messageId: 'wamid-1',
      status: 'sent'
    });
    expect(registration).not.toHaveProperty('devCode');
  });

  it('exposes phone codes only for dev-console delivery and email activation codes during local registration', async () => {
    const hidden = makeService();
    const hiddenRegistration = await hidden.service.startRegistration({ email: 'hidden-code@example.test', phone: '+255700000021' });
    const hiddenOtp = await hidden.service.verifyOtp(hiddenRegistration.challengeId, hidden.notifications.phoneOtps[0].code);
    expect(hiddenRegistration).not.toHaveProperty('devCode');
    expect(hiddenOtp.devCode).toBe(hidden.notifications.activations[0].code);

    const { repository, notifications, service } = makeService(new FakeIdentityRepository(), new FakeDevConsoleIdentityNotifications());
    const registration = await service.startRegistration({ email: 'visible-code@example.test', phone: '+255700000022' });
    expect(registration.devCode).toBe(notifications.phoneOtps[0].code);

    repository.challenges.get(registration.challengeId).createdAt = new Date(Date.now() - 31_000);
    const resentOtp = await service.resendOtp(registration.challengeId);
    expect(resentOtp.devCode).toBe(notifications.phoneOtps.at(-1)!.code);

    const otp = await service.verifyOtp(resentOtp.challengeId, notifications.phoneOtps.at(-1)!.code);
    expect(otp.devCode).toBe(notifications.activations[0].code);

    repository.challenges.get(otp.activationChallengeId).createdAt = new Date(Date.now() - 31_000);
    const activation = await service.resendActivation(otp.activationChallengeId);
    expect(activation.devCode).toBe(notifications.activations.at(-1)!.code);
  });

  it('creates a user who can verify, activate, set a password, and sign in with delivered codes', async () => {
    const { notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'walkthrough@example.test', phone: '+255 700 000 002' });

    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('walkthrough@example.test', 'Strong123!', legalAcceptance());
    const session = await service.signIn('walkthrough@example.test', 'Strong123!');

    expect(session.user.email).toBe('walkthrough@example.test');
    expect(session.user.verificationStatus).toBe(VerificationStatus.NOT_STARTED);
    expect(session.isFirstSignIn).toBe(true);

    const nextSession = await service.signIn('walkthrough@example.test', 'Strong123!');
    expect(nextSession.isFirstSignIn).toBe(false);
  });

  it('validates email deliverability before sending activation emails and resends', async () => {
    const validator = new FakeEmailValidationProvider();
    const { repository, notifications, service } = makeService(new FakeIdentityRepository(), new FakeIdentityNotifications(), undefined, validator);
    const registration = await service.startRegistration({ email: 'activation@example.test', phone: '+255700000062' });

    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    expect(notifications.activations).toHaveLength(1);
    expect(validator.calls.filter((email) => email === 'activation@example.test')).toHaveLength(2);

    repository.challenges.get(otp.activationChallengeId).createdAt = new Date(Date.now() - 31_000);
    await service.resendActivation(otp.activationChallengeId);

    expect(notifications.activations).toHaveLength(2);
    expect(validator.calls.filter((email) => email === 'activation@example.test')).toHaveLength(3);
  });

  it('returns a temporary activation code when local activation email delivery fails', async () => {
    const { repository, notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'activation-retry@example.test', phone: '+255700000071' });

    notifications.failNext = true;
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);

    expect(otp.activationChallengeId).toBeTruthy();
    expect(otp.devCode).toBe(repository.challenges.get(otp.activationChallengeId).metadata.devCode);
    expect(repository.challenges.get(registration.challengeId).status).toBe('CONSUMED');
    expect(repository.usersByEmail.get('activation-retry@example.test').metadata.phoneVerified).toBe(true);
    expect(notifications.activations).toHaveLength(0);
  });

  it('returns a temporary activation code when local activation email validation is unavailable', async () => {
    const validator = new FakeEmailValidationProvider();
    const { repository, notifications, service } = makeService(new FakeIdentityRepository(), new FakeIdentityNotifications(), undefined, validator);
    const registration = await service.startRegistration({ email: 'activation-validation-retry@example.test', phone: '+255700000072' });

    validator.failNext = true;
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);

    expect(otp.activationChallengeId).toBeTruthy();
    expect(otp.devCode).toBe(notifications.activations[0].code);
    expect(repository.challenges.get(registration.challengeId).status).toBe('CONSUMED');
    expect(repository.usersByEmail.get('activation-validation-retry@example.test').metadata.phoneVerified).toBe(true);
    expect(notifications.activations).toHaveLength(1);
  });

  it('rejects activation email delivery when Mailboxlayer rejects the address', async () => {
    const validator = new FakeEmailValidationProvider();
    const { notifications, service } = makeService(new FakeIdentityRepository(), new FakeIdentityNotifications(), undefined, validator);
    const registration = await service.startRegistration({ email: 'activation-reject@example.test', phone: '+255700000063' });
    validator.result = {
      ...validator.result,
      accepted: false,
      reasons: ['Disposable email addresses are not allowed.'],
      checks: { ...validator.result.checks, disposable: true }
    };

    await expect(service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code)).rejects.toMatchObject({ status: 400 });
    expect(notifications.activations).toHaveLength(0);
  });

  it('persists preferred language and records an audit event', async () => {
    const { repository, notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'language@example.test', phone: '+255 700 000 050' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('language@example.test', 'Strong123!', legalAcceptance());
    const session = await service.signIn('language@example.test', 'Strong123!');

    await expect(service.preferences(session.token)).resolves.toMatchObject({ preferredLanguage: 'en' });
    const updated = await service.updatePreferences(session.token, { preferredLanguage: 'sw' }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });

    expect(updated).toMatchObject({ preferredLanguage: 'sw' });
    expect(repository.preferences.get(session.user.id)).toMatchObject({ preferredLanguage: 'sw' });
    expect(repository.auditEvents.some((event) => event.event === 'identity.preferences.language_changed')).toBe(true);
  });

  it('normalizes Tanzanian phone numbers and rejects duplicate phone registrations', async () => {
    const { service } = makeService();

    const first = await service.startRegistration({ email: 'first@example.test', phone: '0712 345 678' });
    expect(first.user.phone).toBe('+255712345678');

    await expect(service.startRegistration({ email: 'second@example.test', phone: '+255 712 345 678' })).rejects.toMatchObject({
      status: 409
    });
  });

  it('stores an optional Tanzania registration location in user metadata', async () => {
    const { repository, service } = makeService();

    const registration = await service.startRegistration({
      email: 'located@example.test',
      phone: '+255700000068',
      location: testLocation
    });

    expect(registration.user.location).toEqual(testLocation);
    expect(repository.users.get(registration.user.id).metadata.location).toEqual(testLocation);
  });

  it('rejects invalid Tanzania registration locations', async () => {
    const { service } = makeService();

    await expect(
      service.startRegistration({
        email: 'bad-location@example.test',
        phone: '+255700000069',
        location: { region: 'Dar es Salaam', district: 'Dodoma', ward: 'Kariakoo' }
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('validates and persists account profile Tanzania locations', async () => {
    const { notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'profile-location@example.test', phone: '+255700000070' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('profile-location@example.test', 'Strong123!', legalAcceptance());
    const session = await service.signIn('profile-location@example.test', 'Strong123!');

    const saved = await service.updateProfile(session.token, {
      profile: {
        displayName: 'Profile Location Business',
        location: testLocation
      }
    });

    expect(saved.payload.profile).toMatchObject({ location: testLocation });
    await expect(
      service.updateProfile(session.token, {
        profile: {
          location: { region: 'Dar es Salaam', district: 'Dodoma', ward: 'Kariakoo' }
        }
      })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('validates registration emails before persisting a user', async () => {
    const repository = new FakeIdentityRepository();
    const validator = new FakeEmailValidationProvider();
    validator.result = {
      provider: 'fake-email-validation',
      configured: true,
      accepted: false,
      reasons: ['Disposable email addresses are not allowed.'],
      score: 0.12,
      didYouMean: 'owner@example.com',
      checks: {
        formatValid: true,
        mxFound: true,
        smtpCheck: true,
        disposable: true,
        role: false,
        free: false
      }
    };
    const { service } = makeService(repository, new FakeIdentityNotifications(), undefined, validator);

    await expect(service.startRegistration({ email: 'owner@mailinator.test', phone: '+255700000060' })).rejects.toMatchObject({
      status: 400
    });

    expect(repository.usersByEmail.has('owner@mailinator.test')).toBe(false);
    expect(repository.auditEvents.some((event) => event.event === 'identity.auth.registration_start.email_validation_rejected')).toBe(true);
    expect(JSON.stringify(repository.auditEvents)).not.toContain('owner@mailinator.test');
  });

  it('returns a provider error when email validation is unavailable', async () => {
    const repository = new FakeIdentityRepository();
    const validator = new FakeEmailValidationProvider();
    validator.failNext = true;
    const { service } = makeService(repository, new FakeIdentityNotifications(), undefined, validator);

    await expect(service.startRegistration({ email: 'provider-fail@example.test', phone: '+255700000061' })).rejects.toMatchObject({
      status: 502
    });

    expect(repository.usersByEmail.has('provider-fail@example.test')).toBe(false);
    expect(repository.auditEvents.some((event) => event.event === 'identity.auth.registration_start.email_validation_failed')).toBe(true);
  });

  it('validates phone numbers with Number Insight before creating OTP challenges', async () => {
    const phoneValidator = new FakePhoneValidationProvider();
    const { repository, service } = makeService(
      new FakeIdentityRepository(),
      new FakeIdentityNotifications(),
      undefined,
      new FakeEmailValidationProvider(),
      phoneValidator
    );

    const registration = await service.startRegistration({ email: 'phone-insight@example.test', phone: '+255 700 000 065' });

    expect(phoneValidator.calls).toEqual(['+255700000065']);
    expect(repository.challenges.get(registration.challengeId).metadata.phoneValidation).toMatchObject({
      provider: 'fake-phone-validation',
      accepted: true
    });
  });

  it('blocks registration when Number Insight rejects the phone number', async () => {
    const repository = new FakeIdentityRepository();
    const phoneValidator = new FakePhoneValidationProvider();
    phoneValidator.result = {
      ...phoneValidator.result,
      accepted: false,
      reasons: ['Phone number is invalid.'],
      checks: { valid: false, reachable: true }
    };
    const { service } = makeService(repository, new FakeIdentityNotifications(), undefined, new FakeEmailValidationProvider(), phoneValidator);

    await expect(service.startRegistration({ email: 'invalid-phone@example.test', phone: '+255700000066' })).rejects.toMatchObject({
      status: 400
    });

    expect(repository.usersByEmail.has('invalid-phone@example.test')).toBe(false);
    expect(repository.challenges.size).toBe(0);
    expect(repository.auditEvents.some((event) => event.event === 'identity.auth.registration_start.phone_validation_rejected')).toBe(true);
    expect(JSON.stringify(repository.auditEvents)).not.toContain('+255700000066');
  });

  it('returns a provider error when Number Insight is unavailable', async () => {
    const repository = new FakeIdentityRepository();
    const phoneValidator = new FakePhoneValidationProvider();
    phoneValidator.failNext = true;
    const { service } = makeService(repository, new FakeIdentityNotifications(), undefined, new FakeEmailValidationProvider(), phoneValidator);

    await expect(service.startRegistration({ email: 'phone-provider-fail@example.test', phone: '+255700000067' })).rejects.toMatchObject({
      status: 502
    });

    expect(repository.usersByEmail.has('phone-provider-fail@example.test')).toBe(false);
    expect(repository.challenges.size).toBe(0);
    expect(repository.auditEvents.some((event) => event.event === 'identity.auth.registration_start.phone_validation_failed')).toBe(true);
    expect(JSON.stringify(repository.auditEvents)).not.toContain('beem_live_');
  });

  it('rejects duplicate active account emails', async () => {
    const { notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'active@example.test', phone: '+255700000010' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('active@example.test', 'Strong123!', legalAcceptance());

    await expect(service.startRegistration({ email: 'ACTIVE@example.test', phone: '+255700000011' })).rejects.toMatchObject({
      status: 409
    });
  });

  it('caps OTP attempts and rejects later correct codes after the cap', async () => {
    const { notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'attempts@example.test', phone: '+255700000012' });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.verifyOtp(registration.challengeId, '111111')).rejects.toMatchObject({ status: 400 });
    }

    await expect(service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code)).rejects.toMatchObject({ status: 429 });
  });

  it('rejects expired and consumed OTP challenges', async () => {
    const { repository, notifications, service } = makeService();
    const expired = await service.startRegistration({ email: 'expired@example.test', phone: '+255700000013' });
    repository.challenges.get(expired.challengeId).expiresAt = new Date(Date.now() - 1000);

    await expect(service.verifyOtp(expired.challengeId, notifications.phoneOtps[0].code)).rejects.toMatchObject({ status: 410 });

    const consumed = await service.startRegistration({ email: 'consumed@example.test', phone: '+255700000014' });
    const consumedCode = notifications.phoneOtps.at(-1)!.code;
    await service.verifyOtp(consumed.challengeId, consumedCode);
    await expect(service.verifyOtp(consumed.challengeId, consumedCode)).rejects.toMatchObject({ status: 410 });
  });

  it('requires email activation and legal acceptance before setting a password', async () => {
    const { repository, notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'gates@example.test', phone: '+255700000015' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);

    await expect(service.setPassword('gates@example.test', 'Strong123!', legalAcceptance())).rejects.toMatchObject({
      status: 409
    });

    expect(repository.challenges.get(otp.activationChallengeId).metadata.delivery).toMatchObject({ status: 'sent' });
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await expect(service.setPassword('gates@example.test', 'Strong123!')).rejects.toMatchObject({ status: 400 });
  });

  it('records accepted terms and privacy versions when setting a password', async () => {
    const { repository, notifications, service } = makeService();
    const termsPage = {
      id: 'terms-version-2026-06-06',
      pageKey: PublicPageKey.TERMS_AND_CONDITIONS,
      version: '2026.06.06',
      status: PublicPageStatus.PUBLISHED
    };
    const privacyPage = {
      id: 'privacy-version-2026-06-06',
      pageKey: PublicPageKey.PRIVACY_POLICY,
      version: '2026.06.06',
      status: PublicPageStatus.PUBLISHED
    };
    repository.publicPages.set(PublicPageKey.TERMS_AND_CONDITIONS, termsPage);
    repository.publicPages.set(PublicPageKey.PRIVACY_POLICY, privacyPage);
    const registration = await service.startRegistration({ email: 'legal@example.test', phone: '+255 700 000 004' });

    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('legal@example.test', 'Strong123!', {
      termsAccepted: true,
      privacyAccepted: true,
      termsVersionId: termsPage.id,
      privacyVersionId: privacyPage.id,
      source: 'registration',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest'
    });

    expect(repository.acceptances).toHaveLength(1);
    expect(repository.acceptances[0]).toMatchObject({
      termsVersionId: termsPage.id,
      privacyVersionId: privacyPage.id,
      source: 'registration',
      ipAddress: '127.0.0.1',
      userAgent: 'vitest',
      payload: {
        termsVersion: termsPage.version,
        privacyVersion: privacyPage.version
      }
    });
  });

  it('resends OTP after cooldown by replacing the previous pending challenge', async () => {
    const { repository, notifications, phoneValidationProvider, service } = makeService();
    const registration = await service.startRegistration({ email: 'resend@example.test', phone: '+255700000016' });

    await expect(service.resendOtp(registration.challengeId)).rejects.toMatchObject({ status: 429 });
    repository.challenges.get(registration.challengeId).createdAt = new Date(Date.now() - 31_000);

    const resent = await service.resendOtp(registration.challengeId);

    expect(resent.challengeId).not.toBe(registration.challengeId);
    expect(repository.challenges.get(registration.challengeId).status).toBe('REPLACED');
    expect(repository.challenges.get(resent.challengeId).status).toBe('PENDING');
    expect(notifications.phoneOtps).toHaveLength(2);
    expect((phoneValidationProvider as FakePhoneValidationProvider).calls).toEqual(['+255700000016', '+255700000016']);
  });

  it('sends password reset email and accepts the delivered reset code', async () => {
    const { notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'reset@example.test', phone: '+255700000017' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('reset@example.test', 'Strong123!', legalAcceptance());

    const reset = await service.forgotPassword('reset@example.test');
    expect(reset).toMatchObject({
      accountFound: true,
      challengeId: expect.any(String)
    });
    expect(notifications.resets).toHaveLength(1);
    expect(notifications.resets[0].actionUrl).toContain('/forgot-password?challengeId=');
    expect(notifications.resets[0].actionUrl).toContain(`#code=${notifications.resets[0].code}`);

    if (!reset.challengeId) throw new Error('Expected password reset response to include a challenge id.');
    await expect(service.verifyResetCode(resetChallengeIdFromEmail(notifications.resets[0]), notifications.resets[0].code)).resolves.toMatchObject({
      ok: true,
      challengeId: reset.challengeId
    });
    await service.resetPassword(reset.challengeId, notifications.resets[0].code, 'Better123!');
    const session = await service.signIn('reset@example.test', 'Better123!');

    expect(session.user.email).toBe('reset@example.test');
  });

  it('revokes existing sessions after password reset', async () => {
    const { notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'revoke@example.test', phone: '+255700000019' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('revoke@example.test', 'Strong123!', legalAcceptance());
    const oldSession = await service.signIn('revoke@example.test', 'Strong123!');

    await service.forgotPassword('revoke@example.test');
    await service.resetPassword(resetChallengeIdFromEmail(notifications.resets[0]), notifications.resets[0].code, 'Better123!');

    await expect(service.sessionFromToken(oldSession.token)).rejects.toMatchObject({ status: 401 });
  });

  it('reports missing password reset accounts and surfaces delivery failures for existing accounts', async () => {
    const { notifications, service } = makeService();
    const missing = await service.forgotPassword('missing@example.test');
    expect(missing).toMatchObject({
      ok: true,
      accountFound: false,
      message: 'No account found for this email.'
    });
    expect(notifications.resets).toHaveLength(0);

    const registration = await service.startRegistration({ email: 'suppressed@example.test', phone: '+255700000064' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations.at(-1)!.code);
    await service.setPassword('suppressed@example.test', 'Strong123!', legalAcceptance());
    notifications.failNext = true;
    await expect(service.forgotPassword('suppressed@example.test')).rejects.toMatchObject({ status: 502 });
  });

  it('verifies password reset codes before password changes and tracks failed attempts', async () => {
    const { repository, notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'verify-reset@example.test', phone: '+255700000065' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations.at(-1)!.code);
    await service.setPassword('verify-reset@example.test', 'Strong123!', legalAcceptance());

    const reset = await service.forgotPassword('verify-reset@example.test');
    if (!reset.challengeId) throw new Error('Expected password reset response to include a challenge id.');
    await expect(service.verifyResetCode(reset.challengeId, '000000')).rejects.toMatchObject({ status: 400 });
    expect(repository.challenges.get(reset.challengeId).attempts).toBe(1);

    await expect(service.verifyResetCode(reset.challengeId, notifications.resets.at(-1)!.code)).resolves.toMatchObject({
      ok: true,
      challengeId: reset.challengeId
    });
    expect(repository.challenges.get(reset.challengeId).status).toBe('PENDING');
  });

  it('records auth audit events without sensitive secrets', async () => {
    const { repository, notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'audit@example.test', phone: '+255700000020' }, { ipAddress: '127.0.0.1', userAgent: 'vitest' });
    await expect(service.verifyOtp(registration.challengeId, '111111', { ipAddress: '127.0.0.1' })).rejects.toMatchObject({ status: 400 });
    const otp = notifications.phoneOtps[0].code;

    const serialized = JSON.stringify(repository.auditEvents);
    expect(repository.auditEvents.some((event) => event.event === 'identity.auth.registration_started')).toBe(true);
    expect(repository.auditEvents.some((event) => event.event === 'identity.auth.phone_otp_failed_attempt')).toBe(true);
    expect(serialized).not.toContain(otp);
    expect(serialized).not.toContain('audit@example.test');
    expect(serialized).not.toContain('+255700000020');
  });

  it('marks a challenge failed when delivery fails and prevents its use', async () => {
    const { repository, notifications, service } = makeService();
    notifications.failNext = true;

    await expect(service.startRegistration({ email: 'delivery@example.test', phone: '+255700000018' })).rejects.toMatchObject({ status: 502 });

    const challenge = Array.from(repository.challenges.values())[0];
    expect(challenge.status).toBe('DELIVERY_FAILED');
    await expect(service.verifyOtp(challenge.id, '123456')).rejects.toMatchObject({ status: 410 });
  });

  it('looks up registry records through a provider and persists normalized results', async () => {
    const repository = new FakeIdentityRepository();
    const registryProvider = new FakeRegistryProvider();
    registryProvider.records.set('TRA:TIN-100', {
      source: 'TRA',
      registryNumber: 'TIN-100',
      entityType: 'business',
      name: 'Provider Business',
      status: 'MATCHED',
      confidence: 97,
      payload: { region: 'Dar es Salaam' }
    });
    const { service } = makeService(repository, new FakeIdentityNotifications(), registryProvider);

    const record = await service.registryLookup({
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registryNumber: 'TIN-100'
    });

    expect(record).toMatchObject({
      source: 'TRA',
      registryNumber: 'TIN-100',
      entityType: 'business',
      name: 'Provider Business',
      confidence: 97
    });
    expect(repository.registry.get('TRA:TIN-100')).toMatchObject({ name: 'Provider Business', payload: { region: 'Dar es Salaam' } });
    expect(repository.auditEvents.some((event) => event.event === 'identity.verification.registry_lookup_succeeded')).toBe(true);
  });

  it('returns a delivery-style provider error when registry lookup is unavailable', async () => {
    const registryProvider = new FakeRegistryProvider();
    registryProvider.failNext = true;
    const { service } = makeService(new FakeIdentityRepository(), new FakeIdentityNotifications(), registryProvider);

    await expect(
      service.registryLookup({
        entityType: 'company',
        registryNumber: 'BRELA-500'
      })
    ).rejects.toMatchObject({ status: 502 });
  });

  it('serves local test registry mocks only outside production', async () => {
    const { service } = makeService(new FakeIdentityRepository(), new FakeIdentityNotifications(), new FakeRegistryProvider());

    const tin = await service.registryLookup({
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registryNumber: '1234567890'
    });
    expect(tin).toMatchObject({
      source: 'TRA',
      registryNumber: '1234567890',
      entityType: 'business',
      name: 'Asha Juma Trading Enterprise',
      status: 'MATCHED',
      confidence: 100
    });
    expect(tin.payload).toMatchObject({ localDevelopmentRecord: true, mockIdentifier: true, provider: 'LOCAL_TRA_MOCK' });

    const arushaTin = await service.registryLookup({
      entityType: 'individual',
      registryNumber: '1098765432'
    });
    expect(arushaTin).toMatchObject({
      source: 'TRA',
      registryNumber: '1098765432',
      entityType: 'individual',
      name: 'Neema Ally Msuya'
    });

    const mwanzaTin = await service.registryLookup({
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registryNumber: '555666777'
    });
    expect(mwanzaTin).toMatchObject({
      source: 'TRA',
      registryNumber: '555666777',
      entityType: 'business',
      name: 'Mwanza Medical Supplies'
    });

    const brela = await service.registryLookup({
      entityType: 'company',
      registryNumber: '987654321'
    });
    expect(brela).toMatchObject({
      source: 'BRELA',
      registryNumber: '987654321',
      entityType: 'company',
      name: 'Local Test Supplies Limited',
      status: 'MATCHED',
      confidence: 100
    });
    expect(brela.payload).toMatchObject({ localDevelopmentRecord: true, mockIdentifier: true, provider: 'LOCAL_BRELA_MOCK' });

    const moshiBrela = await service.registryLookup({
      entityType: 'company',
      registryNumber: 'BRN-2024-001'
    });
    expect(moshiBrela).toMatchObject({
      source: 'BRELA',
      registryNumber: 'BRN-2024-001',
      entityType: 'company',
      name: 'Kilimanjaro Works Limited'
    });

    const zanzibarBusiness = await service.registryLookup({
      entityType: 'business',
      businessRegistrationSource: 'brela',
      registryNumber: 'BN-778899'
    });
    expect(zanzibarBusiness).toMatchObject({
      source: 'BRELA',
      registryNumber: 'BN-778899',
      entityType: 'business',
      name: 'Zanzibar Digital Services'
    });

    const newTraBusiness = await service.registryLookup({
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registryNumber: '2046813579'
    });
    expect(newTraBusiness).toMatchObject({
      source: 'TRA',
      registryNumber: '2046813579',
      entityType: 'business',
      name: 'Grace Stationery and Office Supplies'
    });

    const newBrelaCompany = await service.registryLookup({
      entityType: 'company',
      registryNumber: 'BRN-2025-014'
    });
    expect(newBrelaCompany).toMatchObject({
      source: 'BRELA',
      registryNumber: 'BRN-2025-014',
      entityType: 'company',
      name: 'Serengeti Office Solutions Limited'
    });

    process.env.APP_ENV = 'production';
    const productionOnly = makeService(new FakeIdentityRepository(), new FakeIdentityNotifications(), new FakeRegistryProvider()).service;
    await expect(
      productionOnly.registryLookup({
        entityType: 'individual',
        registryNumber: '1234567890'
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('auto-approves eKYC when a matching production registry record passes deterministic checks', async () => {
    const { repository, notifications, service } = makeService();
    repository.registry.set('TRA:TIN-001', {
      id: 'registry-1',
      source: 'TRA',
      registryNumber: 'TIN-001',
      entityType: 'business',
      name: 'Walkthrough Business',
      status: 'MATCHED',
      confidence: 100,
      payload: {}
    });
    const registration = await service.startRegistration({ email: 'ekyc@example.test', phone: '+255 700 000 003' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('ekyc@example.test', 'Strong123!', legalAcceptance());
    const session = await service.signIn('ekyc@example.test', 'Strong123!');
    const keyphrase = await requestSignatureForSession(service, session.token);

    const registry = await service.registryLookup({
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registryNumber: 'TIN-001'
    });
    const result = await service.submitVerification(session.token, {
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      registryVerified: true,
      registryRecordId: registry.id,
      signatureName: 'Walkthrough Owner',
      signatureConsent: true,
      signatureKeyphrase: keyphrase,
      location: testLocation
    });

    expect(registry.status).toBe('MATCHED');
    expect(result.autoApproved).toBe(true);
    expect(result.user.verificationStatus).toBe(VerificationStatus.APPROVED);
    expect(repository.signatures).toHaveLength(1);
    expect(repository.signatures[0]).toMatchObject({
      verificationProfileId: result.verification.id,
      signerName: 'Walkthrough Owner',
      status: 'SIGNED'
    });
    expect(repository.signatures[0].canonicalPayloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.signatures[0].signatureHash).toMatch(/^[a-f0-9]{64}$/);
    expect(repository.signatures[0].providerMetadata).toMatchObject({
      provider: 'procurex-keyphrase-ed25519-v1',
      algorithm: 'Ed25519'
    });
    expect(repository.history.some((entry) => entry.event === 'verification_submitted')).toBe(true);
    expect(repository.auditEvents.some((event) => event.event === 'identity.verification.signature_created')).toBe(true);
    expect(JSON.stringify(repository.signatures)).not.toContain(session.token);
    expect(JSON.stringify(repository.signatures)).not.toContain(keyphrase);
    expect(JSON.stringify(repository.profiles)).not.toContain(keyphrase);
  });

  it('auto-approves individual users with buyer and supplier capabilities', async () => {
    const { repository, notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'individual@example.test', phone: '+255700000081' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps.at(-1)!.code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations.at(-1)!.code);
    await service.setPassword('individual@example.test', 'Strong123!', legalAcceptance());
    const session = await service.signIn('individual@example.test', 'Strong123!');
    const keyphrase = await requestSignatureForSession(service, session.token);
    const registry = await service.registryLookup({ entityType: 'individual', registryNumber: '1234567890' });

    const result = await service.submitVerification(session.token, {
      entityType: 'individual',
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      registryVerified: true,
      registryRecordId: registry.id,
      signatureName: 'Asha Juma Mwinyi',
      signatureConsent: true,
      signatureKeyphrase: keyphrase,
      location: testLocation
    });

    expect(result.autoApproved).toBe(true);
    expect(result.user.capabilities).toEqual(expect.arrayContaining(['BUYER', 'SUPPLIER']));
    const organization = repository.usersByEmail.get('individual@example.test').memberships[0].organization;
    expect(organization.buyerProfile).toMatchObject({ procuringType: 'Verified individual buyer' });
    expect(organization.supplierProfile).toMatchObject({ trustTier: TrustTier.SILVER, riskLevel: RiskLevel.LOW });

    const refreshedSession = await service.signIn('individual@example.test', 'Strong123!');
    expect(refreshedSession.user.capabilities).toEqual(expect.arrayContaining(['BUYER', 'SUPPLIER']));
    expect(refreshedSession.user.permissions).toEqual(expect.arrayContaining(['procurement.create', 'bidding.submit']));
  });

  it('requires an active signing credential and matching keyphrase for eKYC submission', async () => {
    const { repository, notifications, service } = makeService();
    repository.registry.set('TRA:TIN-KEYPHRASE', {
      id: 'registry-keyphrase',
      source: 'TRA',
      registryNumber: 'TIN-KEYPHRASE',
      entityType: 'business',
      name: 'Keyphrase Business',
      status: 'MATCHED',
      confidence: 100,
      payload: {}
    });
    const registration = await service.startRegistration({ email: 'keyphrase@example.test', phone: '+255700000041' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps.at(-1)!.code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations.at(-1)!.code);
    await service.setPassword('keyphrase@example.test', 'Strong123!', legalAcceptance());
    const session = await service.signIn('keyphrase@example.test', 'Strong123!');
    const registry = await service.registryLookup({ entityType: 'business', businessRegistrationSource: 'tin', registryNumber: 'TIN-KEYPHRASE' });
    const input = {
      entityType: 'business' as const,
      businessRegistrationSource: 'tin' as const,
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      registryVerified: true as const,
      registryRecordId: registry.id,
      signatureName: 'Keyphrase Owner',
      signatureConsent: true as const,
      location: testLocation
    };

    await expect(service.submitVerification(session.token, { ...input, signatureKeyphrase: 'Signing123' })).rejects.toMatchObject({ status: 409 });
    const keyphrase = await requestSignatureForSession(service, session.token);
    const { location: _location, ...missingLocationInput } = input;
    await expect(service.submitVerification(session.token, { ...missingLocationInput, signatureKeyphrase: keyphrase })).rejects.toMatchObject({ status: 400 });
    await expect(service.submitVerification(session.token, { ...input, signatureKeyphrase: 'Wrong123' })).rejects.toMatchObject({ status: 403 });
    await expect(service.submitVerification(session.token, { ...input, signatureKeyphrase: keyphrase })).resolves.toMatchObject({ autoApproved: true });
  });

  it('returns computed IAM access context in sessions after trust evaluation', async () => {
    const { repository, notifications, service } = makeService();
    repository.registry.set('TRA:TIN-ACCESS', {
      id: 'registry-access',
      source: 'TRA',
      registryNumber: 'TIN-ACCESS',
      entityType: 'business',
      name: 'Access Business',
      status: 'MATCHED',
      confidence: 100,
      payload: {}
    });
    const registration = await service.startRegistration({ email: 'access@example.test', phone: '+255700000031' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps.at(-1)!.code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations.at(-1)!.code);
    await service.setPassword('access@example.test', 'Strong123!', legalAcceptance());
    const session = await service.signIn('access@example.test', 'Strong123!');
    const keyphrase = await requestSignatureForSession(service, session.token);
    const registry = await service.registryLookup({ entityType: 'business', businessRegistrationSource: 'tin', registryNumber: 'TIN-ACCESS' });

    const submitted = await service.submitVerification(session.token, {
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      registryVerified: true,
      registryRecordId: registry.id,
      signatureName: 'Access Owner',
      signatureConsent: true,
      signatureKeyphrase: keyphrase,
      location: testLocation,
      profile: { displayName: 'Access Business' },
      documents: [{ type: 'registry', status: 'fetched' }]
    });

    expect(submitted.user.screeningStatus).toBe('CLEAR');
    expect(submitted.user.trustTier).toBe(TrustTier.SILVER);
    expect(submitted.user.riskLevel).toBe(RiskLevel.LOW);
    expect(submitted.user.permissions).toEqual(expect.arrayContaining(['procurement.create', 'procurement.publish', 'bidding.submit', 'evaluation.manage']));
    expect(submitted.user.featureGates).toMatchObject({
      tenderCreation: true,
      bidSubmission: true,
      evaluationManagement: true
    });
    await expect(service.requirePermission(session.token, 'procurement.create')).resolves.toBeTruthy();
  });

  it('routes local sanctions/watchlist matches to admin review while temporary core gates stay open', async () => {
    const { repository, notifications, service } = makeService();
    repository.registry.set('TRA:TIN-BLOCKED', {
      id: 'registry-blocked',
      source: 'TRA',
      registryNumber: 'TIN-BLOCKED',
      entityType: 'business',
      name: 'Sanctioned Supplier Limited',
      status: 'MATCHED',
      confidence: 100,
      payload: {}
    });
    const registration = await service.startRegistration({ email: 'blocked@example.test', phone: '+255700000032' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps.at(-1)!.code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations.at(-1)!.code);
    await service.setPassword('blocked@example.test', 'Strong123!', legalAcceptance());
    const session = await service.signIn('blocked@example.test', 'Strong123!');
    const keyphrase = await requestSignatureForSession(service, session.token);
    const registry = await service.registryLookup({ entityType: 'business', businessRegistrationSource: 'tin', registryNumber: 'TIN-BLOCKED' });
    const result = await service.submitVerification(session.token, {
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      registryVerified: true,
      registryRecordId: registry.id,
      signatureName: 'Blocked Owner',
      signatureConsent: true,
      signatureKeyphrase: keyphrase,
      location: testLocation
    });

    expect(result.autoApproved).toBe(false);
    expect(result.user.verificationStatus).toBe(VerificationStatus.PENDING);
    expect(result.user.screeningStatus).toBe('BLOCKED');
    expect(result.user.permissions).toEqual(expect.arrayContaining(['procurement.create', 'procurement.publish', 'bidding.submit', 'evaluation.manage']));
    expect(result.user.permissions).not.toContain('admin.access');
    await expect(service.requirePermission(session.token, 'procurement.create')).resolves.toBeTruthy();
    await expect(service.requirePermission(session.token, 'compliance.review')).rejects.toMatchObject({ status: 403 });
    expect(result.reviewReasons.join(' ')).toMatch(/sanctions|debarment/i);
  });

  it('routes duplicate approved registry numbers to admin review', async () => {
    const { repository, notifications, service } = makeService();
    repository.registry.set('TRA:TIN-200', {
      id: 'registry-duplicate',
      source: 'TRA',
      registryNumber: 'TIN-200',
      entityType: 'business',
      name: 'Duplicate Business',
      status: 'MATCHED',
      confidence: 100,
      payload: {}
    });

    const first = await service.startRegistration({ email: 'duplicate-one@example.test', phone: '+255700000021' });
    const firstOtp = await service.verifyOtp(first.challengeId, notifications.phoneOtps.at(-1)!.code);
    await service.activateEmail(firstOtp.activationChallengeId, notifications.activations.at(-1)!.code);
    await service.setPassword('duplicate-one@example.test', 'Strong123!', legalAcceptance());
    const firstSession = await service.signIn('duplicate-one@example.test', 'Strong123!');
    const firstKeyphrase = await requestSignatureForSession(service, firstSession.token, 'SigningOne123');
    const firstRegistry = await service.registryLookup({ entityType: 'business', businessRegistrationSource: 'tin', registryNumber: 'TIN-200' });
    await service.submitVerification(firstSession.token, {
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registrySource: firstRegistry.source,
      registryNumber: firstRegistry.registryNumber,
      registryVerified: true,
      registryRecordId: firstRegistry.id,
      signatureName: 'First Owner',
      signatureConsent: true,
      signatureKeyphrase: firstKeyphrase,
      location: testLocation
    });

    const second = await service.startRegistration({ email: 'duplicate-two@example.test', phone: '+255700000022' });
    const secondOtp = await service.verifyOtp(second.challengeId, notifications.phoneOtps.at(-1)!.code);
    await service.activateEmail(secondOtp.activationChallengeId, notifications.activations.at(-1)!.code);
    await service.setPassword('duplicate-two@example.test', 'Strong123!', legalAcceptance());
    const secondSession = await service.signIn('duplicate-two@example.test', 'Strong123!');
    const secondKeyphrase = await requestSignatureForSession(service, secondSession.token, 'SigningTwo123');
    const secondRegistry = await service.registryLookup({ entityType: 'business', businessRegistrationSource: 'tin', registryNumber: 'TIN-200' });
    const result = await service.submitVerification(secondSession.token, {
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registrySource: secondRegistry.source,
      registryNumber: secondRegistry.registryNumber,
      registryVerified: true,
      registryRecordId: secondRegistry.id,
      signatureName: 'Second Owner',
      signatureConsent: true,
      signatureKeyphrase: secondKeyphrase,
      location: testLocation
    });

    expect(result.autoApproved).toBe(false);
    expect(result.user.verificationStatus).toBe(VerificationStatus.PENDING);
    expect(result.reviewReasons).toContain('Another approved account already uses this registry number.');
  });

  it('records verification history for admin approval decisions', async () => {
    const { repository, notifications, service } = makeService();
    repository.registry.set('TRA:TIN-300', {
      id: 'registry-pending',
      source: 'TRA',
      registryNumber: 'TIN-300',
      entityType: 'individual',
      name: 'Pending Individual',
      status: 'MATCHED',
      confidence: 80,
      payload: {}
    });
    const registration = await service.startRegistration({ email: 'pending@example.test', phone: '+255700000023' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('pending@example.test', 'Strong123!', legalAcceptance());
    const session = await service.signIn('pending@example.test', 'Strong123!');
    const keyphrase = await requestSignatureForSession(service, session.token);
    const registry = await service.registryLookup({ entityType: 'individual', registryNumber: 'TIN-300' });
    const submitted = await service.submitVerification(session.token, {
      entityType: 'individual',
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      registryVerified: true,
      registryRecordId: registry.id,
      signatureName: 'Pending Owner',
      signatureConsent: true,
      signatureKeyphrase: keyphrase,
      location: testLocation
    });

    const admin = await service.startRegistration({ email: 'admin@example.test', phone: '+255700000024' });
    const adminOtp = await service.verifyOtp(admin.challengeId, notifications.phoneOtps.at(-1)!.code);
    await service.activateEmail(adminOtp.activationChallengeId, notifications.activations.at(-1)!.code);
    await service.setPassword('admin@example.test', 'Strong123!', legalAcceptance());
    const adminUser = repository.usersByEmail.get('admin@example.test');
    adminUser.accountType = AccountType.ADMIN;
    const adminSession = await service.signIn('admin@example.test', 'Strong123!');

    await service.decideAdminVerification(adminSession.token, submitted.verification.id, 'approve', 'Registry confidence manually reviewed.');

    expect(repository.history.some((entry) => entry.event === 'admin_approve' && entry.verificationProfileId === submitted.verification.id)).toBe(true);
    expect(repository.auditEvents.some((event) => event.event === 'identity.verification.admin_approve')).toBe(true);
    const approvedOrganization = repository.usersByEmail.get('pending@example.test').memberships[0].organization;
    const capabilities = approvedOrganization.capabilities.map((item: { capability: string }) => item.capability);
    expect(capabilities).toEqual(expect.arrayContaining(['BUYER', 'SUPPLIER']));
    expect(approvedOrganization.buyerProfile).toMatchObject({ procuringType: 'Verified individual buyer' });
  });
});
