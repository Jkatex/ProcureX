import { mockApi } from '@/shared/api/mockApi';
import { apiClient } from '@/shared/api/http';
import { demoUsers } from '@/shared/data/fixtures';
import type { Bid, SessionUser, Tender } from '@/shared/types/domain';
import { toTenderType } from '../createTenderConfig';
import { isActiveMarketplaceTender } from '../marketplaceTenderVisibility';
import type {
  CreateTenderDraft,
  CreateTenderPayload,
  CreateTenderResponse,
  MarketplacePayload,
  MarketplaceTenderRow,
  MyBidRow,
  MyTenderRow,
  PublishTenderResponse,
  TenderReviewDecisionResponse,
  TenderReviewDetail,
  TenderReviewListResponse,
  TenderDetail,
  UpdateTenderPayload,
  UpdateTenderResponse
} from '../types';

export const procurementApi = {
  listTenders: mockApi.getTenders,
  async getMarketplace(currentUser?: SessionUser | null): Promise<MarketplacePayload> {
    try {
      const response = await apiClient.get<MarketplacePayload>('/api/procurement/marketplace');
      return normalizeMarketplacePayload(response.data);
    } catch {
      const [tenders, bids, workItems] = await Promise.all([mockApi.getTenders(), mockApi.getBids(), mockApi.getWorkItems()]);
      return buildMarketplacePayload(tenders, bids, workItems, currentUser);
    }
  },
  async getTenderDetail(tenderId: string): Promise<TenderDetail> {
    try {
      const response = await apiClient.get<TenderDetail>(`/api/procurement/tenders/${tenderId}`);
      return normalizeTenderDetail(response.data);
    } catch {
      const tenders = await mockApi.getTenders();
      const tender = tenders.find((item) => item.id === tenderId || item.reference === tenderId);
      if (!tender) throw new Error('Tender not found');
      return buildTenderDetailFallback(tender);
    }
  },
  async recordTenderDocumentDownload(tenderId: string, documentId: string) {
    const response = await apiClient.post<{ success: true; message: string }>(`/api/procurement/tenders/${tenderId}/documents/${documentId}/download`, {});
    return response.data;
  },
  async saveTender(tenderId: string) {
    const response = await apiClient.post<{ success: true; message: string }>(`/api/procurement/tenders/${tenderId}/save`);
    return response.data;
  },
  async unsaveTender(tenderId: string) {
    const response = await apiClient.delete<{ success: true; message: string }>(`/api/procurement/tenders/${tenderId}/save`);
    return response.data;
  },
  async createTender(payload: CreateTenderPayload): Promise<CreateTenderResponse> {
    const response = await apiClient.post<CreateTenderResponse>('/api/procurement/tenders', payload);
    return response.data;
  },
  async updateTender(tenderId: string, payload: UpdateTenderPayload): Promise<UpdateTenderResponse> {
    const response = await apiClient.patch<UpdateTenderResponse>(`/api/procurement/tenders/${tenderId}`, payload);
    return response.data;
  },
  async publishTender(tenderId: string): Promise<PublishTenderResponse> {
    const response = await apiClient.post<PublishTenderResponse>(`/api/procurement/tenders/${tenderId}/publish`, {});
    return response.data;
  },
  async listTenderReviews(query: { search?: string; page?: number; pageSize?: number } = {}): Promise<TenderReviewListResponse> {
    const response = await apiClient.get<TenderReviewListResponse>('/api/procurement/admin/tender-review', {
      params: query
    });
    return response.data;
  },
  async getTenderReview(tenderId: string): Promise<TenderReviewDetail> {
    const response = await apiClient.get<TenderReviewDetail>(`/api/procurement/admin/tender-review/${tenderId}`);
    return response.data;
  },
  async passTenderReview(tenderId: string): Promise<TenderReviewDecisionResponse> {
    const response = await apiClient.post<TenderReviewDecisionResponse>(`/api/procurement/admin/tender-review/${tenderId}/pass`, {});
    return response.data;
  },
  async failTenderReview(tenderId: string, input: { messageId: string }): Promise<TenderReviewDecisionResponse> {
    const response = await apiClient.post<TenderReviewDecisionResponse>(`/api/procurement/admin/tender-review/${tenderId}/fail`, input);
    return response.data;
  }
};

type WorkItemFixture = Awaited<ReturnType<typeof mockApi.getWorkItems>>[number];

