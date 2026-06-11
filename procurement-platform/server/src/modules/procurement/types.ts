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
