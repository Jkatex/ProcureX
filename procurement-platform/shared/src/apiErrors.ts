export type ApiFieldError = {
  path: string;
  message: string;
  code: string;
};

export type ApiErrorAction = {
  label: string;
  to?: string;
};

export type ApiErrorResponse = {
  success: false;
  error: string;
  code: string;
  message: string;
  userMessage: string;
  reason: string;
  fieldErrors: ApiFieldError[];
  action?: ApiErrorAction;
};