function normalizeMarketplacePayload(payload: MarketplacePayload): MarketplacePayload {
  return {
    ...payload,
    tenders: (payload.tenders ?? []).map(normalizeMarketplaceTenderRow).filter(isActiveMarketplaceTender),
    myTenders: (payload.myTenders ?? []).map((row) => ({
      ...row,
      tender: row.tender ? normalizeMarketplaceTenderRow(row.tender as MarketplaceTenderRow) : undefined
    })),
    myBids: (payload.myBids ?? []).map((row) => ({
      ...row,
      tender: normalizeMarketplaceTenderRow(row.tender as MarketplaceTenderRow)
    }))
  };
}

function normalizeTenderDetail(tender: TenderDetail): TenderDetail {
  return {
    ...normalizeMarketplaceTenderRow(tender),
    method: tender.method,
    visibility: tender.visibility,
    publishedAt: tender.publishedAt,
    requirements: tender.requirements ?? {},
    requirementRows: tender.requirementRows ?? [],
    milestones: tender.milestones ?? [],
    commercialItems: tender.commercialItems ?? [],
    documents: tender.documents ?? [],
    bidSummary: tender.bidSummary ?? { total: 0, draft: 0, submitted: 0, withdrawn: 0 },
    currentBid: tender.currentBid ?? null,
    activity: tender.activity
  };
}

function normalizeMarketplaceTenderRow<T extends MarketplaceTenderRow>(tender: T): T {
  const category = tender.category || categoryFromCategories(tender.categories) || String(tender.type || 'Tender');
  return {
    ...tender,
    category,
    categories: normalizeCategoryList(tender.categories, category),
    currency: tender.currency || 'TZS',
    ownerOrganization: tender.ownerOrganization || tender.organization,
    createdByCurrentUser: Boolean(tender.createdByCurrentUser),
    ownedByCurrentOrganization: Boolean(tender.ownedByCurrentOrganization ?? tender.createdByCurrentUser),
    canBid: Boolean(tender.canBid),
    hasDraftBid: Boolean(tender.hasDraftBid),
    hasSubmittedBid: Boolean(tender.hasSubmittedBid),
    isSaved: Boolean(tender.isSaved)
  };
}

function normalizeCategoryList(categories: string[] | undefined, fallback: string) {
  const values = Array.isArray(categories) ? categories : [];
  const normalized = values.map((category) => category.trim()).filter(Boolean);
  return normalized.length ? normalized : [fallback].filter(Boolean);
}

function categoryFromCategories(categories: string[] | undefined) {
  return Array.isArray(categories) ? categories.find((category) => category.trim())?.trim() : undefined;
}

function buildMarketplacePayload(tenders: Tender[], bids: Bid[], workItems: WorkItemFixture[], currentUser?: SessionUser | null): MarketplacePayload {
  const normalizedTenders = tenders.map((tender) => normalizeFixtureTender(tender, currentUser));
  const myTenderRows = buildMyTenderRows(normalizedTenders, workItems, currentUser);
  const myBidRows = buildMyBidRows(normalizedTenders, bids, workItems, currentUser);
  const activeMarketplaceTenders = normalizedTenders.filter(isActiveMarketplaceTender);

  return {
    tenders: activeMarketplaceTenders.map((tender) => ({
      ...tender,
      hasDraftBid: myBidRows.some((bid) => bid.tenderReference === tender.reference && bid.section === 'draft'),
      hasSubmittedBid: myBidRows.some((bid) => bid.tenderReference === tender.reference && bid.section === 'submitted'),
      canBid: canBidOnFixtureTender(tender, myBidRows)
    })),
    myTenders: myTenderRows,
    myBids: myBidRows
  };
}

