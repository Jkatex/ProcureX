import { AccountType, AuditSeverity } from '@prisma/client';
import type { HelpFaq, HelpMessageResponse, HelpSessionContext, HelpUserRole } from '@procurex/shared';
import { auditPayload, type RequestAuditContext } from '../shared/audit.js';
import { ModuleService as IdentityService } from '../identity/service.js';
import { helpCategories } from './constants.js';
import { allHelpFaqs } from './data/catalog.js';
import { matchFaq } from './matcher.js';
import { normalizeHelpText } from './normalization.js';
import { ModuleRepository } from './repository.js';
import { assertValidHelpFaqs } from './validation.js';
import { moduleDefinition, type HelpMessageInput, type ModuleStatus } from './types.js';
import { requestError } from '../shared/apiErrors.js';

assertValidHelpFaqs(allHelpFaqs);

export class ModuleService {
  constructor(
    private readonly repository = new ModuleRepository(),
    private readonly identity = new IdentityService()
  ) {}

  async status(): Promise<ModuleStatus> {
    await this.repository.health();
    return {
      ...moduleDefinition,
      status: 'ready',
      faqCount: allHelpFaqs.length,
      categoryCount: helpCategories.length
    };
  }

  categories() {
    return { categories: helpCategories };
  }

  listFaqs(query: { category?: string; role?: HelpUserRole; q?: string } = {}) {
    const category = normalizeHelpText(query.category ?? '');
    const search = normalizeHelpText(query.q ?? '');
    const faqs = allHelpFaqs.filter((faq) => {
      if (!faq.enabled) return false;
      if (query.role && !faq.userRoles.includes(query.role)) return false;
      if (category && normalizeHelpText(`${faq.categoryId} ${faq.category}`).indexOf(category) === -1) return false;
      if (search && normalizeHelpText(`${faq.title} ${faq.summary} ${faq.keywords.join(' ')}`).indexOf(search) === -1) return false;
      return true;
    });
    return { faqs, total: faqs.length };
  }

  getFaq(faqId: string) {
    const faq = allHelpFaqs.find((item) => item.id === faqId && item.enabled);
    if (!faq) throw requestError('Help Centre FAQ was not found.', 404);
    return faq;
  }

  popular() {
    return { faqs: allHelpFaqs.filter((faq) => faq.enabled).sort((a, b) => b.priority - a.priority).slice(0, 18), total: 18 };
  }

  byCategory(categoryId: string) {
    const category = helpCategories.find((item) => item.id === categoryId);
    if (!category) throw requestError('Help Centre category was not found.', 404);
    const faqs = allHelpFaqs.filter((faq) => faq.enabled && faq.categoryId === categoryId).sort((a, b) => b.priority - a.priority);
    return { category, faqs, total: faqs.length };
  }

  suggestions(query: { q?: string; category?: string; limit?: number }) {
    const normalized = normalizeHelpText(query.q ?? '');
    const category = normalizeHelpText(query.category ?? '');
    const limit = query.limit ?? 8;
    const suggestions = allHelpFaqs
      .filter((faq) => faq.enabled)
      .filter((faq) => !category || normalizeHelpText(`${faq.categoryId} ${faq.category}`).includes(category))
      .filter((faq) => !normalized || normalizeHelpText(`${faq.title} ${faq.keywords.join(' ')}`).includes(normalized))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, limit)
      .map((faq) => ({ faqId: faq.id, title: faq.title }));

    return { suggestions };
  }

  async message(token: string | undefined, input: HelpMessageInput, audit?: RequestAuditContext): Promise<HelpMessageResponse> {
    const session = await this.optionalSession(token);
    const context = session?.user
      ? {
          accountType: session.user.accountType,
          organizationId: session.user.organizationId,
          capabilities: session.user.capabilities?.filter((item): item is 'BUYER' | 'SUPPLIER' => item === 'BUYER' || item === 'SUPPLIER') ?? []
        }
      : {};
    const candidate = matchFaq(allHelpFaqs, input, context);
    const response = candidate ? matchedResponse(candidate.faq, candidate.confidence) : fallbackResponse(Boolean(session?.user));

    await this.safeAudit(session?.user, response, input, audit);
    return response;
  }

  private async optionalSession(token?: string) {
    if (!token) return null;
    try {
      return await this.identity.requireSession(token);
    } catch {
      return null;
    }
  }

  private async safeAudit(
    user: { id: string; accountType: AccountType; organizationId?: string; capabilities?: string[] } | undefined,
    response: HelpMessageResponse,
    input: HelpMessageInput,
    audit?: RequestAuditContext
  ) {
    try {
      await this.repository.createAuditEvent({
        actorUserId: user?.id,
        ownerOrgId: user?.organizationId,
        event: response.matched ? 'help_centre.faq.matched' : 'help_centre.faq.unmatched',
        entityType: 'help_centre_faq',
        entityRef: response.faqId,
        severity: AuditSeverity.INFO,
        payload: auditPayload({
          ...audit,
          details: {
            matched: response.matched,
            faqId: response.faqId,
            category: response.category,
            subcategory: response.subcategory,
            confidence: response.confidence,
            selectedCategory: input.category,
            currentPath: input.currentPath,
            accountType: user?.accountType,
            capabilities: user?.capabilities
          }
        })
      });
    } catch {
      // Help responses must not depend on audit storage availability.
    }
  }
}

function matchedResponse(faq: HelpFaq, confidence: number): HelpMessageResponse {
  return {
    success: true,
    matched: true,
    confidence,
    faqId: faq.id,
    title: faq.title,
    category: faq.category,
    categoryId: faq.categoryId,
    subcategory: faq.subcategory,
    summary: faq.summary,
    steps: faq.steps,
    notes: faq.notes,
    warnings: faq.warnings,
    relatedQuestions: faq.relatedFaqIds
      .map((faqId) => allHelpFaqs.find((item) => item.id === faqId && item.enabled))
      .filter((item): item is HelpFaq => Boolean(item))
      .map((item) => ({ faqId: item.id, title: item.title })),
    action: faq.action
  };
}

function fallbackResponse(signedIn: boolean): HelpMessageResponse {
  return {
    success: true,
    matched: false,
    summary: 'I could not find an approved Help Centre answer for that question.',
    steps: [
      'Try asking the question with fewer words.',
      'Select the closest Help Centre category.',
      'Open a popular or related question.',
      signedIn ? 'Use Contact Support if you still need account-specific assistance.' : 'Use Contact Support if you still need assistance.'
    ],
    notes: ['The Help Assistant provides platform guidance only and cannot make procurement decisions.'],
    warnings: ['Do not include passwords, verification codes, bid prices, bank details, or confidential documents in Help Centre questions.'],
    relatedQuestions: allHelpFaqs.slice(0, 4).map((faq) => ({ faqId: faq.id, title: faq.title })),
    action: signedIn ? { label: 'Contact Support', path: '/support' } : { label: 'Contact Support', path: '/contact' }
  };
}

