import { ModuleRepository } from './repository.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import {
  moduleDefinition,
  type MarketplaceAnalyticsResponseDto,
  type ModuleStatus,
  type RecommendedTendersResponseDto,
  type SupplierRecommendationsResponseDto
} from './types.js';
import { requestError } from '../shared/apiErrors.js';

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

  async recommendedTenders(token: string | undefined): Promise<RecommendedTendersResponseDto> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    return this.repository.recommendedTenders({ organizationId, userId: session.user.id });
  }

  async marketplaceAnalytics(token: string | undefined): Promise<MarketplaceAnalyticsResponseDto> {
    await this.identity.requireSession(token);
    return this.repository.marketplaceAnalytics();
  }

  async supplierRecommendations(tenderId: string, token: string | undefined): Promise<SupplierRecommendationsResponseDto> {
    const session = await this.identity.requireSession(token);
    const organizationId = requireOrganization(session.user.organizationId);
    const recommendations = await this.repository.supplierRecommendations(tenderId, { organizationId, userId: session.user.id });
    if (!recommendations) throw requestError('Tender was not found.', 404);
    return recommendations;
  }
}

function requireOrganization(organizationId?: string) {
  if (!organizationId) throw requestError('An organization profile is required.', 409);
  return organizationId;
}

