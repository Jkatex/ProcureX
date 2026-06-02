/* This file is generated from the ProcureX design prototype. Do not edit by hand. */

import type { ComponentType } from 'react';
import { WelcomeProcurexPage } from '@/features/public/components/procurex/WelcomeProcurexPage';
import { AboutProcurexPage } from '@/features/public/components/procurex/AboutProcurexPage';
import { PrivacyPolicyProcurexPage } from '@/features/public/components/procurex/PrivacyPolicyProcurexPage';
import { TermsAndConditionsProcurexPage } from '@/features/public/components/procurex/TermsAndConditionsProcurexPage';
import { ContactProcurexPage } from '@/features/public/components/procurex/ContactProcurexPage';
import { GuestMarketplaceProcurexPage } from '@/features/public/components/procurex/GuestMarketplaceProcurexPage';
import { RegisterProcurexPage } from '@/features/auth/components/procurex/RegisterProcurexPage';
import { SignInProcurexPage } from '@/features/auth/components/procurex/SignInProcurexPage';
import { RoleSelectionProcurexPage } from '@/features/auth/components/procurex/RoleSelectionProcurexPage';
import { IdentityVerificationProcurexPage } from '@/features/identity/components/procurex/IdentityVerificationProcurexPage';
import { AccountProfileProcurexPage } from '@/features/identity/components/procurex/AccountProfileProcurexPage';
import { AppLauncherProcurexPage } from '@/features/workspace/components/procurex/AppLauncherProcurexPage';
import { WorkspaceDashboardProcurexPage } from '@/features/workspace/components/procurex/WorkspaceDashboardProcurexPage';
import { TenderPlanningProcurexPage } from '@/features/tenderPlanning/components/procurex/TenderPlanningProcurexPage';
import { MarketplaceProcurexPage } from '@/features/procurement/components/procurex/MarketplaceProcurexPage';
import { CreateTenderProcurexPage } from '@/features/procurement/components/procurex/CreateTenderProcurexPage';
import { TenderPublicationProcurexPage } from '@/features/procurement/components/procurex/TenderPublicationProcurexPage';
import { TenderDetailsProcurexPage } from '@/features/procurement/components/procurex/TenderDetailsProcurexPage';
import { TenderDocumentProcurexPage } from '@/features/procurement/components/procurex/TenderDocumentProcurexPage';
import { SupplierTenderDetailProcurexPage } from '@/features/procurement/components/procurex/SupplierTenderDetailProcurexPage';
import { ProcurementGuideProcurexPage } from '@/features/procurement/components/procurex/ProcurementGuideProcurexPage';
import { BiddingWorkspaceProcurexPage } from '@/features/bidding/components/procurex/BiddingWorkspaceProcurexPage';
import { BidEvaluationProcurexPage } from '@/features/evaluation/components/procurex/BidEvaluationProcurexPage';
import { AwardingContractsProcurexPage } from '@/features/awardsContracts/components/procurex/AwardingContractsProcurexPage';
import { AwardRecommendationProcurexPage } from '@/features/awardsContracts/components/procurex/AwardRecommendationProcurexPage';
import { ContractNegotiationProcurexPage } from '@/features/awardsContracts/components/procurex/ContractNegotiationProcurexPage';
import { PostAwardTrackingProcurexPage } from '@/features/awardsContracts/components/procurex/PostAwardTrackingProcurexPage';
import { CommunicationCenterProcurexPage } from '@/features/communication/components/procurex/CommunicationCenterProcurexPage';
import { RecordsHistoryProcurexPage } from '@/features/records/components/procurex/RecordsHistoryProcurexPage';
import { AdminDashboardProcurexPage } from '@/features/admin/components/procurex/AdminDashboardProcurexPage';
import { AdminSearchProcurexPage } from '@/features/admin/components/procurex/AdminSearchProcurexPage';
import { AdminUsersProcurexPage } from '@/features/admin/components/procurex/AdminUsersProcurexPage';
import { AdminComplianceProcurexPage } from '@/features/admin/components/procurex/AdminComplianceProcurexPage';
import { AdminAnalyticsProcurexPage } from '@/features/admin/components/procurex/AdminAnalyticsProcurexPage';
import { AdminAuditProcurexPage } from '@/features/admin/components/procurex/AdminAuditProcurexPage';

export const procurexPageRegistry = {
  'welcome': WelcomeProcurexPage,
  'about-procurex': AboutProcurexPage,
  'privacy-policy': PrivacyPolicyProcurexPage,
  'terms-and-conditions': TermsAndConditionsProcurexPage,
  'contact': ContactProcurexPage,
  'guest-marketplace': GuestMarketplaceProcurexPage,
  'register': RegisterProcurexPage,
  'sign-in': SignInProcurexPage,
  'role-selection': RoleSelectionProcurexPage,
  'identity-verification': IdentityVerificationProcurexPage,
  'account-profile': AccountProfileProcurexPage,
  'app-launcher': AppLauncherProcurexPage,
  'workspace-dashboard': WorkspaceDashboardProcurexPage,
  'tender-planning': TenderPlanningProcurexPage,
  'marketplace': MarketplaceProcurexPage,
  'create-tender': CreateTenderProcurexPage,
  'tender-publication': TenderPublicationProcurexPage,
  'tender-details': TenderDetailsProcurexPage,
  'tender-document': TenderDocumentProcurexPage,
  'tender-detail': SupplierTenderDetailProcurexPage,
  'procurement-guide': ProcurementGuideProcurexPage,
  'bidding-workspace': BiddingWorkspaceProcurexPage,
  'bid-evaluation': BidEvaluationProcurexPage,
  'awarding-contracts': AwardingContractsProcurexPage,
  'award-recommendation': AwardRecommendationProcurexPage,
  'contract-negotiation': ContractNegotiationProcurexPage,
  'post-award-tracking': PostAwardTrackingProcurexPage,
  'communication-center': CommunicationCenterProcurexPage,
  'records-history': RecordsHistoryProcurexPage,
  'admin-dashboard': AdminDashboardProcurexPage,
  'admin-search': AdminSearchProcurexPage,
  'admin-users': AdminUsersProcurexPage,
  'admin-compliance': AdminComplianceProcurexPage,
  'admin-analytics': AdminAnalyticsProcurexPage,
  'admin-audit': AdminAuditProcurexPage
} satisfies Record<string, ComponentType>;

export type ProcurexPageKey = keyof typeof procurexPageRegistry;
