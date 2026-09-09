import { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { getPostAuthPath } from '@/lib/accountRouting'
import type { AuthUser } from '@/types/auth'

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { checkAuth } = useAuth()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    const error = searchParams.get('error')
    const userParam = searchParams.get('user')

    let user: AuthUser | null = null
    try {
      if (userParam) {
        user = JSON.parse(decodeURIComponent(userParam))
      }
    } catch {
      // Failed to parse user data
    }

    if (error) {
      setErrorMsg(error)
      setTimeout(() => navigate('/', { replace: true }), 2000)
      return
    }

    if (token && user) {
      localStorage.setItem('auth_token', token)
      localStorage.setItem('user', JSON.stringify(user))
      localStorage.setItem('auth_provider', 'google')

      checkAuth().then(() => {
        navigate(getPostAuthPath(user), { replace: true })
      })
    } else {
      navigate('/', { replace: true })
    }
  }, [searchParams, navigate, checkAuth])

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md mx-auto">
        <a href="/" className="flex items-center justify-center gap-3 mb-8">
          <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8" />
          <img src="/logo.svg" alt="Clippster" className="h-5" />
        </a>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
          <div className="flex flex-col items-center">
            {errorMsg ? (
              <>
                <h2 className="text-xl font-bold text-white mb-2">Authentication Failed</h2>
                <p className="text-zinc-400 text-sm text-center">{errorMsg}</p>
              </>
            ) : (
              <>
                <Loader2 className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
                <h2 className="text-xl font-bold text-white mb-2">Signing you in…</h2>
                <p className="text-zinc-400 text-sm text-center">Finishing Google authentication</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
