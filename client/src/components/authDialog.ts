/** The shared sign-in UI depends on this interface, never on a platform's session storage. */
export interface AuthDialogResult {
  success: boolean;
  needsVerification?: boolean;
  is_new_user?: boolean;
}

export interface AuthDialogAdapter {
  loading: boolean;
  error: string | null;
  pendingVerificationEmail: string | null;
  user: { id: number } | null;
  authenticateWithGoogle(referralCode?: string | null): Promise<AuthDialogResult>;
  loginWithEmail(email: string, password: string): Promise<AuthDialogResult>;
  registerWithEmail(
    email: string,
    password: string,
    referralCode?: string | null
  ): Promise<AuthDialogResult>;
  verifyEmailOtp(email: string, code: string): Promise<AuthDialogResult>;
  resendVerificationEmail(email: string): Promise<AuthDialogResult>;
  forgotPassword(email: string): Promise<AuthDialogResult>;
  resetPassword(token: string, password: string): Promise<AuthDialogResult>;
  clearPendingVerification(): void;
}
