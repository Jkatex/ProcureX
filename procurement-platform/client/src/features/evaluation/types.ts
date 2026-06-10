export type EvaluationStatusFilter = 'all' | 'NOT_STARTED' | 'IN_PROGRESS' | 'LOCKED' | 'COMPLETED' | 'RETURNED';

export type ProcurementTypeFilter = 'all' | 'GOODS' | 'WORKS' | 'SERVICE' | 'CONSULTANCY';

export type EvaluationDashboard = {
  publishedTenders: number;
  readyToEvaluate: number;
  draftedEvaluations: number;
  lockedUntilClosing: number;
  totalRecords: number;
};

export type EvaluationRecord = {
  id: string;
  tenderId: string;
  reference: string;
  title: string;
  buyerName: string;
  procurementType: Exclude<ProcurementTypeFilter, 'all'>;
  status: Exclude<EvaluationStatusFilter, 'all'>;
  currentStage: string | null;
  progressPercentage: number;
  recommendationStatus: string | null;
  submittedBidCount: number;
  closingDate: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EvaluationRecordsResponse = {
  records: EvaluationRecord[];
  totalRecords: number;
};

export type EvaluationDraft = {
  id: string;
  tenderId: string;
  reference: string;
  title: string;
  procurementType: Exclude<ProcurementTypeFilter, 'all'>;
  currentStage: string | null;
  progressPercentage: number;
  submittedBidCount: number;
  updatedAt: string;
};

export type EvaluationDraftsResponse = {
  drafts: EvaluationDraft[];
};

export type ReadyEvaluationTender = {
  tenderId: string;
  reference: string;
  title: string;
  buyerName: string;
  procurementType: Exclude<ProcurementTypeFilter, 'all'>;
  closingDate: string;
  submittedBidCount: number;
};

export type ReadyEvaluationResponse = {
  tenders: ReadyEvaluationTender[];
};

export type EvaluationRecordsQuery = {
  search: string;
  status: EvaluationStatusFilter;
  type: ProcurementTypeFilter;
};

export type EvaluationDecisionStatus = 'PENDING' | 'PASSED' | 'FAILED' | 'NEEDS_CLARIFICATION' | 'RECOMMENDED';

export type EvaluationWorkspace = {
  tender: {
    id: string;
    reference: string;
    title: string;
    buyerName: string;
    procurementType: Exclude<ProcurementTypeFilter, 'all'>;
    status: string;
    closingDate: string | null;
    currency: string;
  } | null;
  availability: {
    isReady: boolean;
    reason: string | null;
  };
  summary: {
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
  };
  criteria: EvaluationWorkspaceCriterion[];
  bids: EvaluationWorkspaceBid[];
  rankings: EvaluationRankingRow[];
  audit: {
    evaluatedBy: string | null;
    lastUpdatedBy: string | null;
    events: EvaluationAuditEvent[];
  };
};

export type EvaluationWorkspaceCriterion = {
  id: string;
  name: string;
  category: string;
  stage: string;
  weight: number | null;
  maxScore: number;
};

export type EvaluationWorkspaceScore = {
  criterionId: string;
  score: number | null;
  comment: string;
  evaluatorName: string | null;
  evaluatedAt: string | null;
};

export type EvaluationWorkspaceBid = {
  id: string;
  reference: string;
  supplierName: string;
  status: string;
  submittedAt: string | null;
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
  scores: EvaluationWorkspaceScore[];
  technicalScore: number | null;
  financialScore: number | null;
  totalScore: number | null;
  evaluated: boolean;
  decisionStatus: EvaluationDecisionStatus;
  decisionComment: string;
  commentSummary: string;
};

export type EvaluationRankingRow = {
  rank: number;
  bidId: string;
  bidderName: string;
  technicalScore: number | null;
  financialScore: number | null;
  totalScore: number;
  decisionStatus: EvaluationDecisionStatus;
  commentSummary: string;
};

export type EvaluationAuditEvent = {
  event: string;
  actorName: string | null;
  createdAt: string;
};

export type SaveEvaluationWorkspaceInput = {
  scores: Array<{
    bidId: string;
    criterionId: string;
    score: number;
    comment: string;
  }>;
  decisions: Array<{
    bidId: string;
    status: EvaluationDecisionStatus;
    comment: string;
  }>;
  complete?: boolean;
};
