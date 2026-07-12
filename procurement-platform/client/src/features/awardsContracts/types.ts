export type AwardQueueId =
  | 'my-urgent-actions'
  | 'awarding-in-progress'
  | 'awards-received'
  | 'contracts-in-progress'
  | 'active-contracts'
  | 'closed-contracts';

export type AwardContractRole = 'Buyer' | 'Supplier';

export type AwardContractStep =
  | 'evaluation-result'
  | 'award-decision'
  | 'approval'
  | 'award-notification'
  | 'standstill-period'
  | 'supplier-acceptance'
  | 'pre-contract-documents'
  | 'draft-contract'
  | 'overview'
  | 'buyer-review'
  | 'supplier-review'
  | 'negotiation'
  | 'contract-owner-approval'
  | 'signatures'
  | 'execution';

export type AwardResponseAction = 'accept' | 'clarify' | 'decline';
export type ContractTabId = 'overview' | 'buyer-review' | 'supplier-review' | 'negotiation' | 'contract-owner-approval' | 'signatures' | 'activity';
export type PostAwardMode = 'active' | 'closed';
export type PostAwardTabId = 'milestones' | 'payments' | 'issues' | 'variations' | 'closure' | 'performance';

export type BadgeTone = 'success' | 'warning' | 'error' | 'info';

export type FlowStepStatus = 'complete' | 'current' | 'available' | 'locked';

export type FlowLockReason = {
  message: string;
  actionLabel?: string;
  navigatePage?: string;
  routeSearch?: string;
};

export type FlowStep<TId extends string = string> = {
  id: TId;
  label: string;
  description: string;
  status: FlowStepStatus;
  count?: number;
  countLabel?: string;
  statusLabel?: string;
  summary?: string;
  lockReason?: FlowLockReason;
};

export type FlowState<TId extends string = string> = {
  activeStep: TId;
  steps: Array<FlowStep<TId>>;
};

export type LifecycleRoleContext = 'BUYER' | 'SUPPLIER';
export type ViewerRole = LifecycleRoleContext | 'ADMIN' | 'NONE';
export type WorkflowActionOwner = LifecycleRoleContext | 'ADMIN' | 'ANY';

export type WorkflowAccess = {
  viewerRole: ViewerRole;
  canManageBuyerActions: boolean;
  canSubmitSupplierActions: boolean;
  canSignBuyer: boolean;
  canSignSupplier: boolean;
  readOnlyReason: string | null;
};

export type PickerOption = {
  value: string;
  label: string;
  description?: string;
  status?: string;
};

export type LinkedRecordPickerConfig = {
  emptyLabel?: string;
  options: PickerOption[];
};

export type AwardContractActionDefinition = {
  key: string;
  label: string;
  owner: WorkflowActionOwner;
  group: string;
  targetRecordType?: string;
};

export type ActionDrawerState = {
  open: boolean;
  actionKey: string | null;
  title: string;
};

export type LifecycleAction = {
  id: string;
  roleContext: LifecycleRoleContext;
  sourceType: 'TENDER_CREATED' | 'AWARD_RECEIVED' | 'CONTRACT_ACTIVE';
  tenderId: string | null;
  awardId: string | null;
  noticeId: string | null;
  contractId: string | null;
  reference?: string | null;
  noticeReference?: string | null;
  title: string;
  otherParty: string;
  currentStage: string;
  requiredAction: string;
  dueDate: string | null;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  status: string;
  amount: number | null;
  currency: string;
  nextRoute: string;
  nextAction?: {
    key: string;
    label: string;
    url: string;
    method: 'GET' | 'POST' | 'PATCH' | 'PUT';
    canAct: boolean;
    disabledReason: string | null;
    requiredRole: LifecycleRoleContext | 'ANY';
    requiredEvidence: string[];
  };
};

export type AwardContractDashboard = {
  summary: {
    urgentActions: number;
    awardQueues: number;
    contractActions: number;
  };
  queues: Record<AwardQueueId, LifecycleAction[]>;
};

export type ContractLifecycleItemDto = {
  id: string;
  type: string;
  title: string;
  status: string;
  dueDate: string | null;
  note: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
};

export type AwardBidDocumentDto = {
  id: string;
  bidId: string;
  documentId: string;
  name: string;
  documentType: string;
  envelope: string;
  reviewStatus: string;
  checksum: string | null;
  createdAt: string;
};

