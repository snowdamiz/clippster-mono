import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const token = searchParams.get('token')
    const userParam = searchParams.get('user')

    let user = null
    try {
      if (userParam) {
        user = JSON.parse(decodeURIComponent(userParam))
      }
    } catch {
      // Failed to parse user data
    }

    if (window.opener) {
      window.opener.postMessage(
        {
          type: 'google-auth-result',
          token,
          user,
        },
        '*'
      )

      // Close the popup after a brief delay to ensure the message is sent
      setTimeout(() => {
        window.close()
      }, 500)
    } else {
      // If there's no opener (e.g., navigated directly), store and redirect
      if (token && user) {
        localStorage.setItem('auth_token', token)
        localStorage.setItem('user', JSON.stringify(user))
        localStorage.setItem('auth_provider', 'google')
        window.location.href = user.owned_organization_id
          ? `/dashboard/org/${user.owned_organization_id}`
          : '/dashboard'
      } else {
        window.location.href = '/login'
      }
    }
  }, [searchParams])

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
            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-white font-medium">Authenticating...</p>
            <p className="text-zinc-500 text-sm text-center">
              Please wait while we complete your sign in.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
