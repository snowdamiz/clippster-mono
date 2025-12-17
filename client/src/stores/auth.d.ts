import { Store } from 'pinia'

export interface AuthUser {
  id: number
  wallet_address?: string
  email?: string
  name?: string
  is_admin: boolean
}

export interface AuthState {
  isAuthenticated: boolean
  walletAddress: string | null
  email: string | null
  token: string | null
  user: AuthUser | null
  loading: boolean
  error: string | null
  authProvider: 'wallet' | 'google' | 'email' | null
  pendingVerificationEmail: string | null
  verificationSentAt: number | null
}

export interface AuthResult {
  success: boolean
  error?: string
  message?: string
  needsVerification?: boolean
}

export interface AuthActions {
  // Existing methods
  requestChallenge(): Promise<any>
  authenticateWithWallet(): Promise<AuthResult>
  authenticateWithGoogle(): Promise<AuthResult>
  getClientId(): Promise<string>
  logout(): Promise<void>
  checkAuth(): Promise<boolean>
  
  // Email auth methods
  registerWithEmail(email: string, password: string): Promise<AuthResult>
  verifyEmailOtp(email: string, otp: string): Promise<AuthResult>
  loginWithEmail(email: string, password: string): Promise<AuthResult>
  resendVerificationEmail(email: string): Promise<AuthResult>
  forgotPassword(email: string): Promise<AuthResult>
  resetPassword(token: string, newPassword: string): Promise<AuthResult>
  startEmailVerificationListener(): Promise<void>
  clearPendingVerification(): void
}

export const useAuthStore: () => Store<'auth', AuthState, {}, AuthActions>
