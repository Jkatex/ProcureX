import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHash, createHmac, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import {
  AccountType,
  AdminActionType,
  AuditSeverity,
  BidStatus,
  CommunicationKind,
  CommunicationPriority,
  CommunicationStatus,
  ContractStatus,
  ContractType,
  EvaluationStage,
  EvaluationStatus,
  InvoiceStatus,
  OrganizationCapabilityName,
  OrganizationKind,
  ProcurementMethod,
  PublicPageKey,
  PublicPageStatus,
  RecommendationStatus,
  TenderStatus,
  TenderType,
  TrustTier,
  VerificationStatus,
  Visibility
} from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { withDbContext } from '../src/db/context.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uiDataPath = path.resolve(__dirname, '../../../procurex-ui/js/data.js');
const clientPublicPagesPath = path.resolve(__dirname, '../../client/src/features/public/components/procurex');

type AnyRecord = Record<string, any>;
const scrypt = promisify(scryptCallback);

async function hashSeedPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

function loadUiMockData(): AnyRecord {
  const source = fs.readFileSync(uiDataPath, 'utf8');
  const sandbox: AnyRecord = { window: {}, console };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: uiDataPath });
  return sandbox.window.mockData;
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

function parseDate(value?: string | Date | null): Date | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? undefined : value;
  const iso = String(value).match(/\d{4}-\d{2}-\d{2}/)?.[0];
  const parsed = Date.parse(iso ?? String(value).replace(/\s+EAT\b/g, ''));
  return Number.isNaN(parsed) ? undefined : new Date(parsed);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 80);
}

function tenderType(value?: string): TenderType {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('good')) return TenderType.GOODS;
  if (normalized.includes('consult')) return TenderType.CONSULTANCY;
  if (normalized.includes('service')) return TenderType.SERVICE;
  return TenderType.WORKS;
}

function tenderStatus(value?: string): TenderStatus {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('draft')) return TenderStatus.DRAFT;
  if (normalized.includes('evaluation')) return TenderStatus.EVALUATION;
  if (normalized.includes('award')) return TenderStatus.AWARDED;
  if (normalized.includes('closed')) return TenderStatus.CLOSED;
  if (normalized.includes('cancel')) return TenderStatus.CANCELLED;
  if (normalized.includes('publish')) return TenderStatus.PUBLISHED;
  if (normalized.includes('review')) return TenderStatus.REVIEW;
  return TenderStatus.OPEN;
}

function procurementMethod(value?: string): ProcurementMethod {
  return /invite/i.test(String(value ?? '')) ? ProcurementMethod.INVITED_TENDER : ProcurementMethod.OPEN_TENDER;
}

function visibility(value?: string): Visibility {
  if (/private/i.test(String(value ?? ''))) return Visibility.PRIVATE;
  if (/invite/i.test(String(value ?? ''))) return Visibility.INVITED;
  return Visibility.PUBLIC_MARKETPLACE;
}

function contractType(value?: string): ContractType {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('lump')) return ContractType.LUMP_SUM;
  if (normalized.includes('framework')) return ContractType.FRAMEWORK;
  if (normalized.includes('time')) return ContractType.TIME_AND_MATERIALS;
  if (normalized.includes('unit')) return ContractType.UNIT_PRICE;
  return ContractType.OTHER;
}

function communicationKind(value?: string): CommunicationKind {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('clarification')) return CommunicationKind.CLARIFICATION;
  if (normalized.includes('alert')) return CommunicationKind.ALERT;
  if (normalized.includes('notification')) return CommunicationKind.NOTIFICATION;
  return CommunicationKind.MESSAGE;
}

function communicationStatus(value?: string): CommunicationStatus {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('action')) return CommunicationStatus.ACTION_REQUIRED;
  if (normalized.includes('pending')) return CommunicationStatus.PENDING_RESPONSE;
  if (normalized.includes('reply')) return CommunicationStatus.REPLIED;
  if (normalized.includes('resolved') || normalized.includes('answered')) return CommunicationStatus.RESOLVED;
  if (normalized.includes('archive')) return CommunicationStatus.ARCHIVED;
  if (normalized.includes('delete')) return CommunicationStatus.DELETED;
  if (normalized.includes('complete')) return CommunicationStatus.COMPLETED;
  if (normalized.includes('read')) return CommunicationStatus.READ;
  return CommunicationStatus.UNREAD;
}

