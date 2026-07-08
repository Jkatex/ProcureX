import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { assumeUser, signOut } from '@/features/auth/slice';
import { NotificationToastHost } from '@/features/notifications/NotificationToastHost';
import { clearNotifications } from '@/features/notifications/slice';
import { apiClient } from '@/shared/api/http';
import { CookieConsentBanner, HelpCenterProcurexPage, NotFoundProcurexPage, SignedInHelpDeskProcurexPage, SystemStatusProcurexPage } from './SupportPages';

vi.mock('@/shared/api/http', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn()
  }
}));

const apiGet = vi.mocked(apiClient.get);
const apiPost = vi.mocked(apiClient.post);

function renderWithRouter(element: ReactNode) {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        {element}
        <NotificationToastHost />
      </MemoryRouter>
    </Provider>
  );
}

describe('support pages', () => {
  beforeEach(() => {
    window.localStorage.clear();
    store.dispatch(signOut());
    store.dispatch(clearNotifications());
    apiGet.mockReset();
    apiPost.mockReset();
  });

  it('renders curated help content and support links', () => {
    renderWithRouter(<HelpCenterProcurexPage />);

    expect(screen.getByRole('heading', { name: 'Help for registration, verification, tenders, and bids.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute('href', '/status');
    expect(screen.getByText('How do I get verified on ProcureX?')).toBeInTheDocument();
  });

  it('creates a support ticket for signed-in users', async () => {
    const user = userEvent.setup();
    store.dispatch(
      assumeUser({
        id: 'user-1',
        displayName: 'Demo Verified User',
        email: 'demo@procurex.test',
        accountType: 'USER',
        organization: 'Demo Organization',
        organizationId: 'org-1',
        capabilities: ['BUYER'],
        verificationStatus: 'APPROVED'
      })
    );
    apiPost.mockResolvedValueOnce({
      data: {
        id: 'ticket-12345678',
        subject: 'Tender help',
        category: 'Technical',
        priority: 'NORMAL',
        status: 'OPEN',
        description: 'I need help with a tender workspace.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    renderWithRouter(<HelpCenterProcurexPage />);

    await user.type(screen.getByLabelText('Subject'), 'Tender help');
    await user.selectOptions(screen.getByLabelText('Category'), 'Technical');
    await user.type(screen.getByLabelText('Description'), 'I need help with a tender workspace.');
    await user.click(screen.getByRole('button', { name: 'Create support ticket' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/support/tickets', {
      subject: 'Tender help',
      category: 'Technical',
      priority: 'NORMAL',
      description: 'I need help with a tender workspace.'
    }));
    expect(await screen.findByText('Support ticket created')).toBeInTheDocument();
  });

  it('renders signed-in help desk support categories and quick links', () => {
    store.dispatch(
      assumeUser({
        id: 'user-1',
        displayName: 'Demo Verified User',
        email: 'demo@procurex.test',
        accountType: 'USER',
        organization: 'Demo Organization',
        organizationId: 'org-1',
        capabilities: ['BUYER'],
        verificationStatus: 'APPROVED'
      })
    );

    renderWithRouter(<SignedInHelpDeskProcurexPage />);

    expect(screen.getByRole('heading', { name: 'Help Desk', level: 1 })).toBeInTheDocument();
    expect(screen.getAllByText('Demo Organization').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Account access').length).toBeGreaterThan(0);
    expect(screen.getByText('Awarding and contract support')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Awarding and Contracts' })).toBeInTheDocument();
    expect(screen.getByLabelText('Category')).toHaveValue('General');
  });

  it('creates a support ticket from the signed-in help desk', async () => {
    const user = userEvent.setup();
    store.dispatch(
      assumeUser({
        id: 'user-1',
        displayName: 'Demo Verified User',
        email: 'demo@procurex.test',
        accountType: 'USER',
        organization: 'Demo Organization',
        organizationId: 'org-1',
        capabilities: ['BUYER'],
        verificationStatus: 'APPROVED'
      })
    );
    apiPost.mockResolvedValueOnce({
      data: {
        id: 'ticket-helpdesk-1',
        subject: 'Award notice problem',
        category: 'Awarding and contract',
        priority: 'HIGH',
        status: 'OPEN',
        description: 'The supplier response workspace does not open.',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    });

    renderWithRouter(<SignedInHelpDeskProcurexPage />);

    await user.type(screen.getByLabelText('Subject'), 'Award notice problem');
    await user.selectOptions(screen.getByLabelText('Category'), 'Awarding and contract');
    await user.selectOptions(screen.getByLabelText('Priority'), 'HIGH');
    await user.type(screen.getByLabelText('Description'), 'The supplier response workspace does not open.');
    await user.click(screen.getByRole('button', { name: 'Create support ticket' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/support/tickets', {
      subject: 'Award notice problem',
      category: 'Awarding and contract',
      priority: 'HIGH',
      description: 'The supplier response workspace does not open.'
    }));
    expect(await screen.findByText('Support ticket created')).toBeInTheDocument();
    expect(screen.getByLabelText('Subject')).toHaveValue('');
    expect(screen.getByLabelText('Category')).toHaveValue('General');
  });

  it('shows an error when signed-in help desk ticket creation fails', async () => {
    const user = userEvent.setup();
    store.dispatch(
      assumeUser({
        id: 'user-1',
        displayName: 'Demo Verified User',
        email: 'demo@procurex.test',
        accountType: 'USER',
        organization: 'Demo Organization',
        organizationId: 'org-1',
        capabilities: ['BUYER'],
        verificationStatus: 'APPROVED'
      })
    );
    apiPost.mockRejectedValueOnce(new Error('offline'));

    renderWithRouter(<SignedInHelpDeskProcurexPage />);

    await user.type(screen.getByLabelText('Subject'), 'Login help');
    await user.type(screen.getByLabelText('Description'), 'I cannot access the procurement workflow.');
    await user.click(screen.getByRole('button', { name: 'Create support ticket' }));

    expect(await screen.findByText('Ticket could not be created')).toBeInTheDocument();
  });

  it('uses the public health endpoint on the status page', async () => {
    apiGet.mockResolvedValueOnce({
      data: {
        status: 'ok',
        service: 'procurex-server',
        modules: [{ key: 'identity', basePath: '/api/identity' }]
      }
    });

    renderWithRouter(<SystemStatusProcurexPage />);

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/health'));
    expect(await screen.findByRole('heading', { name: 'Operational' })).toBeInTheDocument();
    expect(screen.getByText('identity')).toBeInTheDocument();
  });

  it('renders a real not-found page instead of silently redirecting home', () => {
    renderWithRouter(<NotFoundProcurexPage />);

    expect(screen.getByRole('heading', { name: 'That ProcureX page was not found.' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open help' })).toHaveAttribute('href', '/help');
  });

  it('persists cookie consent in localStorage', async () => {
    const user = userEvent.setup();
    renderWithRouter(<CookieConsentBanner />);

    await user.click(screen.getByRole('button', { name: 'Accept' }));

    expect(window.localStorage.getItem('procurex.cookieConsent.v1')).toBe('accepted');
    expect(screen.queryByRole('button', { name: 'Accept' })).not.toBeInTheDocument();
  });
});
