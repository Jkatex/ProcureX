import { Navigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { routes } from './router';

describe('auth routes', () => {
  it('redirects role selection to registration', () => {
    const roleSelectionRoute = routes.find((route) => route.path === '/role-selection');

    expect(roleSelectionRoute?.element.type).toBe(Navigate);
    expect(roleSelectionRoute?.element.props).toMatchObject({ to: '/register', replace: true });
  });
});
