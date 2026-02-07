import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Skeleton } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Settings, Upload, Trash2 } from 'lucide-react'

export function OrgSettings() {
  const { loading, organization, isOwner, isAdmin, loadOrganization, updateOrganization, uploadLogo, deleteOrganization } = useOrganization()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [allowAi, setAllowAi] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const navigate = useNavigate()

  useEffect(() => { loadOrganization() }, [loadOrganization])
  useEffect(() => {
    if (organization) {
      setName(organization.name)
      setDescription(organization.description || '')
      setAllowAi(organization.settings?.allow_ai ?? false)
    }
  }, [organization])

  const handleSave = async () => {
    setSaving(true)
    await updateOrganization({ name, description, settings: { allow_ai: allowAi } })
    setSaving(false)
  }

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) await uploadLogo(file)
  }

  const handleDelete = async () => {
    setDeleteLoading(true)
    const result = await deleteOrganization()
    setDeleteLoading(false)
    if (result.success) { navigate('/dashboard/org/new') }
  }

  if (loading && !organization) return <PageLayout icon={Settings} title="Settings"><div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div></PageLayout>

  return (
    <PageLayout icon={Settings} title="Settings" description="Manage organization settings">
      <div className="max-w-2xl space-y-8">
        {/* Profile section */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
          <h3 className="text-sm font-semibold text-white mb-4">Organization Profile</h3>
          <div className="flex items-start gap-4 mb-4">
            <div className="relative group">
              {organization?.logo_url ? (
                <img src={organization.logo_url} alt="" className="w-16 h-16 rounded-xl object-cover" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-zinc-800 flex items-center justify-center text-zinc-600 text-xl font-bold">{name?.[0]}</div>
              )}
              {isAdmin && (
                <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-xl opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Upload className="w-5 h-5 text-white" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </label>
              )}
            </div>
            <div className="flex-1 space-y-3">
              <Input label="Name" value={name} onChange={e => setName(e.target.value)} disabled={!isAdmin} />
              <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} disabled={!isAdmin} />
            </div>
          </div>
        </div>

        {/* Settings */}
        {isAdmin && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-white mb-4">Features</h3>
            <label className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800/50 transition-colors cursor-pointer">
              <div><p className="text-sm text-white">AI Features</p><p className="text-xs text-zinc-500">Allow AI-powered clip generation</p></div>
              <input type="checkbox" checked={allowAi} onChange={e => setAllowAi(e.target.checked)} className="rounded bg-zinc-800 border-zinc-700 text-cyan-500" />
            </label>
          </div>
        )}

        {isAdmin && (
          <Button onClick={handleSave} loading={saving}>Save Settings</Button>
        )}

        {/* Danger zone */}
        {isOwner && (
          <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-6">
            <h3 className="text-sm font-semibold text-red-400 mb-2">Danger Zone</h3>
            <p className="text-xs text-zinc-500 mb-4">Permanently delete this organization and all its data.</p>
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}><Trash2 className="w-4 h-4" /> Delete Organization</Button>
          </div>
        )}
      </div>

      <ConfirmDialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} onConfirm={handleDelete} title="Delete Organization" description="This will permanently delete the organization, all members, assets, and data. This action cannot be undone." confirmText="Delete Forever" loading={deleteLoading} />
    </PageLayout>
  )
}
