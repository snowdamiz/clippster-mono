import type { AxiosError } from 'axios';

export const SOCIAL_TOKEN_EXPIRED_ERROR_CODE = 'social_token_expired';

export function isSocialTokenExpiredApiError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('response' in error)) return false;

  const axiosError = error as AxiosError<{ error_code?: string }>;
  return axiosError.response?.data?.error_code === SOCIAL_TOKEN_EXPIRED_ERROR_CODE;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const axiosError = error as AxiosError<{ error?: string }>;
  return axiosError.response?.data?.error || (error instanceof Error ? error.message : fallback);
}
