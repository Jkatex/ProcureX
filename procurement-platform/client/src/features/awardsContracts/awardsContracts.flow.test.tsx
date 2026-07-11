import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { store } from '@/app/store';
import '@/i18n';
import { summaryCards } from './fixtures';
import { awardsContractsApi } from './api';
import type { ContractDetailDto, LifecycleAction } from './types';
import { AwardingContractsProcurexPage } from './components/procurex/AwardingContractsProcurexPage';
import { AwardRecommendationProcurexPage } from './components/procurex/AwardRecommendationProcurexPage';
import { AwardResponseProcurexPage } from './components/procurex/AwardResponseProcurexPage';
import { ActionFormPanel } from './components/procurex/AwardContractActionForms';
import { AwardContractAccessProvider } from './components/procurex/AwardContractRoleAccess';
import { ContractNegotiationProcurexPage } from './components/procurex/ContractNegotiationProcurexPage';
import { PostAwardTrackingProcurexPage } from './components/procurex/PostAwardTrackingProcurexPage';

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderFlow(page: ReactNode, initialEntry: string) {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        {page}
        <LocationProbe />
      </MemoryRouter>
    </Provider>
  );
}

function lifecycleAction(overrides: Partial<LifecycleAction> & Pick<LifecycleAction, 'id' | 'title'>): LifecycleAction {
  return {
    id: overrides.id,
    roleContext: overrides.roleContext ?? 'BUYER',
    sourceType: overrides.sourceType ?? 'TENDER_CREATED',
    tenderId: overrides.tenderId ?? 'tender-test',
    awardId: overrides.awardId ?? null,
    noticeId: overrides.noticeId ?? null,
    contractId: overrides.contractId ?? null,
    reference: overrides.reference ?? null,
    noticeReference: overrides.noticeReference ?? null,
    title: overrides.title,
    otherParty: overrides.otherParty ?? 'Test counterparty',
    currentStage: overrides.currentStage ?? 'Workflow',
    requiredAction: overrides.requiredAction ?? 'Continue',
    dueDate: overrides.dueDate ?? new Date().toISOString(),
    riskLevel: overrides.riskLevel ?? 'Medium',
    status: overrides.status ?? 'OPEN',
    amount: overrides.amount ?? 1000,
    currency: overrides.currency ?? 'TZS',
    nextRoute: overrides.nextRoute ?? '/awards-contracts',
    nextAction: overrides.nextAction
  };
}

function contractDetail(overrides: Partial<ContractDetailDto> = {}): ContractDetailDto {
  return {
    id: 'contract-1',
    reference: 'PX-C-1',
    title: 'Road maintenance contract',
    status: 'ACTIVE',
    buyerName: 'Buyer Org',
    supplierName: 'Supplier Org',
    amount: 90000000,
    currency: 'TZS',
    payload: {},
    parties: [],
    clauses: [],
    negotiations: [],
    signatures: [],
    milestones: [],
    managementPlan: null,
    mobilizationItems: [],
    kpis: [],
    deliverables: [],
    acceptances: [],
    inspections: [],
    goodsInspections: [],
    paymentSchedules: [],
    invoices: [],
    payments: [],
    threeWayMatches: [],
    paymentApprovals: [],
    paymentConfirmations: [],
    purchaseOrders: [],
    risks: [],
    riskForecasts: [],
    variations: [],
    issues: [],
    disputes: [],
    terminations: [],
    warranties: [],
    requiredDocuments: [],
    workflowApprovals: [],
    urgentActions: [],
    notifications: [],
    closeout: null,
    supplierPerformanceRecords: [],
    performanceScores: [],
    supplierRiskProfile: null,
    audit: [],
    ...overrides
  };
}

