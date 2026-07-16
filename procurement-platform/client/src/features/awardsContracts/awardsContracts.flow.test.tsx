import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { store } from '@/app/store';
import '@/i18n';
import { postAwardApi } from '@/features/postAward/api';
import { awardsContractsApi } from './api';
import type { AwardContractDashboard, AwardContractSampleDashboard, AwardContractSampleDto, ContractDetailDto, LifecycleAction } from './types';
import { AwardingContractsProcurexPage } from './components/procurex/AwardingContractsProcurexPage';
import { AwardRecommendationProcurexPage } from './components/procurex/AwardRecommendationProcurexPage';
import { AwardResponseProcurexPage } from './components/procurex/AwardResponseProcurexPage';
import { ActionFormPanel } from './components/procurex/AwardContractActionForms';
import { AwardContractAccessProvider } from './components/procurex/AwardContractRoleAccess';
import { ContractClausesProcurexPage } from './components/procurex/ContractClausesProcurexPage';
import { ContractDraftingProcurexPage } from './components/procurex/ContractDraftingProcurexPage';
import { ContractNegotiationProcurexPage } from './components/procurex/ContractNegotiationProcurexPage';
import { ContractSigningProcurexPage } from './components/procurex/ContractSigningProcurexPage';
import { PostAwardTrackingProcurexPage } from './components/procurex/PostAwardTrackingProcurexPage';
import { SampleProcurementProcurexPage } from './components/procurex/SampleProcurementProcurexPage';

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

