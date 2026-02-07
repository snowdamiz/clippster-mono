import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { ShareClipDialog } from '@/components/organization/ShareClipDialog'
import { listOrganizationSharedClips, deleteSharedClip, getExpirationBadgeColor, getExpirationText } from '@/services/sharedClipsApi'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import type { SharedClip } from '@/types/organization'
import { Share2, Plus, Trash2, Eye, Download, Clock } from 'lucide-react'

export function OrgShared() {
  const { loadOrganization, organizationId, isAdmin } = useOrganization()
  const [clips, setClips] = useState<SharedClip[]>([])
  const [loading, setLoading] = useState(true)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SharedClip | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  const loadClips = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const result = await listOrganizationSharedClips(organizationId)
      if (result.success) setClips(result.clips)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadOrganization(); loadClips() }, [organizationId])

  const handleDelete = async () => {
    if (!deleteTarget || !organizationId) return
    setDeleting(true)
    try {
      const result = await deleteSharedClip(organizationId, deleteTarget.id)
      if (result.success) { setClips(prev => prev.filter(c => c.id !== deleteTarget.id)); toast.success('Clip deleted') }
    } finally { setDeleting(false); setDeleteTarget(null) }
  }

  if (loading) return <PageLayout icon={Share2} title="Shared Clips"><div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div></PageLayout>

  return (
    <PageLayout icon={Share2} title="Shared Clips" description="Share clips with your team members" actions={isAdmin && <Button onClick={() => setShowShareDialog(true)}><Plus className="w-4 h-4" /> Share Clip</Button>}>
      {clips.length === 0 ? (
        <EmptyState icon={Share2} title="No Shared Clips" description="Share clips with your team for review and posting" action={isAdmin && <Button onClick={() => setShowShareDialog(true)}>Share a Clip</Button>} />
      ) : (
        <div className="space-y-3">
          {clips.map(clip => {
            const expColor = getExpirationBadgeColor(clip.days_until_expiration)
            return (
              <div key={clip.id} className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
                {clip.thumbnail_url ? (
                  <img src={clip.thumbnail_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center"><Share2 className="w-6 h-6 text-zinc-600" /></div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white truncate">{clip.name}</h3>
                  {clip.description && <p className="text-xs text-zinc-500 truncate">{clip.description}</p>}
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs text-zinc-600 flex items-center gap-1"><Clock className="w-3 h-3" /> {getExpirationText(clip.days_until_expiration)}</span>
                    {clip.stats && (
                      <>
                        <span className="text-xs text-zinc-600 flex items-center gap-1"><Eye className="w-3 h-3" /> {clip.stats.viewed}</span>
                        <span className="text-xs text-zinc-600 flex items-center gap-1"><Download className="w-3 h-3" /> {clip.stats.downloaded}</span>
                      </>
                    )}
                  </div>
                </div>
                <Badge variant={expColor === 'green' ? 'success' : expColor === 'yellow' ? 'warning' : 'danger'}>{clip.days_until_expiration}d</Badge>
                {isAdmin && <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(clip)}><Trash2 className="w-4 h-4 text-red-400" /></Button>}
              </div>
            )
          })}
        </div>
      )}

      <ShareClipDialog open={showShareDialog} onClose={() => setShowShareDialog(false)} onSuccess={loadClips} />
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Shared Clip" description={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmText="Delete" loading={deleting} />
    </PageLayout>
  )
}
