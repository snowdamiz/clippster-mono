import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useAuth } from '@/hooks/useAuth'
import { useOrganization } from '@/hooks/useOrganization'
import { useToast } from '@/hooks/useToast'
import { Mail, UserPlus } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

export function InviteMemberDialog({ open, onClose, onSuccess }: Props) {
  const [mode, setMode] = useState<'invite' | 'create'>('invite')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [role, setRole] = useState('member')
  const [loading, setLoading] = useState(false)
  const auth = useAuth()
  const { organizationId } = useOrganization()
  const toast = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!organizationId) return
    setLoading(true)
    try {
      if (mode === 'invite') {
        const result = await auth.inviteOrganizationMember(Number(organizationId), email, role)
        if (result.success) {
          toast.success('Invitation sent', `Invitation sent to ${email}`)
          onSuccess()
          handleClose()
        } else {
          toast.error('Failed to invite', result.error || 'Could not send invitation')
        }
      } else {
        const result = await auth.createOrganizationMember(Number(organizationId), email, password, role, name)
        if (result.success) {
          toast.success('Member created', `Account created for ${email}`)
          onSuccess()
          handleClose()
        } else {
          toast.error('Failed to create', result.error || 'Could not create member')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setEmail('')
    setPassword('')
    setName('')
    setRole('member')
    onClose()
  }

  return (
    <Dialog open={open} onClose={handleClose} title={mode === 'invite' ? 'Invite Member' : 'Create Member Account'}>
      <div className="flex gap-2 mb-5">
        <button
          onClick={() => setMode('invite')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'invite' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-zinc-400 hover:bg-zinc-800'}`}
        >
          <Mail className="w-4 h-4" /> Invite by Email
        </button>
        <button
          onClick={() => setMode('create')}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${mode === 'create' ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' : 'text-zinc-400 hover:bg-zinc-800'}`}
        >
          <UserPlus className="w-4 h-4" /> Create Account
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === 'create' && <Input label="Name" value={name} onChange={e => setName(e.target.value)} placeholder="Full name" />}
        <Input label="Email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="member@example.com" />
        {mode === 'create' && <Input label="Password" type="password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 characters" />}
        <Select label="Role" value={role} onChange={e => setRole(e.target.value)}>
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={handleClose}>Cancel</Button>
          <Button type="submit" loading={loading}>{mode === 'invite' ? 'Send Invitation' : 'Create Account'}</Button>
        </div>
      </form>
    </Dialog>
  )
}
