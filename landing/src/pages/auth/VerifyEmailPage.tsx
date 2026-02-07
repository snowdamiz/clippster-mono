import { useState, useEffect, useRef, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Loader2, AlertCircle, ArrowLeft, Mail } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function VerifyEmailPage() {
  const [otp, setOtp] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [resendSuccess, setResendSuccess] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    verifyEmailOtp,
    resendVerificationEmail,
    pendingVerificationEmail,
    isAuthenticated,
    user,
    loading,
    error,
    clearError,
  } = useAuth()

  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated && user) {
      const dest = user.owned_organization_id
        ? `/dashboard/org/${user.owned_organization_id}`
        : '/dashboard'
      navigate(dest, { replace: true })
    }
  }, [isAuthenticated, user, navigate])

  useEffect(() => {
    if (!pendingVerificationEmail) {
      navigate('/login', { replace: true })
    }
  }, [pendingVerificationEmail, navigate])

  useEffect(() => {
    return () => clearError()
  }, [clearError])

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleOtpChange = (value: string) => {
    // Only allow digits, max 6
    const cleaned = value.replace(/\D/g, '').slice(0, 6)
    setOtp(cleaned)
  }

  const handleVerify = useCallback(async () => {
    if (!pendingVerificationEmail || otp.length !== 6) return

    const result = await verifyEmailOtp(pendingVerificationEmail, otp)
    if (result.success && result.user) {
      const dest = result.user.owned_organization_id
        ? `/dashboard/org/${result.user.owned_organization_id}`
        : '/dashboard'
      navigate(dest, { replace: true })
    }
  }, [pendingVerificationEmail, otp, verifyEmailOtp, navigate])

  // Auto-submit when 6 digits are entered
  useEffect(() => {
    if (otp.length === 6) {
      handleVerify()
    }
  }, [otp, handleVerify])

  const handleResend = async () => {
    if (!pendingVerificationEmail || resendCooldown > 0) return

    setResendSuccess(false)
    const result = await resendVerificationEmail(pendingVerificationEmail)
    if (result.success) {
      setResendSuccess(true)
      setResendCooldown(60)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await handleVerify()
  }

  if (!pendingVerificationEmail) return null

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
          {/* Email icon */}
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
              <Mail className="w-8 h-8 text-cyan-400" />
            </div>
          </div>

          <h1 className="text-2xl font-bold text-white text-center mb-2">
            Check your email
          </h1>
          <p className="text-zinc-500 text-center text-sm mb-2">
            We sent a verification code to
          </p>
          <p className="text-cyan-400 text-center text-sm font-medium mb-8">
            {pendingVerificationEmail}
          </p>

          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg p-3 mb-6 flex items-start gap-2 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Resend success */}
          {resendSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg p-3 mb-6 text-sm text-center">
              Verification code resent successfully
            </div>
          )}

          {/* OTP Input */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="otp" className="block text-sm font-medium text-zinc-400 mb-3 text-center">
                Enter 6-digit code
              </label>
              <input
                ref={inputRef}
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={otp}
                onChange={(e) => handleOtpChange(e.target.value)}
                placeholder="000000"
                maxLength={6}
                className="w-full bg-zinc-800/50 border border-zinc-700 rounded-lg px-4 py-4 text-white text-center text-3xl font-mono tracking-[0.5em] placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading || otp.length !== 6}
              className="w-full bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-semibold rounded-lg px-4 py-3 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify email'
              )}
            </button>
          </form>

          {/* Resend */}
          <div className="text-center mt-6">
            <p className="text-sm text-zinc-500">
              Didn't receive the code?{' '}
              {resendCooldown > 0 ? (
                <span className="text-zinc-600">
                  Resend in {resendCooldown}s
                </span>
              ) : (
                <button
                  onClick={handleResend}
                  disabled={loading}
                  className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium disabled:opacity-50"
                >
                  Resend code
                </button>
              )}
            </p>
          </div>

          {/* Back to login */}
          <div className="text-center mt-4">
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
