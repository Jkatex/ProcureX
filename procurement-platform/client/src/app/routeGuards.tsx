import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Navigate, useLocation } from 'react-router-dom';
import { ProcurexLoadingPage } from '@/shared/components/ProcurexLoadingPage';
import { useAppSelector } from './store';
import type { FeatureGateName, PermissionName, TrustTier } from '@procurex/shared';

type GuardProps = {
  children: ReactNode;
  requireVerified?: boolean;
  requiredPermission?: PermissionName;
  requiredGate?: FeatureGateName;
  minimumTrustTier?: TrustTier;
  adminRedirectTo?: string;
  allowSupportComposeForUnverified?: boolean;
};

const trustRank: Record<TrustTier, number> = {
  UNVERIFIED: 0,
  VERIFIED: 1,
  BRONZE: 2,
  SILVER: 3,
  GOLD: 4,
  PLATINUM: 5
};

function LoadingGate() {
  const { t } = useTranslation();
  return <ProcurexLoadingPage title={t('loading.restoringSession')} message={t('loading.checkingSession')} />;
}

export function ProtectedRoute({
  children,
  requireVerified = false,
  requiredPermission,
  requiredGate,
  minimumTrustTier,
  adminRedirectTo,
  allowSupportComposeForUnverified = false
}: GuardProps) {
  const location = useLocation();
  const { isAuthenticated, sessionExpired, status, token, user } = useAppSelector((state) => state.auth);
  const params = new URLSearchParams(location.search);
  const supportComposeAllowed = allowSupportComposeForUnverified && params.get('support') === 'true' && params.get('view') === 'compose';

  if (status === 'loading' && token && !user) {
    return <LoadingGate />;
  }

  if (sessionExpired) {
    return <Navigate to="/session-expired" replace state={{ from: location }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  if (adminRedirectTo && user?.accountType === 'ADMIN') {
    return <Navigate to={adminRedirectTo} replace state={{ from: location }} />;
  }

  if (requireVerified && !supportComposeAllowed && user?.accountType !== 'ADMIN' && user?.verificationStatus !== 'APPROVED') {
    return <Navigate to="/identity/verification" replace state={{ from: location }} />;
  }

  if (minimumTrustTier && user?.accountType !== 'ADMIN' && trustRank[user?.trustTier ?? 'UNVERIFIED'] < trustRank[minimumTrustTier]) {
    return <Navigate to="/identity/verification" replace state={{ from: location }} />;
  }

  if (requiredPermission && !user?.permissions?.includes(requiredPermission)) {
    return <Navigate to={user?.verificationStatus === 'APPROVED' ? '/dashboard' : '/identity/verification'} replace state={{ from: location }} />;
  }

  if (requiredGate && !user?.featureGates?.[requiredGate]) {
    return <Navigate to={user?.verificationStatus === 'APPROVED' ? '/dashboard' : '/identity/verification'} replace state={{ from: location }} />;
  }

  return children;
}

export function AdminRoute({ children }: GuardProps) {
  const location = useLocation();
  const { sessionExpired, status, token, user } = useAppSelector((state) => state.auth);

  if (status === 'loading' && token && !user) {
    return <LoadingGate />;
  }

  if (sessionExpired) {
    return <Navigate to="/session-expired" replace state={{ from: location }} />;
  }

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  if (user.accountType !== 'ADMIN' || (user.permissions && !user.permissions.includes('admin.access'))) {
    return <Navigate to={user.verificationStatus === 'APPROVED' ? '/dashboard' : '/identity/verification'} replace />;
  }

  return children;
}
