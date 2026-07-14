import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotificationToastHost } from '@/features/notifications/NotificationToastHost';
import notificationsReducer, { enqueueNotification } from '@/features/notifications/slice';
import { useTenderDetail } from '@/features/procurement/hooks';
import type { TenderDetail } from '@/features/procurement/types';
import { biddingApi } from '../../api';
import type { BidDocumentEnvelope, BidDto, BidSampleDto, BidSubmissionSchemaDto, BidSubmissionSchemaFieldDto, BidSubmissionSection, BidSubmissionSchemaStepDto, BidSubmissionStepId } from '../../types';
import { BiddingWorkspaceProcurexPage } from './BiddingWorkspaceProcurexPage';

vi.mock('@/features/procurement/hooks', () => ({
  useTenderDetail: vi.fn()
}));

function renderWorkspaceWithNotifications() {
  const store = configureStore({ reducer: { notifications: notificationsReducer } });
  const view = render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
        <NotificationToastHost />
      </MemoryRouter>
    </Provider>
  );
  return { ...view, store };
}

describe('BiddingWorkspaceProcurexPage document upload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
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
    expect(savedPayload.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementKey: 'productCompliance'
        })
      ])
    );
    expect(savedPayload.documents).toEqual([
      expect.objectContaining({
        name: 'technical.pdf',
        documentType: 'TECHNICAL_PRODUCT_BROCHURES',
        envelope: 'TECHNICAL',
        checksum: 'a'.repeat(64),
        metadata: expect.objectContaining({ requirementKey: 'goods-technical', storage: 'local-dev' })
      })
    ]);
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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    const uploadInput = screen
      .getByText('Eligibility and administrative evidence')
      .closest('label')
      ?.querySelector('input[type="file"]') as HTMLInputElement | null;

    fireEvent.change(uploadInput!, { target: { files: [new File(['bad'], 'bad.exe', { type: 'application/x-msdownload' })] } });

    expect(await screen.findByText('Document upload failed.')).toBeInTheDocument();
    expect(screen.queryByText('Unsupported bid document file type.')).not.toBeInTheDocument();
  });
});

