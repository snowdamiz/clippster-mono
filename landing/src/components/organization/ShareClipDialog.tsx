import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useOrganization } from '@/hooks/useOrganization'
import { useToast } from '@/hooks/useToast'
import { createSharedClip } from '@/services/sharedClipsApi'
import { Upload } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ShareClipDialog({ open, onClose, onSuccess }: Props) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [shareWithAll, setShareWithAll] = useState(true)
  const [loading, setLoading] = useState(false)
  const { organizationId } = useOrganization()
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file || !organizationId) return
    setLoading(true)
    try {
      const result = await createSharedClip(organizationId, file, { name, description, shareWithAll })
      if (result.success) {
        toast.success('Clip shared', 'Clip has been shared with your team')
        onSuccess()
        handleClose()
      } else {
        toast.error('Share failed', result.error || 'Failed to share clip')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setFile(null)
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title="Share Clip">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Name" required value={name} onChange={e => setName(e.target.value)} placeholder="Clip name" />
        <Input label="Description" value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional description" />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-300">Video File</label>
          <label className="flex items-center justify-center gap-2 p-6 border-2 border-dashed border-zinc-700 rounded-lg cursor-pointer hover:border-zinc-600 transition-colors">
            <Upload className="w-5 h-5 text-zinc-500" />
            <span className="text-sm text-zinc-500">{file ? file.name : 'Choose a file'}</span>
            <input type="file" accept="video/*" className="hidden" onChange={e => setFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-400">
          <input type="checkbox" checked={shareWithAll} onChange={e => setShareWithAll(e.target.checked)} className="rounded bg-zinc-800 border-zinc-700" />
          Share with all members
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={loading} disabled={!file}>Share Clip</Button>
        </div>
      </form>
    </Dialog>
  )
}
