import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { authApi } from '@/features/auth/api';
import { signOut } from '@/features/auth/slice';
import { store } from '@/app/store';
import { demoUsers } from '@/shared/data/fixtures';
import { SignInProcurexPage } from './SignInProcurexPage';
import type { AuthSessionResponse } from '@/features/auth/api';

vi.mock('@/features/auth/api', () => ({
  authApi: {
    signIn: vi.fn()
  }
}));

vi.mock('./TurnstileWidget', () => ({
  TurnstileWidget: ({ onVerify }: { onVerify: (token: string) => void }) => (
    <button type="button" onClick={() => onVerify('turnstile-token')}>
      Complete security check
    </button>
  )
}));

const mockedAuthApi = vi.mocked(authApi);

function apiError(status: number, message: string) {
  return { response: { status, data: { message } }, message };
}

function authSession(input: Partial<AuthSessionResponse> = {}): AuthSessionResponse {
  return {
    token: 'token',
    expiresAt: '2026-06-13T00:00:00.000Z',
    user: demoUsers.user,
    isFirstSignIn: true,
    ...input
  };
}

function renderSignIn(initialEntry: string | { pathname: string; state?: unknown } = '/sign-in') {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/sign-in" element={<SignInProcurexPage />} />
          <Route path="/identity/verification" element={<div>Identity verification</div>} />
          <Route path="/apps" element={<div>Apps</div>} />
          <Route path="/dashboard" element={<div>User dashboard</div>} />
          <Route path="/procurement/marketplace" element={<div>Marketplace</div>} />
          <Route path="/admin" element={<div>Admin</div>} />
          <Route path="/account-locked" element={<div>Account locked page</div>} />
        </Routes>
      </MemoryRouter>
    </Provider>
  );
}

