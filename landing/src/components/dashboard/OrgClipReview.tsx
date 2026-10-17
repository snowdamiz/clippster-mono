import { useEffect, useState } from 'react'
import { api } from '@/lib/api'

interface ReviewPost { id: number; caption: string; media_url: string; scheduled_at?: string; submitted_by?: { name?: string; email: string } }
export function OrgClipReview({ organizationId, canReview, onReviewed }: { organizationId: string | number; canReview: boolean; onReviewed: () => void }) {
  const [posts, setPosts] = useState<ReviewPost[]>([])
  const [selected, setSelected] = useState<ReviewPost | null>(null)
  const [notes, setNotes] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    api.get<{ success: boolean; posts: ReviewPost[]; error?: string }>(`/organizations/${organizationId}/posts?status=awaiting_approval&limit=100`).then(result => {
      if (active) { if (result.success) setPosts(result.posts); else setError(result.error || 'Unable to load clip reviews') }
    }).catch(() => { if (active) setError('Unable to load clip reviews') })
    return () => { active = false }
  }, [organizationId, revision])
  async function review(action: 'approve' | 'reject') {
    if (!selected) return
    setBusy(true); setError('')
    try {
      const result = await api.post<{ success: boolean; error?: string }>(`/organizations/${organizationId}/posts/${selected.id}/${action}`, { notes })
      if (!result.success) throw new Error(result.error || 'Review failed')
      setPosts(current => current.filter(post => post.id !== selected.id)); setSelected(null); onReviewed()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Review failed') } finally { setBusy(false) }
  }
  return <section className="mb-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
    <h2 className="font-semibold text-white">Clip approvals · {posts.length}</h2>
    <button className="mt-2 text-sm text-cyan-400" disabled={busy} onClick={() => setRevision(value => value + 1)}>Refresh reviews</button>
    <p className="mt-1 text-sm text-zinc-400">Submitted clips remain private until an organization owner or admin approves them. Approval publishes now or at the requested future time.</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-2">{posts.map(post => <button key={post.id} className="rounded-lg border border-white/10 px-3 py-2 text-sm text-white hover:bg-white/5" onClick={() => { setSelected(post); setNotes(''); setError('') }}>{post.caption || `Clip ${post.id}`} · {post.submitted_by?.name || post.submitted_by?.email}</button>)}</div>
    {selected && <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4" onClick={() => !busy && setSelected(null)}>
      <section role="dialog" aria-modal="true" aria-label="Review clip" className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-xl border border-white/10 bg-zinc-950 p-6" onClick={event => event.stopPropagation()}>
        <h2 className="mb-3 text-lg font-semibold text-white">Review clip</h2>
        <video src={selected.media_url} controls preload="metadata" className="max-h-[50vh] w-full bg-black" />
        <p className="mt-3 whitespace-pre-wrap text-zinc-300">{selected.caption}</p>
        {selected.scheduled_at && <p className="mt-2 text-sm text-zinc-400">Requested time: {new Date(selected.scheduled_at).toLocaleString()}</p>}
        {canReview && <label className="mt-4 block text-sm text-zinc-300">Review notes<textarea value={notes} onChange={event => setNotes(event.target.value)} maxLength={2000} className="mt-2 w-full rounded-lg border border-white/10 bg-zinc-900 p-3" /></label>}
        {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
        <div className="mt-4 flex gap-3">{canReview && <><button disabled={busy} onClick={() => review('approve')} className="rounded-lg bg-cyan-500 px-4 py-2 font-medium text-black">Approve and publish</button><button disabled={busy} onClick={() => review('reject')} className="rounded-lg border border-red-400/30 px-4 py-2 text-red-300">Reject</button></>}<button disabled={busy} onClick={() => setSelected(null)} className="rounded-lg border border-white/10 px-4 py-2 text-white">Close</button></div>
      </section>
    </div>}
  </section>
}
