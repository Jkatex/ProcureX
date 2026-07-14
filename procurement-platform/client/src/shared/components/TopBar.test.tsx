import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { vi } from 'vitest';
import { store } from '@/app/store';
import { assumeUser, signOut } from '@/features/auth/slice';
import { accountApi } from '@/features/account/api';
import { authApi } from '@/features/auth/api';
import { communicationApi } from '@/features/communication/api';
import i18n from '@/i18n';
import { TopBar } from './TopBar';
import { demoUsers } from '@/shared/data/fixtures';
import type { SessionUser } from '@/shared/types/domain';

vi.mock('@/features/account/api', () => ({
  accountApi: {
    recordActivity: vi.fn().mockResolvedValue({ ok: true }),
    updatePreferences: vi.fn().mockResolvedValue({ preferredLanguage: 'sw', timezone: 'Africa/Dar_es_Salaam' })
  }
}));

vi.mock('@/features/auth/api', () => ({
  authApi: {
    signOut: vi.fn().mockResolvedValue({ ok: true }),
    getSession: vi.fn().mockResolvedValue({
      user: {
        id: 'user-1',
        displayName: 'Demo Verified User',
        email: 'demo@procurex.test',
        accountType: 'USER',
        organization: 'Company account tools',
        capabilities: ['BUYER'],
        verificationStatus: 'APPROVED',
        preferences: { preferredLanguage: 'sw', timezone: 'Africa/Dar_es_Salaam' }
      },
      expiresAt: new Date(Date.now() + 3600_000).toISOString()
    })
  }
}));

vi.mock('@/features/communication/api', () => ({
  communicationApi: {
    listMailbox: vi.fn().mockResolvedValue({
      messages: [],
      counts: { total: 3, inbox: 3, sent: 0, drafts: 0, archived: 0, unread: 3, actionRequired: 0 },
      totalMessages: 3,
      page: 1,
      pageSize: 1,
      totalPages: 3
    })
  }
}));

const recordActivity = vi.mocked(accountApi.recordActivity);
const updatePreferences = vi.mocked(accountApi.updatePreferences);
const authSignOut = vi.mocked(authApi.signOut);
const listMailbox = vi.mocked(communicationApi.listMailbox);

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderTopBar(userOverride?: SessionUser) {
  store.dispatch(signOut());
  store.dispatch(
    assumeUser(
      userOverride ?? {
        id: 'user-1',
        displayName: 'Demo Verified User',
        email: 'demo@procurex.test',
        accountType: 'USER',
        organization: 'Company account tools',
        organizationId: 'org-1',
        capabilities: ['BUYER'],
        verificationStatus: 'APPROVED',
        preferences: { preferredLanguage: 'en', timezone: 'Africa/Dar_es_Salaam' }
      }
    )
  );

  return render(
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <MemoryRouter initialEntries={['/dashboard']}>
          <TopBar />
          <button type="button">Outside target</button>
          <LocationProbe />
        </MemoryRouter>
      </I18nextProvider>
    </Provider>
  );
}

function openAppsDrawer() {
  const appsButton = screen.getByRole('button', { name: 'Open apps' });
  fireEvent.click(appsButton);
  return appsButton;
}

