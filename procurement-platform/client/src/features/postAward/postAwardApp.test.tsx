/* Exercises post Award behavior so regressions are caught close to the domain workflow they protect. */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import '@/i18n';
import { postAwardApi } from '@/features/postAward/api';
import { PostAwardAppPage } from '@/features/postAward/pages/PostAwardAppPage';
import type { PostAwardContractRow, PostAwardTask, PostAwardWorkspace } from '@/features/postAward/types';

vi.mock('@/features/postAward/api', () => ({
  postAwardApi: {
    contracts: vi.fn(),
    workspace: vi.fn(),
    upsertManagementPlan: vi.fn(),
    generateManagementPlanDraft: vi.fn(),
    createDeliverySchedule: vi.fn(),
    createDispatchNotice: vi.fn(),
    createGoodsReceipt: vi.fn(),
    createGoodsInspection: vi.fn(),
    createAcceptance: vi.fn(),
    createSiteHandover: vi.fn(),
    createWorksProgressReport: vi.fn(),
    reviewWorksProgressReport: vi.fn(),
    createBoqMeasurement: vi.fn(),
    reviewBoqMeasurement: vi.fn(),
    createInterimPaymentCertificate: vi.fn(),
    certifyInterimPaymentCertificate: vi.fn(),
    createWorksCompletionCertificate: vi.fn(),
    createContractDefect: vi.fn(),
    respondToContractDefect: vi.fn(),
    verifyContractDefect: vi.fn(),
    closeContractDefect: vi.fn(),
    createServiceLevel: vi.fn(),
    createServicePeriod: vi.fn(),
    createServiceReport: vi.fn(),
    reviewServiceReport: vi.fn(),
    createServiceCredit: vi.fn(),
    reviewServiceCredit: vi.fn(),
    createServiceIncident: vi.fn(),
    respondToServiceIncident: vi.fn(),
    verifyServiceIncident: vi.fn(),
    closeServiceIncident: vi.fn(),
    createConsultancyDeliverable: vi.fn(),
    reviewConsultancyDeliverable: vi.fn(),
    createDeliverableVersion: vi.fn(),
    reviewDeliverableVersion: vi.fn(),
    createDeliverableReview: vi.fn(),
    confirmDeliverableReviewPaymentEligibility: vi.fn(),
    upsertConsultancyFinalReport: vi.fn(),
    reviewConsultancyFinalReport: vi.fn(),
    createInvoice: vi.fn(),
    upsertThreeWayMatch: vi.fn(),
    createPaymentApproval: vi.fn(),
    verifyInvoiceFinance: vi.fn(),
    returnInvoiceFinance: vi.fn(),
    rejectInvoiceFinance: vi.fn(),
    correctInvoiceFinance: vi.fn(),
    createPaymentRecommendation: vi.fn(),
    reviewPaymentApproval: vi.fn(),
    controlPayment: vi.fn(),
    createPostAwardPaymentConfirmation: vi.fn(),
    createFinanceDeduction: vi.fn(),
    createFinanceRetention: vi.fn(),
    createFinanceAdvanceRecovery: vi.fn(),
    createFinanceLiquidatedDamages: vi.fn(),
    createIssue: vi.fn(),
    createNonConformance: vi.fn(),
    controlNonConformance: vi.fn(),
    createContractChangeRequest: vi.fn(),
    controlChangeRequest: vi.fn(),
    createClaim: vi.fn(),
    controlClaim: vi.fn(),
    createDispute: vi.fn(),
    controlDispute: vi.fn(),
    controlRisk: vi.fn(),
    controlIssue: vi.fn(),
    controlVariation: vi.fn(),
    controlExtensionRequest: vi.fn(),
    createTermination: vi.fn(),
    controlTermination: vi.fn(),
    createContractSecurity: vi.fn(),
    controlContractSecurity: vi.fn(),
    upsertRequiredDocument: vi.fn(),
    upsertWarranty: vi.fn(),
    controlWarranty: vi.fn(),
    createContractNotice: vi.fn(),
    controlContractNotice: vi.fn(),
    createContractMeeting: vi.fn(),
    createContractMeetingAction: vi.fn(),
    controlContractMeetingAction: vi.fn(),
    recalculateUrgentActions: vi.fn(),
    updateCloseoutStep: vi.fn(),
    upsertSupplierPerformance: vi.fn(),
    upsertCloseout: vi.fn(),
    submitActivationItem: vi.fn(),
    reviewActivationItem: vi.fn()
  }
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPostAward(initialEntry = '/post-award?contract=contract-1&stage=delivery') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PostAwardAppPage />
        <LocationProbe />
      </MemoryRouter>
    </Provider>
  );
}

async function findEntranceContractRow() {
  const chooser = await screen.findByLabelText('Contracts');
  const contractTitle = await within(chooser).findByText('Clinic delivery contract');
  return contractTitle.closest('tr') as HTMLElement;
}

function row(overrides: Partial<PostAwardContractRow> = {}): PostAwardContractRow {
  return {
    id: 'contract-1',
    title: 'Clinic delivery contract',
    reference: 'PX-C-001',
    status: 'ACTIVE',
    buyerName: 'Arusha City Council',
    supplierName: 'Moshi Medical Supplies',
    viewerRole: 'BUYER',
    amount: 1200000,
    currency: 'TZS',
    stage: 'Active',
    nextAction: 'Monitor execution',
    dueDate: null,
    riskLevel: 'Low',
    ...overrides
  };
}

function task(overrides: Partial<PostAwardTask>): PostAwardTask {
  return {
    id: 'task',
    title: 'Task',
    detail: 'Task detail',
    owner: 'BUYER',
    priority: 'High',
    status: 'READY',
    actionKey: 'management-plan',
    sectionId: 'setup',
    dueDate: null,
    blockerIds: [],
    visibility: 'SHARED',
    ...overrides
  };
}

function workspace(overrides: Partial<PostAwardWorkspace> = {}): PostAwardWorkspace {
  const buyerTasks = [
    task({ id: 'goods-schedule', title: 'Create goods delivery schedule', detail: 'Define item, quantity, location, delivery date, and milestone link.', actionKey: 'goods-delivery-schedule', sectionId: 'delivery' }),
    task({ id: 'receipt', title: 'Record goods receipt', detail: 'Record received, damaged, rejected, and accepted quantities.', actionKey: 'goods-receipt', sectionId: 'delivery', status: 'BLOCKED' }),
    task({ id: 'payment', title: 'Approve and record payment', detail: 'Buyer private payment control.', actionKey: 'payment-approval', sectionId: 'finance', visibility: 'BUYER_PRIVATE' })
  ];
  const supplierTasks = [
    task({ id: 'dispatch', title: 'Submit dispatch notice', detail: 'Supplier records carrier, tracking, quantity, packing list, and expected arrival.', owner: 'SUPPLIER', actionKey: 'dispatch-notice', sectionId: 'delivery' }),
    task({ id: 'invoice', title: 'Submit invoice linked to accepted work', detail: 'Invoice must reference accepted execution evidence.', owner: 'SUPPLIER', actionKey: 'invoice', sectionId: 'finance' })
  ];
  const base: PostAwardWorkspace = {
    contract: {
      ...row(),
      tenderId: 'tender-1',
      tenderReference: 'TDR-001',
      access: {
        viewerRole: 'BUYER',
        canSubmitSupplierActions: false,
        canManageBuyerActions: true,
        readOnlyReason: null
      }
    },
    procurementType: 'GOODS',
    health: { level: 'MEDIUM', label: 'Watch', score: 35, summary: '2 workflow blockers require attention.' },
    buyerTasks,
    supplierTasks,
    workflowSections: [
      {
        id: 'setup',
        label: 'Activation / Setup',
        description: 'Activation checklist and CMP.',
        status: 'PENDING',
        steps: [{ id: 'activation', label: 'Activation gate', owner: 'SHARED', status: 'PENDING', count: 0 }],
        records: []
      },
      {
        id: 'delivery',
        label: 'Delivery',
        description: 'Goods delivery schedule, dispatch, and receipt.',
        status: 'ACTIVE',
        steps: [
          { id: 'schedule', label: 'Delivery schedule', owner: 'BUYER', status: 'PENDING', count: 0 },
          { id: 'dispatch', label: 'Dispatch notice', owner: 'SUPPLIER', status: 'PENDING', count: 0 },
          { id: 'receipt', label: 'Goods receipt', owner: 'BUYER', status: 'PENDING', count: 0 }
        ],
        records: []
      },
      {
        id: 'finance',
        label: 'Finance',
        description: 'Invoice, match, payment.',
        status: 'ACTIVE',
        steps: [{ id: 'invoice', label: 'Invoice', owner: 'SUPPLIER', status: 'PENDING', count: 0 }],
        records: [{ id: 'invoice-1', type: 'invoice', title: 'INV-001', status: 'MATCHED', amount: 250000, currency: 'TZS', payload: {} }]
      }
    ],
    currentBlockers: [{ id: 'no-accepted-work', title: 'No accepted work is invoiceable', detail: 'Supplier can invoice only after accepted evidence exists.', owner: 'SUPPLIER', severity: 'High', sectionId: 'finance', actionKey: 'invoice' }],
    financialEligibility: {
      invoiceableRecords: [{
        id: 'acceptance-1',
        type: 'acceptance',
        title: 'Acceptance certificate 1',
        amount: 250000,
        acceptedAmount: 250000,
        alreadyInvoicedAmount: 0,
        remainingInvoiceableAmount: 250000,
        currency: 'TZS',
        status: 'APPROVED',
        blockingReasons: [],
        executionReferenceType: 'acceptance',
        executionReferenceId: 'acceptance-1'
      }],
      blockedReasons: [],
      paymentQueue: [],
      retentionSummary: { retainedAmount: 0, releasedAmount: 0, remainingRetention: 0, currency: 'TZS', blockingReasons: [] },
      advanceRecoverySummary: { recoveredAmount: 0, outstandingAmount: 0, currency: 'TZS', blockingReasons: [] },
      deductionSummary: { pendingDeductionsAmount: 0, approvedDeductionsAmount: 0, liquidatedDamagesRecommended: 0, liquidatedDamagesApproved: 0, currency: 'TZS' },
      paymentStatusSummary: { recommendedAmount: 0, approvedAmount: 0, initiatedAmount: 0, completedAmount: 0, overduePaymentCount: 0, currency: 'TZS' },
      supplierReceiptPending: 0,
      financialCloseoutBlockers: [],
      submittedInvoiceCount: 0,
      matchedInvoiceCount: 1,
      payableAmount: 250000,
      paidAmount: 0,
      currency: 'TZS'
    },
    operationalReadiness: {
      ready: false,
      activationStatus: 'DRAFT',
      managerAssigned: false,
      managementPlanReady: false,
      activationItems: { total: 0, open: 0, submitted: 0, approved: 0 },
      securities: { total: 0, blocking: 0 },
      requiredDocuments: { total: 0, open: 0 },
      blockers: []
    },
    urgentActions: [],
    communicationSummary: { totalNotices: 0, openNotices: 0, awaitingAcknowledgement: 0, awaitingResponse: 0, overdueNotices: 0 },
    meetingActionSummary: { totalMeetings: 0, openActions: 0, supplierActions: 0, buyerActions: 0, overdueActions: 0 },
    securityExpirySummary: { total: 0, expiringSoon: 0, expired: 0, unresolved: 0 },
    warrantySummary: { total: 0, open: 0, awaitingSupplier: 0, awaitingBuyer: 0, expiringSoon: 0, overdue: 0 },
    performanceReadiness: { ready: true, systemMetrics: [], evaluatorRecords: 0, blockers: [] },
    closeoutReadiness: {
      ready: false,
      steps: [
        { id: 'execution', label: 'Execution and acceptance', status: 'BLOCKED', blockerIds: ['no-accepted-work'] },
        { id: 'finance', label: 'Financial settlement', status: 'READY', blockerIds: [] }
      ],
      blockers: []
    },
    timeline: [],
    permissions: {
      visibility: 'BUYER_PRIVATE',
      canManageBuyerActions: true,
      canSubmitSupplierActions: false,
      canSeeBuyerPrivate: true,
      canSeeSupplierPrivate: false
    },
    metrics: [{ label: 'Health', value: 'Watch', tone: 'warning' }],
    stages: [],
    secondary: [],
    actions: []
  };
  return { ...base, ...overrides };
}

describe('PostAwardAppPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(postAwardApi.contracts).mockResolvedValue([row()]);
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createDeliverySchedule).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createDispatchNotice).mockResolvedValue(workspace({ contract: { ...workspace().contract, viewerRole: 'SUPPLIER' } }));
    vi.mocked(postAwardApi.createAcceptance).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createInvoice).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.reviewWorksProgressReport).mockResolvedValue(workspace({ procurementType: 'WORKS' }));
    vi.mocked(postAwardApi.reviewBoqMeasurement).mockResolvedValue(workspace({ procurementType: 'WORKS' }));
    vi.mocked(postAwardApi.certifyInterimPaymentCertificate).mockResolvedValue(workspace({ procurementType: 'WORKS' }));
    vi.mocked(postAwardApi.createWorksCompletionCertificate).mockResolvedValue(workspace({ procurementType: 'WORKS' }));
    vi.mocked(postAwardApi.createContractDefect).mockResolvedValue(workspace({ procurementType: 'WORKS' }));
    vi.mocked(postAwardApi.respondToContractDefect).mockResolvedValue(workspace({ procurementType: 'WORKS' }));
    vi.mocked(postAwardApi.verifyContractDefect).mockResolvedValue(workspace({ procurementType: 'WORKS' }));
    vi.mocked(postAwardApi.closeContractDefect).mockResolvedValue(workspace({ procurementType: 'WORKS' }));
    vi.mocked(postAwardApi.reviewServiceReport).mockResolvedValue(workspace({ procurementType: 'SERVICES' }));
    vi.mocked(postAwardApi.createServiceIncident).mockResolvedValue(workspace({ procurementType: 'SERVICES' }));
    vi.mocked(postAwardApi.respondToServiceIncident).mockResolvedValue(workspace({ procurementType: 'SERVICES' }));
    vi.mocked(postAwardApi.verifyServiceIncident).mockResolvedValue(workspace({ procurementType: 'SERVICES' }));
    vi.mocked(postAwardApi.closeServiceIncident).mockResolvedValue(workspace({ procurementType: 'SERVICES' }));
    vi.mocked(postAwardApi.reviewServiceCredit).mockResolvedValue(workspace({ procurementType: 'SERVICES' }));
    vi.mocked(postAwardApi.reviewConsultancyDeliverable).mockResolvedValue(workspace({ procurementType: 'CONSULTANCY' }));
    vi.mocked(postAwardApi.reviewDeliverableVersion).mockResolvedValue(workspace({ procurementType: 'CONSULTANCY' }));
    vi.mocked(postAwardApi.confirmDeliverableReviewPaymentEligibility).mockResolvedValue(workspace({ procurementType: 'CONSULTANCY' }));
    vi.mocked(postAwardApi.upsertConsultancyFinalReport).mockResolvedValue(workspace({ procurementType: 'CONSULTANCY' }));
    vi.mocked(postAwardApi.reviewConsultancyFinalReport).mockResolvedValue(workspace({ procurementType: 'CONSULTANCY' }));
    vi.mocked(postAwardApi.verifyInvoiceFinance).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.returnInvoiceFinance).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.rejectInvoiceFinance).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.correctInvoiceFinance).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createPaymentRecommendation).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.reviewPaymentApproval).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.controlPayment).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createPostAwardPaymentConfirmation).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createFinanceDeduction).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createFinanceRetention).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createFinanceAdvanceRecovery).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createFinanceLiquidatedDamages).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.controlClaim).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.controlChangeRequest).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.controlNonConformance).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.controlVariation).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.controlExtensionRequest).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.controlDispute).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.controlRisk).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.controlIssue).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createDispute).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.createTermination).mockResolvedValue(workspace());
    vi.mocked(postAwardApi.controlTermination).mockResolvedValue(workspace());
  });

  it('shows the post-award entrance at the root route without auto-opening a contract', async () => {
    renderPostAward('/post-award');

    expect(await screen.findByRole('heading', { name: 'Contract tracking' })).toBeInTheDocument();
    expect(screen.getByText('Track signed contracts')).toBeInTheDocument();
    expect(await screen.findByText('Clinic delivery contract')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/post-award');
    expect(postAwardApi.workspace).not.toHaveBeenCalled();
  });

  it('opens a selected contract workspace from the entrance page', async () => {
    const user = userEvent.setup();
    renderPostAward('/post-award');

    const contractRow = await findEntranceContractRow();
    await user.click(within(contractRow).getByRole('button', { name: 'Open' }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/post-award?contract=contract-1&stage=delivery'));
  });

  it.each([
    ['Setup', 'setup'],
    ['Delivery', 'delivery'],
    ['Finance', 'finance']
  ])('opens the %s quick page from the entrance page', async (label, stage) => {
    const user = userEvent.setup();
    renderPostAward('/post-award');

    const contractRow = await findEntranceContractRow();
    await user.click(within(contractRow).getByRole('button', { name: label }));

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent(`/post-award?contract=contract-1&stage=${stage}`));
  });

  it('shows an empty entrance state when no contracts are ready', async () => {
    vi.mocked(postAwardApi.contracts).mockResolvedValue([]);

    renderPostAward('/post-award');

    expect(await screen.findByRole('heading', { name: 'Contract tracking' })).toBeInTheDocument();
    expect(screen.getByText('No contracts ready yet')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/post-award');
    expect(postAwardApi.workspace).not.toHaveBeenCalled();
  });

  it('shows an entrance error state when contracts cannot load', async () => {
    vi.mocked(postAwardApi.contracts).mockRejectedValue(new Error('Contracts could not load'));

    renderPostAward('/post-award');

    expect(await screen.findByText('Contracts could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText('Choose a contract')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/post-award');
    expect(postAwardApi.workspace).not.toHaveBeenCalled();
  });

  it('loads the canonical task workspace for a buyer and saves a goods schedule', async () => {
    const user = userEvent.setup();
    renderPostAward();

    expect(await screen.findByRole('heading', { name: 'Clinic delivery contract' })).toBeInTheDocument();
    expect(screen.getByLabelText('Select contract')).toBeInTheDocument();
    expect(screen.getAllByText('Next task').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Buyer tasks' })).toBeInTheDocument();
    expect(screen.getByText('Overall status')).toBeInTheDocument();
    expect(screen.getByText('Delivery schedule')).toBeInTheDocument();
    expect(screen.getAllByText('Create goods delivery schedule').length).toBeGreaterThan(0);

    await user.click(screen.getAllByText('Create goods delivery schedule')[0]);
    await user.type(screen.getByLabelText('Goods or line description'), 'Hospital beds');
    await user.type(screen.getByLabelText('Planned quantity'), '10');
    await user.click(screen.getByRole('button', { name: 'Save action' }));

    await waitFor(() => expect(postAwardApi.createDeliverySchedule).toHaveBeenCalledWith('contract-1', expect.objectContaining({
      description: 'Hospital beds',
      plannedQuantity: 10
    })));
  });

  it('lets a buyer settle an open claim through the control workflow panel', async () => {
    const user = userEvent.setup();
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace({
      buyerTasks: [
        task({ id: 'claim-response', title: 'Respond to claim', detail: 'Respond, assess, settle, reject, or escalate claims with evidence.', actionKey: 'claim-response', sectionId: 'claims' })
      ],
      workflowSections: [
        ...workspace().workflowSections,
        {
          id: 'claims',
          label: 'Claims',
          description: 'Claims, responses, disputes, and entitlement decisions.',
          status: 'ACTIVE',
          steps: [{ id: 'claims', label: 'Claims and responses', owner: 'SHARED', status: 'ACTIVE', count: 1 }],
          records: [{ id: 'claim-1', type: 'claim', title: 'Delay cost claim', status: 'OPEN', amount: 40000, currency: 'TZS', payload: {} }]
        }
      ]
    }));

    renderPostAward('/post-award?contract=contract-1&stage=claims');

    await user.click((await screen.findAllByText('Respond to claim'))[0]);
    await user.selectOptions(screen.getByLabelText('Claim'), 'claim-1');
    await user.selectOptions(screen.getByLabelText('Action'), 'settle');
    await user.type(screen.getByLabelText('Approved or settlement amount'), '30000');
    await user.type(screen.getByLabelText('Response or decision'), 'Settled against approved delay evidence.');
    await user.click(screen.getByRole('button', { name: 'Save action' }));

    await waitFor(() => expect(postAwardApi.controlClaim).toHaveBeenCalledWith('contract-1', 'claim-1', 'settle', expect.objectContaining({
      amountApproved: 30000,
      response: 'Settled against approved delay evidence.'
    })));
  });

  it('shows only supplier-owned queue items to suppliers', async () => {
    vi.mocked(postAwardApi.contracts).mockResolvedValue([row({ viewerRole: 'SUPPLIER' })]);
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace({
      contract: {
        ...workspace().contract,
        viewerRole: 'SUPPLIER',
        access: {
          viewerRole: 'SUPPLIER',
          canSubmitSupplierActions: true,
          canManageBuyerActions: false,
          readOnlyReason: null
        }
      },
      permissions: {
        visibility: 'SUPPLIER_PRIVATE',
        canManageBuyerActions: false,
        canSubmitSupplierActions: true,
        canSeeBuyerPrivate: false,
        canSeeSupplierPrivate: true
      }
    }));

    renderPostAward();

    expect(await screen.findByRole('heading', { name: 'Supplier tasks' })).toBeInTheDocument();
    expect((await screen.findAllByText('Submit dispatch notice')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Approve and record payment')).not.toBeInTheDocument();
    expect(screen.queryByText('Buyer private payment control.')).not.toBeInTheDocument();
  });

  it('requires supplier invoices to choose accepted execution evidence', async () => {
    const user = userEvent.setup();
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace({
      contract: {
        ...workspace().contract,
        viewerRole: 'SUPPLIER',
        access: {
          viewerRole: 'SUPPLIER',
          canSubmitSupplierActions: true,
          canManageBuyerActions: false,
          readOnlyReason: null
        }
      }
    }));

    renderPostAward('/post-award?contract=contract-1&stage=finance');

    await user.click((await screen.findAllByText('Submit invoice linked to accepted work'))[0]);
    await user.type(screen.getByLabelText('Invoice reference'), 'INV-900');
    await user.selectOptions(screen.getByLabelText('Accepted execution item'), 'acceptance::acceptance-1');
    await user.type(screen.getByLabelText('Invoice amount'), '250000');
    await user.click(screen.getByRole('button', { name: 'Save action' }));

    await waitFor(() => expect(postAwardApi.createInvoice).toHaveBeenCalledWith('contract-1', expect.objectContaining({
      reference: 'INV-900',
      executionReferenceType: 'acceptance',
      executionReferenceId: 'acceptance-1',
      amount: 250000
    })));
  });

  it('lets a buyer recommend payment with deductions and net payable', async () => {
    const user = userEvent.setup();
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace({
      buyerTasks: [task({ id: 'payment-recommendation', title: 'Recommend payment', detail: 'Finance recommends gross, deductions, retention, advance recovery, LD, tax, and net payable.', actionKey: 'payment-recommendation', sectionId: 'finance', visibility: 'BUYER_PRIVATE' })],
      workflowSections: [
        ...workspace().workflowSections.filter((section) => section.id !== 'finance'),
        {
          id: 'finance',
          label: 'Finance',
          description: 'Invoice, match, payment.',
          status: 'ACTIVE',
          steps: [{ id: 'payment', label: 'Payment', owner: 'BUYER', status: 'ACTIVE', count: 1 }],
          records: [{ id: 'invoice-1', type: 'invoice', title: 'INV-001', status: 'MATCHED', amount: 250000, currency: 'TZS', payload: {} }]
        }
      ],
      financialEligibility: {
        ...workspace().financialEligibility,
        paymentQueue: [{ id: 'invoice-1', type: 'invoice', title: 'Recommend payment for INV-001', status: 'MATCHED', amount: 250000, currency: 'TZS', invoiceId: 'invoice-1', paymentId: null, actionKey: 'payment-recommendation', owner: 'BUYER', blockingReasons: [] }]
      }
    }));

    renderPostAward('/post-award?contract=contract-1&stage=finance');

    await user.click((await screen.findAllByText('Recommend payment'))[0]);
    await user.selectOptions(screen.getByLabelText('Matched invoice'), 'invoice-1');
    await user.type(screen.getByLabelText('Recommended amount'), '250000');
    await user.type(screen.getByLabelText('Retention'), '10000');
    await user.type(screen.getByLabelText('Advance recovery'), '5000');
    await user.type(screen.getByLabelText('Liquidated damages'), '2000');
    await user.type(screen.getByLabelText('Tax withholding'), '3000');
    await user.type(screen.getByLabelText('Recommendation note'), 'Ready for approval.');
    await user.click(screen.getByRole('button', { name: 'Save action' }));

    await waitFor(() => expect(postAwardApi.createPaymentRecommendation).toHaveBeenCalledWith('contract-1', expect.objectContaining({
      invoiceId: 'invoice-1',
      amountApproved: 250000,
      note: 'Ready for approval.',
      payload: expect.objectContaining({
        retentionAmount: 10000,
        advanceRecovery: 5000,
        liquidatedDamages: 2000,
        taxWithholding: 3000,
        netAmount: 230000,
        visibilityScope: 'BUYER_PRIVATE'
      })
    })));
  });

  it('lets a buyer issue a goods acceptance decision from linked receipt and inspection records', async () => {
    const user = userEvent.setup();
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace({
      buyerTasks: [task({ id: 'acceptance', title: 'Issue acceptance decision', detail: 'Create an acceptance, partial acceptance, or rejection certificate against inspected goods.', actionKey: 'acceptance', sectionId: 'inspections' })],
      workflowSections: [
        ...workspace().workflowSections.filter((section) => section.id !== 'delivery' && section.id !== 'inspections'),
        {
          id: 'delivery',
          label: 'Delivery',
          description: 'Goods delivery schedule, dispatch, and receipt.',
          status: 'ACTIVE',
          steps: [],
          records: [{ id: 'receipt-1', type: 'goods_receipt', title: 'GRN-001', status: 'APPROVED', payload: {} }]
        },
        {
          id: 'inspections',
          label: 'Inspections / Acceptance',
          description: 'Buyer inspections and acceptance.',
          status: 'ACTIVE',
          steps: [],
          records: [{ id: 'inspection-1', type: 'goods_inspection', title: 'PX-GI-001', status: 'APPROVED', payload: { goodsReceiptId: 'receipt-1' } }]
        }
      ]
    }));

    renderPostAward('/post-award?contract=contract-1&stage=inspections');

    await user.click((await screen.findAllByText('Issue acceptance decision'))[0]);
    await user.selectOptions(screen.getByLabelText('Goods receipt'), 'receipt-1');
    await user.selectOptions(screen.getByLabelText('Goods inspection'), 'inspection-1');
    await user.type(screen.getByLabelText('Accepted value'), '250000');
    await user.click(screen.getByRole('button', { name: 'Save action' }));

    await waitFor(() => expect(postAwardApi.createAcceptance).toHaveBeenCalledWith('contract-1', expect.objectContaining({
      goodsReceiptId: 'receipt-1',
      goodsInspectionId: 'inspection-1',
      acceptedValue: 250000,
      status: 'APPROVED'
    })));
  });

  it('renders the procurement-type-specific works workflow', async () => {
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace({
      procurementType: 'WORKS',
      workflowSections: [
        ...workspace().workflowSections.filter((section) => section.id !== 'delivery'),
        {
          id: 'delivery',
          label: 'Delivery',
          description: 'Works handover, progress, BOQ, and IPC.',
          status: 'ACTIVE',
          steps: [
            { id: 'handover', label: 'Site handover', owner: 'BUYER', status: 'PENDING', count: 0 },
            { id: 'boq', label: 'BOQ measurements', owner: 'BUYER', status: 'PENDING', count: 0 },
            { id: 'ipc', label: 'Interim certificates', owner: 'BUYER', status: 'PENDING', count: 0 }
          ],
          records: []
        }
      ],
      buyerTasks: [task({ id: 'site-handover', title: 'Complete site handover', detail: 'Record possession date and site condition.', actionKey: 'site-handover', sectionId: 'delivery' })]
    }));

    renderPostAward();

    expect(await screen.findByText('Site handover')).toBeInTheDocument();
    expect(screen.getByText('BOQ measurements')).toBeInTheDocument();
    expect(screen.getByText('Interim certificates')).toBeInTheDocument();
    expect(screen.queryByText('Goods receipt')).not.toBeInTheDocument();
  });

  it('lets a buyer review a supplier works progress report', async () => {
    const user = userEvent.setup();
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace({
      procurementType: 'WORKS',
      buyerTasks: [task({ id: 'works-progress-review', title: 'Review works progress report', detail: 'Approve or return progress before measurement.', actionKey: 'works-progress-review', sectionId: 'delivery' })],
      supplierTasks: [],
      workflowSections: [
        ...workspace().workflowSections.filter((section) => section.id !== 'delivery'),
        {
          id: 'delivery',
          label: 'Delivery',
          description: 'Works handover, progress, BOQ, and IPC.',
          status: 'ACTIVE',
          steps: [],
          records: [{ id: 'progress-1', type: 'works_progress_report', title: 'WPR-001', status: 'SUBMITTED', payload: {} }]
        }
      ]
    }));

    renderPostAward();

    await user.click((await screen.findAllByText('Review works progress report'))[0]);
    await user.selectOptions(screen.getByLabelText('Progress report'), 'progress-1');
    await user.selectOptions(screen.getByLabelText('Decision'), 'APPROVED');
    await user.type(screen.getByLabelText('Accepted progress percent'), '42');
    await user.type(screen.getByLabelText('Review note'), 'Measured progress accepted');
    await user.click(screen.getByRole('button', { name: 'Save action' }));

    await waitFor(() => expect(postAwardApi.reviewWorksProgressReport).toHaveBeenCalledWith('contract-1', 'progress-1', expect.objectContaining({
      status: 'APPROVED',
      progressPercent: 42,
      note: 'Measured progress accepted'
    })));
  });

  it('lets a buyer verify a service report and set invoice eligibility', async () => {
    const user = userEvent.setup();
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace({
      procurementType: 'SERVICES',
      buyerTasks: [task({ id: 'service-report-review', title: 'Review service report', detail: 'Verify SLA evidence, accepted service amount, and correction needs.', actionKey: 'service-report-review', sectionId: 'delivery' })],
      supplierTasks: [],
      workflowSections: [
        ...workspace().workflowSections.filter((section) => section.id !== 'delivery'),
        {
          id: 'delivery',
          label: 'Delivery',
          description: 'SLA periods, reports, verification, incidents, and credits.',
          status: 'ACTIVE',
          steps: [
            { id: 'sla', label: 'SLA setup', owner: 'BUYER', status: 'DONE', count: 1 },
            { id: 'report', label: 'Service reports', owner: 'SUPPLIER', status: 'ACTIVE', count: 1 }
          ],
          records: [{ id: 'report-1', type: 'service_report', title: 'SR-001', status: 'SUBMITTED', payload: {} }]
        }
      ]
    }));

    renderPostAward();

    await user.click((await screen.findAllByText('Review service report'))[0]);
    await user.selectOptions(screen.getByLabelText('Service report'), 'report-1');
    await user.selectOptions(screen.getByLabelText('Decision'), 'APPROVED');
    await user.selectOptions(screen.getByLabelText('SLA result'), 'MET');
    await user.type(screen.getByLabelText('Accepted service amount'), '180000');
    await user.type(screen.getByLabelText('Review note'), 'Monthly SLA evidence accepted');
    await user.click(screen.getByRole('button', { name: 'Save action' }));

    await waitFor(() => expect(postAwardApi.reviewServiceReport).toHaveBeenCalledWith('contract-1', 'report-1', expect.objectContaining({
      status: 'APPROVED',
      verifiedSlaResult: 'MET',
      acceptedAmount: 180000,
      note: 'Monthly SLA evidence accepted'
    })));
  });

  it('lets a buyer review a consultancy version with payment eligibility', async () => {
    const user = userEvent.setup();
    vi.mocked(postAwardApi.workspace).mockResolvedValue(workspace({
      procurementType: 'CONSULTANCY',
      buyerTasks: [task({ id: 'deliverable-review', title: 'Review consultancy deliverable version', detail: 'Record technical decision and payment eligibility.', actionKey: 'deliverable-review', sectionId: 'inspections' })],
      supplierTasks: [],
      workflowSections: [
        ...workspace().workflowSections.filter((section) => section.id !== 'delivery' && section.id !== 'inspections'),
        {
          id: 'delivery',
          label: 'Delivery',
          description: 'Consultancy deliverables and versioned submissions.',
          status: 'ACTIVE',
          steps: [{ id: 'versions', label: 'Versioned submissions', owner: 'SUPPLIER', status: 'ACTIVE', count: 1 }],
          records: [{ id: 'version-1', type: 'deliverable_version', title: 'Version 1', status: 'SUBMITTED', payload: {} }]
        },
        {
          id: 'inspections',
          label: 'Inspections / Acceptance',
          description: 'Technical review and approval.',
          status: 'ACTIVE',
          steps: [{ id: 'review', label: 'Technical review', owner: 'BUYER', status: 'PENDING', count: 0 }],
          records: []
        }
      ]
    }));

    renderPostAward('/post-award?contract=contract-1&stage=inspections');

    await user.click((await screen.findAllByText('Review consultancy deliverable version'))[0]);
    await user.selectOptions(screen.getByLabelText('Submitted version'), 'version-1');
    await user.selectOptions(screen.getByLabelText('Decision'), 'APPROVED');
    await user.type(screen.getByLabelText('Accepted amount'), '220000');
    await user.click(screen.getByLabelText('Payment eligible'));
    await user.type(screen.getByLabelText('Supplier-visible comments'), 'Accepted for payment');
    await user.type(screen.getByLabelText('Buyer private notes'), 'Internal technical note');
    await user.click(screen.getByRole('button', { name: 'Save action' }));

    await waitFor(() => expect(postAwardApi.reviewDeliverableVersion).toHaveBeenCalledWith('contract-1', 'version-1', expect.objectContaining({
      decision: 'APPROVED',
      acceptedAmount: 220000,
      paymentEligible: true,
      comments: 'Accepted for payment',
      buyerPrivateNotes: 'Internal technical note'
    })));
  });
});
