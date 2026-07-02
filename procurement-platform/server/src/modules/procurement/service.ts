import { TenderStatus } from '@prisma/client';
import { ModuleRepository } from './repository.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import { isProductionRuntime } from '../../security/config.js';
import {
  type CloseTenderResponseDto,
  type CreateTenderInput,
  type CreateTenderResponseDto,
  moduleDefinition,
  type MarketplaceQuery,
  type ProcurementMarketplacePayload,
  type ModuleStatus,
  type PublishTenderResponseDto,
  type ProcurementPlanDto,
  type ProcurementPlanLineDto,
  type ProcurementPlanLineInput,
  type ProcurementPlanLinePatchInput,
  type ProcurementPlanningListDto,
  type ProcurementPlanningQuery,
  type PublicWelcomePayload,
  type PublicWelcomeTender,
  type SaveAnnualPlanInput,
  type SavedTendersPayload,
  type SaveTenderResponseDto,
  type TenderDetailDto,
  type UnsaveTenderResponseDto,
  type UpdateTenderInput,
  type UpdateTenderResponseDto,
  type UpdateProcurementPlanInput
} from './types.js';

export const MARKETPLACE_UNAVAILABLE_MESSAGE = 'Marketplace is temporarily unavailable. Please try again later.';
export const MARKETPLACE_UNAVAILABLE_CODE = 'MARKETPLACE_UNAVAILABLE';

function requestError(message: string, status = 400) {
  const error = new Error(message) as Error & { status?: number };
  error.status = status;
  return error;
}

function marketplaceUnavailableError() {
  const error = requestError(MARKETPLACE_UNAVAILABLE_MESSAGE, 503) as Error & { code?: string };
  error.code = MARKETPLACE_UNAVAILABLE_CODE;
  return error;
}

export class ModuleService {
  constructor(
    private readonly repository = new ModuleRepository(),
    private readonly identity = new IdentityService()
  ) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  async publicWelcome(): Promise<PublicWelcomePayload> {
    try {
      return this.mapWelcomeData(await this.repository.getWelcomeData());
    } catch {
      return defaultWelcomePayload;
    }
  }

  async marketplace(token?: string, query: MarketplaceQuery = defaultMarketplaceQuery): Promise<ProcurementMarketplacePayload> {
    try {
      const context = await this.contextFromToken(token);
      return await this.repository.getMarketplaceData(context, query);
    } catch (error) {
      if (isDatabaseUnavailable(error)) {
        if (!isProductionRuntime()) return emptyMarketplace(query);
        console.error('[procurement.marketplace] Database unavailable while loading marketplace.', error);
        throw marketplaceUnavailableError();
      }
      throw error;
    }
  }

  async getTenderDetail(tenderId: string, token?: string): Promise<TenderDetailDto | null> {
    const context = await this.contextFromToken(token);
    return this.repository.getTenderDetail(tenderId, context);
  }

  async createTender(token: string | undefined, input: CreateTenderInput): Promise<CreateTenderResponseDto> {
    const session = await this.identity.requirePermission(token, 'procurement.create');
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.createTender(input, { organizationId, userId: session.user.id });
  }

