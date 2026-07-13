import { apiClient } from '@/shared/api/http';
import type { VerificationProfile } from '@/features/identity/types';
import type { RiskLevel, ScreeningStatus, SessionUser, TrustTier } from '@/shared/types/domain';

export type AdminVerification = VerificationProfile & {
  user: SessionUser;
  reviewReasons: string[];
  screeningStatus: ScreeningStatus;
  trustTier: TrustTier;
  riskLevel: RiskLevel;
};

export type PageDto<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

export type AdminUser = {
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
  trustRisk?: SessionUser['trustRisk'];
  permissions: string[];
  documents: string[];
  timeline: Array<{ label: string; at: string; detail: string }>;
  availableActions: string[];
  lastSessionAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ComplianceCase = {
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

export type ComplianceRule = {
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

export type AdminAction = {
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

export type AuditEvent = {
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

export type AdminMetric = {
  label: string;
  value: number;
  detail: string;
};

export type AdminApp = {
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

export type AdminApps = {
  items: AdminApp[];
  generatedAt: string;
};

export type AdminActionQueueItem = {
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

export type AdminDashboard = {
  counts: Record<string, number>;
  metrics: AdminMetric[];
  riskSummary: Record<string, number>;
  adminActionQueue: AdminActionQueueItem[];
  weeklyComplianceActions: Array<{ label: string; count: number }>;
  evaluationOversight: Array<{ id: string; tenderTitle: string; reference: string; buyer: string; status: string; stage: string | null; progress: number; updatedAt: string }>;
  exceptionLog: Array<{ id: string; title: string; severity: string; status: string; owner: string; summary: string; createdAt: string }>;
  checklistPreview: Array<{ id: string; code: string; title: string; status: string; severity: string }>;
  openComplianceItems: ComplianceCase[];
  recentActions: AdminAction[];
  generatedAt: string;
};

export type SearchResult = {
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

export type AdminAnalytics = {
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

export type DataStoreScope = 'GLOBAL' | 'USER';

export type DataStoreEntry = {
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

export type DataStoreEntryVersion = {
  id: string;
  entryId: string;
  action: string;
  previousValue: unknown;
  nextValue: unknown;
  actorUser: { id: string; displayName: string; email: string } | null;
  createdAt: string;
};

export type DataStoreNamespace = {
  namespace: string;
  scope: DataStoreScope;
  total: number;
  updatedAt: string | null;
};

export type DataStoreParams = {
  scope?: DataStoreScope;
  namespace?: string;
  ownerUserId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type DataStoreEntryInput = {
  scope?: DataStoreScope;
  ownerUserId?: string | null;
  namespace: string;
  key: string;
  value: unknown;
  encrypted?: boolean;
};

export type AdminUserListParams = {
  q?: string;
  verificationStatus?: string;
  accountType?: string;
  role?: string;
  page?: number;
  pageSize?: number;
};

export type AdminSearchParams = {
  q?: string;
  type?: string;
  status?: string;
  stage?: string;
  from?: string;
  to?: string;
  minAmount?: number;
  maxAmount?: number;
  flaggedOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export type ComplianceCaseParams = {
  status?: string;
  severity?: string;
  page?: number;
  pageSize?: number;
};

export type AuditParams = {
  severity?: string;
  entityType?: string;
  eventType?: string;
  actorRole?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export type AnalyticsParams = {
  from?: string;
  to?: string;
};

export type ComplianceRuleInput = {
  ownerOrgId?: string | null;
  code: string;
  title: string;
  description?: string | null;
  severity?: string;
  status?: string;
  condition?: Record<string, unknown>;
  payload?: Record<string, unknown>;
};

export type WorkflowRecord = Record<string, unknown> & {
  id: string;
  status?: string;
  title?: string;
  summary?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type WorkflowListParams = {
  status?: string;
  supplierOrgId?: string;
  ownerOrgId?: string;
  tenderId?: string;
  contractId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
};

export const adminApi = {
  async apps() {
    const response = await apiClient.get<AdminApps>('/api/compliance-admin/apps');
    return response.data;
  },
  async dashboard() {
    const response = await apiClient.get<AdminDashboard>('/api/compliance-admin/dashboard');
    return response.data;
  },
  async listUsers(params?: AdminUserListParams) {
    const response = await apiClient.get<PageDto<AdminUser>>('/api/compliance-admin/users', { params });
    return response.data;
  },
  async suspendUser(id: string, input: { note?: string; revokeSessions?: boolean } = {}) {
    const response = await apiClient.post<AdminUser>(`/api/compliance-admin/users/${id}/suspend`, input);
    return response.data;
  },
  async reinstateUser(id: string, input: { note?: string } = {}) {
    const response = await apiClient.post<AdminUser>(`/api/compliance-admin/users/${id}/reinstate`, input);
    return response.data;
  },
  async resetUserAccess(id: string, input: { note?: string } = {}) {
    const response = await apiClient.post<AdminAction>(`/api/compliance-admin/users/${id}/reset-access`, input);
    return response.data;
  },
  async revokeUserSessions(id: string, input: { note?: string } = {}) {
    const response = await apiClient.post<AdminAction>(`/api/compliance-admin/users/${id}/revoke-sessions`, input);
    return response.data;
  },
  async inviteUser(input: { email: string; displayName: string; accountType?: 'USER' | 'ADMIN'; note?: string }) {
    const response = await apiClient.post<AdminUser>('/api/compliance-admin/users/invite', input);
    return response.data;
  },
  async search(params?: AdminSearchParams) {
    const response = await apiClient.get<PageDto<SearchResult>>('/api/compliance-admin/search', { params });
    return response.data;
  },
  async listComplianceCases(params?: ComplianceCaseParams) {
    const response = await apiClient.get<PageDto<ComplianceCase>>('/api/compliance-admin/compliance/cases', { params });
    return response.data;
  },
  async updateComplianceCase(id: string, input: Partial<Pick<ComplianceCase, 'status' | 'severity' | 'owner' | 'payload'>>) {
    const response = await apiClient.patch<ComplianceCase>(`/api/compliance-admin/compliance/cases/${id}`, input);
    return response.data;
  },
  async listComplianceRules(params?: Pick<ComplianceCaseParams, 'status' | 'severity' | 'page' | 'pageSize'>) {
    const response = await apiClient.get<PageDto<ComplianceRule>>('/api/compliance-admin/compliance/rules', { params });
    return response.data;
  },
  async createComplianceRule(input: ComplianceRuleInput) {
    const response = await apiClient.post<ComplianceRule>('/api/compliance-admin/compliance/rules', input);
    return response.data;
  },
  async updateComplianceRule(id: string, input: Partial<ComplianceRuleInput>) {
    const response = await apiClient.patch<ComplianceRule>(`/api/compliance-admin/compliance/rules/${id}`, input);
    return response.data;
  },
  async complianceReviews(params?: WorkflowListParams) {
    const response = await apiClient.get<PageDto<WorkflowRecord>>('/api/compliance-admin/compliance/reviews', { params });
    return response.data;
  },
  async createComplianceReview(input: Record<string, unknown>) {
    const response = await apiClient.post<WorkflowRecord>('/api/compliance-admin/compliance/reviews', input);
    return response.data;
  },
  async violationCases(params?: WorkflowListParams) {
    const response = await apiClient.get<PageDto<WorkflowRecord>>('/api/compliance-admin/compliance/violations', { params });
    return response.data;
  },
  async createViolationCase(input: Record<string, unknown>) {
    const response = await apiClient.post<WorkflowRecord>('/api/compliance-admin/compliance/violations', input);
    return response.data;
  },
  async createViolationEvidence(input: Record<string, unknown>) {
    const response = await apiClient.post<WorkflowRecord>('/api/compliance-admin/compliance/violation-evidence', input);
    return response.data;
  },
  async enforcementRecords(params?: WorkflowListParams) {
    const response = await apiClient.get<PageDto<WorkflowRecord>>('/api/compliance-admin/compliance/enforcements', { params });
    return response.data;
  },
  async createEnforcementRecord(input: Record<string, unknown>) {
    const response = await apiClient.post<WorkflowRecord>('/api/compliance-admin/compliance/enforcements', input);
    return response.data;
  },
  async appealRecords(params?: WorkflowListParams) {
    const response = await apiClient.get<PageDto<WorkflowRecord>>('/api/compliance-admin/compliance/appeals', { params });
    return response.data;
  },
  async createAppealRecord(input: Record<string, unknown>) {
    const response = await apiClient.post<WorkflowRecord>('/api/compliance-admin/compliance/appeals', input);
    return response.data;
  },
  async collusionAlerts(params?: WorkflowListParams) {
    const response = await apiClient.get<PageDto<WorkflowRecord>>('/api/compliance-admin/risk/collusion-alerts', { params });
    return response.data;
  },
  async createCollusionAlert(input: Record<string, unknown>) {
    const response = await apiClient.post<WorkflowRecord>('/api/compliance-admin/risk/collusion-alerts', input);
    return response.data;
  },
  async supplierRiskProfiles(params?: WorkflowListParams) {
    const response = await apiClient.get<PageDto<WorkflowRecord>>('/api/compliance-admin/risk/supplier-profiles', { params });
    return response.data;
  },
  async upsertSupplierRiskProfile(input: Record<string, unknown>) {
    const response = await apiClient.put<WorkflowRecord>('/api/compliance-admin/risk/supplier-profiles', input);
    return response.data;
  },
  async listAuditEvents(params?: AuditParams) {
    const response = await apiClient.get<PageDto<AuditEvent>>('/api/compliance-admin/audit/events', { params });
    return response.data;
  },
  async analytics(params?: AnalyticsParams) {
    const response = await apiClient.get<AdminAnalytics>('/api/compliance-admin/analytics', { params });
    return response.data;
  },
  async recordAction(input: { ownerOrgId?: string | null; actionType: string; entityType: string; entityRef?: string | null; summary?: string }) {
    const response = await apiClient.post<AdminAction>('/api/compliance-admin/actions', input);
    return response.data;
  },
  async undoAction(id: string, input: { note?: string } = {}) {
    const response = await apiClient.post<AdminAction>(`/api/compliance-admin/actions/${id}/undo`, input);
    return response.data;
  },
  async listDataStoreNamespaces(params?: Pick<DataStoreParams, 'scope' | 'q'>) {
    const response = await apiClient.get<{ items: DataStoreNamespace[]; generatedAt: string }>('/api/compliance-admin/datastore/namespaces', { params });
    return response.data;
  },
  async listDataStoreEntries(params?: DataStoreParams) {
    const response = await apiClient.get<PageDto<DataStoreEntry>>('/api/compliance-admin/datastore/entries', { params });
    return response.data;
  },
  async getDataStoreEntry(id: string) {
    const response = await apiClient.get<DataStoreEntry>(`/api/compliance-admin/datastore/entries/${id}`);
    return response.data;
  },
  async listDataStoreEntryVersions(id: string) {
    const response = await apiClient.get<{ items: DataStoreEntryVersion[]; generatedAt: string }>(`/api/compliance-admin/datastore/entries/${id}/versions`);
    return response.data;
  },
  async createDataStoreEntry(input: DataStoreEntryInput) {
    const response = await apiClient.post<DataStoreEntry>('/api/compliance-admin/datastore/entries', input);
    return response.data;
  },
  async updateDataStoreEntry(id: string, input: Partial<Omit<DataStoreEntryInput, 'scope' | 'ownerUserId'>>) {
    const response = await apiClient.patch<DataStoreEntry>(`/api/compliance-admin/datastore/entries/${id}`, input);
    return response.data;
  },
  async deleteDataStoreEntry(id: string) {
    const response = await apiClient.delete<DataStoreEntry>(`/api/compliance-admin/datastore/entries/${id}`, { data: { confirm: 'DELETE' } });
    return response.data;
  },
  async restoreDataStoreEntry(id: string, input: { note?: string } = {}) {
    const response = await apiClient.post<DataStoreEntry>(`/api/compliance-admin/datastore/entries/${id}/restore`, input);
    return response.data;
  },
  async restoreDataStoreVersion(id: string, input: { note?: string } = {}) {
    const response = await apiClient.post<DataStoreEntry>(`/api/compliance-admin/datastore/versions/${id}/restore`, input);
    return response.data;
  },
  async exportDataStoreEntries(params?: DataStoreParams) {
    const response = await apiClient.get<PageDto<DataStoreEntry>>('/api/compliance-admin/datastore/entries/export', { params });
    return response.data;
  },
  async updateProfilePreferences(input: { preferredLanguage?: string; timezone?: string; metadata?: Record<string, unknown>; note?: string }) {
    const response = await apiClient.patch<{ saved: true; action: AdminAction }>('/api/compliance-admin/profile/preferences', input);
    return response.data;
  },
  async updateCommunicationState(id: string, state: 'read' | 'unread' | 'archive' | 'unarchive' | 'delete' | 'restore', input: { note?: string } = {}) {
    const response = await apiClient.post<AdminAction>(`/api/compliance-admin/communication/messages/${id}/${state}`, input);
    return response.data;
  },
  async listVerifications(status?: SessionUser['verificationStatus']) {
    const response = await apiClient.get<AdminVerification[]>('/api/identity/admin/verifications', {
      params: status ? { status } : undefined
    });
    return response.data;
  },
  async decideVerification(id: string, input: { decision: 'approve' | 'reject'; note?: string }) {
    const response = await apiClient.post<AdminVerification>(`/api/identity/admin/verifications/${id}/decision`, input);
    return response.data;
  },
  async rescreenVerification(id: string) {
    const response = await apiClient.post<AdminVerification>(`/api/identity/admin/verifications/${id}/rescreen`);
    return response.data;
  }
};
