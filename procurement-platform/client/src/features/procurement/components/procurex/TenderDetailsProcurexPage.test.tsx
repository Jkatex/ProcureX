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
  submittedBidBusinesses: [{ id: 'supplier-1', name: 'Prime Medical Supplies', submittedAt: '2099-08-01T09:00:00.000Z' }],
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
    expect(screen.queryByRole('button', { name: 'Create Amendment' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Open Evaluation' })).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Procurement details', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Tender activity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Customer Information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Purchase Information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tender Documentation' })).toBeInTheDocument();
    expect(screen.getAllByText('Diagnostic kit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tender document').length).toBeGreaterThan(0);
    expect(screen.queryByText('Marketplace views')).not.toBeInTheDocument();
    expect(screen.queryByText('Document downloads')).not.toBeInTheDocument();
    expect(screen.queryByText('Time to close')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Bid summary' })).not.toBeInTheDocument();
  });

  it('shows buyer tender activity controls without exposing bid details', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(buyerTender);

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
    expect(screen.getByText('Prime Medical Supplies')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tender activity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Clarification inquiries' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Buyer notice' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Make amendment' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cancel tender' })).toBeInTheDocument();
    expect(screen.queryByText(/financial proposal|technical proposal|unit price/i)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open clarification messages' }).getAttribute('href')).toContain('/communication?');
    expect(screen.getByRole('button', { name: 'Make amendment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel tender' })).toBeDisabled();

    await user.type(screen.getByRole('textbox', { name: 'Buyer notice' }), 'Please review the updated site access instruction.');
    await user.click(screen.getByRole('button', { name: 'Save notice' }));

    expect(screen.getByText('Buyer notice persistence is not connected for published tenders yet.')).toBeInTheDocument();
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
