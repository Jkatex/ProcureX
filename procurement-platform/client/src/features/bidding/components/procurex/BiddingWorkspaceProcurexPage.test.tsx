/* Exercises bidding behavior so regressions are caught close to the domain workflow they protect. */
import { act, fireEvent, render as rtlRender, screen, waitFor, within } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import type { ReactElement } from 'react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authReducer, { assumeUser } from '@/features/auth/slice';
import { NotificationToastHost } from '@/features/notifications/NotificationToastHost';
import notificationsReducer, { enqueueNotification } from '@/features/notifications/slice';
import { useTenderDetail } from '@/features/procurement/hooks';
import type { TenderDetail } from '@/features/procurement/types';
import { demoUsers } from '@/shared/data/fixtures';
import { biddingApi } from '../../api';
import type { BidDocumentEnvelope, BidDto, BidSampleDto, BidSubmissionSchemaDto, BidSubmissionSchemaFieldDto, BidSubmissionSection, BidSubmissionSchemaStepDto, BidSubmissionStepId } from '../../types';
import { BiddingWorkspaceProcurexPage } from './BiddingWorkspaceProcurexPage';

const html2PdfMock = vi.hoisted(() => {
  const worker = {
    set: vi.fn(),
    from: vi.fn(),
    outputPdf: vi.fn()
  };
  return {
    factory: vi.fn(() => worker),
    worker
  };
});

vi.mock('@/features/procurement/hooks', () => ({
  useTenderDetail: vi.fn()
}));

vi.mock('@/features/identity/api', () => ({
  identityApi: {
    getVerificationMe: vi.fn().mockResolvedValue({ verification: { payload: { profile: {} } } }),
    getProfileImageBlob: vi.fn()
  }
}));

vi.mock('html2pdf.js', () => ({
  default: html2PdfMock.factory
}));

function resetHtml2PdfMock() {
  html2PdfMock.worker.set.mockReset().mockReturnValue(html2PdfMock.worker);
  html2PdfMock.worker.from.mockReset().mockReturnValue(html2PdfMock.worker);
  html2PdfMock.worker.outputPdf.mockReset().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
}

function createBidWorkspaceStore() {
  const store = configureStore({ reducer: { auth: authReducer, notifications: notificationsReducer } });
  store.dispatch(assumeUser(demoUsers.user));
  return store;
}

function render(ui: ReactElement) {
  const store = createBidWorkspaceStore();
  const view = rtlRender(<Provider store={store}>{ui}</Provider>);
  return { ...view, store };
}

function renderWorkspaceWithNotifications() {
  return render(
    <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
      <BiddingWorkspaceProcurexPage />
      <NotificationToastHost />
    </MemoryRouter>
  );
}

describe('BiddingWorkspaceProcurexPage document upload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetHtml2PdfMock();
    vi.spyOn(biddingApi, 'getTenderSchema').mockResolvedValue(bidSchema());
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail(),
      status: 'success',
      isLoading: false,
      isError: false
    });
  });

  it('creates a draft before uploading selected files and stores returned document DTOs', async () => {
    const draft = bidDto();
    const uploaded = bidDto({
      documents: [
        {
          id: 'bid-doc-1',
          documentId: 'doc-1',
          name: 'technical.pdf',
          documentType: 'TECHNICAL_PRODUCT_BROCHURES',
          envelope: 'TECHNICAL',
          reviewStatus: 'UPLOADED',
          checksum: 'a'.repeat(64),
          metadata: { requirementKey: 'goods-technical', size: 18, mimeType: 'application/pdf', storage: 'local-dev' }
        }
      ]
    });
    const callOrder: string[] = [];
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);
    vi.spyOn(biddingApi, 'saveTenderDraft').mockImplementation(async () => {
      callOrder.push('saveDraft');
      return draft;
    });
    vi.spyOn(biddingApi, 'uploadDocuments').mockImplementation(async () => {
      callOrder.push('uploadDocuments');
      return uploaded;
    });
    vi.spyOn(biddingApi, 'updateBid').mockResolvedValue(uploaded);

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    const technicalStep = screen.getAllByRole('button', { name: /Technical Response/i })[0];
    fireEvent.click(technicalStep);
    expect(screen.getByText('Product brochures, catalogues, and specification evidence')).toBeInTheDocument();
    const uploadInput = screen
      .getByText('Upload evidence')
      .closest('label')
      ?.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(uploadInput).not.toBeNull();

    const file = new File(['technical proposal'], 'technical.pdf', { type: 'application/pdf' });
    fireEvent.change(uploadInput!, { target: { files: [file] } });

    expect(await screen.findByText('1 evidence file uploaded and validated.')).toBeInTheDocument();
    expect(callOrder).toEqual(['saveDraft', 'uploadDocuments']);
    expect(biddingApi.saveTenderDraft).toHaveBeenCalledWith('tender-1', expect.objectContaining({ documents: [] }));
    expect(biddingApi.uploadDocuments).toHaveBeenCalledWith('bid-1', {
      files: [file],
      documentType: 'TECHNICAL_PRODUCT_BROCHURES',
      envelope: 'TECHNICAL',
      metadata: { requirementKey: 'goods-technical', requirementLabel: 'Upload evidence', source: 'bid-workspace', fieldId: 'technical.productEvidence' }
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);
    await waitFor(() => expect(biddingApi.updateBid).toHaveBeenCalled());
    const savedPayload = vi.mocked(biddingApi.updateBid).mock.calls[0][1];
    expect(savedPayload.documents).toEqual([
      expect.objectContaining({
        documentId: 'doc-1',
        name: 'technical.pdf',
        documentType: 'TECHNICAL_PRODUCT_BROCHURES',
        envelope: 'TECHNICAL',
        checksum: 'a'.repeat(64),
        metadata: expect.objectContaining({ requirementKey: 'goods-technical', storage: 'local-dev' })
      })
    ]);
    expect(savedPayload.workspaceState).toEqual(
      expect.objectContaining({
        source: 'react-bidding-workspace',
        workflowType: 'goods',
        documents: [expect.objectContaining({ documentId: 'doc-1', name: 'technical.pdf' })],
        form: expect.any(Object),
        schemaResponses: expect.any(Object)
      })
    );
    expect(savedPayload.documents[0]).not.toBeInstanceOf(File);
  });

  it('keeps backend upload validation messages out of the workspace status', async () => {
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'uploadDocuments').mockRejectedValue({
      response: { data: { message: 'Unsupported bid document file type.' } }
    });

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    fireEvent.change(uploadInputByText('Upload eligibility evidence'), { target: { files: [new File(['bad'], 'bad.exe', { type: 'application/x-msdownload' })] } });

    expect(await screen.findByText('Document upload failed.')).toBeInTheDocument();
    expect(screen.queryByText('Unsupported bid document file type.')).not.toBeInTheDocument();
  });
});

describe('BiddingWorkspaceProcurexPage sample tracking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetHtml2PdfMock();
    vi.spyOn(biddingApi, 'getTenderSchema').mockResolvedValue(bidSchema());
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail(),
      status: 'success',
      isLoading: false,
      isError: false
    });
  });

  it('hides the sample step when tender requirements do not require samples', async () => {
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    expect(screen.queryByRole('button', { name: /Sample Submission/i })).not.toBeInTheDocument();
  });

  it('shows the sample step when tender requirements require samples', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetailWithSamples(),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(bidSchema({ withSamples: true }));
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    expect(screen.getAllByRole('button', { name: /Sample Submission/i })[0]).toBeInTheDocument();
  });

  it('creates a draft before adding the first sample record', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetailWithSamples(),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(bidSchema({ withSamples: true }));
    const draft = bidDto();
    const sample = sampleDto({ trackingStatus: 'SUBMITTED', submittedAt: '2026-07-09T10:15:00.000Z' });
    const callOrder: string[] = [];
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);
    vi.spyOn(biddingApi, 'saveTenderDraft').mockImplementation(async () => {
      callOrder.push('saveDraft');
      return draft;
    });
    vi.spyOn(biddingApi, 'createSample').mockImplementation(async () => {
      callOrder.push('createSample');
      return sample;
    });
    vi.spyOn(biddingApi, 'listSamples').mockResolvedValue([sample]);

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    fireEvent.click(screen.getAllByRole('button', { name: /Sample Submission/i })[0]);
    fireEvent.change(screen.getByLabelText('Courier'), { target: { value: 'DHL' } });
    fireEvent.change(screen.getByLabelText('Tracking number'), { target: { value: 'DHL-123' } });
    fireEvent.click(screen.getByLabelText('Mark sample as submitted'));
    fireEvent.click(screen.getByRole('button', { name: 'Add sample record' }));

    expect(await screen.findByText('Sample record added and marked as submitted.')).toBeInTheDocument();
    expect(callOrder).toEqual(['saveDraft', 'createSample']);
    expect(biddingApi.createSample).toHaveBeenCalledWith('bid-1', {
      sampleName: 'Laptop sample',
      relatedItem: 'line-1',
      quantity: 2,
      deliveryLocation: 'PMU office',
      courier: 'DHL',
      trackingNumber: 'DHL-123',
      trackingStatus: 'SUBMITTED'
    });
  });

  it('fetches and displays existing sample records for an existing bid', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetailWithSamples(),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(bidSchema({ withSamples: true }));
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'listSamples').mockResolvedValue([
      sampleDto({ trackingStatus: 'RECEIVED', receivedAt: '2026-07-09T11:00:00.000Z' })
    ]);

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(biddingApi.listSamples).toHaveBeenCalledWith('bid-1'));
    await openEligibilityStep();
    completeGate();
    fireEvent.click(screen.getAllByRole('button', { name: /Sample Submission/i })[0]);

    expect(screen.getByLabelText('Sample name for Laptop sample')).toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
    expect(screen.getByText(/Received 09 Jul 2026/i)).toBeInTheDocument();
  });

  it('renders sample fields read-only after bid submission', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetailWithSamples(),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(bidSchema({ withSamples: true }));
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(bidDto({ status: 'SUBMITTED', submittedAt: '2026-07-09T10:00:00.000Z' }));
    vi.spyOn(biddingApi, 'listSamples').mockResolvedValue([sampleDto()]);

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(biddingApi.listSamples).toHaveBeenCalledWith('bid-1'));
    fireEvent.click(screen.getAllByRole('button', { name: /Sample Submission/i })[0]);

    expect(screen.getByLabelText('Sample name for Laptop sample')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add sample record' })).toBeDisabled();
  });
});

