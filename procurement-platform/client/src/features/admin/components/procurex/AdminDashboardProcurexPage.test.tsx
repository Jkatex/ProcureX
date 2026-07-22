/* Exercises admin behavior so regressions are caught close to the domain workflow they protect. */
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { adminApi, type AdminDashboard } from '@/features/admin/api';
import { assumeUser, signOut } from '@/features/auth/slice';
import { procurexTheme } from '@/styles/mui-theme';
import { AdminDashboardProcurexPage } from './AdminDashboardProcurexPage';

vi.mock('@/features/admin/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/api')>('@/features/admin/api');
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      apps: vi.fn(),
      dashboard: vi.fn(),
      recordAction: vi.fn(),
      undoAction: vi.fn()
    }
  };
});

const dashboard = vi.mocked(adminApi.dashboard);
const apps = vi.mocked(adminApi.apps);

const now = '2026-07-07T10:00:00.000Z';

const dashboardFixture: AdminDashboard = {
  counts: {
    users: 12,
    activeTenders: 4,
    pendingReviews: 2,
    flaggedIssues: 1,
    complianceRate: 92,
    evaluationDrafts: 3,
    auditEventsToday: 8,
    auditEvents: 40,
    tenders: 9,
    bids: 5,
    contracts: 2,
    rules: 6,
    openCases: 2
  },
  metrics: [
    { label: 'Active Tenders', value: 4, detail: 'Live tender records' },
    { label: 'Pending Compliance Reviews', value: 2, detail: 'Needs admin review' },
    { label: 'Flagged Issues', value: 1, detail: 'Open flags' },
    { label: 'Compliance Rate', value: 92, detail: 'Percent' }
  ],
  riskSummary: { HIGH: 1, MEDIUM: 2 },
  adminActionQueue: [
    {
      id: 'queue-1',
      title: 'Review supplier verification',
      severity: 'HIGH',
      status: 'PENDING',
      owner: 'Compliance Team',
      ownerOrgId: null,
      entityType: 'USER',
      entityRef: 'user-1',
      summary: 'Supplier profile requires admin verification.',
      createdAt: now
    }
  ],
  weeklyComplianceActions: [{ label: 'Reviews opened', count: 3 }],
  evaluationOversight: [
    { id: 'eval-1', tenderTitle: 'Medical supplies', reference: 'PX-2026-001', buyer: 'Ministry of Health', status: 'DRAFT', stage: 'TECHNICAL', progress: 45, updatedAt: now }
  ],
  exceptionLog: [
    { id: 'exception-1', title: 'Late evaluation update', severity: 'MEDIUM', status: 'OPEN', owner: 'Evaluation', summary: 'Draft has not moved in 3 days.', createdAt: now }
  ],
  checklistPreview: [
    { id: 'check-1', code: 'RULE-001', title: 'Tender threshold review', status: 'ACTIVE', severity: 'LOW' }
  ],
  openComplianceItems: [],
  recentActions: [
    {
      id: 'action-1',
      actionType: 'APPROVE',
      entityType: 'USER',
      entityRef: 'user-1',
      summary: 'Approved verification review.',
      ownerOrg: null,
      actorUser: null,
      createdAt: now
    }
  ],
  generatedAt: now
};

function renderDashboard() {
  store.dispatch(signOut());
  store.dispatch(
    assumeUser({
      id: 'admin-1',
      displayName: 'Platform Admin',
      email: 'admin@procurex.tz',
      phone: null,
      accountType: 'ADMIN',
      organization: 'ProcureX Administration',
      organizationId: 'platform',
      capabilities: ['BUYER'],
      permissions: ['admin.access'],
      verificationStatus: 'APPROVED',
      preferences: { preferredLanguage: 'en', timezone: 'Africa/Dar_es_Salaam' }
    })
  );

  return render(
    <Provider store={store}>
      <ThemeProvider theme={procurexTheme}>
        <MemoryRouter>
          <AdminDashboardProcurexPage />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
}

describe('AdminDashboardProcurexPage', () => {
  beforeEach(() => {
    dashboard.mockResolvedValue(dashboardFixture);
    apps.mockResolvedValue({
      generatedAt: now,
      items: [
        {
          key: 'command-center',
          title: 'Command Center',
          description: 'Platform oversight',
          route: '/admin',
          group: 'primary',
          backend: { module: 'compliance-admin', endpoint: '/api/compliance-admin/dashboard', status: 'live' },
          generatedAt: now
        }
      ]
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    store.dispatch(signOut());
  });

  it('renders a single admin intelligence dashboard without first-run sections', async () => {
    renderDashboard();

    expect(await screen.findByRole('heading', { name: 'Admin Command Center' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Platform Status Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Prioritized admin actions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'App health and shortcuts' })).toBeInTheDocument();
    expect(screen.getByText('Review supplier verification')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recommended first actions' })).not.toBeInTheDocument();
  });
});
