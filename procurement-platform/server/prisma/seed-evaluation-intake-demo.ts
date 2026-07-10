import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  AccountType,
  BidStatus,
  DocumentReviewStatus,
  EnvelopeType,
  EvaluationStage,
  EvaluationStatus,
  OrganizationCapabilityName,
  OrganizationKind,
  ProcurementMethod,
  RiskLevel,
  TenderStatus,
  TenderType,
  TrustTier,
  VerificationStatus,
  Visibility
} from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { withDbContext } from '../src/db/context.js';

type AnyDb = Record<string, any>;
type DemoTender = (typeof DEMO_TENDERS)[number];
type DemoBid = DemoTender['bids'][number];

export const EVALUATION_INTAKE_DEMO_DATASET = 'evaluation-intake-demo';
export const EVALUATION_INTAKE_TENDER_REFS = ['PX-WRK-2026-001', 'PX-GDS-2026-002', 'PX-SRV-2026-003'] as const;

const DEMO_TENDERS = [
  {
    tenderNo: 'PX-WRK-2026-001',
    title: 'Construction of Ward Health Centre',
    category: 'Works',
    procurementMethod: 'National Competitive Tendering',
    buyer: 'Mwanza District Council',
    closingDate: '2026-06-25',
    openingDate: '2026-06-26',
    currency: 'TZS',
    estimatedBudget: 950000000,
    bids: [
      { supplier: 'Umoja Builders Ltd', bidAmount: 910000000 },
      { supplier: 'Prime Civil Works Ltd', bidAmount: 975000000 },
      { supplier: 'Kijiji Construction Co.', bidAmount: 890000000 }
    ],
    criteria: [
      { name: 'Administrative Compliance', stage: EvaluationStage.PRELIMINARY, weight: null, maxScore: 1, criterionType: 'PASS_FAIL' },
      { name: 'Technical Experience', stage: EvaluationStage.TECHNICAL, weight: 30, maxScore: 100 },
      { name: 'Methodology and Work Plan', stage: EvaluationStage.TECHNICAL, weight: 25, maxScore: 100 },
      { name: 'Equipment and Personnel', stage: EvaluationStage.TECHNICAL, weight: 20, maxScore: 100 },
      { name: 'Financial Proposal', stage: EvaluationStage.FINANCIAL, weight: 25, maxScore: 100 }
    ]
  },
  {
    tenderNo: 'PX-GDS-2026-002',
    title: 'Supply of Office Computers and Printers',
    category: 'Goods',
    procurementMethod: 'Request for Quotations',
    buyer: 'Arusha Technical Institute',
    closingDate: '2026-06-28',
    openingDate: '2026-06-29',
    currency: 'TZS',
    estimatedBudget: 120000000,
    bids: [
      { supplier: 'TechWorld Suppliers Ltd', bidAmount: 116500000 },
      { supplier: 'Smart Office Solutions', bidAmount: 118200000 },
      { supplier: 'Digital Edge Tanzania', bidAmount: 112900000 }
    ],
    criteria: [
      { name: 'Administrative Compliance', stage: EvaluationStage.PRELIMINARY, weight: null, maxScore: 1, criterionType: 'PASS_FAIL' },
      { name: 'Technical Specification Compliance', stage: EvaluationStage.TECHNICAL, weight: 40, maxScore: 100 },
      { name: 'Warranty and After-Sales Support', stage: EvaluationStage.TECHNICAL, weight: 20, maxScore: 100 },
      { name: 'Delivery Period', stage: EvaluationStage.TECHNICAL, weight: 15, maxScore: 100 },
      { name: 'Financial Proposal', stage: EvaluationStage.FINANCIAL, weight: 25, maxScore: 100 }
    ]
  },
  {
    tenderNo: 'PX-SRV-2026-003',
    title: 'Provision of Cleaning Services',
    category: 'Services',
    procurementMethod: 'Competitive Selection',
    buyer: 'Dodoma Regional Hospital',
    closingDate: '2026-07-01',
    openingDate: '2026-07-02',
    currency: 'TZS',
    estimatedBudget: 85000000,
    bids: [
      { supplier: 'SafiCare Services Ltd', bidAmount: 81000000 },
      { supplier: 'GreenClean Tanzania Ltd', bidAmount: 79500000 },
      { supplier: 'Bright Facility Services', bidAmount: 76000000 }
    ],
    criteria: [
      { name: 'Administrative Compliance', stage: EvaluationStage.PRELIMINARY, weight: null, maxScore: 1, criterionType: 'PASS_FAIL' },
      { name: 'Company Experience', stage: EvaluationStage.TECHNICAL, weight: 25, maxScore: 100 },
      { name: 'Staff Qualification', stage: EvaluationStage.TECHNICAL, weight: 20, maxScore: 100 },
      { name: 'Service Methodology', stage: EvaluationStage.TECHNICAL, weight: 25, maxScore: 100 },
      { name: 'Financial Proposal', stage: EvaluationStage.FINANCIAL, weight: 30, maxScore: 100 }
    ]
  }
] as const;

