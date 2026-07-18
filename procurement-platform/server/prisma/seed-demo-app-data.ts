import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import {
  AccountType,
  ApprovalStatus,
  AuditSeverity,
  AwardNoticeStatus,
  AwardResponseAction,
  BidSampleStatus,
  BidStatus,
  CommunicationKind,
  CommunicationPriority,
  CommunicationStatus,
  ContractLifecycleItemStatus,
  ContractMilestoneStatus,
  ContractPartyRole,
  ContractRiskLevel,
  ContractStatus,
  ContractType,
  DocumentReviewStatus,
  EnvelopeType,
  EvaluationStage,
  EvaluationStatus,
  InvoiceStatus,
  OrganizationCapabilityName,
  OrganizationKind,
  ProcurementMethod,
  RecommendationStatus,
  SignatureStatus,
  TenderAmendmentStatus,
  TenderStatus,
  TenderType,
  VerificationStatus,
  Visibility,
  WorkflowAssignmentType
} from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { withDbContext } from '../src/db/context.js';

export const DEMO_APP_DATASET = 'demo-app-temp';
export const DEMO_APP_REFERENCE_PREFIX = 'PX-DEMO-APP';
export const DEMO_APP_USER_EMAIL = 'demo@procurex.tz';
export const DEMO_APP_BID_READY_BUYER_ORG_NAME = 'PX-DEMO-APP Buyer Authority';
export const DEMO_APP_BID_READY_TENDER_REFERENCE = 'PX-DEMO-APP-BID-READY-TENDER-001';

type AnyDb = Record<string, any>;
type DemoActor = {
  user: {
    id: string;
    email: string;
    displayName: string;
    accountType: AccountType;
    verificationStatus: VerificationStatus;
  };
  organization: {
    id: string;
    name: string;
  };
};

export function assertDemoAppSeedRuntime(environment = process.env.NODE_ENV || process.env.APP_ENV || 'development') {
  const normalized = environment.trim().toLowerCase();
  const blocked = new Set(['production', 'prod', 'staging', 'stage', 'uat', 'preprod', 'pre-production', 'preview']);

  if (blocked.has(normalized)) {
    throw new Error(`Refusing to run temporary demo app seed when NODE_ENV/APP_ENV=${environment}. Use development or test only.`);
  }
}

export function assertBaseDemoUser(user: {
  email?: string | null;
  accountType?: AccountType | null;
  verificationStatus?: VerificationStatus | null;
}) {
  if (user.email !== DEMO_APP_USER_EMAIL) {
    throw new Error(`Temporary demo app seed must target ${DEMO_APP_USER_EMAIL}.`);
  }

  if (user.accountType !== AccountType.USER) {
    throw new Error(`Refusing to seed app data because ${DEMO_APP_USER_EMAIL} is not a normal USER account.`);
  }

  if (user.verificationStatus !== VerificationStatus.APPROVED) {
    throw new Error(`Refusing to seed app data because ${DEMO_APP_USER_EMAIL} is not verified. Run npm run db:seed first.`);
  }
}

export function demoAppPayload(extra: Record<string, unknown> = {}) {
  return {
    dataset: DEMO_APP_DATASET,
    demoDataset: DEMO_APP_DATASET,
    temporary: true,
    referencePrefix: DEMO_APP_REFERENCE_PREFIX,
    ...extra
  };
}

export function assertBidReadyTenderBuyerIsExternal(input: { buyerOrgId?: string | null; supplierOrgId?: string | null }) {
  if (!input.buyerOrgId || !input.supplierOrgId) {
    throw new Error('Bid-ready tender requires both buyer and supplier organization ids.');
  }

  if (input.buyerOrgId === input.supplierOrgId) {
    throw new Error('Bid-ready tender buyer organization must be different from the demo supplier organization.');
  }
}

function ref(suffix: string) {
  return `${DEMO_APP_REFERENCE_PREFIX}-${suffix}`;
}

function fixedDate(isoDate: string, hour = 9) {
  const date = new Date(`${isoDate}T${String(hour).padStart(2, '0')}:00:00.000Z`);
  return date;
}

function hash(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

async function deleteByPayloadDataset(db: AnyDb, model: string) {
  await db[model].deleteMany({ where: { payload: { path: ['dataset'], equals: DEMO_APP_DATASET } } });
}

async function deleteByMetadataDataset(db: AnyDb, model: string) {
  await db[model].deleteMany({ where: { metadata: { path: ['dataset'], equals: DEMO_APP_DATASET } } });
}

async function resolveDemoActor(db: AnyDb): Promise<DemoActor> {
  const membership = await db.organizationMember.findFirst({
    where: {
      user: { email: DEMO_APP_USER_EMAIL },
      status: 'ACTIVE',
      isDefault: true
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          displayName: true,
          accountType: true,
          verificationStatus: true
        }
      },
      organization: {
        select: {
          id: true,
          name: true
        }
      }
    }
  });

  if (!membership?.user || !membership?.organization) {
    throw new Error(`Base demo account not found. Run npm run db:seed first, then rerun npm run db:seed:demo-app-data.`);
  }

  assertBaseDemoUser(membership.user);

  const capabilities = await db.organizationCapability.findMany({
    where: { organizationId: membership.organization.id, enabled: true },
    select: { capability: true }
  });
  const capabilitySet = new Set(capabilities.map((item: { capability: OrganizationCapabilityName }) => item.capability));
  for (const capability of [OrganizationCapabilityName.BUYER, OrganizationCapabilityName.SUPPLIER]) {
    if (!capabilitySet.has(capability)) {
      throw new Error(`Base demo organization is missing ${capability}. Run npm run db:seed first.`);
    }
  }

  return { user: membership.user, organization: membership.organization };
}

