import { Navigate, createBrowserRouter } from 'react-router-dom';
import { lazy, Suspense, type ComponentProps, type ElementType, type ReactNode } from 'react';
import { procurexPageRegistry, type ProcurexPageKey } from '@/features/procurexPageRegistry';
import { ProcurexLoadingPage } from '@/shared/components/ProcurexLoadingPage';
import { LegacyPageRedirect, HomeOrLegacyPage } from './legacyRedirects';
import { AdminRoute, ProtectedRoute } from './routeGuards';
import { supportComposeRoute } from '@/features/communication/supportComposeRoute';

const ForgotPasswordProcurexPage = lazy(() =>
  import('@/features/auth/components/procurex/ForgotPasswordProcurexPage').then((module) => ({ default: module.ForgotPasswordProcurexPage }))
);
const RecoverKeyphraseProcurexPage = lazy(() =>
  import('@/features/auth/components/procurex/RecoverKeyphraseProcurexPage').then((module) => ({ default: module.RecoverKeyphraseProcurexPage }))
);
const HelpCenterProcurexPage = lazy(() => import('@/features/support/pages/SupportPages').then((module) => ({ default: module.HelpCenterProcurexPage })));
const SystemStatusProcurexPage = lazy(() => import('@/features/support/pages/SupportPages').then((module) => ({ default: module.SystemStatusProcurexPage })));
const SessionExpiredProcurexPage = lazy(() => import('@/features/support/pages/SupportPages').then((module) => ({ default: module.SessionExpiredProcurexPage })));
const AccountLockedProcurexPage = lazy(() => import('@/features/support/pages/SupportPages').then((module) => ({ default: module.AccountLockedProcurexPage })));
const NotFoundProcurexPage = lazy(() => import('@/features/support/pages/SupportPages').then((module) => ({ default: module.NotFoundProcurexPage })));

function lazyElement(Component: ElementType) {
  return (
    <Suspense fallback={<ProcurexLoadingPage />}>
      <Component />
    </Suspense>
  );
}

function page(pageKey: ProcurexPageKey) {
  const Page = procurexPageRegistry[pageKey];
  return lazyElement(Page);
}

function protectedPage(
  pageKey: ProcurexPageKey,
  options?: Omit<ComponentProps<typeof ProtectedRoute>, 'children'> & { children?: ReactNode }
) {
  return <ProtectedRoute {...options}>{page(pageKey)}</ProtectedRoute>;
}

