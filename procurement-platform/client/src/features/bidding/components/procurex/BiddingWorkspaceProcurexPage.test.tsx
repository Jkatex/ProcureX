import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useTenderDetail } from '@/features/procurement/hooks';
import type { TenderDetail } from '@/features/procurement/types';
import { biddingApi } from '../../api';
import type { BidDocumentEnvelope, BidDto, BidSampleDto, BidSubmissionSchemaDto, BidSubmissionSchemaFieldDto, BidSubmissionSection, BidSubmissionSchemaStepDto, BidSubmissionStepId } from '../../types';
import { BiddingWorkspaceProcurexPage } from './BiddingWorkspaceProcurexPage';

vi.mock('@/features/procurement/hooks', () => ({
  useTenderDetail: vi.fn()
}));

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
      documentType: 'TECHNICAL_PRODUCT_BROCHURES',
      envelope: 'TECHNICAL',
      metadata: { requirementKey: 'goods-technical', requirementLabel: 'Product brochures, catalogues, and specification evidence', source: 'bid-workspace' }
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
    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByRole('heading', { name: 'Eligibility and Document Requirements' })).toBeInTheDocument();
    expect(screen.getAllByText(/Complete required tender fields before continuing/i).length).toBeGreaterThan(0);

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

  it('renders ProcureX structured product specification matrices and saves structured responses', async () => {
    vi.mocked(biddingApi.getTenderSchema).mockResolvedValue(
      bidSchema({
        steps: [
          step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
            field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible'),
            field('administrative.taxCompliant', 'Confirm tax and statutory compliance', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'taxCompliant'),
            field('administrative.authorized', 'Confirm authorized representative', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'authorized'),
            field('administrative.documentsConfirmed', 'Confirm mandatory documents are attached', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'documentsConfirmed'),
            field('administrative.eligibilityDocument', 'Eligibility and administrative evidence', 'file', 'administrative', 'attachment', 'ADMINISTRATIVE', false, 'eligibility', { documentType: 'ADMINISTRATIVE_EVIDENCE' })
          ]),
          step('technical', 'Technical Response', 'TECHNICAL', [
            field('technical.productSpec.line1', 'Product specification response - Laptop', 'table', 'technical', 'structured', 'TECHNICAL', true, 'goods.productSpecification.line-1', {
              control: 'goodsProductSpecification',
              rowIndex: 1,
              prompt: 'Processor: Core i7 / RAM: 16GB / Storage: 512GB SSD'
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

    render(
      <MemoryRouter initialEntries={['/bidding?tenderId=tender-1']}>
        <BiddingWorkspaceProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('Eligibility and administrative evidence')).toBeInTheDocument();
    completeGate();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(screen.getByText('Product specification compliance response')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Product specification response - Laptop Compliance'), { target: { value: 'Compliant' } });
    fireEvent.change(screen.getByLabelText('Product specification response - Laptop Supplier offered specification'), { target: { value: 'Core i7, 16GB RAM, 512GB SSD' } });
    fireEvent.change(screen.getByLabelText('Product specification response - Laptop Evidence / attachment reference'), { target: { value: 'brochure.pdf' } });
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
              evidenceReference: 'brochure.pdf'
            })
          }
        })
      ])
    );
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

function bidSchema(options: { tenderType?: string; withSamples?: boolean; steps?: BidSubmissionSchemaStepDto[] } = {}): BidSubmissionSchemaDto {
  const { tenderType = 'GOODS', withSamples = false } = options;
  const administrative = step('administrative', 'Eligibility and Document Requirements', 'ADMINISTRATIVE', [
    field('administrative.eligible', 'Confirm eligibility to participate', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'eligible'),
    field('administrative.taxCompliant', 'Confirm tax and statutory compliance', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'taxCompliant'),
    field('administrative.authorized', 'Confirm authorized representative', 'boolean', 'administrative', 'acknowledgement', 'ADMINISTRATIVE', true, 'authorized'),
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
          step('worksDeclaration', 'Declaration and Submission', 'COMBINED', declarations)
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