describe('BiddingWorkspaceProcurexPage procurex-ui flow parity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetHtml2PdfMock();
    vi.spyOn(biddingApi, 'getTenderSchema').mockResolvedValue(bidSchema());
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);
    vi.spyOn(biddingApi, 'submitBid').mockResolvedValue({ receiptRef: 'BID-PX-1', receiptHash: 'hash-1', createdAt: '2026-07-09T10:30:00.000Z', bid: bidDto({ status: 'SUBMITTED' }) });
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail(),
      status: 'success',
      isLoading: false,
      isError: false
    });
  });

  it('renders the ProcureX workspace top bar for the bidding workspace', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Bid Submission Workspace' })).toBeInTheDocument();
    const topBar = container.querySelector('.app-topbar') as HTMLElement | null;
    expect(topBar).toBeInTheDocument();
    expect(within(topBar!).getByRole('img', { name: 'ProcureX' })).toBeInTheDocument();
    expect(within(topBar!).getByText('Bidding')).toBeInTheDocument();
    expect(topBar!.querySelector('[data-app-menu-toggle]')).toBeInTheDocument();
    expect(topBar!.querySelector('.profile-button')).toBeInTheDocument();
  });

  it('keeps the ProcureX workspace top bar on the empty bid workspace state', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/bidding']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Open a tender from the marketplace to start or continue a bid.')).toBeInTheDocument();
    const topBar = container.querySelector('.app-topbar') as HTMLElement | null;
    expect(topBar).toBeInTheDocument();
    expect(within(topBar!).getByText('Bidding')).toBeInTheDocument();
    expect(topBar!.querySelector('[data-app-menu-toggle]')).toBeInTheDocument();
    expect(topBar!.querySelector('.profile-button')).toBeInTheDocument();
  });

  it.each([
    ['goods', tenderDetail(), ['Bid Information', 'Eligibility and Document Requirements', 'Technical Response', 'Quantity Schedule / Financial Offer', 'Review Submission', 'Supplier Declaration and Submit']],
    ['goods samples', tenderDetailWithSamples(), ['Bid Information', 'Eligibility and Document Requirements', 'Technical Response', 'Quantity Schedule / Financial Offer', 'Sample Submission', 'Review Submission', 'Supplier Declaration and Submit']],
    ['works', tenderDetail({ type: 'WORKS' }), ['Eligibility and Document Requirements', 'Technical Capacity and Experience', 'Technical Proposal and Work Program', 'Financial Proposal / BOQ Pricing', 'Review Submission', 'Declaration and Submission']],
    ['services', tenderDetail({ type: 'SERVICE' }), ['Eligibility and Document Requirements', 'Service Understanding and Methodology', 'Service Schedule and Delivery Plan', 'Staffing, Capacity and Continuity Plan', 'Performance, SLA, Reporting and Compliance', 'Commercial Pricing and Cost Breakdown', 'Review Submission']],
    ['consultancy', tenderDetail({ type: 'CONSULTANCY' }), ['Eligibility and Document Requirements', 'Technical Proposal', 'Financial Proposal', 'Review and Submit']],
    ['generic', tenderDetail({ type: undefined }), ['Eligibility and Document Requirements', 'Technical Response', 'Financial Offer', 'Declarations and Submit', 'Review Submission']]
  ])('renders exact %s step order', async (_name, tender, expected) => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tender,
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(bidSchema({ tenderType: String(tender.type ?? 'GENERIC'), withSamples: expected.includes('Sample Submission') }));

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    expect(progressStepLabels()).toEqual(expected);
  });

  it('renders goods Bid Information first with autofilled bidder and reference before eligibility', async () => {
    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Bid Information' })).toBeInTheDocument();
    expect(progressStepLabels()[0]).toBe('Bid Information');
    await waitFor(() => expect(screen.getByLabelText('Name of bidder')).toHaveValue('Supplier organization'));
    await waitFor(() => expect((screen.getByLabelText('Bid reference number') as HTMLInputElement).value).toMatch(/^PX-BID-PX-2026-001-/));
    expect(screen.getByLabelText('Name of bidder')).toHaveAttribute('readonly');
    expect(screen.getByLabelText('Bid reference number')).toHaveAttribute('readonly');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Bid Information' })).toBeInTheDocument();
    expect(screen.getByText(/First incomplete: Contact person name/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Contact person name'), { target: { value: 'Jane Supplier' } });
    fireEvent.change(screen.getByLabelText('Contact person email'), { target: { value: 'jane@supplier.example' } });
    fireEvent.change(screen.getByLabelText('Contact person phone number'), { target: { value: '+255700111222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
  });

  it('shows only one active new-bid notice when the same bid notice is replayed', async () => {
    const { store } = renderWorkspaceWithNotifications();

    await openEligibilityStep();
    act(() => {
      store.dispatch(enqueueNotification({ tone: 'info', presentation: 'bidNotice', title: 'Notice', message: 'Ready to prepare a new sealed bid.', dismissible: true, autoDismissMs: 3000 }));
    });

    const notices = store.getState().notifications.items.filter((notice) => notice.presentation === 'bidNotice' && notice.message === 'Ready to prepare a new sealed bid.');
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({
      tone: 'info',
      title: 'Notice',
      autoDismissMs: 3000
    });
  });

  it('uses procurex-ui visual shell and progress step markup without the old status summary bar', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    const page = container.querySelector('.journey-page.tender-wizard-page.bid-flow-page');
    expect(page).toBeInTheDocument();
    expect(container.querySelector('.procurement-market-summary')).not.toBeInTheDocument();
    expect(container.querySelector('.kpi-card')).not.toBeInTheDocument();

    const heroActions = container.querySelector('.hero-action-stack');
    expect(heroActions).toBeInTheDocument();
    expect(within(heroActions as HTMLElement).getByText('View Tender Details')).toBeInTheDocument();
    expect(within(heroActions as HTMLElement).queryByText('Ask Buyer')).not.toBeInTheDocument();
    expect(within(heroActions as HTMLElement).getByText('Save Draft')).toBeInTheDocument();
    expect(within(heroActions as HTMLElement).queryByText('Review Submission')).not.toBeInTheDocument();

    expect(container.querySelector('.bid-assistance-panel')).not.toBeInTheDocument();
    expect(container.querySelector('.bid-command-bar')).not.toBeInTheDocument();

    const progressButtons = within(screen.getByRole('navigation', { name: 'Bid submission progress' })).getAllByRole('button');
    expect(progressButtons[0]).toHaveClass('completed');
    expect(within(progressButtons[0]).getByText('01')).toBeInTheDocument();
    expect(within(progressButtons[0]).getByText('Bid Information')).toBeInTheDocument();
    expect(progressButtons[1]).toHaveClass('wizard-progress-step', 'active');
    expect(within(progressButtons[1]).getByText('02')).toBeInTheDocument();
    expect(within(progressButtons[1]).getByText('Eligibility and Document Requirements')).toBeInTheDocument();

    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(progressButtons[1]).toHaveClass('completed');
    expect(progressButtons[2]).toHaveClass('wizard-progress-step', 'active');
  });

  it('blocks Continue and forward step navigation until the mandatory gate is complete', async () => {
    const notices: Array<Record<string, unknown>> = [];
    const listener = (event: Event) => notices.push((event as CustomEvent<Record<string, unknown>>).detail);
    window.addEventListener('procurex:notify', listener);
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.requiredUpload', 'Required field', 'file', 'administrative', 'attachment', 'ADMINISTRATIVE', true, 'required-upload', {
              documentType: 'ADMIN_REQUIRED'
            })
          ]),
          step('goodsTechnical', 'Technical Response', 'TECHNICAL', [goodsProductSpecificationField()])
        ]
      })
    );
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'uploadDocuments').mockResolvedValue(
      bidDto({
        documents: [
          {
            id: 'bid-doc-required',
            documentId: 'doc-required',
            name: 'required.pdf',
            documentType: 'ADMIN_REQUIRED',
            envelope: 'ADMINISTRATIVE',
            reviewStatus: 'UPLOADED',
            checksum: 'r'.repeat(64),
            metadata: { requirementKey: 'required-upload', fieldId: 'administrative.requiredUpload' }
          }
        ]
      })
    );
    const { container } = renderWorkspaceWithNotifications();

    await openEligibilityStep();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
    await waitFor(() =>
      expect(notices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tone: 'warning',
            title: 'Notice',
            presentation: 'bidNotice',
            autoDismissMs: 3000,
            message: 'Complete all mandatory eligibility requirements before continuing. Incomplete: Required field (Document upload)'
          })
        ])
      )
    );
    expect(container.querySelector('.form-status')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Technical Response/i })[0]);
    expect(screen.getByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();

    fireEvent.change(uploadInputByText('Upload mandatory evidence'), { target: { files: [new File(['required'], 'required.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalled());
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Technical Response' })).toBeInTheDocument();
    window.removeEventListener('procurex:notify', listener);
  });

  it('shows the procurex-ui notice wording for missing mandatory eligibility uploads', async () => {
    const notices: Array<Record<string, unknown>> = [];
    const listener = (event: Event) => notices.push((event as CustomEvent<Record<string, unknown>>).detail);
    window.addEventListener('procurex:notify', listener);
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.requiredUpload', 'Required field', 'file', 'administrative', 'attachment', 'ADMINISTRATIVE', true, 'required-upload', {
              documentType: 'ADMIN_REQUIRED'
            })
          ]),
          step('goodsTechnical', 'Technical Response', 'TECHNICAL', [goodsProductSpecificationField()])
        ]
      })
    );
    const { container } = renderWorkspaceWithNotifications();

    await openEligibilityStep();
    expect(screen.getByText('Required field')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(notices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tone: 'warning',
            title: 'Notice',
            presentation: 'bidNotice',
            autoDismissMs: 3000,
            message: 'Complete all mandatory eligibility requirements before continuing. Incomplete: Required field (Document upload)'
          })
        ])
      )
    );
    expect(container.querySelector('.form-status')).not.toBeInTheDocument();
    window.removeEventListener('procurex:notify', listener);
  });

  it('renders the administrative gate with procurex-ui grouped eligibility sections', async () => {
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible'),
            field('administrative.shippingLicense', 'Shipping Agency License', 'file', 'administrative', 'attachment', 'ADMINISTRATIVE', true, 'regulatoryLicenseRequirementRows.shipping', {
              documentType: 'ADMIN_LICENSE',
              prompt: 'Tanzania Shipping Agencies Corporation'
            }),
            field('administrative.signedBidForm', 'Signed bid submission form', 'file', 'administrative', 'attachment', 'ADMINISTRATIVE', true, 'submissionDocuments.signedBidForm', {
              documentType: 'ADMIN_SUBMISSION_FORM'
            }),
            field('administrative.eligibilityEvidence', 'Eligibility and administrative evidence', 'file', 'administrative', 'attachment', 'ADMINISTRATIVE', false, 'eligibility', {
              documentType: 'ADMINISTRATIVE_EVIDENCE'
            })
          ]),
          step('goodsTechnical', 'Technical Response', 'TECHNICAL', [goodsProductSpecificationField()]),
          step('goodsReview', 'Review Submission', 'COMBINED', [field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete')])
        ]
      })
    );

    const { container } = renderWorkspaceWithNotifications();

    await openEligibilityStep();
    expect(screen.getByText('1. Regulatory license requirements')).toBeInTheDocument();
    expect(screen.getByText('Regulatory licence response')).toBeInTheDocument();
    expect(screen.getByText('Shipping Agency License')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Licence requirement' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Possession status' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader', { name: 'Evidence' }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Shipping Agency License possession status')).toBeInTheDocument();
    expect(screen.getByText('Bid submission documents')).toBeInTheDocument();
    expect(screen.getByText('Signed bid submission form')).toBeInTheDocument();
    expect(screen.getByText('Other eligibility response')).toBeInTheDocument();
    expect(screen.getByText('Eligibility and administrative evidence')).toBeInTheDocument();
    expect(screen.queryByText('Eligibility declarations/confirmations')).not.toBeInTheDocument();
    expect(screen.queryByText('I confirm that the documents I uploaded are valid and true.')).not.toBeInTheDocument();
    expect(screen.queryByText('I understand that false or misleading documents may lead to disqualification.')).not.toBeInTheDocument();
    expect(screen.queryByText('Administrative confirmations')).not.toBeInTheDocument();
    expect(screen.queryByText('Administrative compliance')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm eligibility to participate')).not.toBeInTheDocument();
    expect(screen.queryByText('I confirm I am authorized to submit these documents on behalf of the bidder.')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm authorized representative')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm similar project evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm that similar completed project evidence is completed in the technical capacity response.')).not.toBeInTheDocument();
    expect(screen.queryByText('I confirm and accept this requirement.')).not.toBeInTheDocument();
    expect(container.querySelectorAll('.bid-gate-group').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelectorAll('.bid-declaration-check').length).toBe(0);
  });

  it('derives goods eligibility uploads from financial, regulatory, and other eligibility tender requirements', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail({
        requirements: {
          financialRequirements: [{ id: 'fin-1', requirementType: 'Average annual turnover', minimumValue: 'TZS 500M', period: 'Last 6 months', evidenceRequired: 'Audited accounts', mandatory: true }],
          regulatoryLicenseRequirements: [{ id: 'lic-1', license: 'Medical devices dealer license', body: 'TMDA', mandatory: true, expiryRequired: false }],
          eligibilityRequirements: [
            { id: 'elig-1', requirementName: 'Tax clearance certificate', mandatory: true, requiresUpload: false, notes: 'Valid TRA tax clearance certificate.' },
            { id: 'elig-2', requirementName: 'ISO 9001 certificate', mandatory: false, requiresUpload: false, notes: 'Optional quality certification.' }
          ]
        }
      }),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible')
          ]),
          step('goodsTechnical', 'Technical Response', 'TECHNICAL', [goodsProductSpecificationField()]),
          step('goodsFinancial', 'Quantity Schedule / Financial Offer', 'FINANCIAL', [
            field('financial.unitRate', 'Unit rate for Laptop', 'number', 'financial', 'pricing', 'FINANCIAL', true, 'unitRate', {
              itemId: 'line-1',
              itemNo: '1',
              description: 'Laptop',
              quantity: 1,
              unit: 'Each',
              min: 0
            })
          ]),
          step('goodsReview', 'Review Submission', 'COMBINED', [field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete')])
        ]
      })
    );
    const uploadedDocuments: BidDto['documents'] = [];
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'uploadDocuments').mockImplementation(async (_bidId, input) => {
      input.files.forEach((file, index) => {
        uploadedDocuments.push({
          id: `bid-doc-${uploadedDocuments.length + 1}`,
          documentId: `doc-${uploadedDocuments.length + 1}`,
          name: file.name,
          documentType: input.documentType,
          envelope: input.envelope,
          reviewStatus: 'UPLOADED',
          checksum: `${index}`.padStart(64, 'a'),
          metadata: input.metadata ?? {}
        });
      });
      return bidDto({ documents: uploadedDocuments });
    });

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    expect(screen.getByText('Financial capacity response')).toBeInTheDocument();
    expect(screen.getByText('Average annual turnover')).toBeInTheDocument();
    expect(screen.getByText(/Evidence required: Audited accounts/)).toBeInTheDocument();
    expect(screen.getByText('Regulatory licence response')).toBeInTheDocument();
    expect(screen.getByText('Medical devices dealer license')).toBeInTheDocument();
    expect(screen.getByText('Other eligibility response')).toBeInTheDocument();
    expect(screen.getByText('Tax clearance certificate')).toBeInTheDocument();
    expect(screen.getByText('ISO 9001 certificate')).toBeInTheDocument();
    expect(screen.queryByText('I confirm that the documents I uploaded are valid and true.')).not.toBeInTheDocument();

    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
    expect(screen.getByText(/Complete all mandatory eligibility requirements before continuing/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Average annual turnover Supplier declared value'), { target: { value: 'TZS 650M' } });
    fireEvent.change(uploadInputByText('Upload financial evidence'), { target: { files: [new File(['accounts'], 'audited-accounts.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByLabelText('Medical devices dealer license possession status'), { target: { value: 'Yes' } });
    fireEvent.change(uploadInputByText('Upload license evidence'), { target: { files: [new File(['license'], 'tmda-license.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText('Tax clearance certificate confirmation'), { target: { value: 'Yes' } });
    fireEvent.change(uploadInputByText('Upload eligibility evidence'), { target: { files: [new File(['tax'], 'tax-clearance.pdf', { type: 'application/pdf' })] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(3));

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Technical Response' })).toBeInTheDocument();
    expect(biddingApi.uploadDocuments).toHaveBeenNthCalledWith(1, 'bid-1', expect.objectContaining({
      documentType: 'ADMIN_FINANCIAL_CAPACITY_AVERAGE_ANNUAL_TURNOVER',
      envelope: 'ADMINISTRATIVE',
      metadata: expect.objectContaining({ parentRequirementKey: 'goods.financialRequirement.fin-1', fieldId: 'goods.financialRequirement.fin-1', evidenceKey: 'evidenceUpload' })
    }));
    expect(biddingApi.uploadDocuments).toHaveBeenNthCalledWith(2, 'bid-1', expect.objectContaining({
      envelope: 'ADMINISTRATIVE',
      metadata: expect.objectContaining({ parentRequirementKey: 'goods.regulatoryLicense.lic-1', fieldId: 'goods.regulatoryLicense.lic-1', evidenceKey: 'licenseEvidence' })
    }));
    expect(biddingApi.uploadDocuments).toHaveBeenNthCalledWith(3, 'bid-1', expect.objectContaining({
      documentType: 'ADMIN_ELIGIBILITY_TAX_CLEARANCE_CERTIFICATE',
      envelope: 'ADMINISTRATIVE',
      metadata: expect.objectContaining({ parentRequirementKey: 'goods.eligibilityRequirement.elig-1', fieldId: 'goods.eligibilityRequirement.elig-1', evidenceKey: 'evidenceUpload' })
    }));
  });

  it('shows existing uploaded files inside upload cards while allowing another upload', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail({
        requirements: {
          financialRequirements: [{ id: 'fin-1', requirementType: 'Financial capacity requirement 1', minimumValue: 'TZS 500M', period: 'Last 6 months', evidenceRequired: 'Audited accounts', mandatory: true }]
        }
      }),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible')
          ]),
          step('goodsTechnical', 'Technical Response', 'TECHNICAL', [field('technical.productCompliance', 'Product compliance statement', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'productCompliance')]),
          step('goodsFinancial', 'Quantity Schedule / Financial Offer', 'FINANCIAL', [
            field('financial.unitRate', 'Unit rate for Laptop', 'number', 'financial', 'pricing', 'FINANCIAL', true, 'unitRate', {
              itemId: 'line-1',
              itemNo: '1',
              description: 'Laptop',
              quantity: 1,
              unit: 'Each',
              min: 0
            })
          ]),
          step('goodsReview', 'Review Submission', 'COMBINED', [field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete')])
        ]
      })
    );
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(
      bidDto({
        documents: [
          {
            id: 'bid-doc-1',
            documentId: 'doc-1',
            name: 'Barua_ya_Maombi_ya_Mkopo.pdf',
            documentType: 'ADMIN_FINANCIAL_CAPACITY_FINANCIAL_CAPACITY_REQUIREMENT_1',
            envelope: 'ADMINISTRATIVE',
            reviewStatus: 'UPLOADED',
            checksum: 'a'.repeat(64),
            metadata: {
              requirementKey: 'goods.financialRequirement.fin-1.evidenceUpload',
              fieldId: 'goods.financialRequirement.fin-1.evidenceUpload'
            }
          }
        ]
      })
    );
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'updateBid').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'uploadDocuments').mockResolvedValue(bidDto());

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    const uploadCard = screen
      .getAllByText('Uploaded: Barua_ya_Maombi_ya_Mkopo.pdf')
      .map((element) => element.closest('label'))
      .find(Boolean);
    expect(uploadCard).not.toBeNull();
    expect(within(uploadCard as HTMLElement).getByText('Uploaded: Barua_ya_Maombi_ya_Mkopo.pdf')).toBeInTheDocument();
    expect(within(uploadCard as HTMLElement).getByText('Upload another file')).toBeInTheDocument();
    expect(within(uploadCard as HTMLElement).queryByText('No file selected yet.')).not.toBeInTheDocument();
    expect(screen.queryByText('No files selected')).not.toBeInTheDocument();
    const input = within(uploadCard as HTMLElement).getByLabelText('Upload financial evidence') as HTMLInputElement;
    expect(input).toHaveClass('bid-upload-input');
    expect(input).toHaveClass('sr-only');

    fireEvent.change(input, { target: { files: [new File(['updated'], 'updated-accounts.pdf', { type: 'application/pdf' })] } });

    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(1));
    expect(biddingApi.uploadDocuments).toHaveBeenCalledWith('bid-1', expect.objectContaining({
      documentType: 'ADMIN_FINANCIAL_CAPACITY_FINANCIAL_CAPACITY_REQUIREMENT_1',
      envelope: 'ADMINISTRATIVE',
      metadata: expect.objectContaining({
        requirementKey: 'goods.financialRequirement.fin-1.evidenceUpload',
        fieldId: 'goods.financialRequirement.fin-1',
        parentRequirementKey: 'goods.financialRequirement.fin-1',
        evidenceKey: 'evidenceUpload'
      })
    }));
  });

  it('does not render a hero Review Submission shortcut', async () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    const heroActions = container.querySelector('.hero-action-stack');
    expect(heroActions).toBeInTheDocument();
    expect(within(heroActions as HTMLElement).queryByText('Review Submission')).not.toBeInTheDocument();
    expect(biddingApi.submitBid).not.toHaveBeenCalled();
  });

  it('uses the progress Review Submission action as a jump to the review step after the current gate is complete', async () => {
    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    openProgressStep('Review Submission');

    expect(screen.getByRole('heading', { name: 'Review Submission' })).toBeInTheDocument();
    expect(biddingApi.submitBid).not.toHaveBeenCalled();
  });

  it('renders ProcureX goods offer rows and saves structured pricing by requirement key', async () => {
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    completeDefaultGoodsTechnicalResponse('Compliant laptop specification.');
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Quantity Schedule / Financial Offer' })).toBeInTheDocument();
    const boqTable = screen.getByRole('table');
    expect(boqTable).toHaveClass('bid-financial-boq-table');
    expect(screen.getByText('Goods offer rows')).toBeInTheDocument();
    expect(within(boqTable).getByText('Laptop')).toBeInTheDocument();
    expect(within(boqTable).getByText('Each')).toBeInTheDocument();
    expect(boqTable.querySelector('.goods-offer-row')).toBeInTheDocument();
    expect(within(boqTable).queryByText('Response for Financial')).not.toBeInTheDocument();
    const standaloneFinancialInput = screen.getByText('Response for Financial').closest('label')?.querySelector('input') as HTMLInputElement | null;
    expect(standaloneFinancialInput).toBeInTheDocument();
    expect(screen.queryByText('Quoted unit price')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Unit price for Laptop'), { target: { value: '2500000' } });
    fireEvent.change(standaloneFinancialInput!, { target: { value: '85' } });

    expect(screen.getAllByText('TZS 2,500,000').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);

    await waitFor(() => expect(biddingApi.saveTenderDraft).toHaveBeenCalled());
    const savedPayload = vi.mocked(biddingApi.saveTenderDraft).mock.calls[0][1];
    expect(savedPayload.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementKey: 'unitRate',
          response: {
            value: expect.objectContaining({
              unitPrice: 2500000
            })
          }
        }),
        expect.objectContaining({
          requirementKey: 'evaluationCriteria.financial',
          response: { value: 85 }
        })
      ])
    );
    expect(savedPayload.financial.items).toEqual([
      expect.objectContaining({ id: 'line-1', description: 'Laptop', quantity: 1, unit: 'Each', rate: 2500000, total: 2500000 })
    ]);
  });

  it('renders ProcureX goods technical response cards and saves structured responses', async () => {
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible'),
            field('administrative.taxCompliant', 'Confirm tax and statutory compliance', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'taxCompliant'),
            field('administrative.documentsConfirmed', 'Confirm mandatory documents are attached', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'documentsConfirmed'),
            field('administrative.eligibilityDocument', 'Eligibility and administrative evidence', 'file', 'administrative', 'attachment', 'ADMINISTRATIVE', false, 'eligibility', { documentType: 'ADMINISTRATIVE_EVIDENCE' })
          ]),
          step('technical', 'Technical Response', 'TECHNICAL', [
            field('technical.productSpec.line1', 'Product specification response - Laptop', 'table', 'technical', 'structured', 'TECHNICAL', true, 'goods.productSpecification.line-1', {
              control: 'goodsProductSpecification',
              rowIndex: 1,
              itemNo: '1',
              requestedProduct: 'Laptop',
              buyerSpecification: 'Processor: Core i7 / RAM: 16GB / Storage: 512GB SSD',
              quantity: 1,
              unit: 'Each',
              prompt: '0934e352-111f-443f-8877-63477037937e 1 Laptop 1 Each false'
            })
          ]),
          step('financial', 'Quantity Schedule / Financial Offer', 'FINANCIAL', [
            field('financial.unitRate', 'Unit rate for Laptop', 'number', 'financial', 'pricing', 'FINANCIAL', true, 'unitRate', {
              itemId: 'line-1',
              itemNo: '1',
              description: 'Laptop',
              quantity: 1,
              unit: 'Each',
              min: 0
            })
          ]),
          step('review', 'Review Submission', 'COMBINED', []),
          step('declarations', 'Supplier Declaration and Submit', 'COMBINED', [
            field('declarations.confirmAccuracy', 'I confirm the bid is accurate and complete', 'boolean', 'declarations', 'declaration', 'COMBINED', true, 'confirmAccuracy')
          ]),
          step('receipt', 'Receipt', 'COMBINED', [])
        ]
      })
    );
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());

    const { container } = render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.queryByText('Tenderer template')).not.toBeInTheDocument();
    expect(screen.queryByText('Download CSV response template')).not.toBeInTheDocument();
    expect(screen.queryByText('Need clarification about product specifications?')).not.toBeInTheDocument();
    expect(container.querySelector('.goods-compliance-card')).toBeInTheDocument();
    expect(container.querySelector('.premium-response-matrix')).not.toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Laptop' })).toBeInTheDocument();
    expect(screen.getByText('Processor: Core i7 / RAM: 16GB / Storage: 512GB SSD')).toBeInTheDocument();
    expect(screen.queryByText(/0934e352-111f-443f-8877-63477037937e/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Product specification response - Laptop Compliance'), { target: { value: 'Comply' } });
    fireEvent.change(screen.getByLabelText('Product specification response - Laptop Supplier offered specification'), { target: { value: 'Core i7, 16GB RAM, 512GB SSD' } });
    fireEvent.change(screen.getByLabelText('Product specification response - Laptop Evidence / attachment reference'), { target: { value: 'brochure.pdf' } });
    fireEvent.change(screen.getByLabelText('Product specification response - Laptop Deviations / comments'), { target: { value: 'No deviations.' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);

    await waitFor(() => expect(biddingApi.saveTenderDraft).toHaveBeenCalled());
    expect(vi.mocked(biddingApi.saveTenderDraft).mock.calls[0][1].responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementKey: 'goods.productSpecification.line-1',
          response: {
            value: expect.objectContaining({
              complianceStatus: 'Comply',
              offeredSpecification: 'Core i7, 16GB RAM, 512GB SSD',
              evidenceReference: 'brochure.pdf',
              deviations: 'No deviations.'
            })
          }
        })
      ])
    );
  });

  it('does not render unspecified goods technical CSV import/export controls', async () => {
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible'),
            field('administrative.taxCompliant', 'Confirm tax and statutory compliance', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'taxCompliant'),
            field('administrative.documentsConfirmed', 'Confirm mandatory documents are attached', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'documentsConfirmed')
          ]),
          step('goodsTechnical', 'Technical Response', 'TECHNICAL', [
            field('technical.productSpec.line1', 'Product specification response - Laptop', 'table', 'technical', 'structured', 'TECHNICAL', true, 'goods.productSpecification.line-1', {
              control: 'goodsProductSpecification',
              itemNo: '1',
              requestedProduct: 'Laptop',
              buyerSpecification: 'Core i7 laptop',
              quantity: 1,
              unit: 'Each'
            })
          ]),
          step('goodsReview', 'Review Submission', 'COMBINED', [field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete')])
        ]
      })
    );
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    expect(screen.queryByText('Confirm eligibility to participate')).not.toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.queryByLabelText('Import goods technical response CSV')).not.toBeInTheDocument();
    expect(screen.queryByText('Download CSV Template')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Product specification response - Laptop Supplier offered specification')).toBeInTheDocument();
  });

  it('uploads goods technical evidence through existing document metadata', async () => {
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible'),
            field('administrative.taxCompliant', 'Confirm tax and statutory compliance', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'taxCompliant'),
            field('administrative.documentsConfirmed', 'Confirm mandatory documents are attached', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'documentsConfirmed')
          ]),
          step('goodsTechnical', 'Technical Response', 'TECHNICAL', [
            field('technical.productSpec.line1', 'Product specification response - Laptop', 'table', 'technical', 'structured', 'TECHNICAL', true, 'goods.productSpecification.line-1', {
              control: 'goodsProductSpecification',
              itemNo: '1',
              requestedProduct: 'Laptop',
              buyerSpecification: 'Core i7 laptop'
            }),
            field('technical.productBrochure', 'Product brochures, catalogues, and specification evidence', 'file', 'technical', 'attachment', 'TECHNICAL', true, 'goods-technical', {
              documentType: 'TECHNICAL_PRODUCT_BROCHURES',
              prompt: 'Upload OEM catalogue evidence.'
            })
          ]),
          step('goodsReview', 'Review Submission', 'COMBINED', [field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete')])
        ]
      })
    );
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'updateBid').mockResolvedValue(bidDto());
    const uploadedDocuments: BidDto['documents'] = [];
    vi.spyOn(biddingApi, 'uploadDocuments').mockImplementation(async (_bidId, input) => {
      input.files.forEach((file) => {
        uploadedDocuments.push({
          id: `bid-doc-${uploadedDocuments.length + 1}`,
          documentId: `doc-${uploadedDocuments.length + 1}`,
          name: file.name,
          documentType: input.documentType,
          envelope: input.envelope,
          reviewStatus: 'UPLOADED',
          checksum: `${uploadedDocuments.length}`.padStart(64, 'b'),
          metadata: input.metadata ?? {}
        });
      });
      return bidDto({ documents: uploadedDocuments });
    });

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    expect(screen.queryByText('Confirm eligibility to participate')).not.toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Technical requirement uploads')).toBeInTheDocument();
    const uploadInput = screen
      .getByText('Upload mandatory evidence')
      .closest('label')
      ?.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(uploadInput).not.toBeNull();
    const file = new File(['brochure'], 'brochure.pdf', { type: 'application/pdf' });
    fireEvent.change(uploadInput!, { target: { files: [file] } });

    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalled());
    expect(biddingApi.uploadDocuments).toHaveBeenCalledWith('bid-1', {
      files: [file],
      documentType: 'TECHNICAL_PRODUCT_BROCHURES',
      envelope: 'TECHNICAL',
      metadata: {
        requirementKey: 'goods-technical',
        requirementLabel: 'Upload mandatory evidence',
        source: 'bid-workspace',
        fieldId: 'technical.productBrochure'
      }
    });
  });

  it('renders newly created goods schema controls and saves license, product specification, financial, and upload metadata', async () => {
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible'),
            field('administrative.taxCompliant', 'Confirm tax and statutory compliance', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'taxCompliant'),
            field('administrative.documentsConfirmed', 'Confirm mandatory documents are attached', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'documentsConfirmed'),
            field('administrative.license.tmda', 'Medical devices dealer license', 'table', 'administrative', 'structured', 'ADMINISTRATIVE', false, 'goods.regulatoryLicense.lic-1', {
              control: 'goodsRegulatoryLicense',
              issuingAuthority: 'TMDA',
              prompt: 'Valid license certificate'
            })
          ]),
          step('goodsTechnical', 'Technical Response', 'TECHNICAL', [
            field('technical.productSpec.line1', 'Product specification response - Laptop', 'table', 'technical', 'structured', 'TECHNICAL', true, 'goods.productSpecification.line-1', {
              control: 'goodsProductSpecification',
              itemNo: '1',
              requestedProduct: 'Laptop',
              buyerSpecification: 'Core i7 laptop',
              quantity: 1,
              unit: 'Each'
            })
          ]),
          step('goodsFinancial', 'Quantity Schedule / Financial Offer', 'FINANCIAL', [
            field('financial.unitRate', 'Unit rate for Laptop', 'number', 'financial', 'pricing', 'FINANCIAL', true, 'commercialItems.line-1.unitRate', {
              itemId: 'line-1',
              itemNo: '1',
              description: 'Laptop',
              quantity: 1,
              unit: 'Each',
              min: 0
            }),
            field('financial.turnover', 'Annual turnover', 'table', 'financial', 'structured', 'FINANCIAL', false, 'goods.financialRequirement.fin-1', {
              control: 'goodsFinancialRequirement',
              evidenceRequired: 'Audited accounts',
              prompt: 'Audited accounts for the last two years'
            }),
            field('goods.commercial.bidValidity', 'Bid Validity Period (days)', 'number', 'financial', 'number', 'FINANCIAL', true, 'goods.commercial.bidValidity', { control: 'goodsCommercialTerms' }),
            field('goods.commercial.currency', 'Currency', 'select', 'financial', 'text', 'FINANCIAL', true, 'goods.commercial.currency', { control: 'goodsCommercialTerms', options: ['TZS', 'USD'] }),
            field('goods.commercial.deliveryTermsAccepted', 'I accept the delivery terms defined in the tender.', 'boolean', 'financial', 'boolean', 'FINANCIAL', true, 'goods.commercial.deliveryTermsAccepted', { control: 'goodsCommercialTerms' })
          ]),
          step('goodsReview', 'Review Submission', 'COMBINED', [field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete')])
        ]
      })
    );
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'updateBid').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'uploadDocuments').mockResolvedValue(bidDto());

    const { container } = render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    expect(screen.getByText('Financial capacity response')).toBeInTheDocument();
    expect(screen.getByText('Annual turnover')).toBeInTheDocument();
    expect(screen.getByText('Medical devices dealer license')).toBeInTheDocument();
    const licenseUpload = screen.getByText('Upload license evidence').closest('label')?.querySelector('input[type="file"]') as HTMLInputElement | null;
    const licenseFile = new File(['license'], 'tmda-license.pdf', { type: 'application/pdf' });
    fireEvent.change(licenseUpload!, { target: { files: [licenseFile] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText('Annual turnover Supplier declared value'), { target: { value: 'TZS 800M' } });
    const financialUpload = uploadInputByText('Upload financial evidence');
    const financialFile = new File(['accounts'], 'audited-accounts.pdf', { type: 'application/pdf' });
    fireEvent.change(financialUpload!, { target: { files: [financialFile] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(2));

    completeGate();
    await waitFor(() => expect(screen.getByText('Administrative requirements complete. You can continue to the bid workflow.')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Technical Response' })).toBeInTheDocument();
    expect(container.querySelector('.goods-compliance-card')).toBeInTheDocument();
    expect(container.querySelector('.goods-product-detail-card')).not.toBeInTheDocument();
    expect(container.querySelector('.premium-response-matrix')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Product specification response - Laptop Compliance'), { target: { value: 'Comply' } });
    fireEvent.change(screen.getByLabelText('Product specification response - Laptop Supplier offered specification'), { target: { value: 'Core i7, 16GB RAM' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Goods offer rows')).toBeInTheDocument();
    expect(container.querySelector('.goods-offer-row')).toBeInTheDocument();
    expect(screen.queryByText('Financial capacity requirements')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Unit price for Laptop'), { target: { value: '2500000' } });
    fireEvent.change(screen.getByLabelText('Bid Validity Period (days)'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'TZS' } });
    fireEvent.click(screen.getByLabelText('I accept the delivery terms defined in the tender.'));

    const updateCallsBeforeFinal = vi.mocked(biddingApi.updateBid).mock.calls.length;
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);
    await waitFor(() => expect(vi.mocked(biddingApi.updateBid).mock.calls.length).toBeGreaterThan(updateCallsBeforeFinal));
    const savedPayload = vi.mocked(biddingApi.updateBid).mock.calls.at(-1)?.[1];
    expect(savedPayload?.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requirementKey: 'goods.productSpecification.line-1', response: { value: expect.objectContaining({ complianceStatus: 'Comply', offeredSpecification: 'Core i7, 16GB RAM' }) } }),
        expect.objectContaining({ requirementKey: 'commercialItems.line-1.unitRate', response: { value: expect.objectContaining({ unitPrice: 2500000 }) } }),
        expect.objectContaining({ requirementKey: 'goods.commercial.bidValidity', response: { value: 120 } }),
        expect.objectContaining({ requirementKey: 'goods.commercial.currency', response: { value: 'TZS' } }),
        expect.objectContaining({ requirementKey: 'goods.commercial.deliveryTermsAccepted', response: { value: true } })
      ])
    );
    const removedProductDetailsKey = ['goods.product', 'Details.line-1'].join('');
    expect(savedPayload?.responses).toEqual(
      expect.not.arrayContaining([expect.objectContaining({ requirementKey: removedProductDetailsKey })])
    );
    expect(biddingApi.uploadDocuments).toHaveBeenNthCalledWith(1, 'bid-1', expect.objectContaining({
      envelope: 'ADMINISTRATIVE',
      metadata: expect.objectContaining({ parentRequirementKey: 'goods.regulatoryLicense.lic-1', fieldId: 'administrative.license.tmda', evidenceKey: 'licenseEvidence' })
    }));
    expect(biddingApi.uploadDocuments).toHaveBeenNthCalledWith(2, 'bid-1', expect.objectContaining({
      envelope: 'ADMINISTRATIVE',
      documentType: 'ADMIN_FINANCIAL_CAPACITY_ANNUAL_TURNOVER',
      metadata: expect.objectContaining({ parentRequirementKey: 'goods.financialRequirement.fin-1', fieldId: 'financial.turnover', evidenceKey: 'evidenceUpload' })
    }));
  });

  it('renders works technical capacity with the procurex-ui workbook layout and saves structured responses', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail({ type: 'WORKS', title: 'Solar mini-grid civil works', category: 'Works' }),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        tenderType: 'WORKS',
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible'),
            field('administrative.taxCompliant', 'Confirm tax and statutory compliance', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'taxCompliant'),
            field('administrative.documentsConfirmed', 'Confirm mandatory documents are attached', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'documentsConfirmed')
          ]),
          step('worksCapacity', 'Technical Capacity and Experience', 'TECHNICAL', [
            field('works.similarProjects', 'Similar completed project evidence', 'table', 'technical', 'structured', 'TECHNICAL', true, 'works.similarProjects', {
              control: 'worksSimilarProject',
              prompt: 'Upload documents explaining previous similar projects.'
            }),
            field('works.keyPersonnel', 'Key personnel CV and qualification response', 'table', 'technical', 'structured', 'TECHNICAL', true, 'works.keyPersonnel', {
              control: 'worksPersonnel'
            }),
            field('works.equipment.excavator', 'Excavator', 'table', 'technical', 'structured', 'TECHNICAL', true, 'works.equipment.excavator', {
              control: 'worksEquipment',
              equipmentName: 'Excavator',
              quantity: 2,
              ownershipRequirement: 'Owned or leased'
            }),
            field('works.hsePolicy', 'HSE policy response', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'works.hsePolicy'),
            field('works.capacityNarrative', 'Capacity narrative', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'works.capacityNarrative')
          ]),
          step('worksTechnicalProposal', 'Technical Proposal and Work Program', 'TECHNICAL', [field('technical.methodStatement', 'Method statement response', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'works.methodStatement')]),
          step('worksFinancial', 'Financial Proposal / BOQ Pricing', 'FINANCIAL', [
            field('financial.unitRate', 'Unit rate for Civil works', 'number', 'financial', 'pricing', 'FINANCIAL', true, 'unitRate', {
              itemId: 'line-1',
              itemNo: '1',
              description: 'Civil works',
              quantity: 1,
              unit: 'Lot',
              min: 0
            }),
            field('works.financialCapacityEvidence', 'Financial capacity and bank statement evidence', 'file', 'financial', 'attachment', 'FINANCIAL', true, 'works.financialCapacityEvidence', {
              documentType: 'FINANCIAL_CAPACITY_EVIDENCE',
              prompt: 'Upload bank statements or financial capacity evidence.'
            })
          ]),
          step('worksReview', 'Review Submission', 'COMBINED', [field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete')]),
          step('worksDeclaration', 'Declaration and Submission', 'COMBINED', worksDeclarationFields())
        ]
      })
    );
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());

    const { container } = renderWorkspaceWithNotifications();

    expect(await screen.findByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Technical Capacity and Experience' })).toBeInTheDocument();
    expect(screen.getByText('Similar completed projects')).toBeInTheDocument();
    expect(screen.getByText('Key personnel')).toBeInTheDocument();
    expect(screen.getByText('Equipment capacity')).toBeInTheDocument();
    expect(screen.getByText('Health, Safety and Environmental Response')).toBeInTheDocument();
    expect(screen.queryByText('Additional capacity responses')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Capacity narrative')).not.toBeInTheDocument();
    expect(container.querySelector('.works-capacity-workbook')).toBeInTheDocument();
    expect(container.querySelector('.works-capacity-card')).toBeInTheDocument();
    expect(container.querySelector('.works-person-card')).toBeInTheDocument();
    expect(container.querySelector('.works-person-avatar')).toBeInTheDocument();
    expect(container.querySelector('.works-equipment-table')).toBeInTheDocument();
    expect(screen.getByText('Upload Similar project document')).toBeInTheDocument();
    expect(screen.getByText('CV upload')).toBeInTheDocument();
    expect(screen.getByText('Upload Lease / access agreement')).toBeInTheDocument();
    expect(screen.getByText('Upload HSE documents')).toBeInTheDocument();
    expect(screen.queryByLabelText('Project / client')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Value')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Completion / status')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Qualification / certification')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Years experience')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Personnel Position'), { target: { value: 'Site engineer' } });
    fireEvent.change(screen.getByLabelText('Quantity available for Excavator'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Ownership status for Excavator'), { target: { value: 'Owned' } });
    fireEvent.change(screen.getByLabelText('Safety Policy Available'), { target: { value: 'Yes' } });
    fireEvent.change(screen.getByLabelText('Environmental Policy Available'), { target: { value: 'Yes' } });
    fireEvent.change(screen.getByLabelText('Safety Officer Assigned'), { target: { value: 'Yes' } });
    fireEvent.change(screen.getByLabelText('PPE Plan'), { target: { value: 'PPE is issued, inspected, and replaced for all site workers.' } });
    fireEvent.change(screen.getByLabelText('Incident Management Plan'), { target: { value: 'Incident reporting, first aid response, and escalation are defined.' } });
    fireEvent.change(screen.getByLabelText('Waste Management Plan'), { target: { value: 'Waste streams are separated, stored safely, and disposed through licensed handlers.' } });
    const notices: Array<{ title?: string; message?: string; presentation?: string }> = [];
    const listener = ((event: Event) => notices.push((event as CustomEvent).detail ?? {})) as EventListener;
    window.addEventListener('procurex:notify', listener);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Technical Capacity and Experience' })).toBeInTheDocument();
    await waitFor(() => {
      expect(notices).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            title: 'Notice',
            presentation: 'bidNotice',
            message: expect.stringMatching(/Complete 4 required responses in this section before continuing.*First incomplete: Similar completed project evidence/i)
          })
        ])
      );
    });
    window.removeEventListener('procurex:notify', listener);
    expect(container.querySelector('.form-status')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);

    await waitFor(() => expect(biddingApi.saveTenderDraft).toHaveBeenCalled());
    expect(vi.mocked(biddingApi.saveTenderDraft).mock.calls[0][1].responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementKey: 'works.similarProjects',
          response: { value: undefined }
        }),
        expect.objectContaining({
          requirementKey: 'works.keyPersonnel',
          response: { value: expect.objectContaining({ namedResource: 'Site engineer' }) }
        }),
        expect.objectContaining({
          requirementKey: 'works.equipment.excavator',
          response: { value: expect.objectContaining({ quantityAvailable: 3, ownershipStatus: 'Owned' }) }
        }),
        expect.objectContaining({
          requirementKey: 'works.hsePolicy',
          response: {
            value: expect.objectContaining({
              safetyPolicyAvailable: 'Yes',
              environmentalPolicyAvailable: 'Yes',
              safetyOfficerAssigned: 'Yes',
              ppePlan: 'PPE is issued, inspected, and replaced for all site workers.',
              incidentManagementPlan: 'Incident reporting, first aid response, and escalation are defined.',
              wasteManagementPlan: 'Waste streams are separated, stored safely, and disposed through licensed handlers.'
            })
          }
        })
      ])
    );
  });

  it('uploads works technical capacity evidence with structured field metadata', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail({ type: 'WORKS', title: 'Solar mini-grid civil works', category: 'Works' }),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(worksCapacityBidSchema());
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'uploadDocuments').mockImplementation(async (_bidId, payload) => {
      const metadata = payload.metadata ?? {};
      return bidDto({
        documents: [
          {
            id: `bid-doc-${String(metadata.requirementKey)}`,
            documentId: `doc-${String(metadata.requirementKey)}`,
            name: payload.files[0]?.name ?? 'evidence.pdf',
            documentType: payload.documentType,
            envelope: payload.envelope,
            reviewStatus: 'UPLOADED',
            checksum: 'c'.repeat(64),
            metadata
          }
        ]
      });
    });

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const similarInput = screen.getByText('Upload Similar project document').closest('label')?.querySelector('input[type="file"]') as HTMLInputElement | null;
    const personnelInput = screen.getByText('CV upload').closest('label')?.querySelector('input[type="file"]') as HTMLInputElement | null;
    const equipmentInput = screen.getByText('Upload Lease / access agreement').closest('label')?.querySelector('input[type="file"]') as HTMLInputElement | null;
    const hseInput = screen.getByText('Upload HSE documents').closest('label')?.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(similarInput).not.toBeNull();
    expect(personnelInput).not.toBeNull();
    expect(equipmentInput).not.toBeNull();
    expect(hseInput).not.toBeNull();

    const projectEvidence = new File(['project reference'], 'project-reference.pdf', { type: 'application/pdf' });
    const cvEvidence = new File(['cv'], 'site-engineer-cv.pdf', { type: 'application/pdf' });
    const equipmentEvidence = new File(['lease'], 'excavator-lease.pdf', { type: 'application/pdf' });
    const hseEvidence = new File(['hse'], 'hse-plan.pdf', { type: 'application/pdf' });
    fireEvent.change(similarInput!, { target: { files: [projectEvidence] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(1));
    fireEvent.change(personnelInput!, { target: { files: [cvEvidence] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(2));
    fireEvent.change(equipmentInput!, { target: { files: [equipmentEvidence] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(3));
    fireEvent.change(hseInput!, { target: { files: [hseEvidence] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(4));

    expect(biddingApi.uploadDocuments).toHaveBeenNthCalledWith(
      1,
      'bid-1',
      expect.objectContaining({
        files: [projectEvidence],
        envelope: 'TECHNICAL',
        metadata: expect.objectContaining({
          requirementKey: 'works.similarProjects.referenceEvidence',
          parentRequirementKey: 'works.similarProjects',
          fieldId: 'works.similarProjects',
          evidenceKey: 'referenceEvidence',
          requirementLabel: 'Upload Similar project document',
          source: 'bid-workspace'
        })
      })
    );
    expect(biddingApi.uploadDocuments).toHaveBeenNthCalledWith(
      2,
      'bid-1',
      expect.objectContaining({
        files: [cvEvidence],
        envelope: 'TECHNICAL',
        metadata: expect.objectContaining({
          requirementKey: 'works.keyPersonnel.cvEvidence',
          parentRequirementKey: 'works.keyPersonnel',
          fieldId: 'works.keyPersonnel',
          evidenceKey: 'cvEvidence',
          requirementLabel: 'CV upload',
          source: 'bid-workspace'
        })
      })
    );
    expect(biddingApi.uploadDocuments).toHaveBeenNthCalledWith(
      3,
      'bid-1',
      expect.objectContaining({
        files: [equipmentEvidence],
        envelope: 'TECHNICAL',
        metadata: expect.objectContaining({
          requirementKey: 'works.equipment.excavator.evidenceReference',
          parentRequirementKey: 'works.equipment.excavator',
          fieldId: 'works.equipment.excavator',
          evidenceKey: 'evidenceReference',
          requirementLabel: 'Upload Lease / access agreement',
          source: 'bid-workspace'
        })
      })
    );
    expect(biddingApi.uploadDocuments).toHaveBeenNthCalledWith(
      4,
      'bid-1',
      expect.objectContaining({
        files: [hseEvidence],
        envelope: 'TECHNICAL',
        documentType: 'TECHNICAL_HSE_DOCUMENTS',
        metadata: expect.objectContaining({
          requirementKey: 'works.hsePolicy.documents',
          parentRequirementKey: 'works.hsePolicy',
          fieldId: 'works.hsePolicy',
          evidenceKey: 'documents',
          requirementLabel: 'Upload HSE documents',
          source: 'bid-workspace'
        })
      })
    );
  });

  it('renders the works technical proposal workbook with schedule, drawings, and site visit controls', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail({
        type: 'WORKS',
        title: 'Solar mini-grid civil works',
        category: 'Works',
        description: 'Build and commission civil works.',
        requirements: {
          worksRequirements: {
            scopeSummary: 'Construct foundations, trenching, fencing, and site restoration.',
            completionPeriod: '14 months',
            siteVisitRequirement: 'Mandatory',
            drawingDesignRows: [{ documentType: 'Foundation drawings', buyerDocumentUpload: 'foundation-drawings.pdf' }]
          }
        }
      }),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(worksCapacityBidSchema());

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
    completeGate();
    openProgressStep('Technical Proposal and Work Program');

    expect(screen.getByText('Project understanding and methodology')).toBeInTheDocument();
    expect(screen.getByText('Construction schedule / work program')).toBeInTheDocument();
    expect(screen.getByText('Drawing and Design Section')).toBeInTheDocument();
    expect(screen.getByText('Foundation drawings')).toBeInTheDocument();
    expect(screen.getAllByText('Site visit response')).not.toHaveLength(0);
    expect(screen.getByText('Upload work program')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Construction Methodology'), { target: { value: 'Phased works with QA/QC hold points.' } });
    fireEvent.change(screen.getByLabelText('Proposed Start Date'), { target: { value: '2026-09-01' } });
    fireEvent.change(screen.getByLabelText('Proposed Completion Period'), { target: { value: '14 months' } });
    fireEvent.change(screen.getByLabelText('Alternative Design Proposed?'), { target: { value: 'Yes' } });

    expect(screen.getByText('Upload proposed alternative designs')).toBeInTheDocument();
    expect(screen.getByLabelText('Proposed Design Alternative')).toBeInTheDocument();
  });

  it('renders works BOQ cost breakdown, recalculates totals, and saves financial payloads', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail({ type: 'WORKS', title: 'Solar mini-grid civil works', category: 'Works' }),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(worksCapacityBidSchema());
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'uploadDocuments').mockImplementation(async (_bidId, payload) =>
      bidDto({
        documents: [
          {
            id: 'bid-doc-financial-capacity',
            documentId: 'doc-financial-capacity',
            name: payload.files[0]?.name ?? 'financial-capacity.pdf',
            documentType: payload.documentType,
            envelope: payload.envelope,
            reviewStatus: 'UPLOADED',
            checksum: 'c'.repeat(64),
            metadata: payload.metadata ?? {}
          }
        ]
      })
    );

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
    completeGate();
    openProgressStep('Financial Proposal / BOQ Pricing');

    expect(screen.getByText('Financial statements and capacity requirements')).toBeInTheDocument();
    ['Buyer Requirement', 'Minimum / Period', 'Evidence Required', 'Your Response', 'Evidence Note', 'Upload'].forEach((heading) => {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument();
    });
    expect(screen.queryByText('Financial evidence uploads')).not.toBeInTheDocument();
    expect(screen.getAllByText('Financial capacity and bank statement evidence').length).toBeGreaterThanOrEqual(1);
    const matrixSection = screen.getByText('Financial statements and capacity requirements').closest('section');
    const boqTable = screen.getByRole('table', { name: 'Editable financial offer review table' });
    expect(matrixSection?.compareDocumentPosition(boqTable) ?? 0).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(boqTable).toBeInTheDocument();
    ['Item', 'Work Item', 'Qty', 'Unit', 'Status', 'Labor', 'Material', 'Equipment', 'Overheads', 'Profit %', 'Unit Rate', 'Total'].forEach((heading) => {
      expect(screen.getByRole('columnheader', { name: heading })).toBeInTheDocument();
    });
    expect(screen.getByText('Commercial terms response')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Bid status for work item 1'), { target: { value: 'Bid' } });
    fireEvent.change(screen.getByLabelText('Labor cost for work item 1'), { target: { value: '1000' } });
    fireEvent.change(screen.getByLabelText('Material cost for work item 1'), { target: { value: '2000' } });
    fireEvent.change(screen.getByLabelText('Equipment cost for work item 1'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Overheads for work item 1'), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText('Profit margin percentage for work item 1'), { target: { value: '10' } });
    expect(screen.getAllByText('TZS 4,400').length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByLabelText('Bid security submitted, if required by this tender.'));
    expect(screen.getByText('Bid security document')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Response for Financial capacity and bank statement evidence'), { target: { value: 'Average monthly balance exceeds minimum requirement.' } });
    fireEvent.change(screen.getByLabelText('Evidence note for Financial capacity and bank statement evidence'), { target: { value: 'Attached six months of bank statements.' } });
    fireEvent.change(screen.getByLabelText('Commercial Clarifications'), { target: { value: 'Rates exclude night work.' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);

    await waitFor(() => expect(biddingApi.saveTenderDraft).toHaveBeenCalled());
    const payload = vi.mocked(biddingApi.saveTenderDraft).mock.calls[0][1];
    expect(payload.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementKey: 'unitRate',
          response: {
            value: expect.objectContaining({
              status: 'Bid',
              labor: 1000,
              material: 2000,
              equipment: 500,
              overheads: 500,
              profit: 10,
              unitRate: 4400
            })
          }
        }),
        expect.objectContaining({
          requirementKey: 'works.financialCapacityEvidence',
          response: {
            value: expect.objectContaining({
              response: 'Average monthly balance exceeds minimum requirement.',
              evidenceNote: 'Attached six months of bank statements.'
            })
          }
        }),
        expect.objectContaining({
          requirementKey: 'works.commercial.clarifications',
          response: { value: 'Rates exclude night work.' }
        })
      ])
    );
    expect(payload.financial.items).toEqual([
      expect.objectContaining({
        id: 'line-1',
        rate: 4400,
        total: 4400
      })
    ]);

    fireEvent.change(screen.getByLabelText('Bid status for work item 1'), { target: { value: 'Not Bid' } });
    expect(screen.getAllByText('TZS 0').length).toBeGreaterThanOrEqual(2);

    const financialUploadSection = screen.getByText('Financial statements and capacity requirements').closest('section');
    const financialCapacityInput = financialUploadSection?.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(financialCapacityInput).not.toBeNull();
    const financialCapacityFile = new File(['bank statements'], 'bank-statements.pdf', { type: 'application/pdf' });
    fireEvent.change(financialCapacityInput!, { target: { files: [financialCapacityFile] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledWith('bid-1', expect.objectContaining({
      files: [financialCapacityFile],
      envelope: 'FINANCIAL',
      documentType: 'FINANCIAL_CAPACITY_EVIDENCE',
      metadata: expect.objectContaining({
        requirementKey: 'works.financialCapacityEvidence',
        requirementLabel: 'Financial capacity and bank statement evidence',
        fieldId: 'works.financialCapacityEvidence',
        source: 'bid-workspace'
      })
    })));
  });

  it('renders works declaration and submission like procurex-ui, uploads company stamp, and saves draft responses', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail({ type: 'WORKS', title: 'Solar mini-grid civil works', category: 'Works' }),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        tenderType: 'WORKS',
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible')]),
          step('worksDeclaration', 'Declaration and Submission', 'COMBINED', worksDeclarationFields())
        ]
      })
    );
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'updateBid').mockResolvedValue(bidDto());
    vi.spyOn(biddingApi, 'uploadDocuments').mockImplementation(async (_bidId, payload) => {
      const metadata = payload.metadata ?? {};
      return bidDto({
        documents: [
          {
            id: 'bid-doc-company-stamp',
            documentId: 'doc-company-stamp',
            name: payload.files[0]?.name ?? 'company-stamp.png',
            documentType: payload.documentType,
            envelope: payload.envelope,
            reviewStatus: 'UPLOADED',
            checksum: 'd'.repeat(64),
            metadata
          }
        ]
      });
    });

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('I confirm and accept this requirement.'));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Declaration and Submission' })).toBeInTheDocument();
    expect(screen.getByLabelText('Authorized Signatory Name')).toBeInTheDocument();
    expect(screen.getByLabelText('Position')).toBeInTheDocument();
    expect(screen.getByLabelText('Company stamp upload')).toHaveAttribute('accept', '.pdf,.jpg,.jpeg,.png');
    expect(screen.getByPlaceholderText('Type authorized digital signature')).toBeInTheDocument();
    expect(screen.getByText('I confirm this works bid is complete, accurate, and authorized.')).toBeInTheDocument();
    expect(screen.getByText('I declare no conflict of interest.')).toBeInTheDocument();
    expect(screen.getByText('I accept anti-corruption declarations.')).toBeInTheDocument();
    expect(screen.getByText('Submission date')).toBeInTheDocument();
    expect(screen.getByText(new Date().toISOString().slice(0, 10))).toBeInTheDocument();
    expect(screen.getByText('Draft until submitted')).toBeInTheDocument();
    expect(screen.getByText('Ready to seal')).toBeInTheDocument();
    expect(screen.getByText('The system will check required responses, seal the works bid, and store a receipt.')).toBeInTheDocument();
    const submitStrip = screen.getByText('Ready to seal').closest('.submit-strip') as HTMLElement;
    expect(within(submitStrip).queryByRole('button', { name: 'Save Draft' })).not.toBeInTheDocument();

    fireEvent.click(within(submitStrip).getByRole('button', { name: 'Submit Bid' }));
    await waitFor(() => {
      expect(biddingApi.submitBid).not.toHaveBeenCalled();
      expect(workspaceStatus()).toMatch(/Complete required sections before submitting:/);
    });

    openProgressStep('Declaration and Submission');
    fireEvent.change(screen.getByLabelText('Authorized Signatory Name'), { target: { value: 'Asha Contractor' } });
    fireEvent.change(screen.getByLabelText('Position'), { target: { value: 'Managing Director' } });
    fireEvent.change(screen.getByLabelText('Digital Signature'), { target: { value: 'Asha Contractor' } });
    fireEvent.click(screen.getByLabelText('I confirm this works bid is complete, accurate, and authorized.'));
    fireEvent.click(screen.getByLabelText('I declare no conflict of interest.'));
    fireEvent.click(screen.getByLabelText('I accept anti-corruption declarations.'));
    const stamp = new File(['stamp'], 'company-stamp.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('Company stamp upload'), { target: { files: [stamp] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalled());

    expect(biddingApi.uploadDocuments).toHaveBeenCalledWith(
      'bid-1',
      expect.objectContaining({
        files: [stamp],
        documentType: 'DECLARATION_COMPANY_STAMP',
        envelope: 'COMBINED',
        metadata: expect.objectContaining({
          requirementKey: 'works.declaration.companyStamp',
          requirementLabel: 'Company stamp upload',
          fieldId: 'works.declaration.companyStamp',
          source: 'bid-workspace'
        })
      })
    );

    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);
    await waitFor(() => expect(biddingApi.updateBid).toHaveBeenCalled());
    const savedPayload = vi.mocked(biddingApi.updateBid).mock.calls.at(-1)?.[1];
    expect(savedPayload?.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ requirementKey: 'works.declaration.signatoryName', response: { value: 'Asha Contractor' } }),
        expect.objectContaining({ requirementKey: 'works.declaration.position', response: { value: 'Managing Director' } }),
        expect.objectContaining({ requirementKey: 'works.declaration.digitalSignature', response: { value: 'Asha Contractor' } }),
        expect.objectContaining({ requirementKey: 'works.declaration.final', response: { value: true } }),
        expect.objectContaining({ requirementKey: 'works.declaration.conflict', response: { value: true } }),
        expect.objectContaining({ requirementKey: 'works.declaration.antiCorruption', response: { value: true } })
      ])
    );
    expect(savedPayload?.documents).toEqual([
      expect.objectContaining({
        name: 'company-stamp.png',
        documentType: 'DECLARATION_COMPANY_STAMP',
        envelope: 'COMBINED',
        metadata: expect.objectContaining({ requirementKey: 'works.declaration.companyStamp' })
      })
    ]);
  });

  it('renders the supplier bid submission review document with editable response rows', async () => {
    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    await waitFor(() => expect(screen.getByText('Administrative requirements complete. You can continue to the bid workflow.')).toBeInTheDocument());
    openProgressStep('Review Submission');

    expect(screen.getByText('BID SUBMISSION — GOODS PROCUREMENT')).toBeInTheDocument();
    const reviewDocument = document.querySelector('.bid-response-document') as HTMLElement;
    expect(reviewDocument).toBeInTheDocument();
    expect(within(reviewDocument).getByText('Bid Submission Summary')).toBeInTheDocument();
    expect(within(reviewDocument).getByText('Bidder Information')).toBeInTheDocument();
    expect(within(reviewDocument).getByText('Eligibility and Documentary Requirements Response Schedule')).toBeInTheDocument();
    expect(within(reviewDocument).getByText('Technical Offer and Specification Compliance Schedule')).toBeInTheDocument();
    expect(within(reviewDocument).getByText('Quantity Schedule and Financial Offer')).toBeInTheDocument();
    expect(within(reviewDocument).getByText('Attachments and Evidence Register')).toBeInTheDocument();
    expect(screen.getByText('Document completeness summary')).toBeInTheDocument();
    expect(screen.getByText('Official goods bid submission document')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Print / Save PDF' })).toBeInTheDocument();
    expect(screen.queryByLabelText('I have reviewed the completeness checklist and corrected any incomplete bid sections.')).not.toBeInTheDocument();
    expect(screen.getAllByText(/Pending required response|Not complete|Awaiting/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Change' }).length).toBeGreaterThan(0);
  });

  it('downloads the review submission document as a clean official PDF', async () => {
    const captured: { anchor?: HTMLAnchorElement; blob?: Blob } = {};
    const createObjectUrl = vi.fn((blob: Blob | MediaSource) => {
      captured.blob = blob as Blob;
      return 'blob:bid-review';
    });
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation(((tagName: string, options?: ElementCreationOptions) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === 'a') captured.anchor = element as HTMLAnchorElement;
      return element;
    }) as typeof document.createElement);

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    openProgressStep('Review Submission');
    fireEvent.click(screen.getByRole('button', { name: 'Download PDF' }));

    await waitFor(() => expect(html2PdfMock.worker.outputPdf).toHaveBeenCalledWith('blob'));
    expect(html2PdfMock.worker.set).toHaveBeenCalledWith(expect.objectContaining({
      filename: expect.stringMatching(/^Bid_px-bid-px-2026-001-[a-z0-9]+_px-2026-001_DRAFT\.pdf$/)
    }));
    const pdfSource = html2PdfMock.worker.from.mock.calls.at(-1)?.[0] as HTMLElement | undefined;
    expect(pdfSource?.textContent).toContain('BID SUBMISSION — GOODS PROCUREMENT');
    expect(pdfSource?.textContent).toContain('DRAFT — NOT SUBMITTED');
    expect(pdfSource?.textContent).toContain('Supply of laptops');
    expect(pdfSource?.outerHTML).not.toContain('bid-review-edit-button');
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    if (!captured.anchor) throw new Error('Expected the review download to create an anchor element.');
    expect(captured.anchor.download).toMatch(/^Bid_px-bid-px-2026-001-[a-z0-9]+_px-2026-001_DRAFT\.pdf$/);
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:bid-review');
    if (!captured.blob) throw new Error('Expected the review download to create a PDF blob.');
    expect(captured.blob.type).toBe('application/pdf');
  });

  it('opens the review submission document for print and PDF saving', async () => {
    const print = vi.fn();
    const write = vi.fn();
    const open = vi.fn(() => ({
      document: { open: vi.fn(), write, close: vi.fn() },
      focus: vi.fn(),
      print
    }));
    Object.defineProperty(window, 'open', { configurable: true, value: open });

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    openProgressStep('Review Submission');
    fireEvent.click(screen.getByRole('button', { name: 'Print / Save PDF' }));

    expect(open).toHaveBeenCalledWith('', '_blank');
    expect(write).toHaveBeenCalledWith(expect.stringContaining('BID SUBMISSION — GOODS PROCUREMENT'));
  });

  it('uses review Change actions to navigate back to the editable technical source field', async () => {
    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    openProgressStep('Review Submission');

    const productAction = screen
      .getAllByText('Product specification response - Laptop')
      .map((element) => element.closest('.bid-review-action-row') as HTMLElement | null)
      .find(Boolean);
    if (!productAction) throw new Error('Expected product specification action row.');
    fireEvent.click(within(productAction).getByRole('button', { name: 'Change' }));

    expect(screen.getByRole('heading', { name: 'Technical Response' })).toBeInTheDocument();
    expect(screen.getByLabelText('Product specification response - Laptop Compliance')).toBeInTheDocument();
    expect(screen.getByText('Jumped to the source field. Update it, then return to Review Submission.')).toBeInTheDocument();
  });

  it('renders submitted bid review rows as read-only without edit buttons', async () => {
    vi.mocked(biddingApi.getTenderDraft).mockResolvedValue(bidDto({ status: 'SUBMITTED', submittedAt: '2026-07-09T10:00:00.000Z' }));

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    openProgressStep('Review Submission');

    expect(screen.getByText('BID SUBMISSION — GOODS PROCUREMENT')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace file' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Read only').length).toBeGreaterThan(0);
  });

  it('renders services declaration inside review without a standalone declaration step', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetail({ type: 'SERVICE' }),
      status: 'success',
      isLoading: false,
      isError: false
    });

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    expect(progressStepLabels()).toContain('Supplier Declaration and Submit');
    completeGate();
    openProgressStep('Review Submission');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Ready to seal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Sealed Bid' })).toBeInTheDocument();
  });

  it('completes a fresh goods bid from bid information through final submitted receipt', async () => {
    const draft = bidDto();
    const submitted = bidDto({
      status: 'SUBMITTED',
      totalAmount: 2500000,
      receipt: { receiptRef: 'BID-PX-FRESH', receiptHash: 'hash-fresh-goods', createdAt: '2026-07-09T10:45:00.000Z' }
    });
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(draft);
    vi.spyOn(biddingApi, 'updateBid').mockResolvedValue(draft);
    vi.mocked(biddingApi.submitBid).mockResolvedValue({ receiptRef: 'BID-PX-FRESH', receiptHash: 'hash-fresh-goods', createdAt: '2026-07-09T10:45:00.000Z', bid: submitted });

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await completeBasicGoodsBidToDeclaration();
    await signAndSubmitGoodsBid('fresh-goods-keyphrase');

    expect(await screen.findByText('Bid submitted successfully')).toBeInTheDocument();
    expect(screen.getAllByText('hash-fresh-goods').length).toBeGreaterThan(0);
    expect(biddingApi.submitBid).toHaveBeenCalledWith('bid-1', { signatureKeyphrase: 'fresh-goods-keyphrase' });
    const savedPayload = vi.mocked(biddingApi.saveTenderDraft).mock.calls.at(-1)?.[1];
    expect(savedPayload?.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementKey: 'goods.productSpecification.line-1',
          response: { value: expect.objectContaining({ complianceStatus: 'Comply', offeredSpecification: 'Offered laptops comply with the stated requirements.' }) }
        }),
        expect.objectContaining({ requirementKey: 'unitRate', response: { value: expect.objectContaining({ unitPrice: 2500000 }) } }),
        expect.objectContaining({ requirementKey: 'confirmAccuracy', response: { value: true } }),
        expect.objectContaining({ requirementKey: 'acceptTerms', response: { value: true } }),
        expect.objectContaining({ requirementKey: 'noConflict', response: { value: true } })
      ])
    );
    expect(savedPayload?.totalAmount).toBe(2500000);
  });

  it('completes a sample-required goods bid and submits after sample tracking is recorded', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetailWithSamples(),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(bidSchema({ withSamples: true }));
    const draft = bidDto();
    const sample = sampleDto({ trackingStatus: 'SUBMITTED', submittedAt: '2026-07-09T10:15:00.000Z' });
    const submitted = bidDto({
      status: 'SUBMITTED',
      totalAmount: 2500000,
      receipt: { receiptRef: 'BID-PX-SAMPLE', receiptHash: 'hash-sample-goods', createdAt: '2026-07-09T11:00:00.000Z' }
    });
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(draft);
    vi.spyOn(biddingApi, 'updateBid').mockResolvedValue(draft);
    vi.spyOn(biddingApi, 'createSample').mockResolvedValue(sample);
    vi.spyOn(biddingApi, 'listSamples').mockResolvedValue([sample]);
    vi.mocked(biddingApi.submitBid).mockResolvedValue({ receiptRef: 'BID-PX-SAMPLE', receiptHash: 'hash-sample-goods', createdAt: '2026-07-09T11:00:00.000Z', bid: submitted });

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await completeBasicGoodsBidToFinancialOffer();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Sample Submission', level: 2 })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Courier'), { target: { value: 'DHL' } });
    fireEvent.change(screen.getByLabelText('Tracking number'), { target: { value: 'DHL-123' } });
    fireEvent.click(screen.getByLabelText('Mark sample as submitted'));
    fireEvent.click(screen.getByRole('button', { name: 'Add sample record' }));
    expect(await screen.findByText('Sample record added and marked as submitted.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Review Submission' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Supplier Declaration and Submit' })).toBeInTheDocument();
    await completeGoodsDeclarations();
    await signAndSubmitGoodsBid('sample-goods-keyphrase');

    expect(await screen.findByText('Bid submitted successfully')).toBeInTheDocument();
    expect(screen.getAllByText('hash-sample-goods').length).toBeGreaterThan(0);
    expect(biddingApi.createSample).toHaveBeenCalledWith('bid-1', expect.objectContaining({ sampleName: 'Laptop sample', trackingStatus: 'SUBMITTED' }));
    expect(biddingApi.submitBid).toHaveBeenCalledWith('bid-1', { signatureKeyphrase: 'sample-goods-keyphrase' });
    const finalDraftPayload = vi.mocked(biddingApi.updateBid).mock.calls.at(-1)?.[1] ?? vi.mocked(biddingApi.saveTenderDraft).mock.calls.at(-1)?.[1];
    expect(finalDraftPayload?.workspaceState?.samples).toEqual([expect.objectContaining({ sampleName: 'Laptop sample', trackingStatus: 'SUBMITTED' })]);
  });

  it('renders receipt in the final panel after successful submit', async () => {
    const createObjectUrl = vi.fn(() => 'blob:bid-record');
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectUrl });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const print = vi.fn();
    Object.defineProperty(window, 'print', { configurable: true, value: print });
    const draft = bidDto({
      payload: {
        administrative: { eligible: true, taxCompliant: true, documentsConfirmed: true },
        technical: { 'goods.productSpecification.line-1': { complianceStatus: 'Comply', offeredSpecification: 'Compliant product response.' } },
        financial: { items: [{ id: 'line-1', itemNo: '1', description: 'Laptop', quantity: 1, unit: 'Each', rate: 2500000 }] },
        declarations: { confirmAccuracy: false, acceptTerms: false, noConflict: true }
      },
      documents: [
        {
          id: 'bid-doc-1',
          documentId: 'doc-1',
          name: 'eligibility.pdf',
          documentType: 'ADMINISTRATIVE_EVIDENCE',
          envelope: 'ADMINISTRATIVE',
          reviewStatus: 'UPLOADED',
          checksum: 'a'.repeat(64),
          metadata: { requirementKey: 'eligibility', size: 12, mimeType: 'application/pdf' }
        }
      ],
      responses: [
        { requirementKey: 'unitRate', response: { value: 2500000 } }
      ]
    });
    const submitted = bidDto({
      ...draft,
      status: 'SUBMITTED',
      receipt: { receiptRef: 'BID-PX-1', receiptHash: 'hash-1', createdAt: '2026-07-09T10:30:00.000Z' }
    });
    vi.mocked(biddingApi.getTenderDraft).mockResolvedValue(draft);
    vi.spyOn(biddingApi, 'updateBid').mockResolvedValue(draft);
    vi.mocked(biddingApi.submitBid).mockResolvedValue({ receiptRef: 'BID-PX-1', receiptHash: 'hash-1', createdAt: '2026-07-09T10:30:00.000Z', bid: submitted });

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    await waitFor(() => expect(screen.getByText('Administrative requirements complete. You can continue to the bid workflow.')).toBeInTheDocument());
    openProgressStep('Review Submission');
    expect(await screen.findByRole('heading', { name: 'Review Submission' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    checkCard('I confirm the bid is accurate and complete');
    checkCard('I accept the tender and contract terms');
    await signAndSubmitGoodsBid('receipt-keyphrase');

    await waitFor(() => expect(biddingApi.updateBid).toHaveBeenCalled());
    const savedPayload = vi.mocked(biddingApi.updateBid).mock.calls.at(-1)?.[1];
    expect(savedPayload?.administrative).toEqual(expect.objectContaining({ contactName: 'Jane Supplier' }));
    expect(savedPayload?.administrative).not.toHaveProperty('administrative');
    expect(await screen.findByText('Bid submitted successfully')).toBeInTheDocument();
    expect(screen.getAllByText('hash-1').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
    const downloadButton = screen.getByRole('button', { name: 'Download submitted bid record' });
    const printButton = screen.getByRole('button', { name: 'Print submission receipt' });
    expect(downloadButton).toBeEnabled();
    expect(printButton).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Withdraw Submission' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Return to Dashboard' })).toBeInTheDocument();

    fireEvent.click(downloadButton);
    expect(createObjectUrl).toHaveBeenCalledWith(expect.any(Blob));
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:bid-record');

    fireEvent.click(printButton);
    expect(print).toHaveBeenCalled();
  });

  it('surfaces backend submit blockers instead of the generic fallback', async () => {
    const blocker = 'Complete required bid sections before submitting: technical.goods.productSpecification.line-1.';
    const draft = bidDto({
      payload: {
        administrative: { eligible: true, taxCompliant: true, documentsConfirmed: true },
        technical: { 'goods.productSpecification.line-1': { complianceStatus: 'Comply', offeredSpecification: 'Compliant product response.' } },
        financial: { items: [{ id: 'line-1', itemNo: '1', description: 'Laptop', quantity: 1, unit: 'Each', rate: 2500000 }] },
        declarations: { confirmAccuracy: false, acceptTerms: false, noConflict: true }
      },
      documents: [
        {
          id: 'bid-doc-1',
          documentId: 'doc-1',
          name: 'eligibility.pdf',
          documentType: 'ADMINISTRATIVE_EVIDENCE',
          envelope: 'ADMINISTRATIVE',
          reviewStatus: 'UPLOADED',
          checksum: 'a'.repeat(64),
          metadata: { requirementKey: 'eligibility', size: 12, mimeType: 'application/pdf' }
        }
      ],
      responses: [{ requirementKey: 'unitRate', response: { value: 2500000 } }]
    });
    vi.mocked(biddingApi.getTenderDraft).mockResolvedValue(draft);
    vi.spyOn(biddingApi, 'updateBid').mockResolvedValue(draft);
    vi.mocked(biddingApi.submitBid).mockRejectedValue({
      response: { status: 400, data: { message: blocker } },
      message: 'Request failed with status code 400'
    });

    const { container } = render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await openEligibilityStep();
    completeGate();
    openProgressStep('Review Submission');
    expect(await screen.findByRole('heading', { name: 'Review Submission' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    checkCard('I confirm the bid is accurate and complete');
    checkCard('I accept the tender and contract terms');
    fireEvent.click(screen.getByRole('button', { name: 'Submit Sealed Bid' }));
    fireEvent.change(await screen.findByLabelText('Signature keyphrase'), { target: { value: 'Signing123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit bid' }));

    await waitFor(() => expect(biddingApi.submitBid).toHaveBeenCalled());
    await waitFor(() => expect(container.querySelector('[data-bid-workspace-status]')).toHaveTextContent(blocker));
    expect(container.querySelector('[data-bid-workspace-status]')).not.toHaveTextContent('Bid could not be submitted.');
  });
});

function progressStepLabels() {
  return within(screen.getByRole('navigation', { name: 'Bid submission progress' }))
    .getAllByRole('button')
    .map((button) => (button.textContent ?? '').replace(/^\s*\d+\s*/, '').trim());
}

function completeGate() {
  [
    'Confirm eligibility to participate',
    'Confirm tax and statutory compliance',
    'Confirm mandatory documents are attached',
    'I confirm that the documents I uploaded are valid and true.',
    'I understand that false or misleading documents may lead to disqualification.'
  ].forEach(checkCardIfPresent);
}

function completeDefaultGoodsTechnicalResponse(offeredSpecification = 'Offered laptops comply with the stated requirements.') {
  fireEvent.change(screen.getByLabelText('Product specification response - Laptop Compliance'), { target: { value: 'Comply' } });
  fireEvent.change(screen.getByLabelText('Product specification response - Laptop Supplier offered specification'), { target: { value: offeredSpecification } });
}

async function completeBasicGoodsBidToFinancialOffer() {
  await openEligibilityStep();
  completeGate();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('heading', { name: 'Technical Response' })).toBeInTheDocument();
  completeDefaultGoodsTechnicalResponse();
  await waitFor(() => expect(screen.getByLabelText('Product specification response - Laptop Supplier offered specification')).toHaveValue('Offered laptops comply with the stated requirements.'));
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('heading', { name: 'Quantity Schedule / Financial Offer' })).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Unit price for Laptop'), { target: { value: '2500000' } });
  await waitFor(() => expect(screen.getAllByText('TZS 2,500,000').length).toBeGreaterThan(0));
}

