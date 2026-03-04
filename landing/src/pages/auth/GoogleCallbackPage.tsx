import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { checkAuth } = useAuth()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    const error = searchParams.get('error')
    const userParam = searchParams.get('user')

    let user = null
    try {
      if (userParam) {
        user = JSON.parse(decodeURIComponent(userParam))
      }
    } catch {
      // Failed to parse user data
    }

    if (error) {
      setErrorMsg(error)
      setTimeout(() => navigate('/login', { replace: true }), 2000)
      return
    }

    if (token && user) {
      // Store auth data in localStorage
      localStorage.setItem('auth_token', token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('auth_provider', 'google')

      // Sync React auth state from localStorage, then navigate
      checkAuth().then(() => {
        const path = user.owned_organization_id
          ? `/dashboard/org/${user.owned_organization_id}`
          : '/dashboard'
        navigate(path, { replace: true })
      })
    } else {
      navigate('/login', { replace: true })
    }
  }, [searchParams, navigate, checkAuth])

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        {/* Logo */}
        <a href="/" className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8" />
          <img src="/logo.svg" alt="Clippster" className="h-5" />
        </a>

        {/* Card */}
        <style>{`
          @keyframes scaleIn {
            0% { transform: scale(0); opacity: 0; }
            50% { transform: scale(1.1); }
            100% { transform: scale(1); opacity: 1; }
          }
        `}</style>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
          <div className="flex flex-col items-center">
            {errorMsg ? (
              <>
                <div
                  className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6"
                  style={{ animation: 'scaleIn 0.5s ease-out' }}
                >
                  <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Authentication Failed</h2>
                <p className="text-zinc-400 text-sm text-center">{errorMsg}</p>
                <p className="text-zinc-600 text-xs mt-4">Redirecting to login...</p>
              </>
            ) : (
              <>
                <div
                  className="w-16 h-16 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-6"
                  style={{ animation: 'scaleIn 0.5s ease-out' }}
                >
                  <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">Authenticating...</h2>
                <p className="text-zinc-400 text-sm text-center">
                  Please wait while we complete your sign in.
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
