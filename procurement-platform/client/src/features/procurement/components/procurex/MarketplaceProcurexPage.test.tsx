import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { store } from '@/app/store';
import { assumeUser, signOut } from '@/features/auth/slice';
import { demoUsers, tenders as fixtureTenders } from '@/shared/data/fixtures';
import { procurexTheme } from '@/styles/mui-theme';
import { procurementApi } from '../../api';
import type { MarketplacePayload, MarketplaceTenderRow, MyBidRow, MyTenderRow } from '../../types';
import { MarketplaceProcurexPage } from './MarketplaceProcurexPage';

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}{location.search}</span>;
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
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValue(defaultMarketplacePayload());
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

  it('renders the redesigned marketplace tabs', async () => {
    renderMarketplace();

    expect(await screen.findByRole('tab', { name: 'Recommended', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'All Tenders' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Invited Tenders' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My Workspace' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Marketplace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'My Tenders' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'My Bids' })).not.toBeInTheDocument();
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

    renderMarketplace('/procurement/marketplace?view=all-tenders');

    expect(await screen.findByText('Active Marketplace Tender')).toBeInTheDocument();
    expect(screen.queryByText('Expired Marketplace Tender')).not.toBeInTheDocument();
    expect(screen.queryByText(/\b\d+\s+matching\b/i)).not.toBeInTheDocument();
  });

  it('filters tenders by search text', async () => {
    const user = userEvent.setup();
    renderMarketplace();

    await screen.findByText('Construction of District Maternal Health Wing');
    expect(screen.queryByRole('searchbox', { name: 'Search by region' })).not.toBeInTheDocument();
    expect(screen.queryByRole('spinbutton', { name: 'Minimum budget' })).not.toBeInTheDocument();

    await user.type(screen.getByRole('searchbox', { name: 'Search title, buyer, reference, sector, location' }), 'Muhimbili');

    expect(screen.getByText('Supply of Hospital Diagnostic Equipment')).toBeInTheDocument();
    expect(screen.queryByText('Construction of District Maternal Health Wing')).not.toBeInTheDocument();
  });

  it('filters tenders by region and budget range', async () => {
    const user = userEvent.setup();
    renderMarketplace('/procurement/marketplace?view=all-tenders');

    await screen.findByText('Construction of District Maternal Health Wing');
    const budgetRange = screen.getByRole('group', { name: 'Filter by budget range' });
    await user.type(screen.getByRole('searchbox', { name: 'Search by region' }), 'Dar es Salaam');
    await user.type(within(budgetRange).getByRole('spinbutton', { name: 'Minimum budget' }), '2000000000');
    await user.type(within(budgetRange).getByRole('spinbutton', { name: 'Maximum budget' }), '3000000000');

    expect(screen.getByText('Supply of Hospital Diagnostic Equipment')).toBeInTheDocument();
    expect(screen.queryByText('Construction of District Maternal Health Wing')).not.toBeInTheDocument();
    expect(screen.queryByText('Facilities Maintenance Services Framework')).not.toBeInTheDocument();
  });

  it('does not render marketplace dropdown filters', async () => {
    renderMarketplace();

    await screen.findByText('Construction of District Maternal Health Wing');

    expect(screen.queryByRole('combobox', { name: 'Type' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Budget' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Sort' })).not.toBeInTheDocument();
    expect(screen.queryByText('All tender types')).not.toBeInTheDocument();
    expect(screen.queryByText('All budgets')).not.toBeInTheDocument();
    expect(screen.queryByText('All statuses')).not.toBeInTheDocument();
    expect(screen.queryByText('Sort by deadline')).not.toBeInTheDocument();
  });

  it('uses procurement type cards as tender filters', async () => {
    const user = userEvent.setup();
    renderMarketplace('/procurement/marketplace?view=all-tenders');

    await screen.findByText('Construction of District Maternal Health Wing');
    const allFilter = screen.getByRole('button', { name: /^All 3$/i });

    expect(allFilter).toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: /^Works 1$/i }));

    expect(screen.getByText('Construction of District Maternal Health Wing')).toBeInTheDocument();
    expect(screen.queryByText('Supply of Hospital Diagnostic Equipment')).not.toBeInTheDocument();
    expect(screen.queryByText('Facilities Maintenance Services Framework')).not.toBeInTheDocument();

    await user.click(allFilter);

    expect(screen.getByText('Construction of District Maternal Health Wing')).toBeInTheDocument();
    expect(screen.getByText('Supply of Hospital Diagnostic Equipment')).toBeInTheDocument();
    expect(screen.getByText('Facilities Maintenance Services Framework')).toBeInTheDocument();
  });

  it('keeps marketplace tender rows to one status tag and removes the draft-bid tag', async () => {
    renderMarketplace();

    await screen.findByText('Supply of Hospital Diagnostic Equipment');
    const submittedRow = screen.getByText('Construction of District Maternal Health Wing').closest('article');
    const draftRow = screen.getByText('Supply of Hospital Diagnostic Equipment').closest('article');

    expect(within(submittedRow!).getAllByText(/Open|You already bid|Draft bid saved/i)).toHaveLength(1);
    expect(within(draftRow!).queryByText('Draft bid saved')).not.toBeInTheDocument();
    expect(within(draftRow!).getAllByText(/Open|You already bid|Draft bid saved/i)).toHaveLength(1);
  });

  it('orders All Tenders and Recommended by the closest deadline first', async () => {
    const { unmount } = renderMarketplace('/procurement/marketplace?view=all-tenders');

    const allRows = await screen.findAllByRole('article');
    expect(within(allRows[0]).getByText('Construction of District Maternal Health Wing')).toBeInTheDocument();
    expect(within(allRows[1]).getByText('Supply of Hospital Diagnostic Equipment')).toBeInTheDocument();

    unmount();
    renderMarketplace('/procurement/marketplace');

    const recommendedRows = await screen.findAllByRole('article');
    expect(within(recommendedRows[0]).getByText('Construction of District Maternal Health Wing')).toBeInTheDocument();
    expect(within(recommendedRows[1]).getByText('Supply of Hospital Diagnostic Equipment')).toBeInTheDocument();
  });

  it('selects all tenders and workspace from route paths', async () => {
    const { unmount } = renderMarketplace('/procurement/my-tenders');

    expect(await screen.findByRole('tab', { name: 'My Workspace', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Saved' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My Bids' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My Tenders' })).toBeInTheDocument();
    expect(screen.queryByText(/\b\d+\s+records?\b/i)).not.toBeInTheDocument();

    unmount();
    renderMarketplace('/procurement/marketplace?view=all-tenders');

    expect(await screen.findByRole('tab', { name: 'All Tenders', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'All tenders' })).toBeInTheDocument();
  });

  it('shows invited tenders between all tenders and workspace with empty prompt', async () => {
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [],
      invitedTenders: [],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/marketplace?view=invited-tenders');

    expect(await screen.findByRole('tab', { name: 'Invited Tenders', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invited tenders' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search title, buyer, reference, sector, location' })).toBeInTheDocument();
    expect(screen.getByText('Tenders you are invited to, will appear here')).toBeInTheDocument();
  });

  it('lists and searches invited tenders without publishing them in All Tenders', async () => {
    const user = userEvent.setup();
    const invitedTender = marketplaceTender({
      id: 'invited-open-tender',
      reference: 'PX-INV-001',
      title: 'Invited Cleaning Tender',
      visibility: 'INVITED',
      organization: 'Invitation Buyer',
      canBid: true
    });
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [],
      invitedTenders: [invitedTender],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/marketplace?view=invited-tenders');

    expect(await screen.findByText('Invited Cleaning Tender')).toBeInTheDocument();
    const tenderRow = screen.getByText('Invited Cleaning Tender').closest('article');
    expect(within(tenderRow!).getByRole('link', { name: /^Bid$/i })).toHaveAttribute('href', '/bidding?tenderId=invited-open-tender');

    await user.type(screen.getByRole('searchbox', { name: 'Search title, buyer, reference, sector, location' }), 'nothing-matches');

    expect(screen.queryByText('Invited Cleaning Tender')).not.toBeInTheDocument();
    expect(screen.getByText('Tenders you are invited to, will appear here')).toBeInTheDocument();
  });

  it('renders backend recommended tenders including invited matches', async () => {
    const user = userEvent.setup();
    const recommendedPublic = marketplaceTender({
      id: 'recommended-public',
      reference: 'PX-REC-001',
      title: 'Recommended Medical Equipment Tender',
      categories: ['Medical Equipment']
    });
    const invitedTender = marketplaceTender({
      id: 'recommended-invited',
      reference: 'PX-INV-REC',
      title: 'Recommended Invited Tender',
      visibility: 'INVITED',
      organization: 'Invitation Buyer',
      categories: ['Cleaning Services']
    });
    const publicButNotRecommended = marketplaceTender({
      id: 'other-public',
      reference: 'PX-OTHER-001',
      title: 'Other Public Tender'
    });
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [publicButNotRecommended, recommendedPublic],
      recommendedTenders: [invitedTender, recommendedPublic],
      invitedTenders: [invitedTender],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/marketplace');

    expect(await screen.findByText('Recommended Invited Tender')).toBeInTheDocument();
    expect(screen.getByText('Recommended Medical Equipment Tender')).toBeInTheDocument();
    expect(screen.queryByText('Other Public Tender')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'All Tenders' }));

    expect(await screen.findByText('Other Public Tender')).toBeInTheDocument();
    expect(screen.getByText('Recommended Medical Equipment Tender')).toBeInTheDocument();
    expect(screen.queryByText('Recommended Invited Tender')).not.toBeInTheDocument();
  });

  it('does not fall back to all published tenders when the backend has no recommendations', async () => {
    const user = userEvent.setup();
    const publicTender = marketplaceTender({
      id: 'not-recommended-public',
      reference: 'PX-NOT-REC',
      title: 'Published But Not Recommended Tender'
    });
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [publicTender],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/marketplace');

    expect(await screen.findByText('No relevant recommended tenders right now.')).toBeInTheDocument();
    expect(screen.queryByText('Published But Not Recommended Tender')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'All Tenders' }));

    expect(await screen.findByText('Published But Not Recommended Tender')).toBeInTheDocument();
  });

  it('uses buyer-safe actions for owned tenders', async () => {
    renderMarketplace();

    await screen.findByText('Facilities Maintenance Services Framework');
    const tenderRow = screen.getByText('Facilities Maintenance Services Framework').closest('article');

    expect(within(tenderRow!).getByRole('link', { name: 'View tender' })).toHaveAttribute('href', '/procurement/tender-details?tenderId=tender-3');
    expect(within(tenderRow!).queryByRole('button', { name: /save|saved|own org/i })).not.toBeInTheDocument();
    expect(within(tenderRow!).queryByRole('button', { name: 'Your Tender' })).not.toBeInTheDocument();
    expect(within(tenderRow!).queryByRole('link', { name: /^Bid$/i })).not.toBeInTheDocument();
  });

  it('keeps the current user view-only for their own published tender in All Tenders', async () => {
    const ownedTender = marketplaceTender({
      id: 'owner-open-tender',
      reference: 'PX-OWNER-001',
      title: 'Owner Published Tender',
      organization: demoUsers.user.organization,
      createdByCurrentUser: true,
      ownedByCurrentOrganization: true,
      canBid: false
    });
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [ownedTender],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/marketplace?view=all-tenders');

    expect(await screen.findByRole('tab', { name: 'All Tenders', selected: true })).toBeInTheDocument();
    const tenderRow = screen.getByText('Owner Published Tender').closest('article');

    expect(within(tenderRow!).getByRole('link', { name: 'View tender' })).toHaveAttribute('href', '/procurement/tender-details?tenderId=owner-open-tender');
    expect(within(tenderRow!).queryByRole('link', { name: /^Bid$/i })).not.toBeInTheDocument();
    expect(within(tenderRow!).queryByRole('button', { name: /save|saved/i })).not.toBeInTheDocument();
  });

  it('allows other users to view and bid on a public open tender in All Tenders', async () => {
    const publicTender = marketplaceTender({
      id: 'public-open-tender',
      reference: 'PX-PUBLIC-001',
      title: 'Public Open Tender',
      organization: 'Ministry of Works',
      createdByCurrentUser: false,
      ownedByCurrentOrganization: false,
      canBid: true
    });
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [publicTender],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/marketplace?view=all-tenders');

    expect(await screen.findByRole('tab', { name: 'All Tenders', selected: true })).toBeInTheDocument();
    const tenderRow = screen.getByText('Public Open Tender').closest('article');

    expect(within(tenderRow!).getByRole('link', { name: 'View Tender' })).toHaveAttribute('href', '/procurement/supplier-tender-detail?tenderId=public-open-tender');
    expect(within(tenderRow!).getByRole('link', { name: /^Bid$/i })).toHaveAttribute('href', '/bidding?tenderId=public-open-tender');
    expect(within(tenderRow!).queryByRole('button', { name: /^Bid$/i })).not.toBeInTheDocument();
  });

  it('shows only public open marketplace tenders in All Tenders', async () => {
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [
        marketplaceTender({
          id: 'open-public-tender',
          reference: 'PX-OPEN-001',
          title: 'Open Public Tender'
        }),
        marketplaceTender({
          id: 'invited-tender',
          reference: 'PX-INVITED-001',
          title: 'Invited Tender',
          visibility: 'INVITED'
        }),
        marketplaceTender({
          id: 'review-tender',
          reference: 'PX-REVIEW-001',
          title: 'Review Tender',
          status: 'DRAFT' as MarketplaceTenderRow['status'],
          visibility: 'PRIVATE'
        }),
        marketplaceTender({
          id: 'private-open-tender',
          reference: 'PX-PRIVATE-001',
          title: 'Private Open Tender',
          visibility: 'PRIVATE'
        })
      ],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/marketplace?view=all-tenders');

    expect(await screen.findByText('Open Public Tender')).toBeInTheDocument();
    expect(screen.queryByText('Invited Tender')).not.toBeInTheDocument();
    expect(screen.queryByText('Review Tender')).not.toBeInTheDocument();
    expect(screen.queryByText('Private Open Tender')).not.toBeInTheDocument();
  });

  it('moves saved tenders into and out of My Workspace', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [
        marketplaceTender({
          id: 'save-only-tender',
          reference: 'PX-SAVE-001',
          title: 'Save Only Tender',
          organization: 'Public Buyer',
          canBid: true
        })
      ],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);
    renderMarketplace('/procurement/marketplace?view=all-tenders');

    await screen.findByText('Save Only Tender');
    const tenderRow = screen.getByText('Save Only Tender').closest('article');
    await user.click(within(tenderRow!).getByRole('button', { name: 'Save' }));

    await user.click(screen.getByRole('tab', { name: 'My Workspace' }));
    const savedSection = screen.getByRole('heading', { name: 'Saved' }).closest('section');

    expect(within(savedSection!).getByText('Save Only Tender')).toBeInTheDocument();

    await user.click(within(savedSection!).getByRole('button', { name: 'Saved' }));

    expect(within(savedSection!).queryByText('Save Only Tender')).not.toBeInTheDocument();
    expect(within(savedSection!).getByText(/No saved active tenders/i)).toBeInTheDocument();
    expect(procurementApi.unsaveTender).toHaveBeenCalledWith('save-only-tender');
  });

  it('orders each My Workspace section by the closest deadline first', async () => {
    const savedSooner = marketplaceTender({ id: 'saved-sooner', title: 'Saved Sooner', closingDate: futureDate(1), isSaved: true });
    const savedLater = marketplaceTender({ id: 'saved-later', title: 'Saved Later', closingDate: futureDate(8), isSaved: true });
    const bidSooner = marketplaceTender({ id: 'bid-sooner', title: 'Bid Sooner', closingDate: futureDate(2) });
    const bidLater = marketplaceTender({ id: 'bid-later', title: 'Bid Later', closingDate: futureDate(9) });
    const ownedSooner = marketplaceTender({ id: 'owned-sooner', title: 'Owned Sooner', closingDate: futureDate(3), createdByCurrentUser: true, ownedByCurrentOrganization: true, canBid: false });
    const ownedLater = marketplaceTender({ id: 'owned-later', title: 'Owned Later', closingDate: futureDate(10), createdByCurrentUser: true, ownedByCurrentOrganization: true, canBid: false });

    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [savedLater, savedSooner, bidLater, bidSooner, ownedLater, ownedSooner],
      myTenders: [
        myTenderRow(ownedLater),
        myTenderRow(ownedSooner)
      ],
      myBids: [
        myBidRow(bidLater),
        myBidRow(bidSooner)
      ]
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/marketplace?view=my-workspace');

    expect(await screen.findByRole('tab', { name: 'My Workspace', selected: true })).toBeInTheDocument();
    expect(await screen.findByText('Saved Sooner')).toBeInTheDocument();
    const savedRows = within(screen.getByRole('heading', { name: 'Saved' }).closest('section')!).getAllByRole('article');
    const bidRows = within(screen.getByRole('heading', { name: 'My Bids' }).closest('section')!).getAllByRole('article');
    const ownedRows = within(screen.getByRole('heading', { name: 'My Tenders' }).closest('section')!).getAllByRole('article');

    expect(within(savedRows[0]).getByText('Saved Sooner')).toBeInTheDocument();
    expect(within(savedRows[1]).getByText('Saved Later')).toBeInTheDocument();
    expect(within(bidRows[0]).getByText('Bid Sooner')).toBeInTheDocument();
    expect(within(bidRows[1]).getByText('Bid Later')).toBeInTheDocument();
    expect(within(ownedRows[0]).getByText('Owned Sooner')).toBeInTheDocument();
    expect(within(ownedRows[1]).getByText('Owned Later')).toBeInTheDocument();
  });

  it('deduplicates My Workspace across saved, bid, and owned tender rows', async () => {
    const sharedTender = marketplaceTender({
      id: 'shared-tender',
      reference: 'PX-SHARED-001',
      title: 'Shared Active Tender',
      createdByCurrentUser: true,
      ownedByCurrentOrganization: true,
      canBid: false,
      isSaved: true
    });
    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [sharedTender],
      myTenders: [
        {
          id: 'shared-tender',
          title: 'Shared Active Tender',
          section: 'posted',
          status: 'Open',
          type: 'GOODS',
          tender: sharedTender,
          lastActivity: new Date().toISOString(),
          actionLabel: 'View tender',
          nav: '/procurement/tender-details?tenderId=shared-tender'
        }
      ],
      myBids: [
        {
          id: 'shared-bid',
          tenderId: 'shared-tender',
          tenderReference: 'PX-SHARED-001',
          title: 'Shared Active Tender',
          section: 'draft',
          status: 'Draft',
          tender: sharedTender,
          lastActivity: new Date().toISOString(),
          actionLabel: 'Continue Bid',
          nav: '/bidding?tenderId=shared-tender'
        }
      ]
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/marketplace?view=my-workspace');

    expect(await screen.findByRole('tab', { name: 'My Workspace', selected: true })).toBeInTheDocument();
    expect(screen.getAllByText('Shared Active Tender')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'My Tenders' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Continue Bid' })).not.toBeInTheDocument();
  });

  it('uses the requested My Tenders actions by tender state', async () => {
    const draftTender = marketplaceTender({ id: 'draft-tender', title: 'Draft Owned Tender', status: 'DRAFT' as MarketplaceTenderRow['status'], createdByCurrentUser: true, ownedByCurrentOrganization: true });
    const reviewTender = marketplaceTender({ id: 'review-tender', title: 'Review Owned Tender', status: 'DRAFT' as MarketplaceTenderRow['status'], createdByCurrentUser: true, ownedByCurrentOrganization: true });
    const failedTender = marketplaceTender({ id: 'failed-tender', title: 'Failed Review Tender', status: 'DRAFT' as MarketplaceTenderRow['status'], createdByCurrentUser: true, ownedByCurrentOrganization: true });
    const publishedTender = marketplaceTender({ id: 'published-tender', title: 'Published Owned Tender', createdByCurrentUser: true, ownedByCurrentOrganization: true });

    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [publishedTender],
      myBids: [],
      myTenders: [
        {
          id: 'draft-tender',
          title: 'Draft Owned Tender',
          section: 'draft',
          status: 'Draft',
          type: 'GOODS',
          tender: draftTender,
          lastActivity: new Date().toISOString(),
          actionLabel: 'Continue creating',
          nav: '/procurement/create-tender?draftId=draft-tender'
        },
        {
          id: 'review-tender',
          title: 'Review Owned Tender',
          section: 'draft',
          status: 'Awaiting Review',
          type: 'GOODS',
          tender: reviewTender,
          lastActivity: new Date().toISOString(),
          actionLabel: 'Awaiting review',
          nav: '/procurement/create-tender?tenderId=review-tender'
        },
        {
          id: 'failed-tender',
          title: 'Failed Review Tender',
          section: 'draft',
          status: 'Failed Review',
          type: 'GOODS',
          tender: failedTender,
          lastActivity: new Date().toISOString(),
          actionLabel: 'Amend tender',
          nav: '/procurement/create-tender?tenderId=failed-tender'
        },
        {
          id: 'published-tender',
          title: 'Published Owned Tender',
          section: 'posted',
          status: 'Open',
          type: 'GOODS',
          tender: publishedTender,
          lastActivity: new Date().toISOString(),
          actionLabel: 'View tender',
          nav: '/procurement/tender-details?tenderId=published-tender'
        }
      ]
    } satisfies MarketplacePayload);

    renderMarketplace('/procurement/marketplace?view=my-workspace');

    expect(await screen.findByText('Draft Owned Tender')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue creating' })).toHaveAttribute('href', '/procurement/create-tender?draftId=draft-tender');
    expect(screen.getByRole('button', { name: 'Awaiting review' })).toBeDisabled();
    expect(screen.queryByRole('link', { name: 'Awaiting review' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Amend tender' })).toHaveAttribute('href', '/procurement/create-tender?tenderId=failed-tender');
    expect(screen.getByRole('link', { name: 'View tender' })).toHaveAttribute('href', '/procurement/tender-details?tenderId=published-tender');
  });

  it('does not render marketplace summary KPI cards', async () => {
    renderMarketplace();

    await screen.findByText('Construction of District Maternal Health Wing');

    expect(screen.queryByText('Open tenders')).not.toBeInTheDocument();
    expect(screen.queryByText('Total budget value')).not.toBeInTheDocument();
    expect(screen.queryByText('My tenders')).not.toBeInTheDocument();
    expect(screen.queryByText('My bids')).not.toBeInTheDocument();
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

    expect(await screen.findByRole('tab', { name: 'My Workspace', selected: true })).toBeInTheDocument();
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

  it('opens the bidding workspace from a submitted My Bids row', async () => {
    const user = userEvent.setup();
    const tender = marketplaceTender({
      id: 'submitted-tender',
      reference: 'PX-SUB-001',
      title: 'Submitted Tender'
    });
    const getTenderDetail = vi.spyOn(procurementApi, 'getTenderDetail').mockRejectedValue(new Error('Bid navigation should not fetch tender detail'));

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

    const openBidLink = await screen.findByRole('link', { name: 'Open Bid' });
    expect(openBidLink).toHaveAttribute('href', '/bidding?tenderId=submitted-tender');

    await user.click(openBidLink);

    expect(getTenderDetail).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/bidding?tenderId=submitted-tender');
  });

  it('opens the bidding workspace from an active marketplace bid link', async () => {
    const user = userEvent.setup();
    const tender = marketplaceTender({
      id: 'open-tender',
      reference: 'PX-OPEN-001',
      title: 'Open Tender',
      hasDraftBid: true
    });
    const getTenderDetail = vi.spyOn(procurementApi, 'getTenderDetail').mockRejectedValue(new Error('Bid navigation should not fetch tender detail'));

    vi.spyOn(procurementApi, 'getMarketplace').mockResolvedValueOnce({
      tenders: [tender],
      recommendedTenders: [tender],
      myTenders: [],
      myBids: []
    } satisfies MarketplacePayload);

    renderMarketplace();

    const tenderRow = (await screen.findByText('Open Tender')).closest('article');
    const continueBidLink = within(tenderRow!).getByRole('link', { name: 'Continue Bid' });
    expect(continueBidLink).toHaveAttribute('href', '/bidding?tenderId=open-tender');

    await user.click(continueBidLink);

    expect(getTenderDetail).not.toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/bidding?tenderId=open-tender');
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
    visibility: 'PUBLIC_MARKETPLACE',
    categories: ['Goods'],
    ...overrides
  };
}

function defaultMarketplacePayload(): MarketplacePayload {
  const tenders = fixtureTenders.map((tender): MarketplaceTenderRow => ({
    ...tender,
    ownerOrganization: tender.organization,
    ownedByCurrentOrganization: Boolean(tender.ownedByCurrentOrganization ?? tender.createdByCurrentUser),
    canBid: !tender.createdByCurrentUser && !tender.hasSubmittedBid,
    hasDraftBid: Boolean(tender.hasDraftBid),
    hasSubmittedBid: Boolean(tender.hasSubmittedBid),
    isSaved: Boolean(tender.isSaved),
    visibility: tender.visibility ?? 'PUBLIC_MARKETPLACE',
    categories: tender.categories.length ? tender.categories : [tender.type]
  }));

  return {
    tenders,
    recommendedTenders: tenders,
    myTenders: [],
    myBids: []
  };
}

function futureDate(daysFromNow: number) {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString();
}

function myTenderRow(tender: MarketplaceTenderRow): MyTenderRow {
  return {
    id: tender.id,
    title: tender.title,
    section: 'posted',
    status: 'Open',
    type: tender.type,
    tender,
    lastActivity: new Date().toISOString(),
    actionLabel: 'View tender',
    nav: `/procurement/tender-details?tenderId=${tender.id}`
  };
}

function myBidRow(tender: MarketplaceTenderRow): MyBidRow {
  return {
    id: `bid-${tender.id}`,
    tenderId: tender.id,
    title: tender.title,
    section: 'draft',
    status: 'Draft',
    tender,
    tenderReference: tender.reference,
    lastActivity: new Date().toISOString(),
    actionLabel: 'Continue Bid',
    nav: `/bidding?tenderId=${tender.id}`
  };
}
