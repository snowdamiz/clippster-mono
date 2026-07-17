import api from './api';

export interface ChangeEmailRequest {
  new_email: string;
  password?: string;
  new_password?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ApiResponse {
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

/**
 * Requests an email change. Sends OTP to the new address.
 * Email users pass password; OAuth users converting pass new_password.
 */
export async function changeEmail(
  newEmail: string,
  options: { password?: string; newPassword?: string } = {}
): Promise<ApiResponse> {
  const body: ChangeEmailRequest = { new_email: newEmail };
  if (options.newPassword) body.new_password = options.newPassword;
  if (options.password) body.password = options.password;

  const response = await api.post('/account/change-email', body);
  return response.data;
}

/**
 * Verifies a pending email change with the OTP from the new inbox.
 */
export async function verifyEmailChangeOtp(otp: string): Promise<ApiResponse> {
  const response = await api.post('/account/verify-email-change-otp', { otp });
  return response.data;
}

/**
 * Resends OTP for a pending email change.
 */
export async function resendEmailChangeVerification(): Promise<ApiResponse> {
  const response = await api.post('/account/resend-email-change', {});
  return response.data;
}

/**
 * Changes the user's password.
 * Requires current password for verification.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<ApiResponse> {
  const response = await api.post('/account/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return response.data;
}

/**
 * Verifies email change using the verification token (magic link).
 */
export async function verifyEmailChange(token: string): Promise<ApiResponse> {
  const response = await api.get(`/account/verify-email-change/${token}`);
  return response.data;
}

export default {
  changeEmail,
  changePassword,
  verifyEmailChange,
  verifyEmailChangeOtp,
  resendEmailChangeVerification,
};