  async updateTender(tenderId: string, token: string | undefined, input: UpdateTenderInput): Promise<UpdateTenderResponseDto | null> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.updateTender(tenderId, input, { organizationId, userId: session.user.id });
  }

  async publishTender(tenderId: string, token: string | undefined): Promise<PublishTenderResponseDto> {
    const session = await this.identity.requirePermission(token, 'procurement.publish');
    const organizationId = requireOrganization(session.user.organizationId);
    const tender = await this.repository.getTenderForPublication(tenderId);
    if (!tender) throw requestError('Tender was not found.', 404);
    if (tender.buyerOrgId !== organizationId) throw requestError('Only the owner organization can publish this tender.', 403);
    assertTenderPublishable(tender);
    const published = await this.repository.publishTender(tenderId, organizationId);
    if (!published) throw requestError('Tender was not found.', 404);
    return published;
  }

  async closeTender(tenderId: string, token: string | undefined): Promise<CloseTenderResponseDto> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    const tender = await this.repository.getTenderForClose(tenderId);
    if (!tender) throw requestError('Tender was not found.', 404);
    if (tender.buyerOrgId !== organizationId) throw requestError('Only the owner organization can close this tender.', 403);
    assertTenderClosable(tender);
    const closed = await this.repository.closeTender(tenderId, organizationId);
    if (!closed) throw requestError('Tender was not found.', 404);
    return closed;
  }

  async saveTender(tenderId: string, token: string | undefined): Promise<SaveTenderResponseDto> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.saveTender(tenderId, { organizationId, userId: session.user.id });
  }

  async unsaveTender(tenderId: string, token: string | undefined): Promise<UnsaveTenderResponseDto> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.unsaveTender(tenderId, organizationId);
  }

  async savedTenders(token: string | undefined): Promise<SavedTendersPayload> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.getSavedTenders(organizationId);
  }

  async planning(query: ProcurementPlanningQuery): Promise<ProcurementPlanningListDto> {
    try {
      return await this.repository.listPlans(query);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyPlanningList(query);
      throw error;
    }
  }

  async planningSummary(query: ProcurementPlanningQuery) {
    const data = await this.planning({ ...query, page: 1, pageSize: 1 });
    return data.summary;
  }

  async getPlan(planId: string): Promise<ProcurementPlanDto | null> {
    return this.repository.getPlan(planId);
  }

  async saveAnnualPlan(input: SaveAnnualPlanInput): Promise<ProcurementPlanDto> {
    return this.repository.saveAnnualPlan(input);
  }

  async updatePlan(planId: string, input: UpdateProcurementPlanInput): Promise<ProcurementPlanDto | null> {
    return this.repository.updatePlan(planId, input);
  }

  async createPlanLine(planId: string, input: ProcurementPlanLineInput): Promise<ProcurementPlanLineDto | null> {
    return this.repository.createPlanLine(planId, input);
  }

  async updatePlanLine(lineId: string, input: ProcurementPlanLinePatchInput): Promise<ProcurementPlanLineDto | null> {
    return this.repository.updatePlanLine(lineId, input);
  }

  async deletePlanLine(lineId: string): Promise<ProcurementPlanLineDto | null> {
    return this.repository.deletePlanLine(lineId);
  }

  private async contextFromToken(token?: string) {
    if (!token) return {};
    try {
      const session = await this.identity.requireSession(token);
      return { organizationId: session.user.organizationId, userId: session.user.id };
    } catch {
      return {};
    }
  }

  private mapWelcomeData(data: WelcomeRepositoryData): PublicWelcomePayload {
    const participantCount = Math.max(data.participantCount, defaultWelcomePayload.stats.participantCount);
    const openTenderCount = Math.max(data.openTenderCount, defaultWelcomePayload.stats.openTenderCount);
    const verifiedProfileCompletionRate =
      data.participantCount > 0
        ? Math.min(
            100,
            Math.max(
              defaultWelcomePayload.stats.verifiedProfileCompletionRate,
              Math.round((data.verifiedUserCount / data.participantCount) * 1000) / 10
            )
          )
        : defaultWelcomePayload.stats.verifiedProfileCompletionRate;

    return {
      stats: {
        participantCount,
        participantLabel: formatParticipantLabel(participantCount),
        openTenderCount,
        verifiedProfileCompletionRate,
        activeWorkspaceLabel: defaultWelcomePayload.stats.activeWorkspaceLabel
      },
      featuredTenders: data.featuredTenders.length > 0 ? data.featuredTenders.map(mapTender) : defaultWelcomePayload.featuredTenders
    };
  }
}

type WelcomeRepositoryData = Awaited<ReturnType<ModuleRepository['getWelcomeData']>>;

function mapTender(tender: WelcomeRepositoryData['featuredTenders'][number]): PublicWelcomeTender {
  return {
    id: tender.id,
    reference: tender.reference,
    title: tender.title,
    buyerName: tender.buyerOrg.name,
    type: tender.type,
    status: tender.status,
    budget: tender.budget?.toString() ?? null,
    currency: tender.currency,
    location: tender.location,
    closingDate: tender.closingDate?.toISOString() ?? null,
    categories: tender.categories.map((category) => category.name)
  };
}

