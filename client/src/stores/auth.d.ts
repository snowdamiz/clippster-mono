import { Store } from 'pinia'

export interface AuthState {
  isAuthenticated: boolean
  walletAddress: string | null
  token: string | null
  user: { id: number; wallet_address: string; is_admin: boolean } | null
  loading: boolean
  error: string | null
}

export interface AuthActions {
  requestChallenge(): Promise<any>
  authenticateWithWallet(): Promise<{ success: boolean; error?: string }>
  getClientId(): Promise<string>
  logout(): void
  checkAuth(): Promise<boolean>
}

export const useAuthStore: () => Store<'auth', AuthState, {}, AuthActions>
