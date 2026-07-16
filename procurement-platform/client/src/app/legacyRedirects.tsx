import { Suspense } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { procurexPageRegistry } from '@/features/procurexPageRegistry';
import { ProcurexLoadingPage } from '@/shared/components/ProcurexLoadingPage';

const pageRouteAliases: Record<string, string> = {
  welcome: '/',
  register: '/register',
  'sign-in': '/sign-in',
  'role-selection': '/role-selection',
  'iam-verification': '/identity/verification',
  'identity-verification': '/identity/verification',
  'verification-status': '/identity/profile',
  'account-profile': '/identity/profile',
  'app-launcher': '/apps',
  'workspace-dashboard': '/dashboard',
  'buyer-dashboard': '/dashboard',
  'supplier-dashboard': '/dashboard',
  'procurement-dashboard': '/dashboard',
  marketplace: '/procurement/marketplace',
  'supplier-marketplace': '/procurement/marketplace',
  'my-tenders': '/procurement/my-tenders',
  'my-tender': '/procurement/my-tenders',
  'my-bids': '/procurement/my-bids',
  'my-bid': '/procurement/my-bids',
  'guest-marketplace': '/guest-marketplace',
  'create-tender': '/procurement/create-tender',
  'tender-publication': '/procurement/tender-publication',
  'tender-details': '/procurement/tender-details',
  'tender-document': '/procurement/tender-document',
  'tender-detail': '/procurement/supplier-tender-detail',
  'supplier-tender-detail': '/procurement/supplier-tender-detail',
  'procurement-guide': '/procurement/guide',
  'supplier-journey': '/procurement/guide',
  'buyer-journey': '/procurement/guide',
  'bidding-workspace': '/bidding',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'award-recommendation': '/awards-contracts/recommendation',
  'award-response': '/awards-contracts/award-response',
  'contract-drafting': '/awards-contracts/drafting',
  'contract-clauses': '/awards-contracts/drafting/clauses',
  'contract-negotiation': '/awards-contracts/negotiation',
  'contract-signing': '/awards-contracts/signing',
  'post-award-tracking': '/post-award',
  'communication-center': '/communication',
  'records-history': '/records',
  'admin-dashboard': '/admin',
  'admin-users': '/admin/users',
  'admin-analytics': '/admin/analytics',
  'admin-audit': '/admin/audit',
  'about-procurex': '/about',
  'privacy-policy': '/privacy',
  'terms-and-conditions': '/terms',
  contact: '/contact'
};

export function LegacyPageRedirect() {
  const [searchParams] = useSearchParams();
  const page = searchParams.get('page') ?? 'welcome';
  return <Navigate to={pageRouteAliases[page] ?? '/'} replace />;
}

export function HomeOrLegacyPage() {
  const [searchParams] = useSearchParams();
  const page = searchParams.get('page');
  if (page && page !== 'welcome') {
    return <Navigate to={pageRouteAliases[page] ?? '/'} replace />;
  }
  const WelcomePage = procurexPageRegistry.welcome;
  return (
    <Suspense fallback={<ProcurexLoadingPage />}>
      <WelcomePage />
    </Suspense>
  );
}
