import { createHash, randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
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
  RecommendationStatus,
  TenderStatus,
  TenderType,
  VerificationStatus,
  Visibility,
  WorkflowAssignmentType
} from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { withDbContext } from '../src/db/context.js';

const scrypt = promisify(scryptCallback);

export const AWARD_READY_DEMO_DATASET = 'award-ready-evaluation-demo';
export const AWARD_READY_TENDER_REF = 'PX-AWARD-READY-2026-001';
export const AWARD_READY_BUYER_EMAIL = 'award-ready-buyer@procurex.tz';
export const AWARD_READY_BUYER_PASSWORD = 'AwardReady123!';

type AnyDb = Record<string, any>;
type Actor = { org: any; user: any };

const supplierSpecs = [
  { key: 'alpha', orgName: 'Alpha Medical Supplies Limited', email: 'award-ready-alpha@procurex.tz', displayName: 'Alpha Bid Manager', amount: 238_500_000, technical: 94, financial: 91 },
  { key: 'beta', orgName: 'Beta Health Logistics Limited', email: 'award-ready-beta@procurex.tz', displayName: 'Beta Bid Manager', amount: 246_800_000, technical: 88, financial: 84 },
  { key: 'gamma', orgName: 'Gamma Diagnostics Tanzania', email: 'award-ready-gamma@procurex.tz', displayName: 'Gamma Bid Manager', amount: 251_200_000, technical: 82, financial: 79 },
  { key: 'delta', orgName: 'Delta Hospital Equipment Company', email: 'award-ready-delta@procurex.tz', displayName: 'Delta Bid Manager', amount: 259_400_000, technical: 76, financial: 73 }
] as const;

function assertSafeEnvironment() {
  const environment = process.env.NODE_ENV || 'development';
  if (!['development', 'test'].includes(environment)) {
    throw new Error(`Refusing to run award-ready demo seed when NODE_ENV=${environment}. Use development or test only.`);
  }
}

function demoPayload(extra: Record<string, unknown> = {}) {
  return { demoDataset: AWARD_READY_DEMO_DATASET, ...extra };
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function hashSeedPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

function daysFromNow(days: number, hour = 9) {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

async function deleteByIds(db: AnyDb, model: string, field: string, ids: string[]) {
  if (ids.length === 0) return;
  await db[model].deleteMany({ where: { [field]: { in: ids } } });
}

async function resetAwardReadyDemo(db: AnyDb) {
  const tenders = await db.tender.findMany({
    where: { OR: [{ reference: AWARD_READY_TENDER_REF }, { metadata: { path: ['demoDataset'], equals: AWARD_READY_DEMO_DATASET } }] },
    select: { id: true, evaluation: { select: { id: true } }, bids: { select: { id: true } } }
  });
  const tenderIds = tenders.map((tender: any) => tender.id);
  const workspaceIds = tenders.map((tender: any) => tender.evaluation?.id).filter(Boolean);
  const bidIds = tenders.flatMap((tender: any) => tender.bids.map((bid: any) => bid.id));

  await deleteByIds(db, 'awardRecommendation', 'workspaceId', workspaceIds);
  await deleteByIds(db, 'evaluationScore', 'workspaceId', workspaceIds);
  await deleteByIds(db, 'evaluationCriterion', 'workspaceId', workspaceIds);
  await deleteByIds(db, 'workflowAssignment', 'workspaceId', workspaceIds);
  await deleteByIds(db, 'evaluationWorkspace', 'id', workspaceIds);
  await deleteByIds(db, 'bidReceipt', 'bidId', bidIds);
  await deleteByIds(db, 'bidResponse', 'bidId', bidIds);
  await deleteByIds(db, 'bidVersion', 'bidId', bidIds);
  await deleteByIds(db, 'bidDocument', 'bidId', bidIds);
  await deleteByIds(db, 'bid', 'id', bidIds);
  await deleteByIds(db, 'tenderDocument', 'tenderId', tenderIds);
  await deleteByIds(db, 'tenderCategory', 'tenderId', tenderIds);
  await deleteByIds(db, 'tenderRequirement', 'tenderId', tenderIds);
  await deleteByIds(db, 'tenderMilestone', 'tenderId', tenderIds);
  await deleteByIds(db, 'tenderCommercialItem', 'tenderId', tenderIds);
  await deleteByIds(db, 'tender', 'id', tenderIds);
  await db.documentObject.deleteMany({ where: { objectKey: { startsWith: `${AWARD_READY_DEMO_DATASET}/` } } });
  await db.auditEvent.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_READY_DEMO_DATASET } } });
}

