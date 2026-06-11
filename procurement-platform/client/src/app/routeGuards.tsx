import type { ReactNode } from 'react';
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
  return <ProcurexLoadingPage title="Restoring session" message="Checking your ProcureX sign-in state." />;
}

export function ProtectedRoute({ children, requireVerified = false, requiredPermission, requiredGate, minimumTrustTier }: GuardProps) {
  const location = useLocation();
  const { isAuthenticated, sessionExpired, status, token, user } = useAppSelector((state) => state.auth);

  if (status === 'loading' && token && !user) {
    return <LoadingGate />;
  }

  if (sessionExpired) {
    return <Navigate to="/session-expired" replace state={{ from: location }} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  if (requireVerified && user?.accountType !== 'ADMIN' && user?.verificationStatus !== 'APPROVED') {
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