function verifiedPage(
  pageKey: ProcurexPageKey,
  options?: Omit<ComponentProps<typeof ProtectedRoute>, 'children' | 'requireVerified'> & { children?: ReactNode }
) {
  return protectedPage(pageKey, { ...options, requireVerified: true });
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
  { path: '/help', element: lazyElement(HelpCenterProcurexPage) },
  { path: '/status', element: lazyElement(SystemStatusProcurexPage) },
  { path: '/register', element: page('register') },
  { path: '/sign-in', element: page('sign-in') },
  { path: '/forgot-password', element: lazyElement(ForgotPasswordProcurexPage) },
  { path: '/recover-keyphrase', element: lazyElement(RecoverKeyphraseProcurexPage) },
  { path: '/session-expired', element: lazyElement(SessionExpiredProcurexPage) },
  { path: '/account-locked', element: lazyElement(AccountLockedProcurexPage) },
  { path: '/role-selection', element: <Navigate to="/register" replace /> },

  { path: '/apps', element: verifiedPage('app-launcher', { adminRedirectTo: '/admin' }) },
  { path: '/dashboard', element: verifiedPage('workspace-dashboard', { adminRedirectTo: '/admin' }) },
  { path: '/identity/verification', element: protectedPage('identity-verification', { adminRedirectTo: '/admin/profile' }) },
  { path: '/identity/security/keyphrase', element: protectedPage('identity-security-keyphrase', { adminRedirectTo: '/admin/profile' }) },
  { path: '/identity/profile', element: protectedPage('account-profile', { adminRedirectTo: '/admin/profile' }) },
  { path: '/support', element: <ProtectedRoute><Navigate to={supportComposeRoute()} replace /></ProtectedRoute> },
  { path: '/tender-planning', element: verifiedPage('tender-planning', { adminRedirectTo: '/admin' }) },
  { path: '/procurement/guide', element: verifiedPage('procurement-guide', { adminRedirectTo: '/admin' }) },
  { path: '/procurement/marketplace', element: verifiedPage('marketplace', { adminRedirectTo: '/admin/search' }) },
  { path: '/procurement/my-tenders', element: verifiedPage('marketplace', { adminRedirectTo: '/admin/search' }) },
  { path: '/procurement/my-bids', element: verifiedPage('marketplace', { adminRedirectTo: '/admin/search' }) },
  { path: '/procurement/create-tender', element: protectedPage('create-tender', { ...procurementCoreGateOptions.createTender, adminRedirectTo: '/admin' }) },
  { path: '/procurement/tender-publication', element: protectedPage('tender-publication', { ...procurementCoreGateOptions.tenderPublication, adminRedirectTo: '/admin' }) },
  { path: '/procurement/tender-details', element: verifiedPage('tender-details', { adminRedirectTo: '/admin/search' }) },
  { path: '/procurement/tender-document', element: verifiedPage('tender-document', { adminRedirectTo: '/admin/search' }) },
  { path: '/procurement/supplier-tender-detail', element: verifiedPage('tender-detail', { adminRedirectTo: '/admin/search' }) },
  { path: '/bidding', element: protectedPage('bidding-workspace', { ...procurementCoreGateOptions.bidding, adminRedirectTo: '/admin/search' }) },
  { path: '/evaluation', element: protectedPage('bid-evaluation', { ...procurementCoreGateOptions.evaluation, adminRedirectTo: '/admin/analytics' }) },
  { path: '/awards-contracts', element: verifiedPage('awarding-contracts', { adminRedirectTo: '/admin/search' }) },
  { path: '/awards-contracts/recommendation', element: verifiedPage('award-recommendation', { adminRedirectTo: '/admin/search' }) },
  { path: '/awards-contracts/award-response', element: verifiedPage('award-response', { adminRedirectTo: '/admin/search' }) },
  { path: '/awards-contracts/negotiation', element: verifiedPage('contract-negotiation', { adminRedirectTo: '/admin/search' }) },
  { path: '/awards-contracts/samples', element: verifiedPage('sample-procurement', { adminRedirectTo: '/admin/search' }) },
  { path: '/awards-contracts/post-award', element: verifiedPage('post-award-tracking', { adminRedirectTo: '/admin/search' }) },
  { path: '/communication', element: verifiedPage('communication-center', { adminRedirectTo: '/admin/communication', allowSupportComposeForUnverified: true }) },
  { path: '/communication-center', element: <Navigate to="/communication" replace /> },
  { path: '/records', element: verifiedPage('records-history', { adminRedirectTo: '/admin/audit' }) },
  { path: '/documents', element: verifiedPage('tender-document', { adminRedirectTo: '/admin/search' }) },

  { path: '/admin', element: adminPage('admin-dashboard') },
  { path: '/admin/search', element: adminPage('admin-search') },
  { path: '/admin/users', element: adminPage('admin-users') },
  { path: '/admin/compliance', element: adminPage('admin-compliance') },
  { path: '/admin/analytics', element: adminPage('admin-analytics') },
  { path: '/admin/audit', element: adminPage('admin-audit') },
  { path: '/admin/datastore', element: adminPage('admin-datastore') },
  { path: '/admin/tender-review', element: adminPage('admin-tender-review') },
  { path: '/admin/tender-review/:tenderId', element: adminPage('admin-tender-review') },
  { path: '/admin/communication', element: adminPage('admin-communication') },
  { path: '/admin/profile', element: adminPage('admin-profile') },

  { path: '/supplier-marketplace', element: <Navigate to="/procurement/marketplace" replace /> },
  { path: '/buyer-dashboard', element: <Navigate to="/dashboard" replace /> },
  { path: '/supplier-dashboard', element: <Navigate to="/dashboard" replace /> },
  { path: '/procurement-dashboard', element: <Navigate to="/dashboard" replace /> },
  { path: '*', element: lazyElement(NotFoundProcurexPage) }
];

export const router = createBrowserRouter(routes);
