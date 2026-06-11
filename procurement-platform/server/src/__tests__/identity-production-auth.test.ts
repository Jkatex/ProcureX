import { AccountType, PublicPageKey, PublicPageStatus, RiskLevel, TrustTier, VerificationStatus } from '@prisma/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModuleService } from '../modules/identity/service.js';
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
  trustHistory: any[] = [];
  screeningChecks: any[] = [];
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
  activations: Array<{ to: string; code: string }> = [];
  resets: Array<{ to: string; code: string }> = [];
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

  sendEmailActivation(input: { to: string; code: string }) {
    this.maybeFail();
    this.activations.push(input);
    return Promise.resolve({ provider: 'fake-email', messageId: `activation-${this.activations.length}` });
  }

  sendPasswordReset(input: { to: string; code: string }) {
    this.maybeFail();
    this.resets.push(input);
    return Promise.resolve({ provider: 'fake-email', messageId: `reset-${this.resets.length}` });
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

function makeService(repository = new FakeIdentityRepository(), notifications = new FakeIdentityNotifications(), registryProvider?: RegistryProvider) {
  return {
    repository,
    notifications,
    registryProvider,
    service: new ModuleService(repository as any, notifications, registryProvider)
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

describe('identity production auth', () => {
  it('sends phone OTP by SMS and rejects a fallback OTP', async () => {
    const { repository, notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'new-user@example.test', phone: '+255 700 000 001' });

    expect(notifications.phoneOtps).toHaveLength(1);
    expect(notifications.phoneOtps[0]).toMatchObject({ to: '+255700000001' });
    expect(repository.challenges.get(registration.challengeId).codeHash).not.toBe(notifications.phoneOtps[0].code);
    await expect(service.verifyOtp(registration.challengeId, '000000')).rejects.toMatchObject({ status: 400 });
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
  });

  it('normalizes Tanzanian phone numbers and rejects duplicate phone registrations', async () => {
    const { service } = makeService();

    const first = await service.startRegistration({ email: 'first@example.test', phone: '0712 345 678' });
    expect(first.user.phone).toBe('+255712345678');

    await expect(service.startRegistration({ email: 'second@example.test', phone: '+255 712 345 678' })).rejects.toMatchObject({
      status: 409
    });
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
    const { repository, notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'resend@example.test', phone: '+255700000016' });

    await expect(service.resendOtp(registration.challengeId)).rejects.toMatchObject({ status: 429 });
    repository.challenges.get(registration.challengeId).createdAt = new Date(Date.now() - 31_000);

    const resent = await service.resendOtp(registration.challengeId);

    expect(resent.challengeId).not.toBe(registration.challengeId);
    expect(repository.challenges.get(registration.challengeId).status).toBe('REPLACED');
    expect(repository.challenges.get(resent.challengeId).status).toBe('PENDING');
    expect(notifications.phoneOtps).toHaveLength(2);
  });

  it('sends password reset email and accepts the delivered reset code', async () => {
    const { notifications, service } = makeService();
    const registration = await service.startRegistration({ email: 'reset@example.test', phone: '+255700000017' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('reset@example.test', 'Strong123!', legalAcceptance());

    const reset = await service.forgotPassword('reset@example.test');
    expect(reset.challengeId).toBeTruthy();
    expect(notifications.resets).toHaveLength(1);

    await service.resetPassword(reset.challengeId!, notifications.resets[0].code, 'Better123!');
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

    const reset = await service.forgotPassword('revoke@example.test');
    await service.resetPassword(reset.challengeId!, notifications.resets[0].code, 'Better123!');

    await expect(service.sessionFromToken(oldSession.token)).rejects.toMatchObject({ status: 401 });
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
      signatureConsent: true
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
    expect(repository.history.some((entry) => entry.event === 'verification_submitted')).toBe(true);
    expect(repository.auditEvents.some((event) => event.event === 'identity.verification.signature_created')).toBe(true);
    expect(JSON.stringify(repository.signatures)).not.toContain(session.token);
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
    const registry = await service.registryLookup({ entityType: 'business', businessRegistrationSource: 'tin', registryNumber: 'TIN-BLOCKED' });
    const result = await service.submitVerification(session.token, {
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      registryVerified: true,
      registryRecordId: registry.id,
      signatureName: 'Blocked Owner',
      signatureConsent: true
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
    const firstRegistry = await service.registryLookup({ entityType: 'business', businessRegistrationSource: 'tin', registryNumber: 'TIN-200' });
    await service.submitVerification(firstSession.token, {
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registrySource: firstRegistry.source,
      registryNumber: firstRegistry.registryNumber,
      registryVerified: true,
      registryRecordId: firstRegistry.id,
      signatureName: 'First Owner',
      signatureConsent: true
    });

    const second = await service.startRegistration({ email: 'duplicate-two@example.test', phone: '+255700000022' });
    const secondOtp = await service.verifyOtp(second.challengeId, notifications.phoneOtps.at(-1)!.code);
    await service.activateEmail(secondOtp.activationChallengeId, notifications.activations.at(-1)!.code);
    await service.setPassword('duplicate-two@example.test', 'Strong123!', legalAcceptance());
    const secondSession = await service.signIn('duplicate-two@example.test', 'Strong123!');
    const secondRegistry = await service.registryLookup({ entityType: 'business', businessRegistrationSource: 'tin', registryNumber: 'TIN-200' });
    const result = await service.submitVerification(secondSession.token, {
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registrySource: secondRegistry.source,
      registryNumber: secondRegistry.registryNumber,
      registryVerified: true,
      registryRecordId: secondRegistry.id,
      signatureName: 'Second Owner',
      signatureConsent: true
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
      entityType: 'business',
      name: 'Pending Business',
      status: 'MATCHED',
      confidence: 80,
      payload: {}
    });
    const registration = await service.startRegistration({ email: 'pending@example.test', phone: '+255700000023' });
    const otp = await service.verifyOtp(registration.challengeId, notifications.phoneOtps[0].code);
    await service.activateEmail(otp.activationChallengeId, notifications.activations[0].code);
    await service.setPassword('pending@example.test', 'Strong123!', legalAcceptance());
    const session = await service.signIn('pending@example.test', 'Strong123!');
    const registry = await service.registryLookup({ entityType: 'business', businessRegistrationSource: 'tin', registryNumber: 'TIN-300' });
    const submitted = await service.submitVerification(session.token, {
      entityType: 'business',
      businessRegistrationSource: 'tin',
      registrySource: registry.source,
      registryNumber: registry.registryNumber,
      registryVerified: true,
      registryRecordId: registry.id,
      signatureName: 'Pending Owner',
      signatureConsent: true
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
  });
});
