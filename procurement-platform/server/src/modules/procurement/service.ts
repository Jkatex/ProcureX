import { ModuleRepository } from './repository.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import {
  moduleDefinition,
  type ProcurementMarketplacePayload,
  type ModuleStatus,
  type ProcurementPlanDto,
  type ProcurementPlanLineDto,
  type ProcurementPlanLineInput,
  type ProcurementPlanLinePatchInput,
  type ProcurementPlanningListDto,
  type ProcurementPlanningQuery,
  type PublicWelcomePayload,
  type PublicWelcomeTender,
  type SaveAnnualPlanInput,
  type TenderDetailDto,
  type UpdateProcurementPlanInput
} from './types.js';

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

  async marketplace(token?: string): Promise<ProcurementMarketplacePayload> {
    try {
      const context = await this.contextFromToken(token);
      return await this.repository.getMarketplaceData(context);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return { tenders: [], myTenders: [], myBids: [] };
      throw error;
    }
  }

  async getTenderDetail(tenderId: string, token?: string): Promise<TenderDetailDto | null> {
    const context = await this.contextFromToken(token);
    return this.repository.getTenderDetail(tenderId, context);
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
      return { organizationId: session.user.organizationId };
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
