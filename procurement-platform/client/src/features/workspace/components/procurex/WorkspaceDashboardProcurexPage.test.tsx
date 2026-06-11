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
    expect(screen.getByText('TZS 7,250,000')).toBeInTheDocument();
    expect(screen.getByText('Clarification required')).toBeInTheDocument();
    expect(screen.getByText('PX-2026-001 - Medical supplies')).toBeInTheDocument();
    expect(screen.getByText('Monitor supplier activity')).toBeInTheDocument();
  });
});
