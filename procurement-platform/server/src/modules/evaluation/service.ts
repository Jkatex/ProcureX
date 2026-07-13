import { EvaluationStage, type Prisma } from '@prisma/client';
import { ModuleRepository, type EvaluationWorkspaceAuditRecord, type EvaluationWorkspaceTenderRecord } from './repository.js';
import {
  moduleDefinition,
  type EvaluationDashboardDto,
  type EvaluationDecisionStatus,
  type EvaluationDraftsResponseDto,
  type EvaluationRecordsQuery,
  type EvaluationRecordsResponseDto,
  type EvaluationRequestContext,
  type EvaluationWorkspaceDto,
  type ModuleStatus,
  type ReadyEvaluationResponseDto,
  type SaveEvaluationWorkspaceInput
} from './types.js';

export class ModuleService {
  constructor(private readonly repository = new ModuleRepository()) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  async dashboard(context?: EvaluationRequestContext): Promise<EvaluationDashboardDto> {
    try {
      const [publishedTenders, readyToEvaluate, draftedEvaluations, lockedUntilClosing, totalRecords] = await this.repository.getDashboardData(undefined, context);

      return {
        publishedTenders,
        readyToEvaluate,
        draftedEvaluations,
        lockedUntilClosing,
        totalRecords
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyDashboard;
      throw error;
    }
  }

  async records(query: EvaluationRecordsQuery, context?: EvaluationRequestContext): Promise<EvaluationRecordsResponseDto> {
    try {
      const data = await this.repository.listRecords(query, context);

      return {
        totalRecords: data.totalRecords,
        records: data.records.map((record) => ({
          id: record.id,
          tenderId: record.tender.id,
          reference: record.tender.reference,
          title: record.tender.title,
          buyerName: record.tender.buyerOrg.name,
          procurementType: record.tender.type,
          status: record.status,
          currentStage: readString(record.payload, 'activeStageId') ?? record.currentStage,
          progressPercentage: record.progress,
          recommendationStatus: record.recommendations[0]?.status ?? null,
          submittedBidCount: record.tender.bids.length,
          closingDate: record.tender.closingDate?.toISOString() ?? null,
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString()
        }))
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) return { records: [], totalRecords: 0 };
      throw error;
    }
  }

  async drafts(context?: EvaluationRequestContext): Promise<EvaluationDraftsResponseDto> {
    try {
      const drafts = await this.repository.listDrafts(context);

      return {
        drafts: drafts.map((draft) => ({
          id: draft.id,
          tenderId: draft.tender.id,
          reference: draft.tender.reference,
          title: draft.tender.title,
          procurementType: draft.tender.type,
          currentStage: readString(draft.payload, 'activeStageId') ?? draft.currentStage,
          progressPercentage: draft.progress,
          submittedBidCount: draft.tender.bids.length,
          updatedAt: draft.updatedAt.toISOString()
        }))
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) return { drafts: [] };
      throw error;
    }
  }

  async ready(context?: EvaluationRequestContext): Promise<ReadyEvaluationResponseDto> {
    try {
      const tenders = await this.repository.listReadyTenders(context);
      const now = new Date();

      return {
        tenders: tenders.map((tender) => {
          const eligibility = tenderEvaluationEligibility(tender, now);
          const bidOpeningStatus = bidOpeningStatusLabel(tender);
          return {
            tenderId: tender.id,
            reference: tender.reference,
            title: tender.title,
            buyerName: tender.buyerOrg.name,
            procurementType: tender.type,
            closingDate: tender.closingDate?.toISOString() ?? '',
            submittedBidCount: tender.bids.length,
            bidCount: tender.bids.length,
            requirementCount: tender.requirementRows.length || countRequirementItems(tender.requirements),
            criteriaCount: tender.evaluation?.criteria.length ?? countEvaluationCriteria(tender.metadata),
            ready: eligibility.canStartEvaluation || eligibility.canContinueEvaluation,
            status: eligibility.evaluationStatus,
            tenderStatus: tender.status,
            bidOpeningStatus,
            hasClosed: eligibility.hasClosed,
            openingStatus: eligibility.openingStatus,
            evaluationStatus: eligibility.evaluationStatus,
            canStartEvaluation: eligibility.canStartEvaluation,
            canContinueEvaluation: eligibility.canContinueEvaluation,
            lockReason: eligibility.lockReason,
            currentStage: readString(tender.evaluation?.payload, 'activeStageId') ?? tender.evaluation?.currentStage ?? null,
            progressPercentage: tender.evaluation?.progress ?? 0,
            readinessReason: eligibility.lockReason
          };
        })
      };
    } catch (error) {
      if (isDatabaseUnavailable(error)) return { tenders: [] };
      throw error;
    }
  }

  async workspace(tenderId: string, context?: EvaluationRequestContext): Promise<EvaluationWorkspaceDto> {
    try {
      const data = await this.repository.getWorkspaceByTenderId(tenderId, context);
      return toWorkspaceDto(data.tender, data.auditEvents);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyWorkspace;
      throw error;
    }
  }

  async saveWorkspace(tenderId: string, input: SaveEvaluationWorkspaceInput, context?: EvaluationRequestContext): Promise<EvaluationWorkspaceDto> {
    try {
      await this.repository.saveWorkspace(tenderId, input, context);
      const data = await this.repository.getWorkspaceByTenderId(tenderId, context);
      return toWorkspaceDto(data.tender, data.auditEvents);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyWorkspace;
      throw error;
    }
  }
}

const emptyDashboard: EvaluationDashboardDto = {
  publishedTenders: 0,
  readyToEvaluate: 0,
  draftedEvaluations: 0,
  lockedUntilClosing: 0,
  totalRecords: 0
};

const emptyWorkspace: EvaluationWorkspaceDto = {
  tender: null,
  availability: {
    isReady: false,
    reason: 'No submitted bids available for evaluation yet.'
  },
  summary: {
    submittedBidCount: 0,
    evaluatedBidCount: 0,
    pendingEvaluationCount: 0,
    evaluationStatus: 'NOT_STARTED',
    recommendedBidder: null,
    updatedAt: null,
    lastSavedAt: null,
    activeStageId: null,
    selectedBidId: null
  },
  criteria: [],
  bids: [],
  rankings: [],
  audit: {
    evaluatedBy: null,
    lastUpdatedBy: null,
    events: []
  }
};

const decisionStatuses: EvaluationDecisionStatus[] = ['PENDING', 'PASSED', 'FAILED', 'NEEDS_CLARIFICATION', 'RECOMMENDED'];

function toWorkspaceDto(tender: EvaluationWorkspaceTenderRecord | null, auditEvents: EvaluationWorkspaceAuditRecord[]): EvaluationWorkspaceDto {
  if (!tender) {
    return {
      ...emptyWorkspace,
      availability: {
        isReady: false,
        reason: 'Tender was not found.'
      }
    };
  }

  const workspace = tender.evaluation;
  const criteria = workspace?.criteria ?? [];
  const scores = workspace?.scores ?? [];
  const decisions = readDecisions(workspace?.payload);
  const priceScores = financialScores(tender.bids);
  const bids = tender.bids.map((bid) => {
    const bidScores = criteria.map((criterion) => {
      const score = latestScore(scores, bid.id, criterion.id);
      return {
        criterionId: criterion.id,
        score: decimalToNumber(score?.score),
        comment: score?.comment ?? '',
        evaluatorName: userName(score?.evaluatorUser ?? null),
        evaluatedAt: score?.createdAt.toISOString() ?? null
      };
    });
    const technical = technicalScore(bid.id, criteria, scores);
    const decision = decisions[bid.id];
    const comments = bidScores.map((score) => score.comment).filter(Boolean);

    return {
      id: bid.id,
      reference: bid.reference,
      supplierName: bid.supplierOrg.name,
      status: bid.status,
      submittedAt: bid.submittedAt?.toISOString() ?? null,
      documents: bid.documents.filter((item) => financialDocumentsVisible(workspace?.currentStage, item.envelope)).map((item) => ({
        id: item.document.id,
        name: item.document.name,
        documentType: item.document.documentType,
        reviewStatus: item.reviewStatus
      })),
      responses: bid.responses.map((response) => ({
        requirementKey: response.requirementKey,
        response: response.response
      })),
      financialAmount: decimalToNumber(bid.totalAmount),
      currency: bid.currency,
      eligibilityStatus: eligibilityStatus(bid.payload),
      scores: bidScores,
      technicalScore: technical,
      financialScore: priceScores.get(bid.id) ?? null,
      totalScore: technical,
      evaluated: technical !== null,
      decisionStatus: decisionStatus(decision?.status),
      decisionComment: decision?.comment ?? '',
      commentSummary: decision?.comment || comments[0] || ''
    };
  });

  const rankings = bids
    .filter((bid) => bid.totalScore !== null)
    .sort((a, b) => (b.totalScore ?? 0) - (a.totalScore ?? 0))
    .map((bid, index) => ({
      rank: index + 1,
      bidId: bid.id,
      bidderName: bid.supplierName,
      technicalScore: bid.technicalScore,
      financialScore: bid.financialScore,
      totalScore: bid.totalScore ?? 0,
      decisionStatus: bid.decisionStatus,
      commentSummary: bid.commentSummary
    }));
  const recommended = bids.find((bid) => bid.decisionStatus === 'RECOMMENDED')
    ?? workspace?.recommendations.find((recommendation) => recommendation.bid)?.bid
    ?? null;
  const evaluatedBidCount = bids.filter((bid) => bid.evaluated).length;
  const lastScore = scores[0] ?? null;
  const lastAudit = auditEvents[0] ?? null;

  return {
    tender: {
      id: tender.id,
      reference: tender.reference,
      title: tender.title,
      buyerName: tender.buyerOrg.name,
      procurementType: tender.type,
      status: tender.status,
      closingDate: tender.closingDate?.toISOString() ?? null,
      currency: tender.currency
    },
    availability: workspaceAvailability(tender),
    summary: {
      submittedBidCount: bids.length,
      evaluatedBidCount,
      pendingEvaluationCount: Math.max(0, bids.length - evaluatedBidCount),
      evaluationStatus: workspace?.status ?? 'NOT_STARTED',
      recommendedBidder: recommended
        ? {
            bidId: 'supplierName' in recommended ? recommended.id : recommended.id,
            supplierName: 'supplierName' in recommended ? recommended.supplierName : recommended.supplierOrg.name
          }
        : null,
      updatedAt: workspace?.updatedAt.toISOString() ?? null,
      lastSavedAt: readString(workspace?.payload, 'lastSavedAt') ?? lastAudit?.createdAt.toISOString() ?? null,
      activeStageId: readString(workspace?.payload, 'activeStageId'),
      selectedBidId: readString(workspace?.payload, 'selectedBidId')
    },
    criteria: criteria.map((criterion) => ({
      id: criterion.id,
      name: criterion.name,
      category: readCriterionCategory(criterion.payload) ?? humanizeEnum(criterion.stage),
      stage: criterion.stage,
      weight: decimalToNumber(criterion.weight),
      maxScore: decimalToNumber(criterion.maxScore) ?? 100
    })),
    bids,
    rankings,
    audit: {
      evaluatedBy: userName(lastScore?.evaluatorUser ?? null),
      lastUpdatedBy: userName(lastAudit?.actorUser ?? null),
      events: auditEvents.map((event) => ({
        event: event.event,
        actorName: userName(event.actorUser ?? null),
        createdAt: event.createdAt.toISOString()
      }))
    }
  };
}

function workspaceAvailability(tender: EvaluationWorkspaceTenderRecord, now = new Date()) {
  if (!['PUBLISHED', 'OPEN', 'CLOSED', 'EVALUATION'].includes(tender.status)) {
    return { isReady: false, reason: 'Tender is not published yet.' };
  }
  if (!tenderHasClosed(tender, now)) {
    return { isReady: false, reason: 'Tender is locked until the closing date passes.' };
  }
  if (tender.bids.length === 0) {
    return { isReady: false, reason: 'No submitted bids available for evaluation yet.' };
  }
  if (tender.evaluation?.status === 'COMPLETED') {
    return { isReady: false, reason: 'Evaluation is already completed.' };
  }
  return { isReady: true, reason: null };
}

function tenderEvaluationEligibility(tender: {
  status: string;
  closingDate: Date | null;
  bids: Array<unknown>;
  metadata?: Prisma.JsonValue;
  evaluation: {
    status: string;
  } | null;
}, now = new Date()) {
  const openingStatus = bidOpeningStatusValue(tender);
  const hasClosed = tenderHasClosed(tender, now);
  const evaluationStatus = tender.evaluation?.status ?? 'NOT_STARTED';
  const bidCount = tender.bids.length;

  if (tender.evaluation?.status === 'COMPLETED') {
    return {
      hasClosed,
      bidCount,
      openingStatus,
      evaluationStatus: 'COMPLETED',
      canStartEvaluation: false,
      canContinueEvaluation: false,
      lockReason: null
    };
  }
  if (tender.evaluation?.status === 'IN_PROGRESS' || tender.evaluation?.status === 'RETURNED') {
    return {
      hasClosed,
      bidCount,
      openingStatus,
      evaluationStatus: tender.evaluation.status,
      canStartEvaluation: false,
      canContinueEvaluation: true,
      lockReason: null
    };
  }
  if (!hasClosed) {
    return {
      hasClosed,
      bidCount,
      openingStatus,
      evaluationStatus: 'LOCKED',
      canStartEvaluation: false,
      canContinueEvaluation: false,
      lockReason: 'Tender has not closed yet'
    };
  }
  if (bidCount === 0) {
    return {
      hasClosed,
      bidCount,
      openingStatus,
      evaluationStatus: 'LOCKED',
      canStartEvaluation: false,
      canContinueEvaluation: false,
      lockReason: 'No bids available for evaluation'
    };
  }
  if (!openingComplete(openingStatus)) {
    return {
      hasClosed,
      bidCount,
      openingStatus,
      evaluationStatus: 'LOCKED',
      canStartEvaluation: false,
      canContinueEvaluation: false,
      lockReason: 'Complete bid opening first'
    };
  }
  return {
    hasClosed,
    bidCount,
    openingStatus,
    evaluationStatus,
    canStartEvaluation: true,
    canContinueEvaluation: false,
    lockReason: null
  };
}

function tenderHasClosed(tender: { status: string; closingDate: Date | null }, now = new Date()) {
  return tender.status === 'CLOSED' || tender.status === 'EVALUATION' || Boolean(tender.closingDate && tender.closingDate <= now);
}

function bidOpeningStatusValue(tender: { status: string; bids: Array<unknown>; metadata?: Prisma.JsonValue; evaluation?: { status: string } | null }) {
  const metadata = jsonObject(tender.metadata);
  const direct = metadata.bidOpeningStatus ?? metadata.openingStatus;
  if (typeof direct === 'string' && direct.trim()) return direct.trim().toUpperCase();
  if (tender.evaluation && ['IN_PROGRESS', 'RETURNED', 'COMPLETED'].includes(tender.evaluation.status)) return 'COMPLETED';
  if (['CLOSED', 'EVALUATION'].includes(tender.status) && tender.bids.length > 0) return 'COMPLETED';
  return 'PENDING';
}

function bidOpeningStatusLabel(tender: { status: string; bids: Array<unknown>; metadata?: Prisma.JsonValue; evaluation?: { status: string } | null }) {
  const value = bidOpeningStatusValue(tender);
  if (openingComplete(value)) return 'Opening Completed';
  if (value === 'OPENED') return 'Opened';
  return humanizeEnum(value);
}

function openingComplete(value: string) {
  return ['COMPLETED', 'COMPLETE', 'OPENED'].includes(value);
}

function countRequirementItems(value: Prisma.JsonValue | null | undefined): number {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== 'object') return 0;
  return Object.values(value as Record<string, unknown>).reduce<number>((sum, item) => {
    if (Array.isArray(item)) return sum + item.length;
    if (item && typeof item === 'object') {
      const rows = (item as Record<string, unknown>).rows;
      if (Array.isArray(rows)) return sum + rows.length;
      return sum + Object.keys(item).length;
    }
    return item === null || item === undefined || item === '' ? sum : sum + 1;
  }, 0);
}

