import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { store } from '@/app/store';
import { signOut } from '@/features/auth/slice';
import { tenderPlanningApi } from '../../api';
import { TenderPlanningProcurexPage } from './TenderPlanningProcurexPage';

function renderPlanningPage(initialEntries = ['/tender-planning']) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/tender-planning" element={<TenderPlanningProcurexPage />} />
          <Route path="/procurement/create-tender" element={<div>Create tender route</div>} />
          <Route path="/evaluation" element={<div>Evaluation route</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

function seedPlanningRecords() {
  const records = [
    {
      id: 'user-plan-fleet',
      financialYear: '2026/2027',
      tenderTitle: 'Fleet maintenance framework agreement',
      openingDate: '2026-07-20',
      closingDate: '2026-08-12',
      category: 'Non Consultancy',
      budget: 125000000,
      procurementMethod: 'Framework',
      sourceOfFunds: 'Operational budget',
      expectedCompletionDate: '2026-09-18',
      status: 'Inactive',
      planState: 'Not started',
      notes: 'Funding approved by finance'
    }
  ];

  window.localStorage.setItem('procurex.procurementPlans.v4', JSON.stringify(records));
}

describe('TenderPlanningProcurexPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(tenderPlanningApi, 'listPlans').mockRejectedValue(new Error('Planning API unavailable in component tests.'));
    vi.spyOn(tenderPlanningApi, 'saveAnnualPlan').mockRejectedValue(new Error('Planning API unavailable in component tests.'));
    store.dispatch(signOut());
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders the ProcureX procurement planning dashboard', () => {
    renderPlanningPage();

    expect(screen.getByRole('heading', { name: 'Procurement Planning' })).toBeInTheDocument();
    expect(screen.getByText('Create, upload, view, and download procurement plans. Use the Plan action to finish tender requirements before publication.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your procurement plan will appear here once you create or upload it.' })).toBeInTheDocument();
    expect(screen.getByText('TZS 0')).toBeInTheDocument();
  });

  it('opens the full worksheet view from the quick plan table', () => {
    renderPlanningPage();

    fireEvent.click(screen.getByRole('button', { name: /View Plan/i }));

    expect(screen.getByRole('heading', { name: '2026/2027 annual procurement plan' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Expected Completion Date' })).toBeInTheDocument();
  });

  it('uploads directly into the full worksheet without showing the import panel', () => {
    renderPlanningPage();

    fireEvent.click(screen.getAllByRole('button', { name: /Upload Plan/i })[0]);
    expect(screen.queryByText('Import Excel plan')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Upload annual procurement plan Excel file'), {
      target: {
        files: [new File(['mock excel'], 'annual-plan-upload.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })]
      }
    });

    expect(screen.getByRole('heading', { name: '2026/2027 annual procurement plan' })).toBeInTheDocument();
    expect(screen.getAllByText('annual plan upload').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Uploaded from Excel').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Imported file: annual-plan-upload.xlsx').length).toBeGreaterThan(0);
  });

  it('opens record details using the same plan data', () => {
    seedPlanningRecords();
    renderPlanningPage();

    fireEvent.click(screen.getAllByRole('button', { name: 'Details' })[0]);

    expect(screen.getByRole('heading', { name: 'Fleet maintenance framework agreement' })).toBeInTheDocument();
    expect(screen.getAllByText('Funding approved by finance').length).toBeGreaterThan(0);
  });

  it('replaces stale local records when the backend is reachable and empty', async () => {
    seedPlanningRecords();
    vi.mocked(tenderPlanningApi.listPlans).mockResolvedValue({
      plans: [],
      records: [],
      summary: {
        financialYear: null,
        years: [],
        totalPlans: 0,
        totalLines: 0,
        totalBudget: 0,
        byStatus: [],
        byCategory: []
      },
      totalPlans: 0,
      page: 1,
      pageSize: 100,
      totalPages: 1
    });

    renderPlanningPage();

    await waitFor(() => {
      expect(screen.queryByText('Fleet maintenance framework agreement')).not.toBeInTheDocument();
    });
    expect(window.localStorage.getItem('procurex.procurementPlans.v4')).toBe('[]');
  });

  it('saves a created plan into the annual plan table', () => {
    const { container } = renderPlanningPage();

    fireEvent.click(screen.getAllByRole('button', { name: /Create Plan/i })[0]);
    const tenderInput = container.querySelector<HTMLInputElement>('input[name="tenderTitle"]');
    expect(tenderInput).toBeInTheDocument();

    fireEvent.change(tenderInput as HTMLInputElement, { target: { value: 'MRI maintenance package' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Plan' }));

    expect(screen.getAllByText('MRI maintenance package').length).toBeGreaterThan(0);
    expect(window.localStorage.getItem('procurex.procurementPlans.v4')).toContain('MRI maintenance package');
  });

  it('hands a planned tender to the create tender route', () => {
    seedPlanningRecords();
    renderPlanningPage();

    fireEvent.click(screen.getByRole('button', { name: 'Plan' }));

    expect(screen.getByText('Create tender route')).toBeInTheDocument();
    expect(window.localStorage.getItem('procurex.planning.selectedTenderPlan')).toContain('Fleet maintenance framework agreement');
  });
});
