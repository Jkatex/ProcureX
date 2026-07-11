import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { adminApi, type AdminUser, type AdminVerification, type PageDto } from '@/features/admin/api';
import { assumeUser, signOut } from '@/features/auth/slice';
import { procurexTheme } from '@/styles/mui-theme';
import { AdminUsersProcurexPage } from './AdminUsersProcurexPage';

vi.mock('@/features/admin/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/api')>('@/features/admin/api');
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      apps: vi.fn(),
      listVerifications: vi.fn(),
      listUsers: vi.fn(),
      decideVerification: vi.fn(),
      rescreenVerification: vi.fn(),
      recordAction: vi.fn(),
      reinstateUser: vi.fn(),
      resetUserAccess: vi.fn(),
      revokeUserSessions: vi.fn(),
      inviteUser: vi.fn(),
      undoAction: vi.fn()
    }
  };
});

vi.mock('@/shared/components/AccountMenu', () => ({
  AccountMenu: () => <button type="button">Account menu</button>
}));

vi.mock('@/shared/components/procurex/PlatformAppsDrawer', () => ({
  PlatformAppsButton: ({ onClick }: { onClick: () => void }) => (
    <button type="button" aria-label="Open apps" onClick={onClick}>
      Open apps
    </button>
  ),
  PlatformAppIcon: () => <span aria-hidden="true" />
}));

const apps = vi.mocked(adminApi.apps);
const listVerifications = vi.mocked(adminApi.listVerifications);
const listUsers = vi.mocked(adminApi.listUsers);

const now = '2026-06-19T10:00:00.000Z';

function userFixture(overrides: Partial<AdminUser> = {}): AdminUser {
  return {
    id: 'user-1',
    email: 'josemwijage@example.com',
    phone: '+255716234751',
    displayName: 'Josemwijage',
    accountType: 'USER',
    verificationStatus: 'NOT_STARTED',
    role: 'USER',
    membershipStatus: null,
    organization: null,
    trustTier: 'NONE',
    riskLevel: 'LOW',
    screeningStatus: 'NOT_STARTED',
    permissions: [],
    documents: [],
    timeline: [{ label: 'ACCOUNT_CREATED', detail: 'USER', at: now }],
    availableActions: [],
    lastSessionAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

function userPage(items: AdminUser[]): PageDto<AdminUser> {
  return {
    items,
    page: 1,
    pageSize: 8,
    total: items.length
  };
}

const verificationFixture: AdminVerification = {
  id: 'verification-1',
  status: 'PENDING',
  registrySource: 'TIN',
  registryNumber: '123456789',
  payload: {
    registryRecord: {
      name: 'Josemwijage Co',
      source: 'TIN',
      registryNumber: '123456789'
    },
    entityType: 'company',
    signatureName: 'Jose Mwijage'
  },
  createdAt: now,
  updatedAt: now,
  user: {
    id: 'verification-user-1',
    displayName: 'Verification User',
    email: 'verify@example.com',
    phone: null,
    accountType: 'USER',
    organization: 'Verification Org',
    organizationId: 'org-1',
    capabilities: ['BUYER'],
    permissions: [],
    verificationStatus: 'PENDING'
  },
  reviewReasons: ['Registry mismatch'],
  screeningStatus: 'REVIEW',
  trustTier: 'BRONZE',
  riskLevel: 'MEDIUM'
};

function renderPage() {
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
          <AdminUsersProcurexPage />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
}

describe('AdminUsersProcurexPage account registry sidebar', () => {
  beforeEach(() => {
    apps.mockReturnValue(new Promise(() => {}));
    listVerifications.mockResolvedValue([verificationFixture]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('opens the selected registry user in a cancellable floating account sidebar', async () => {
    listUsers.mockResolvedValue(userPage([userFixture()]));

    renderPage();

    const row = (await screen.findByText('Josemwijage')).closest('tr');
    expect(row).not.toBeNull();
    expect(screen.queryByLabelText('Account registry detail')).not.toBeInTheDocument();

    await userEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: 'View' }));

    const sidebar = screen.getByLabelText('Account registry detail');
    expect(within(sidebar).getByText('Account registry detail')).toBeInTheDocument();
    expect(within(sidebar).getByRole('heading', { name: 'Josemwijage' })).toBeInTheDocument();
    expect(within(sidebar).getByText('Not Started')).toBeInTheDocument();
    expect(within(sidebar).getByText('+255716234751')).toBeInTheDocument();
    expect(within(sidebar).getByText('No membership')).toBeInTheDocument();
    expect(within(sidebar).getByText('No documents recorded')).toBeInTheDocument();
    expect(within(sidebar).getByText('Default permissions')).toBeInTheDocument();
    expect(within(sidebar).getByText('Account Created')).toBeInTheDocument();
    expect(within(sidebar).getByText(/USER \/ Jun 19, 2026|USER \/ 19 Jun 2026/)).toBeInTheDocument();

    await userEvent.click(within(sidebar).getByRole('button', { name: 'Close account detail' }));
    expect(screen.queryByLabelText('Account registry detail')).not.toBeInTheDocument();
  });

  it('updates the account sidebar when another registry user is selected', async () => {
    listUsers.mockResolvedValue(
      userPage([
        userFixture(),
        userFixture({
          id: 'user-2',
          displayName: 'Asha Buyer',
          email: 'asha@example.com',
          phone: '+255700000002',
          verificationStatus: 'APPROVED',
          membershipStatus: 'ACTIVE',
          documents: ['TIN certificate'],
          permissions: ['procurement.create'],
          timeline: [{ label: 'ACCOUNT_CREATED', detail: 'BUYER', at: '2026-07-01T10:00:00.000Z' }]
        })
      ])
    );

    renderPage();

    const row = (await screen.findByText('Asha Buyer')).closest('tr');
    expect(row).not.toBeNull();
    await userEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: 'View' }));

    const sidebar = screen.getByLabelText('Account registry detail');
    expect(within(sidebar).getByRole('heading', { name: 'Asha Buyer' })).toBeInTheDocument();
    expect(within(sidebar).getByText('+255700000002')).toBeInTheDocument();
    expect(within(sidebar).getByText('TIN certificate')).toBeInTheDocument();
    expect(within(sidebar).getByText('procurement.create')).toBeInTheDocument();
    expect(within(sidebar).queryByRole('heading', { name: 'Josemwijage' })).not.toBeInTheDocument();
  });

  it('keeps the floating account sidebar closed when the registry has no selected user', async () => {
    listUsers.mockResolvedValue(userPage([]));

    renderPage();

    expect(await screen.findByText('No platform users match the current registry search.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Account registry detail')).not.toBeInTheDocument();
  });

  it('does not duplicate verification review details inside the account registry sidebar', async () => {
    listUsers.mockResolvedValue(userPage([userFixture()]));

    renderPage();

    const row = (await screen.findByText('Josemwijage')).closest('tr');
    expect(row).not.toBeNull();
    await userEvent.click(within(row as HTMLTableRowElement).getByRole('button', { name: 'View' }));

    const sidebar = screen.getByLabelText('Account registry detail');
    expect(within(sidebar).getByRole('heading', { name: 'Josemwijage' })).toBeInTheDocument();
    expect(within(sidebar).queryByText('Source')).not.toBeInTheDocument();
    expect(within(sidebar).queryByText('Review reason')).not.toBeInTheDocument();
    expect(screen.getByText('Registry mismatch')).toBeInTheDocument();
  });
});