function formatParticipantLabel(count: number) {
  if (count >= 1000) return `Used by ${Math.floor(count / 1000).toLocaleString('en-US')},000+ participants`;
  return `Used by ${count.toLocaleString('en-US')}+ participants`;
}

const defaultWelcomePayload: PublicWelcomePayload = {
  stats: {
    participantCount: 2000,
    participantLabel: 'Used by 2,000+ participants',
    openTenderCount: 12,
    verifiedProfileCompletionRate: 98.4,
    activeWorkspaceLabel: 'Active workspace'
  },
  featuredTenders: [
    {
      id: 'welcome-featured-tender',
      reference: 'PX-OPEN-2026',
      title: 'Open procurement opportunities',
      buyerName: 'Verified procuring entities',
      type: 'OPEN_TENDER',
      status: 'OPEN',
      budget: null,
      currency: 'TZS',
      location: 'Tanzania',
      closingDate: null,
      categories: ['Goods', 'Services', 'Works']
    }
  ]
};

const defaultMarketplaceQuery: MarketplaceQuery = {
  search: '',
  type: '',
  budgetBand: '',
  status: '',
  sort: 'deadline',
  page: 1,
  limit: 20
};

function emptyMarketplace(query: MarketplaceQuery): ProcurementMarketplacePayload {
  return {
    tenders: [],
    myTenders: [],
    myBids: [],
    summary: {
      openTenders: 0,
      myTenders: 0,
      myBids: 0,
      totalBudgetValue: 0,
      categoryCounts: [],
      closingSoon: 0
    },
    pagination: {
      page: query.page,
      limit: query.limit,
      matching: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPreviousPage: false
    }
  };
}

function requireOrganization(organizationId?: string) {
  if (!organizationId) throw requestError('An organization profile is required.', 409);
  return organizationId;
}

function assertTenderPublishable(tender: {
  title: string;
  type: unknown;
  description: string | null;
  budget: unknown;
  status: TenderStatus;
  location: string | null;
  closingDate: Date | null;
  requirements: unknown;
}) {
  if (tender.status !== TenderStatus.DRAFT && tender.status !== TenderStatus.REVIEW) {
    throw requestError('Only draft or review tenders can be published.', 409);
  }
  if (!tender.title.trim()) throw requestError('Tender title is required before publishing.', 400);
  if (!tender.type) throw requestError('Tender type is required before publishing.', 400);
  if (!tender.description?.trim()) throw requestError('Tender description is required before publishing.', 400);
  if (Number(tender.budget ?? 0) <= 0) throw requestError('Tender budget is required before publishing.', 400);
  if (!tender.location?.trim()) throw requestError('Tender location is required before publishing.', 400);
  if (!tender.closingDate) throw requestError('Tender closing date is required before publishing.', 400);
  if (tender.closingDate.getTime() <= Date.now()) throw requestError('Tender closing date must be in the future.', 400);
  if (!hasRequirements(tender.requirements)) throw requestError('Tender requirements are required before publishing.', 400);
}

function assertTenderClosable(tender: { status: TenderStatus }) {
  if (tender.status !== TenderStatus.OPEN && tender.status !== TenderStatus.PUBLISHED) {
    throw requestError('Only open or published tenders can be closed.', 409);
  }
}

function hasRequirements(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length > 0);
}

function emptyPlanningList(query: ProcurementPlanningQuery): ProcurementPlanningListDto {
  return {
    plans: [],
    records: [],
    summary: {
      financialYear: query.financialYear || null,
      years: query.financialYear ? [query.financialYear] : [],
      totalPlans: 0,
      totalLines: 0,
      totalBudget: 0,
      byStatus: [],
      byCategory: []
    },
    totalPlans: 0,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: 1
  };
}

function isDatabaseUnavailable(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  return code === 'P1001' || code === 'P2024' || message.includes("can't reach database") || message.includes('database_url');
}
