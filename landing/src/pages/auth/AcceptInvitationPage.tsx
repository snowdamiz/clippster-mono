import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, Users, Building2, Shield, ArrowLeft } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

interface InvitationDetails {
  invitation: {
    id: number
    email: string
    role: string
    inviter_email?: string
    status: string
  }
  organization: {
    id: number
    name: string
    description?: string
  }
}

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  const {
    getInvitationDetails,
    acceptInvitation,
    isAuthenticated,
    error,
    clearError,
  } = useAuth()

  // Load invitation details
  useEffect(() => {
    if (!token) {
      setPageError('Invalid invitation link')
      setPageLoading(false)
      return
    }

    const loadInvitation = async () => {
      setPageLoading(true)
      setPageError(null)

      const result = await getInvitationDetails(token)
      if (result.success && result.invitation && result.organization) {
        setInvitation({
          invitation: result.invitation,
          organization: result.organization,
        })
      } else {
        setPageError(result.error || 'Invitation not found or has expired')
      }
      setPageLoading(false)
    }

    loadInvitation()
  }, [token, getInvitationDetails])

  useEffect(() => {
    return () => clearError()
  }, [clearError])

  // Auto-accept invitation if user just authenticated and there's a stored invite token
  useEffect(() => {
    const storedToken = localStorage.getItem('pending_invite_token')
    if (isAuthenticated && storedToken && storedToken === token && invitation) {
      localStorage.removeItem('pending_invite_token')
      handleAccept()
    }
  }, [isAuthenticated, token, invitation]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleAccept = async () => {
    if (!token) return

    setAccepting(true)
    setPageError(null)

    const result = await acceptInvitation(token)
    if (result.success) {
      const orgId = invitation?.organization.id
      navigate(orgId ? `/dashboard/org/${orgId}` : '/dashboard', { replace: true })
    } else {
      setPageError(result.error || 'Failed to accept invitation')
    }
    setAccepting(false)
  }

  const handleLoginRedirect = () => {
    if (token) {
      localStorage.setItem('pending_invite_token', token)
    }
    navigate('/login', { state: { from: `/accept-invitation/${token}` } })
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'owner':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'admin':
        return 'bg-violet-500/10 text-violet-400 border-violet-500/20'
      default:
        return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
    }
  }

  // Loading state
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <Link to="/" className="flex items-center justify-center gap-3 mb-8">
            <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8" />
            <img src="/logo.svg" alt="Clippster" className="h-5" />
          </Link>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
              <p className="text-zinc-400 text-sm">Loading invitation...</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Error state (no invitation)
  if (pageError && !invitation) {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto">
          <Link to="/" className="flex items-center justify-center gap-3 mb-8">
            <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8" />
            <img src="/logo.svg" alt="Clippster" className="h-5" />
          </Link>

          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-6 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{pageError}</span>
            </div>

            <div className="text-center">
              <Link
                to="/login"
                className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Go to login
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8" />
          <img src="/logo.svg" alt="Clippster" className="h-5" />
        </Link>

        {/* Card */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
          {/* Invitation icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Users className="w-8 h-8 text-cyan-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            You're invited
          </h1>
          <p className="text-zinc-500 text-center text-sm mb-8">
            You've been invited to join an organization
          </p>

          {/* Error Display */}
          {(pageError || error) && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-6 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{pageError || error}</span>
            </div>
          )}

          {/* Invitation Details */}
          {invitation && (
            <div className="bg-zinc-800/30 border border-zinc-700/50 rounded-lg p-5 mb-6 space-y-4">
              {/* Organization */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-700/50 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Organization</p>
                  <p className="text-white font-medium">{invitation.organization.name}</p>
                </div>
              </div>

              {/* Role */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-zinc-700/50 flex items-center justify-center">
                  <Shield className="w-5 h-5 text-zinc-400" />
                </div>
                <div>
                  <p className="text-xs text-zinc-500">Role</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getRoleBadgeColor(invitation.invitation.role)}`}>
                    {invitation.invitation.role.charAt(0).toUpperCase() + invitation.invitation.role.slice(1)}
                  </span>
                </div>
              </div>

              {/* Invited by */}
              {invitation.invitation.inviter_email && (
                <div className="pt-3 border-t border-zinc-700/50">
                  <p className="text-xs text-zinc-500">
                    Invited by{' '}
                    <span className="text-zinc-400">{invitation.invitation.inviter_email}</span>
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {isAuthenticated ? (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-semibold rounded-lg px-4 py-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {accepting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Accepting...
                </>
              ) : (
                'Accept Invitation'
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500 text-center mb-4">
                Please sign in to your existing account to accept this invitation
              </p>

              <button
                onClick={handleLoginRedirect}
                className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-semibold rounded-lg px-4 py-3 transition-all duration-200 flex items-center justify-center gap-2"
              >
                Sign in to accept
              </button>
            </div>
          )}

          {/* Back to login */}
          <div className="text-center mt-6">
            <Link
              to="/login"
              className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back to login
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