describe('SignInProcurexPage', () => {
  beforeEach(async () => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
    await i18n.changeLanguage('en');
    store.dispatch(signOut());
    mockedAuthApi.signIn.mockReset();
  });

  it('trims email, signs in with real credentials, and routes unverified users to verification', async () => {
    mockedAuthApi.signIn.mockResolvedValueOnce(authSession({
      user: {
        id: 'user-1',
        email: 'user@example.test',
        phone: '+255700000001',
        displayName: 'User',
        accountType: 'USER',
        organization: 'User Organization',
        verificationStatus: 'NOT_STARTED',
        capabilities: []
      }
    }));

    renderSignIn();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: '  user@example.test  ' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'Strong123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await screen.findByText('Identity verification');
    expect(mockedAuthApi.signIn).toHaveBeenCalledWith({ email: 'user@example.test', password: 'Strong123!', turnstileToken: 'turnstile-token' });
  });

  it('prevents duplicate submits while loading', async () => {
    mockedAuthApi.signIn.mockReturnValue(new Promise(() => undefined));

    renderSignIn();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'Strong123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Signing in...' })).toBeDisabled());
    fireEvent.submit(document.querySelector('form')!);

    expect(mockedAuthApi.signIn).toHaveBeenCalledTimes(1);
  });

  it('blocks sign-in until the security check is complete', async () => {
    renderSignIn();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'Strong123!' } });
    fireEvent.submit(document.querySelector('form')!);

    expect(await screen.findByText('Complete the security check before signing in.')).toBeInTheDocument();
    expect(mockedAuthApi.signIn).not.toHaveBeenCalled();
  });

  it('hides the demo account placeholder when it is disabled outside local development', () => {
    vi.stubEnv('MODE', 'production');
    vi.stubEnv('VITE_DEMO_SIGN_IN_ENABLED', 'false');

    renderSignIn();

    expect(screen.queryByRole('button', { name: /Sign in as demo user/i })).not.toBeInTheDocument();
  });

  it('prefills demo credentials when enabled but does not show a bypass button', () => {
    vi.stubEnv('VITE_DEMO_SIGN_IN_ENABLED', 'true');

    renderSignIn();

    expect(screen.queryByRole('button', { name: /Sign in as demo user/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Email Address *')).toHaveValue('demo@procurex.tz');
    expect(screen.getByLabelText('Password *')).toHaveValue('Demo123!');
    expect(mockedAuthApi.signIn).not.toHaveBeenCalled();
  });

  it('prefills demo credentials from the landing demo route when demo mode is enabled', () => {
    vi.stubEnv('VITE_DEMO_SIGN_IN_ENABLED', 'true');
    vi.stubEnv('VITE_DEMO_USER_EMAIL', 'walkthrough@procurex.tz');
    vi.stubEnv('VITE_DEMO_USER_PASSWORD', 'Walkthrough123!');

    renderSignIn('/sign-in?demo=1');

    expect(screen.getByLabelText('Email Address *')).toHaveValue('walkthrough@procurex.tz');
    expect(screen.getByLabelText('Password *')).toHaveValue('Walkthrough123!');
    expect(screen.getByText('Development demo credentials are filled in for this session. Complete the security check, then sign in.')).toBeInTheDocument();
  });

  it('accepts typed demo credentials through the backend when local demo sign-in is enabled', async () => {
    vi.stubEnv('VITE_DEMO_SIGN_IN_ENABLED', 'true');
    mockedAuthApi.signIn.mockResolvedValueOnce(authSession({
      token: 'typed-demo-token',
      user: demoUsers.user
    }));

    renderSignIn();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'demo@procurex.tz' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'Demo123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await screen.findByText('Apps');
    expect(mockedAuthApi.signIn).toHaveBeenCalledWith({ email: 'demo@procurex.tz', password: 'Demo123!', turnstileToken: 'turnstile-token' });
    expect(window.localStorage.getItem('procurex.authToken')).toBe('typed-demo-token');
  });

  it('routes approved returning users to the dashboard after normal sign-in', async () => {
    mockedAuthApi.signIn.mockResolvedValueOnce(authSession({ isFirstSignIn: false }));

    renderSignIn();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'demo@procurex.tz' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'Demo123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await screen.findByText('User dashboard');
  });

  it('routes admin users to the admin dashboard regardless of first sign-in status', async () => {
    mockedAuthApi.signIn.mockResolvedValueOnce(authSession({ user: demoUsers.admin, isFirstSignIn: true }));

    renderSignIn();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'admin@procurex.tz' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'Admin123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await screen.findByText('Admin');
  });

  it('preserves protected-route deep links after sign-in', async () => {
    mockedAuthApi.signIn.mockResolvedValueOnce(authSession({ isFirstSignIn: true }));

    renderSignIn({ pathname: '/sign-in', state: { from: { pathname: '/procurement/marketplace' } } });

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'demo@procurex.tz' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'Demo123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await screen.findByText('Marketplace');
  });

  it('shows the language switcher and translates sign-in copy to Swahili', async () => {
    renderSignIn();

    const actionGroup = document.querySelector('.auth-header-actions-new');
    const languageSwitcher = screen.getByRole('combobox', { name: 'Language' });
    const createAccountButton = screen.getByRole('button', { name: 'Create an account' });
    expect(actionGroup).toContainElement(languageSwitcher);
    expect(actionGroup).toContainElement(createAccountButton);
    expect(Boolean(languageSwitcher.compareDocumentPosition(createAccountButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    fireEvent.change(screen.getByRole('combobox', { name: 'Language' }), { target: { value: 'sw' } });

    expect(await screen.findByRole('heading', { name: 'Karibu Tena' })).toBeInTheDocument();
    expect(screen.getByLabelText('Barua Pepe *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingia' })).toBeInTheDocument();
  });

  it('shows an accessible alert for invalid credentials', async () => {
    mockedAuthApi.signIn.mockRejectedValueOnce(apiError(401, 'Invalid email or password.'));

    renderSignIn();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'user@example.test' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'Wrong123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password.');
  });

  it('routes locked or suspended account responses to the account support page', async () => {
    mockedAuthApi.signIn.mockRejectedValueOnce(apiError(423, 'Account locked pending support review.'));

    renderSignIn();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'locked@example.test' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'Strong123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('Account locked page')).toBeInTheDocument();
  });
});