export type AwardWinnerDto = {
  id: string;
  recommendationId: string | null;
  bidId: string | null;
  supplierOrgId: string | null;
  supplierName: string | null;
  noticeId: string | null;
  contractId: string | null;
  amount: number | null;
  currency: string;
  status: string;
  bidDocuments: AwardBidDocumentDto[];
  payload: Record<string, unknown>;
};

export type AwardBidPackDto = {
  id: string;
  documentId: string | null;
  status: string;
  checksum: string | null;
  generatedAt: string;
  payload: Record<string, unknown>;
};

export type AwardSourceDocumentDto = {
  id: string;
  sourceType: 'tender' | 'bid' | 'evaluation-report';
  documentId: string | null;
  label: string;
  name: string;
  status: string;
  supplierName?: string | null;
  bidId?: string | null;
  openUrl: string;
  downloadUrl: string;
};

export type AwardGroupDto = {
  id: string;
  reference: string;
  title: string;
  status: string;
  tenderId: string;
  buyerOrgId: string;
  settledAt: string | null;
  winners: AwardWinnerDto[];
  clauses: ContractLifecycleItemDto[];
  negotiations: ContractLifecycleItemDto[];
  bidPacks: AwardBidPackDto[];
  payload: Record<string, unknown>;
};

export type AwardRecommendationDetailDto = LifecycleAction & {
  awardGroupId?: string | null;
  reference?: string | null;
  tenderReference?: string | null;
  tenderTitle?: string | null;
  buyerOrgId?: string | null;
  buyerName?: string | null;
  supplierOrgId?: string | null;
  supplierName?: string | null;
  bidId?: string | null;
  reason?: string;
  payload?: Record<string, unknown>;
  notice?: {
    id: string;
    reference?: string | null;
    status: string;
    contractId: string | null;
    buyerNote?: string;
    supplierNote?: string;
    issuedAt?: string;
    respondedAt?: string | null;
    responses?: Array<{ id: string; action: string; note: string; actorOrgId?: string | null; actorUserId?: string | null; createdAt: string }>;
  } | null;
  contract?: ContractDetailDto | null;
  awardGroup?: AwardGroupDto;
  sourceDocuments?: AwardSourceDocumentDto[];
  access?: WorkflowAccess;
  approvalRoutes?: Array<Record<string, unknown>>;
  tieBreakers?: Array<Record<string, unknown>>;
  feasibilityChecks?: Array<Record<string, unknown>>;
  standstillPeriods?: Array<Record<string, unknown>>;
  awardNotifications?: Array<Record<string, unknown>>;
  budgetCommitments?: Array<Record<string, unknown>>;
  audit?: Array<{ event: string; actorUserId: string | null; createdAt: string }>;
};

export type AwardDecisionDraftInput = {
  selectedSupplier?: string;
  awardAmount?: number;
  currency?: string;
  awardDate?: string;
  reason?: string;
  conditions?: string;
  confirmationBy?: string;
  confirmations?: {
    evaluationReviewed?: boolean;
    documentsReviewed?: boolean;
    authorityConfirmed?: boolean;
  };
  note: string;
};