async function upsertActor(db: AnyDb, input: { orgName: string; email: string; displayName: string; title: string; capability: OrganizationCapabilityName; password: string }) {
  const org = await db.organization.upsert({
    where: { name: input.orgName },
    update: { kind: OrganizationKind.COMPANY, country: 'TZ', metadata: demoPayload({ seededActor: true }) },
    create: { name: input.orgName, kind: OrganizationKind.COMPANY, country: 'TZ', metadata: demoPayload({ seededActor: true }) }
  });

  await db.organizationCapability.upsert({
    where: { organizationId_capability: { organizationId: org.id, capability: input.capability } },
    update: { enabled: true },
    create: { organizationId: org.id, capability: input.capability, enabled: true }
  });

  await db.organizationProfile.upsert({
    where: { organizationId: org.id },
    update: { summary: `${input.orgName} seeded for award-ready evaluation testing.`, payload: demoPayload() },
    create: { organizationId: org.id, summary: `${input.orgName} seeded for award-ready evaluation testing.`, payload: demoPayload() }
  });

  const user = await db.user.upsert({
    where: { email: input.email },
    update: {
      displayName: input.displayName,
      verificationStatus: VerificationStatus.APPROVED,
      passwordHash: await hashSeedPassword(input.password),
      metadata: demoPayload({ emailVerified: true, phoneVerified: true })
    },
    create: {
      email: input.email,
      displayName: input.displayName,
      verificationStatus: VerificationStatus.APPROVED,
      passwordHash: await hashSeedPassword(input.password),
      metadata: demoPayload({ emailVerified: true, phoneVerified: true })
    }
  });

  await db.account.upsert({
    where: { provider_providerUserId: { provider: 'password', providerUserId: input.email } },
    update: { accountType: AccountType.USER, metadata: demoPayload() },
    create: { userId: user.id, provider: 'password', providerUserId: input.email, accountType: AccountType.USER, metadata: demoPayload() }
  });

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: { status: 'ACTIVE', isDefault: true, title: input.title },
    create: { organizationId: org.id, userId: user.id, status: 'ACTIVE', isDefault: true, title: input.title }
  });

  return { org, user };
}

async function createDocument(db: AnyDb, input: { owner: Actor; name: string; type: string; key: string; uploadedBy?: Actor }) {
  return db.documentObject.create({
    data: {
      ownerOrgId: input.owner.org.id,
      uploadedByUserId: (input.uploadedBy ?? input.owner).user.id,
      name: input.name,
      objectKey: `${AWARD_READY_DEMO_DATASET}/${input.key}`,
      documentType: input.type,
      checksum: sha256(`${AWARD_READY_DEMO_DATASET}:${input.key}`),
      metadata: demoPayload({ generatedPreview: true })
    }
  });
}

