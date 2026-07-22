/* Defines intelligence TypeScript contracts that keep API payloads, state, and UI props aligned. */
export const moduleDefinition = {
  key: 'intelligence',
  name: 'Intelligence',
  description: 'Market snapshots, price benchmarks, supplier match signals, and module registry data.'
} as const;

export type ModuleStatus = {
  key: string;
  name: string;
  status: 'ready';
  description: string;
};

export type RecommendedTenderRow = {
  id: string;
  title: string;
  organization: string;
  ownerOrganization: string;
  type: string;
  category: string;
  description: string;
  location: string;
  budget: number;
  status: string;
  reference: string;
  publishedAt: string;
  closingDate: string;
  createdByCurrentUser: boolean;
  isSaved: boolean;
  matchScore: number;
  matchReasons: string[];
};

export type RecommendedTendersResponseDto = {
  success: true;
  data: RecommendedTenderRow[];
};

export type SupplierRecommendationRow = {
  supplierOrgId: string;
  supplierName: string;
  matchScore: number;
  matchReasons: string[];
  categories: string[];
  locations: string[];
  capabilitySummary: string;
};

export type SupplierRecommendationsResponseDto = {
  success: true;
  data: SupplierRecommendationRow[];
};

export type AnalyticsBreakdownRow = {
  label: string;
  value: number;
  amount: number;
};

export type AnalyticsBudgetBand = {
  value: number;
  amount: number;
};

export type MarketplaceAnalyticsDto = {
  openTenders: number;
  publishedTenders: number;
  closingSoon: number;
  totalBudgetValue: number;
  averageTenderValue: number;
  tendersByType: AnalyticsBreakdownRow[];
  tendersByCategory: AnalyticsBreakdownRow[];
  tendersByLocation: AnalyticsBreakdownRow[];
  tendersByMonth: AnalyticsBreakdownRow[];
  budgetBands: {
    underHundredMillion: AnalyticsBudgetBand;
    hundredMillionToOneBillion: AnalyticsBudgetBand;
    billionPlus: AnalyticsBudgetBand;
  };
  topBuyerOrganizations: AnalyticsBreakdownRow[];
  competitionSignals: {
    averageBidsPerTender: number;
    tendersWithNoBids: number;
    highCompetitionTenders: number;
  };
};

export type MarketplaceAnalyticsResponseDto = {
  success: true;
  data: MarketplaceAnalyticsDto;
};

