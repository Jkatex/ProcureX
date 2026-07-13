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
  | 'my-urgent-actions'
  | 'awarding-in-progress'
  | 'awards-received'
  | 'contracts-in-progress'
  | 'active-contracts'
  | 'closed-contracts';

export type LifecycleActionDto = {
  id: string;
  roleContext: LifecycleRoleContext;
  sourceType: 'TENDER_CREATED' | 'AWARD_RECEIVED' | 'CONTRACT_ACTIVE';
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
    urgentActions: number;
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
  risks: ContractRiskDto[];
  riskForecasts: Array<Record<string, unknown>>;
  variations: ContractVariationDto[];
  issues: ContractLifecycleItemDto[];
  disputes: ContractLifecycleItemDto[];
  terminations: ContractTerminationDto[];
  warranties: ContractLifecycleItemDto[];
  requiredDocuments: ContractLifecycleItemDto[];
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
};

export type AwardDecisionInput = AwardDecisionDraftInput;

export type AwardNoticeResponseInput = {
  action: AwardResponseAction;
  note: string;
  payload: Record<string, unknown>;
};

export type ContractVersionInput = {
  documentId?: string;
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
