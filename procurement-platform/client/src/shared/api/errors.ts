import type { AxiosError } from 'axios';
import type { ApiErrorAction, ApiErrorResponse, ApiFieldError } from '@procurex/shared';
import i18n from '@/i18n';
import type { CreateNotificationInput, NotificationTone, UserNotification } from '@/shared/types/notifications';

type LegacyApiErrorBody = {
  message?: string;
  error?: string;
  errors?: Array<string | { path?: unknown; field?: unknown; message?: unknown; code?: unknown }>;
};

type ApiErrorBody = Partial<ApiErrorResponse> & LegacyApiErrorBody;

export const keyphraseErrorMessage = 'Wrong or mismatched keyphrase. Check the keyphrase and try again.';

type UserFacingApiError = {
  status?: number;
  code?: string;
  title: string;
  message: string;
  reason: string;
  tone: NotificationTone;
  action?: ApiErrorAction;
  fieldErrors: ApiFieldError[];
  rawMessage: string;
};

export type ApiErrorNotificationContext = {
  title?: string;
  fallback?: string;
  actionTo?: string;
};

const localized = {
  en: {
    keyphraseErrorMessage,
    keyphraseErrorTitle: 'Wrong keyphrase',
    keyphraseErrorReason: 'The keyphrase entered does not match the signing credential for this account.',
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
    notFound: 'Record not found',
    validationTitle: 'Check the information',
    conflictTitle: 'Action needs attention',
    expiredTitle: 'Request expired',
    networkReason: 'ProcureX could not reach the service needed for this action.',
    invalidReason: 'Some submitted information is incomplete or invalid.',
    validationReason: 'Review the highlighted fields and try again.',
    sessionReason: 'Your session is no longer valid for this request.',
    permissionReason: 'Your account, permission, or security check does not allow this action right now.',
    notFoundReason: 'The requested record could not be found.',
    conflictReason: 'The request conflicts with an existing record or the current workflow state.',
    expiredReason: 'The code, link, or request has expired.',
    rateReason: 'This action was attempted too many times in a short period.',
    serverReason: 'ProcureX could not complete this request.',
    unavailableReason: 'A required service is temporarily unavailable.',
    defaultReason: 'ProcureX could not complete this action.',
    tenderIncomplete: 'Tender details are incomplete.',
    tenderIncompleteReason: 'Add the missing tender details, then submit again.',
    submissionClosed: 'Submission is closed for this tender.',
    submissionClosedReason: 'The deadline or workflow state no longer allows this bid action.',
    missingSignature: 'Digital signature keyphrase is required.',
    missingSignatureReason: 'Enter your signing keyphrase to continue this protected action.',
    uploadFailed: 'Document upload failed.',
    uploadFailedReason: 'Check the file and try the upload again.',
    downloadFailed: 'Document could not be opened or downloaded.',
    downloadFailedReason: 'The document service could not provide the file right now.',
    attachmentFailed: 'Attachment could not be opened or downloaded.',
    attachmentFailedReason: 'The attachment service could not provide the file right now.',
    communicationFailed: 'Communication action could not be completed.',
    communicationFailedReason: 'Review the message details and try again.',
    supportFailed: 'Support request could not be sent.',
    supportFailedReason: 'Check the support request details and try again.',
    recordLoadFailed: 'Records could not be loaded.',
    recordLoadFailedReason: 'Refresh the page or adjust the current filters.',
    profileImageFailed: 'Profile image could not be updated.',
    profileImageFailedReason: 'Use a PNG, JPG, or WebP image under the allowed size.',
    detailsPrefix: 'Details'
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
    notFound: 'Rekodi haikupatikana',
    validationTitle: 'Kagua taarifa',
    conflictTitle: 'Kitendo kinahitaji umakini',
    expiredTitle: 'Ombi limeisha muda',
    networkReason: 'ProcureX haikuweza kufikia huduma inayohitajika kwa kitendo hiki.',
    invalidReason: 'Baadhi ya taarifa ulizowasilisha hazijakamilika au si sahihi.',
    validationReason: 'Kagua sehemu zilizoonyeshwa kisha ujaribu tena.',
    sessionReason: 'Kipindi chako hakitumiki tena kwa ombi hili.',
    permissionReason: 'Akaunti, ruhusa, au ukaguzi wa usalama haukuruhusu kitendo hiki kwa sasa.',
    notFoundReason: 'Rekodi iliyoombwa haikupatikana.',
    conflictReason: 'Ombi linakinzana na rekodi iliyopo au hali ya sasa ya mtiririko wa kazi.',
    expiredReason: 'Msimbo, kiungo, au ombi limeisha muda.',
    rateReason: 'Kitendo hiki kimejaribiwa mara nyingi ndani ya muda mfupi.',
    serverReason: 'ProcureX haikuweza kukamilisha ombi hili.',
    unavailableReason: 'Huduma inayohitajika haipatikani kwa muda.',
    defaultReason: 'ProcureX haikuweza kukamilisha kitendo hiki.',
    tenderIncomplete: 'Taarifa za zabuni hazijakamilika.',
    tenderIncompleteReason: 'Ongeza taarifa za zabuni zinazokosekana kisha uwasilishe tena.',
    submissionClosed: 'Uwasilishaji umefungwa kwa zabuni hii.',
    submissionClosedReason: 'Mwisho wa muda au hali ya mtiririko hairuhusu tena kitendo hiki cha ombi la zabuni.',
    missingSignature: 'Kaulisiri ya saini ya kidijitali inahitajika.',
    missingSignatureReason: 'Weka kaulisiri yako ya saini ili kuendelea na kitendo hiki kilicholindwa.',
    uploadFailed: 'Upakiaji wa waraka haukufanikiwa.',
    uploadFailedReason: 'Kagua faili kisha ujaribu kupakia tena.',
    downloadFailed: 'Waraka haukuweza kufunguliwa au kupakuliwa.',
    downloadFailedReason: 'Huduma ya nyaraka haikuweza kutoa faili kwa sasa.',
    attachmentFailed: 'Kiambatisho hakikuweza kufunguliwa au kupakuliwa.',
    attachmentFailedReason: 'Huduma ya viambatisho haikuweza kutoa faili kwa sasa.',
    communicationFailed: 'Kitendo cha mawasiliano hakikuweza kukamilika.',
    communicationFailedReason: 'Kagua taarifa za ujumbe kisha ujaribu tena.',
    supportFailed: 'Ombi la msaada halikuweza kutumwa.',
    supportFailedReason: 'Kagua taarifa za ombi la msaada kisha ujaribu tena.',
    recordLoadFailed: 'Rekodi hazikuweza kupakiwa.',
    recordLoadFailedReason: 'Pakia ukurasa upya au badilisha vichujio vya sasa.',
    profileImageFailed: 'Picha ya wasifu haikuweza kusasishwa.',
    profileImageFailedReason: 'Tumia picha ya PNG, JPG, au WebP iliyo ndani ya ukubwa unaoruhusiwa.',
    detailsPrefix: 'Maelezo'
  }
};