export function mergeSessionMarketplaceData(
  payload: MarketplacePayload,
  drafts: CreateTenderDraft[],
  publishedTenders: CreateTenderDraft[],
  organization = demoUsers.user.organization
): MarketplacePayload {
  const sessionTenderRows = publishedTenders.map((draft): MarketplaceTenderRow => createMarketplaceTenderFromDraft(draft, organization));
  const sessionMyTenderRows = drafts.map((draft): MyTenderRow => ({
    id: draft.id,
    title: draft.title || 'Untitled tender draft',
    section: draft.status === 'PUBLISHED' ? 'posted' : 'draft',
    status: draft.status === 'PUBLISHED' ? 'Posted' : draft.status === 'SUBMITTED' ? 'Under Review' : 'Draft',
    type: toTenderType(draft.procurementTypeId),
    tender: draft.status === 'PUBLISHED' ? createMarketplaceTenderFromDraft(draft, organization) : undefined,
    lastActivity: draft.publishedAt?.slice(0, 10) || draft.updatedAt.slice(0, 10),
    actionLabel: draft.status === 'PUBLISHED' ? 'View My Tender' : draft.status === 'SUBMITTED' ? 'Review Pending' : 'Continue Draft',
    nav: draft.status === 'PUBLISHED' ? `/procurement/tender-details?tenderId=${draft.id}` : '/procurement/create-tender'
  }));

  const existingTenderIds = new Set(sessionTenderRows.map((row) => row.id));
  const existingMyTenderIds = new Set(sessionMyTenderRows.map((row) => row.id));

  return {
    ...payload,
    tenders: [...sessionTenderRows.filter(isActiveMarketplaceTender), ...payload.tenders.filter((row) => !existingTenderIds.has(row.id))],
    myTenders: [...sessionMyTenderRows, ...payload.myTenders.filter((row) => !existingMyTenderIds.has(row.id))]
  };
}

function createMarketplaceTenderFromDraft(draft: CreateTenderDraft, organization: string): MarketplaceTenderRow {
  return {
    id: draft.id,
    reference: draft.reference,
    title: draft.title || 'Untitled tender',
    organization: draft.procuringEntity || organization,
    type: toTenderType(draft.procurementTypeId),
    status: 'OPEN',
    budget: Number(draft.estimatedBudget || draft.requirements.estimated_budget || draft.commercialItems.length * 5000000 || 100000000),
    currency: draft.currency || 'TZS',
    closingDate: draft.submissionDate || new Date().toISOString().slice(0, 10),
    location: draft.location || 'Tanzania',
    description: summarizeDraft(draft),
    createdByCurrentUser: true,
    ownedByCurrentOrganization: true,
    canBid: false,
    hasDraftBid: false,
    hasSubmittedBid: false,
    isSaved: false,
    categories: draft.categories.length ? draft.categories : [draft.procurementTypeId]
  };
}

function buildTenderDetailFallback(tender: Tender): TenderDetail {
  return {
    ...tender,
    method: 'Open Tender',
    visibility: 'PUBLIC_MARKETPLACE',
    publishedAt: new Date().toISOString(),
    requirements: { summary: tender.description },
    requirementRows: [
      { id: 'eligibility', section: 'Eligibility', payload: { title: 'Valid business registration and tax compliance evidence required.' } },
      { id: 'technical', section: 'Technical', payload: { title: 'Submit a technical approach, work plan, and relevant experience.' } },
      { id: 'financial', section: 'Financial', payload: { title: 'Submit priced commercial offer in the requested currency.' } }
    ],
    milestones: [
      { id: 'published', name: 'Tender published', dueDate: new Date().toISOString(), payload: {} },
      { id: 'closing', name: 'Submission deadline', dueDate: tender.closingDate, payload: {} }
    ],
    commercialItems: [
      {
        id: 'line-1',
        itemNo: '1',
        description: tender.title,
        quantity: 1,
        unit: 'lot',
        rate: tender.budget,
        total: tender.budget,
        payload: {}
      }
    ],
    documents: [{ id: 'document-1', name: `${tender.reference} tender document`, documentType: 'TENDER_DOCUMENT', label: 'Tender document' }],
    bidSummary: { total: 0, draft: 0, submitted: 0, withdrawn: 0 },
    currentBid: null
  };
}

function summarizeDraft(draft: CreateTenderDraft) {
  const firstRequirement = Object.values(draft.requirements).find(Boolean);
  return draft.description || firstRequirement || draft.deliverables[0] || `Published ${draft.procurementTypeId} tender created in the React workflow.`;
}

