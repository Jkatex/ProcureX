import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { procurementApi } from '../../api';
import type { TenderDetail } from '../../types';
import { TenderDetailsProcurexPage } from './TenderDetailsProcurexPage';

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
  requirements: { deliveryRequirements: ['Deliver to buyer stores'] },
  requirementRows: [{ id: 'req-1', section: 'Eligibility', payload: { title: 'Tax clearance required' } }],
  milestones: [],
  commercialItems: [{ id: 'line-1', itemNo: '1', description: 'Diagnostic kit', quantity: 2, unit: 'Set', rate: 125000000, total: 250000000, payload: {} }],
  documents: [{ id: 'doc-1', name: 'Tender document', documentType: 'TENDER_DOCUMENT', label: 'Available for review' }],
  bidSummary: { total: 2, draft: 1, submitted: 1, withdrawn: 0 },
  currentBid: null,
  activity: { marketplaceViews: 12, documentDownloads: 4, clarifications: 0 }
};

describe('TenderDetailsProcurexPage', () => {
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

  it('records document downloads through the backend tracker', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(buyerTender);
    const recordDownload = vi.spyOn(procurementApi, 'recordTenderDocumentDownload').mockResolvedValue({
      success: true,
      message: 'Document download recorded'
    });

    render(
      <MemoryRouter initialEntries={['/procurement/tender-details?tenderId=tender-1']}>
        <TenderDetailsProcurexPage />
      </MemoryRouter>
    );

    await screen.findAllByRole('heading', { name: 'Supply of medical equipment' });
    await user.click(screen.getByRole('button', { name: 'Download Document' }));

    expect(recordDownload).toHaveBeenCalledWith('tender-1', 'doc-1');
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
    expect(screen.getByText('56')).toBeInTheDocument();
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