function captureAwardNotifications() {
  const notifications: Array<{ tone: string; title: string; message: string }> = [];
  const listener = (event: Event) => {
    notifications.push((event as CustomEvent).detail);
  };
  window.addEventListener('procurex:notify', listener);
  return {
    notifications,
    stop: () => window.removeEventListener('procurex:notify', listener)
  };
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

function dashboard(overrides: Partial<AwardContractDashboard['queues']> = {}, summary: Partial<AwardContractDashboard['summary']> = {}): AwardContractDashboard {
  const queues: AwardContractDashboard['queues'] = {
    'sample-procurement': [],
    'contract-preparation': [],
    'awarding-in-progress': [],
    'awards-received': [],
    'contracts-in-progress': [],
    'contract-signing': [],
    ...overrides
  };
  return {
    summary: {
      awardQueues: queues['awarding-in-progress'].length + queues['awards-received'].length,
      contractActions: queues['sample-procurement'].length + queues['contract-preparation'].length + queues['contracts-in-progress'].length + queues['contract-signing'].length,
      ...summary
    },
    queues
  };
}

function contractDetail(overrides: Partial<ContractDetailDto> = {}): ContractDetailDto {
  return {
    id: 'contract-1',
    reference: 'PX-C-1',
    awardId: 'award-1',
    supplierOrgId: 'supplier-org-1',
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

function signingReadyContract(overrides: Partial<ContractDetailDto> = {}): ContractDetailDto {
  return contractDetail({
    status: 'SIGNATURE_PENDING',
    access: {
      viewerRole: 'BUYER',
      canManageBuyerActions: true,
      canSubmitSupplierActions: false,
      canSignBuyer: true,
      canSignSupplier: false,
      readOnlyReason: null
    },
    acceptances: [
      {
        id: 'buyer-final-draft',
        type: 'acceptance',
        title: 'Buyer final draft acceptance',
        status: 'APPROVED',
        dueDate: null,
        note: '',
        payload: { acceptanceType: 'NEGOTIATED_DRAFT', role: 'BUYER' },
        createdAt: new Date().toISOString(),
        updatedAt: null
      },
      {
        id: 'supplier-final-draft',
        type: 'acceptance',
        title: 'Supplier final draft acceptance',
        status: 'APPROVED',
        dueDate: null,
        note: '',
        payload: { acceptanceType: 'NEGOTIATED_DRAFT', role: 'SUPPLIER' },
        createdAt: new Date().toISOString(),
        updatedAt: null
      }
    ],
    workflowApprovals: [
      {
        id: 'outcome-communications',
        type: 'approval',
        title: 'outcome-communications',
        status: 'APPROVED',
        dueDate: null,
        note: '',
        payload: {},
        createdAt: new Date().toISOString(),
        updatedAt: null
      }
    ],
    ...overrides
  });
}

function sampleRecord(overrides: Partial<AwardContractSampleDto> = {}): AwardContractSampleDto {
  return {
    id: 'sample-1',
    bidSampleId: 'bid-sample-1',
    viewerRole: 'BUYER',
    sampleRequired: true,
    sampleRequirementStatus: 'SUBMITTED',
    actionable: true,
    tenderId: 'tender-1',
    tenderReference: 'TDR-001',
    tenderTitle: 'Clinic equipment tender',
    bidId: 'bid-1',
    supplierOrgId: 'supplier-org-1',
    supplierName: 'Moshi Clinical Supplies',
    buyerOrgId: 'buyer-org-1',
    sampleName: 'Hospital bed sample',
    relatedItem: 'Hospital bed',
    quantity: 1,
    deliveryLocation: 'PMU office',
    deliveryDeadline: null,
    trackingStatus: 'SUBMITTED',
    awardingStatus: 'awaiting-receipt',
    sampleReference: 'SMP-001',
    courier: '',
    trackingNumber: '',
    submittedAt: '2026-07-01T08:00:00.000Z',
    receivedAt: null,
    inspectedAt: null,
    receipt: null,
    latestVerification: null,
    evaluations: [],
    tests: [],
    custodyLogs: [],
    dispositions: [],
    referenceSamples: [],
    contractId: null,
    payload: {},
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
    ...overrides
  };
}

function sampleDashboard(samples: AwardContractSampleDto[]): AwardContractSampleDashboard {
  return {
    summary: samples.reduce<Record<string, number>>((summary, sample) => {
      summary[sample.awardingStatus] = (summary[sample.awardingStatus] ?? 0) + 1;
      return summary;
    }, {}),
    queues: samples.reduce<Record<string, AwardContractSampleDto[]>>((queues, sample) => {
      queues[sample.awardingStatus] = [...(queues[sample.awardingStatus] ?? []), sample];
      return queues;
    }, {})
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

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Contract Signing' })).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: 'Active Contracts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Closed / Archived' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Contract Signing' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts?queue=contract-signing'));
    expect(screen.getByRole('tab', { name: 'Contract Signing' })).toHaveClass('active');

    expect(container.querySelector('.awarding-contracts-page > .award-floating-sidebar')).not.toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Awards Received' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts?queue=awards-received'));
    expect(screen.getByRole('tab', { name: 'Awards Received' })).toHaveClass('active');
  });

  it('renders dashboard summary counts as zero', async () => {
    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts');

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Samples' })).toBeInTheDocument());
    expect(screen.getByText('Sample actions')).toBeInTheDocument();
    expect(screen.getByText('Awards')).toBeInTheDocument();
    expect(screen.getByText('Contract actions')).toBeInTheDocument();
    expect(screen.getAllByText('0').length).toBeGreaterThanOrEqual(3);
  });

  it('shows the empty award decisions queue by default', async () => {
    const { container } = renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts');

    await waitFor(() => expect(container.querySelector<HTMLElement>('[data-tab="awarding-in-progress"].tab-content--visible')).toBeInTheDocument());
    const panel = container.querySelector<HTMLElement>('[data-tab="awarding-in-progress"].tab-content--visible');
    expect(within(panel!).getByText(/No award decisions need action yet/i)).toBeInTheDocument();
    expect(screen.getByText('Your next actions')).toBeInTheDocument();
  });

  it('shows a retryable dashboard load error instead of an empty queue', async () => {
    const user = userEvent.setup();
    const dashboard = vi.spyOn(awardsContractsApi, 'dashboard')
      .mockRejectedValueOnce(new Error('API offline'))
      .mockResolvedValueOnce({
        summary: { awardQueues: 0, contractActions: 0 },
        queues: {
          'sample-procurement': [],
          'contract-preparation': [],
          'awarding-in-progress': [],
          'awards-received': [],
          'contracts-in-progress': [],
          'contract-signing': []
        }
      });

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts');

    await waitFor(() => expect(screen.getByText('Awarding and contracts could not be loaded')).toBeInTheDocument());
    expect(screen.getByText('Awarding and contract records could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('No award decisions need action yet.')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry loading' }));
    await waitFor(() => expect(screen.getByText(/No award decisions need action yet/i)).toBeInTheDocument());
    expect(dashboard).toHaveBeenCalledTimes(2);
  });

  it('renders empty child workspaces without selected records', async () => {
    const user = userEvent.setup();
    renderFlow(<AwardRecommendationProcurexPage />, '/awards-contracts/recommendation');
    await waitFor(() => expect(screen.getByText('No recommendation is ready yet.')).toBeInTheDocument());

    renderFlow(<AwardResponseProcurexPage />, '/awards-contracts/award-response');
    await waitFor(() => expect(screen.getAllByText('No award selected').length).toBeGreaterThan(0));
    expect(screen.getByRole('button', { name: 'Open awards received' })).toHaveAttribute('data-route-search', 'queue=awards-received');

    renderFlow(<ContractNegotiationProcurexPage />, '/awards-contracts/negotiation');
    expect(screen.getByText('Open a contract in negotiation')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to negotiations' }));
    expect(screen.getAllByTestId('location').at(-1)).toHaveTextContent('/awards-contracts?queue=contracts-in-progress');

    vi.spyOn(postAwardApi, 'contracts').mockResolvedValue([]);
    renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award');
    await waitFor(() => expect(screen.getByText('Choose a contract')).toBeInTheDocument());
    expect(screen.getByText(/No contracts ready yet. Finish award, contract, and signing first./i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Awards and Contracts' })).toBeInTheDocument();
  });

  it('renders buyer signature controls with a hidden keyphrase on the dedicated contract signing page', async () => {
    const user = userEvent.setup();
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(signingReadyContract({
      signatures: [
        { id: 'buyer-signature', role: 'BUYER', status: 'PENDING', signerOrgId: null, signerName: '', signedAt: null },
        { id: 'supplier-signature', role: 'SUPPLIER', status: 'PENDING', signerOrgId: null, signerName: '', signedAt: null }
      ]
    }));
    vi.spyOn(awardsContractsApi, 'contractDocuments').mockResolvedValue([]);

    renderFlow(<ContractSigningProcurexPage />, '/awards-contracts/signing?contract=contract-1');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Signature requests and signing' })).toBeInTheDocument());
    expect(screen.getByText('BUYER')).toBeInTheDocument();
    expect(screen.getByText('SUPPLIER')).toBeInTheDocument();
    expect(screen.getByText('Sign BUYER')).toBeInTheDocument();
    expect(screen.queryByText('Sign SUPPLIER')).not.toBeInTheDocument();
    expect(screen.getByText('Buyer signing')).toBeInTheDocument();
    expect(screen.getByText('Open buyer form below')).toBeInTheDocument();
    expect(screen.getByText('Supplier signing')).toBeInTheDocument();
    expect(screen.getByText('After buyer signs')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Open form' }).at(-1)!);
    const keyphraseInput = screen.getByLabelText(/Signature keyphrase/i);
    expect(keyphraseInput).toHaveAttribute('type', 'password');
    await user.type(keyphraseInput, 'Secret123!');
    expect(screen.queryByText('Secret123!')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Signature payload/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced payload')).not.toBeInTheDocument();
  });

  it('blocks supplier signing until the buyer has signed', async () => {
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(signingReadyContract({
      access: {
        viewerRole: 'SUPPLIER',
        canManageBuyerActions: false,
        canSubmitSupplierActions: true,
        canSignBuyer: false,
        canSignSupplier: true,
        readOnlyReason: null
      },
      signatures: [
        { id: 'buyer-signature', role: 'BUYER', status: 'PENDING', signerOrgId: null, signerName: '', signedAt: null },
        { id: 'supplier-signature', role: 'SUPPLIER', status: 'PENDING', signerOrgId: null, signerName: '', signedAt: null }
      ]
    }));
    vi.spyOn(awardsContractsApi, 'contractDocuments').mockResolvedValue([]);

    renderFlow(<ContractSigningProcurexPage />, '/awards-contracts/signing?contract=contract-1');

    await waitFor(() => expect(screen.getByText('Supplier signature opens after the buyer has signed.')).toBeInTheDocument());
    expect(screen.queryByText('Sign SUPPLIER')).not.toBeInTheDocument();
  });

  it('shows the supplier signing form after the buyer signs', async () => {
    const user = userEvent.setup();
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(signingReadyContract({
      access: {
        viewerRole: 'SUPPLIER',
        canManageBuyerActions: false,
        canSubmitSupplierActions: true,
        canSignBuyer: false,
        canSignSupplier: true,
        readOnlyReason: null
      },
      signatures: [
        { id: 'buyer-signature', role: 'BUYER', status: 'SIGNED', signerOrgId: 'buyer-org-1', signerName: 'Buyer signer', signedAt: '2026-07-01T08:00:00.000Z' },
        { id: 'supplier-signature', role: 'SUPPLIER', status: 'PENDING', signerOrgId: null, signerName: '', signedAt: null }
      ]
    }));
    vi.spyOn(awardsContractsApi, 'contractDocuments').mockResolvedValue([]);

    renderFlow(<ContractSigningProcurexPage />, '/awards-contracts/signing?contract=contract-1');

    await waitFor(() => expect(screen.getByText('Supplier signing')).toBeInTheDocument());
    expect(screen.getByText('Open supplier form below')).toBeInTheDocument();
    expect(screen.getByText('Sign SUPPLIER')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Open form' }));
    const keyphraseInput = screen.getByLabelText(/Signature keyphrase/i);
    expect(keyphraseInput).toHaveAttribute('type', 'password');
    await user.type(keyphraseInput, 'SupplierSecret123!');
    expect(screen.queryByText('SupplierSecret123!')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Signature payload/i)).not.toBeInTheDocument();
  });

  it('shows the latest linked official contract document after all signatures complete', async () => {
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(signingReadyContract({
      status: 'SIGNED',
      signatures: [
        { id: 'buyer-signature', role: 'BUYER', status: 'SIGNED', signerOrgId: 'buyer-org-1', signerName: 'Buyer signer', signedAt: '2026-07-01T08:00:00.000Z' },
        { id: 'supplier-signature', role: 'SUPPLIER', status: 'SIGNED', signerOrgId: 'supplier-org-1', signerName: 'Supplier signer', signedAt: '2026-07-01T09:00:00.000Z' }
      ],
      versions: [
        { id: 'version-1', versionNo: 1, documentId: 'draft-doc', documentName: 'Draft contract', payload: {}, createdAt: '2026-07-01T07:00:00.000Z' },
        { id: 'version-2', versionNo: 2, documentId: 'official-doc', documentName: 'Official contract', payload: {}, createdAt: '2026-07-01T10:00:00.000Z' }
      ]
    }));
    vi.spyOn(awardsContractsApi, 'contractDocuments').mockResolvedValue([
      { id: 'draft-doc', name: 'Draft contract', documentType: 'contract-version', createdAt: '2026-07-01T07:00:00.000Z', contentUrl: '/api/documents/draft-doc/content', sourceLabel: 'Version 1' },
      { id: 'official-doc', name: 'Official contract', documentType: 'contract-version', createdAt: '2026-07-01T10:00:00.000Z', contentUrl: '/api/documents/official-doc/content', sourceLabel: 'Version 2' }
    ]);

    renderFlow(<ContractSigningProcurexPage />, '/awards-contracts/signing?contract=contract-1');

    await waitFor(() => expect(screen.getByText('Official contract')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: 'Open' })).toHaveAttribute('href', '/api/documents/official-doc/content');
    expect(screen.getByRole('link', { name: 'Download' })).toHaveAttribute('href', '/api/documents/official-doc/content?download=true');
  });

  it('opens active contract tracking from the direct post-award chooser', async () => {
    const user = userEvent.setup();
    vi.spyOn(postAwardApi, 'contracts').mockResolvedValue([{
      id: 'contract-1',
      title: 'Road maintenance contract',
      reference: 'PX-C-1',
      status: 'ACTIVE',
      buyerName: 'Buyer Org',
      supplierName: 'Supplier Org',
      viewerRole: 'BUYER',
      amount: 90000000,
      currency: 'TZS',
      stage: 'Delivery monitoring',
      nextAction: 'Monitor execution',
      dueDate: null,
      riskLevel: 'Low'
    }]);

    renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award');

    await waitFor(() => expect(screen.getByText('Road maintenance contract')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Setup' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/post-award/setup?contract=contract-1');
  });

  it('shows Sample required for opened missing required sample records', async () => {
    vi.spyOn(awardsContractsApi, 'samples').mockResolvedValue(sampleDashboard([
      sampleRecord({
        id: 'missing-sample-1',
        bidSampleId: null,
        sampleName: 'Required catalogue sample',
        sampleRequired: true,
        sampleRequirementStatus: 'MISSING_REQUIRED',
        trackingStatus: 'REQUIRED',
        sampleReference: '',
        submittedAt: null
      })
    ]));

    renderFlow(<SampleProcurementProcurexPage />, '/awards-contracts/samples');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Required catalogue sample' })).toBeInTheDocument());
    expect(screen.getByText('Sample requirement').nextSibling).toHaveTextContent('Sample required');
    expect(screen.getByText('This tender or bid requires a sample, but no submitted sample is available yet.')).toBeInTheDocument();
  });

  it('shows Sample required for opened submitted sample records', async () => {
    vi.spyOn(awardsContractsApi, 'samples').mockResolvedValue(sampleDashboard([
      sampleRecord({
        id: 'submitted-sample-1',
        sampleName: 'Submitted laptop sample',
        sampleRequired: true,
        sampleRequirementStatus: 'SUBMITTED'
      })
    ]));

    renderFlow(<SampleProcurementProcurexPage />, '/awards-contracts/samples');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Submitted laptop sample' })).toBeInTheDocument());
    expect(screen.getByText('Sample requirement').nextSibling).toHaveTextContent('Sample required');
    expect(screen.getByText('This tender or bid requires a sample and a sample record is available.')).toBeInTheDocument();
  });

  it('shows Sample not required for opened not-required sample records', async () => {
    vi.spyOn(awardsContractsApi, 'samples').mockResolvedValue(sampleDashboard([
      sampleRecord({
        id: 'not-required-sample-1',
        bidSampleId: null,
        sampleName: 'No sample requirement',
        sampleRequired: false,
        sampleRequirementStatus: 'NOT_REQUIRED',
        trackingStatus: 'NOT_REQUIRED',
        awardingStatus: 'not-required',
        sampleReference: '',
        submittedAt: null
      })
    ]));

    renderFlow(<SampleProcurementProcurexPage />, '/awards-contracts/samples');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'No sample requirement' })).toBeInTheDocument());
    expect(screen.getByText('Sample requirement').nextSibling).toHaveTextContent('Sample not required');
    expect(screen.getByText('This tender or bid does not require sample procurement.')).toBeInTheDocument();
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
      otherParty: 'Lake Builders Ltd',
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
      summary: { awardQueues: 1, contractActions: 0 },
      queues: {
        'sample-procurement': [],
        'contract-preparation': [],
        'awarding-in-progress': [awardAction],
        'awards-received': [],
        'contracts-in-progress': [],
        'contract-signing': []
      }
    });
    vi.spyOn(awardsContractsApi, 'recommendation').mockResolvedValue({
      ...awardAction,
      supplierName: 'Lake Builders Ltd',
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

    await waitFor(() => expect(screen.getAllByRole('heading', { name: /Award offer for Lake Builders Ltd/i }).length).toBeGreaterThan(0));
    expect(screen.getByLabelText(/Selected supplier/i)).toHaveValue('Lake Builders Ltd');
    expect(screen.getByLabelText(/Reason for award/i)).toHaveValue('Best evaluated responsive bidder.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve award' })).toBeInTheDocument();
    expect(screen.getByText('Decision to contract draft')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Send award offer notice' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open contract drafting' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Workflow step/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /Evaluation Results/i })).not.toBeInTheDocument();

    const documents = screen.getByText('Award documents').closest('details') as HTMLDetailsElement;
    expect(documents).not.toHaveAttribute('open');
    expect(screen.getByText('Supplier ranking')).toBeInTheDocument();
    expect(screen.getAllByText('Waiting period').length).toBeGreaterThan(0);
  });

  it('asks the buyer to confirm the award before sending notices', async () => {
    const user = userEvent.setup();
    const notifications = captureAwardNotifications();
    const awardAction = lifecycleAction({
      id: 'award-rec-unconfirmed',
      awardId: 'rec-unconfirmed',
      title: 'Medical supplies tender',
      otherParty: 'Lake Builders Ltd',
      status: 'RECOMMENDED',
      nextRoute: '/awards-contracts/recommendation?recommendation=rec-unconfirmed'
    });
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { awardQueues: 1, contractActions: 0 },
      queues: {
        'sample-procurement': [],
        'contract-preparation': [],
        'awarding-in-progress': [awardAction],
        'awards-received': [],
        'contracts-in-progress': [],
        'contract-signing': []
      }
    });
    vi.spyOn(awardsContractsApi, 'recommendation').mockResolvedValue({
      ...awardAction,
      supplierName: 'Lake Builders Ltd',
      tenderTitle: 'Medical supplies tender',
      reason: 'Best evaluated responsive bidder.'
    });
    const settleAwardGroup = vi.spyOn(awardsContractsApi, 'settleAwardGroup').mockResolvedValue({} as never);

    try {
      renderFlow(<AwardRecommendationProcurexPage />, '/awards-contracts/recommendation?recommendation=rec-unconfirmed');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Approve award' })).toBeInTheDocument());
      expect(screen.queryByRole('button', { name: 'Send award offer notice' })).not.toBeInTheDocument();

      expect(settleAwardGroup).not.toHaveBeenCalled();
    } finally {
      notifications.stop();
    }
  });

  it('sends notices after confirmation and hides internal clause errors from the toast', async () => {
    const user = userEvent.setup();
    const notifications = captureAwardNotifications();
    const awardAction = lifecycleAction({
      id: 'award-rec-approved',
      awardId: 'rec-approved',
      title: 'Medical supplies tender',
      otherParty: 'Lake Builders Ltd',
      status: 'APPROVED',
      nextRoute: '/awards-contracts/recommendation?recommendation=rec-approved'
    });
    const approvedDetail = {
      ...awardAction,
      status: 'APPROVED',
      supplierName: 'Lake Builders Ltd',
      tenderTitle: 'Medical supplies tender',
      reason: 'Best evaluated responsive bidder.'
    };
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { awardQueues: 1, contractActions: 0 },
      queues: {
        'sample-procurement': [],
        'contract-preparation': [],
        'awarding-in-progress': [awardAction],
        'awards-received': [],
        'contracts-in-progress': [],
        'contract-signing': []
      }
    });
    vi.spyOn(awardsContractsApi, 'recommendation').mockResolvedValue(approvedDetail);
    const settleAwardGroup = vi.spyOn(awardsContractsApi, 'settleAwardGroup')
      .mockRejectedValueOnce(new Error('Award cannot be settled until open clauses and negotiation points are approved, completed, or waived.'))
      .mockResolvedValueOnce({
        ...approvedDetail,
        notice: { id: 'notice-1', reference: 'AN-1', status: 'PENDING_RESPONSE', contractId: null, responses: [] }
      });

    try {
      renderFlow(<AwardRecommendationProcurexPage />, '/awards-contracts/recommendation?recommendation=rec-approved');
      await waitFor(() => expect(screen.getByRole('button', { name: 'Send award offer notice' })).toBeInTheDocument());
      await user.click(screen.getByRole('button', { name: 'Send award offer notice' }));
      await user.type(screen.getByLabelText('Signature keyphrase'), 'Secret123!');
      await user.click(within(screen.getByRole('dialog', { name: 'Send award offer notice' })).getByRole('button', { name: 'Send award offer notice' }));
      await waitFor(() => expect(settleAwardGroup).toHaveBeenCalledTimes(1));
      expect(notifications.notifications.at(-1)).toMatchObject({
        title: 'Offer not sent',
        message: 'Award offer could not be sent.'
      });
      expect(notifications.notifications.at(-1)?.message).not.toMatch(/open clauses|negotiation points/i);

      await user.click(within(screen.getByRole('dialog', { name: 'Send award offer notice' })).getByRole('button', { name: /Cancel/i }));
      await user.click(screen.getByRole('button', { name: 'Send award offer notice' }));
      await user.type(screen.getByLabelText('Signature keyphrase'), 'Secret123!');
      await user.click(within(screen.getByRole('dialog', { name: 'Send award offer notice' })).getByRole('button', { name: 'Send award offer notice' }));
      await waitFor(() => expect(settleAwardGroup).toHaveBeenCalledTimes(2));
      expect(notifications.notifications).toEqual(expect.arrayContaining([
        expect.objectContaining({ title: 'Award offer sent' })
      ]));
    } finally {
      notifications.stop();
    }
  });

  it('gates contract generation until the supplier accepts and a contract is linked', async () => {
    const user = userEvent.setup();
    const notifications = captureAwardNotifications();
    const awardAction = lifecycleAction({
      id: 'award-rec-contract',
      awardId: 'rec-contract',
      title: 'Medical supplies tender',
      otherParty: 'Lake Builders Ltd',
      status: 'APPROVED',
      nextRoute: '/awards-contracts/recommendation?recommendation=rec-contract'
    });
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { awardQueues: 1, contractActions: 0 },
      queues: {
        'sample-procurement': [],
        'contract-preparation': [],
        'awarding-in-progress': [awardAction],
        'awards-received': [],
        'contracts-in-progress': [],
        'contract-signing': []
      }
    });
    vi.spyOn(awardsContractsApi, 'recommendation').mockResolvedValue({
      ...awardAction,
      supplierName: 'Lake Builders Ltd',
      tenderTitle: 'Medical supplies tender',
      reason: 'Best evaluated responsive bidder.',
      notice: { id: 'notice-1', reference: 'AN-1', status: 'PENDING_RESPONSE', contractId: null, responses: [] }
    });

    try {
      renderFlow(<AwardRecommendationProcurexPage />, '/awards-contracts/recommendation?recommendation=rec-contract');
      await waitFor(() => expect(screen.getByText('Waiting for supplier decision')).toBeInTheDocument());

      expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts/recommendation?recommendation=rec-contract');
      expect(screen.queryByRole('button', { name: 'Open contract drafting' })).not.toBeInTheDocument();
      expect(notifications.notifications).toEqual([]);
    } finally {
      notifications.stop();
    }
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
      summary: { awardQueues: 1, contractActions: 0 },
      queues: {
        'sample-procurement': [],
        'contract-preparation': [],
        'awarding-in-progress': [awardAction],
        'awards-received': [],
        'contracts-in-progress': [],
        'contract-signing': []
      }
    });

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=awarding-in-progress');

    await waitFor(() => expect(screen.getAllByText('Road maintenance award').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Arusha Works Ltd').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Award approval').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('columnheader', { name: 'Priority' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('columnheader', { name: 'Related Tender/Contract' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Approve award' })).not.toBeInTheDocument();

    const approveButtons = screen.getAllByRole('button', { name: 'Approve award' });
    await user.click(approveButtons[approveButtons.length - 1]);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts/recommendation?recommendation=rec-card-1&step=award-decision'));
  });

  it('renders contract drafting queue and opens the drafting workspace', async () => {
    const user = userEvent.setup();
    const preparationAction = lifecycleAction({
      id: 'contract-prep-1',
      sourceType: 'CONTRACT_ACTIVE',
      tenderId: 'tender-prep-1',
      awardId: null,
      contractId: 'contract-prep-1',
      title: 'Clinic equipment contract preparation',
      otherParty: 'Supplier selected after evaluation',
      currentStage: 'Contract preparation',
      requiredAction: 'Prepare contract',
      status: 'DRAFT',
      nextRoute: '/awards-contracts/drafting?contract=contract-prep-1'
    });
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue(dashboard({
      'contract-preparation': [preparationAction]
    }));

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=contract-preparation');

    await waitFor(() => expect(screen.getByRole('tab', { name: 'Contract Drafting' })).toHaveClass('active'));
    expect(screen.getAllByText('Clinic equipment contract preparation').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Contract preparation').length).toBeGreaterThan(0);

    const prepareButtons = screen.getAllByRole('button', { name: 'Open drafting' });
    await user.click(prepareButtons[prepareButtons.length - 1]);
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts/drafting?contract=contract-prep-1&step=draft'));
  });

  it('keeps dashboard records unfiltered in the prototype queue table', async () => {
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { awardQueues: 2, contractActions: 0 },
      queues: {
        'sample-procurement': [],
        'contract-preparation': [],
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
        'contract-signing': []
      }
    });

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=awarding-in-progress');

    await waitFor(() => expect(screen.getAllByText('Road maintenance award').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Hospital supplies award').length).toBeGreaterThan(0);
    expect(screen.queryByRole('textbox', { name: 'Search award and contract records' })).not.toBeInTheDocument();
    expect(screen.queryByText('Showing 1 of 2')).not.toBeInTheDocument();
  });

  it('keeps supplier award and contract queues visible through prototype tabs', async () => {
    const user = userEvent.setup();
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { awardQueues: 2, contractActions: 4 },
      queues: {
        'sample-procurement': [],
        'contract-preparation': [],
        'awarding-in-progress': [],
        'awards-received': [
          lifecycleAction({ id: 'supplier-award-1', roleContext: 'SUPPLIER', sourceType: 'AWARD_RECEIVED', title: 'Zanzibar clinic award', otherParty: 'Zanzibar Health Board', awardId: 'rec-zanzibar-1', noticeId: 'notice-zanzibar-1', requiredAction: 'Respond to notice' }),
          lifecycleAction({ id: 'supplier-award-2', roleContext: 'SUPPLIER', sourceType: 'AWARD_RECEIVED', title: 'Mwanza warehouse award', otherParty: 'Mwanza Stores', awardId: 'rec-mwanza-1', noticeId: 'notice-mwanza-1', requiredAction: 'Respond to notice' })
        ],
        'contracts-in-progress': [
          lifecycleAction({ id: 'contract-progress-1', sourceType: 'CONTRACT_ACTIVE', title: 'Zanzibar clinic contract draft', otherParty: 'Zanzibar Health Board', contractId: 'contract-zanzibar-1', currentStage: 'Negotiation' }),
          lifecycleAction({ id: 'contract-progress-2', sourceType: 'CONTRACT_ACTIVE', title: 'Dodoma school contract draft', otherParty: 'Dodoma Council', contractId: 'contract-dodoma-1', currentStage: 'Negotiation' })
        ],
        'contract-signing': [
          lifecycleAction({ id: 'contract-signing-1', sourceType: 'CONTRACT_ACTIVE', title: 'Zanzibar contract pending signature', otherParty: 'Zanzibar Health Board', contractId: 'contract-zanzibar-signing', status: 'SIGNATURE_PENDING', currentStage: 'Signature', requiredAction: 'Sign contract', nextRoute: '/awards-contracts/signing?contract=contract-zanzibar-signing' }),
          lifecycleAction({ id: 'contract-signing-2', sourceType: 'CONTRACT_ACTIVE', title: 'Arusha road works pending signature', otherParty: 'Arusha Works', contractId: 'contract-arusha-signing', status: 'SIGNATURE_PENDING', currentStage: 'Signature', requiredAction: 'Sign contract', nextRoute: '/awards-contracts/signing?contract=contract-arusha-signing' })
        ]
      }
    });

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=awards-received');

    await waitFor(() => expect(screen.getAllByText('Zanzibar clinic award').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Zanzibar clinic award').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mwanza warehouse award').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Contract Negotiation' }));
    expect(screen.getAllByText('Zanzibar clinic contract draft').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dodoma school contract draft').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('tab', { name: 'Contract Signing' }));
    expect(screen.getAllByText('Zanzibar contract pending signature').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Arusha road works pending signature').length).toBeGreaterThan(0);
    expect(screen.queryByRole('tab', { name: 'Active Contracts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Closed / Archived' })).not.toBeInTheDocument();
  });

  it('does not render removed role and risk filter controls on the dashboard', async () => {
    vi.spyOn(awardsContractsApi, 'dashboard').mockResolvedValue({
      summary: { awardQueues: 0, contractActions: 0 },
      queues: {
        'sample-procurement': [
          lifecycleAction({ id: 'sample-action-1', roleContext: 'BUYER', sourceType: 'SAMPLE_ACTION', title: 'Buyer sample receipt', otherParty: 'Supplier party', riskLevel: 'High' }),
          lifecycleAction({ id: 'sample-action-2', roleContext: 'BUYER', sourceType: 'SAMPLE_ACTION', title: 'Buyer sample evaluation', otherParty: 'Supplier party', riskLevel: 'Low' })
        ],
        'contract-preparation': [],
        'awarding-in-progress': [],
        'awards-received': [],
        'contracts-in-progress': [],
        'contract-signing': []
      }
    });

    renderFlow(<AwardingContractsProcurexPage />, '/awards-contracts?queue=sample-procurement');

    await waitFor(() => expect(screen.getAllByText('Buyer sample receipt').length).toBeGreaterThan(0));
    expect(screen.getAllByText('Buyer sample evaluation').length).toBeGreaterThan(0);
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
      summary: { awardQueues: 1, contractActions: 0 },
      queues: {
        'sample-procurement': [],
        'contract-preparation': [],
        'awarding-in-progress': [],
        'awards-received': [awardAction],
        'contracts-in-progress': [],
        'contract-signing': []
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
    await user.click(screen.getByRole('button', { name: 'Accept award and request contract draft' }));
    await user.type(screen.getByLabelText('Signature keyphrase'), 'Secret123!');
    await user.click(within(screen.getByRole('dialog', { name: 'Submit award response' })).getByRole('button', { name: 'Sign and submit' }));

    await waitFor(() => expect(respond).toHaveBeenCalledWith('notice-supplier-refresh', 'ACCEPT', expect.any(String), expect.any(Object), 'Secret123!'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Open contract negotiation' })).toBeInTheDocument());
    expect(screen.getByText(/Contract linked/i)).toBeInTheDocument();
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
      summary: { awardQueues: 1, contractActions: 0 },
      queues: {
        'sample-procurement': [],
        'contract-preparation': [],
        'awarding-in-progress': [awardAction],
        'awards-received': [],
        'contracts-in-progress': [],
        'contract-signing': []
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
        awardId: 'rec-picker-1',
        supplierOrgId: 'supplier-org-1',
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

    await waitFor(() => expect(screen.getAllByRole('heading', { name: /Award offer for Moshi Clinical Supplies/i }).length).toBeGreaterThan(0));
    const documents = screen.getByText('Award documents').closest('details') as HTMLDetailsElement;
    await user.click(within(documents).getByText('Award documents'));
    expect(within(documents).getByText('Tender Document')).toBeInTheDocument();
    expect(within(documents).getByText('Bid Documents')).toBeInTheDocument();
    expect(within(documents).getByText('Evaluation Report')).toBeInTheDocument();
    expect(within(documents).getAllByRole('button', { name: 'Open' }).length).toBeGreaterThanOrEqual(2);
    expect(within(documents).getAllByRole('button', { name: 'Download' }).length).toBeGreaterThanOrEqual(2);
    expect(container.querySelector('[data-award-contract-form="Tie-breaker"]')).not.toBeInTheDocument();
  });

  it('renders contract drafting and post-award workspaces from contract detail', async () => {
    const contract: ContractDetailDto = {
      id: 'contract-1',
      reference: 'PX-C-1',
      awardId: 'award-1',
      supplierOrgId: 'supplier-org-1',
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
      audit: [],
      access: {
        viewerRole: 'BUYER',
        canManageBuyerActions: true,
        canSubmitSupplierActions: false,
        canSignBuyer: true,
        canSignSupplier: false,
        readOnlyReason: null
      }
    };
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(contract);
    vi.spyOn(awardsContractsApi, 'contractDocuments').mockResolvedValue([]);

    const contractRender = renderFlow(<ContractDraftingProcurexPage />, '/awards-contracts/drafting?contract=contract-1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Standard contract document' })).toBeInTheDocument());
    expect(screen.getAllByText('PX-C-1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Selected Contract')).not.toBeInTheDocument();
    expect(screen.getByText(/Tender and Commercial Terms/)).toBeInTheDocument();
    expect(screen.queryByText(/\{"buyer"/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Clause Library')).not.toBeInTheDocument();
    expect(screen.queryByText('Build the contract terms')).not.toBeInTheDocument();
    expect(screen.queryByText('Send a clarification or amendment request')).not.toBeInTheDocument();
    contractRender.unmount();

    renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award?contract=contract-1');
    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Contract management plan (CMP)' }).length).toBeGreaterThan(0));
    expect(screen.getAllByText('PX-C-1').length).toBeGreaterThan(0);
    expect(screen.queryByText('Selected Contract')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Post-award health summary' })).not.toBeInTheDocument();
    expect(screen.queryByText("Open the page that matches today's task")).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Post-award pages' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Finance/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Risk/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Close-out/ })).toBeInTheDocument();
  });

  it('generates a draft version and sends it to negotiation without the clause library panel', async () => {
    const user = userEvent.setup();
    const contract = contractDetail({
      status: 'DRAFT',
      access: {
        viewerRole: 'BUYER',
        canManageBuyerActions: true,
        canSubmitSupplierActions: false,
        canSignBuyer: true,
        canSignSupplier: false,
        readOnlyReason: null
      },
      clauses: [
        {
          id: 'clause-1',
          type: 'clause',
          title: 'Payment terms',
          status: 'OPEN',
          dueDate: null,
          note: 'Pay within 30 days.',
          payload: { clauseKey: 'payment_terms', category: 'commercial', buyerComment: 'Buyer review pending.' },
          createdAt: new Date().toISOString(),
          updatedAt: null
        }
      ]
    });
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(contract);
    vi.spyOn(awardsContractsApi, 'contractDocuments').mockResolvedValue([]);
    const uploadDocument = vi.spyOn(awardsContractsApi, 'uploadContractDocument').mockResolvedValue({
      id: 'draft-doc-1',
      name: 'PX-C-1-draft-v1.pdf',
      documentType: 'CONTRACT_DRAFT',
      createdAt: new Date().toISOString(),
      contentUrl: '/api/documents/draft-doc-1/content',
      sourceLabel: 'Uploaded evidence'
    });
    const versionedContract = {
      ...contract,
      versions: [{ id: 'version-1', versionNo: 1, documentId: 'draft-doc-1', documentName: 'PX-C-1-draft-v1.pdf', payload: {}, createdAt: new Date().toISOString() }]
    };
    const saveDraft = vi.spyOn(awardsContractsApi, 'saveDraft').mockResolvedValue(versionedContract);
    const sendForNegotiation = vi.spyOn(awardsContractsApi, 'sendForNegotiation').mockResolvedValue({ ...versionedContract, status: 'NEGOTIATION' });

    const draftRender = renderFlow(<ContractDraftingProcurexPage />, '/awards-contracts/drafting?contract=contract-1');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Standard contract document' })).toBeInTheDocument());
    expect(screen.queryByText('Clause Library')).not.toBeInTheDocument();
    expect(screen.queryByText('Build the contract terms')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Contract Clauses' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit contract wording' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Clause wording')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit Contract Clauses' }));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts/drafting/clauses?contract=contract-1'));

    draftRender.unmount();
    renderFlow(<ContractDraftingProcurexPage />, '/awards-contracts/drafting?contract=contract-1');
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Standard contract document' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Generate draft document' }));
    await waitFor(() => expect(uploadDocument).toHaveBeenCalledWith('contract-1', expect.objectContaining({
      documentType: 'CONTRACT_DRAFT',
      mimeType: 'application/pdf',
      contentBase64: expect.any(String)
    })));
    await waitFor(() => expect(saveDraft).toHaveBeenCalledWith('contract-1', expect.objectContaining({ documentId: 'draft-doc-1' }), 'draft-doc-1'));

    await user.click(screen.getByRole('button', { name: 'Send to negotiation' }));
    await waitFor(() => expect(sendForNegotiation).toHaveBeenCalledWith('contract-1'));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts/negotiation?contract=contract-1'));
  });

  it('edits and adds contract clauses in the dedicated clause workspace', async () => {
    const user = userEvent.setup();
    const contract = contractDetail({
      status: 'DRAFT',
      clauses: [
        {
          id: 'clause-1',
          type: 'clause',
          title: 'Payment terms',
          status: 'OPEN',
          dueDate: null,
          note: 'Pay within 30 days.',
          payload: { clauseKey: 'payment_terms', category: 'payment' },
          createdAt: new Date().toISOString(),
          updatedAt: null
        }
      ],
      access: {
        viewerRole: 'BUYER',
        canManageBuyerActions: true,
        canSubmitSupplierActions: false,
        canSignBuyer: true,
        canSignSupplier: false,
        readOnlyReason: null
      }
    });
    const updatedContract = { ...contract, clauses: [{ ...contract.clauses![0], note: 'Pay within 21 days.' }] };
    const customContract = {
      ...updatedContract,
      clauses: [
        ...updatedContract.clauses!,
        {
          id: 'clause-2',
          type: 'clause',
          title: 'Data protection',
          status: 'OPEN',
          dueDate: null,
          note: 'Supplier must protect buyer data.',
          payload: { clauseKey: 'data-protection', category: 'compliance' },
          createdAt: new Date().toISOString(),
          updatedAt: null
        }
      ]
    };
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(contract);
    const upsertClause = vi.spyOn(awardsContractsApi, 'upsertClause')
      .mockResolvedValueOnce(updatedContract)
      .mockResolvedValueOnce(customContract);
    const deleteClause = vi.spyOn(awardsContractsApi, 'deleteClause')
      .mockResolvedValue({ ...updatedContract, clauses: [] });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderFlow(<ContractClausesProcurexPage />, '/awards-contracts/drafting/clauses?contract=contract-1');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Choose a clause to edit' })).toBeInTheDocument());
    expect(screen.queryByText('Clause Library')).not.toBeInTheDocument();
    expect(screen.queryByText('Build the contract terms')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);
    const editDialog = screen.getByRole('dialog', { name: 'Payment terms' });
    fireEvent.change(within(editDialog).getByLabelText('Clause wording'), { target: { value: 'Pay within 21 days.' } });
    await user.click(within(editDialog).getByRole('button', { name: 'Save clause' }));
    await waitFor(() => expect(upsertClause).toHaveBeenCalledWith('contract-1', expect.objectContaining({
      clauseKey: 'payment_terms',
      title: 'Payment terms',
      body: 'Pay within 21 days.',
      category: 'payment'
    })));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts/drafting/clauses?contract=contract-1');

    await user.click(screen.getByRole('button', { name: 'Delete Payment terms' }));
    await waitFor(() => expect(deleteClause).toHaveBeenCalledWith('contract-1', 'clause-1'));

    await user.click(screen.getByRole('button', { name: 'New custom clause' }));
    const customDialog = screen.getByRole('dialog', { name: 'Add buyer-defined clause' });
    fireEvent.change(within(customDialog).getByLabelText('Category'), { target: { value: 'compliance' } });
    fireEvent.change(within(customDialog).getByLabelText('Clause title'), { target: { value: 'Data protection' } });
    fireEvent.change(within(customDialog).getByLabelText('Clause wording'), { target: { value: 'Supplier must protect buyer data.' } });
    await user.click(within(customDialog).getByRole('button', { name: 'Save and review draft' }));
    await waitFor(() => expect(upsertClause).toHaveBeenLastCalledWith('contract-1', expect.objectContaining({
      title: 'Data protection',
      body: 'Supplier must protect buyer data.',
      category: 'compliance'
    })));
    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/awards-contracts/drafting?contract=contract-1'));
  });

  it('handles supplier clarification and buyer amendment decisions in contract negotiation', async () => {
    const user = userEvent.setup();
    const supplierContract = contractDetail({
      status: 'NEGOTIATION',
      access: {
        viewerRole: 'SUPPLIER',
        canManageBuyerActions: false,
        canSubmitSupplierActions: true,
        canSignBuyer: false,
        canSignSupplier: true,
        readOnlyReason: null
      },
      clauses: [
        {
          id: 'clause-1',
          type: 'clause',
          title: 'Payment terms',
          status: 'OPEN',
          dueDate: null,
          note: 'Pay within 30 days.',
          payload: { clauseKey: 'payment_terms', category: 'payment' },
          createdAt: new Date().toISOString(),
          updatedAt: null
        }
      ]
    });
    const buyerContract = contractDetail({
      ...supplierContract,
      access: {
        viewerRole: 'BUYER',
        canManageBuyerActions: true,
        canSubmitSupplierActions: false,
        canSignBuyer: true,
        canSignSupplier: false,
        readOnlyReason: null
      },
      negotiations: [
        {
          id: 'negotiation-1',
          type: 'Supplier',
          title: 'Extend payment period',
          status: 'OPEN',
          dueDate: null,
          note: 'Supplier requested 45 days.',
          payload: { clauseId: 'clause-1', requestType: 'AMENDMENT', counterOffer: '45 days' },
          createdAt: new Date().toISOString(),
          updatedAt: null
        }
      ]
    });
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValueOnce(supplierContract).mockResolvedValueOnce(buyerContract);
    vi.spyOn(awardsContractsApi, 'contractDocuments').mockResolvedValue([]);
    const createNegotiation = vi.spyOn(awardsContractsApi, 'createNegotiation').mockResolvedValue({
      ...supplierContract,
      negotiations: buyerContract.negotiations
    });
    const updateNegotiation = vi.spyOn(awardsContractsApi, 'updateNegotiation').mockResolvedValue({ ...buyerContract, status: 'DRAFT', payload: { redraftRequired: true } });

    const supplierRender = renderFlow(<ContractNegotiationProcurexPage />, '/awards-contracts/negotiation?contract=contract-1');
    await waitFor(() => expect(screen.getByText('Send a request')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Request type'), { target: { value: 'AMENDMENT' } });
    fireEvent.change(screen.getByLabelText('Clause or section'), { target: { value: 'clause-1' } });
    fireEvent.change(screen.getByLabelText('Where clarification or amendment is needed'), { target: { value: 'Extend payment period' } });
    fireEvent.change(screen.getByLabelText('Reason and details'), { target: { value: 'Supplier requested 45 days.' } });
    fireEvent.change(screen.getByLabelText('Suggested replacement wording'), { target: { value: '45 days' } });
    await user.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() =>
      expect(createNegotiation).toHaveBeenCalledWith('contract-1', expect.objectContaining({
        requestType: 'AMENDMENT',
        clauseId: 'clause-1',
        subject: 'Extend payment period',
        position: 'Supplier requested 45 days.',
        counterOffer: '45 days',
        status: 'OPEN'
      }))
    );
    expect(screen.getByText('Resolve open requests first.')).toBeInTheDocument();
    supplierRender.unmount();

    renderFlow(<ContractNegotiationProcurexPage />, '/awards-contracts/negotiation?contract=contract-1');
    await waitFor(() => expect(screen.getByText('Extend payment period')).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Buyer reason / explanation'), { target: { value: 'Accepted and will redraft.' } });
    await user.click(screen.getByRole('button', { name: 'Accept request' }));
    await waitFor(() => expect(updateNegotiation).toHaveBeenCalledWith('contract-1', 'negotiation-1', expect.objectContaining({
      status: 'APPROVED',
      reason: 'Accepted and will redraft.'
    })));
  });

  it('keeps supplier negotiation and signing controls out of pre-award contract drafting', async () => {
    const contract = contractDetail({
      tenderId: 'tender-prep-1',
      awardId: null,
      supplierOrgId: null,
      status: 'DRAFT',
      supplierName: null,
      access: {
        viewerRole: 'BUYER',
        canManageBuyerActions: true,
        canSubmitSupplierActions: false,
        canSignBuyer: true,
        canSignSupplier: false,
        readOnlyReason: null
      },
      clauses: [
        {
          id: 'clause-1',
          type: 'clause',
          title: 'Payment terms',
          status: 'OPEN',
          dueDate: null,
          note: 'Draft payment terms.',
          payload: { clauseKey: 'payment_terms' },
          createdAt: new Date().toISOString(),
          updatedAt: null
        }
      ],
      requiredDocuments: [
        {
          id: 'document-1',
          type: 'document',
          title: 'Performance security',
          status: 'REQUIRED',
          dueDate: null,
          note: 'Required after award.',
          payload: {},
          createdAt: new Date().toISOString(),
          updatedAt: null
        }
      ]
    });
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(contract);
    vi.spyOn(awardsContractsApi, 'contractDocuments').mockResolvedValue([]);

    renderFlow(<ContractDraftingProcurexPage />, '/awards-contracts/drafting?contract=contract-1');

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Standard contract document' })).toBeInTheDocument());
    expect(screen.getByText('Supplier selected after award acceptance')).toBeInTheDocument();
    expect(screen.getAllByText('Payment terms').length).toBeGreaterThan(0);
    expect(screen.getByText(/Performance security/)).toBeInTheDocument();
    expect(screen.queryByText('Send a clarification or amendment request')).not.toBeInTheDocument();
    expect(screen.queryByText('Signatures are locked')).not.toBeInTheDocument();
    expect(screen.queryByText('Sign contract')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request signatures' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Activate contract' })).not.toBeInTheDocument();
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

    await waitFor(() => expect(screen.getAllByRole('heading', { name: 'Contract management plan (CMP)' }).length).toBeGreaterThan(0));
    expect(screen.queryByText('Overdue work')).not.toBeInTheDocument();
    expect(screen.queryByText('Payment blockers')).not.toBeInTheDocument();
    expect(form('Contract management plan (CMP)')).toBeInTheDocument();
    expect(form('Contract status')).toBeInTheDocument();
    expect(form('Milestone')).toBeInTheDocument();
    expect(form('Invoice submission')).not.toBeInTheDocument();
    expect(form('Termination')).not.toBeInTheDocument();
    expect(form('Supplier performance')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Finance/ }));
    expect(form('Invoice submission')).toBeInTheDocument();
    expect(form('Payment review')).toBeInTheDocument();
    expect(form('Payment approval')).toBeInTheDocument();
    expect(form('Contract management plan (CMP)')).not.toBeInTheDocument();
    expect(form('Termination')).not.toBeInTheDocument();
    expect(form('Supplier performance')).not.toBeInTheDocument();

    const invoiceSubmission = form('Invoice submission') as HTMLElement;
    await user.click(within(invoiceSubmission).getByRole('button', { name: 'Open form' }));
    expect(screen.queryByRole('dialog', { name: 'Invoice submission' })).not.toBeInTheDocument();
    expect(within(invoiceSubmission).getByRole('searchbox', { name: /Supplier organization/i })).toBeInTheDocument();
    expect(within(invoiceSubmission).queryByLabelText(/Supplier organization ID/i)).not.toBeInTheDocument();
    await user.click(within(invoiceSubmission).getByRole('button', { name: 'Cancel' }));

    const paymentReview = form('Payment review') as HTMLElement;
    await user.click(within(paymentReview).getByRole('button', { name: 'Open form' }));
    expect(within(paymentReview).getByRole('listbox', { name: 'Invoice' })).toBeInTheDocument();
    expect(within(paymentReview).queryByLabelText('Invoice ID')).not.toBeInTheDocument();
    await user.click(within(paymentReview).getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: /Termination/ }));
    expect(form('Termination')).toBeInTheDocument();
    expect(form('Termination notice')).toBeInTheDocument();
    expect(form('Invoice submission')).not.toBeInTheDocument();
    expect(form('Risk')).not.toBeInTheDocument();
    expect(form('Deliverable')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /History/ }));
    expect(screen.getByRole('heading', { name: 'Tables' })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Mobilization/ })).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Invoices/ })).toBeInTheDocument();
    expect(container.querySelector('[data-award-contract-form]')).not.toBeInTheDocument();
  });

  it('submits structured goods inspection defects without exposing JSON payload fields', async () => {
    const user = userEvent.setup();
    const contract = contractDetail({
      access: {
        viewerRole: 'BUYER',
        canManageBuyerActions: true,
        canSubmitSupplierActions: false,
        canSignBuyer: true,
        canSignSupplier: false,
        readOnlyReason: null
      },
      payload: { procurementType: 'GOODS' },
      milestones: [{ id: 'milestone-1', type: 'milestone', title: 'Delivery milestone', status: 'OPEN', dueDate: null, note: 'Pending delivery', payload: {}, createdAt: new Date().toISOString(), updatedAt: null }],
      deliverables: [{ id: 'deliverable-1', type: 'deliverable', title: 'Medical kits delivery', status: 'SUBMITTED', dueDate: null, note: 'Awaiting inspection', payload: {}, createdAt: new Date().toISOString(), updatedAt: null }]
    });
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(contract);
    const goodsInspection = vi.spyOn(awardsContractsApi, 'createGoodsInspection').mockResolvedValue(contract);
    const { container } = renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award?contract=contract-1&step=inspections');

    await waitFor(() => expect(screen.getAllByText('Inspections and acceptance').length).toBeGreaterThan(0));
    const form = container.querySelector('[data-award-contract-form="Goods inspection"]') as HTMLElement;
    await user.click(within(form).getByRole('button', { name: 'Open form' }));
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

  it('uploads and submits a document id from milestone evidence', async () => {
    const user = userEvent.setup();
    const contract = contractDetail({
      access: {
        viewerRole: 'SUPPLIER',
        canManageBuyerActions: false,
        canSubmitSupplierActions: true,
        canSignBuyer: false,
        canSignSupplier: true,
        readOnlyReason: null
      },
      milestones: [{ id: 'milestone-1', type: 'milestone', title: 'Delivery milestone', status: 'OPEN', dueDate: null, note: 'Pending delivery', payload: {}, createdAt: new Date().toISOString(), updatedAt: null }]
    });
    vi.spyOn(awardsContractsApi, 'contract').mockResolvedValue(contract);
    vi.spyOn(awardsContractsApi, 'contractDocuments').mockResolvedValue([]);
    const uploadDocument = vi.spyOn(awardsContractsApi, 'uploadContractDocument').mockResolvedValue({
      id: 'doc-uploaded',
      name: 'delivery-note.pdf',
      documentType: 'application/pdf',
      createdAt: '2026-07-14T00:00:00.000Z',
      contentUrl: '/api/award-contract/documents/doc-uploaded/content',
      sourceLabel: 'Uploaded evidence'
    });
    const addEvidence = vi.spyOn(awardsContractsApi, 'addMilestoneEvidence').mockResolvedValue(contract);
    const { container } = renderFlow(<PostAwardTrackingProcurexPage />, '/awards-contracts/post-award?contract=contract-1&step=delivery');

    await waitFor(() => expect(container.querySelector('[data-award-contract-form="Milestone evidence"]')).toBeInTheDocument());
    const form = container.querySelector('[data-award-contract-form="Milestone evidence"]') as HTMLElement;
    await user.click(within(form).getByRole('button', { name: 'Open form' }));
    expect(within(form).queryByLabelText(/Evidence document ID/i)).not.toBeInTheDocument();

    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, new File(['proof'], 'delivery-note.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(uploadDocument).toHaveBeenCalledWith('contract-1', expect.objectContaining({
      name: 'delivery-note.pdf',
      documentType: 'application/pdf',
      mimeType: 'application/pdf',
      size: 5,
      contentBase64: expect.any(String)
    })));
    await waitFor(() => expect(within(form).getByText('Selected: delivery-note.pdf')).toBeInTheDocument());

    await user.click(within(form).getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(addEvidence).toHaveBeenCalledWith('contract-1', 'milestone-1', expect.objectContaining({
      documentId: 'doc-uploaded'
    })));
  });

  it('opens production action forms read-only when they belong to the other contract party', async () => {
    const user = userEvent.setup();
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
    expect(screen.getByRole('button', { name: 'View read-only' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View read-only' }));

    expect(screen.getByLabelText('Objectives')).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  }, 10000);

  it('shows supplier-only action fields read-only for buyers without upload or submit controls', async () => {
    const user = userEvent.setup();
    const buyerAccess = {
      viewerRole: 'BUYER' as const,
      canManageBuyerActions: true,
      canSubmitSupplierActions: false,
      canSignBuyer: true,
      canSignSupplier: false,
      readOnlyReason: 'Supplier actions are read-only for the buyer.'
    };
    render(
      <AwardContractAccessProvider access={buyerAccess}>
        <ActionFormPanel
          title="Milestone evidence"
          badge="Evidence"
          fields={[
            {
              name: 'documentId',
              label: 'Evidence document',
              kind: 'document',
              document: {
                options: [{ label: 'Delivery proof.pdf', value: 'doc-1', description: 'Supplier uploaded evidence' }],
                onUpload: async () => ({ label: 'New upload.pdf', value: 'doc-2' })
              }
            },
            { name: 'note', label: 'Note', kind: 'textarea' }
          ]}
          initialValues={{ documentId: 'doc-1', note: 'Supplier delivery evidence.' }}
          onSubmit={async () => ({})}
        />
      </AwardContractAccessProvider>
    );

    expect(screen.getByText('Supplier actions are read-only for the buyer.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'View read-only' }));

    expect(screen.getByLabelText('Note')).toHaveAttribute('readonly');
    expect(screen.getByRole('option', { name: /Delivery proof.pdf/ })).toBeDisabled();
    expect(screen.queryByText('Upload file')).not.toBeInTheDocument();
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

    await user.click(screen.getByRole('button', { name: 'Open form' }));
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

    await user.click(screen.getByRole('button', { name: 'Open form' }));
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

  it('hides advanced payload fields for admin access while preserving defaults', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({});
    render(
      <AwardContractAccessProvider access={{
        viewerRole: 'ADMIN',
        canManageBuyerActions: true,
        canSubmitSupplierActions: true,
        canSignBuyer: true,
        canSignSupplier: true,
        readOnlyReason: null
      }}>
        <ActionFormPanel
          title="Admin payload review"
          badge="Admin"
          fields={[
            { name: 'note', label: 'Review note', kind: 'textarea' },
            { name: 'payload', label: 'Response payload', kind: 'json', rows: 4 }
          ]}
          initialValues={{ note: 'Internal review', payload: JSON.stringify({ source: 'admin-workspace' }) }}
          onSubmit={submit}
        />
      </AwardContractAccessProvider>
    );

    await user.click(screen.getByRole('button', { name: 'Open form' }));
    expect(screen.queryByText('Advanced payload')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Response payload/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Submit' }));
    await waitFor(() => expect(submit).toHaveBeenCalledWith(expect.objectContaining({
      note: 'Internal review',
      payload: { source: 'admin-workspace' }
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

    const launcher = screen.getByRole('button', { name: 'Open form' });
    await user.click(launcher);
    expect(screen.queryByRole('dialog', { name: 'Contract status' })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Status note/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Hide form' }));
    await waitFor(() => expect(screen.queryByLabelText(/Status note/i)).not.toBeInTheDocument());
  });
});
