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
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
      <div className="text-center p-8 max-w-sm">
        {success ? (
          <>
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Account Connected</h2>
            <p className="text-sm text-zinc-400">
              {username ? `@${username} has been connected.` : 'Your account has been connected.'}
            </p>
            <p className="text-xs text-zinc-500 mt-3">This window will close automatically...</p>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white mb-2">Connection Failed</h2>
            <p className="text-sm text-zinc-400">{error || 'An unknown error occurred.'}</p>
            <p className="text-xs text-zinc-500 mt-3">This window will close automatically...</p>
          </>
        )}
      </div>
    </div>
  )
}
