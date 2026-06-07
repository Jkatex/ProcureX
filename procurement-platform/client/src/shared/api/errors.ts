import type { AxiosError } from 'axios';

type ApiErrorBody = {
  message?: string;
  error?: string;
};

export function apiErrorMessage(error: unknown, fallback = 'Request failed.') {
  if (typeof error === 'string') return error;
  const axiosError = error as AxiosError<ApiErrorBody>;
  return axiosError.response?.data?.message || axiosError.message || fallback;
}
