import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/http';
import { procurementApi } from '../../api';
import type { TenderDetail } from '../../types';
import { SupplierTenderDetailProcurexPage } from './SupplierTenderDetailProcurexPage';

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

const supplierTender: TenderDetail = {
  id: 'tender-2',
  reference: 'PX-2026-002',
  title: 'Office renovation works',
  organization: 'Tanzania Revenue Authority',
  ownerOrganization: 'Tanzania Revenue Authority',
  type: 'WORKS',
  category: 'Office Renovation',
  categories: ['Office Renovation'],
  status: 'OPEN',
  budget: 950000000,
  currency: 'TZS',
  closingDate: '2099-09-15',
  location: 'Dodoma',
  description: 'Renovation of regional office spaces',
  createdByCurrentUser: false,
  ownedByCurrentOrganization: false,
  canBid: true,
  hasDraftBid: false,
  hasSubmittedBid: false,
  isSaved: false,
  visibility: 'PUBLIC_MARKETPLACE',
  publishedAt: '2026-07-01T08:00:00.000Z',
  requirements: {
    deliveryRequirements: ['Complete works in phases'],
    complianceDocuments: ['Contractor registration certificate'],
    evaluationCriteria: [{ criterion: 'Methodology', weight: 60 }]
  },
  metadata: {
    buyerNotice: 'Please use Gate B for the mandatory site visit.',
    worksRequirements: {
      scopeSummary: 'Renovate regional office workspaces',
      siteVisitRequirement: 'Mandatory'
    }
  },
  requirementRows: [{ id: 'req-1', section: 'Technical', payload: { title: 'Submit methodology' } }],
  milestones: [{ id: 'ms-1', name: 'Site visit', dueDate: '2099-08-01', payload: {} }],
  commercialItems: [{ id: 'line-1', itemNo: '1.1', description: 'Partition works', quantity: 1, unit: 'Lot', rate: 950000000, total: 950000000, payload: {} }],
  documents: [
    {
      id: 'doc-1',
      name: 'Renovation tender document',
      documentType: 'TENDER_DOCUMENT',
      label: 'Tender document',
      openUrl: '/api/procurement/tenders/tender-2/documents/doc-1/open',
      downloadUrl: '/api/procurement/tenders/tender-2/documents/doc-1/download'
    }
  ],
  bidSummary: { total: 0, draft: 0, submitted: 0, withdrawn: 0 },
  currentBid: null
};

describe('SupplierTenderDetailProcurexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    html2PdfMock.worker.set.mockReturnValue(html2PdfMock.worker);
    html2PdfMock.worker.from.mockReturnValue(html2PdfMock.worker);
    html2PdfMock.worker.outputPdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the procurex-ui style supplier tender detail for backend tenders', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(supplierTender);

    render(
      <MemoryRouter initialEntries={['/procurement/supplier-tender-detail?tenderId=tender-2']}>
        <SupplierTenderDetailProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findAllByRole('heading', { name: 'Office renovation works' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Start Bid' }).some((link) => link.getAttribute('href') === '/bidding?tenderId=tender-2')).toBe(true);
    expect(screen.getByRole('button', { name: 'Open Document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Tender' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ask clarification' }).some((link) => link.getAttribute('href')?.includes('/communication?'))).toBe(true);
    expect(screen.queryByText('Mandatory before bid')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional responses')).not.toBeInTheDocument();
    expect(screen.queryByText('Time remaining')).not.toBeInTheDocument();
    expect(screen.queryByText('Jump to')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask Buyer' })).toHaveAttribute('href', expect.stringContaining('/communication?view=compose&mode=clarification'));
    expect(screen.getByText('Mandatory before bid')).toBeInTheDocument();
    expect(screen.getByText('Additional responses')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Procurement details', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Clarification and buyer notice' })).toBeInTheDocument();
    expect(screen.getByText('Customer Information')).toBeInTheDocument();
    expect(screen.getByText('Purchase Information')).toBeInTheDocument();
    expect(screen.getByText('Tender Documentation')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Buyer notice' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Clarification and buyer notice' }));

    expect(screen.getByRole('tab', { name: 'Clarification and buyer notice', selected: true })).toBeInTheDocument();
    expect(screen.queryByText('Clarification deadline')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Buyer notice' })).toBeInTheDocument();
    expect(screen.getByText('Please use Gate B for the mandatory site visit.')).toBeInTheDocument();
  });

  it('downloads a consolidated tender pack PDF from the main supplier action', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(supplierTender);
    const download = mockBrowserDownload();
    const getDocument = vi.spyOn(apiClient, 'get');

    render(
      <MemoryRouter initialEntries={['/procurement/supplier-tender-detail?tenderId=tender-2']}>
        <SupplierTenderDetailProcurexPage />
      </MemoryRouter>
    );

    await screen.findAllByRole('heading', { name: 'Office renovation works' });
    await user.click(screen.getByRole('button', { name: 'Download Document' }));

    expect(getDocument).not.toHaveBeenCalled();
    expect(html2PdfMock.worker.set).toHaveBeenCalledWith(expect.objectContaining({ filename: 'PX-2026-002-tender-pack.pdf' }));
    expect(pdfSourceText()).toContain('Complete works in phases');
    expect(pdfSourceText()).toContain('Contractor registration certificate');
    expect(pdfSourceText()).toContain('Methodology');
    expect(pdfSourceText()).toContain('Site visit');
    expect(pdfSourceText()).toContain('Partition works');
    expect(pdfSourceText()).toContain('Renovation tender document');
    expect(download.downloads.at(-1)).toBe('PX-2026-002-tender-pack.pdf');
    expect(download.blobs.at(-1)?.type).toBe('application/pdf');
  });

  it('downloads backend documents from supplier document cards', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(supplierTender);
    const download = mockBrowserDownload();
    const getDocument = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: new Blob(['pdf'], { type: 'application/pdf' }),
      headers: { 'content-disposition': 'attachment; filename="Renovation tender document.pdf"' }
    });

    render(
      <MemoryRouter initialEntries={['/procurement/supplier-tender-detail?tenderId=tender-2']}>
        <SupplierTenderDetailProcurexPage />
      </MemoryRouter>
    );

    await screen.findByText('Renovation tender document');
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(getDocument).toHaveBeenCalledWith('/api/procurement/tenders/tender-2/documents/doc-1/download', { responseType: 'blob' });
    expect(download.downloads.at(-1)).toBe('Renovation tender document.pdf');
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

  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === 'a') {
      Object.defineProperty(element, 'click', { configurable: true, value: vi.fn() });
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

  return { blobs, downloads };
}
