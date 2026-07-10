import type { AdminActionType, AuditSeverity, ComplianceCaseStatus } from '@prisma/client';

export const moduleDefinition = {
  key: 'compliance-admin',
  name: 'Compliance Admin',
  description: 'Platform admin search, compliance review, audit events, risk signals, and admin actions.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type AdminAppDto = {
  key: string;
  title: string;
  description: string;
  route: string;
  group: 'primary' | 'secondary';
  backend: {
    module: string;
    endpoint: string;
    status: 'live';
  };
  generatedAt: string;
};

export type AdminAppsDto = {
  items: AdminAppDto[];
  generatedAt: string;
};

export const adminAppDefinitions = [
  {
    key: 'command-center',
    title: 'Command Center',
    description: 'Platform-wide oversight for compliance, risk, admin actions, and procurement activity.',
    route: '/admin',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/dashboard', status: 'live' }
  },
  {
    key: 'deep-search',
    title: 'Deep Search',
    description: 'Search users, organizations, procurement records, documents, audit events, and archives.',
    route: '/admin/search',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/search', status: 'live' }
  },
  {
    key: 'user-management',
    title: 'User Management',
    description: 'Review verification queues, inspect user registry data, and record account actions.',
    route: '/admin/users',
    group: 'primary',
    backend: { module: 'compliance-admin + identity', endpoint: '/api/compliance-admin/users + /api/identity/admin/verifications', status: 'live' }
  },
  {
    key: 'compliance-rules',
    title: 'Compliance Rules',
    description: 'Manage compliance cases, rules, method limits, checklists, standstill settings, and alerts.',
    route: '/admin/compliance',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/compliance/cases + /api/compliance-admin/compliance/rules', status: 'live' }
  },
  {
    key: 'platform-analytics',
    title: 'Platform Analytics',
    description: 'View aggregate activity, workflow, procurement value, compliance, and risk metrics.',
    route: '/admin/analytics',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/analytics', status: 'live' }
  },
  {
    key: 'full-audit-trail',
    title: 'Full Audit Trail',
    description: 'Trace system events, admin actions, authentication, verification, and compliance evidence.',
    route: '/admin/audit',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/audit/events', status: 'live' }
  },
  {
    key: 'data-store',
    title: 'Data Store',
    description: 'Manage global and user-scoped JSON namespaces, keys, and configuration values.',
    route: '/admin/datastore',
    group: 'primary',
    backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/datastore', status: 'live' }
  },
  {
    key: 'tender-review',
    title: 'Tender Review',
    description: 'Review newly submitted tenders before marketplace publication.',
    route: '/admin/tender-review',
    group: 'primary',
    backend: { module: 'procurement', endpoint: '/api/procurement/admin/tender-review', status: 'live' }
  },
  {
    key: 'communication-center',
    title: 'Communication Center',
    description: 'Messages, clarifications, alerts, and admin-visible communication activity.',
    route: '/admin/communication',
    group: 'secondary',
    backend: { module: 'communication', endpoint: '/api/communication', status: 'live' }
  },
  {
    key: 'admin-profile',
    title: 'Admin Profile',
    description: 'Admin identity profile, preferences, verification context, and account controls.',
    route: '/admin/profile',
    group: 'secondary',
    backend: { module: 'identity', endpoint: '/api/identity/me + /api/identity/profile', status: 'live' }
  }
] as const satisfies ReadonlyArray<Omit<AdminAppDto, 'generatedAt'>>;

export type PaginationQuery = {
  page: number;
  pageSize: number;
};

export type SearchQuery = PaginationQuery & {
  q: string;
  type?: string;
  status?: string;
  stage?: string;
  from?: Date;
  to?: Date;
  minAmount?: number;
  maxAmount?: number;
  flaggedOnly?: boolean;
};

export type UserListQuery = PaginationQuery & {
  q?: string;
  verificationStatus?: string;
  accountType?: string;
  role?: string;
};

