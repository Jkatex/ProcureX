import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import i18n, { persistLanguage } from '@/i18n';
import { ProcurexStaticPage } from './ProcurexStaticPage';

const selectedEvaluationTenderKey = 'procurex.selectedEvaluationTender';
const selectedEvaluationReportKey = 'procurex.selectedEvaluationReport';
const marketplaceHtml = `
  <section data-marketplace-root>
    <div role="tablist">
      <button type="button" role="tab" class="active" aria-selected="true" data-marketplace-tab="marketplace">Marketplace</button>
      <button type="button" role="tab" aria-selected="false" data-marketplace-tab="my-tenders">My Tenders</button>
      <button type="button" role="tab" aria-selected="false" data-marketplace-tab="my-bids">My Bids</button>
    </div>
    <section data-marketplace-tab-panel="marketplace">Marketplace page</section>
    <section data-marketplace-tab-panel="my-tenders">Tender page</section>
    <section data-marketplace-tab-panel="my-bids">Bid page</section>
  </section>
`;

function LocationProbe() {
  const location = useLocation();
  return <span data-testid="location">{location.pathname}</span>;
}

describe('ProcurexStaticPage localization', () => {
  afterEach(async () => {
    window.localStorage.removeItem(selectedEvaluationTenderKey);
    window.localStorage.removeItem(selectedEvaluationReportKey);
    await act(async () => {
      await i18n.changeLanguage('en');
      persistLanguage('en');
    });
  });

  it('translates generated static page text and attributes to Swahili', async () => {
    await act(async () => {
      await i18n.changeLanguage('sw');
    });

    render(
      <MemoryRouter>
        <ProcurexStaticPage
          pageKey="welcome"
          html='<main><button aria-label="Open apps">Create Tender</button><input placeholder="Search" /></main>'
        />
      </MemoryRouter>
    );

    expect(await screen.findByText('Tengeneza Zabuni')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText('Fungua programu')).toBeInTheDocument());
  });

  it('clears saved evaluation selection when the evaluation page is entered', () => {
    window.localStorage.setItem(selectedEvaluationTenderKey, 'PX-WRK-2026-001');
    window.localStorage.setItem(selectedEvaluationReportKey, 'PX-WRK-2026-001');

    render(
      <MemoryRouter>
        <ProcurexStaticPage pageKey="bid-evaluation" html="<main><h1>Tenders for Evaluation</h1></main>" />
      </MemoryRouter>
    );

    expect(window.localStorage.getItem(selectedEvaluationTenderKey)).toBeNull();
    expect(window.localStorage.getItem(selectedEvaluationReportKey)).toBeNull();
    expect(screen.getByText('Tenders for Evaluation')).toBeInTheDocument();
  });

  it('clears saved evaluation selection when another Procurex page navigates to evaluation', () => {
    window.localStorage.setItem(selectedEvaluationTenderKey, 'PX-WRK-2026-001');
    window.localStorage.setItem(selectedEvaluationReportKey, 'PX-WRK-2026-001');

    render(
      <MemoryRouter>
        <ProcurexStaticPage
          pageKey="workspace-dashboard"
          html='<main><button type="button" data-navigate="bid-evaluation">Evaluation</button></main>'
        />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText('Evaluation'));

    expect(window.localStorage.getItem(selectedEvaluationTenderKey)).toBeNull();
    expect(window.localStorage.getItem(selectedEvaluationReportKey)).toBeNull();
  });

  it('shows marketplace work sections from route-backed pages', async () => {
    render(
      <MemoryRouter initialEntries={['/procurement/my-tenders']}>
        <ProcurexStaticPage pageKey="marketplace" html={marketplaceHtml} />
      </MemoryRouter>
    );

    const panel = screen.getByText('Tender page').closest<HTMLElement>('[data-marketplace-tab-panel]');
    await waitFor(() => expect(panel).toHaveStyle({ display: 'grid' }));
    expect(screen.getByRole('tab', { name: 'My Tenders' })).toHaveAttribute('aria-selected', 'true');
  });

  it('navigates marketplace work tabs to in-app pages', async () => {
    render(
      <MemoryRouter initialEntries={['/procurement/marketplace']}>
        <LocationProbe />
        <ProcurexStaticPage pageKey="marketplace" html={marketplaceHtml} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('tab', { name: 'My Bids' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/procurement/my-bids'));
    expect(screen.getByRole('tab', { name: 'My Bids' })).toHaveAttribute('aria-selected', 'true');
  });
});
