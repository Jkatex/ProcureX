/* Defines workspace TypeScript contracts that keep API payloads, state, and UI props aligned. */
import type { WorkItem } from '@/shared/types/domain';

export type WorkspaceItem = WorkItem;

export type DashboardPriority = 'Low' | 'Normal' | 'High' | 'Urgent';

export type WorkspaceDashboardSummary = {
  urgentCount: number;
  workflowCount: number;
  unreadMessages: number;
  myTenders: number;
  myBids: number;
  recordedValue: number;
  currency: string;
  complianceStatus: 'Clear' | 'Attention needed';
};

export type WorkspaceDashboardPipelineStage = {
  stage: string;
  count: number;
  route: string;
};

export type WorkspaceDashboardMetric = {
  label: string;
  value: string;
  note: string;
};

export type WorkspaceDashboardExecutive = {
  transactionValue: number;
  completedOrders: number;
  activeOrders: number;
  orderSuccessRate: number;
  transactionGrowthRate: number;
  averageOrderValue: number;
  currency: string;
};

export type WorkspaceDashboardAction = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  route: string;
  priority: DashboardPriority;
  createdAt: string;
};

export type WorkspaceDashboardDeadline = {
  id: string;
  title: string;
  date: string;
  kind: string;
  route: string;
};

export type WorkspaceDashboardActiveWork = {
  id: string;
  type: string;
  title: string;
  status: string;
  nextAction: string;
  deadline: string | null;
  route: string;
  priority: DashboardPriority;
};

export type WorkspaceDashboardData = {
  summary: WorkspaceDashboardSummary;
  executive?: WorkspaceDashboardExecutive;
  pipeline: WorkspaceDashboardPipelineStage[];
  metrics: WorkspaceDashboardMetric[];
  actionQueue: WorkspaceDashboardAction[];
  deadlines: WorkspaceDashboardDeadline[];
  activeWork: WorkspaceDashboardActiveWork[];
  generatedAt: string;
};
