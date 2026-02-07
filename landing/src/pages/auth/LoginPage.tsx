import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Mail, Lock, Loader2, AlertCircle, Eye, EyeOff, Wallet } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

function WalletLoginButton({
  onWalletAuth,
  loading,
}: {
  onWalletAuth: (publicKey: string, signMessage: (message: Uint8Array) => Promise<Uint8Array>) => Promise<void>
  loading: boolean
}) {
  const [walletLoading, setWalletLoading] = useState(false)

  const handleWalletAuth = async () => {
    setWalletLoading(true)
    try {
      const provider = (window as any).phantom?.solana || (window as any).solana
      if (!provider) {
        throw new Error('No Solana wallet found. Please install Phantom or another Solana wallet.')
      }
      const resp = await provider.connect()
      const pk = resp.publicKey.toString()
      const sign = async (msg: Uint8Array) => {
        const { signature: sig } = await provider.signMessage(msg, 'utf8')
        return sig as Uint8Array
      }
      await onWalletAuth(pk, sign)
    } catch (err: any) {
      throw err
    } finally {
      setWalletLoading(false)
    }
  }

  return (
    <button
      onClick={async () => {
        try {
          await handleWalletAuth()
        } catch {
          // Error is handled by parent
        }
      }}
      disabled={loading || walletLoading}
      className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
    >
      {walletLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Wallet className="w-4 h-4" />
      )}
      Wallet
    </button>
  )
}

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)

  const {
    loginWithEmail,
    authenticateWithGoogle,
    authenticateWithWallet,
    isAuthenticated,
    user,
    loading,
    error,
    clearError,
    pendingVerificationEmail,
  } = useAuth()

  const navigate = useNavigate()
  const location = useLocation()

  const getRedirectPath = (u: { owned_organization_id?: number | null } | null) => {
    const from = (location.state as any)?.from
    if (from) return from
    if (u?.owned_organization_id) return `/dashboard/org/${u.owned_organization_id}`
    return '/dashboard'
  }

  useEffect(() => {
    if (isAuthenticated && user) {
      navigate(getRedirectPath(user), { replace: true })
    }
  }, [isAuthenticated, user]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (pendingVerificationEmail) {
      navigate('/verify-email', { replace: true })
    }
  }, [pendingVerificationEmail, navigate])

  useEffect(() => {
    return () => clearError()
  }, [clearError])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setWalletError(null)
    const result = await loginWithEmail(email, password)
    if (result.success && result.user) {
      navigate(getRedirectPath(result.user), { replace: true })
    }
  }

  const handleGoogleLogin = async () => {
    setWalletError(null)
    const result = await authenticateWithGoogle()
    if (result.success && result.user) {
      navigate(getRedirectPath(result.user), { replace: true })
    }
  }

  const handleWalletAuth = async (publicKey: string, signMessage: (message: Uint8Array) => Promise<Uint8Array>) => {
    setWalletError(null)
    try {
      const result = await authenticateWithWallet(publicKey, signMessage)
      if (result.success && result.user) {
        navigate(getRedirectPath(result.user), { replace: true })
      }
    } catch (err: any) {
      setWalletError(err.message || 'Wallet authentication failed')
    }
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
          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Welcome back
          </h1>
          <p className="text-zinc-500 text-center text-sm mb-8">
            Sign in to your account
          </p>

          {/* Error Display */}
          {(error || walletError) && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-6 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error || walletError}</span>
            </div>
          )}

          {/* Email/Password Form */}
          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-400 mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg pl-10 pr-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-medium text-zinc-400">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg pl-10 pr-11 py-3 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-semibold rounded-lg px-4 py-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-3 bg-zinc-900/50 text-zinc-500">or continue with</span>
            </div>
          </div>

          {/* Social Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg px-4 py-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-medium"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  fill="#EA4335"
                />
              </svg>
              Google
            </button>

            <WalletLoginButton
              onWalletAuth={handleWalletAuth}
              loading={loading}
            />
          </div>

          {/* Sign up link */}
          <p className="text-center text-sm text-zinc-500 mt-6">
            Don't have an account?{' '}
            <Link to="/signup" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
