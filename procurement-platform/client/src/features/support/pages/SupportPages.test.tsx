import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
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

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>;
}

function renderWithRouter(element: ReactNode) {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        {element}
        <LocationProbe />
        <NotificationToastHost />
      </MemoryRouter>
    </Provider>
  );
}

const helpCategories = [
  {
    id: 'getting-started',
    title: 'Getting started',
    description: 'Platform basics',
    subcategories: ['Overview', 'Roles'],
    roles: ['PUBLIC'],
    priority: 300
  },
  {
    id: 'bid-submission',
    title: 'Bid submission',
    description: 'Submit and track bids',
    subcategories: ['Submission', 'Receipts'],
    roles: ['SUPPLIER'],
    priority: 225
  }
];

const popularFaq = {
  id: 'bid-submission-submit-bid',
  category: 'Bid submission',
  categoryId: 'bid-submission',
  subcategory: 'Submission',
  title: 'How do I submit a bid?',
  summary: 'Submit a completed bid before the tender deadline.',
  userRoles: ['SUPPLIER'],
  alternativeQuestions: ['How do I submit a bid?'],
  keywords: ['submit', 'bid'],
  importantKeywords: ['submit'],
  steps: ['Open Bidding.', 'Review the bid.', 'Select Submit Bid.'],
  notes: ['Save the receipt.'],
  warnings: ['Do not submit after the deadline.'],
  relatedFaqIds: [],
  action: { label: 'Open Bidding', path: '/bidding' },
  enabled: true,
  priority: 225
};

function mockHelpCentreLoad() {
  apiGet.mockImplementation((url: string) => {
    if (url === '/api/help-centre/categories') return Promise.resolve({ data: { categories: helpCategories } });
    if (url === '/api/help-centre/popular') return Promise.resolve({ data: { faqs: [popularFaq], total: 1 } });
    if (url === '/api/help-centre/category/getting-started') return Promise.resolve({ data: { category: helpCategories[0], faqs: [popularFaq], total: 1 } });
    if (url === '/api/help-centre/category/bid-submission') return Promise.resolve({ data: { category: helpCategories[1], faqs: [popularFaq], total: 1 } });
    return Promise.resolve({ data: {} });
  });
}

