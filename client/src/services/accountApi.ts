import api from './api';

export interface ChangeEmailRequest {
  new_email: string;
  password: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
}

export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  user?: {
    id: number;
    email: string;
    name: string;
  };
}

/**
 * Changes the user's email address.
 * Requires current password for verification.
 * Sends verification email to new address.
 */
export async function changeEmail(newEmail: string, password: string): Promise<ApiResponse> {
  const response = await api.post('/account/change-email', {
    new_email: newEmail,
    password,
  });
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
 * Verifies email change using the verification token.
 * This is called when the user clicks the link in the verification email.
 */
export async function verifyEmailChange(token: string): Promise<ApiResponse> {
  const response = await api.get(`/account/verify-email-change/${token}`);
  return response.data;
}

export default {
  changeEmail,
  changePassword,
  verifyEmailChange,
};
