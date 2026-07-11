export type RecordsRecordType =
  | 'TENDER'
  | 'BID'
  | 'CONTRACT'
  | 'AWARD'
  | 'AMENDMENT'
  | 'CLARIFICATION'
  | 'CANCELLATION'
  | 'COMPLIANCE'
  | 'REPORT';

export type RecordsRecordStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'PUBLISHED'
  | 'OPEN'
  | 'CLOSED'
  | 'EVALUATION'
  | 'AWARDED'
  | 'CONTRACTED'
  | 'CANCELLED'
  | 'SUBMITTED'
  | 'WITHDRAWN'
  | 'OPENED'
  | 'UNDER_EVALUATION'
  | 'DISQUALIFIED'
  | 'LOST'
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'LOCKED'
  | 'COMPLETED'
  | 'RETURNED'
  | 'RECOMMENDED'
  | 'APPROVED'
  | 'REJECTED'
  | 'NEGOTIATION'
  | 'SIGNATURE_PENDING'
  | 'ACTIVE'
  | 'TERMINATED'
  | 'UPLOADED'
  | 'VERIFIED'
  | 'INVESTIGATION'
  | 'FALSE_POSITIVE'
  | 'RESOLVED'
  | 'ESCALATED'
  | 'UNREAD'
  | 'READ'
  | 'ARCHIVED';

export type RecordsFilterValue<T extends string> = T | 'all';

export type RecordsSortField = 'date' | 'title' | 'type' | 'status' | 'value';

export type RecordsDashboard = {
  tenderRecords: number;
  bidRecords: number;
  evaluationRecords: number;
  awardRecords: number;
  contractRecords: number;
  activeContracts: number;
  evidenceFiles: number;
  archivedRecords: number;
  recordedValue: number;
  currency: string;
  totalRecords: number;
};

export type ProcurementRecord = {
  id: string;
  recordType: RecordsRecordType;
  sourceModule: string;
  sourceId: string;
  title: string;
  referenceNumber: string | null;
  status: string;
  valueAmount: number | null;
  currency: string;
  category: string | null;
  procurementType: string | null;
  buyerName: string | null;
  supplierName: string | null;
  tenderId: string | null;
  bidId: string | null;
  contractId: string | null;
  evidenceCount: number;
  evidence: string[];
  createdAt: string;
  updatedAt: string;
};

export type RecordsQuery = {
  recordId?: string;
  search: string;
  recordType: RecordsFilterValue<RecordsRecordType>;
  status: RecordsFilterValue<RecordsRecordStatus>;
  category: string;
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
  sortBy: RecordsSortField;
  sortDirection: 'asc' | 'desc';
};

export type RecordsLifecycleStage = {
  key: string;
  label: string;
  status: 'completed' | 'current' | 'pending';
  date: string | null;
  detail: string | null;
  recordId: string | null;
};

export type RecordsDocument = {
  id: string;
  name: string;
  category: string;
  relatedRecord: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
  fileType: string;
  version: string;
  accessLevel: string;
};

export type RecordsAuditEvent = {
  id: string;
  occurredAt: string;
  user: string | null;
  organization: string | null;
  action: string;
  recordType: string;
  recordReference: string | null;
  result: string;
};

export type RecordsDetail = {
  record: ProcurementRecord;
  lifecycle: RecordsLifecycleStage[];
  documents: RecordsDocument[];
  audit: RecordsAuditEvent[];
};

export type RecordsListResponse = {
  records: ProcurementRecord[];
  totalRecords: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ChartPoint = {
  label: string;
  value: number;
  amount?: number;
  currency?: string;
  secondaryValue?: number;
};

export type RecordsCharts = {
  tendersByStatus: ChartPoint[];
  procurementRecordsByMonth: ChartPoint[];
  contractValueByCategory: ChartPoint[];
  supplierParticipation: ChartPoint[];
  awardVsCancellationTrend: ChartPoint[];
  complianceCompletionSummary: ChartPoint[];
  categories: string[];
};

export type RecordsInsights = {
  mostActiveCategory: string | null;
  highestValueRecord: {
    title: string;
    referenceNumber: string | null;
    valueAmount: number;
    currency: string;
  } | null;
  bestSupplierParticipation: {
    supplierName: string;
    recordCount: number;
  } | null;
  complianceCompletion: number;
  awardSuccessRate: number;
  averageTenderDuration: number | null;
};
