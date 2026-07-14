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
import { createEncryptedSigningCredential } from '../src/modules/identity/signing.js';

const scrypt = promisify(scryptCallback);

export const DEMO_EVALUATION_AWARD_DATASET = 'demo-evaluation-award-two-user';
export const DEMO_EVALUATION_AWARD_TENDER_REF = 'PX-DEMO-EVAL-AWARD-2026-001';
export const DEMO_EVALUATION_AWARD_BUYER_EMAIL = 'demo@procurex.tz';
export const DEMO_EVALUATION_AWARD_WINNER_EMAIL = 'josefmmbaga@gmail.com';
export const DEMO_EVALUATION_AWARD_KEYPHRASE = 'DemoAward123!';

type AnyDb = Record<string, any>;
type Actor = { org: any; user: any };

const bidSpecs = [
  {
    key: 'winner',
    email: DEMO_EVALUATION_AWARD_WINNER_EMAIL,
    fallbackOrgName: 'Hassan Omari Mdee',
    displayName: 'Josef Mmbaga',
    amount: 187_500_000,
    technical: 93,
    financial: 90
  },
  {
    key: 'runner-up',
    email: 'demo-award-runner-up@procurex.tz',
    fallbackOrgName: 'Mlimani Medical Logistics Limited',
    displayName: 'Runner Up Bid Manager',
    amount: 194_800_000,
    technical: 84,
    financial: 82
  }
] as const;

function assertSafeEnvironment() {
  const environment = process.env.NODE_ENV || 'development';
  if (!['development', 'test'].includes(environment)) {
    throw new Error(`Refusing to run demo evaluation award seed when NODE_ENV=${environment}. Use development or test only.`);
  }
}

