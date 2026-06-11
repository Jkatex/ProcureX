import {
  BidStatus,
  CommunicationPriority,
  CommunicationStatus,
  ComplianceCaseStatus,
  ContractStatus,
  EvaluationStatus,
  RecommendationStatus,
  TenderStatus,
  type Prisma,
  type PrismaClient
} from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import type {
  DashboardActionDto,
  DashboardActiveWorkDto,
  DashboardDeadlineDto,
  DashboardPipelineStageDto,
  DashboardPriority,
  DashboardQuery,
  WorkspaceDashboardDto
} from './types.js';

const currency = 'TZS';

export class ModuleRepository {
  constructor(private readonly db: PrismaClient = prisma) {}

  async health() {
    return { ready: true };
  }

  async workspaceDashboard(query: DashboardQuery): Promise<WorkspaceDashboardDto> {
    const now = new Date();
    const deadlineLimit = addDays(now, query.deadlineWindowDays);
    const organizationId = query.organizationId;

    const [
      draftTenders,
      publishedTenders,
      evaluationTenders,
      awardedTenders,
      activeContracts,
      completedTenders,
      completedContracts,
      myTenders,
      myBids,
      unreadMessages,
      actionRequiredMessages,
      attentionComplianceCases,
      activeEvaluationWorkspaces,
      activeAwards,
      planningLines,
      recordedValues,
      upcomingTenders,
      upcomingPlanLines,
      upcomingMilestones,
      actionMessages,
      draftTenderRows,
      complianceRows,
      activeTenderRows,
      activeBidRows,
      activeContractRows
    ] = await Promise.all([
      this.db.tender.count({ where: withTenderScope(organizationId, { status: { in: [TenderStatus.DRAFT, TenderStatus.REVIEW] } }) }),
      this.db.tender.count({ where: withTenderScope(organizationId, { status: { in: [TenderStatus.PUBLISHED, TenderStatus.OPEN] } }) }),
      this.db.tender.count({ where: withTenderScope(organizationId, { status: TenderStatus.EVALUATION }) }),
      this.db.tender.count({ where: withTenderScope(organizationId, { status: TenderStatus.AWARDED }) }),
      this.db.contract.count({
        where: withContractScope(organizationId, {
          status: { in: [ContractStatus.DRAFT, ContractStatus.NEGOTIATION, ContractStatus.SIGNATURE_PENDING, ContractStatus.ACTIVE] }
        })
      }),
      this.db.tender.count({ where: withTenderScope(organizationId, { status: TenderStatus.CLOSED }) }),
      this.db.contract.count({ where: withContractScope(organizationId, { status: ContractStatus.COMPLETED }) }),
      this.db.tender.count({ where: tenderScope(organizationId) }),
      this.db.bid.count({ where: bidScope(organizationId) }),
      this.db.communicationItem.count({
        where: withCommunicationScope(organizationId, {
          read: false,
          status: { not: CommunicationStatus.DELETED }
        })
      }),
      this.db.communicationItem.count({
        where: withCommunicationScope(organizationId, {
          status: { not: CommunicationStatus.DELETED },
          OR: [{ actionRequired: true }, { status: CommunicationStatus.ACTION_REQUIRED }]
        })
      }),
      this.db.complianceCase.count({
        where: withComplianceScope(organizationId, {
          status: { in: [ComplianceCaseStatus.OPEN, ComplianceCaseStatus.INVESTIGATION, ComplianceCaseStatus.ESCALATED] }
        })
      }),
      this.db.evaluationWorkspace.count({
        where: withEvaluationScope(organizationId, {
          status: { in: [EvaluationStatus.NOT_STARTED, EvaluationStatus.IN_PROGRESS, EvaluationStatus.RETURNED] }
        })
      }),
      this.db.awardRecommendation.count({
        where: withAwardScope(organizationId, {
          status: { in: [RecommendationStatus.DRAFT, RecommendationStatus.RECOMMENDED, RecommendationStatus.RETURNED] }
        })
      }),
      this.db.procurementPlanLine.count({ where: planLineScope(organizationId) }),
      this.getRecordedValues(organizationId),
      this.db.tender.findMany({
        where: withTenderScope(organizationId, {
          closingDate: { gte: now, lte: deadlineLimit },
          status: { notIn: [TenderStatus.CLOSED, TenderStatus.CANCELLED] }
        }),
        select: { id: true, title: true, reference: true, closingDate: true },
        orderBy: { closingDate: 'asc' },
        take: query.itemLimit
      }),
      this.db.procurementPlanLine.findMany({
        where: {
          ...planLineScope(organizationId),
          OR: [
            { openingDate: { gte: now, lte: deadlineLimit } },
            { closingDate: { gte: now, lte: deadlineLimit } },
            { expectedCompletionDate: { gte: now, lte: deadlineLimit } }
          ]
        },
        select: {
          id: true,
          tenderTitle: true,
          openingDate: true,
          closingDate: true,
          expectedCompletionDate: true
        },
        orderBy: [{ closingDate: 'asc' }, { openingDate: 'asc' }, { expectedCompletionDate: 'asc' }],
        take: query.itemLimit
      }),
      this.db.tenderMilestone.findMany({
        where: {
          dueDate: { gte: now, lte: deadlineLimit },
          tender: tenderScope(organizationId)
        },
        select: {
          id: true,
          name: true,
          dueDate: true,
          tender: { select: { title: true, reference: true } }
        },
        orderBy: { dueDate: 'asc' },
        take: query.itemLimit
      }),
      this.db.communicationItem.findMany({
        where: withCommunicationScope(organizationId, {
          status: { not: CommunicationStatus.DELETED },
          OR: [{ actionRequired: true }, { status: CommunicationStatus.ACTION_REQUIRED }, { read: false }]
        }),
        select: {
          id: true,
          subject: true,
          category: true,
          status: true,
          priority: true,
          createdAt: true,
          senderOrg: { select: { name: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: query.itemLimit
      }),
      this.db.tender.findMany({
        where: withTenderScope(organizationId, { status: { in: [TenderStatus.DRAFT, TenderStatus.REVIEW] } }),
        select: { id: true, title: true, reference: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: query.itemLimit
      }),
      this.db.complianceCase.findMany({
        where: withComplianceScope(organizationId, {
          status: { in: [ComplianceCaseStatus.OPEN, ComplianceCaseStatus.INVESTIGATION, ComplianceCaseStatus.ESCALATED] }
        }),
        select: { id: true, title: true, severity: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: query.itemLimit
      }),
      this.db.tender.findMany({
        where: withTenderScope(organizationId, {
          status: { in: [TenderStatus.DRAFT, TenderStatus.REVIEW, TenderStatus.PUBLISHED, TenderStatus.OPEN, TenderStatus.EVALUATION] }
        }),
        select: { id: true, title: true, reference: true, status: true, closingDate: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: query.itemLimit
      }),
      this.db.bid.findMany({
        where: withBidScope(organizationId, {
          status: { in: [BidStatus.DRAFT, BidStatus.SUBMITTED, BidStatus.OPENED, BidStatus.UNDER_EVALUATION] }
        }),
        select: {
          id: true,
          reference: true,
          status: true,
          updatedAt: true,
          tender: { select: { title: true, closingDate: true } },
          supplierOrg: { select: { name: true } }
        },
        orderBy: { updatedAt: 'desc' },
        take: query.itemLimit
      }),
      this.db.contract.findMany({
        where: withContractScope(organizationId, {
          status: { in: [ContractStatus.DRAFT, ContractStatus.NEGOTIATION, ContractStatus.SIGNATURE_PENDING, ContractStatus.ACTIVE] }
        }),
        select: { id: true, reference: true, title: true, status: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: query.itemLimit
      })
    ]);

    const deadlines = sortDeadlines([
      ...upcomingTenders.map((tender) => ({
        id: `tender:${tender.id}`,
        title: `${tender.reference} - ${tender.title}`,
        date: toIso(tender.closingDate),
        kind: 'Tender closing',
        route: '/procurement/marketplace'
      })),
      ...upcomingPlanLines.flatMap((line) => planLineDeadlines(line)),
      ...upcomingMilestones.map((milestone) => ({
        id: `milestone:${milestone.id}`,
        title: `${milestone.tender.reference} - ${milestone.name}`,
        date: toIso(milestone.dueDate),
        kind: 'Tender milestone',
        route: '/procurement/tender-details'
      }))
    ]).slice(0, query.itemLimit);

    const dueSoonCount = deadlines.filter((deadline) => new Date(deadline.date) <= addDays(now, 14)).length;
    const urgentCount = actionRequiredMessages + attentionComplianceCases + dueSoonCount;
    const workflowCount = myTenders + myBids + activeContracts + activeEvaluationWorkspaces + activeAwards + planningLines;
    const recordedValue = recordedValues.reduce((sum, value) => sum + value, 0);

    const summary = {
      urgentCount,
      workflowCount,
      unreadMessages,
      myTenders,
      myBids,
      recordedValue,
      currency,
      complianceStatus: attentionComplianceCases > 0 ? 'Attention needed' : 'Clear'
    } satisfies WorkspaceDashboardDto['summary'];

    const pipeline: DashboardPipelineStageDto[] = [
      { stage: 'Draft', count: draftTenders, route: '/procurement/create-tender' },
      { stage: 'Published', count: publishedTenders, route: '/procurement/marketplace' },
      { stage: 'Evaluation', count: evaluationTenders + activeEvaluationWorkspaces, route: '/evaluation' },
      { stage: 'Award', count: awardedTenders + activeAwards, route: '/awards-contracts' },
      { stage: 'Contract', count: activeContracts, route: '/awards-contracts/negotiation' },
      { stage: 'Completed', count: completedTenders + completedContracts, route: '/records' }
    ];

    const actionQueue = sortActions([
      ...actionMessages.map((message): DashboardActionDto => ({
        id: `message:${message.id}`,
        title: message.subject,
        subtitle: message.senderOrg?.name ? `${message.category} from ${message.senderOrg.name}` : message.category,
        status: displayEnum(message.status),
        route: '/communication',
        priority: priorityFromCommunication(message.priority),
        createdAt: message.createdAt.toISOString()
      })),
      ...draftTenderRows.map((tender): DashboardActionDto => ({
        id: `tender:${tender.id}`,
        title: tender.title,
        subtitle: tender.reference,
        status: displayEnum(tender.status),
        route: '/procurement/create-tender',
        priority: tender.status === TenderStatus.REVIEW ? 'High' : 'Normal',
        createdAt: tender.updatedAt.toISOString()
      })),
      ...complianceRows.map((item): DashboardActionDto => ({
        id: `compliance:${item.id}`,
        title: item.title,
        subtitle: `${displayEnum(item.severity)} compliance case`,
        status: displayEnum(item.status),
        route: '/records',
        priority: item.severity === 'CRITICAL' ? 'Urgent' : item.severity === 'ERROR' ? 'High' : 'Normal',
        createdAt: item.createdAt.toISOString()
      }))
    ]).slice(0, query.itemLimit);

    const activeWork = sortActiveWork([
      ...activeTenderRows.map((tender): DashboardActiveWorkDto => ({
        id: `tender:${tender.id}`,
        type: 'Tender',
        title: tender.title,
        status: displayEnum(tender.status),
        nextAction: tenderNextAction(tender.status),
        deadline: toIsoOrNull(tender.closingDate),
        route: tender.status === TenderStatus.DRAFT || tender.status === TenderStatus.REVIEW ? '/procurement/create-tender' : '/procurement/marketplace',
        priority: tender.closingDate && tender.closingDate <= addDays(now, 7) ? 'High' : 'Normal'
      })),
      ...activeBidRows.map((bid): DashboardActiveWorkDto => ({
        id: `bid:${bid.id}`,
        type: 'Bid',
        title: `${bid.reference} - ${bid.tender.title}`,
        status: displayEnum(bid.status),
        nextAction: bidNextAction(bid.status),
        deadline: toIsoOrNull(bid.tender.closingDate),
        route: '/bidding',
        priority: bid.status === BidStatus.DRAFT ? 'High' : 'Normal'
      })),
      ...activeContractRows.map((contract): DashboardActiveWorkDto => ({
        id: `contract:${contract.id}`,
        type: 'Contract',
        title: `${contract.reference} - ${contract.title}`,
        status: displayEnum(contract.status),
        nextAction: contractNextAction(contract.status),
        deadline: null,
        route: '/awards-contracts/negotiation',
        priority: contract.status === ContractStatus.SIGNATURE_PENDING ? 'High' : 'Normal'
      }))
    ]).slice(0, query.itemLimit);

    return {
      summary,
      pipeline,
      metrics: [
        { label: 'My tenders', value: String(summary.myTenders), note: 'Tenders created by the selected organization.' },
        { label: 'My bids', value: String(summary.myBids), note: 'Bid drafts and submitted opportunities.' },
        { label: 'Recorded value', value: formatMoney(summary.recordedValue, summary.currency), note: 'Plan, tender, bid, award, and contract value.' },
        { label: 'Unread messages', value: String(summary.unreadMessages), note: 'Unread communication owned by this mailbox.' }
      ],
      actionQueue,
      deadlines,
      activeWork,
      generatedAt: new Date().toISOString()
    };
  }

  private async getRecordedValues(organizationId: string) {
    const [planValue, tenderValue, bidValue, contractValue, awardValue] = await Promise.all([
      this.db.procurementPlanLine.aggregate({
        where: planLineScope(organizationId),
        _sum: { budget: true }
      }),
      this.db.tender.aggregate({
        where: tenderScope(organizationId),
        _sum: { budget: true }
      }),
      this.db.bid.aggregate({
        where: bidScope(organizationId),
        _sum: { totalAmount: true }
      }),
      this.db.contract.aggregate({
        where: contractScope(organizationId),
        _sum: { amount: true }
      }),
      this.db.awardRecommendation.aggregate({
        where: awardScope(organizationId),
        _sum: { amount: true }
      })
    ]);

    return [
      decimalToNumber(planValue._sum.budget),
      decimalToNumber(tenderValue._sum.budget),
      decimalToNumber(bidValue._sum.totalAmount),
      decimalToNumber(contractValue._sum.amount),
      decimalToNumber(awardValue._sum.amount)
    ];
  }
}

function tenderScope(organizationId: string): Prisma.TenderWhereInput {
  return organizationId ? { buyerOrgId: organizationId } : {};
}

function bidScope(organizationId: string): Prisma.BidWhereInput {
  return organizationId ? { OR: [{ buyerOrgId: organizationId }, { supplierOrgId: organizationId }] } : {};
}

function contractScope(organizationId: string): Prisma.ContractWhereInput {
  return organizationId ? { OR: [{ buyerOrgId: organizationId }, { supplierOrgId: organizationId }] } : {};
}

function communicationScope(organizationId: string): Prisma.CommunicationItemWhereInput {
  return organizationId ? { ownerOrgId: organizationId } : {};
}

function complianceScope(organizationId: string): Prisma.ComplianceCaseWhereInput {
  return organizationId ? { ownerOrgId: organizationId } : {};
}

function evaluationScope(organizationId: string): Prisma.EvaluationWorkspaceWhereInput {
  return organizationId ? { buyerOrgId: organizationId } : {};
}

function awardScope(organizationId: string): Prisma.AwardRecommendationWhereInput {
  return organizationId ? { OR: [{ supplierOrgId: organizationId }, { workspace: { buyerOrgId: organizationId } }] } : {};
}

function planLineScope(organizationId: string): Prisma.ProcurementPlanLineWhereInput {
  return organizationId ? { plan: { ownerOrgId: organizationId } } : {};
}

function withTenderScope(organizationId: string, where: Prisma.TenderWhereInput): Prisma.TenderWhereInput {
  return andWhere([tenderScope(organizationId), where]);
}

function withBidScope(organizationId: string, where: Prisma.BidWhereInput): Prisma.BidWhereInput {
  return andWhere([bidScope(organizationId), where]);
}

function withContractScope(organizationId: string, where: Prisma.ContractWhereInput): Prisma.ContractWhereInput {
  return andWhere([contractScope(organizationId), where]);
}

function withCommunicationScope(organizationId: string, where: Prisma.CommunicationItemWhereInput): Prisma.CommunicationItemWhereInput {
  return andWhere([communicationScope(organizationId), where]);
}

function withComplianceScope(organizationId: string, where: Prisma.ComplianceCaseWhereInput): Prisma.ComplianceCaseWhereInput {
  return andWhere([complianceScope(organizationId), where]);
}

function withEvaluationScope(organizationId: string, where: Prisma.EvaluationWorkspaceWhereInput): Prisma.EvaluationWorkspaceWhereInput {
  return andWhere([evaluationScope(organizationId), where]);
}

function withAwardScope(organizationId: string, where: Prisma.AwardRecommendationWhereInput): Prisma.AwardRecommendationWhereInput {
  return andWhere([awardScope(organizationId), where]);
}

function andWhere<T extends object>(filters: T[]): T {
  const active = filters.filter((filter) => Object.keys(filter).length > 0);
  if (active.length === 0) return {} as T;
  if (active.length === 1) return active[0];
  return { AND: active } as T;
}

function planLineDeadlines(line: {
  id: string;
  tenderTitle: string;
  openingDate: Date | null;
  closingDate: Date | null;
  expectedCompletionDate: Date | null;
}): DashboardDeadlineDto[] {
  return [
    line.openingDate
      ? {
          id: `plan-opening:${line.id}`,
          title: line.tenderTitle,
          date: line.openingDate.toISOString(),
          kind: 'Planned opening',
          route: '/tender-planning'
        }
      : null,
    line.closingDate
      ? {
          id: `plan-closing:${line.id}`,
          title: line.tenderTitle,
          date: line.closingDate.toISOString(),
          kind: 'Planned closing',
          route: '/tender-planning'
        }
      : null,
    line.expectedCompletionDate
      ? {
          id: `plan-completion:${line.id}`,
          title: line.tenderTitle,
          date: line.expectedCompletionDate.toISOString(),
          kind: 'Expected completion',
          route: '/tender-planning'
        }
      : null
  ].filter(Boolean) as DashboardDeadlineDto[];
}

function sortDeadlines(deadlines: DashboardDeadlineDto[]) {
  return deadlines.sort((left, right) => left.date.localeCompare(right.date));
}

function sortActions(actions: DashboardActionDto[]) {
  return actions.sort((left, right) => priorityWeight(right.priority) - priorityWeight(left.priority) || right.createdAt.localeCompare(left.createdAt));
}

function sortActiveWork(items: DashboardActiveWorkDto[]) {
  return items.sort((left, right) => priorityWeight(right.priority) - priorityWeight(left.priority) || (left.deadline ?? '').localeCompare(right.deadline ?? ''));
}

function priorityWeight(priority: DashboardPriority) {
  return { Low: 1, Normal: 2, High: 3, Urgent: 4 }[priority];
}

function priorityFromCommunication(priority: CommunicationPriority): DashboardPriority {
  if (priority === CommunicationPriority.URGENT) return 'Urgent';
  if (priority === CommunicationPriority.HIGH) return 'High';
  if (priority === CommunicationPriority.LOW) return 'Low';
  return 'Normal';
}

function tenderNextAction(status: TenderStatus) {
  if (status === TenderStatus.DRAFT) return 'Complete tender draft';
  if (status === TenderStatus.REVIEW) return 'Review before publication';
  if (status === TenderStatus.PUBLISHED || status === TenderStatus.OPEN) return 'Monitor supplier activity';
  if (status === TenderStatus.EVALUATION) return 'Continue evaluation';
  return 'Open tender record';
}

function bidNextAction(status: BidStatus) {
  if (status === BidStatus.DRAFT) return 'Complete and submit bid';
  if (status === BidStatus.SUBMITTED) return 'Track bid receipt';
  if (status === BidStatus.UNDER_EVALUATION || status === BidStatus.OPENED) return 'Await evaluation result';
  return 'Open bid workspace';
}

function contractNextAction(status: ContractStatus) {
  if (status === ContractStatus.DRAFT) return 'Prepare contract';
  if (status === ContractStatus.NEGOTIATION) return 'Continue negotiation';
  if (status === ContractStatus.SIGNATURE_PENDING) return 'Collect signatures';
  if (status === ContractStatus.ACTIVE) return 'Track performance';
  return 'Open contract';
}

function displayEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function decimalToNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatMoney(amount: number, valueCurrency: string) {
  return `${valueCurrency} ${amount.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * 86400000);
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : new Date(0).toISOString();
}

function toIsoOrNull(value: Date | null) {
  return value ? value.toISOString() : null;
}
