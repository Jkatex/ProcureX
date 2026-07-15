import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import '@/i18n';
import { awardsContractsApi } from '@/features/awardsContracts/api';
import { PostAwardTrackingProcurexPage } from '@/features/awardsContracts/components/procurex/PostAwardTrackingProcurexPage';
import { postAwardApi } from '@/features/postAward/api';
import type { ContractDetailDto } from '@/features/awardsContracts/types';
import type { PostAwardContractRow } from '@/features/postAward/types';

vi.mock('@/features/awardsContracts/api', () => ({
  awardsContractsApi: {
    contract: vi.fn(),
    contractDocuments: vi.fn(),
    uploadContractDocument: vi.fn(),
    addMilestoneEvidence: vi.fn()
  }
}));

vi.mock('@/features/postAward/api', () => ({
  postAwardApi: {
    contracts: vi.fn()
  }
}));

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

function renderPostAward(initialEntry = '/post-award') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <PostAwardTrackingProcurexPage />
        <LocationProbe />
      </MemoryRouter>
    </Provider>
  );
}

function postAwardContractRow(overrides: Partial<PostAwardContractRow> = {}): PostAwardContractRow {
  return {
    id: 'contract-1',
    title: 'Clinic delivery contract',
    reference: 'PX-C-001',
    status: 'SIGNED',
    buyerName: 'Arusha City Council',
    supplierName: 'Moshi Medical Supplies',
    viewerRole: 'BUYER',
    amount: 1200000,
    currency: 'TZS',
    stage: 'Signed',
    nextAction: 'Complete mobilization checklist',
    dueDate: '2026-07-30T00:00:00.000Z',
    riskLevel: 'Low',
    ...overrides
  };
}

