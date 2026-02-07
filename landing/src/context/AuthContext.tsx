import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react'
import type { AuthUser, AuthContextType, AuthResult } from '@/types/auth'

const API_BASE = 'https://clippster-server.fly.dev'

export const AuthContext = createContext<AuthContextType | null>(null)

function getStoredToken(): string | null {
  return localStorage.getItem('auth_token')
}

function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem('user')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function getStoredProvider(): 'wallet' | 'google' | 'email' | null {
  return localStorage.getItem('auth_provider') as any
}

async function apiFetch(path: string, options: RequestInit = {}): Promise<any> {
  const token = getStoredToken()
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (!headers['Content-Type'] && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  const response = await fetch(`${API_BASE}/api${path}`, { ...options, headers })
  return response.json()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getStoredToken())
  const [user, setUser] = useState<AuthUser | null>(getStoredUser)
  const [token, setToken] = useState<string | null>(getStoredToken)
  const [authProvider, setAuthProvider] = useState<'wallet' | 'google' | 'email' | null>(getStoredProvider)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])
  const clearPendingVerification = useCallback(() => setPendingVerificationEmail(null), [])

  const setAuthState = useCallback((userData: AuthUser, authToken: string, provider: 'wallet' | 'google' | 'email') => {
    setUser(userData)
    setToken(authToken)
    setAuthProvider(provider)
    setIsAuthenticated(true)
    setError(null)
    localStorage.setItem('auth_token', authToken)
    localStorage.setItem('user', JSON.stringify(userData))
    localStorage.setItem('auth_provider', provider)
  }, [])

  const logout = useCallback(() => {
    setUser(null)
    setToken(null)
    setAuthProvider(null)
    setIsAuthenticated(false)
    setError(null)
    setPendingVerificationEmail(null)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('user')
    localStorage.removeItem('auth_provider')
    localStorage.removeItem('wallet_address')
    localStorage.removeItem('email')
  }, [])

  // Listen for auth-required events (401 responses)
  useEffect(() => {
    const handler = () => logout()
    window.addEventListener('auth-required', handler)
    return () => window.removeEventListener('auth-required', handler)
  }, [logout])

  // Email auth methods
  const registerWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/auth/email/register', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (data.success) {
        setPendingVerificationEmail(email)
        return { success: true, message: data.message }
      }
      setError(data.error || 'Registration failed')
      return { success: false, error: data.error }
    } catch (err: any) {
      const msg = err.message || 'Registration failed'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  const verifyEmailOtp = useCallback(async (email: string, otp: string): Promise<AuthResult> => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/auth/email/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ email, otp }),
      })
      if (data.success && data.token && data.user) {
        setAuthState(data.user, data.token, 'email')
        setPendingVerificationEmail(null)
        return { success: true, user: data.user }
      }
      setError(data.error || 'Verification failed')
      return { success: false, error: data.error }
    } catch (err: any) {
      const msg = err.message || 'Verification failed'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [setAuthState])

  const loginWithEmail = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/auth/email/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      if (data.success && data.token && data.user) {
        setAuthState(data.user, data.token, 'email')
        return { success: true, user: data.user }
      }
      if (data.code === 'EMAIL_NOT_VERIFIED') {
        setPendingVerificationEmail(email)
        setError(null)
        return { success: false, needsVerification: true, error: data.error }
      }
      setError(data.error || 'Login failed')
      return { success: false, error: data.error }
    } catch (err: any) {
      const msg = err.message || 'Login failed'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [setAuthState])

  const resendVerificationEmail = useCallback(async (email: string): Promise<AuthResult> => {
    setLoading(true)
    try {
      const data = await apiFetch('/auth/email/resend-verification', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      return data.success ? { success: true, message: data.message } : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }, [])

  const forgotPassword = useCallback(async (email: string): Promise<AuthResult> => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/auth/email/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      })
      if (data.success) return { success: true, message: data.message }
      setError(data.error || 'Failed to send reset email')
      return { success: false, error: data.error }
    } catch (err: any) {
      const msg = err.message || 'Failed to send reset email'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  const resetPassword = useCallback(async (resetToken: string, newPassword: string): Promise<AuthResult> => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiFetch('/auth/email/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token: resetToken, password: newPassword }),
      })
      if (data.success) return { success: true, message: data.message }
      setError(data.error || 'Password reset failed')
      return { success: false, error: data.error }
    } catch (err: any) {
      const msg = err.message || 'Password reset failed'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [])

  // Google OAuth (popup)
  const authenticateWithGoogle = useCallback(async (): Promise<AuthResult> => {
    setLoading(true)
    setError(null)
    try {
      const popup = window.open(
        `${API_BASE}/api/auth/google?web=true`,
        'google-auth',
        'width=500,height=600,scrollbars=yes'
      )
      if (!popup) {
        setError('Popup blocked. Please allow popups for this site.')
        setLoading(false)
        return { success: false, error: 'Popup blocked' }
      }

      return new Promise<AuthResult>((resolve) => {
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'google-auth-result' || (event.data?.token && event.data?.user)) {
            window.removeEventListener('message', handleMessage)
            const { token: authToken, user: userData } = event.data
            if (authToken && userData) {
              setAuthState(userData, authToken, 'google')
              setLoading(false)
              resolve({ success: true, user: userData })
            } else {
              setError('Google authentication failed')
              setLoading(false)
              resolve({ success: false, error: 'Authentication failed' })
            }
          }
        }
        window.addEventListener('message', handleMessage)

        // Poll for popup close
        const pollTimer = setInterval(() => {
          if (popup.closed) {
            clearInterval(pollTimer)
            window.removeEventListener('message', handleMessage)
            setLoading(false)
            resolve({ success: false, error: 'Authentication cancelled' })
          }
        }, 500)
      })
    } catch (err: any) {
      const msg = err.message || 'Google authentication failed'
      setError(msg)
      setLoading(false)
      return { success: false, error: msg }
    }
  }, [setAuthState])

  // Wallet auth
  const authenticateWithWallet = useCallback(async (
    publicKey: string,
    signMessage: (message: Uint8Array) => Promise<Uint8Array>
  ): Promise<AuthResult> => {
    setLoading(true)
    setError(null)
    try {
      // Request challenge
      const clientId = localStorage.getItem('client_id') || crypto.randomUUID()
      localStorage.setItem('client_id', clientId)

      const challengeData = await apiFetch('/auth/challenge', {
        method: 'POST',
        body: JSON.stringify({ client_id: clientId }),
      })

      if (!challengeData.message || !challengeData.nonce) {
        throw new Error('Failed to get authentication challenge')
      }

      // Sign message
      const messageBytes = new TextEncoder().encode(challengeData.message)
      const signatureBytes = await signMessage(messageBytes)

      // Import bs58
      const bs58 = await import('bs58')
      const signature = bs58.default.encode(signatureBytes)

      // Verify with server
      const verifyData = await apiFetch('/auth/verify', {
        method: 'POST',
        body: JSON.stringify({
          signature,
          public_key: publicKey,
          message: challengeData.message,
          nonce: challengeData.nonce,
        }),
      })

      if (verifyData.success && verifyData.token && verifyData.user) {
        setAuthState(verifyData.user, verifyData.token, 'wallet')
        localStorage.setItem('wallet_address', publicKey)
        return { success: true, user: verifyData.user }
      }

      setError(verifyData.error || 'Wallet authentication failed')
      return { success: false, error: verifyData.error }
    } catch (err: any) {
      const msg = err.message || 'Wallet authentication failed'
      setError(msg)
      return { success: false, error: msg }
    } finally {
      setLoading(false)
    }
  }, [setAuthState])

  // Session management
  const checkAuth = useCallback(async (): Promise<boolean> => {
    const storedToken = getStoredToken()
    if (!storedToken) return false

    try {
      const data = await apiFetch('/auth/me')
      if (data.success && data.user) {
        const provider = getStoredProvider() || 'email'
        setAuthState({ ...getStoredUser(), ...data.user }, storedToken, provider)
        return true
      }
      logout()
      return false
    } catch {
      logout()
      return false
    }
  }, [setAuthState, logout])

  const refreshUserData = useCallback(async () => {
    if (!token) return
    try {
      const data = await apiFetch('/auth/me')
      if (data.success && data.user) {
        setUser(prev => {
          const updated = { ...prev, ...data.user }
          localStorage.setItem('user', JSON.stringify(updated))
          return updated
        })
      }
    } catch {
      // Don't logout on network errors
    }
  }, [token])

  // Organization methods
  const createOrganization = useCallback(async (orgData: { name: string; description?: string }) => {
    try {
      const data = await apiFetch('/organizations', {
        method: 'POST',
        body: JSON.stringify(orgData),
      })
      if (data.success) {
        setUser(prev => {
          if (!prev) return prev
          const updated = { ...prev, account_type: 'organization' as const, owned_organization_id: data.organization.id }
          localStorage.setItem('user', JSON.stringify(updated))
          return updated
        })
        return { success: true, organization: data.organization }
      }
      return { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const getOrganizations = useCallback(async () => {
    try {
      const data = await apiFetch('/organizations')
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const getOrganization = useCallback(async (orgId: number) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}`)
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const updateOrganization = useCallback(async (orgId: number, updates: any) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const deleteOrganization = useCallback(async (orgId: number) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}`, { method: 'DELETE' })
      if (data.success) {
        setUser(prev => {
          if (!prev) return prev
          const updated = { ...prev, account_type: 'personal' as const, owned_organization_id: null }
          localStorage.setItem('user', JSON.stringify(updated))
          return updated
        })
      }
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const getOrganizationMembers = useCallback(async (orgId: number) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/members`)
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const inviteOrganizationMember = useCallback(async (orgId: number, email: string, role = 'member') => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/invitations`, {
        method: 'POST',
        body: JSON.stringify({ email, role }),
      })
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const createOrganizationMember = useCallback(async (orgId: number, email: string, password: string, role = 'member', name = '') => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/create-member`, {
        method: 'POST',
        body: JSON.stringify({ email, password, role, name: name || undefined }),
      })
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const removeOrganizationMember = useCallback(async (orgId: number, userId: number) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/members/${userId}`, { method: 'DELETE' })
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const updateOrganizationMemberRole = useCallback(async (orgId: number, userId: number, role: string) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/members/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      })
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const updateOrganizationMemberAccount = useCallback(async (orgId: number, userId: number, updates: { name?: string; email?: string; password?: string }) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/members/${userId}/account`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const getOrganizationInvitations = useCallback(async (orgId: number) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/invitations`)
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const cancelOrganizationInvitation = useCallback(async (orgId: number, invitationId: number) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/invitations/${invitationId}`, { method: 'DELETE' })
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const resendOrganizationInvitation = useCallback(async (orgId: number, invitationId: number) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/invitations/${invitationId}/resend`, { method: 'POST' })
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const getInvitationDetails = useCallback(async (inviteToken: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/invitations/${inviteToken}`)
      const data = await response.json()
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const acceptInvitation = useCallback(async (inviteToken: string) => {
    try {
      const data = await apiFetch(`/invitations/${inviteToken}/accept`, { method: 'POST' })
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const getOrganizationCredits = useCallback(async (orgId: number) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/credits`)
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const allocateOrganizationCredits = useCallback(async (orgId: number, userId: number, hours: number) => {
    try {
      const data = await apiFetch(`/organizations/${orgId}/credits/allocate`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, hours }),
      })
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  const getOrganizationTransactions = useCallback(async (orgId: number, options: { limit?: number; offset?: number } = {}) => {
    try {
      const params = new URLSearchParams()
      if (options.limit) params.append('limit', String(options.limit))
      if (options.offset) params.append('offset', String(options.offset))
      const qs = params.toString() ? `?${params.toString()}` : ''
      const data = await apiFetch(`/organizations/${orgId}/transactions${qs}`)
      return data.success ? data : { success: false, error: data.error }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  }, [])

  // Verify token on mount
  useEffect(() => {
    if (getStoredToken()) {
      checkAuth()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const value: AuthContextType = {
    isAuthenticated,
    user,
    token,
    authProvider,
    loading,
    error,
    pendingVerificationEmail,
    registerWithEmail,
    verifyEmailOtp,
    loginWithEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    authenticateWithGoogle,
    authenticateWithWallet,
    checkAuth,
    logout,
    refreshUserData,
    clearError,
    clearPendingVerification,
    createOrganization,
    getOrganizations,
    getOrganization,
    updateOrganization,
    deleteOrganization,
    getOrganizationMembers,
    inviteOrganizationMember,
    createOrganizationMember,
    removeOrganizationMember,
    updateOrganizationMemberRole,
    updateOrganizationMemberAccount,
    getOrganizationInvitations,
    cancelOrganizationInvitation,
    resendOrganizationInvitation,
    getInvitationDetails,
    acceptInvitation,
    getOrganizationCredits,
    allocateOrganizationCredits,
    getOrganizationTransactions,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
