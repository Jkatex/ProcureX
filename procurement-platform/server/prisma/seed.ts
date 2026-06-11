import fs from 'node:fs';
import path from 'node:path';
import { createHash, createHmac, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  AccountType,
  OrganizationCapabilityName,
  OrganizationKind,
  PublicPageKey,
  PublicPageStatus,
  RiskLevel,
  TrustTier,
  VerificationStatus
} from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { withDbContext } from '../src/db/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientPublicPagesPath = path.resolve(__dirname, '../../client/src/features/public/components/procurex');
const scrypt = promisify(scryptCallback);

type AnyRecord = Record<string, any>;

async function hashSeedPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

function sha256Seed(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJsonSeed(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJsonSeed(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJsonSeed(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function signatureHashSeed(value: string): string {
  return createHmac('sha256', process.env.SIGNATURE_HASH_SECRET || 'seed-demo-signature-secret').update(value).digest('hex');
}

function extractClientPageHtml(fileName: string): string {
  const source = fs.readFileSync(path.join(clientPublicPagesPath, fileName), 'utf8');
  const match = source.match(/const html = ("(?:\\.|[^"\\])*");/);
  if (!match) throw new Error(`Could not find generated HTML in ${fileName}`);
  return JSON.parse(match[1]);
}

function publicPageSeedData() {
  const effectiveAt = new Date('2026-06-06T00:00:00.000Z');
  const pages = [
    {
      pageKey: PublicPageKey.ABOUT_PROCUREX,
      fileName: 'AboutProcurexPage.tsx',
      title: 'About ProcureX',
      summary: 'ProcureX is a digital procurement platform for tendering, bidding, evaluation, awards, contracts, and records.'
    },
    {
      pageKey: PublicPageKey.PRIVACY_POLICY,
      fileName: 'PrivacyPolicyProcurexPage.tsx',
      title: 'Privacy Policy',
      summary: 'How ProcureX collects, uses, stores, protects, and shares procurement platform information.'
    },
    {
      pageKey: PublicPageKey.TERMS_AND_CONDITIONS,
      fileName: 'TermsAndConditionsProcurexPage.tsx',
      title: 'Terms and Conditions',
      summary: 'Rules, responsibilities, rights, and limitations for using the ProcureX procurement platform.'
    }
  ];

  return pages.map((page) => {
    const html = extractClientPageHtml(page.fileName);
    return {
      pageKey: page.pageKey,
      version: '2026.06.06',
      status: PublicPageStatus.PUBLISHED,
      title: page.title,
      summary: page.summary,
      content: { html },
      contentHash: sha256Seed(html),
      effectiveAt,
      publishedAt: effectiveAt
    };
  });
}

async function main() {
  await withDbContext({ accountType: AccountType.ADMIN }, async (tx) => {
    const db = tx as AnyRecord;

    const platformOrg = await db.organization.upsert({
      where: { name: 'ProcureX Platform' },
      update: { kind: OrganizationKind.PLATFORM, country: 'TZ' },
      create: { name: 'ProcureX Platform', kind: OrganizationKind.PLATFORM, country: 'TZ' }
    });

    const demoOrg = await db.organization.upsert({
      where: { name: 'Kilimanjaro Supplies Limited' },
      update: {
        kind: OrganizationKind.COMPANY,
        taxId: null,
        country: 'TZ',
        metadata: {
          entityType: 'company',
          registrySource: 'BRELA',
          registryNumber: '123456789',
          demoAccount: true
        }
      },
      create: {
        name: 'Kilimanjaro Supplies Limited',
        kind: OrganizationKind.COMPANY,
        country: 'TZ',
        metadata: {
          entityType: 'company',
          registrySource: 'BRELA',
          registryNumber: '123456789',
          demoAccount: true
        }
      }
    });

    for (const capability of [OrganizationCapabilityName.BUYER, OrganizationCapabilityName.SUPPLIER]) {
      await db.organizationCapability.upsert({
        where: { organizationId_capability: { organizationId: demoOrg.id, capability } },
        update: { enabled: true },
        create: { organizationId: demoOrg.id, capability, enabled: true }
      });
    }

    await db.organizationProfile.upsert({
      where: { organizationId: demoOrg.id },
      update: {
        summary: 'Verified demo organization for a clean first-run ProcureX account.',
        payload: { demoAccount: true, firstRun: true }
      },
      create: {
        organizationId: demoOrg.id,
        summary: 'Verified demo organization for a clean first-run ProcureX account.',
        payload: { demoAccount: true, firstRun: true }
      }
    });

    await db.buyerProfile.upsert({
      where: { organizationId: demoOrg.id },
      update: { procuringType: 'Demo procuring entity', payload: { demoAccount: true } },
      create: { organizationId: demoOrg.id, procuringType: 'Demo procuring entity', payload: { demoAccount: true } }
    });

    await db.supplierProfile.upsert({
      where: { organizationId: demoOrg.id },
      update: {
        trustTier: TrustTier.PLATINUM,
        riskLevel: RiskLevel.LOW,
        bidLimit: 999999999999,
        categories: []
      },
      create: {
        organizationId: demoOrg.id,
        trustTier: TrustTier.PLATINUM,
        riskLevel: RiskLevel.LOW,
        bidLimit: 999999999999,
        categories: []
      }
    });

    const adminUser = await db.user.upsert({
      where: { email: 'admin@procurex.tz' },
      update: {
        displayName: 'Admin User',
        accountType: AccountType.ADMIN,
        verificationStatus: VerificationStatus.APPROVED,
        passwordHash: await hashSeedPassword('Admin123!'),
        metadata: { phoneVerified: true, emailVerified: true }
      },
      create: {
        email: 'admin@procurex.tz',
        phone: '+255715555666',
        displayName: 'Admin User',
        accountType: AccountType.ADMIN,
        verificationStatus: VerificationStatus.APPROVED,
        passwordHash: await hashSeedPassword('Admin123!'),
        metadata: { phoneVerified: true, emailVerified: true }
      }
    });

    const demoUser = await db.user.upsert({
      where: { email: 'demo@procurex.tz' },
      update: {
        displayName: 'Demo Verified User',
        accountType: AccountType.USER,
        verificationStatus: VerificationStatus.APPROVED,
        passwordHash: await hashSeedPassword('Demo123!'),
        metadata: {
          phoneVerified: true,
          emailVerified: true,
          entityType: 'company',
          registrySource: 'BRELA',
          registryNumber: '123456789',
          verifiedName: 'Kilimanjaro Supplies Limited',
          demoAccount: true
        }
      },
      create: {
        email: 'demo@procurex.tz',
        phone: '+255713333444',
        displayName: 'Demo Verified User',
        accountType: AccountType.USER,
        verificationStatus: VerificationStatus.APPROVED,
        passwordHash: await hashSeedPassword('Demo123!'),
        metadata: {
          phoneVerified: true,
          emailVerified: true,
          entityType: 'company',
          registrySource: 'BRELA',
          registryNumber: '123456789',
          verifiedName: 'Kilimanjaro Supplies Limited',
          demoAccount: true
        }
      }
    });

    for (const user of [adminUser, demoUser]) {
      await db.account.upsert({
        where: { provider_providerUserId: { provider: 'password', providerUserId: user.email } },
        update: { accountType: user.accountType },
        create: { userId: user.id, provider: 'password', providerUserId: user.email, accountType: user.accountType }
      });
    }

    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: platformOrg.id, userId: adminUser.id } },
      update: { status: 'ACTIVE', isDefault: true },
      create: {
        organizationId: platformOrg.id,
        userId: adminUser.id,
        status: 'ACTIVE',
        isDefault: true,
        title: 'Platform compliance administrator'
      }
    });

    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: demoOrg.id, userId: demoUser.id } },
      update: { status: 'ACTIVE', isDefault: true },
      create: {
        organizationId: demoOrg.id,
        userId: demoUser.id,
        status: 'ACTIVE',
        isDefault: true,
        title: 'Demo verified operator'
      }
    });

    const demoRegistryRecord = await db.registryRecord.upsert({
      where: { source_registryNumber: { source: 'BRELA', registryNumber: '123456789' } },
      update: {
        entityType: 'company',
        name: 'Kilimanjaro Supplies Limited',
        status: 'MATCHED',
        confidence: 100,
        payload: {
          registrationNumber: '123456789',
          companyType: 'Private limited company',
          registeredOn: '2021-02-12',
          location: 'Arusha, Tanzania',
          summaryRows: [
            ['Company name', 'Kilimanjaro Supplies Limited'],
            ['BRELA number', '123456789'],
            ['Status', 'Active'],
            ['Location', 'Arusha, Tanzania']
          ]
        }
      },
      create: {
        source: 'BRELA',
        registryNumber: '123456789',
        entityType: 'company',
        name: 'Kilimanjaro Supplies Limited',
        status: 'MATCHED',
        confidence: 100,
        payload: {
          registrationNumber: '123456789',
          companyType: 'Private limited company',
          registeredOn: '2021-02-12',
          location: 'Arusha, Tanzania',
          summaryRows: [
            ['Company name', 'Kilimanjaro Supplies Limited'],
            ['BRELA number', '123456789'],
            ['Status', 'Active'],
            ['Location', 'Arusha, Tanzania']
          ]
        }
      }
    });

    const demoProfileId = '00000000-0000-4000-8000-000000000101';
    const demoSignatureId = '00000000-0000-4000-8000-000000000102';
    const demoHistoryId = '00000000-0000-4000-8000-000000000103';
    const demoScreeningId = '00000000-0000-4000-8000-000000000104';
    const demoTrustHistoryId = '00000000-0000-4000-8000-000000000105';
    const demoSignedAt = new Date('2026-06-06T00:00:00.000Z');
    const demoConsentVersion = '2026.06.06';
    const demoConsentTitle = 'ProcureX identity verification signature consent';
    const demoSignedPayload = {
      verificationProfileId: demoProfileId,
      userId: demoUser.id,
      registrySource: demoRegistryRecord.source,
      registryNumber: demoRegistryRecord.registryNumber,
      registryRecordId: demoRegistryRecord.id,
      entityType: 'company',
      signerName: 'Demo Verified User',
      signerTitle: 'Authorized Signatory',
      consentVersion: demoConsentVersion,
      consentTitle: demoConsentTitle,
      signedAt: demoSignedAt.toISOString()
    };
    const demoCanonicalPayloadHash = sha256Seed(canonicalJsonSeed(demoSignedPayload));
    const demoSignatureHash = signatureHashSeed(`${demoCanonicalPayloadHash}:${demoUser.id}:${demoProfileId}`);
    const demoRegistryPayload = {
      id: demoRegistryRecord.id,
      source: demoRegistryRecord.source,
      registryNumber: demoRegistryRecord.registryNumber,
      entityType: demoRegistryRecord.entityType,
      name: demoRegistryRecord.name,
      status: demoRegistryRecord.status,
      confidence: demoRegistryRecord.confidence,
      payload: demoRegistryRecord.payload
    };
    const demoVerificationPayload = {
      entityType: 'company',
      businessRegistrationSource: 'brela',
      registrySource: demoRegistryRecord.source,
      registryNumber: demoRegistryRecord.registryNumber,
      registryVerified: true,
      registryRecordId: demoRegistryRecord.id,
      signatureName: 'Demo Verified User',
      signatureTitle: 'Authorized Signatory',
      signatureConsent: true,
      signatureConsentVersion: demoConsentVersion,
      signatureConsentTitle: demoConsentTitle,
      registryRecord: demoRegistryPayload,
      verifiedName: demoRegistryRecord.name,
      reviewReasons: [],
      autoApproved: true,
      screening: {
        provider: 'deterministic-local-v1',
        status: 'CLEAR',
        reasons: [],
        providerMetadata: { demoAccount: true, developmentBypass: true }
      },
      submittedAt: demoSignedAt.toISOString(),
      digitalSignature: {
        id: demoSignatureId,
        status: 'SIGNED',
        signedAt: demoSignedAt.toISOString(),
        canonicalPayloadHash: demoCanonicalPayloadHash,
        consentVersion: demoConsentVersion,
        consentTitle: demoConsentTitle,
        blockchainAnchorStatus: 'PENDING_IMPLEMENTATION'
      }
    };

    await db.verificationProfile.upsert({
      where: { id: demoProfileId },
      update: {
        userId: demoUser.id,
        organizationId: demoOrg.id,
        status: VerificationStatus.APPROVED,
        registrySource: demoRegistryRecord.source,
        registryNumber: demoRegistryRecord.registryNumber,
        payload: demoVerificationPayload
      },
      create: {
        id: demoProfileId,
        userId: demoUser.id,
        organizationId: demoOrg.id,
        status: VerificationStatus.APPROVED,
        registrySource: demoRegistryRecord.source,
        registryNumber: demoRegistryRecord.registryNumber,
        payload: demoVerificationPayload
      }
    });

    await db.digitalSignature.upsert({
      where: { id: demoSignatureId },
      update: {
        verificationProfileId: demoProfileId,
        userId: demoUser.id,
        organizationId: demoOrg.id,
        signerName: 'Demo Verified User',
        signerTitle: 'Authorized Signatory',
        consentVersion: demoConsentVersion,
        consentTitle: demoConsentTitle,
        canonicalPayloadHash: demoCanonicalPayloadHash,
        signatureHash: demoSignatureHash,
        status: 'SIGNED',
        signedAt: demoSignedAt,
        metadata: { seeded: true, demoAccount: true },
        providerMetadata: { provider: 'procurex-seed-secure-hash-v1' },
        blockchainMetadata: { anchorStatus: 'PENDING_IMPLEMENTATION' }
      },
      create: {
        id: demoSignatureId,
        verificationProfileId: demoProfileId,
        userId: demoUser.id,
        organizationId: demoOrg.id,
        signerName: 'Demo Verified User',
        signerTitle: 'Authorized Signatory',
        consentVersion: demoConsentVersion,
        consentTitle: demoConsentTitle,
        canonicalPayloadHash: demoCanonicalPayloadHash,
        signatureHash: demoSignatureHash,
        status: 'SIGNED',
        signedAt: demoSignedAt,
        metadata: { seeded: true, demoAccount: true },
        providerMetadata: { provider: 'procurex-seed-secure-hash-v1' },
        blockchainMetadata: { anchorStatus: 'PENDING_IMPLEMENTATION' }
      }
    });

    await db.verificationProfileHistory.upsert({
      where: { id: demoHistoryId },
      update: {
        verificationProfileId: demoProfileId,
        userId: demoUser.id,
        organizationId: demoOrg.id,
        status: VerificationStatus.APPROVED,
        registrySource: demoRegistryRecord.source,
        registryNumber: demoRegistryRecord.registryNumber,
        event: 'seed_demo_verified',
        payload: demoVerificationPayload
      },
      create: {
        id: demoHistoryId,
        verificationProfileId: demoProfileId,
        userId: demoUser.id,
        organizationId: demoOrg.id,
        status: VerificationStatus.APPROVED,
        registrySource: demoRegistryRecord.source,
        registryNumber: demoRegistryRecord.registryNumber,
        event: 'seed_demo_verified',
        payload: demoVerificationPayload
      }
    });

    await db.screeningCheck.upsert({
      where: { id: demoScreeningId },
      update: {
        userId: demoUser.id,
        verificationProfileId: demoProfileId,
        organizationId: demoOrg.id,
        provider: 'deterministic-local-v1',
        status: 'CLEAR',
        reasons: [],
        providerMetadata: { demoAccount: true, developmentBypass: true }
      },
      create: {
        id: demoScreeningId,
        userId: demoUser.id,
        verificationProfileId: demoProfileId,
        organizationId: demoOrg.id,
        provider: 'deterministic-local-v1',
        status: 'CLEAR',
        reasons: [],
        providerMetadata: { demoAccount: true, developmentBypass: true }
      }
    });

    await db.trustTierHistory.upsert({
      where: { id: demoTrustHistoryId },
      update: {
        organizationId: demoOrg.id,
        userId: demoUser.id,
        verificationProfileId: demoProfileId,
        previousTier: TrustTier.GOLD,
        nextTier: TrustTier.PLATINUM,
        riskLevel: RiskLevel.LOW,
        score: 100,
        reasons: ['Development demo account with full buyer and supplier gates enabled.']
      },
      create: {
        id: demoTrustHistoryId,
        organizationId: demoOrg.id,
        userId: demoUser.id,
        verificationProfileId: demoProfileId,
        previousTier: TrustTier.GOLD,
        nextTier: TrustTier.PLATINUM,
        riskLevel: RiskLevel.LOW,
        score: 100,
        reasons: ['Development demo account with full buyer and supplier gates enabled.']
      }
    });

    for (const module of ['public', 'identity', 'organization', 'procurement', 'bidding', 'evaluation', 'award-contract', 'financial', 'compliance-admin', 'communication', 'records', 'intelligence', 'integration', 'documents']) {
      await db.moduleRegistry.upsert({
        where: { name: module },
        update: { status: 'Available', version: '0.1.0', payload: { seeded: true } },
        create: { name: module, status: 'Available', version: '0.1.0', payload: { seeded: true } }
      });
    }

    for (const page of publicPageSeedData()) {
      await db.publicPageVersion.upsert({
        where: { pageKey_version: { pageKey: page.pageKey, version: page.version } },
        update: page,
        create: page
      });
    }

    const demoTermsVersion = await db.publicPageVersion.findUnique({
      where: { pageKey_version: { pageKey: PublicPageKey.TERMS_AND_CONDITIONS, version: '2026.06.06' } }
    });
    const demoPrivacyVersion = await db.publicPageVersion.findUnique({
      where: { pageKey_version: { pageKey: PublicPageKey.PRIVACY_POLICY, version: '2026.06.06' } }
    });
    if (!demoTermsVersion || !demoPrivacyVersion) throw new Error('Seeded legal page versions were not found for demo account.');

    await db.userPolicyAcceptance.upsert({
      where: { id: '00000000-0000-4000-8000-000000000104' },
      update: {
        userId: demoUser.id,
        termsVersionId: demoTermsVersion.id,
        privacyVersionId: demoPrivacyVersion.id,
        source: 'seed-demo',
        payload: {
          seeded: true,
          termsVersion: demoTermsVersion.version,
          privacyVersion: demoPrivacyVersion.version
        }
      },
      create: {
        id: '00000000-0000-4000-8000-000000000104',
        userId: demoUser.id,
        termsVersionId: demoTermsVersion.id,
        privacyVersionId: demoPrivacyVersion.id,
        source: 'seed-demo',
        payload: {
          seeded: true,
          termsVersion: demoTermsVersion.version,
          privacyVersion: demoPrivacyVersion.version
        }
      }
    });
  }, prisma);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    console.log('ProcureX demo/admin-only seed completed.');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
