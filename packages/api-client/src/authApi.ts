import type { AuthResult, AuthUser } from '@clippster/shared-types';
import type { ApiClient } from './createApiClient';

interface MeResponse {
  success: boolean;
  user?: AuthUser;
  error?: string;
}

interface AuthTokenResponse extends AuthResult {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
  code?: string;
  message?: string;
}

export function createAuthApi(client: ApiClient) {
  return {
    login(email: string, password: string) {
      return client.post<AuthTokenResponse>('/auth/email/login', { email, password }, { skipAuth: true });
    },

    register(email: string, password: string) {
      return client.post<AuthTokenResponse>('/auth/email/register', { email, password }, { skipAuth: true });
    },

    verifyOtp(email: string, otp: string) {
      return client.post<AuthTokenResponse>('/auth/email/verify-otp', { email, otp }, { skipAuth: true });
    },

    resendVerification(email: string) {
      return client.post<AuthTokenResponse>('/auth/email/resend-verification', { email }, { skipAuth: true });
    },

    forgotPassword(email: string) {
      return client.post<{ success: boolean; message?: string; error?: string }>(
        '/auth/email/forgot-password',
        { email },
        { skipAuth: true },
      );
    },

    resetPassword(token: string, password: string) {
      return client.post<{ success: boolean; message?: string; error?: string }>(
        '/auth/email/reset-password',
        { token, password },
        { skipAuth: true },
      );
    },

    deleteAccount() {
      return client.post<{ success: boolean; message?: string; error?: string }>(
        '/subscription/deactivate',
        {},
      );
    },

    me() {
      return client.get<MeResponse>('/auth/me');
    },

    activityPing() {
      return client.post<{ success: boolean }>('/auth/activity-ping');
    },
  };
}

export type AuthApi = ReturnType<typeof createAuthApi>;
