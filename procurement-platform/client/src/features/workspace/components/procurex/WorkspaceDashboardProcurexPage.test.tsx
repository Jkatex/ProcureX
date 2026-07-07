import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { store } from '@/app/store';
import { signOut } from '@/features/auth/slice';
import { workspaceDashboardApi } from '@/features/workspace/api';
import { WorkspaceDashboardProcurexPage } from './WorkspaceDashboardProcurexPage';

vi.mock('@/features/workspace/api', () => ({
  workspaceDashboardApi: {
    getWorkspaceDashboard: vi.fn()
  }
}));

const getWorkspaceDashboard = vi.mocked(workspaceDashboardApi.getWorkspaceDashboard);

function renderDashboard() {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <WorkspaceDashboardProcurexPage />
      </MemoryRouter>
    </Provider>
  );
}

describe('WorkspaceDashboardProcurexPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    store.dispatch(signOut());
    getWorkspaceDashboard.mockReset();
  });

  it('hydrates dashboard metrics from the backend API', async () => {
    getWorkspaceDashboard.mockResolvedValueOnce({
      summary: {
        urgentCount: 2,
        workflowCount: 9,
        unreadMessages: 3,
        myTenders: 4,
        myBids: 5,
        recordedValue: 7250000,
        currency: 'TZS',
        complianceStatus: 'Attention needed'
      },
      executive: {
        transactionValue: 9000000,
        completedOrders: 3,
        activeOrders: 6,
        orderSuccessRate: 33.33,
        transactionGrowthRate: 18.4,
        averageOrderValue: 1500000,
        currency: 'TZS'
      },
      pipeline: [
        { stage: 'Draft', count: 1, route: '/procurement/create-tender' },
        { stage: 'Published', count: 2, route: '/procurement/marketplace' },
        { stage: 'Evaluation', count: 3, route: '/evaluation' },
        { stage: 'Award', count: 1, route: '/awards-contracts' },
        { stage: 'Contract', count: 1, route: '/awards-contracts/negotiation' },
        { stage: 'Completed', count: 1, route: '/records' }
      ],
      metrics: [
        { label: 'My tenders', value: '4', note: 'Tenders created by the selected organization.' },
        { label: 'My bids', value: '5', note: 'Bid drafts and submitted opportunities.' },
        { label: 'Recorded value', value: 'TZS 7,250,000', note: 'Plan, tender, bid, award, and contract value.' },
        { label: 'Unread messages', value: '3', note: 'Unread communication owned by this mailbox.' }
      ],
      actionQueue: [
        {
          id: 'message:1',
          title: 'Clarification required',
          subtitle: 'Tender Clarification',
          status: 'Action Required',
          route: '/communication',
          priority: 'Urgent',
          createdAt: '2026-06-11T10:00:00.000Z'
        }
      ],
      deadlines: [
        {
          id: 'tender:1',
          title: 'PX-2026-001 - Medical supplies',
          date: '2026-07-01T00:00:00.000Z',
          kind: 'Tender closing',
          route: '/procurement/marketplace'
        }
      ],
      activeWork: [
        {
          id: 'tender:1',
          type: 'Tender',
          title: 'Medical supplies',
          status: 'Open',
          nextAction: 'Monitor supplier activity',
          deadline: '2026-07-01T00:00:00.000Z',
          route: '/procurement/marketplace',
          priority: 'High'
        }
      ],
      generatedAt: '2026-06-11T10:00:00.000Z'
    });

    renderDashboard();

    expect(await screen.findByText('Live workspace dashboard')).toBeInTheDocument();
    expect(screen.getAllByText(/TZS\s*7,250,000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Clarification required').length).toBeGreaterThan(0);
    expect(screen.getAllByText('PX-2026-001 - Medical supplies').length).toBeGreaterThan(0);
    expect(screen.getByText(/Monitor supplier activity/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Executive KPI Snapshot' })).toBeInTheDocument();
    expect(screen.getByText('Transaction value')).toBeInTheDocument();
    expect(screen.getByText('Completed orders')).toBeInTheDocument();
    expect(screen.getByText('Order success rate')).toBeInTheDocument();
    expect(screen.getByText('Transaction growth')).toBeInTheDocument();
    expect(screen.getByText('Average order value')).toBeInTheDocument();
    expect(screen.getByText('Active orders')).toBeInTheDocument();
    expect(screen.getByText(/\+18%/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Procurement Status Overview' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Latest workspace movement' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Procurement lifecycle status' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recommended first actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Workspace apps' })).not.toBeInTheDocument();
  });

  it('keeps first-run app guidance visible for a new empty workspace', async () => {
    getWorkspaceDashboard.mockResolvedValueOnce({
      summary: {
        urgentCount: 0,
        workflowCount: 0,
        unreadMessages: 0,
        myTenders: 0,
        myBids: 0,
        recordedValue: 0,
        currency: 'TZS',
        complianceStatus: 'Clear'
      },
      pipeline: [
        { stage: 'Draft', count: 0, route: '/procurement/create-tender' },
        { stage: 'Published', count: 0, route: '/procurement/marketplace' },
        { stage: 'Evaluation', count: 0, route: '/evaluation' },
        { stage: 'Award', count: 0, route: '/awards-contracts' },
        { stage: 'Contract', count: 0, route: '/awards-contracts/negotiation' },
        { stage: 'Completed', count: 0, route: '/records' }
      ],
      metrics: [
        { label: 'My tenders', value: '0', note: 'Tenders you create will be counted here.' },
        { label: 'My bids', value: '0', note: 'Bid drafts and submissions will appear after activity starts.' },
        { label: 'Recorded value', value: 'TZS 0', note: 'Procurement value is calculated from real plan and tender records.' },
        { label: 'Unread messages', value: '0', note: 'New platform communication will be surfaced here.' }
      ],
      actionQueue: [],
      deadlines: [],
      activeWork: [],
      generatedAt: '2026-06-11T10:00:00.000Z'
    });

    renderDashboard();

    expect(await screen.findByText('First run dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Procurement lifecycle status' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recommended first actions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workspace apps' })).toBeInTheDocument();
  });

  it('treats created tenders as continuing activity even when no queue rows exist', async () => {
    getWorkspaceDashboard.mockResolvedValueOnce({
      summary: {
        urgentCount: 0,
        workflowCount: 0,
        unreadMessages: 0,
        myTenders: 1,
        myBids: 0,
        recordedValue: 0,
        currency: 'TZS',
        complianceStatus: 'Clear'
      },
      pipeline: [
        { stage: 'Draft', count: 0, route: '/procurement/create-tender' },
        { stage: 'Published', count: 0, route: '/procurement/marketplace' },
        { stage: 'Evaluation', count: 0, route: '/evaluation' },
        { stage: 'Award', count: 0, route: '/awards-contracts' },
        { stage: 'Contract', count: 0, route: '/awards-contracts/negotiation' },
        { stage: 'Completed', count: 0, route: '/records' }
      ],
      metrics: [
        { label: 'My tenders', value: '1', note: 'Tenders created by the selected organization.' },
        { label: 'My bids', value: '0', note: 'Bid drafts and submitted opportunities.' },
        { label: 'Recorded value', value: 'TZS 0', note: 'Plan, tender, bid, award, and contract value.' },
        { label: 'Unread messages', value: '0', note: 'Unread communication owned by this mailbox.' }
      ],
      actionQueue: [],
      deadlines: [],
      activeWork: [],
      generatedAt: '2026-06-11T10:00:00.000Z'
    });

    renderDashboard();

    expect(await screen.findByText('Live workspace dashboard')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recommended first actions' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Workspace apps' })).not.toBeInTheDocument();
  });
});
