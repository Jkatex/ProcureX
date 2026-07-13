import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { store } from '@/app/store';
import '@/i18n';
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

  it('updates dashboard queue URLs from the top queue tabs', async () => {
    const user = userEvent.setup();
    const { container } = renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts');

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Closed Contracts' })).toBeInTheDocument());
    await user.click(screen.getByRole('tab', { name: 'Closed Contracts' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts?queue=closed-contracts'));
    expect(screen.getByRole('tab', { name: 'Closed Contracts' })).toHaveClass('active');

    expect(container.querySelector('.awarding-contracts-page > .award-floating-sidebar')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Awards Received' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts?queue=awards-received'));
    expect(screen.getByRole('tab', { name: 'Awards Received' })).toHaveClass('active');
  });

  it('renders dashboard summary counts as zero', async () => {
    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts');

    await waitFor(() => expect(screen.getByRole('tab', { name: 'My Urgent Actions' })).toBeInTheDocument());
    expect(screen.getByText('Urgent actions')).toBeInTheDocument();
    expect(screen.getByText('Awards')).toBeInTheDocument();
    expect(screen.getByText('Contract actions')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3);
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
    expect(screen.getByText('Awarding and contract records could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('No urgent award or contract actions yet.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry loading' }));
    await waitFor(() => expect(screen.getByText(/No urgent award or contract actions yet/i)).toBeInTheDocument());
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it('renders empty child workspaces without selected records', async () => {
    renderFlow(<AwardRecommendationProcurexPage />, '/awards-contracts/recommendation');
    await waitFor(() => expect(screen.getByText('No recommendation is ready yet.')).toBeInTheDocument());

    renderFlow(<AwardResponseProcurexPage />, '/awards-contracts/award-response');
    await waitFor(() => expect(screen.getAllByText('No award selected').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Open awards received' })).toHaveAttribute('data-route-search', 'queue=awards-received');

    renderFlow(<ContractNegotiationProcurexPage />, '/awards-contracts/negotiation');
    expect(screen.getByText('No contract is in progress.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to contracts' })).toHaveAttribute('data-route-search', 'queue=contracts-in-progress');

    renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award');
    expect(screen.getByText('No post-award records are available yet.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Active Contracts' })).toHaveAttribute('data-route-search', 'queue=active-contracts');
  });

  it('renders the award decision form first and keeps supporting details collapsed', async () => {
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
      reason: 'Best evaluated responsive bidder.',
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
      supplierName: 'Kilimanjaro Supplies',
      tenderTitle: 'Medical supplies tender',
      reason: 'Best evaluated responsive bidder.',
      sourceDocuments: [
        {
          id: 'tender-doc-1',
          sourceType: 'tender',
          documentId: 'doc-1',
          label: 'Tender Document',
          name: 'Medical supplies tender',
          status: 'Available',
          openUrl: '/api/documents/doc-1/content',
          downloadUrl: '/api/documents/doc-1/content?download=true'
        },
        {
          id: 'evaluation-report-rec-1',
          sourceType: 'evaluation-report',
          documentId: null,
          label: 'Evaluation Report',
          name: 'Evaluation report',
          status: 'Generated',
          openUrl: '/api/award-contract/recommendations/rec-1/evaluation-report',
          downloadUrl: '/api/award-contract/recommendations/rec-1/evaluation-report?download=true'
        }
      ],
      approvalRoutes: [{ id: 'bd822b04-54c0-4c89-a4f2-32c8db2cf72f', title: 'Single-user award approval', status: 'APPROVED', note: 'Seeded single-user approval.' }],
      tieBreakers: [{ id: 'tie-1', title: 'Delivery tie-breaker', status: 'RESOLVED', note: 'Tie-breaker resolved.' }],
      feasibilityChecks: [{ id: 'feasibility-1', title: 'Delivery feasibility', status: 'APPROVED', note: 'Feasibility approved.' }],
      standstillPeriods: [],
      awardNotifications: [],
      budgetCommitments: [{ id: 'budget-1', budgetCode: 'PROCUREMENT.AWARD', status: 'PENDING', note: 'Budget reserved.' }],
      audit: []
    });

    renderFlow(<AwardRecommendationProcurexPage />, '/awards-contracts/recommendation?recommendation=rec-1');

    await waitFor(() => expect(screen.getAllByRole('heading', { name: /Confirm award for Kilimanjaro Supplies/i }).length).toBeGreaterThan(0));
    expect(screen.getByLabelText(/Selected supplier/i)).toHaveValue('Kilimanjaro Supplies');
    expect(screen.getByLabelText(/Reason for award/i)).toHaveValue('Best evaluated responsive bidder.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirm award' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send notices' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate contract' })).toBeInTheDocument();
    expect(screen.queryByText(/Workflow step/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Evaluation Results/i })).not.toBeInTheDocument();

    const documents = screen.getByText('Documents used for this award').closest('details') as HTMLDetailsElement;
    expect(documents).not.toHaveAttribute('open');
    expect(screen.getByText('Bid ranking')).toBeInTheDocument();
    expect(screen.getAllByText('Waiting period').length).toBeGreaterThan(0);
  });

  it('renders dashboard queue items as prototype table rows', async () => {
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
    expect(screen.getByRole('columnheader', { name: 'Priority' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Related Tender/Contract' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Approve award' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Approve award' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts/recommendation?recommendation=rec-card-1&step=award-decision'));
  });

  it('keeps dashboard records unfiltered in the prototype queue table', async () => {
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
    expect(screen.queryByRole('textbox', { name: 'Search award and contract records' })).not.toBeInTheDocument();
    expect(screen.queryByText('Showing 1 of 2')).not.toBeInTheDocument();
  });

  it('keeps supplier award and contract queues visible through prototype tabs', async () => {
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
    expect(screen.getByText('Zanzibar clinic award')).toBeInTheDocument();
    expect(screen.getByText('Mwanza warehouse award')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Contracts in Progress' }));
    expect(screen.getByText('Zanzibar clinic contract draft')).toBeInTheDocument();
    expect(screen.getByText('Dodoma school contract draft')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Active Contracts' }));
    expect(screen.getByText('Zanzibar active clinic supply')).toBeInTheDocument();
    expect(screen.getByText('Arusha active road works')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Closed Contracts' }));
    expect(screen.getByText('Zanzibar closed maintenance')).toBeInTheDocument();
    expect(screen.getByText('Mbeya closed ICT support')).toBeInTheDocument();
  });

  it('does not render removed role and risk filter controls on the dashboard', async () => {
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
    expect(screen.getByText('Supplier urgent award response')).toBeInTheDocument();
    expect(screen.queryByText('Buyer work')).not.toBeInTheDocument();
    expect(screen.queryByText('Supplier work')).not.toBeInTheDocument();
    expect(screen.queryByText('Due this week')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Supplier' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'High risk' })).not.toBeInTheDocument();
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
    await waitFor(() => expect(screen.getAllByText('AWN-001').length).toBeGreaterThan(0));

    expect(screen.queryByRole('button', { name: 'Open action' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit response' }));

    await waitFor(() => expect(respond).toHaveBeenCalledWith('notice-supplier-refresh', 'ACCEPT', expect.any(String), expect.any(Object)));
    await user.click(screen.getByText('Response history'));

    await waitFor(() => expect(screen.getByText('SUPPLIER_ACCEPTED_AWARD')).toBeInTheDocument());
    expect(screen.getByText(/Linked contract is ready for preparation/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Supplier response submitted: ACCEPT/i).length).toBeGreaterThan(0);
  });

  it('shows source document actions in the award recommendation details', async () => {
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
      tenderTitle: 'Clinic equipment tender',
      reason: 'Best evaluated supplier.',
      supplierOrgId: 'supplier-org-1',
      supplierName: 'Moshi Clinical Supplies',
      bidId: 'bid-1',
      sourceDocuments: [
        {
          id: 'tender-doc-picker',
          sourceType: 'tender',
          documentId: 'doc-tender',
          label: 'Tender Document',
          name: 'Clinic equipment tender',
          status: 'Available',
          openUrl: '/api/documents/doc-tender/content',
          downloadUrl: '/api/documents/doc-tender/content?download=true'
        },
        {
          id: 'bid-doc-picker',
          sourceType: 'bid',
          documentId: 'doc-bid',
          label: 'Bid Document',
          name: 'Submitted bid',
          status: 'Available',
          supplierName: 'Moshi Clinical Supplies',
          bidId: 'bid-1',
          openUrl: '/api/documents/doc-bid/content',
          downloadUrl: '/api/documents/doc-bid/content?download=true'
        },
        {
          id: 'evaluation-report-picker',
          sourceType: 'evaluation-report',
          documentId: null,
          label: 'Evaluation Report',
          name: 'Evaluation report',
          status: 'Generated',
          openUrl: '/api/award-contract/recommendations/rec-picker-1/evaluation-report',
          downloadUrl: '/api/award-contract/recommendations/rec-picker-1/evaluation-report?download=true'
        }
      ],
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

    await waitFor(() => expect(screen.getAllByRole('heading', { name: /Confirm award for Moshi Clinical Supplies/i }).length).toBeGreaterThan(0));
    const documents = screen.getByText('Documents used for this award').closest('details') as HTMLDetailsElement;
    await user.click(within(documents).getByText('Documents used for this award'));
    expect(within(documents).getByText('Tender Document')).toBeInTheDocument();
    expect(within(documents).getByText('Bid Documents')).toBeInTheDocument();
    expect(within(documents).getByText('Evaluation Report')).toBeInTheDocument();
    expect(within(documents).getAllByRole('button', { name: 'Open' }).length).toBeGreaterThanOrEqual(2);
    expect(within(documents).getAllByRole('button', { name: 'Download' }).length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[data-award-contract-form="Tie-breaker"]')).not.toBeInTheDocument();
  });

  it('renders form-first contract formation and post-award workspaces from contract detail', async () => {
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
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Prepare contract' })).toBeInTheDocument());
    expect(screen.getAllByText('PX-C-1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Selected Contract')).not.toBeInTheDocument();
    expect(screen.getByText('Commercial terms')).toBeInTheDocument();
    expect(screen.queryByText(/\{"buyer"/i)).not.toBeInTheDocument();
    expect(screen.getByText('Review terms')).toBeInTheDocument();
    expect(screen.getByText('Approve contract')).toBeInTheDocument();
    expect(screen.getByText('Saved records')).toBeInTheDocument();
    contractRender.unmount();

    renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award?contract=contract-1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Track delivery' })).toBeInTheDocument());
    expect(screen.getAllByText('PX-C-1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Selected Contract')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Post-award health summary' })).not.toBeInTheDocument();
    expect(screen.getByText('Payments')).toBeInTheDocument();
    expect(screen.getByText('Termination')).toBeInTheDocument();
    expect(screen.getByText('History')).toBeInTheDocument();
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

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Track delivery' })).toBeInTheDocument());
    expect(screen.queryByText('Overdue work')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment blockers')).not.toBeInTheDocument();
    expect(form('Contract Management Plan')).toBeInTheDocument();
    expect(form('Contract status')).toBeInTheDocument();
    expect(form('Milestone')).toBeInTheDocument();
    expect(form('Invoice submission')).not.toBeInTheDocument();
    expect(form('Termination')).not.toBeInTheDocument();
    expect(form('Supplier performance')).not.toBeInTheDocument();

    await user.click(screen.getByText('Payments'));
    await user.click(screen.getByRole('button', { name: 'Work on payments' }));
    expect(form('Invoice submission')).toBeInTheDocument();
    expect(form('Payment review')).toBeInTheDocument();
    expect(form('Payment approval')).toBeInTheDocument();
    expect(form('Contract Management Plan')).not.toBeInTheDocument();
    expect(form('Termination')).not.toBeInTheDocument();
    expect(form('Supplier performance')).not.toBeInTheDocument();

    const invoiceSubmission = form('Invoice submission') as HTMLElement;
    await user.click(within(invoiceSubmission).getByRole('button', { name: 'Select' }));
    expect(screen.queryByRole('dialog', { name: 'Invoice submission' })).not.toBeInTheDocument();
    expect(within(invoiceSubmission).getByRole('searchbox', { name: /Supplier organization/i })).toBeInTheDocument();
    expect(within(invoiceSubmission).queryByLabelText(/Supplier organization ID/i)).not.toBeInTheDocument();
    await user.click(within(invoiceSubmission).getByRole('button', { name: 'Cancel' }));

    const paymentReview = form('Payment review') as HTMLElement;
    await user.click(within(paymentReview).getByRole('button', { name: 'Select' }));
    expect(within(paymentReview).getByRole('listbox', { name: 'Invoice' })).toBeInTheDocument();
    expect(within(paymentReview).queryByLabelText('Invoice ID')).not.toBeInTheDocument();
    await user.click(within(paymentReview).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByText('Termination'));
    await user.click(screen.getByRole('button', { name: 'Work on termination' }));
    expect(form('Termination')).toBeInTheDocument();
    expect(form('Termination notice')).toBeInTheDocument();
    expect(form('Invoice submission')).not.toBeInTheDocument();
    expect(form('Risk')).not.toBeInTheDocument();
    expect(form('Deliverable')).not.toBeInTheDocument();

    await user.click(screen.getByText('History'));
    await user.click(screen.getByRole('button', { name: 'Work on saved records' }));
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

    await waitFor(() => expect(screen.getByText('Inspections and acceptance')).toBeInTheDocument());
    const form = container.querySelector('[data-award-contract-form="Goods inspection"]') as HTMLElement;
    await user.click(within(form).getByRole('button', { name: 'Select' }));
    expect(screen.queryByRole('dialog', { name: 'Goods inspection' })).not.toBeInTheDocument();
    expect(within(form).queryByText('Advanced payload')).not.toBeInTheDocument();
    expect(within(form).queryByLabelText(/Goods inspection payload/i)).not.toBeInTheDocument();
    expect(within(form).queryByText(/JSON array/i)).not.toBeInTheDocument();

    await user.type(within(form).getByLabelText(/Defect type/i), 'quality');
    await user.clear(within(form).getByLabelText(/Defect quantity/i));
    await user.type(within(form).getByLabelText(/Defect quantity/i), '2');
    await user.selectOptions(within(form).getByLabelText(/Defect severity/i), 'major');
    await user.type(within(form).getByLabelText(/Defect note/i), 'Packaging seal failed inspection.');
    await user.click(within(form).getByRole('button', { name: 'Submit' }));

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

  it('opens production forms inline and submits searchable picker values', async () => {
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

    await user.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.queryByRole('dialog', { name: 'Inspection' })).not.toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Select' }));
    expect(screen.queryByRole('dialog', { name: 'Tie-breaker' })).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced payload')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Response payload/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Step key/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Tie-break criteria/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Risk drivers/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      criteria: ['Delivery score', 'Warranty terms'],
      drivers: [{ driver: 'Late inspection' }, { driver: 'Supplier capacity' }],
      stepKey: 'internal-step',
      payload: { source: 'test-workspace' }
    }), expect.any(Object)));
  });

  it('hides inline action forms without rendering drawers', async () => {
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

    const launcher = screen.getByRole('button', { name: 'Select' });
    await user.click(launcher);
    expect(screen.queryByRole('dialog', { name: 'Contract status' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Status note/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide' }));
    await waitFor(() => expect(screen.queryByLabelText(/Status note/i)).not.toBeInTheDocument());
  });
});
