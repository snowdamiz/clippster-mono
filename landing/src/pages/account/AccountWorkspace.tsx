import { useEffect, useState, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/** Keep account navigation outside the shared Vue video workspace. */
export function AccountWorkspace() {
  const { token, refreshUserData } = useAuth()
  const { pathname } = useLocation()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const abort = new AbortController()
    setReady(false)
    setError('')
    async function connect() {
      try {
        const response = await fetch('/workspace/api/auth/session', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          signal: abort.signal,
        })
        if (response.status === 401) window.dispatchEvent(new CustomEvent('auth-required'))
        if (!response.ok) throw new Error(response.status === 401
          ? 'Your session expired. Please sign in again.'
          : 'Unable to connect to your workspace. Please try again.')
        if (!abort.signal.aborted) setReady(true)
      } catch (cause) {
        if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Unable to connect.')
      }
    }
    void connect()
    return () => abort.abort()
  }, [token, attempt])

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow ||
          event.data?.type !== 'clippster-account-refresh') return
      void refreshUserData()
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [refreshUserData])

  if (error) return <div className="p-6" role="alert">
    <p className="text-red-400">{error}</p>
    <button onClick={() => setAttempt(value => value + 1)} className="rounded-lg bg-cyan-400 px-4 py-2 text-black">Retry</button>
    <Link to="/account/billing" className="ml-4 text-cyan-400">Manage plan</Link>
  </div>
  if (!ready) return <div className="p-6 text-zinc-400" role="status">Loading your workspace…</div>
  return <iframe
    ref={frame}
    key={pathname}
    src={`/workspace/?embedded=1&view=${({ downloads: 'download', creators: 'creators', campaigns: 'campaigns', prompts: 'prompts', calendar: 'calendar' } as Record<string, string>)[pathname.split('/').at(-1) || ''] || 'library'}`}
    title="Clippster video workspace"
    className="h-full min-h-[600px] w-full border-0"
    allow="fullscreen"
  />
}