async function createTender(db: AnyDb, buyer: Actor) {
  const tender = await db.tender.create({
    data: {
      reference: AWARD_READY_TENDER_REF,
      buyerOrgId: buyer.org.id,
      ownerUserId: buyer.user.id,
      title: 'Supply and delivery of hospital diagnostic equipment',
      description: 'Award-ready tender with four submitted bids, completed evaluation, and source documents.',
      type: TenderType.GOODS,
      status: TenderStatus.EVALUATION,
      method: ProcurementMethod.OPEN_TENDER,
      visibility: Visibility.PUBLIC_MARKETPLACE,
      budget: 275_000_000,
      currency: 'TZS',
      location: 'Dar es Salaam',
      closingDate: daysFromNow(-10, 14),
      publishedAt: daysFromNow(-40, 8),
      requirements: demoPayload({
        eligibility: ['Business registration', 'Tax clearance', 'Manufacturer authorization'],
        technical: ['Diagnostic equipment specification compliance', 'Warranty and after-sales support', 'Delivery plan'],
        financial: ['Priced schedule in TZS', 'Valid bid security']
      }),
      metadata: demoPayload({ bidOpeningStatus: 'COMPLETED', evaluationStatus: 'COMPLETED' })
    }
  });

  await db.tenderCategory.createMany({ data: ['Medical Equipment', 'Diagnostic Equipment', 'Goods'].map((name) => ({ tenderId: tender.id, name })) });
  await db.tenderRequirement.createMany({
    data: [
      { tenderId: tender.id, section: 'Eligibility', payload: demoPayload({ title: 'Submit valid business registration, tax clearance, and manufacturer authorization.' }) },
      { tenderId: tender.id, section: 'Technical', payload: demoPayload({ title: 'Confirm specification compliance, warranty, maintenance support, and delivery plan.' }) },
      { tenderId: tender.id, section: 'Financial', payload: demoPayload({ title: 'Submit priced bill of quantities and valid bid security.' }) }
    ]
  });
  await db.tenderCommercialItem.createMany({
    data: [
      { tenderId: tender.id, itemNo: '1', description: 'Portable ultrasound diagnostic equipment', quantity: 8, unit: 'Each', rate: 18_000_000, total: 144_000_000, payload: demoPayload() },
      { tenderId: tender.id, itemNo: '2', description: 'Digital patient monitors', quantity: 16, unit: 'Each', rate: 5_500_000, total: 88_000_000, payload: demoPayload() },
      { tenderId: tender.id, itemNo: '3', description: 'Installation, training, and warranty support', quantity: 1, unit: 'Lot', rate: 43_000_000, total: 43_000_000, payload: demoPayload() }
    ]
  });
  await db.tenderMilestone.createMany({
    data: [
      { tenderId: tender.id, name: 'Tender published', dueDate: daysFromNow(-40, 8), payload: demoPayload() },
      { tenderId: tender.id, name: 'Submission deadline', dueDate: daysFromNow(-10, 14), payload: demoPayload() },
      { tenderId: tender.id, name: 'Evaluation completed', dueDate: daysFromNow(-3, 16), payload: demoPayload() }
    ]
  });

  const tenderDocument = await createDocument(db, { owner: buyer, name: `${AWARD_READY_TENDER_REF} Tender Document`, type: 'TENDER_DOCUMENT', key: `${AWARD_READY_TENDER_REF}/tender-document.html` });
  await db.tenderDocument.create({ data: { tenderId: tender.id, documentId: tenderDocument.id, label: 'Tender Document' } });
  return tender;
}