describe('TopBar platform apps drawer', () => {
  afterEach(async () => {
    act(() => {
      store.dispatch(signOut());
    });
    window.localStorage.clear();
    await i18n.changeLanguage('en');
    recordActivity.mockClear();
    updatePreferences.mockClear();
    authSignOut.mockClear();
    listMailbox.mockClear();
  });

  it('opens the platform apps drawer from the 9-dot button', () => {
    renderTopBar();

    const appsButton = openAppsDrawer();
    const drawer = screen.getByText('ProcureX Apps').closest<HTMLElement>('[data-app-menu]');

    expect(appsButton).toHaveAttribute('aria-expanded', 'true');
    expect(drawer).toHaveClass('open');
    expect(drawer).not.toBeNull();
    expect(within(drawer!).getByText('Registration and Verification')).toBeInTheDocument();
    expect(within(drawer!).getByText('Procurement Planning')).toBeInTheDocument();
    expect(within(drawer!).getByText('Procurement')).toBeInTheDocument();
    expect(within(drawer!).getByText('Communication Center')).toBeInTheDocument();
    expect(within(drawer!).getByText('Evaluation')).toBeInTheDocument();
    expect(within(drawer!).getByText('Awarding and Contract')).toBeInTheDocument();
    expect(within(drawer!).getByText('Records and History')).toBeInTheDocument();
  });

  it('navigates to the selected app and closes the drawer', () => {
    renderTopBar();

    const appsButton = openAppsDrawer();
    fireEvent.click(screen.getByRole('button', { name: /Communication Center Messages, clarifications, alerts/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/communication');
    expect(appsButton).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('ProcureX Apps').closest('[data-app-menu]')).not.toHaveClass('open');
  });

  it('closes the platform apps drawer from outside click and Escape', () => {
    renderTopBar();

    const appsButton = openAppsDrawer();
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside target' }));
    expect(appsButton).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(appsButton);
    expect(appsButton).toHaveAttribute('aria-expanded', 'true');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(appsButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('sends admin app launcher and nav links to admin pages only', () => {
    renderTopBar({ ...demoUsers.admin, organizationId: 'org-admin' });

    expect(screen.getByRole('link', { name: /Command Center/i })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('link', { name: /Deep Search/i })).toHaveAttribute('href', '/admin/search');
    expect(screen.getByRole('link', { name: /Communication/i })).toHaveAttribute('href', '/admin/communication');
    expect(screen.queryByRole('link', { name: /Marketplace/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open apps' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/admin');
    expect(screen.queryByText('ProcureX Apps')).not.toBeInTheDocument();
  });

  it('opens account menu and records profile navigation', async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    expect(await screen.findByText('Demo Verified User')).toBeInTheDocument();
    await waitFor(() => expect(listMailbox).toHaveBeenCalledWith({ organizationId: 'org-1', folder: 'unread', page: 1, pageSize: 1 }));

    await user.click(screen.getByText('Profile'));

    expect(recordActivity).toHaveBeenCalledWith('identity.profile.opened');
    expect(screen.getByTestId('location')).toHaveTextContent('/identity/profile');
  });

  it('opens Help Centre from the account menu', async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    await user.click(await screen.findByText('Help'));

    expect(recordActivity).toHaveBeenCalledWith('support.help.opened');
    expect(screen.getByTestId('location')).toHaveTextContent('/help');
  });

  it('opens admin account menu links on admin pages', async () => {
    const user = userEvent.setup();
    renderTopBar({ ...demoUsers.admin, organizationId: 'org-admin' });

    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    await waitFor(() => expect(listMailbox).toHaveBeenCalledWith({ organizationId: 'org-admin', folder: 'unread', page: 1, pageSize: 1 }));

    await user.click(await screen.findByText('Profile'));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/profile');

    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    await user.click(await screen.findByText('Messages'));
    expect(screen.getByTestId('location')).toHaveTextContent('/admin/communication');
  });

  it('persists language changes from the account menu', async () => {
    renderTopBar();

    fireEvent.click(screen.getByRole('button', { name: 'Open account menu' }));
    fireEvent.change(await screen.findByTestId('account-language-select'), { target: { value: 'sw' } });

    await waitFor(() => expect(updatePreferences).toHaveBeenCalledWith({ preferredLanguage: 'sw' }));
    expect(window.localStorage.getItem('procurex.language')).toBe('sw');
  });

  it('logs out through the server sign-out endpoint', async () => {
    const user = userEvent.setup();
    renderTopBar();

    await user.click(screen.getByRole('button', { name: 'Open account menu' }));
    await user.click(await screen.findByText('Logout'));

    await waitFor(() => expect(authSignOut).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/sign-in'));
  });
});
