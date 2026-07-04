import { ThemeProvider } from '@mui/material';
import { render, screen, within } from '@testing-library/react';
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
import { MarketplaceProcurexPage } from './MarketplaceProcurexPage';

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
});
