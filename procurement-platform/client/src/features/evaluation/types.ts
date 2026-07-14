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
  bidCount: number;
  requirementCount: number;
  criteriaCount: number;
  ready: boolean;
  status: Exclude<EvaluationStatusFilter, 'all'>;
  tenderStatus: string;
  bidOpeningStatus: string;
  hasClosed: boolean;
  openingStatus: string;
  evaluationStatus: Exclude<EvaluationStatusFilter, 'all'>;
  canStartEvaluation: boolean;
  canContinueEvaluation: boolean;
  lockReason: string | null;
  currentStage: string | null;
  progressPercentage: number;
  readinessReason: string | null;
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
    referenceNumber: string;
    title: string;
    buyerName: string;
    procurementType: Exclude<ProcurementTypeFilter, 'all'>;
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
    activeStageId: string | null;
    selectedBidId: string | null;
  };
  evaluationConfiguration: EvaluationConfiguration | null;
  criteria: EvaluationWorkspaceCriterion[];
  bids: EvaluationWorkspaceBid[];
  rankings: EvaluationRankingRow[];
  sectionDraft: Record<string, unknown>;
  audit: {
    evaluatedBy: string | null;
    lastUpdatedBy: string | null;
    events: EvaluationAuditEvent[];
  };
};

export type EvaluationConfigurationItem = {
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

export type EvaluationConfigurationSection = {
  id: string;
  label: string;
  emptyMessage: string;
  items: EvaluationConfigurationItem[];
};

export type EvaluationConfiguration = {
  procurementCategory: string;
  procurementMethod: string;
  evaluationMethod: string;
  minimumPassMark: number | null;
  technicalWeight: number | null;
  financialWeight: number | null;
  requirements: unknown;
  requiredDocuments: EvaluationConfigurationItem[];
  technicalSpecifications: EvaluationConfigurationItem[];
  evaluationCriteria: EvaluationConfigurationItem[];
  qualificationRequirements: EvaluationConfigurationItem[];
  stages: Array<{ id: string; label: string }>;
  sections: EvaluationConfigurationSection[];
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
  activeStageId?: string;
  selectedBidId?: string;
  sectionDraft?: Record<string, unknown>;
  signatureKeyphrase?: string;
};
