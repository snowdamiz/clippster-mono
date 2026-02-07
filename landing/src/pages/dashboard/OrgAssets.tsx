import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { uploadOrganizationAsset, deleteOrganizationAsset } from '@/services/organizationApi'
import { useToast } from '@/hooks/useToast'
import type { ServerOrganizationAsset } from '@/types/organization'
import { FolderOpen, Upload, Trash2, Film, Image, Music, FileQuestion } from 'lucide-react'

const assetTypeIcons: Record<string, any> = { intro: Film, outro: Film, watermark: Image, audio: Music, image: Image, video: Film }

export function OrgAssets() {
  const { orgAssets, assetsLoading, loadOrgAssets, organizationId, isAdmin } = useOrganization()
  const [deleteTarget, setDeleteTarget] = useState<ServerOrganizationAsset | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  useEffect(() => { loadOrgAssets() }, [loadOrgAssets])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, assetType: string) => {
    const file = e.target.files?.[0]
    if (!file || !organizationId) return
    try {
      const result = await uploadOrganizationAsset(Number(organizationId), file, assetType, file.name)
      if (result.success) { toast.success('Asset uploaded'); loadOrgAssets() }
      else toast.error('Upload failed', result.error)
    } catch { toast.error('Upload failed') }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !organizationId) return
    setDeleting(true)
    try {
      const result = await deleteOrganizationAsset(Number(organizationId), deleteTarget.id)
      if (result.success) { toast.success('Asset deleted'); loadOrgAssets() }
    } finally { setDeleting(false); setDeleteTarget(null) }
  }

  const groups = ['intro', 'outro', 'watermark', 'audio', 'image', 'video'].map(type => ({
    type,
    assets: orgAssets.filter(a => a.asset_type === type),
  })).filter(g => g.assets.length > 0 || isAdmin)

  if (assetsLoading && orgAssets.length === 0) {
    return <PageLayout icon={FolderOpen} title="Assets"><div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div></PageLayout>
  }

  return (
    <PageLayout icon={FolderOpen} title="Assets" description="Manage intros, outros, watermarks, and media assets">
      {groups.map(group => {
        const Icon = assetTypeIcons[group.type] || FileQuestion
        return (
          <div key={group.type} className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                <Icon className="w-4 h-4" /> {group.type}s ({group.assets.length})
              </h2>
              {isAdmin && (
                <label className="cursor-pointer">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg text-sm font-medium text-white transition-colors cursor-pointer">
                    <Upload className="w-3.5 h-3.5" /> Upload
                  </span>
                  <input type="file" className="hidden" onChange={e => handleUpload(e, group.type)} accept={group.type === 'audio' ? 'audio/*' : group.type === 'image' || group.type === 'watermark' ? 'image/*' : 'video/*'} />
                </label>
              )}
            </div>
            {group.assets.length === 0 ? (
              <div className="p-8 border border-dashed border-zinc-800 rounded-xl text-center text-sm text-zinc-600">No {group.type}s uploaded</div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.assets.map(asset => (
                  <div key={asset.id} className="group relative bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
                    {asset.thumbnail_url || (asset.mime_type?.startsWith('image') && asset.url) ? (
                      <img src={asset.thumbnail_url || asset.url} alt={asset.name} className="w-full h-24 object-cover" />
                    ) : (
                      <div className="w-full h-24 flex items-center justify-center bg-zinc-800/50"><Icon className="w-8 h-8 text-zinc-600" /></div>
                    )}
                    <div className="p-3">
                      <p className="text-xs font-medium text-white truncate">{asset.name}</p>
                      {asset.file_size && <p className="text-xs text-zinc-600">{(asset.file_size / 1024 / 1024).toFixed(1)} MB</p>}
                    </div>
                    {isAdmin && (
                      <button onClick={() => setDeleteTarget(asset)} className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-zinc-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}

      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Asset" description={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmText="Delete" loading={deleting} />
    </PageLayout>
  )
}
