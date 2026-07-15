import type {
  AwardNoticeStatus,
  AwardResponseAction,
  ContractLifecycleItemStatus,
  ContractMilestoneStatus,
  ContractPartyRole,
  ContractRiskLevel,
  ContractStatus,
  ContractTerminationStatus,
  ContractTerminationType,
  InvoiceStatus,
  RecommendationStatus,
  SignatureStatus
} from '@prisma/client';

export const moduleDefinition = {
  key: 'award-contract',
  name: 'Award and Contract',
  description: 'Award handoff, contract negotiation, contract versions, signatures, and post-award contract state.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type AwardContractRequestContext = {
  userId?: string;
  organizationId?: string;
  isAdmin?: boolean;
};

export type AwardRecommendationQuery = {
  organizationId: string;
  status: RecommendationStatus | 'all';
  search: string;
  page: number;
  pageSize: number;
};

export type ContractQuery = {
  organizationId: string;
  status: ContractStatus | 'all';
  search: string;
  page: number;
  pageSize: number;
};

export type LifecycleRoleContext = 'BUYER' | 'SUPPLIER';
export type ViewerRole = LifecycleRoleContext | 'ADMIN' | 'NONE';

export type WorkflowAccessDto = {
  viewerRole: ViewerRole;
  canManageBuyerActions: boolean;
  canSubmitSupplierActions: boolean;
  canSignBuyer: boolean;
  canSignSupplier: boolean;
  readOnlyReason: string | null;
};

export type LifecycleUrgency = 'Critical' | 'High' | 'Medium' | 'Low';

export type LifecycleQueueId =
  | 'sample-procurement'
  | 'contract-preparation'
  | 'awarding-in-progress'
  | 'awards-received'
  | 'contracts-in-progress'
  | 'contract-signing';

