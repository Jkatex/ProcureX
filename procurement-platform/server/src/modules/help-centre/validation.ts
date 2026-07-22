/* Supports the help centre server workflow with reusable logic kept close to the module that owns it. */
import type { HelpFaq } from '@procurex/shared';
import { approvedHelpActionPaths, helpCategories } from './constants.js';
import type { ValidationIssue } from './types.js';

const validRoles = new Set(['PUBLIC', 'BUYER', 'SUPPLIER', 'ADMIN']);
const validCategoryIds = new Set(helpCategories.map((category) => category.id));
const validActionPaths = new Set<string>(approvedHelpActionPaths);

export function validateHelpFaqs(faqs: HelpFaq[]) {
  const issues: ValidationIssue[] = [];
  const byId = new Map<string, HelpFaq>();
  const alternativeQuestionOwners = new Map<string, string>();

  for (const faq of faqs) {
    if (byId.has(faq.id)) issues.push({ faqId: faq.id, message: 'Duplicate FAQ ID.' });
    byId.set(faq.id, faq);

    if (!faq.title.trim()) issues.push({ faqId: faq.id, message: 'FAQ title is empty.' });
    if (!faq.summary.trim()) issues.push({ faqId: faq.id, message: 'FAQ summary is empty.' });
    if (!validCategoryIds.has(faq.categoryId)) issues.push({ faqId: faq.id, message: 'FAQ category is invalid.' });
    if (faq.alternativeQuestions.length === 0) issues.push({ faqId: faq.id, message: 'FAQ has no alternative questions.' });
    if (faq.keywords.length === 0) issues.push({ faqId: faq.id, message: 'FAQ has no keywords.' });
    if (faq.steps.length === 0) issues.push({ faqId: faq.id, message: 'FAQ has no steps.' });
    if (faq.notes.some((item) => !item.trim())) issues.push({ faqId: faq.id, message: 'FAQ has an empty note.' });
    if (faq.warnings.some((item) => !item.trim())) issues.push({ faqId: faq.id, message: 'FAQ has an empty warning.' });
    if (faq.userRoles.some((role) => !validRoles.has(role))) issues.push({ faqId: faq.id, message: 'FAQ role is invalid.' });
    if (faq.action && !validActionPaths.has(faq.action.path)) issues.push({ faqId: faq.id, message: `FAQ action path is invalid: ${faq.action.path}` });

    for (const question of faq.alternativeQuestions) {
      const normalized = question.trim().toLowerCase();
      if (!normalized) issues.push({ faqId: faq.id, message: 'FAQ has an empty alternative question.' });
      const owner = alternativeQuestionOwners.get(normalized);
      if (owner && owner !== faq.id) issues.push({ faqId: faq.id, message: `Duplicate alternative question also used by ${owner}.` });
      alternativeQuestionOwners.set(normalized, faq.id);
    }
  }

  for (const faq of faqs) {
    for (const relatedId of faq.relatedFaqIds) {
      const related = byId.get(relatedId);
      if (!related) issues.push({ faqId: faq.id, message: `Broken related FAQ reference: ${relatedId}` });
      else if (!related.enabled) issues.push({ faqId: faq.id, message: `Related FAQ is disabled: ${relatedId}` });
    }
  }

  if (faqs.filter((faq) => faq.enabled).length < 250) {
    issues.push({ message: 'Help Centre must contain at least 250 enabled FAQs.' });
  }

  for (const category of helpCategories) {
    if (!faqs.some((faq) => faq.categoryId === category.id)) {
      issues.push({ message: `Category has no FAQs: ${category.id}` });
    }
  }

  return issues;
}

export function assertValidHelpFaqs(faqs: HelpFaq[]) {
  const issues = validateHelpFaqs(faqs);
  if (issues.length > 0) {
    const details = issues.map((issue) => `${issue.faqId ? `${issue.faqId}: ` : ''}${issue.message}`).join('\n');
    throw new Error(`Help Centre FAQ data is invalid:\n${details}`);
  }
}