function assertSafeEnvironment() {
  const environment = process.env.NODE_ENV || 'development';
  if (!['development', 'test'].includes(environment)) {
    throw new Error(`Refusing to run evaluation intake demo seed when NODE_ENV=${environment}. Use development or test only.`);
  }
}

function demoPayload(extra: Record<string, unknown> = {}) {
  return { isDemo: true, demoDataset: EVALUATION_INTAKE_DEMO_DATASET, ...extra };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
}

function tenderType(category: DemoTender['category']) {
  if (category === 'Works') return TenderType.WORKS;
  if (category === 'Goods') return TenderType.GOODS;
  return TenderType.SERVICE;
}

function procurementMethod(method: string) {
  return method === 'Request for Quotations' ? ProcurementMethod.INVITED_TENDER : ProcurementMethod.OPEN_TENDER;
}

function closingDate(item: DemoTender) {
  return new Date(`${item.closingDate}T14:00:00.000Z`);
}

function openingDate(item: DemoTender) {
  return new Date(`${item.openingDate}T09:00:00.000Z`);
}

function submittedAt(item: DemoTender, index: number) {
  return new Date(`${item.closingDate}T${String(8 + index).padStart(2, '0')}:30:00.000Z`);
}

function supplierEmail(name: string) {
  return `${slug(name)}@evaluation-demo.procurex.tz`;
}

function bidReference(item: DemoTender, bid: DemoBid, index: number) {
  return `${item.tenderNo}-BID-${String(index + 1).padStart(2, '0')}-${slug(bid.supplier).toUpperCase()}`;
}

function documentSpecs(item: DemoTender) {
  return [
    { name: 'Business Registration Certificate', type: 'BUSINESS_REGISTRATION_CERTIFICATE', envelope: EnvelopeType.ADMINISTRATIVE },
    { name: 'Tax Clearance Certificate', type: 'TAX_CLEARANCE_CERTIFICATE', envelope: EnvelopeType.ADMINISTRATIVE },
    { name: 'Technical Proposal', type: 'TECHNICAL_PROPOSAL', envelope: EnvelopeType.TECHNICAL },
    { name: 'Financial Proposal', type: 'FINANCIAL_PROPOSAL', envelope: EnvelopeType.FINANCIAL },
    {
      name: item.category === 'Works' ? 'BOQ' : 'Quotation',
      type: item.category === 'Works' ? 'BOQ' : 'QUOTATION',
      envelope: EnvelopeType.FINANCIAL
    }
  ];
}

async function deleteByIds(db: AnyDb, model: string, field: string, ids: string[]) {
  if (ids.length === 0) return;
  await db[model].deleteMany({ where: { [field]: { in: ids } } });
}

async function resetEvaluationIntakeDemo(db: AnyDb) {
  const tenders = await db.tender.findMany({
    where: { reference: { in: [...EVALUATION_INTAKE_TENDER_REFS] } },
    select: {
      id: true,
      evaluation: { select: { id: true } },
      bids: { select: { id: true } }
    }
  });
  const tenderIds = tenders.map((tender: any) => tender.id);
  const bidIds = tenders.flatMap((tender: any) => tender.bids.map((bid: any) => bid.id));
  const workspaceIds = tenders.map((tender: any) => tender.evaluation?.id).filter(Boolean);

  await deleteByIds(db, 'awardRecommendation', 'workspaceId', workspaceIds);
  await deleteByIds(db, 'evaluationScore', 'workspaceId', workspaceIds);
  await deleteByIds(db, 'evaluationCriterion', 'workspaceId', workspaceIds);
  await deleteByIds(db, 'workflowAssignment', 'workspaceId', workspaceIds);
  await deleteByIds(db, 'bidDocument', 'bidId', bidIds);
  await deleteByIds(db, 'bidResponse', 'bidId', bidIds);
  await deleteByIds(db, 'bidVersion', 'bidId', bidIds);
  await deleteByIds(db, 'bidReceipt', 'bidId', bidIds);
  await db.documentObject.deleteMany({ where: { objectKey: { startsWith: `${EVALUATION_INTAKE_DEMO_DATASET}/` } } });
  await deleteByIds(db, 'tenderMilestone', 'tenderId', tenderIds);
  await deleteByIds(db, 'tenderRequirement', 'tenderId', tenderIds);
  await deleteByIds(db, 'tenderCommercialItem', 'tenderId', tenderIds);
}

