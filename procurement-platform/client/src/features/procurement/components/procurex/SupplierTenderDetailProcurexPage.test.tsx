import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { procurementApi } from '../../api';
import type { TenderDetail } from '../../types';
import { SupplierTenderDetailProcurexPage } from './SupplierTenderDetailProcurexPage';

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
  requirements: { deliveryRequirements: ['Complete works in phases'] },
  requirementRows: [{ id: 'req-1', section: 'Technical', payload: { title: 'Submit methodology' } }],
  milestones: [{ id: 'ms-1', name: 'Site visit', dueDate: '2099-08-01', payload: {} }],
  commercialItems: [{ id: 'line-1', itemNo: '1.1', description: 'Partition works', quantity: 1, unit: 'Lot', rate: 950000000, total: 950000000, payload: {} }],
  documents: [{ id: 'doc-1', name: 'Renovation tender document', documentType: 'TENDER_DOCUMENT', label: 'Tender document' }],
  bidSummary: { total: 0, draft: 0, submitted: 0, withdrawn: 0 },
  currentBid: null
};

describe('SupplierTenderDetailProcurexPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the procurex-ui style supplier tender detail for backend tenders', async () => {
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
    expect(screen.getByRole('link', { name: 'Ask Buyer' })).toHaveAttribute('href', '/communication');
    expect(screen.getByText('Mandatory before bid')).toBeInTheDocument();
    expect(screen.getByText('Additional responses')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Procurement details', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Questions and requirements' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Complaints' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Monitoring and reporting' })).toBeInTheDocument();
    expect(screen.getByText('Customer Information')).toBeInTheDocument();
    expect(screen.getByText('Purchase Information')).toBeInTheDocument();
    expect(screen.getByText('Tender Documentation')).toBeInTheDocument();
  });
});
