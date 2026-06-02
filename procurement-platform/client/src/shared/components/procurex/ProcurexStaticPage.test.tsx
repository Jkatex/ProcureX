import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import i18n, { persistLanguage } from '@/i18n';
import { ProcurexStaticPage } from './ProcurexStaticPage';

const selectedEvaluationTenderKey = 'procurex.selectedEvaluationTender';
const selectedEvaluationReportKey = 'procurex.selectedEvaluationReport';

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
});