async function upsertOrganization(db: AnyDb, name: string, capability: OrganizationCapabilityName) {
  const org = await db.organization.upsert({
    where: { name },
    update: { kind: OrganizationKind.COMPANY, country: 'TZ', metadata: demoPayload({ seededFrom: 'evaluation-intake' }) },
    create: { name, kind: OrganizationKind.COMPANY, country: 'TZ', metadata: demoPayload({ seededFrom: 'evaluation-intake' }) }
  });

  await db.organizationCapability.upsert({
    where: { organizationId_capability: { organizationId: org.id, capability } },
    update: { enabled: true },
    create: { organizationId: org.id, capability, enabled: true }
  });

  await db.organizationProfile.upsert({
    where: { organizationId: org.id },
    update: { summary: `${name} seeded for evaluation intake demo.`, payload: demoPayload({ capability }) },
    create: { organizationId: org.id, summary: `${name} seeded for evaluation intake demo.`, payload: demoPayload({ capability }) }
  });

  if (capability === OrganizationCapabilityName.BUYER) {
    await db.buyerProfile.upsert({
      where: { organizationId: org.id },
      update: { procuringType: 'Public procuring entity', payload: demoPayload() },
      create: { organizationId: org.id, procuringType: 'Public procuring entity', payload: demoPayload() }
    });
  } else {
    await db.supplierProfile.upsert({
      where: { organizationId: org.id },
      update: { trustTier: TrustTier.GOLD, riskLevel: RiskLevel.LOW, categories: [] },
      create: { organizationId: org.id, trustTier: TrustTier.GOLD, riskLevel: RiskLevel.LOW, categories: [] }
    });
  }

  return org;
}

async function upsertUser(db: AnyDb, org: any, name: string, capability: OrganizationCapabilityName) {
  const email = capability === OrganizationCapabilityName.BUYER ? `${slug(name)}@buyer.evaluation-demo.procurex.tz` : supplierEmail(name);
  const user = await db.user.upsert({
    where: { email },
    update: {
      displayName: `${name} Demo User`,
      accountType: AccountType.USER,
      verificationStatus: VerificationStatus.APPROVED,
      metadata: demoPayload({ phoneVerified: true, emailVerified: true, organizationName: name })
    },
    create: {
      email,
      displayName: `${name} Demo User`,
      accountType: AccountType.USER,
      verificationStatus: VerificationStatus.APPROVED,
      metadata: demoPayload({ phoneVerified: true, emailVerified: true, organizationName: name })
    }
  });

  await db.account.upsert({
    where: { provider_providerUserId: { provider: 'password', providerUserId: email } },
    update: { accountType: AccountType.USER, metadata: demoPayload() },
    create: { userId: user.id, provider: 'password', providerUserId: email, accountType: AccountType.USER, metadata: demoPayload() }
  });

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: { status: 'ACTIVE', isDefault: true, title: capability === OrganizationCapabilityName.BUYER ? 'Procurement officer' : 'Bid submitter' },
    create: {
      organizationId: org.id,
      userId: user.id,
      status: 'ACTIVE',
      isDefault: true,
      title: capability === OrganizationCapabilityName.BUYER ? 'Procurement officer' : 'Bid submitter'
    }
  });

  return user;
}

