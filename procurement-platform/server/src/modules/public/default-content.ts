import { PublicPageKey, PublicPageStatus } from '@prisma/client';
import { pageKeyToRouteKey, type PublicPageVersionDto } from './types.js';

const effectiveAt = '2026-06-06T00:00:00.000Z';

const metadata: Record<PublicPageKey, { title: string; summary: string }> = {
  [PublicPageKey.ABOUT_PROCUREX]: {
    title: 'About ProcureX',
    summary: 'ProcureX is a digital procurement platform for tendering, bidding, evaluation, awards, contracts, and records.'
  },
  [PublicPageKey.PRIVACY_POLICY]: {
    title: 'Privacy Policy',
    summary: 'How ProcureX collects, uses, stores, protects, and shares procurement platform information.'
  },
  [PublicPageKey.TERMS_AND_CONDITIONS]: {
    title: 'Terms and Conditions',
    summary: 'Rules, responsibilities, rights, and limitations for using the ProcureX procurement platform.'
  }
};

export function defaultPublicPageVersion(pageKey: PublicPageKey): PublicPageVersionDto {
  const pageMetadata = metadata[pageKey];

  return {
    id: `default-${pageKey.toLowerCase()}-2026-06-06`,
    pageKey: pageKeyToRouteKey[pageKey],
    version: '2026.06.06',
    status: PublicPageStatus.PUBLISHED,
    title: pageMetadata.title,
    summary: pageMetadata.summary,
    content: {},
    contentHash: 'default-content-fallback',
    effectiveAt,
    publishedAt: effectiveAt,
    lastUpdated: effectiveAt
  };
}
