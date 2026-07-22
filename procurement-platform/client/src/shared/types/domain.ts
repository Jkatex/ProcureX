/* Defines shared TypeScript contracts that keep API payloads, state, and UI props aligned. */
import type { AccountType, FeatureGateMap, PermissionName, RiskLevel, ScreeningStatus, TrustTier, OrganizationCapability } from '@procurex/shared';

export type { AccountType, FeatureGateMap, PermissionName, RiskLevel, ScreeningStatus, TrustTier, OrganizationCapability };

export type SessionUser = {
  id: string;
  displayName: string;
  email: string;
  phone?: string | null;
  accountType: AccountType;
  organization: string;
  organizationId?: string;
  capabilities: OrganizationCapability[];
  permissions?: PermissionName[];
  trustTier?: TrustTier;
  riskLevel?: RiskLevel;
  featureGates?: FeatureGateMap;
  screeningStatus?: ScreeningStatus;
  trustRisk?: {
    trustTier: TrustTier;
    riskLevel: RiskLevel;
    screeningStatus: ScreeningStatus;
    score: number | null;
    reasons: string[];
    assessedAt: string | null;
    history: Array<{
      previousTier?: TrustTier | null;
      nextTier: TrustTier;
      riskLevel: RiskLevel;
      score: number;
      reasons: string[];
      createdAt: string;
    }>;
  };
  preferences?: {
    preferredLanguage: 'en' | 'sw';
    timezone: string;
  };
  location?: {
    region: string;
    district: string;
    ward: string;
  };
  verificationStatus: 'NOT_STARTED' | 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
};

export type Tender = {
  id: string;
  reference: string;
  title: string;
  organization: string;
  buyerLogoUrl?: string;
  type: 'GOODS' | 'WORKS' | 'SERVICE' | 'CONSULTANCY';
  status: 'DRAFT' | 'PUBLISHED' | 'OPEN' | 'EVALUATION' | 'AWARDED' | 'CLOSED';
  budget: number;
  currency: string;
  openingDate?: string;
  closingDate: string;
  location: string;
  description: string;
  createdByCurrentUser?: boolean;
  ownedByCurrentOrganization?: boolean;
  canBid?: boolean;
  hasDraftBid?: boolean;
  hasSubmittedBid?: boolean;
  isSaved?: boolean;
  visibility?: 'PUBLIC_MARKETPLACE' | 'INVITED' | 'PRIVATE' | string;
  categories: string[];
};

export type Bid = {
  id: string;
  tenderReference: string;
  supplier: string;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_EVALUATION' | 'AWARDED' | 'LOST';
  amount: number;
  score: number;
};

export type TimelineItem = {
  id: string;
  label: string;
  date: string;
  status: 'complete' | 'current' | 'pending';
};

export type WorkItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  nav: string;
  priority?: 'Low' | 'Normal' | 'High' | 'Urgent';
};

export type MessageItem = {
  id: string;
  subject: string;
  body: string;
  category: string;
  status: string;
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  tenderReference?: string;
};

export type RecordItem = {
  id: string;
  entityType: string;
  reference: string;
  title: string;
  status: string;
  owner: string;
  date: string;
};

export type AdminMetric = {
  label: string;
  value: string;
  note: string;
};