export function toUserError(error: unknown, context: ApiErrorNotificationContext = {}): UserFacingApiError {
  const status = apiStatus(error);
  const body = apiBody(error);
  const rawMessage = rawApiMessage(error);
  const code = typeof body?.code === 'string' ? body.code : undefined;
  const fieldErrors = normalizedFieldErrors(body);
  const copy = copyForLanguage();
  const isKeyphraseError = isKeyphraseErrorMessage(rawMessage) || /KEYPHRASE_INVALID|SIGNATURE_KEYPHRASE_INVALID/i.test(code ?? '');
  const curated = curatedErrorCopy({ status, code, rawMessage, fieldErrors });

  if (isKeyphraseError) {
    return {
      status,
      code,
      title: copy.keyphraseErrorTitle,
      message: copy.keyphraseErrorMessage,
      reason: copy.keyphraseErrorReason,
      tone: 'error',
      action: { label: copy.tryAgain },
      fieldErrors,
      rawMessage
    };
  }

  const mapped = errorGuidance(status, rawMessage, code);
  return {
    status,
    code,
    title: context.title ?? curated.title ?? titleForStatus(status, rawMessage),
    message: curated.message ?? safeServerUserMessage(body, status) ?? context.fallback ?? copy.requestFailed,
    reason: curated.reason ?? safeServerReason(body, status) ?? mapped.reason ?? copy.defaultReason,
    tone: curated.tone ?? mapped.tone,
    action: context.actionTo ? { label: mapped.actionLabel ?? copy.open, to: context.actionTo } : safeAction(body) ?? mapped.action,
    fieldErrors,
    rawMessage
  };
}