async function upsertTender(db: AnyDb, item: DemoTender, buyerOrg: any, buyerUser: any) {
  const data = {
    buyerOrgId: buyerOrg.id,
    ownerUserId: buyerUser.id,
    title: item.title,
    description: `${item.procurementMethod} for ${item.buyer}.`,
    type: tenderType(item.category),
    status: TenderStatus.CLOSED,
    method: procurementMethod(item.procurementMethod),
    visibility: Visibility.PUBLIC_MARKETPLACE,
    budget: item.estimatedBudget,
    currency: item.currency,
    location: item.buyer.split(' ')[0],
    closingDate: closingDate(item),
    publishedAt: new Date('2026-06-01T09:00:00.000Z'),
    requirements: {
      procurementMethod: item.procurementMethod,
      openingDate: item.openingDate,
      evaluationStatus: 'PENDING',
      bidOpeningStatus: 'COMPLETED'
    },
    metadata: demoPayload({
      tenderNo: item.tenderNo,
      category: item.category,
      openingDate: item.openingDate,
      bidOpeningStatus: 'COMPLETED',
      evaluationStatus: 'PENDING',
      mappedEvaluationStatus: EvaluationStatus.NOT_STARTED
    })
  };

  const tender = await db.tender.upsert({
    where: { reference: item.tenderNo },
    update: data,
    create: { reference: item.tenderNo, ...data }
  });

  await db.tenderCategory.deleteMany({ where: { tenderId: tender.id } });
  await db.tenderCategory.createMany({
    data: [
      { tenderId: tender.id, name: item.category },
      { tenderId: tender.id, name: item.procurementMethod }
    ],
    skipDuplicates: true
  });

  await db.tenderMilestone.createMany({
    data: [
      { tenderId: tender.id, name: 'Submission deadline', dueDate: data.closingDate, payload: demoPayload() },
      { tenderId: tender.id, name: 'Bid opening', dueDate: openingDate(item), payload: demoPayload({ bidOpeningStatus: 'COMPLETED' }) }
    ]
  });

  return tender;
}

async function createBidDocument(db: AnyDb, bid: any, supplierOrg: any, submittedByUser: any, item: DemoTender, spec: ReturnType<typeof documentSpecs>[number]) {
  const objectKey = `${EVALUATION_INTAKE_DEMO_DATASET}/${bid.reference}/${slug(spec.name)}`;
  const document = await db.documentObject.upsert({
    where: { objectKey },
    update: {
      ownerOrgId: supplierOrg.id,
      uploadedByUserId: submittedByUser.id,
      name: spec.name,
      documentType: spec.type,
      checksum: sha256(objectKey),
      metadata: demoPayload({ tenderNo: item.tenderNo, bidReference: bid.reference, envelope: spec.envelope })
    },
    create: {
      ownerOrgId: supplierOrg.id,
      uploadedByUserId: submittedByUser.id,
      name: spec.name,
      objectKey,
      documentType: spec.type,
      checksum: sha256(objectKey),
      metadata: demoPayload({ tenderNo: item.tenderNo, bidReference: bid.reference, envelope: spec.envelope })
    }
  });

  await db.bidDocument.upsert({
    where: { bidId_documentId: { bidId: bid.id, documentId: document.id } },
    update: { envelope: spec.envelope, reviewStatus: DocumentReviewStatus.UPLOADED },
    create: { bidId: bid.id, documentId: document.id, envelope: spec.envelope, reviewStatus: DocumentReviewStatus.UPLOADED }
  });
}

