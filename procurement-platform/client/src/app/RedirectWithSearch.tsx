/* Supports the app client workflow with reusable logic kept close to the screens that consume it. */
import { Navigate, useLocation } from 'react-router-dom';

export function RedirectWithSearch({ to }: { to: string }) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}`} replace />;
}