export function isKeyphraseApiError(error: unknown) {
  return isKeyphraseErrorMessage(rawApiMessage(error));
}

export function apiErrorMessage(error: unknown, fallback = 'Request failed.') {
  return toUserError(error, { fallback }).message;
}

export function apiRawErrorMessage(error: unknown) {
  return rawApiMessage(error).trim();
}

export function notificationFromApiError(error: unknown, context: ApiErrorNotificationContext = {}): CreateNotificationInput {
  const userError = toUserError(error, context);
  const details = fieldErrorSummary(userError.fieldErrors);

  return {
    tone: userError.tone,
    title: userError.title,
    message: userError.message,
    reason: userError.reason,
    details,
    action: userError.action,
    dismissible: true,
    autoDismissMs: 6000
  };
}

export function notifyApiError(dispatch: (action: unknown) => unknown, error: unknown, context: ApiErrorNotificationContext = {}) {
  return dispatch({ type: 'notifications/enqueueNotification', payload: notificationWithMetadata(notificationFromApiError(error, context)) });
}

function apiStatus(error: unknown) {
  return (error as AxiosError<ApiErrorBody>).response?.status;
}

function apiBody(error: unknown): ApiErrorBody | undefined {
  return (error as AxiosError<ApiErrorBody>).response?.data;
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
  const fieldMessages = Array.isArray(data?.fieldErrors) ? data.fieldErrors.map((issue) => issue.message).filter(Boolean).join(' ') : '';
  return data?.userMessage || data?.message || data?.error || fieldMessages || issueMessages || axiosError.message || '';
}

function isNetworkUnavailable(message: string) {
  return /network|timeout|failed to fetch|load failed|ECONN|ENOTFOUND|ERR_NETWORK|can't reach/i.test(message);
}

function isKeyphraseErrorMessage(message: string) {
  return /invalid keyphrase|wrong keyphrase|key\s*phrase.*do not match|keyphrases? do not match|keyphrases? must|key\s*phrase.*must/i.test(message);
}

function curatedErrorCopy(input: {
  status?: number;
  code?: string;
  rawMessage: string;
  fieldErrors: ApiFieldError[];
}): Partial<Pick<UserFacingApiError, 'title' | 'message' | 'reason' | 'tone'>> {
  const copy = copyForLanguage();
  const haystack = `${input.code ?? ''} ${input.rawMessage}`.toLowerCase();

  if (input.fieldErrors.length || /validation failed|invalid .*payload|schema-required-fields|basic-fields/.test(haystack)) {
    return {
      title: copy.validationTitle,
      message: /tender|procurement|publish/.test(haystack) ? copy.tenderIncomplete : copy.invalidReason,
      reason: /tender|procurement|publish/.test(haystack) ? copy.tenderIncompleteReason : copy.validationReason,
      tone: 'warning'
    };
  }

  if (/deadline|submission.*closed|tender.*closed|bidding.*closed|submission_closed|bid.*closed/.test(haystack)) {
    return {
      title: copy.conflictTitle,
      message: copy.submissionClosed,
      reason: copy.submissionClosedReason,
      tone: 'warning'
    };
  }

  if (/signature.*required|keyphrase.*required|digital signature keyphrase is required/.test(haystack)) {
    return {
      title: copy.validationTitle,
      message: copy.missingSignature,
      reason: copy.missingSignatureReason,
      tone: 'warning'
    };
  }

  if (/upload|file too large|file type|unsupported .*file|multipart|document.*payload/.test(haystack)) {
    return {
      title: copy.validationTitle,
      message: copy.uploadFailed,
      reason: copy.uploadFailedReason,
      tone: 'error'
    };
  }

  if (/download|stream|blob|document content|open.*document/.test(haystack)) {
    return {
      title: copy.serviceUnavailable,
      message: copy.downloadFailed,
      reason: copy.downloadFailedReason,
      tone: 'error'
    };
  }

  if (/attachment/.test(haystack)) {
    return {
      title: copy.serviceUnavailable,
      message: copy.attachmentFailed,
      reason: copy.attachmentFailedReason,
      tone: 'error'
    };
  }

  if (/communication|message|mailbox|reply|recipient/.test(haystack)) {
    return {
      message: copy.communicationFailed,
      reason: copy.communicationFailedReason,
      tone: 'error'
    };
  }

  if (/support|help/.test(haystack)) {
    return {
      message: copy.supportFailed,
      reason: copy.supportFailedReason,
      tone: 'error'
    };
  }

  if (/records?/.test(haystack)) {
    return {
      message: copy.recordLoadFailed,
      reason: copy.recordLoadFailedReason,
      tone: 'error'
    };
  }

  if (/profile image|image/.test(haystack)) {
    return {
      message: copy.profileImageFailed,
      reason: copy.profileImageFailedReason,
      tone: 'error'
    };
  }

  return {};
}

