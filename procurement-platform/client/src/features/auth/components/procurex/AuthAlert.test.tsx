import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AuthAlert, authAlert, authAlertFromError } from './AuthAlert';

function apiError(status: number, message: string) {
  return { response: { status, data: { message } }, message };
}

describe('AuthAlert', () => {
  it('renders error and warning messages as alerts, and success/info as status messages', () => {
    const { rerender } = render(<AuthAlert message={authAlert('Something is wrong.', 'error')} />);
    expect(screen.getByRole('alert')).toHaveClass('form-message-new', 'error');

    rerender(<AuthAlert message={authAlert('Saved.', 'success')} />);
    expect(screen.getByRole('status')).toHaveClass('form-message-new', 'success');
  });

  it('maps common auth API failures to user-friendly messages', () => {
    expect(authAlertFromError(apiError(502, 'Could not send verification SMS.'), 'registration')).toEqual({
      text: 'SMS verification is not available right now. Please try again later.',
      tone: 'error'
    });
    expect(authAlertFromError(apiError(400, 'OTP code is incorrect.'), 'otp')).toEqual({
      text: 'Verification code is incorrect.',
      tone: 'error'
    });
    expect(authAlertFromError(apiError(410, 'OTP challenge is no longer valid.'), 'otp')).toEqual({
      text: 'That verification code has expired. Request a new code and try again.',
      tone: 'warning'
    });
    expect(authAlertFromError(apiError(429, 'Please wait before requesting another code.'), 'resend-otp')).toEqual({
      text: 'Please wait before requesting another code.',
      tone: 'warning'
    });
    expect(authAlertFromError(apiError(409, 'An account already exists for this phone number.'), 'registration')).toEqual({
      text: 'An account already exists for this phone number.',
      tone: 'error'
    });
    expect(authAlertFromError(apiError(403, 'Security check failed.'), 'sign-in')).toEqual({
      text: 'Security check failed or expired. Complete the security check and try again.',
      tone: 'error'
    });
  });
});

