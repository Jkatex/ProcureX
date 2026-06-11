import { Navigate, createBrowserRouter } from 'react-router-dom';
import type { ComponentProps, ReactNode } from 'react';
import { ForgotPasswordProcurexPage } from '@/features/auth/components/procurex/ForgotPasswordProcurexPage';
import { procurexPageRegistry, type ProcurexPageKey } from '@/features/procurexPageRegistry';
import { AccountLockedProcurexPage, HelpCenterProcurexPage, NotFoundProcurexPage, SessionExpiredProcurexPage, SystemStatusProcurexPage } from '@/features/support/pages/SupportPages';
import { LegacyPageRedirect, HomeOrLegacyPage } from './legacyRedirects';
import { AdminRoute, ProtectedRoute } from './routeGuards';

function page(pageKey: ProcurexPageKey) {
  const Page = procurexPageRegistry[pageKey];
  return <Page />;
}

function protectedPage(
  pageKey: ProcurexPageKey,
  options?: Omit<ComponentProps<typeof ProtectedRoute>, 'children'> & { children?: ReactNode }
) {
  return <ProtectedRoute {...options}>{page(pageKey)}</ProtectedRoute>;
}

function verifiedPage(pageKey: ProcurexPageKey) {
  return protectedPage(pageKey, { requireVerified: true });
}

function adminPage(pageKey: ProcurexPageKey) {
  return <AdminRoute>{page(pageKey)}</AdminRoute>;
}

// Temporary development switch: keep core procurement routes auth-only while trust gates are being iterated.
const TEMP_PROCUREMENT_CORE_GATES_ENABLED = false;
const procurementCoreGateOptions = TEMP_PROCUREMENT_CORE_GATES_ENABLED
  ? {
      createTender: { requireVerified: true, requiredPermission: 'procurement.create', requiredGate: 'tenderCreation', minimumTrustTier: 'BRONZE' } as const,
      tenderPublication: { requireVerified: true, requiredPermission: 'procurement.publish', requiredGate: 'tenderPublication', minimumTrustTier: 'BRONZE' } as const,
      bidding: { requireVerified: true, requiredPermission: 'bidding.submit', requiredGate: 'bidSubmission', minimumTrustTier: 'BRONZE' } as const,
      evaluation: { requireVerified: true, requiredPermission: 'evaluation.manage', requiredGate: 'evaluationManagement', minimumTrustTier: 'BRONZE' } as const
    }
  : {
      createTender: undefined,
      tenderPublication: undefined,
      bidding: undefined,
      evaluation: undefined
    };

export const routes = [
  { path: '/', element: <HomeOrLegacyPage /> },
  { path: '/legacy', element: <LegacyPageRedirect /> },

  { path: '/guest-marketplace', element: page('guest-marketplace') },
  { path: '/about', element: page('about-procurex') },
  { path: '/privacy', element: page('privacy-policy') },
  { path: '/terms', element: page('terms-and-conditions') },
  { path: '/contact', element: page('contact') },
  { path: '/help', element: <HelpCenterProcurexPage /> },
  { path: '/status', element: <SystemStatusProcurexPage /> },
  { path: '/register', element: page('register') },
  { path: '/sign-in', element: page('sign-in') },
  { path: '/forgot-password', element: <ForgotPasswordProcurexPage /> },
  { path: '/session-expired', element: <SessionExpiredProcurexPage /> },
  { path: '/account-locked', element: <AccountLockedProcurexPage /> },
  { path: '/role-selection', element: <Navigate to="/register" replace /> },

  { path: '/apps', element: verifiedPage('app-launcher') },
  { path: '/dashboard', element: verifiedPage('workspace-dashboard') },
  { path: '/identity/verification', element: protectedPage('identity-verification') },
  { path: '/identity/profile', element: protectedPage('account-profile') },
  { path: '/tender-planning', element: verifiedPage('tender-planning') },
  { path: '/procurement/guide', element: verifiedPage('procurement-guide') },
  { path: '/procurement/marketplace', element: verifiedPage('marketplace') },
  { path: '/procurement/my-tenders', element: verifiedPage('marketplace') },
  { path: '/procurement/my-bids', element: verifiedPage('marketplace') },
  { path: '/procurement/create-tender', element: protectedPage('create-tender', procurementCoreGateOptions.createTender) },
  { path: '/procurement/tender-publication', element: protectedPage('tender-publication', procurementCoreGateOptions.tenderPublication) },
  { path: '/procurement/tender-details', element: verifiedPage('tender-details') },
  { path: '/procurement/tender-document', element: verifiedPage('tender-document') },
  { path: '/procurement/supplier-tender-detail', element: verifiedPage('tender-detail') },
  { path: '/bidding', element: protectedPage('bidding-workspace', procurementCoreGateOptions.bidding) },
  { path: '/evaluation', element: protectedPage('bid-evaluation', procurementCoreGateOptions.evaluation) },
  { path: '/awards-contracts', element: verifiedPage('awarding-contracts') },
  { path: '/awards-contracts/recommendation', element: verifiedPage('award-recommendation') },
  { path: '/awards-contracts/award-response', element: verifiedPage('award-response') },
  { path: '/awards-contracts/negotiation', element: verifiedPage('contract-negotiation') },
  { path: '/awards-contracts/post-award', element: verifiedPage('post-award-tracking') },
  { path: '/communication', element: verifiedPage('communication-center') },
  { path: '/records', element: verifiedPage('records-history') },
  { path: '/documents', element: verifiedPage('tender-document') },

  { path: '/admin', element: adminPage('admin-dashboard') },
  { path: '/admin/search', element: adminPage('admin-search') },
  { path: '/admin/users', element: adminPage('admin-users') },
  { path: '/admin/compliance', element: adminPage('admin-compliance') },
  { path: '/admin/analytics', element: adminPage('admin-analytics') },
  { path: '/admin/audit', element: adminPage('admin-audit') },

  { path: '/supplier-marketplace', element: <Navigate to="/procurement/marketplace" replace /> },
  { path: '/buyer-dashboard', element: <Navigate to="/dashboard" replace /> },
  { path: '/supplier-dashboard', element: <Navigate to="/dashboard" replace /> },
  { path: '/procurement-dashboard', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: <NotFoundProcurexPage /> }
];

export const router = createBrowserRouter(routes);