function safeServerUserMessage(body: ApiErrorBody | undefined, status: number | undefined) {
  if (!body || status === undefined || status >= 500) return undefined;
  if (typeof body.userMessage === 'string' && body.userMessage.trim()) return body.userMessage.trim();
  return undefined;
}

function safeServerReason(body: ApiErrorBody | undefined, status: number | undefined) {
  if (!body || status === undefined || status >= 500) return undefined;
  if (typeof body.reason === 'string' && body.reason.trim()) return body.reason.trim();
  return undefined;
}

function safeAction(body: ApiErrorBody | undefined) {
  if (!body?.action?.label) return undefined;
  return body.action;
}

function normalizedFieldErrors(body: ApiErrorBody | undefined): ApiFieldError[] {
  const source = Array.isArray(body?.fieldErrors) ? body.fieldErrors : Array.isArray(body?.errors) ? body.errors : [];
  return source
    .map((issue) => {
      if (typeof issue === 'string') return { path: '', message: issue, code: 'VALIDATION_FAILED' };
      if (!issue || typeof issue !== 'object') return null;
      const issueRecord = issue as { path?: unknown; field?: unknown; message?: unknown; code?: unknown };
      return {
        path: String(issueRecord.path ?? issueRecord.field ?? ''),
        message: String(issueRecord.message ?? ''),
        code: String(issueRecord.code ?? 'VALIDATION_FAILED')
      };
    })
    .filter((issue): issue is ApiFieldError => Boolean(issue?.message));
}

function fieldErrorSummary(fieldErrors: ApiFieldError[]) {
  if (!fieldErrors.length) return undefined;
  return fieldErrors
    .slice(0, 3)
    .map((issue) => {
      const label = humanizePath(issue.path);
      return label ? `${label}: ${issue.message}` : issue.message;
    })
    .join(' ');
}

function humanizePath(path: string) {
  if (!path) return '';
  const last = path.split('.').filter(Boolean).pop() ?? path;
  return last
    .replace(/\[[0-9]+\]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());
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
  if (status === 400 || status === 422) return copy.validationTitle;
  if (status === 401) return copy.sessionExpired;
  if (status === 403) return copy.actionBlocked;
  if (status === 404) return copy.notFound;
  if (status === 409) return copy.conflictTitle;
  if (status === 410) return copy.expiredTitle;
  if (status === 429) return copy.tooManyAttempts;
  if (status === 503) return copy.serviceUnavailable;
  if (status && status >= 500) return copy.serviceProblem;
  return copy.somethingWentWrong;
}

function errorGuidance(status: number | undefined, message: string, code?: string): Pick<CreateNotificationInput, 'tone' | 'reason' | 'action'> & { actionLabel?: string } {
  const copy = copyForLanguage();
  if (isNetworkUnavailable(message)) {
    return {
      tone: 'error',
      reason: copy.networkReason
    };
  }

  if (status === 400 || status === 422 || /VALIDATION/.test(code ?? '')) {
    return {
      tone: 'warning',
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

  if (status === 404) {
    return {
      tone: 'warning',
      reason: copy.notFoundReason
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

  if (status === 503) {
    return {
      tone: 'error',
      reason: copy.unavailableReason
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
