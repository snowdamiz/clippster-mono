import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Badge } from '@/components/ui/Badge'
import { listOrganizationCampaigns, createCampaign, deleteCampaign, pauseCampaign, activateCampaign } from '@/services/campaignApi'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/hooks/useToast'
import type { Campaign } from '@/types/organization'
import { Megaphone, Plus, Users, Pause, Play, Trash2 } from 'lucide-react'

const statusVariants: Record<string, 'success' | 'warning' | 'default' | 'danger'> = { active: 'success', paused: 'warning', draft: 'default', completed: 'admin' as any }

export function OrgCampaigns() {
  const { loadOrganization, organizationId, isAdmin } = useOrganization()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  const loadCampaigns = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const result = await listOrganizationCampaigns(Number(organizationId))
      if (result.success) setCampaigns(result.campaigns)
    } finally { setLoading(false) }
  }

  useEffect(() => { loadOrganization(); loadCampaigns() }, [organizationId])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return
    setCreating(true)
    try {
      const result = await createCampaign(Number(organizationId), { title, status: 'draft' })
      if (result.success) { toast.success('Campaign created'); loadCampaigns(); setShowCreate(false); setTitle('') }
      else toast.error('Failed', result.error)
    } finally { setCreating(false) }
  }

  const handleToggleStatus = async (campaign: Campaign) => {
    if (!organizationId) return
    const result = campaign.status === 'active'
      ? await pauseCampaign(Number(organizationId), campaign.id)
      : await activateCampaign(Number(organizationId), campaign.id)
    if (result.success) loadCampaigns()
  }

  const handleDelete = async () => {
    if (!deleteTarget || !organizationId) return
    setDeleting(true)
    try {
      const result = await deleteCampaign(Number(organizationId), deleteTarget.id)
      if (result.success) { setCampaigns(prev => prev.filter(c => c.id !== deleteTarget.id)); toast.success('Campaign deleted') }
    } finally { setDeleting(false); setDeleteTarget(null) }
  }

  if (loading) return <PageLayout icon={Megaphone} title="Campaigns"><div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div></PageLayout>

  return (
    <PageLayout icon={Megaphone} title="Campaigns" description="Create and manage marketing campaigns" actions={isAdmin && <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> New Campaign</Button>}>
      {campaigns.length === 0 ? (
        <EmptyState icon={Megaphone} title="No Campaigns" description="Create campaigns to promote your content" action={isAdmin && <Button onClick={() => setShowCreate(true)}>Create Campaign</Button>} />
      ) : (
        <div className="space-y-3">
          {campaigns.map(campaign => (
            <div key={campaign.id} className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              {campaign.cover_image_url ? (
                <img src={campaign.cover_image_url} alt="" className="w-16 h-16 rounded-lg object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-zinc-800 flex items-center justify-center"><Megaphone className="w-6 h-6 text-zinc-600" /></div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white">{campaign.title}</h3>
                  <Badge variant={statusVariants[campaign.status] || 'default'}>{campaign.status}</Badge>
                </div>
                {campaign.description && <p className="text-xs text-zinc-500 truncate">{campaign.description}</p>}
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-zinc-600 flex items-center gap-1"><Users className="w-3 h-3" /> {campaign.participants_count || 0} participants</span>
                  {campaign.budget && <span className="text-xs text-zinc-600">Budget: ${campaign.budget}</span>}
                </div>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(campaign)}>
                    {campaign.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(campaign)}><Trash2 className="w-4 h-4 text-red-400" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onClose={() => setShowCreate(false)} title="Create Campaign" maxWidth="max-w-md">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="Campaign Title" required value={title} onChange={e => setTitle(e.target.value)} placeholder="My Campaign" />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button type="submit" loading={creating}>Create</Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Campaign" description={`Delete "${deleteTarget?.title}"? This cannot be undone.`} confirmText="Delete" loading={deleting} />
    </PageLayout>
  )
}