async function completeBasicGoodsBidToDeclaration() {
  await completeBasicGoodsBidToFinancialOffer();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('heading', { name: 'Review Submission' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(await screen.findByRole('heading', { name: 'Supplier Declaration and Submit' })).toBeInTheDocument();
  await completeGoodsDeclarations();
}

async function completeGoodsDeclarations() {
  const labels = [
    'I confirm the bid is accurate and complete',
    'I accept the tender and contract terms',
    'I declare no conflict of interest',
    'I confirm anti-corruption compliance'
  ];
  labels.forEach(checkCard);
  await waitFor(() => {
    labels.forEach((label) => expect(checkboxInputByText(label)).toBeChecked());
  });
}

async function signAndSubmitGoodsBid(signatureKeyphrase: string) {
  const submitButton =
    (screen.getAllByRole('button', { name: 'Submit Sealed Bid' }).find((button) => !(button as HTMLButtonElement).disabled) as HTMLButtonElement | undefined) ??
    (screen.getByRole('button', { name: 'Submit Sealed Bid' }) as HTMLButtonElement);
  fireEvent.click(submitButton);
  await waitFor(() => {
    const dialog = screen.queryByRole('dialog');
    if (!dialog) {
      const buttons = screen
        .queryAllByRole('button', { name: 'Submit Sealed Bid' })
        .map((button) => `disabled=${String((button as HTMLButtonElement).disabled)} class=${button.getAttribute('class') ?? ''}`)
        .join(' | ');
      throw new Error(`Signature dialog did not open. status="${workspaceStatus()}" buttons="${buttons}"`);
    }
    expect(dialog).toBeInTheDocument();
  });
  const dialog = screen.getByRole('dialog');
  expect(within(dialog).getByText('Submit sealed bid')).toBeInTheDocument();
  fireEvent.change(within(dialog).getByLabelText('Signature keyphrase'), { target: { value: signatureKeyphrase } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Submit bid' }));
  await waitFor(() => expect(biddingApi.submitBid).toHaveBeenCalled());
}

function workspaceStatus() {
  return document.querySelector('[data-bid-workspace-status]')?.textContent ?? '';
}

async function openEligibilityStep() {
  await waitFor(() => {
    expect(
      screen.queryByRole('heading', { name: 'Bid Information' }) ||
        screen.queryByRole('heading', { name: 'Eligibility and Document Requirements' }) ||
        screen.queryByText('Eligibility and administrative evidence')
    ).toBeTruthy();
  });

  if (screen.queryByRole('heading', { name: 'Bid Information' })) {
    await waitFor(() => expect((screen.getByLabelText('Name of bidder') as HTMLInputElement).value).toBeTruthy());
    await waitFor(() => expect((screen.getByLabelText('Bid reference number') as HTMLInputElement).value).toBeTruthy());
    fireEvent.change(screen.getByLabelText('Contact person name'), { target: { value: 'Jane Supplier' } });
    fireEvent.change(screen.getByLabelText('Contact person email'), { target: { value: 'jane@supplier.example' } });
    fireEvent.change(screen.getByLabelText('Contact person phone number'), { target: { value: '+255700111222' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  }

  expect(await screen.findByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
}

function openProgressStep(label: string) {
  const button = screen
    .getAllByText(label)
    .map((element) => element.closest('button') as HTMLButtonElement | null)
    .find(Boolean);
  if (!button) throw new Error(`Progress step not found for ${label}`);
  fireEvent.click(button);
}

function checkCard(label: string) {
  const checkbox = checkboxInputByText(label);
  if (!checkbox.checked) fireEvent.click(checkbox);
}

function checkboxInputByText(label: string) {
  const checkbox = screen
    .getAllByText(label)
    .map((element) => {
      const compactCard = element.closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (compactCard) return compactCard;
      return element.closest('article')?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    })
    .find(Boolean);
  if (!checkbox) throw new Error(`Checkbox not found for ${label}`);
  return checkbox;
}

function checkCardIfPresent(label: string) {
  if (!screen.queryByText(label)) return;
  checkCard(label);
}

function uploadInputByText(label: string) {
  const input = screen
    .getAllByText(label)
    .map((element) => element.closest('label')?.querySelector('input[type="file"]') as HTMLInputElement | null)
    .find(Boolean);
  if (!input) throw new Error(`Upload input not found for ${label}`);
  return input;
}

function goodsProductSpecificationField() {
  return field('technical.productSpec.line1', 'Product specification response - Laptop', 'table', 'technical', 'structured', 'TECHNICAL', true, 'goods.productSpecification.line-1', {
    control: 'goodsProductSpecification',
    itemNo: '1',
    requestedProduct: 'Laptop',
    buyerSpecification: 'Core i7 laptop',
    quantity: 1,
    unit: 'Each'
  });
}

function bidSchema(options: { tenderType?: string; withSamples?: boolean; steps?: BidSubmissionSchemaStepDto[] } = {}): BidSubmissionSchemaDto {
  const { tenderType = 'GOODS', withSamples = false } = options;
  const administrative = step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
    field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible'),
    field('administrative.taxCompliant', 'Confirm tax and statutory compliance', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'taxCompliant'),
    field('administrative.documentsConfirmed', 'Confirm mandatory documents are attached', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'documentsConfirmed'),
    field('administrative.eligibilityDocument', 'Eligibility and administrative evidence', 'file', 'administrative', 'attachment', 'ADMINISTRATIVE', false, 'eligibility', {
      documentType: 'ADMINISTRATIVE_EVIDENCE'
    })
  ]);
  const goodsTechnical = [
    goodsProductSpecificationField(),
    field('technical.productEvidence', 'Product brochures, catalogues, and specification evidence', 'file', 'technical', 'attachment', 'TECHNICAL', false, 'goods-technical', {
      documentType: 'TECHNICAL_PRODUCT_BROCHURES'
    })
  ];
  const pricingFields = [
    field('financial.unitRate', 'Unit rate for Laptop', 'number', 'financial', 'pricing', 'FINANCIAL', true, 'unitRate', {
      itemId: 'line-1',
      itemNo: '1',
      description: 'Laptop',
      quantity: 1,
      unit: 'Each',
      min: 0
    }),
    field('financial.offerDocument', 'Financial offer and price schedule', 'file', 'financial', 'attachment', 'FINANCIAL', false, 'goods-financial', {
      documentType: 'FINANCIAL_OFFER'
    }),
    field('criteria.financial', 'Response for Financial', 'number', 'financial', 'money', 'FINANCIAL', false, 'evaluationCriteria.financial')
  ];
  const samples = withSamples
    ? [
        step('goodsSamples', 'Sample Submission', 'TECHNICAL', [
          field('samples.laptop', 'Laptop sample', 'table', 'samples', 'structured', 'TECHNICAL', true, 'sample-req-1', {
            relatedItem: 'line-1',
            quantity: 2,
            deliveryLocation: 'PMU office',
            deliveryDeadline: '2099-09-01'
          })
        ])
      ]
    : [];
  const declarations = [
    field('declarations.confirmAccuracy', 'I confirm the bid is accurate and complete', 'boolean', 'declarations', 'declaration', 'COMBINED', true, 'confirmAccuracy'),
    field('declarations.acceptTerms', 'I accept the tender and contract terms', 'boolean', 'declarations', 'declaration', 'COMBINED', true, 'acceptTerms'),
    field('declarations.noConflict', 'I declare no conflict of interest', 'boolean', 'declarations', 'declaration', 'COMBINED', true, 'noConflict'),
    field('declarations.antiCorruption', 'I confirm anti-corruption compliance', 'boolean', 'declarations', 'declaration', 'COMBINED', false, 'antiCorruption')
  ];
  const review = field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete');
  const type = tenderType.toLowerCase();
  const steps =
    options.steps ??
    (type.includes('work')
      ? [
          administrative,
          step('worksCapacity', 'Technical Capacity and Experience', 'TECHNICAL', [
            field('technical.personnel', 'Key personnel CV and qualification response', 'table', 'technical', 'structured', 'TECHNICAL', true, 'works.personnel'),
            field('technical.equipment', 'Equipment availability response', 'table', 'technical', 'structured', 'TECHNICAL', true, 'works.equipment')
          ]),
          step('worksTechnicalProposal', 'Technical Proposal and Work Program', 'TECHNICAL', goodsTechnical),
          step('worksFinancial', 'Financial Proposal / BOQ Pricing', 'FINANCIAL', pricingFields),
          step('worksReview', 'Review Submission', 'COMBINED', [review]),
          step('worksDeclaration', 'Declaration and Submission', 'COMBINED', worksDeclarationFields())
        ]
      : type.includes('service')
        ? [
            administrative,
            step('servicesMethodology', 'Service Understanding and Methodology', 'TECHNICAL', [field('technical.methodology', 'Service methodology response', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'services.methodology')]),
            step('servicesDeliveryPlan', 'Service Schedule and Delivery Plan', 'TECHNICAL', [field('technical.delivery', 'Delivery milestone response', 'table', 'technical', 'structured', 'TECHNICAL', true, 'services.delivery')]),
            step('servicesStaffing', 'Staffing, Capacity and Continuity Plan', 'TECHNICAL', [field('technical.staffing', 'Staffing and supervision response', 'table', 'technical', 'structured', 'TECHNICAL', true, 'services.staffing')]),
            step('servicesSla', 'Performance, SLA, Reporting and Compliance', 'TECHNICAL', [field('technical.sla', 'SLA and performance response', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'services.sla')]),
            step('servicesCommercial', 'Commercial Pricing and Cost Breakdown', 'FINANCIAL', pricingFields),
            step('servicesReview', 'Review Submission', 'COMBINED', [...declarations, review])
          ]
        : type.includes('consult')
          ? [
              administrative,
              step('consultancyTechnical', 'Technical Proposal', 'TECHNICAL', [field('technical.consultancy', 'TOR understanding and methodology response', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'consultancy.tor')]),
              step('consultancyFinancial', 'Financial Proposal', 'FINANCIAL', pricingFields),
              step('consultancyReview', 'Review and Submit', 'COMBINED', [...declarations, review])
            ]
          : type.includes('generic')
            ? [
                administrative,
                step('technical', 'Technical Response', 'TECHNICAL', goodsTechnical),
                step('financial', 'Financial Offer', 'FINANCIAL', pricingFields),
                step('declarations', 'Declarations and Submit', 'COMBINED', declarations),
                step('review', 'Review Submission', 'COMBINED', [review])
              ]
            : [
                administrative,
                step('goodsTechnical', 'Technical Response', 'TECHNICAL', goodsTechnical),
                step('goodsFinancial', 'Quantity Schedule / Financial Offer', 'FINANCIAL', pricingFields),
                ...samples,
                step('goodsReview', 'Review Submission', 'COMBINED', [review]),
                step('goodsDeclaration', 'Supplier Declaration and Submit', 'COMBINED', declarations)
              ]);
  return {
    tenderId: 'tender-1',
    tenderReference: 'PX-2026-001',
    tenderTitle: 'Supply of laptops',
    tenderType,
    schemaVersion: 'bid-submission-schema-v1',
    steps
  };
}
function worksCapacityBidSchema(): BidSubmissionSchemaDto {
  return bidSchema({
    tenderType: 'WORKS',
    steps: [
      step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
        field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible'),
        field('administrative.taxCompliant', 'Confirm tax and statutory compliance', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'taxCompliant'),
        field('administrative.documentsConfirmed', 'Confirm mandatory documents are attached', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'documentsConfirmed')
      ]),
      step('worksCapacity', 'Technical Capacity and Experience', 'TECHNICAL', [
        field('works.similarProjects', 'Similar completed project evidence', 'table', 'technical', 'structured', 'TECHNICAL', true, 'works.similarProjects', {
          control: 'worksSimilarProject',
          prompt: 'Upload documents explaining previous similar projects.'
        }),
        field('works.keyPersonnel', 'Key personnel CV and qualification response', 'table', 'technical', 'structured', 'TECHNICAL', true, 'works.keyPersonnel', {
          control: 'worksPersonnel'
        }),
        field('works.equipment.excavator', 'Excavator', 'table', 'technical', 'structured', 'TECHNICAL', true, 'works.equipment.excavator', {
          control: 'worksEquipment',
          equipmentName: 'Excavator',
          quantity: 2,
          ownershipRequirement: 'Owned or leased'
        }),
        field('works.hsePolicy', 'HSE policy response', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'works.hsePolicy'),
        field('works.capacityNarrative', 'Capacity narrative', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'works.capacityNarrative')
      ]),
      step('worksTechnicalProposal', 'Technical Proposal and Work Program', 'TECHNICAL', [
        field('works.proposal.understanding', 'Project Understanding', 'textarea', 'technical', 'text', 'TECHNICAL', false, 'works.proposal.understanding', { control: 'worksProposalNarrative' }),
        field('works.proposal.methodology', 'Construction Methodology', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'works.proposal.methodology', { control: 'worksProposalNarrative' }),
        field('works.proposal.riskPlan', 'Risk Mitigation Plan', 'textarea', 'technical', 'text', 'TECHNICAL', false, 'works.proposal.riskPlan', { control: 'worksProposalNarrative' }),
        field('works.proposal.qualityPlan', 'Quality Assurance Approach', 'textarea', 'technical', 'text', 'TECHNICAL', false, 'works.proposal.qualityPlan', { control: 'worksProposalNarrative' }),
        field('works.schedule.startDate', 'Proposed Start Date', 'date', 'technical', 'date', 'TECHNICAL', false, 'works.schedule.startDate', { control: 'worksSchedule' }),
        field('works.schedule.completionPeriod', 'Proposed Completion Period', 'text', 'technical', 'text', 'TECHNICAL', false, 'works.schedule.completionPeriod', { control: 'worksSchedule' }),
        field('works.schedule.workPlan', 'Proposed Work Plan', 'textarea', 'technical', 'text', 'TECHNICAL', false, 'works.schedule.workPlan', { control: 'worksSchedule' }),
        field('works.schedule.resources', 'Resource Allocation Plan', 'textarea', 'technical', 'text', 'TECHNICAL', false, 'works.schedule.resources', { control: 'worksSchedule' }),
        field('works.schedule.workProgramUpload', 'Upload work program', 'file', 'technical', 'attachment', 'TECHNICAL', false, 'works.schedule.workProgramUpload', { documentType: 'TECHNICAL_UPLOAD_WORK_PROGRAM', control: 'worksSchedule' }),
        field('works.drawings.reviewedAcknowledgement', 'Drawing reviewed acknowledgement', 'boolean', 'technical', 'acknowledgement', 'TECHNICAL', false, 'works.drawings.reviewedAcknowledgement', { control: 'worksDrawingDesign' }),
        field('works.design.clarificationNeeded', 'Design Clarification Needed', 'select', 'technical', 'text', 'TECHNICAL', false, 'works.design.clarificationNeeded', { control: 'worksDrawingDesign', options: ['Yes', 'No'] }),
        field('works.design.alternativeProposed', 'Alternative Design Proposed?', 'select', 'technical', 'text', 'TECHNICAL', false, 'works.design.alternativeProposed', { control: 'worksDrawingDesign', options: ['Yes', 'No'] }),
        field('works.design.alternativeUpload', 'Upload proposed alternative designs', 'file', 'technical', 'attachment', 'TECHNICAL', false, 'works.design.alternativeUpload', { documentType: 'TECHNICAL_UPLOAD_PROPOSED_ALTERNATIVE_DESIGNS', control: 'worksDrawingDesign' }),
        field('works.design.alternative', 'Proposed Design Alternative', 'textarea', 'technical', 'text', 'TECHNICAL', false, 'works.design.alternative', { control: 'worksDrawingDesign' }),
        field('works.siteVisit', 'Site visit response', 'select', 'technical', 'text', 'TECHNICAL', false, 'works.siteVisit', { control: 'worksSiteVisit', options: ['Conducted', 'Scheduled', 'Not conducted', 'Not applicable'] }),
        field('works.siteVisitEvidence', 'Site visit evidence upload', 'file', 'technical', 'attachment', 'TECHNICAL', false, 'works.siteVisitEvidence', { documentType: 'TECHNICAL_SITE_VISIT_EVIDENCE_UPLOAD', control: 'worksSiteVisit' }),
        field('works.siteVisit.notes', 'Site Visit Notes', 'textarea', 'technical', 'text', 'TECHNICAL', false, 'works.siteVisit.notes', { control: 'worksSiteVisit' })
      ]),
      step('worksFinancial', 'Financial Proposal / BOQ Pricing', 'FINANCIAL', [
        field('financial.unitRate', 'Unit rate for Civil works', 'number', 'financial', 'pricing', 'FINANCIAL', true, 'unitRate', {
          control: 'worksBoqCostBreakdown',
          itemId: 'line-1',
          itemNo: '1',
          description: 'Civil works',
          quantity: 1,
          unit: 'Lot',
          min: 0
        }),
        field('works.commercial.bidValidity', 'Bid Validity Period (days)', 'number', 'financial', 'number', 'FINANCIAL', true, 'works.commercial.bidValidity', { control: 'worksCommercialTerms', min: 1 }),
        field('works.commercial.currency', 'Currency', 'select', 'financial', 'text', 'FINANCIAL', true, 'works.commercial.currency', { control: 'worksCommercialTerms', options: ['TZS', 'USD', 'EUR', 'GBP'] }),
        field('works.commercial.clarifications', 'Commercial Clarifications', 'textarea', 'financial', 'text', 'FINANCIAL', false, 'works.commercial.clarifications', { control: 'worksCommercialTerms' }),
        field('works.financialCapacityEvidence', 'Financial capacity and bank statement evidence', 'file', 'financial', 'attachment', 'FINANCIAL', true, 'works.financialCapacityEvidence', { documentType: 'FINANCIAL_CAPACITY_EVIDENCE', prompt: 'Upload bank statements or financial capacity evidence.' }),
        field('works.commercial.bidSecuritySubmitted', 'Bid security submitted, if required by this tender.', 'boolean', 'financial', 'boolean', 'FINANCIAL', false, 'works.commercial.bidSecuritySubmitted', { control: 'worksCommercialTerms' }),
        field('works.commercial.bidSecurityDocument', 'Bid security document', 'file', 'financial', 'attachment', 'FINANCIAL', false, 'works.commercial.bidSecurityDocument', { documentType: 'FINANCIAL_BID_SECURITY_DOCUMENT', control: 'worksCommercialTerms' })
      ]),
      step('worksReview', 'Review Submission', 'COMBINED', [field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete')]),
      step('worksDeclaration', 'Declaration and Submission', 'COMBINED', worksDeclarationFields())
    ]
  });
}
function worksDeclarationFields(): BidSubmissionSchemaFieldDto[] {
  return [
    field('works.declaration.signatoryName', 'Authorized Signatory Name', 'text', 'declarations', 'text', 'COMBINED', true, 'works.declaration.signatoryName', { control: 'worksDeclaration' }),
    field('works.declaration.position', 'Position', 'text', 'declarations', 'text', 'COMBINED', true, 'works.declaration.position', { control: 'worksDeclaration' }),
    field('works.declaration.companyStamp', 'Company stamp upload', 'file', 'declarations', 'attachment', 'COMBINED', false, 'works.declaration.companyStamp', { control: 'worksDeclaration', accept: '.pdf,.jpg,.jpeg,.png', documentType: 'DECLARATION_COMPANY_STAMP' }),
    field('works.declaration.digitalSignature', 'Digital Signature', 'text', 'declarations', 'text', 'COMBINED', true, 'works.declaration.digitalSignature', { control: 'worksDeclaration', placeholder: 'Type authorized digital signature' }),
    field('works.declaration.final', 'I confirm this works bid is complete, accurate, and authorized.', 'boolean', 'declarations', 'declaration', 'COMBINED', true, 'works.declaration.final', { control: 'worksDeclaration' }),
    field('works.declaration.conflict', 'I declare no conflict of interest.', 'boolean', 'declarations', 'declaration', 'COMBINED', true, 'works.declaration.conflict', { control: 'worksDeclaration' }),
    field('works.declaration.antiCorruption', 'I accept anti-corruption declarations.', 'boolean', 'declarations', 'declaration', 'COMBINED', true, 'works.declaration.antiCorruption', { control: 'worksDeclaration' })
  ];
}

function step(id: BidSubmissionStepId, label: string, envelope: BidDocumentEnvelope, fields: BidSubmissionSchemaFieldDto[]): BidSubmissionSchemaStepDto {
  return { id, label, envelope, required: fields.some((item) => item.required), fields };
}

function field(
  id: string,
  label: string,
  type: BidSubmissionSchemaFieldDto['type'],
  section: BidSubmissionSection,
  responseType: BidSubmissionSchemaFieldDto['responseType'],
  envelope: BidDocumentEnvelope,
  required: boolean,
  requirementKey = id,
  validation: Record<string, unknown> = {}
): BidSubmissionSchemaFieldDto {
  return {
    id,
    requirementKey,
    label,
    type,
    section,
    required,
    responseType,
    envelope,
    source: section,
    validation
  };
}
function tenderDetail(patch: Partial<TenderDetail> = {}): TenderDetail {
  return {
    id: 'tender-1',
    reference: 'PX-2026-001',
    title: 'Supply of laptops',
    organization: 'Buyer Org',
    ownerOrganization: 'Buyer Org',
    type: 'GOODS',
    category: 'ICT Equipment',
    categories: ['ICT Equipment'],
    status: 'OPEN',
    budget: 250000000,
    currency: 'TZS',
    closingDate: '2099-09-15T10:00:00.000Z',
    location: 'Dar es Salaam',
    description: 'Supply of laptop computers',
    createdByCurrentUser: false,
    ownedByCurrentOrganization: false,
    canBid: true,
    hasDraftBid: false,
    hasSubmittedBid: false,
    isSaved: false,
    visibility: 'PUBLIC_MARKETPLACE',
    publishedAt: '2026-07-01T08:00:00.000Z',
    requirements: {},
    requirementRows: [],
    milestones: [],
    commercialItems: [{ id: 'line-1', itemNo: '1', description: 'Laptop', quantity: 1, unit: 'Each', rate: 2500000, total: 2500000, payload: {} }],
    documents: [],
    bidSummary: { total: 0, draft: 0, submitted: 0, withdrawn: 0 },
    currentBid: null,
    ...patch
  };
}

function tenderDetailWithSamples(patch: Partial<TenderDetail> = {}): TenderDetail {
  return tenderDetail({
    requirements: {
      summary: { requireSamples: 'Yes' },
      goods: {
        fields: {
          sampleRequirementRows: [
            {
              id: 'sample-req-1',
              relatedBoqItemId: 'line-1',
              sampleRequired: true,
              numberOfSamples: '2',
              sampleDescription: 'Laptop sample',
              deliveryLocation: 'PMU office',
              deliveryDeadline: '2099-09-01',
              mandatory: true
            }
          ]
        }
      }
    },
    ...patch
  });
}

function bidDto(patch: Partial<BidDto> = {}): BidDto {
  return {
    id: 'bid-1',
    tenderId: 'tender-1',
    tenderReference: 'PX-2026-001',
    tenderTitle: 'Supply of laptops',
    buyerOrgId: 'buyer-1',
    buyerName: 'Buyer Org',
    supplierOrgId: 'supplier-1',
    supplierName: 'Supplier Org',
    reference: 'PX-BID-2026-000001',
    status: 'DRAFT',
    submittedAt: null,
    totalAmount: 0,
    currency: 'TZS',
    payload: {},
    responses: [],
    documents: [],
    receipt: null,
    createdAt: '2026-07-09T10:00:00.000Z',
    updatedAt: '2026-07-09T10:00:00.000Z',
    ...patch
  };
}

function sampleDto(patch: Partial<BidSampleDto> = {}): BidSampleDto {
  return {
    id: 'sample-1',
    bidId: 'bid-1',
    tenderId: 'tender-1',
    supplierOrgId: 'supplier-1',
    sampleName: 'Laptop sample',
    relatedItem: 'line-1',
    quantity: 2,
    deliveryLocation: 'PMU office',
    deliveryDeadline: null,
    trackingStatus: 'PENDING_SUBMISSION',
    courier: 'DHL',
    trackingNumber: 'DHL-123',
    submittedAt: null,
    receivedAt: null,
    inspectedAt: null,
    inspectionNotes: null,
    metadata: {},
    createdAt: '2026-07-09T10:00:00.000Z',
    updatedAt: '2026-07-09T10:00:00.000Z',
    ...patch
  };
}
