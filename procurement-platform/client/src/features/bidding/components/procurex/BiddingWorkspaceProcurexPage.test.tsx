import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTenderDetail } from '@/features/procurement/hooks';
import type { TenderDetail } from '@/features/procurement/types';
import { biddingApi } from '../../api';
import type { BidDto, BidSampleDto } from '../../types';
import { BiddingWorkspaceProcurexPage } from './BiddingWorkspaceProcurexPage';

vi.mock('@/features/procurement/hooks', () => ({
  useTenderDetail: vi.fn()
}));

describe('BiddingWorkspaceProcurexPage document upload', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
          documentType: 'TECHNICAL_PRODUCT_SPEC',
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
    const uploadInput = screen
      .getByText('Product brochures, catalogues, and specification evidence')
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
      documentType: 'TECHNICAL_PRODUCT_SPEC',
      envelope: 'TECHNICAL',
      metadata: { requirementKey: 'goods-technical' }
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Save Draft' })[0]);
    await waitFor(() => expect(biddingApi.updateBid).toHaveBeenCalled());
    const savedPayload = vi.mocked(biddingApi.updateBid).mock.calls[0][1];
    expect(savedPayload.technical).toEqual(
      expect.objectContaining({
        productCompliance: expect.any(String),
        approach: expect.any(String),
        deliveryPlan: expect.any(String)
      })
    );
    expect(savedPayload.documents).toEqual([
      expect.objectContaining({
        name: 'technical.pdf',
        documentType: 'TECHNICAL_PRODUCT_SPEC',
        envelope: 'TECHNICAL',
        checksum: 'a'.repeat(64),
        metadata: expect.objectContaining({ requirementKey: 'goods-technical', storage: 'local-dev' })
      })
    ]);
    expect(savedPayload.documents[0]).not.toBeInstanceOf(File);
  });

  it('displays backend upload validation messages', async () => {
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

    expect(await screen.findByText('Unsupported bid document file type.')).toBeInTheDocument();
  });
});

describe('BiddingWorkspaceProcurexPage sample tracking', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    expect(screen.queryByRole('button', { name: /Samples/i })).not.toBeInTheDocument();
  });

  it('shows the sample step when tender requirements require samples', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetailWithSamples(),
      status: 'success',
      isLoading: false,
      isError: false
    });
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(null);

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    completeGate();
    expect(screen.getAllByRole('button', { name: /Samples/i })[0]).toBeInTheDocument();
  });

  it('creates a draft before adding the first sample record', async () => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tenderDetailWithSamples(),
      status: 'success',
      isLoading: false,
      isError: false
    });
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
    fireEvent.click(screen.getAllByRole('button', { name: /Samples/i })[0]);
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
    fireEvent.click(screen.getAllByRole('button', { name: /Samples/i })[0]);

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
    vi.spyOn(biddingApi, 'getTenderDraft').mockResolvedValue(bidDto({ status: 'SUBMITTED', submittedAt: '2026-07-09T10:00:00.000Z' }));
    vi.spyOn(biddingApi, 'listSamples').mockResolvedValue([sampleDto()]);

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(biddingApi.listSamples).toHaveBeenCalledWith('bid-1'));
    fireEvent.click(screen.getAllByRole('button', { name: /Samples/i })[0]);

    expect(screen.getByLabelText('Sample name for Laptop sample')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Add sample record' })).toBeDisabled();
  });
});

describe('BiddingWorkspaceProcurexPage procurex-ui flow parity', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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
    ['goods samples', tenderDetailWithSamples(), ['Eligibility and Document Requirements', 'Technical Response', 'Quantity Schedule / Financial Offer', 'Samples', 'Review Submission', 'Supplier Declaration and Submit']],
    ['works', tenderDetail({ type: 'WORKS' }), ['Eligibility and Document Requirements', 'Technical Capacity', 'Technical Proposal', 'Financial Proposal / BOQ Pricing', 'Review Submission', 'Declaration and Submission']],
    ['services', tenderDetail({ type: 'SERVICE' }), ['Eligibility and Document Requirements', 'Methodology', 'Delivery Plan', 'Staffing, Capacity and Continuity Plan', 'SLA and Reporting', 'Commercial Pricing', 'Review Submission']],
    ['consultancy', tenderDetail({ type: 'CONSULTANCY' }), ['Eligibility and Document Requirements', 'Technical Proposal', 'Financial Proposal', 'Review and Submit']],
    ['generic', tenderDetail({ type: undefined }), ['Eligibility and Document Requirements', 'Dynamic Responses', 'Financial Offer', 'Review Submission', 'Receipt']]
  ])('renders exact %s step order', async (_name, tender, expected) => {
    vi.mocked(useTenderDetail).mockReturnValue({
      data: tender,
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
    expect(progressStepLabels()).toEqual(expected);
  });

  it('uses procurex-ui visual shell, assistance panel, and progress step markup', async () => {
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

    const assistance = container.querySelector('.bid-assistance-panel');
    expect(assistance).toBeInTheDocument();
    expect(within(assistance as HTMLElement).getByText('Bid Assistance')).toBeInTheDocument();
    expect(within(assistance as HTMLElement).getByRole('link', { name: 'View Tender Details' })).toBeInTheDocument();
    expect(within(assistance as HTMLElement).getByRole('link', { name: 'Ask Clarification' })).toBeInTheDocument();
    expect(within(assistance as HTMLElement).getByRole('button', { name: 'Save Draft' })).toBeInTheDocument();
    expect(within(assistance as HTMLElement).getByRole('button', { name: 'Review Submission' })).toBeInTheDocument();

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
    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
    expect(screen.getAllByText(/unlock the bid workflow/i).length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByRole('button', { name: /Technical Response/i })[0]);
    expect(screen.getByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();

    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('heading', { name: 'Technical Response' })).toBeInTheDocument();
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
    expect(progressStepLabels()).not.toContain('Declaration and Submit');
    fireEvent.click(screen.getAllByRole('button', { name: 'Review Submission' })[0]);

    expect(screen.getByText('Ready to seal')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Sealed Bid' })).toBeInTheDocument();
  });

  it('renders receipt in the final panel after successful submit', async () => {
    const draft = bidDto({
      payload: {
        administrative: { eligible: true, taxCompliant: true, authorized: true, documentsConfirmed: true },
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
    'Confirm authorized representative',
    'Confirm mandatory documents are attached'
  ].forEach(checkCard);
}

function checkCard(label: string) {
  const checkbox = screen
    .getAllByText(label)
    .map((element) => element.closest('label')?.querySelector('input[type="checkbox"]') as HTMLInputElement | null)
    .find(Boolean);
  if (!checkbox) throw new Error(`Checkbox not found for ${label}`);
  if (!checkbox.checked) fireEvent.click(checkbox);
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