export type ContractDetailDto = {
  access?: WorkflowAccess;
  id: string;
  reference: string;
  tenderId?: string | null;
  tenderReference?: string | null;
  buyerOrgId?: string | null;
  supplierOrgId?: string | null;
  awardId?: string | null;
  noticeId?: string | null;
  title: string;
  status: string;
  buyerName: string;
  supplierName: string | null;
  amount: number | null;
  currency: string;
  payload: Record<string, unknown>;
  parties?: Array<Record<string, unknown>>;
  versions?: Array<Record<string, unknown>>;
  clauses?: ContractLifecycleItemDto[];
  negotiations?: ContractLifecycleItemDto[];
  signatures: Array<{ id: string; role: string; status: string; signerName: string; signedAt: string | null }>;
  milestones: Array<ContractLifecycleItemDto & { amount?: number | null; evidence?: ContractLifecycleItemDto[] }>;
  managementPlan: null | {
    id: string;
    contractManagerId?: string | null;
    objectives: string;
    monitoringPlan: string;
    reportingPlan: string;
    communicationPlan: string;
    payload: Record<string, unknown>;
  };
  mobilizationItems: ContractLifecycleItemDto[];
  kpis: ContractLifecycleItemDto[];
  deliverables?: ContractLifecycleItemDto[];
  acceptances?: ContractLifecycleItemDto[];
  inspections: ContractLifecycleItemDto[];
  goodsInspections?: Array<Record<string, unknown>>;
  paymentSchedules?: ContractLifecycleItemDto[];
  purchaseOrders?: Array<Record<string, unknown>>;
  invoices?: Array<Record<string, unknown>>;
  payments?: Array<Record<string, unknown>>;
  threeWayMatches?: Array<Record<string, unknown>>;
  paymentApprovals?: Array<Record<string, unknown>>;
  paymentConfirmations?: Array<Record<string, unknown>>;
  risks: Array<ContractLifecycleItemDto & { level?: string; score?: number; mitigationAction?: string }>;
  riskForecasts?: Array<Record<string, unknown>>;
  variations: Array<ContractLifecycleItemDto & { changeType?: string; costImpact?: number | null; timeImpactDays?: number | null }>;
  issues: ContractLifecycleItemDto[];
  disputes: ContractLifecycleItemDto[];
  terminations: Array<ContractLifecycleItemDto & { reason?: string; contractClause?: string; notices?: ContractLifecycleItemDto[]; evidence?: ContractLifecycleItemDto[] }>;
  warranties?: ContractLifecycleItemDto[];
  requiredDocuments?: ContractLifecycleItemDto[];
  workflowApprovals?: ContractLifecycleItemDto[];
  urgentActions?: ContractLifecycleItemDto[];
  notifications?: ContractLifecycleItemDto[];
  closeout: Record<string, unknown> | null;
  supplierPerformanceRecords: Array<Record<string, unknown>>;
  performanceScores?: Array<Record<string, unknown>>;
  supplierRiskProfile?: Record<string, unknown> | null;
  audit: Array<{ event: string; actorUserId: string | null; createdAt: string }>;
};

export type AwardContractActionPayload = Record<string, unknown>;
export type AwardContractFormSubmitter = (payload: AwardContractActionPayload) => Promise<unknown>;

export type SummaryCard = {
  queue: AwardQueueId;
  label: string;
  value: number;
  detail: string;
  trend: string;
};

export type UrgentAction = {
  id: string;
  priority: string;
  action: string;
  item: string;
  party: string;
  dueDate: string;
  role: AwardContractRole;
  status: string;
  buttonLabel: string;
  nav: string;
  routeSearch?: string;
  tenderId?: string;
};

export type PendingAward = {
  id: string;
  title: string;
  reference: string;
  role: AwardContractRole;
  procurementType: string;
  evaluationStatus: string;
  recommendedSupplier: string;
  awardStatus: string;
  contractStatus: string;
  progressStatus: string;
  progressStep: string;
  progressDate: string;
  action: string;
};

export type SupplierAward = {
  id: string;
  title: string;
  buyer: string;
  procurementType: string;
  awardValue: number;
  currency: string;
  awardStatus: string;
  contractStatus: string;
  requiredAction: string;
  responseStatus: string;
  documents: Array<{ name: string; owner: string; status: string; action: string }>;
  activity: Array<{ time: string; actor: string; event: string; status: string }>;
};

export type ContractAction = {
  id: string;
  contract: string;
  role: AwardContractRole;
  otherParty: string;
  status: string;
  requiredAction: string;
  dueDate: string;
  routeSearch: string;
};

export type ActiveContract = {
  id: string;
  title: string;
  role: AwardContractRole;
  otherParty: string;
  progress: number;
  progressLabel: string;
  nextMilestone: string;
  paymentStatus: string;
};

export type ClosedContract = {
  id: string;
  title: string;
  role: AwardContractRole;
  otherParty: string;
  finalValue: number;
  currency: string;
  completionDate: string;
  performanceRating: string;
  status: string;
};

export type AwardWorkflowStep = {
  id: AwardContractStep;
  title: string;
  shortTitle: string;
  status: string;
};

export type ContractTab = {
  id: ContractTabId;
  label: string;
};

export type PostAwardTab = {
  id: PostAwardTabId;
  label: string;
};
