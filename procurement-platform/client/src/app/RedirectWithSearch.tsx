import { Navigate, useLocation } from 'react-router-dom';

export function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}
