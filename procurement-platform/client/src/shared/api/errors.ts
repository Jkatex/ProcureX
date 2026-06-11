import type { AxiosError } from 'axios';
import type { CreateNotificationInput, UserNotification } from '@/shared/types/notifications';

type ApiErrorBody = {
  message?: string;
  error?: string;
};

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
  return axiosError.response?.data?.message || axiosError.message || '';
}

function isNetworkUnavailable(message: string) {
  return /network|timeout|failed to fetch|load failed|ECONN|ENOTFOUND|ERR_NETWORK|can't reach/i.test(message);
}

export function apiErrorMessage(error: unknown, fallback = 'Request failed.') {
  return rawApiMessage(error) || fallback;
}

export function notificationFromApiError(error: unknown, context: ApiErrorNotificationContext = {}): CreateNotificationInput {
  const status = apiStatus(error);
  const message = apiErrorMessage(error, context.fallback ?? 'Request failed.');
  const title = context.title ?? titleForStatus(status, message);
  const mapped = errorGuidance(status, message);

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
  if (status && status >= 500) return 'Server problem';
  return 'Something went wrong';
}

function errorGuidance(status: number | undefined, message: string): Pick<CreateNotificationInput, 'tone' | 'reason' | 'action'> & { actionLabel?: string } {
  if (isNetworkUnavailable(message)) {
    return {
      tone: 'error',
      reason: 'ProcureX could not reach the service needed for this action.'
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
      reason: 'The server could not complete the request.'
    };
  }

  return {
    tone: 'error',
    reason: 'ProcureX could not complete this action.'
  };
}