async function createBid(db: AnyDb, tender: any, buyer: Actor, supplier: Actor, spec: (typeof supplierSpecs)[number], index: number) {
  const reference = `${AWARD_READY_TENDER_REF}-BID-${String(index + 1).padStart(2, '0')}`;
  const submittedAt = daysFromNow(-12 + index, 9);
  const bid = await db.bid.create({
    data: {
      tenderId: tender.id,
      buyerOrgId: buyer.org.id,
      supplierOrgId: supplier.org.id,
      submittedByUserId: supplier.user.id,
      reference,
      status: BidStatus.UNDER_EVALUATION,
      submittedAt,
      totalAmount: spec.amount,
      currency: 'TZS',
      payload: demoPayload({
        submissionStatus: 'SUBMITTED',
        openingStatus: 'OPENED',
        administrativeStatus: 'PASSED',
        technicalStatus: 'PASSED',
        financialStatus: 'EVALUATED'
      })
    }
  });

  await db.bidVersion.create({
    data: { bidId: bid.id, versionNo: 1, envelope: EnvelopeType.COMBINED, sealedHash: sha256(`${reference}:${spec.amount}`), payload: demoPayload({ snapshot: 'Award-ready submitted bid' }) }
  });
  await db.bidReceipt.create({
    data: { bidId: bid.id, receiptRef: `${reference}-RCPT`, receiptHash: sha256(`${reference}:receipt`) }
  });
  await db.bidResponse.createMany({
    data: [
      { bidId: bid.id, requirementKey: 'Eligibility', response: demoPayload({ status: 'PASSED', summary: 'Administrative documents submitted and compliant.' }) },
      { bidId: bid.id, requirementKey: 'Technical', response: demoPayload({ status: 'PASSED', technicalScore: spec.technical }) },
      { bidId: bid.id, requirementKey: 'Financial', response: demoPayload({ amount: spec.amount, currency: 'TZS' }) }
    ]
  });

  const docs = [
    { name: 'Business Registration Certificate', type: 'BUSINESS_REGISTRATION_CERTIFICATE', envelope: EnvelopeType.ADMINISTRATIVE },
    { name: 'Technical Proposal', type: 'TECHNICAL_PROPOSAL', envelope: EnvelopeType.TECHNICAL },
    { name: 'Financial Proposal', type: 'FINANCIAL_PROPOSAL', envelope: EnvelopeType.FINANCIAL }
  ];
  for (const doc of docs) {
    const document = await createDocument(db, {
      owner: supplier,
      uploadedBy: supplier,
      name: `${spec.orgName} - ${doc.name}`,
      type: doc.type,
      key: `${reference}/${doc.type}.html`
    });
    await db.bidDocument.create({
      data: { bidId: bid.id, documentId: document.id, envelope: doc.envelope, reviewStatus: DocumentReviewStatus.VERIFIED }
    });
  }

  return bid;
}