export type LifecycleActionDto = {
  id: string;
  roleContext: LifecycleRoleContext;
  sourceType: 'TENDER_CREATED' | 'AWARD_RECEIVED' | 'CONTRACT_ACTIVE' | 'SAMPLE_ACTION';
  tenderId: string | null;
  awardId: string | null;
  noticeId: string | null;
  contractId: string | null;
  reference: string | null;
  noticeReference: string | null;
  title: string;
  otherParty: string;
  currentStage: string;
  requiredAction: string;
  dueDate: string | null;
  riskLevel: LifecycleUrgency;
  status: string;
  amount: number | null;
  currency: string;
  nextRoute: string;
  nextAction: {
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

export type AwardContractDashboardDto = {
  summary: {
    awardQueues: number;
    contractActions: number;
  };
  queues: Record<LifecycleQueueId, LifecycleActionDto[]>;
};

export type AwardRecommendationListItemDto = {
  id: string;
  reference: string;
  tenderId: string;
  tenderReference: string;
  tenderTitle: string;
  buyerOrgId: string;
  buyerName: string;
  supplierOrgId: string | null;
  supplierName: string | null;
  bidId: string | null;
  status: RecommendationStatus;
  amount: number | null;
  currency: string;
  noticeStatus: AwardNoticeStatus | null;
  contractId: string | null;
  createdAt: string;
};

export type AwardNoticeDto = {
  id: string;
  reference: string;
  status: AwardNoticeStatus;
  buyerOrgId: string;
  supplierOrgId: string;
  contractId: string | null;
  buyerNote: string;
  supplierNote: string;
  issuedAt: string;
  respondedAt: string | null;
  responses: AwardResponseDto[];
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

export type AwardResponseDto = {
  id: string;
  action: AwardResponseAction;
  note: string;
  actorOrgId: string | null;
  actorUserId: string | null;
  createdAt: string;
};

export type ContractListItemDto = {
  id: string;
  reference: string;
  tenderId: string | null;
  tenderReference: string | null;
  title: string;
  buyerOrgId: string;
  buyerName: string;
  supplierOrgId: string | null;
  supplierName: string | null;
  status: ContractStatus;
  amount: number | null;
  currency: string;
  versionCount: number;
  signatureCount: number;
  pendingSignatureCount: number;
  milestoneCount: number;
  updatedAt: string;
};

export type ContractVersionDto = {
  id: string;
  versionNo: number;
  documentId: string | null;
  documentName: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ContractSignatureDto = {
  id: string;
  role: ContractPartyRole;
  status: SignatureStatus;
  signerOrgId: string | null;
  signerUserId: string | null;
  signerName: string;
  signerTitle: string;
  signedAt: string | null;
  declinedAt: string | null;
};

export type ContractMilestoneEvidenceDto = {
  id: string;
  documentId: string;
  documentName: string;
  uploadedByUserId: string | null;
  uploaderOrgId: string | null;
  note: string;
  createdAt: string;
};

export type ContractMilestoneDto = {
  id: string;
  title: string;
  description: string;
  status: ContractMilestoneStatus;
  dueDate: string | null;
  completedAt: string | null;
  amount: number | null;
  currency: string;
  payload: Record<string, unknown>;
  evidence: ContractMilestoneEvidenceDto[];
  createdAt: string;
  updatedAt: string;
};

export type ContractManagementPlanDto = {
  id: string;
  contractManagerId: string | null;
  objectives: string;
  monitoringPlan: string;
  reportingPlan: string;
  communicationPlan: string;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
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

export type ContractRiskDto = ContractLifecycleItemDto & {
  category: string;
  level: ContractRiskLevel;
  score: number;
  mitigationAction: string;
};

export type ContractVariationDto = ContractLifecycleItemDto & {
  changeType: string;
  costImpact: number | null;
  timeImpactDays: number | null;
};

export type ContractTerminationDto = {
  id: string;
  terminationType: ContractTerminationType;
  status: ContractTerminationStatus;
  reason: string;
  contractClause: string;
  faultParty: string;
  noticeDate: string | null;
  cureDeadline: string | null;
  terminationEffectiveDate: string | null;
  supplierResponse: string;
  finalDecision: string;
  payload: Record<string, unknown>;
  notices: ContractLifecycleItemDto[];
  evidence: ContractLifecycleItemDto[];
  valuation: Record<string, unknown> | null;
  settlement: Record<string, unknown> | null;
  replacementProcurement: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type AuditEventDto = {
  event: string;
  actorUserId: string | null;
  createdAt: string;
};

export type AwardRecommendationDetailDto = AwardRecommendationListItemDto & {
  awardGroupId: string | null;
  access: WorkflowAccessDto;
  reason: string;
  payload: Record<string, unknown>;
  sourceDocuments: AwardSourceDocumentDto[];
  awardGroup: AwardGroupDto;
  notice: AwardNoticeDto | null;
  contract: ContractDetailDto | null;
  approvalRoutes: Array<Record<string, unknown>>;
  tieBreakers: Array<Record<string, unknown>>;
  feasibilityChecks: Array<Record<string, unknown>>;
  standstillPeriods: Array<Record<string, unknown>>;
  awardNotifications: Array<Record<string, unknown>>;
  budgetCommitments: Array<Record<string, unknown>>;
  approvals: Array<{
    id: string;
    status: string;
    action: string;
    actorUserId: string | null;
    decidedAt: string | null;
  }>;
  audit: AuditEventDto[];
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

export type ContractDetailDto = ContractListItemDto & {
  access: WorkflowAccessDto;
  awardId: string | null;
  noticeId: string | null;
  payload: Record<string, unknown>;
  parties: Array<Record<string, unknown>>;
  clauses: ContractLifecycleItemDto[];
  negotiations: ContractLifecycleItemDto[];
  versions: ContractVersionDto[];
  signatures: ContractSignatureDto[];
  milestones: ContractMilestoneDto[];
  managementPlan: ContractManagementPlanDto | null;
  mobilizationItems: ContractLifecycleItemDto[];
  kpis: ContractLifecycleItemDto[];
  deliverables: ContractLifecycleItemDto[];
  acceptances: ContractLifecycleItemDto[];
  inspections: ContractLifecycleItemDto[];
  goodsInspections: Array<Record<string, unknown>>;
  paymentSchedules: ContractLifecycleItemDto[];
  purchaseOrders: Array<Record<string, unknown>>;
  invoices: Array<Record<string, unknown>>;
  payments: Array<Record<string, unknown>>;
  threeWayMatches: Array<Record<string, unknown>>;
  paymentApprovals: Array<Record<string, unknown>>;
  paymentConfirmations: Array<Record<string, unknown>>;
  commencements: Array<Record<string, unknown>>;
  nonConformances: Array<Record<string, unknown>>;
  securities: Array<Record<string, unknown>>;
  penalties: Array<Record<string, unknown>>;
  changeRequests: Array<Record<string, unknown>>;
  referenceSamples: Array<Record<string, unknown>>;
  risks: ContractRiskDto[];
  riskForecasts: Array<Record<string, unknown>>;
  variations: ContractVariationDto[];
  issues: ContractLifecycleItemDto[];
  disputes: ContractLifecycleItemDto[];
  terminations: ContractTerminationDto[];
  warranties: ContractLifecycleItemDto[];
  requiredDocuments: ContractLifecycleItemDto[];
  activation: Record<string, unknown> | null;
  activationItems: ContractLifecycleItemDto[];
  baselines: Array<Record<string, unknown>>;
  obligations: ContractLifecycleItemDto[];
  evidenceRequirements: ContractLifecycleItemDto[];
  deliverySchedules: Array<Record<string, unknown>>;
  dispatchNotices: Array<Record<string, unknown>>;
  goodsReceipts: Array<Record<string, unknown>>;
  siteHandovers: Array<Record<string, unknown>>;
  worksProgressReports: Array<Record<string, unknown>>;
  boqMeasurements: Array<Record<string, unknown>>;
  interimPaymentCertificates: Array<Record<string, unknown>>;
  defects: ContractLifecycleItemDto[];
  serviceLevels: Array<Record<string, unknown>>;
  servicePeriods: Array<Record<string, unknown>>;
  serviceReports: Array<Record<string, unknown>>;
  serviceCredits: Array<Record<string, unknown>>;
  consultancyDeliverables: Array<Record<string, unknown>>;
  deliverableVersions: Array<Record<string, unknown>>;
  deliverableReviews: Array<Record<string, unknown>>;
  claims: Array<Record<string, unknown>>;
  claimResponses: Array<Record<string, unknown>>;
  extensionRequests: Array<Record<string, unknown>>;
  amendments: Array<Record<string, unknown>>;
  workflowApprovals: ContractLifecycleItemDto[];
  urgentActions: ContractLifecycleItemDto[];
  notifications: ContractLifecycleItemDto[];
  closeout: Record<string, unknown> | null;
  supplierPerformanceRecords: Array<Record<string, unknown>>;
  performanceScores: Array<Record<string, unknown>>;
  supplierRiskProfile: Record<string, unknown> | null;
  audit: AuditEventDto[];
  createdAt: string;
};

export type AwardContractSampleDto = {
  id: string;
  bidSampleId: string | null;
  viewerRole: ViewerRole;
  sampleRequired: boolean;
  sampleRequirementStatus: 'SUBMITTED' | 'MISSING_REQUIRED' | 'NOT_REQUIRED';
  actionable: boolean;
  tenderId: string;
  tenderReference: string | null;
  tenderTitle: string;
  bidId: string;
  supplierOrgId: string;
  supplierName: string;
  buyerOrgId: string;
  sampleName: string;
  relatedItem: string;
  quantity: number | null;
  deliveryLocation: string;
  deliveryDeadline: string | null;
  trackingStatus: string;
  awardingStatus: string;
  sampleReference: string;
  courier: string;
  trackingNumber: string;
  submittedAt: string | null;
  receivedAt: string | null;
  inspectedAt: string | null;
  receipt: Record<string, unknown> | null;
  latestVerification: Record<string, unknown> | null;
  evaluations: Array<Record<string, unknown>>;
  tests: Array<Record<string, unknown>>;
  custodyLogs: Array<Record<string, unknown>>;
  dispositions: Array<Record<string, unknown>>;
  referenceSamples: Array<Record<string, unknown>>;
  contractId: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type AwardContractSampleDashboardDto = {
  summary: Record<string, number>;
  queues: Record<string, AwardContractSampleDto[]>;
};

export type ListAwardRecommendationsResponseDto = {
  recommendations: AwardRecommendationListItemDto[];
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
};

export type ListContractsResponseDto = {
  contracts: ContractListItemDto[];
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
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
  signatureKeyphrase?: string;
};

export type AwardDecisionInput = AwardDecisionDraftInput;

export type AwardNoticeResponseInput = {
  action: AwardResponseAction;
  note: string;
  payload: Record<string, unknown>;
  signatureKeyphrase?: string;
};

export type AwardNoticeCancelInput = {
  reason: string;
  payload: Record<string, unknown>;
};

export type AwardNoticeReissueInput = {
  supplierOrgId?: string;
  bidId?: string;
  reason: string;
  payload: Record<string, unknown>;
};

export type ContractVersionInput = {
  documentId?: string;
  payload: Record<string, unknown>;
};

export type ContractNegotiationDecisionInput = {
  status: ContractLifecycleItemStatus;
  reason: string;
  payload: Record<string, unknown>;
};

export type ContractSignatureRequestInput = {
  roles: ContractPartyRole[];
};

export type ContractSignatureSignInput = {
  signerName: string;
  signerTitle: string;
  signatureKeyphrase: string;
  payload: Record<string, unknown>;
};

export type ContractMilestoneInput = {
  title: string;
  description: string;
  dueDate?: string;
  amount?: number;
  currency: string;
  payload: Record<string, unknown>;
};

export type ContractMilestonePatchInput = Partial<ContractMilestoneInput> & {
  status?: ContractMilestoneStatus;
  completedAt?: string;
};

export type ContractMilestoneEvidenceInput = {
  documentId: string;
  note: string;
};

export type AwardContractDocumentDto = {
  id: string;
  name: string;
  documentType: string;
  createdAt: string;
  contentUrl: string;
  sourceLabel: string;
};

export type AwardContractDocumentUploadInput = {
  name: string;
  documentType?: string;
  mimeType?: string;
  size?: number;
  contentBase64?: string;
};

export type ContractStatusPatchInput = {
  status: ContractStatus;
  note: string;
};

export type ContractManagementPlanInput = {
  contractManagerId?: string;
  objectives: string;
  monitoringPlan: string;
  reportingPlan: string;
  communicationPlan: string;
  payload: Record<string, unknown>;
};

export type LifecycleItemInput = {
  title: string;
  category?: string;
  description?: string;
  status?: ContractLifecycleItemStatus;
  dueDate?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type LifecycleItemPatchInput = Partial<LifecycleItemInput> & {
  required?: boolean;
  waived?: boolean;
  signatureKeyphrase?: string;
};

export type ContractActivationItemSubmitInput = {
  documentId?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type ContractActivationItemReviewInput = {
  status: ContractLifecycleItemStatus;
  note?: string;
  payload: Record<string, unknown>;
};

export type ContractActivateInput = {
  note?: string;
  payload: Record<string, unknown>;
};

export type ContractObligationInput = {
  title: string;
  obligationType?: string;
  description?: string;
  ownerRole: string;
  relatedMilestoneId?: string;
  status?: ContractLifecycleItemStatus;
  dueDate?: string;
  amount?: number;
  currency?: string;
  acceptanceMethod?: string;
  acceptanceCriteria?: string;
  paymentEligible?: boolean;
  payload: Record<string, unknown>;
};

export type ContractEvidenceRequirementInput = {
  title: string;
  obligationId?: string;
  milestoneId?: string;
  evidenceType?: string;
  ownerRole: string;
  mandatory?: boolean;
  status?: ContractLifecycleItemStatus;
  dueDate?: string;
  documentId?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type ContractDeliveryScheduleInput = {
  obligationId?: string;
  lineReference?: string;
  description: string;
  plannedQuantity?: number;
  unit?: string;
  deliveryLocation?: string;
  plannedDeliveryDate?: string;
  status?: ContractLifecycleItemStatus;
  payload: Record<string, unknown>;
};

export type ContractDispatchNoticeInput = {
  scheduleId?: string;
  dispatchReference?: string;
  carrier?: string;
  trackingReference?: string;
  dispatchedQuantity?: number;
  expectedArrivalDate?: string;
  status?: string;
  payload: Record<string, unknown>;
};

export type ContractGoodsReceiptLineInput = {
  scheduleId?: string;
  description: string;
  orderedQuantity?: number;
  receivedQuantity?: number;
  acceptedQuantity?: number;
  rejectedQuantity?: number;
  unit?: string;
  note?: string;
  payload?: Record<string, unknown>;
};

export type ContractGoodsReceiptInput = {
  dispatchNoticeId?: string;
  receiptReference?: string;
  receivedAt?: string;
  location?: string;
  conditionAtReceipt?: string;
  status?: ContractLifecycleItemStatus;
  note?: string;
  lines?: ContractGoodsReceiptLineInput[];
  payload: Record<string, unknown>;
};

export type ContractSiteHandoverInput = {
  handoverReference?: string;
  handoverDate?: string;
  location?: string;
  handedOverBy?: string;
  receivedBy?: string;
  constraints?: string;
  status?: string;
  payload: Record<string, unknown>;
};

export type ContractWorksProgressReportInput = {
  reportReference?: string;
  periodStart?: string;
  periodEnd?: string;
  progressPercent?: number;
  narrative?: string;
  status?: string;
  payload: Record<string, unknown>;
};

export type ContractBoqMeasurementInput = {
  reportId?: string;
  boqItemReference: string;
  description?: string;
  previousQuantity?: number;
  currentQuantity?: number;
  cumulativeQuantity?: number;
  unitRate?: number;
  amount?: number;
  status?: string;
  payload: Record<string, unknown>;
};

export type ContractInterimPaymentCertificateInput = {
  certificateNumber?: string;
  periodStart?: string;
  periodEnd?: string;
  grossAmount?: number;
  deductionsAmount?: number;
  netAmount?: number;
  currency?: string;
  status?: string;
  approvedAt?: string;
  payload: Record<string, unknown>;
};

export type ContractDefectInput = {
  defectReference?: string;
  title: string;
  description?: string;
  severity?: string;
  identifiedAt?: string;
  dueDate?: string;
  status?: ContractLifecycleItemStatus;
  closedAt?: string;
  payload: Record<string, unknown>;
};

export type ContractServiceLevelInput = {
  metricKey: string;
  title: string;
  targetValue?: string;
  measurementUnit?: string;
  creditRule?: string;
  status?: string;
  payload: Record<string, unknown>;
};

export type ContractServicePeriodInput = {
  periodKey: string;
  startDate: string;
  endDate: string;
  status?: string;
  payload: Record<string, unknown>;
};

export type ContractServiceReportInput = {
  periodId?: string;
  reportReference?: string;
  submittedAt?: string;
  status?: string;
  summary?: string;
  payload: Record<string, unknown>;
};

export type ContractServiceCreditInput = {
  serviceLevelId?: string;
  periodId?: string;
  creditType?: string;
  amount?: number;
  currency?: string;
  status?: string;
  reason?: string;
  payload: Record<string, unknown>;
};

export type ContractConsultancyDeliverableInput = {
  deliverableCode: string;
  title: string;
  description?: string;
  dueDate?: string;
  paymentEligible?: boolean;
  status?: ContractLifecycleItemStatus;
  payload: Record<string, unknown>;
};

export type ContractDeliverableVersionInput = {
  deliverableId?: string;
  versionNo?: number;
  documentId?: string;
  submittedAt?: string;
  status?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type ContractDeliverableReviewInput = {
  versionId?: string;
  decision?: string;
  reviewedAt?: string;
  comments?: string;
  payload: Record<string, unknown>;
};

export type ContractClaimInput = {
  claimReference?: string;
  claimType?: string;
  title: string;
  description?: string;
  raisedByRole?: string;
  amount?: number;
  currency?: string;
  status?: ContractLifecycleItemStatus;
  submittedAt?: string;
  payload: Record<string, unknown>;
};

export type ContractClaimResponseInput = {
  claimId?: string;
  responderRole?: string;
  decision?: string;
  response?: string;
  amountApproved?: number;
  respondedAt?: string;
  payload: Record<string, unknown>;
};

export type ContractExtensionRequestInput = {
  requestReference?: string;
  requestedByRole?: string;
  reason?: string;
  requestedEndDate?: string;
  impactSummary?: string;
  status?: ContractLifecycleItemStatus;
  decidedAt?: string;
  payload: Record<string, unknown>;
};

export type ContractAmendmentInput = {
  amendmentReference?: string;
  amendmentType?: string;
  title: string;
  reason?: string;
  baselineVersionNo?: number;
  valueDelta?: number;
  timeDeltaDays?: number;
  status?: string;
  approvedAt?: string;
  signedAt?: string;
  payload: Record<string, unknown>;
};

export type InspectionInput = LifecycleItemInput & {
  milestoneId?: string;
  inspectionType: string;
  inspectedAt?: string;
  inspectorUserId?: string;
};

export type RiskInput = LifecycleItemInput & {
  likelihood?: number;
  impact?: number;
  level?: ContractRiskLevel;
  responsibleUserId?: string;
  mitigationAction?: string;
};

export type VariationInput = LifecycleItemInput & {
  changeType: string;
  affectedClause?: string;
  costImpact?: number;
  timeImpactDays?: number;
  technicalImpact?: string;
};

export type TerminationInput = {
  terminationType: ContractTerminationType;
  reason: string;
  contractClause?: string;
  faultParty?: string;
  noticeDate?: string;
  cureDeadline?: string;
  terminationEffectiveDate?: string;
  supplierResponse?: string;
  finalDecision?: string;
  payload: Record<string, unknown>;
};

export type TerminationPatchInput = Partial<TerminationInput> & {
  status?: ContractTerminationStatus;
  signatureKeyphrase?: string;
};

export type TerminationNoticeInput = {
  noticeType: string;
  contractClause?: string;
  requiredAction?: string;
  deadline?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type TerminationEvidenceInput = {
  documentId?: string;
  evidenceType: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type TerminationValuationInput = {
  acceptedValue?: number;
  rejectedValue?: number;
  advanceRecovery?: number;
  retentionHeld?: number;
  liquidatedDamages?: number;
  costToComplete?: number;
  performanceSecurityClaim?: number;
  finalAmountPayable?: number;
  finalAmountRecoverable?: number;
  currency: string;
  payload: Record<string, unknown>;
};

export type TerminationSettlementInput = {
  status?: ContractLifecycleItemStatus;
  settlementNote?: string;
  settledAt?: string;
  payload: Record<string, unknown>;
};

export type ReplacementProcurementInput = {
  method: string;
  urgencyLevel?: ContractRiskLevel;
  remainingScope?: string;
  estimatedCost?: number;
  currency: string;
  status?: ContractLifecycleItemStatus;
  payload: Record<string, unknown>;
};

export type ContractCloseoutInput = {
  status?: ContractLifecycleItemStatus;
  completionCertificate?: boolean;
  finalAccountApproved?: boolean;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  lessonsLearned?: string;
  payload: Record<string, unknown>;
  signatureKeyphrase?: string;
};

export type SupplierPerformanceInput = {
  overallScore?: number;
  timeScore?: number;
  qualityScore?: number;
  costScore?: number;
  complianceScore?: number;
  terminationFault?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type InvoiceStatusPatchInput = {
  status: InvoiceStatus;
  note: string;
};

export type ClauseInput = {
  clauseKey: string;
  title: string;
  body?: string;
  category?: string;
  status?: ContractLifecycleItemStatus;
  buyerComment?: string;
  supplierComment?: string;
  legalComment?: string;
  payload: Record<string, unknown>;
};

export type NegotiationInput = {
  winnerId?: string;
  clauseId?: string;
  raisedByRole: string;
  requestType?: 'CLARIFICATION' | 'AMENDMENT';
  subject: string;
  position?: string;
  counterOffer?: string;
  status?: ContractLifecycleItemStatus;
  dueDate?: string;
  payload: Record<string, unknown>;
};

export type AwardSettlementInput = {
  note: string;
  payload: Record<string, unknown>;
  signatureKeyphrase?: string;
};

export type DeliverableInput = LifecycleItemInput & {
  milestoneId?: string;
  submittedAt?: string;
  acceptanceNote?: string;
};

export type AcceptanceInput = {
  deliverableId?: string;
  inspectionId?: string;
  certificateNo?: string;
  status?: ContractLifecycleItemStatus;
  acceptedValue?: number;
  currency: string;
  acceptedAt?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type PaymentScheduleInput = {
  milestoneId?: string;
  title: string;
  amount?: number;
  currency: string;
  dueDate?: string;
  status?: ContractLifecycleItemStatus;
  payload: Record<string, unknown>;
};

export type ContractPaymentInput = {
  invoiceId?: string;
  scheduleId?: string;
  status?: InvoiceStatus;
  grossAmount?: number;
  retentionAmount?: number;
  advanceRecovery?: number;
  liquidatedDamages?: number;
  taxWithholding?: number;
  netAmount?: number;
  currency: string;
  paidAt?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type WarrantyInput = LifecycleItemInput & {
  defectReference?: string;
  startDate?: string;
  endDate?: string;
  responsibleRole?: string;
};

export type RequiredDocumentInput = {
  documentType: string;
  title: string;
  ownerRole: string;
  status?: ContractLifecycleItemStatus;
  documentId?: string;
  dueDate?: string;
  reviewedAt?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type WorkflowApprovalInput = {
  stepKey: string;
  role: string;
  status?: ContractLifecycleItemStatus;
  note?: string;
  payload: Record<string, unknown>;
};

export type AwardApprovalRouteInput = {
  routeKey: string;
  title: string;
  status?: string;
  currentStepOrder?: number;
  requiredQuorum?: number;
  note?: string;
  payload: Record<string, unknown>;
};

export type AwardApprovalStepInput = {
  routeId: string;
  stepOrder: number;
  stepKey: string;
  role: string;
  actorUserId?: string;
  status?: string;
  dueDate?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type AwardTieBreakerInput = {
  triggerReason: string;
  method: string;
  criteria?: unknown[];
  outcomeBidId?: string;
  status?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type DeliveryFeasibilityInput = {
  deliveryCapacity?: string;
  siteReadiness?: string;
  resourcePlan?: string;
  riskRating?: string;
  status?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type StandstillPeriodInput = {
  startsAt?: string;
  endsAt?: string;
  days?: number;
  status?: string;
  waived?: boolean;
  waiverReason?: string;
  payload: Record<string, unknown>;
};

export type AwardNotificationInput = {
  recipientOrgId?: string;
  channel?: string;
  notificationType: string;
  subject: string;
  body?: string;
  status?: string;
  payload: Record<string, unknown>;
};

export type BudgetCommitmentInput = {
  contractId?: string;
  budgetCode: string;
  commitmentNo?: string;
  amount: number;
  currency: string;
  status?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type GoodsInspectionInput = {
  milestoneId?: string;
  deliverableId?: string;
  inspectionNo?: string;
  goodsDescription: string;
  quantityOrdered?: number;
  quantityReceived?: number;
  quantityAccepted?: number;
  quantityRejected?: number;
  unit?: string;
  location?: string;
  result?: ContractLifecycleItemStatus;
  inspectedAt?: string;
  defects?: unknown[];
  note?: string;
  payload: Record<string, unknown>;
};

export type InvoiceInput = {
  reference?: string;
  purchaseOrderId?: string;
  supplierOrgId?: string;
  executionReferenceType?: string;
  executionReferenceId?: string;
  amount: number;
  currency: string;
  status?: InvoiceStatus;
  payload: Record<string, unknown>;
};

export type ThreeWayMatchInput = {
  invoiceId: string;
  purchaseOrderId?: string;
  acceptanceId?: string;
  status?: InvoiceStatus;
  poMatched?: boolean;
  receiptMatched?: boolean;
  invoiceMatched?: boolean;
  varianceAmount?: number;
  currency: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type PaymentApprovalInput = {
  invoiceId?: string;
  paymentId?: string;
  stepKey: string;
  role: string;
  status?: InvoiceStatus;
  amountApproved?: number;
  currency: string;
  note?: string;
  payload: Record<string, unknown>;
  signatureKeyphrase?: string;
};

export type PaymentConfirmationInput = {
  invoiceId?: string;
  paymentId?: string;
  confirmationReference?: string;
  paidAmount: number;
  currency: string;
  paidAt?: string;
  evidenceDocumentId?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type PerformanceScoreInput = {
  scoreType: string;
  score: number;
  weight?: number;
  periodStart?: string;
  periodEnd?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type RiskForecastInput = {
  supplierOrgId?: string;
  tenderId?: string;
  forecastType: string;
  horizonDays?: number;
  probability: number;
  impactLevel?: string;
  status?: string;
  drivers?: unknown[];
  recommendation?: string;
  payload: Record<string, unknown>;
};

export type SupplierRiskProfileInput = {
  supplierOrgId?: string;
  riskLevel?: string;
  riskScore?: number;
  trustTier?: string;
  activeAlerts?: number;
  openViolations?: number;
  summary?: string;
  drivers?: unknown[];
  payload: Record<string, unknown>;
};

export type SampleReceiptInput = {
  receivedQuantity?: number;
  conditionAtReceipt?: string;
  packagingCondition?: string;
  deliveryRepresentative?: string;
  receivingOfficerId?: string;
  storageLocation?: string;
  missingComponents?: string;
  visibleDamage?: string;
  remarks?: string;
  receivedAt?: string;
  payload: Record<string, unknown>;
};

export type SampleVerificationInput = {
  result: string;
  quantityAccepted?: boolean;
  certificatesAttached?: boolean;
  packagingAccepted?: boolean;
  matchesBid?: boolean;
  completeUndamaged?: boolean;
  clarificationRequired?: boolean;
  note?: string;
  verifiedAt?: string;
  payload: Record<string, unknown>;
};

export type SampleCustodyTransferInput = {
  fromCustodianId?: string;
  toCustodianId?: string;
  previousLocation?: string;
  newLocation?: string;
  transferPurpose: string;
  conditionBefore?: string;
  conditionAfter?: string;
  remarks?: string;
  transferredAt?: string;
  payload: Record<string, unknown>;
};

export type SampleEvaluationInput = {
  criterion: string;
  score?: number;
  maximumScore?: number;
  passed?: boolean;
  decision?: string;
  comments?: string;
  evaluatedAt?: string;
  payload: Record<string, unknown>;
};

export type SampleTestInput = {
  testName: string;
  testingInstitution?: string;
  testingOfficer?: string;
  testingMethod?: string;
  testingStandard?: string;
  expectedResult?: string;
  actualResult?: string;
  result?: string;
  testCost?: number;
  currency: string;
  responsibleParty?: string;
  reportDocumentId?: string;
  testedAt?: string;
  payload: Record<string, unknown>;
};

export type SampleDispositionInput = {
  dispositionType: string;
  reason?: string;
  supplierNotifiedAt?: string;
  collectionDeadline?: string;
  collectionRepresentative?: string;
  returnCondition?: string;
  disposalMethod?: string;
  witnesses?: string;
  acknowledgementDocumentId?: string;
  status?: string;
  completedAt?: string;
  payload: Record<string, unknown>;
};

export type ContractReferenceSampleInput = {
  contractId?: string;
  referenceNo?: string;
  storageLocation?: string;
  status?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type ContractCommencementInput = {
  noticeDate?: string;
  startDate?: string;
  effectiveDate?: string;
  completionDate?: string;
  deliveryLocation?: string;
  buyerContractManager?: string;
  supplierContractManager?: string;
  initialMeetingDate?: string;
  approvedWorkPlan?: string;
  approvedDeliverySchedule?: string;
  status?: string;
  payload: Record<string, unknown>;
};

export type ContractNonConformanceInput = {
  category: string;
  title: string;
  description?: string;
  relatedRecordId?: string;
  contractClause?: string;
  severity?: string;
  responsibleSupplierOfficer?: string;
  correctiveAction?: string;
  correctiveActionDeadline?: string;
  verificationResult?: string;
  status?: string;
  identifiedAt?: string;
  closedAt?: string;
  payload: Record<string, unknown>;
};

export type ContractSecurityInput = {
  securityType: string;
  issuingInstitution?: string;
  referenceNumber?: string;
  amount?: number;
  currency: string;
  issueDate?: string;
  expiryDate?: string;
  verificationStatus?: string;
  claimStatus?: string;
  releasedAt?: string;
  documentId?: string;
  note?: string;
  payload: Record<string, unknown>;
};

export type ContractPenaltyInput = {
  invoiceId?: string;
  penaltyType: string;
  contractClause?: string;
  basis?: string;
  amount?: number;
  currency: string;
  status?: string;
  evidence?: unknown[];
  note?: string;
  payload: Record<string, unknown>;
};

export type ContractChangeRequestInput = {
  changeType: string;
  title: string;
  reason?: string;
  technicalReview?: string;
  financialReview?: string;
  budgetCheck?: string;
  legalReview?: string;
  supplierResponse?: string;
  amendmentVersionId?: string;
  status?: string;
  approvedAt?: string;
  signedAt?: string;
  payload: Record<string, unknown>;
};
