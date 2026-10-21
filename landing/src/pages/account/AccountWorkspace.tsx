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
  const query = new URLSearchParams(search)
  const view = viewOverride || (fromBuiltClips ? 'built' : ({ settings: 'settings', profile: 'profile', edit: 'profile-edit', clips: 'built', downloads: 'download', creators: 'creators', campaigns: 'campaigns', prompts: 'prompts', calendar: 'calendar' } as Record<string, string>)[pathname.split('/').at(-1) || ''] || 'library')
  const workspaceQuery = new URLSearchParams({ embedded: '1', view })
  if (query.get('tab')) workspaceQuery.set('tab', query.get('tab')!)
  if (projectId && /^[\da-f-]{36}$/i.test(projectId)) workspaceQuery.set('project', projectId)
  if (clipId && /^[\da-f-]{36}$/i.test(clipId)) workspaceQuery.set('clip', clipId)
  const workspaceSearch = workspaceQuery.toString()
  // Navigation is delivered to the running app; changing src would reload it.
  const [initialSrc] = useState(() => `/workspace/?${workspaceSearch}`)
  const previousRoute = useRef(pathname + search)

  useEffect(() => {
    const destination = pathname + search
    if (previousRoute.current !== destination) {
      const guard = new Event('clippster-before-workspace-navigation', { cancelable: true })
      if (!window.dispatchEvent(guard) && !window.confirm('You have unsaved changes or an upload in progress. Leave this page?')) {
        navigate(previousRoute.current, { replace: true })
        return
      }
      previousRoute.current = destination
    }
    frame.current?.contentWindow?.postMessage({ type: 'clippster-workspace-route', search: workspaceSearch }, window.location.origin)
  }, [workspaceSearch, ready, pathname, search, navigate])

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
      if (event.data?.type === 'clippster-workspace-ready') {
        frame.current?.contentWindow?.postMessage({ type: 'clippster-workspace-route', search: workspaceSearch }, window.location.origin)
      }
      if (event.data?.type === 'clippster-account-navigation') {
        const path = event.data.path
        if (typeof path === 'string' && /^\/account(?:[/?#]|$)/.test(path) && !path.includes('\\'))
          navigate(path, { replace: event.data.replace === true })
      }
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
  }, [refreshUserData, navigate, pathname, search, onClose, workspaceSearch])

  if (error) return <div className="p-6" role="alert">
    <p className="text-red-400">{error}</p>
    <button onClick={() => setAttempt(value => value + 1)} className="rounded-lg bg-cyan-400 px-4 py-2 text-black">Retry</button>
    <Link to="/account/billing" className="ml-4 text-cyan-400">Manage plan</Link>
  </div>
  if (!ready) return <div className="p-6 text-zinc-400" role="status">Loading your workspace…</div>
  return <iframe
    ref={frame}
    src={initialSrc}
    title="Clippster video workspace"
    className="h-full min-h-0 w-full border-0"
    allow="fullscreen"
  />
}