function countEvaluationCriteria(metadata: Prisma.JsonValue | null | undefined): number {
  const criteria = jsonObject(metadata).evaluationCriteria;
  if (Array.isArray(criteria)) return criteria.length;
  if (criteria && typeof criteria === 'object') return Object.keys(criteria).length;
  return 0;
}

function financialDocumentsVisible(currentStage: EvaluationStage | null | undefined, envelope: string) {
  if (envelope !== 'FINANCIAL') return true;
  if (!currentStage) return false;
  const order = [
    EvaluationStage.OPENING,
    EvaluationStage.CONFLICT,
    EvaluationStage.PRELIMINARY,
    EvaluationStage.ELIGIBILITY,
    EvaluationStage.TECHNICAL,
    EvaluationStage.FINANCIAL,
    EvaluationStage.CLARIFICATIONS,
    EvaluationStage.COMPARISON,
    EvaluationStage.REPORT,
    EvaluationStage.RECOMMENDATION
  ];
  return order.indexOf(currentStage) >= order.indexOf(EvaluationStage.FINANCIAL);
}

function readDecisions(payload: Prisma.JsonValue | null | undefined) {
  const object = jsonObject(payload);
  const decisions = object.decisions;
  if (typeof decisions !== 'object' || decisions === null || Array.isArray(decisions)) return {};
  return decisions as Record<string, { status?: string; comment?: string }>;
}

