import { useState, useEffect, useRef } from 'react'
import { useOrganization } from '@/hooks/useOrganization'
import { useToast } from '@/hooks/useToast'
import { listSocialAccounts, deleteSocialAccount, updateSocialAccount, assignSocialAccount, unassignSocialAccount } from '@/services/socialAccountsApi'
import { isTokenExpiringSoonForAccount } from '@/utils/socialTokenExpiry'
import { useOAuthPopup } from '@/hooks/useOAuthPopup'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Dialog } from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import type { SocialAccount, OrganizationMember } from '@/types/organization'
import { Globe, Trash2, Instagram, MoreVertical, RefreshCw, XCircle, CheckCircle, Users, Plus, Search, Check } from 'lucide-react'

function getPlatformGradient(platform: string) {
  if (platform === 'instagram') return 'from-purple-500 to-pink-500'
  if (platform === 'tiktok') return 'from-zinc-900 to-zinc-700'
  if (platform === 'youtube') return 'from-red-500 to-red-600'
  if (platform === 'twitter') return 'from-zinc-800 to-zinc-900'
  return 'from-cyan-500 to-cyan-700'
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function getPlatformIcon(platform: string) {
  if (platform === 'instagram') return Instagram
  if (platform === 'twitter') return XIcon
  return Globe
}

function formatRelativeDate(dateStr: string | undefined): string {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return date.toLocaleDateString()
}

function isTokenExpiringSoon(account: SocialAccount): boolean {
  return isTokenExpiringSoonForAccount(account)
}

type ConnectPlatform = 'instagram' | 'tiktok' | 'YouTube' | 'x'

function reconnectPlatform(account: SocialAccount): ConnectPlatform {
  if (account.platform === 'instagram') return 'instagram'
  if (account.platform === 'tiktok') return 'tiktok'
  if (account.platform === 'youtube') return 'YouTube'
  return 'x'
}

function AccountActionsMenu({ account, onReconnect, onToggleActive, onDisconnect, onManageAssignments }: {
  account: SocialAccount
  onReconnect: (a: SocialAccount) => void
  onToggleActive: (a: SocialAccount, active: boolean) => void
  onDisconnect: (a: SocialAccount) => void
  onManageAssignments: (a: SocialAccount) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
      >
        <MoreVertical className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          <button
            onClick={() => { onManageAssignments(account); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <Users className="w-4 h-4" />
            Manage Access
          </button>
          <button
            onClick={() => { onReconnect(account); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Reconnect
          </button>
          {account.is_active ? (
            <button
              onClick={() => { onToggleActive(account, false); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Deactivate
            </button>
          ) : (
            <button
              onClick={() => { onToggleActive(account, true); setOpen(false) }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-white transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Activate
            </button>
          )}
          <div className="border-t border-zinc-700 my-1" />
          <button
            onClick={() => { onDisconnect(account); setOpen(false) }}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-400 hover:bg-zinc-700 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}

function AssignmentsDialog({ account, open, onClose, organizationId, members, onUpdated }: {
  account: SocialAccount
  open: boolean
  onClose: () => void
  organizationId: string
  members: OrganizationMember[]
  onUpdated: () => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [assignedIds, setAssignedIds] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (open && account.assignments) {
      setAssignedIds(new Set(account.assignments.map(a => a.user_id)))
    }
  }, [open, account])

  const filteredMembers = members.filter(m => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (m.user?.name?.toLowerCase().includes(q) || m.user?.email.toLowerCase().includes(q))
  })

  const toggleAssignment = async (userId: number, assign: boolean) => {
    setSaving(true)
    try {
      if (assign) {
        const res = await assignSocialAccount(organizationId, account.id, [userId])
        if (res.success) {
          setAssignedIds(prev => new Set([...prev, userId]))
          toast.success('Member assigned')
          onUpdated()
        } else { toast.error(res.error || 'Failed to assign') }
      } else {
        const res = await unassignSocialAccount(organizationId, account.id, userId)
        if (res.success) {
          setAssignedIds(prev => { const s = new Set(prev); s.delete(userId); return s })
          toast.success('Member unassigned')
          onUpdated()
        } else { toast.error(res.error || 'Failed to unassign') }
      }
    } catch { toast.error('Failed to update assignment') }
    finally { setSaving(false) }
  }

  const getInitials = (name: string) =>
    name.split(/[\s@]+/).map(p => p[0]).slice(0, 2).join('').toUpperCase()

  return (
    <Dialog open={open} onClose={onClose} title="Manage Access" maxWidth="max-w-lg">
      <div className="space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-zinc-800">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-gradient-to-br ${getPlatformGradient(account.platform)}/20 border border-white/10`}>
            {(() => { const Icon = getPlatformIcon(account.platform); return <Icon className="w-5 h-5 text-white" /> })()}
          </div>
          <div>
            <p className="text-sm font-medium text-white">@{account.username}</p>
            <p className="text-xs text-zinc-500">Assign members who can use this account to publish posts</p>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search members..."
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-900/80 border border-zinc-800 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 transition-all text-sm"
          />
        </div>

        <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
          {filteredMembers.map(member => {
            const assigned = assignedIds.has(member.user_id)
            return (
              <button
                key={member.user_id}
                onClick={() => toggleAssignment(member.user_id, !assigned)}
                disabled={saving}
                className={`flex items-center gap-3 w-full p-3 rounded-xl border transition-colors text-left ${saving ? 'opacity-50 pointer-events-none' : ''} ${assigned ? 'border-zinc-700 bg-zinc-800/30' : 'border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700'}`}
              >
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${assigned ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-transparent' : 'border-zinc-600'}`}>
                  {assigned && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="w-9 h-9 rounded-full bg-zinc-800 flex items-center justify-center shrink-0 border border-zinc-700 overflow-hidden">
                  {member.user?.avatar_url ? (
                    <img src={member.user.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-medium text-zinc-400">{getInitials(member.user?.name || member.user?.email || '')}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{member.user?.name || member.user?.email}</div>
                  {member.user?.name && <div className="text-xs text-zinc-500 truncate">{member.user.email}</div>}
                </div>
                <Badge variant={member.role === 'owner' ? 'owner' : member.role === 'admin' ? 'admin' : 'member'}>{member.role}</Badge>
              </button>
            )
          })}
          {filteredMembers.length === 0 && searchQuery && (
            <div className="text-center py-8">
              <Search className="w-5 h-5 text-zinc-500 mx-auto mb-2" />
              <p className="text-sm text-zinc-500">No members match your search</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-3 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-pink-500" />
            <span className="text-sm text-zinc-400">{assignedIds.size} member{assignedIds.size !== 1 ? 's' : ''} assigned</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    </Dialog>
  )
}

export function SocialAccountsManager() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<SocialAccount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [assignTarget, setAssignTarget] = useState<SocialAccount | null>(null)
  const { organizationId, isAdmin, members } = useOrganization()
  const { openOAuth } = useOAuthPopup()
  const toast = useToast()

  const load = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const result = await listSocialAccounts(organizationId, true)
      if (result.success) setAccounts(result.accounts)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [organizationId])

  const handleDelete = async () => {
    if (!deleteTarget || !organizationId) return
    setDeleting(true)
    try {
      const result = await deleteSocialAccount(organizationId, deleteTarget.id)
      if (result.success) {
        setAccounts(prev => prev.filter(a => a.id !== deleteTarget.id))
        toast.success('Account disconnected')
      }
    } finally { setDeleting(false); setDeleteTarget(null) }
  }

  const handleToggleActive = async (account: SocialAccount, active: boolean) => {
    if (!organizationId) return
    try {
      const result = await updateSocialAccount(organizationId, account.id, { is_active: active })
      if (result.success) {
        toast.success(`Account ${active ? 'activated' : 'deactivated'}`)
        load()
      } else { toast.error(result.error || 'Failed to update account') }
    } catch { toast.error('Failed to update account') }
  }

  const handleReconnect = (account: SocialAccount) => {
    if (!organizationId) return
    const platform = reconnectPlatform(account)
    openOAuth(platform, organizationId, (result) => {
      if (result.success) {
        toast.success(`${account.platform} reconnected`)
        load()
      } else if (result.error) {
        toast.error(result.error)
      }
    })
  }

  if (loading) return (
    <div className="p-6 space-y-3 max-w-[1400px] mx-auto w-full">
      {[1, 2].map(i => (
        <div key={i} className="py-4 px-5 bg-zinc-800/20 border border-zinc-800/30 rounded-[10px] animate-pulse">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-zinc-800/50" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-zinc-800/50 rounded" />
              <div className="h-3 w-48 bg-zinc-800/50 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )

  if (accounts.length === 0) return (
    <EmptyState
      icon={Globe}
      title="No Accounts Connected"
      description="Connect your social media accounts to start publishing clips directly"
      action={isAdmin && <Button onClick={() => toast.info('Go to the Social Accounts page to connect accounts')}><Plus className="w-4 h-4" /> Connect Account</Button>}
    />
  )

  return (
    <>
      <div className="p-6 space-y-3 max-w-[1400px] mx-auto w-full">
        {accounts.map(account => {
          const PlatformIcon = getPlatformIcon(account.platform)
          const gradient = getPlatformGradient(account.platform)
          return (
            <div key={account.id} className="py-4 px-5 bg-zinc-900/50 border border-zinc-800 rounded-[10px] hover:border-white/[0.12] transition-all hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)]">
              <div className="flex items-center gap-4">
                {/* Avatar with platform badge */}
                <div className="relative shrink-0">
                  {account.profile_image_url ? (
                    <img src={account.profile_image_url} alt={account.username} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                      <PlatformIcon className="w-6 h-6 text-white" />
                    </div>
                  )}
                  <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center ring-2 ring-zinc-900`}>
                    <PlatformIcon className="w-3 h-3 text-white" />
                  </div>
                </div>

                {/* Account info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">@{account.username}</span>
                    {!account.is_active && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-500/20 text-red-400">Disconnected</span>
                    )}
                    {account.is_active && isTokenExpiringSoon(account) && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/20 text-amber-400">Reconnect soon</span>
                    )}
                  </div>
                  <div className="text-sm text-zinc-500">{account.display_name || account.username}</div>
                  <div className="text-xs text-zinc-600 mt-0.5">
                    Connected {formatRelativeDate(account.inserted_at)}
                    {account.assignments && account.assignments.length > 0 && (
                      <> · {account.assignments.length} member{account.assignments.length !== 1 ? 's' : ''} assigned</>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {isAdmin && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => setAssignTarget(account)}
                      className="p-2 rounded-lg hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors"
                      title="Manage assignments"
                    >
                      <Users className="w-4 h-4" />
                    </button>
                    <AccountActionsMenu
                      account={account}
                      onReconnect={handleReconnect}
                      onToggleActive={handleToggleActive}
                      onDisconnect={setDeleteTarget}
                      onManageAssignments={setAssignTarget}
                    />
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Assignments Dialog */}
      {assignTarget && (
        <AssignmentsDialog
          account={assignTarget}
          open={!!assignTarget}
          onClose={() => setAssignTarget(null)}
          organizationId={organizationId}
          members={members}
          onUpdated={load}
        />
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Disconnect Account"
        description={`Are you sure you want to disconnect @${deleteTarget?.username}? This will remove all member assignments. Any existing posts will remain but won't be synced.`}
        confirmText="Disconnect"
        loading={deleting}
      />
    </>
  )
}
