import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'

/** Keep account navigation outside the shared Vue video workspace. */
export function AccountWorkspace({ viewOverride, onClose }: { viewOverride?: string; onClose?: () => void } = {}) {
  const { token, refreshUserData } = useAuth()
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const projectId = new URLSearchParams(search).get('project')
  const clipId = new URLSearchParams(search).get('clip')
  const fromBuiltClips = new URLSearchParams(search).get('from') === 'clips'
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
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return
      if (event.data?.type === 'clippster-account-refresh') void refreshUserData()
      if (event.data?.type === 'clippster-profile-updated') window.dispatchEvent(new Event('clippster-profile-updated'))
      if (event.data?.type === 'clippster-settings-close') { if(onClose)onClose();else navigate('/account/profile') }
      if (event.data?.type === 'clippster-workspace-navigation') {
        const id = event.data.projectId
        if (id !== null && (typeof id !== 'string' || !/^[\da-f-]{36}$/i.test(id))) return
        const clip = event.data.clipId
        if (clip != null && (typeof clip !== 'string' || !/^[\da-f-]{36}$/i.test(clip))) return
        const built = event.data.view === 'built'
        const destination = (id || !built ? '/account/videos' : '/account/clips') + (id ? `?project=${encodeURIComponent(id)}${clip ? `&clip=${encodeURIComponent(clip)}` : ''}${built ? '&from=clips' : ''}` : '')
        if (pathname + search !== destination) navigate(destination)
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [refreshUserData, navigate, pathname, search, onClose])

  if (error) return <div className="p-6" role="alert">
    <p className="text-red-400">{error}</p>
    <button onClick={() => setAttempt(value => value + 1)} className="rounded-lg bg-cyan-400 px-4 py-2 text-black">Retry</button>
    <Link to="/account/billing" className="ml-4 text-cyan-400">Manage plan</Link>
  </div>
  if (!ready) return <div className="p-6 text-zinc-400" role="status">Loading your workspace…</div>
  return <iframe
    ref={frame}
    key={pathname}
    src={`/workspace/?embedded=1&view=${viewOverride || (fromBuiltClips ? 'built' : ({ settings: 'settings', profile: 'profile', clips: 'built', downloads: 'download', creators: 'creators', campaigns: 'campaigns', prompts: 'prompts', calendar: 'calendar' } as Record<string, string>)[pathname.split('/').at(-1) || ''] || 'library')}${new URLSearchParams(search).get('tab') ? `&tab=${encodeURIComponent(new URLSearchParams(search).get('tab')!)}` : ''}${projectId && /^[\da-f-]{36}$/i.test(projectId) ? `&project=${encodeURIComponent(projectId)}` : ''}${clipId && /^[\da-f-]{36}$/i.test(clipId) ? `&clip=${encodeURIComponent(clipId)}` : ''}`}
    title="Clippster video workspace"
    className="h-full min-h-[600px] w-full border-0"
    allow="fullscreen"
  />
}
