import type { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { NotificationCard } from '@/shared/components/NotificationCard';
import { notificationFromApiError } from '@/shared/api/errors';
import type { CreateNotificationInput } from '@/shared/types/notifications';

export type AuthAlertTone = 'error' | 'warning' | 'info' | 'success';

export type AuthAlertMessage = {
  key?: string;
  text?: string;
  tone: AuthAlertTone;
  values?: Record<string, number | string>;
  reason?: string;
  actionLabel?: string;
  autoDismissMs?: number | null;
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

function friendlyAuthError(context: AuthErrorContext, status?: number, message = ''): Pick<AuthAlertMessage, 'key' | 'text'> {
  const normalized = message.toLowerCase();

  if (isNetworkUnavailable(message)) return { key: 'auth.alerts.networkUnavailable' };
  if (status === 502) return deliveryFailureMessage(context);
  if (status === 429) return { key: normalized.includes('wait') ? 'auth.alerts.rateLimitWait' : 'auth.alerts.rateLimit' };
  if (status === 403) return { key: 'auth.alerts.securityFailed' };
  if (status === 410) return expiredMessage(context);
  if (status === 409) return conflictMessage(context, message);
  if (status === 401) return context === 'sign-in' ? { key: 'auth.alerts.invalidCredentials' } : { key: 'auth.alerts.sessionInvalid' };
  if (status === 404) return notFoundMessage(context);
  if (status === 400) return badInputMessage(context, message);
  if (status && status >= 500) return { key: 'auth.alerts.serverUnavailable' };

  return fallbackMessage(context);
}

function deliveryFailureMessage(context: AuthErrorContext): Pick<AuthAlertMessage, 'key'> {
  if (context === 'registration' || context === 'resend-otp') return { key: 'auth.alerts.delivery.smsUnavailable' };
  if (context === 'otp' || context === 'activation' || context === 'resend-activation') return { key: 'auth.alerts.delivery.activationUnavailable' };
  if (context === 'forgot-password' || context === 'reset-password' || context === 'resend-reset') return { key: 'auth.alerts.delivery.resetUnavailable' };
  return { key: 'auth.alerts.deliveryUnavailable' };
}

function expiredMessage(context: AuthErrorContext): Pick<AuthAlertMessage, 'key'> {
  if (context === 'otp' || context === 'resend-otp') return { key: 'auth.alerts.expired.otp' };
  if (context === 'activation' || context === 'resend-activation') return { key: 'auth.alerts.expired.activation' };
  if (context === 'reset-password' || context === 'resend-reset') return { key: 'auth.alerts.expired.reset' };
  return { key: 'auth.alerts.requestExpired' };
}

function conflictMessage(context: AuthErrorContext, message: string): Pick<AuthAlertMessage, 'key' | 'text'> {
  const normalized = message.toLowerCase();
  if (normalized.includes('phone')) return { key: 'auth.alerts.conflict.phone' };
  if (normalized.includes('email')) return { key: 'auth.alerts.conflict.email' };
  if (context === 'password') return { key: 'auth.alerts.conflict.passwordGate' };
  return { key: 'auth.alerts.actionUnavailable' };
}

function notFoundMessage(context: AuthErrorContext): Pick<AuthAlertMessage, 'key'> {
  if (context === 'registration' || context === 'password') return { key: 'auth.alerts.notFound.registration' };
  if (context === 'otp' || context === 'resend-otp') return { key: 'auth.alerts.notFound.otp' };
  if (context === 'activation' || context === 'resend-activation') return { key: 'auth.alerts.notFound.activation' };
  if (context === 'reset-password' || context === 'resend-reset') return { key: 'auth.alerts.notFound.reset' };
  return { key: 'auth.alerts.authActionNotFound' };
}

function badInputMessage(context: AuthErrorContext, message: string): Pick<AuthAlertMessage, 'key' | 'text'> {
  const normalized = message.toLowerCase();
  if (normalized.includes('incorrect') || normalized.includes('invalid')) {
    if (context === 'otp') return { key: 'auth.alerts.badInput.otp' };
    if (context === 'activation') return { key: 'auth.alerts.badInput.activation' };
    if (context === 'reset-password') return { key: 'auth.alerts.badInput.reset' };
  }
  if (context === 'registration' && normalized.includes('phone')) return { key: 'auth.alerts.badInput.phone' };
  if (context === 'password' || context === 'reset-password') return { key: 'auth.alerts.badInput.password' };
  return fallbackMessage(context);
}

function fallbackMessage(context: AuthErrorContext): Pick<AuthAlertMessage, 'key'> {
  if (context === 'sign-in') return { key: 'auth.alerts.fallback.signIn' };
  if (context === 'registration') return { key: 'auth.alerts.fallback.registration' };
  if (context === 'forgot-password') return { key: 'auth.alerts.fallback.forgotPassword' };
  if (context === 'reset-password') return { key: 'auth.alerts.fallback.resetPassword' };
  return { key: 'auth.alerts.requestFailed' };
}

function toneForStatus(status?: number): AuthAlertTone {
  if (status === 429 || status === 410) return 'warning';
  return 'error';
}

export function authAlertFromError(error: unknown, context: AuthErrorContext): AuthAlertMessage {
  const status = apiStatus(error);
  const content = friendlyAuthError(context, status, apiMessage(error));
  const notification = notificationFromApiError(error, { fallback: fallbackMessage(context).key });
  return {
    ...content,
    tone: toneForStatus(status),
    reason: notification.reason,
    actionLabel: notification.action?.label
  };
}

export function authAlert(key: string, tone: AuthAlertTone, values?: Record<string, number | string>): AuthAlertMessage {
  return { key, tone, values };
}

export function authAlertText(text: string, tone: AuthAlertTone, autoDismissMs?: number | null): AuthAlertMessage {
  return { text, tone, autoDismissMs };
}

export function authAlertToNotification(message: AuthAlertMessage, translate: (key: string, values?: Record<string, number | string>) => string): CreateNotificationInput {
  const text = message.key ? translate(message.key, message.values) : message.text;
  return {
    tone: message.tone,
    title: titleForTone(message.tone),
    message: text ?? '',
    reason: message.reason,
    action: message.actionLabel ? { label: message.actionLabel } : undefined,
    dismissible: true,
    autoDismissMs: message.autoDismissMs
  };
}

export function AuthAlert({ message }: { message: AuthAlertMessage | null }) {
  const { t } = useTranslation();
  if (!message) return null;
  const notification: CreateNotificationInput = { ...authAlertToNotification(message, t), dismissible: false };
  return <NotificationCard notification={notification} />;
}

function titleForTone(tone: AuthAlertTone) {
  if (tone === 'success') return 'Success';
  if (tone === 'warning') return 'Needs attention';
  if (tone === 'info') return 'Information';
  return 'Action needed';
}
