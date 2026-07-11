import { scrypt as scryptCallback, randomBytes } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import {
  AccountType,
  ApprovalStatus,
  AuditSeverity,
  AwardNoticeStatus,
  AwardResponseAction,
  BidStatus,
  ComplianceCaseStatus,
  ContractLifecycleItemStatus,
  ContractMilestoneStatus,
  ContractPartyRole,
  ContractRiskLevel,
  ContractStatus,
  ContractTerminationStatus,
  ContractTerminationType,
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
  RiskLevel,
  SignatureStatus,
  TenderStatus,
  TenderType,
  TrustTier,
  VerificationStatus,
  Visibility,
  WorkflowAssignmentType
} from '@prisma/client';
import { prisma } from '../src/db/prisma.js';
import { withDbContext } from '../src/db/context.js';

const scrypt = promisify(scryptCallback);

export const AWARD_CONTRACT_DEMO_DATASET = 'award-contract-full';
export const AWARD_CONTRACT_DEMO_PREFIX = 'PX-DEMO-AC';
const MAIN_DEMO_USER_EMAIL = 'demo@procurex.tz';
const MAIN_DEMO_ORGANIZATION_NAME = 'Kilimanjaro Supplies Limited';

const demoOrganizationNames = [
  'ProcureX Demo Compliance Authority',
  'PX Demo National Procurement Authority',
  'PX Demo Buyer Supplier Company',
  'PX Demo External Buyer Authority',
  'PX Demo Accepted Supplier Ltd',
  'PX Demo Declined Supplier Ltd',
  'PX Demo Risky Supplier Ltd',
  'PX Demo Terminated Supplier Ltd',
  'PX Demo Closed Supplier Ltd'
];

const demoUserEmails = [
  'award-demo@procurex.tz',
  'award-admin@procurex.tz',
  'award-buyer@procurex.tz',
  'contract-manager@procurex.tz',
  'legal-review@procurex.tz',
  'finance-review@procurex.tz',
  'technical-review@procurex.tz',
  'award-supplier@procurex.tz',
  'declined-supplier@procurex.tz',
  'risky-supplier@procurex.tz',
  'terminated-supplier@procurex.tz',
  'closed-supplier@procurex.tz'
];

type AnyDb = Record<string, any>;

type DemoActor = {
  org: any;
  user: any;
};

type DemoScenario = {
  key: string;
  title: string;
  procurementType: 'GOODS' | 'WORKS' | 'SERVICE' | 'CONSULTANCY' | 'IT';
  status: ContractStatus;
  buyer?: DemoActor;
  supplier: DemoActor;
  amount: number;
};

function demoPayload(extra: Record<string, unknown> = {}) {
  return {
    demoDataset: AWARD_CONTRACT_DEMO_DATASET,
    ...extra
  };
}

function ref(suffix: string) {
  return `${AWARD_CONTRACT_DEMO_PREFIX}-${suffix}`;
}

