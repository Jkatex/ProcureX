/* Exercises admin behavior so regressions are caught close to the domain workflow they protect. */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import { adminApi } from '@/features/admin/api';
import { assumeUser, signOut } from '@/features/auth/slice';
import { procurementApi } from '@/features/procurement/api';
import type { TenderReviewDetail, TenderReviewListResponse, TenderReviewQueueItem } from '@/features/procurement/types';
import { procurexTheme } from '@/styles/mui-theme';
import { AdminTenderReviewProcurexPage } from './AdminTenderReviewProcurexPage';

vi.mock('@/features/admin/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/admin/api')>('@/features/admin/api');
  return {
    ...actual,
    adminApi: {
      ...actual.adminApi,
      apps: vi.fn()
    }
  };
});

vi.mock('@/features/procurement/api', async () => {
  const actual = await vi.importActual<typeof import('@/features/procurement/api')>('@/features/procurement/api');
  return {
    ...actual,
    procurementApi: {
      ...actual.procurementApi,
      listTenderReviews: vi.fn(),
      getTenderReview: vi.fn(),
      passTenderReview: vi.fn(),
      failTenderReview: vi.fn()
    }
  };
});

const apps = vi.mocked(adminApi.apps);
const listTenderReviews = vi.mocked(procurementApi.listTenderReviews);
const getTenderReview = vi.mocked(procurementApi.getTenderReview);
const passTenderReview = vi.mocked(procurementApi.passTenderReview);

const now = '2026-07-02T09:00:00.000Z';
const tenderId = '11111111-1111-4111-8111-111111111111';
const buyerOrgId = '22222222-2222-4222-8222-222222222222';

const queueItem: TenderReviewQueueItem = {
  id: tenderId,
  reference: 'PX-GDS-2026-001',
  title: 'Supply hospital oxygen',
  buyerOrgId,
  buyerName: 'Kilimanjaro Supplies Limited',
  ownerUserId: '33333333-3333-4333-8333-333333333333',
  ownerName: 'Tender Owner',
  type: 'Goods',
  status: 'Under Review',
  method: 'OPEN_TENDER',
  visibility: 'PRIVATE',
  budget: 250000000,
  currency: 'TZS',
  location: 'Dodoma',
  closingDate: '2026-08-20',
  categories: ['Medical equipment'],
  submittedAt: '2026-07-01T08:00:00.000Z',
  createdAt: '2026-07-01T07:00:00.000Z',
  updatedAt: '2026-07-01T08:00:00.000Z'
};

const laterQueueItem: TenderReviewQueueItem = {
  ...queueItem,
  id: '44444444-4444-4444-8444-444444444444',
  reference: 'PX-SRV-2026-002',
  title: 'Cleaning services framework',
  submittedAt: '2026-07-01T10:00:00.000Z',
  createdAt: '2026-07-01T09:00:00.000Z',
  updatedAt: '2026-07-01T10:00:00.000Z'
};

