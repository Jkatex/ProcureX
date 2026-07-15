import type { ContractStatus } from '@prisma/client';

export const moduleDefinition = {
  key: 'post-award',
  name: 'Post Award',
  description: 'Standalone contract execution workspace for delivery, acceptance, finance, issues, variations, close-out, and history.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type PostAwardRequestContext = {
  userId?: string;
  organizationId?: string;
  isAdmin?: boolean;
};

export type PostAwardViewerRole = 'BUYER' | 'SUPPLIER' | 'ADMIN' | 'NONE';
export type PostAwardStageId = 'setup' | 'delivery' | 'inspections' | 'finance' | 'risk' | 'changes' | 'claims' | 'documents' | 'closeout' | 'performance' | 'history';
export type PostAwardSecondaryId = 'termination' | 'securities' | 'audit';
export type PostAwardVisibilityScope = 'SHARED' | 'BUYER_PRIVATE' | 'SUPPLIER_PRIVATE';
export type PostAwardProcurementType = 'GOODS' | 'WORKS' | 'SERVICES' | 'CONSULTANCY' | 'GENERAL';

export type PostAwardContractRowDto = {
  id: string;
  reference: string;
  title: string;
  status: ContractStatus | string;
  buyerName: string;
  supplierName: string | null;
  viewerRole: PostAwardViewerRole;
  amount: number | null;
  currency: string;
  stage: string;
  nextAction: string;
  dueDate: string | null;
  riskLevel: string;
};

export type PostAwardRecordDto = {
  id: string;
  type: string;
  title: string;
  status: string;
  ownerRole?: string | null;
  dueDate?: string | null;
  amount?: number | string | null;
  currency?: string | null;
  note?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  payload?: Record<string, unknown>;
};

export type PostAwardActionDto = {
  key: string;
  label: string;
  stage: PostAwardStageId;
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  enabled: boolean;
  reason: string | null;
};

export type PostAwardTaskDto = {
  id: string;
  title: string;
  detail: string;
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  status: 'READY' | 'BLOCKED' | 'WAITING' | 'DONE';
  actionKey: string;
  sectionId: PostAwardStageId;
  dueDate: string | null;
  blockerIds: string[];
  visibility: PostAwardVisibilityScope;
};

export type PostAwardBlockerDto = {
  id: string;
  title: string;
  detail: string;
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  sectionId: PostAwardStageId;
  actionKey: string;
};

export type PostAwardWorkflowStepDto = {
  id: string;
  label: string;
  status: 'DONE' | 'ACTIVE' | 'BLOCKED' | 'WAITING' | 'PENDING';
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  count: number;
};

export type PostAwardWorkflowSectionDto = {
  id: PostAwardStageId;
  label: string;
  description: string;
  status: 'DONE' | 'ACTIVE' | 'BLOCKED' | 'WAITING' | 'PENDING';
  steps: PostAwardWorkflowStepDto[];
  records: PostAwardRecordDto[];
};

export type PostAwardFinancialEligibilityDto = {
  invoiceableRecords: Array<{
    id: string;
    type: string;
    title: string;
    amount: number | string | null;
    acceptedAmount: number | string | null;
    alreadyInvoicedAmount: number;
    remainingInvoiceableAmount: number | null;
    currency: string;
    status: string;
    blockingReasons: string[];
    executionReferenceType: string;
    executionReferenceId: string;
  }>;
  paymentQueue: Array<{
    id: string;
    type: 'invoice' | 'payment_approval' | 'payment' | 'payment_confirmation' | 'penalty';
    title: string;
    status: string;
    amount: number;
    currency: string;
    invoiceId: string | null;
    paymentId: string | null;
    actionKey: string;
    owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
    blockingReasons: string[];
  }>;
  retentionSummary: {
    retainedAmount: number;
    releasedAmount: number;
    remainingRetention: number;
    currency: string;
    blockingReasons: string[];
  };
  advanceRecoverySummary: {
    recoveredAmount: number;
    outstandingAmount: number;
    currency: string;
    blockingReasons: string[];
  };
  deductionSummary: {
    pendingDeductionsAmount: number;
    approvedDeductionsAmount: number;
    liquidatedDamagesRecommended: number;
    liquidatedDamagesApproved: number;
    currency: string;
  };
  paymentStatusSummary: {
    recommendedAmount: number;
    approvedAmount: number;
    initiatedAmount: number;
    completedAmount: number;
    overduePaymentCount: number;
    currency: string;
  };
  supplierReceiptPending: number;
  financialCloseoutBlockers: PostAwardBlockerDto[];
  blockedReasons: PostAwardBlockerDto[];
  submittedInvoiceCount: number;
  matchedInvoiceCount: number;
  payableAmount: number;
  paidAmount: number;
  currency: string;
};

