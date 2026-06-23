import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { store } from '@/app/store';
import i18n from '@/i18n';
import { authApi } from '@/features/auth/api';
import { NotificationToastHost } from '@/features/notifications/NotificationToastHost';
import { clearNotifications } from '@/features/notifications/slice';
import { useCurrentLegalVersions } from '@/features/public/hooks';
import { RegisterProcurexPage } from './RegisterProcurexPage';

vi.mock('@/features/auth/api', () => ({
  authApi: {
    startRegistration: vi.fn(),
    verifyOtp: vi.fn(),
    resendOtp: vi.fn(),
    activateEmail: vi.fn(),
    resendActivation: vi.fn(),
    setPassword: vi.fn()
  }
}));

vi.mock('@/features/public/hooks', () => ({
  useCurrentLegalVersions: vi.fn()
}));

vi.mock('./TurnstileWidget', () => ({
  TurnstileWidget: ({ onVerify }: { onVerify: (token: string) => void }) => (
    <button type="button" onClick={() => onVerify('turnstile-token')}>
      Complete security check
    </button>
  )
}));

const mockedAuthApi = vi.mocked(authApi);
const mockedUseCurrentLegalVersions = vi.mocked(useCurrentLegalVersions);

function apiError(status: number, message: string) {
  return { response: { status, data: { message } }, message };
}

function fillVisibleInput(type: string, value: string, index = 0) {
  const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(`input[type="${type}"], input:not([type])`)).filter(
    (input) => input.offsetParent !== null || input.closest('.register-screen-new.active')
  );
  fireEvent.change(inputs[index], { target: { value } });
}

function renderRegisterPage() {
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <RegisterProcurexPage />
        <NotificationToastHost />
      </MemoryRouter>
    </Provider>
  );
}

