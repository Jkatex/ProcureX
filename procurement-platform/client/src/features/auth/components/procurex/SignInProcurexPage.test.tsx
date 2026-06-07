import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { authApi } from '@/features/auth/api';
import { signOut } from '@/features/auth/slice';
import { store } from '@/app/store';
import { SignInProcurexPage } from './SignInProcurexPage';

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

function renderSignIn() {
  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/sign-in']}>
        <Routes>
          <Route path="/sign-in" element={<SignInProcurexPage />} />
          <Route path="/identity/verification" element={<div>Identity verification</div>} />
          <Route path="/apps" element={<div>Apps</div>} />
          <Route path="/dashboard" element={<div>User dashboard</div>} />
          <Route path="/admin" element={<div>Admin</div>} />
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
    mockedAuthApi.signIn.mockResolvedValueOnce({
      token: 'token',
      expiresAt: '2026-06-13T00:00:00.000Z',
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
    });

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

  it('shows the local demo account icon button when enabled and keeps it blocked until Turnstile is complete', () => {
    vi.stubEnv('VITE_DEMO_SIGN_IN_ENABLED', 'true');

    renderSignIn();

    const demoButton = screen.getByRole('button', { name: /Sign in as demo user/i });
    expect(demoButton).toBeDisabled();
    expect(demoButton.querySelector('svg')).toBeInTheDocument();
    expect(mockedAuthApi.signIn).not.toHaveBeenCalled();
  });

  it('signs in the local demo account without the backend after Turnstile and routes to the dashboard', async () => {
    vi.stubEnv('VITE_DEMO_SIGN_IN_ENABLED', 'true');

    renderSignIn();

    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: /Sign in as demo user/i }));

    await screen.findByText('User dashboard');
    expect(mockedAuthApi.signIn).not.toHaveBeenCalled();
  });

  it('accepts typed demo credentials without the backend when local demo sign-in is enabled', async () => {
    vi.stubEnv('VITE_DEMO_SIGN_IN_ENABLED', 'true');

    renderSignIn();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'demo@procurex.tz' } });
    fireEvent.change(screen.getByLabelText('Password *'), { target: { value: 'Demo123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await screen.findByText('Apps');
    expect(mockedAuthApi.signIn).not.toHaveBeenCalled();
  });

  it('shows the language switcher and translates sign-in copy to Swahili', async () => {
    const user = userEvent.setup();
    renderSignIn();

    const actionGroup = document.querySelector('.auth-header-actions-new');
    const languageSwitcher = screen.getByRole('combobox', { name: 'Language' });
    const createAccountButton = screen.getByRole('button', { name: 'Create an account' });
    expect(actionGroup).toContainElement(languageSwitcher);
    expect(actionGroup).toContainElement(createAccountButton);
    expect(Boolean(languageSwitcher.compareDocumentPosition(createAccountButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    await user.click(screen.getByRole('combobox', { name: 'Language' }));
    await user.click(screen.getByRole('option', { name: 'Swahili' }));

    expect(screen.getByRole('heading', { name: 'Karibu Tena' })).toBeInTheDocument();
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
});