function buildMyTenderRows(tenders: Tender[], workItems: WorkItemFixture[], currentUser?: SessionUser | null): MyTenderRow[] {
  if (!isDemoFixtureUser(currentUser)) return [];
  const ownedTenders = tenders.filter((tender) => tender.createdByCurrentUser);
  const draftWorkItems = workItems.filter((item) => /tender draft|publish tender/i.test(`${item.title} ${item.subtitle}`));

  const draftRows = draftWorkItems.map((item, index): MyTenderRow => {
    const tender = ownedTenders[index] ?? ownedTenders[0];
    return {
      id: `my-tender-draft-${item.id}`,
      title: item.subtitle || item.title,
      section: 'draft',
      status: item.status || 'Draft',
      type: tender?.type ?? 'SERVICE',
      tender,
      lastActivity: '2026-06-09',
      actionLabel: 'Continue Draft',
      nav: '/procurement/create-tender'
    };
  });

  const postedRows = ownedTenders.map((tender): MyTenderRow => ({
    id: `my-tender-posted-${tender.id}`,
    title: tender.title,
    section: 'posted',
    status: tender.status === 'PUBLISHED' ? 'Posted' : tender.status,
    type: tender.type,
    tender,
    lastActivity: tender.closingDate,
    actionLabel: 'View My Tender',
    nav: `/procurement/tender-details?tenderId=${tender.id}`
  }));

  return [...draftRows, ...postedRows];
}

function buildMyBidRows(tenders: Tender[], bids: Bid[], workItems: WorkItemFixture[], currentUser?: SessionUser | null): MyBidRow[] {
  if (!currentUser) return [];
  const tenderByReference = new Map(tenders.map((tender) => [tender.reference, tender]));
  const draftBidWorkItems = isDemoFixtureUser(currentUser) ? workItems.filter((item) => /bid package|continue bid/i.test(`${item.title} ${item.subtitle}`)) : [];

  const draftRows = draftBidWorkItems.flatMap((item): MyBidRow[] => {
    const tender = findTenderForWorkItem(tenders, item);
    if (!tender) return [];
    return [
      {
        id: `my-bid-draft-${item.id}`,
        title: item.subtitle || tender.title,
        section: 'draft',
        status: item.status || 'Draft',
        tender,
        tenderReference: tender.reference,
        lastActivity: '2026-06-09',
        actionLabel: 'Continue Bid',
        nav: `/bidding?tenderId=${tender.id}`
      }
    ];
  });

  const submittedRows = bids.flatMap((bid): MyBidRow[] => {
    const tender = tenderByReference.get(bid.tenderReference);
    if (!tender || bid.status === 'DRAFT' || bid.supplier !== currentUser.organization) return [];
    return [
      {
        id: `my-bid-submitted-${bid.id}`,
        title: tender.title,
        section: 'submitted',
        status: bid.status === 'SUBMITTED' ? 'Submitted' : bid.status,
        tender,
        tenderReference: tender.reference,
        amount: `${tender.currency} ${bid.amount.toLocaleString()}`,
        receiptHash: `BID-${bid.id.toUpperCase()}`,
        lastActivity: '2026-06-09',
        actionLabel: 'Open Bid',
        nav: `/bidding?tenderId=${tender.id}`
      }
    ];
  });

  return [...draftRows, ...submittedRows];
}

function findTenderForWorkItem(tenders: Tender[], item: WorkItemFixture) {
  const haystack = `${item.title} ${item.subtitle}`.toLowerCase();
  return tenders.find((tender) => haystack.includes(tender.title.toLowerCase()) || tender.title.toLowerCase().includes(item.subtitle.toLowerCase()));
}

function normalizeFixtureTender(tender: Tender, currentUser?: SessionUser | null): MarketplaceTenderRow {
  const createdByCurrentUser = Boolean(tender.createdByCurrentUser && isDemoFixtureUser(currentUser));
  const ownedByCurrentOrganization = Boolean(currentUser?.organization && tender.organization === currentUser.organization);
  return {
    ...tender,
    createdByCurrentUser,
    ownedByCurrentOrganization,
    canBid: false,
    hasDraftBid: false,
    hasSubmittedBid: false,
    isSaved: false
  };
}

function canBidOnFixtureTender(tender: Tender, myBidRows: MyBidRow[]) {
  const status = String(tender.status).toUpperCase();
  const hasSubmittedBid = myBidRows.some((bid) => bid.tenderReference === tender.reference && bid.section === 'submitted');
  if (tender.ownedByCurrentOrganization) return false;
  if (status !== 'OPEN' && status !== 'PUBLISHED') return false;
  if (hasSubmittedBid) return false;
  return Date.parse(`${tender.closingDate}T23:59:59.999Z`) > Date.now();
}

function isDemoFixtureUser(user?: SessionUser | null) {
  return Boolean(user && (user.id === demoUsers.user.id || user.email === demoUsers.user.email));
}
