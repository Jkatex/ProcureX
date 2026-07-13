import {
  AccountType,
  AdminActionType,
  AuditSeverity,
  BidStatus,
  ComplianceCaseStatus,
  ContractStatus,
  EvaluationStage,
  EvaluationStatus,
  MemberStatus,
  OrganizationCapabilityName,
  ProcurementMethod,
  RecommendationStatus,
  SessionStatus,
  TenderStatus,
  TenderType,
  VerificationStatus,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type {
  AdminActionInput,
  AuditListQuery,
  CaseListQuery,
  CaseUpdateInput,
  DataStoreEntryCreateInput,
  DataStoreEntryQuery,
  DataStoreEntryUpdateInput,
  DataStoreNamespaceQuery,
  RuleCreateInput,
  RuleListQuery,
  RuleUpdateInput,
  AnalyticsQuery,
  SearchQuery,
  UserListQuery
} from './types.js';

type AdminDb = PrismaClient | Prisma.TransactionClient;

const userAdminInclude = {
  memberships: {
    include: {
      organization: {
        include: {
          supplierProfile: true,
          trustTierHistory: {
            orderBy: { createdAt: 'desc' },
            take: 5
          },
          capabilities: { where: { enabled: true } }
        }
      }
    },
    orderBy: [{ isDefault: 'desc' as const }, { createdAt: 'desc' as const }],
    take: 3
  },
  permissionOverrides: { orderBy: { createdAt: 'desc' as const }, take: 8 },
  verificationProfiles: {
    orderBy: { updatedAt: 'desc' as const },
    take: 1,
    include: {
      documents: {
        include: { document: { select: { name: true, documentType: true } } },
        take: 6
      },
      history: { orderBy: { createdAt: 'desc' as const }, take: 5 }
    }
  },
  screeningChecks: { orderBy: { createdAt: 'desc' as const }, take: 1 },
  sessions: { orderBy: { createdAt: 'desc' as const }, take: 1 }
} satisfies Prisma.UserInclude;

const caseInclude = {
  ownerOrg: { select: { id: true, name: true } }
} satisfies Prisma.ComplianceCaseInclude;

const auditInclude = {
  ownerOrg: { select: { id: true, name: true } },
  actorUser: { select: { id: true, displayName: true, email: true, accountType: true } }
} satisfies Prisma.AuditEventInclude;

const adminActionInclude = {
  ownerOrg: { select: { id: true, name: true } },
  actorUser: { select: { id: true, displayName: true, email: true } }
} satisfies Prisma.AdminActionInclude;

const dataStoreInclude = {
  ownerUser: { select: { id: true, displayName: true, email: true } },
  createdByUser: { select: { id: true, displayName: true, email: true } },
  updatedByUser: { select: { id: true, displayName: true, email: true } },
  deletedByUser: { select: { id: true, displayName: true, email: true } }
} satisfies Prisma.DataStoreEntryInclude;

const dataStoreVersionInclude = {
  actorUser: { select: { id: true, displayName: true, email: true } }
} satisfies Prisma.DataStoreEntryVersionInclude;

export type AdminUserRow = Prisma.UserGetPayload<{ include: typeof userAdminInclude }>;
export type ComplianceCaseRow = Prisma.ComplianceCaseGetPayload<{ include: typeof caseInclude }>;
export type AuditEventRow = Prisma.AuditEventGetPayload<{ include: typeof auditInclude }>;
export type AdminActionRow = Prisma.AdminActionGetPayload<{ include: typeof adminActionInclude }>;
export type ComplianceRuleRow = Prisma.ComplianceRuleGetPayload<object>;
export type DataStoreEntryRow = Prisma.DataStoreEntryGetPayload<{ include: typeof dataStoreInclude }>;
export type DataStoreEntryVersionRow = Prisma.DataStoreEntryVersionGetPayload<{ include: typeof dataStoreVersionInclude }>;

type AdminSearchUserRow = {
  id: string;
  email: string;
  displayName: string;
  accountType: AccountType;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  updatedAt: Date;
};

type AdminSearchOrganizationRow = {
  id: string;
  name: string;
  kind: string;
  taxId: string | null;
  country: string;
  createdAt: Date;
  updatedAt: Date;
};

type AdminSearchTenderRow = {
  id: string;
  reference: string;
  title: string;
  status: TenderStatus;
  type: TenderType;
  method: ProcurementMethod;
  budget: Prisma.Decimal | null;
  currency: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  buyerOrg: { name: string };
  riskSignals: Array<{ id: string }>;
};

type AdminSearchBidRow = {
  id: string;
  reference: string;
  status: BidStatus;
  totalAmount: Prisma.Decimal | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  tender: { title: string; reference: string };
  supplierOrg: { name: string };
  buyerOrg: { name: string };
};

type AdminSearchContractRow = {
  id: string;
  reference: string;
  title: string;
  status: ContractStatus;
  amount: Prisma.Decimal | null;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  buyerOrg: { name: string };
  supplierOrg: { name: string } | null;
};

type AdminSearchAuditEventRow = {
  id: string;
  event: string;
  entityType: string;
  entityRef: string | null;
  severity: AuditSeverity;
  payload: Prisma.JsonValue;
  createdAt: Date;
  actorUser: { accountType: AccountType; displayName: string } | null;
};

type AdminSearchRecordRow = {
  id: string;
  title: string;
  entityType: string;
  entityRef: string;
  createdAt: Date;
};

type AdminSearchDocumentRow = {
  id: string;
  name: string;
  documentType: string;
  createdAt: Date;
  ownerOrg: { name: string } | null;
  uploadedByUser: { displayName: string; email: string } | null;
};

type AdminSearchEvaluationRow = {
  id: string;
  status: EvaluationStatus;
  currentStage: EvaluationStage | null;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  tender: { title: string; reference: string };
  buyerOrg: { name: string };
};

type AdminSearchAwardRow = {
  id: string;
  status: RecommendationStatus;
  amount: Prisma.Decimal | null;
  currency: string;
  reason: string | null;
  createdAt: Date;
  workspace: { tender: { title: string; reference: string }; buyerOrg: { name: string } };
};

export type AdminSearchResultRows = {
  users: AdminSearchUserRow[];
  organizations: AdminSearchOrganizationRow[];
  tenders: AdminSearchTenderRow[];
  bids: AdminSearchBidRow[];
  contracts: AdminSearchContractRow[];
  auditEvents: AdminSearchAuditEventRow[];
  records: AdminSearchRecordRow[];
  documents: AdminSearchDocumentRow[];
  evaluations: AdminSearchEvaluationRow[];
  awards: AdminSearchAwardRow[];
  complianceCases: ComplianceCaseRow[];
};

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  findActiveSession(tokenHash: string, db: AdminDb = this.db) {
    return db.session.findFirst({
      where: {
        tokenHash,
        status: SessionStatus.ACTIVE,
        expiresAt: { gt: new Date() }
      },
      include: {
        user: { select: { id: true, accountType: true, displayName: true, email: true } },
        organization: { select: { id: true, name: true } }
      }
    });
  }

  async dashboard(db: AdminDb = this.db) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);
    const openCaseWhere = {
      status: { in: [ComplianceCaseStatus.OPEN, ComplianceCaseStatus.INVESTIGATION, ComplianceCaseStatus.ESCALATED] }
    } satisfies Prisma.ComplianceCaseWhereInput;

    const [
      users,
      admins,
      organizations,
      tenders,
      bids,
      contracts,
      openCases,
      criticalCases,
      riskSignals,
      auditEvents,
      rules,
      activeTenders,
      pendingVerification,
      resolvedCases,
      totalCases,
      evaluationDrafts,
      auditEventsToday,
      riskGroups,
      openComplianceItems,
      recentActions,
      weeklyActions,
      evaluationOversight,
      exceptionLog,
      checklistPreview
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { accountType: AccountType.ADMIN } }),
      db.organization.count(),
      db.tender.count(),
      db.bid.count(),
      db.contract.count(),
      db.complianceCase.count({ where: openCaseWhere }),
      db.complianceCase.count({ where: { severity: { in: [AuditSeverity.ERROR, AuditSeverity.CRITICAL] } } }),
      db.riskSignal.count(),
      db.auditEvent.count(),
      db.complianceRule.count(),
      db.tender.count({ where: { status: { in: adminStatusFilters.activeTender } } }),
      db.user.count({ where: { verificationStatus: VerificationStatus.PENDING } }),
      db.complianceCase.count({ where: { status: { in: [ComplianceCaseStatus.RESOLVED, ComplianceCaseStatus.FALSE_POSITIVE] } } }),
      db.complianceCase.count(),
      db.evaluationWorkspace.count({ where: { status: { in: [EvaluationStatus.NOT_STARTED, EvaluationStatus.IN_PROGRESS, EvaluationStatus.RETURNED] } } }),
      db.auditEvent.count({ where: { createdAt: { gte: today } } }),
      db.riskSignal.groupBy({ by: ['riskLevel'], _count: { _all: true } }),
      db.complianceCase.findMany({
        where: openCaseWhere,
        include: caseInclude,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 8
      }),
      db.adminAction.findMany({
        include: adminActionInclude,
        orderBy: { createdAt: 'desc' },
        take: 8
      }),
      db.adminAction.findMany({
        where: { createdAt: { gte: weekStart } },
        select: { id: true, createdAt: true },
        orderBy: { createdAt: 'asc' }
      }),
      db.evaluationWorkspace.findMany({
        where: { status: { in: [EvaluationStatus.NOT_STARTED, EvaluationStatus.IN_PROGRESS, EvaluationStatus.RETURNED] } },
        select: {
          id: true,
          status: true,
          currentStage: true,
          progress: true,
          updatedAt: true,
          buyerOrg: { select: { name: true } },
          tender: { select: { title: true, reference: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: 6
      }),
      db.complianceCase.findMany({
        where: {
          OR: [{ severity: { in: [AuditSeverity.ERROR, AuditSeverity.CRITICAL] } }, openCaseWhere]
        },
        include: caseInclude,
        orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
        take: 6
      }),
      db.complianceRule.findMany({
        where: { OR: [{ code: { startsWith: 'CHECKLIST.' } }, { status: 'ACTIVE' }] },
        orderBy: { updatedAt: 'desc' },
        take: 6
      })
    ]);

    return {
      counts: {
        users,
        admins,
        organizations,
        tenders,
        bids,
        contracts,
        openCases,
        criticalCases,
        riskSignals,
        auditEvents,
        rules,
        activeTenders,
        pendingReviews: openCases + pendingVerification,
        flaggedIssues: criticalCases + riskSignals,
        complianceRate: totalCases ? Math.round((resolvedCases / totalCases) * 100) : 100,
        evaluationDrafts,
        auditEventsToday
      },
      riskGroups,
      openComplianceItems,
      recentActions,
      weeklyActions,
      evaluationOversight,
      exceptionLog,
      checklistPreview
    };
  }

  async users(query: UserListQuery, db: AdminDb = this.db) {
    const where: Prisma.UserWhereInput = {};
    if (query.q) {
      where.OR = [
        { email: { contains: query.q, mode: 'insensitive' } },
        { displayName: { contains: query.q, mode: 'insensitive' } },
        { phone: { contains: query.q, mode: 'insensitive' } },
        { memberships: { some: { organization: { name: { contains: query.q, mode: 'insensitive' } } } } }
      ];
    }
    if (query.verificationStatus) where.verificationStatus = query.verificationStatus as VerificationStatus;
    if (query.accountType) where.accountType = query.accountType as AccountType;
    if (query.role) {
      const capability = enumValue(OrganizationCapabilityName, query.role);
      where.memberships = {
        some: {
          OR: [
            { title: { contains: query.role, mode: 'insensitive' } },
            ...(capability ? [{ organization: { capabilities: { some: { capability, enabled: true } } } }] : [])
          ]
        }
      };
    }

    const [total, items] = await Promise.all([
      db.user.count({ where }),
      db.user.findMany({
        where,
        include: userAdminInclude,
        orderBy: { updatedAt: 'desc' },
        skip: pageOffset(query),
        take: query.pageSize
      })
    ]);

    return { items, total };
  }

  async search(query: SearchQuery, db: AdminDb = this.db): Promise<AdminSearchResultRows> {
    const term = query.q;
    const take = Math.min(query.pageSize, 25);
    const shouldRun = (type: string) => !query.type || query.type === type;
    const createdAt = dateRange(query);
    const updatedAt = dateRange(query);
    const status = query.status?.toUpperCase();
    const stage = query.stage?.toUpperCase();
    const amount = amountRange(query);

    const [users, organizations, tenders, bids, contracts, auditEvents, records, documents, evaluations, awards, complianceCases] = await Promise.all([
      shouldRun('users')
        ? db.user.findMany({
            where: compactAnd(
              searchText(term, ['email', 'displayName', 'phone']),
              status ? { verificationStatus: enumValue(VerificationStatus, status) ?? undefined } : undefined,
              createdAt ? { createdAt } : undefined
            ) as Prisma.UserWhereInput,
            select: { id: true, email: true, displayName: true, accountType: true, verificationStatus: true, createdAt: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take
          })
        : [],
      shouldRun('organizations')
        ? db.organization.findMany({
            where: compactAnd(searchText(term, ['name', 'taxId', 'country']), createdAt ? { createdAt } : undefined) as Prisma.OrganizationWhereInput,
            select: { id: true, name: true, kind: true, taxId: true, country: true, createdAt: true, updatedAt: true },
            orderBy: { updatedAt: 'desc' },
            take
          })
        : [],
      shouldRun('tenders')
        ? db.tender.findMany({
            where: compactAnd(
              searchText(term, ['reference', 'title', 'description', 'location']),
              status ? { status: enumValue(TenderStatus, status) ?? undefined } : undefined,
              stage ? { OR: [{ type: enumValue(TenderType, stage) ?? undefined }, { method: enumValue(ProcurementMethod, stage) ?? undefined }] } : undefined,
              updatedAt ? { updatedAt } : undefined,
              amount ? { budget: amount } : undefined,
              query.flaggedOnly ? { riskSignals: { some: {} } } : undefined
            ) as Prisma.TenderWhereInput,
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
              type: true,
              method: true,
              budget: true,
              currency: true,
              description: true,
              createdAt: true,
              updatedAt: true,
              buyerOrg: { select: { name: true } },
              riskSignals: { select: { id: true }, take: 1 }
            },
            orderBy: { updatedAt: 'desc' },
            take
          })
        : [],
      shouldRun('bids')
        ? db.bid.findMany({
            where: compactAnd(
              searchText(term, ['reference']),
              status ? { status: enumValue(BidStatus, status) ?? undefined } : undefined,
              updatedAt ? { updatedAt } : undefined,
              amount ? { totalAmount: amount } : undefined
            ) as Prisma.BidWhereInput,
            select: {
              id: true,
              reference: true,
              status: true,
              totalAmount: true,
              currency: true,
              createdAt: true,
              updatedAt: true,
              tender: { select: { title: true, reference: true } },
              supplierOrg: { select: { name: true } },
              buyerOrg: { select: { name: true } }
            },
            orderBy: { updatedAt: 'desc' },
            take
          })
        : [],
      shouldRun('contracts')
        ? db.contract.findMany({
            where: compactAnd(
              searchText(term, ['reference', 'title']),
              status ? { status: enumValue(ContractStatus, status) ?? undefined } : undefined,
              updatedAt ? { updatedAt } : undefined,
              amount ? { amount } : undefined
            ) as Prisma.ContractWhereInput,
            select: {
              id: true,
              reference: true,
              title: true,
              status: true,
              amount: true,
              currency: true,
              createdAt: true,
              updatedAt: true,
              buyerOrg: { select: { name: true } },
              supplierOrg: { select: { name: true } }
            },
            orderBy: { updatedAt: 'desc' },
            take
          })
        : [],
      shouldRun('audit-events')
        ? db.auditEvent.findMany({
            where: compactAnd(
              searchText(term, ['event', 'entityType', 'entityRef']),
              status ? { severity: enumValue(AuditSeverity, status) ?? undefined } : undefined,
              query.flaggedOnly ? { severity: { in: [AuditSeverity.WARNING, AuditSeverity.ERROR, AuditSeverity.CRITICAL] } } : undefined,
              createdAt ? { createdAt } : undefined
            ) as Prisma.AuditEventWhereInput,
            select: { id: true, event: true, entityType: true, entityRef: true, severity: true, payload: true, createdAt: true, actorUser: { select: { accountType: true, displayName: true } } },
            orderBy: { createdAt: 'desc' },
            take
          })
        : [],
      shouldRun('records')
        ? db.recordEntry.findMany({
            where: compactAnd(searchText(term, ['title', 'entityType', 'entityRef']), createdAt ? { createdAt } : undefined) as Prisma.RecordEntryWhereInput,
            select: { id: true, title: true, entityType: true, entityRef: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
            take
          })
        : [],
      shouldRun('documents')
        ? db.documentObject.findMany({
            where: compactAnd(searchText(term, ['name', 'documentType']), createdAt ? { createdAt } : undefined) as Prisma.DocumentObjectWhereInput,
            select: { id: true, name: true, documentType: true, createdAt: true, ownerOrg: { select: { name: true } }, uploadedByUser: { select: { displayName: true, email: true } } },
            orderBy: { createdAt: 'desc' },
            take
          })
        : [],
      shouldRun('evaluations')
        ? db.evaluationWorkspace.findMany({
            where: compactAnd(
              term
                ? {
                    OR: [
                      { tender: { title: { contains: term, mode: 'insensitive' } } },
                      { tender: { reference: { contains: term, mode: 'insensitive' } } },
                      { buyerOrg: { name: { contains: term, mode: 'insensitive' } } }
                    ]
                  }
                : undefined,
              status ? { status: enumValue(EvaluationStatus, status) ?? undefined } : undefined,
              stage ? { currentStage: enumValue(EvaluationStage, stage) ?? undefined } : undefined,
              updatedAt ? { updatedAt } : undefined
            ) as Prisma.EvaluationWorkspaceWhereInput,
            select: {
              id: true,
              status: true,
              currentStage: true,
              progress: true,
              createdAt: true,
              updatedAt: true,
              tender: { select: { title: true, reference: true } },
              buyerOrg: { select: { name: true } }
            },
            orderBy: { updatedAt: 'desc' },
            take
          })
        : [],
      shouldRun('awards')
        ? db.awardRecommendation.findMany({
            where: compactAnd(
              term
                ? {
                    OR: [
                      { reason: { contains: term, mode: 'insensitive' } },
                      { workspace: { tender: { title: { contains: term, mode: 'insensitive' } } } },
                      { workspace: { tender: { reference: { contains: term, mode: 'insensitive' } } } }
                    ]
                  }
                : undefined,
              status ? { status: enumValue(RecommendationStatus, status) ?? undefined } : undefined,
              createdAt ? { createdAt } : undefined,
              amount ? { amount } : undefined
            ) as Prisma.AwardRecommendationWhereInput,
            select: {
              id: true,
              status: true,
              amount: true,
              currency: true,
              reason: true,
              createdAt: true,
              workspace: { select: { tender: { select: { title: true, reference: true } }, buyerOrg: { select: { name: true } } } }
            },
            orderBy: { createdAt: 'desc' },
            take
          })
        : [],
      shouldRun('compliance')
        ? db.complianceCase.findMany({
            where: compactAnd(
              searchText(term, ['title', 'owner']),
              status ? { status: enumValue(ComplianceCaseStatus, status) ?? undefined } : undefined,
              query.flaggedOnly ? { status: { in: [ComplianceCaseStatus.OPEN, ComplianceCaseStatus.INVESTIGATION, ComplianceCaseStatus.ESCALATED] } } : undefined,
              createdAt ? { createdAt } : undefined
            ) as Prisma.ComplianceCaseWhereInput,
            include: caseInclude,
            orderBy: { createdAt: 'desc' },
            take
          })
        : []
    ]);

    return { users, organizations, tenders, bids, contracts, auditEvents, records, documents, evaluations, awards, complianceCases };
  }

  async cases(query: CaseListQuery, db: AdminDb = this.db) {
    const where: Prisma.ComplianceCaseWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {})
    };
    const [total, items] = await Promise.all([
      db.complianceCase.count({ where }),
      db.complianceCase.findMany({
        where,
        include: caseInclude,
        orderBy: { createdAt: 'desc' },
        skip: pageOffset(query),
        take: query.pageSize
      })
    ]);

    return { items, total };
  }

  caseById(id: string, db: AdminDb = this.db) {
    return db.complianceCase.findUnique({ where: { id }, include: caseInclude });
  }

  updateCase(id: string, input: CaseUpdateInput, db: AdminDb = this.db) {
    return db.complianceCase.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.owner !== undefined ? { owner: input.owner } : {}),
        ...(input.payload ? { payload: input.payload as Prisma.InputJsonObject } : {})
      },
      include: caseInclude
    });
  }

  async rules(query: RuleListQuery, db: AdminDb = this.db) {
    const where: Prisma.ComplianceRuleWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.severity ? { severity: query.severity } : {})
    };
    const [total, items] = await Promise.all([
      db.complianceRule.count({ where }),
      db.complianceRule.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: pageOffset(query),
        take: query.pageSize
      })
    ]);

    return { items, total };
  }

  ruleById(id: string, db: AdminDb = this.db) {
    return db.complianceRule.findUnique({ where: { id } });
  }

  createRule(input: RuleCreateInput & { createdByUserId: string }, db: AdminDb = this.db) {
    return db.complianceRule.create({
      data: {
        ownerOrgId: input.ownerOrgId ?? null,
        code: input.code,
        title: input.title,
        description: input.description ?? null,
        severity: input.severity,
        status: input.status ?? 'ACTIVE',
        condition: input.condition as Prisma.InputJsonObject,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject,
        createdByUserId: input.createdByUserId
      }
    });
  }

  updateRule(id: string, input: RuleUpdateInput, db: AdminDb = this.db) {
    return db.complianceRule.update({
      where: { id },
      data: {
        ...(input.ownerOrgId !== undefined ? { ownerOrgId: input.ownerOrgId || null } : {}),
        ...(input.code ? { code: input.code } : {}),
        ...(input.title ? { title: input.title } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.severity ? { severity: input.severity } : {}),
        ...(input.status ? { status: input.status } : {}),
        ...(input.condition ? { condition: input.condition as Prisma.InputJsonObject } : {}),
        ...(input.payload ? { payload: input.payload as Prisma.InputJsonObject } : {})
      }
    });
  }

  async auditEvents(query: AuditListQuery, db: AdminDb = this.db) {
    const where: Prisma.AuditEventWhereInput = {
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(query.eventType ? { event: { contains: query.eventType, mode: 'insensitive' } } : {}),
      ...(query.actorRole ? { actorUser: { accountType: enumValue(AccountType, query.actorRole.toUpperCase()) } } : {}),
      ...(query.from || query.to ? { createdAt: dateRange(query) } : {}),
      ...(query.q ? { OR: searchText(query.q, ['event', 'entityType', 'entityRef']).OR } : {})
    };
    const [total, items] = await Promise.all([
      db.auditEvent.count({ where }),
      db.auditEvent.findMany({
        where,
        include: auditInclude,
        orderBy: { createdAt: 'desc' },
        skip: pageOffset(query),
        take: query.pageSize
      })
    ]);

    return { items, total };
  }

  async analytics(query: AnalyticsQuery = {}, db: AdminDb = this.db) {
    const createdAt = dateRange(query);
    const [
      users,
      organizations,
      tenders,
      bids,
      contracts,
      complianceCases,
      auditEvents,
      usersByVerificationStatus,
      tendersByStatus,
      bidsByStatus,
      complianceByStatus,
      auditBySeverity,
      tenderRows,
      bidRows,
      evaluationRows,
      awardRows,
      complianceRows
    ] = await Promise.all([
      db.user.count(),
      db.organization.count(),
      db.tender.count({ where: createdAt ? { createdAt } : undefined }),
      db.bid.count({ where: createdAt ? { createdAt } : undefined }),
      db.contract.count(),
      db.complianceCase.count(),
      db.auditEvent.count(),
      db.user.groupBy({ by: ['verificationStatus'], _count: { _all: true } }),
      db.tender.groupBy({ by: ['status'], _count: { _all: true } }),
      db.bid.groupBy({ by: ['status'], _count: { _all: true } }),
      db.complianceCase.groupBy({ by: ['status'], _count: { _all: true } }),
      db.auditEvent.groupBy({ by: ['severity'], _count: { _all: true } }),
      db.tender.findMany({
        where: createdAt ? { createdAt } : undefined,
        select: {
          id: true,
          type: true,
          status: true,
          budget: true,
          publishedAt: true,
          createdAt: true,
          buyerOrg: { select: { name: true } },
          categories: { select: { name: true }, take: 1 },
          bids: { select: { id: true } }
        },
        orderBy: { createdAt: 'desc' }
      }),
      db.bid.findMany({
        where: createdAt ? { createdAt } : undefined,
        select: { id: true, totalAmount: true, supplierOrg: { select: { name: true } } }
      }),
      db.evaluationWorkspace.findMany({
        where: createdAt ? { createdAt } : undefined,
        select: { status: true, createdAt: true, updatedAt: true }
      }),
      db.awardRecommendation.findMany({
        where: createdAt ? { createdAt } : undefined,
        select: { createdAt: true, workspace: { select: { tender: { select: { createdAt: true } } } } }
      }),
      db.complianceCase.findMany({
        where: createdAt ? { createdAt } : undefined,
        select: { status: true, createdAt: true }
      })
    ]);

    return {
      totals: { users, organizations, tenders, bids, contracts, complianceCases, auditEvents },
      usersByVerificationStatus,
      tendersByStatus,
      bidsByStatus,
      complianceByStatus,
      auditBySeverity,
      tenderRows,
      bidRows,
      evaluationRows,
      awardRows,
      complianceRows
    };
  }

  async dataStoreNamespaces(query: DataStoreNamespaceQuery, db: AdminDb = this.db) {
    const where = dataStoreWhere(query);
    return db.dataStoreEntry.groupBy({
      by: ['namespace', 'scope'],
      where,
      _count: { _all: true },
      _max: { updatedAt: true },
      orderBy: [{ namespace: 'asc' }, { scope: 'asc' }]
    });
  }

  async dataStoreEntries(query: DataStoreEntryQuery, db: AdminDb = this.db) {
    const where = dataStoreWhere(query);
    const [total, items] = await Promise.all([
      db.dataStoreEntry.count({ where }),
      db.dataStoreEntry.findMany({
        where,
        include: dataStoreInclude,
        orderBy: [{ namespace: 'asc' }, { key: 'asc' }],
        skip: pageOffset(query),
        take: query.pageSize
      })
    ]);

    return { items, total };
  }

  dataStoreEntry(id: string, db: AdminDb = this.db) {
    return db.dataStoreEntry.findUnique({
      where: { id },
      include: dataStoreInclude
    });
  }

  dataStoreEntryVersions(entryId: string, db: AdminDb = this.db) {
    return db.dataStoreEntryVersion.findMany({
      where: { entryId },
      include: dataStoreVersionInclude,
      orderBy: { createdAt: 'desc' },
      take: 25
    });
  }

  createDataStoreEntry(input: DataStoreEntryCreateInput & { actorUserId: string }, db: AdminDb = this.db) {
    return db.dataStoreEntry.create({
      data: {
        scope: input.scope,
        ownerUserId: input.scope === 'USER' ? input.ownerUserId ?? null : null,
        namespace: input.namespace,
        key: input.key,
        value: input.value as Prisma.InputJsonValue,
        encrypted: input.encrypted ?? false,
        createdByUserId: input.actorUserId,
        updatedByUserId: input.actorUserId,
        versions: {
          create: {
            actorUserId: input.actorUserId,
            action: 'created',
            nextValue: input.value as Prisma.InputJsonValue
          }
        }
      },
      include: dataStoreInclude
    });
  }

  async updateDataStoreEntry(id: string, input: DataStoreEntryUpdateInput & { actorUserId: string }, db: AdminDb = this.db) {
    const current = await db.dataStoreEntry.findUnique({ where: { id } });
    if (!current) return null;
    return db.dataStoreEntry.update({
      where: { id },
      data: {
        ...(input.namespace ? { namespace: input.namespace } : {}),
        ...(input.key ? { key: input.key } : {}),
        ...(input.value !== undefined ? { value: input.value as Prisma.InputJsonValue } : {}),
        ...(input.encrypted !== undefined ? { encrypted: input.encrypted } : {}),
        updatedByUserId: input.actorUserId,
        versions: {
          create: {
            actorUserId: input.actorUserId,
            action: 'updated',
            previousValue: current.value as Prisma.InputJsonValue,
            nextValue: (input.value ?? current.value) as Prisma.InputJsonValue
          }
        }
      },
      include: dataStoreInclude
    });
  }

  async softDeleteDataStoreEntry(id: string, actorUserId: string, db: AdminDb = this.db) {
    const current = await db.dataStoreEntry.findUnique({ where: { id } });
    if (!current) return null;
    return db.dataStoreEntry.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedByUserId: actorUserId,
        updatedByUserId: actorUserId,
        versions: {
          create: {
            actorUserId,
            action: 'deleted',
            previousValue: current.value as Prisma.InputJsonValue,
            nextValue: current.value as Prisma.InputJsonValue
          }
        }
      },
      include: dataStoreInclude
    });
  }

  async restoreDataStoreEntry(id: string, actorUserId: string, db: AdminDb = this.db) {
    const current = await db.dataStoreEntry.findUnique({ where: { id } });
    if (!current) return null;
    return db.dataStoreEntry.update({
      where: { id },
      data: {
        deletedAt: null,
        deletedByUserId: null,
        updatedByUserId: actorUserId,
        versions: {
          create: {
            actorUserId,
            action: 'restored',
            previousValue: current.value as Prisma.InputJsonValue,
            nextValue: current.value as Prisma.InputJsonValue
          }
        }
      },
      include: dataStoreInclude
    });
  }

  async restoreDataStoreVersion(versionId: string, actorUserId: string, db: AdminDb = this.db) {
    const version = await db.dataStoreEntryVersion.findUnique({ where: { id: versionId } });
    if (!version) return null;
    const current = await db.dataStoreEntry.findUnique({ where: { id: version.entryId } });
    if (!current) return null;
    const nextValue = version.previousValue ?? version.nextValue ?? {};
    return db.dataStoreEntry.update({
      where: { id: version.entryId },
      data: {
        value: nextValue as Prisma.InputJsonValue,
        updatedByUserId: actorUserId,
        versions: {
          create: {
            actorUserId,
            action: 'version_restored',
            previousValue: current.value as Prisma.InputJsonValue,
            nextValue: nextValue as Prisma.InputJsonValue
          }
        }
      },
      include: dataStoreInclude
    });
  }

  createAdminAction(actorUserId: string, input: AdminActionInput, db: AdminDb = this.db) {
    return db.adminAction.create({
      data: {
        actorUserId,
        ownerOrgId: input.ownerOrgId ?? null,
        actionType: input.actionType,
        entityType: input.entityType,
        entityRef: input.entityRef ?? null,
        summary: input.summary,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject,
        previousState: (input.previousState ?? {}) as Prisma.InputJsonObject,
        nextState: (input.nextState ?? {}) as Prisma.InputJsonObject,
        reversible: input.reversible ?? false
      },
      include: adminActionInclude
    });
  }

  adminAction(id: string, db: AdminDb = this.db) {
    return db.adminAction.findUnique({ where: { id }, include: adminActionInclude });
  }

  markAdminActionReverted(id: string, revertedByUserId: string, reverseActionId: string, db: AdminDb = this.db) {
    return db.adminAction.update({
      where: { id },
      data: { revertedAt: new Date(), revertedByUserId, reverseActionId },
      include: adminActionInclude
    });
  }

  userForAdmin(id: string, db: AdminDb = this.db) {
    return db.user.findUnique({ where: { id }, include: userAdminInclude });
  }

  async suspendUserMemberships(userId: string, db: AdminDb = this.db) {
    const previous = await db.organizationMember.findMany({
      where: { userId },
      select: { id: true, status: true }
    });
    await db.organizationMember.updateMany({
      where: { userId, status: MemberStatus.ACTIVE },
      data: { status: MemberStatus.SUSPENDED }
    });
    return previous;
  }

  reinstateUserMemberships(userId: string, db: AdminDb = this.db) {
    return db.organizationMember.updateMany({
      where: { userId, status: MemberStatus.SUSPENDED },
      data: { status: MemberStatus.ACTIVE }
    });
  }

  restoreUserMembershipStatuses(statuses: Array<{ id: string; status: MemberStatus }>, db: AdminDb = this.db) {
    return Promise.all(statuses.map((item) => db.organizationMember.update({ where: { id: item.id }, data: { status: item.status } })));
  }

  revokeUserSessions(userId: string, db: AdminDb = this.db) {
    return db.session.updateMany({
      where: { userId, status: SessionStatus.ACTIVE },
      data: { status: SessionStatus.REVOKED }
    });
  }

  createIdentityChallenge(input: { userId?: string | null; purpose: string; target: string; codeHash: string; expiresAt: Date; metadata?: Prisma.InputJsonObject }, db: AdminDb = this.db) {
    return db.identityChallenge.create({
      data: input
    });
  }

  createInvitedUser(input: { email: string; displayName: string; accountType: AccountType; metadata: Prisma.InputJsonObject }, db: AdminDb = this.db) {
    return db.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        accountType: input.accountType,
        verificationStatus: VerificationStatus.NOT_STARTED,
        metadata: input.metadata
      },
      include: userAdminInclude
    });
  }

  updateUserPreferences(userId: string, input: { preferredLanguage?: string; timezone?: string; metadata?: Prisma.InputJsonObject }, db: AdminDb = this.db) {
    return db.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        preferredLanguage: input.preferredLanguage ?? 'en',
        timezone: input.timezone ?? 'Africa/Dar_es_Salaam',
        metadata: input.metadata ?? {}
      },
      update: {
        ...(input.preferredLanguage ? { preferredLanguage: input.preferredLanguage } : {}),
        ...(input.timezone ? { timezone: input.timezone } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {})
      }
    });
  }

  updateCommunicationMessage(id: string, data: Prisma.CommunicationItemUpdateInput, db: AdminDb = this.db) {
    return db.communicationItem.update({
      where: { id },
      data
    });
  }

  async complianceReviews(query: Record<string, unknown>, db: AdminDb = this.db) {
    const where: Prisma.ComplianceReviewWhereInput = {
      ...(query.status ? { status: query.status as ComplianceCaseStatus } : {}),
      ...(query.ownerOrgId ? { ownerOrgId: query.ownerOrgId as string } : {}),
      ...(query.q ? { OR: [{ reviewType: { contains: query.q as string, mode: 'insensitive' } }, { findings: { contains: query.q as string, mode: 'insensitive' } }] } : {})
    };
    const [total, items] = await Promise.all([
      db.complianceReview.count({ where }),
      db.complianceReview.findMany({ where, orderBy: { createdAt: 'desc' }, skip: pageOffset(query as { page: number; pageSize: number }), take: query.pageSize as number })
    ]);
    return { total, items };
  }

  createComplianceReview(input: Record<string, unknown>, actorUserId: string, db: AdminDb = this.db) {
    return db.complianceReview.create({
      data: {
        ownerOrgId: input.ownerOrgId as string | undefined,
        entityType: input.entityType as string,
        entityRef: input.entityRef as string | undefined,
        reviewType: input.reviewType as string,
        status: (input.status as ComplianceCaseStatus | undefined) ?? ComplianceCaseStatus.OPEN,
        severity: (input.severity as AuditSeverity | undefined) ?? AuditSeverity.WARNING,
        assignedUserId: (input.assignedUserId as string | undefined) ?? actorUserId,
        findings: input.findings as string | undefined,
        decision: input.decision as string | undefined,
        dueDate: input.dueDate ? new Date(`${input.dueDate as string}T00:00:00.000Z`) : undefined,
        completedAt: input.completedAt ? new Date(input.completedAt as string) : undefined,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject
      }
    });
  }

  async violationCases(query: Record<string, unknown>, db: AdminDb = this.db) {
    const where: Prisma.ViolationCaseWhereInput = {
      ...(query.status ? { status: query.status as ComplianceCaseStatus } : {}),
      ...(query.ownerOrgId ? { ownerOrgId: query.ownerOrgId as string } : {}),
      ...(query.supplierOrgId ? { supplierOrgId: query.supplierOrgId as string } : {}),
      ...(query.q ? { OR: [{ title: { contains: query.q as string, mode: 'insensitive' } }, { violationType: { contains: query.q as string, mode: 'insensitive' } }] } : {})
    };
    const [total, items] = await Promise.all([
      db.violationCase.count({ where }),
      db.violationCase.findMany({ where, orderBy: { createdAt: 'desc' }, skip: pageOffset(query as { page: number; pageSize: number }), take: query.pageSize as number })
    ]);
    return { total, items };
  }

  createViolationCase(input: Record<string, unknown>, db: AdminDb = this.db) {
    return db.violationCase.create({
      data: {
        reviewId: input.reviewId as string | undefined,
        ownerOrgId: input.ownerOrgId as string | undefined,
        supplierOrgId: input.supplierOrgId as string | undefined,
        title: input.title as string,
        violationType: input.violationType as string,
        severity: (input.severity as AuditSeverity | undefined) ?? AuditSeverity.WARNING,
        status: (input.status as ComplianceCaseStatus | undefined) ?? ComplianceCaseStatus.OPEN,
        statement: input.statement as string | undefined,
        assignedUserId: input.assignedUserId as string | undefined,
        decision: input.decision as string | undefined,
        decidedAt: input.decidedAt ? new Date(input.decidedAt as string) : undefined,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject
      }
    });
  }

  createViolationEvidence(input: Record<string, unknown>, actorUserId: string, db: AdminDb = this.db) {
    return db.violationEvidence.create({
      data: {
        violationId: input.violationId as string,
        documentId: input.documentId as string | undefined,
        evidenceType: input.evidenceType as string,
        description: input.description as string | undefined,
        submittedByUserId: actorUserId,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject
      }
    });
  }

  async enforcementRecords(query: Record<string, unknown>, db: AdminDb = this.db) {
    const where: Prisma.EnforcementRecordWhereInput = {
      ...(query.status ? { status: query.status as string } : {}),
      ...(query.supplierOrgId ? { supplierOrgId: query.supplierOrgId as string } : {}),
      ...(query.q ? { OR: [{ enforcementType: { contains: query.q as string, mode: 'insensitive' } }, { actionSummary: { contains: query.q as string, mode: 'insensitive' } }] } : {})
    };
    const [total, items] = await Promise.all([
      db.enforcementRecord.count({ where }),
      db.enforcementRecord.findMany({ where, orderBy: { createdAt: 'desc' }, skip: pageOffset(query as { page: number; pageSize: number }), take: query.pageSize as number })
    ]);
    return { total, items };
  }

  createEnforcementRecord(input: Record<string, unknown>, actorUserId: string, db: AdminDb = this.db) {
    return db.enforcementRecord.create({
      data: {
        violationId: input.violationId as string | undefined,
        supplierOrgId: input.supplierOrgId as string | undefined,
        enforcementType: input.enforcementType as string,
        status: (input.status as string | undefined) ?? 'PENDING',
        severity: (input.severity as AuditSeverity | undefined) ?? AuditSeverity.WARNING,
        effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom as string) : undefined,
        effectiveTo: input.effectiveTo ? new Date(input.effectiveTo as string) : undefined,
        actionSummary: input.actionSummary as string | undefined,
        issuedByUserId: actorUserId,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject
      }
    });
  }

  async appealRecords(query: Record<string, unknown>, db: AdminDb = this.db) {
    const where: Prisma.AppealRecordWhereInput = {
      ...(query.status ? { status: query.status as string } : {}),
      ...(query.ownerOrgId ? { appellantOrgId: query.ownerOrgId as string } : {}),
      ...(query.q ? { OR: [{ appealGrounds: { contains: query.q as string, mode: 'insensitive' } }, { decision: { contains: query.q as string, mode: 'insensitive' } }] } : {})
    };
    const [total, items] = await Promise.all([
      db.appealRecord.count({ where }),
      db.appealRecord.findMany({ where, orderBy: { createdAt: 'desc' }, skip: pageOffset(query as { page: number; pageSize: number }), take: query.pageSize as number })
    ]);
    return { total, items };
  }

  createAppealRecord(input: Record<string, unknown>, actorUserId: string, db: AdminDb = this.db) {
    return db.appealRecord.create({
      data: {
        enforcementId: input.enforcementId as string | undefined,
        violationId: input.violationId as string | undefined,
        appellantOrgId: input.appellantOrgId as string | undefined,
        appealGrounds: input.appealGrounds as string,
        status: (input.status as string | undefined) ?? 'SUBMITTED',
        reviewerUserId: actorUserId,
        decision: input.decision as string | undefined,
        decidedAt: input.decidedAt ? new Date(input.decidedAt as string) : undefined,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject
      }
    });
  }

  async collusionAlerts(query: Record<string, unknown>, db: AdminDb = this.db) {
    const where: Prisma.CollusionAlertWhereInput = {
      ...(query.status ? { status: query.status as string } : {}),
      ...(query.supplierOrgId ? { supplierOrgId: query.supplierOrgId as string } : {}),
      ...(query.tenderId ? { tenderId: query.tenderId as string } : {}),
      ...(query.q ? { OR: [{ alertType: { contains: query.q as string, mode: 'insensitive' } }, { signalSummary: { contains: query.q as string, mode: 'insensitive' } }] } : {})
    };
    const [total, items] = await Promise.all([
      db.collusionAlert.count({ where }),
      db.collusionAlert.findMany({ where, orderBy: { createdAt: 'desc' }, skip: pageOffset(query as { page: number; pageSize: number }), take: query.pageSize as number })
    ]);
    return { total, items };
  }

  createCollusionAlert(input: Record<string, unknown>, db: AdminDb = this.db) {
    return db.collusionAlert.create({
      data: {
        tenderId: input.tenderId as string | undefined,
        bidId: input.bidId as string | undefined,
        supplierOrgId: input.supplierOrgId as string | undefined,
        alertType: input.alertType as string,
        severity: (input.severity as AuditSeverity | undefined) ?? AuditSeverity.WARNING,
        status: (input.status as string | undefined) ?? 'OPEN',
        confidence: input.confidence as number | undefined,
        signalSummary: input.signalSummary as string | undefined,
        assignedUserId: input.assignedUserId as string | undefined,
        resolvedAt: input.resolvedAt ? new Date(input.resolvedAt as string) : undefined,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject
      }
    });
  }

  async supplierRiskProfiles(query: Record<string, unknown>, db: AdminDb = this.db) {
    const where: Prisma.SupplierRiskProfileWhereInput = {
      ...(query.supplierOrgId ? { supplierOrgId: query.supplierOrgId as string } : {}),
      ...(query.status ? { riskLevel: query.status as any } : {}),
      ...(query.q ? { summary: { contains: query.q as string, mode: 'insensitive' } } : {})
    };
    const [total, items] = await Promise.all([
      db.supplierRiskProfile.count({ where }),
      db.supplierRiskProfile.findMany({ where, orderBy: [{ riskScore: 'desc' }, { updatedAt: 'desc' }], skip: pageOffset(query as { page: number; pageSize: number }), take: query.pageSize as number })
    ]);
    return { total, items };
  }

  async upsertSupplierRiskProfile(input: Record<string, unknown>, actorUserId: string, db: AdminDb = this.db) {
    const supplierOrgId = input.supplierOrgId as string;
    const existing = await db.supplierRiskProfile.findUnique({ where: { supplierOrgId } });
    const profile = await db.supplierRiskProfile.upsert({
      where: { supplierOrgId },
      update: {
        riskLevel: input.riskLevel as any,
        riskScore: input.riskScore as number | undefined,
        trustTier: input.trustTier as string | undefined,
        activeAlerts: input.activeAlerts as number | undefined,
        openViolations: input.openViolations as number | undefined,
        lastReviewedAt: new Date(),
        reviewerUserId: actorUserId,
        summary: input.summary as string | undefined,
        drivers: (input.drivers ?? []) as Prisma.InputJsonArray,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject
      },
      create: {
        supplierOrgId,
        riskLevel: (input.riskLevel as any) ?? 'MEDIUM',
        riskScore: (input.riskScore as number | undefined) ?? 50,
        trustTier: (input.trustTier as string | undefined) ?? 'UNVERIFIED',
        activeAlerts: (input.activeAlerts as number | undefined) ?? 0,
        openViolations: (input.openViolations as number | undefined) ?? 0,
        lastReviewedAt: new Date(),
        reviewerUserId: actorUserId,
        summary: input.summary as string | undefined,
        drivers: (input.drivers ?? []) as Prisma.InputJsonArray,
        payload: (input.payload ?? {}) as Prisma.InputJsonObject
      }
    });
    return { profile, previous: existing };
  }

  createAuditEvent(input: {
    actorUserId: string;
    ownerOrgId?: string | null;
    event: string;
    entityType: string;
    entityRef?: string | null;
    severity?: AuditSeverity;
    payload?: Prisma.InputJsonObject;
  }, db: AdminDb = this.db) {
    return db.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        ownerOrgId: input.ownerOrgId ?? null,
        event: input.event,
        entityType: input.entityType,
        entityRef: input.entityRef ?? null,
        severity: input.severity ?? AuditSeverity.INFO,
        payload: input.payload ?? {}
      }
    });
  }
}