function demoPayload(extra: Record<string, unknown> = {}) {
  return { demoDataset: DEMO_EVALUATION_AWARD_DATASET, ...extra };
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

async function resetDemo(db: AnyDb) {
  const tenders = await db.tender.findMany({
    where: { OR: [{ reference: DEMO_EVALUATION_AWARD_TENDER_REF }, { metadata: { path: ['demoDataset'], equals: DEMO_EVALUATION_AWARD_DATASET } }] },
    select: {
      id: true,
      evaluation: {
        select: {
          id: true,
          recommendations: { select: { id: true, notice: { select: { id: true, contractId: true } } } },
          awardGroups: { select: { id: true } }
        }
      },
      bids: { select: { id: true } },
      contracts: { select: { id: true } }
    }
  });
  const tenderIds = tenders.map((tender: any) => tender.id);
  const workspaceIds = tenders.map((tender: any) => tender.evaluation?.id).filter(Boolean);
  const bidIds = tenders.flatMap((tender: any) => tender.bids.map((bid: any) => bid.id));
  const recommendationIds = tenders.flatMap((tender: any) => tender.evaluation?.recommendations.map((recommendation: any) => recommendation.id) ?? []);
  const noticeIds = tenders.flatMap((tender: any) => tender.evaluation?.recommendations.map((recommendation: any) => recommendation.notice?.id).filter(Boolean) ?? []);
  const contractIds = [
    ...tenders.flatMap((tender: any) => tender.contracts.map((contract: any) => contract.id)),
    ...tenders.flatMap((tender: any) => tender.evaluation?.recommendations.map((recommendation: any) => recommendation.notice?.contractId).filter(Boolean) ?? [])
  ];
  const awardGroupIds = tenders.flatMap((tender: any) => tender.evaluation?.awardGroups.map((group: any) => group.id) ?? []);

  await deleteByIds(db, 'awardResponse', 'noticeId', noticeIds);
  await deleteByIds(db, 'contract', 'id', [...new Set(contractIds)]);
  await deleteByIds(db, 'awardNotice', 'id', noticeIds);
  await deleteByIds(db, 'awardWinner', 'awardGroupId', awardGroupIds);
  await deleteByIds(db, 'awardClause', 'awardGroupId', awardGroupIds);
  await deleteByIds(db, 'awardNegotiation', 'awardGroupId', awardGroupIds);
  await deleteByIds(db, 'awardBidPack', 'awardGroupId', awardGroupIds);
  await deleteByIds(db, 'awardGroup', 'id', awardGroupIds);
  await deleteByIds(db, 'approvalStep', 'recommendationId', recommendationIds);
  await deleteByIds(db, 'standstillPeriod', 'recommendationId', recommendationIds);
  await deleteByIds(db, 'awardNotification', 'recommendationId', recommendationIds);
  await deleteByIds(db, 'budgetCommitment', 'recommendationId', recommendationIds);
  await deleteByIds(db, 'awardRecommendation', 'id', recommendationIds);
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
  await db.documentObject.deleteMany({ where: { objectKey: { startsWith: `${DEMO_EVALUATION_AWARD_DATASET}/` } } });
  await db.auditEvent.deleteMany({ where: { payload: { path: ['demoDataset'], equals: DEMO_EVALUATION_AWARD_DATASET } } });
  await db.signingCredential.updateMany({
    where: { user: { email: { in: [DEMO_EVALUATION_AWARD_BUYER_EMAIL, DEMO_EVALUATION_AWARD_WINNER_EMAIL] } }, status: 'ACTIVE' },
    data: { status: 'REVOKED', revokedAt: new Date() }
  });
}

async function ensureCapability(db: AnyDb, organizationId: string, capability: OrganizationCapabilityName) {
  await db.organizationCapability.upsert({
    where: { organizationId_capability: { organizationId, capability } },
    update: { enabled: true },
    create: { organizationId, capability, enabled: true }
  });
}

async function defaultActor(db: AnyDb, email: string): Promise<Actor | null> {
  const user = await db.user.findUnique({
    where: { email },
    include: {
      memberships: {
        where: { status: 'ACTIVE' },
        orderBy: { isDefault: 'desc' },
        include: { organization: true }
      }
    }
  });
  const membership = user?.memberships?.[0];
  return user && membership ? { user, org: membership.organization } : null;
}

async function ensureActor(db: AnyDb, input: { email: string; fallbackOrgName: string; displayName: string; title: string; password: string }) {
  const existing = await defaultActor(db, input.email);
  if (existing) {
    await db.user.update({
      where: { id: existing.user.id },
      data: {
        displayName: input.displayName,
        verificationStatus: VerificationStatus.APPROVED,
        passwordHash: await hashSeedPassword(input.password)
      }
    });
    await db.account.upsert({
      where: { provider_providerUserId: { provider: 'password', providerUserId: input.email } },
      update: { accountType: AccountType.USER, metadata: demoPayload({ passwordRefreshed: true }) },
      create: { userId: existing.user.id, provider: 'password', providerUserId: input.email, accountType: AccountType.USER, metadata: demoPayload({ passwordRefreshed: true }) }
    });
    await ensureCapability(db, existing.org.id, OrganizationCapabilityName.BUYER);
    await ensureCapability(db, existing.org.id, OrganizationCapabilityName.SUPPLIER);
    return existing;
  }

  const org = await db.organization.upsert({
    where: { name: input.fallbackOrgName },
    update: { kind: OrganizationKind.COMPANY, country: 'TZ', metadata: demoPayload({ seededActor: true }) },
    create: { name: input.fallbackOrgName, kind: OrganizationKind.COMPANY, country: 'TZ', metadata: demoPayload({ seededActor: true }) }
  });
  for (const capability of [OrganizationCapabilityName.BUYER, OrganizationCapabilityName.SUPPLIER]) {
    await ensureCapability(db, org.id, capability);
  }
  await db.organizationProfile.upsert({
    where: { organizationId: org.id },
    update: { summary: `${org.name} seeded for the two-user award demo.`, payload: demoPayload() },
    create: { organizationId: org.id, summary: `${org.name} seeded for the two-user award demo.`, payload: demoPayload() }
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

async function replaceSigningCredential(db: AnyDb, actor: Actor) {
  await db.signingCredential.updateMany({
    where: { userId: actor.user.id, status: 'ACTIVE' },
    data: { status: 'REVOKED', revokedAt: new Date() }
  });
  const encrypted = await createEncryptedSigningCredential(DEMO_EVALUATION_AWARD_KEYPHRASE);
  const credential = await db.signingCredential.create({
    data: {
      userId: actor.user.id,
      publicKeyPem: encrypted.publicKeyPem,
      keyFingerprint: encrypted.keyFingerprint,
      encryptedPrivateKey: encrypted.encryptedPrivateKey,
      kdfMetadata: encrypted.kdfMetadata,
      encryptionMetadata: encrypted.encryptionMetadata,
      providerMetadata: {
        ...encrypted.providerMetadata,
        provisionedBy: 'seed-demo-evaluation-award',
        demoDataset: DEMO_EVALUATION_AWARD_DATASET,
        provisionedAt: new Date().toISOString()
      }
    }
  });
  await db.keyphraseRecovery.create({
    data: {
      userId: actor.user.id,
      organizationId: actor.org.id,
      email: actor.user.email,
      status: 'DEMO_SEEDED',
      completedAt: new Date(),
      newKeyFingerprint: credential.keyFingerprint,
      requestMetadata: demoPayload({ source: 'seed-demo-evaluation-award' }),
      payload: demoPayload({ mode: 'seeded_demo_award_keyphrase', credentialId: credential.id })
    }
  });
}

async function createDocument(db: AnyDb, input: { owner: Actor; name: string; type: string; key: string; uploadedBy?: Actor }) {
  return db.documentObject.create({
    data: {
      ownerOrgId: input.owner.org.id,
      uploadedByUserId: (input.uploadedBy ?? input.owner).user.id,
      name: input.name,
      objectKey: `${DEMO_EVALUATION_AWARD_DATASET}/${input.key}`,
      documentType: input.type,
      checksum: sha256(`${DEMO_EVALUATION_AWARD_DATASET}:${input.key}`),
      metadata: demoPayload({ generatedPreview: true })
    }
  });
}

async function createTender(db: AnyDb, buyer: Actor) {
  const tender = await db.tender.create({
    data: {
      reference: DEMO_EVALUATION_AWARD_TENDER_REF,
      buyerOrgId: buyer.org.id,
      ownerUserId: buyer.user.id,
      title: 'Supply and delivery of emergency medical equipment',
      description: 'Two-user demo tender with completed evaluation and a recommendation ready for buyer award confirmation.',
      type: TenderType.GOODS,
      status: TenderStatus.EVALUATION,
      method: ProcurementMethod.OPEN_TENDER,
      visibility: Visibility.PUBLIC_MARKETPLACE,
      budget: 210_000_000,
      currency: 'TZS',
      location: 'Dar es Salaam',
      closingDate: daysFromNow(-8, 14),
      publishedAt: daysFromNow(-35, 8),
      requirements: demoPayload({
        eligibility: ['Business registration', 'Tax clearance', 'Manufacturer authorization'],
        technical: ['Equipment compliance', 'Delivery plan', 'Warranty support'],
        financial: ['Priced schedule in TZS', 'Bid validity confirmation']
      }),
      metadata: demoPayload({ bidOpeningStatus: 'COMPLETED', evaluationStatus: 'COMPLETED' })
    }
  });
  await db.tenderCategory.createMany({ data: ['Medical Equipment', 'Emergency Equipment', 'Goods'].map((name) => ({ tenderId: tender.id, name })) });
  await db.tenderRequirement.createMany({
    data: [
      { tenderId: tender.id, section: 'Eligibility', payload: demoPayload({ title: 'Submit registration, tax clearance, and authorization documents.' }) },
      { tenderId: tender.id, section: 'Technical', payload: demoPayload({ title: 'Confirm equipment specification compliance and warranty support.' }) },
      { tenderId: tender.id, section: 'Financial', payload: demoPayload({ title: 'Submit priced schedule and confirm bid validity.' }) }
    ]
  });
  await db.tenderCommercialItem.createMany({
    data: [
      { tenderId: tender.id, itemNo: '1', description: 'Emergency patient monitors', quantity: 10, unit: 'Each', rate: 9_500_000, total: 95_000_000, payload: demoPayload() },
      { tenderId: tender.id, itemNo: '2', description: 'Portable oxygen concentrators', quantity: 12, unit: 'Each', rate: 6_250_000, total: 75_000_000, payload: demoPayload() },
      { tenderId: tender.id, itemNo: '3', description: 'Installation, user training, and warranty support', quantity: 1, unit: 'Lot', rate: 40_000_000, total: 40_000_000, payload: demoPayload() }
    ]
  });
  await db.tenderMilestone.createMany({
    data: [
      { tenderId: tender.id, name: 'Tender published', dueDate: daysFromNow(-35, 8), payload: demoPayload() },
      { tenderId: tender.id, name: 'Submission deadline', dueDate: daysFromNow(-8, 14), payload: demoPayload() },
      { tenderId: tender.id, name: 'Evaluation completed', dueDate: daysFromNow(-2, 16), payload: demoPayload() }
    ]
  });
  const tenderDocument = await createDocument(db, { owner: buyer, name: `${DEMO_EVALUATION_AWARD_TENDER_REF} Tender Document`, type: 'TENDER_DOCUMENT', key: `${DEMO_EVALUATION_AWARD_TENDER_REF}/tender-document.html` });
  await db.tenderDocument.create({ data: { tenderId: tender.id, documentId: tenderDocument.id, label: 'Tender Document' } });
  return tender;
}

async function createBid(db: AnyDb, tender: any, buyer: Actor, supplier: Actor, spec: (typeof bidSpecs)[number], index: number) {
  const reference = `${DEMO_EVALUATION_AWARD_TENDER_REF}-BID-${String(index + 1).padStart(2, '0')}`;
  const bid = await db.bid.create({
    data: {
      tenderId: tender.id,
      buyerOrgId: buyer.org.id,
      supplierOrgId: supplier.org.id,
      submittedByUserId: supplier.user.id,
      reference,
      status: BidStatus.UNDER_EVALUATION,
      submittedAt: daysFromNow(-9 + index, 9),
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
  await db.bidVersion.create({ data: { bidId: bid.id, versionNo: 1, envelope: EnvelopeType.COMBINED, sealedHash: sha256(`${reference}:${spec.amount}`), payload: demoPayload({ snapshot: 'Two-user award demo submitted bid' }) } });
  await db.bidReceipt.create({ data: { bidId: bid.id, receiptRef: `${reference}-RCPT`, receiptHash: sha256(`${reference}:receipt`) } });
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
    const document = await createDocument(db, { owner: supplier, uploadedBy: supplier, name: `${supplier.org.name} - ${doc.name}`, type: doc.type, key: `${reference}/${doc.type}.html` });
    await db.bidDocument.create({ data: { bidId: bid.id, documentId: document.id, envelope: doc.envelope, reviewStatus: DocumentReviewStatus.VERIFIED } });
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
      payload: demoPayload({ completedAt: daysFromNow(-2, 16).toISOString() })
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
  await db.evaluationScore.createMany({
    data: bids.flatMap((bid, index) => {
      const spec = bidSpecs[index];
      return [
        { workspaceId: workspace.id, criterionId: criteria[0].id, bidId: bid.id, evaluatorUserId: buyer.user.id, score: 1, comment: 'Passed administrative compliance.', lockedAt: daysFromNow(-2, 12), payload: demoPayload({ decision: 'PASSED' }) },
        { workspaceId: workspace.id, criterionId: criteria[1].id, bidId: bid.id, evaluatorUserId: buyer.user.id, score: spec.technical, comment: 'Technical score captured from completed evaluation.', lockedAt: daysFromNow(-2, 12), payload: demoPayload() },
        { workspaceId: workspace.id, criterionId: criteria[2].id, bidId: bid.id, evaluatorUserId: buyer.user.id, score: spec.financial, comment: 'Financial score captured from completed evaluation.', lockedAt: daysFromNow(-2, 12), payload: demoPayload() }
      ];
    })
  });
  await db.auditEvent.createMany({
    data: [
      { ownerOrgId: buyer.org.id, actorUserId: buyer.user.id, event: 'evaluation.completed', entityType: 'evaluation_workspace', entityRef: workspace.id, payload: demoPayload({ tenderReference: tender.reference }) },
      { ownerOrgId: buyer.org.id, actorUserId: buyer.user.id, event: 'evaluation.recommendation.prepared', entityType: 'award_recommendation', entityRef: tender.reference, payload: demoPayload() }
    ]
  });
  const winningBid = bids[0];
  await db.awardRecommendation.create({
    data: {
      reference: 'PX-DEMO-EVAL-AWARD-REC-001',
      workspaceId: workspace.id,
      bidId: winningBid.id,
      supplierOrgId: winningBid.supplierOrgId,
      status: RecommendationStatus.RECOMMENDED,
      amount: winningBid.totalAmount,
      currency: winningBid.currency,
      reason: `${bidSpecs[0].displayName} ranked first after administrative, technical, and financial evaluation.`,
      payload: demoPayload({
        awardDecisionDraft: {
          selectedSupplier: bidSpecs[0].fallbackOrgName,
          awardAmount: bidSpecs[0].amount,
          currency: 'TZS',
          reason: 'Best evaluated responsive bidder.',
          conditions: 'Submit delivery schedule and signatory authorization before contract signing.'
        },
        rankings: bidSpecs.map((supplier, index) => ({
          rank: index + 1,
          supplier: supplier.fallbackOrgName,
          amount: supplier.amount,
          technicalScore: supplier.technical,
          financialScore: supplier.financial
        }))
      })
    }
  });
  return workspace;
}

export async function seedDemoEvaluationAward() {
  assertSafeEnvironment();
  await withDbContext({ accountType: AccountType.ADMIN }, async (tx) => {
    const db = tx as AnyDb;
    await resetDemo(db);

    const buyer = await ensureActor(db, {
      email: DEMO_EVALUATION_AWARD_BUYER_EMAIL,
      fallbackOrgName: 'Kilimanjaro Supplies Limited',
      displayName: 'Demo Verified User',
      title: 'Demo verified operator',
      password: 'Demo123!'
    });
    const suppliers: Actor[] = [];
    for (const spec of bidSpecs) {
      suppliers.push(await ensureActor(db, {
        email: spec.email,
        fallbackOrgName: spec.fallbackOrgName,
        displayName: spec.displayName,
        title: spec.key === 'winner' ? 'Winning Supplier Representative' : 'Bid Manager',
        password: spec.key === 'winner' ? 'Demo123!' : 'Supplier123!'
      }));
    }
    await replaceSigningCredential(db, buyer);
    await replaceSigningCredential(db, suppliers[0]);

    const tender = await createTender(db, buyer);
    const bids = [];
    for (const [index, supplier] of suppliers.entries()) {
      bids.push(await createBid(db, tender, buyer, supplier, bidSpecs[index], index));
    }
    await createCompletedEvaluation(db, tender, buyer, bids);
  }, prisma);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  seedDemoEvaluationAward()
    .then(() => {
      console.log(`Seeded ${DEMO_EVALUATION_AWARD_DATASET}. Buyer: ${DEMO_EVALUATION_AWARD_BUYER_EMAIL} / Demo123!. Winner: ${DEMO_EVALUATION_AWARD_WINNER_EMAIL} / Demo123!. Signing keyphrase: ${DEMO_EVALUATION_AWARD_KEYPHRASE}`);
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