async function createCompletedEvaluation(db: AnyDb, tender: any, buyer: Actor, bids: any[]) {
  const workspace = await db.evaluationWorkspace.create({
    data: {
      tenderId: tender.id,
      buyerOrgId: buyer.org.id,
      status: EvaluationStatus.COMPLETED,
      currentStage: EvaluationStage.RECOMMENDATION,
      progress: 100,
      payload: demoPayload({ completedAt: daysFromNow(-3, 16).toISOString() })
    }
  });

  await db.workflowAssignment.createMany({
    data: [
      { workspaceId: workspace.id, userId: buyer.user.id, assignment: WorkflowAssignmentType.EVALUATOR, status: 'ACTIVE', payload: demoPayload({ role: 'Lead evaluator' }) },
      { workspaceId: workspace.id, userId: buyer.user.id, assignment: WorkflowAssignmentType.APPROVER, status: 'ACTIVE', payload: demoPayload({ role: 'Award approver' }) }
    ],
    skipDuplicates: true
  });

  const criteria = await Promise.all(
    [
      { stage: EvaluationStage.PRELIMINARY, name: 'Administrative compliance', weight: null, maxScore: 1 },
      { stage: EvaluationStage.TECHNICAL, name: 'Technical specification compliance', weight: 60, maxScore: 100 },
      { stage: EvaluationStage.FINANCIAL, name: 'Financial proposal', weight: 40, maxScore: 100 }
    ].map((criterion) => db.evaluationCriterion.create({ data: { workspaceId: workspace.id, ...criterion, payload: demoPayload() } }))
  );

  const scoreRows = bids.flatMap((bid, index) => {
    const spec = supplierSpecs[index];
    return [
      { workspaceId: workspace.id, criterionId: criteria[0].id, bidId: bid.id, evaluatorUserId: buyer.user.id, score: 1, comment: 'Passed administrative compliance.', lockedAt: daysFromNow(-3, 12), payload: demoPayload({ decision: 'PASSED' }) },
      { workspaceId: workspace.id, criterionId: criteria[1].id, bidId: bid.id, evaluatorUserId: buyer.user.id, score: spec.technical, comment: 'Technical score captured from completed evaluation.', lockedAt: daysFromNow(-3, 12), payload: demoPayload() },
      { workspaceId: workspace.id, criterionId: criteria[2].id, bidId: bid.id, evaluatorUserId: buyer.user.id, score: spec.financial, comment: 'Financial score captured from completed evaluation.', lockedAt: daysFromNow(-3, 12), payload: demoPayload() }
    ];
  });
  await db.evaluationScore.createMany({ data: scoreRows });

  await db.auditEvent.createMany({
    data: [
      { ownerOrgId: buyer.org.id, actorUserId: buyer.user.id, event: 'evaluation.completed', entityType: 'evaluation_workspace', entityRef: workspace.id, payload: demoPayload({ tenderReference: tender.reference }) },
      { ownerOrgId: buyer.org.id, actorUserId: buyer.user.id, event: 'evaluation.recommendation.prepared', entityType: 'award_recommendation', entityRef: tender.reference, payload: demoPayload() }
    ]
  });

  const winningBid = bids[0];
  await db.awardRecommendation.create({
    data: {
      reference: 'PX-AWARD-READY-REC-001',
      workspaceId: workspace.id,
      bidId: winningBid.id,
      supplierOrgId: winningBid.supplierOrgId,
      status: RecommendationStatus.RECOMMENDED,
      amount: winningBid.totalAmount,
      currency: winningBid.currency,
      reason: 'Alpha Medical Supplies Limited ranked first after administrative, technical, and financial evaluation.',
      payload: demoPayload({
        awardDecisionDraft: {
          selectedSupplier: supplierSpecs[0].orgName,
          awardAmount: supplierSpecs[0].amount,
          currency: 'TZS',
          reason: 'Best evaluated responsive bidder.',
          conditions: 'Submit updated delivery schedule before contract signing.'
        },
        rankings: supplierSpecs.map((supplier, index) => ({
          rank: index + 1,
          supplier: supplier.orgName,
          amount: supplier.amount,
          technicalScore: supplier.technical,
          financialScore: supplier.financial
        }))
      })
    }
  });

  return workspace;
}

export async function seedAwardReadyDemo() {
  assertSafeEnvironment();
  await withDbContext({ accountType: AccountType.ADMIN }, async (tx) => {
    const db = tx as AnyDb;
    await resetAwardReadyDemo(db);

    const buyer = await upsertActor(db, {
      orgName: 'ProcureX Award Ready Buyer Authority',
      email: AWARD_READY_BUYER_EMAIL,
      displayName: 'Award Ready Buyer',
      title: 'Head of Procurement',
      capability: OrganizationCapabilityName.BUYER,
      password: AWARD_READY_BUYER_PASSWORD
    });
    const suppliers: Actor[] = [];
    for (const spec of supplierSpecs) {
      suppliers.push(await upsertActor(db, {
        orgName: spec.orgName,
        email: spec.email,
        displayName: spec.displayName,
        title: 'Bid Manager',
        capability: OrganizationCapabilityName.SUPPLIER,
        password: 'Supplier123!'
      }));
    }

    const tender = await createTender(db, buyer);
    const bids = [];
    for (const [index, supplier] of suppliers.entries()) {
      bids.push(await createBid(db, tender, buyer, supplier, supplierSpecs[index], index));
    }
    await createCompletedEvaluation(db, tender, buyer, bids);
  }, prisma);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  seedAwardReadyDemo()
    .then(() => {
      console.log(`Seeded ${AWARD_READY_DEMO_DATASET}. Login: ${AWARD_READY_BUYER_EMAIL} / ${AWARD_READY_BUYER_PASSWORD}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
