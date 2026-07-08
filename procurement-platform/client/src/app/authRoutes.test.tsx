import { Navigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ProtectedRoute } from './routeGuards';
import { routes } from './router';

describe('auth routes', () => {
  it('redirects role selection to registration', () => {
    const roleSelectionRoute = routes.find((route) => route.path === '/role-selection');

    expect(roleSelectionRoute?.element.type).toBe(Navigate);
    expect(roleSelectionRoute?.element.props).toMatchObject({ to: '/register', replace: true });
  });

  it('keeps public help open and adds protected signed-in support', () => {
    const publicHelpRoute = routes.find((route) => route.path === '/help');
    const signedInSupportRoute = routes.find((route) => route.path === '/support');

    expect(publicHelpRoute).toBeDefined();
    expect(signedInSupportRoute?.element.type).toBe(ProtectedRoute);
  });
});
