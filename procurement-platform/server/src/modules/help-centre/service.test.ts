/* Exercises help centre behavior so regressions are caught close to the domain workflow they protect. */
import { AccountType } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { allHelpFaqs, helpCategories } from './data/catalog.js';
import { matchFaq } from './matcher.js';
import { resetHelpCentreRateLimitState } from './rateLimit.js';
import { ModuleService } from './service.js';
import { validateHelpFaqs } from './validation.js';

class FakeRepository {
  auditEvents: any[] = [];

  health() {
    return Promise.resolve({ ready: true });
  }

  createAuditEvent(input: any) {
    this.auditEvents.push(input);
    return Promise.resolve(input);
  }
}

class FakeIdentity {
  requireSession(token?: string) {
    if (token !== 'supplier') {
      const error = new Error('Authentication is required.') as Error & { status?: number };
      error.status = 401;
      return Promise.reject(error);
    }

    return Promise.resolve({
      user: {
        id: 'user-1',
        accountType: AccountType.USER,
        organizationId: 'org-1',
        capabilities: ['SUPPLIER']
      }
    });
  }
}

describe('help centre module', () => {
  it('validates the complete FAQ knowledge base', () => {
    expect(allHelpFaqs).toHaveLength(300);
    expect(helpCategories).toHaveLength(30);
    expect(validateHelpFaqs(allHelpFaqs)).toEqual([]);
    for (const category of helpCategories) {
      expect(allHelpFaqs.filter((faq) => faq.categoryId === category.id)).toHaveLength(10);
    }
  });

  it('matches exact and alternative bid submission questions', () => {
    const exact = matchFaq(allHelpFaqs, { message: 'How do I submit a bid?' }, { capabilities: ['SUPPLIER'] });
    expect(exact?.faq.id).toBe('bid-submission-submit-bid');
    expect(exact?.confidence).toBeGreaterThanOrEqual(90);

    const alternative = matchFaq(allHelpFaqs, { message: 'Help me submit a bid.' }, { capabilities: ['SUPPLIER'] });
    expect(alternative?.faq.id).toBe('bid-submission-submit-bid');
  });

  it('handles punctuation, case, important keywords, category relevance, and weak matches', () => {
    expect(matchFaq(allHelpFaqs, { message: 'SUBMIT!!!   BID??' }, { capabilities: ['SUPPLIER'] })?.faq.id).toBe('bid-submission-submit-bid');
    expect(matchFaq(allHelpFaqs, { message: 'I need help with technical proposal documents', category: 'Bid preparation' }, { capabilities: ['SUPPLIER'] })?.faq.categoryId).toBe('bid-preparation');
    expect(matchFaq(allHelpFaqs, { message: 'tender' }, { capabilities: ['SUPPLIER'] })).toBeNull();
    expect(matchFaq(allHelpFaqs, { message: '   ' }, { capabilities: ['SUPPLIER'] })).toBeNull();
  });

  it('returns matched and fallback message responses with safe audit metadata', async () => {
    resetHelpCentreRateLimitState();
    const repository = new FakeRepository();
    const service = new ModuleService(repository as any, new FakeIdentity() as any);

    const matched = await service.message('supplier', { message: 'How do I submit a bid?', category: 'Bid submission', currentPath: '/help' });
    expect(matched).toMatchObject({
      success: true,
      matched: true,
      faqId: 'bid-submission-submit-bid',
      action: { path: '/bidding' }
    });
    expect(matched.steps.length).toBeGreaterThanOrEqual(10);
    expect(matched.relatedQuestions?.length).toBeGreaterThan(0);

    const fallback = await service.message(undefined, { message: 'zzzz unknown workflow', currentPath: '/help' });
    expect(fallback).toMatchObject({
      success: true,
      matched: false,
      action: { path: '/contact' }
    });
    expect(repository.auditEvents.map((event) => event.event)).toEqual(
      expect.arrayContaining(['help_centre.faq.matched', 'help_centre.faq.unmatched'])
    );
    expect(JSON.stringify(repository.auditEvents)).not.toContain('How do I submit a bid?');
  });

  it('lists categories, popular FAQs, category FAQs, suggestions, and individual FAQs', async () => {
    const service = new ModuleService(new FakeRepository() as any, new FakeIdentity() as any);

    await expect(service.status()).resolves.toMatchObject({ key: 'help-centre', faqCount: 300, categoryCount: 30 });
    expect(service.categories().categories).toHaveLength(30);
    expect(service.popular().faqs).toHaveLength(18);
    expect(service.byCategory('marketplace').faqs).toHaveLength(10);
    expect(service.suggestions({ q: 'submit bid', limit: 5 }).suggestions.length).toBeGreaterThan(0);
    expect(service.getFaq('bid-submission-submit-bid').title).toBe('How do I submit a bid?');
    expect(() => service.getFaq('missing')).toThrow();
  });
});

