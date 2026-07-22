/* Coordinates public business rules across repositories and peer modules before data leaves the server boundary. */
import { PublicPageKey } from '@prisma/client';
import { ModuleRepository } from './repository.js';
import { defaultPublicPageVersion } from './default-content.js';
import {
  moduleDefinition,
  pageKeyToRouteKey,
  routeKeyToPageKey,
  type CurrentLegalVersionsDto,
  type ModuleStatus,
  type PublicPageRouteKey,
  type PublicPageVersionDto
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

  async getPage(routeKey: PublicPageRouteKey): Promise<PublicPageVersionDto> {
    return this.getPageByKey(routeKeyToPageKey[routeKey]);
  }

  async currentLegalVersions(): Promise<CurrentLegalVersionsDto> {
    const [terms, privacy] = await Promise.all([
      this.getPageByKey(PublicPageKey.TERMS_AND_CONDITIONS),
      this.getPageByKey(PublicPageKey.PRIVACY_POLICY)
    ]);

    return { terms, privacy };
  }

  private async getPageByKey(pageKey: PublicPageKey): Promise<PublicPageVersionDto> {
    try {
      const page = await this.repository.latestPublishedPage(pageKey);
      return page ? toDto(page) : defaultPublicPageVersion(pageKey);
    } catch {
      return defaultPublicPageVersion(pageKey);
    }
  }
}

type PublicPageRecord = NonNullable<Awaited<ReturnType<ModuleRepository['latestPublishedPage']>>>;

function toContent(value: PublicPageRecord['content']): PublicPageVersionDto['content'] {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as PublicPageVersionDto['content']) : {};
}

function toDto(page: PublicPageRecord): PublicPageVersionDto {
  return {
    id: page.id,
    pageKey: pageKeyToRouteKey[page.pageKey],
    version: page.version,
    status: page.status,
    title: page.title,
    summary: page.summary,
    content: toContent(page.content),
    contentHash: page.contentHash,
    effectiveAt: page.effectiveAt.toISOString(),
    publishedAt: page.publishedAt?.toISOString() ?? null,
    lastUpdated: page.updatedAt.toISOString()
  };
}
