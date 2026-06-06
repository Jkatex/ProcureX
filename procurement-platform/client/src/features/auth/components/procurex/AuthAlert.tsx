import type { AxiosError } from 'axios';

export type AuthAlertTone = 'error' | 'warning' | 'info' | 'success';

export type AuthAlertMessage = {
  text: string;
  tone: AuthAlertTone;
};

type ApiErrorBody = {
  message?: string;
  error?: string;
};

type AuthErrorContext =
  | 'registration'
  | 'otp'
  | 'activation'
  | 'password'
  | 'sign-in'
  | 'forgot-password'
  | 'reset-password'
  | 'resend-otp'
  | 'resend-activation'
  | 'resend-reset';

function apiStatus(error: unknown) {
  return (error as AxiosError<ApiErrorBody>).response?.status;
}

function apiMessage(error: unknown) {
  if (typeof error === 'string') return error;
  const axiosError = error as AxiosError<ApiErrorBody>;
  return axiosError.response?.data?.message || axiosError.message || '';
}

function isNetworkUnavailable(message: string) {
  return /network|timeout|failed to fetch|load failed|ECONN|ENOTFOUND|ERR_NETWORK/i.test(message);
}

function friendlyAuthError(context: AuthErrorContext, status?: number, message = '') {
  const normalized = message.toLowerCase();

  if (isNetworkUnavailable(message)) return 'The authentication service is not available. Check your connection and try again.';
  if (status === 502) return deliveryFailureMessage(context);
  if (status === 429) return normalized.includes('wait') ? 'Please wait before requesting another code.' : 'Too many attempts. Please wait and try again.';
  if (status === 403) return 'Security check failed or expired. Complete the security check and try again.';
  if (status === 410) return expiredMessage(context);
  if (status === 409) return conflictMessage(context, message);
  if (status === 401) return context === 'sign-in' ? 'Email or password is incorrect.' : 'Your session is invalid or expired. Please sign in again.';
  if (status === 404) return notFoundMessage(context);
  if (status === 400) return badInputMessage(context, message);
  if (status && status >= 500) return 'The authentication service is not available. Please try again later.';

  return message || fallbackMessage(context);
}

function deliveryFailureMessage(context: AuthErrorContext) {
  if (context === 'registration' || context === 'resend-otp') return 'SMS verification is not available right now. Please try again later.';
  if (context === 'activation' || context === 'resend-activation') return 'Email activation is not available right now. Please try again later.';
  if (context === 'forgot-password' || context === 'reset-password' || context === 'resend-reset') return 'Password reset email is not available right now. Please try again later.';
  return 'Delivery is not available right now. Please try again later.';
}

function expiredMessage(context: AuthErrorContext) {
  if (context === 'otp' || context === 'resend-otp') return 'That verification code has expired. Request a new code and try again.';
  if (context === 'activation' || context === 'resend-activation') return 'That activation code has expired. Request a new activation email and try again.';
  if (context === 'reset-password' || context === 'resend-reset') return 'That reset code has expired. Request a new reset code and try again.';
  return 'This request has expired. Start again and try once more.';
}

function conflictMessage(context: AuthErrorContext, message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('phone')) return 'An account already exists for this phone number.';
  if (normalized.includes('email')) return 'An account already exists for this email.';
  if (context === 'password') return 'Verify your phone and email before creating a password.';
  return message || 'This account action is not available with the current information.';
}

function notFoundMessage(context: AuthErrorContext) {
  if (context === 'registration' || context === 'password') return 'Account information was not found. Start registration again.';
  if (context === 'otp' || context === 'resend-otp') return 'Verification request was not found. Request a new code.';
  if (context === 'activation' || context === 'resend-activation') return 'Activation request was not found. Request a new activation email.';
  if (context === 'reset-password' || context === 'resend-reset') return 'Password reset request was not found. Request a new reset code.';
  return 'The requested auth action was not found.';
}

function badInputMessage(context: AuthErrorContext, message: string) {
  const normalized = message.toLowerCase();
  if (normalized.includes('incorrect') || normalized.includes('invalid')) {
    if (context === 'otp') return 'Verification code is incorrect.';
    if (context === 'activation') return 'Activation code is incorrect.';
    if (context === 'reset-password') return 'Password reset code is incorrect.';
  }
  if (context === 'registration' && normalized.includes('phone')) return 'Enter a valid phone number in international format.';
  if (context === 'password' || context === 'reset-password') return 'Enter a stronger password that meets all requirements.';
  return message || fallbackMessage(context);
}

function fallbackMessage(context: AuthErrorContext) {
  if (context === 'sign-in') return 'Sign-in failed. Check the email and password.';
  if (context === 'registration') return 'Could not start registration.';
  if (context === 'forgot-password') return 'Could not request password reset.';
  if (context === 'reset-password') return 'Could not reset password.';
  return 'Request failed. Please try again.';
}

function toneForStatus(status?: number): AuthAlertTone {
  if (status === 429 || status === 410) return 'warning';
  return 'error';
}

export function authAlertFromError(error: unknown, context: AuthErrorContext): AuthAlertMessage {
  const status = apiStatus(error);
  return {
    text: friendlyAuthError(context, status, apiMessage(error)),
    tone: toneForStatus(status)
  };
}

export function authAlert(text: string, tone: AuthAlertTone): AuthAlertMessage {
  return { text, tone };
}

export function AuthAlert({ message }: { message: AuthAlertMessage | null }) {
  if (!message) return null;
  const role = message.tone === 'success' || message.tone === 'info' ? 'status' : 'alert';
  return (
    <p className={`form-message-new ${message.tone}`} role={role}>
      {message.text}
    </p>
  );
}