function readString(payload: Prisma.JsonValue | null | undefined, key: string) {
  const value = jsonObject(payload)[key];
  return typeof value === 'string' ? value : null;
}

function jsonObject(value: Prisma.JsonValue | null | undefined): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readCriterionCategory(payload: Prisma.JsonValue | null | undefined) {
  const value = jsonObject(payload).category;
  return typeof value === 'string' && value.trim() ? value : null;
}

function eligibilityStatus(payload: Prisma.JsonValue | null | undefined) {
  const object = jsonObject(payload);
  const direct = object.eligibilityStatus;
  if (typeof direct === 'string' && direct.trim()) return direct;
  const eligibility = object.eligibility;
  if (typeof eligibility === 'object' && eligibility !== null && !Array.isArray(eligibility)) {
    const status = (eligibility as Record<string, unknown>).status;
    if (typeof status === 'string' && status.trim()) return status;
  }
  return 'Pending';
}

function latestScore(
  scores: NonNullable<EvaluationWorkspaceTenderRecord['evaluation']>['scores'],
  bidId: string,
  criterionId: string
) {
  return scores.find((score) => score.bidId === bidId && score.criterionId === criterionId) ?? null;
}

function technicalScore(
  bidId: string,
  criteria: NonNullable<EvaluationWorkspaceTenderRecord['evaluation']>['criteria'],
  scores: NonNullable<EvaluationWorkspaceTenderRecord['evaluation']>['scores']
) {
  if (criteria.length === 0) return null;
  const rows = criteria.map((criterion) => ({ criterion, score: latestScore(scores, bidId, criterion.id) }));
  if (rows.some((row) => row.score?.score === null || row.score?.score === undefined)) return null;
  const totalWeight = criteria.reduce((sum, criterion) => sum + (decimalToNumber(criterion.weight) ?? 0), 0);
  if (totalWeight > 0) {
    return roundScore(
      rows.reduce((sum, row) => {
        const score = decimalToNumber(row.score?.score) ?? 0;
        const maxScore = decimalToNumber(row.criterion.maxScore) ?? 100;
        return sum + (score / maxScore) * (decimalToNumber(row.criterion.weight) ?? 0);
      }, 0)
    );
  }
  return roundScore(
    rows.reduce((sum, row) => {
      const score = decimalToNumber(row.score?.score) ?? 0;
      const maxScore = decimalToNumber(row.criterion.maxScore) ?? 100;
      return sum + (score / maxScore) * 100;
    }, 0) / Math.max(1, rows.length)
  );
}

