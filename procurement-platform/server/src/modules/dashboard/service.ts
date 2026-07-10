import { ModuleRepository } from './repository.js';
import {
  moduleDefinition,
  type DashboardQuery,
  type ModuleStatus,
  type WorkspaceDashboardDto
} from './types.js';

export class ModuleService {
  constructor(private readonly repository = new ModuleRepository()) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();

    return {
      ...moduleDefinition,
      status: 'ready'
    };
  }

  async workspaceDashboard(query: DashboardQuery): Promise<WorkspaceDashboardDto> {
    try {
      return await this.repository.workspaceDashboard(query);
    } catch (error) {
      if (isDatabaseUnavailable(error)) return emptyDashboard();
      throw error;
    }
  }
}

function emptyDashboard(): WorkspaceDashboardDto {
  return {
    summary: {
      urgentCount: 0,
      workflowCount: 0,
      unreadMessages: 0,
      myTenders: 0,
      myBids: 0,
      recordedValue: 0,
      currency: 'TZS',
      complianceStatus: 'Clear'
    },
    executive: {
      transactionValue: 0,
      completedOrders: 0,
      activeOrders: 0,
      orderSuccessRate: 0,
      transactionGrowthRate: 0,
      averageOrderValue: 0,
      currency: 'TZS'
    },
    pipeline: [
      { stage: 'Draft', count: 0, route: '/procurement/create-tender' },
      { stage: 'Published', count: 0, route: '/procurement/marketplace' },
      { stage: 'Evaluation', count: 0, route: '/evaluation' },
      { stage: 'Award', count: 0, route: '/awards-contracts' },
      { stage: 'Contract', count: 0, route: '/awards-contracts/negotiation' },
      { stage: 'Completed', count: 0, route: '/records' }
    ],
    metrics: [
      { label: 'My tenders', value: '0', note: 'Tenders created by the selected organization.' },
      { label: 'My bids', value: '0', note: 'Bid drafts and submitted opportunities.' },
      { label: 'Recorded value', value: 'TZS 0', note: 'Plan, tender, bid, award, and contract value.' },
      { label: 'Unread messages', value: '0', note: 'Unread communication owned by this mailbox.' }
    ],
    actionQueue: [],
    deadlines: [],
    activeWork: [],
    generatedAt: new Date().toISOString()
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
