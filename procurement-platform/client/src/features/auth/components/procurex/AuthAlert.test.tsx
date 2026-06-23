import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '@/i18n';
import { AuthAlert, authAlert, authAlertFromError, authAlertText, authAlertToNotification } from './AuthAlert';

function apiError(status: number, message: string) {
  return { response: { status, data: { message } }, message };
}

describe('AuthAlert', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await i18n.changeLanguage('en');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders error and warning messages as alerts, and success/info as status messages', () => {
    const { rerender } = render(<AuthAlert message={authAlert('auth.security.missing', 'error')} />);
    expect(screen.getByRole('alert')).toHaveClass('procurex-notification-card', 'tone-error');

    rerender(<AuthAlert message={authAlert('auth.register.messages.otpResent', 'success')} />);
    expect(screen.getByRole('status')).toHaveClass('procurex-notification-card', 'tone-success');
  });

  it('maps common auth API failures to user-friendly messages', () => {
    expect(authAlertFromError(apiError(502, 'Could not send verification SMS.'), 'registration')).toEqual({
      key: 'auth.alerts.delivery.smsUnavailable',
      tone: 'error',
      reason: 'The server could not complete the request.',
      actionLabel: undefined
    });
    expect(authAlertFromError(apiError(502, 'Could not send activation email.'), 'otp')).toEqual({
      key: 'auth.alerts.delivery.activationUnavailable',
      tone: 'error',
      reason: 'The server could not complete the request.',
      actionLabel: undefined
    });
    expect(authAlertFromError(apiError(400, 'OTP code is incorrect.'), 'otp')).toEqual({
      key: 'auth.alerts.badInput.otp',
      tone: 'error',
      reason: 'Some submitted information is incomplete or invalid.',
      actionLabel: undefined
    });
    expect(authAlertFromError(apiError(410, 'OTP challenge is no longer valid.'), 'otp')).toEqual({
      key: 'auth.alerts.expired.otp',
      tone: 'warning',
      reason: 'The code, link, or request has expired.',
      actionLabel: undefined
    });
    expect(authAlertFromError(apiError(429, 'Please wait before requesting another code.'), 'resend-otp')).toEqual({
      key: 'auth.alerts.rateLimitWait',
      tone: 'warning',
      reason: 'This action was attempted too many times in a short period.',
      actionLabel: undefined
    });
    expect(authAlertFromError(apiError(409, 'An account already exists for this phone number.'), 'registration')).toEqual({
      key: 'auth.alerts.conflict.phone',
      tone: 'error',
      reason: 'The request conflicts with an existing record or the current workflow state.',
      actionLabel: undefined
    });
    expect(authAlertFromError(apiError(403, 'Security check failed.'), 'sign-in')).toEqual({
      key: 'auth.alerts.securityFailed',
      tone: 'error',
      reason: 'Your account, permission, or security check does not allow this action right now.',
      actionLabel: undefined
    });
  });

  it('renders mapped auth failures in the active language', async () => {
    await i18n.changeLanguage('sw');

    render(<AuthAlert message={authAlertFromError(apiError(400, 'OTP code is incorrect.'), 'otp')} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Msimbo wa uthibitishaji si sahihi.');
  });

  it('keeps temporary code notifications visible longer than the default duration', () => {
    vi.useFakeTimers();
    render(<AuthAlert message={authAlertText('Temporary phone verification code: 123456', 'info', 30_000)} />);

    expect(screen.getByRole('status')).toHaveTextContent('Temporary phone verification code: 123456');

    act(() => {
      vi.advanceTimersByTime(6_500);
    });
    expect(screen.getByRole('status')).toHaveTextContent('Temporary phone verification code: 123456');

    act(() => {
      vi.advanceTimersByTime(23_500);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('maps temporary code alerts to long-lived floating toast notifications', () => {
    const notification = authAlertToNotification(authAlertText('Temporary phone verification code: 123456', 'info', 30_000), i18n.t);

    expect(notification).toMatchObject({
      tone: 'info',
      title: 'Information',
      message: 'Temporary phone verification code: 123456',
      dismissible: true,
      autoDismissMs: 30_000
    });
  });
});
