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
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
          <div className="flex flex-col items-center gap-4">
            {errorMsg ? (
              <>
                <p className="text-red-400 font-medium">Authentication failed</p>
                <p className="text-zinc-500 text-sm text-center">{errorMsg}</p>
                <p className="text-zinc-600 text-xs">Redirecting to login...</p>
              </>
            ) : (
              <>
                <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                <p className="text-white font-medium">Authenticating...</p>
                <p className="text-zinc-500 text-sm text-center">
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
