export type ProcurementPlanningColumnType = 'text' | 'select' | 'date' | 'number';

export type ProcurementPlanningColumn = {
  id: string;
  label: string;
  type: ProcurementPlanningColumnType;
  options?: string[];
  custom?: boolean;
};

export type ProcurementPlanningRecord = {
  id: string;
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
  customValues?: Record<string, string>;
};

export type ProcurementPlanningStatusTone = 'info' | 'success' | 'warning';

export type ProcurementPlanningStatus = {
  value: string;
  label: string;
  description: string;
  page: string;
  tone: ProcurementPlanningStatusTone;
};

export type PlanningRouteView = 'front' | 'create' | 'full' | 'detail';

export type PlanningEditorRow = {
  id: string;
  values: Record<string, string>;
};

export type ProcurementPlanningSummary = {
  financialYear: string | null;
  years: string[];
  totalPlans: number;
  totalLines: number;
  totalBudget: number;
  byStatus: Array<{ label: string; value: number; amount?: number }>;
  byCategory: Array<{ label: string; value: number; amount?: number }>;
};

export type ProcurementPlan = {
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
  lines: ProcurementPlanningRecord[];
};

export type ProcurementPlanningListResponse = {
  plans: ProcurementPlan[];
  records: ProcurementPlanningRecord[];
  summary: ProcurementPlanningSummary;
  totalPlans: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type ProcurementPlanningQuery = Partial<{
  organizationId: string;
  financialYear: string;
  search: string;
  status: string;
  category: string;
  page: number;
  pageSize: number;
  sortBy: 'date' | 'title' | 'budget' | 'status' | 'category';
  sortDirection: 'asc' | 'desc';
}>;

export type SaveAnnualProcurementPlanInput = {
  ownerOrgId?: string;
  financialYear: string;
  name?: string;
  status?: string;
  source?: string;
  currency?: string;
  metadata?: Record<string, unknown>;
  lines: ProcurementPlanningRecord[];
};
