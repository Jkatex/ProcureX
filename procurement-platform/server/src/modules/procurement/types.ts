import type { TenderType } from '@prisma/client';

export const moduleDefinition = {
  key: 'procurement',
  name: 'Procurement',
  description: 'Tender creation, publication, marketplace visibility, requirements, milestones, and commercial items.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type PublicWelcomeStats = {
  participantCount: number;
  participantLabel: string;
  openTenderCount: number;
  verifiedProfileCompletionRate: number;
  activeWorkspaceLabel: string;
};

export type PublicWelcomeTender = {
  id: string;
  reference: string;
  title: string;
  buyerName: string;
  type: string;
  status: string;
  budget: string | null;
  currency: string;
  location: string | null;
  closingDate: string | null;
  categories: string[];
};

export type PublicWelcomePayload = {
  stats: PublicWelcomeStats;
  featuredTenders: PublicWelcomeTender[];
};

export const masterDataGroupValues = [
  'tender-types',
  'procurement-methods',
  'categories',
  'currencies',
  'units',
  'funding-sources',
  'evaluation-methods',
  'response-types',
  'standards',
  'certifications',
  'regulatory-licenses',
  'professional-bodies'
] as const;

export type MasterDataGroup = (typeof masterDataGroupValues)[number];

export type MasterDataItemDto = {
  code: string;
  label: string;
  value: string;
  isActive: boolean;
  sortOrder: number;
};

export type MasterDataGroupDto = {
  group: MasterDataGroup;
  items: MasterDataItemDto[];
};

export type MasterDataGroupResponseDto = {
  success: true;
  data: MasterDataGroupDto;
};

export type MasterDataListResponseDto = {
  success: true;
  data: {
    groups: MasterDataGroupDto[];
  };
};

export const designFormSchemaTypeValues = ['goods', 'works', 'services', 'consultancy'] as const;

export type FormSchemaType = (typeof designFormSchemaTypeValues)[number];

export type DesignFormShowWhenDto = {
  field: string;
  value?: string | number | boolean;
  values?: Array<string | number | boolean>;
};

export type DesignFormOptionSourceDto = {
  group: MasterDataGroup;
};

export type DesignFormControlDto = {
  id: string;
  label: string;
  type: string;
  required?: boolean;
  placeholder?: string;
  helperText?: string;
  hint?: string;
  options?: string[];
  optionSource?: DesignFormOptionSourceDto;
  showWhen?: DesignFormShowWhenDto;
  defaultValue?: unknown;
  addLabel?: string;
  importLabel?: string;
  emptyText?: string;
  sourceEmptyText?: string;
  requiresSourceOptions?: boolean;
  sourceControlId?: string;
  sourceLabelField?: string;
  buttonLabel?: string;
  accept?: string;
  rows?: number;
  maxLength?: number;
  formula?: string;
  suffix?: string;
  columns?: DesignFormControlDto[];
  fields?: DesignFormControlDto[];
  panels?: DesignFormControlDto[];
  presets?: string[];
  cardTitle?: string;
  cardTitleField?: string;
  cardTitlePrefix?: string;
  hideAdd?: boolean;
};

export type DesignFormSectionDto = {
  id: string;
  title: string;
  hint?: string;
  showWhen?: DesignFormShowWhenDto;
  controls: DesignFormControlDto[];
};

export type DesignFormSchemaDto = {
  schemaVersion: string;
  type: FormSchemaType;
  tenderType: string;
  title: string;
  sections: DesignFormSectionDto[];
};

export type DesignFormSchemaResponseDto = {
  success: true;
  data: DesignFormSchemaDto;
};

export type DesignFormSchemaListResponseDto = {
  success: true;
  data: {
    schemaVersion: string;
    schemas: DesignFormSchemaDto[];
  };
};

export type ProcurementTaxonomyCategoryDto = {
  code: string;
  label: string;
  value: string;
  type: string;
  synonyms: string[];
  isActive: boolean;
  sortOrder: number;
};

export type ProcurementTaxonomyResponseDto = {
  success: true;
  data: {
    taxonomyVersion: string;
    categories: ProcurementTaxonomyCategoryDto[];
  };
};

export type CategoryStandardizationDto = {
  rawCategory: string;
  standardCategory: string;
  type: string;
  confidence: number;
  synonymsMatched: string[];
};