function pageOffset(query: { page: number; pageSize: number }) {
  return (query.page - 1) * query.pageSize;
}

function compactAnd(...parts: Array<object | undefined>) {
  const filtered = parts.filter((part): part is Record<string, unknown> => Boolean(part && Object.keys(part).length > 0));
  return filtered.length ? { AND: filtered } : {};
}

function searchText<T extends string>(term: string, fields: T[]) {
  if (!term) return {};
  return {
    OR: fields.map((field) => ({
      [field]: { contains: term, mode: 'insensitive' }
    }))
  };
}

function dateRange(query: { from?: Date; to?: Date }) {
  if (!query.from && !query.to) return undefined;
  return {
    ...(query.from ? { gte: query.from } : {}),
    ...(query.to ? { lte: query.to } : {})
  };
}

function amountRange(query: { minAmount?: number; maxAmount?: number }) {
  if (query.minAmount === undefined && query.maxAmount === undefined) return undefined;
  return {
    ...(query.minAmount !== undefined ? { gte: query.minAmount } : {}),
    ...(query.maxAmount !== undefined ? { lte: query.maxAmount } : {})
  };
}

function dataStoreWhere(query: DataStoreNamespaceQuery | DataStoreEntryQuery): Prisma.DataStoreEntryWhereInput {
  const where: Prisma.DataStoreEntryWhereInput = {
    ...(query.scope ? { scope: query.scope } : {}),
    ...('namespace' in query && query.namespace ? { namespace: query.namespace } : {}),
    ...('ownerUserId' in query && query.ownerUserId ? { ownerUserId: query.ownerUserId } : {})
  };
  const q = query.q?.trim();
  if (!q) return where;
  if (q.startsWith('#')) {
    where.key = { contains: q.slice(1), mode: 'insensitive' };
    return where;
  }
  const [namespace, key] = q.split('#');
  if (q.includes('#')) {
    where.namespace = { contains: namespace, mode: 'insensitive' };
    if (key) where.key = { contains: key, mode: 'insensitive' };
    return where;
  }
  where.OR = [
    { namespace: { contains: q, mode: 'insensitive' } },
    { key: { contains: q, mode: 'insensitive' } }
  ];
  return where;
}

function enumValue<T extends Record<string, string>>(source: T, value: string | undefined) {
  if (!value) return undefined;
  const normalized = value.toUpperCase().replace(/[\s-]+/g, '_');
  return Object.values(source).find((item) => item === normalized) as T[keyof T] | undefined;
}

export const adminStatusFilters = {
  activeTender: [TenderStatus.DRAFT, TenderStatus.REVIEW, TenderStatus.PUBLISHED, TenderStatus.OPEN, TenderStatus.EVALUATION],
  activeBid: [BidStatus.DRAFT, BidStatus.SUBMITTED, BidStatus.OPENED, BidStatus.UNDER_EVALUATION],
  activeContract: [
    ContractStatus.DRAFT,
    ContractStatus.NEGOTIATION,
    ContractStatus.SIGNATURE_PENDING,
    ContractStatus.SIGNED,
    ContractStatus.MOBILIZATION,
    ContractStatus.ACTIVE,
    ContractStatus.AT_RISK,
    ContractStatus.TERMINATION_REVIEW
  ],
  adminActionReview: AdminActionType.REVIEW
};
