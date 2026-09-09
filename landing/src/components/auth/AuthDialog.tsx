import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Apple,
  Download,
  Film,
  Loader2,
  Lock,
  Mail,
  Monitor,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useDownloads } from '@/hooks/usePlatform'
import { getPostAuthPath } from '@/lib/accountRouting'
import { trackDownloadClick, trackLandingEvent } from '@/services/landingAnalytics'

export type AuthDialogView = 'intro' | 'signin' | 'signup' | 'verify-otp' | 'forgot-password' | 'reset-sent'

interface AuthDialogProps {
  open: boolean
  onClose: () => void
  initialView?: AuthDialogView
}

export function AuthDialog({
  open,
  onClose,
  initialView = 'intro',
}: AuthDialogProps) {
  const navigate = useNavigate()
  const { primaryDownload, isLoading: downloadsLoading } = useDownloads()
  const {
    loginWithEmail,
    registerWithEmail,
    verifyEmailOtp,
    resendVerificationEmail,
    forgotPassword,
    authenticateWithGoogle,
    loading,
    error,
    clearError,
    pendingVerificationEmail,
    isAuthenticated,
    user,
  } = useAuth()

  const [view, setView] = useState<AuthDialogView>(initialView)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [otp, setOtp] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  useEffect(() => {
    if (!open) return
    setView(initialView)
    setLocalError(null)
    setSuccessMessage(null)
    clearError()
    document.body.style.overflow = 'hidden'
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('keydown', onEsc)
      document.body.style.overflow = ''
    }
  }, [open, initialView, onClose, clearError])

  useEffect(() => {
    if (open && pendingVerificationEmail) {
      setEmail(pendingVerificationEmail)
      setView('verify-otp')
    }
  }, [open, pendingVerificationEmail])

  useEffect(() => {
    if (resendCooldown <= 0) return
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [resendCooldown])

  if (!open) return null

  const displayError = localError || error

  const finishAuth = (authUser = user) => {
    onClose()
    navigate(getPostAuthPath(authUser), { replace: true })
  }

  const handleContinueFromIntro = (mode: 'signin' | 'signup') => {
    trackLandingEvent('landing_cta_click', {
      source: 'auth_dialog',
      button_label: mode === 'signup' ? 'intro_sign_up' : 'intro_sign_in',
    })
    setLocalError(null)
    clearError()
    setView(mode)
  }

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    const result = await loginWithEmail(email, password)
    if (result.needsVerification) {
      setView('verify-otp')
      setResendCooldown(30)
      return
    }
    if (result.success) {
      finishAuth(result.user)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    if (password !== confirmPassword) {
      setLocalError('Passwords do not match')
      return
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters')
      return
    }
    const result = await registerWithEmail(email, password)
    if (result.success) {
      setView('verify-otp')
      setResendCooldown(30)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    const result = await verifyEmailOtp(email || pendingVerificationEmail || '', otp)
    if (result.success) {
      finishAuth(result.user)
    }
  }

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    const result = await forgotPassword(email)
    if (result.success) {
      setSuccessMessage(result.message || 'Check your email for a reset link.')
      setView('reset-sent')
    }
  }

  const handleResend = async () => {
    if (resendCooldown > 0) return
    const target = email || pendingVerificationEmail
    if (!target) return
    await resendVerificationEmail(target)
    setResendCooldown(30)
  }

  const handleGoogle = async () => {
    trackLandingEvent('landing_cta_click', { source: 'auth_dialog', button_label: 'google', path: view })
    await authenticateWithGoogle()
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-dialog-title"
        className="relative w-full max-w-[720px] max-h-[90vh] overflow-hidden rounded-xl border border-[#1f1f23] bg-[#141416] shadow-2xl flex flex-col"
      >
        <div className="h-0.5 bg-gradient-to-r from-cyan-500 to-cyan-600" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="grid md:grid-cols-2 min-h-[420px]">
          {/* Branding column */}
          <div className="hidden md:flex flex-col justify-between p-8 bg-[#0f0f11] border-r border-[#1f1f23]">
            <div>
              <img src="/logo.svg" alt="Clippster" className="h-5 mb-8" />
              <h2 id="auth-dialog-title" className="text-2xl font-bold text-white mb-2 leading-tight">
                {view === 'intro' ? 'Your online account dashboard' : 'Transform videos into viral clips'}
              </h2>
              <p className="text-sm text-zinc-400 mb-8">
                {view === 'intro'
                  ? 'Manage your profile, social accounts, messages, and settings on the web. Clipping and editing happen in the desktop app.'
                  : 'Sign in to unlock AI-powered clip creation and editing'}
              </p>
              <div className="space-y-4">
                {(view === 'intro'
                  ? [
                      { icon: Download, title: 'Desktop app required', desc: 'Download Clippster to clip live, edit, and publish' },
                      { icon: Film, title: 'Web is for account stuff', desc: 'Profile, social connects, posts, messages, and billing' },
                      { icon: Zap, title: 'Same account everywhere', desc: 'Sign up here, then log into the desktop app with the same credentials' },
                    ]
                  : [
                      { icon: Zap, title: 'AI-Powered Detection', desc: 'Automatically find the best moments in your videos' },
                      { icon: Film, title: 'Professional Editing', desc: 'Timeline editor with multi-platform formatting' },
                      { icon: ShieldCheck, title: 'Secure authentication', desc: 'Email or Google — synced across web and desktop' },
                    ]
                ).map(({ icon: Icon, title, desc }) => (
                  <div key={title} className="flex gap-3">
                    <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-cyan-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{title}</p>
                      <p className="text-xs text-zinc-500">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 mt-8">
              <ShieldCheck className="w-3.5 h-3.5" />
              Secure authentication
            </div>
          </div>

          {/* Action column */}
          <div className="p-6 sm:p-8 overflow-y-auto">
            {displayError && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{displayError}</span>
              </div>
            )}

            {view === 'intro' && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">Before you continue</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    This website is an <span className="text-zinc-200">online dashboard</span> for your
                    Clippster account — profile, settings, social accounts, messages, and posts.
                    You still need the <span className="text-zinc-200">desktop app</span> to clip, edit,
                    and publish.
                  </p>
                </div>
                {!downloadsLoading && primaryDownload && (
                  <a
                    href={primaryDownload.downloadUrl}
                    className="flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border border-[#1f1f23] bg-[#1a1a1d] text-sm text-zinc-200 hover:border-cyan-500/40 hover:text-white transition-colors"
                    onClick={() =>
                      trackDownloadClick(primaryDownload, 'auth_dialog_intro', `Download for ${primaryDownload.label}`)
                    }
                  >
                    {primaryDownload.platform.os === 'mac' ? (
                      <Apple className="w-4 h-4" />
                    ) : (
                      <Monitor className="w-4 h-4" />
                    )}
                    Download for {primaryDownload.label}
                  </a>
                )}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleContinueFromIntro('signin')}
                    className="px-4 py-3 rounded-lg border border-[#1f1f23] bg-[#1a1a1d] text-white font-medium text-sm hover:border-cyan-500/40 hover:text-cyan-300 transition-colors"
                  >
                    Sign in
                  </button>
                  <button
                    type="button"
                    onClick={() => handleContinueFromIntro('signup')}
                    className="px-4 py-3 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium text-sm hover:from-cyan-400 hover:to-cyan-500"
                  >
                    Sign up
                  </button>
                </div>
                {isAuthenticated && user && (
                  <button
                    type="button"
                    onClick={() => finishAuth(user)}
                    className="w-full text-sm text-zinc-500 hover:text-cyan-400"
                  >
                    Already signed in — go to account
                  </button>
                )}
              </div>
            )}

            {view === 'signin' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Sign In</h3>
                <form onSubmit={handleSignIn} className="space-y-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0b] border border-[#1f1f23] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0b] border border-[#1f1f23] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setLocalError(null)
                      clearError()
                      setView('forgot-password')
                    }}
                    className="text-xs text-zinc-500 hover:text-cyan-400"
                  >
                    Forgot password?
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium text-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Sign In
                  </button>
                </form>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#1f1f23]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-[#141416] text-zinc-600">or</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-zinc-900 font-medium text-sm hover:bg-zinc-100 disabled:opacity-50"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <p className="text-xs text-zinc-500 text-center">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    className="text-cyan-400 hover:underline"
                    onClick={() => {
                      setLocalError(null)
                      clearError()
                      setView('signup')
                    }}
                  >
                    Sign up
                  </button>
                </p>
              </div>
            )}

            {view === 'signup' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Sign Up</h3>
                <form onSubmit={handleSignUp} className="space-y-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0b] border border-[#1f1f23] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Password (min 8 characters)"
                      className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-[#0a0a0b] border border-[#1f1f23] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>
                  <input
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm password"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0b] border border-[#1f1f23] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium text-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                    Create account
                  </button>
                </form>
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#1f1f23]" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="px-2 bg-[#141416] text-zinc-600">or</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-zinc-900 font-medium text-sm hover:bg-zinc-100 disabled:opacity-50"
                >
                  <GoogleIcon />
                  Continue with Google
                </button>
                <p className="text-xs text-zinc-500 text-center">
                  Already have an account?{' '}
                  <button
                    type="button"
                    className="text-cyan-400 hover:underline"
                    onClick={() => {
                      setLocalError(null)
                      clearError()
                      setView('signin')
                    }}
                  >
                    Sign in
                  </button>
                </p>
              </div>
            )}

            {view === 'verify-otp' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Verify email</h3>
                <p className="text-sm text-zinc-400">
                  Enter the 6-digit code sent to{' '}
                  <span className="text-zinc-200">{email || pendingVerificationEmail}</span>
                </p>
                <form onSubmit={handleVerifyOtp} className="space-y-3">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    required
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="000000"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0b] border border-[#1f1f23] text-white text-center text-lg tracking-[0.4em] placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="submit"
                    disabled={loading || otp.length !== 6}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium text-sm disabled:opacity-50"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    Verify
                  </button>
                </form>
                <button
                  type="button"
                  disabled={resendCooldown > 0}
                  onClick={handleResend}
                  className="w-full text-xs text-zinc-500 hover:text-cyan-400 disabled:opacity-50"
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            )}

            {view === 'forgot-password' && (
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-white">Reset password</h3>
                <form onSubmit={handleForgot} className="space-y-3">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Email address"
                    className="w-full px-3 py-2.5 rounded-lg bg-[#0a0a0b] border border-[#1f1f23] text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500/50"
                  />
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-medium text-sm disabled:opacity-50"
                  >
                    Send reset link
                  </button>
                </form>
                <button
                  type="button"
                  onClick={() => setView('signin')}
                  className="w-full text-xs text-zinc-500 hover:text-cyan-400"
                >
                  Back to sign in
                </button>
              </div>
            )}

            {view === 'reset-sent' && (
              <div className="space-y-4 text-center">
                <h3 className="text-xl font-bold text-white">Check your email</h3>
                <p className="text-sm text-zinc-400">{successMessage}</p>
                <button
                  type="button"
                  onClick={() => setView('signin')}
                  className="w-full px-4 py-2.5 rounded-lg border border-[#1f1f23] text-sm text-zinc-200 hover:border-cyan-500/40"
                >
                  Back to sign in
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
