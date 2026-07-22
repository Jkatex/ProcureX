/* Supports the help centre server workflow with reusable logic kept close to the module that owns it. */
import type { HelpFaq, HelpSessionContext } from '@procurex/shared';
import { genericWeakTerms } from './constants.js';
import { meaningfulWords, normalizeHelpText } from './normalization.js';
import type { MatchCandidate } from './types.js';

export function matchFaq(
  faqs: HelpFaq[],
  input: { message: string; category?: string },
  context: HelpSessionContext = {}
): MatchCandidate | null {
  const normalizedMessage = normalizeHelpText(input.message);
  const inputWords = meaningfulWords(input.message);
  const uniqueWords = Array.from(new Set(inputWords));

  if (!normalizedMessage || uniqueWords.length === 0) return null;
  if (uniqueWords.length === 1 && genericWeakTerms.has(uniqueWords[0])) return null;

  const selectedCategory = normalizeHelpText(input.category ?? '');
  const candidates = faqs
    .filter((faq) => faq.enabled)
    .map((faq) => scoreFaq(faq, normalizedMessage, uniqueWords, selectedCategory, context))
    .filter((candidate) => candidate.score >= 45)
    .sort((a, b) => b.score - a.score || b.faq.priority - a.faq.priority);

  const best = candidates[0];
  if (!best) return null;
  if (best.score < 58 && !best.reasons.includes('exact-question') && !best.reasons.includes('phrase')) return null;
  return best;
}

function scoreFaq(
  faq: HelpFaq,
  normalizedMessage: string,
  uniqueWords: string[],
  selectedCategory: string,
  context: HelpSessionContext
): MatchCandidate {
  let score = 0;
  const reasons: string[] = [];
  const normalizedQuestions = [faq.title, ...faq.alternativeQuestions].map(normalizeHelpText);
  const normalizedTitle = normalizeHelpText(faq.title);
  const normalizedCategory = normalizeHelpText(`${faq.category} ${faq.categoryId}`);
  const normalizedSubcategory = normalizeHelpText(faq.subcategory);
  const keywordSet = new Set(faq.keywords.flatMap(meaningfulWords));
  const importantSet = new Set(faq.importantKeywords.flatMap(meaningfulWords));
  const faqWords = new Set([...meaningfulWords(faq.title), ...keywordSet]);

  if (normalizedQuestions.includes(normalizedMessage)) {
    score += 100;
    reasons.push('exact-question');
  } else if (normalizedQuestions.some((question) => question.length > 8 && normalizedMessage.includes(question))) {
    score += 90;
    reasons.push('configured-question');
  } else if (normalizedTitle.length > 8 && normalizedMessage.includes(normalizedTitle)) {
    score += 80;
    reasons.push('phrase');
  }

  const importantMatches = uniqueWords.filter((word) => importantSet.has(word));
  if (importantMatches.length > 0) {
    score += Math.min(70, importantMatches.length * 18 + 34);
    reasons.push('important-keywords');
  }

  const keywordMatches = uniqueWords.filter((word) => keywordSet.has(word));
  const wordMatches = uniqueWords.filter((word) => faqWords.has(word));
  const overlap = new Set([...keywordMatches, ...wordMatches]);
  if (overlap.size > 0) {
    score += Math.min(44, overlap.size * 8);
    reasons.push('word-overlap');
  }

  if (selectedCategory && (normalizedCategory.includes(selectedCategory) || selectedCategory.includes(normalizedCategory) || normalizedSubcategory.includes(selectedCategory))) {
    score += 15;
    reasons.push('category');
  }

  const userRoles = rolesForContext(context);
  if (faq.userRoles.some((role) => userRoles.includes(role))) {
    score += 10;
    reasons.push('role');
  }

  return {
    faq,
    score,
    confidence: Math.min(100, Math.round(score)),
    reasons
  };
}

function rolesForContext(context: HelpSessionContext) {
  if (context.accountType === 'ADMIN') return ['ADMIN'];
  const roles = ['PUBLIC'];
  if (context.capabilities?.includes('BUYER')) roles.push('BUYER');
  if (context.capabilities?.includes('SUPPLIER')) roles.push('SUPPLIER');
  return roles;
}

