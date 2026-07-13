import type {
  HelpFaq,
  HelpFaqCategory,
  HelpMessageResponse,
  HelpOrganizationCapability,
  HelpSessionContext,
  HelpUserRole
} from '@procurex/shared';

export const moduleDefinition = {
  key: 'help-centre',
  name: 'Help Centre',
  description: 'Deterministic ProcureX FAQ assistant and Help Centre knowledge base.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
  faqCount: number;
  categoryCount: number;
};

export type {
  HelpFaq,
  HelpFaqCategory,
  HelpMessageResponse,
  HelpOrganizationCapability,
  HelpSessionContext,
  HelpUserRole
};

export type HelpMessageInput = {
  message: string;
  category?: string;
  currentPath?: string;
};

export type MatchCandidate = {
  faq: HelpFaq;
  score: number;
  confidence: number;
  reasons: string[];
};

export type ValidationIssue = {
  faqId?: string;
  message: string;
};

