import { Navigate, createBrowserRouter } from 'react-router-dom';
import { procurexPageRegistry, type ProcurexPageKey } from '@/features/procurexPageRegistry';
import { LegacyPageRedirect, HomeOrLegacyPage } from './legacyRedirects';
import { ProtectedRoute } from './routeGuards';

function page(pageKey: ProcurexPageKey) {
  const Page = procurexPageRegistry[pageKey];
  return <Page />;
}

function protectedPage(pageKey: ProcurexPageKey) {
  return <ProtectedRoute>{page(pageKey)}</ProtectedRoute>;
}

const adminPage = protectedPage;

export const router = createBrowserRouter([
  { path: '/', element: <HomeOrLegacyPage /> },
  { path: '/legacy', element: <LegacyPageRedirect /> },

  { path: '/guest-marketplace', element: page('guest-marketplace') },
  { path: '/about', element: page('about-procurex') },
  { path: '/privacy', element: page('privacy-policy') },
  { path: '/terms', element: page('terms-and-conditions') },
  { path: '/contact', element: page('contact') },
  { path: '/register', element: page('register') },
  { path: '/sign-in', element: page('sign-in') },
  { path: '/role-selection', element: page('role-selection') },

  { path: '/apps', element: protectedPage('app-launcher') },
  { path: '/dashboard', element: protectedPage('workspace-dashboard') },
  { path: '/identity/verification', element: protectedPage('identity-verification') },
  { path: '/identity/profile', element: protectedPage('account-profile') },
  { path: '/tender-planning', element: protectedPage('tender-planning') },
  { path: '/procurement/guide', element: protectedPage('procurement-guide') },
  { path: '/procurement/marketplace', element: protectedPage('marketplace') },
  { path: '/procurement/my-tenders', element: protectedPage('marketplace') },
  { path: '/procurement/my-bids', element: protectedPage('marketplace') },
  { path: '/procurement/create-tender', element: protectedPage('create-tender') },
  { path: '/procurement/tender-publication', element: protectedPage('tender-publication') },
  { path: '/procurement/tender-details', element: protectedPage('tender-details') },
  { path: '/procurement/tender-document', element: protectedPage('tender-document') },
  { path: '/procurement/supplier-tender-detail', element: protectedPage('tender-detail') },
  { path: '/bidding', element: protectedPage('bidding-workspace') },
  { path: '/evaluation', element: protectedPage('bid-evaluation') },
  { path: '/awards-contracts', element: protectedPage('awarding-contracts') },
  { path: '/awards-contracts/recommendation', element: protectedPage('award-recommendation') },
  { path: '/awards-contracts/award-response', element: protectedPage('award-response') },
  { path: '/awards-contracts/negotiation', element: protectedPage('contract-negotiation') },
  { path: '/awards-contracts/post-award', element: protectedPage('post-award-tracking') },
  { path: '/communication', element: protectedPage('communication-center') },
  { path: '/records', element: protectedPage('records-history') },
  { path: '/documents', element: protectedPage('tender-document') },

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
  { path: '*', element: <Navigate to="/" replace /> }
]);
