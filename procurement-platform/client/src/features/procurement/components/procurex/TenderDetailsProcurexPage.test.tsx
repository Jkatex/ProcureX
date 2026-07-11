import { render, screen } from '@testing-library/react';
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
  currentBid: null,
  activity: { marketplaceViews: 12, documentDownloads: 4, clarifications: 0 }
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
    expect(screen.getByText('Active tender')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Document' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Create Amendment' }).length).toBeGreaterThan(0);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      'Procurement details',
      'Questions and amendments',
      'Supplier activity',
      'Evaluation and records'
    ]);
    expect(screen.getByRole('tab', { name: 'Procurement details', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Questions and amendments' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Supplier activity' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Evaluation and records' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Customer Information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Purchase Information' })).toBeInTheDocument();
    expect(screen.getByText('Diagnostic kit')).toBeInTheDocument();
    expect(screen.getAllByText('Tender document').length).toBeGreaterThan(0);
    expect(screen.getByText('Marketplace views')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
  });

  it('switches between buyer tender detail sections', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(buyerTender);

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=tender-1']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByRole('tab', { name: 'Procurement details', selected: true })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Questions and amendments' }));
    expect(screen.getByRole('heading', { name: 'Supplier questions' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Addenda' })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Supplier activity' }));
    expect(screen.getByRole('heading', { name: 'Supplier engagement' })).toBeInTheDocument();
    expect(screen.getByText('Marketplace engagement')).toBeInTheDocument();
    expect(screen.getByText('Document interest')).toBeInTheDocument();
    expect(screen.getByText('Clarification activity')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Activity requiring buyer attention' })).toBeInTheDocument();
    expect(screen.getAllByText('Marketplace views').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Document downloads').length).toBeGreaterThan(0);
    expect(screen.getAllByText('12').length).toBeGreaterThan(0);
    expect(screen.getAllByText('4').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Time to close').length).toBeGreaterThan(0);
    expect(screen.getByText('Clarifications')).toBeInTheDocument();
    expect(screen.getByText('Documents')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Evaluation and records' }));
    expect(screen.getByRole('heading', { name: 'Awaiting close' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sealed Bid Summary' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Lifecycle archive' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open Records and History' })).toHaveAttribute('href', '/records-history');
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
    expect(html2PdfMock.worker.set).toHaveBeenCalledWith(expect.objectContaining({ filename: 'PX-2026-001-tender-pack.pdf' }));
    expect(pdfSourceText()).toContain('Deliver to buyer stores');
    expect(pdfSourceText()).toContain('Tax clearance required');
    expect(pdfSourceText()).toContain('Technical responsiveness');
    expect(pdfSourceText()).toContain('Four hour support window');
    expect(pdfSourceText()).toContain('Site inspection');
    expect(pdfSourceText()).toContain('Diagnostic kit');
    expect(pdfSourceText()).toContain('Pricing schedule');
    expect(download.click).toHaveBeenCalled();
    expect(download.downloads.at(-1)).toBe('PX-2026-001-tender-pack.pdf');
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
    expect(download.downloads.at(-1)).toBe('PX-2026-001-tender-pack.pdf');
    expect(download.blobs.at(-1)?.type).toBe('application/pdf');
  });

  it('downloads the selected document from document cards', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(buyerTender);
    mockBrowserDownload();
    const getDocument = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: new Blob(['xlsx'], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      headers: { 'content-disposition': 'attachment; filename="Pricing schedule.xlsx"' }
    });

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=tender-1']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    await screen.findByText('Pricing schedule');
    await user.click(screen.getAllByRole('button', { name: 'Download' })[1]);

    expect(getDocument).toHaveBeenCalledWith('/api/procurement/tenders/tender-1/documents/doc-2/download', { responseType: 'blob' });
  });

  it('falls back to prototype activity metrics when older backend responses omit activity', async () => {
    const tenderWithoutActivity: TenderDetail = { ...buyerTender, activity: undefined };
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(tenderWithoutActivity);

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=tender-1']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('224')).toBeInTheDocument();
    expect(screen.getByText('67')).toBeInTheDocument();
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
