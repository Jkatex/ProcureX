/* Exercises auth behavior so regressions are caught close to the domain workflow they protect. */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { authApi } from '@/features/auth/api';
import { ForgotPasswordProcurexPage } from './ForgotPasswordProcurexPage';

vi.mock('@/features/auth/api', () => ({
  authApi: {
    forgotPassword: vi.fn(),
    resendResetCode: vi.fn(),
    verifyResetCode: vi.fn(),
    resetPassword: vi.fn()
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

function renderForgotPassword(initialEntry = '/forgot-password') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ForgotPasswordProcurexPage />
    </MemoryRouter>
  );
}

describe('ForgotPasswordProcurexPage', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage('en');
    mockedAuthApi.forgotPassword.mockReset();
    mockedAuthApi.resendResetCode.mockReset();
    mockedAuthApi.verifyResetCode.mockReset();
    mockedAuthApi.resetPassword.mockReset();
  });

  it('requests a reset code for an existing account and moves to code verification', async () => {
    mockedAuthApi.forgotPassword.mockResolvedValueOnce({
      ok: true,
      accountFound: true,
      message: 'Password reset code has been sent to this email.',
      challengeId: 'reset-challenge',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });

    renderForgotPassword();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: '  reset@example.test  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Instructions' }));

    await waitFor(() => expect(mockedAuthApi.forgotPassword).toHaveBeenCalledWith({ email: 'reset@example.test', turnstileToken: 'turnstile-token' }));
    expect(screen.getByRole('heading', { name: 'Verify Reset Code' })).toBeInTheDocument();
    expect(mockedAuthApi.forgotPassword).toHaveBeenCalledWith({ email: 'reset@example.test', turnstileToken: 'turnstile-token' });
    expect(screen.getByRole('status')).toHaveClass('procurex-notification-card', 'tone-info');
  });

  it('shows email-not-found and stays on the email step', async () => {
    mockedAuthApi.forgotPassword.mockResolvedValueOnce({
      ok: true,
      accountFound: false,
      message: 'No account found for this email.'
    });

    renderForgotPassword();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'missing@example.test' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send Reset Instructions' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No account found for this email.');
    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeInTheDocument();
  });

  it('accepts challenge query and code hash parameters, verifies the code, and resets the password', async () => {
    mockedAuthApi.verifyResetCode.mockResolvedValueOnce({
      ok: true,
      challengeId: 'query-challenge',
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString()
    });
    mockedAuthApi.resetPassword.mockResolvedValueOnce({
      ok: true,
      user: {
        id: 'user-1',
        email: 'reset@example.test',
        displayName: 'Reset User',
        accountType: 'USER',
        organization: 'Reset Organization',
        verificationStatus: 'APPROVED',
        capabilities: []
      }
    });

    renderForgotPassword('/forgot-password?challengeId=query-challenge#code=123456');

    expect(screen.getByLabelText('Reset Code *')).toHaveValue('123456');
    expect(screen.getByLabelText('Reset Code *')).toHaveAttribute('autocomplete', 'one-time-code');
    expect(screen.getByRole('button', { name: 'Back' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));

    await screen.findByRole('heading', { name: 'Create New Password' });
    expect(mockedAuthApi.verifyResetCode).toHaveBeenCalledWith({
      challengeId: 'query-challenge',
      code: '123456',
      turnstileToken: 'turnstile-token'
    });

    const passwords = screen.getAllByLabelText(/Password \*/);
    expect(passwords[0]).toHaveAttribute('maxlength', '128');
    fireEvent.change(passwords[0], { target: { value: 'Better123!' } });
    fireEvent.change(screen.getByLabelText('Confirm New Password *'), { target: { value: 'Better123!' } });
    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await screen.findByRole('heading', { name: 'Password Updated' });
    expect(mockedAuthApi.resetPassword).toHaveBeenCalledWith({
      challengeId: 'query-challenge',
      code: '123456',
      password: 'Better123!',
      turnstileToken: 'turnstile-token'
    });
    expect(screen.getByRole('status')).toHaveClass('procurex-notification-card', 'tone-success');
  });

  it('resends reset codes and renders resend failures as errors', async () => {
    mockedAuthApi.resendResetCode.mockRejectedValueOnce(apiError(502, 'Could not send password reset email. Please try again later.'));

    renderForgotPassword('/forgot-password?challengeId=query-challenge');

    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Resend Reset Code' }));

    await waitFor(() => expect(mockedAuthApi.resendResetCode).toHaveBeenCalledWith({ challengeId: 'query-challenge', turnstileToken: 'turnstile-token' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Password reset email is not available right now. Please try again later.');
  });

  it('blocks reset requests until the security check is complete', async () => {
    renderForgotPassword();

    fireEvent.change(screen.getByLabelText('Email Address *'), { target: { value: 'reset@example.test' } });
    fireEvent.submit(document.querySelector('form')!);

    expect(await screen.findByText('Complete the security check before continuing.')).toBeInTheDocument();
    expect(mockedAuthApi.forgotPassword).not.toHaveBeenCalled();
  });

  it('shows the language switcher and translates reset request copy to Swahili', async () => {
    renderForgotPassword();

    const actionGroup = document.querySelector('.auth-header-actions-new');
    const languageSwitcher = screen.getByRole('combobox', { name: 'Language' });
    const backButton = screen.getByRole('button', { name: 'Back to sign in' });
    expect(actionGroup).toContainElement(languageSwitcher);
    expect(actionGroup).toContainElement(backButton);
    expect(Boolean(languageSwitcher.compareDocumentPosition(backButton) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true);

    fireEvent.change(languageSwitcher, { target: { value: 'sw' } });

    expect(await screen.findByRole('heading', { name: 'Weka Upya Nenosiri' })).toBeInTheDocument();
    expect(screen.getByLabelText('Barua Pepe *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tuma Maelekezo ya Kuweka Upya' })).toBeInTheDocument();
  });

  it('shows an incorrect reset code alert', async () => {
    mockedAuthApi.verifyResetCode.mockRejectedValueOnce(apiError(400, 'Password reset code is incorrect.'));

    renderForgotPassword('/forgot-password?challengeId=query-challenge#code=123456');

    fireEvent.click(screen.getByRole('button', { name: 'Complete security check' }));
    fireEvent.click(screen.getByRole('button', { name: 'Verify Code' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Password reset code is incorrect.');
  });
});
