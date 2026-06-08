export type RecordsRecordType =
  | 'TENDER'
  | 'BID'
  | 'EVALUATION'
  | 'AWARD'
  | 'CONTRACT'
  | 'DOCUMENT'
  | 'COMMUNICATION'
  | 'COMPLIANCE'
  | 'ARCHIVE';

export type RecordsRecordStatus =
  | 'DRAFT'
  | 'REVIEW'
  | 'PUBLISHED'
  | 'OPEN'
  | 'CLOSED'
  | 'EVALUATION'
  | 'AWARDED'
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
  contractRecords: number;
  evidenceFiles: number;
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
