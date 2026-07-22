/* Exercises procurement behavior so regressions are caught close to the domain workflow they protect. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/http';
import { procurementApi } from '../../api';
import type { TenderDetail } from '../../types';
import { TenderDetailsProcurexPage } from './TenderDetailsProcurexPage';

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

vi.mock('html2pdf.js', () => ({
  default: html2PdfMock.factory
}));

const buyerTender: TenderDetail = {
  id: 'tender-1',
  reference: 'PX-2026-001',
  title: 'Supply of medical equipment',
  organization: 'Medical Stores Department',
  ownerOrganization: 'Medical Stores Department',
  type: 'GOODS',
  category: 'Medical Equipment',
  categories: ['Medical Equipment'],
  status: 'OPEN',
  budget: 250000000,
  currency: 'TZS',
  closingDate: '2099-08-30',
  location: 'Dar es Salaam',
  description: 'Diagnostic equipment package',
  createdByCurrentUser: true,
  ownedByCurrentOrganization: true,
  canBid: false,
  hasDraftBid: false,
  hasSubmittedBid: false,
  isSaved: false,
  visibility: 'PUBLIC_MARKETPLACE',
  publishedAt: '2026-07-01T08:00:00.000Z',
  requirements: {
    deliveryRequirements: ['Deliver to buyer stores'],
    eligibilityRequirements: [{ requirementName: 'Tax clearance required', mandatory: true }],
    evaluationCriteria: [{ criterion: 'Technical responsiveness', weight: 70 }],
    submissionInstructions: 'Submit through the ProcureX bidding workspace'
  },
  metadata: {
    serviceRequirements: { slaRequirement: 'Four hour support window' },
    annexes: ['Warranty_Form.pdf']
  },
  requirementRows: [{ id: 'req-1', section: 'Eligibility', payload: { title: 'Tax clearance required' } }],
  milestones: [{ id: 'ms-1', name: 'Site inspection', dueDate: '2099-08-01', payload: { location: 'Buyer stores' } }],
  commercialItems: [{ id: 'line-1', itemNo: '1', description: 'Diagnostic kit', quantity: 2, unit: 'Set', rate: 125000000, total: 250000000, payload: {} }],
  documents: [
    {
      id: 'doc-1',
      name: 'Tender document',
      documentType: 'TENDER_DOCUMENT',
      label: 'Available for review',
      openUrl: '/api/procurement/tenders/tender-1/documents/doc-1/open',
      downloadUrl: '/api/procurement/tenders/tender-1/documents/doc-1/download'
    },
    {
      id: 'doc-2',
      name: 'Pricing schedule',
      documentType: 'PRICE_SCHEDULE',
      label: 'Commercial template',
      downloadUrl: '/api/procurement/tenders/tender-1/documents/doc-2/download'
    }
  ],
  bidSummary: { total: 2, draft: 1, submitted: 1, withdrawn: 0 },
  submittedBidBusinesses: [{ id: 'supplier-1', name: 'Prime Medical Supplies', submittedAt: '2099-08-01T09:00:00.000Z' }],
  clarificationInquiries: [
    {
      id: 'clarification-1',
      senderOrgId: 'supplier-1',
      senderName: 'Prime Medical Supplies',
      subject: 'Site access clarification',
      body: 'Can bidders access the delivery site before final submission?',
      status: 'UNREAD',
      read: false,
      createdAt: '2099-08-01T09:00:00.000Z',
      updatedAt: '2099-08-01T09:00:00.000Z'
    },
    {
      id: 'clarification-2',
      senderOrgId: 'supplier-2',
      senderName: 'Taifa Diagnostics',
      subject: 'Delivery staging clarification',
      body: 'Please confirm whether partial delivery will be accepted.',
      status: 'READ',
      read: true,
      createdAt: '2099-08-02T09:00:00.000Z',
      updatedAt: '2099-08-02T09:00:00.000Z'
    }
  ],
  currentBid: null,
  activity: { marketplaceViews: 12, documentDownloads: 4, clarifications: 0 }
};

const documentCardTender: TenderDetail = {
  ...buyerTender,
  id: 'service-tender-1',
  reference: 'PX-2026-SVC-001',
  title: 'Facilities management services',
  type: 'SERVICE',
  category: 'Non Consultancy',
  categories: ['Non Consultancy']
};

describe('TenderDetailsProcurexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    html2PdfMock.worker.set.mockReturnValue(html2PdfMock.worker);
    html2PdfMock.worker.from.mockReturnValue(html2PdfMock.worker);
    html2PdfMock.worker.outputPdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the procurex-ui style buyer tender detail for backend tenders', async () => {
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(buyerTender);

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=tender-1']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findAllByRole('heading', { name: 'Supply of medical equipment' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Open Document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Document' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Create Amendment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Evaluation' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Procurement details', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tender activity' })).toBeInTheDocument();
    expect(screen.getByLabelText('Goods tender summary')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Goods Details' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product Specifications' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Financial Capacity Requirements' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Eligibility Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evaluation Criteria' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Customer Information' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Diagnostic kit').length).toBeGreaterThan(0);
    expect(screen.getByText('2 Set')).toBeInTheDocument();
    expect(screen.getByText('Tax clearance required')).toBeInTheDocument();
    expect(screen.getByText('Technical responsiveness')).toBeInTheDocument();
    expect(screen.queryByText('Marketplace views')).not.toBeInTheDocument();
    expect(screen.queryByText('Document downloads')).not.toBeInTheDocument();
    expect(screen.queryByText('Time to close')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bid summary' })).not.toBeInTheDocument();
  });

  it('shows buyer tender activity controls without exposing bid details', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(buyerTender);
    const updateBuyerNotice = vi.spyOn(procurementApi, 'updateBuyerNotice')
      .mockResolvedValueOnce({
        success: true,
        message: 'Buyer notice saved successfully',
        data: {
          id: 'tender-1',
          buyerNotice: 'Please review the updated site access instruction.',
          updatedAt: '2099-08-01T10:00:00.000Z'
        }
      })
      .mockResolvedValueOnce({
        success: true,
        message: 'Buyer notice saved successfully',
        data: {
          id: 'tender-1',
          buyerNotice: '',
          updatedAt: '2099-08-01T10:05:00.000Z'
        }
      });

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=tender-1']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('tab', { name: 'Procurement details', selected: true })).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Tender activity' }));

    expect(screen.getByRole('tab', { name: 'Tender activity', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bid summary' })).toBeInTheDocument();
    expect(screen.getByText('Submitted bids')).toBeInTheDocument();
    expect(screen.getByText('Draft bids')).toBeInTheDocument();
    expect(screen.getByText('Days remaining until tender closes')).toBeInTheDocument();
    expect(screen.getByText('Prime Medical Supplies')).toHaveClass('buyer-clarification-sender');
    expect(screen.queryByText(/Submitted 2099/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Withdrawn bids')).not.toBeInTheDocument();
    expect(screen.queryByText('Total bid records')).not.toBeInTheDocument();
    expect(screen.queryByText('No submitted bids yet.')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tender activity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clarification inquiries' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Buyer notice' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Make amendment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cancel tender' })).toBeInTheDocument();
    expect(screen.queryByText(/financial proposal|technical proposal|unit price/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open clarification messages' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Site access clarification/i }).getAttribute('href')).toContain('/communication?view=message&id=clarification-1');
    expect(screen.getByRole('link', { name: /Delivery staging clarification/i }).getAttribute('href')).toContain('/communication?view=message&id=clarification-2');
    expect(screen.getByRole('button', { name: 'Make amendment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel tender' })).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Buyer notice' }), 'Please review the updated site access instruction.');
    await user.click(screen.getByRole('button', { name: 'Save notice' }));

    await waitFor(() => expect(updateBuyerNotice).toHaveBeenCalledWith('tender-1', 'Please review the updated site access instruction.'));
    expect(await screen.findByText('Buyer notice saved for bidders.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove notice' }));

    await waitFor(() => expect(updateBuyerNotice).toHaveBeenCalledWith('tender-1', ''));
    expect(await screen.findByText('Buyer notice removed for bidders.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove notice' })).not.toBeInTheDocument();
  });

  it('downloads a consolidated tender pack PDF from the main buyer action', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(buyerTender);
    const download = mockBrowserDownload();
    const getDocument = vi.spyOn(apiClient, 'get');
    const recordDownload = vi.spyOn(procurementApi, 'recordTenderDocumentDownload');

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=tender-1']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    await screen.findAllByRole('heading', { name: 'Supply of medical equipment' });
    await user.click(screen.getByRole('button', { name: 'Download Document' }));

    expect(getDocument).not.toHaveBeenCalled();
    await waitFor(() => expect(html2PdfMock.worker.set).toHaveBeenCalledWith(expect.objectContaining({ filename: 'Tender_PX-2026-001_Goods.pdf' })));
    expect(pdfSourceText()).toContain('Goods Details');
    expect(pdfSourceText()).toContain('Tax clearance required');
    expect(pdfSourceText()).toContain('Technical responsiveness');
    expect(pdfSourceText()).toContain('Diagnostic kit');
    expect(download.click).toHaveBeenCalled();
    expect(download.downloads.at(-1)).toBe('Tender_PX-2026-001_Goods.pdf');
    expect(download.blobs.at(-1)?.type).toBe('application/pdf');
    expect(recordDownload).not.toHaveBeenCalled();
  });

  it('downloads a generated tender pack PDF when no backend document is attached', async () => {
    const user = userEvent.setup();
    const tenderWithoutDocuments: TenderDetail = { ...buyerTender, documents: [] };
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(tenderWithoutDocuments);
    const download = mockBrowserDownload();
    const getDocument = vi.spyOn(apiClient, 'get');

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=tender-1']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    await screen.findAllByRole('heading', { name: 'Supply of medical equipment' });
    const button = screen.getByRole('button', { name: 'Download Document' });
    expect(button).toBeEnabled();

    await user.click(button);

    expect(getDocument).not.toHaveBeenCalled();
    await waitFor(() => expect(download.downloads.at(-1)).toBe('Tender_PX-2026-001_Goods.pdf'));
    expect(download.blobs.at(-1)?.type).toBe('application/pdf');
  });

  it('downloads the selected document from document cards', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(documentCardTender);
    mockBrowserDownload();
    const getDocument = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      headers: { 'content-disposition': 'attachment; filename="Pricing schedule.xlsx"' }
    });

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=service-tender-1']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    await screen.findByText('Pricing schedule');
    await user.click(screen.getAllByRole('button', { name: 'Download' })[1]);

    expect(getDocument).toHaveBeenCalledWith('/api/procurement/tenders/tender-1/documents/doc-2/download', { responseType: 'blob' });
  });

  it('shows a not-found state for an invalid tender id', async () => {
    vi.spyOn(procurementApi, 'getTenderDetail').mockRejectedValue(new Error('Tender not found'));

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=session-draft-178333411768']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Tender not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'My Tenders' })).toHaveAttribute('href', '/procurement/my-tenders');
  });
});

function pdfSourceText() {
  const source = html2PdfMock.worker.from.mock.calls.at(-1)?.[0] as HTMLElement | undefined;
  return source?.textContent ?? '';
}

function mockBrowserDownload() {
  const downloads: string[] = [];
  const blobs: Blob[] = [];
  const originalCreateElement = document.createElement.bind(document);

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:procurex-${blobs.length}`;
    })
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn()
  });

  const click = vi.fn();
  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === 'a') {
      Object.defineProperty(element, 'click', { configurable: true, value: click });
      Object.defineProperty(element, 'download', {
        configurable: true,
        get: () => downloads.at(-1) ?? '',
        set: (value: string) => {
          downloads.push(value);
        }
      });
    }
    return element;
  });

  return { blobs, click, downloads };
}
