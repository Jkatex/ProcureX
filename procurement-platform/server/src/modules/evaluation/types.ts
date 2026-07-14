import type { EvaluationStatus, TenderType } from '@prisma/client';

export const moduleDefinition = {
  key: 'evaluation',
  name: 'Evaluation',
  description: 'Evaluation workspaces, criteria, workflow assignments, scores, recommendations, and approvals.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type EvaluationDashboardDto = {
  publishedTenders: number;
  readyToEvaluate: number;
  draftedEvaluations: number;
  lockedUntilClosing: number;
  totalRecords: number;
};

export type EvaluationRecordDto = {
  id: string;
  tenderId: string;
  reference: string;
  title: string;
  buyerName: string;
  procurementType: string;
  status: string;
  currentStage: string | null;
  progressPercentage: number;
  recommendationStatus: string | null;
  submittedBidCount: number;
  closingDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EvaluationRecordsResponseDto = {
  records: EvaluationRecordDto[];
  totalRecords: number;
};

export type EvaluationDraftDto = {
  id: string;
  tenderId: string;
  reference: string;
  title: string;
  procurementType: string;
  currentStage: string | null;
  progressPercentage: number;
  submittedBidCount: number;
  updatedAt: string;
};

export type EvaluationDraftsResponseDto = {
  drafts: EvaluationDraftDto[];
};

export type ReadyEvaluationTenderDto = {
  tenderId: string;
  reference: string;
  title: string;
  buyerName: string;
  procurementType: string;
  closingDate: string;
  submittedBidCount: number;
  bidCount: number;
  requirementCount: number;
  criteriaCount: number;
  ready: boolean;
  status: string;
  tenderStatus: string;
  bidOpeningStatus: string;
  hasClosed: boolean;
  openingStatus: string;
  evaluationStatus: string;
  canStartEvaluation: boolean;
  canContinueEvaluation: boolean;
  lockReason: string | null;
  currentStage: string | null;
  progressPercentage: number;
  readinessReason: string | null;
};

export type ReadyEvaluationResponseDto = {
  tenders: ReadyEvaluationTenderDto[];
};

export type EvaluationRecordsQuery = {
  search: string;
  status: EvaluationStatus | 'all';
  type: TenderType | 'all';
};

export type EvaluationDecisionStatus =
  | 'PENDING'
  | 'PASSED'
  | 'FAILED'
  | 'NEEDS_CLARIFICATION'
  | 'RECOMMENDED';

export type EvaluationRequestContext = {
  userId?: string;
  organizationId?: string;
  isAdmin?: boolean;
};

export type EvaluationWorkspaceTenderDto = {
  id: string;
  reference: string;
  referenceNumber: string;
  title: string;
  buyerName: string;
  procurementType: string;
  procurementCategory: string;
  procurementMethod: string;
  evaluationMethod: string;
  status: string;
  closingDate: string | null;
  currency: string;
  requirements: unknown;
  metadata: unknown;
  requirementRows: Array<{
    id: string;
    section: string;
    payload: unknown;
  }>;
  commercialItems: Array<{
    id: string;
    itemNo: string | null;
    description: string;
    quantity: number | null;
    unit: string | null;
    rate: number | null;
    total: number | null;
    payload: unknown;
  }>;
};

export type EvaluationConfigurationItemDto = {
  id: string;
  stageId: string;
  title: string;
  description: string;
  source: string;
  category: string;
  mandatory: boolean;
  weight: number | null;
  maxScore: number | null;
  evidenceRequired: string[];
  payload: unknown;
};

export type EvaluationConfigurationSectionDto = {
  id: string;
  label: string;
  emptyMessage: string;
  items: EvaluationConfigurationItemDto[];
};

export type EvaluationConfigurationDto = {
  procurementCategory: string;
  procurementMethod: string;
  evaluationMethod: string;
  minimumPassMark: number | null;
  technicalWeight: number | null;
  financialWeight: number | null;
  requirements: unknown;
  requiredDocuments: EvaluationConfigurationItemDto[];
  technicalSpecifications: EvaluationConfigurationItemDto[];
  evaluationCriteria: EvaluationConfigurationItemDto[];
  qualificationRequirements: EvaluationConfigurationItemDto[];
  stages: Array<{ id: string; label: string }>;
  sections: EvaluationConfigurationSectionDto[];
};

export type EvaluationWorkspaceSummaryDto = {
  submittedBidCount: number;
  evaluatedBidCount: number;
  pendingEvaluationCount: number;
  evaluationStatus: string;
  recommendedBidder: {
    bidId: string;
    supplierName: string;
  } | null;
  updatedAt: string | null;
  lastSavedAt: string | null;
  activeStageId: string | null;
  selectedBidId: string | null;
};

export type EvaluationWorkspaceCriterionDto = {
  id: string;
  name: string;
  category: string;
  stage: string;
  weight: number | null;
  maxScore: number;
};

export type EvaluationWorkspaceScoreDto = {
  criterionId: string;
  score: number | null;
  comment: string;
  evaluatorName: string | null;
  evaluatedAt: string | null;
};

export type EvaluationWorkspaceBidDto = {
  id: string;
  reference: string;
  supplierName: string;
  status: string;
  submittedAt: string | null;
  receiptRef: string | null;
  receiptHash: string | null;
  documents: Array<{
    id: string;
    name: string;
    documentType: string;
    reviewStatus: string;
  }>;
  responses: Array<{
    requirementKey: string;
    response: unknown;
  }>;
  financialAmount: number | null;
  currency: string;
  eligibilityStatus: string;
  scores: EvaluationWorkspaceScoreDto[];
  technicalScore: number | null;
  financialScore: number | null;
  totalScore: number | null;
  evaluated: boolean;
  decisionStatus: EvaluationDecisionStatus;
  decisionComment: string;
  commentSummary: string;
};

export type EvaluationRankingRowDto = {
  rank: number;
  bidId: string;
  bidderName: string;
  technicalScore: number | null;
  financialScore: number | null;
  totalScore: number;
  decisionStatus: EvaluationDecisionStatus;
  commentSummary: string;
};

export type EvaluationAuditEventDto = {
  event: string;
  actorName: string | null;
  createdAt: string;
};

export type EvaluationWorkspaceDto = {
  tender: EvaluationWorkspaceTenderDto | null;
  availability: {
    isReady: boolean;
    reason: string | null;
  };
  summary: EvaluationWorkspaceSummaryDto;
  evaluationConfiguration: EvaluationConfigurationDto | null;
  criteria: EvaluationWorkspaceCriterionDto[];
  bids: EvaluationWorkspaceBidDto[];
  rankings: EvaluationRankingRowDto[];
  sectionDraft: Record<string, unknown>;
  audit: {
    evaluatedBy: string | null;
    lastUpdatedBy: string | null;
    events: EvaluationAuditEventDto[];
  };
};

export type EvaluationScoreInput = {
  bidId: string;
  criterionId: string;
  score: number;
  comment: string;
};

export type EvaluationDecisionInput = {
  bidId: string;
  status: EvaluationDecisionStatus;
  comment: string;
};

export type SaveEvaluationWorkspaceInput = {
  scores: EvaluationScoreInput[];
  decisions: EvaluationDecisionInput[];
  sectionDraft: Record<string, unknown>;
  complete: boolean;
  activeStageId?: string;
  selectedBidId?: string;
  signatureKeyphrase?: string;
};
