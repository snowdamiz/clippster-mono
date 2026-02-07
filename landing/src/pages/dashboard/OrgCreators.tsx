import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProfileDialog } from '@/components/organization/ProfileDialog'
import { deleteOrganizationCreatorProfile, uploadCreatorProfileImage } from '@/services/organizationApi'
import { useToast } from '@/hooks/useToast'
import type { ServerOrganizationCreatorProfile } from '@/types/organization'
import { UserCircle, Plus, Pencil, Trash2, Link, Upload } from 'lucide-react'

export function OrgCreators() {
  const { creatorProfiles, profilesLoading, loadCreatorProfiles, organizationId, isAdmin } = useOrganization()
  const [showProfileDialog, setShowProfileDialog] = useState(false)
  const [editProfile, setEditProfile] = useState<ServerOrganizationCreatorProfile | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ServerOrganizationCreatorProfile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const toast = useToast()

  useEffect(() => { loadCreatorProfiles() }, [loadCreatorProfiles])

  const handleDelete = async () => {
    if (!deleteTarget || !organizationId) return
    setDeleting(true)
    try {
      const result = await deleteOrganizationCreatorProfile(Number(organizationId), deleteTarget.id)
      if (result.success) { toast.success('Profile deleted'); loadCreatorProfiles() }
      else toast.error('Delete failed', result.error)
    } finally { setDeleting(false); setDeleteTarget(null) }
  }

  const handleImageUpload = async (profile: ServerOrganizationCreatorProfile, file: File) => {
    if (!organizationId) return
    const result = await uploadCreatorProfileImage(Number(organizationId), profile.id, file)
    if (result.success) { toast.success('Image updated'); loadCreatorProfiles() }
    else toast.error('Upload failed', result.error)
  }

  if (profilesLoading && creatorProfiles.length === 0) {
    return <PageLayout icon={UserCircle} title="Creator Profiles"><div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div></PageLayout>
  }

  return (
    <PageLayout icon={UserCircle} title="Creator Profiles" description="Manage creator profiles and platform links" actions={isAdmin && <Button onClick={() => { setEditProfile(null); setShowProfileDialog(true) }}><Plus className="w-4 h-4" /> New Profile</Button>}>
      {creatorProfiles.length === 0 ? (
        <EmptyState icon={UserCircle} title="No Creator Profiles" description="Create profiles to represent your creators" action={isAdmin && <Button onClick={() => setShowProfileDialog(true)}>Create Profile</Button>} />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {creatorProfiles.map(profile => (
            <div key={profile.id} className="p-5 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <div className="flex items-start gap-4">
                <div className="relative group">
                  <Avatar src={profile.profile_image_url} name={profile.name} size="lg" />
                  {isAdmin && (
                    <label className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <Upload className="w-4 h-4 text-white" />
                      <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleImageUpload(profile, e.target.files[0])} />
                    </label>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white">{profile.name}</h3>
                  {profile.description && <p className="text-xs text-zinc-500 mt-0.5">{profile.description}</p>}
                  {profile.platform_links && profile.platform_links.length > 0 && (
                    <div className="flex items-center gap-2 mt-2">
                      {profile.platform_links.map(link => (
                        <Badge key={link.id} variant="default"><Link className="w-3 h-3" /> {link.platform}</Badge>
                      ))}
                    </div>
                  )}
                  {profile.assignments && profile.assignments.length > 0 && (
                    <p className="text-xs text-zinc-600 mt-1">{profile.assignments.length} assigned member(s)</p>
                  )}
                </div>
                {isAdmin && (
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditProfile(profile); setShowProfileDialog(true) }}><Pencil className="w-3.5 h-3.5" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(profile)}><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ProfileDialog open={showProfileDialog} onClose={() => setShowProfileDialog(false)} onSuccess={loadCreatorProfiles} profile={editProfile} />
      <ConfirmDialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDelete} title="Delete Profile" description={`Delete "${deleteTarget?.name}"? This cannot be undone.`} confirmText="Delete" loading={deleting} />
    </PageLayout>
  )
}
