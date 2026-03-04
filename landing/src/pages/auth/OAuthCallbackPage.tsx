import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * OAuth callback page for popup-based social account OAuth.
 *
 * The backend redirects here after OAuth completes with query params:
 * ?success=true&account_id=...&platform=...&username=...
 * or
 * ?success=false&error=...
 *
 * This page reads the params and sends them back to the opener window
 * via postMessage, then closes itself.
 */
export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()

  useEffect(() => {
    const result: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      result[key] = value
    })

    // Send result to opener window
    if (window.opener) {
      window.opener.postMessage(
        { type: 'oauth-callback', ...result },
        window.location.origin
      )
      // Close popup after a brief delay to ensure message is sent
      setTimeout(() => window.close(), 300)
    }
  }, [searchParams])

  const success = searchParams.get('success') === 'true'
  const username = searchParams.get('username')
  const error = searchParams.get('error')

  return (
    <>
      <style>{`
        @keyframes scaleIn {
          0% { transform: scale(0); opacity: 0; }
          50% { transform: scale(1.1); }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md mx-auto" style={{ animation: 'fadeIn 0.5s ease-out' }}>
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <img src="/logo-icon.svg" alt="Clippster" className="w-8 h-8" />
            <img src="/logo.svg" alt="Clippster" className="h-5" />
          </div>

          {/* Card */}
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-8">
            <div className="flex flex-col items-center">
              {success ? (
                <>
                  <div
                    className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-6"
                    style={{ animation: 'scaleIn 0.5s ease-out' }}
                  >
                    <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Account Connected</h2>
                  <p className="text-sm text-zinc-400 text-center">
                    {username ? `@${username} has been connected successfully.` : 'Your account has been connected successfully.'}
                  </p>
                  <p className="text-xs text-zinc-600 mt-4">This window will close automatically...</p>
                </>
              ) : (
                <>
                  <div
                    className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6"
                    style={{ animation: 'scaleIn 0.5s ease-out' }}
                  >
                    <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-bold text-white mb-2">Connection Failed</h2>
                  <p className="text-sm text-zinc-400 text-center">{error || 'An unknown error occurred.'}</p>
                  <p className="text-xs text-zinc-600 mt-4">This window will close automatically...</p>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