function communicationPriority(value?: string): CommunicationPriority {
  const normalized = String(value ?? '').toLowerCase();
  if (normalized.includes('urgent')) return CommunicationPriority.URGENT;
  if (normalized.includes('high')) return CommunicationPriority.HIGH;
  if (normalized.includes('low')) return CommunicationPriority.LOW;
  return CommunicationPriority.NORMAL;
}

async function ensureDocument(db: AnyRecord, input: {
  ownerOrgId?: string;
  uploadedByUserId?: string;
  name: string;
  documentType: string;
  objectKey: string;
  metadata?: AnyRecord;
}) {
  return db.documentObject.upsert({
    where: { objectKey: input.objectKey },
    update: {
      ownerOrgId: input.ownerOrgId,
      uploadedByUserId: input.uploadedByUserId,
      name: input.name,
      documentType: input.documentType,
      metadata: input.metadata ?? {}
    },
    create: input
  });
}

async function main() {
  const mockData = loadUiMockData();

  await withDbContext({ accountType: AccountType.ADMIN }, async (tx) => {
    const db = tx as AnyRecord;

    const platformOrg = await db.organization.upsert({
      where: { name: 'ProcureX Platform' },
      update: { kind: OrganizationKind.PLATFORM },
      create: { name: 'ProcureX Platform', kind: OrganizationKind.PLATFORM, country: 'TZ' }
    });

    const companyOrg = await db.organization.upsert({
      where: { name: mockData.users?.current?.organization ?? 'Kilimanjaro Supplies Limited' },
      update: { kind: OrganizationKind.COMPANY },
      create: {
        name: mockData.users?.current?.organization ?? 'Kilimanjaro Supplies Limited',
        kind: OrganizationKind.COMPANY,
        taxId: 'TIN-101-2026',
        country: 'TZ'
      }
    });

    for (const capability of [OrganizationCapabilityName.BUYER, OrganizationCapabilityName.SUPPLIER]) {
      await db.organizationCapability.upsert({
        where: { organizationId_capability: { organizationId: companyOrg.id, capability } },
        update: { enabled: true },
        create: { organizationId: companyOrg.id, capability, enabled: true }
      });
    }

    await db.organizationProfile.upsert({
      where: { organizationId: companyOrg.id },
      update: { summary: 'Seeded company account that can operate as buyer and supplier.', payload: mockData.users?.current ?? {} },
      create: {
        organizationId: companyOrg.id,
        summary: 'Seeded company account that can operate as buyer and supplier.',
        payload: mockData.users?.current ?? {}
      }
    });

    await db.buyerProfile.upsert({
      where: { organizationId: companyOrg.id },
      update: { procuringType: 'Company procuring entity', payload: mockData.users?.buyer ?? {} },
      create: { organizationId: companyOrg.id, procuringType: 'Company procuring entity', payload: mockData.users?.buyer ?? {} }
    });

    await db.supplierProfile.upsert({
      where: { organizationId: companyOrg.id },
      update: {
        trustTier: TrustTier.VERIFIED,
        bidLimit: mockData.users?.current?.bidLimit ?? 5000000000,
        categories: ['Healthcare infrastructure', 'Water Pumps and Spare Parts']
      },
      create: {
        organizationId: companyOrg.id,
        trustTier: TrustTier.VERIFIED,
        bidLimit: mockData.users?.current?.bidLimit ?? 5000000000,
        categories: ['Healthcare infrastructure', 'Water Pumps and Spare Parts']
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
        phone: '+255 715 555 666',
        displayName: 'Admin User',
        accountType: AccountType.ADMIN,
        verificationStatus: VerificationStatus.APPROVED,
        passwordHash: await hashSeedPassword('Admin123!'),
        metadata: { phoneVerified: true, emailVerified: true }
      }
    });

    const companyUser = await db.user.upsert({
      where: { email: 'user@company.tz' },
      update: {
        displayName: mockData.users?.current?.name ?? 'Kilimanjaro Supplies Limited',
        accountType: AccountType.USER,
        verificationStatus: VerificationStatus.APPROVED,
        passwordHash: await hashSeedPassword('Procure1!'),
        metadata: { phoneVerified: true, emailVerified: true }
      },
      create: {
        email: 'user@company.tz',
        phone: '+255 713 111 222',
        displayName: mockData.users?.current?.name ?? 'Kilimanjaro Supplies Limited',
        accountType: AccountType.USER,
        verificationStatus: VerificationStatus.APPROVED,
        passwordHash: await hashSeedPassword('Procure1!'),
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
        phone: '+255 713 333 444',
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

    for (const user of [adminUser, companyUser, demoUser]) {
      await db.account.upsert({
        where: { provider_providerUserId: { provider: 'password', providerUserId: user.email } },
        update: { accountType: user.accountType },
        create: { userId: user.id, provider: 'password', providerUserId: user.email, accountType: user.accountType }
      });
    }

    const registryRecords = [
      {
        source: 'TRA',
        registryNumber: '123-456-789',
        entityType: 'individual',
        name: 'Mariam Saidi Nyoni',
        payload: {
          tin: '123-456-789',
          email: 'mariam.nyoni@example.co.tz',
          mobileNumber: '0718 462 390',
          physicalAddress: 'Plot 24, Mbezi Beach, Dar es Salaam',
          postalAddress: 'P.O. Box 20418',
          taxRegion: 'DSM',
          registeredOn: '2022-05-18',
          summaryRows: [
            ['Name', 'Mariam Saidi Nyoni'],
            ['Taxpayer Identification Number', '123-456-789'],
            ['Status', 'CER'],
            ['Location', 'Dar es Salaam, Tanzania']
          ]
        }
      },
      {
        source: 'BRELA',
        registryNumber: '123456789',
        entityType: 'company',
        name: 'Kilimanjaro Supplies Limited',
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
      {
        source: 'BRELA',
        registryNumber: 'BN-123456',
        entityType: 'business',
        name: 'Zahra Omari Business Services',
        payload: {
          businessNumber: 'BN-123456',
          registrationMethod: 'BRELA business name',
          registeredOn: '2023-09-04',
          location: 'Dodoma, Tanzania',
          summaryRows: [
            ['Business name', 'Zahra Omari Business Services'],
            ['Business number', 'BN-123456'],
            ['Status', 'Active'],
            ['Location', 'Dodoma, Tanzania']
          ]
        }
      }
    ];

    for (const record of registryRecords) {
      await db.registryRecord.upsert({
        where: { source_registryNumber: { source: record.source, registryNumber: record.registryNumber } },
        update: record,
        create: record
      });
    }

    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: platformOrg.id, userId: adminUser.id } },
      update: { status: 'ACTIVE', isDefault: true },
      create: { organizationId: platformOrg.id, userId: adminUser.id, status: 'ACTIVE', title: 'Platform compliance administrator' }
    });
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: companyOrg.id, userId: companyUser.id } },
      update: { status: 'ACTIVE', isDefault: true },
      create: { organizationId: companyOrg.id, userId: companyUser.id, status: 'ACTIVE', title: 'Company operator' }
    });
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId: companyOrg.id, userId: demoUser.id } },
      update: { status: 'ACTIVE', isDefault: true },
      create: { organizationId: companyOrg.id, userId: demoUser.id, status: 'ACTIVE', isDefault: true, title: 'Demo verified operator' }
    });

    const demoRegistryRecord = await db.registryRecord.findUnique({
      where: { source_registryNumber: { source: 'BRELA', registryNumber: '123456789' } }
    });
    if (!demoRegistryRecord) throw new Error('Seeded BRELA registry record was not found for demo account.');

    const demoProfileId = '00000000-0000-4000-8000-000000000101';
    const demoSignatureId = '00000000-0000-4000-8000-000000000102';
    const demoHistoryId = '00000000-0000-4000-8000-000000000103';
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
        organizationId: companyOrg.id,
        status: VerificationStatus.APPROVED,
        registrySource: demoRegistryRecord.source,
        registryNumber: demoRegistryRecord.registryNumber,
        payload: demoVerificationPayload
      },
      create: {
        id: demoProfileId,
        userId: demoUser.id,
        organizationId: companyOrg.id,
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
        organizationId: companyOrg.id,
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
        organizationId: companyOrg.id,
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
        organizationId: companyOrg.id,
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
        organizationId: companyOrg.id,
        status: VerificationStatus.APPROVED,
        registrySource: demoRegistryRecord.source,
        registryNumber: demoRegistryRecord.registryNumber,
        event: 'seed_demo_verified',
        payload: demoVerificationPayload
      }
    });

    const externalBuyer = await db.organization.upsert({
      where: { name: 'Medical Stores Department' },
      update: { kind: OrganizationKind.COMPANY },
      create: { name: 'Medical Stores Department', kind: OrganizationKind.COMPANY, country: 'TZ' }
    });
    await db.organizationCapability.upsert({
      where: { organizationId_capability: { organizationId: externalBuyer.id, capability: OrganizationCapabilityName.BUYER } },
      update: { enabled: true },
      create: { organizationId: externalBuyer.id, capability: OrganizationCapabilityName.BUYER }
    });

    const tenders = (mockData.tenders ?? []).slice(0, 3);
    const seededTenders: AnyRecord[] = [];
    for (const [index, tender] of tenders.entries()) {
      const buyerOrg = index === 1 ? externalBuyer : companyOrg;
      const reference = tender.reference || tender.id;
      const savedTender = await db.tender.upsert({
        where: { reference },
        update: {
          buyerOrgId: buyerOrg.id,
          ownerUserId: buyerOrg.id === companyOrg.id ? companyUser.id : null,
          title: tender.title,
          description: tender.description,
          type: tenderType(tender.type || tender.procurementTypeId),
          status: tenderStatus(tender.status),
          method: procurementMethod(tender.method),
          visibility: visibility(tender.visibility),
          budget: tender.budget ?? undefined,
          location: tender.location,
          contractType: contractType(tender.contractType),
          closingDate: parseDate(tender.closingDate),
          requirements: tender.requirements ?? {},
          metadata: tender
        },
        create: {
          reference,
          buyerOrgId: buyerOrg.id,
          ownerUserId: buyerOrg.id === companyOrg.id ? companyUser.id : null,
          title: tender.title,
          description: tender.description,
          type: tenderType(tender.type || tender.procurementTypeId),
          status: tenderStatus(tender.status),
          method: procurementMethod(tender.method),
          visibility: visibility(tender.visibility),
          budget: tender.budget ?? undefined,
          location: tender.location,
          contractType: contractType(tender.contractType),
          closingDate: parseDate(tender.closingDate),
          requirements: tender.requirements ?? {},
          metadata: tender
        }
      });
      seededTenders.push(savedTender);

      await db.tenderCategory.deleteMany({ where: { tenderId: savedTender.id } });
      await db.tenderRequirement.deleteMany({ where: { tenderId: savedTender.id } });
      await db.tenderMilestone.deleteMany({ where: { tenderId: savedTender.id } });
      await db.tenderCommercialItem.deleteMany({ where: { tenderId: savedTender.id } });
      await db.tenderDocument.deleteMany({ where: { tenderId: savedTender.id } });

      await db.tenderCategory.createMany({
        data: (tender.categories ?? [tender.category].filter(Boolean)).map((name: string) => ({ tenderId: savedTender.id, name })),
        skipDuplicates: true
      });
      await db.tenderRequirement.create({
        data: { tenderId: savedTender.id, section: 'requirements', payload: tender.requirements ?? {} }
      });
      await db.tenderMilestone.createMany({
        data: (tender.milestones ?? []).map((item: AnyRecord) => ({
          tenderId: savedTender.id,
          name: item.name,
          dueDate: parseDate(item.date),
          payload: item
        }))
      });
      await db.tenderCommercialItem.createMany({
        data: (tender.commercialItems ?? tender.boqItems ?? []).map((item: AnyRecord) => ({
          tenderId: savedTender.id,
          itemNo: item.item,
          description: item.description || item.workItem || 'Commercial item',
          quantity: item.qty ?? item.quantity ?? undefined,
          unit: item.unit,
          rate: item.rate ?? undefined,
          total: item.totalCost ?? undefined,
          payload: item
        }))
      });

      for (const name of tender.documents ?? []) {
        const document = await ensureDocument(db, {
          ownerOrgId: buyerOrg.id,
          uploadedByUserId: buyerOrg.id === companyOrg.id ? companyUser.id : undefined,
          name,
          documentType: 'Tender document',
          objectKey: `tenders/${reference}/${slug(name)}`,
          metadata: { seeded: true }
        });
        await db.tenderDocument.upsert({
          where: { tenderId_documentId: { tenderId: savedTender.id, documentId: document.id } },
          update: { label: name },
          create: { tenderId: savedTender.id, documentId: document.id, label: name }
        });
      }
    }

    const companyTender = seededTenders[0];
    const marketplaceTender = seededTenders[1] ?? seededTenders[0];
    const competitorOrg = await db.organization.upsert({
      where: { name: 'ABC Construction Ltd' },
      update: { kind: OrganizationKind.COMPANY },
      create: { name: 'ABC Construction Ltd', kind: OrganizationKind.COMPANY, country: 'TZ' }
    });
    await db.organizationCapability.upsert({
      where: { organizationId_capability: { organizationId: competitorOrg.id, capability: OrganizationCapabilityName.SUPPLIER } },
      update: { enabled: true },
      create: { organizationId: competitorOrg.id, capability: OrganizationCapabilityName.SUPPLIER }
    });

    const supplierBid = await db.bid.upsert({
      where: { reference: `${marketplaceTender.reference}-${slug(companyOrg.name)}` },
      update: { status: BidStatus.SUBMITTED, totalAmount: 6200000000, payload: { seededFrom: 'company supplier bid' } },
      create: {
        tenderId: marketplaceTender.id,
        buyerOrgId: marketplaceTender.buyerOrgId,
        supplierOrgId: companyOrg.id,
        submittedByUserId: companyUser.id,
        reference: `${marketplaceTender.reference}-${slug(companyOrg.name)}`,
        status: BidStatus.SUBMITTED,
        submittedAt: new Date('2026-06-11T12:00:00Z'),
        totalAmount: 6200000000,
        payload: { seededFrom: 'company supplier bid' }
      }
    });
    await db.bidReceipt.upsert({
      where: { bidId: supplierBid.id },
      update: { receiptHash: `seed-${slug(supplierBid.reference)}` },
      create: { bidId: supplierBid.id, receiptRef: `RCT-${slug(supplierBid.reference)}`, receiptHash: `seed-${slug(supplierBid.reference)}` }
    });

    const evaluationBid = await db.bid.upsert({
      where: { reference: `${companyTender.reference}-${slug(competitorOrg.name)}` },
      update: { status: BidStatus.SUBMITTED, totalAmount: 6420000000, payload: { seededFrom: 'evaluation competitor bid' } },
      create: {
        tenderId: companyTender.id,
        buyerOrgId: companyOrg.id,
        supplierOrgId: competitorOrg.id,
        reference: `${companyTender.reference}-${slug(competitorOrg.name)}`,
        status: BidStatus.SUBMITTED,
        submittedAt: new Date('2026-06-10T12:00:00Z'),
        totalAmount: 6420000000,
        payload: { seededFrom: 'evaluation competitor bid' }
      }
    });

    const workspace = await db.evaluationWorkspace.upsert({
      where: { tenderId: companyTender.id },
      update: { buyerOrgId: companyOrg.id, status: EvaluationStatus.IN_PROGRESS, currentStage: EvaluationStage.TECHNICAL, progress: 58, payload: mockData.bidEvaluation ?? {} },
      create: {
        tenderId: companyTender.id,
        buyerOrgId: companyOrg.id,
        status: EvaluationStatus.IN_PROGRESS,
        currentStage: EvaluationStage.TECHNICAL,
        progress: 58,
        payload: mockData.bidEvaluation ?? {}
      }
    });
    await db.evaluationCriterion.deleteMany({ where: { workspaceId: workspace.id } });
    await db.evaluationScore.deleteMany({ where: { workspaceId: workspace.id } });
    await db.awardRecommendation.deleteMany({ where: { workspaceId: workspace.id } });

    const criterion = await db.evaluationCriterion.create({
      data: {
        workspaceId: workspace.id,
        stage: EvaluationStage.TECHNICAL,
        name: 'Technical capacity',
        weight: 30,
        maxScore: 100,
        payload: mockData.bidEvaluation?.technicalCriteria?.[0] ?? {}
      }
    });
    await db.evaluationScore.create({
      data: {
        workspaceId: workspace.id,
        criterionId: criterion.id,
        bidId: evaluationBid.id,
        evaluatorUserId: companyUser.id,
        score: 84,
        comment: 'Seeded technical score.',
        payload: { seeded: true }
      }
    });
    const recommendation = await db.awardRecommendation.create({
      data: {
        workspaceId: workspace.id,
        bidId: evaluationBid.id,
        supplierOrgId: competitorOrg.id,
        status: RecommendationStatus.RECOMMENDED,
        amount: 6420000000,
        reason: 'Best evaluated seeded bid.',
        payload: mockData.bidEvaluation?.recommendation ?? {}
      }
    });

    const contract = await db.contract.upsert({
      where: { reference: mockData.contractNegotiation?.contractId ?? 'PX-2026-0892' },
      update: { status: ContractStatus.NEGOTIATION, payload: mockData.contractNegotiation ?? {} },
      create: {
        reference: mockData.contractNegotiation?.contractId ?? 'PX-2026-0892',
        tenderId: companyTender.id,
        awardId: recommendation.id,
        buyerOrgId: companyOrg.id,
        supplierOrgId: competitorOrg.id,
        title: companyTender.title,
        status: ContractStatus.NEGOTIATION,
        amount: 6420000000,
        payload: mockData.contractNegotiation ?? {}
      }
    });

    await db.purchaseOrder.upsert({
      where: { reference: 'PO-SEED-001' },
      update: { amount: 1000000, payload: { seeded: true } },
      create: { reference: 'PO-SEED-001', contractId: contract.id, buyerOrgId: companyOrg.id, amount: 1000000, payload: { seeded: true } }
    });
    await db.invoice.upsert({
      where: { reference: 'INV-SEED-001' },
      update: { status: InvoiceStatus.MATCHED, payload: { seeded: true } },
      create: {
        reference: 'INV-SEED-001',
        contractId: contract.id,
        buyerOrgId: companyOrg.id,
        supplierOrgId: competitorOrg.id,
        status: InvoiceStatus.MATCHED,
        amount: 1000000,
        payload: { seeded: true }
      }
    });

    await db.communicationItem.deleteMany({ where: { ownerOrgId: companyOrg.id } });
    for (const item of (mockData.communicationCenter?.items ?? []).slice(0, 6)) {
      const linkedTender = item.tenderReference ? await db.tender.findUnique({ where: { reference: item.tenderReference } }) : null;
      await db.communicationItem.create({
        data: {
          ownerOrgId: companyOrg.id,
          senderOrgId: item.senderType === 'Supplier' ? competitorOrg.id : platformOrg.id,
          recipientOrgId: companyOrg.id,
          tenderId: linkedTender?.id,
          kind: communicationKind(item.kind || item.category),
          folder: item.folder ?? 'inbox',
          category: item.category,
          subject: item.subject,
          body: item.body,
          status: communicationStatus(item.status),
          priority: communicationPriority(item.priority),
          read: Boolean(item.read),
          actionRequired: Boolean(item.actionRequired),
          visibility: item.visibility,
          payload: item,
          createdAt: parseDate(item.createdAt) ?? new Date(),
          updatedAt: parseDate(item.updatedAt) ?? new Date()
        }
      });
    }

    await db.complianceCase.deleteMany({ where: { ownerOrgId: platformOrg.id } });
    await db.complianceCase.createMany({
      data: (mockData.platformOps?.complianceQueue ?? []).slice(0, 4).map((item: AnyRecord) => ({
        ownerOrgId: platformOrg.id,
        title: item.alert,
        severity: item.severity === 'High' ? AuditSeverity.WARNING : AuditSeverity.INFO,
        status: 'OPEN',
        owner: item.owner,
        payload: item
      }))
    });

    await db.auditEvent.deleteMany({ where: { entityType: 'Seed' } });
    await db.auditEvent.create({
      data: {
        ownerOrgId: platformOrg.id,
        actorUserId: adminUser.id,
        event: 'ProcureX seed completed',
        entityType: 'Seed',
        entityRef: 'procurement-platform',
        severity: AuditSeverity.INFO,
        payload: { source: 'procurex-ui/js/data.js' }
      }
    });
    await db.adminAction.upsert({
      where: { id: '00000000-0000-4000-8000-000000000003' },
      update: { summary: 'Seeded corrected ProcureX database foundation.' },
      create: {
        id: '00000000-0000-4000-8000-000000000003',
        actorUserId: adminUser.id,
        ownerOrgId: platformOrg.id,
        actionType: AdminActionType.REVIEW,
        entityType: 'Seed',
        entityRef: 'procurement-platform',
        summary: 'Seeded corrected ProcureX database foundation.'
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
    console.log('ProcureX corrected seed completed.');
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
