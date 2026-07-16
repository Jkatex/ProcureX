import type { Response } from 'express';
import type { ZodError } from 'zod';
import type { SupportedLanguage } from '@procurex/shared';
import { localizedMessage } from './localization.js';

type ApiFieldError = {
  path: string;
  message: string;
  code: string;
};

type ApiErrorAction = {
  label: string;
  to?: string;
};

type ApiErrorResponse = {
  success: false;
  error: string;
  code: string;
  message: string;
  userMessage: string;
  reason: string;
  fieldErrors: ApiFieldError[];
  action?: ApiErrorAction;
};

export type ProcureXApiErrorInput = {
  status?: number;
  code: string;
  userMessage: string;
  reason?: string;
  fieldErrors?: ApiFieldError[];
  action?: ApiErrorAction;
  internalMessage?: string;
};

export type ProcureXApiError = Error & {
  status: number;
  code: string;
  userMessage: string;
  reason?: string;
  fieldErrors: ApiFieldError[];
  action?: ApiErrorAction;
  expose: true;
};

export function requestError(input: ProcureXApiErrorInput): ProcureXApiError;
export function requestError(message: string, status?: number): ProcureXApiError;
export function requestError(input: ProcureXApiErrorInput | string, status = 400): ProcureXApiError {
  const config: ProcureXApiErrorInput =
    typeof input === 'string'
      ? {
          status,
          code: codeForStatus(status),
          userMessage: input,
          internalMessage: input
        }
      : input;

  const resolvedStatus = config.status ?? status;
  const error = new Error(config.internalMessage ?? config.userMessage) as ProcureXApiError;
  error.status = resolvedStatus;
  error.code = config.code;
  error.userMessage = config.userMessage;
  error.reason = config.reason;
  error.fieldErrors = config.fieldErrors ?? [];
  error.action = config.action;
  error.expose = true;
  return error;
}

export function validationErrorResponse(
  res: Response,
  error: ZodError,
  language: SupportedLanguage = 'en',
  input: Partial<Pick<ProcureXApiErrorInput, 'code' | 'userMessage' | 'reason'>> = {}
) {
  const body = apiErrorResponseBody(
    requestError({
      status: 400,
      code: input.code ?? 'VALIDATION_FAILED',
      userMessage: input.userMessage ?? 'Some submitted information is incomplete or invalid.',
      reason: input.reason ?? 'Review the highlighted fields and try again.',
      fieldErrors: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
        code: issue.code
      }))
    }),
    language
  );
  return res.status(400).json(body);
}

export function apiErrorResponseBody(error: unknown, language: SupportedLanguage): ApiErrorResponse {
  const status = statusFromError(error);
  const safeServerError = status >= 500;
  const code = safeServerError ? 'INTERNAL_ERROR' : codeFromError(error, status);
  const userMessage = safeServerError ? 'Unexpected server error.' : userMessageFromError(error);
  const reason = safeServerError ? 'ProcureX could not complete this request.' : reasonFromError(error, status);
  const fieldErrors = safeServerError ? [] : fieldErrorsFromError(error);
  const action = safeServerError ? undefined : actionFromError(error);

  return {
    success: false,
    error: safeServerError ? 'internal_error' : 'request_error',
    code,
    message: localizedMessage(userMessage, language),
    userMessage: localizedMessage(userMessage, language),
    reason: localizedMessage(reason, language),
    fieldErrors: fieldErrors.map((fieldError) => ({
      ...fieldError,
      message: localizedMessage(fieldError.message, language)
    })),
    ...(action ? { action: { ...action, label: localizedMessage(action.label, language) } } : {})
  };
}

export function statusFromError(error: unknown) {
  const status = Number((error as { status?: unknown })?.status);
  return Number.isInteger(status) && status >= 400 && status <= 599 ? status : 500;
}

export function codeForStatus(status: number) {
  if (status === 400) return 'BAD_REQUEST';
  if (status === 401) return 'AUTHENTICATION_REQUIRED';
  if (status === 403) return 'PERMISSION_DENIED';
  if (status === 404) return 'RESOURCE_NOT_FOUND';
  if (status === 409) return 'WORKFLOW_CONFLICT';
  if (status === 410) return 'REQUEST_EXPIRED';
  if (status === 422) return 'VALIDATION_FAILED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 503) return 'SERVICE_UNAVAILABLE';
  if (status >= 500) return 'INTERNAL_ERROR';
  return 'REQUEST_FAILED';
}

function codeFromError(error: unknown, status: number) {
  const code = (error as { code?: unknown })?.code;
  return typeof code === 'string' && code.trim() ? code : codeForStatus(status);
}

function userMessageFromError(error: unknown) {
  const userMessage = (error as { userMessage?: unknown })?.userMessage;
  if (typeof userMessage === 'string' && userMessage.trim()) return userMessage.trim();
  const message = (error as { message?: unknown })?.message;
  if (typeof message === 'string' && message.trim()) return message.trim();
  return 'Request failed.';
}

function reasonFromError(error: unknown, status: number) {
  const reason = (error as { reason?: unknown })?.reason;
  if (typeof reason === 'string' && reason.trim()) return reason.trim();
  if (status === 400 || status === 422) return 'Some submitted information is incomplete or invalid.';
  if (status === 401) return 'Your session is no longer valid for this request.';
  if (status === 403) return 'Your account, permission, or security check does not allow this action right now.';
  if (status === 404) return 'The requested record could not be found.';
  if (status === 409) return 'The request conflicts with an existing record or the current workflow state.';
  if (status === 410) return 'The code, link, or request has expired.';
  if (status === 429) return 'This action was attempted too many times in a short period.';
  if (status === 503) return 'A required service is temporarily unavailable.';
  return 'ProcureX could not complete this action.';
}

function fieldErrorsFromError(error: unknown): ApiFieldError[] {
  const fieldErrors = (error as { fieldErrors?: unknown })?.fieldErrors;
  if (!Array.isArray(fieldErrors)) return [];
  return fieldErrors
    .map((fieldError) => {
      if (!fieldError || typeof fieldError !== 'object') return null;
      const candidate = fieldError as Partial<ApiFieldError>;
      return {
        path: String(candidate.path ?? ''),
        message: String(candidate.message ?? ''),
        code: String(candidate.code ?? 'VALIDATION_FAILED')
      };
    })
    .filter((fieldError): fieldError is ApiFieldError => Boolean(fieldError?.message));
}

function actionFromError(error: unknown): ApiErrorAction | undefined {
  const action = (error as { action?: unknown })?.action;
  if (!action || typeof action !== 'object') return undefined;
  const candidate = action as Partial<ApiErrorAction>;
  if (!candidate.label) return undefined;
  return {
    label: String(candidate.label),
    ...(candidate.to ? { to: String(candidate.to) } : {})
  };
}