export type PostAwardOperationalReadinessDto = {
  ready: boolean;
  activationStatus: string;
  managerAssigned: boolean;
  managementPlanReady: boolean;
  activationItems: { total: number; open: number; submitted: number; approved: number };
  securities: { total: number; blocking: number };
  requiredDocuments: { total: number; open: number };
  blockers: PostAwardBlockerDto[];
};

export type PostAwardUrgentActionDto = {
  id: string;
  title: string;
  detail: string;
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  dueDate: string | null;
  actionKey: string;
  sectionId: PostAwardStageId;
};

export type PostAwardCommunicationSummaryDto = {
  totalNotices: number;
  openNotices: number;
  awaitingAcknowledgement: number;
  awaitingResponse: number;
  overdueNotices: number;
};

export type PostAwardMeetingActionSummaryDto = {
  totalMeetings: number;
  openActions: number;
  supplierActions: number;
  buyerActions: number;
  overdueActions: number;
};

export type PostAwardSecurityExpirySummaryDto = {
  total: number;
  expiringSoon: number;
  expired: number;
  unresolved: number;
};

export type PostAwardWarrantySummaryDto = {
  total: number;
  open: number;
  awaitingSupplier: number;
  awaitingBuyer: number;
  expiringSoon: number;
  overdue: number;
};

export type PostAwardPerformanceReadinessDto = {
  ready: boolean;
  systemMetrics: Array<{ key: string; label: string; value: number; tone: 'success' | 'warning' | 'error' | 'info' }>;
  evaluatorRecords: number;
  blockers: PostAwardBlockerDto[];
};

export type PostAwardCloseoutReadinessDto = {
  ready: boolean;
  steps: Array<{
    id: string;
    label: string;
    status: 'READY' | 'BLOCKED' | 'DONE';
    blockerIds: string[];
  }>;
  blockers: PostAwardBlockerDto[];
};

export type PostAwardHealthDto = {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  label: string;
  score: number;
  summary: string;
};

export type PostAwardStageDto = {
  id: PostAwardStageId;
  label: string;
  description: string;
  count: number;
  records: PostAwardRecordDto[];
};

export type PostAwardSecondaryRegisterDto = {
  id: PostAwardSecondaryId;
  label: string;
  count: number;
  records: PostAwardRecordDto[];
};

export type PostAwardWorkspaceDto = {
  contract: PostAwardContractRowDto & {
    tenderId?: string | null;
    tenderReference?: string | null;
    access: {
      viewerRole: PostAwardViewerRole;
      canSubmitSupplierActions: boolean;
      canManageBuyerActions: boolean;
      readOnlyReason: string | null;
    };
  };
  procurementType: PostAwardProcurementType;
  health: PostAwardHealthDto;
  buyerTasks: PostAwardTaskDto[];
  supplierTasks: PostAwardTaskDto[];
  workflowSections: PostAwardWorkflowSectionDto[];
  currentBlockers: PostAwardBlockerDto[];
  financialEligibility: PostAwardFinancialEligibilityDto;
  operationalReadiness: PostAwardOperationalReadinessDto;
  urgentActions: PostAwardUrgentActionDto[];
  communicationSummary: PostAwardCommunicationSummaryDto;
  meetingActionSummary: PostAwardMeetingActionSummaryDto;
  securityExpirySummary: PostAwardSecurityExpirySummaryDto;
  warrantySummary: PostAwardWarrantySummaryDto;
  performanceReadiness: PostAwardPerformanceReadinessDto;
  closeoutReadiness: PostAwardCloseoutReadinessDto;
  timeline: PostAwardRecordDto[];
  permissions: {
    visibility: PostAwardVisibilityScope;
    canManageBuyerActions: boolean;
    canSubmitSupplierActions: boolean;
    canSeeBuyerPrivate: boolean;
    canSeeSupplierPrivate: boolean;
  };
  metrics: Array<{ label: string; value: string | number; tone?: 'success' | 'warning' | 'error' | 'info' }>;
  stages: PostAwardStageDto[];
  secondary: PostAwardSecondaryRegisterDto[];
  actions: PostAwardActionDto[];
};
