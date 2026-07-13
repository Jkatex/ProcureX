export const helpUserRoles = ['PUBLIC', 'BUYER', 'SUPPLIER', 'ADMIN'] as const;

export type HelpUserRole = (typeof helpUserRoles)[number];
export type HelpOrganizationCapability = 'BUYER' | 'SUPPLIER';

export type HelpFaqAction = {
  label: string;
  path: string;
};

export type HelpFaq = {
  id: string;
  category: string;
  categoryId: string;
  subcategory: string;
  title: string;
  summary: string;
  userRoles: HelpUserRole[];
  alternativeQuestions: string[];
  keywords: string[];
  importantKeywords: string[];
  steps: string[];
  notes: string[];
  warnings: string[];
  relatedFaqIds: string[];
  action?: HelpFaqAction;
  enabled: boolean;
  priority: number;
};

export type HelpFaqCategory = {
  id: string;
  title: string;
  description: string;
  subcategories: string[];
  roles: HelpUserRole[];
  priority: number;
};

export type HelpRelatedQuestion = {
  faqId: string;
  title: string;
};

export type HelpMessageRequest = {
  message: string;
  category?: string;
  currentPath?: string;
};

export type HelpMessageResponse = {
  success: true;
  matched: boolean;
  confidence?: number;
  faqId?: string;
  title?: string;
  category?: string;
  categoryId?: string;
  subcategory?: string;
  summary: string;
  steps: string[];
  notes?: string[];
  warnings?: string[];
  relatedQuestions?: HelpRelatedQuestion[];
  action?: HelpFaqAction;
};

export type HelpFaqListResponse = {
  faqs: HelpFaq[];
  total: number;
};

export type HelpCategoryListResponse = {
  categories: HelpFaqCategory[];
};

export type HelpSuggestionResponse = {
  suggestions: HelpRelatedQuestion[];
};

export type HelpSessionContext = {
  accountType?: 'USER' | 'ADMIN';
  organizationId?: string;
  capabilities?: HelpOrganizationCapability[];
};
