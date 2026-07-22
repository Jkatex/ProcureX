/* Supports the help centre server workflow with reusable logic kept close to the module that owns it. */
import type { HelpFaq, HelpFaqAction, HelpFaqCategory, HelpUserRole } from '@procurex/shared';

export type TopicDefinition = {
  slug: string;
  title: string;
  subcategory: string;
  role?: HelpUserRole;
  summary: string;
  keywords: string[];
  importantKeywords: string[];
  action?: HelpFaqAction;
  notes?: string[];
  warnings?: string[];
};

export function createCategoryFaqs(category: HelpFaqCategory, topics: TopicDefinition[]): HelpFaq[] {
  return topics.map((topic, index) => {
    const id = `${category.id}-${topic.slug}`;
    const role = topic.role ?? (category.roles.includes('PUBLIC') ? 'PUBLIC' : category.roles[0]);
    const action = topic.action;
    const relatedFaqIds = [topics[(index + 1) % topics.length], topics[(index + 2) % topics.length]]
      .filter(Boolean)
      .map((related) => `${category.id}-${related.slug}`);

    return {
      id,
      category: category.title,
      categoryId: category.id,
      subcategory: topic.subcategory,
      title: topic.title,
      summary: topic.summary,
      userRoles: Array.from(new Set<HelpUserRole>(['PUBLIC', role].filter((item): item is HelpUserRole => item === 'PUBLIC' || Boolean(item)))),
      alternativeQuestions: alternativeQuestions(topic.title),
      keywords: Array.from(new Set([...topic.keywords, category.title, topic.subcategory, topic.slug.replace(/-/g, ' ')])),
      importantKeywords: topic.importantKeywords,
      steps: buildSteps(category, topic),
      notes: topic.notes ?? defaultNotes(category, topic),
      warnings: topic.warnings ?? defaultWarnings(topic),
      relatedFaqIds,
      ...(action ? { action } : {}),
      enabled: true,
      priority: category.priority - index
    };
  });
}

function alternativeQuestions(title: string) {
  const plain = title.replace(/\?$/, '');
  return [title, plain, `Where do I ${plain.charAt(0).toLowerCase()}${plain.slice(1)}?`, `Help me ${plain.charAt(0).toLowerCase()}${plain.slice(1)}.`];
}

function buildSteps(category: HelpFaqCategory, topic: TopicDefinition) {
  const page = topic.action?.label.replace(/^Open\s+/i, '') ?? category.title;
  const roleLine =
    topic.role === 'BUYER'
      ? 'Confirm that your company has buyer access for this workflow.'
      : topic.role === 'SUPPLIER'
        ? 'Confirm that your company has supplier access for this workflow.'
        : 'Confirm that you are using the correct ProcureX account or public page for this task.';

  return [
    topic.summary,
    roleLine,
    `Open ${page} from the Help Centre action button or the relevant ProcureX navigation link.`,
    'Review the page heading, status labels, and any validation messages before entering new information.',
    'Select the relevant record, draft, tender, bid, contract, invoice, message, or account section for your task.',
    'Enter only accurate business information and attach only documents requested by the page.',
    'Use Save Draft or the page equivalent when you need to pause and continue later.',
    'Correct required fields, expired documents, unsupported files, missing declarations, or date warnings before submission.',
    'Select the page confirmation button only when the information is complete and reviewed by the responsible user.',
    'After confirmation, return to the same module, dashboard, records, notifications, or Communication Centre to check the updated status.'
  ];
}

function defaultNotes(category: HelpFaqCategory, topic: TopicDefinition) {
  return [
    `${category.title} guidance is based on ProcureX platform workflow names and does not replace your organization approval process.`,
    topic.action ? `The action button only opens ${topic.action.path}; it does not submit, approve, sign, award, invoice, or pay anything.` : 'If you cannot access the page, check your registration, verification status, and organization capability.'
  ];
}

function defaultWarnings(topic: TopicDefinition) {
  return [
    'Do not upload confidential or personal documents unless the selected ProcureX page specifically requests them.',
    topic.role === 'SUPPLIER'
      ? 'Supplier actions are normally restricted by tender deadlines and published requirements.'
      : topic.role === 'BUYER'
        ? 'Buyer actions may affect published procurement records, so review drafts and approvals carefully.'
        : 'The Help Assistant provides platform guidance only and cannot make procurement decisions.'
  ];
}