export type CategoryStandardizationResultDto = {
  taxonomyVersion: string;
  mappings: CategoryStandardizationDto[];
  standardCategories: string[];
};

export type CategoryStandardizationResponseDto = {
  success: true;
  data: CategoryStandardizationDto;
};

export type TenderDraftMissingRequiredFieldDto = {
  path: string;
  label: string;
  section: string;
};

export type TenderDraftValidationDto = {
  warnings: string[];
  missingRequiredFields: TenderDraftMissingRequiredFieldDto[];
  schemaVersion: string;
};

export type TenderLanguageScanSeverity = 'Low' | 'Medium' | 'High';

export type TenderLanguageScanRiskLevel = 'Low' | 'Medium' | 'High';

export type TenderLanguageScanIssueDto = {
  type: string;
  severity: TenderLanguageScanSeverity;
  field: string;
  text: string;
  suggestion: string;
};

export type TenderLanguageScanDto = {
  riskLevel: TenderLanguageScanRiskLevel;
  score: number;
  issues: TenderLanguageScanIssueDto[];
};

export type TenderLanguageScanInput = {
  title?: string;
  description?: string;
  requirements?: Record<string, unknown>;
  evaluationCriteria?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type TenderLanguageScanResponseDto = {
  success: true;
  data: TenderLanguageScanDto;
};

export const planningSortValues = ['date', 'title', 'budget', 'status', 'category'] as const;

export type PlanningSort = (typeof planningSortValues)[number];

export type ProcurementPlanningQuery = {
  organizationId: string;
  financialYear: string;
  search: string;
  status: string;
  category: string;
  page: number;
  pageSize: number;
  sortBy: PlanningSort;
  sortDirection: 'asc' | 'desc';
};

export type ProcurementPlanLineInput = {
  tenderTitle: string;
  openingDate: string;
  closingDate: string;
  category: string;
  budget: number;
  procurementMethod: string;
  sourceOfFunds: string;
  expectedCompletionDate: string;
  status: string;
  planState: string;
  notes: string;
  customValues: Record<string, string>;
  metadata: Record<string, unknown>;
  tenderId?: string;
};

export type SaveAnnualPlanInput = {
  ownerOrgId?: string;
  financialYear: string;
  name?: string;
  status: string;
  source: string;
  currency: string;
  metadata: Record<string, unknown>;
  lines: ProcurementPlanLineInput[];
};

export type UpdateProcurementPlanInput = Partial<{
  name: string;
  status: string;
  source: string;
  currency: string;
  metadata: Record<string, unknown>;
  lines: ProcurementPlanLineInput[];
}>;

export type ProcurementPlanLinePatchInput = Partial<ProcurementPlanLineInput>;

export type ProcurementPlanLineDto = {
  id: string;
  planId: string;
  tenderId: string | null;
  financialYear: string;
  tenderTitle: string;
  openingDate: string;
  closingDate: string;
  category: string;
  budget: number;
  procurementMethod: string;
  sourceOfFunds: string;
  expectedCompletionDate: string;
  status: string;
  planState: string;
  notes: string;
  customValues: Record<string, string>;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ProcurementPlanDto = {
  id: string;
  ownerOrgId: string;
  ownerName: string;
  financialYear: string;
  name: string;
  status: string;
  source: string;
  currency: string;
  lineCount: number;
  totalBudget: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  lines: ProcurementPlanLineDto[];
};

export type PlanningBreakdownDto = {
  label: string;
  value: number;
  amount?: number;
};

export type ProcurementPlanningSummaryDto = {
  financialYear: string | null;
  years: string[];
  totalPlans: number;
  totalLines: number;
  totalBudget: number;
  byStatus: PlanningBreakdownDto[];
  byCategory: PlanningBreakdownDto[];
};

export type ProcurementPlanningListDto = {
  plans: ProcurementPlanDto[];
  records: ProcurementPlanLineDto[];
  summary: ProcurementPlanningSummaryDto;
  totalPlans: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type MarketplaceTenderRow = {
  id: string;
  title: string;
  organization: string;
  ownerOrganization: string;
  type: string;
  category: string;
  description: string;
  location: string;
  budget: number;
  status: string;
  visibility: string;
  reference: string;
  publishedAt: string;
  closingDate: string;
  createdByCurrentUser: boolean;
  ownedByCurrentOrganization: boolean;
  canBid: boolean;
  hasDraftBid: boolean;
  hasSubmittedBid: boolean;
  isSaved: boolean;
};

export type MyTenderRow = {
  id: string;
  title: string;
  section: 'draft' | 'posted' | 'completed';
  status: string;
  type: string;
  tender: MarketplaceTenderRow;
  lastActivity: string;
  actionLabel: string;
  nav: string;
};

export type MyBidRow = {
  id: string;
  tenderId: string;
  title: string;
  section: 'draft' | 'submitted';
  status: string;
  tender: MarketplaceTenderRow;
  amount?: string;
  receiptHash?: string;
  lastActivity: string;
  actionLabel: string;
  nav: string;
};

export const marketplaceSortValues = ['deadline', 'newest', 'budget-desc', 'budget-asc'] as const;
export const marketplaceBudgetBandValues = ['under-hundred-million', 'hundred-million-plus', 'billion-plus'] as const;
export const marketplaceVisibilityFilterValues = ['PUBLIC_MARKETPLACE', 'INVITED', 'PRIVATE'] as const;

export type MarketplaceSort = (typeof marketplaceSortValues)[number];
export type MarketplaceBudgetBand = (typeof marketplaceBudgetBandValues)[number];
export type MarketplaceVisibilityFilter = (typeof marketplaceVisibilityFilterValues)[number];

export type MarketplaceQuery = {
  search: string;
  category: string;
  type: string;
  budgetBand: '' | MarketplaceBudgetBand;
  status: string;
  includeClosed: boolean;
  visibility: '' | MarketplaceVisibilityFilter;
  sort: MarketplaceSort;
  page: number;
  limit: number;
};

export type TenderReviewQuery = {
  search: string;
  page: number;
  pageSize: number;
};

export type CreateTenderInput = {
  title: string;
  type: TenderType;
  description: string;
  budget?: number;
  currency: string;
  location: string;
  closingDate?: string;
  categories: string[];
  requirements: Record<string, unknown>;
  metadata: Record<string, unknown>;
  reference?: string;
};

export type UpdateTenderInput = {
  title?: string;
  type?: TenderType;
  description?: string;
  budget?: number;
  currency?: string;
  location?: string;
  closingDate?: string;
  categories?: string[];
  requirements?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
};

export type CreateTenderResponseDto = {
  success: true;
  message: 'Tender draft created successfully' | 'Tender draft saved successfully';
  data: {
    id: string;
    reference: string;
    title: string;
    status: string;
    type: string;
    createdAt: string;
  };
  validation?: TenderDraftValidationDto;
};

export type UpdateTenderResponseDto = {
  success: true;
  message: 'Tender updated successfully' | 'Tender draft saved successfully';
  data: {
    id: string;
    reference: string;
    title: string;
    status: string;
    updatedAt: string;
  };
  validation?: TenderDraftValidationDto;
};

export type PublishTenderResponseDto = {
  success: true;
  message: string;
  data: {
    id: string;
    reference: string;
    title: string;
    status: string;
    visibility: string;
    publishedAt: string;
    closingDate: string;
  };
  validation: {
    warnings: string[];
    scannerIssues: TenderLanguageScanIssueDto[];
    standardizedCategories: string[];
  };
  languageScan?: TenderLanguageScanDto;
};

export type TenderReviewQueueItemDto = {
  id: string;
  reference: string;
  title: string;
  buyerOrgId: string;
  buyerName: string;
  ownerUserId: string | null;
  ownerName: string | null;
  type: string;
  status: string;
  method: string;
  visibility: string;
  budget: number;
  currency: string;
  location: string;
  closingDate: string;
  categories: string[];
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type TenderReviewListDto = {
  success: true;
  items: TenderReviewQueueItemDto[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  generatedAt: string;
};

export type TenderReviewDetailDto = TenderDetailDto & {
  buyerName: string;
  ownerName: string | null;
  submittedAt: string;
  reviewAttempts: number;
};

export type TenderReviewFailInput = {
  messageId: string;
};

export type TenderReviewDecisionResponseDto = {
  success: true;
  message: string;
  data: {
    tenderId: string;
    reference: string;
    title: string;
    status: string;
    visibility: string;
    publishedAt: string;
    communicationMessageId: string | null;
    marketplaceRoute?: string;
    amendmentRoute?: string;
  };
};

export type PublishValidationIssueDto = {
  step: string;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
};

export type PublishValidationFailureDto = {
  success: false;
  message: 'Tender cannot be published';
  errors: PublishValidationIssueDto[];
};

export type CloseTenderResponseDto = {
  success: true;
  message: 'Tender closed successfully';
  data: {
    id: string;
    reference: string;
    title: string;
    status: string;
    closingDate: string;
    updatedAt: string;
  };
};

export type SaveTenderResponseDto = {
  success: true;
  message: 'Tender saved successfully';
};

export type UnsaveTenderResponseDto = {
  success: true;
  message: 'Tender removed from saved tenders';
};

export type SavedTendersPayload = {
  tenders: MarketplaceTenderRow[];
};

export type ProcurementMarketplaceSummary = {
  openTenders: number;
  myTenders: number;
  myBids: number;
  totalBudgetValue: number;
  categoryCounts: PlanningBreakdownDto[];
  closingSoon: number;
};

export type MarketplacePaginationDto = {
  page: number;
  limit: number;
  matching: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type ProcurementMarketplacePayload = {
  tenders: MarketplaceTenderRow[];
  myTenders: MyTenderRow[];
  myBids: MyBidRow[];
  summary: ProcurementMarketplaceSummary;
  pagination: MarketplacePaginationDto;
};

export type TenderDetailDto = {
  id: string;
  title: string;
  reference: string;
  buyerOrgId: string;
  ownerUserId: string | null;
  organization: string;
  ownerOrganization: string;
  type: string;
  category: string;
  description: string;
  location: string;
  budget: number;
  currency: string;
  status: string;
  method: string;
  contractType: string | null;
  visibility: string;
  publishedAt: string;
  closingDate: string;
  requirements: Record<string, unknown>;
  metadata: Record<string, unknown>;
  requirementRows: Array<{ id: string; section: string; payload: Record<string, unknown> }>;
  milestones: Array<{ id: string; name: string; dueDate: string | null; payload: Record<string, unknown> }>;
  commercialItems: Array<{
    id: string;
    itemNo: string | null;
    description: string;
    quantity: number;
    unit: string | null;
    rate: number;
    total: number;
    payload: Record<string, unknown>;
  }>;
  documents: Array<{ id: string; name: string; documentType: string; label: string | null; openUrl: string; downloadUrl: string }>;
  createdByCurrentUser: boolean;
  ownedByCurrentOrganization: boolean;
  canBid: boolean;
  hasDraftBid: boolean;
  hasSubmittedBid: boolean;
  bidSummary: {
    total: number;
    draft: number;
    submitted: number;
    withdrawn: number;
  };
  submittedBidBusinesses: Array<{
    id: string;
    name: string;
    submittedAt: string | null;
  }>;
  currentBid: {
    id: string;
    reference: string;
    status: string;
    submittedAt: string | null;
    receiptHash: string | null;
  } | null;
  activity: {
    marketplaceViews: number;
    documentDownloads: number;
    clarifications: number;
  };
  amendmentSummary: {
    total: number;
    published: number;
    draft: number;
  };
};

export type TenderDocumentDownloadResponseDto = {
  success: true;
  message: 'Document download recorded';
};

export type TenderDocumentStreamDto = {
  id: string;
  name: string;
  documentType: string;
  objectKey: string;
  disposition: 'inline' | 'attachment';
};

export type TenderAmendmentInput = {
  title: string;
  summary?: string;
  payload: Record<string, unknown>;
};

export type TenderAmendmentPatchInput = {
  title?: string;
  summary?: string;
  payload?: Record<string, unknown>;
};

export type TenderAmendmentDto = {
  id: string;
  tenderId: string;
  reference: string;
  title: string;
  summary: string;
  status: string;
  payload: Record<string, unknown>;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TenderAmendmentsResponseDto = {
  success: true;
  data: TenderAmendmentDto[];
};

export type TenderAmendmentResponseDto = {
  success: true;
  message: string;
  data: TenderAmendmentDto;
};

export type OpenEvaluationResponseDto = {
  success: true;
  nav: string;
  data: {
    tenderId: string;
    availability: {
      isReady: boolean;
      reason: string | null;
    };
  };
};