export type CaseListQuery = PaginationQuery & {
  status?: ComplianceCaseStatus;
  severity?: AuditSeverity;
};

export type RuleListQuery = PaginationQuery & {
  status?: string;
  severity?: AuditSeverity;
};

export type AuditListQuery = PaginationQuery & {
  severity?: AuditSeverity;
  entityType?: string;
  eventType?: string;
  actorRole?: string;
  from?: Date;
  to?: Date;
  q?: string;
};

export type AnalyticsQuery = {
  from?: Date;
  to?: Date;
};

export type DataStoreScope = 'GLOBAL' | 'USER';

export type DataStoreNamespaceQuery = {
  scope?: DataStoreScope;
  q?: string;
};

export type DataStoreEntryQuery = PaginationQuery & {
  scope?: DataStoreScope;
  namespace?: string;
  ownerUserId?: string;
  q?: string;
};

export type DataStoreEntryDto = {
  id: string;
  scope: DataStoreScope;
  ownerUser: { id: string; displayName: string; email: string } | null;
  namespace: string;
  key: string;
  value: unknown;
  encrypted: boolean;
  createdByUser: { id: string; displayName: string; email: string } | null;
  updatedByUser: { id: string; displayName: string; email: string } | null;
  deletedByUser?: { id: string; displayName: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  availableActions?: string[];
};

export type DataStoreEntryVersionDto = {
  id: string;
  entryId: string;
  action: string;
  previousValue: unknown;
  nextValue: unknown;
  actorUser: { id: string; displayName: string; email: string } | null;
  createdAt: string;
};

export type DataStoreNamespaceDto = {
  namespace: string;
  scope: DataStoreScope;
  total: number;
  updatedAt: string | null;
};

export type DataStoreEntryCreateInput = {
  scope: DataStoreScope;
  ownerUserId?: string | null;
  namespace: string;
  key: string;
  value: unknown;
  encrypted?: boolean;
};

export type DataStoreEntryUpdateInput = {
  namespace?: string;
  key?: string;
  value?: unknown;
  encrypted?: boolean;
};

export type DataStoreDeleteInput = {
  confirm: string;
  note?: string;
};

export type AdminNoteInput = {
  note?: string;
};

export type AdminUserInviteInput = {
  email: string;
  displayName: string;
  accountType?: string;
  note?: string;
};

export type AdminUserActionInput = AdminNoteInput & {
  revokeSessions?: boolean;
};

export type AdminProfilePreferencesInput = {
  preferredLanguage?: string;
  timezone?: string;
  metadata?: Record<string, unknown>;
  note?: string;
};

export type PageDto<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type AdminUserDto = {
  id: string;
  email: string;
  phone: string | null;
  displayName: string;
  accountType: string;
  verificationStatus: string;
  role: string;
  membershipStatus: string | null;
  organization: { id: string; name: string; capabilities: string[] } | null;
  trustTier: string;
  riskLevel: string;
  screeningStatus: string;
  permissions: string[];
  documents: string[];
  timeline: Array<{ label: string; at: string; detail: string }>;
  availableActions: string[];
  lastSessionAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminMetricDto = {
  label: string;
  value: number;
  detail: string;
};

export type AdminActionQueueDto = {
  id: string;
  title: string;
  severity: string;
  status: string;
  owner: string;
  ownerOrgId: string | null;
  entityType: string;
  entityRef: string;
  summary: string;
  createdAt: string;
};

export type AdminActivityBucketDto = {
  label: string;
  count: number;
};

export type AdminEvaluationOversightDto = {
  id: string;
  tenderTitle: string;
  reference: string;
  buyer: string;
  status: string;
  stage: string | null;
  progress: number;
  updatedAt: string;
};

export type AdminExceptionDto = {
  id: string;
  title: string;
  severity: string;
  status: string;
  owner: string;
  summary: string;
  createdAt: string;
};

export type AdminChecklistPreviewDto = {
  id: string;
  code: string;
  title: string;
  status: string;
  severity: string;
};

export type DashboardDto = {
  counts: Record<string, number>;
  metrics: AdminMetricDto[];
  riskSummary: Record<string, number>;
  adminActionQueue: AdminActionQueueDto[];
  weeklyComplianceActions: AdminActivityBucketDto[];
  evaluationOversight: AdminEvaluationOversightDto[];
  exceptionLog: AdminExceptionDto[];
  checklistPreview: AdminChecklistPreviewDto[];
  openComplianceItems: ComplianceCaseDto[];
  recentActions: AdminActionDto[];
  generatedAt: string;
};

export type SearchResultDto = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  status?: string;
  stage?: string | null;
  party?: string | null;
  amount?: string | null;
  summary?: string | null;
  routeHint?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ComplianceCaseDto = {
  id: string;
  title: string;
  severity: string;
  status: string;
  owner: string | null;
  ownerOrg: { id: string; name: string } | null;
  payload: Record<string, unknown>;
  availableActions: string[];
  createdAt: string;
};

export type ComplianceRuleDto = {
  id: string;
  ownerOrgId: string | null;
  code: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  condition: Record<string, unknown>;
  payload: Record<string, unknown>;
  createdByUserId: string | null;
  availableActions: string[];
  createdAt: string;
  updatedAt: string;
};

export type AuditEventDto = {
  id: string;
  event: string;
  entityType: string;
  entityRef: string | null;
  severity: string;
  ownerOrg: { id: string; name: string } | null;
  actorUser: { id: string; displayName: string; email: string } | null;
  actorRole: string;
  summary: string;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type AdminActionDto = {
  id: string;
  actionType: string;
  entityType: string;
  entityRef: string | null;
  summary: string | null;
  payload?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  nextState?: Record<string, unknown>;
  reversible?: boolean;
  revertedAt?: string | null;
  reverseActionId?: string | null;
  ownerOrg: { id: string; name: string } | null;
  actorUser: { id: string; displayName: string; email: string } | null;
  createdAt: string;
};

export type AnalyticsDto = {
  totals: Record<string, number>;
  range: { from: string | null; to: string | null };
  procurementValue: number;
  tendersPublished: number;
  avgEvaluationDurationDays: number;
  avgAwardCycleDays: number;
  usersByVerificationStatus: Array<{ status: string; count: number }>;
  tendersByStatus: Array<{ status: string; count: number }>;
  bidsByStatus: Array<{ status: string; count: number }>;
  complianceByStatus: Array<{ status: string; count: number }>;
  auditBySeverity: Array<{ severity: string; count: number }>;
  procurementByCategory: Array<{ category: string; count: number; value: number }>;
  tenderStatusMix: Array<{ status: string; count: number }>;
  procurementTypeBreakdown: Array<{ type: string; tenders: number; totalValue: number; avgBidsPerTender: number; avgDaysToAward: number }>;
  topBuyers: Array<{ organization: string; tenders: number; value: number }>;
  topSuppliers: Array<{ organization: string; bids: number; value: number }>;
  complianceTrend: Array<{ label: string; rate: number; total: number; resolved: number }>;
  generatedAt: string;
};

export type CaseUpdateInput = {
  status?: ComplianceCaseStatus;
  severity?: AuditSeverity;
  owner?: string | null;
  payload?: Record<string, unknown>;
};

export type RuleCreateInput = {
  ownerOrgId?: string | null;
  code: string;
  title: string;
  description?: string | null;
  severity: AuditSeverity;
  status?: string;
  condition: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

export type RuleUpdateInput = Partial<Omit<RuleCreateInput, 'code'>> & {
  code?: string;
};

export type AdminActionInput = {
  ownerOrgId?: string | null;
  actionType: AdminActionType;
  entityType: string;
  entityRef?: string | null;
  summary?: string;
  payload?: Record<string, unknown>;
  previousState?: Record<string, unknown>;
  nextState?: Record<string, unknown>;
  reversible?: boolean;
};
