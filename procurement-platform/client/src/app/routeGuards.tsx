import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppSelector } from './store';

type GuardProps = {
  children: ReactNode;
  requireVerified?: boolean;
};

function LoadingGate() {
  return (
    <div className="coming-soon">
      <h2 className="coming-soon-title">Restoring session</h2>
      <p className="coming-soon-text">Checking your ProcureX sign-in state.</p>
    </div>
  );
}

export function ProtectedRoute({ children, requireVerified = false }: GuardProps) {
  const location = useLocation();
  const { isAuthenticated, status, token, user } = useAppSelector((state) => state.auth);

  if (status === 'loading' && token && !user) {
    return <LoadingGate />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  if (requireVerified && user?.accountType !== 'ADMIN' && user?.verificationStatus !== 'APPROVED') {
    return <Navigate to="/identity/verification" replace state={{ from: location }} />;
  }

  return children;
}

export function AdminRoute({ children }: GuardProps) {
  const location = useLocation();
  const { status, token, user } = useAppSelector((state) => state.auth);

  if (status === 'loading' && token && !user) {
    return <LoadingGate />;
  }

  if (!user) {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  if (user.accountType !== 'ADMIN') {
    return <Navigate to={user.verificationStatus === 'APPROVED' ? '/dashboard' : '/identity/verification'} replace />;
  }

  return children;
}
