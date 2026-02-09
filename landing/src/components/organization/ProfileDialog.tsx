import { useState, useEffect } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { createOrganizationCreatorProfile, updateOrganizationCreatorProfile } from '@/services/organizationApi'
import { useOrganization } from '@/hooks/useOrganization'
import { useToast } from '@/hooks/useToast'
import type { ServerOrganizationCreatorProfile } from '@/types/organization'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  profile?: ServerOrganizationCreatorProfile | null
}

export function ProfileDialog({ open, onClose, onSuccess, profile }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const { organizationId } = useOrganization()
  const toast = useToast()

  useEffect(() => {
    if (profile) { setName(profile.name); setDescription(profile.description || '') }
    else { setName(''); setDescription('') }
  }, [profile, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return
    setLoading(true)
    try {
      const result = profile
        ? await updateOrganizationCreatorProfile(Number(organizationId), profile.id, { name, description })
        : await createOrganizationCreatorProfile(Number(organizationId), { name, description })
      if (result.success) {
        toast.success(profile ? 'Profile updated' : 'Profile created')
        onSuccess()
        onClose()
      } else {
        toast.error('Failed', result.error || 'Operation failed')
      }
    } finally { setLoading(false) }
  }

  return (
    <Dialog open={open} onClose={onClose} title={profile ? 'Edit Profile' : 'Create Creator Profile'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" required value={name} onChange={e => setName(e.target.value)} placeholder="Creator name" />
        <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{profile ? 'Save' : 'Create'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
