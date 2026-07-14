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
  RiskLevel,
  TenderStatus,
  TenderType,
  TrustTier,
  VerificationStatus,
  Visibility
} from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { withDbContext } from '../src/db/context.js';
import { createEncryptedSigningCredential } from '../src/modules/identity/signing.js';

type AnyDb = Record<string, any>;
type DemoTender = (typeof DEMO_TENDERS)[number];
type DemoBid = DemoTender['bids'][number];

export const EVALUATION_INTAKE_DEMO_DATASET = 'evaluation-intake-demo';
export const EVALUATION_INTAKE_TENDER_REFS = ['PX-GDS-2026-001', 'PX-WRK-2026-002', 'PX-SRV-2026-003', 'PX-CON-2026-004'] as const;
export const EVALUATION_INTAKE_BUYER_EMAIL = 'evaluation-buyer@procurex.tz';
export const EVALUATION_INTAKE_BUYER_PASSWORD = 'Demo123!';
export const EVALUATION_INTAKE_BUYER_SIGNATURE_KEYPHRASE = 'Signing123';

const scrypt = promisify(scryptCallback);

const DEMO_TENDERS = [
  {
    tenderNo: 'PX-GDS-2026-001',
    title: 'Supply of Emergency Medical Consumables',
    category: 'Goods',
    procurementMethod: 'National Competitive Tendering',
    buyer: 'ProcureX Evaluation Demo Buyer',
    status: TenderStatus.CLOSED,
    closingDate: '2026-06-24',
    openingDate: '2026-06-25',
    currency: 'TZS',
    estimatedBudget: 185000000,
    minimumPassMark: 70,
    technicalWeight: 70,
    financialWeight: 30,
    bids: [
      { supplier: 'Afya Medical Supplies Ltd', bidAmount: 176500000, discount: 2500000, correction: 0, adjustment: 750000, technicalHint: 88 },
      { supplier: 'Kisasa Health Logistics', bidAmount: 181200000, discount: 0, correction: -800000, adjustment: 1200000, technicalHint: 79 }
    ],
    criteria: [
      { name: 'Mandatory document compliance', stage: EvaluationStage.PRELIMINARY, weight: null, maxScore: 1, criterionType: 'PASS_FAIL' },
      { name: 'Technical specification compliance', stage: EvaluationStage.TECHNICAL, weight: 35, maxScore: 100 },
      { name: 'Warranty and after-sales support', stage: EvaluationStage.TECHNICAL, weight: 20, maxScore: 100 },
      { name: 'Delivery schedule and stock availability', stage: EvaluationStage.TECHNICAL, weight: 15, maxScore: 100 },
      { name: 'Financial proposal', stage: EvaluationStage.FINANCIAL, weight: 30, maxScore: 100 }
    ]
  },
  {
    tenderNo: 'PX-WRK-2026-002',
    title: 'Rehabilitation of Municipal Stormwater Drains',
    category: 'Works',
    procurementMethod: 'National Competitive Tendering',
    buyer: 'ProcureX Evaluation Demo Buyer',
    status: TenderStatus.CLOSED,
    closingDate: '2026-06-25',
    openingDate: '2026-06-26',
    currency: 'TZS',
    estimatedBudget: 940000000,
    minimumPassMark: 75,
    technicalWeight: 75,
    financialWeight: 25,
    bids: [
      { supplier: 'Ujenzi Bora Contractors Ltd', bidAmount: 910000000, discount: 10000000, correction: 2500000, adjustment: 0, technicalHint: 86 },
      { supplier: 'Prime Civil Works Ltd', bidAmount: 935000000, discount: 5000000, correction: -1500000, adjustment: 3000000, technicalHint: 78 }
    ],
    criteria: [
      { name: 'Mandatory document compliance', stage: EvaluationStage.PRELIMINARY, weight: null, maxScore: 1, criterionType: 'PASS_FAIL' },
      { name: 'Similar project experience', stage: EvaluationStage.TECHNICAL, weight: 25, maxScore: 100 },
      { name: 'Construction methodology and work programme', stage: EvaluationStage.TECHNICAL, weight: 25, maxScore: 100 },
      { name: 'Key personnel, equipment, health and safety', stage: EvaluationStage.TECHNICAL, weight: 25, maxScore: 100 },
      { name: 'BOQ and financial proposal', stage: EvaluationStage.FINANCIAL, weight: 25, maxScore: 100 }
    ]
  },
  {
    tenderNo: 'PX-SRV-2026-003',
    title: 'Provision of Hospital Cleaning and Waste Handling Services',
    category: 'Services',
    procurementMethod: 'Competitive Selection',
    buyer: 'ProcureX Evaluation Demo Buyer',
    status: TenderStatus.CLOSED,
    closingDate: '2026-06-26',
    openingDate: '2026-06-27',
    currency: 'TZS',
    estimatedBudget: 88000000,
    minimumPassMark: 70,
    technicalWeight: 70,
    financialWeight: 30,
    bids: [
      { supplier: 'SafiCare Services Ltd', bidAmount: 81200000, discount: 1200000, correction: 0, adjustment: 450000, technicalHint: 84 },
      { supplier: 'GreenClean Tanzania Ltd', bidAmount: 79500000, discount: 0, correction: 350000, adjustment: 900000, technicalHint: 76 }
    ],
    criteria: [
      { name: 'Mandatory document compliance', stage: EvaluationStage.PRELIMINARY, weight: null, maxScore: 1, criterionType: 'PASS_FAIL' },
      { name: 'Understanding of scope and service methodology', stage: EvaluationStage.TECHNICAL, weight: 25, maxScore: 100 },
      { name: 'Staffing, equipment and resources', stage: EvaluationStage.TECHNICAL, weight: 20, maxScore: 100 },
      { name: 'Service schedule and SLA controls', stage: EvaluationStage.TECHNICAL, weight: 25, maxScore: 100 },
      { name: 'Financial proposal', stage: EvaluationStage.FINANCIAL, weight: 30, maxScore: 100 }
    ]
  },
  {
    tenderNo: 'PX-CON-2026-004',
    title: 'Consultancy for Water Utility Revenue Improvement',
    category: 'Consultancy',
    procurementMethod: 'Quality and Cost Based Selection',
    buyer: 'ProcureX Evaluation Demo Buyer',
    status: TenderStatus.CLOSED,
    closingDate: '2026-06-27',
    openingDate: '2026-06-28',
    currency: 'TZS',
    estimatedBudget: 320000000,
    minimumPassMark: 75,
    technicalWeight: 80,
    financialWeight: 20,
    bids: [
      { supplier: 'Maji Advisory Partners Ltd', bidAmount: 302000000, discount: 0, correction: 0, adjustment: 2500000, technicalHint: 91 },
      { supplier: 'Nile Basin Consulting Ltd', bidAmount: 286000000, discount: 4000000, correction: 1500000, adjustment: 0, technicalHint: 72 }
    ],
    criteria: [
      { name: 'Mandatory document compliance', stage: EvaluationStage.PRELIMINARY, weight: null, maxScore: 1, criterionType: 'PASS_FAIL' },
      { name: 'Firm experience', stage: EvaluationStage.TECHNICAL, weight: 20, maxScore: 100 },
      { name: 'Technical approach, methodology and work plan', stage: EvaluationStage.TECHNICAL, weight: 35, maxScore: 100 },
      { name: 'Key experts qualifications and experience', stage: EvaluationStage.TECHNICAL, weight: 25, maxScore: 100 },
      { name: 'Financial proposal', stage: EvaluationStage.FINANCIAL, weight: 20, maxScore: 100 }
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

async function hashSeedPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
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
  if (category === 'Consultancy') return TenderType.CONSULTANCY;
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

function tenderDocumentSpecs(item: DemoTender) {
  const common = [
    { label: 'Certificate of incorporation', name: 'Certificate of incorporation', type: 'REQUIRED_ADMINISTRATIVE_DOCUMENT' },
    { label: 'Tax clearance certificate', name: 'Tax clearance certificate', type: 'REQUIRED_ADMINISTRATIVE_DOCUMENT' },
    { label: 'Signed form of bid', name: 'Signed form of bid', type: 'REQUIRED_ADMINISTRATIVE_DOCUMENT' }
  ];
  if (item.category === 'Consultancy') {
    return [
      ...common,
      { label: 'Technical proposal', name: 'Technical proposal format', type: 'TECHNICAL_PROPOSAL_TEMPLATE' },
      { label: 'Financial proposal', name: 'Financial proposal format', type: 'FINANCIAL_PROPOSAL_TEMPLATE' },
      { label: 'Key expert CVs', name: 'Key expert CV template', type: 'KEY_EXPERT_CV_TEMPLATE' }
    ];
  }
  return [
    ...common,
    { label: 'Technical proposal', name: 'Technical proposal template', type: 'TECHNICAL_PROPOSAL_TEMPLATE' },
    { label: item.category === 'Works' ? 'Priced BOQ' : 'Price schedule', name: item.category === 'Works' ? 'Priced BOQ template' : 'Price schedule template', type: item.category === 'Works' ? 'BOQ_TEMPLATE' : 'PRICE_SCHEDULE_TEMPLATE' }
  ];
}

function tenderRequirementRows(item: DemoTender) {
  const common = [
    { section: 'Eligibility', payload: { title: 'Valid business registration', description: 'Bidder must submit a current certificate of incorporation.', mandatory: true, evidenceRequired: ['Certificate of incorporation'] } },
    { section: 'Eligibility', payload: { title: 'Valid tax clearance', description: 'Bidder must submit a current tax clearance certificate.', mandatory: true, evidenceRequired: ['Tax clearance certificate'] } },
    { section: 'Eligibility', payload: { title: 'Signed bid form', description: 'Bid form must be signed by an authorized representative.', mandatory: true, evidenceRequired: ['Signed form of bid'] } }
  ];
  if (item.category === 'Goods') {
    return [
      ...common,
      { section: 'Technical specification', payload: { title: 'Medical consumables specification compliance', description: 'Supplier must comply with sterile packaging, shelf-life, and ISO/TFDA quality standards.', mandatory: true, maxScore: 100, evidenceRequired: ['Technical proposal', 'Catalogues'] } },
      { section: 'Delivery schedule', payload: { title: 'Delivery within 21 calendar days', description: 'Delivery schedule must confirm stock availability and delivery to central medical stores.', mandatory: true, evidenceRequired: ['Delivery schedule'] } },
      { section: 'Warranty and after-sales support', payload: { title: 'Product replacement warranty', description: 'Supplier must replace defective or expired stock within 10 working days.', mandatory: true, evidenceRequired: ['Warranty statement'] } },
      { section: 'Manufacturer authorization', payload: { title: 'Manufacturer authorization', description: 'Authorization is required for branded sterile consumables.', mandatory: true, evidenceRequired: ['Manufacturer authorization letter'] } },
      { section: 'Post qualification', payload: { title: 'Warehouse and distribution capacity', description: 'Preferred bidder must demonstrate controlled storage and distribution capacity.', mandatory: true, evidenceRequired: ['Warehouse lease', 'Reference checks'] } }
    ];
  }
  if (item.category === 'Works') {
    return [
      ...common,
      { section: 'Construction methodology', payload: { title: 'Drain rehabilitation methodology', description: 'Method statement must cover dewatering, traffic management, concrete works, and reinstatement.', mandatory: true, maxScore: 100, evidenceRequired: ['Method statement'] } },
      { section: 'Work programme', payload: { title: 'Twelve-week work programme', description: 'Programme must show critical path, milestones, and site sequencing.', mandatory: true, evidenceRequired: ['Work programme'] } },
      { section: 'Similar project experience', payload: { title: 'Two similar drainage projects', description: 'Contractor must show at least two completed drainage or roadworks contracts.', mandatory: true, evidenceRequired: ['Completion certificates'] } },
      { section: 'Key personnel', payload: { title: 'Site engineer and safety officer', description: 'Named personnel must meet the minimum experience requirement.', mandatory: true, evidenceRequired: ['CVs', 'Professional certificates'] } },
      { section: 'Equipment', payload: { title: 'Excavator, compactor and concrete mixer', description: 'Equipment ownership or hire commitment must be available for the project.', mandatory: true, evidenceRequired: ['Equipment list'] } },
      { section: 'Health and safety', payload: { title: 'Site health and safety plan', description: 'Plan must address public safety around open drains.', mandatory: true, evidenceRequired: ['HSE plan'] } },
      { section: 'Post qualification', payload: { title: 'Financial capacity and references', description: 'Preferred bidder must pass financial capacity and reference checks.', mandatory: true, evidenceRequired: ['Bank reference', 'Client references'] } }
    ];
  }
  if (item.category === 'Services') {
    return [
      ...common,
      { section: 'Scope of services', payload: { title: 'Hospital cleaning scope understanding', description: 'Bidder must address clinical areas, waste holding rooms, laundry zones, and public areas.', mandatory: true, maxScore: 100, evidenceRequired: ['Technical proposal'] } },
      { section: 'Service methodology', payload: { title: 'Cleaning methodology and infection control', description: 'Methodology must cover infection control, shift management, and waste segregation.', mandatory: true, evidenceRequired: ['Methodology'] } },
      { section: 'Staffing', payload: { title: 'Supervisor and cleaner staffing plan', description: 'Staffing plan must show supervisor coverage and cleaner allocation by zone.', mandatory: true, evidenceRequired: ['Staffing schedule'] } },
      { section: 'SLA', payload: { title: 'Service-level response times', description: 'Bidder must commit to spill response, complaint resolution, and daily quality checks.', mandatory: true, evidenceRequired: ['SLA matrix'] } },
      { section: 'Equipment and resources', payload: { title: 'Cleaning equipment and PPE', description: 'Bidder must provide equipment, PPE, and consumable supply plan.', mandatory: true, evidenceRequired: ['Equipment list'] } },
      { section: 'Post qualification', payload: { title: 'Reference and physical address check', description: 'Preferred bidder must pass reference and operating address verification.', mandatory: true, evidenceRequired: ['Reference letters', 'Physical address'] } }
    ];
  }
  return [
    ...common,
    { section: 'Terms of reference', payload: { title: 'Understanding of assignment', description: 'Consultant must address utility billing, collection efficiency, customer database quality, and NRW impacts.', mandatory: true, maxScore: 100, evidenceRequired: ['Technical proposal'] } },
    { section: 'Terms of reference', payload: { title: 'Technical approach and methodology', description: 'Approach must include diagnostics, stakeholder engagement, revenue model design, and implementation roadmap.', mandatory: true, evidenceRequired: ['Methodology'] } },
    { section: 'Work plan', payload: { title: 'Six-month assignment work plan', description: 'Work plan must identify deliverables, review workshops, and reporting schedule.', mandatory: true, evidenceRequired: ['Work plan'] } },
    { section: 'Key experts', payload: { title: 'Team leader and revenue specialist', description: 'Named experts must meet minimum qualifications and availability.', mandatory: true, evidenceRequired: ['CVs', 'Availability statements'] } },
    { section: 'Due diligence', payload: { title: 'Expert availability and reference checks', description: 'Preferred consultant must pass expert availability, reference, and negotiation checks.', mandatory: true, evidenceRequired: ['Reference checks', 'Negotiation record'] } }
  ];
}

function commercialItems(item: DemoTender) {
  if (item.category === 'Works') {
    return [
      { itemNo: '1.0', description: 'Site establishment and traffic management', quantity: 1, unit: 'LS', rate: 85000000, total: 85000000 },
      { itemNo: '2.0', description: 'Excavation and drain clearing', quantity: 2400, unit: 'm', rate: 95000, total: 228000000 },
      { itemNo: '3.0', description: 'Reinforced concrete lining', quantity: 1800, unit: 'm', rate: 265000, total: 477000000 }
    ];
  }
  if (item.category === 'Consultancy') {
    return [
      { itemNo: '1', description: 'Professional fees for key experts', quantity: 1, unit: 'LS', rate: 235000000, total: 235000000 },
      { itemNo: '2', description: 'Workshops, travel and reimbursables', quantity: 1, unit: 'LS', rate: 55000000, total: 55000000 }
    ];
  }
  if (item.category === 'Services') {
    return [
      { itemNo: '1', description: 'Monthly cleaning service charge', quantity: 12, unit: 'month', rate: 5900000, total: 70800000 },
      { itemNo: '2', description: 'Consumables and PPE allowance', quantity: 12, unit: 'month', rate: 950000, total: 11400000 }
    ];
  }
  return [
    { itemNo: '1', description: 'Sterile gloves assorted sizes', quantity: 5000, unit: 'box', rate: 14500, total: 72500000 },
    { itemNo: '2', description: 'Disposable surgical masks', quantity: 7500, unit: 'box', rate: 8500, total: 63750000 },
    { itemNo: '3', description: 'IV cannula assorted gauges', quantity: 3000, unit: 'pack', rate: 15500, total: 46500000 }
  ];
}

async function deleteByIds(db: AnyDb, model: string, field: string, ids: string[]) {
  if (ids.length === 0) return;
  await db[model].deleteMany({ where: { [field]: { in: ids } } });
}

async function resetEvaluationIntakeDemo(db: AnyDb) {
  const tenders = await db.tender.findMany({
    where: {
      OR: [
        { reference: { in: [...EVALUATION_INTAKE_TENDER_REFS, 'PX-GDS-2026-004'] } },
        { metadata: { path: ['demoDataset'], equals: EVALUATION_INTAKE_DEMO_DATASET } }
      ]
    },
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
  await deleteByIds(db, 'evaluationWorkspace', 'id', workspaceIds);
  await deleteByIds(db, 'awardRecommendation', 'bidId', bidIds);
  await deleteByIds(db, 'bidDocument', 'bidId', bidIds);
  await deleteByIds(db, 'bidResponse', 'bidId', bidIds);
  await deleteByIds(db, 'bidVersion', 'bidId', bidIds);
  await deleteByIds(db, 'bidReceipt', 'bidId', bidIds);
  await deleteByIds(db, 'bid', 'id', bidIds);
  await deleteByIds(db, 'tenderDocument', 'tenderId', tenderIds);
  await deleteByIds(db, 'tenderCategory', 'tenderId', tenderIds);
  await db.documentObject.deleteMany({ where: { objectKey: { startsWith: `${EVALUATION_INTAKE_DEMO_DATASET}/` } } });
  await deleteByIds(db, 'tenderMilestone', 'tenderId', tenderIds);
  await deleteByIds(db, 'tenderRequirement', 'tenderId', tenderIds);
  await deleteByIds(db, 'tenderCommercialItem', 'tenderId', tenderIds);
  await deleteByIds(db, 'tender', 'id', tenderIds);
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
  const email = capability === OrganizationCapabilityName.BUYER ? EVALUATION_INTAKE_BUYER_EMAIL : supplierEmail(name);
  const user = await db.user.upsert({
    where: { email },
    update: {
      displayName: `${name} Demo User`,
      accountType: AccountType.USER,
      verificationStatus: VerificationStatus.APPROVED,
      passwordHash: await hashSeedPassword(EVALUATION_INTAKE_BUYER_PASSWORD),
      metadata: demoPayload({ phoneVerified: true, emailVerified: true, organizationName: name })
    },
    create: {
      email,
      displayName: `${name} Demo User`,
      accountType: AccountType.USER,
      verificationStatus: VerificationStatus.APPROVED,
      passwordHash: await hashSeedPassword(EVALUATION_INTAKE_BUYER_PASSWORD),
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

async function ensureEvaluationBuyerSigningCredential(db: AnyDb, user: any, org: any) {
  await db.signingCredential.updateMany({
    where: { userId: user.id, status: 'ACTIVE' },
    data: { status: 'REVOKED', revokedAt: new Date() }
  });

  const encrypted = await createEncryptedSigningCredential(EVALUATION_INTAKE_BUYER_SIGNATURE_KEYPHRASE);
  const credential = await db.signingCredential.create({
    data: {
      userId: user.id,
      publicKeyPem: encrypted.publicKeyPem,
      keyFingerprint: encrypted.keyFingerprint,
      encryptedPrivateKey: encrypted.encryptedPrivateKey,
      kdfMetadata: encrypted.kdfMetadata,
      encryptionMetadata: encrypted.encryptionMetadata,
      providerMetadata: demoPayload({
        ...encrypted.providerMetadata,
        provisionedBy: EVALUATION_INTAKE_DEMO_DATASET,
        provisionedAt: new Date().toISOString()
      })
    }
  });

  await db.keyphraseRecovery.create({
    data: {
      userId: user.id,
      organizationId: org.id,
      email: user.email,
      status: 'ADMIN_SEEDED',
      completedAt: new Date(),
      newKeyFingerprint: credential.keyFingerprint,
      requestMetadata: demoPayload({ source: EVALUATION_INTAKE_DEMO_DATASET }),
      payload: demoPayload({ mode: 'evaluation_e2e_keyphrase', credentialId: credential.id })
    }
  });
}

async function upsertTender(db: AnyDb, item: DemoTender, buyerOrg: any, buyerUser: any) {
  const data = {
    buyerOrgId: buyerOrg.id,
    ownerUserId: buyerUser.id,
    title: item.title,
    description: `${item.procurementMethod} for ${item.buyer}.`,
    type: tenderType(item.category),
    status: item.status,
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
      bidOpeningStatus: 'COMPLETED',
      minimumPassMark: item.minimumPassMark,
      technicalWeight: item.technicalWeight,
      financialWeight: item.financialWeight,
      clarificationRules: {
        allowClarifications: true,
        correctableOnly: true,
        deadlineDays: 3
      },
      [tenderType(item.category).toLowerCase()]: {
        fields: {
          eligibilityRequirementCards: tenderRequirementRows(item).filter((row) => row.section === 'Eligibility').map((row) => row.payload),
          personnelRequirementRows: tenderRequirementRows(item).filter((row) => row.section === 'Key personnel' || row.section === 'Key experts').map((row) => row.payload),
          equipmentRequirementRows: tenderRequirementRows(item).filter((row) => row.section === 'Equipment' || row.section === 'Equipment and resources').map((row) => row.payload),
          boqRows: item.category === 'Works' ? commercialItems(item) : [],
          serviceBoqRows: item.category === 'Services' ? commercialItems(item) : [],
          assignmentActivityRows: item.category === 'Consultancy' ? tenderRequirementRows(item).filter((row) => row.section === 'Terms of reference' || row.section === 'Work plan').map((row) => row.payload) : [],
          keyExpertRows: item.category === 'Consultancy' ? tenderRequirementRows(item).filter((row) => row.section === 'Key experts').map((row) => row.payload) : []
        }
      }
    },
    metadata: demoPayload({
      tenderNo: item.tenderNo,
      category: item.category,
      openingDate: item.openingDate,
      bidOpeningStatus: 'COMPLETED',
      evaluationStatus: 'PENDING',
      minimumPassMark: item.minimumPassMark,
      technicalWeight: item.technicalWeight,
      financialWeight: item.financialWeight,
      evaluationMethod: item.category === 'Consultancy' ? 'Quality and Cost Based Selection' : 'Lowest Evaluated Responsive Bid',
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

  await db.tenderRequirement.createMany({
    data: tenderRequirementRows(item).map((row) => ({
      tenderId: tender.id,
      section: row.section,
      payload: demoPayload(row.payload)
    }))
  });

  await db.tenderCommercialItem.createMany({
    data: commercialItems(item).map((row) => ({
      tenderId: tender.id,
      itemNo: row.itemNo,
      description: row.description,
      quantity: row.quantity,
      unit: row.unit,
      rate: row.rate,
      total: row.total,
      payload: demoPayload({ source: item.category === 'Works' ? 'BOQ' : item.category === 'Consultancy' ? 'Financial proposal schedule' : 'Price schedule' })
    }))
  });

  for (const spec of tenderDocumentSpecs(item)) {
    const objectKey = `${EVALUATION_INTAKE_DEMO_DATASET}/${item.tenderNo}/tender/${slug(spec.name)}`;
    const document = await db.documentObject.create({
      data: {
        ownerOrgId: buyerOrg.id,
        uploadedByUserId: buyerUser.id,
        name: spec.name,
        objectKey,
        documentType: spec.type,
        checksum: sha256(objectKey),
        metadata: demoPayload({ tenderNo: item.tenderNo, requiredDocument: true })
      }
    });
    await db.tenderDocument.create({
      data: {
        tenderId: tender.id,
        documentId: document.id,
        label: spec.label
      }
    });
  }

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
      openedAt: openingDate(item).toISOString(),
      openingRemarks: 'Opened during seeded bid-opening register validation.',
      discount: demoBid.discount,
      arithmeticCorrection: demoBid.correction,
      evaluationAdjustment: demoBid.adjustment
    })
  };

  const bid = await db.bid.upsert({
    where: { reference },
    update: bidData,
    create: { reference, ...bidData }
  });

  await db.bidResponse.createMany({
    data: [
      { bidId: bid.id, requirementKey: 'ADMINISTRATIVE', response: demoPayload({ status: 'PENDING', registration: 'Submitted', taxClearance: 'Submitted', signedBidForm: 'Submitted' }) },
      { bidId: bid.id, requirementKey: 'TECHNICAL', response: demoPayload({ status: 'PENDING', category: item.category, technicalScoreHint: demoBid.technicalHint, methodology: `${demoBid.supplier} submitted a category-specific technical response.` }) },
      { bidId: bid.id, requirementKey: 'FINANCIAL', response: demoPayload({ status: 'PENDING', amount: demoBid.bidAmount, currency: item.currency }) },
      { bidId: bid.id, requirementKey: 'DISCOUNT_DECLARED_DURING_OPENING', response: `${item.currency} ${demoBid.discount.toLocaleString()}` },
      { bidId: bid.id, requirementKey: 'ARITHMETIC_CORRECTION', response: `${item.currency} ${demoBid.correction.toLocaleString()}` },
      { bidId: bid.id, requirementKey: 'EVALUATION_ADJUSTMENT', response: `${item.currency} ${demoBid.adjustment.toLocaleString()}` },
      { bidId: bid.id, requirementKey: 'BID_SECURITY_DETAILS', response: item.category === 'Consultancy' ? 'Not required for consultancy proposal.' : `Bid security submitted for ${item.currency} 5,000,000 and valid for 120 days.` },
      { bidId: bid.id, requirementKey: 'OPENING_REMARKS', response: 'Bid opened successfully. No withdrawal recorded. Submission was on time.' },
      { bidId: bid.id, requirementKey: 'WITHDRAWAL_OR_LATE_STATUS', response: 'On time and not withdrawn' }
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
    const signedBuyerIds = new Set<string>();

    for (const item of DEMO_TENDERS) {
      const buyerOrg = await upsertOrganization(db, item.buyer, OrganizationCapabilityName.BUYER);
      const buyerUser = await upsertUser(db, buyerOrg, item.buyer, OrganizationCapabilityName.BUYER);
      if (!signedBuyerIds.has(buyerUser.id)) {
        await ensureEvaluationBuyerSigningCredential(db, buyerUser, buyerOrg);
        signedBuyerIds.add(buyerUser.id);
      }
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
