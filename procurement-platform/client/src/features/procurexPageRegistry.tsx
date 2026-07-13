/* This file is generated from the ProcureX design prototype. Do not edit by hand. */

import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type ProcurexPageComponent = LazyExoticComponent<ComponentType>;

export const procurexPageRegistry = {
  'welcome': lazy(() => import('@/features/public/components/procurex/WelcomeProcurexPage').then((module) => ({ default: module.WelcomeProcurexPage }))),
  'about-procurex': lazy(() => import('@/features/public/components/procurex/AboutProcurexPage').then((module) => ({ default: module.AboutProcurexPage }))),
  'privacy-policy': lazy(() => import('@/features/public/components/procurex/PrivacyPolicyProcurexPage').then((module) => ({ default: module.PrivacyPolicyProcurexPage }))),
  'terms-and-conditions': lazy(() => import('@/features/public/components/procurex/TermsAndConditionsProcurexPage').then((module) => ({ default: module.TermsAndConditionsProcurexPage }))),
  'contact': lazy(() => import('@/features/public/components/procurex/ContactProcurexPage').then((module) => ({ default: module.ContactProcurexPage }))),
  'guest-marketplace': lazy(() => import('@/features/public/components/procurex/GuestMarketplaceProcurexPage').then((module) => ({ default: module.GuestMarketplaceProcurexPage }))),
  'register': lazy(() => import('@/features/auth/components/procurex/RegisterProcurexPage').then((module) => ({ default: module.RegisterProcurexPage }))),
  'sign-in': lazy(() => import('@/features/auth/components/procurex/SignInProcurexPage').then((module) => ({ default: module.SignInProcurexPage }))),
  'identity-verification': lazy(() => import('@/features/identity/components/procurex/IdentityVerificationProcurexPage').then((module) => ({ default: module.IdentityVerificationProcurexPage }))),
  'identity-security-keyphrase': lazy(() => import('@/features/identity/components/procurex/IdentitySecurityKeyphraseProcurexPage').then((module) => ({ default: module.IdentitySecurityKeyphraseProcurexPage }))),
  'account-profile': lazy(() => import('@/features/identity/components/procurex/AccountProfileProcurexPage').then((module) => ({ default: module.AccountProfileProcurexPage }))),
  'app-launcher': lazy(() => import('@/features/workspace/components/procurex/AppLauncherProcurexPage').then((module) => ({ default: module.AppLauncherProcurexPage }))),
  'workspace-dashboard': lazy(() => import('@/features/workspace/components/procurex/WorkspaceDashboardProcurexPage').then((module) => ({ default: module.WorkspaceDashboardProcurexPage }))),
  'tender-planning': lazy(() => import('@/features/tenderPlanning/components/procurex/TenderPlanningProcurexPage').then((module) => ({ default: module.TenderPlanningProcurexPage }))),
  'marketplace': lazy(() => import('@/features/procurement/components/procurex/MarketplaceProcurexPage').then((module) => ({ default: module.MarketplaceProcurexPage }))),
  'create-tender': lazy(() => import('@/features/procurement/components/procurex/CreateTenderProcurexPage').then((module) => ({ default: module.CreateTenderProcurexPage }))),
  'tender-publication': lazy(() => import('@/features/procurement/components/procurex/TenderPublicationProcurexPage').then((module) => ({ default: module.TenderPublicationProcurexPage }))),
  'tender-details': lazy(() => import('@/features/procurement/components/procurex/TenderDetailsProcurexPage').then((module) => ({ default: module.TenderDetailsProcurexPage }))),
  'tender-document': lazy(() => import('@/features/procurement/components/procurex/TenderDocumentProcurexPage').then((module) => ({ default: module.TenderDocumentProcurexPage }))),
  'tender-detail': lazy(() => import('@/features/procurement/components/procurex/SupplierTenderDetailProcurexPage').then((module) => ({ default: module.SupplierTenderDetailProcurexPage }))),
  'procurement-guide': lazy(() => import('@/features/procurement/components/procurex/ProcurementGuideProcurexPage').then((module) => ({ default: module.ProcurementGuideProcurexPage }))),
  'bidding-workspace': lazy(() => import('@/features/bidding/components/procurex/BiddingWorkspaceProcurexPage').then((module) => ({ default: module.BiddingWorkspaceProcurexPage }))),
  'bid-evaluation': lazy(() => import('@/features/evaluation/components/procurex/BidEvaluationProcurexPage').then((module) => ({ default: module.BidEvaluationProcurexPage }))),
  'awarding-contracts': lazy(() => import('@/features/awardsContracts/components/procurex/AwardingContractsProcurexPage').then((module) => ({ default: module.AwardingContractsProcurexPage }))),
  'award-recommendation': lazy(() => import('@/features/awardsContracts/components/procurex/AwardRecommendationProcurexPage').then((module) => ({ default: module.AwardRecommendationProcurexPage }))),
  'award-response': lazy(() => import('@/features/awardsContracts/components/procurex/AwardResponseProcurexPage').then((module) => ({ default: module.AwardResponseProcurexPage }))),
  'contract-negotiation': lazy(() => import('@/features/awardsContracts/components/procurex/ContractNegotiationProcurexPage').then((module) => ({ default: module.ContractNegotiationProcurexPage }))),
  'sample-procurement': lazy(() => import('@/features/awardsContracts/components/procurex/SampleProcurementProcurexPage').then((module) => ({ default: module.SampleProcurementProcurexPage }))),
  'post-award-tracking': lazy(() => import('@/features/awardsContracts/components/procurex/PostAwardTrackingProcurexPage').then((module) => ({ default: module.PostAwardTrackingProcurexPage }))),
  'communication-center': lazy(() => import('@/features/communication/components/procurex/CommunicationCenterProcurexPage').then((module) => ({ default: module.CommunicationCenterProcurexPage }))),
  'records-history': lazy(() => import('@/features/records/components/procurex/RecordsHistoryProcurexPage').then((module) => ({ default: module.RecordsHistoryProcurexPage }))),
  'admin-dashboard': lazy(() => import('@/features/admin/components/procurex/AdminDashboardProcurexPage').then((module) => ({ default: module.AdminDashboardProcurexPage }))),
  'admin-search': lazy(() => import('@/features/admin/components/procurex/AdminSearchProcurexPage').then((module) => ({ default: module.AdminSearchProcurexPage }))),
  'admin-users': lazy(() => import('@/features/admin/components/procurex/AdminUsersProcurexPage').then((module) => ({ default: module.AdminUsersProcurexPage }))),
  'admin-compliance': lazy(() => import('@/features/admin/components/procurex/AdminComplianceProcurexPage').then((module) => ({ default: module.AdminComplianceProcurexPage }))),
  'admin-analytics': lazy(() => import('@/features/admin/components/procurex/AdminAnalyticsProcurexPage').then((module) => ({ default: module.AdminAnalyticsProcurexPage }))),
  'admin-audit': lazy(() => import('@/features/admin/components/procurex/AdminAuditProcurexPage').then((module) => ({ default: module.AdminAuditProcurexPage }))),
  'admin-datastore': lazy(() => import('@/features/admin/components/procurex/AdminDatastoreProcurexPage').then((module) => ({ default: module.AdminDatastoreProcurexPage }))),
  'admin-tender-review': lazy(() => import('@/features/admin/components/procurex/AdminTenderReviewProcurexPage').then((module) => ({ default: module.AdminTenderReviewProcurexPage }))),
  'admin-communication': lazy(() => import('@/features/admin/components/procurex/AdminCommunicationProcurexPage').then((module) => ({ default: module.AdminCommunicationProcurexPage }))),
  'admin-profile': lazy(() => import('@/features/admin/components/procurex/AdminProfileProcurexPage').then((module) => ({ default: module.AdminProfileProcurexPage })))
} satisfies Record<string, ProcurexPageComponent>;

export type ProcurexPageKey = keyof typeof procurexPageRegistry;
 