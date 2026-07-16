import {
  AccountType,
  AdminActionType,
  AuditSeverity,
  OrganizationCapabilityName,
  OrganizationKind,
  RiskLevel,
  TrustTier,
  PublicPageKey,
  PublicPageStatus,
  VerificationStatus,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';

const userInclude = {
  preference: true,
  memberships: {
    where: { status: 'ACTIVE' as const, isDefault: true },
    include: {
      organization: {
        include: {
          supplierProfile: true,
          trustTierHistory: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          capabilities: {
            where: { enabled: true }
          }
        }
      }
    },
    take: 1
  },
  screeningChecks: {
    orderBy: { createdAt: 'desc' as const },
    take: 1
  }
} satisfies Prisma.UserInclude;

export type UserWithDefaultOrg = Prisma.UserGetPayload<{ include: typeof userInclude }>;

const sessionInclude = {
  user: {
    include: userInclude
  },
  organization: {
    include: {
      supplierProfile: true,
      trustTierHistory: {
        orderBy: { createdAt: 'desc' },
        take: 5
      },
      capabilities: {
        where: { enabled: true }
      }
    }
  }
} satisfies Prisma.SessionInclude;

export type SessionWithUser = Prisma.SessionGetPayload<{ include: typeof sessionInclude }>;

export type VerificationWithUser = Prisma.VerificationProfileGetPayload<{
  include: { user: { include: typeof userInclude } };
}>;

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  findUserByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email: email.toLowerCase() },
      include: userInclude
    });
  }

  findUserByPhone(phone: string) {
    return this.db.user.findFirst({
      where: { phone },
      include: userInclude
    });
  }

  findUserById(id: string) {
    return this.db.user.findUnique({
      where: { id },
      include: userInclude
    });
  }

  findPreference(userId: string) {
    return this.db.userPreference.findUnique({
      where: { userId }
    });
  }

  findActiveSigningCredential(userId: string) {
    return this.db.signingCredential.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' }
    });
  }

  createSigningCredential(input: {
    userId: string;
    publicKeyPem: string;
    keyFingerprint: string;
    encryptedPrivateKey: string;
    kdfMetadata: Prisma.InputJsonObject;
    encryptionMetadata: Prisma.InputJsonObject;
    providerMetadata: Prisma.InputJsonObject;
  }) {
    return this.db.signingCredential.create({
      data: input
    });
  }

  revokeActiveSigningCredential(userId: string) {
    return this.db.signingCredential.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'REVOKED', revokedAt: new Date() }
    });
  }

  updateSigningCredential(
    id: string,
    input: {
      encryptedPrivateKey: string;
      kdfMetadata: Prisma.InputJsonObject;
      encryptionMetadata: Prisma.InputJsonObject;
      providerMetadata: Prisma.InputJsonObject;
    }
  ) {
    return this.db.signingCredential.update({
      where: { id },
      data: input
    });
  }

  createKeyphraseRecovery(input: {
    userId?: string | null;
    organizationId?: string | null;
    email: string;
    phoneMasked?: string | null;
    emailChallengeId?: string | null;
    phoneChallengeId?: string | null;
    status?: string;
    requestMetadata?: Prisma.InputJsonObject;
    payload?: Prisma.InputJsonObject;
  }) {
    return this.db.keyphraseRecovery.create({
      data: {
        userId: input.userId ?? null,
        organizationId: input.organizationId ?? null,
        email: input.email,
        phoneMasked: input.phoneMasked ?? null,
        emailChallengeId: input.emailChallengeId ?? null,
        phoneChallengeId: input.phoneChallengeId ?? null,
        status: input.status ?? 'STARTED',
        requestMetadata: input.requestMetadata ?? {},
        payload: input.payload ?? {}
      }
    });
  }

  findKeyphraseRecovery(id: string) {
    return this.db.keyphraseRecovery.findUnique({
      where: { id },
      include: { user: { include: userInclude }, organization: true }
    });
  }

  updateKeyphraseRecovery(id: string, data: Prisma.KeyphraseRecoveryUpdateInput) {
    return this.db.keyphraseRecovery.update({
      where: { id },
      data
    });
  }

  listKeyphraseRecoveriesForUser(userId: string) {
    return this.db.keyphraseRecovery.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  listKeyphraseRecoveriesForAdmin() {
    return this.db.keyphraseRecovery.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { user: { select: { id: true, email: true, displayName: true } }, organization: { select: { id: true, name: true } } }
    });
  }

  upsertPreference(input: { userId: string; preferredLanguage?: string; timezone?: string; metadata?: Prisma.InputJsonObject }) {
    return this.db.userPreference.upsert({
      where: { userId: input.userId },
      update: {
        ...(input.preferredLanguage !== undefined ? { preferredLanguage: input.preferredLanguage } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {})
      },
      create: {
        userId: input.userId,
        preferredLanguage: input.preferredLanguage ?? 'en',
        timezone: input.timezone ?? 'Africa/Dar_es_Salaam',
        metadata: input.metadata ?? {}
      }
    });
  }

  async upsertRegistrationUser(input: { email: string; phone: string; displayName: string }) {
    return this.db.user.upsert({
      where: { email: input.email.toLowerCase() },
      update: {
        phone: input.phone,
        displayName: input.displayName
      },
      create: {
        email: input.email.toLowerCase(),
        phone: input.phone,
        displayName: input.displayName,
        accountType: AccountType.USER,
        verificationStatus: VerificationStatus.NOT_STARTED,
        metadata: {}
      },
      include: userInclude
    });
  }

  updateUser(id: string, data: Prisma.UserUpdateInput) {
    return this.db.user.update({
      where: { id },
      data,
      include: userInclude
    });
  }

  listMfaFactors(userId: string) {
    return this.db.mfaFactor.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  findMfaFactor(id: string) {
    return this.db.mfaFactor.findUnique({
      where: { id }
    });
  }

  findVerifiedTotpFactor(userId: string) {
    return this.db.mfaFactor.findFirst({
      where: { userId, type: 'totp', verified: true },
      orderBy: { createdAt: 'desc' }
    });
  }

  createMfaFactor(input: { userId: string; type: string; secretRef?: string | null; verified?: boolean }) {
    return this.db.mfaFactor.create({
      data: {
        userId: input.userId,
        type: input.type,
        secretRef: input.secretRef ?? null,
        verified: input.verified ?? false
      }
    });
  }

  verifyMfaFactor(id: string) {
    return this.db.mfaFactor.update({
      where: { id },
      data: { verified: true }
    });
  }

  createChallenge(input: {
    userId?: string;
    purpose: string;
    target: string;
    codeHash: string;
    expiresAt: Date;
    metadata?: Prisma.InputJsonObject;
  }) {
    return this.db.identityChallenge.create({
      data: {
        userId: input.userId,
        purpose: input.purpose,
        target: input.target,
        codeHash: input.codeHash,
        expiresAt: input.expiresAt,
        metadata: input.metadata ?? {}
      }
    });
  }

  findChallenge(id: string) {
    return this.db.identityChallenge.findUnique({
      where: { id },
      include: { user: { include: userInclude } }
    });
  }

  incrementChallengeAttempts(id: string) {
    return this.db.identityChallenge.update({
      where: { id },
      data: { attempts: { increment: 1 } }
    });
  }

  updateChallenge(id: string, data: Prisma.IdentityChallengeUpdateInput) {
    return this.db.identityChallenge.update({
      where: { id },
      data
    });
  }

  replacePendingChallenges(input: { userId?: string | null; purpose: string; target: string; exceptId?: string }) {
    return this.db.identityChallenge.updateMany({
      where: {
        userId: input.userId ?? undefined,
        purpose: input.purpose,
        target: input.target,
        status: 'PENDING',
        ...(input.exceptId ? { id: { not: input.exceptId } } : {})
      },
      data: {
        status: 'REPLACED',
        consumedAt: new Date()
      }
    });
  }

  consumeChallenge(id: string) {
    return this.db.identityChallenge.update({
      where: { id },
      data: {
        status: 'CONSUMED',
        consumedAt: new Date()
      },
      include: { user: { include: userInclude } }
    });
  }

  upsertPasswordAccount(userId: string, email: string) {
    return this.db.account.upsert({
      where: {
        provider_providerUserId: {
          provider: 'password',
          providerUserId: email.toLowerCase()
        }
      },
      update: { accountType: AccountType.USER },
      create: {
        userId,
        provider: 'password',
        providerUserId: email.toLowerCase(),
        accountType: AccountType.USER
      }
    });
  }

  findCurrentPublicPageVersion(pageKey: PublicPageKey) {
    return this.db.publicPageVersion.findFirst({
      where: {
        pageKey,
        status: PublicPageStatus.PUBLISHED,
        effectiveAt: {
          lte: new Date()
        }
      },
      orderBy: [{ effectiveAt: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }]
    });
  }

  findPublicPageVersionById(id: string) {
    return this.db.publicPageVersion.findUnique({
      where: { id }
    });
  }

  createUserPolicyAcceptance(input: {
    userId: string;
    termsVersionId: string;
    privacyVersionId: string;
    source: string;
    ipAddress?: string;
    userAgent?: string;
    payload?: Prisma.InputJsonObject;
  }) {
    return this.db.userPolicyAcceptance.create({
      data: {
        userId: input.userId,
        termsVersionId: input.termsVersionId,
        privacyVersionId: input.privacyVersionId,
        source: input.source,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        payload: input.payload ?? {}
      }
    });
  }

  createSession(input: { userId: string; organizationId?: string; tokenHash: string; expiresAt: Date }) {
    return this.db.session.create({
      data: {
        userId: input.userId,
        organizationId: input.organizationId,
        tokenHash: input.tokenHash,
        expiresAt: input.expiresAt
      },
      include: sessionInclude
    });
  }

  async hasPriorSession(userId: string) {
    const count = await this.db.session.count({
      where: { userId }
    });
    return count > 0;
  }

  findActiveSession(tokenHash: string) {
    return this.db.session.findFirst({
      where: {
        tokenHash,
        status: 'ACTIVE',
        expiresAt: { gt: new Date() }
      },
      include: sessionInclude
    });
  }

  revokeSession(tokenHash: string) {
    return this.db.session.updateMany({
      where: { tokenHash, status: 'ACTIVE' },
      data: { status: 'REVOKED' }
    });
  }

  revokeSessionsForUser(userId: string) {
    return this.db.session.updateMany({
      where: { userId, status: 'ACTIVE' },
      data: { status: 'REVOKED' }
    });
  }

  findRegistryRecord(source: string, registryNumber: string) {
    return this.db.registryRecord.findUnique({
      where: {
        source_registryNumber: {
          source,
          registryNumber
        }
      }
    });
  }

  upsertRegistryRecord(input: {
    source: string;
    registryNumber: string;
    entityType: string;
    name: string;
    status: string;
    confidence: number;
    payload: Prisma.InputJsonObject;
  }) {
    return this.db.registryRecord.upsert({
      where: {
        source_registryNumber: {
          source: input.source,
          registryNumber: input.registryNumber
        }
      },
      update: {
        entityType: input.entityType,
        name: input.name,
        status: input.status,
        confidence: input.confidence,
        payload: input.payload
      },
      create: input
    });
  }

  latestVerificationProfile(userId: string) {
    return this.db.verificationProfile.findFirst({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });
  }

  upsertVerificationProfile(input: {
    userId: string;
    organizationId?: string | null;
    status: VerificationStatus;
    registrySource?: string | null;
    registryNumber?: string | null;
    payload: Prisma.InputJsonObject;
  }) {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.verificationProfile.findFirst({
        where: { userId: input.userId },
        orderBy: { updatedAt: 'desc' }
      });

      if (existing) {
        return tx.verificationProfile.update({
          where: { id: existing.id },
          data: {
            organizationId: input.organizationId,
            status: input.status,
            registrySource: input.registrySource,
            registryNumber: input.registryNumber,
            payload: input.payload
          }
        });
      }

      return tx.verificationProfile.create({
        data: {
          userId: input.userId,
          organizationId: input.organizationId,
          status: input.status,
          registrySource: input.registrySource,
          registryNumber: input.registryNumber,
          payload: input.payload
        }
      });
    });
  }

  createVerificationHistory(input: {
    verificationProfileId: string;
    userId: string;
    organizationId?: string | null;
    status: VerificationStatus;
    registrySource?: string | null;
    registryNumber?: string | null;
    event: string;
    payload: Prisma.InputJsonObject;
  }) {
    return this.db.verificationProfileHistory.create({
      data: input
    });
  }

  createDigitalSignature(input: {
    verificationProfileId: string;
    userId: string;
    organizationId?: string | null;
    signerName: string;
    signerTitle?: string | null;
    consentVersion: string;
    consentTitle: string;
    canonicalPayloadHash: string;
    signatureHash: string;
    metadata: Prisma.InputJsonObject;
    providerMetadata?: Prisma.InputJsonObject;
    blockchainMetadata?: Prisma.InputJsonObject;
  }) {
    return this.db.digitalSignature.create({
      data: {
        ...input,
        providerMetadata: input.providerMetadata ?? {},
        blockchainMetadata: input.blockchainMetadata ?? {}
      }
    });
  }

  countApprovedRegistryDuplicates(input: {
    userId: string;
    registrySource: string;
    registryNumber: string;
  }) {
    return this.db.verificationProfile.count({
      where: {
        userId: { not: input.userId },
        status: VerificationStatus.APPROVED,
        registrySource: input.registrySource,
        registryNumber: input.registryNumber
      }
    });
  }

  async createOrUpdateVerifiedOrganization(input: {
    userId: string;
    organizationName: string;
    entityType: string;
    registrySource: string;
    registryNumber: string;
  }) {
    const organization = await this.db.organization.upsert({
      where: { name: input.organizationName },
      update: {
        taxId: input.registrySource === 'TRA' ? input.registryNumber : undefined,
        metadata: {
          entityType: input.entityType,
          registrySource: input.registrySource,
          registryNumber: input.registryNumber
        }
      },
      create: {
        name: input.organizationName,
        kind: OrganizationKind.COMPANY,
        taxId: input.registrySource === 'TRA' ? input.registryNumber : undefined,
        country: 'TZ',
        metadata: {
          entityType: input.entityType,
          registrySource: input.registrySource,
          registryNumber: input.registryNumber
        }
      }
    });

    await this.db.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: organization.id,
          userId: input.userId
        }
      },
      update: { status: 'ACTIVE', isDefault: true },
      create: {
        organizationId: organization.id,
        userId: input.userId,
        status: 'ACTIVE',
        isDefault: true,
        title: input.entityType === 'individual' ? 'Verified individual' : 'Verified account owner'
      }
    });

    const capabilities = [OrganizationCapabilityName.BUYER, OrganizationCapabilityName.SUPPLIER];

    for (const capability of capabilities) {
      await this.db.organizationCapability.upsert({
        where: {
          organizationId_capability: {
            organizationId: organization.id,
            capability
          }
        },
        update: { enabled: true },
        create: {
          organizationId: organization.id,
          capability,
          enabled: true
        }
      });
    }

    await this.db.buyerProfile.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: {
        organizationId: organization.id,
        procuringType: input.entityType === 'individual' ? 'Verified individual buyer' : 'Verified procuring entity',
        payload: {
          entityType: input.entityType,
          registrySource: input.registrySource,
          registryNumber: input.registryNumber
        }
      }
    });

    await this.db.supplierProfile.upsert({
      where: { organizationId: organization.id },
      update: {},
      create: {
        organizationId: organization.id,
        trustTier: TrustTier.UNVERIFIED,
        riskLevel: RiskLevel.MEDIUM
      }
    });

    return organization;
  }

  createScreeningCheck(input: {
    userId: string;
    verificationProfileId?: string | null;
    organizationId?: string | null;
    provider: string;
    status: string;
    reasons: Prisma.InputJsonArray;
    providerMetadata: Prisma.InputJsonObject;
  }) {
    return this.db.screeningCheck.create({
      data: input
    });
  }

  latestScreeningCheckForUser(userId: string) {
    return this.db.screeningCheck.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async upsertSupplierTrust(input: {
    organizationId: string;
    trustTier: TrustTier;
    riskLevel: RiskLevel;
    score: number;
    reasons: Prisma.InputJsonArray;
    userId?: string | null;
    verificationProfileId?: string | null;
  }) {
    const existing = await this.db.supplierProfile.findUnique({
      where: { organizationId: input.organizationId }
    });

    const profile = await this.db.supplierProfile.upsert({
      where: { organizationId: input.organizationId },
      update: {
        trustTier: input.trustTier,
        riskLevel: input.riskLevel
      },
      create: {
        organizationId: input.organizationId,
        trustTier: input.trustTier,
        riskLevel: input.riskLevel
      }
    });

    await this.db.trustTierHistory.create({
      data: {
        organizationId: input.organizationId,
        userId: input.userId,
        verificationProfileId: input.verificationProfileId,
        previousTier: existing?.trustTier,
        nextTier: input.trustTier,
        riskLevel: input.riskLevel,
        score: input.score,
        reasons: input.reasons
      }
    });

    return profile;
  }

  createTrustTierHistory(input: {
    organizationId?: string | null;
    userId?: string | null;
    verificationProfileId?: string | null;
    previousTier?: TrustTier | null;
    nextTier: TrustTier;
    riskLevel: RiskLevel;
    score: number;
    reasons: Prisma.InputJsonArray;
  }) {
    return this.db.trustTierHistory.create({
      data: input
    });
  }

  listVerificationProfiles(status?: VerificationStatus) {
    return this.db.verificationProfile.findMany({
      where: status ? { status } : undefined,
      include: {
        user: {
          include: userInclude
        }
      },
      orderBy: { updatedAt: 'desc' }
    });
  }

  findVerificationProfileById(id: string) {
    return this.db.verificationProfile.findUnique({
      where: { id },
      include: {
        user: {
          include: userInclude
        }
      }
    });
  }

  updateVerificationStatus(id: string, status: VerificationStatus, payload: Prisma.InputJsonObject, organizationId?: string | null) {
    return this.db.verificationProfile.update({
      where: { id },
      data: {
        status,
        payload,
        ...(organizationId !== undefined ? { organizationId } : {})
      },
      include: {
        user: {
          include: userInclude
        }
      }
    });
  }

  createAuditEvent(input: {
    actorUserId?: string | null;
    ownerOrgId?: string | null;
    event: string;
    entityType: string;
    entityRef?: string | null;
    severity?: AuditSeverity;
    payload?: Prisma.InputJsonObject;
  }) {
    return this.db.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        ownerOrgId: input.ownerOrgId,
        event: input.event,
        entityType: input.entityType,
        entityRef: input.entityRef,
        severity: input.severity ?? AuditSeverity.INFO,
        payload: input.payload ?? {}
      }
    });
  }

  createAdminAction(input: {
    actorUserId?: string | null;
    ownerOrgId?: string | null;
    actionType: AdminActionType;
    entityType: string;
    entityRef?: string | null;
    summary?: string;
  }) {
    return this.db.adminAction.create({
      data: {
        actorUserId: input.actorUserId,
        ownerOrgId: input.ownerOrgId,
        actionType: input.actionType,
        entityType: input.entityType,
        entityRef: input.entityRef,
        summary: input.summary
      }
    });
  }
}