describe('BiddingWorkspaceProcurexPage sample tracking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
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

  it.each([
    ['goods', tenderDetail(), ['Eligibility and Document Requirements', 'Technical Response', 'Quantity Schedule / Financial Offer', 'Review Submission', 'Supplier Declaration and Submit']],
    ['goods samples', tenderDetailWithSamples(), ['Eligibility and Document Requirements', 'Technical Response', 'Quantity Schedule / Financial Offer', 'Sample Submission', 'Review Submission', 'Supplier Declaration and Submit']],
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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    expect(progressStepLabels()).toEqual(expected);
  });

  it('shows only one active new-bid notice when the same bid notice is replayed', async () => {
    const { store } = renderWorkspaceWithNotifications();

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    const page = container.querySelector('.journey-page.tender-wizard-page.bid-flow-page');
    expect(page).toBeInTheDocument();
    expect(container.querySelector('.procurement-market-summary')).not.toBeInTheDocument();
    expect(container.querySelector('.kpi-card')).not.toBeInTheDocument();

    const heroActions = container.querySelector('.hero-action-stack');
    expect(heroActions).toBeInTheDocument();
    expect(within(heroActions as HTMLElement).getByText('View Tender Details')).toBeInTheDocument();
    expect(within(heroActions as HTMLElement).getByText('Ask Buyer')).toBeInTheDocument();
    expect(within(heroActions as HTMLElement).getByText('Save Draft')).toBeInTheDocument();
    expect(within(heroActions as HTMLElement).getByText('Review Submission')).toBeInTheDocument();

    expect(container.querySelector('.bid-assistance-panel')).not.toBeInTheDocument();
    expect(container.querySelector('.bid-command-bar')).not.toBeInTheDocument();

    const progressButtons = within(screen.getByRole('navigation', { name: 'Bid submission progress' })).getAllByRole('button');
    expect(progressButtons[0]).toHaveClass('wizard-progress-step', 'active');
    expect(within(progressButtons[0]).getByText('01')).toBeInTheDocument();
    expect(within(progressButtons[0]).getByText('Eligibility and Document Requirements')).toBeInTheDocument();

    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(progressButtons[0]).toHaveClass('completed');
    expect(progressButtons[1]).toHaveClass('wizard-progress-step', 'active');
  });

  it('blocks Continue and forward step navigation until the mandatory gate is complete', async () => {
    const notices: Array<Record<string, unknown>> = [];
    const listener = (event: Event) => notices.push((event as CustomEvent<Record<string, unknown>>).detail);
    window.addEventListener('procurex:notify', listener);
    const { container } = renderWorkspaceWithNotifications();

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
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
            message: expect.stringMatching(/Complete all mandatory eligibility requirements before continuing.*Incomplete: Confirm eligibility to participate \(Confirmation\)/i)
          })
        ])
      )
    );
    expect(container.querySelector('.form-status')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: /Technical Response/i })[0]);
    expect(screen.getByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();

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
          step('goodsTechnical', 'Technical Response', 'TECHNICAL', [field('technical.productCompliance', 'Product compliance statement', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'productCompliance')])
        ]
      })
    );
    const { container } = renderWorkspaceWithNotifications();

    expect(await screen.findByText('Required field')).toBeInTheDocument();
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
          step('goodsTechnical', 'Technical Response', 'TECHNICAL', [field('technical.productCompliance', 'Product compliance statement', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'productCompliance')]),
          step('goodsReview', 'Review Submission', 'COMBINED', [field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete')])
        ]
      })
    );

    const { container } = renderWorkspaceWithNotifications();

    expect(await screen.findByText('Eligibility and document requirements')).toBeInTheDocument();
    expect(screen.getByText('1. Licenses and certifications')).toBeInTheDocument();
    expect(screen.getByText('Regulatory license evidence')).toBeInTheDocument();
    expect(screen.getByText('Shipping Agency License')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Permit / license' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Evidence' })).toBeInTheDocument();
    expect(screen.getByLabelText('Shipping Agency License status')).toBeInTheDocument();
    expect(screen.getByText('Bid submission documents')).toBeInTheDocument();
    expect(screen.getByText('Signed bid submission form')).toBeInTheDocument();
    expect(screen.getByText('Other administrative supporting documents')).toBeInTheDocument();
    expect(screen.getByText('Eligibility and administrative evidence')).toBeInTheDocument();
    expect(screen.getByText('4. Eligibility declarations/confirmations')).toBeInTheDocument();
    expect(screen.getByText('Administrative confirmations')).toBeInTheDocument();
    expect(screen.getAllByText('Administrative compliance').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Confirm eligibility to participate')).toBeInTheDocument();
    expect(screen.queryByText('Confirm authorized representative')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm similar project evidence')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm that similar completed project evidence is completed in the technical capacity response.')).not.toBeInTheDocument();
    expect(screen.getAllByText('I confirm and accept this requirement.').length).toBeGreaterThanOrEqual(1);
    expect(container.querySelectorAll('.bid-gate-group').length).toBeGreaterThanOrEqual(4);
    expect(container.querySelectorAll('.bid-requirement-card').length).toBeGreaterThanOrEqual(1);
  });

  it('uses the hero Review Submission action as a jump to the review step', async () => {
    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Review Submission' })[0]);

    expect(screen.getByRole('heading', { name: 'Review Submission' })).toBeInTheDocument();
    expect(biddingApi.submitBid).not.toHaveBeenCalled();
  });

  it('renders BOQ rows in the financial offer and saves entered rates by requirement key', async () => {
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(screen.getByLabelText('Product compliance statement'), { target: { value: 'Compliant laptop specification.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Quantity Schedule / Financial Offer' })).toBeInTheDocument();
    const boqTable = screen.getByRole('table');
    expect(boqTable).toHaveClass('bid-financial-boq-table');
    expect(screen.getByText('BOQ pricing schedule')).toBeInTheDocument();
    expect(within(boqTable).getByText('Laptop')).toBeInTheDocument();
    expect(within(boqTable).getByText('Each')).toBeInTheDocument();
    expect(within(boqTable).queryByText('Response for Financial')).not.toBeInTheDocument();
    const standaloneFinancialInput = screen.getByText('Response for Financial').closest('label')?.querySelector('input') as HTMLInputElement | null;
    expect(standaloneFinancialInput).toBeInTheDocument();
    expect(screen.queryByText('Quoted unit price')).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Rate for Laptop'), { target: { value: '2500000' } });
    fireEvent.change(standaloneFinancialInput!, { target: { value: '85' } });

    expect(screen.getAllByText('TZS 2,500,000').length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);

    await waitFor(() => expect(biddingApi.saveTenderDraft).toHaveBeenCalled());
    const savedPayload = vi.mocked(biddingApi.saveTenderDraft).mock.calls[0][1];
    expect(savedPayload.responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementKey: 'unitRate',
          response: { value: 2500000 }
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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Tenderer template')).toBeInTheDocument();
    expect(screen.getByText('Download CSV response template')).toBeInTheDocument();
    expect(screen.getByText('Need clarification about product specifications?')).toBeInTheDocument();
    expect(container.querySelector('.goods-compliance-card')).toBeInTheDocument();
    expect(container.querySelector('.premium-response-matrix')).not.toBeInTheDocument();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Laptop' })).toBeInTheDocument();
    expect(screen.getByText('Processor: Core i7 / RAM: 16GB / Storage: 512GB SSD')).toBeInTheDocument();
    expect(screen.queryByText(/0934e352-111f-443f-8877-63477037937e/i)).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Product specification response - Laptop Compliance'), { target: { value: 'Compliant' } });
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
              complianceStatus: 'Compliant',
              offeredSpecification: 'Core i7, 16GB RAM, 512GB SSD',
              evidenceReference: 'brochure.pdf',
              deviations: 'No deviations.'
            })
          }
        })
      ])
    );
  });

  it('imports goods technical response CSV rows by requirement key', async () => {
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

    expect(await screen.findByText('Confirm eligibility to participate')).toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const csv = [
      'requirementKey,fieldId,itemNo,requestedProduct,buyerSpecification,complianceStatus,offeredSpecification,evidenceReference,deviations',
      'goods.productSpecification.line-1,technical.productSpec.line1,1,Laptop,Core i7 laptop,Compliant,"Core i7, 16GB RAM",catalogue.pdf,None'
    ].join('\n');
    const importInput = screen.getByLabelText('Import goods technical response CSV') as HTMLInputElement;
    fireEvent.change(importInput, { target: { files: [new File([csv], 'goods-response.csv', { type: 'text/csv' })] } });

    await waitFor(() => expect(screen.getByLabelText('Product specification response - Laptop Supplier offered specification')).toHaveValue('Core i7, 16GB RAM'));
    expect(screen.getByLabelText('Product specification response - Laptop Compliance')).toHaveValue('Compliant');
    expect(screen.getByLabelText('Product specification response - Laptop Evidence / attachment reference')).toHaveValue('catalogue.pdf');
    expect(screen.getByLabelText('Product specification response - Laptop Deviations / comments')).toHaveValue('None');
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
    vi.spyOn(biddingApi, 'uploadDocuments').mockResolvedValue(bidDto());

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Confirm eligibility to participate')).toBeInTheDocument();
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
            field('works.capacityNarrative', 'Capacity narrative', 'textarea', 'technical', 'text', 'TECHNICAL', false, 'works.capacityNarrative')
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
            })
          ]),
          step('worksReview', 'Review Submission', 'COMBINED', [field('review.confirmComplete', 'Confirm the bid is complete and ready for submission', 'boolean', 'review', 'acknowledgement', 'COMBINED', true, 'review.confirmComplete')]),
          step('worksDeclaration', 'Declaration and Submission', 'COMBINED', worksDeclarationFields())
        ]
      })
    );
    vi.spyOn(biddingApi, 'saveTenderDraft').mockResolvedValue(bidDto());

    const { container } = renderWorkspaceWithNotifications();

    expect(await screen.findByText('Eligibility and document requirements')).toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Technical Capacity and Experience' })).toBeInTheDocument();
    expect(screen.getByText('Similar completed projects')).toBeInTheDocument();
    expect(screen.getByText('Key personnel')).toBeInTheDocument();
    expect(screen.getByText('Equipment capacity')).toBeInTheDocument();
    expect(screen.getByText('Health, Safety and Environmental Response')).toBeInTheDocument();
    expect(screen.getByText('Additional capacity responses')).toBeInTheDocument();
    expect(container.querySelector('.works-capacity-workbook')).toBeInTheDocument();
    expect(container.querySelector('.works-capacity-card')).toBeInTheDocument();
    expect(container.querySelector('.works-person-card')).toBeInTheDocument();
    expect(container.querySelector('.works-person-avatar')).toBeInTheDocument();
    expect(container.querySelector('.works-equipment-table')).toBeInTheDocument();
    expect(screen.getByText('Upload Similar project document')).toBeInTheDocument();
    expect(screen.getByText('CV upload')).toBeInTheDocument();
    expect(screen.getByText('Upload Lease / access agreement')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Project / client'), { target: { value: 'Rural distribution network' } });
    fireEvent.change(screen.getByLabelText('Personnel Position'), { target: { value: 'Site engineer' } });
    fireEvent.change(screen.getByLabelText('Quantity available for Excavator'), { target: { value: '3' } });
    fireEvent.change(screen.getByLabelText('Ownership status for Excavator'), { target: { value: 'Owned' } });
    fireEvent.change(screen.getByLabelText('HSE policy response'), { target: { value: 'HSE plan available with safety officer assigned.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Technical Capacity and Experience' })).toBeInTheDocument();
    const blockerNotice = await screen.findByRole('alert');
    expect(blockerNotice).toHaveClass('presentation-bidNotice');
    expect(blockerNotice).toHaveTextContent('Notice');
    expect(blockerNotice).toHaveTextContent(/Complete 3 required responses in this section before continuing/i);
    expect(blockerNotice).toHaveTextContent(/First incomplete: Similar completed project evidence/i);
    expect(container.querySelector('.form-status')).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);

    await waitFor(() => expect(biddingApi.saveTenderDraft).toHaveBeenCalled());
    expect(vi.mocked(biddingApi.saveTenderDraft).mock.calls[0][1].responses).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          requirementKey: 'works.similarProjects',
          response: { value: expect.objectContaining({ projectName: 'Rural distribution network' }) }
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
          response: { value: 'HSE plan available with safety officer assigned.' }
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

    expect(await screen.findByText('Eligibility and document requirements')).toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const similarInput = screen.getByText('Upload Similar project document').closest('label')?.querySelector('input[type="file"]') as HTMLInputElement | null;
    const personnelInput = screen.getByText('CV upload').closest('label')?.querySelector('input[type="file"]') as HTMLInputElement | null;
    const equipmentInput = screen.getByText('Upload Lease / access agreement').closest('label')?.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(similarInput).not.toBeNull();
    expect(personnelInput).not.toBeNull();
    expect(equipmentInput).not.toBeNull();

    const projectEvidence = new File(['project reference'], 'project-reference.pdf', { type: 'application/pdf' });
    const cvEvidence = new File(['cv'], 'site-engineer-cv.pdf', { type: 'application/pdf' });
    const equipmentEvidence = new File(['lease'], 'excavator-lease.pdf', { type: 'application/pdf' });
    fireEvent.change(similarInput!, { target: { files: [projectEvidence] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(1));
    fireEvent.change(personnelInput!, { target: { files: [cvEvidence] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(2));
    fireEvent.change(equipmentInput!, { target: { files: [equipmentEvidence] } });
    await waitFor(() => expect(biddingApi.uploadDocuments).toHaveBeenCalledTimes(3));

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

    expect(await screen.findByText('Eligibility and document requirements')).toBeInTheDocument();
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

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Eligibility and document requirements')).toBeInTheDocument();
    completeGate();
    openProgressStep('Financial Proposal / BOQ Pricing');

    expect(screen.getByRole('table', { name: 'Editable financial offer review table' })).toBeInTheDocument();
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

    expect(await screen.findByText('Eligibility and document requirements')).toBeInTheDocument();
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
    await waitFor(() => expect(biddingApi.submitBid).not.toHaveBeenCalled());
    expect(screen.getByText(/Complete required sections before submitting:/)).toBeInTheDocument();

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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getAllByRole('button', { name: 'Review Submission' })[0]);

    expect(screen.getByText('Supplier Bid Submission Review')).toBeInTheDocument();
    const reviewDocument = document.querySelector('.bid-response-document') as HTMLElement;
    expect(reviewDocument).toBeInTheDocument();
    expect(within(reviewDocument).getByText('Eligibility and Document Requirements')).toBeInTheDocument();
    expect(within(reviewDocument).getByText('Technical Response')).toBeInTheDocument();
    expect(within(reviewDocument).getByText('Quantity Schedule / Financial Offer')).toBeInTheDocument();
    expect(within(reviewDocument).getByText('Supplier Declaration and Submit')).toBeInTheDocument();
    expect(screen.getAllByText('Complete').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Missing').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Replace file' }).length).toBeGreaterThan(0);
  });

  it('uses review Change actions to navigate back to the editable technical source field', async () => {
    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Review Submission' })[0]);

    const productRow = screen.getByText('Product compliance statement').closest('tr') as HTMLTableRowElement;
    fireEvent.click(within(productRow).getByRole('button', { name: 'Change' }));

    expect(screen.getByRole('heading', { name: 'Technical Response' })).toBeInTheDocument();
    expect(screen.getByLabelText('Product compliance statement')).toBeInTheDocument();
    expect(screen.getByText('Jumped to the source field. Update it, then return to Review Submission.')).toBeInTheDocument();
  });

  it('renders submitted bid review rows as read-only without edit buttons', async () => {
    vi.mocked(biddingApi.getTenderDraft).mockResolvedValue(bidDto({ status: 'SUBMITTED', submittedAt: '2026-07-09T10:00:00.000Z' }));

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: /Review Submission/i })[0]);

    expect(screen.getByText('Supplier Bid Submission Review')).toBeInTheDocument();
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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    expect(progressStepLabels()).toContain('Supplier Declaration and Submit');
    fireEvent.click(screen.getAllByRole('button', { name: 'Review Submission' })[0]);

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Ready to seal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Sealed Bid' })).toBeInTheDocument();
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
        technical: { productCompliance: 'Compliant product response.' },
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

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Review Submission' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    checkCard('I confirm the bid is accurate and complete');
    checkCard('I accept the tender and contract terms');
    fireEvent.click(screen.getByRole('button', { name: 'Submit Sealed Bid' }));

    expect(await screen.findByText('Bid submitted successfully')).toBeInTheDocument();
    expect(screen.getByText('hash-1')).toBeInTheDocument();
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
    'Confirm mandatory documents are attached'
  ].forEach(checkCard);
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
  const checkbox = screen
    .getAllByText(label)
    .map((element) => {
      const compactCard = element.closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      if (compactCard) return compactCard;
      return element.closest('article')?.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    })
    .find(Boolean);
  if (!checkbox) throw new Error(`Checkbox not found for ${label}`);
  if (!checkbox.checked) fireEvent.click(checkbox);
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
    field('technical.productCompliance', 'Product compliance statement', 'textarea', 'technical', 'text', 'TECHNICAL', true, 'productCompliance'),
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
        field('works.capacityNarrative', 'Capacity narrative', 'textarea', 'technical', 'text', 'TECHNICAL', false, 'works.capacityNarrative')
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