function financialScores(bids: EvaluationWorkspaceTenderRecord['bids']) {
  const amounts = bids
    .map((bid) => ({ bidId: bid.id, amount: decimalToNumber(bid.totalAmount) }))
    .filter((row): row is { bidId: string; amount: number } => typeof row.amount === 'number' && row.amount > 0);
  const lowest = Math.min(...amounts.map((row) => row.amount));
  const scores = new Map<string, number>();
  if (!Number.isFinite(lowest)) return scores;
  for (const row of amounts) scores.set(row.bidId, roundScore((lowest / row.amount) * 100));
  return scores;
}

function decisionStatus(value: string | undefined): EvaluationDecisionStatus {
  return decisionStatuses.includes(value as EvaluationDecisionStatus) ? value as EvaluationDecisionStatus : 'PENDING';
}

function decimalToNumber(value: Prisma.Decimal | null | undefined) {
  return value === null || value === undefined ? null : Number(value.toString());
}

function roundScore(value: number) {
  return Math.round(value * 100) / 100;
}

function userName(user: { displayName: string | null; email: string } | null) {
  return user?.displayName || user?.email || null;
}

function humanizeEnum(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function isDatabaseUnavailable(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return code === 'P1001' || code === 'P2024' || message.includes("can't reach database") || message.includes('database_url');
}
