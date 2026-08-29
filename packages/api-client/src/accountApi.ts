import type { ApiClient } from './createApiClient';

export interface AccountApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  pending_email?: string;
  otp_required?: boolean;
  converting_from_oauth?: boolean;
  token?: string;
  user?: {
    id: number;
    email: string;
    name: string;
    provider?: string;
    provider_id?: string;
  };
}

export function createAccountApi(client: ApiClient) {
  return {
    changeEmail(newEmail: string, options: { password?: string; newPassword?: string } = {}) {
      const body: Record<string, string> = { new_email: newEmail };
      if (options.password) body.password = options.password;
      if (options.newPassword) body.new_password = options.newPassword;
      return client.post<AccountApiResponse>('/account/change-email', body);
    },

    verifyEmailChangeOtp(otp: string) {
      return client.post<AccountApiResponse>('/account/verify-email-change-otp', { otp });
    },

    resendEmailChangeVerification() {
      return client.post<AccountApiResponse>('/account/resend-email-change', {});
    },

    changePassword(currentPassword: string, newPassword: string) {
      return client.post<AccountApiResponse>('/account/change-password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
    },
  };
}

export type AccountApi = ReturnType<typeof createAccountApi>;
