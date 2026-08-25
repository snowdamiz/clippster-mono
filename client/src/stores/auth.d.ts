import { Store } from 'pinia'

export interface AuthUser {
  id: number
  wallet_address?: string
  email?: string
  name?: string
  avatar_url?: string
  is_admin: boolean
  is_moderator?: boolean
  is_affiliate?: boolean
  account_type?: 'personal' | 'organization'
  owned_organization_id?: string | null
  created_by_organization_id?: number | null
  ai_allowed?: boolean
  ai_editor_enabled?: boolean
  beta_activated?: boolean
  subscription?: {
    status: 'none' | 'active' | 'cancelled' | 'expired'
    tier: string | null
    tier_name: string | null
    start_date: string | null
    end_date: string | null
    renewal_method: 'stripe' | 'crypto' | 'admin' | null
    needs_subscription: boolean
    days_remaining: number
  }
  credits?: {
    hours_remaining: number
    minutes_remaining: number
  }
  preferences?: {
    time_format_preference: '12hr' | '24hr'
    toast_enabled: boolean
    toast_duration: number
    toast_position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'
    toast_sound_enabled: boolean
    toast_background_enabled: boolean
    notify_livestream: boolean
    notify_clips: boolean
    notify_downloads: boolean
    notify_projects: boolean
    notify_social: boolean
    notify_organization: boolean
    notify_system: boolean
  }
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
  needsOrgSetup?: boolean
  user?: AuthUser
}

export interface OrganizationResult {
  success: boolean
  error?: string
  organization?: any
  organizations?: any[]
  role?: string
  members?: any[]
  invitations?: any[]
  invitation?: any
  org_credits?: any
  my_allocation?: any
  organization_id?: string
  transactions?: any[]
  total?: number
  allocation?: {
    hours_allocated: string
    hours_used: string
    allow_pool_fallback: boolean
  }
  org_pool_remaining?: string
}

export interface AuthActions {
  // Existing methods
  requestChallenge(): Promise<any>
  authenticateWithWallet(referralCode?: string | null): Promise<AuthResult>
  authenticateWithGoogle(referralCode?: string | null): Promise<AuthResult>
  getClientId(): Promise<string>
  logout(): Promise<void>
  checkAuth(): Promise<boolean>
  
  // Email auth methods
  registerWithEmail(email: string, password: string, referralCode?: string | null): Promise<AuthResult>
  verifyEmailOtp(email: string, otp: string): Promise<AuthResult>
  loginWithEmail(email: string, password: string): Promise<AuthResult>
  resendVerificationEmail(email: string): Promise<AuthResult>
  forgotPassword(email: string): Promise<AuthResult>
  resetPassword(token: string, newPassword: string): Promise<AuthResult>
  startEmailVerificationListener(): Promise<void>
  clearPendingVerification(): void

  // Account type
  setAccountType(type: 'personal' | 'organization'): Promise<AuthResult>

  // Organization methods
  createOrganization(orgData: { name: string; description?: string; logo_url?: string }): Promise<OrganizationResult>
  getOrganizations(): Promise<OrganizationResult>
  getOrganization(id: string): Promise<OrganizationResult>
  updateOrganization(id: string, data: { name?: string; description?: string; settings?: any }): Promise<OrganizationResult>
  deleteOrganization(id: string): Promise<OrganizationResult>
  getOrganizationMembers(id: string): Promise<OrganizationResult>
  getOrganizationInvitations(id: string): Promise<OrganizationResult>
  inviteToOrganization(id: string, email: string, role: string): Promise<OrganizationResult>
  inviteOrganizationMember(orgId: string, email: string, role: string): Promise<OrganizationResult>
  createOrganizationMember(orgId: string, email: string, password: string, role?: string, name?: string): Promise<OrganizationResult>
  cancelOrganizationInvitation(orgId: string, invitationId: number): Promise<OrganizationResult>
  resendOrganizationInvitation(orgId: string, invitationId: number): Promise<OrganizationResult>
  removeOrganizationMember(orgId: string, userId: number): Promise<OrganizationResult>
  updateOrganizationMemberRole(orgId: string, userId: number, role: string): Promise<OrganizationResult>
  updateOrganizationMemberAccount(orgId: string, userId: number, updates: { name?: string; email?: string; password?: string }): Promise<OrganizationResult>
  getOrganizationCredits(id: string): Promise<OrganizationResult>
  allocateOrganizationCredits(orgId: string, userId: number, hours: number): Promise<OrganizationResult>
  getOrganizationTransactions(id: string, options?: { limit?: number; offset?: number }): Promise<OrganizationResult>

  // Invitation methods
  getInvitationDetails(token: string): Promise<OrganizationResult>
  acceptInvitation(token: string): Promise<OrganizationResult>
}

export const useAuthStore: () => Store<'auth', AuthState, {}, AuthActions>
