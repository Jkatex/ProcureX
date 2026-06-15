import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { assumeUser, signOut } from '@/features/auth/slice';
import authReducer from '@/features/auth/slice';
import { demoUsers } from '@/shared/data/fixtures';
import { store } from './store';
import { AdminRoute, ProtectedRoute } from './routeGuards';

function renderGuarded(route: 'protected' | 'admin') {
  const Guard = route === 'protected' ? ProtectedRoute : AdminRoute;
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[route === 'protected' ? '/private' : '/admin']}>
        <Routes>
          <Route path="/sign-in" element={<div>Sign in page</div>} />
          <Route path="/dashboard" element={<div>User dashboard</div>} />
          <Route
            path={route === 'protected' ? '/private' : '/admin'}
            element={
              <Guard>
                <div>Allowed</div>
              </Guard>
            }
          />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('route guards', () => {
  beforeEach(() => {
    store.dispatch(assumeUser(demoUsers.user));
  });

  it('redirects unauthenticated users away from protected routes', () => {
    store.dispatch(signOut());
    renderGuarded('protected');
    expect(screen.getByText('Sign in page')).toBeInTheDocument();
  });

  it('renders the ProcureX loading animation while restoring a stored session', () => {
    const loadingStore = configureStore({
      reducer: { auth: authReducer },
      preloadedState: {
        auth: {
          user: null,
          token: 'stored-token',
          expiresAt: null,
          isAuthenticated: false,
          status: 'loading' as const,
          error: null,
          sessionExpired: false
        }
      }
    });

    render(
      <Provider store={loadingStore}>
        <MemoryRouter initialEntries={['/private']}>
          <Routes>
            <Route path="/private" element={<ProtectedRoute><div>Allowed</div></ProtectedRoute>} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByRole('status', { name: 'Restoring session' })).toBeInTheDocument();
    expect(screen.getByText('Checking your ProcureX sign-in state.')).toBeInTheDocument();
    expect(document.querySelector('dotlottie-player.procurex-lottie-lg')).toHaveAttribute('src', '/assets/ProcureX.json');
  });

  it('redirects normal users away from admin routes', () => {
    renderGuarded('admin');
    expect(screen.getByText('User dashboard')).toBeInTheDocument();
  });

  it('allows admin users into admin routes', () => {
    store.dispatch(assumeUser(demoUsers.admin));
    renderGuarded('admin');
    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });

  it('allows signed-in low-trust users through temporary auth-only procurement core routes', () => {
    store.dispatch(assumeUser({
      ...demoUsers.user,
      verificationStatus: 'NOT_STARTED',
      trustTier: 'UNVERIFIED',
      riskLevel: 'CRITICAL',
      screeningStatus: 'BLOCKED',
      permissions: ['identity.verify'],
      featureGates: {
        identityVerification: true,
        adminReview: false,
        tenderCreation: false,
        tenderPublication: false,
        bidSubmission: false,
        evaluationManagement: false,
        awardManagement: false,
        awardResponse: false,
        contractManagement: false,
        contractSigning: false,
        contractTracking: false,
        complianceReview: false
      }
    }));

    renderGuarded('protected');

    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });

  it('keeps explicit trust gates enforceable for routes that still opt into them', () => {
    const Guarded = () => (
      <ProtectedRoute requireVerified requiredPermission="procurement.create" requiredGate="tenderCreation" minimumTrustTier="BRONZE">
        <div>Allowed</div>
      </ProtectedRoute>
    );
    store.dispatch(assumeUser({
      ...demoUsers.user,
      verificationStatus: 'NOT_STARTED',
      trustTier: 'UNVERIFIED',
      permissions: ['identity.verify']
    }));

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/private']}>
          <Routes>
            <Route path="/identity/verification" element={<div>Identity verification</div>} />
            <Route path="/private" element={<Guarded />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Identity verification')).toBeInTheDocument();
  });

  it('allows the development demo user through explicit core procurement gates', () => {
    const Guarded = () => (
      <ProtectedRoute requireVerified requiredPermission="procurement.create" requiredGate="tenderCreation" minimumTrustTier="BRONZE">
        <div>Allowed</div>
      </ProtectedRoute>
    );

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/private']}>
          <Routes>
            <Route path="/private" element={<Guarded />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });
});