function daysFromNow(days: number, hour = 9) {
  const date = new Date();
  date.setUTCHours(hour, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function dateOnly(days: number) {
  return daysFromNow(days).toISOString().slice(0, 10);
}

async function hashSeedPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${derived.toString('hex')}`;
}

async function deleteIfIds(db: AnyDb, model: string, field: string, ids: string[]) {
  if (ids.length === 0) return;
  await db[model].deleteMany({ where: { [field]: { in: ids } } });
}

async function resetDemoDataset(db: AnyDb) {
  const demoOrganizations = await db.organization.findMany({ where: { name: { in: demoOrganizationNames } }, select: { id: true } });
  const demoOrganizationIds = demoOrganizations.map((item: { id: string }) => item.id);
  const contracts = await db.contract.findMany({
    where: {
      OR: [
        { reference: { startsWith: AWARD_CONTRACT_DEMO_PREFIX } },
        ...(demoOrganizationIds.length ? [{ buyerOrgId: { in: demoOrganizationIds } }, { supplierOrgId: { in: demoOrganizationIds } }] : [])
      ]
    },
    select: { id: true, awardId: true, tenderId: true }
  });
  const contractIds = contracts.map((item: { id: string }) => item.id);
  const tenderIdsFromContracts = contracts.map((item: { tenderId: string | null }) => item.tenderId).filter(Boolean);
  const tenders = await db.tender.findMany({
    where: {
      OR: [
        { reference: { startsWith: AWARD_CONTRACT_DEMO_PREFIX } },
        ...(tenderIdsFromContracts.length ? [{ id: { in: tenderIdsFromContracts } }] : []),
        ...(demoOrganizationIds.length ? [{ buyerOrgId: { in: demoOrganizationIds } }] : [])
      ]
    },
    select: { id: true }
  });
  const tenderIds = tenders.map((item: { id: string }) => item.id);
  const workspaces = tenderIds.length
    ? await db.evaluationWorkspace.findMany({ where: { tenderId: { in: tenderIds } }, select: { id: true } })
    : [];
  const workspaceIds = workspaces.map((item: { id: string }) => item.id);
  const recommendations = workspaceIds.length
    ? await db.awardRecommendation.findMany({ where: { workspaceId: { in: workspaceIds } }, select: { id: true } })
    : [];
  const recommendationIds = recommendations.map((item: { id: string }) => item.id);
  const awardGroups = workspaceIds.length
    ? await db.awardGroup.findMany({ where: { workspaceId: { in: workspaceIds } }, select: { id: true } })
    : [];
  const awardGroupIds = awardGroups.map((item: { id: string }) => item.id);
  const bids = tenderIds.length ? await db.bid.findMany({ where: { tenderId: { in: tenderIds } }, select: { id: true } }) : [];
  const bidIds = bids.map((item: { id: string }) => item.id);
  const terminations = contractIds.length
    ? await db.contractTermination.findMany({ where: { contractId: { in: contractIds } }, select: { id: true } })
    : [];
  const terminationIds = terminations.map((item: { id: string }) => item.id);
  const milestones = contractIds.length
    ? await db.contractMilestone.findMany({ where: { contractId: { in: contractIds } }, select: { id: true } })
    : [];
  const milestoneIds = milestones.map((item: { id: string }) => item.id);
  const invoices = contractIds.length
    ? await db.invoice.findMany({ where: { contractId: { in: contractIds } }, select: { id: true } })
    : [];
  const invoiceIds = invoices.map((item: { id: string }) => item.id);
  const violations = await db.violationCase.findMany({
    where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } },
    select: { id: true }
  });
  const violationIds = violations.map((item: { id: string }) => item.id);
  const enforcements = await db.enforcementRecord.findMany({
    where: {
      OR: [
        { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } },
        ...(violationIds.length ? [{ violationId: { in: violationIds } }] : [])
      ]
    },
    select: { id: true }
  });
  const enforcementIds = enforcements.map((item: { id: string }) => item.id);

  await deleteIfIds(db, 'appealRecord', 'enforcementId', enforcementIds);
  await deleteIfIds(db, 'appealRecord', 'violationId', violationIds);
  await deleteIfIds(db, 'enforcementRecord', 'violationId', violationIds);
  await deleteIfIds(db, 'violationEvidence', 'violationId', violationIds);
  await db.appealRecord.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } } });
  await db.enforcementRecord.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } } });
  await db.violationEvidence.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } } });
  await db.violationCase.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } } });
  await db.complianceReview.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } } });
  await db.collusionAlert.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } } });
  await db.riskForecast.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } } });
  await db.riskSignal.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } } });
  await db.supplierRiskProfile.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } } });
  await db.auditEvent.deleteMany({ where: { payload: { path: ['demoDataset'], equals: AWARD_CONTRACT_DEMO_DATASET } } });

  await deleteIfIds(db, 'paymentConfirmation', 'invoiceId', invoiceIds);
  await deleteIfIds(db, 'paymentApproval', 'invoiceId', invoiceIds);
  await deleteIfIds(db, 'threeWayMatchResult', 'invoiceId', invoiceIds);
  await deleteIfIds(db, 'paymentConfirmation', 'contractId', contractIds);
  await deleteIfIds(db, 'paymentApproval', 'contractId', contractIds);
  await deleteIfIds(db, 'threeWayMatchResult', 'contractId', contractIds);
  await deleteIfIds(db, 'contractPayment', 'contractId', contractIds);
  await deleteIfIds(db, 'invoice', 'contractId', contractIds);
  await deleteIfIds(db, 'purchaseOrder', 'contractId', contractIds);

  await deleteIfIds(db, 'terminationNotice', 'terminationId', terminationIds);
  await deleteIfIds(db, 'terminationEvidence', 'terminationId', terminationIds);
  await deleteIfIds(db, 'terminationValuation', 'terminationId', terminationIds);
  await deleteIfIds(db, 'terminationSettlement', 'terminationId', terminationIds);
  await deleteIfIds(db, 'replacementProcurementPlan', 'terminationId', terminationIds);

  await deleteIfIds(db, 'contractMilestoneEvidence', 'milestoneId', milestoneIds);
  for (const model of [
    'urgentAction',
    'notification',
    'contractWorkflowApproval',
    'contractRequiredDocument',
    'contractWarranty',
    'performanceScore',
    'supplierPerformanceRecord',
    'contractCloseout',
    'contractTermination',
    'contractDispute',
    'contractIssue',
    'contractVariation',
    'contractRisk',
    'contractInspection',
    'goodsInspection',
    'contractAcceptance',
    'contractDeliverable',
    'contractKpi',
    'contractMobilizationItem',
    'contractManagementPlan',
    'contractMilestone',
    'contractNegotiation',
    'contractClause',
    'contractSignature',
    'contractVersion',
    'contractParty'
  ]) {
    await deleteIfIds(db, model, 'contractId', contractIds);
  }

  await deleteIfIds(db, 'contract', 'id', contractIds);

  await deleteIfIds(db, 'awardApprovalStep', 'recommendationId', recommendationIds);
  await deleteIfIds(db, 'awardApprovalRoute', 'recommendationId', recommendationIds);
  await deleteIfIds(db, 'awardTieBreaker', 'recommendationId', recommendationIds);
  await deleteIfIds(db, 'deliveryFeasibilityCheck', 'recommendationId', recommendationIds);
  await deleteIfIds(db, 'standstillPeriod', 'recommendationId', recommendationIds);
  await deleteIfIds(db, 'awardNotification', 'recommendationId', recommendationIds);
  await deleteIfIds(db, 'budgetCommitment', 'recommendationId', recommendationIds);
  await deleteIfIds(db, 'awardResponse', 'noticeId', []);
  if (recommendationIds.length) {
    const notices = await db.awardNotice.findMany({ where: { recommendationId: { in: recommendationIds } }, select: { id: true } });
    await deleteIfIds(
      db,
      'awardResponse',
      'noticeId',
      notices.map((item: { id: string }) => item.id)
    );
  }
  await deleteIfIds(db, 'awardNotice', 'recommendationId', recommendationIds);
  await deleteIfIds(db, 'awardBidPack', 'awardGroupId', awardGroupIds);
  await deleteIfIds(db, 'awardNegotiation', 'awardGroupId', awardGroupIds);
  await deleteIfIds(db, 'awardClause', 'awardGroupId', awardGroupIds);
  await deleteIfIds(db, 'awardWinner', 'awardGroupId', awardGroupIds);
  await deleteIfIds(db, 'awardGroup', 'id', awardGroupIds);
  await deleteIfIds(db, 'approvalStep', 'recommendationId', recommendationIds);
  await deleteIfIds(db, 'awardRecommendation', 'id', recommendationIds);

  await deleteIfIds(db, 'bidReceipt', 'bidId', bidIds);
  await deleteIfIds(db, 'bidResponse', 'bidId', bidIds);
  await deleteIfIds(db, 'bidDocument', 'bidId', bidIds);
  await deleteIfIds(db, 'bidVersion', 'bidId', bidIds);
  await deleteIfIds(db, 'bid', 'id', bidIds);
  await deleteIfIds(db, 'evaluationWorkspace', 'id', workspaceIds);
  await deleteIfIds(db, 'tender', 'id', tenderIds);
  await db.documentObject.deleteMany({ where: { objectKey: { startsWith: AWARD_CONTRACT_DEMO_PREFIX } } });
}

async function cleanupDemoActors(db: AnyDb) {
  const users = await db.user.findMany({ where: { email: { in: demoUserEmails } }, select: { id: true } });
  const userIds = users.map((item: { id: string }) => item.id);
  const organizations = await db.organization.findMany({ where: { name: { in: demoOrganizationNames } }, select: { id: true } });
  const organizationIds = organizations.map((item: { id: string }) => item.id);

  await deleteIfIds(db, 'trustTierHistory', 'userId', userIds);
  await deleteIfIds(db, 'trustTierHistory', 'organizationId', organizationIds);
  await deleteIfIds(db, 'permissionOverride', 'userId', userIds);
  await deleteIfIds(db, 'permissionOverride', 'organizationId', organizationIds);
  await deleteIfIds(db, 'session', 'userId', userIds);
  await deleteIfIds(db, 'identityChallenge', 'userId', userIds);
  await deleteIfIds(db, 'account', 'userId', userIds);
  await deleteIfIds(db, 'organizationMember', 'userId', userIds);
  await deleteIfIds(db, 'organizationMember', 'organizationId', organizationIds);
  await deleteIfIds(db, 'organizationCapability', 'organizationId', organizationIds);
  await deleteIfIds(db, 'buyerProfile', 'organizationId', organizationIds);
  await deleteIfIds(db, 'supplierProfile', 'organizationId', organizationIds);
  await deleteIfIds(db, 'organizationProfile', 'organizationId', organizationIds);
  await deleteIfIds(db, 'user', 'id', userIds);
  await deleteIfIds(db, 'organization', 'id', organizationIds);
}

async function upsertOrganization(db: AnyDb, name: string, kind: OrganizationKind, capabilities: OrganizationCapabilityName[]) {
  const org = await db.organization.upsert({
    where: { name },
    update: { kind, country: 'TZ', metadata: demoPayload({ seededActor: true }) },
    create: { name, kind, country: 'TZ', metadata: demoPayload({ seededActor: true }) }
  });
  for (const capability of capabilities) {
    await db.organizationCapability.upsert({
      where: { organizationId_capability: { organizationId: org.id, capability } },
      update: { enabled: true },
      create: { organizationId: org.id, capability, enabled: true }
    });
  }
  await db.organizationProfile.upsert({
    where: { organizationId: org.id },
    update: { summary: `${name} demo profile for awarding and contract lifecycle testing.`, payload: demoPayload() },
    create: { organizationId: org.id, summary: `${name} demo profile for awarding and contract lifecycle testing.`, payload: demoPayload() }
  });
  if (capabilities.includes(OrganizationCapabilityName.BUYER)) {
    await db.buyerProfile.upsert({
      where: { organizationId: org.id },
      update: { procuringType: 'Demo procuring entity', budgetCode: ref('BUDGET-GENERAL'), payload: demoPayload() },
      create: { organizationId: org.id, procuringType: 'Demo procuring entity', budgetCode: ref('BUDGET-GENERAL'), payload: demoPayload() }
    });
  }
  if (capabilities.includes(OrganizationCapabilityName.SUPPLIER)) {
    await db.supplierProfile.upsert({
      where: { organizationId: org.id },
      update: {
        trustTier: TrustTier.GOLD,
        riskLevel: RiskLevel.MEDIUM,
        bidLimit: 5000000000,
        categories: ['goods', 'works', 'services']
      },
      create: {
        organizationId: org.id,
        trustTier: TrustTier.GOLD,
        riskLevel: RiskLevel.MEDIUM,
        bidLimit: 5000000000,
        categories: ['goods', 'works', 'services']
      }
    });
  }
  return org;
}

function mergedDemoMetadata(current: unknown, extra: Record<string, unknown> = {}) {
  const currentObject = current && typeof current === 'object' && !Array.isArray(current) ? current as Record<string, unknown> : {};
  return {
    ...currentObject,
    ...demoPayload(extra)
  };
}

async function upsertMainDemoOrganization(db: AnyDb) {
  const existing = await db.organization.findUnique({ where: { name: MAIN_DEMO_ORGANIZATION_NAME } });
  const org = await db.organization.upsert({
    where: { name: MAIN_DEMO_ORGANIZATION_NAME },
    update: {
      kind: OrganizationKind.COMPANY,
      country: 'TZ',
      metadata: mergedDemoMetadata(existing?.metadata, {
        demoAccount: true,
        seededAwardContractDemo: true,
        entityType: 'company',
        registrySource: 'BRELA',
        registryNumber: '123456789'
      })
    },
    create: {
      name: MAIN_DEMO_ORGANIZATION_NAME,
      kind: OrganizationKind.COMPANY,
      country: 'TZ',
      metadata: demoPayload({
        demoAccount: true,
        seededAwardContractDemo: true,
        entityType: 'company',
        registrySource: 'BRELA',
        registryNumber: '123456789'
      })
    }
  });

  for (const capability of [OrganizationCapabilityName.BUYER, OrganizationCapabilityName.SUPPLIER]) {
    await db.organizationCapability.upsert({
      where: { organizationId_capability: { organizationId: org.id, capability } },
      update: { enabled: true },
      create: { organizationId: org.id, capability, enabled: true }
    });
  }

  await db.organizationProfile.upsert({
    where: { organizationId: org.id },
    update: {
      summary: 'Verified demo organization with awardable tenders and contract lifecycle records.',
      payload: mergedDemoMetadata(undefined, { demoAccount: true, seededAwardContractDemo: true })
    },
    create: {
      organizationId: org.id,
      summary: 'Verified demo organization with awardable tenders and contract lifecycle records.',
      payload: demoPayload({ demoAccount: true, seededAwardContractDemo: true })
    }
  });

  await db.buyerProfile.upsert({
    where: { organizationId: org.id },
    update: { procuringType: 'Demo procuring entity', budgetCode: ref('BUDGET-GENERAL'), payload: demoPayload({ demoAccount: true }) },
    create: { organizationId: org.id, procuringType: 'Demo procuring entity', budgetCode: ref('BUDGET-GENERAL'), payload: demoPayload({ demoAccount: true }) }
  });

  await db.supplierProfile.upsert({
    where: { organizationId: org.id },
    update: {
      trustTier: TrustTier.PLATINUM,
      riskLevel: RiskLevel.LOW,
      bidLimit: 999999999999,
      categories: ['goods', 'works', 'services', 'consultancy']
    },
    create: {
      organizationId: org.id,
      trustTier: TrustTier.PLATINUM,
      riskLevel: RiskLevel.LOW,
      bidLimit: 999999999999,
      categories: ['goods', 'works', 'services', 'consultancy']
    }
  });

  return org;
}

async function upsertUser(db: AnyDb, org: any, email: string, displayName: string, title: string, accountType: AccountType = AccountType.USER) {
  const user = await db.user.upsert({
    where: { email },
    update: {
      displayName,
      accountType,
      verificationStatus: VerificationStatus.APPROVED,
      passwordHash: await hashSeedPassword(accountType === AccountType.ADMIN ? 'Admin123!' : 'Demo123!'),
      metadata: demoPayload({ phoneVerified: true, emailVerified: true })
    },
    create: {
      email,
      phone: `+2557${Math.floor(10000000 + Math.random() * 89999999)}`,
      displayName,
      accountType,
      verificationStatus: VerificationStatus.APPROVED,
      passwordHash: await hashSeedPassword(accountType === AccountType.ADMIN ? 'Admin123!' : 'Demo123!'),
      metadata: demoPayload({ phoneVerified: true, emailVerified: true })
    }
  });
  await db.account.upsert({
    where: { provider_providerUserId: { provider: 'password', providerUserId: email } },
    update: { accountType },
    create: { userId: user.id, provider: 'password', providerUserId: email, accountType }
  });
  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: { status: 'ACTIVE', isDefault: true, title },
    create: { organizationId: org.id, userId: user.id, status: 'ACTIVE', isDefault: true, title }
  });
  return user;
}

async function upsertMainDemoUser(db: AnyDb, org: any) {
  const existing = await db.user.findUnique({ where: { email: MAIN_DEMO_USER_EMAIL } });
  const user = await db.user.upsert({
    where: { email: MAIN_DEMO_USER_EMAIL },
    update: {
      displayName: 'Demo Verified User',
      accountType: AccountType.USER,
      verificationStatus: VerificationStatus.APPROVED,
      passwordHash: await hashSeedPassword('Demo123!'),
      metadata: mergedDemoMetadata(existing?.metadata, {
        phoneVerified: true,
        emailVerified: true,
        demoAccount: true,
        seededAwardContractDemo: true,
        verifiedName: MAIN_DEMO_ORGANIZATION_NAME
      })
    },
    create: {
      email: MAIN_DEMO_USER_EMAIL,
      phone: '+255713333444',
      displayName: 'Demo Verified User',
      accountType: AccountType.USER,
      verificationStatus: VerificationStatus.APPROVED,
      passwordHash: await hashSeedPassword('Demo123!'),
      metadata: demoPayload({
        phoneVerified: true,
        emailVerified: true,
        demoAccount: true,
        seededAwardContractDemo: true,
        verifiedName: MAIN_DEMO_ORGANIZATION_NAME
      })
    }
  });

  await db.account.upsert({
    where: { provider_providerUserId: { provider: 'password', providerUserId: MAIN_DEMO_USER_EMAIL } },
    update: { accountType: AccountType.USER },
    create: { userId: user.id, provider: 'password', providerUserId: MAIN_DEMO_USER_EMAIL, accountType: AccountType.USER }
  });

  await db.organizationMember.upsert({
    where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
    update: { status: 'ACTIVE', isDefault: true, title: 'Demo verified operator' },
    create: { organizationId: org.id, userId: user.id, status: 'ACTIVE', isDefault: true, title: 'Demo verified operator' }
  });

  return user;
}

async function createActors(db: AnyDb) {
  const mainOrg = await upsertMainDemoOrganization(db);
  const externalBuyerOrg = await upsertOrganization(db, 'PX Demo External Buyer Authority', OrganizationKind.COMPANY, [OrganizationCapabilityName.BUYER]);
  const supplierOrgs = {
    accepted: await upsertOrganization(db, 'PX Demo Accepted Supplier Ltd', OrganizationKind.COMPANY, [OrganizationCapabilityName.SUPPLIER]),
    declined: await upsertOrganization(db, 'PX Demo Declined Supplier Ltd', OrganizationKind.COMPANY, [OrganizationCapabilityName.SUPPLIER]),
    risky: await upsertOrganization(db, 'PX Demo Risky Supplier Ltd', OrganizationKind.COMPANY, [OrganizationCapabilityName.SUPPLIER]),
    terminated: await upsertOrganization(db, 'PX Demo Terminated Supplier Ltd', OrganizationKind.COMPANY, [OrganizationCapabilityName.SUPPLIER]),
    closed: await upsertOrganization(db, 'PX Demo Closed Supplier Ltd', OrganizationKind.COMPANY, [OrganizationCapabilityName.SUPPLIER])
  };

  const demoUser = await upsertMainDemoUser(db, mainOrg);
  const mainActor = { org: mainOrg, user: demoUser };
  const externalBuyerActor = { org: externalBuyerOrg, user: demoUser };

  return {
    admin: mainActor,
    buyer: mainActor,
    externalBuyer: externalBuyerActor,
    manager: mainActor,
    legal: mainActor,
    finance: mainActor,
    technical: mainActor,
    suppliers: {
      self: mainActor,
      accepted: { org: supplierOrgs.accepted, user: demoUser },
      declined: { org: supplierOrgs.declined, user: demoUser },
      risky: { org: supplierOrgs.risky, user: demoUser },
      terminated: { org: supplierOrgs.terminated, user: demoUser },
      closed: { org: supplierOrgs.closed, user: demoUser }
    }
  };
}

function tenderTypeFor(procurementType: DemoScenario['procurementType']) {
  if (procurementType === 'GOODS') return TenderType.GOODS;
  if (procurementType === 'WORKS') return TenderType.WORKS;
  if (procurementType === 'CONSULTANCY') return TenderType.CONSULTANCY;
  return TenderType.SERVICE;
}

function buyerForScenario(actors: Awaited<ReturnType<typeof createActors>>, scenario: DemoScenario) {
  return scenario.buyer ?? actors.buyer;
}

async function createDocument(db: AnyDb, ownerOrgId: string, uploadedByUserId: string, key: string, name: string, documentType: string) {
  return db.documentObject.upsert({
    where: { objectKey: ref(`DOC-${key}`) },
    update: {
      ownerOrgId,
      uploadedByUserId,
      name,
      documentType,
      checksum: `demo-${key}`,
      metadata: demoPayload({ documentKey: key })
    },
    create: {
      ownerOrgId,
      uploadedByUserId,
      name,
      objectKey: ref(`DOC-${key}`),
      documentType,
      checksum: `demo-${key}`,
      metadata: demoPayload({ documentKey: key })
    }
  });
}

async function seedBidDocuments(db: AnyDb, bid: any, supplier: DemoActor, key: string) {
  const documents = [
    { suffix: 'ELIGIBILITY', name: 'Eligibility and registration pack.pdf', documentType: 'BID_ELIGIBILITY', envelope: EnvelopeType.COMBINED },
    { suffix: 'TECHNICAL', name: 'Technical methodology and delivery plan.pdf', documentType: 'BID_TECHNICAL', envelope: EnvelopeType.TECHNICAL },
    { suffix: 'FINANCIAL', name: 'Priced BOQ and financial offer.pdf', documentType: 'BID_FINANCIAL', envelope: EnvelopeType.FINANCIAL }
  ];
  for (const document of documents) {
    const object = await createDocument(db, supplier.org.id, supplier.user.id, `BID-${key}-${document.suffix}`, `${bid.reference} ${document.name}`, document.documentType);
    await db.bidDocument.create({
      data: {
        bidId: bid.id,
        documentId: object.id,
        envelope: document.envelope,
        reviewStatus: DocumentReviewStatus.VERIFIED
      }
    });
  }
}

async function createAwardBase(db: AnyDb, actors: Awaited<ReturnType<typeof createActors>>, scenario: DemoScenario, recommendationStatus: RecommendationStatus) {
  const buyer = buyerForScenario(actors, scenario);
  const tenderReference = ref(`TENDER-${scenario.key}`);
  const bidReference = ref(`BID-${scenario.key}`);
  const tender = await db.tender.create({
    data: {
      reference: tenderReference,
      buyerOrgId: buyer.org.id,
      ownerUserId: buyer.user.id,
      title: scenario.title,
      description: `${scenario.procurementType} demo tender for ${scenario.status} lifecycle testing.`,
      type: tenderTypeFor(scenario.procurementType),
      status: recommendationStatus === RecommendationStatus.APPROVED ? TenderStatus.AWARDED : TenderStatus.EVALUATION,
      method: ProcurementMethod.OPEN_TENDER,
      visibility: Visibility.PUBLIC_MARKETPLACE,
      budget: scenario.amount * 1.1,
      currency: 'TZS',
      location: 'Dar es Salaam',
      contractType: scenario.procurementType === 'CONSULTANCY' ? ContractType.TIME_AND_MATERIALS : ContractType.LUMP_SUM,
      closingDate: daysFromNow(-30),
      publishedAt: daysFromNow(-60),
      requirements: demoPayload({ procurementType: scenario.procurementType }),
      metadata: demoPayload({ procurementType: scenario.procurementType, scenarioKey: scenario.key })
    }
  });
  await db.tenderMilestone.createMany({
    data: [
      { tenderId: tender.id, name: 'Award recommendation', dueDate: daysFromNow(-10), payload: demoPayload({ phase: 'award' }) },
      { tenderId: tender.id, name: 'Contract completion', dueDate: daysFromNow(90), payload: demoPayload({ phase: 'delivery' }) }
    ]
  });
  await db.tenderCommercialItem.create({
    data: {
      tenderId: tender.id,
      itemNo: '1',
      description: `${scenario.procurementType} main scope`,
      quantity: 1,
      unit: 'lot',
      rate: scenario.amount,
      total: scenario.amount,
      payload: demoPayload()
    }
  });

  const bid = await db.bid.create({
    data: {
      tenderId: tender.id,
      buyerOrgId: buyer.org.id,
      supplierOrgId: scenario.supplier.org.id,
      submittedByUserId: scenario.supplier.user.id,
      reference: bidReference,
      status: recommendationStatus === RecommendationStatus.APPROVED ? BidStatus.AWARDED : BidStatus.UNDER_EVALUATION,
      submittedAt: daysFromNow(-25),
      totalAmount: scenario.amount,
      currency: 'TZS',
      payload: demoPayload({ scenarioKey: scenario.key, procurementType: scenario.procurementType })
    }
  });
  await db.bidVersion.create({
    data: { bidId: bid.id, versionNo: 1, envelope: EnvelopeType.COMBINED, sealedHash: ref(`HASH-${scenario.key}`), payload: demoPayload({ version: 1 }) }
  });
  await db.bidReceipt.create({
    data: { bidId: bid.id, receiptRef: ref(`RECEIPT-${scenario.key}`), receiptHash: ref(`RECEIPT-HASH-${scenario.key}`) }
  });
  await seedBidDocuments(db, bid, scenario.supplier, scenario.key);
  const workspace = await db.evaluationWorkspace.create({
    data: {
      tenderId: tender.id,
      buyerOrgId: buyer.org.id,
      status: EvaluationStatus.COMPLETED,
      currentStage: EvaluationStage.RECOMMENDATION,
      progress: 100,
      payload: demoPayload({ scenarioKey: scenario.key })
    }
  });
  await db.workflowAssignment.createMany({
    data: [
      { workspaceId: workspace.id, userId: actors.technical.user.id, assignment: WorkflowAssignmentType.EVALUATOR, status: 'ACTIVE', payload: demoPayload() },
      { workspaceId: workspace.id, userId: actors.buyer.user.id, assignment: WorkflowAssignmentType.APPROVER, status: 'ACTIVE', payload: demoPayload() }
    ]
  });
  const criterion = await db.evaluationCriterion.create({
    data: { workspaceId: workspace.id, stage: EvaluationStage.FINANCIAL, name: 'Evaluated price and responsiveness', weight: 100, maxScore: 100, payload: demoPayload() }
  });
  await db.evaluationScore.create({
    data: {
      workspaceId: workspace.id,
      criterionId: criterion.id,
      bidId: bid.id,
      evaluatorUserId: actors.technical.user.id,
      score: scenario.status === ContractStatus.AT_RISK ? 72 : 88,
      comment: 'Seeded evaluation score for award and contract lifecycle testing.',
      lockedAt: daysFromNow(-12),
      payload: demoPayload()
    }
  });
  const recommendation = await db.awardRecommendation.create({
    data: {
      reference: ref(`AWD-${scenario.key}`),
      workspaceId: workspace.id,
      bidId: bid.id,
      supplierOrgId: scenario.supplier.org.id,
      status: recommendationStatus,
      amount: scenario.amount,
      currency: 'TZS',
      reason: `${scenario.title} recommended for ${scenario.supplier.org.name}.`,
      payload: demoPayload({ scenarioKey: scenario.key, contractStatus: scenario.status, procurementType: scenario.procurementType })
    }
  });
  return { tender, bid, workspace, criterion, recommendation };
}

async function createSiblingAwardRecommendation(
  db: AnyDb,
  actors: Awaited<ReturnType<typeof createActors>>,
  base: Awaited<ReturnType<typeof createAwardBase>>,
  supplier: DemoActor,
  key: string,
  amount: number,
  status: RecommendationStatus
) {
  const bid = await db.bid.create({
    data: {
      tenderId: base.tender.id,
      buyerOrgId: base.tender.buyerOrgId,
      supplierOrgId: supplier.org.id,
      submittedByUserId: supplier.user.id,
      reference: ref(`BID-${key}`),
      status: status === RecommendationStatus.APPROVED ? BidStatus.AWARDED : BidStatus.UNDER_EVALUATION,
      submittedAt: daysFromNow(-24),
      totalAmount: amount,
      currency: 'TZS',
      payload: demoPayload({ scenarioKey: key, groupedAward: true })
    }
  });
  await db.bidVersion.create({
    data: { bidId: bid.id, versionNo: 1, envelope: EnvelopeType.COMBINED, sealedHash: ref(`HASH-${key}`), payload: demoPayload({ version: 1, groupedAward: true }) }
  });
  await db.bidReceipt.create({
    data: { bidId: bid.id, receiptRef: ref(`RECEIPT-${key}`), receiptHash: ref(`RECEIPT-HASH-${key}`) }
  });
  await seedBidDocuments(db, bid, supplier, key);
  await db.evaluationScore.create({
    data: {
      workspaceId: base.workspace.id,
      criterionId: base.criterion.id,
      bidId: bid.id,
      evaluatorUserId: actors.technical.user.id,
      score: status === RecommendationStatus.APPROVED ? 91 : 84,
      comment: 'Seeded grouped award score for multi-winner testing.',
      lockedAt: daysFromNow(-11),
      payload: demoPayload({ groupedAward: true })
    }
  });
  const recommendation = await db.awardRecommendation.create({
    data: {
      reference: ref(`AWD-${key}`),
      workspaceId: base.workspace.id,
      bidId: bid.id,
      supplierOrgId: supplier.org.id,
      status,
      amount,
      currency: 'TZS',
      reason: `${base.tender.title} grouped winner for ${supplier.org.name}.`,
      payload: demoPayload({ scenarioKey: key, groupedAward: true })
    }
  });
  return { tender: base.tender, bid, workspace: base.workspace, criterion: base.criterion, recommendation };
}

async function seedAwardSideRecords(db: AnyDb, actors: Awaited<ReturnType<typeof createActors>>, base: Awaited<ReturnType<typeof createAwardBase>>, index: number) {
  const route = await db.awardApprovalRoute.create({
    data: {
      recommendationId: base.recommendation.id,
      routeKey: 'single-user-award-approval',
      title: 'Single-user award approval',
      status: index % 3 === 0 ? 'APPROVED' : index % 3 === 1 ? 'PENDING' : 'DRAFT',
      currentStepOrder: 1,
      requiredQuorum: 1,
      note: 'Seeded single-user award approval history.',
      payload: demoPayload({ hidden: true, model: 'single-user', actorUserId: actors.buyer.user.id })
    }
  });
  await db.awardApprovalStep.createMany({
    data: [
      {
        routeId: route.id,
        recommendationId: base.recommendation.id,
        stepOrder: 1,
        stepKey: 'award-owner-approval',
        role: 'AWARD_OWNER',
        actorUserId: actors.buyer.user.id,
        status: index % 3 === 2 ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED,
        dueDate: daysFromNow(-5),
        decidedAt: index % 3 === 2 ? null : daysFromNow(-4),
        note: 'Award owner approval seeded.',
        payload: demoPayload({ hidden: true, model: 'single-user' })
      }
    ]
  });
  await db.approvalStep.createMany({
    data: [
      {
        recommendationId: base.recommendation.id,
        actorUserId: actors.buyer.user.id,
        assignment: WorkflowAssignmentType.APPROVER,
        status: index % 3 === 2 ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED,
        action: 'award-owner-approval',
        decidedAt: index % 3 === 2 ? null : daysFromNow(-4),
        payload: demoPayload({ model: 'single-user' })
      }
    ]
  });
  await db.awardTieBreaker.create({
    data: {
      recommendationId: base.recommendation.id,
      tenderId: base.tender.id,
      triggerReason: 'Two technically responsive bids were within one percent of evaluated price.',
      method: index % 2 === 0 ? 'Best delivery capacity' : 'Lowest lifecycle cost',
      criteria: [{ criterion: 'delivery', weight: 60 }, { criterion: 'warranty', weight: 40 }],
      outcomeBidId: base.bid.id,
      status: index % 2 === 0 ? 'RESOLVED' : 'OPEN',
      decidedByUserId: index % 2 === 0 ? actors.buyer.user.id : null,
      decidedAt: index % 2 === 0 ? daysFromNow(-3) : null,
      note: 'Seeded tie-breaker for award workflow testing.',
      payload: demoPayload()
    }
  });
  await db.deliveryFeasibilityCheck.create({
    data: {
      recommendationId: base.recommendation.id,
      tenderId: base.tender.id,
      bidId: base.bid.id,
      supplierOrgId: base.recommendation.supplierOrgId,
      deliveryCapacity: 'Confirmed equipment, personnel, and logistics plan.',
      siteReadiness: index % 4 === 0 ? 'Site handover requires buyer action.' : 'Site ready.',
      resourcePlan: 'Named delivery manager, weekly reporting, escalation channel.',
      riskRating: index % 4 === 0 ? 'HIGH' : 'LOW',
      status: index % 4 === 0 ? 'PENDING' : 'APPROVED',
      reviewerUserId: actors.technical.user.id,
      reviewedAt: daysFromNow(-3),
      note: 'Seeded feasibility check.',
      payload: demoPayload()
    }
  });
}

async function createNoticeAndContract(
  db: AnyDb,
  actors: Awaited<ReturnType<typeof createActors>>,
  scenario: DemoScenario,
  base: Awaited<ReturnType<typeof createAwardBase>>,
  noticeStatus: AwardNoticeStatus
) {
  const buyer = buyerForScenario(actors, scenario);
  const contract = await db.contract.create({
    data: {
      reference: ref(`CONTRACT-${scenario.key}`),
      tenderId: base.tender.id,
      awardId: base.recommendation.id,
      buyerOrgId: buyer.org.id,
      supplierOrgId: scenario.supplier.org.id,
      title: scenario.title.replace('Tender', 'Contract'),
      status: scenario.status,
      amount: scenario.amount,
      currency: 'TZS',
      payload: demoPayload({ scenarioKey: scenario.key, procurementType: scenario.procurementType, activationChecks: ['CMP', 'milestones', 'documents', 'mobilization'] })
    }
  });
  const notice = await db.awardNotice.create({
    data: {
      reference: ref(`NOTICE-${scenario.key}`),
      recommendationId: base.recommendation.id,
      buyerOrgId: buyer.org.id,
      supplierOrgId: scenario.supplier.org.id,
      contractId: contract.id,
      issuedByUserId: buyer.user.id,
      respondedByUserId: noticeStatus === AwardNoticeStatus.PENDING_RESPONSE ? null : scenario.supplier.user.id,
      status: noticeStatus,
      buyerNote: 'Intent to award issued from demo seed.',
      supplierNote: noticeStatus === AwardNoticeStatus.ACCEPTED ? 'Award accepted. Proceed to contract.' : noticeStatus === AwardNoticeStatus.DECLINED ? 'Supplier declined due to capacity.' : '',
      issuedAt: daysFromNow(-7),
      respondedAt: noticeStatus === AwardNoticeStatus.PENDING_RESPONSE ? null : daysFromNow(-6),
      payload: demoPayload({ scenarioKey: scenario.key })
    }
  });
  if (noticeStatus !== AwardNoticeStatus.PENDING_RESPONSE) {
    await db.awardResponse.create({
      data: {
        noticeId: notice.id,
        actorUserId: scenario.supplier.user.id,
        actorOrgId: scenario.supplier.org.id,
        action: noticeStatus === AwardNoticeStatus.DECLINED ? AwardResponseAction.DECLINE : noticeStatus === AwardNoticeStatus.CLARIFICATION_REQUESTED ? AwardResponseAction.REQUEST_CLARIFICATION : AwardResponseAction.ACCEPT,
        note: noticeStatus === AwardNoticeStatus.CLARIFICATION_REQUESTED ? 'Please clarify performance security wording.' : 'Seeded supplier response.',
        payload: demoPayload()
      }
    });
  }
  await db.standstillPeriod.create({
    data: {
      recommendationId: base.recommendation.id,
      noticeId: notice.id,
      buyerOrgId: buyer.org.id,
      supplierOrgId: scenario.supplier.org.id,
      startsAt: daysFromNow(-7),
      endsAt: scenario.status === ContractStatus.DRAFT ? daysFromNow(3) : daysFromNow(-1),
      days: 7,
      status: scenario.status === ContractStatus.DRAFT ? 'ACTIVE' : scenario.status === ContractStatus.SIGNATURE_PENDING ? 'WAIVED' : 'EXPIRED',
      waived: scenario.status === ContractStatus.SIGNATURE_PENDING,
      waiverReason: scenario.status === ContractStatus.SIGNATURE_PENDING ? 'Urgent public interest delivery.' : null,
      payload: demoPayload()
    }
  });
  await db.awardNotification.createMany({
    data: [
      {
        recommendationId: base.recommendation.id,
        noticeId: notice.id,
        recipientOrgId: scenario.supplier.org.id,
        channel: 'IN_APP',
        notificationType: 'AWARD_NOTICE',
        subject: `Award notice for ${scenario.title}`,
        body: 'Open the award response workspace to accept, clarify, or decline.',
        status: noticeStatus === AwardNoticeStatus.PENDING_RESPONSE ? 'SENT' : 'READ',
        sentAt: daysFromNow(-7),
        payload: demoPayload()
      },
      {
        recommendationId: base.recommendation.id,
        noticeId: notice.id,
        recipientOrgId: buyer.org.id,
        channel: 'EMAIL',
        notificationType: 'BUYER_COPY',
        subject: `Buyer copy: ${scenario.title}`,
        body: 'Award notification generated by demo seed.',
        status: 'SENT',
        sentAt: daysFromNow(-7),
        payload: demoPayload()
      }
    ]
  });
  await db.budgetCommitment.create({
    data: {
      recommendationId: base.recommendation.id,
      tenderId: base.tender.id,
      contractId: contract.id,
      buyerOrgId: buyer.org.id,
      commitmentNo: ref(`BC-${scenario.key}`),
      budgetCode: ref(`BUDGET-${scenario.procurementType}`),
      amount: scenario.amount,
      currency: 'TZS',
      status: scenario.status === ContractStatus.TERMINATION_REVIEW ? 'HELD' : 'RESERVED',
      reservedAt: daysFromNow(-7),
      approvedByUserId: actors.finance.user.id,
      note: 'Seeded commitment for budget gating.',
      payload: demoPayload()
    }
  });
  return { contract, notice };
}

async function seedContractCore(db: AnyDb, actors: Awaited<ReturnType<typeof createActors>>, scenario: DemoScenario, contract: any, rich = false) {
  const buyer = buyerForScenario(actors, scenario);
  await db.contractParty.createMany({
    data: [
      {
        contractId: contract.id,
        role: ContractPartyRole.BUYER,
        organizationId: buyer.org.id,
        displayName: buyer.org.name,
        contactName: actors.manager.user.displayName,
        contactEmail: actors.manager.user.email,
        signatoryName: buyer.user.displayName,
        signatoryTitle: 'Accounting officer',
        payload: demoPayload()
      },
      {
        contractId: contract.id,
        role: ContractPartyRole.SUPPLIER,
        organizationId: scenario.supplier.org.id,
        displayName: scenario.supplier.org.name,
        contactName: scenario.supplier.user.displayName,
        contactEmail: scenario.supplier.user.email,
        signatoryName: scenario.supplier.user.displayName,
        signatoryTitle: 'Authorized representative',
        payload: demoPayload()
      }
    ]
  });
  const generalClause = await db.contractClause.create({
    data: {
      contractId: contract.id,
      clauseKey: 'general-conditions',
      title: 'General conditions',
      body: 'Supplier shall deliver the contracted scope in accordance with the agreed specifications.',
      category: 'general',
      status: scenario.status === ContractStatus.NEGOTIATION ? ContractLifecycleItemStatus.IN_PROGRESS : ContractLifecycleItemStatus.APPROVED,
      buyerComment: 'Buyer clause accepted.',
      supplierComment: scenario.status === ContractStatus.NEGOTIATION ? 'Supplier requests wording adjustment.' : 'Supplier accepted.',
      legalComment: 'Legal review seeded.',
      payload: demoPayload()
    }
  });
  await db.contractClause.create({
    data: {
      contractId: contract.id,
      clauseKey: 'payment-terms',
      title: 'Payment terms',
      body: 'Payment after acceptance and invoice approval, less retention where applicable.',
      category: 'payment',
      status: ContractLifecycleItemStatus.OPEN,
      payload: demoPayload({ retentionPercent: 10 })
    }
  });
  await db.contractNegotiation.create({
    data: {
      contractId: contract.id,
      clauseId: generalClause.id,
      raisedByRole: scenario.status === ContractStatus.NEGOTIATION ? 'SUPPLIER' : 'BUYER',
      raisedByOrgId: scenario.supplier.org.id,
      subject: 'Clarify delivery and payment wording',
      position: 'Supplier proposes milestone-linked acceptance wording.',
      counterOffer: 'Buyer accepts with inspection certificate condition.',
      status: scenario.status === ContractStatus.NEGOTIATION ? ContractLifecycleItemStatus.IN_PROGRESS : ContractLifecycleItemStatus.CLOSED,
      dueDate: daysFromNow(2),
      payload: demoPayload()
    }
  });
  const draftDoc = await createDocument(db, buyer.org.id, buyer.user.id, `VERSION-${scenario.key}`, `${contract.reference} draft contract.pdf`, 'CONTRACT_DRAFT');
  await db.contractVersion.createMany({
    data: [
      { contractId: contract.id, versionNo: 1, documentId: draftDoc.id, payload: demoPayload({ generatedFrom: 'award-acceptance', clauses: ['general-conditions', 'payment-terms'] }) },
      ...(rich ? [{ contractId: contract.id, versionNo: 2, documentId: draftDoc.id, payload: demoPayload({ generatedFrom: 'negotiation', change: 'Payment retention clarified' }) }] : [])
    ]
  });
  await db.contractSignature.createMany({
    data: [
      {
        contractId: contract.id,
        signerUserId: scenario.status === ContractStatus.SIGNATURE_PENDING ? null : buyer.user.id,
        signerOrgId: buyer.org.id,
        role: ContractPartyRole.BUYER,
        status: scenario.status === ContractStatus.DRAFT || scenario.status === ContractStatus.NEGOTIATION ? SignatureStatus.PENDING : SignatureStatus.SIGNED,
        signerName: scenario.status === ContractStatus.DRAFT || scenario.status === ContractStatus.NEGOTIATION ? null : buyer.user.displayName,
        signerTitle: 'Accounting officer',
        signedAt: scenario.status === ContractStatus.DRAFT || scenario.status === ContractStatus.NEGOTIATION ? null : daysFromNow(-5),
        payload: demoPayload()
      },
      {
        contractId: contract.id,
        signerUserId: scenario.status === ContractStatus.SIGNATURE_PENDING ? null : scenario.supplier.user.id,
        signerOrgId: scenario.supplier.org.id,
        role: ContractPartyRole.SUPPLIER,
        status: scenario.status === ContractStatus.SIGNATURE_PENDING ? SignatureStatus.PENDING : scenario.status === ContractStatus.DRAFT || scenario.status === ContractStatus.NEGOTIATION ? SignatureStatus.PENDING : SignatureStatus.SIGNED,
        signerName: scenario.status === ContractStatus.SIGNATURE_PENDING || scenario.status === ContractStatus.DRAFT || scenario.status === ContractStatus.NEGOTIATION ? null : scenario.supplier.user.displayName,
        signerTitle: 'Authorized representative',
        signedAt: scenario.status === ContractStatus.SIGNATURE_PENDING || scenario.status === ContractStatus.DRAFT || scenario.status === ContractStatus.NEGOTIATION ? null : daysFromNow(-4),
        payload: demoPayload()
      }
    ]
  });
}

async function seedContractDelivery(db: AnyDb, actors: Awaited<ReturnType<typeof createActors>>, scenario: DemoScenario, contract: any, rich = false) {
  await db.contractManagementPlan.create({
    data: {
      contractId: contract.id,
      contractManagerId: actors.manager.user.id,
      objectives: 'Deliver scope on time, within budget, and with auditable acceptance evidence.',
      monitoringPlan: 'Weekly progress review, milestone inspection, risk log review.',
      reportingPlan: 'Monthly buyer report with supplier response tracking.',
      communicationPlan: 'Formal notices through ProcureX communication center.',
      payload: demoPayload({ meetingCadence: 'weekly' })
    }
  });
  await db.contractMobilizationItem.createMany({
    data: [
      {
        contractId: contract.id,
        category: scenario.procurementType.toLowerCase(),
        title: 'Kick-off meeting',
        responsibleRole: 'BUYER',
        status: scenario.status === ContractStatus.MOBILIZATION ? ContractLifecycleItemStatus.IN_PROGRESS : ContractLifecycleItemStatus.APPROVED,
        required: true,
        dueDate: daysFromNow(scenario.status === ContractStatus.MOBILIZATION ? 1 : -3),
        completedAt: scenario.status === ContractStatus.MOBILIZATION ? null : daysFromNow(-3),
        note: 'Category-specific mobilization seeded.',
        payload: demoPayload()
      },
      {
        contractId: contract.id,
        category: 'documents',
        title: 'Performance security',
        responsibleRole: 'SUPPLIER',
        status: scenario.status === ContractStatus.MOBILIZATION ? ContractLifecycleItemStatus.OPEN : ContractLifecycleItemStatus.WAIVED,
        required: true,
        dueDate: daysFromNow(2),
        waivedAt: scenario.status === ContractStatus.MOBILIZATION ? null : daysFromNow(-2),
        note: scenario.status === ContractStatus.MOBILIZATION ? 'Awaiting supplier submission.' : 'Waived for demo testing.',
        payload: demoPayload()
      }
    ]
  });
  await db.contractKpi.createMany({
    data: [
      { contractId: contract.id, area: 'time', title: 'Milestones delivered on time', target: '95%', status: ContractLifecycleItemStatus.OPEN, score: 82, payload: demoPayload() },
      { contractId: contract.id, area: 'quality', title: 'Accepted without major defects', target: '98%', status: ContractLifecycleItemStatus.OPEN, score: scenario.status === ContractStatus.AT_RISK ? 61 : 90, payload: demoPayload() }
    ]
  });
  const milestone1 = await db.contractMilestone.create({
    data: {
      contractId: contract.id,
      title: 'Mobilization complete',
      description: 'Supplier mobilized and readiness confirmed.',
      status: scenario.status === ContractStatus.MOBILIZATION ? ContractMilestoneStatus.IN_PROGRESS : ContractMilestoneStatus.COMPLETED,
      dueDate: daysFromNow(scenario.status === ContractStatus.MOBILIZATION ? 2 : -2),
      completedAt: scenario.status === ContractStatus.MOBILIZATION ? null : daysFromNow(-2),
      amount: scenario.amount * 0.2,
      currency: 'TZS',
      payload: demoPayload()
    }
  });
  const milestone2 = await db.contractMilestone.create({
    data: {
      contractId: contract.id,
      title: 'Main delivery and acceptance',
      description: 'Main scope delivered, inspected, and accepted.',
      status: scenario.status === ContractStatus.COMPLETED || scenario.status === ContractStatus.CLOSED ? ContractMilestoneStatus.ACCEPTED : ContractMilestoneStatus.SUBMITTED,
      dueDate: daysFromNow(rich ? 0 : 15),
      amount: scenario.amount * 0.8,
      currency: 'TZS',
      payload: demoPayload()
    }
  });
  const evidenceDoc = await createDocument(db, scenario.supplier.org.id, scenario.supplier.user.id, `MILESTONE-${scenario.key}`, `${contract.reference} delivery evidence.pdf`, 'MILESTONE_EVIDENCE');
  await db.contractMilestoneEvidence.create({
    data: {
      milestoneId: milestone2.id,
      documentId: evidenceDoc.id,
      uploadedByUserId: scenario.supplier.user.id,
      uploaderOrgId: scenario.supplier.org.id,
      note: 'Seeded milestone evidence.'
    }
  });
  const deliverable = await db.contractDeliverable.create({
    data: {
      contractId: contract.id,
      milestoneId: milestone2.id,
      title: `${scenario.procurementType} delivery package`,
      description: 'Supplier-submitted deliverable for buyer review.',
      submittedByOrgId: scenario.supplier.org.id,
      status: rich ? ContractLifecycleItemStatus.SUBMITTED : ContractLifecycleItemStatus.APPROVED,
      dueDate: daysFromNow(rich ? 0 : -1),
      submittedAt: daysFromNow(-1),
      acceptanceNote: rich ? null : 'Accepted after inspection.',
      payload: demoPayload()
    }
  });
  const inspection = await db.contractInspection.create({
    data: {
      contractId: contract.id,
      milestoneId: milestone2.id,
      inspectionType: scenario.procurementType === 'WORKS' ? 'SITE' : scenario.procurementType === 'GOODS' ? 'GOODS_RECEIPT' : 'DELIVERABLE_REVIEW',
      title: 'Buyer inspection',
      result: scenario.status === ContractStatus.AT_RISK ? ContractLifecycleItemStatus.REJECTED : ContractLifecycleItemStatus.APPROVED,
      inspectedAt: daysFromNow(-1),
      inspectorUserId: actors.technical.user.id,
      note: scenario.status === ContractStatus.AT_RISK ? 'Defects found; corrective action required.' : 'Inspection accepted.',
      payload: demoPayload()
    }
  });
  await db.goodsInspection.create({
    data: {
      contractId: contract.id,
      milestoneId: milestone2.id,
      deliverableId: deliverable.id,
      inspectionNo: ref(`GI-${scenario.key}`),
      goodsDescription: scenario.procurementType === 'GOODS' ? 'Medical supply kits' : `${scenario.procurementType} acceptance sample`,
      quantityOrdered: 100,
      quantityReceived: scenario.status === ContractStatus.AT_RISK ? 92 : 100,
      quantityAccepted: scenario.status === ContractStatus.AT_RISK ? 80 : 100,
      quantityRejected: scenario.status === ContractStatus.AT_RISK ? 12 : 0,
      unit: 'units',
      location: 'Central stores',
      result: scenario.status === ContractStatus.AT_RISK ? ContractLifecycleItemStatus.REJECTED : ContractLifecycleItemStatus.APPROVED,
      inspectedByUserId: actors.technical.user.id,
      inspectedAt: daysFromNow(-1),
      defects: scenario.status === ContractStatus.AT_RISK ? [{ type: 'quality', quantity: 12, severity: 'major' }] : [],
      note: 'Seeded goods-specific inspection.',
      payload: demoPayload()
    }
  });
  await db.contractAcceptance.create({
    data: {
      contractId: contract.id,
      deliverableId: deliverable.id,
      inspectionId: inspection.id,
      certificateNo: ref(`ACCEPT-${scenario.key}`),
      status: scenario.status === ContractStatus.AT_RISK ? ContractLifecycleItemStatus.REJECTED : ContractLifecycleItemStatus.APPROVED,
      acceptedValue: scenario.status === ContractStatus.AT_RISK ? scenario.amount * 0.65 : scenario.amount,
      currency: 'TZS',
      acceptedAt: daysFromNow(-1),
      note: 'Seeded acceptance certificate.',
      payload: demoPayload()
    }
  });
  return { milestone1, milestone2, deliverable, inspection };
}

async function seedFinance(db: AnyDb, actors: Awaited<ReturnType<typeof createActors>>, scenario: DemoScenario, contract: any, deliveryRefs: any, rich = false) {
  const buyer = buyerForScenario(actors, scenario);
  const purchaseOrder = await db.purchaseOrder.create({
    data: {
      reference: ref(`PO-${scenario.key}`),
      contractId: contract.id,
      buyerOrgId: buyer.org.id,
      amount: scenario.amount,
      currency: 'TZS',
      payload: demoPayload()
    }
  });
  await db.contractPaymentSchedule.createMany({
    data: [
      {
        contractId: contract.id,
        milestoneId: deliveryRefs.milestone1.id,
        title: 'Mobilization payment',
        amount: scenario.amount * 0.2,
        currency: 'TZS',
        dueDate: daysFromNow(-1),
        status: ContractLifecycleItemStatus.APPROVED,
        payload: demoPayload()
      },
      {
        contractId: contract.id,
        milestoneId: deliveryRefs.milestone2.id,
        title: 'Final delivery payment',
        amount: scenario.amount * 0.8,
        currency: 'TZS',
        dueDate: daysFromNow(rich ? 0 : 7),
        status: rich ? ContractLifecycleItemStatus.OPEN : ContractLifecycleItemStatus.SUBMITTED,
        payload: demoPayload()
      }
    ]
  });
  const invoiceStatuses = rich
    ? [InvoiceStatus.DRAFT, InvoiceStatus.SUBMITTED, InvoiceStatus.MATCHED, InvoiceStatus.REVIEW, InvoiceStatus.BLOCKED, InvoiceStatus.PAID, InvoiceStatus.REJECTED]
    : [scenario.status === ContractStatus.TERMINATION_REVIEW ? InvoiceStatus.BLOCKED : scenario.status === ContractStatus.CLOSED ? InvoiceStatus.PAID : InvoiceStatus.SUBMITTED];
  const invoices = [];
  for (const status of invoiceStatuses) {
    const invoice = await db.invoice.create({
      data: {
        reference: ref(`INV-${scenario.key}-${status}`),
        purchaseOrderId: purchaseOrder.id,
        contractId: contract.id,
        buyerOrgId: buyer.org.id,
        supplierOrgId: scenario.supplier.org.id,
        status,
        amount: status === InvoiceStatus.REJECTED ? scenario.amount * 0.1 : scenario.amount * 0.5,
        currency: 'TZS',
        payload: demoPayload({ statusScenario: status })
      }
    });
    invoices.push(invoice);
  }
  const primaryInvoice = invoices.find((invoice) => invoice.status === InvoiceStatus.SUBMITTED) ?? invoices[0];
  const schedule = await db.contractPaymentSchedule.findFirst({ where: { contractId: contract.id }, orderBy: { createdAt: 'desc' } });
  const payment = await db.contractPayment.create({
    data: {
      contractId: contract.id,
      invoiceId: primaryInvoice.id,
      scheduleId: schedule?.id,
      status: scenario.status === ContractStatus.TERMINATION_REVIEW ? InvoiceStatus.BLOCKED : scenario.status === ContractStatus.CLOSED ? InvoiceStatus.PAID : InvoiceStatus.REVIEW,
      grossAmount: primaryInvoice.amount,
      retentionAmount: scenario.amount * 0.05,
      advanceRecovery: scenario.amount * 0.02,
      liquidatedDamages: scenario.status === ContractStatus.AT_RISK ? scenario.amount * 0.01 : 0,
      taxWithholding: scenario.amount * 0.03,
      netAmount: scenario.amount * 0.4,
      currency: 'TZS',
      reviewedByUserId: actors.finance.user.id,
      approvedByUserId: scenario.status === ContractStatus.CLOSED ? actors.finance.user.id : null,
      paidAt: scenario.status === ContractStatus.CLOSED ? daysFromNow(-10) : null,
      note: scenario.status === ContractStatus.TERMINATION_REVIEW ? 'Payment blocked during termination review.' : 'Seeded payment record.',
      payload: demoPayload()
    }
  });
  await db.threeWayMatchResult.create({
    data: {
      contractId: contract.id,
      invoiceId: primaryInvoice.id,
      purchaseOrderId: purchaseOrder.id,
      acceptanceId: null,
      status: scenario.status === ContractStatus.AT_RISK ? InvoiceStatus.REVIEW : InvoiceStatus.MATCHED,
      poMatched: true,
      receiptMatched: scenario.status !== ContractStatus.AT_RISK,
      invoiceMatched: true,
      varianceAmount: scenario.status === ContractStatus.AT_RISK ? scenario.amount * 0.03 : 0,
      currency: 'TZS',
      reviewerUserId: actors.finance.user.id,
      reviewedAt: daysFromNow(-1),
      note: 'Seeded three-way match result.',
      payload: demoPayload()
    }
  });
  await db.paymentApproval.createMany({
    data: [
      {
        contractId: contract.id,
        invoiceId: primaryInvoice.id,
        paymentId: payment.id,
        stepKey: 'finance-certification',
        role: 'FINANCE',
        status: scenario.status === ContractStatus.TERMINATION_REVIEW ? InvoiceStatus.BLOCKED : InvoiceStatus.MATCHED,
        amountApproved: scenario.amount * 0.45,
        currency: 'TZS',
        actorUserId: actors.finance.user.id,
        decidedAt: daysFromNow(-1),
        note: 'Finance certification seeded.',
        payload: demoPayload()
      },
      {
        contractId: contract.id,
        invoiceId: primaryInvoice.id,
        paymentId: payment.id,
        stepKey: 'accounting-officer',
        role: 'BUYER',
        status: scenario.status === ContractStatus.CLOSED ? InvoiceStatus.PAID : InvoiceStatus.REVIEW,
        amountApproved: scenario.amount * 0.45,
        currency: 'TZS',
        actorUserId: scenario.status === ContractStatus.CLOSED ? actors.buyer.user.id : null,
        decidedAt: scenario.status === ContractStatus.CLOSED ? daysFromNow(-10) : null,
        note: 'Accounting officer approval seeded.',
        payload: demoPayload()
      }
    ]
  });
  if (scenario.status === ContractStatus.CLOSED || rich) {
    const evidenceDoc = await createDocument(db, buyer.org.id, actors.finance.user.id, `PAYMENT-${scenario.key}`, `${contract.reference} payment confirmation.pdf`, 'PAYMENT_EVIDENCE');
    await db.paymentConfirmation.create({
      data: {
        contractId: contract.id,
        invoiceId: primaryInvoice.id,
        paymentId: payment.id,
        confirmationReference: ref(`PAY-${scenario.key}`),
        paidAmount: scenario.status === ContractStatus.CLOSED ? scenario.amount * 0.45 : scenario.amount * 0.2,
        currency: 'TZS',
        paidAt: scenario.status === ContractStatus.CLOSED ? daysFromNow(-10) : daysFromNow(-2),
        evidenceDocumentId: evidenceDoc.id,
        confirmedByUserId: actors.finance.user.id,
        note: 'Seeded payment confirmation with evidence.',
        payload: demoPayload()
      }
    });
  }
}

async function seedRiskTerminationPerformance(db: AnyDb, actors: Awaited<ReturnType<typeof createActors>>, scenario: DemoScenario, contract: any, rich = false) {
  const buyer = buyerForScenario(actors, scenario);
  await db.contractRisk.create({
    data: {
      contractId: contract.id,
      title: scenario.status === ContractStatus.AT_RISK ? 'Critical delivery quality risk' : 'Delivery schedule risk',
      category: 'delivery',
      description: 'Seeded risk for risk form testing.',
      likelihood: scenario.status === ContractStatus.AT_RISK ? 5 : 2,
      impact: scenario.status === ContractStatus.AT_RISK ? 5 : 3,
      score: scenario.status === ContractStatus.AT_RISK ? 25 : 6,
      level: scenario.status === ContractStatus.AT_RISK ? ContractRiskLevel.CRITICAL : ContractRiskLevel.MEDIUM,
      responsibleUserId: actors.manager.user.id,
      mitigationAction: 'Escalate in weekly contract review.',
      dueDate: daysFromNow(scenario.status === ContractStatus.AT_RISK ? 0 : 5),
      status: ContractLifecycleItemStatus.OPEN,
      evidence: [{ source: 'inspection', ref: ref(`GI-${scenario.key}`) }],
      payload: demoPayload()
    }
  });
  await db.riskForecast.create({
    data: {
      supplierOrgId: scenario.supplier.org.id,
      tenderId: contract.tenderId,
      contractId: contract.id,
      forecastType: 'DELIVERY_DELAY',
      horizonDays: 30,
      probability: scenario.status === ContractStatus.AT_RISK ? 0.82 : 0.24,
      impactLevel: scenario.status === ContractStatus.AT_RISK ? RiskLevel.CRITICAL : RiskLevel.MEDIUM,
      status: scenario.status === ContractStatus.CLOSED ? 'CLOSED' : 'OPEN',
      drivers: [{ driver: 'inspection', weight: 0.6 }],
      recommendation: 'Review milestones and supplier capacity.',
      payload: demoPayload()
    }
  });
  await db.contractVariation.create({
    data: {
      contractId: contract.id,
      requestedByOrgId: buyer.org.id,
      title: 'Scope adjustment for delivery sequencing',
      changeType: 'TIME_EXTENSION',
      reason: 'Buyer site readiness shifted the delivery sequence.',
      affectedClause: 'general-conditions',
      costImpact: rich ? 2500000 : 0,
      timeImpactDays: rich ? 14 : 3,
      technicalImpact: 'No change to core specifications.',
      status: rich ? ContractLifecycleItemStatus.APPROVED : ContractLifecycleItemStatus.OPEN,
      decision: rich ? 'Approved for demo variation workflow.' : null,
      payload: demoPayload()
    }
  });
  await db.contractIssue.create({
    data: {
      contractId: contract.id,
      raisedByOrgId: buyer.org.id,
      title: 'Late supplier progress report',
      description: 'Supplier progress report missed reporting date.',
      category: 'reporting',
      status: rich ? ContractLifecycleItemStatus.IN_PROGRESS : ContractLifecycleItemStatus.OPEN,
      dueDate: daysFromNow(1),
      resolution: null,
      payload: demoPayload()
    }
  });
  await db.contractDispute.create({
    data: {
      contractId: contract.id,
      raisedByOrgId: scenario.supplier.org.id,
      title: 'Disputed rejected quantity',
      contractClause: 'inspection-and-acceptance',
      description: 'Supplier disputes rejected quantity and requests joint reinspection.',
      route: 'amicable-settlement',
      status: scenario.status === ContractStatus.AT_RISK ? ContractLifecycleItemStatus.IN_PROGRESS : ContractLifecycleItemStatus.OPEN,
      decision: null,
      payload: demoPayload()
    }
  });

  if (([ContractStatus.TERMINATION_REVIEW, ContractStatus.TERMINATED] as ContractStatus[]).includes(scenario.status) || rich) {
    const termination = await db.contractTermination.create({
      data: {
        contractId: contract.id,
        terminationType: ContractTerminationType.SUPPLIER_DEFAULT,
        initiatedByOrgId: buyer.org.id,
        reason: 'Repeated failure to cure delivery defects.',
        contractClause: 'termination-for-default',
        faultParty: 'SUPPLIER',
        status: scenario.status === ContractStatus.TERMINATED ? ContractTerminationStatus.TERMINATED : ContractTerminationStatus.UNDER_REVIEW,
        noticeDate: daysFromNow(-10),
        cureDeadline: daysFromNow(-3),
        terminationEffectiveDate: scenario.status === ContractStatus.TERMINATED ? daysFromNow(-1) : null,
        supplierResponse: 'Supplier disputes default and requests settlement meeting.',
        finalDecision: scenario.status === ContractStatus.TERMINATED ? 'Terminate and proceed with replacement procurement.' : '',
        payload: demoPayload()
      }
    });
    await db.terminationNotice.create({
      data: {
        terminationId: termination.id,
        noticeType: 'CURE_NOTICE',
        contractClause: 'termination-for-default',
        requiredAction: 'Cure defects and submit corrective action plan.',
        deadline: daysFromNow(-3),
        note: 'Seeded cure notice.',
        acknowledgedAt: daysFromNow(-9),
        payload: demoPayload()
      }
    });
    const terminationDoc = await createDocument(db, buyer.org.id, actors.technical.user.id, `TERMINATION-${scenario.key}`, `${contract.reference} termination evidence.pdf`, 'TERMINATION_EVIDENCE');
    await db.terminationEvidence.create({
      data: {
        terminationId: termination.id,
        documentId: terminationDoc.id,
        evidenceType: 'INSPECTION_FAILURE',
        note: 'Inspection failure and supplier correspondence.',
        payload: demoPayload()
      }
    });
    await db.terminationValuation.create({
      data: {
        terminationId: termination.id,
        acceptedValue: scenario.amount * 0.55,
        rejectedValue: scenario.amount * 0.15,
        advanceRecovery: scenario.amount * 0.05,
        retentionHeld: scenario.amount * 0.1,
        liquidatedDamages: scenario.amount * 0.03,
        costToComplete: scenario.amount * 0.2,
        performanceSecurityClaim: scenario.amount * 0.1,
        finalAmountPayable: scenario.amount * 0.22,
        finalAmountRecoverable: scenario.amount * 0.08,
        currency: 'TZS',
        payload: demoPayload()
      }
    });
    await db.terminationSettlement.create({
      data: {
        terminationId: termination.id,
        status: scenario.status === ContractStatus.TERMINATED ? ContractLifecycleItemStatus.APPROVED : ContractLifecycleItemStatus.OPEN,
        settlementNote: 'Settlement terms seeded for controlled termination workflow.',
        settledAt: scenario.status === ContractStatus.TERMINATED ? daysFromNow(-1) : null,
        payload: demoPayload()
      }
    });
    await db.replacementProcurementPlan.create({
      data: {
        terminationId: termination.id,
        method: 'Emergency restricted tender',
        urgencyLevel: ContractRiskLevel.HIGH,
        remainingScope: 'Remaining accepted delivery balance and replacement defective items.',
        estimatedCost: scenario.amount * 0.35,
        currency: 'TZS',
        status: ContractLifecycleItemStatus.IN_PROGRESS,
        payload: demoPayload()
      }
    });
  }

  if (([ContractStatus.COMPLETED, ContractStatus.WARRANTY_DEFECTS, ContractStatus.CLOSED] as ContractStatus[]).includes(scenario.status) || rich) {
    await db.contractWarranty.create({
      data: {
        contractId: contract.id,
        title: scenario.status === ContractStatus.WARRANTY_DEFECTS ? 'Defects liability claim' : 'Standard warranty period',
        defectReference: scenario.status === ContractStatus.WARRANTY_DEFECTS ? ref(`DEFECT-${scenario.key}`) : null,
        status: scenario.status === ContractStatus.WARRANTY_DEFECTS ? ContractLifecycleItemStatus.OPEN : ContractLifecycleItemStatus.CLOSED,
        startDate: daysFromNow(-20),
        endDate: daysFromNow(345),
        responsibleRole: 'SUPPLIER',
        resolution: scenario.status === ContractStatus.WARRANTY_DEFECTS ? null : 'No defects pending.',
        payload: demoPayload()
      }
    });
    await db.contractCloseout.create({
      data: {
        contractId: contract.id,
        status: scenario.status === ContractStatus.CLOSED ? ContractLifecycleItemStatus.CLOSED : ContractLifecycleItemStatus.OPEN,
        completionCertificate: scenario.status === ContractStatus.CLOSED,
        finalAccountApproved: scenario.status === ContractStatus.CLOSED,
        warrantyStartDate: daysFromNow(-20),
        warrantyEndDate: daysFromNow(345),
        lessonsLearned: 'Seeded closeout lessons for testing.',
        payload: demoPayload()
      }
    });
  }

  await db.supplierPerformanceRecord.create({
    data: {
      contractId: contract.id,
      buyerOrgId: buyer.org.id,
      supplierOrgId: scenario.supplier.org.id,
      overallScore: scenario.status === ContractStatus.AT_RISK || scenario.status === ContractStatus.TERMINATED ? 48 : 86,
      timeScore: scenario.status === ContractStatus.AT_RISK ? 40 : 84,
      qualityScore: scenario.status === ContractStatus.WARRANTY_DEFECTS ? 62 : 88,
      costScore: 80,
      complianceScore: scenario.status === ContractStatus.TERMINATED ? 35 : 90,
      terminationFault: scenario.status === ContractStatus.TERMINATED ? 'SUPPLIER_DEFAULT' : null,
      note: 'Seeded supplier performance record.',
      payload: demoPayload()
    }
  });
  await db.performanceScore.createMany({
    data: [
      {
        contractId: contract.id,
        supplierOrgId: scenario.supplier.org.id,
        scoreType: 'QUALITY',
        score: scenario.status === ContractStatus.WARRANTY_DEFECTS ? 62 : 88,
        weight: 40,
        periodStart: daysFromNow(-30),
        periodEnd: daysFromNow(0),
        evaluatorUserId: actors.manager.user.id,
        note: 'Quality score seeded.',
        payload: demoPayload()
      },
      {
        contractId: contract.id,
        supplierOrgId: scenario.supplier.org.id,
        scoreType: 'TIME',
        score: scenario.status === ContractStatus.AT_RISK ? 40 : 84,
        weight: 30,
        periodStart: daysFromNow(-30),
        periodEnd: daysFromNow(0),
        evaluatorUserId: actors.manager.user.id,
        note: 'Time score seeded.',
        payload: demoPayload()
      }
    ]
  });
  await db.supplierRiskProfile.upsert({
    where: { supplierOrgId: scenario.supplier.org.id },
    update: {
      riskLevel: scenario.status === ContractStatus.AT_RISK || scenario.status === ContractStatus.TERMINATED ? RiskLevel.HIGH : RiskLevel.LOW,
      riskScore: scenario.status === ContractStatus.AT_RISK || scenario.status === ContractStatus.TERMINATED ? 78 : 22,
      trustTier: scenario.status === ContractStatus.TERMINATED ? 'BRONZE' : 'GOLD',
      activeAlerts: scenario.status === ContractStatus.AT_RISK ? 2 : 0,
      openViolations: scenario.status === ContractStatus.TERMINATED ? 1 : 0,
      lastReviewedAt: daysFromNow(0),
      reviewerUserId: actors.admin.user.id,
      summary: 'Seeded supplier risk profile for admin and contract workspaces.',
      drivers: [{ driver: 'performance', score: scenario.status === ContractStatus.AT_RISK ? 78 : 22 }],
      payload: demoPayload()
    },
    create: {
      supplierOrgId: scenario.supplier.org.id,
      riskLevel: scenario.status === ContractStatus.AT_RISK || scenario.status === ContractStatus.TERMINATED ? RiskLevel.HIGH : RiskLevel.LOW,
      riskScore: scenario.status === ContractStatus.AT_RISK || scenario.status === ContractStatus.TERMINATED ? 78 : 22,
      trustTier: scenario.status === ContractStatus.TERMINATED ? 'BRONZE' : 'GOLD',
      activeAlerts: scenario.status === ContractStatus.AT_RISK ? 2 : 0,
      openViolations: scenario.status === ContractStatus.TERMINATED ? 1 : 0,
      lastReviewedAt: daysFromNow(0),
      reviewerUserId: actors.admin.user.id,
      summary: 'Seeded supplier risk profile for admin and contract workspaces.',
      drivers: [{ driver: 'performance', score: scenario.status === ContractStatus.AT_RISK ? 78 : 22 }],
      payload: demoPayload()
    }
  });
}

async function seedDocumentsAndApprovals(db: AnyDb, actors: Awaited<ReturnType<typeof createActors>>, scenario: DemoScenario, contract: any) {
  const buyer = buyerForScenario(actors, scenario);
  const securityDoc = await createDocument(db, scenario.supplier.org.id, scenario.supplier.user.id, `REQUIRED-${scenario.key}`, `${contract.reference} performance security.pdf`, 'PERFORMANCE_SECURITY');
  await db.contractRequiredDocument.createMany({
    data: [
      {
        contractId: contract.id,
        documentType: 'PERFORMANCE_SECURITY',
        title: 'Performance security',
        ownerRole: 'SUPPLIER',
        status: scenario.status === ContractStatus.MOBILIZATION ? ContractLifecycleItemStatus.SUBMITTED : ContractLifecycleItemStatus.APPROVED,
        documentId: securityDoc.id,
        dueDate: daysFromNow(2),
        reviewedAt: scenario.status === ContractStatus.MOBILIZATION ? null : daysFromNow(-2),
        note: 'Seeded required document.',
        payload: demoPayload()
      },
      {
        contractId: contract.id,
        documentType: 'INSURANCE',
        title: 'Insurance cover',
        ownerRole: 'SUPPLIER',
        status: ContractLifecycleItemStatus.OPEN,
        dueDate: daysFromNow(5),
        note: 'Insurance document pending.',
        payload: demoPayload()
      }
    ]
  });
  await db.contractWorkflowApproval.createMany({
    data: [
      {
        contractId: contract.id,
        stepKey: 'contract-owner-approval',
        role: 'CONTRACT_OWNER',
        status: scenario.status === ContractStatus.NEGOTIATION ? ContractLifecycleItemStatus.IN_PROGRESS : ContractLifecycleItemStatus.APPROVED,
        actorUserId: actors.buyer.user.id,
        decidedAt: scenario.status === ContractStatus.NEGOTIATION ? null : daysFromNow(-4),
        note: 'Contract owner approval seeded.',
        payload: demoPayload({ model: 'single-user' })
      }
    ]
  });
  await db.urgentAction.createMany({
    data: [
      {
        ownerOrgId: buyer.org.id,
        contractId: contract.id,
        awardId: contract.awardId,
        actionKey: `${contract.reference}:buyer-next`,
        title: `${contract.title} buyer action`,
        requiredAction: scenario.status === ContractStatus.AT_RISK ? 'Resolve critical risk' : 'Review next contract action',
        riskLevel: scenario.status === ContractStatus.AT_RISK ? 'Critical' : 'Medium',
        dueDate: scenario.status === ContractStatus.AT_RISK ? daysFromNow(-1) : daysFromNow(1),
        status: 'OPEN',
        nextRoute: `/awards-contracts/post-award?contract=${contract.id}`,
        payload: demoPayload()
      },
      {
        ownerOrgId: scenario.supplier.org.id,
        contractId: contract.id,
        awardId: contract.awardId,
        actionKey: `${contract.reference}:supplier-next`,
        title: `${contract.title} supplier action`,
        requiredAction: 'Submit supplier evidence or response',
        riskLevel: scenario.status === ContractStatus.SIGNATURE_PENDING ? 'High' : 'Medium',
        dueDate: daysFromNow(scenario.status === ContractStatus.SIGNATURE_PENDING ? 0 : 2),
        status: 'OPEN',
        nextRoute: `/awards-contracts/post-award?contract=${contract.id}`,
        payload: demoPayload()
      }
    ],
    skipDuplicates: true
  });
  await db.notification.createMany({
    data: [
      {
        ownerOrgId: buyer.org.id,
        userId: actors.manager.user.id,
        contractId: contract.id,
        awardId: contract.awardId,
        channel: 'IN_APP',
        title: `${contract.title} requires buyer attention`,
        body: 'Seeded notification for account menu and contract dashboards.',
        status: 'UNREAD',
        payload: demoPayload()
      },
      {
        ownerOrgId: scenario.supplier.org.id,
        userId: scenario.supplier.user.id,
        contractId: contract.id,
        awardId: contract.awardId,
        channel: 'EMAIL',
        title: `${contract.title} supplier update`,
        body: 'Seeded supplier notification.',
        status: 'UNREAD',
        payload: demoPayload()
      }
    ]
  });
  await db.auditEvent.createMany({
    data: [
      {
        ownerOrgId: buyer.org.id,
        actorUserId: actors.buyer.user.id,
        event: 'demo.contract.seeded',
        entityType: 'contract',
        entityRef: contract.id,
        severity: AuditSeverity.INFO,
        payload: demoPayload({ reference: contract.reference, status: contract.status })
      },
      {
        ownerOrgId: buyer.org.id,
        actorUserId: actors.buyer.user.id,
        event: 'demo.award.seeded',
        entityType: 'award_recommendation',
        entityRef: contract.awardId,
        severity: AuditSeverity.INFO,
        payload: demoPayload({ contractReference: contract.reference })
      }
    ]
  });
}

async function seedAwardOnlyVariety(db: AnyDb, actors: Awaited<ReturnType<typeof createActors>>) {
  const statuses = [
    RecommendationStatus.DRAFT,
    RecommendationStatus.RECOMMENDED,
    RecommendationStatus.RETURNED,
    RecommendationStatus.APPROVED,
    RecommendationStatus.REJECTED
  ];
  for (const [index, status] of statuses.entries()) {
    const scenario: DemoScenario = {
      key: `AWARD-${status}`,
      title: `${status.toLowerCase().replace('_', ' ')} award recommendation demo tender`,
      procurementType: index % 2 === 0 ? 'GOODS' : 'SERVICE',
      status: ContractStatus.DRAFT,
      supplier: index === 2 ? actors.suppliers.declined : actors.suppliers.accepted,
      amount: 120000000 + index * 10000000
    };
    const base = await createAwardBase(db, actors, scenario, status);
    await seedAwardSideRecords(db, actors, base, index);
    if (status === RecommendationStatus.APPROVED) {
      const notice = await db.awardNotice.create({
        data: {
          reference: ref(`NOTICE-${scenario.key}`),
          recommendationId: base.recommendation.id,
          buyerOrgId: actors.buyer.org.id,
          supplierOrgId: scenario.supplier.org.id,
          issuedByUserId: actors.buyer.user.id,
          status: AwardNoticeStatus.PENDING_RESPONSE,
          buyerNote: 'Supplier response pending for demo award.',
          issuedAt: daysFromNow(-1),
          payload: demoPayload({ awardOnly: true })
        }
      });
      await db.standstillPeriod.create({
        data: {
          recommendationId: base.recommendation.id,
          noticeId: notice.id,
          buyerOrgId: actors.buyer.org.id,
          supplierOrgId: scenario.supplier.org.id,
          startsAt: daysFromNow(-1),
          endsAt: daysFromNow(6),
          days: 7,
          status: 'ACTIVE',
          payload: demoPayload()
        }
      });
    }
  }
}

async function seedGroupedAwardDemo(db: AnyDb, actors: Awaited<ReturnType<typeof createActors>>) {
  const negotiationScenario: DemoScenario = {
    key: 'GROUP-NEGOTIATION-WATER',
    title: 'Water testing kits multi-winner award',
    procurementType: 'GOODS',
    status: ContractStatus.DRAFT,
    supplier: actors.suppliers.accepted,
    amount: 72000000
  };
  const negotiationBase = await createAwardBase(db, actors, negotiationScenario, RecommendationStatus.RECOMMENDED);
  const negotiationSibling = await createSiblingAwardRecommendation(
    db,
    actors,
    negotiationBase,
    actors.suppliers.risky,
    'GROUP-NEGOTIATION-WATER-LOT-2',
    68000000,
    RecommendationStatus.RECOMMENDED
  );
  await seedAwardSideRecords(db, actors, negotiationBase, 21);
  await seedAwardSideRecords(db, actors, negotiationSibling, 22);
  const negotiationGroup = await db.awardGroup.create({
    data: {
      reference: ref('GROUP-NEGOTIATION-WATER'),
      workspaceId: negotiationBase.workspace.id,
      tenderId: negotiationBase.tender.id,
      buyerOrgId: negotiationBase.tender.buyerOrgId,
      title: 'Water testing kits negotiated multi-winner award',
      status: 'NEGOTIATION',
      payload: demoPayload({ groupedAward: true, scenario: 'multi-winner-negotiation', lots: ['Lab kits', 'Field kits'] })
    }
  });
  await db.awardRecommendation.updateMany({
    where: { id: { in: [negotiationBase.recommendation.id, negotiationSibling.recommendation.id] } },
    data: { awardGroupId: negotiationGroup.id }
  });
  const negotiationWinnerOne = await db.awardWinner.create({
    data: {
      awardGroupId: negotiationGroup.id,
      recommendationId: negotiationBase.recommendation.id,
      bidId: negotiationBase.bid.id,
      supplierOrgId: negotiationScenario.supplier.org.id,
      amount: negotiationScenario.amount,
      currency: 'TZS',
      status: 'NEGOTIATION',
      payload: demoPayload({ lot: 'Lot 1 - laboratory water testing kits', deliveryWindow: '21 days' })
    }
  });
  const negotiationWinnerTwo = await db.awardWinner.create({
    data: {
      awardGroupId: negotiationGroup.id,
      recommendationId: negotiationSibling.recommendation.id,
      bidId: negotiationSibling.bid.id,
      supplierOrgId: actors.suppliers.risky.org.id,
      amount: 68000000,
      currency: 'TZS',
      status: 'NEGOTIATION',
      payload: demoPayload({ lot: 'Lot 2 - field reagent kits', deliveryWindow: '28 days' })
    }
  });
  const negotiationClause = await db.awardClause.create({
    data: {
      awardGroupId: negotiationGroup.id,
      winnerId: negotiationWinnerOne.id,
      clauseKey: 'delivery-schedule',
      title: 'Delivery schedule and inspection lots',
      body: 'Winners shall deliver by lot with buyer inspection at warehouse receipt.',
      category: 'delivery',
      status: ContractLifecycleItemStatus.IN_PROGRESS,
      buyerComment: 'Buyer requests phased deliveries before school laboratory opening.',
      supplierComment: 'Supplier confirms Lot 1 but requests two extra days for Lot 2.',
      legalComment: 'Confirm delay damages before settlement.',
      payload: demoPayload({ groupedAward: true, clauseType: 'negotiated' })
    }
  });
  await db.awardClause.createMany({
    data: [
      {
        awardGroupId: negotiationGroup.id,
        winnerId: negotiationWinnerTwo.id,
        clauseKey: 'performance-security',
        title: 'Performance security',
        body: 'Each winner shall submit performance security equal to ten percent of awarded lot value.',
        category: 'security',
        status: ContractLifecycleItemStatus.APPROVED,
        buyerComment: 'Accepted by buyer.',
        supplierComment: 'Accepted by supplier.',
        legalComment: 'Compliant.',
        payload: demoPayload({ groupedAward: true })
      },
      {
        awardGroupId: negotiationGroup.id,
        clauseKey: 'payment-retention',
        title: 'Retention and payment release',
        body: 'Five percent retention is released after acceptance certificate and warranty confirmation.',
        category: 'payment',
        status: ContractLifecycleItemStatus.OPEN,
        buyerComment: 'Finance wants retention confirmed before notices.',
        supplierComment: 'Awaiting final finance response.',
        legalComment: 'Open item blocks settlement.',
        payload: demoPayload({ groupedAward: true })
      }
    ]
  });
  await db.awardNegotiation.createMany({
    data: [
      {
        awardGroupId: negotiationGroup.id,
        winnerId: negotiationWinnerOne.id,
        clauseId: negotiationClause.id,
        raisedByRole: 'BUYER',
        raisedByOrgId: negotiationBase.tender.buyerOrgId,
        subject: 'Confirm split delivery dates',
        position: 'Buyer requires Lot 1 within 21 days and Lot 2 within 28 days.',
        counterOffer: 'Supplier can meet Lot 1 and requests Lot 2 delivery at 30 days.',
        status: ContractLifecycleItemStatus.IN_PROGRESS,
        dueDate: daysFromNow(1),
        payload: demoPayload({ groupedAward: true, thread: 'delivery' })
      },
      {
        awardGroupId: negotiationGroup.id,
        winnerId: negotiationWinnerTwo.id,
        raisedByRole: 'SUPPLIER',
        raisedByOrgId: actors.suppliers.risky.org.id,
        subject: 'Warranty replacement wording',
        position: 'Supplier accepts replacement within seven business days after defect confirmation.',
        counterOffer: 'Buyer accepts with batch traceability records attached.',
        status: ContractLifecycleItemStatus.CLOSED,
        dueDate: daysFromNow(-1),
        payload: demoPayload({ groupedAward: true, thread: 'warranty' })
      }
    ]
  });

  const settledScenario: DemoScenario = {
    key: 'GROUP-SETTLED-CLINIC',
    title: 'Clinic equipment installation settled award',
    procurementType: 'GOODS',
    status: ContractStatus.SIGNATURE_PENDING,
    supplier: actors.suppliers.accepted,
    amount: 132000000
  };
  const settledBase = await createAwardBase(db, actors, settledScenario, RecommendationStatus.APPROVED);
  const settledSibling = await createSiblingAwardRecommendation(
    db,
    actors,
    settledBase,
    actors.suppliers.self,
    'GROUP-SETTLED-CLINIC-LOT-2',
    54000000,
    RecommendationStatus.APPROVED
  );
  await seedAwardSideRecords(db, actors, settledBase, 31);
  await seedAwardSideRecords(db, actors, settledSibling, 32);
  const settledGroup = await db.awardGroup.create({
    data: {
      reference: ref('GROUP-SETTLED-CLINIC'),
      workspaceId: settledBase.workspace.id,
      tenderId: settledBase.tender.id,
      buyerOrgId: settledBase.tender.buyerOrgId,
      title: 'Clinic equipment installation settled award',
      status: 'NOTICED',
      settledAt: daysFromNow(-2),
      payload: demoPayload({ groupedAward: true, scenario: 'settled-forming-contracts', settlementNote: 'Negotiations closed and notices issued to all winners.' })
    }
  });
  await db.awardRecommendation.updateMany({
    where: { id: { in: [settledBase.recommendation.id, settledSibling.recommendation.id] } },
    data: { awardGroupId: settledGroup.id }
  });
  const settledClauseRows = [
    {
      clauseKey: 'installation-acceptance',
      title: 'Installation and acceptance',
      body: 'Equipment is accepted only after commissioning certificate, user training, and asset tagging.',
      category: 'delivery',
      status: ContractLifecycleItemStatus.APPROVED,
      buyerComment: 'Accepted after technical review.',
      supplierComment: 'Accepted by winner.',
      legalComment: 'Ready for contract formation.'
    },
    {
      clauseKey: 'payment-milestones',
      title: 'Payment milestones',
      body: 'Forty percent on delivery, forty percent on installation, twenty percent after acceptance.',
      category: 'payment',
      status: ContractLifecycleItemStatus.APPROVED,
      buyerComment: 'Budget commitment confirmed.',
      supplierComment: 'Accepted.',
      legalComment: 'Ready.'
    },
    {
      clauseKey: 'training-warranty',
      title: 'Training and warranty',
      body: 'Supplier shall provide on-site user training and twelve months warranty support.',
      category: 'warranty',
      status: ContractLifecycleItemStatus.WAIVED,
      buyerComment: 'Warranty wording folded into installation clause.',
      supplierComment: 'No objection.',
      legalComment: 'Waiver recorded.'
    }
  ];
  await db.awardClause.createMany({
    data: settledClauseRows.map((clause) => ({
      awardGroupId: settledGroup.id,
      ...clause,
      payload: demoPayload({ groupedAward: true, settled: true })
    }))
  });
  await db.awardNegotiation.createMany({
    data: [
      {
        awardGroupId: settledGroup.id,
        raisedByRole: 'BUYER',
        raisedByOrgId: settledBase.tender.buyerOrgId,
        subject: 'Close installation acceptance wording',
        position: 'Buyer required commissioning and training evidence.',
        counterOffer: 'Suppliers accepted with asset tagging checklist attached.',
        status: ContractLifecycleItemStatus.CLOSED,
        dueDate: daysFromNow(-3),
        payload: demoPayload({ groupedAward: true, settled: true })
      },
      {
        awardGroupId: settledGroup.id,
        raisedByRole: 'SUPPLIER',
        raisedByOrgId: settledScenario.supplier.org.id,
        subject: 'Confirm payment milestone percentages',
        position: 'Supplier requested 50 percent on delivery.',
        counterOffer: 'Buyer settled at 40/40/20 with faster acceptance review.',
        status: ContractLifecycleItemStatus.CLOSED,
        dueDate: daysFromNow(-2),
        payload: demoPayload({ groupedAward: true, settled: true })
      }
    ]
  });
  const bidPackDocument = await createDocument(db, settledBase.tender.buyerOrgId, settledBase.tender.ownerUserId, 'AWARD-BID-PACK-GROUP-SETTLED-CLINIC', 'Clinic equipment installation award bid pack.json', 'AWARD_BID_PACK');
  await db.awardBidPack.create({
    data: {
      awardGroupId: settledGroup.id,
      documentId: bidPackDocument.id,
      status: 'GENERATED',
      checksum: ref('BID-PACK-CHECKSUM-GROUP-SETTLED-CLINIC'),
      payload: demoPayload({
        generatedBy: 'seed-award-contract-demo',
        winners: [settledBase.recommendation.reference, settledSibling.recommendation.reference],
        clauses: settledClauseRows.map((clause) => clause.clauseKey),
        notices: 'issued'
      }),
      generatedAt: daysFromNow(-2)
    }
  });

  const settledWinnerOne = await db.awardWinner.create({
    data: {
      awardGroupId: settledGroup.id,
      recommendationId: settledBase.recommendation.id,
      bidId: settledBase.bid.id,
      supplierOrgId: settledScenario.supplier.org.id,
      amount: settledScenario.amount,
      currency: 'TZS',
      status: AwardNoticeStatus.ACCEPTED,
      payload: demoPayload({ lot: 'Lot 1 - diagnostic equipment', settled: true })
    }
  });
  const settledWinnerTwo = await db.awardWinner.create({
    data: {
      awardGroupId: settledGroup.id,
      recommendationId: settledSibling.recommendation.id,
      bidId: settledSibling.bid.id,
      supplierOrgId: actors.suppliers.self.org.id,
      amount: 54000000,
      currency: 'TZS',
      status: AwardNoticeStatus.ACCEPTED,
      payload: demoPayload({ lot: 'Lot 2 - installation and training', settled: true })
    }
  });

  const settledContractOne = await createNoticeAndContract(db, actors, settledScenario, settledBase, AwardNoticeStatus.ACCEPTED);
  await seedContractCore(db, actors, settledScenario, settledContractOne.contract, false);
  const settledDeliveryOne = await seedContractDelivery(db, actors, settledScenario, settledContractOne.contract, false);
  await seedFinance(db, actors, settledScenario, settledContractOne.contract, settledDeliveryOne, false);
  await seedDocumentsAndApprovals(db, actors, settledScenario, settledContractOne.contract);

  const siblingScenario: DemoScenario = {
    ...settledScenario,
    key: 'GROUP-SETTLED-CLINIC-LOT-2',
    status: ContractStatus.ACTIVE,
    supplier: actors.suppliers.self,
    amount: 54000000
  };
  const settledContractTwo = await createNoticeAndContract(db, actors, siblingScenario, settledSibling, AwardNoticeStatus.ACCEPTED);
  await seedContractCore(db, actors, siblingScenario, settledContractTwo.contract, false);
  const settledDeliveryTwo = await seedContractDelivery(db, actors, siblingScenario, settledContractTwo.contract, false);
  await seedFinance(db, actors, siblingScenario, settledContractTwo.contract, settledDeliveryTwo, false);
  await seedDocumentsAndApprovals(db, actors, siblingScenario, settledContractTwo.contract);

  await db.awardWinner.update({
    where: { id: settledWinnerOne.id },
    data: { noticeId: settledContractOne.notice.id, contractId: settledContractOne.contract.id }
  });
  await db.awardWinner.update({
    where: { id: settledWinnerTwo.id },
    data: { noticeId: settledContractTwo.notice.id, contractId: settledContractTwo.contract.id }
  });
}

async function seedCompliance(db: AnyDb, actors: Awaited<ReturnType<typeof createActors>>, referenceContract: any, referenceTenderId: string, referenceBidId: string) {
  await db.collusionAlert.create({
    data: {
      tenderId: referenceTenderId,
      bidId: referenceBidId,
      supplierOrgId: actors.suppliers.risky.org.id,
      alertType: 'BID_PATTERN_SIMILARITY',
      severity: AuditSeverity.CRITICAL,
      status: 'OPEN',
      confidence: 0.87,
      signalSummary: 'Unusual pricing pattern and shared metadata detected in seeded demo bids.',
      assignedUserId: actors.admin.user.id,
      payload: demoPayload()
    }
  });
  const review = await db.complianceReview.create({
    data: {
      ownerOrgId: actors.buyer.org.id,
      entityType: 'contract',
      entityRef: referenceContract.id,
      reviewType: 'SUPPLIER_RISK_REVIEW',
      status: ComplianceCaseStatus.INVESTIGATION,
      severity: AuditSeverity.WARNING,
      assignedUserId: actors.admin.user.id,
      findings: 'Seeded review links contract risk, supplier profile, and compliance evidence.',
      decision: null,
      dueDate: daysFromNow(5),
      payload: demoPayload()
    }
  });
  const violation = await db.violationCase.create({
    data: {
      reviewId: review.id,
      ownerOrgId: actors.buyer.org.id,
      supplierOrgId: actors.suppliers.terminated.org.id,
      title: 'Failure to cure contract defects',
      violationType: 'CONTRACT_DEFAULT',
      severity: AuditSeverity.ERROR,
      status: ComplianceCaseStatus.ESCALATED,
      statement: 'Seeded violation case for enforcement and appeal testing.',
      assignedUserId: actors.admin.user.id,
      decision: 'Proceed with temporary suspension recommendation.',
      decidedAt: daysFromNow(-1),
      payload: demoPayload()
    }
  });
  const evidenceDoc = await createDocument(db, actors.buyer.org.id, actors.admin.user.id, 'VIOLATION-EVIDENCE', 'Violation evidence bundle.pdf', 'VIOLATION_EVIDENCE');
  await db.violationEvidence.create({
    data: {
      violationId: violation.id,
      documentId: evidenceDoc.id,
      evidenceType: 'CONTRACT_RECORDS',
      description: 'Inspection records, notices, and supplier response package.',
      submittedByUserId: actors.admin.user.id,
      payload: demoPayload()
    }
  });
  const enforcement = await db.enforcementRecord.create({
    data: {
      violationId: violation.id,
      supplierOrgId: actors.suppliers.terminated.org.id,
      enforcementType: 'TEMPORARY_SUSPENSION',
      status: 'ACTIVE',
      severity: AuditSeverity.ERROR,
      effectiveFrom: daysFromNow(0),
      effectiveTo: daysFromNow(90),
      actionSummary: 'Seeded enforcement action for compliance workspace testing.',
      issuedByUserId: actors.admin.user.id,
      payload: demoPayload()
    }
  });
  await db.appealRecord.create({
    data: {
      enforcementId: enforcement.id,
      violationId: violation.id,
      appellantOrgId: actors.suppliers.terminated.org.id,
      appealGrounds: 'Supplier disputes cause and requests review of accepted quantities.',
      status: 'SUBMITTED',
      reviewerUserId: actors.admin.user.id,
      payload: demoPayload()
    }
  });
  await db.trustTierHistory.create({
    data: {
      organizationId: actors.suppliers.terminated.org.id,
      userId: actors.suppliers.terminated.user.id,
      previousTier: TrustTier.GOLD,
      nextTier: TrustTier.BRONZE,
      riskLevel: RiskLevel.HIGH,
      score: 42,
      reasons: ['Contract default demo', 'Open enforcement record']
    }
  });
  await db.auditEvent.create({
    data: {
      ownerOrgId: actors.buyer.org.id,
      actorUserId: actors.admin.user.id,
      event: 'demo.compliance.seeded',
      entityType: 'compliance_review',
      entityRef: review.id,
      severity: AuditSeverity.INFO,
      payload: demoPayload({ linkedContractId: referenceContract.id })
    }
  });
}

export async function seedAwardContractDemo() {
  const adminContext = { accountType: AccountType.ADMIN };
  let actors: Awaited<ReturnType<typeof createActors>>;

  actors = await withDbContext(adminContext, async (tx) => {
    const db = tx as AnyDb;
    await resetDemoDataset(db);
    await cleanupDemoActors(db);
    return createActors(db);
  });

  const scenarios: DemoScenario[] = [
    { key: 'DRAFT-GOODS', title: 'Goods Tender Draft Contract Demo', procurementType: 'GOODS', status: ContractStatus.DRAFT, buyer: actors.externalBuyer, supplier: actors.suppliers.self, amount: 450000000 },
    { key: 'NEGOTIATION-WORKS', title: 'Works Tender Negotiation Demo', procurementType: 'WORKS', status: ContractStatus.NEGOTIATION, buyer: actors.externalBuyer, supplier: actors.suppliers.self, amount: 980000000 },
    { key: 'SIGNATURE-SERVICES', title: 'Services Tender Signature Pending Demo', procurementType: 'SERVICE', status: ContractStatus.SIGNATURE_PENDING, supplier: actors.suppliers.accepted, amount: 350000000 },
    { key: 'SIGNED-CONSULTANCY', title: 'Consultancy Tender Signed Demo', procurementType: 'CONSULTANCY', status: ContractStatus.SIGNED, supplier: actors.suppliers.accepted, amount: 250000000 },
    { key: 'MOBILIZATION-IT', title: 'IT Tender Mobilization Demo', procurementType: 'IT', status: ContractStatus.MOBILIZATION, supplier: actors.suppliers.accepted, amount: 720000000 },
    { key: 'ACTIVE-GOODS', title: 'Goods Tender Active Rich Demo', procurementType: 'GOODS', status: ContractStatus.ACTIVE, buyer: actors.externalBuyer, supplier: actors.suppliers.self, amount: 650000000 },
    { key: 'AT-RISK-WORKS', title: 'Works Tender At Risk Demo', procurementType: 'WORKS', status: ContractStatus.AT_RISK, supplier: actors.suppliers.risky, amount: 1250000000 },
    { key: 'COMPLETED-SERVICES', title: 'Services Tender Completed Demo', procurementType: 'SERVICE', status: ContractStatus.COMPLETED, supplier: actors.suppliers.closed, amount: 180000000 },
    { key: 'WARRANTY-GOODS', title: 'Goods Tender Warranty Defects Demo', procurementType: 'GOODS', status: ContractStatus.WARRANTY_DEFECTS, supplier: actors.suppliers.closed, amount: 390000000 },
    { key: 'TERMINATION-REVIEW', title: 'Works Tender Termination Review Demo', procurementType: 'WORKS', status: ContractStatus.TERMINATION_REVIEW, supplier: actors.suppliers.terminated, amount: 850000000 },
    { key: 'TERMINATED-SERVICES', title: 'Services Tender Terminated Demo', procurementType: 'SERVICE', status: ContractStatus.TERMINATED, supplier: actors.suppliers.terminated, amount: 210000000 },
    { key: 'CLOSED-CONSULTANCY', title: 'Consultancy Tender Closed Demo', procurementType: 'CONSULTANCY', status: ContractStatus.CLOSED, supplier: actors.suppliers.closed, amount: 160000000 }
  ];

  let richContract: any = null;
  let complianceTenderId = '';
  let complianceBidId = '';

  for (const [index, scenario] of scenarios.entries()) {
    const result = await withDbContext(adminContext, async (tx) => {
      const db = tx as AnyDb;
      const base = await createAwardBase(db, actors, scenario, RecommendationStatus.APPROVED);
      await seedAwardSideRecords(db, actors, base, index);
      const noticeStatus =
        scenario.status === ContractStatus.DRAFT
          ? AwardNoticeStatus.PENDING_RESPONSE
          : scenario.status === ContractStatus.NEGOTIATION
            ? AwardNoticeStatus.CLARIFICATION_REQUESTED
            : AwardNoticeStatus.ACCEPTED;
      const { contract } = await createNoticeAndContract(db, actors, scenario, base, noticeStatus);
      const rich = scenario.key === 'ACTIVE-GOODS';
      await seedContractCore(db, actors, scenario, contract, rich);
      const deliveryRefs = await seedContractDelivery(db, actors, scenario, contract, rich);
      await seedFinance(db, actors, scenario, contract, deliveryRefs, rich);
      await seedRiskTerminationPerformance(db, actors, scenario, contract, rich);
      await seedDocumentsAndApprovals(db, actors, scenario, contract);
      return { contract, tenderId: base.tender.id, bidId: base.bid.id, rich };
    });
    if (result.rich) richContract = result.contract;
    if (scenario.status === ContractStatus.AT_RISK) {
      complianceTenderId = result.tenderId;
      complianceBidId = result.bidId;
    }
  }

  await withDbContext(adminContext, async (tx) => {
    const db = tx as AnyDb;
    await seedAwardOnlyVariety(db, actors);
    await seedGroupedAwardDemo(db, actors);
  });

  if (richContract && complianceTenderId && complianceBidId) {
    await withDbContext(adminContext, async (tx) => {
      const db = tx as AnyDb;
      await seedCompliance(db, actors, richContract, complianceTenderId, complianceBidId);
    });
  }
}

export async function cleanupAwardContractDemo() {
  const adminContext = { accountType: AccountType.ADMIN };
  await withDbContext(adminContext, async (tx) => {
    const db = tx as AnyDb;
    await resetDemoDataset(db);
    await cleanupDemoActors(db);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const command = process.argv[2];
  const action = command === 'cleanup' ? cleanupAwardContractDemo : seedAwardContractDemo;
  action()
    .then(async () => {
      console.log(command === 'cleanup' ? `Removed ${AWARD_CONTRACT_DEMO_DATASET} demo records.` : `Seeded ${AWARD_CONTRACT_DEMO_DATASET} demo records.`);
      await prisma.$disconnect();
    })
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
 
