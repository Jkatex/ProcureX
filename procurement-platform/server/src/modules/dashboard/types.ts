export const moduleDefinition = {
  key: 'dashboard',
  name: 'Dashboard',
  description: 'Workspace command-center metrics, action queues, deadlines, and active procurement work.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type DashboardQuery = {
  organizationId: string;
  deadlineWindowDays: number;
  itemLimit: number;
};

export type DashboardPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export type DashboardSummaryDto = {
  urgentCount: number;
  workflowCount: number;
  unreadMessages: number;
  myTenders: number;
  myBids: number;
  recordedValue: number;
  currency: string;
  complianceStatus: 'Clear' | 'Attention needed';
};

export type DashboardPipelineStageDto = {
  stage: string;
  count: number;
  route: string;
};

export type DashboardMetricDto = {
  label: string;
  value: string;
  note: string;
};

export type DashboardActionDto = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  route: string;
  priority: DashboardPriority;
  createdAt: string;
};

export type DashboardDeadlineDto = {
  id: string;
  title: string;
  date: string;
  kind: string;
  route: string;
};

export type DashboardActiveWorkDto = {
  id: string;
  type: string;
  title: string;
  status: string;
  nextAction: string;
  deadline: string | null;
  route: string;
  priority: DashboardPriority;
};

export type WorkspaceDashboardDto = {
  summary: DashboardSummaryDto;
  pipeline: DashboardPipelineStageDto[];
  metrics: DashboardMetricDto[];
  actionQueue: DashboardActionDto[];
  deadlines: DashboardDeadlineDto[];
  activeWork: DashboardActiveWorkDto[];
  generatedAt: string;
};
