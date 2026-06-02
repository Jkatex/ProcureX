import { Navigate, useSearchParams } from 'react-router-dom';
import { procurexPageRegistry } from '@/features/procurexPageRegistry';

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
  'tender-planning': '/tender-planning',
  marketplace: '/procurement/marketplace',
  'supplier-marketplace': '/procurement/marketplace',
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
  'contract-negotiation': '/awards-contracts/negotiation',
  'post-award-tracking': '/awards-contracts/post-award',
  'communication-center': '/communication',
  'records-history': '/records',
  'admin-dashboard': '/admin',
  'admin-search': '/admin/search',
  'admin-users': '/admin/users',
  'admin-compliance': '/admin/compliance',
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
  return <WelcomePage />;
}
