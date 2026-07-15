import type { AxiosError } from 'axios';
import type { CreateNotificationInput, UserNotification } from '@/shared/types/notifications';

type ApiErrorBody = {
  message?: string;
  error?: string;
  errors?: Array<string | { message?: unknown }>;
};

export const keyphraseErrorMessage = 'Wrong or mismatched keyphrase. Check the keyphrase and try again.';
const keyphraseErrorTitle = 'Wrong keyphrase';
const keyphraseErrorReason = 'The keyphrase entered does not match the signing credential for this account.';

export type ApiErrorNotificationContext = {
  title?: string;
  fallback?: string;
  actionTo?: string;
};

function apiStatus(error: unknown) {
  return (error as AxiosError<ApiErrorBody>).response?.status;
}

function rawApiMessage(error: unknown) {
  if (typeof error === 'string') return error;
  const axiosError = error as AxiosError<ApiErrorBody>;
  const data = axiosError.response?.data;
  const issueMessages = Array.isArray(data?.errors)
    ? data.errors
        .map((issue) => (typeof issue === 'string' ? issue : typeof issue.message === 'string' ? issue.message : ''))
        .filter(Boolean)
        .join(' ')
    : '';
  return data?.message || data?.error || issueMessages || axiosError.message || '';
}

function isNetworkUnavailable(message: string) {
  return /network|timeout|failed to fetch|load failed|ECONN|ENOTFOUND|ERR_NETWORK|can't reach/i.test(message);
}

function isKeyphraseErrorMessage(message: string) {
  return /invalid keyphrase|key\s*phrase.*do not match|keyphrases? do not match|keyphrases? must|key\s*phrase.*must/i.test(message);
}

export function isKeyphraseApiError(error: unknown) {
  return isKeyphraseErrorMessage(rawApiMessage(error));
}

export function apiErrorMessage(error: unknown, fallback = 'Request failed.') {
  if (isKeyphraseApiError(error)) return keyphraseErrorMessage;
  return fallback;
}

export function notificationFromApiError(error: unknown, context: ApiErrorNotificationContext = {}): CreateNotificationInput {
  const status = apiStatus(error);
  const rawMessage = rawApiMessage(error);
  const isKeyphraseError = isKeyphraseErrorMessage(rawMessage);
  const message = isKeyphraseError ? keyphraseErrorMessage : context.fallback ?? 'Request failed.';
  const title = isKeyphraseError ? keyphraseErrorTitle : context.title ?? titleForStatus(status, rawMessage);
  const mapped = errorGuidance(status, rawMessage);

  return {
    tone: mapped.tone,
    title,
    message,
    reason: mapped.reason,
    action: context.actionTo ? { label: mapped.actionLabel ?? 'Open', to: context.actionTo } : mapped.action,
    dismissible: true,
    autoDismissMs: 6000
  };
}

export function notifyApiError(dispatch: (action: unknown) => unknown, error: unknown, context: ApiErrorNotificationContext = {}) {
  return dispatch({ type: 'notifications/enqueueNotification', payload: notificationWithMetadata(notificationFromApiError(error, context)) });
}

function notificationWithMetadata(input: CreateNotificationInput): UserNotification {
  return {
    ...input,
    id: input.id ?? notificationId(),
    createdAt: input.createdAt ?? new Date().toISOString(),
    dismissible: input.dismissible ?? true
  };
}

function notificationId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `notification-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function titleForStatus(status: number | undefined, message: string) {
  if (isNetworkUnavailable(message)) return 'Service unavailable';
  if (status === 401) return 'Session expired';
  if (status === 403) return 'Action blocked';
  if (status === 429) return 'Too many attempts';
  if (status && status >= 500) return 'Service problem';
  return 'Something went wrong';
}

function errorGuidance(status: number | undefined, message: string): Pick<CreateNotificationInput, 'tone' | 'reason' | 'action'> & { actionLabel?: string } {
  if (isNetworkUnavailable(message)) {
    return {
      tone: 'error',
      reason: 'ProcureX could not reach the service needed for this action.'
    };
  }

  if (isKeyphraseErrorMessage(message)) {
    return {
      tone: 'error',
      reason: keyphraseErrorReason,
      actionLabel: 'Try again',
      action: { label: 'Try again' }
    };
  }

  if (status === 400) {
    return {
      tone: 'error',
      reason: 'Some submitted information is incomplete or invalid.'
    };
  }

  if (status === 401) {
    return {
      tone: 'warning',
      reason: 'Your session is no longer valid for this request.',
      actionLabel: 'Sign in again',
      action: { label: 'Sign in again', to: '/sign-in' }
    };
  }

  if (status === 403) {
    return {
      tone: 'error',
      reason: 'Your account, permission, or security check does not allow this action right now.'
    };
  }

  if (status === 409) {
    return {
      tone: 'warning',
      reason: 'The request conflicts with an existing record or the current workflow state.'
    };
  }

  if (status === 410) {
    return {
      tone: 'warning',
      reason: 'The code, link, or request has expired.'
    };
  }

  if (status === 429) {
    return {
      tone: 'warning',
      reason: 'This action was attempted too many times in a short period.'
    };
  }

  if (status && status >= 500) {
    return {
      tone: 'error',
      reason: 'ProcureX could not complete this request.'
    };
  }

  return {
    tone: 'error',
    reason: 'ProcureX could not complete this action.'
  };
}
