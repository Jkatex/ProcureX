export const moduleDefinition = {
  key: 'records',
  name: 'Records',
  description: 'Procurement history, audit-ready record entries, and cross-module evidence indexes.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export const recordTypeValues = [
  'TENDER',
  'BID',
  'EVALUATION',
  'AWARD',
  'CONTRACT',
  'DOCUMENT',
  'COMMUNICATION',
  'COMPLIANCE',
  'ARCHIVE'
] as const;

export type ProcurementRecordType = (typeof recordTypeValues)[number];

export const recordStatusValues = [
  'DRAFT',
  'REVIEW',
  'PUBLISHED',
  'OPEN',
  'CLOSED',
  'EVALUATION',
  'AWARDED',
  'CANCELLED',
  'SUBMITTED',
  'WITHDRAWN',
  'OPENED',
  'UNDER_EVALUATION',
  'DISQUALIFIED',
  'LOST',
  'NOT_STARTED',
  'IN_PROGRESS',
  'LOCKED',
  'COMPLETED',
  'RETURNED',
  'RECOMMENDED',
  'APPROVED',
  'REJECTED',
  'NEGOTIATION',
  'SIGNATURE_PENDING',
  'ACTIVE',
  'TERMINATED',
  'UPLOADED',
  'VERIFIED',
  'INVESTIGATION',
  'FALSE_POSITIVE',
  'RESOLVED',
  'ESCALATED',
  'UNREAD',
  'READ',
  'ARCHIVED'
] as const;

export type ProcurementRecordStatus = (typeof recordStatusValues)[number];

export const sortFieldValues = ['date', 'title', 'type', 'status', 'value'] as const;

export type RecordsSortField = (typeof sortFieldValues)[number];

export type RecordsQuery = {
  search: string;
  recordType: ProcurementRecordType | 'all';
  status: ProcurementRecordStatus | 'all';
  category: string;
  startDate: string;
  endDate: string;
  page: number;
  pageSize: number;
  sortBy: RecordsSortField;
  sortDirection: 'asc' | 'desc';
};

export type RecordsDashboardDto = {
  tenderRecords: number;
  bidRecords: number;
  contractRecords: number;
  evidenceFiles: number;
  recordedValue: number;
  currency: string;
  totalRecords: number;
};

export type ProcurementRecordDto = {
  id: string;
  recordType: ProcurementRecordType;
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

export type RecordsListDto = {
  records: ProcurementRecordDto[];
  totalRecords: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ChartPointDto = {
  label: string;
  value: number;
  amount?: number;
  currency?: string;
  secondaryValue?: number;
};

export type RecordsChartsDto = {
  tendersByStatus: ChartPointDto[];
  procurementRecordsByMonth: ChartPointDto[];
  contractValueByCategory: ChartPointDto[];
  supplierParticipation: ChartPointDto[];
  awardVsCancellationTrend: ChartPointDto[];
  complianceCompletionSummary: ChartPointDto[];
  categories: string[];
};

export type HighestValueRecordDto = {
  title: string;
  referenceNumber: string | null;
  valueAmount: number;
  currency: string;
} | null;

export type BestSupplierParticipationDto = {
  supplierName: string;
  recordCount: number;
} | null;

export type RecordsInsightsDto = {
  mostActiveCategory: string | null;
  highestValueRecord: HighestValueRecordDto;
  bestSupplierParticipation: BestSupplierParticipationDto;
  complianceCompletion: number;
  awardSuccessRate: number;
  averageTenderDuration: number | null;
};

