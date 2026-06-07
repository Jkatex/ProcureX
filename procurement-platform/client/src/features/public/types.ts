export type PublicPageKey = 'welcome' | 'about' | 'privacy' | 'terms' | 'contact' | 'guest-marketplace';

export type WelcomeLandingStats = {
  participantCount: number;
  participantLabel: string;
  openTenderCount: number;
  verifiedProfileCompletionRate: number;
  activeWorkspaceLabel: string;
};

export type WelcomeLandingTender = {
  id: string;
  reference: string;
  title: string;
  buyerName: string;
  type: string;
  status: string;
  budget: string | null;
  currency: string;
  location: string | null;
  closingDate: string | null;
  categories: string[];
};

export type WelcomeLandingData = {
  stats: WelcomeLandingStats;
  featuredTenders: WelcomeLandingTender[];
};

export type PublicContentPageKey = 'about-procurex' | 'privacy-policy' | 'terms-and-conditions';

export type PublicPageVersion = {
  id: string;
  pageKey: PublicContentPageKey;
  version: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
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

export type CurrentLegalVersions = {
  terms: PublicPageVersion;
  privacy: PublicPageVersion;
};