function contractDetail(overrides: Partial<ContractDetailDto> = {}): ContractDetailDto {
  return {
    access: {
      viewerRole: 'SUPPLIER',
      canManageBuyerActions: false,
      canSubmitSupplierActions: true,
      canSignBuyer: false,
      canSignSupplier: true,
      readOnlyReason: 'Buyer actions are read-only for the supplier.'
    },
    id: 'contract-1',
    reference: 'PX-C-001',
    tenderId: 'tender-1',
    tenderReference: 'TDR-001',
    buyerOrgId: 'buyer-1',
    supplierOrgId: 'supplier-1',
    awardId: null,
    noticeId: null,
    title: 'Clinic delivery contract',
    status: 'ACTIVE',
    buyerName: 'Arusha City Council',
    supplierName: 'Moshi Medical Supplies',
    amount: 1200000,
    currency: 'TZS',
    payload: {},
    parties: [],
    versions: [],
    clauses: [],
    negotiations: [],
    signatures: [],
    milestones: [{ id: 'milestone-1', type: 'milestone', title: 'First delivery', status: 'OPEN', dueDate: '2026-07-30T00:00:00.000Z', note: 'Pending delivery', payload: {}, createdAt: '2026-07-14T00:00:00.000Z', updatedAt: null }],
    managementPlan: null,
    mobilizationItems: [],
    kpis: [],
    deliverables: [],
    acceptances: [],
    inspections: [],
    goodsInspections: [],
    paymentSchedules: [],
    purchaseOrders: [],
    invoices: [],
    payments: [],
    threeWayMatches: [],
    paymentApprovals: [],
    paymentConfirmations: [],
    commencements: [],
    nonConformances: [],
    securities: [],
    penalties: [],
    changeRequests: [],
    referenceSamples: [],
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

describe('PostAwardTrackingProcurexPage', () => {
  beforeEach(() => {
    vi.mocked(postAwardApi.contracts).mockResolvedValue([postAwardContractRow()]);
    vi.mocked(awardsContractsApi.contract).mockResolvedValue(contractDetail());
    vi.mocked(awardsContractsApi.contractDocuments).mockResolvedValue([]);
    vi.mocked(awardsContractsApi.uploadContractDocument).mockResolvedValue({
      id: 'doc-uploaded',
      name: 'delivery-note.pdf',
      documentType: 'application/pdf',
      createdAt: '2026-07-14T00:00:00.000Z',
      contentUrl: '/api/award-contract/documents/doc-uploaded/content',
      sourceLabel: 'Uploaded evidence'
    });
    vi.mocked(awardsContractsApi.addMilestoneEvidence).mockResolvedValue(contractDetail());
  });

  it('opens the post-award dashboard with signed contracts from the post-award facade', async () => {
    const user = userEvent.setup();
    renderPostAward();

    expect(await screen.findByRole('heading', { name: 'Post-award' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Choose a contract' })).toBeInTheDocument();
    expect(await screen.findByText('Clinic delivery contract')).toBeInTheDocument();
    expect(screen.getByText('Signed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Setup' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/post-award/setup?contract=contract-1');
  });

  it('maps old stage links to the matching post-award subpage', async () => {
    renderPostAward('/post-award?contract=contract-1&stage=delivery');

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/post-award/delivery?contract=contract-1'));
    expect(await screen.findByRole('heading', { name: 'Delivery' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'My actions' })).toBeInTheDocument();
  });

  it('lets suppliers open buyer setup actions as readable disabled forms', async () => {
    const user = userEvent.setup();
    renderPostAward('/post-award/setup?contract=contract-1');

    const cmpAction = (await screen.findAllByText('Contract management plan (CMP)'))
      .map((node) => node.closest('[data-award-contract-form]'))
      .find(Boolean) as HTMLElement;
    expect(cmpAction).toBeTruthy();
    expect(within(cmpAction).getByText('Buyer actions are read-only for the supplier.')).toBeInTheDocument();
    expect(within(cmpAction).queryByLabelText(/Objectives/i)).not.toBeInTheDocument();

    await user.click(within(cmpAction).getByRole('button', { name: 'View read-only' }));

    const objectives = within(cmpAction).getByLabelText(/Objectives/i);
    expect(objectives).toHaveAttribute('readonly');
    expect(within(cmpAction).queryByRole('searchbox', { name: /Contract manager/i })).not.toBeInTheDocument();
    expect(within(cmpAction).queryByText('Advanced payload')).not.toBeInTheDocument();
    expect(within(cmpAction).queryByRole('button', { name: 'Save plan' })).not.toBeInTheDocument();
    expect(within(cmpAction).queryByRole('button', { name: 'Reset' })).not.toBeInTheDocument();
    expect(within(cmpAction).getByRole('button', { name: 'Close' })).toBeInTheDocument();

    const statusAction = screen.getByText('Contract status').closest('[data-award-contract-form]') as HTMLElement;
    expect(within(statusAction).getByText('Status only')).toBeInTheDocument();
    expect(within(statusAction).queryByRole('button', { name: 'View read-only' })).not.toBeInTheDocument();
    expect(within(statusAction).queryByLabelText('Status')).not.toBeInTheDocument();

    const activationReview = screen.getByText('Activation review').closest('[data-award-contract-form]') as HTMLElement;
    expect(within(activationReview).getByRole('button', { name: 'View read-only' })).toBeInTheDocument();
  });

  it('shows supplier actions and buyer locked states on a subpage', async () => {
    const user = userEvent.setup();
    renderPostAward('/post-award/delivery?contract=contract-1');

    await waitFor(() => expect(screen.getByText('Milestone evidence')).toBeInTheDocument());
    expect(screen.getAllByText('Read-only action').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Buyer actions are read-only for the supplier.').length).toBeGreaterThan(0);

    const form = screen.getByText('Milestone evidence').closest('[data-award-contract-form]') as HTMLElement;
    await user.click(within(form).getByRole('button', { name: 'Open form' }));
    await user.upload(form.querySelector('input[type="file"]') as HTMLInputElement, new File(['proof'], 'delivery-note.pdf', { type: 'application/pdf' }));
    await waitFor(() => expect(awardsContractsApi.uploadContractDocument).toHaveBeenCalledWith('contract-1', expect.objectContaining({ name: 'delivery-note.pdf' })));
    await user.click(within(form).getByRole('button', { name: 'Submit' }));

    await waitFor(() => expect(awardsContractsApi.addMilestoneEvidence).toHaveBeenCalledWith('contract-1', 'milestone-1', expect.objectContaining({ documentId: 'doc-uploaded' })));
  });

  it('shows goods workflow actions and hides works-only delivery forms', async () => {
    vi.mocked(awardsContractsApi.contract).mockResolvedValue(contractDetail({
      payload: { procurementType: 'GOODS' },
      deliverySchedules: [],
      dispatchNotices: [],
      goodsReceipts: []
    }));

    renderPostAward('/post-award/delivery?contract=contract-1');

    expect(await screen.findByText('Goods execution')).toBeInTheDocument();
    expect(screen.getByText('Goods delivery schedule')).toBeInTheDocument();
    expect(screen.getByText('Dispatch notice')).toBeInTheDocument();
    const dispatchAction = screen.getByText('Dispatch notice').closest('[data-award-contract-form]') as HTMLElement;
    expect(within(dispatchAction).getByRole('button', { name: 'Open form' })).toBeInTheDocument();
    expect(screen.queryByText('Site handover')).not.toBeInTheDocument();
    expect(screen.queryByText('Works progress report')).not.toBeInTheDocument();
  });

  it('shows works workflow actions and hides goods-only delivery forms', async () => {
    vi.mocked(awardsContractsApi.contract).mockResolvedValue(contractDetail({
      title: 'Clinic construction works',
      payload: { procurementType: 'WORKS' },
      siteHandovers: [],
      worksProgressReports: [],
      boqMeasurements: [],
      interimPaymentCertificates: []
    }));

    renderPostAward('/post-award/delivery?contract=contract-1');

    expect(await screen.findByText('Works execution')).toBeInTheDocument();
    expect(screen.getByText('Site handover')).toBeInTheDocument();
    expect(screen.getByText('Works progress report')).toBeInTheDocument();
    const progressReport = screen.getByText('Works progress report').closest('[data-award-contract-form]') as HTMLElement;
    expect(within(progressReport).getByRole('button', { name: 'Open form' })).toBeInTheDocument();
    expect(screen.queryByText('Goods delivery schedule')).not.toBeInTheDocument();
    expect(screen.queryByText('Goods receipt')).not.toBeInTheDocument();
  });

  it('hides internal buyer/admin post-award actions from suppliers', async () => {
    const riskView = renderPostAward('/post-award/risk?contract=contract-1');
    expect(await screen.findByText('Risks and non-conformance')).toBeInTheDocument();
    expect(document.querySelector('[data-award-contract-form="Risk"]')).toBeInTheDocument();
    expect(screen.queryByText('Risk forecast')).not.toBeInTheDocument();
    riskView.unmount();

    const terminationView = renderPostAward('/post-award/termination?contract=contract-1');
    expect((await screen.findAllByRole('heading', { name: 'Termination' })).length).toBeGreaterThan(0);
    expect(screen.queryByText('Replacement procurement')).not.toBeInTheDocument();
    terminationView.unmount();

    renderPostAward('/post-award/performance?contract=contract-1');
    expect((await screen.findAllByRole('heading', { name: 'Supplier performance' })).length).toBeGreaterThan(0);
    expect(screen.queryByText('Supplier risk profile')).not.toBeInTheDocument();
  });

  it('guides users on empty finance pages and keeps payload fields hidden by default', async () => {
    vi.mocked(awardsContractsApi.contract).mockResolvedValue(contractDetail({
      payload: { procurementType: 'SERVICES' },
      milestones: [],
      invoices: [],
      payments: [],
      paymentApprovals: [],
      serviceCredits: []
    }));

    renderPostAward('/post-award/finance?contract=contract-1');

    expect(await screen.findByText('Services execution')).toBeInTheDocument();
    expect(screen.getByText('No finance record yet')).toBeInTheDocument();
    expect(screen.getByText('Service credit')).toBeInTheDocument();
    expect(screen.queryByText('Three-way match')).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Invoice payload/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Advanced payload')).not.toBeInTheDocument();
  });
});