describe('support pages', () => {
  beforeEach(() => {
    window.localStorage.clear();
    store.dispatch(signOut());
    store.dispatch(clearNotifications());
    apiGet.mockReset();
    apiPost.mockReset();
  });

  it('renders the Help Centre chatbot page with categories and popular questions', async () => {
    const user = userEvent.setup();
    mockHelpCentreLoad();
    renderWithRouter(<HelpCenterProcurexPage />);

    expect(screen.getByRole('heading', { name: 'Help Assistant' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Status' })).toHaveAttribute('href', '/status');
    expect(screen.queryByRole('button', { name: /Getting started/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'How do I submit a bid?' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Open help panel' }));
    expect(await screen.findByRole('button', { name: /Getting started/i })).toBeInTheDocument();
    expect((await screen.findAllByRole('button', { name: 'How do I submit a bid?' })).length).toBeGreaterThan(0);
    expect(screen.queryByText('Create support ticket')).not.toBeInTheDocument();
  });

  it('submits typed Help Centre questions and renders step-by-step answers', async () => {
    const user = userEvent.setup();
    mockHelpCentreLoad();
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
        success: true,
        matched: true,
        confidence: 98,
        faqId: 'bid-submission-submit-bid',
        title: 'How do I submit a bid?',
        category: 'Bid submission',
        subcategory: 'Submission',
        summary: 'Submit a completed bid before the tender deadline.',
        steps: ['Open Bidding.', 'Review the bid.', 'Select Submit Bid.'],
        notes: ['Save the receipt.'],
        warnings: ['Do not submit after the deadline.'],
        relatedQuestions: [{ faqId: 'bid-preparation-save-bid-draft', title: 'How do I save a bid as a draft?' }],
        action: { label: 'Open Bidding', path: '/bidding' }
      }
    });

    renderWithRouter(<HelpCenterProcurexPage />);

    await user.type(screen.getByLabelText('Ask a platform question'), 'How do I submit a bid?');
    await user.click(screen.getByRole('button', { name: 'Ask' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/help-centre/message', {
      message: 'How do I submit a bid?',
      category: 'getting-started',
      currentPath: '/help'
    }));
    expect(await screen.findByText('Submit a completed bid before the tender deadline.')).toBeInTheDocument();
    expect(screen.getByText('Open Bidding.')).toBeInTheDocument();
    expect(screen.getByText('Save the receipt.')).toBeInTheDocument();
    expect(screen.getByText('Do not submit after the deadline.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How do I save a bid as a draft?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Bidding' })).toBeInTheDocument();
  });

  it('prevents empty Help Centre submissions and shows fallback responses', async () => {
    const user = userEvent.setup();
    mockHelpCentreLoad();
    apiPost.mockResolvedValueOnce({
      data: {
        success: true,
        matched: false,
        summary: 'I could not find an approved Help Centre answer for that question.',
        steps: ['Try asking the question using fewer words.'],
        action: { label: 'Contact Support', path: '/contact' }
      }
    });

    renderWithRouter(<HelpCenterProcurexPage />);

    expect(screen.getByRole('button', { name: 'Ask' })).toBeDisabled();
    await user.type(screen.getByLabelText('Ask a platform question'), 'unknown workflow');
    await user.keyboard('{Enter}');

    expect(await screen.findByText('I could not find an approved Help Centre answer for that question.')).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledTimes(1);
  });

  it('routes signed-in Help Centre contact support to support compose', async () => {
    const user = userEvent.setup();
    mockHelpCentreLoad();
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

    renderWithRouter(<HelpCenterProcurexPage />);
    await user.click(screen.getByRole('button', { name: 'Open help panel' }));
    await screen.findByRole('button', { name: /Getting started/i });

    await user.click(screen.getByRole('button', { name: 'Contact Support' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/communication?');
    expect(screen.getByTestId('location')).toHaveTextContent('support=true');
    expect(screen.getByTestId('location')).toHaveTextContent('view=compose');
  });

  it('routes public Help Centre contact support to the public contact page', async () => {
    const user = userEvent.setup();
    mockHelpCentreLoad();

    renderWithRouter(<HelpCenterProcurexPage />);
    await user.click(screen.getByRole('button', { name: 'Open help panel' }));
    await screen.findByRole('button', { name: /Getting started/i });

    await user.click(screen.getByRole('button', { name: 'Contact Support' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/contact');
  });

  it('uses a focused signed-in Help Centre shell with one hidden left panel', async () => {
    const user = userEvent.setup();
    mockHelpCentreLoad();
    apiPost.mockResolvedValueOnce({
      data: {
        success: true,
        matched: true,
        confidence: 98,
        faqId: 'bid-submission-submit-bid',
        title: 'How do I submit a bid?',
        category: 'Bid submission',
        subcategory: 'Submission',
        summary: 'Submit a completed bid before the tender deadline.',
        steps: ['Open Bidding.', 'Review the bid.', 'Select Submit Bid.'],
        notes: [],
        warnings: [],
        relatedQuestions: []
      }
    });
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

    renderWithRouter(<HelpCenterProcurexPage />);

    expect(screen.queryByRole('link', { name: 'Open tenders' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Help' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Sign In' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Getting started/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'How do I submit a bid?' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Help Assistant' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open help panel' }));

    expect(await screen.findByRole('button', { name: /Getting started/i })).toBeInTheDocument();
    expect(await screen.findAllByRole('button', { name: 'How do I submit a bid?' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Contact Support' })).toBeInTheDocument();
    expect(screen.getAllByText('ProcureX Help Assistant provides platform guidance only. It does not make procurement, evaluation, award, contract, invoice or payment decisions.').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: /Bid submission/i }));
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/api/help-centre/category/bid-submission'));
    await user.click(screen.getAllByRole('button', { name: 'How do I submit a bid?' })[0]);
    await waitFor(() => expect(apiPost).toHaveBeenCalledWith('/api/help-centre/message', {
      message: 'How do I submit a bid?',
      category: 'bid-submission',
      currentPath: '/help'
    }));

    await user.click(screen.getByRole('button', { name: 'Hide help panel' }));
    expect(screen.queryByRole('button', { name: /Getting started/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'How do I submit a bid?' })).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Award notice problem' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Awarding and contract' } });
    fireEvent.change(screen.getByLabelText('Priority'), { target: { value: 'HIGH' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'The supplier response workspace does not open.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create support ticket' }));

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