const detail = {
  ...queueItem,
  organization: queueItem.buyerName,
  ownerOrganization: queueItem.buyerName,
  status: 'DRAFT',
  category: 'Medical equipment',
  description: 'Procurement of medical oxygen cylinders and associated regulators for regional facilities.',
  createdByCurrentUser: false,
  ownedByCurrentOrganization: true,
  canBid: false,
  hasDraftBid: false,
  hasSubmittedBid: false,
  isSaved: false,
  buyerOrgId,
  method: 'OPEN_TENDER',
  visibility: 'PRIVATE',
  publishedAt: null,
  requirements: {
    summary: { requireSamples: 'Yes' },
    delivery: 'Supply, install, and test oxygen equipment before acceptance.',
    commercialItems: [{ id: 'item-1', description: 'Oxygen cylinder', quantity: '20', unit: 'unit' }],
    productSpecifications: [{ id: 'spec-1', sourceItemId: 'item-1', specificationName: 'Cylinder capacity', acceptableRequirement: '50 litres' }],
    sampleRequirements: [{
      id: 'sample-1',
      relatedBoqItemId: 'item-1',
      sampleRequired: true,
      numberOfSamples: '1',
      sampleDescription: 'Sample cylinder with regulator',
      deliveryLocation: 'Dodoma regional hospital',
      deliveryDeadline: '2026-08-01',
      mandatory: true,
      returnableSample: false
    }],
    financialRequirements: [{ id: 'fin-1', requirementType: 'Access to Credit', minimumValue: '50000000', period: 'Last 12 months', evidenceRequired: 'Bank letter', mandatory: true }],
    eligibilityRequirements: [{ id: 'elig-1', requirementName: 'Tax clearance certificate', mandatory: true, requiresUpload: true, notes: 'Supplier must be tax compliant.' }],
    regulatoryLicenseRequirements: [{ id: 'lic-1', license: 'Medical Devices Registration Permit', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)', mandatory: true, expiryRequired: true }]
  },
  metadata: {
    fundingSource: 'Government budget',
    contact: { name: 'Procurement Officer' },
    publication: { openingDate: '2026-08-21' },
    evaluationCriteria: [{ id: 'criteria-1', label: 'Technical Compliance', weight: 70, notes: '', suggestedFor: ['goods'], subcriteria: ['Conformity to technical specifications'] }]
  },
  requirementRows: [{ id: 'req-1', section: 'Technical', payload: { title: 'Valid medical equipment authorization.' } }],
  milestones: [],
  commercialItems: [{ id: 'item-1', itemNo: '1', description: 'Oxygen cylinder', quantity: 20, unit: 'unit', rate: 1000000, total: 20000000, payload: {} }],
  documents: [{ id: 'doc-1', name: 'Tender document', documentType: 'TENDER_DOCUMENT', label: 'Tender document' }],
  bidSummary: { total: 0, draft: 0, submitted: 0, withdrawn: 0 },
  currentBid: null,
  activity: { marketplaceViews: 0, documentDownloads: 0, clarifications: 0 },
  ownerName: 'Tender Owner',
  submittedAt: queueItem.submittedAt,
  reviewAttempts: 1
} as TenderReviewDetail;

function queue(items: TenderReviewQueueItem[]): TenderReviewListResponse {
  return {
    success: true,
    items,
    total: items.length,
    page: 1,
    pageSize: 30,
    totalPages: 1,
    generatedAt: now
  };
}

function CommunicationRouteProbe() {
  const location = useLocation();
  return <div data-testid="communication-route">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(initialEntries = ['/admin/tender-review']) {
  store.dispatch(signOut());
  store.dispatch(
    assumeUser({
      id: 'admin-1',
      displayName: 'Platform Admin',
      email: 'admin@procurex.tz',
      phone: null,
      accountType: 'ADMIN',
      organization: 'ProcureX Administration',
      organizationId: 'platform',
      capabilities: ['BUYER'],
      permissions: ['admin.access'],
      verificationStatus: 'APPROVED',
      preferences: { preferredLanguage: 'en', timezone: 'Africa/Dar_es_Salaam' }
    })
  );

  return render(
    <Provider store={store}>
      <ThemeProvider theme={procurexTheme}>
        <MemoryRouter initialEntries={initialEntries}>
          <Routes>
            <Route path="/admin/tender-review" element={<AdminTenderReviewProcurexPage />} />
            <Route path="/admin/tender-review/:tenderId" element={<AdminTenderReviewProcurexPage />} />
            <Route path="/admin/communication" element={<CommunicationRouteProbe />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
}

describe('AdminTenderReviewProcurexPage', () => {
  beforeEach(() => {
    apps.mockReset();
    listTenderReviews.mockReset();
    getTenderReview.mockReset();
    passTenderReview.mockReset();
    apps.mockResolvedValue({ items: [], generatedAt: now });
    listTenderReviews.mockResolvedValue(queue([queueItem, laterQueueItem]));
    getTenderReview.mockResolvedValue(detail);
    passTenderReview.mockResolvedValue({
      success: true,
      message: 'Tender review passed. The tender is now published to the marketplace.',
      data: {
        tenderId,
        reference: queueItem.reference,
        title: queueItem.title,
        status: 'Open',
        visibility: 'PUBLIC_MARKETPLACE',
        publishedAt: now,
        communicationMessageId: '55555555-5555-4555-8555-555555555555',
        marketplaceRoute: `/procurement/tender-details?tenderId=${tenderId}`
      }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    store.dispatch(signOut());
  });

  it('lists review tenders oldest first and opens the clicked tender detail', async () => {
    renderPage();

    const rows = await screen.findAllByRole('button', { name: /PX-/i });
    expect(rows[0]).toHaveTextContent('PX-GDS-2026-001');
    expect(rows[1]).toHaveTextContent('PX-SRV-2026-002');
    expect(screen.getByLabelText('2 tenders in review queue')).toHaveTextContent('2');
    expect(screen.queryByText('2 awaiting review')).not.toBeInTheDocument();
    expect(screen.queryByText('Select a tender from the queue.')).not.toBeInTheDocument();

    await userEvent.click(rows[0]);

    await waitFor(() => expect(getTenderReview).toHaveBeenCalledWith(tenderId));
    expect((await screen.findAllByRole('heading', { name: 'Supply hospital oxygen' })).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Procurement of medical oxygen cylinders and associated regulators for regional facilities.').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Goods tender summary')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'List of Goods and Product Specifications' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sample Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financial Capacity Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Eligibility Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evaluation Criteria' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Customer Information' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Oxygen cylinder').length).toBeGreaterThan(0);
    expect(screen.getByText('20 unit')).toBeInTheDocument();
    expect(screen.getByText('Cylinder capacity')).toBeInTheDocument();
    expect(screen.getByText('50 litres')).toBeInTheDocument();
    expect(screen.getByText('Access to Credit')).toBeInTheDocument();
    expect(screen.getByText('Tax clearance certificate')).toBeInTheDocument();
    expect(screen.getByText('Technical Compliance')).toBeInTheDocument();
    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pass' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fail' })).toBeInTheDocument();
  });

  it('passes review by publishing the tender and refreshing it out of the queue', async () => {
    listTenderReviews.mockResolvedValueOnce(queue([queueItem])).mockResolvedValueOnce(queue([]));
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /PX-GDS-2026-001/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Pass' }));
    await userEvent.type(await screen.findByLabelText('Signature keyphrase'), 'review-keyphrase');
    await userEvent.click(screen.getByRole('button', { name: 'Pass review' }));

    await waitFor(() => expect(passTenderReview).toHaveBeenCalledWith(tenderId, { signatureKeyphrase: 'review-keyphrase' }));
    expect(await screen.findByText('Tender review passed. The tender is now published to the marketplace.')).toBeInTheDocument();
    expect(await screen.findByText('No tenders are awaiting review.')).toBeInTheDocument();
  });

  it('opens admin Communication Center for failed review with owner and amendment action context', async () => {
    renderPage();

    await userEvent.click(await screen.findByRole('button', { name: /PX-GDS-2026-001/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Fail' }));

    const route = await screen.findByTestId('communication-route');
    expect(route.textContent).toContain('/admin/communication?');
    expect(route.textContent).toContain('reviewDecision=fail');
    expect(route.textContent).toContain(`reviewTenderId=${tenderId}`);
    expect(route.textContent).toContain(`recipientOrgId=${buyerOrgId}`);
    expect(route.textContent).toContain('subject=Your+tender+has+failed+review');
    expect(route.textContent).toContain('actionLabel=Amend+Tender');
    expect(route.textContent).toContain(`actionRoute=%2Fprocurement%2Fcreate-tender%3FtenderId%3D${tenderId}`);
  });
});
