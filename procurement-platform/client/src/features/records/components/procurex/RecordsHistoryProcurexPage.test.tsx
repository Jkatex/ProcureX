/* Exercises records behavior so regressions are caught close to the domain workflow they protect. */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { store } from '@/app/store';
import { signOut } from '@/features/auth/slice';
import { recordsApi } from '@/features/records/api';
import '@/i18n';
import { RecordsHistoryProcurexPage } from './RecordsHistoryProcurexPage';

vi.mock('@/features/records/api', () => ({
  recordsApi: {
    getDashboard: vi.fn(),
    listRecords: vi.fn(),
    getCharts: vi.fn(),
    getInsights: vi.fn(),
    getDetail: vi.fn(),
    exportCsv: vi.fn(),
    exportPdf: vi.fn()
  }
}));

const getDashboard = vi.mocked(recordsApi.getDashboard);
const listRecords = vi.mocked(recordsApi.listRecords);
const getCharts = vi.mocked(recordsApi.getCharts);
const getInsights = vi.mocked(recordsApi.getInsights);

function renderRecordsPage() {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <RecordsHistoryProcurexPage />
      </MemoryRouter>
    </Provider>
  );
}

describe('RecordsHistoryProcurexPage', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/records');
    window.localStorage.clear();
    store.dispatch(signOut());

    getDashboard.mockReset();
    listRecords.mockReset();
    getCharts.mockReset();
    getInsights.mockReset();

    getDashboard.mockResolvedValue({
      tenderRecords: 1,
      bidRecords: 1,
      evaluationRecords: 0,
      awardRecords: 1,
      contractRecords: 1,
      activeContracts: 1,
      evidenceFiles: 0,
      archivedRecords: 0,
      recordedValue: 5000000,
      currency: 'TZS',
      totalRecords: 4
    });

    listRecords.mockResolvedValue({
      records: [],
      totalRecords: 0,
      page: 1,
      pageSize: 10,
      totalPages: 1
    });

    getCharts.mockResolvedValue({
      tendersByStatus: [{ label: 'Awarded', value: 1 }],
      procurementRecordsByMonth: [{ label: 'Jul 2026', value: 4 }],
      contractValueByCategory: [{ label: 'Medical', value: 5000000, amount: 5000000, currency: 'TZS' }],
      supplierParticipation: [{ label: 'Supplier A', value: 3 }],
      awardVsCancellationTrend: [{ label: 'Jul 2026', value: 1, secondaryValue: 0 }],
      complianceCompletionSummary: [{ label: 'Complete', value: 100 }],
      categories: ['Medical']
    });

    getInsights.mockResolvedValue({
      mostActiveCategory: 'Medical',
      highestValueRecord: {
        title: 'Medical supplies award',
        referenceNumber: 'PX-001',
        valueAmount: 5000000,
        currency: 'TZS'
      },
      bestSupplierParticipation: {
        supplierName: 'Supplier A',
        recordCount: 3
      },
      complianceCompletion: 100,
      awardSuccessRate: 100,
      averageTenderDuration: 5
    });
  });

  it('hides supplier participation and compliance completion summary chart panels', async () => {
    renderRecordsPage();

    await userEvent.click(screen.getByRole('button', { name: 'Charts & Insights' }));

    expect(await screen.findByRole('heading', { name: 'Tenders by Status' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Procurement Records by Month' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Contract Value by Category' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Award vs Cancellation Trend' })).toBeInTheDocument();

    expect(screen.queryByRole('heading', { name: 'Supplier Participation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Compliance Completion Summary' })).not.toBeInTheDocument();
    expect(screen.getByText('Best Supplier Participation')).toBeInTheDocument();
    expect(screen.getByText('Compliance Completion')).toBeInTheDocument();
  });
});
