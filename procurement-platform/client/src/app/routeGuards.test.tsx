import { configureStore } from '@reduxjs/toolkit';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Navigate, Route, Routes } from 'react-router-dom';
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
    expect(document.querySelector('img.procurex-loading-logo')).toHaveAttribute('src', '/assets/logo.svg');
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

  it('redirects admins away from shared user routes when an admin redirect is configured', () => {
    store.dispatch(assumeUser(demoUsers.admin));

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/identity/profile']}>
          <Routes>
            <Route path="/admin/profile" element={<div>Admin profile</div>} />
            <Route
              path="/identity/profile"
              element={
                <ProtectedRoute adminRedirectTo="/admin/profile">
                  <div>User profile</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Admin profile')).toBeInTheDocument();
  });

  it('redirects admins from shared communication to admin communication', () => {
    store.dispatch(assumeUser(demoUsers.admin));

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/communication']}>
          <Routes>
            <Route path="/admin/communication" element={<div>Admin communication</div>} />
            <Route
              path="/communication"
              element={
                <ProtectedRoute requireVerified adminRedirectTo="/admin/communication">
                  <div>User communication</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Admin communication')).toBeInTheDocument();
  });

  it('redirects legacy communication center links to the user communication route', () => {
    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/communication-center']}>
          <Routes>
            <Route path="/communication" element={<div>User communication</div>} />
            <Route path="/communication-center" element={<Navigate to="/communication" replace />} />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('User communication')).toBeInTheDocument();
  });

  it('allows unverified signed-in users into restricted support compose only', () => {
    store.dispatch(assumeUser({
      ...demoUsers.user,
      verificationStatus: 'NOT_STARTED',
      trustTier: 'UNVERIFIED'
    }));

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/communication?support=true&view=compose']}>
          <Routes>
            <Route path="/identity/verification" element={<div>Identity verification</div>} />
            <Route
              path="/communication"
              element={
                <ProtectedRoute requireVerified allowSupportComposeForUnverified>
                  <div>Support compose</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Support compose')).toBeInTheDocument();
  });

  it('keeps normal communication blocked for unverified signed-in users', () => {
    store.dispatch(assumeUser({
      ...demoUsers.user,
      verificationStatus: 'NOT_STARTED',
      trustTier: 'UNVERIFIED'
    }));

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/communication']}>
          <Routes>
            <Route path="/identity/verification" element={<div>Identity verification</div>} />
            <Route
              path="/communication"
              element={
                <ProtectedRoute requireVerified allowSupportComposeForUnverified>
                  <div>User communication</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Identity verification')).toBeInTheDocument();
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