async function upsertBid(db: AnyDb, tender: any, item: DemoTender, demoBid: DemoBid, index: number) {
  const supplierOrg = await upsertOrganization(db, demoBid.supplier, OrganizationCapabilityName.SUPPLIER);
  const supplierUser = await upsertUser(db, supplierOrg, demoBid.supplier, OrganizationCapabilityName.SUPPLIER);
  const reference = bidReference(item, demoBid, index);
  const submitted = submittedAt(item, index);
  const bidData = {
    tenderId: tender.id,
    buyerOrgId: tender.buyerOrgId,
    supplierOrgId: supplierOrg.id,
    submittedByUserId: supplierUser.id,
    status: BidStatus.SUBMITTED,
    submittedAt: submitted,
    totalAmount: demoBid.bidAmount,
    currency: item.currency,
    payload: demoPayload({
      supplier: demoBid.supplier,
      submissionStatus: 'SUBMITTED',
      openingStatus: 'OPENED',
      administrativeStatus: 'PENDING',
      technicalStatus: 'PENDING',
      financialStatus: 'PENDING',
      openedAt: openingDate(item).toISOString()
    })
  };

  const bid = await db.bid.upsert({
    where: { reference },
    update: bidData,
    create: { reference, ...bidData }
  });

  await db.bidResponse.createMany({
    data: [
      { bidId: bid.id, requirementKey: 'ADMINISTRATIVE', response: demoPayload({ status: 'PENDING' }) },
      { bidId: bid.id, requirementKey: 'TECHNICAL', response: demoPayload({ status: 'PENDING' }) },
      { bidId: bid.id, requirementKey: 'FINANCIAL', response: demoPayload({ status: 'PENDING', amount: demoBid.bidAmount }) }
    ]
  });

  const sealedHash = sha256(`${reference}:${demoBid.bidAmount}:${submitted.toISOString()}`);
  await db.bidVersion.upsert({
    where: { bidId_versionNo_envelope: { bidId: bid.id, versionNo: 1, envelope: EnvelopeType.COMBINED } },
    update: { sealedHash, payload: demoPayload({ snapshot: 'Submitted and opened evaluation intake demo bid' }) },
    create: { bidId: bid.id, versionNo: 1, envelope: EnvelopeType.COMBINED, sealedHash, payload: demoPayload({ snapshot: 'Submitted and opened evaluation intake demo bid' }) }
  });

  await db.bidReceipt.upsert({
    where: { bidId: bid.id },
    update: { receiptRef: `${reference}-RCPT`, receiptHash: sha256(`${reference}:receipt:${sealedHash}`) },
    create: { bidId: bid.id, receiptRef: `${reference}-RCPT`, receiptHash: sha256(`${reference}:receipt:${sealedHash}`) }
  });

  for (const spec of documentSpecs(item)) {
    await createBidDocument(db, bid, supplierOrg, supplierUser, item, spec);
  }

  return bid;
}

async function upsertEvaluationWorkspace(db: AnyDb, tender: any, item: DemoTender) {
  const workspace = await db.evaluationWorkspace.upsert({
    where: { tenderId: tender.id },
    update: {
      buyerOrgId: tender.buyerOrgId,
      status: EvaluationStatus.NOT_STARTED,
      currentStage: EvaluationStage.OPENING,
      progress: 0,
      payload: demoPayload({ tenderNo: item.tenderNo, evaluationStatus: 'PENDING', bidOpeningStatus: 'COMPLETED' })
    },
    create: {
      tenderId: tender.id,
      buyerOrgId: tender.buyerOrgId,
      status: EvaluationStatus.NOT_STARTED,
      currentStage: EvaluationStage.OPENING,
      progress: 0,
      payload: demoPayload({ tenderNo: item.tenderNo, evaluationStatus: 'PENDING', bidOpeningStatus: 'COMPLETED' })
    }
  });

  await db.evaluationCriterion.createMany({
    data: item.criteria.map((criterion) => ({
      workspaceId: workspace.id,
      stage: criterion.stage,
      name: criterion.name,
      weight: criterion.weight,
      maxScore: criterion.maxScore,
      payload: demoPayload({
        category: criterion.stage === EvaluationStage.FINANCIAL ? 'Financial' : criterion.stage === EvaluationStage.PRELIMINARY ? 'Administrative' : 'Technical',
        criterionType: 'criterionType' in criterion ? criterion.criterionType : 'SCORED'
      })
    }))
  });

  return workspace;
}

export async function seedEvaluationIntakeDemo() {
  assertSafeEnvironment();
  await withDbContext({ accountType: AccountType.ADMIN }, async (tx) => {
    const db = tx as AnyDb;
    await resetEvaluationIntakeDemo(db);

    for (const item of DEMO_TENDERS) {
      const buyerOrg = await upsertOrganization(db, item.buyer, OrganizationCapabilityName.BUYER);
      const buyerUser = await upsertUser(db, buyerOrg, item.buyer, OrganizationCapabilityName.BUYER);
      const tender = await upsertTender(db, item, buyerOrg, buyerUser);

      for (const [index, bid] of item.bids.entries()) {
        await upsertBid(db, tender, item, bid, index);
      }

      await upsertEvaluationWorkspace(db, tender, item);
    }
  }, prisma);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedEvaluationIntakeDemo()
    .then(async () => {
      console.log('ProcureX evaluation intake demo seed completed.');
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
