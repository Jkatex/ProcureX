import { PublicPageKey, PublicPageStatus } from '@prisma/client';

export const moduleDefinition = {
  key: 'public',
  name: 'Public Content',
  description: 'Published public page content, legal versions, and public policy metadata.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type PublicPageRouteKey = 'about-procurex' | 'privacy-policy' | 'terms-and-conditions';

export type PublicPageVersionDto = {
  id: string;
  pageKey: PublicPageRouteKey;
  version: string;
  status: PublicPageStatus;
  title: string;
  summary: string | null;
  content: {
    html?: string;
    [key: string]: unknown;
  };
  contentHash: string;
  effectiveAt: string;
  publishedAt: string | null;
  lastUpdated: string;
};

export type CurrentLegalVersionsDto = {
  terms: PublicPageVersionDto;
  privacy: PublicPageVersionDto;
};

export const routeKeyToPageKey: Record<PublicPageRouteKey, PublicPageKey> = {
  'about-procurex': PublicPageKey.ABOUT_PROCUREX,
  'privacy-policy': PublicPageKey.PRIVACY_POLICY,
  'terms-and-conditions': PublicPageKey.TERMS_AND_CONDITIONS
};

export const pageKeyToRouteKey: Record<PublicPageKey, PublicPageRouteKey> = {
  [PublicPageKey.ABOUT_PROCUREX]: 'about-procurex',
  [PublicPageKey.PRIVACY_POLICY]: 'privacy-policy',
  [PublicPageKey.TERMS_AND_CONDITIONS]: 'terms-and-conditions'
};
