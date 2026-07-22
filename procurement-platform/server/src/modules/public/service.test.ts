/* Exercises public behavior so regressions are caught close to the domain workflow they protect. */
import { PublicPageKey, PublicPageStatus } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { ModuleService } from './service.js';

function pageRecord(pageKey: PublicPageKey, title: string) {
  return {
    id: `${pageKey}-id`,
    pageKey,
    version: '2026.06.06',
    status: PublicPageStatus.PUBLISHED,
    title,
    summary: `${title} summary`,
    content: { html: `<div>${title}</div>` },
    contentHash: `${pageKey}-hash`,
    effectiveAt: new Date('2026-06-06T00:00:00.000Z'),
    publishedAt: new Date('2026-06-06T00:00:00.000Z'),
    createdAt: new Date('2026-06-06T00:00:00.000Z'),
    updatedAt: new Date('2026-06-07T00:00:00.000Z')
  };
}

describe('public content service', () => {
  it('returns a latest published public page DTO', async () => {
    const service = new ModuleService({
      health: async () => ({ ready: true }),
      latestPublishedPage: async (pageKey: PublicPageKey) => pageRecord(pageKey, 'About ProcureX')
    } as any);

    const page = await service.getPage('about-procurex');

    expect(page).toMatchObject({
      id: 'ABOUT_PROCUREX-id',
      pageKey: 'about-procurex',
      version: '2026.06.06',
      title: 'About ProcureX',
      content: { html: '<div>About ProcureX</div>' },
      lastUpdated: '2026-06-07T00:00:00.000Z'
    });
  });

  it('returns metadata-only fallback content when repository access fails', async () => {
    const service = new ModuleService({
      health: async () => ({ ready: true }),
      latestPublishedPage: async () => {
        throw new Error('database unavailable');
      }
    } as any);

    const page = await service.getPage('privacy-policy');

    expect(page).toMatchObject({
      pageKey: 'privacy-policy',
      version: '2026.06.06',
      title: 'Privacy Policy',
      content: {}
    });
  });

  it('returns current legal versions for terms and privacy', async () => {
    const service = new ModuleService({
      health: async () => ({ ready: true }),
      latestPublishedPage: async (pageKey: PublicPageKey) =>
        pageRecord(pageKey, pageKey === PublicPageKey.PRIVACY_POLICY ? 'Privacy Policy' : 'Terms and Conditions')
    } as any);

    const legal = await service.currentLegalVersions();

    expect(legal.terms.pageKey).toBe('terms-and-conditions');
    expect(legal.privacy.pageKey).toBe('privacy-policy');
    expect(legal.terms.id).toBe('TERMS_AND_CONDITIONS-id');
    expect(legal.privacy.id).toBe('PRIVACY_POLICY-id');
  });
});