export async function cleanupDemoAppData(db: AnyDb) {
  const tenders = await db.tender.findMany({
    where: {
      OR: [
        { reference: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { metadata: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    },
    select: { id: true }
  });
  const tenderIds = tenders.map((item: { id: string }) => item.id);

  const bids = await db.bid.findMany({
    where: {
      OR: [
        { reference: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { payload: { path: ['dataset'], equals: DEMO_APP_DATASET } },
        ...(tenderIds.length ? [{ tenderId: { in: tenderIds } }] : [])
      ]
    },
    select: { id: true }
  });
  const bidIds = bids.map((item: { id: string }) => item.id);

  const contracts = await db.contract.findMany({
    where: {
      OR: [
        { reference: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { payload: { path: ['dataset'], equals: DEMO_APP_DATASET } },
        ...(tenderIds.length ? [{ tenderId: { in: tenderIds } }] : [])
      ]
    },
    select: { id: true }
  });
  const contractIds = contracts.map((item: { id: string }) => item.id);

  const supportTickets = await db.supportTicket.findMany({
    where: {
      OR: [
        { subject: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { payload: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    },
    select: { id: true }
  });
  const supportTicketIds = supportTickets.map((item: { id: string }) => item.id);

  const communications = await db.communicationItem.findMany({
    where: {
      OR: [
        { subject: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { payload: { path: ['dataset'], equals: DEMO_APP_DATASET } },
        ...(tenderIds.length ? [{ tenderId: { in: tenderIds } }] : [])
      ]
    },
    select: { id: true }
  });
  const communicationIds = communications.map((item: { id: string }) => item.id);

  if (supportTicketIds.length) {
    await db.supportTicketComment.deleteMany({ where: { ticketId: { in: supportTicketIds } } });
  }
  if (communicationIds.length) {
    await db.communicationAttachment.deleteMany({ where: { communicationItemId: { in: communicationIds } } });
  }

  await deleteByPayloadDataset(db, 'integrationEvent');
  await deleteByPayloadDataset(db, 'integrationSyncRun');
  await db.externalSystem.deleteMany({
    where: {
      OR: [
        { name: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { config: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    }
  });
  await deleteByPayloadDataset(db, 'supplierMatchSignal');
  await deleteByPayloadDataset(db, 'priceBenchmark');
  await deleteByPayloadDataset(db, 'marketSnapshot');
  await deleteByPayloadDataset(db, 'recordEntry');
  await deleteByPayloadDataset(db, 'auditEvent');
  await deleteByPayloadDataset(db, 'communicationItem');
  await deleteByPayloadDataset(db, 'supportTicket');
  await deleteByPayloadDataset(db, 'paymentConfirmation');
  await deleteByPayloadDataset(db, 'paymentApproval');
  await deleteByPayloadDataset(db, 'threeWayMatchResult');
  await db.invoice.deleteMany({
    where: {
      OR: [
        { reference: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { payload: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    }
  });
  await db.purchaseOrder.deleteMany({
    where: {
      OR: [
        { reference: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { payload: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    }
  });
  await db.budgetCommitment.deleteMany({
    where: {
      OR: [
        { commitmentNo: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { payload: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    }
  });

  await deleteByPayloadDataset(db, 'sampleDisposition');
  await deleteByPayloadDataset(db, 'sampleTest');
  await deleteByPayloadDataset(db, 'sampleEvaluation');
  await deleteByPayloadDataset(db, 'sampleVerification');
  await deleteByPayloadDataset(db, 'sampleCustodyLog');
  await deleteByPayloadDataset(db, 'sampleReceipt');
  await deleteByPayloadDataset(db, 'performanceScore');

  if (contractIds.length) {
    await db.contract.deleteMany({ where: { id: { in: contractIds } } });
  }
  if (bidIds.length) {
    await db.bid.deleteMany({ where: { id: { in: bidIds } } });
  }
  if (tenderIds.length) {
    await db.tender.deleteMany({ where: { id: { in: tenderIds } } });
  }

  await db.procurementPlanLine.deleteMany({ where: { metadata: { path: ['dataset'], equals: DEMO_APP_DATASET } } });
  await db.procurementPlan.deleteMany({
    where: {
      OR: [
        { name: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { metadata: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    }
  });

  await db.officialDocumentVersion.deleteMany({ where: { metadata: { path: ['dataset'], equals: DEMO_APP_DATASET } } });
  await db.officialDocumentTemplate.deleteMany({
    where: {
      OR: [
        { code: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { metadata: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    }
  });
  await db.moduleRegistry.deleteMany({
    where: {
      OR: [
        { name: { startsWith: `${DEMO_APP_REFERENCE_PREFIX} ` } },
        { payload: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    }
  });
  await deleteByMetadataDataset(db, 'documentObject');
  await db.registryRecord.deleteMany({
    where: {
      OR: [
        { registryNumber: { startsWith: DEMO_APP_REFERENCE_PREFIX } },
        { payload: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    }
  });
  await db.organization.deleteMany({
    where: {
      OR: [
        { name: DEMO_APP_BID_READY_BUYER_ORG_NAME },
        { metadata: { path: ['dataset'], equals: DEMO_APP_DATASET } }
      ]
    }
  });
}

async function createDocument(db: AnyDb, actor: DemoActor, key: string, name: string, documentType: string) {
  const objectKey = `${DEMO_APP_DATASET}/${key}`;
  return db.documentObject.upsert({
    where: { objectKey },
    update: {
      ownerOrgId: actor.organization.id,
      uploadedByUserId: actor.user.id,
      name,
      documentType,
      checksum: hash(objectKey),
      metadata: demoAppPayload({ objectKey, storage: 'temporary-seed' })
    },
    create: {
      ownerOrgId: actor.organization.id,
      uploadedByUserId: actor.user.id,
      name,
      objectKey,
      documentType,
      checksum: hash(objectKey),
      metadata: demoAppPayload({ objectKey, storage: 'temporary-seed' })
    }
  });
}

async function ensureBidReadyBuyerOrganization(db: AnyDb) {
  const organization = await db.organization.upsert({
    where: { name: DEMO_APP_BID_READY_BUYER_ORG_NAME },
    update: {
      kind: OrganizationKind.COMPANY,
      taxId: 'PX-DEMO-APP-BUYER-TIN',
      country: 'TZ',
      metadata: demoAppPayload({
        role: 'external-buyer',
        publicName: 'ProcureX Temporary Buyer Authority',
        safeForDemoSupplierBidding: true
      })
    },
    create: {
      name: DEMO_APP_BID_READY_BUYER_ORG_NAME,
      kind: OrganizationKind.COMPANY,
      taxId: 'PX-DEMO-APP-BUYER-TIN',
      country: 'TZ',
      metadata: demoAppPayload({
        role: 'external-buyer',
        publicName: 'ProcureX Temporary Buyer Authority',
        safeForDemoSupplierBidding: true
      })
    }
  });

  await db.organizationCapability.upsert({
    where: { organizationId_capability: { organizationId: organization.id, capability: OrganizationCapabilityName.BUYER } },
    update: { enabled: true },
    create: { organizationId: organization.id, capability: OrganizationCapabilityName.BUYER, enabled: true }
  });

  await db.buyerProfile.upsert({
    where: { organizationId: organization.id },
    update: {
      procuringType: 'Temporary external demo buyer',
      budgetCode: 'PX-DEMO-APP-BUYER-BUDGET',
      payload: demoAppPayload({ role: 'buyer-profile', canReceiveDemoBids: true })
    },
    create: {
      organizationId: organization.id,
      procuringType: 'Temporary external demo buyer',
      budgetCode: 'PX-DEMO-APP-BUYER-BUDGET',
      payload: demoAppPayload({ role: 'buyer-profile', canReceiveDemoBids: true })
    }
  });

  return organization;
}

async function seedWorkspace(db: AnyDb, actor: DemoActor) {
  const modules = [
    ['Dashboard', 'workspace-dashboard', '/dashboard'],
    ['Procurement', 'procurement', '/procurement'],
    ['Bidding', 'bidding', '/bidding'],
    ['Evaluation', 'evaluation', '/evaluation'],
    ['Awards & Contracts', 'awards-contracts', '/awards-contracts'],
    ['Post-Award', 'post-award', '/post-award'],
    ['Finance', 'financial', '/post-award'],
    ['Documents', 'documents', '/documents'],
    ['Communication', 'communication', '/communication'],
    ['Records', 'records', '/records'],
    ['Support', 'support', '/support'],
    ['Help Centre', 'help-centre', '/help']
  ];

  for (const [label, key, route] of modules) {
    await db.moduleRegistry.upsert({
      where: { name: `${DEMO_APP_REFERENCE_PREFIX} ${label}` },
      update: {
        status: 'Available',
        version: 'temporary-demo',
        payload: demoAppPayload({ key, route, userFacing: true })
      },
      create: {
        name: `${DEMO_APP_REFERENCE_PREFIX} ${label}`,
        status: 'Available',
        version: 'temporary-demo',
        payload: demoAppPayload({ key, route, userFacing: true })
      }
    });
  }

  await db.notification.createMany({
    data: [
      {
        ownerOrgId: actor.organization.id,
        userId: actor.user.id,
        title: `${DEMO_APP_REFERENCE_PREFIX} Bid deadline reminder`,
        body: 'Temporary Demo App Data: submit the remaining financial schedule before closing.',
        status: 'UNREAD',
        payload: demoAppPayload({ module: 'workspace', actionRoute: '/bidding' }),
        createdAt: fixedDate('2026-07-12', 7)
      },
      {
        ownerOrgId: actor.organization.id,
        userId: actor.user.id,
        title: `${DEMO_APP_REFERENCE_PREFIX} Evaluation score draft saved`,
        body: 'Temporary Demo App Data: technical evaluation scoring is ready for review.',
        status: 'READ',
        readAt: fixedDate('2026-07-12', 11),
        payload: demoAppPayload({ module: 'evaluation', actionRoute: '/evaluation' }),
        createdAt: fixedDate('2026-07-12', 8)
      },
      {
        ownerOrgId: actor.organization.id,
        userId: actor.user.id,
        title: `${DEMO_APP_REFERENCE_PREFIX} Supplier support response waiting`,
        body: 'Temporary Demo App Data: a support ticket is waiting for the demo user.',
        status: 'UNREAD',
        payload: demoAppPayload({ module: 'support', actionRoute: '/support' }),
        createdAt: fixedDate('2026-07-12', 9)
      }
    ]
  });
}

async function seedProcurement(db: AnyDb, actor: DemoActor, docs: Record<string, any>) {
  const bidReadyBuyerOrg = await ensureBidReadyBuyerOrganization(db);
  assertBidReadyTenderBuyerIsExternal({ buyerOrgId: bidReadyBuyerOrg.id, supplierOrgId: actor.organization.id });

  const plan = await db.procurementPlan.upsert({
    where: {
      ownerOrgId_financialYear_name: {
        ownerOrgId: actor.organization.id,
        financialYear: '2026/2027',
        name: `${DEMO_APP_REFERENCE_PREFIX} Temporary Demo App Procurement Plan`
      }
    },
    update: {
      status: 'APPROVED',
      source: 'temporary-demo-seed',
      currency: 'TZS',
      metadata: demoAppPayload({ module: 'procurement', approval: 'demo-approved', totalBudget: 485_000_000 })
    },
    create: {
      ownerOrgId: actor.organization.id,
      financialYear: '2026/2027',
      name: `${DEMO_APP_REFERENCE_PREFIX} Temporary Demo App Procurement Plan`,
      status: 'APPROVED',
      source: 'temporary-demo-seed',
      currency: 'TZS',
      metadata: demoAppPayload({ module: 'procurement', approval: 'demo-approved', totalBudget: 485_000_000 })
    }
  });

  const tenderBase = {
    buyerOrgId: actor.organization.id,
    ownerUserId: actor.user.id,
    method: ProcurementMethod.OPEN_TENDER,
    visibility: Visibility.PUBLIC_MARKETPLACE,
    currency: 'TZS',
    location: 'Dar es Salaam, Tanzania',
    contractType: ContractType.LUMP_SUM,
    metadata: demoAppPayload({ module: 'procurement' })
  };

  const draftTender = await db.tender.upsert({
    where: { reference: ref('TENDER-DRAFT-001') },
    update: {
      ...tenderBase,
      title: 'Temporary Demo App Draft ICT Equipment Tender',
      type: TenderType.GOODS,
      description: 'Draft tender used to show incomplete tender creation steps, missing approvals, and editable line items.',
      status: TenderStatus.DRAFT,
      budget: 85_000_000,
      closingDate: fixedDate('2026-08-25', 12),
      requirements: demoAppPayload({ requiredSections: ['eligibility', 'technical', 'financial'], draftCompleteness: 62 })
    },
    create: {
      ...tenderBase,
      reference: ref('TENDER-DRAFT-001'),
      title: 'Temporary Demo App Draft ICT Equipment Tender',
      type: TenderType.GOODS,
      description: 'Draft tender used to show incomplete tender creation steps, missing approvals, and editable line items.',
      status: TenderStatus.DRAFT,
      budget: 85_000_000,
      closingDate: fixedDate('2026-08-25', 12),
      requirements: demoAppPayload({ requiredSections: ['eligibility', 'technical', 'financial'], draftCompleteness: 62 })
    }
  });

  const openTender = await db.tender.upsert({
    where: { reference: ref('TENDER-OPEN-001') },
    update: {
      ...tenderBase,
      title: 'Temporary Demo App Open Marketplace Tender',
      type: TenderType.SERVICE,
      description: 'Published marketplace tender with requirements, milestones, documents, amendments, and supplier interest.',
      status: TenderStatus.OPEN,
      budget: 240_000_000,
      publishedAt: fixedDate('2026-07-10', 8),
      closingDate: fixedDate('2026-08-05', 14),
      requirements: demoAppPayload({ eligibility: ['valid TIN', 'current business license'], envelopes: ['technical', 'financial'] })
    },
    create: {
      ...tenderBase,
      reference: ref('TENDER-OPEN-001'),
      title: 'Temporary Demo App Open Marketplace Tender',
      type: TenderType.SERVICE,
      description: 'Published marketplace tender with requirements, milestones, documents, amendments, and supplier interest.',
      status: TenderStatus.OPEN,
      budget: 240_000_000,
      publishedAt: fixedDate('2026-07-10', 8),
      closingDate: fixedDate('2026-08-05', 14),
      requirements: demoAppPayload({ eligibility: ['valid TIN', 'current business license'], envelopes: ['technical', 'financial'] })
    }
  });

  const reviewTender = await db.tender.upsert({
    where: { reference: ref('TENDER-REVIEW-001') },
    update: {
      ...tenderBase,
      title: 'Temporary Demo App Tender Under Review',
      type: TenderType.WORKS,
      description: 'Tender package under internal review before publication.',
      status: TenderStatus.REVIEW,
      budget: 160_000_000,
      closingDate: fixedDate('2026-08-18', 13),
      requirements: demoAppPayload({ reviewChecklist: ['budget confirmed', 'specification review pending', 'legal clearance pending'] })
    },
    create: {
      ...tenderBase,
      reference: ref('TENDER-REVIEW-001'),
      title: 'Temporary Demo App Tender Under Review',
      type: TenderType.WORKS,
      description: 'Tender package under internal review before publication.',
      status: TenderStatus.REVIEW,
      budget: 160_000_000,
      closingDate: fixedDate('2026-08-18', 13),
      requirements: demoAppPayload({ reviewChecklist: ['budget confirmed', 'specification review pending', 'legal clearance pending'] })
    }
  });

  const evaluationTender = await db.tender.upsert({
    where: { reference: ref('TENDER-EVAL-001') },
    update: {
      ...tenderBase,
      title: 'Temporary Demo App Evaluation Tender',
      type: TenderType.CONSULTANCY,
      description: 'Closed tender with submitted bids, evaluation scores, and award handoff records.',
      status: TenderStatus.EVALUATION,
      budget: 155_000_000,
      publishedAt: fixedDate('2026-06-01', 8),
      closingDate: fixedDate('2026-07-01', 14),
      requirements: demoAppPayload({ evaluationMethod: 'quality-cost based selection', technicalThreshold: 75 })
    },
    create: {
      ...tenderBase,
      reference: ref('TENDER-EVAL-001'),
      title: 'Temporary Demo App Evaluation Tender',
      type: TenderType.CONSULTANCY,
      description: 'Closed tender with submitted bids, evaluation scores, and award handoff records.',
      status: TenderStatus.EVALUATION,
      budget: 155_000_000,
      publishedAt: fixedDate('2026-06-01', 8),
      closingDate: fixedDate('2026-07-01', 14),
      requirements: demoAppPayload({ evaluationMethod: 'quality-cost based selection', technicalThreshold: 75 })
    }
  });

  const bidReadyTender = await db.tender.upsert({
    where: { reference: DEMO_APP_BID_READY_TENDER_REFERENCE },
    update: {
      buyerOrgId: bidReadyBuyerOrg.id,
      ownerUserId: null,
      title: 'Temporary Demo App Bid-Ready Office Supplies Tender',
      type: TenderType.GOODS,
      description:
        'A complete public marketplace opportunity for office paper, toner, filing materials, and delivery services. This tender is owned by a separate temporary buyer so demo@procurex.tz can bid on it as a supplier.',
      status: TenderStatus.OPEN,
      method: ProcurementMethod.OPEN_TENDER,
      visibility: Visibility.PUBLIC_MARKETPLACE,
      budget: 72_500_000,
      currency: 'TZS',
      location: 'Dodoma and Dar es Salaam, Tanzania',
      contractType: ContractType.UNIT_PRICE,
      publishedAt: fixedDate('2026-07-19', 8),
      closingDate: fixedDate('2026-09-15', 14),
      requirements: demoAppPayload({
        bidReady: true,
        envelopes: ['administrative', 'technical', 'financial'],
        eligibility: ['valid business registration', 'TIN certificate', 'tax clearance', 'delivery capacity statement'],
        samplesRequired: false,
        canBeBidByDemoUser: true
      }),
      metadata: demoAppPayload({
        module: 'procurement',
        bidReady: true,
        buyerOrganizationName: bidReadyBuyerOrg.name,
        supplierOrganizationName: actor.organization.name,
        publication: { openingDate: '2026-07-19T00:00:00.000Z' },
        marketplace: {
          category: 'Office supplies',
          keywords: ['office supplies', 'paper', 'toner', 'stationery', 'delivery'],
          recommendationReason: 'Strong match for demo supplier profile and low-risk office supply category.'
        }
      })
    },
    create: {
      reference: DEMO_APP_BID_READY_TENDER_REFERENCE,
      buyerOrgId: bidReadyBuyerOrg.id,
      ownerUserId: null,
      title: 'Temporary Demo App Bid-Ready Office Supplies Tender',
      type: TenderType.GOODS,
      description:
        'A complete public marketplace opportunity for office paper, toner, filing materials, and delivery services. This tender is owned by a separate temporary buyer so demo@procurex.tz can bid on it as a supplier.',
      status: TenderStatus.OPEN,
      method: ProcurementMethod.OPEN_TENDER,
      visibility: Visibility.PUBLIC_MARKETPLACE,
      budget: 72_500_000,
      currency: 'TZS',
      location: 'Dodoma and Dar es Salaam, Tanzania',
      contractType: ContractType.UNIT_PRICE,
      publishedAt: fixedDate('2026-07-19', 8),
      closingDate: fixedDate('2026-09-15', 14),
      requirements: demoAppPayload({
        bidReady: true,
        envelopes: ['administrative', 'technical', 'financial'],
        eligibility: ['valid business registration', 'TIN certificate', 'tax clearance', 'delivery capacity statement'],
        samplesRequired: false,
        canBeBidByDemoUser: true
      }),
      metadata: demoAppPayload({
        module: 'procurement',
        bidReady: true,
        buyerOrganizationName: bidReadyBuyerOrg.name,
        supplierOrganizationName: actor.organization.name,
        publication: { openingDate: '2026-07-19T00:00:00.000Z' },
        marketplace: {
          category: 'Office supplies',
          keywords: ['office supplies', 'paper', 'toner', 'stationery', 'delivery'],
          recommendationReason: 'Strong match for demo supplier profile and low-risk office supply category.'
        }
      })
    }
  });

  await db.procurementPlanLine.createMany({
    data: [
      {
        planId: plan.id,
        tenderId: draftTender.id,
        tenderTitle: draftTender.title,
        category: 'ICT equipment',
        procurementMethod: 'OPEN_TENDER',
        sourceOfFunds: 'Development budget',
        budget: 85_000_000,
        openingDate: fixedDate('2026-08-01', 9),
        closingDate: fixedDate('2026-08-25', 12),
        expectedCompletionDate: fixedDate('2026-09-15', 9),
        status: 'DRAFT',
        planState: 'Drafting',
        metadata: demoAppPayload({ lineType: 'draft' })
      },
      {
        planId: plan.id,
        tenderId: openTender.id,
        tenderTitle: openTender.title,
        category: 'Facilities services',
        procurementMethod: 'OPEN_TENDER',
        sourceOfFunds: 'Operational budget',
        budget: 240_000_000,
        openingDate: fixedDate('2026-07-10', 9),
        closingDate: fixedDate('2026-08-05', 14),
        expectedCompletionDate: fixedDate('2026-08-20', 9),
        status: 'PUBLISHED',
        planState: 'In progress',
        metadata: demoAppPayload({ lineType: 'marketplace' })
      }
    ]
  });

  for (const [tender, categoryName] of [
    [draftTender, 'Temporary Demo App ICT Equipment Category'],
    [openTender, 'Temporary Demo App Facilities Services Category'],
    [reviewTender, 'Temporary Demo App Works Review Category'],
    [evaluationTender, 'Temporary Demo App Consultancy Evaluation Category'],
    [bidReadyTender, 'Temporary Demo App Bid-Ready Office Supplies Category']
  ]) {
    await db.tenderCategory.upsert({
      where: { tenderId_name: { tenderId: tender.id, name: categoryName } },
      update: { type: tender.type },
      create: { tenderId: tender.id, name: categoryName, type: tender.type }
    });
  }

  await db.tenderCategory.upsert({
    where: { tenderId_name: { tenderId: bidReadyTender.id, name: 'Office supplies' } },
    update: { type: TenderType.GOODS },
    create: { tenderId: bidReadyTender.id, name: 'Office supplies', type: TenderType.GOODS }
  });

  await db.tenderRequirement.createMany({
    data: [
      { tenderId: openTender.id, section: 'Eligibility', payload: demoAppPayload({ key: 'valid-registration', description: 'Supplier must submit valid registration documents.', mandatory: true, evidence: 'BRELA extract' }) },
      { tenderId: openTender.id, section: 'Technical', payload: demoAppPayload({ key: 'service-methodology', description: 'Supplier must provide a detailed service methodology.', mandatory: true, scored: true }) },
      { tenderId: evaluationTender.id, section: 'Technical', payload: demoAppPayload({ key: 'consultant-team', description: 'Lead consultant qualifications and staffing plan.', mandatory: true, scored: true }) },
      { tenderId: reviewTender.id, section: 'Review', payload: demoAppPayload({ key: 'site-visit-plan', description: 'Site visit arrangements awaiting review.', mandatory: false, reviewer: 'legal' }) },
      { tenderId: bidReadyTender.id, section: 'Administrative', payload: demoAppPayload({ key: 'business-registration', description: 'Upload current business registration, TIN, and tax clearance documents.', mandatory: true, envelope: 'administrative' }) },
      { tenderId: bidReadyTender.id, section: 'Technical', payload: demoAppPayload({ key: 'delivery-capacity', description: 'Describe stock availability, delivery fleet, delivery timetable, and quality-control process.', mandatory: true, envelope: 'technical', scored: true }) },
      { tenderId: bidReadyTender.id, section: 'Financial', payload: demoAppPayload({ key: 'priced-boq', description: 'Complete all commercial line rates and totals for the listed office supplies.', mandatory: true, envelope: 'financial' }) }
    ]
  });

  await db.tenderMilestone.createMany({
    data: [
      { tenderId: openTender.id, name: 'Clarification window closes', dueDate: fixedDate('2026-07-25', 14), payload: demoAppPayload({ milestoneType: 'clarification' }) },
      { tenderId: openTender.id, name: 'Tender closes', dueDate: fixedDate('2026-08-05', 14), payload: demoAppPayload({ milestoneType: 'closing' }) },
      { tenderId: evaluationTender.id, name: 'Technical scores locked', dueDate: fixedDate('2026-07-18', 14), payload: demoAppPayload({ milestoneType: 'evaluation' }) },
      { tenderId: bidReadyTender.id, name: 'Bid-ready tender clarification deadline', dueDate: fixedDate('2026-08-20', 14), payload: demoAppPayload({ milestoneType: 'clarification', bidReady: true }) },
      { tenderId: bidReadyTender.id, name: 'Bid-ready tender submission deadline', dueDate: fixedDate('2026-09-15', 14), payload: demoAppPayload({ milestoneType: 'closing', bidReady: true }) }
    ]
  });

  await db.tenderCommercialItem.createMany({
    data: [
      { tenderId: openTender.id, itemNo: '1', description: 'Facility maintenance monthly service', quantity: 12, unit: 'month', rate: 18_000_000, total: 216_000_000, payload: demoAppPayload({ priceBasis: 'monthly' }) },
      { tenderId: openTender.id, itemNo: '2', description: 'Transition and mobilization allowance', quantity: 1, unit: 'lot', rate: 24_000_000, total: 24_000_000, payload: demoAppPayload({ priceBasis: 'lump-sum' }) },
      { tenderId: draftTender.id, itemNo: '1', description: 'Laptop computer package', quantity: 30, unit: 'unit', rate: 2_500_000, total: 75_000_000, payload: demoAppPayload({ draft: true }) },
      { tenderId: bidReadyTender.id, itemNo: '1', description: 'A4 multipurpose paper, 80gsm, carton of 5 reams', quantity: 1_200, unit: 'carton', rate: 28_000, total: 33_600_000, payload: demoAppPayload({ bidReady: true, priceBasis: 'unit-rate' }) },
      { tenderId: bidReadyTender.id, itemNo: '2', description: 'Laser printer toner cartridge, assorted models', quantity: 220, unit: 'unit', rate: 95_000, total: 20_900_000, payload: demoAppPayload({ bidReady: true, priceBasis: 'unit-rate' }) },
      { tenderId: bidReadyTender.id, itemNo: '3', description: 'Box files and archive folders', quantity: 1_000, unit: 'unit', rate: 9_500, total: 9_500_000, payload: demoAppPayload({ bidReady: true, priceBasis: 'unit-rate' }) },
      { tenderId: bidReadyTender.id, itemNo: '4', description: 'Scheduled delivery to Dodoma and Dar es Salaam offices', quantity: 10, unit: 'trip', rate: 850_000, total: 8_500_000, payload: demoAppPayload({ bidReady: true, priceBasis: 'delivery' }) }
    ]
  });

  for (const [tender, document] of [
    [openTender, docs.tender],
    [openTender, docs.requirements],
    [bidReadyTender, docs.tender],
    [bidReadyTender, docs.requirements],
    [evaluationTender, docs.evaluation],
    [draftTender, docs.draftTender]
  ]) {
    await db.tenderDocument.upsert({
      where: { tenderId_documentId: { tenderId: tender.id, documentId: document.id } },
      update: { label: 'Temporary Demo App linked document' },
      create: { tenderId: tender.id, documentId: document.id, label: 'Temporary Demo App linked document' }
    });
  }

  await db.tenderAmendment.upsert({
    where: { reference: ref('AMD-OPEN-001') },
    update: {
      tenderId: openTender.id,
      buyerOrgId: actor.organization.id,
      createdByUserId: actor.user.id,
      title: 'Temporary Demo App Clarification Amendment',
      summary: 'Extends the site visit response deadline and updates the billing schedule.',
      status: TenderAmendmentStatus.PUBLISHED,
      payload: demoAppPayload({ changedSections: ['milestones', 'commercial items'] }),
      publishedAt: fixedDate('2026-07-16', 10)
    },
    create: {
      tenderId: openTender.id,
      buyerOrgId: actor.organization.id,
      createdByUserId: actor.user.id,
      reference: ref('AMD-OPEN-001'),
      title: 'Temporary Demo App Clarification Amendment',
      summary: 'Extends the site visit response deadline and updates the billing schedule.',
      status: TenderAmendmentStatus.PUBLISHED,
      payload: demoAppPayload({ changedSections: ['milestones', 'commercial items'] }),
      publishedAt: fixedDate('2026-07-16', 10)
    }
  });

  await db.savedTender.upsert({
    where: { tenderId_organizationId: { tenderId: openTender.id, organizationId: actor.organization.id } },
    update: {},
    create: { tenderId: openTender.id, organizationId: actor.organization.id }
  });
  await db.savedTender.upsert({
    where: { tenderId_organizationId: { tenderId: bidReadyTender.id, organizationId: actor.organization.id } },
    update: {},
    create: { tenderId: bidReadyTender.id, organizationId: actor.organization.id }
  });

  return { draftTender, openTender, reviewTender, evaluationTender, bidReadyTender };
}

async function seedBidding(db: AnyDb, actor: DemoActor, tenders: Record<string, any>, docs: Record<string, any>) {
  const draftBid = await db.bid.upsert({
    where: { reference: ref('BID-DRAFT-001') },
    update: {
      tenderId: tenders.openTender.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      submittedByUserId: actor.user.id,
      status: BidStatus.DRAFT,
      totalAmount: 232_500_000,
      currency: 'TZS',
      payload: demoAppPayload({ module: 'bidding', completeness: 58, nextStep: 'Upload financial schedule' })
    },
    create: {
      tenderId: tenders.openTender.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      submittedByUserId: actor.user.id,
      reference: ref('BID-DRAFT-001'),
      status: BidStatus.DRAFT,
      totalAmount: 232_500_000,
      currency: 'TZS',
      payload: demoAppPayload({ module: 'bidding', completeness: 58, nextStep: 'Upload financial schedule' })
    }
  });

  const submittedBid = await db.bid.upsert({
    where: { reference: ref('BID-SUBMITTED-001') },
    update: {
      tenderId: tenders.evaluationTender.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      submittedByUserId: actor.user.id,
      status: BidStatus.UNDER_EVALUATION,
      submittedAt: fixedDate('2026-06-28', 13),
      totalAmount: 148_750_000,
      currency: 'TZS',
      payload: demoAppPayload({ module: 'bidding', receiptReady: true, sampleRequired: true })
    },
    create: {
      tenderId: tenders.evaluationTender.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      submittedByUserId: actor.user.id,
      reference: ref('BID-SUBMITTED-001'),
      status: BidStatus.UNDER_EVALUATION,
      submittedAt: fixedDate('2026-06-28', 13),
      totalAmount: 148_750_000,
      currency: 'TZS',
      payload: demoAppPayload({ module: 'bidding', receiptReady: true, sampleRequired: true })
    }
  });

  for (const bid of [draftBid, submittedBid]) {
    await db.bidVersion.createMany({
      data: [
        { bidId: bid.id, versionNo: 1, envelope: EnvelopeType.TECHNICAL, sealedHash: hash(`${bid.reference}:technical`), payload: demoAppPayload({ envelope: 'technical' }) },
        { bidId: bid.id, versionNo: 1, envelope: EnvelopeType.FINANCIAL, sealedHash: hash(`${bid.reference}:financial`), payload: demoAppPayload({ envelope: 'financial' }) }
      ]
    });

    await db.bidResponse.createMany({
      data: [
        { bidId: bid.id, requirementKey: 'valid-registration', response: demoAppPayload({ answer: 'Compliant', evidenceDocumentId: docs.bidTechnical.id }) },
        { bidId: bid.id, requirementKey: 'service-methodology', response: demoAppPayload({ answer: 'Methodology uploaded', pages: 18 }) }
      ]
    });
  }

  for (const [bid, document, envelope] of [
    [draftBid, docs.bidTechnical, EnvelopeType.TECHNICAL],
    [submittedBid, docs.bidTechnical, EnvelopeType.TECHNICAL],
    [submittedBid, docs.bidFinancial, EnvelopeType.FINANCIAL]
  ]) {
    await db.bidDocument.upsert({
      where: { bidId_documentId: { bidId: bid.id, documentId: document.id } },
      update: { envelope, reviewStatus: DocumentReviewStatus.VERIFIED },
      create: { bidId: bid.id, documentId: document.id, envelope, reviewStatus: DocumentReviewStatus.VERIFIED }
    });
  }

  await db.bidReceipt.upsert({
    where: { bidId: submittedBid.id },
    update: {
      receiptRef: ref('RECEIPT-BID-001'),
      receiptHash: hash(ref('RECEIPT-BID-001'))
    },
    create: {
      bidId: submittedBid.id,
      receiptRef: ref('RECEIPT-BID-001'),
      receiptHash: hash(ref('RECEIPT-BID-001'))
    }
  });

  const sample = await db.bidSample.create({
    data: {
      bidId: submittedBid.id,
      tenderId: tenders.evaluationTender.id,
      supplierOrgId: actor.organization.id,
      sampleName: 'Temporary Demo App Consultancy Approach Sample',
      relatedItem: 'Technical methodology demonstration',
      quantity: 1,
      deliveryLocation: 'ProcureX Demo Registry Desk',
      deliveryDeadline: fixedDate('2026-07-03', 12),
      trackingStatus: BidSampleStatus.ACCEPTED,
      courier: 'Demo Courier',
      trackingNumber: ref('SAMPLE-TRACK-001'),
      submittedAt: fixedDate('2026-06-29', 10),
      receivedAt: fixedDate('2026-07-02', 10),
      inspectedAt: fixedDate('2026-07-03', 11),
      inspectionNotes: 'Accepted for temporary demo evaluation.',
      metadata: demoAppPayload({ module: 'samples' })
    }
  });

  await db.sampleReceipt.create({
    data: {
      bidSampleId: sample.id,
      tenderId: tenders.evaluationTender.id,
      bidId: submittedBid.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      sampleReference: ref('SAMPLE-RECEIPT-001'),
      receivedQuantity: 1,
      conditionAtReceipt: 'Complete',
      packagingCondition: 'Sealed',
      deliveryRepresentative: actor.user.displayName,
      receivingOfficerId: actor.user.id,
      storageLocation: 'Temporary demo sample shelf',
      remarks: 'Temporary Demo App Data receipt.',
      status: 'RECEIVED',
      receivedAt: fixedDate('2026-07-02', 10),
      payload: demoAppPayload({ module: 'sample-receipt' })
    }
  });

  await db.sampleVerification.create({
    data: {
      bidSampleId: sample.id,
      tenderId: tenders.evaluationTender.id,
      bidId: submittedBid.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      result: 'ACCEPTED',
      quantityAccepted: true,
      certificatesAttached: true,
      packagingAccepted: true,
      matchesBid: true,
      completeUndamaged: true,
      verifiedByUserId: actor.user.id,
      verifiedAt: fixedDate('2026-07-03', 11),
      note: 'Temporary Demo App Data sample verification passed.',
      payload: demoAppPayload({ module: 'sample-verification' })
    }
  });

  return { draftBid, submittedBid, sample };
}

async function seedEvaluationAndAward(db: AnyDb, actor: DemoActor, tenders: Record<string, any>, bid: any, docs: Record<string, any>) {
  const workspace = await db.evaluationWorkspace.upsert({
    where: { tenderId: tenders.evaluationTender.id },
    update: {
      buyerOrgId: actor.organization.id,
      status: EvaluationStatus.COMPLETED,
      currentStage: EvaluationStage.RECOMMENDATION,
      progress: 100,
      payload: demoAppPayload({ module: 'evaluation', recommendationReady: true })
    },
    create: {
      tenderId: tenders.evaluationTender.id,
      buyerOrgId: actor.organization.id,
      status: EvaluationStatus.COMPLETED,
      currentStage: EvaluationStage.RECOMMENDATION,
      progress: 100,
      payload: demoAppPayload({ module: 'evaluation', recommendationReady: true })
    }
  });

  await db.workflowAssignment.upsert({
    where: { workspaceId_userId_assignment: { workspaceId: workspace.id, userId: actor.user.id, assignment: WorkflowAssignmentType.EVALUATOR } },
    update: { status: 'ACTIVE', payload: demoAppPayload({ role: 'lead evaluator' }) },
    create: { workspaceId: workspace.id, userId: actor.user.id, assignment: WorkflowAssignmentType.EVALUATOR, status: 'ACTIVE', payload: demoAppPayload({ role: 'lead evaluator' }) }
  });

  const technical = await db.evaluationCriterion.create({
    data: {
      workspaceId: workspace.id,
      stage: EvaluationStage.TECHNICAL,
      name: 'Temporary Demo App Technical Approach',
      weight: 70,
      maxScore: 100,
      payload: demoAppPayload({ threshold: 75 })
    }
  });
  const financial = await db.evaluationCriterion.create({
    data: {
      workspaceId: workspace.id,
      stage: EvaluationStage.FINANCIAL,
      name: 'Temporary Demo App Financial Value',
      weight: 30,
      maxScore: 100,
      payload: demoAppPayload({ formula: 'lowest responsive price' })
    }
  });

  await db.evaluationScore.createMany({
    data: [
      { workspaceId: workspace.id, criterionId: technical.id, bidId: bid.id, evaluatorUserId: actor.user.id, score: 88.5, comment: 'Strong methodology and staffing plan.', lockedAt: fixedDate('2026-07-15', 10), payload: demoAppPayload({ draftSaved: true }) },
      { workspaceId: workspace.id, criterionId: financial.id, bidId: bid.id, evaluatorUserId: actor.user.id, score: 91, comment: 'Responsive financial offer within budget.', lockedAt: fixedDate('2026-07-15', 10), payload: demoAppPayload({ draftSaved: true }) }
    ]
  });

  const awardGroup = await db.awardGroup.upsert({
    where: { reference: ref('AWARD-GROUP-001') },
    update: {
      workspaceId: workspace.id,
      tenderId: tenders.evaluationTender.id,
      buyerOrgId: actor.organization.id,
      title: 'Temporary Demo App Award Group',
      status: 'SETTLED',
      settledAt: fixedDate('2026-07-16', 14),
      payload: demoAppPayload({ module: 'awards-contracts' })
    },
    create: {
      reference: ref('AWARD-GROUP-001'),
      workspaceId: workspace.id,
      tenderId: tenders.evaluationTender.id,
      buyerOrgId: actor.organization.id,
      title: 'Temporary Demo App Award Group',
      status: 'SETTLED',
      settledAt: fixedDate('2026-07-16', 14),
      payload: demoAppPayload({ module: 'awards-contracts' })
    }
  });

  const recommendation = await db.awardRecommendation.upsert({
    where: { reference: ref('REC-001') },
    update: {
      workspaceId: workspace.id,
      awardGroupId: awardGroup.id,
      bidId: bid.id,
      supplierOrgId: actor.organization.id,
      status: RecommendationStatus.APPROVED,
      amount: 148_750_000,
      currency: 'TZS',
      reason: 'Temporary Demo App Data recommendation after completed scoring.',
      payload: demoAppPayload({ handoff: 'contract-formation' })
    },
    create: {
      reference: ref('REC-001'),
      workspaceId: workspace.id,
      awardGroupId: awardGroup.id,
      bidId: bid.id,
      supplierOrgId: actor.organization.id,
      status: RecommendationStatus.APPROVED,
      amount: 148_750_000,
      currency: 'TZS',
      reason: 'Temporary Demo App Data recommendation after completed scoring.',
      payload: demoAppPayload({ handoff: 'contract-formation' })
    }
  });

  await db.approvalStep.create({
    data: {
      recommendationId: recommendation.id,
      actorUserId: actor.user.id,
      assignment: WorkflowAssignmentType.APPROVER,
      status: ApprovalStatus.APPROVED,
      action: 'APPROVE',
      decidedAt: fixedDate('2026-07-16', 15),
      payload: demoAppPayload({ step: 'head-of-procurement' })
    }
  });

  const route = await db.awardApprovalRoute.upsert({
    where: { recommendationId_routeKey: { recommendationId: recommendation.id, routeKey: 'demo-app-route' } },
    update: { title: 'Temporary Demo App Award Approval Route', status: 'APPROVED', currentStepOrder: 2, payload: demoAppPayload({ quorum: 1 }) },
    create: { recommendationId: recommendation.id, routeKey: 'demo-app-route', title: 'Temporary Demo App Award Approval Route', status: 'APPROVED', currentStepOrder: 2, requiredQuorum: 1, payload: demoAppPayload({ quorum: 1 }) }
  });
  await db.awardApprovalStep.upsert({
    where: { routeId_stepKey: { routeId: route.id, stepKey: 'finance-clearance' } },
    update: { recommendationId: recommendation.id, stepOrder: 1, role: 'Finance Reviewer', actorUserId: actor.user.id, status: ApprovalStatus.APPROVED, decidedAt: fixedDate('2026-07-16', 13), note: 'Budget confirmed for temporary demo.', payload: demoAppPayload({ route: 'award' }) },
    create: { routeId: route.id, recommendationId: recommendation.id, stepOrder: 1, stepKey: 'finance-clearance', role: 'Finance Reviewer', actorUserId: actor.user.id, status: ApprovalStatus.APPROVED, decidedAt: fixedDate('2026-07-16', 13), note: 'Budget confirmed for temporary demo.', payload: demoAppPayload({ route: 'award' }) }
  });

  const awardClause = await db.awardClause.upsert({
    where: { awardGroupId_clauseKey: { awardGroupId: awardGroup.id, clauseKey: 'demo-delivery' } },
    update: { title: 'Temporary Demo App Delivery Obligations', body: 'Supplier must deliver agreed outputs according to accepted milestones.', status: ContractLifecycleItemStatus.APPROVED, payload: demoAppPayload({ clause: 'delivery' }) },
    create: { awardGroupId: awardGroup.id, clauseKey: 'demo-delivery', title: 'Temporary Demo App Delivery Obligations', body: 'Supplier must deliver agreed outputs according to accepted milestones.', status: ContractLifecycleItemStatus.APPROVED, payload: demoAppPayload({ clause: 'delivery' }) }
  });

  await db.awardNegotiation.create({
    data: {
      awardGroupId: awardGroup.id,
      clauseId: awardClause.id,
      raisedByRole: 'supplier',
      raisedByOrgId: actor.organization.id,
      subject: 'Temporary Demo App mobilisation date alignment',
      position: 'Supplier requests two extra working days for mobilisation.',
      counterOffer: 'Buyer accepts one extra working day with no cost impact.',
      status: ContractLifecycleItemStatus.CLOSED,
      dueDate: fixedDate('2026-07-18', 12),
      payload: demoAppPayload({ resolved: true })
    }
  });

  await db.awardBidPack.create({
    data: {
      awardGroupId: awardGroup.id,
      documentId: docs.awardPack.id,
      status: 'GENERATED',
      checksum: hash(ref('AWARD-PACK-001')),
      payload: demoAppPayload({ packageType: 'award-handoff' })
    }
  });

  const notice = await db.awardNotice.upsert({
    where: { reference: ref('NOTICE-001') },
    update: {
      recommendationId: recommendation.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      issuedByUserId: actor.user.id,
      respondedByUserId: actor.user.id,
      status: AwardNoticeStatus.ACCEPTED,
      buyerNote: 'Temporary Demo App Data award notice issued.',
      supplierNote: 'Temporary Demo App Data award accepted.',
      issuedAt: fixedDate('2026-07-17', 9),
      respondedAt: fixedDate('2026-07-17', 12),
      payload: demoAppPayload({ module: 'award-notice' })
    },
    create: {
      reference: ref('NOTICE-001'),
      recommendationId: recommendation.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      issuedByUserId: actor.user.id,
      respondedByUserId: actor.user.id,
      status: AwardNoticeStatus.ACCEPTED,
      buyerNote: 'Temporary Demo App Data award notice issued.',
      supplierNote: 'Temporary Demo App Data award accepted.',
      issuedAt: fixedDate('2026-07-17', 9),
      respondedAt: fixedDate('2026-07-17', 12),
      payload: demoAppPayload({ module: 'award-notice' })
    }
  });

  await db.awardResponse.create({
    data: {
      noticeId: notice.id,
      actorUserId: actor.user.id,
      actorOrgId: actor.organization.id,
      action: AwardResponseAction.ACCEPT,
      note: 'Accepted for Temporary Demo App Data.',
      payload: demoAppPayload({ channel: 'supplier-portal' })
    }
  });

  await db.standstillPeriod.create({
    data: {
      recommendationId: recommendation.id,
      noticeId: notice.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      startsAt: fixedDate('2026-07-17', 9),
      endsAt: fixedDate('2026-07-31', 17),
      days: 14,
      status: 'ACTIVE',
      payload: demoAppPayload({ legalBasis: 'temporary-demo' })
    }
  });

  await db.awardNotification.create({
    data: {
      recommendationId: recommendation.id,
      noticeId: notice.id,
      recipientOrgId: actor.organization.id,
      channel: 'IN_APP',
      notificationType: 'AWARD_NOTICE',
      subject: 'Temporary Demo App award notice accepted',
      body: 'The demo award notice has been accepted and is ready for contract drafting.',
      status: 'SENT',
      sentAt: fixedDate('2026-07-17', 9),
      payload: demoAppPayload({ module: 'awards-contracts' })
    }
  });

  return { workspace, awardGroup, recommendation, notice };
}

async function seedContractAndPostAward(db: AnyDb, actor: DemoActor, award: Record<string, any>, tenders: Record<string, any>, docs: Record<string, any>, bid: any) {
  const contract = await db.contract.upsert({
    where: { reference: ref('CONTRACT-001') },
    update: {
      tenderId: tenders.evaluationTender.id,
      awardId: award.recommendation.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      title: 'Temporary Demo App Active Service Contract',
      status: ContractStatus.ACTIVE,
      amount: 148_750_000,
      currency: 'TZS',
      payload: demoAppPayload({ module: 'post-award', active: true, signingReady: true })
    },
    create: {
      reference: ref('CONTRACT-001'),
      tenderId: tenders.evaluationTender.id,
      awardId: award.recommendation.id,
      buyerOrgId: actor.organization.id,
      supplierOrgId: actor.organization.id,
      title: 'Temporary Demo App Active Service Contract',
      status: ContractStatus.ACTIVE,
      amount: 148_750_000,
      currency: 'TZS',
      payload: demoAppPayload({ module: 'post-award', active: true, signingReady: true })
    }
  });

  await db.awardNotice.update({ where: { id: award.notice.id }, data: { contractId: contract.id } });

  await db.awardWinner.create({
    data: {
      awardGroupId: award.awardGroup.id,
      recommendationId: award.recommendation.id,
      bidId: bid.id,
      supplierOrgId: actor.organization.id,
      noticeId: award.notice.id,
      contractId: contract.id,
      amount: 148_750_000,
      currency: 'TZS',
      status: 'CONTRACT_ACTIVE',
      payload: demoAppPayload({ module: 'awards-contracts' })
    }
  });

  await db.contractParty.upsert({
    where: { contractId_role: { contractId: contract.id, role: ContractPartyRole.BUYER } },
    update: { organizationId: actor.organization.id, displayName: actor.organization.name, contactName: actor.user.displayName, contactEmail: actor.user.email, signatoryName: actor.user.displayName, signatoryTitle: 'Demo Procurement Lead', payload: demoAppPayload({ side: 'buyer' }) },
    create: { contractId: contract.id, role: ContractPartyRole.BUYER, organizationId: actor.organization.id, displayName: actor.organization.name, contactName: actor.user.displayName, contactEmail: actor.user.email, signatoryName: actor.user.displayName, signatoryTitle: 'Demo Procurement Lead', payload: demoAppPayload({ side: 'buyer' }) }
  });
  await db.contractParty.upsert({
    where: { contractId_role: { contractId: contract.id, role: ContractPartyRole.SUPPLIER } },
    update: { organizationId: actor.organization.id, displayName: actor.organization.name, contactName: actor.user.displayName, contactEmail: actor.user.email, signatoryName: actor.user.displayName, signatoryTitle: 'Demo Supplier Lead', payload: demoAppPayload({ side: 'supplier' }) },
    create: { contractId: contract.id, role: ContractPartyRole.SUPPLIER, organizationId: actor.organization.id, displayName: actor.organization.name, contactName: actor.user.displayName, contactEmail: actor.user.email, signatoryName: actor.user.displayName, signatoryTitle: 'Demo Supplier Lead', payload: demoAppPayload({ side: 'supplier' }) }
  });

  const clause = await db.contractClause.upsert({
    where: { contractId_clauseKey: { contractId: contract.id, clauseKey: 'demo-service-levels' } },
    update: { title: 'Temporary Demo App Service Levels', body: 'Monthly service levels, reporting, evidence, acceptance, and payment conditions.', status: ContractLifecycleItemStatus.APPROVED, payload: demoAppPayload({ clause: 'service-levels' }) },
    create: { contractId: contract.id, clauseKey: 'demo-service-levels', title: 'Temporary Demo App Service Levels', body: 'Monthly service levels, reporting, evidence, acceptance, and payment conditions.', status: ContractLifecycleItemStatus.APPROVED, payload: demoAppPayload({ clause: 'service-levels' }) }
  });

  await db.contractNegotiation.create({
    data: { contractId: contract.id, clauseId: clause.id, raisedByRole: 'buyer', raisedByOrgId: actor.organization.id, subject: 'Temporary Demo App payment evidence wording', position: 'Buyer requests invoice evidence tied to acceptance certificate.', counterOffer: 'Supplier accepts with three-way match reference.', status: ContractLifecycleItemStatus.CLOSED, dueDate: fixedDate('2026-07-18', 12), payload: demoAppPayload({ resolved: true }) }
  });

  await db.contractVersion.upsert({
    where: { contractId_versionNo: { contractId: contract.id, versionNo: 1 } },
    update: { documentId: docs.contractDraft.id, payload: demoAppPayload({ versionLabel: 'draft-from-award' }) },
    create: { contractId: contract.id, versionNo: 1, documentId: docs.contractDraft.id, payload: demoAppPayload({ versionLabel: 'draft-from-award' }) }
  });

  await db.contractSignature.upsert({
    where: { contractId_signerOrgId_role: { contractId: contract.id, signerOrgId: actor.organization.id, role: ContractPartyRole.BUYER } },
    update: { signerUserId: actor.user.id, status: SignatureStatus.SIGNED, signerName: actor.user.displayName, signerTitle: 'Demo Procurement Lead', canonicalPayloadHash: hash(`${contract.reference}:buyer-payload`), signatureHash: hash(`${contract.reference}:buyer-signature`), signedAt: fixedDate('2026-07-18', 9), payload: demoAppPayload({ keyphraseProtected: true }) },
    create: { contractId: contract.id, signerUserId: actor.user.id, signerOrgId: actor.organization.id, role: ContractPartyRole.BUYER, status: SignatureStatus.SIGNED, signerName: actor.user.displayName, signerTitle: 'Demo Procurement Lead', canonicalPayloadHash: hash(`${contract.reference}:buyer-payload`), signatureHash: hash(`${contract.reference}:buyer-signature`), signedAt: fixedDate('2026-07-18', 9), payload: demoAppPayload({ keyphraseProtected: true }) }
  });
  await db.contractSignature.upsert({
    where: { contractId_signerOrgId_role: { contractId: contract.id, signerOrgId: actor.organization.id, role: ContractPartyRole.SUPPLIER } },
    update: { signerUserId: actor.user.id, status: SignatureStatus.PENDING, signerName: actor.user.displayName, signerTitle: 'Demo Supplier Lead', canonicalPayloadHash: hash(`${contract.reference}:supplier-payload`), signatureHash: null, payload: demoAppPayload({ keyphraseProtected: true, signingReady: true }) },
    create: { contractId: contract.id, signerUserId: actor.user.id, signerOrgId: actor.organization.id, role: ContractPartyRole.SUPPLIER, status: SignatureStatus.PENDING, signerName: actor.user.displayName, signerTitle: 'Demo Supplier Lead', canonicalPayloadHash: hash(`${contract.reference}:supplier-payload`), payload: demoAppPayload({ keyphraseProtected: true, signingReady: true }) }
  });

  const milestone = await db.contractMilestone.create({
    data: { contractId: contract.id, title: 'Temporary Demo App Month 1 Mobilisation', description: 'Mobilisation report and service transition completed.', status: ContractMilestoneStatus.SUBMITTED, dueDate: fixedDate('2026-08-15', 12), amount: 24_000_000, currency: 'TZS', payload: demoAppPayload({ phase: 'mobilisation' }) }
  });

  await db.contractMilestoneEvidence.create({
    data: { milestoneId: milestone.id, documentId: docs.evidence.id, uploadedByUserId: actor.user.id, uploaderOrgId: actor.organization.id, note: 'Temporary Demo App mobilisation evidence uploaded.' }
  });

  const deliverable = await db.contractDeliverable.create({
    data: { contractId: contract.id, milestoneId: milestone.id, title: 'Temporary Demo App Mobilisation Report', description: 'Start-up staffing, tools, help desk, and escalation matrix.', submittedByOrgId: actor.organization.id, status: ContractLifecycleItemStatus.SUBMITTED, dueDate: fixedDate('2026-08-12', 12), submittedAt: fixedDate('2026-08-10', 10), payload: demoAppPayload({ domain: 'service' }) }
  });

  const acceptance = await db.contractAcceptance.create({
    data: { contractId: contract.id, deliverableId: deliverable.id, certificateNo: ref('ACCEPTANCE-001'), status: ContractLifecycleItemStatus.APPROVED, acceptedValue: 24_000_000, currency: 'TZS', acceptedAt: fixedDate('2026-08-13', 14), note: 'Temporary Demo App deliverable accepted.', payload: demoAppPayload({ threeWayMatchReady: true }) }
  });

  await db.contractManagementPlan.upsert({
    where: { contractId: contract.id },
    update: { contractManagerId: actor.user.id, objectives: 'Temporary Demo App management plan for active contract monitoring.', monitoringPlan: 'Track milestones, service levels, risks, issues, and payment evidence weekly.', reportingPlan: 'Monthly progress report and exception log.', communicationPlan: 'Use communication center for all official messages.', payload: demoAppPayload({ module: 'post-award' }) },
    create: { contractId: contract.id, contractManagerId: actor.user.id, objectives: 'Temporary Demo App management plan for active contract monitoring.', monitoringPlan: 'Track milestones, service levels, risks, issues, and payment evidence weekly.', reportingPlan: 'Monthly progress report and exception log.', communicationPlan: 'Use communication center for all official messages.', payload: demoAppPayload({ module: 'post-award' }) }
  });

  const activation = await db.contractActivation.upsert({
    where: { contractId: contract.id },
    update: { status: 'ACTIVE', readyForActivation: true, activatedAt: fixedDate('2026-07-20', 9), activatedByUserId: actor.user.id, note: 'Temporary Demo App activation completed.', payload: demoAppPayload({ module: 'contract-activation' }) },
    create: { contractId: contract.id, status: 'ACTIVE', readyForActivation: true, activatedAt: fixedDate('2026-07-20', 9), activatedByUserId: actor.user.id, note: 'Temporary Demo App activation completed.', payload: demoAppPayload({ module: 'contract-activation' }) }
  });

  await db.contractActivationItem.upsert({
    where: { activationId_title: { activationId: activation.id, title: 'Temporary Demo App performance security received' } },
    update: { contractId: contract.id, category: 'SECURITY', ownerRole: 'supplier', status: ContractLifecycleItemStatus.APPROVED, documentId: docs.security.id, submittedByOrgId: actor.organization.id, submittedAt: fixedDate('2026-07-19', 11), reviewedByUserId: actor.user.id, reviewedAt: fixedDate('2026-07-20', 9), payload: demoAppPayload({ activationGate: true }) },
    create: { activationId: activation.id, contractId: contract.id, category: 'SECURITY', title: 'Temporary Demo App performance security received', ownerRole: 'supplier', status: ContractLifecycleItemStatus.APPROVED, documentId: docs.security.id, submittedByOrgId: actor.organization.id, submittedAt: fixedDate('2026-07-19', 11), reviewedByUserId: actor.user.id, reviewedAt: fixedDate('2026-07-20', 9), payload: demoAppPayload({ activationGate: true }) }
  });

  const obligation = await db.contractObligation.create({
    data: { contractId: contract.id, obligationType: 'SERVICE', title: 'Temporary Demo App maintain help desk coverage', description: 'Maintain agreed help desk coverage during business hours.', ownerRole: 'supplier', relatedMilestoneId: milestone.id, status: ContractLifecycleItemStatus.IN_PROGRESS, dueDate: fixedDate('2026-08-31', 17), amount: 12_000_000, currency: 'TZS', acceptanceMethod: 'Monthly service report', acceptanceCriteria: 'Service desk availability above 98%.', paymentEligible: true, payload: demoAppPayload({ module: 'obligations' }) }
  });

  await db.contractEvidenceRequirement.create({
    data: { contractId: contract.id, obligationId: obligation.id, milestoneId: milestone.id, title: 'Temporary Demo App service report evidence', evidenceType: 'DOCUMENT', ownerRole: 'supplier', mandatory: true, status: ContractLifecycleItemStatus.SUBMITTED, dueDate: fixedDate('2026-08-12', 12), documentId: docs.evidence.id, note: 'Evidence linked to milestone and obligation.', payload: demoAppPayload({ module: 'evidence' }) }
  });

  await db.contractMobilizationItem.createMany({
    data: [
      { contractId: contract.id, category: 'STAFFING', title: 'Temporary Demo App nominate service manager', responsibleRole: 'supplier', status: ContractLifecycleItemStatus.APPROVED, dueDate: fixedDate('2026-07-22', 17), completedAt: fixedDate('2026-07-21', 10), note: 'Named manager added.', payload: demoAppPayload({ module: 'mobilization' }) },
      { contractId: contract.id, category: 'TOOLS', title: 'Temporary Demo App setup service tracker', responsibleRole: 'buyer', status: ContractLifecycleItemStatus.IN_PROGRESS, dueDate: fixedDate('2026-07-24', 17), note: 'Dashboard ready for first month.', payload: demoAppPayload({ module: 'mobilization' }) }
    ]
  });

  await db.contractKpi.createMany({
    data: [
      { contractId: contract.id, area: 'Time', title: 'Temporary Demo App response within SLA', target: '98% within SLA', status: ContractLifecycleItemStatus.IN_PROGRESS, score: 96.5, payload: demoAppPayload({ kpi: 'time' }) },
      { contractId: contract.id, area: 'Quality', title: 'Temporary Demo App accepted deliverables first pass', target: '95% accepted first pass', status: ContractLifecycleItemStatus.OPEN, score: 92, payload: demoAppPayload({ kpi: 'quality' }) }
    ]
  });

  const inspection = await db.contractInspection.create({
    data: { contractId: contract.id, milestoneId: milestone.id, inspectionType: 'SERVICE_REVIEW', title: 'Temporary Demo App mobilisation inspection', result: ContractLifecycleItemStatus.APPROVED, inspectedAt: fixedDate('2026-08-13', 11), inspectorUserId: actor.user.id, note: 'Transition controls verified.', payload: demoAppPayload({ module: 'inspection' }) }
  });
  await db.contractAcceptance.create({
    data: { contractId: contract.id, inspectionId: inspection.id, certificateNo: ref('INSPECTION-ACCEPTANCE-001'), status: ContractLifecycleItemStatus.APPROVED, acceptedValue: 0, currency: 'TZS', acceptedAt: fixedDate('2026-08-13', 15), note: 'Inspection accepted for temporary demo.', payload: demoAppPayload({ acceptanceType: 'inspection' }) }
  });

  await db.contractRisk.create({
    data: { contractId: contract.id, title: 'Temporary Demo App delayed onboarding risk', category: 'Schedule', description: 'Risk that service desk onboarding takes longer than planned.', likelihood: 2, impact: 3, score: 6, level: ContractRiskLevel.MEDIUM, responsibleUserId: actor.user.id, mitigationAction: 'Daily mobilisation check-ins.', dueDate: fixedDate('2026-07-28', 17), status: ContractLifecycleItemStatus.IN_PROGRESS, evidence: [docs.evidence.objectKey], payload: demoAppPayload({ module: 'risk' }) }
  });

  await db.contractIssue.create({
    data: { contractId: contract.id, raisedByOrgId: actor.organization.id, title: 'Temporary Demo App badge access delay', description: 'Two supplier staff badges pending approval.', category: 'Mobilisation', status: ContractLifecycleItemStatus.OPEN, dueDate: fixedDate('2026-07-24', 17), payload: demoAppPayload({ module: 'issue' }) }
  });

  await db.contractNotice.create({
    data: { contractId: contract.id, noticeType: 'OFFICIAL_NOTICE', title: 'Temporary Demo App mobilisation reminder', body: 'Please complete final access setup before the first service month.', status: 'SENT', senderRole: 'buyer', recipientRole: 'supplier', sentAt: fixedDate('2026-07-22', 9), receivedAt: fixedDate('2026-07-22', 9), dueDate: fixedDate('2026-07-24', 17), relatedRecordType: 'MOBILIZATION', visibilityScope: 'SHARED', payload: demoAppPayload({ module: 'contract-notices' }) }
  });

  const meeting = await db.contractMeeting.create({
    data: { contractId: contract.id, meetingType: 'PROGRESS_MEETING', title: 'Temporary Demo App weekly mobilisation meeting', status: ContractLifecycleItemStatus.OPEN, meetingDate: fixedDate('2026-07-24', 9), participants: [{ name: actor.user.displayName, role: 'buyer/supplier demo actor' }], agenda: 'Review mobilisation, documents, risks, and first invoice readiness.', minutes: 'Temporary Demo App meeting minutes pending final sign-off.', visibilityScope: 'SHARED', payload: demoAppPayload({ module: 'meetings' }) }
  });
  await db.contractMeetingAction.create({
    data: { contractId: contract.id, meetingId: meeting.id, title: 'Temporary Demo App upload final roster', ownerRole: 'supplier', status: ContractLifecycleItemStatus.IN_PROGRESS, dueDate: fixedDate('2026-07-25', 17), response: 'Roster being compiled.', visibilityScope: 'SHARED', payload: demoAppPayload({ module: 'meeting-actions' }) }
  });

  await db.contractWarranty.create({
    data: {
      contractId: contract.id,
      title: 'Temporary Demo App warranty and support period',
      status: ContractLifecycleItemStatus.OPEN,
      startDate: fixedDate('2026-08-15', 9),
      endDate: fixedDate('2027-02-15', 17),
      responsibleRole: 'supplier',
      payload: demoAppPayload({ module: 'warranty' })
    }
  });

  await db.contractRequiredDocument.upsert({
    where: { contractId_documentType: { contractId: contract.id, documentType: 'TEMPORARY_DEMO_PERFORMANCE_SECURITY' } },
    update: { title: 'Temporary Demo App performance security', ownerRole: 'supplier', status: ContractLifecycleItemStatus.APPROVED, documentId: docs.security.id, dueDate: fixedDate('2026-07-20', 17), reviewedAt: fixedDate('2026-07-20', 9), note: 'Reviewed for temporary demo.', payload: demoAppPayload({ module: 'required-documents' }) },
    create: { contractId: contract.id, documentType: 'TEMPORARY_DEMO_PERFORMANCE_SECURITY', title: 'Temporary Demo App performance security', ownerRole: 'supplier', status: ContractLifecycleItemStatus.APPROVED, documentId: docs.security.id, dueDate: fixedDate('2026-07-20', 17), reviewedAt: fixedDate('2026-07-20', 9), note: 'Reviewed for temporary demo.', payload: demoAppPayload({ module: 'required-documents' }) }
  });

  await db.contractCloseout.upsert({
    where: { contractId: contract.id },
    update: { status: ContractLifecycleItemStatus.OPEN, completionCertificate: false, finalAccountApproved: false, warrantyStartDate: fixedDate('2026-08-15', 9), warrantyEndDate: fixedDate('2027-02-15', 17), lessonsLearned: 'Temporary Demo App closeout readiness record created early for navigation visibility.', payload: demoAppPayload({ readiness: 35 }) },
    create: { contractId: contract.id, status: ContractLifecycleItemStatus.OPEN, completionCertificate: false, finalAccountApproved: false, warrantyStartDate: fixedDate('2026-08-15', 9), warrantyEndDate: fixedDate('2027-02-15', 17), lessonsLearned: 'Temporary Demo App closeout readiness record created early for navigation visibility.', payload: demoAppPayload({ readiness: 35 }) }
  });

  await db.supplierPerformanceRecord.create({
    data: { contractId: contract.id, buyerOrgId: actor.organization.id, supplierOrgId: actor.organization.id, overallScore: 91.25, timeScore: 89, qualityScore: 93, costScore: 92, complianceScore: 91, note: 'Temporary Demo App supplier performance snapshot.', payload: demoAppPayload({ module: 'supplier-performance' }) }
  });

  const deliverySchedule = await db.contractDeliverySchedule.create({
    data: { contractId: contract.id, obligationId: obligation.id, lineReference: ref('DELIVERY-LINE-001'), description: 'Temporary Demo App service transition pack', plannedQuantity: 1, unit: 'lot', deliveryLocation: 'Dar es Salaam', plannedDeliveryDate: fixedDate('2026-08-10', 10), status: ContractLifecycleItemStatus.APPROVED, payload: demoAppPayload({ sampleType: 'goods' }) }
  });
  const dispatch = await db.contractDispatchNotice.create({
    data: { contractId: contract.id, scheduleId: deliverySchedule.id, dispatchReference: ref('DISPATCH-001'), carrier: 'Temporary Demo Logistics', trackingReference: ref('TRACK-001'), dispatchedQuantity: 1, expectedArrivalDate: fixedDate('2026-08-10', 12), status: 'DISPATCHED', submittedByOrgId: actor.organization.id, payload: demoAppPayload({ sampleType: 'goods' }) }
  });
  const receipt = await db.contractGoodsReceipt.create({
    data: { contractId: contract.id, dispatchNoticeId: dispatch.id, receiptReference: ref('GOODS-RECEIPT-001'), receivedAt: fixedDate('2026-08-10', 13), receivedByUserId: actor.user.id, location: 'Dar es Salaam', conditionAtReceipt: 'Complete', status: ContractLifecycleItemStatus.APPROVED, note: 'Temporary Demo App goods receipt sample.', payload: demoAppPayload({ sampleType: 'goods' }) }
  });
  await db.contractGoodsReceiptLine.create({
    data: { receiptId: receipt.id, scheduleId: deliverySchedule.id, description: 'Temporary Demo App service transition pack', orderedQuantity: 1, receivedQuantity: 1, acceptedQuantity: 1, rejectedQuantity: 0, unit: 'lot', payload: demoAppPayload({ sampleType: 'goods-line' }) }
  });
  await db.goodsInspection.create({
    data: { contractId: contract.id, milestoneId: milestone.id, deliverableId: deliverable.id, inspectionNo: ref('GOODS-INSP-001'), goodsDescription: 'Temporary Demo App handover materials', quantityOrdered: 1, quantityReceived: 1, quantityAccepted: 1, quantityRejected: 0, unit: 'lot', location: 'Dar es Salaam', result: ContractLifecycleItemStatus.APPROVED, inspectedByUserId: actor.user.id, inspectedAt: fixedDate('2026-08-10', 15), note: 'Goods sample inspection accepted.', payload: demoAppPayload({ sampleType: 'goods-inspection' }) }
  });

  const worksReport = await db.contractWorksProgressReport.create({
    data: { contractId: contract.id, reportReference: ref('WORKS-REPORT-001'), periodStart: fixedDate('2026-08-01', 9), periodEnd: fixedDate('2026-08-15', 17), progressPercent: 42, programmeReference: ref('PROGRAMME-001'), narrative: 'Temporary Demo App works-style progress sample for post-award views.', submittedByOrgId: actor.organization.id, status: 'SUBMITTED', reviewedByUserId: actor.user.id, reviewedAt: fixedDate('2026-08-16', 10), payload: demoAppPayload({ sampleType: 'works' }) }
  });
  const measurement = await db.contractBoqMeasurement.create({
    data: { contractId: contract.id, reportId: worksReport.id, measurementReference: ref('MEASURE-001'), boqItemReference: 'BOQ-001', description: 'Temporary Demo App measured work item', previousQuantity: 0, currentQuantity: 42, cumulativeQuantity: 42, unitRate: 1_000_000, amount: 42_000_000, certifiedQuantity: 40, certifiedAmount: 40_000_000, status: 'CERTIFIED', reviewedByUserId: actor.user.id, reviewedAt: fixedDate('2026-08-16', 11), payload: demoAppPayload({ sampleType: 'works-measurement' }) }
  });
  await db.contractInterimPaymentCertificate.create({
    data: { contractId: contract.id, measurementId: measurement.id, certificateNumber: ref('IPC-001'), certificateType: 'INTERIM', periodStart: fixedDate('2026-08-01', 9), periodEnd: fixedDate('2026-08-15', 17), grossAmount: 40_000_000, deductionsAmount: 2_000_000, retentionAmount: 1_000_000, certifiedAmount: 38_000_000, netAmount: 38_000_000, currency: 'TZS', status: 'APPROVED', approvedAt: fixedDate('2026-08-17', 12), reviewedByUserId: actor.user.id, reviewedAt: fixedDate('2026-08-17', 10), payload: demoAppPayload({ sampleType: 'works-certificate' }) }
  });

  const serviceLevel = await db.contractServiceLevel.upsert({
    where: { contractId_metricKey: { contractId: contract.id, metricKey: 'demo-response-time' } },
    update: { title: 'Temporary Demo App response time SLA', targetValue: '4 hours', measurementUnit: 'hours', creditRule: 'Credit applies after repeated breach.', status: 'ACTIVE', payload: demoAppPayload({ sampleType: 'service' }) },
    create: { contractId: contract.id, metricKey: 'demo-response-time', title: 'Temporary Demo App response time SLA', targetValue: '4 hours', measurementUnit: 'hours', creditRule: 'Credit applies after repeated breach.', status: 'ACTIVE', payload: demoAppPayload({ sampleType: 'service' }) }
  });
  const servicePeriod = await db.contractServicePeriod.upsert({
    where: { contractId_periodKey: { contractId: contract.id, periodKey: '2026-08' } },
    update: { startDate: fixedDate('2026-08-01', 9), endDate: fixedDate('2026-08-31', 17), status: 'OPEN', payload: demoAppPayload({ sampleType: 'service' }) },
    create: { contractId: contract.id, periodKey: '2026-08', startDate: fixedDate('2026-08-01', 9), endDate: fixedDate('2026-08-31', 17), status: 'OPEN', payload: demoAppPayload({ sampleType: 'service' }) }
  });
  const serviceReport = await db.contractServiceReport.create({
    data: { contractId: contract.id, periodId: servicePeriod.id, reportReference: ref('SERVICE-REPORT-001'), submittedByOrgId: actor.organization.id, submittedAt: fixedDate('2026-08-31', 12), status: 'SUBMITTED', reviewedByUserId: actor.user.id, reviewedAt: fixedDate('2026-09-01', 10), verifiedSlaResult: '96.5% within SLA', acceptedAmount: 12_000_000, summary: 'Temporary Demo App service report sample.', payload: demoAppPayload({ sampleType: 'service-report' }) }
  });
  await db.contractServiceCredit.create({
    data: { contractId: contract.id, serviceLevelId: serviceLevel.id, periodId: servicePeriod.id, serviceReportId: serviceReport.id, creditType: 'SERVICE_CREDIT', amount: 250_000, invoiceImpactAmount: 250_000, currency: 'TZS', status: 'APPROVED', decision: 'Small credit accepted for two delayed responses.', reviewedByUserId: actor.user.id, reviewedAt: fixedDate('2026-09-01', 11), reason: 'Temporary Demo App service credit sample.', payload: demoAppPayload({ sampleType: 'service-credit' }) }
  });

  const consultancyDeliverable = await db.contractConsultancyDeliverable.upsert({
    where: { contractId_deliverableCode: { contractId: contract.id, deliverableCode: 'DEMO-INCEPTION' } },
    update: { title: 'Temporary Demo App consultancy inception report', dueDate: fixedDate('2026-08-20', 17), paymentEligible: true, acceptedAmount: 18_000_000, reviewedByUserId: actor.user.id, reviewedAt: fixedDate('2026-08-21', 10), approvalStatus: 'APPROVED', isFinalReport: false, status: ContractLifecycleItemStatus.APPROVED, payload: demoAppPayload({ sampleType: 'consultancy' }) },
    create: { contractId: contract.id, deliverableCode: 'DEMO-INCEPTION', title: 'Temporary Demo App consultancy inception report', dueDate: fixedDate('2026-08-20', 17), paymentEligible: true, acceptedAmount: 18_000_000, reviewedByUserId: actor.user.id, reviewedAt: fixedDate('2026-08-21', 10), approvalStatus: 'APPROVED', isFinalReport: false, status: ContractLifecycleItemStatus.APPROVED, payload: demoAppPayload({ sampleType: 'consultancy' }) }
  });
  const deliverableVersion = await db.contractDeliverableVersion.upsert({
    where: { deliverableId_versionNo: { deliverableId: consultancyDeliverable.id, versionNo: 1 } },
    update: { contractId: contract.id, documentId: docs.evaluation.id, submittedByOrgId: actor.organization.id, submittedAt: fixedDate('2026-08-19', 12), status: 'APPROVED', payload: demoAppPayload({ sampleType: 'consultancy-version' }) },
    create: { contractId: contract.id, deliverableId: consultancyDeliverable.id, versionNo: 1, documentId: docs.evaluation.id, submittedByOrgId: actor.organization.id, submittedAt: fixedDate('2026-08-19', 12), status: 'APPROVED', payload: demoAppPayload({ sampleType: 'consultancy-version' }) }
  });
  await db.contractDeliverableReview.create({
    data: { contractId: contract.id, versionId: deliverableVersion.id, decision: 'APPROVED', reviewerUserId: actor.user.id, reviewedAt: fixedDate('2026-08-21', 10), comments: 'Temporary Demo App consultancy deliverable approved.', paymentEligible: true, acceptedAmount: 18_000_000, payload: demoAppPayload({ sampleType: 'consultancy-review' }) }
  });

  await db.contractPaymentSchedule.create({
    data: { contractId: contract.id, milestoneId: milestone.id, title: 'Temporary Demo App mobilisation payment schedule', amount: 24_000_000, currency: 'TZS', dueDate: fixedDate('2026-08-20', 17), status: ContractLifecycleItemStatus.OPEN, payload: demoAppPayload({ module: 'financial' }) }
  });

  await db.urgentAction.upsert({
    where: { ownerOrgId_actionKey: { ownerOrgId: actor.organization.id, actionKey: ref('URGENT-CONTRACT-ACTION-001') } },
    update: { contractId: contract.id, awardId: award.recommendation.id, noticeId: award.notice.id, title: 'Temporary Demo App review pending supplier signature', requiredAction: 'Open signing workspace and confirm pending supplier signature.', riskLevel: 'Medium', dueDate: fixedDate('2026-07-25', 17), status: 'OPEN', nextRoute: '/awards-contracts/signing', payload: demoAppPayload({ module: 'workspace' }) },
    create: { ownerOrgId: actor.organization.id, contractId: contract.id, awardId: award.recommendation.id, noticeId: award.notice.id, actionKey: ref('URGENT-CONTRACT-ACTION-001'), title: 'Temporary Demo App review pending supplier signature', requiredAction: 'Open signing workspace and confirm pending supplier signature.', riskLevel: 'Medium', dueDate: fixedDate('2026-07-25', 17), status: 'OPEN', nextRoute: '/awards-contracts/signing', payload: demoAppPayload({ module: 'workspace' }) }
  });

  return { contract, acceptance, receipt };
}

async function seedFinancial(db: AnyDb, actor: DemoActor, contractState: Record<string, any>, award: Record<string, any>, tenders: Record<string, any>, docs: Record<string, any>) {
  const po = await db.purchaseOrder.upsert({
    where: { reference: ref('PO-001') },
    update: { contractId: contractState.contract.id, buyerOrgId: actor.organization.id, amount: 24_000_000, currency: 'TZS', payload: demoAppPayload({ module: 'financial', lineCount: 2 }) },
    create: { reference: ref('PO-001'), contractId: contractState.contract.id, buyerOrgId: actor.organization.id, amount: 24_000_000, currency: 'TZS', payload: demoAppPayload({ module: 'financial', lineCount: 2 }) }
  });

  const invoice = await db.invoice.upsert({
    where: { reference: ref('INV-001') },
    update: { purchaseOrderId: po.id, contractId: contractState.contract.id, buyerOrgId: actor.organization.id, supplierOrgId: actor.organization.id, executionReferenceType: 'ACCEPTANCE', executionReferenceId: contractState.acceptance.id, visibilityScope: 'SHARED', status: InvoiceStatus.MATCHED, amount: 23_750_000, currency: 'TZS', payload: demoAppPayload({ retention: 1_000_000, deduction: 250_000 }) },
    create: { reference: ref('INV-001'), purchaseOrderId: po.id, contractId: contractState.contract.id, buyerOrgId: actor.organization.id, supplierOrgId: actor.organization.id, executionReferenceType: 'ACCEPTANCE', executionReferenceId: contractState.acceptance.id, visibilityScope: 'SHARED', status: InvoiceStatus.MATCHED, amount: 23_750_000, currency: 'TZS', payload: demoAppPayload({ retention: 1_000_000, deduction: 250_000 }) }
  });

  await db.budgetCommitment.upsert({
    where: { commitmentNo: ref('BUDGET-001') },
    update: { recommendationId: award.recommendation.id, tenderId: tenders.evaluationTender.id, contractId: contractState.contract.id, buyerOrgId: actor.organization.id, budgetCode: 'DEMO-APP-OPS-2026', amount: 148_750_000, currency: 'TZS', status: 'RESERVED', reservedAt: fixedDate('2026-07-16', 12), approvedByUserId: actor.user.id, note: 'Temporary Demo App budget commitment.', payload: demoAppPayload({ module: 'budget' }) },
    create: { commitmentNo: ref('BUDGET-001'), recommendationId: award.recommendation.id, tenderId: tenders.evaluationTender.id, contractId: contractState.contract.id, buyerOrgId: actor.organization.id, budgetCode: 'DEMO-APP-OPS-2026', amount: 148_750_000, currency: 'TZS', status: 'RESERVED', reservedAt: fixedDate('2026-07-16', 12), approvedByUserId: actor.user.id, note: 'Temporary Demo App budget commitment.', payload: demoAppPayload({ module: 'budget' }) }
  });

  await db.threeWayMatchResult.upsert({
    where: { invoiceId: invoice.id },
    update: { contractId: contractState.contract.id, purchaseOrderId: po.id, acceptanceId: contractState.acceptance.id, goodsReceiptId: contractState.receipt.id, status: InvoiceStatus.MATCHED, poMatched: true, receiptMatched: true, invoiceMatched: true, varianceAmount: 250_000, currency: 'TZS', mismatchType: 'SERVICE_CREDIT', reviewerUserId: actor.user.id, reviewedAt: fixedDate('2026-09-02', 10), note: 'Temporary Demo App three-way match with approved service credit.', payload: demoAppPayload({ module: 'three-way-match' }) },
    create: { invoiceId: invoice.id, contractId: contractState.contract.id, purchaseOrderId: po.id, acceptanceId: contractState.acceptance.id, goodsReceiptId: contractState.receipt.id, status: InvoiceStatus.MATCHED, poMatched: true, receiptMatched: true, invoiceMatched: true, varianceAmount: 250_000, currency: 'TZS', mismatchType: 'SERVICE_CREDIT', reviewerUserId: actor.user.id, reviewedAt: fixedDate('2026-09-02', 10), note: 'Temporary Demo App three-way match with approved service credit.', payload: demoAppPayload({ module: 'three-way-match' }) }
  });

  await db.paymentApproval.create({
    data: { contractId: contractState.contract.id, invoiceId: invoice.id, stepKey: 'demo-finance-approval', role: 'Finance Approver', status: InvoiceStatus.MATCHED, amountApproved: 23_750_000, currency: 'TZS', actorUserId: actor.user.id, decidedAt: fixedDate('2026-09-02', 11), note: 'Temporary Demo App payment approved.', payload: demoAppPayload({ module: 'payment-approval' }) }
  });

  const payment = await db.contractPayment.create({
    data: { contractId: contractState.contract.id, invoiceId: invoice.id, status: InvoiceStatus.PAID, grossAmount: 24_000_000, retentionAmount: 1_000_000, advanceRecovery: 0, liquidatedDamages: 0, taxWithholding: 0, netAmount: 23_750_000, currency: 'TZS', reviewedByUserId: actor.user.id, approvedByUserId: actor.user.id, paidAt: fixedDate('2026-09-05', 12), note: 'Temporary Demo App payment with retention and service credit deduction.', payload: demoAppPayload({ module: 'contract-payment' }) }
  });

  await db.paymentConfirmation.upsert({
    where: { confirmationReference: ref('PAYMENT-CONFIRM-001') },
    update: { contractId: contractState.contract.id, invoiceId: invoice.id, paymentId: payment.id, paidAmount: 23_750_000, currency: 'TZS', paidAt: fixedDate('2026-09-05', 12), evidenceDocumentId: docs.paymentProof.id, confirmedByUserId: actor.user.id, note: 'Temporary Demo App payment confirmation.', payload: demoAppPayload({ module: 'payment-confirmation' }) },
    create: { confirmationReference: ref('PAYMENT-CONFIRM-001'), contractId: contractState.contract.id, invoiceId: invoice.id, paymentId: payment.id, paidAmount: 23_750_000, currency: 'TZS', paidAt: fixedDate('2026-09-05', 12), evidenceDocumentId: docs.paymentProof.id, confirmedByUserId: actor.user.id, note: 'Temporary Demo App payment confirmation.', payload: demoAppPayload({ module: 'payment-confirmation' }) }
  });

  return { po, invoice, payment };
}

async function seedDocuments(db: AnyDb, actor: DemoActor, tenders: Record<string, any>, bid: any, award: Record<string, any>, contractState: Record<string, any>, docs: Record<string, any>) {
  const template = await db.officialDocumentTemplate.upsert({
    where: { code: ref('OFFICIAL-TEMPLATE-001') },
    update: {
      name: 'Temporary Demo App Official Document Template',
      description: 'Template used by temporary demo tender, bid, award, and contract records.',
      documentType: 'TEMPORARY_DEMO',
      procurementType: 'SERVICE',
      version: '1.0',
      status: 'ACTIVE',
      sections: [{ key: 'summary', title: 'Summary' }, { key: 'approval', title: 'Approval' }],
      requiredFields: ['reference', 'ownerOrgId', 'generatedByUserId'],
      metadata: demoAppPayload({ module: 'documents' })
    },
    create: {
      code: ref('OFFICIAL-TEMPLATE-001'),
      name: 'Temporary Demo App Official Document Template',
      description: 'Template used by temporary demo tender, bid, award, and contract records.',
      documentType: 'TEMPORARY_DEMO',
      procurementType: 'SERVICE',
      version: '1.0',
      status: 'ACTIVE',
      sections: [{ key: 'summary', title: 'Summary' }, { key: 'approval', title: 'Approval' }],
      requiredFields: ['reference', 'ownerOrgId', 'generatedByUserId'],
      metadata: demoAppPayload({ module: 'documents' })
    }
  });

  const officialDocuments = [
    ['procurement', 'Tender', tenders.openTender.id, 'TEMPORARY_DEMO_TENDER', ref('OFFICIAL-TENDER-001'), docs.tender],
    ['bidding', 'Bid', bid.id, 'TEMPORARY_DEMO_BID', ref('OFFICIAL-BID-001'), docs.bidTechnical],
    ['awards-contracts', 'AwardRecommendation', award.recommendation.id, 'TEMPORARY_DEMO_AWARD', ref('OFFICIAL-AWARD-001'), docs.awardPack],
    ['contract', 'Contract', contractState.contract.id, 'TEMPORARY_DEMO_CONTRACT', ref('OFFICIAL-CONTRACT-001'), docs.contractDraft]
  ];

  for (const [sourceModule, sourceEntityType, sourceEntityId, documentType, reference, documentObject] of officialDocuments) {
    await db.officialDocumentVersion.upsert({
      where: {
        sourceModule_sourceEntityType_sourceEntityId_documentType_versionNo: {
          sourceModule,
          sourceEntityType,
          sourceEntityId,
          documentType,
          versionNo: 1
        }
      },
      update: {
        templateId: template.id,
        documentObjectId: documentObject.id,
        ownerOrgId: actor.organization.id,
        generatedByUserId: actor.user.id,
        title: `${reference} Temporary Demo App Official Document`,
        reference,
        templateVersion: '1.0',
        status: 'OFFICIAL',
        contentHash: hash(reference),
        pdfObjectKey: `${DEMO_APP_DATASET}/official/${reference}.pdf`,
        pdfSizeBytes: 4096,
        metadata: demoAppPayload({ sourceModule, sourceEntityType })
      },
      create: {
        templateId: template.id,
        documentObjectId: documentObject.id,
        ownerOrgId: actor.organization.id,
        generatedByUserId: actor.user.id,
        sourceModule,
        sourceEntityType,
        sourceEntityId,
        documentType,
        title: `${reference} Temporary Demo App Official Document`,
        reference,
        versionNo: 1,
        templateVersion: '1.0',
        status: 'OFFICIAL',
        contentHash: hash(reference),
        pdfObjectKey: `${DEMO_APP_DATASET}/official/${reference}.pdf`,
        pdfSizeBytes: 4096,
        metadata: demoAppPayload({ sourceModule, sourceEntityType })
      }
    });
  }
}

async function seedCommunicationRecordsSupportAndIntelligence(
  db: AnyDb,
  actor: DemoActor,
  tenders: Record<string, any>,
  bid: any,
  award: Record<string, any>,
  contractState: Record<string, any>,
  financial: Record<string, any>,
  docs: Record<string, any>
) {
  const messages = await Promise.all([
    db.communicationItem.create({
      data: { ownerOrgId: actor.organization.id, senderOrgId: actor.organization.id, recipientOrgId: actor.organization.id, tenderId: tenders.openTender.id, kind: CommunicationKind.CLARIFICATION, folder: 'inbox', category: 'Clarification', subject: `${DEMO_APP_REFERENCE_PREFIX} Clarification response received`, body: 'Temporary Demo App Data: supplier asked for billing schedule clarification.', status: CommunicationStatus.UNREAD, priority: CommunicationPriority.HIGH, read: false, actionRequired: true, visibility: 'SHARED', payload: demoAppPayload({ module: 'communication', route: '/communication' }) }
    }),
    db.communicationItem.create({
      data: { ownerOrgId: actor.organization.id, senderOrgId: actor.organization.id, recipientOrgId: actor.organization.id, tenderId: tenders.evaluationTender.id, kind: CommunicationKind.NOTIFICATION, folder: 'sent', category: 'Award Notice', subject: `${DEMO_APP_REFERENCE_PREFIX} Award notice sent`, body: 'Temporary Demo App Data: award notice was sent and accepted.', status: CommunicationStatus.READ, priority: CommunicationPriority.NORMAL, read: true, actionRequired: false, visibility: 'SHARED', payload: demoAppPayload({ module: 'communication', route: '/awards-contracts/award-response' }) }
    }),
    db.communicationItem.create({
      data: { ownerOrgId: actor.organization.id, senderOrgId: actor.organization.id, recipientOrgId: actor.organization.id, kind: CommunicationKind.MESSAGE, folder: 'archive', category: 'Support', subject: `${DEMO_APP_REFERENCE_PREFIX} Support conversation archived`, body: 'Temporary Demo App Data: archived support-related message.', status: CommunicationStatus.ARCHIVED, priority: CommunicationPriority.LOW, read: true, actionRequired: false, visibility: 'PRIVATE', payload: demoAppPayload({ module: 'support' }) }
    })
  ]);

  await db.communicationAttachment.createMany({
    data: [
      { communicationItemId: messages[0].id, documentId: docs.requirements.id },
      { communicationItemId: messages[1].id, documentId: docs.awardPack.id }
    ]
  });

  const recordEntries = [
    ['Tender', tenders.openTender.reference, 'Temporary Demo App tender published'],
    ['Bid', bid.reference, 'Temporary Demo App bid submitted'],
    ['EvaluationWorkspace', award.workspace.id, 'Temporary Demo App evaluation completed'],
    ['AwardRecommendation', award.recommendation.reference, 'Temporary Demo App award approved'],
    ['Contract', contractState.contract.reference, 'Temporary Demo App contract signing-ready'],
    ['Invoice', financial.invoice.reference, 'Temporary Demo App invoice matched and paid'],
    ['SupportTicket', ref('SUPPORT-OPEN-001'), 'Temporary Demo App support activity recorded']
  ];
  await db.recordEntry.createMany({
    data: recordEntries.map(([entityType, entityRef, title]) => ({
      ownerOrgId: actor.organization.id,
      entityType,
      entityRef,
      title,
      payload: demoAppPayload({ module: 'records', entityType, entityRef }),
      createdAt: fixedDate('2026-07-18', 10)
    }))
  });

  await db.auditEvent.createMany({
    data: [
      { ownerOrgId: actor.organization.id, actorUserId: actor.user.id, event: 'demo.help.match', entityType: 'HelpCentre', entityRef: ref('HELP-MATCH-001'), severity: AuditSeverity.INFO, payload: demoAppPayload({ question: 'How do I submit a bid?', matched: true }), createdAt: fixedDate('2026-07-18', 9) },
      { ownerOrgId: actor.organization.id, actorUserId: actor.user.id, event: 'demo.help.unmatched', entityType: 'HelpCentre', entityRef: ref('HELP-UNMATCHED-001'), severity: AuditSeverity.WARNING, payload: demoAppPayload({ question: 'Temporary uncommon demo question', matched: false }), createdAt: fixedDate('2026-07-18', 9) },
      { ownerOrgId: actor.organization.id, actorUserId: actor.user.id, event: 'demo.contract.signature.ready', entityType: 'Contract', entityRef: contractState.contract.reference, severity: AuditSeverity.INFO, payload: demoAppPayload({ module: 'security', keyphraseProtected: true }), createdAt: fixedDate('2026-07-18', 10) }
    ]
  });

  const tickets = await Promise.all([
    db.supportTicket.create({ data: { ownerUserId: actor.user.id, ownerOrgId: actor.organization.id, subject: `${DEMO_APP_REFERENCE_PREFIX} Support open ticket`, category: 'Bidding', priority: 'HIGH', status: 'OPEN', description: 'Temporary Demo App Data: bidder workspace needs help with final financial upload.', payload: demoAppPayload({ reference: ref('SUPPORT-OPEN-001') }), createdAt: fixedDate('2026-07-18', 9) } }),
    db.supportTicket.create({ data: { ownerUserId: actor.user.id, ownerOrgId: actor.organization.id, subject: `${DEMO_APP_REFERENCE_PREFIX} Support waiting on user`, category: 'Documents', priority: 'NORMAL', status: 'WAITING_ON_USER', description: 'Temporary Demo App Data: support requested a corrected document checksum.', payload: demoAppPayload({ reference: ref('SUPPORT-WAITING-001') }), createdAt: fixedDate('2026-07-17', 9) } }),
    db.supportTicket.create({ data: { ownerUserId: actor.user.id, ownerOrgId: actor.organization.id, subject: `${DEMO_APP_REFERENCE_PREFIX} Support resolved ticket`, category: 'Contracts', priority: 'LOW', status: 'RESOLVED', description: 'Temporary Demo App Data: signing page access question resolved.', resolvedAt: fixedDate('2026-07-16', 16), payload: demoAppPayload({ reference: ref('SUPPORT-RESOLVED-001') }), createdAt: fixedDate('2026-07-15', 9) } })
  ]);
  await db.supportTicketComment.createMany({
    data: [
      { ticketId: tickets[0].id, actorUserId: actor.user.id, body: 'Temporary Demo App Data: I cannot see the final upload checklist.', visibility: 'PUBLIC', payload: demoAppPayload({ ticket: 'open' }), createdAt: fixedDate('2026-07-18', 9) },
      { ticketId: tickets[1].id, actorUserId: actor.user.id, body: 'Temporary Demo App Data: I will upload the corrected document.', visibility: 'PUBLIC', payload: demoAppPayload({ ticket: 'waiting' }), createdAt: fixedDate('2026-07-17', 10) },
      { ticketId: tickets[2].id, actorUserId: actor.user.id, body: 'Temporary Demo App Data: signing access confirmed.', visibility: 'PUBLIC', payload: demoAppPayload({ ticket: 'resolved' }), createdAt: fixedDate('2026-07-16', 15) }
    ]
  });

  await db.marketSnapshot.create({ data: { ownerOrgId: actor.organization.id, name: `${DEMO_APP_REFERENCE_PREFIX} Market snapshot`, payload: demoAppPayload({ category: 'facility services', averageBid: 151_000_000, competition: 'healthy', signal: 'prices stable' }), capturedAt: fixedDate('2026-07-18', 8) } });
  await db.priceBenchmark.create({ data: { ownerOrgId: actor.organization.id, tenderType: TenderType.SERVICE, category: 'Facilities services', payload: demoAppPayload({ p25: 142_000_000, median: 153_000_000, p75: 168_000_000, currency: 'TZS' }), capturedAt: fixedDate('2026-07-18', 8) } });
  await db.supplierMatchSignal.create({ data: { tenderId: tenders.openTender.id, supplierOrgId: actor.organization.id, score: 94, payload: demoAppPayload({ matchedCapabilities: ['service delivery', 'Dar es Salaam coverage'], risk: 'LOW' }) } });
  await db.supplierMatchSignal.create({
    data: {
      tenderId: tenders.bidReadyTender.id,
      supplierOrgId: actor.organization.id,
      score: 99,
      payload: demoAppPayload({
        bidReady: true,
        matchedCapabilities: ['office supplies', 'stationery', 'toner delivery', 'Dar es Salaam coverage'],
        recommendationReason: 'Saved public tender from an external buyer organization with no existing demo bid.',
        risk: 'LOW'
      })
    }
  });

  const externalSystem = await db.externalSystem.create({
    data: { ownerOrgId: actor.organization.id, name: `${DEMO_APP_REFERENCE_PREFIX} Temporary Registry Gateway`, systemType: 'REGISTRY', status: 'Configured', config: demoAppPayload({ endpoint: 'local-demo-registry', auth: 'mock-token-ref' }) }
  });
  await db.registryRecord.upsert({
    where: { source_registryNumber: { source: 'PX-DEMO-APP-REGISTRY', registryNumber: ref('REG-001') } },
    update: { entityType: 'ORGANIZATION', name: actor.organization.name, status: 'MATCHED', confidence: 98, payload: demoAppPayload({ registry: 'temporary' }) },
    create: { source: 'PX-DEMO-APP-REGISTRY', registryNumber: ref('REG-001'), entityType: 'ORGANIZATION', name: actor.organization.name, status: 'MATCHED', confidence: 98, payload: demoAppPayload({ registry: 'temporary' }) }
  });
  const syncRun = await db.integrationSyncRun.create({
    data: { externalSystemId: externalSystem.id, ownerOrgId: actor.organization.id, status: 'COMPLETED', direction: 'INBOUND', payload: demoAppPayload({ recordsRead: 4, recordsMatched: 4 }), startedAt: fixedDate('2026-07-18', 7), finishedAt: fixedDate('2026-07-18', 7) }
  });
  await db.integrationEvent.createMany({
    data: [
      { syncRunId: syncRun.id, ownerOrgId: actor.organization.id, eventType: 'REGISTRY_MATCHED', status: 'SUCCESS', payload: demoAppPayload({ entityRef: ref('REG-001') }), createdAt: fixedDate('2026-07-18', 7) },
      { syncRunId: syncRun.id, ownerOrgId: actor.organization.id, eventType: 'SUPPLIER_RISK_REFRESHED', status: 'SUCCESS', payload: demoAppPayload({ risk: 'LOW' }), createdAt: fixedDate('2026-07-18', 7) }
    ]
  });
}

async function seedDemoAppData(db: AnyDb) {
  const actor = await resolveDemoActor(db);
  await cleanupDemoAppData(db);

  const docs = {
    tender: await createDocument(db, actor, 'tender-instructions.pdf', 'Temporary Demo App Tender Instructions.pdf', 'TENDER_DOCUMENT'),
    requirements: await createDocument(db, actor, 'requirements-matrix.xlsx', 'Temporary Demo App Requirements Matrix.xlsx', 'TENDER_REQUIREMENTS'),
    draftTender: await createDocument(db, actor, 'draft-tender-workpad.docx', 'Temporary Demo App Draft Tender Workpad.docx', 'DRAFT_TENDER'),
    evaluation: await createDocument(db, actor, 'evaluation-report.pdf', 'Temporary Demo App Evaluation Report.pdf', 'EVALUATION_REPORT'),
    bidTechnical: await createDocument(db, actor, 'bid-technical.pdf', 'Temporary Demo App Technical Bid.pdf', 'BID_DOCUMENT'),
    bidFinancial: await createDocument(db, actor, 'bid-financial.xlsx', 'Temporary Demo App Financial Bid.xlsx', 'BID_FINANCIAL'),
    awardPack: await createDocument(db, actor, 'award-pack.pdf', 'Temporary Demo App Award Pack.pdf', 'AWARD_PACK'),
    contractDraft: await createDocument(db, actor, 'contract-draft.pdf', 'Temporary Demo App Contract Draft.pdf', 'CONTRACT_DRAFT'),
    evidence: await createDocument(db, actor, 'milestone-evidence.pdf', 'Temporary Demo App Milestone Evidence.pdf', 'CONTRACT_EVIDENCE'),
    security: await createDocument(db, actor, 'performance-security.pdf', 'Temporary Demo App Performance Security.pdf', 'PERFORMANCE_SECURITY'),
    paymentProof: await createDocument(db, actor, 'payment-confirmation.pdf', 'Temporary Demo App Payment Confirmation.pdf', 'PAYMENT_CONFIRMATION')
  };

  await seedWorkspace(db, actor);
  const tenders = await seedProcurement(db, actor, docs);
  const bidding = await seedBidding(db, actor, tenders, docs);
  const award = await seedEvaluationAndAward(db, actor, tenders, bidding.submittedBid, docs);
  const contractState = await seedContractAndPostAward(db, actor, award, tenders, docs, bidding.submittedBid);
  const financial = await seedFinancial(db, actor, contractState, award, tenders, docs);
  await seedDocuments(db, actor, tenders, bidding.submittedBid, award, contractState, docs);
  await seedCommunicationRecordsSupportAndIntelligence(db, actor, tenders, bidding.submittedBid, award, contractState, financial, docs);

  const refreshedUser = await db.user.findUnique({
    where: { email: DEMO_APP_USER_EMAIL },
    select: { email: true, accountType: true, verificationStatus: true }
  });
  assertBaseDemoUser(refreshedUser);
}

export async function runDemoAppSeed(command: 'seed' | 'cleanup' = 'seed') {
  assertDemoAppSeedRuntime();

  return withDbContext(
    { accountType: AccountType.ADMIN },
    async (tx) => {
      const db = tx as AnyDb;
      if (command === 'cleanup') {
        await cleanupDemoAppData(db);
        return { cleaned: true };
      }

      await seedDemoAppData(db);
      return { seeded: true };
    },
    prisma,
    { timeout: 120_000, maxWait: 20_000 }
  );
}

async function main() {
  const command = process.argv[2] === 'cleanup' ? 'cleanup' : 'seed';
  const result = await runDemoAppSeed(command);
  console.log(
    command === 'cleanup'
      ? `Cleaned temporary demo app data (${DEMO_APP_DATASET}).`
      : `Seeded temporary demo app data (${DEMO_APP_DATASET}) for ${DEMO_APP_USER_EMAIL}.`,
    result
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
