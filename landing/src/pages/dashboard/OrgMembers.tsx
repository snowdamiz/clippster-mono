import { useEffect, useState } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { InviteMemberDialog } from '@/components/organization/InviteMemberDialog'
import { Users, UserPlus, X, Mail, Clock } from 'lucide-react'

export function OrgMembers() {
  const {
    loading, members, invitations, isAdmin, loadOrganization,
    removeMember, updateMemberRole, cancelInvitation, resendInvitation,
    formatDate, formatAllocation, canAddMembers
  } = useOrganization()
  const [showInviteDialog, setShowInviteDialog] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState<any>(null)
  const [removing, setRemoving] = useState(false)

  useEffect(() => { loadOrganization() }, [loadOrganization])

  const handleRemove = async () => {
    if (!confirmRemove) return
    setRemoving(true)
    await removeMember(confirmRemove)
    setRemoving(false)
    setConfirmRemove(null)
  }

  if (loading && members.length === 0) {
    return (
      <PageLayout icon={Users} title="Members">
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout icon={Users} title="Members" description="Manage team members and invitations" actions={
      isAdmin && <Button onClick={() => setShowInviteDialog(true)} disabled={!canAddMembers}><UserPlus className="w-4 h-4" /> Add Member</Button>
    }>
      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
          <p className="text-2xl font-bold text-white">{members.length}</p>
          <p className="text-xs text-zinc-500">Members</p>
        </div>
        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
          <p className="text-2xl font-bold text-white">{invitations.length}</p>
          <p className="text-xs text-zinc-500">Pending Invites</p>
        </div>
        <div className="p-3 bg-zinc-900/50 border border-zinc-800 rounded-xl text-center">
          <p className="text-2xl font-bold text-white">{members.filter(m => m.role === 'admin' || m.role === 'owner').length}</p>
          <p className="text-xs text-zinc-500">Admins</p>
        </div>
      </div>

      {/* Pending invitations */}
      {isAdmin && invitations.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-zinc-400 mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Pending Invitations</h3>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center justify-between p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-amber-400" />
                  <div>
                    <p className="text-sm text-white">{inv.email}</p>
                    <p className="text-xs text-zinc-500">Expires {formatDate(inv.expires_at)} · Role: {inv.role}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => resendInvitation(inv)}>Resend</Button>
                  <Button variant="ghost" size="sm" onClick={() => cancelInvitation(inv.id)}><X className="w-4 h-4" /></Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Members list */}
      {members.length === 0 ? (
        <EmptyState icon={Users} title="No members yet" description="Invite team members to get started" action={isAdmin && <Button onClick={() => setShowInviteDialog(true)}>Invite Member</Button>} />
      ) : (
        <div className="space-y-3">
          {members.map(member => (
            <div key={member.id} className="flex items-center gap-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl">
              <Avatar src={member.user?.avatar_url} name={member.user?.name} email={member.user?.email} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{member.user?.name || member.user?.email}</span>
                  <Badge variant={member.role === 'owner' ? 'owner' : member.role === 'admin' ? 'admin' : 'member'}>{member.role}</Badge>
                </div>
                <p className="text-xs text-zinc-500">{member.user?.email}</p>
                {member.allocation && (
                  <p className="text-xs text-zinc-600 mt-0.5">{formatAllocation(member.allocation.hours_remaining)} min remaining</p>
                )}
              </div>
              {isAdmin && member.role !== 'owner' && (
                <div className="flex items-center gap-1">
                  <select
                    value={member.role}
                    onChange={e => updateMemberRole(member, e.target.value)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-2 py-1 text-xs text-white"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmRemove(member)}>
                    <X className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <InviteMemberDialog open={showInviteDialog} onClose={() => setShowInviteDialog(false)} onSuccess={() => loadOrganization(true)} />
      <ConfirmDialog
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        onConfirm={handleRemove}
        title="Remove Member"
        description={`Are you sure you want to remove ${confirmRemove?.user?.email}? They will lose access to this organization.`}
        confirmText="Remove"
        loading={removing}
      />
    </PageLayout>
  )
}