describe('RegisterProcurexPage', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    store.dispatch(clearNotifications());
    await i18n.changeLanguage('en');
    mockedAuthApi.startRegistration.mockReset();
    mockedAuthApi.verifyOtp.mockReset();
    mockedAuthApi.resendOtp.mockReset();
    mockedAuthApi.activateEmail.mockReset();
    mockedAuthApi.resendActivation.mockReset();
    mockedAuthApi.setPassword.mockReset();
    mockedUseCurrentLegalVersions.mockReturnValue({
      data: {
        terms: {
          id: 'terms-version-id',
          pageKey: 'terms-and-conditions',
          version: '2026.06.06',
          status: 'PUBLISHED',
          title: 'Terms and Conditions',
          summary: null,
          content: {},
          contentHash: 'terms-hash',
          effectiveAt: '2026-06-06T00:00:00.000Z',
          publishedAt: '2026-06-06T00:00:00.000Z',
          lastUpdated: '2026-06-06T00:00:00.000Z'
        },
        privacy: {
          id: 'privacy-version-id',
          pageKey: 'privacy-policy',
          version: '2026.06.06',
          status: 'PUBLISHED',
          title: 'Privacy Policy',
          summary: null,
          content: {},
          contentHash: 'privacy-hash',
          effectiveAt: '2026-06-06T00:00:00.000Z',
          publishedAt: '2026-06-06T00:00:00.000Z',
          lastUpdated: '2026-06-06T00:00:00.000Z'
        }
      },
      status: 'success',
      isLoading: false,
      isError: false
    });
  });

  it('links to legal pages and sends accepted legal version IDs when creating the account', async () => {
    mockedAuthApi.startRegistration.mockResolvedValueOnce({ user: {}, challengeId: 'otp-challenge', expiresAt: '2026-06-06T00:00:00.000Z', devCode: '123456' } as never);
    mockedAuthApi.verifyOtp.mockResolvedValueOnce({ activationChallengeId: 'activation-challenge', expiresAt: '2026-06-06T00:00:00.000Z', devCode: 'email-dev-code' });
    mockedAuthApi.activateEmail.mockResolvedValueOnce({ user: {} } as never);
    mockedAuthApi.setPassword.mockResolvedValueOnce({ user: {} } as never);

    renderRegisterPage();

    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="email"]')!, { target: { value: 'legal@example.test' } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="tel"]')!, { target: { value: '+255700000004' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', { name: 'Verify Your Number' });
    const phoneCodeToast = await screen.findByText('Temporary phone verification code: 123456');
    expect(phoneCodeToast.closest('.procurex-toast-host')).toBeInTheDocument();
    expect(document.querySelector<HTMLInputElement>('.otp-input-new')!).toHaveAttribute('autocomplete', 'one-time-code');
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(mockedAuthApi.startRegistration).toHaveBeenCalledWith({ email: 'legal@example.test', phone: '+255700000004', turnstileToken: 'turnstile-token' });
    expect(screen.getByRole('button', { name: 'Verify' })).toBeDisabled();
    fillVisibleInput('text', '123456');
    expect(screen.getByRole('button', { name: 'Verify' })).not.toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    await screen.findByRole('heading', { name: 'Activate Your Email' });
    const emailCodeToast = await screen.findByText('Temporary email activation code: email-dev-code');
    expect(emailCodeToast.closest('.procurex-toast-host')).toBeInTheDocument();
    expect(screen.getByLabelText('Activation Code *')).toHaveAttribute('autocomplete', 'one-time-code');
    fillVisibleInput('text', '87654321');
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Password Setup' }));

    await screen.findByRole('heading', { name: 'Create Your Password' });
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeDisabled();
    const passwordInputs = document.querySelectorAll<HTMLInputElement>('input[type="password"]');
    expect(passwordInputs[0]).toHaveAttribute('maxlength', '128');
    fireEvent.change(passwordInputs[0], { target: { value: 'Strong123!' } });
    fireEvent.change(passwordInputs[1], { target: { value: 'Strong123!' } });
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox'));

    expect(screen.getByRole('link', { name: 'Terms and Conditions' })).toHaveAttribute('href', '/terms');
    expect(screen.getByRole('link', { name: 'Privacy Policy' })).toHaveAttribute('href', '/privacy');
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() =>
      expect(mockedAuthApi.setPassword).toHaveBeenCalledWith({
        email: 'legal@example.test',
        password: 'Strong123!',
        termsAccepted: true,
        privacyAccepted: true,
        termsVersionId: 'terms-version-id',
        privacyVersionId: 'privacy-version-id'
      })
    );
  });

  it('does not expose mock sign-up shortcuts', () => {
    renderRegisterPage();

    expect(document.querySelector('.mock-fill-btn')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Join Us' })).toBeInTheDocument();
  });

  it('does not collect Tanzania location during registration', async () => {
    mockedAuthApi.startRegistration.mockResolvedValueOnce({ user: {}, challengeId: 'otp-challenge', expiresAt: '2026-06-06T00:00:00.000Z' } as never);

    renderRegisterPage();

    expect(screen.queryByText('Location in Tanzania')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Region')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('District')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Ward/shehia')).not.toBeInTheDocument();
    expect(screen.queryByText('Optional during registration. You will confirm a complete location during verification.')).not.toBeInTheDocument();

    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="email"]')!, { target: { value: 'located@example.test' } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="tel"]')!, { target: { value: '+255700000004' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() =>
      expect(mockedAuthApi.startRegistration).toHaveBeenCalledWith({
        email: 'located@example.test',
        phone: '+255700000004',
        turnstileToken: 'turnstile-token'
      })
    );
  });

  it('shows the language switcher and translates registration copy to Swahili', async () => {
    renderRegisterPage();

    const actionGroup = document.querySelector('.auth-header-actions-new');
    const languageSwitcher = screen.getByRole('combobox', { name: 'Language' });
    const signInButton = screen.getByRole('button', { name: 'Already have an account? Sign in' });
    expect(actionGroup).toContainElement(languageSwitcher);
    expect(actionGroup).toContainElement(signInButton);
    expect(Boolean(languageSwitcher.compareDocumentPosition(signInButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    fireEvent.change(languageSwitcher, { target: { value: 'sw' } });

    expect(await screen.findByRole('heading', { name: 'Jiunge Nasi' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('wewe@kampuni.co.tz')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Lugha' })).toBeInTheDocument();
  });

  it('blocks registration submit until the security check is complete', async () => {
    renderRegisterPage();

    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="email"]')!, { target: { value: 'secure@example.test' } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="tel"]')!, { target: { value: '+255700000004' } });
    fireEvent.submit(document.querySelector('form')!);

    expect(await screen.findByText('Complete the security check before continuing.')).toBeInTheDocument();
    expect(mockedAuthApi.startRegistration).not.toHaveBeenCalled();
  });

  it('shows a delivery unavailable alert when SMS cannot be sent', async () => {
    mockedAuthApi.startRegistration.mockRejectedValueOnce(apiError(502, 'Could not send verification SMS. Please try again later.'));

    renderRegisterPage();

    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="email"]')!, { target: { value: 'delivery@example.test' } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="tel"]')!, { target: { value: '+255700000004' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('SMS verification is not available right now. Please try again later.');
  });

  it('shows an incorrect OTP alert with the correct tone', async () => {
    mockedAuthApi.startRegistration.mockResolvedValueOnce({ user: {}, challengeId: 'otp-challenge', expiresAt: '2026-06-06T00:00:00.000Z' } as never);
    mockedAuthApi.verifyOtp.mockRejectedValueOnce(apiError(400, 'OTP code is incorrect.'));

    renderRegisterPage();

    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="email"]')!, { target: { value: 'otp@example.test' } });
    fireEvent.change(document.querySelector<HTMLInputElement>('input[type="tel"]')!, { target: { value: '+255700000004' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByRole('heading', { name: 'Verify Your Number' });
    fillVisibleInput('text', '123456');
    fireEvent.click(screen.getByRole('button', { name: 'Verify' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Verification code is incorrect.');
  });
});
