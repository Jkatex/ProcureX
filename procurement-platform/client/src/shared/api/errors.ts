import type { AxiosError } from 'axios';
import i18n from '@/i18n';
import type { CreateNotificationInput, UserNotification } from '@/shared/types/notifications';

type ApiErrorBody = {
  message?: string;
  error?: string;
  errors?: Array<string | { message?: unknown }>;
};

export const keyphraseErrorMessage = 'Wrong or mismatched keyphrase. Check the keyphrase and try again.';
const keyphraseErrorTitle = 'Wrong keyphrase';
const keyphraseErrorReason = 'The keyphrase entered does not match the signing credential for this account.';

const localized = {
  en: {
    keyphraseErrorMessage,
    keyphraseErrorTitle,
    keyphraseErrorReason,
    requestFailed: 'Request failed.',
    open: 'Open',
    tryAgain: 'Try again',
    signInAgain: 'Sign in again',
    serviceUnavailable: 'Service unavailable',
    sessionExpired: 'Session expired',
    actionBlocked: 'Action blocked',
    tooManyAttempts: 'Too many attempts',
    serviceProblem: 'Service problem',
    somethingWentWrong: 'Something went wrong',
    networkReason: 'ProcureX could not reach the service needed for this action.',
    invalidReason: 'Some submitted information is incomplete or invalid.',
    sessionReason: 'Your session is no longer valid for this request.',
    permissionReason: 'Your account, permission, or security check does not allow this action right now.',
    conflictReason: 'The request conflicts with an existing record or the current workflow state.',
    expiredReason: 'The code, link, or request has expired.',
    rateReason: 'This action was attempted too many times in a short period.',
    serverReason: 'ProcureX could not complete this request.',
    defaultReason: 'ProcureX could not complete this action.'
  },
  sw: {
    keyphraseErrorMessage: 'Kaulisiri si sahihi au haifanani. Kagua kaulisiri kisha ujaribu tena.',
    keyphraseErrorTitle: 'Kaulisiri si sahihi',
    keyphraseErrorReason: 'Kaulisiri uliyoingiza hailingani na kitambulisho cha saini cha akaunti hii.',
    requestFailed: 'Ombi halikufanikiwa.',
    open: 'Fungua',
    tryAgain: 'Jaribu tena',
    signInAgain: 'Ingia tena',
    serviceUnavailable: 'Huduma haipatikani',
    sessionExpired: 'Kipindi kimeisha',
    actionBlocked: 'Kitendo kimezuiwa',
    tooManyAttempts: 'Majaribio ni mengi',
    serviceProblem: 'Tatizo la huduma',
    somethingWentWrong: 'Hitilafu imetokea',
    networkReason: 'ProcureX haikuweza kufikia huduma inayohitajika kwa kitendo hiki.',
    invalidReason: 'Baadhi ya taarifa ulizowasilisha hazijakamilika au si sahihi.',
    sessionReason: 'Kipindi chako hakitumiki tena kwa ombi hili.',
    permissionReason: 'Akaunti, ruhusa, au ukaguzi wa usalama haukuruhusu kitendo hiki kwa sasa.',
    conflictReason: 'Ombi linakinzana na rekodi iliyopo au hali ya sasa ya mtiririko wa kazi.',
    expiredReason: 'Msimbo, kiungo, au ombi limeisha muda.',
    rateReason: 'Kitendo hiki kimejaribiwa mara nyingi ndani ya muda mfupi.',
    serverReason: 'ProcureX haikuweza kukamilisha ombi hili.',
    defaultReason: 'ProcureX haikuweza kukamilisha kitendo hiki.'
  }
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
  const copy = copyForLanguage();
  if (isKeyphraseApiError(error)) return copy.keyphraseErrorMessage;
  return fallback === 'Request failed.' ? copy.requestFailed : fallback;
}

export function apiRawErrorMessage(error: unknown) {
  return rawApiMessage(error).trim();
  if (isKeyphraseApiError(error)) return keyphraseErrorMessage;
  const status = apiStatus(error);
  const rawMessage = rawApiMessage(error).trim();
  if (status && status >= 400 && status < 500 && rawMessage && !isNetworkUnavailable(rawMessage)) return rawMessage;
  return fallback;
}

export function notificationFromApiError(error: unknown, context: ApiErrorNotificationContext = {}): CreateNotificationInput {
  const status = apiStatus(error);
  const rawMessage = rawApiMessage(error);
  const isKeyphraseError = isKeyphraseErrorMessage(rawMessage);
  const copy = copyForLanguage();
  const message = isKeyphraseError ? copy.keyphraseErrorMessage : context.fallback ?? copy.requestFailed;
  const title = isKeyphraseError ? copy.keyphraseErrorTitle : context.title ?? titleForStatus(status, rawMessage);
  const message = isKeyphraseError ? keyphraseErrorMessage : apiErrorMessage(error, context.fallback ?? 'Request failed.');
  const title = isKeyphraseError ? keyphraseErrorTitle : context.title ?? titleForStatus(status, rawMessage);
  const mapped = errorGuidance(status, rawMessage);

  return {
    tone: mapped.tone,
    title,
    message,
    reason: mapped.reason,
    action: context.actionTo ? { label: mapped.actionLabel ?? copy.open, to: context.actionTo } : mapped.action,
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
  const copy = copyForLanguage();
  if (isNetworkUnavailable(message)) return copy.serviceUnavailable;
  if (status === 401) return copy.sessionExpired;
  if (status === 403) return copy.actionBlocked;
  if (status === 429) return copy.tooManyAttempts;
  if (status && status >= 500) return copy.serviceProblem;
  return copy.somethingWentWrong;
}

function errorGuidance(status: number | undefined, message: string): Pick<CreateNotificationInput, 'tone' | 'reason' | 'action'> & { actionLabel?: string } {
  const copy = copyForLanguage();
  if (isNetworkUnavailable(message)) {
    return {
      tone: 'error',
      reason: copy.networkReason
    };
  }

  if (isKeyphraseErrorMessage(message)) {
    return {
      tone: 'error',
      reason: copy.keyphraseErrorReason,
      actionLabel: copy.tryAgain,
      action: { label: copy.tryAgain }
    };
  }

  if (status === 400) {
    return {
      tone: 'error',
      reason: copy.invalidReason
    };
  }

  if (status === 401) {
    return {
      tone: 'warning',
      reason: copy.sessionReason,
      actionLabel: copy.signInAgain,
      action: { label: copy.signInAgain, to: '/sign-in' }
    };
  }

  if (status === 403) {
    return {
      tone: 'error',
      reason: copy.permissionReason
    };
  }

  if (status === 409) {
    return {
      tone: 'warning',
      reason: copy.conflictReason
    };
  }

  if (status === 410) {
    return {
      tone: 'warning',
      reason: copy.expiredReason
    };
  }

  if (status === 429) {
    return {
      tone: 'warning',
      reason: copy.rateReason
    };
  }

  if (status && status >= 500) {
    return {
      tone: 'error',
      reason: copy.serverReason
    };
  }

  return {
    tone: 'error',
    reason: copy.defaultReason
  };
}

function copyForLanguage() {
  return i18n.language === 'sw' ? localized.sw : localized.en;
}
