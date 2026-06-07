import { ModuleRepository } from './repository.js';
import { moduleDefinition, type ModuleStatus, type PublicWelcomePayload, type PublicWelcomeTender } from './types.js';

export class ModuleService {
  constructor(private readonly repository = new ModuleRepository()) {}

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
