import { apiClient } from '@/shared/api/http';
import { demoUsers } from '@/shared/data/fixtures';
import { toTenderType } from '../createTenderConfig';
import { isActiveInvitedTender, isActiveMarketplaceTender } from '../marketplaceTenderVisibility';
import type {
  CreateTenderDraft,
  CreateTenderPayload,
  CreateTenderResponse,
  DeleteTenderDraftResponse,
  MarketplacePayload,
  MarketplaceTenderRow,
  MyTenderRow,
  PublishTenderResponse,
  StartContactVerificationPayload,
  StartContactVerificationResponse,
  TenderReviewDecisionResponse,
  TenderReviewDetail,
  TenderReviewListResponse,
  TenderDetail,
  UpdateBuyerNoticeResponse,
  UpdateTenderPayload,
  UpdateTenderResponse,
  VerifyContactVerificationPayload,
  VerifyContactVerificationResponse
} from '../types';

export const procurementApi = {
  async listTenders() {
    const response = await apiClient.get<MarketplacePayload>('/api/procurement/marketplace');
    return normalizeMarketplacePayload(response.data).tenders;
  },
  async getMarketplace(_context?: unknown): Promise<MarketplacePayload> {
    const response = await apiClient.get<MarketplacePayload>('/api/procurement/marketplace');
    return normalizeMarketplacePayload(response.data);
  },
  async getTenderDetail(tenderId: string): Promise<TenderDetail> {
    const response = await apiClient.get<TenderDetail>(`/api/procurement/tenders/${tenderId}`);
    return normalizeTenderDetail(response.data);
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
  async startContactVerification(payload: StartContactVerificationPayload): Promise<StartContactVerificationResponse> {
    const response = await apiClient.post<StartContactVerificationResponse>('/api/procurement/contact-verifications', payload);
    return response.data;
  },
  async verifyContactVerification(payload: VerifyContactVerificationPayload): Promise<VerifyContactVerificationResponse> {
    const response = await apiClient.post<VerifyContactVerificationResponse>('/api/procurement/contact-verifications/verify', payload);
    return response.data;
  },
  async updateTender(tenderId: string, payload: UpdateTenderPayload): Promise<UpdateTenderResponse> {
    const response = await apiClient.patch<UpdateTenderResponse>(`/api/procurement/tenders/${tenderId}`, payload);
    return response.data;
  },
  async deleteTenderDraft(tenderId: string): Promise<DeleteTenderDraftResponse> {
    const response = await apiClient.delete<DeleteTenderDraftResponse>(`/api/procurement/tenders/${tenderId}/draft`);
    return response.data;
  },
  async updateBuyerNotice(tenderId: string, buyerNotice: string): Promise<UpdateBuyerNoticeResponse> {
    const response = await apiClient.patch<UpdateBuyerNoticeResponse>(`/api/procurement/tenders/${tenderId}/buyer-notice`, { buyerNotice });
    return response.data;
  },
  async publishTender(tenderId: string, input: { signatureKeyphrase?: string } = {}): Promise<PublishTenderResponse> {
    const response = await apiClient.post<PublishTenderResponse>(`/api/procurement/tenders/${tenderId}/publish`, input);
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
  async passTenderReview(tenderId: string, input: { signatureKeyphrase?: string } = {}): Promise<TenderReviewDecisionResponse> {
    const response = await apiClient.post<TenderReviewDecisionResponse>(`/api/procurement/admin/tender-review/${tenderId}/pass`, input);
    return response.data;
  },
  async failTenderReview(tenderId: string, input: { messageId: string }): Promise<TenderReviewDecisionResponse> {
    const response = await apiClient.post<TenderReviewDecisionResponse>(`/api/procurement/admin/tender-review/${tenderId}/fail`, input);
    return response.data;
  }
};

function normalizeMarketplacePayload(payload: MarketplacePayload): MarketplacePayload {
  const normalizedTenders = (payload.tenders ?? []).map(normalizeMarketplaceTenderRow);
  const normalizedInvitedTenders = (payload.invitedTenders ?? normalizedTenders).map(normalizeMarketplaceTenderRow);
  const normalizedRecommendedTenders = (payload.recommendedTenders ?? []).map(normalizeMarketplaceTenderRow);
  return {
    ...payload,
    tenders: normalizedTenders.filter(isActiveMarketplaceTender),
    recommendedTenders: uniqueMarketplaceRows(normalizedRecommendedTenders.filter(isActiveRecommendedTender)),
    invitedTenders: normalizedInvitedTenders.filter(isActiveInvitedTender),
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

function isActiveRecommendedTender(tender: MarketplaceTenderRow) {
  return isActiveMarketplaceTender(tender) || isActiveInvitedTender(tender);
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
    submittedBidBusinesses: tender.submittedBidBusinesses ?? [],
    clarificationInquiries: tender.clarificationInquiries ?? [],
    currentBid: tender.currentBid ?? null,
    activity: tender.activity
  };
}

function normalizeMarketplaceTenderRow<T extends MarketplaceTenderRow>(tender: T): T {
  const category = tender.category || categoryFromCategories(tender.categories) || String(tender.type || 'Tender');
  const buyerLogoUrl = tender.buyerLogoUrl || mockBuyerLogoUrl(tender.organization);
  return {
    ...tender,
    category,
    categories: normalizeCategoryList(tender.categories, category),
    currency: tender.currency || 'TZS',
    ...(buyerLogoUrl ? { buyerLogoUrl } : {}),
    openingDate: tender.openingDate || '',
    ownerOrganization: tender.ownerOrganization || tender.organization,
    visibility: tender.visibility || 'PUBLIC_MARKETPLACE',
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

const mockBuyerLogoPath = '/assets/mock-business-logos/';

const mockBuyerLogoPool = [
  `${mockBuyerLogoPath}marketplace-authority.svg`,
  `${mockBuyerLogoPath}municipal-buyer.svg`,
  `${mockBuyerLogoPath}huui-buyer-authority.svg`,
  `${mockBuyerLogoPath}ict-procurement.svg`,
  `${mockBuyerLogoPath}works-infrastructure.svg`,
  `${mockBuyerLogoPath}facilities-services.svg`,
  `${mockBuyerLogoPath}consultancy-advisory.svg`,
  `${mockBuyerLogoPath}public-procurement.svg`,
  `${mockBuyerLogoPath}procurex-platform.svg`,
  `${mockBuyerLogoPath}kilimanjaro-supplies.svg`,
  `${mockBuyerLogoPath}ministry-works.svg`,
  `${mockBuyerLogoPath}revenue-authority.svg`
];

function mockBuyerLogoUrl(organization: string | undefined) {
  const normalized = String(organization ?? '').trim().toLowerCase();
  const logos: Record<string, string> = {
    'ministry of health': `${mockBuyerLogoPath}ministry-health.svg`,
    'ministry of works': `${mockBuyerLogoPath}ministry-works.svg`,
    'muhimbili national hospital': `${mockBuyerLogoPath}muhimbili-national-hospital.svg`,
    'verified company account': `${mockBuyerLogoPath}verified-company-account.svg`,
    'medical stores department': `${mockBuyerLogoPath}medical-stores-department.svg`,
    'tanzania revenue authority': `${mockBuyerLogoPath}revenue-authority.svg`,
    'procurex platform': `${mockBuyerLogoPath}procurex-platform.svg`,
    'kilimanjaro supplies limited': `${mockBuyerLogoPath}kilimanjaro-supplies.svg`,
    'buyer authority': `${mockBuyerLogoPath}buyer-authority.svg`,
    'public buyer': `${mockBuyerLogoPath}public-procurement.svg`,
    'invitation buyer': `${mockBuyerLogoPath}marketplace-authority.svg`,
    'procurex marketplace test buyer authority': `${mockBuyerLogoPath}marketplace-authority.svg`,
    'procurex marketplace municipal buyer': `${mockBuyerLogoPath}municipal-buyer.svg`,
    'huui demo buyer authority': `${mockBuyerLogoPath}huui-buyer-authority.svg`,
    'px demo external buyer authority': `${mockBuyerLogoPath}public-procurement.svg`,
    'procurex award ready buyer authority': `${mockBuyerLogoPath}marketplace-authority.svg`
  };
  if (logos[normalized]) return logos[normalized];
  if (!normalized) return `${mockBuyerLogoPath}public-procurement.svg`;
  return mockBuyerLogoPool[mockLogoIndex(normalized)];
}

function mockLogoIndex(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash % mockBuyerLogoPool.length;
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
    status: draft.status === 'PUBLISHED' ? 'Open' : draft.status === 'SUBMITTED' ? 'Awaiting Review' : 'Draft',
    type: toTenderType(draft.procurementTypeId),
    tender: createMarketplaceTenderFromDraft(draft, organization),
    lastActivity: draft.publishedAt?.slice(0, 10) || draft.updatedAt.slice(0, 10),
    actionLabel: draft.status === 'PUBLISHED' ? 'View tender' : draft.status === 'SUBMITTED' ? 'Awaiting review' : 'Continue creating',
    nav: draft.status === 'PUBLISHED' ? `/procurement/tender-details?tenderId=${draft.id}` : `/procurement/create-tender?draftId=${draft.id}`
  }));

  const existingTenderIds = new Set(sessionTenderRows.map((row) => row.id));
  const existingMyTenderIds = new Set(sessionMyTenderRows.map((row) => row.id));

  return {
    ...payload,
    tenders: [...sessionTenderRows.filter(isActiveMarketplaceTender), ...payload.tenders.filter((row) => !existingTenderIds.has(row.id))],
    recommendedTenders: payload.recommendedTenders ?? [],
    invitedTenders: payload.invitedTenders ?? [],
    myTenders: [...sessionMyTenderRows, ...payload.myTenders.filter((row) => !existingMyTenderIds.has(row.id))]
  };
}

function uniqueMarketplaceRows(rows: MarketplaceTenderRow[]) {
  return [...new Map(rows.map((row) => [row.id || row.reference, row])).values()];
}

function createMarketplaceTenderFromDraft(draft: CreateTenderDraft, organization: string): MarketplaceTenderRow {
  const procuringEntity = draft.procuringEntity || organization;
  const buyerLogoUrl = mockBuyerLogoUrl(procuringEntity);
  return {
    id: draft.id,
    reference: draft.reference,
    title: draft.title || 'Untitled tender',
    organization: procuringEntity,
    ...(buyerLogoUrl ? { buyerLogoUrl } : {}),
    type: toTenderType(draft.procurementTypeId),
    status: 'OPEN',
    budget: Number(draft.estimatedBudget || draft.requirements.estimated_budget || draft.commercialItems.length * 5000000 || 100000000),
    currency: draft.currency || 'TZS',
    openingDate: draft.openingDate,
    closingDate: draft.submissionDate || new Date().toISOString().slice(0, 10),
    location: draft.location || 'Tanzania',
    description: summarizeDraft(draft),
    createdByCurrentUser: true,
    ownedByCurrentOrganization: true,
    canBid: false,
    hasDraftBid: false,
    hasSubmittedBid: false,
    isSaved: false,
    visibility: 'PUBLIC_MARKETPLACE',
    categories: draft.categories.length ? draft.categories : [draft.procurementTypeId]
  };
}

function summarizeDraft(draft: CreateTenderDraft) {
  const firstRequirement = Object.values(draft.requirements).find(Boolean);
  return draft.description || firstRequirement || draft.deliverables[0] || `Published ${draft.procurementTypeId} tender created in the React workflow.`;
}
