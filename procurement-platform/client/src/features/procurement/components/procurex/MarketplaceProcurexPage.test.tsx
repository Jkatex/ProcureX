import { ThemeProvider } from '@mui/material';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { store } from '@/app/store';
import { assumeUser, signOut } from '@/features/auth/slice';
import { demoUsers } from '@/shared/data/fixtures';
import { procurexTheme } from '@/styles/mui-theme';
import { procurementApi } from '../../api';
import { openTenderDocument } from '../../tenderDocumentActions';
import type { MarketplacePayload, MarketplaceTenderRow, TenderDetail } from '../../types';
import { MarketplaceProcurexPage } from './MarketplaceProcurexPage';

vi.mock('../../tenderDocumentActions', () => ({
  openTenderDocument: vi.fn()
}));

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

function renderMarketplace(route = '/procurement/marketplace') {
  return render(
    <Provider store={store}>
      <ThemeProvider theme={procurexTheme}>
        <MemoryRouter initialEntries={[route]}>
          <MarketplaceProcurexPage />
          <LocationProbe />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
}

describe('MarketplaceProcurexPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    store.dispatch(signOut());
    store.dispatch(assumeUser(demoUsers.user));
    vi.mocked(openTenderDocument).mockResolvedValue(undefined);
    vi.spyOn(procurementApi, 'saveTender').mockResolvedValue({ success: true, message: 'Tender saved successfully' });
    vi.spyOn(procurementApi, 'unsaveTender').mockResolvedValue({ success: true, message: 'Tender removed from saved tenders' });
  });

  it('opens the top-right ProcureX apps drawer and navigates to an app', async () => {
    const user = userEvent.setup();
    renderMarketplace();

    const appsButton = screen.getByRole('button', { name: 'Open apps' });
    await user.click(appsButton);

    const drawer = screen.getByText('ProcureX Apps').closest<HTMLElement>('[data-app-menu]');
    expect(appsButton).toHaveAttribute('aria-expanded', 'true');
    expect(drawer).toHaveClass('open');
    expect(within(drawer!).getByText('Procurement Planning')).toBeInTheDocument();

    await user.click(within(drawer!).getByRole('button', { name: /Communication Center Messages, clarifications, alerts/i }));

    expect(screen.getByTestId('location')).toHaveTextContent('/communication');
    expect(appsButton).toHaveAttribute('aria-expanded', 'false');
    expect(drawer).not.toHaveClass('open');
  });

  it('renders open tender browse data from fixtures', async () => {
    renderMarketplace();

    expect(await screen.findByText('Construction of District Maternal Health Wing')).toBeInTheDocument();
    expect(screen.getByText('Supply of Hospital Diagnostic Equipment')).toBeInTheDocument();
  });

  it('removes expired published tenders from the marketplace list', async () => {
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [
        marketplaceTender({
          id: 'active-tender',
          reference: 'PX-ACTIVE-001',
          title: 'Active Marketplace Tender',
          closingDate: new Date(Date.now() + 86400000).toISOString()
        }),
        marketplaceTender({
          id: 'expired-tender',
          reference: 'PX-EXPIRED-001',
          title: 'Expired Marketplace Tender',
          closingDate: new Date(Date.now() - 86400000).toISOString()
        })
      ],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);

    renderMarketplace();

    expect(await screen.findByText('Active Marketplace Tender')).toBeInTheDocument();
    expect(screen.queryByText('Expired Marketplace Tender')).not.toBeInTheDocument();
    expect(screen.getByText('1 matching')).toBeInTheDocument();
  });

  it('filters tenders by search text', async () => {
    const user = userEvent.setup();
    renderMarketplace();

    await screen.findByText('Construction of District Maternal Health Wing');
    await user.type(screen.getByRole('searchbox', { name: 'Search title, buyer, reference, sector, location' }), 'Muhimbili');

    expect(screen.getByText('Supply of Hospital Diagnostic Equipment')).toBeInTheDocument();
    expect(screen.queryByText('Construction of District Maternal Health Wing')).not.toBeInTheDocument();
  });

  it('filters by type, status, and budget, then sorts by budget', async () => {
    const user = userEvent.setup();
    renderMarketplace();

    await screen.findByText('Construction of District Maternal Health Wing');

    await user.selectOptions(screen.getByLabelText('Type'), 'GOODS');
    expect(screen.getByText('Supply of Hospital Diagnostic Equipment')).toBeInTheDocument();
    expect(screen.queryByText('Construction of District Maternal Health Wing')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Type'), '');
    await user.selectOptions(screen.getByLabelText('Status'), 'PUBLISHED');
    expect(screen.getByText('Facilities Maintenance Services Framework')).toBeInTheDocument();
    expect(screen.queryByText('Supply of Hospital Diagnostic Equipment')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), '');
    await user.selectOptions(screen.getByLabelText('Budget'), 'billion-plus');
    expect(screen.getByText('Construction of District Maternal Health Wing')).toBeInTheDocument();
    expect(screen.getByText('Supply of Hospital Diagnostic Equipment')).toBeInTheDocument();
    expect(screen.queryByText('Facilities Maintenance Services Framework')).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Budget'), '');
    await user.selectOptions(screen.getByLabelText('Sort'), 'budget-asc');
    const rows = screen.getAllByRole('article');
    expect(within(rows[0]).getByText('Facilities Maintenance Services Framework')).toBeInTheDocument();
  });

  it('applies a tender type filter from a category card', async () => {
    const user = userEvent.setup();
    renderMarketplace();

    await screen.findByText('Construction of District Maternal Health Wing');
    await user.click(screen.getByRole('button', { name: /Works 1 tender/i }));

    expect(screen.getByText('Construction of District Maternal Health Wing')).toBeInTheDocument();
    expect(screen.queryByText('Supply of Hospital Diagnostic Equipment')).not.toBeInTheDocument();
  });

  it('selects My Tenders and My Bids from route paths', async () => {
    const { unmount } = renderMarketplace('/procurement/my-tenders');

    expect(await screen.findByRole('tab', { name: 'My Tenders', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Draft Tenders' })).toBeInTheDocument();

    unmount();
    renderMarketplace('/procurement/my-bids');

    expect(await screen.findByRole('tab', { name: 'My Bids', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Draft Bid Submissions' })).toBeInTheDocument();
  });

  it('uses buyer-safe actions for owned tenders', async () => {
    const user = userEvent.setup();
    renderMarketplace();

    await screen.findByText('Construction of District Maternal Health Wing');
    await user.selectOptions(screen.getByLabelText('Status'), 'PUBLISHED');

    expect(screen.getByRole('link', { name: 'View My Tender' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View My Tender' })).toHaveAttribute('href', '/procurement/tender-details?tenderId=tender-3');
    expect(screen.getByRole('button', { name: 'Your Tender' })).toBeDisabled();
  });

  it('does not show another same-organization user exact-user tenders as my tenders', async () => {
    store.dispatch(signOut());
    store.dispatch(
      assumeUser({
        ...demoUsers.user,
        id: 'demo-coworker',
        email: 'coworker@procurex.tz',
        displayName: 'Demo Coworker'
      })
    );
    renderMarketplace('/procurement/my-tenders');

    expect(await screen.findByRole('tab', { name: 'My Tenders', selected: true })).toBeInTheDocument();
    expect(screen.queryByText('Facilities Maintenance Services Framework')).not.toBeInTheDocument();
  });

  it('toggles saved state through the procurement API', async () => {
    const user = userEvent.setup();
    renderMarketplace();

    await screen.findByText('Construction of District Maternal Health Wing');
    const tenderRow = screen.getByText('Supply of Hospital Diagnostic Equipment').closest('article');
    const firstSaveButton = within(tenderRow!).getByRole('button', { name: 'Save' });

    await user.click(firstSaveButton);

    expect(await screen.findByRole('button', { name: 'Saved' })).toBeInTheDocument();
    expect(procurementApi.saveTender).toHaveBeenCalledWith('tender-2');
  });

  it('opens the bid document from a submitted My Bids row without navigating to bidding', async () => {
    const user = userEvent.setup();
    const tender = marketplaceTender({
      id: 'submitted-tender',
      reference: 'PX-SUB-001',
      title: 'Submitted Tender'
    });
    const document = { id: 'doc-1', name: 'Submitted tender document.pdf', documentType: 'PDF', label: 'Tender document', openUrl: '/documents/doc-1/open' };
    const detail = tenderDetail(tender, { documents: [document] });
    const getTenderDetail = vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValueOnce(detail);

    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [],
      myTenders: [],
      myBids: [
        {
          id: 'my-bid-submitted',
          title: tender.title,
          section: 'submitted',
          status: 'Submitted',
          tender,
          tenderReference: tender.reference,
          lastActivity: '2026-06-09',
          actionLabel: 'Open Bid',
          nav: `/bidding?tenderId=${tender.id}`
        }
      ]
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/my-bids');

    await user.click(await screen.findByRole('button', { name: 'Open Bid' }));

    await waitFor(() => expect(getTenderDetail).toHaveBeenCalledWith('submitted-tender'));
    expect(openTenderDocument).toHaveBeenCalledWith(detail, document, 'documents');
    expect(screen.queryByRole('link', { name: 'Open Bid' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/procurement/my-bids');
  });

  it('opens the bid document from an active marketplace bid button without navigating to bidding', async () => {
    const user = userEvent.setup();
    const tender = marketplaceTender({
      id: 'open-tender',
      reference: 'PX-OPEN-001',
      title: 'Open Tender',
      hasDraftBid: true
    });
    const detail = tenderDetail(tender);
    const getTenderDetail = vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValueOnce(detail);

    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [tender],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);

    renderMarketplace();

    const tenderRow = (await screen.findByText('Open Tender')).closest('article');
    await user.click(within(tenderRow!).getByRole('button', { name: 'Continue Bid' }));

    await waitFor(() => expect(getTenderDetail).toHaveBeenCalledWith('open-tender'));
    expect(openTenderDocument).toHaveBeenCalledWith(detail, detail.documents?.[0], 'documents');
    expect(within(tenderRow!).queryByRole('link', { name: 'Continue Bid' })).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/procurement/marketplace');
  });

  it('shows a recoverable error when the bid document cannot be opened', async () => {
    const user = userEvent.setup();
    const tender = marketplaceTender({
      id: 'error-tender',
      reference: 'PX-ERR-001',
      title: 'Error Tender'
    });

    vi.spyOn(procurementApi, 'getTenderDetail').mockRejectedValueOnce(new Error('missing detail'));
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [],
      myTenders: [],
      myBids: [
        {
          id: 'my-bid-error',
          title: tender.title,
          section: 'submitted',
          status: 'Submitted',
          tender,
          tenderReference: tender.reference,
          lastActivity: '2026-06-09',
          actionLabel: 'Open Bid',
          nav: `/bidding?tenderId=${tender.id}`
        }
      ]
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/my-bids');

    await user.click(await screen.findByRole('button', { name: 'Open Bid' }));

    expect(await screen.findByText('Bid document could not be opened. Open the tender detail and try again.')).toBeInTheDocument();
    expect(openTenderDocument).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Open Bid' })).toBeEnabled();
  });
});

function marketplaceTender(overrides: Partial<MarketplaceTenderRow> = {}): MarketplaceTenderRow {
  return {
    id: 'marketplace-tender',
    reference: 'PX-MKT-001',
    title: 'Marketplace Tender',
    organization: 'Public Buyer',
    type: 'GOODS',
    status: 'OPEN',
    budget: 100000000,
    currency: 'TZS',
    closingDate: new Date(Date.now() + 86400000).toISOString(),
    location: 'Dar es Salaam',
    description: 'Tender prepared for marketplace visibility tests.',
    createdByCurrentUser: false,
    ownedByCurrentOrganization: false,
    canBid: true,
    hasDraftBid: false,
    hasSubmittedBid: false,
    isSaved: false,
    categories: ['Goods'],
    ...overrides
  };
}

function tenderDetail(tender: MarketplaceTenderRow, overrides: Partial<TenderDetail> = {}): TenderDetail {
  return {
    ...tender,
    method: 'Open Tender',
    visibility: 'PUBLIC_MARKETPLACE',
    publishedAt: '2026-07-01T08:00:00.000Z',
    requirements: {},
    requirementRows: [],
    milestones: [],
    commercialItems: [],
    documents: [
      {
        id: 'document-1',
        name: `${tender.reference} tender document.pdf`,
        documentType: 'PDF',
        label: 'Tender document',
        openUrl: `/api/procurement/tenders/${tender.id}/documents/document-1/open`
      }
    ],
    bidSummary: { total: 0, draft: 0, submitted: 0, withdrawn: 0 },
    currentBid: null,
    ...overrides
  };
}