describe('awards and contracts empty lifecycle flow', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the requested dashboard queue from the URL with an empty state', async () => {
    const { container } = renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=awards-received');

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Awards Received' })).toHaveClass('active'));

    const panel = container.querySelector<HTMLElement>('[data-tab="awards-received"].tab-content--visible');
    expect(panel).toBeInTheDocument();
    expect(within(panel!).getByText(/No supplier awards have been received yet/i)).toBeInTheDocument();
  });

  it('updates dashboard queue URLs from summary cards and side navigation', async () => {
    const user = userEvent.setup();
    const { container } = renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts');

    await waitFor(() => expect(screen.getByRole('button', { name: 'Go to Closed Contracts tab' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Go to Closed Contracts tab' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts?queue=closed-contracts'));
    expect(screen.getByRole('tab', { name: 'Closed Contracts' })).toHaveClass('active');

    const sideNavAwardsReceived = container.querySelector<HTMLElement>(
      '.sidebar-nav [data-awarding-tab-jump="awards-received"]'
    );
    expect(sideNavAwardsReceived).toBeInTheDocument();
    await user.click(sideNavAwardsReceived!);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts?queue=awards-received'));
    expect(screen.getByRole('tab', { name: 'Awards Received' })).toHaveClass('active');
  });

  it('renders dashboard summary counts as zero', async () => {
    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts');

    await waitFor(() => expect(screen.getByRole('tab', { name: 'My Urgent Actions' })).toBeInTheDocument());
    for (const card of summaryCards) {
      const summary = screen.getByRole('button', { name: `Go to ${card.label} tab` });
      expect(within(summary).getByText('0')).toBeInTheDocument();
    }
  });

  it('shows an empty urgent actions queue', async () => {
    const { container } = renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=my-urgent-actions');

    await waitFor(() => expect(container.querySelector<HTMLElement>('[data-tab="my-urgent-actions"].tab-content--visible')).toBeInTheDocument());
    const panel = container.querySelector<HTMLElement>('[data-tab="my-urgent-actions"].tab-content--visible');
    expect(within(panel!).getByText(/No urgent award or contract actions yet/i)).toBeInTheDocument();
  });

  it('shows a retryable dashboard load error instead of an empty queue', async () => {
    const user = userEvent.setup();
    const dashboard = vi.spyOn(awardsContractsApi, 'dashboard')
      .mockRejectedValueOnce(new Error('API offline'))
      .mockResolvedValueOnce({
        summary: { urgentActions: 0, awardQueues: 0, contractActions: 0 },
        queues: {
          'my-urgent-actions': [],
          'awarding-in-progress': [],
          'awards-received': [],
          'contracts-in-progress': [],
          'active-contracts': [],
          'closed-contracts': []
        }
      });

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts');

    await waitFor(() => expect(screen.getByText('Awarding and contracts could not be loaded')).toBeInTheDocument());
    expect(screen.getByText('API offline')).toBeInTheDocument();
    expect(screen.queryByText('No urgent award or contract actions yet.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry loading' }));
    await waitFor(() => expect(screen.getByText(/No urgent award or contract actions yet/i)).toBeInTheDocument());
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it('renders empty child workspaces without selected records', async () => {
    renderFlow(<AwardRecommendationProcurexPage />, '/awards-contracts/recommendation');
    await waitFor(() => expect(screen.getByText('No evaluation result is ready for awarding.')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Back to Award Queue' })).toHaveAttribute('data-route-search', 'queue=awarding-in-progress');

    renderFlow(<AwardResponseProcurexPage />, '/awards-contracts/award-response');
    await waitFor(() => expect(screen.getAllByText('No award selected').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Open Awards Received Queue' })).toHaveAttribute('data-route-search', 'queue=awards-received');

    renderFlow(<ContractNegotiationProcurexPage />, '/awards-contracts/negotiation');
    expect(screen.getByText('No contract is in progress.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Contract Queue' })).toHaveAttribute('data-route-search', 'queue=contracts-in-progress');

    renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award');
    expect(screen.getByText('No post-award records are available yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Active Contracts' })).toHaveAttribute('data-route-search', 'queue=active-contracts');
  });

  it('groups populated award recommendation controls into readable workflow sections', async () => {
    const user = userEvent.setup();
    const awardAction = {
      id: 'award-rec-1',
      roleContext: 'BUYER' as const,
      sourceType: 'TENDER_CREATED' as const,
      tenderId: 'tender-1',
      awardId: 'rec-1',
      noticeId: 'notice-1',
      contractId: 'contract-1',
      title: 'Medical supplies tender',
      otherParty: 'Kilimanjaro Supplies',
      currentStage: 'Award approval',
      requiredAction: 'Approve award',
      dueDate: new Date().toISOString(),
      riskLevel: 'Medium' as const,
      status: 'RECOMMENDED',
      amount: 140000000,
      currency: 'TZS',
      nextRoute: '/awards-contracts/recommendation?recommendation=rec-1'
    };
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { urgentActions: 0, awardQueues: 1, contractActions: 0 },
      queues: {
        'my-urgent-actions': [],
        'awarding-in-progress': [awardAction],
        'awards-received': [],
        'contracts-in-progress': [],
        'active-contracts': [],
        'closed-contracts': []
      }
    });
    vi.spyOn(awardsContractsApi, 'recommendation').mockResolvedValue({
      ...awardAction,
      approvalRoutes: [{ id: 'bd822b04-54c0-4c89-a4f2-32c8db2cf72f', title: 'Single-user award approval', status: 'APPROVED', note: 'Seeded single-user approval.' }],
      tieBreakers: [{ id: 'tie-1', title: 'Delivery tie-breaker', status: 'RESOLVED', note: 'Tie-breaker resolved.' }],
      feasibilityChecks: [{ id: 'feasibility-1', title: 'Delivery feasibility', status: 'APPROVED', note: 'Feasibility approved.' }],
      standstillPeriods: [],
      awardNotifications: [],
      budgetCommitments: [{ id: 'budget-1', budgetCode: 'PROCUREMENT.AWARD', status: 'PENDING', note: 'Budget reserved.' }],
      audit: []
    });

    renderFlow(<AwardRecommendationProcurexPage />, '/awards-contracts/recommendation?recommendation=rec-1');

    await waitFor(() => expect(screen.getByRole('tab', { name: /Evaluation result/i })).toHaveClass('active'));
    expect(screen.getByRole('heading', { name: /Step 1 of 9: Evaluation result/i })).toBeInTheDocument();
    expect(screen.getAllByText('6 readiness checks').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Award readiness review' })).toBeInTheDocument();
    expect(screen.getByText('Evaluation handoff checks')).toBeInTheDocument();
    expect(screen.getAllByText('Evaluation committee').length).toBeGreaterThan(0);
    expect(screen.getByText('Buyer procurement officer')).toBeInTheDocument();
    expect(screen.getByText('Budget owner')).toBeInTheDocument();
    expect(screen.queryByText('Logged-in buyer user')).not.toBeInTheDocument();
    expect(screen.queryByText(/Actor user ID/i)).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Medical supplies tender/i })).toHaveAttribute('aria-current', 'true');

    await user.click(screen.getByRole('tab', { name: /Step 3 Approval/i }));
    expect(screen.queryByText(/ID bd822b04/)).not.toBeInTheDocument();
    expect(screen.getByText('Tie-breaker and feasibility')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Step 4 Winners/i }));
    expect(screen.getByText('Winning bidders and source bid documents')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: /Step 5 Award clauses/i }));
    expect(screen.getByText('Negotiated terms before notice')).toBeInTheDocument();
  });

  it('renders dashboard queue items as action cards', async () => {
    const user = userEvent.setup();
    const awardAction = {
      id: 'award-card-1',
      roleContext: 'BUYER' as const,
      sourceType: 'TENDER_CREATED' as const,
      tenderId: 'tender-card-1',
      awardId: 'rec-card-1',
      noticeId: null,
      contractId: null,
      title: 'Road maintenance award',
      otherParty: 'Arusha Works Ltd',
      currentStage: 'Award approval',
      requiredAction: 'Approve award',
      dueDate: new Date().toISOString(),
      riskLevel: 'Medium' as const,
      status: 'RECOMMENDED',
      amount: 90000000,
      currency: 'TZS',
      nextRoute: '/awards-contracts/recommendation?recommendation=rec-card-1',
      nextAction: {
        key: 'approve-award',
        label: 'Approve award',
        url: '/awards-contracts/recommendation?recommendation=rec-card-1',
        method: 'GET' as const,
        canAct: true,
        disabledReason: null,
        requiredRole: 'BUYER' as const,
        requiredEvidence: []
      }
    };
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { urgentActions: 0, awardQueues: 1, contractActions: 0 },
      queues: {
        'my-urgent-actions': [],
        'awarding-in-progress': [awardAction],
        'awards-received': [],
        'contracts-in-progress': [],
        'active-contracts': [],
        'closed-contracts': []
      }
    });

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=awarding-in-progress');

    await waitFor(() => expect(screen.getByText('Road maintenance award')).toBeInTheDocument());
    expect(screen.getByText('Arusha Works Ltd')).toBeInTheDocument();
    expect(screen.getByText('Award approval')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve award' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: 'Approve award' })).toBeInTheDocument());
    expect(screen.getByText(/Continue to the dedicated workspace for this action/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts/recommendation?recommendation=rec-card-1&step=award-decision'));
  });

  it('filters buyer-side awarding records by search text', async () => {
    const user = userEvent.setup();
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { urgentActions: 0, awardQueues: 2, contractActions: 0 },
      queues: {
        'my-urgent-actions': [],
        'awarding-in-progress': [
          {
            id: 'award-card-1',
            roleContext: 'BUYER' as const,
            sourceType: 'TENDER_CREATED' as const,
            tenderId: 'tender-card-1',
            awardId: 'rec-card-1',
            noticeId: null,
            contractId: null,
            title: 'Road maintenance award',
            otherParty: 'Arusha Works Ltd',
            currentStage: 'Award approval',
            requiredAction: 'Approve award',
            dueDate: new Date().toISOString(),
            riskLevel: 'Medium' as const,
            status: 'RECOMMENDED',
            amount: 90000000,
            currency: 'TZS',
            nextRoute: '/awards-contracts/recommendation?recommendation=rec-card-1'
          },
          {
            id: 'award-card-2',
            roleContext: 'BUYER' as const,
            sourceType: 'TENDER_CREATED' as const,
            tenderId: 'tender-card-2',
            awardId: 'rec-card-2',
            noticeId: null,
            contractId: null,
            title: 'Hospital supplies award',
            otherParty: 'Dodoma Medical Stores',
            currentStage: 'Notice preparation',
            requiredAction: 'Issue award notice',
            dueDate: new Date().toISOString(),
            riskLevel: 'Low' as const,
            status: 'APPROVED',
            amount: 50000000,
            currency: 'TZS',
            nextRoute: '/awards-contracts/recommendation?recommendation=rec-card-2'
          }
        ],
        'awards-received': [],
        'contracts-in-progress': [],
        'active-contracts': [],
        'closed-contracts': []
      }
    });

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=awarding-in-progress');

    await waitFor(() => expect(screen.getByText('Road maintenance award')).toBeInTheDocument());
    expect(screen.getByText('Hospital supplies award')).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', { name: 'Search award and contract records' }), 'Arusha');
    expect(screen.getByText('Showing 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('Road maintenance award')).toBeInTheDocument();
    expect(screen.queryByText('Hospital supplies award')).not.toBeInTheDocument();
  });

  it('filters supplier award and contract queues with the shared search box', async () => {
    const user = userEvent.setup();
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { urgentActions: 0, awardQueues: 2, contractActions: 6 },
      queues: {
        'my-urgent-actions': [],
        'awarding-in-progress': [],
        'awards-received': [
          lifecycleAction({ id: 'supplier-award-1', roleContext: 'SUPPLIER', sourceType: 'AWARD_RECEIVED', title: 'Zanzibar clinic award', otherParty: 'Zanzibar Health Board', awardId: 'rec-zanzibar-1', noticeId: 'notice-zanzibar-1', requiredAction: 'Respond to notice' }),
          lifecycleAction({ id: 'supplier-award-2', roleContext: 'SUPPLIER', sourceType: 'AWARD_RECEIVED', title: 'Mwanza warehouse award', otherParty: 'Mwanza Stores', awardId: 'rec-mwanza-1', noticeId: 'notice-mwanza-1', requiredAction: 'Respond to notice' })
        ],
        'contracts-in-progress': [
          lifecycleAction({ id: 'contract-progress-1', sourceType: 'CONTRACT_ACTIVE', title: 'Zanzibar clinic contract draft', otherParty: 'Zanzibar Health Board', contractId: 'contract-zanzibar-1', currentStage: 'Negotiation' }),
          lifecycleAction({ id: 'contract-progress-2', sourceType: 'CONTRACT_ACTIVE', title: 'Dodoma school contract draft', otherParty: 'Dodoma Council', contractId: 'contract-dodoma-1', currentStage: 'Negotiation' })
        ],
        'active-contracts': [
          lifecycleAction({ id: 'active-contract-1', sourceType: 'CONTRACT_ACTIVE', title: 'Zanzibar active clinic supply', otherParty: 'Zanzibar Health Board', contractId: 'contract-zanzibar-active', status: 'ACTIVE' }),
          lifecycleAction({ id: 'active-contract-2', sourceType: 'CONTRACT_ACTIVE', title: 'Arusha active road works', otherParty: 'Arusha Works', contractId: 'contract-arusha-active', status: 'ACTIVE' })
        ],
        'closed-contracts': [
          lifecycleAction({ id: 'closed-contract-1', sourceType: 'CONTRACT_ACTIVE', title: 'Zanzibar closed maintenance', otherParty: 'Zanzibar Health Board', contractId: 'contract-zanzibar-closed', status: 'CLOSED' }),
          lifecycleAction({ id: 'closed-contract-2', sourceType: 'CONTRACT_ACTIVE', title: 'Mbeya closed ICT support', otherParty: 'Mbeya ICT', contractId: 'contract-mbeya-closed', status: 'CLOSED' })
        ]
      }
    });

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=awards-received');

    await waitFor(() => expect(screen.getByText('Zanzibar clinic award')).toBeInTheDocument());
    const search = screen.getByRole('textbox', { name: 'Search award and contract records' });
    await user.type(search, 'Zanzibar');

    expect(screen.getByText('Zanzibar clinic award')).toBeInTheDocument();
    expect(screen.queryByText('Mwanza warehouse award')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Contracts in Progress' }));
    expect(screen.getByText('Zanzibar clinic contract draft')).toBeInTheDocument();
    expect(screen.queryByText('Dodoma school contract draft')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Active Contracts' }));
    expect(screen.getByText('Zanzibar active clinic supply')).toBeInTheDocument();
    expect(screen.queryByText('Arusha active road works')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Closed Contracts' }));
    expect(screen.getByText('Zanzibar closed maintenance')).toBeInTheDocument();
    expect(screen.queryByText('Mbeya closed ICT support')).not.toBeInTheDocument();
  });

  it('applies saved role and risk filter chips on the dashboard', async () => {
    const user = userEvent.setup();
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { urgentActions: 2, awardQueues: 0, contractActions: 0 },
      queues: {
        'my-urgent-actions': [
          lifecycleAction({ id: 'buyer-urgent-1', roleContext: 'BUYER', title: 'Buyer urgent award approval', otherParty: 'Buyer party', riskLevel: 'High' }),
          lifecycleAction({ id: 'supplier-urgent-1', roleContext: 'SUPPLIER', sourceType: 'AWARD_RECEIVED', title: 'Supplier urgent award response', otherParty: 'Supplier party', riskLevel: 'Low' })
        ],
        'awarding-in-progress': [],
        'awards-received': [],
        'contracts-in-progress': [],
        'active-contracts': [],
        'closed-contracts': []
      }
    });

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=my-urgent-actions');

    await waitFor(() => expect(screen.getByText('Buyer urgent award approval')).toBeInTheDocument());
    expect(screen.queryByText('Buyer work')).not.toBeInTheDocument();
    expect(screen.queryByText('Supplier work')).not.toBeInTheDocument();
    expect(screen.queryByText('Due this week')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Supplier' }));
    expect(screen.getByText('Supplier urgent award response')).toBeInTheDocument();
    expect(screen.queryByText('Buyer urgent award approval')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'High risk' }));
    expect(screen.getByText('Buyer urgent award approval')).toBeInTheDocument();
    expect(screen.queryByText('Supplier urgent award response')).not.toBeInTheDocument();
  });

  it('refreshes persisted supplier award response detail after submit', async () => {
    const user = userEvent.setup();
    const awardAction = lifecycleAction({
      id: 'supplier-award-refresh',
      roleContext: 'SUPPLIER',
      sourceType: 'AWARD_RECEIVED',
      title: 'Water pumps award notice',
      otherParty: 'Coastal Water Authority',
      awardId: 'rec-supplier-refresh',
      noticeId: 'notice-supplier-refresh',
      contractId: null,
      currentStage: 'Supplier response',
      requiredAction: 'Respond to award notice',
      status: 'ISSUED',
      amount: 25000000
    });
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { urgentActions: 0, awardQueues: 1, contractActions: 0 },
      queues: {
        'my-urgent-actions': [],
        'awarding-in-progress': [],
        'awards-received': [awardAction],
        'contracts-in-progress': [],
        'active-contracts': [],
        'closed-contracts': []
      }
    });
    vi.spyOn(awardsContractsApi, 'recommendation')
      .mockResolvedValueOnce({
        ...awardAction,
        notice: { id: 'notice-supplier-refresh', reference: 'AWN-001', status: 'ISSUED', contractId: null },
        audit: [{ event: 'AWARD_NOTICE_ISSUED', actorUserId: null, createdAt: '2026-01-01T08:00:00.000Z' }]
      })
      .mockResolvedValueOnce({
        ...awardAction,
        status: 'ACCEPTED',
        notice: { id: 'notice-supplier-refresh', reference: 'AWN-001', status: 'ACCEPTED', contractId: 'contract-refresh-1' },
        audit: [
          { event: 'AWARD_NOTICE_ISSUED', actorUserId: null, createdAt: '2026-01-01T08:00:00.000Z' },
          { event: 'SUPPLIER_ACCEPTED_AWARD', actorUserId: 'supplier-user-1', createdAt: '2026-01-01T09:00:00.000Z' }
        ]
      });
    const respond = vi.spyOn(awardsContractsApi, 'respondToNotice').mockResolvedValue({});

    renderFlow(<AwardResponseProcurexPage />, '/awards-contracts/award-response?award=rec-supplier-refresh');

    await waitFor(() => expect(screen.getAllByText('Water pumps award notice').length).toBeGreaterThan(0));
    await waitFor(() => expect(screen.getByText('AWN-001')).toBeInTheDocument());

    const responseTab = screen.getAllByRole('tab').find((tab) => within(tab).queryByText('Response'));
    expect(responseTab).toBeDefined();
    await user.click(responseTab!);
    await user.click(screen.getByRole('button', { name: 'Open action' }));
    await user.click(screen.getByRole('button', { name: 'Submit Response' }));

    await waitFor(() => expect(respond).toHaveBeenCalledWith('notice-supplier-refresh', 'ACCEPT', expect.any(String), expect.any(Object)));
    const registersTab = screen.getAllByRole('tab').find((tab) => within(tab).queryByText('Activity'));
    expect(registersTab).toBeDefined();
    await user.click(registersTab!);

    await waitFor(() => expect(screen.getByText('SUPPLIER_ACCEPTED_AWARD')).toBeInTheDocument());
    expect(screen.getByText(/Linked contract is ready for negotiation/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Supplier response submitted: ACCEPT/i).length).toBeGreaterThan(0);
  });

  it('uses linked pickers for award recommendation context fields', async () => {
    const user = userEvent.setup();
    const awardAction = lifecycleAction({
      id: 'award-picker-rec',
      roleContext: 'BUYER',
      title: 'Clinic equipment award',
      otherParty: 'Moshi Clinical Supplies',
      awardId: 'rec-picker-1',
      contractId: 'contract-picker-1',
      requiredAction: 'Approve award',
      status: 'RECOMMENDED'
    });
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { urgentActions: 0, awardQueues: 1, contractActions: 0 },
      queues: {
        'my-urgent-actions': [],
        'awarding-in-progress': [awardAction],
        'awards-received': [],
        'contracts-in-progress': [],
        'active-contracts': [],
        'closed-contracts': []
      }
    });
    vi.spyOn(awardsContractsApi, 'recommendation').mockResolvedValue({
      ...awardAction,
      reference: 'AWR-001',
      tenderReference: 'TDR-001',
      supplierOrgId: 'supplier-org-1',
      supplierName: 'Moshi Clinical Supplies',
      bidId: 'bid-1',
      notice: { id: 'notice-picker-1', reference: 'AWN-001', status: 'PENDING_RESPONSE', contractId: 'contract-picker-1' },
      contract: {
        id: 'contract-picker-1',
        reference: 'PX-C-PICKER',
        title: 'Clinic equipment contract',
        status: 'NEGOTIATION',
        buyerName: 'Buyer Org',
        supplierName: 'Moshi Clinical Supplies',
        amount: 1000,
        currency: 'TZS',
        payload: {},
        signatures: [],
        milestones: [],
        managementPlan: null,
        mobilizationItems: [],
        kpis: [],
        inspections: [],
        risks: [],
        variations: [],
        issues: [],
        disputes: [],
        terminations: [],
        closeout: null,
        supplierPerformanceRecords: [],
        audit: []
      },
      approvalRoutes: [],
      tieBreakers: [],
      feasibilityChecks: [],
      standstillPeriods: [],
      awardNotifications: [],
      budgetCommitments: [],
      audit: []
    });

    const { container } = renderFlow(<AwardRecommendationProcurexPage />, '/awards-contracts/recommendation?recommendation=rec-picker-1');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Clinic equipment award' })).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: /Approval/i }));
    const tieBreaker = container.querySelector('[data-award-contract-form="Tie-breaker"]') as HTMLElement;
    await user.click(within(tieBreaker).getByRole('button', { name: 'Open action' }));
    const tieDialog = screen.getByRole('dialog', { name: 'Tie-breaker' });
    expect(within(tieDialog).getByRole('searchbox', { name: /Tie-break outcome bid/i })).toBeInTheDocument();
    expect(within(tieDialog).queryByLabelText(/Outcome bid ID/i)).not.toBeInTheDocument();
    await user.click(within(tieDialog).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('tab', { name: /Step 7 Settlement/i }));
    const notice = container.querySelector('[data-award-contract-form="Award notification"]') as HTMLElement;
    await user.click(within(notice).getByRole('button', { name: 'Open action' }));
    expect(screen.getByRole('searchbox', { name: /Notice recipient/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Recipient organization ID/i)).not.toBeInTheDocument();
  });

  it('renders grouped contract formation and post-award tabs from contract detail', async () => {
    const contract = {
      id: 'contract-1',
      reference: 'PX-C-1',
      title: 'Road maintenance contract',
      status: 'NEGOTIATION',
      buyerName: 'Buyer Org',
      supplierName: 'Supplier Org',
      amount: 90000000,
      currency: 'TZS',
      payload: { draft: { parties: { buyer: 'Buyer Org' }, tender: {}, financials: {}, clauses: [] } },
      parties: [{ id: 'party-1', title: 'Buyer Org', status: 'BUYER' }],
      clauses: [{ id: 'clause-1', type: 'clause', title: 'Payment terms', status: 'OPEN', dueDate: null, note: 'Review required', payload: {}, createdAt: new Date().toISOString(), updatedAt: null }],
      negotiations: [],
      signatures: [],
      milestones: [],
      managementPlan: null,
      mobilizationItems: [],
      kpis: [],
      deliverables: [],
      acceptances: [],
      inspections: [],
      goodsInspections: [],
      paymentSchedules: [],
      invoices: [],
      payments: [],
      threeWayMatches: [],
      paymentApprovals: [],
      paymentConfirmations: [],
      risks: [],
      riskForecasts: [],
      variations: [],
      issues: [],
      disputes: [],
      terminations: [],
      warranties: [],
      requiredDocuments: [],
      workflowApprovals: [],
      urgentActions: [],
      notifications: [],
      closeout: null,
      supplierPerformanceRecords: [],
      performanceScores: [],
      supplierRiskProfile: null,
      audit: []
    };
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(contract);

    const contractRender = renderFlow(<ContractNegotiationProcurexPage />, '/awards-contracts/negotiation?contract=contract-1');
    await waitFor(() => expect(screen.getByRole('tab', { name: /Draft/i })).toBeInTheDocument());
    expect(screen.getAllByText('PX-C-1').length).toBeGreaterThan(0);
    expect(screen.getByText('Selected Contract')).toBeInTheDocument();
    expect(screen.getByText('Commercial terms')).toBeInTheDocument();
    expect(screen.queryByText(/\{"buyer"/i)).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Approval/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Records/i })).toBeInTheDocument();
    contractRender.unmount();

    renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award?contract=contract-1');
    await waitFor(() => expect(screen.getByRole('tab', { name: /CMP/i })).toBeInTheDocument());
    expect(screen.getAllByText('PX-C-1').length).toBeGreaterThan(0);
    expect(screen.getByText('Selected Contract')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Post-award health summary' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Payments/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Termination/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Registers/i })).toBeInTheDocument();
  });

  it('filters post-award contract management actions by focused group', async () => {
    const user = userEvent.setup();
    const contract = {
      id: 'contract-1',
      reference: 'PX-C-1',
      title: 'Road maintenance contract',
      status: 'ACTIVE',
      buyerName: 'Buyer Org',
      supplierName: 'Supplier Org',
      amount: 90000000,
      currency: 'TZS',
      payload: {},
      parties: [],
      clauses: [],
      negotiations: [],
      signatures: [],
      milestones: [{ id: 'milestone-1', type: 'milestone', title: 'Delivery milestone', status: 'OPEN', dueDate: null, note: 'Pending delivery', payload: {}, createdAt: new Date().toISOString(), updatedAt: null }],
      managementPlan: null,
      mobilizationItems: [{ id: 'mob-1', type: 'mobilization', title: 'Kickoff meeting', status: 'OPEN', dueDate: null, note: 'Pending', payload: {}, createdAt: new Date().toISOString(), updatedAt: null }],
      kpis: [],
      deliverables: [],
      acceptances: [],
      inspections: [],
      goodsInspections: [],
      paymentSchedules: [],
      invoices: [{ id: 'invoice-1', reference: 'INV-1', status: 'SUBMITTED', amount: 1000, currency: 'TZS', createdAt: new Date().toISOString() }],
      payments: [],
      threeWayMatches: [],
      paymentApprovals: [],
      paymentConfirmations: [],
      risks: [{ id: 'risk-1', type: 'risk', title: 'Delay risk', status: 'OPEN', dueDate: null, note: 'Monitor closely', payload: {}, createdAt: new Date().toISOString(), updatedAt: null }],
      riskForecasts: [],
      variations: [],
      issues: [],
      disputes: [],
      terminations: [{ id: 'term-1', type: 'termination', title: 'Termination review', status: 'UNDER_REVIEW', dueDate: null, note: 'Review', payload: {}, createdAt: new Date().toISOString(), updatedAt: null }],
      warranties: [],
      requiredDocuments: [],
      workflowApprovals: [],
      urgentActions: [],
      notifications: [],
      closeout: null,
      supplierPerformanceRecords: [],
      performanceScores: [],
      supplierRiskProfile: null,
      audit: []
    };
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(contract);
    const { container } = renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award?contract=contract-1');
    const form = (title: string) => container.querySelector(`[data-award-contract-form="${title}"]`);

    await waitFor(() => expect(screen.getByRole('tab', { name: /CMP/i })).toHaveClass('active'));
    expect(screen.getByText('Overdue work')).toBeInTheDocument();
    expect(screen.getByText('Payment blockers')).toBeInTheDocument();
    expect(form('Contract Management Plan')).toBeInTheDocument();
    expect(form('Contract status')).toBeInTheDocument();
    expect(form('Milestone')).toBeInTheDocument();
    expect(form('Invoice submission')).not.toBeInTheDocument();
    expect(form('Termination')).not.toBeInTheDocument();
    expect(form('Supplier performance')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Payments/i }));
    expect(form('Invoice submission')).toBeInTheDocument();
    expect(form('Payment review')).toBeInTheDocument();
    expect(form('Payment approval')).toBeInTheDocument();
    expect(form('Contract Management Plan')).not.toBeInTheDocument();
    expect(form('Termination')).not.toBeInTheDocument();
    expect(form('Supplier performance')).not.toBeInTheDocument();

    const invoiceSubmission = form('Invoice submission') as HTMLElement;
    await user.click(within(invoiceSubmission).getByRole('button', { name: 'Open action' }));
    const invoiceDialog = screen.getByRole('dialog', { name: 'Invoice submission' });
    expect(within(invoiceDialog).getByRole('searchbox', { name: /Supplier organization/i })).toBeInTheDocument();
    expect(within(invoiceDialog).queryByLabelText(/Supplier organization ID/i)).not.toBeInTheDocument();
    await user.click(within(invoiceDialog).getByRole('button', { name: 'Close' }));

    const paymentReview = form('Payment review') as HTMLElement;
    await user.click(within(paymentReview).getByRole('button', { name: 'Open action' }));
    const paymentReviewDialog = screen.getByRole('dialog', { name: 'Payment review' });
    expect(within(paymentReviewDialog).getByRole('listbox', { name: 'Invoice' })).toBeInTheDocument();
    expect(within(paymentReviewDialog).queryByLabelText('Invoice ID')).not.toBeInTheDocument();
    await user.click(within(paymentReviewDialog).getByRole('button', { name: 'Close' }));

    await user.click(screen.getByRole('tab', { name: /Termination/i }));
    expect(form('Termination')).toBeInTheDocument();
    expect(form('Termination notice')).toBeInTheDocument();
    expect(form('Invoice submission')).not.toBeInTheDocument();
    expect(form('Risk')).not.toBeInTheDocument();
    expect(form('Deliverable')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Registers/i }));
    expect(screen.getByText('Mobilization')).toBeInTheDocument();
    expect(screen.getByText('Invoices')).toBeInTheDocument();
    expect(container.querySelector('[data-award-contract-form]')).not.toBeInTheDocument();
  });

  it('submits structured goods inspection defects without exposing JSON payload fields', async () => {
    const user = userEvent.setup();
    const contract = contractDetail({
      milestones: [{ id: 'milestone-1', type: 'milestone', title: 'Delivery milestone', status: 'OPEN', dueDate: null, note: 'Pending delivery', payload: {}, createdAt: new Date().toISOString(), updatedAt: null }],
      deliverables: [{ id: 'deliverable-1', type: 'deliverable', title: 'Medical kits delivery', status: 'SUBMITTED', dueDate: null, note: 'Awaiting inspection', payload: {}, createdAt: new Date().toISOString(), updatedAt: null }]
    });
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(contract);
    const goodsInspection = vi.spyOn(awardsContractsApi, 'createGoodsInspection').mockResolvedValue(contract);
    const { container } = renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award?contract=contract-1&step=inspections');

    await waitFor(() => expect(screen.getByRole('tab', { name: /Inspections/i })).toHaveClass('active'));
    const form = container.querySelector('[data-award-contract-form="Goods inspection"]') as HTMLElement;
    await user.click(within(form).getByRole('button', { name: 'Open action' }));
    const dialog = screen.getByRole('dialog', { name: 'Goods inspection' });
    expect(within(dialog).queryByText('Advanced payload')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Goods inspection payload/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/JSON array/i)).not.toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Defect type/i), 'quality');
    await user.clear(within(dialog).getByLabelText(/Defect quantity/i));
    await user.type(within(dialog).getByLabelText(/Defect quantity/i), '2');
    await user.selectOptions(within(dialog).getByLabelText(/Defect severity/i), 'major');
    await user.type(within(dialog).getByLabelText(/Defect note/i), 'Packaging seal failed inspection.');
    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(goodsInspection).toHaveBeenCalledWith('contract-1', expect.objectContaining({
      defects: [{
        type: 'quality',
        quantity: 2,
        severity: 'major',
        note: 'Packaging seal failed inspection.'
      }]
    })));
  });

  it('locks production action forms that belong to the other contract party', () => {
    const supplierAccess = {
      viewerRole: 'SUPPLIER' as const,
      canManageBuyerActions: false,
      canSubmitSupplierActions: true,
      canSignBuyer: false,
      canSignSupplier: true,
      readOnlyReason: 'Buyer actions are read-only for the supplier.'
    };
    render(
      <AwardContractAccessProvider access={supplierAccess}>
        <ActionFormPanel
          title="Contract Management Plan"
          badge="CMP"
          fields={[{ name: 'objectives', label: 'Objectives', kind: 'textarea' }]}
          onSubmit={async () => ({})}
        />
      </AwardContractAccessProvider>
    );

    expect(screen.getByText('Buyer actions are read-only for the supplier.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
  });

  it('opens production forms in a drawer and submits searchable picker values', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({});
    render(
      <AwardContractAccessProvider access={{
        viewerRole: 'BUYER',
        canManageBuyerActions: true,
        canSubmitSupplierActions: false,
        canSignBuyer: true,
        canSignSupplier: false,
        readOnlyReason: null
      }}>
        <ActionFormPanel
          title="Inspection"
          badge="Buyer"
          fields={[
            {
              name: 'milestoneId',
              label: 'Milestone',
              kind: 'select',
              required: true,
              options: [
                { value: '', label: 'Select milestone' },
                { value: 'milestone-1', label: 'Delivery milestone (SUBMITTED)' }
              ]
            },
            { name: 'title', label: 'Title', kind: 'text', required: true }
          ]}
          initialValues={{ milestoneId: '', title: 'Goods inspection' }}
          onSubmit={submit}
        />
      </AwardContractAccessProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Open action' }));
    expect(screen.getByRole('dialog', { name: 'Inspection' })).toBeInTheDocument();
    const milestoneSearch = screen.getByRole('searchbox', { name: /Milestone/i });
    await user.clear(milestoneSearch);
    await user.type(milestoneSearch, 'Delivery');
    await user.click(screen.getByRole('option', { name: /Delivery milestone/i }));
    await user.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({ milestoneId: 'milestone-1', title: 'Goods inspection' }), expect.any(Object)));
  });

  it('hides technical payload fields while preserving defaults and structured transforms', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({});
    render(
      <AwardContractAccessProvider access={{
        viewerRole: 'BUYER',
        canManageBuyerActions: true,
        canSubmitSupplierActions: false,
        canSignBuyer: true,
        canSignSupplier: false,
        readOnlyReason: null
      }}>
        <ActionFormPanel
          title="Tie-breaker"
          badge="Buyer"
          fields={[
            { name: 'criteria', label: 'Tie-break criteria', kind: 'textarea', transform: 'lineArray' },
            { name: 'drivers', label: 'Risk drivers', kind: 'textarea', transform: 'driverArray' },
            { name: 'stepKey', label: 'Step key', kind: 'text', required: true, technical: true },
            { name: 'payload', label: 'Response payload', kind: 'json', rows: 4 }
          ]}
          initialValues={{
            criteria: 'Delivery score\nWarranty terms',
            drivers: 'Late inspection\nSupplier capacity',
            stepKey: 'internal-step',
            payload: JSON.stringify({ source: 'test-workspace' })
          }}
          onSubmit={submit}
        />
      </AwardContractAccessProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Open action' }));
    const dialog = screen.getByRole('dialog', { name: 'Tie-breaker' });
    expect(within(dialog).queryByText('Advanced payload')).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Response payload/i)).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText(/Step key/i)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Tie-break criteria/i)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Risk drivers/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      criteria: ['Delivery score', 'Warranty terms'],
      drivers: [{ driver: 'Late inspection' }, { driver: 'Supplier capacity' }],
      stepKey: 'internal-step',
      payload: { source: 'test-workspace' }
    }), expect.any(Object)));
  });

  it('closes action drawers with Escape and restores launcher focus', async () => {
    const user = userEvent.setup();
    render(
      <AwardContractAccessProvider access={{
        viewerRole: 'BUYER',
        canManageBuyerActions: true,
        canSubmitSupplierActions: false,
        canSignBuyer: true,
        canSignSupplier: false,
        readOnlyReason: null
      }}>
        <ActionFormPanel
          title="Contract status"
          badge="Buyer"
          fields={[{ name: 'note', label: 'Status note', kind: 'textarea' }]}
          onSubmit={async () => ({})}
        />
      </AwardContractAccessProvider>
    );

    const launcher = screen.getByRole('button', { name: 'Open action' });
    await user.click(launcher);
    expect(screen.getByRole('dialog', { name: 'Contract status' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Contract status' })).not.toBeInTheDocument());
    await waitFor(() => expect(launcher).toHaveFocus());
  });
});
