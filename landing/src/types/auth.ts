export interface AuthUser {
  id: number
  email: string
  name?: string
  avatar_url?: string
  wallet_address?: string
  account_type: 'personal' | 'organization'
  owned_organization_id?: number | null
  created_by_organization_id?: number | null
  is_admin?: boolean
  is_moderator?: boolean
}

export interface AuthState {
  isAuthenticated: boolean
  user: AuthUser | null
  token: string | null
  authProvider: 'wallet' | 'google' | 'email' | null
  loading: boolean
  error: string | null
  pendingVerificationEmail: string | null
}

export interface AuthResult {
  success: boolean
  user?: AuthUser
  token?: string
  error?: string
  message?: string
  needsVerification?: boolean
}

export interface AuthContextType extends AuthState {
  // Email auth
  registerWithEmail: (email: string, password: string) => Promise<AuthResult>
  verifyEmailOtp: (email: string, otp: string) => Promise<AuthResult>
  loginWithEmail: (email: string, password: string) => Promise<AuthResult>
  resendVerificationEmail: (email: string) => Promise<AuthResult>
  forgotPassword: (email: string) => Promise<AuthResult>
  resetPassword: (token: string, newPassword: string) => Promise<AuthResult>

  // OAuth
  authenticateWithGoogle: () => Promise<AuthResult>

  // Wallet
  authenticateWithWallet: (publicKey: string, signMessage: (message: Uint8Array) => Promise<Uint8Array>) => Promise<AuthResult>

  // Session
  checkAuth: () => Promise<boolean>
  logout: () => void
  refreshUserData: () => Promise<void>
  clearError: () => void
  clearPendingVerification: () => void

  // Organization methods
  createOrganization: (data: { name: string; description?: string }) => Promise<AuthResult & { organization?: any }>
  getOrganizations: () => Promise<{ success: boolean; organizations?: any[]; error?: string }>
  getOrganization: (orgId: number) => Promise<{ success: boolean; organization?: any; role?: string; error?: string }>
  updateOrganization: (orgId: number, updates: any) => Promise<{ success: boolean; organization?: any; error?: string }>
  deleteOrganization: (orgId: number) => Promise<AuthResult>
  getOrganizationMembers: (orgId: number) => Promise<{ success: boolean; members?: any[]; error?: string }>
  inviteOrganizationMember: (orgId: number, email: string, role?: string) => Promise<AuthResult>
  createOrganizationMember: (orgId: number, email: string, password: string, role?: string, name?: string) => Promise<AuthResult>
  removeOrganizationMember: (orgId: number, userId: number) => Promise<AuthResult>
  updateOrganizationMemberRole: (orgId: number, userId: number, role: string) => Promise<AuthResult>
  updateOrganizationMemberAccount: (orgId: number, userId: number, updates: { name?: string; email?: string; password?: string }) => Promise<AuthResult>
  getOrganizationInvitations: (orgId: number) => Promise<{ success: boolean; invitations?: any[]; error?: string }>
  cancelOrganizationInvitation: (orgId: number, invitationId: number) => Promise<AuthResult>
  resendOrganizationInvitation: (orgId: number, invitationId: number) => Promise<AuthResult>
  getInvitationDetails: (token: string) => Promise<{ success: boolean; invitation?: any; organization?: any; error?: string }>
  acceptInvitation: (inviteToken: string) => Promise<AuthResult>
  getOrganizationCredits: (orgId: number) => Promise<{ success: boolean; org_credits?: any; my_allocation?: any; error?: string }>
  allocateOrganizationCredits: (orgId: number, userId: number, hours: number) => Promise<AuthResult>
  getOrganizationTransactions: (orgId: number, options?: { limit?: number; offset?: number }) => Promise<{ success: boolean; transactions?: any[]; total?: number; error?: string }>
}
