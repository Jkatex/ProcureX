import type { ContractDetailDto } from '@/features/awardsContracts/types';

export type PostAwardViewerRole = 'BUYER' | 'SUPPLIER' | 'ADMIN' | 'NONE';
export type PostAwardStageId = 'setup' | 'delivery' | 'inspections' | 'finance' | 'risk' | 'changes' | 'claims' | 'documents' | 'closeout' | 'performance' | 'history';
export type PostAwardPageId = 'setup' | 'delivery' | 'inspections' | 'finance' | 'risk' | 'changes' | 'claims' | 'termination' | 'documents' | 'closeout' | 'performance' | 'history';
export type PostAwardVisibilityScope = 'SHARED' | 'BUYER_PRIVATE' | 'SUPPLIER_PRIVATE';
export type PostAwardProcurementType = 'GOODS' | 'WORKS' | 'SERVICES' | 'CONSULTANCY' | 'GENERAL';

export type PostAwardContractRow = {
  id: string;
  reference: string;
  title: string;
  status: string;
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

export type PostAwardRecord = {
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

export type PostAwardAction = {
  key: string;
  label: string;
  stage: PostAwardStageId;
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  enabled: boolean;
  reason: string | null;
};

export type PostAwardTask = {
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

export type PostAwardBlocker = {
  id: string;
  title: string;
  detail: string;
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  sectionId: PostAwardStageId;
  actionKey: string;
};

export type PostAwardWorkflowStep = {
  id: string;
  label: string;
  status: 'DONE' | 'ACTIVE' | 'BLOCKED' | 'WAITING' | 'PENDING';
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  count: number;
};

export type PostAwardWorkflowSection = {
  id: PostAwardStageId;
  label: string;
  description: string;
  status: 'DONE' | 'ACTIVE' | 'BLOCKED' | 'WAITING' | 'PENDING';
  steps: PostAwardWorkflowStep[];
  records: PostAwardRecord[];
};

export type PostAwardFinancialEligibility = {
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
  financialCloseoutBlockers: PostAwardBlocker[];
  blockedReasons: PostAwardBlocker[];
  submittedInvoiceCount: number;
  matchedInvoiceCount: number;
  payableAmount: number;
  paidAmount: number;
  currency: string;
};

export type PostAwardOperationalReadiness = {
  ready: boolean;
  activationStatus: string;
  managerAssigned: boolean;
  managementPlanReady: boolean;
  activationItems: { total: number; open: number; submitted: number; approved: number };
  securities: { total: number; blocking: number };
  requiredDocuments: { total: number; open: number };
  blockers: PostAwardBlocker[];
};

export type PostAwardUrgentAction = {
  id: string;
  title: string;
  detail: string;
  owner: 'BUYER' | 'SUPPLIER' | 'SHARED';
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  dueDate: string | null;
  actionKey: string;
  sectionId: PostAwardStageId;
};

export type PostAwardCommunicationSummary = {
  totalNotices: number;
  openNotices: number;
  awaitingAcknowledgement: number;
  awaitingResponse: number;
  overdueNotices: number;
};

export type PostAwardMeetingActionSummary = {
  totalMeetings: number;
  openActions: number;
  supplierActions: number;
  buyerActions: number;
  overdueActions: number;
};

export type PostAwardSecurityExpirySummary = {
  total: number;
  expiringSoon: number;
  expired: number;
  unresolved: number;
};

export type PostAwardWarrantySummary = {
  total: number;
  open: number;
  awaitingSupplier: number;
  awaitingBuyer: number;
  expiringSoon: number;
  overdue: number;
};

export type PostAwardPerformanceReadiness = {
  ready: boolean;
  systemMetrics: Array<{ key: string; label: string; value: number; tone: 'success' | 'warning' | 'error' | 'info' }>;
  evaluatorRecords: number;
  blockers: PostAwardBlocker[];
};

export type PostAwardCloseoutReadiness = {
  ready: boolean;
  steps: Array<{ id: string; label: string; status: 'READY' | 'BLOCKED' | 'DONE'; blockerIds: string[] }>;
  blockers: PostAwardBlocker[];
};

export type PostAwardHealth = {
  level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  label: string;
  score: number;
  summary: string;
};

export type PostAwardStage = {
  id: PostAwardStageId;
  label: string;
  description: string;
  count: number;
  records: PostAwardRecord[];
};

export type PostAwardWorkspace = {
  contract: PostAwardContractRow & {
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
  health: PostAwardHealth;
  buyerTasks: PostAwardTask[];
  supplierTasks: PostAwardTask[];
  workflowSections: PostAwardWorkflowSection[];
  currentBlockers: PostAwardBlocker[];
  financialEligibility: PostAwardFinancialEligibility;
  operationalReadiness: PostAwardOperationalReadiness;
  urgentActions: PostAwardUrgentAction[];
  communicationSummary: PostAwardCommunicationSummary;
  meetingActionSummary: PostAwardMeetingActionSummary;
  securityExpirySummary: PostAwardSecurityExpirySummary;
  warrantySummary: PostAwardWarrantySummary;
  performanceReadiness: PostAwardPerformanceReadiness;
  closeoutReadiness: PostAwardCloseoutReadiness;
  timeline: PostAwardRecord[];
  permissions: {
    visibility: PostAwardVisibilityScope;
    canManageBuyerActions: boolean;
    canSubmitSupplierActions: boolean;
    canSeeBuyerPrivate: boolean;
    canSeeSupplierPrivate: boolean;
  };
  metrics: Array<{ label: string; value: string | number; tone?: 'success' | 'warning' | 'error' | 'info' }>;
  detail?: ContractDetailDto;
  pages?: Array<{ id: PostAwardPageId; label: string; description: string; count: number; locked?: boolean; lockReason?: string | null }>;
  workGroups?: Array<{ id: string; label: string; description: string; pageIds: PostAwardPageId[]; count: number }>;
  recommendedActions?: Array<{ pageId: PostAwardPageId; title: string; detail: string; priority: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info'; owner: 'BUYER' | 'SUPPLIER' | 'SHARED' }>;
  stages: PostAwardStage[];
  secondary: Array<{ id: string; label: string; count: number; records: PostAwardRecord[] }>;
  actions: PostAwardAction[];
};

export type PostAwardDocument = {
  id: string;
  name: string;
  documentType: string;
  createdAt: string;
  contentUrl: string;
  sourceLabel: string;
};
