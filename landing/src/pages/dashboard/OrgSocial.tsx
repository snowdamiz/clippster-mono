import { useState, useEffect, useRef } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { useAuth } from '@/hooks/useAuth'
import { useOAuthPopup } from '@/hooks/useOAuthPopup'
import { useToast } from '@/hooks/useToast'
import { listSocialAccounts, deleteSocialAccount, updateSocialAccount, refreshAccountToken, assignSocialAccount, unassignSocialAccount } from '@/services/socialAccountsApi'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import type { SocialAccount, OrganizationMember } from '@/types/organization'
import {
  Globe, Instagram, Youtube, Users, AlertTriangle, Zap, Link2,
  Plus, RefreshCw, Clock, MoreVertical, XCircle, CheckCircle,
  Trash2, X, Loader2, Search, Check
} from 'lucide-react'

/* ───── Helpers ───── */

function getPlatformGradient(platform: string) {
  if (platform === 'instagram') return 'from-purple-500 to-pink-500'
  if (platform === 'tiktok') return 'from-zinc-900 to-zinc-700'
  if (platform === 'youtube') return 'from-red-500 to-red-600'
  if (platform === 'twitter') return 'from-zinc-800 to-zinc-900'
  return 'from-cyan-500 to-cyan-700'
}

function getPlatformIcon(platform: string) {
  if (platform === 'instagram') return Instagram
  if (platform === 'twitter') return XIcon
  return Globe
}

function formatDate(dateStr: string): string {
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
  if (!account.token_expires_at) return false
  const expiresAt = new Date(account.token_expires_at)
  const daysUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return daysUntilExpiry < 7
}

/* ───── Account Actions ───── */

function AccountActions({ account, isAdmin, onManageAssignments, onRefreshToken, onToggleActive, onDisconnect }: {
  account: SocialAccount
  isAdmin: boolean
  onManageAssignments: (a: SocialAccount) => void
  onRefreshToken: (a: SocialAccount) => void
  onToggleActive: (a: SocialAccount, active: boolean) => void
  onDisconnect: (a: SocialAccount) => void
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

  if (!isAdmin) return null

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <button
        onClick={() => onManageAssignments(account)}
        className="flex items-center justify-center w-8 h-8 bg-transparent border border-zinc-800 rounded-lg text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:border-white/[0.15] hover:text-white"
        title="Manage assignments"
      >
        <Users className="w-4 h-4" />
      </button>
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className={`flex items-center justify-center w-8 h-8 bg-transparent border border-zinc-800 rounded-lg cursor-pointer transition-all duration-150 ${
            open ? 'bg-zinc-800 border-white/[0.15] text-white' : 'text-zinc-500 hover:bg-zinc-800 hover:border-white/[0.15] hover:text-white'
          }`}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
        {open && (
          <div className="absolute right-0 top-full mt-1 w-[180px] bg-zinc-900 backdrop-blur-xl border border-zinc-800 rounded-[10px] shadow-[0_10px_40px_rgba(0,0,0,0.4)] p-2 z-[9999]">
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 text-[0.8125rem] text-white bg-transparent border-none rounded-md cursor-pointer transition-all duration-150 text-left hover:bg-cyan-500/10 hover:text-cyan-400"
              onClick={() => { onRefreshToken(account); setOpen(false) }}
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh Token</span>
            </button>
            {account.is_active ? (
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 text-[0.8125rem] text-white bg-transparent border-none rounded-md cursor-pointer transition-all duration-150 text-left hover:bg-cyan-500/10 hover:text-cyan-400"
                onClick={() => { onToggleActive(account, false); setOpen(false) }}
              >
                <XCircle className="w-4 h-4" />
                <span>Deactivate</span>
              </button>
            ) : (
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 text-[0.8125rem] text-white bg-transparent border-none rounded-md cursor-pointer transition-all duration-150 text-left hover:bg-cyan-500/10 hover:text-cyan-400"
                onClick={() => { onToggleActive(account, true); setOpen(false) }}
              >
                <CheckCircle className="w-4 h-4" />
                <span>Activate</span>
              </button>
            )}
            <div className="my-2 border-t border-zinc-800" />
            <button
              className="w-full flex items-center gap-3 px-3 py-2.5 text-[0.8125rem] text-red-500 bg-transparent border-none rounded-md cursor-pointer transition-all duration-150 text-left hover:bg-red-500/10 hover:text-red-400"
              onClick={() => { onDisconnect(account); setOpen(false) }}
            >
              <Trash2 className="w-4 h-4" />
              <span>Disconnect</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* ───── Assignments Dialog ───── */

function AssignmentsDialog({ account, open, onClose, organizationId, members, onUpdated }: {
  account: SocialAccount
  open: boolean
  onClose: () => void
  organizationId: string | number
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
            <p className="text-sm font-medium text-white m-0">@{account.username}</p>
            <p className="text-xs text-zinc-500 m-0">Assign members who can use this account to publish posts</p>
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
              <p className="text-sm text-zinc-500 m-0">No members match your search</p>
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

/* ───── Delete Dialog ───── */

function DeleteAccountDialog({ account, open, onClose, onConfirm, loading }: {
  account: SocialAccount | null
  open: boolean
  onClose: () => void
  onConfirm: () => void
  loading: boolean
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape' && !loading) onClose() }
      document.addEventListener('keydown', handleEsc)
      return () => { document.removeEventListener('keydown', handleEsc); document.body.style.overflow = '' }
    } else {
      document.body.style.overflow = ''
    }
  }, [open, onClose, loading])

  if (!open || !account) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="relative w-full max-w-[400px] bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col max-h-[85vh]">
        {/* Accent bar */}
        <div className="h-[3px] shrink-0 bg-gradient-to-r from-red-500 to-red-400" />

        {/* Header */}
        <div className="relative flex flex-col items-center px-6 pt-6 pb-4 text-center">
          <button
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-md text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:text-white"
            onClick={onClose}
          >
            <X size={18} />
          </button>
          <div className="flex items-center justify-center w-[52px] h-[52px] rounded-xl mb-3.5 bg-red-500/15 text-red-500">
            <Trash2 size={24} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-[-0.02em] m-0">Disconnect Account</h2>
          <p className="text-[0.8125rem] text-zinc-500 mt-1">@{account.username}</p>
        </div>

        {/* Content */}
        <div className="px-6">
          <div className="flex items-start gap-3 px-4 py-3.5 bg-red-500/10 border border-red-500/20 rounded-lg">
            <AlertTriangle className="w-[18px] h-[18px] text-red-500 shrink-0 mt-0.5" />
            <p className="text-[0.8125rem] text-red-300 m-0 leading-relaxed">
              This will remove all member assignments. Any existing posts will remain but won't be synced.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2.5 px-6 py-5 border-t border-zinc-800 mt-4">
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg bg-zinc-800 text-white border border-zinc-800 cursor-pointer transition-all duration-150 hover:bg-zinc-700 hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold rounded-lg bg-gradient-to-br from-red-500 to-red-600 text-white border-none cursor-pointer transition-all duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onConfirm}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Disconnect Account
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───── TikTok SVG Icon ───── */

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className}>
      <defs>
        <linearGradient id="tiktok-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: '#25f4ee' }} />
          <stop offset="100%" style={{ stopColor: '#fe2c55' }} />
        </linearGradient>
      </defs>
      <path
        fill="url(#tiktok-gradient)"
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"
      />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

/* ───── Main Component ───── */

export function OrgSocial() {
  const { loadOrganization, organizationId, isAdmin, members } = useOrganization()
  const { token } = useAuth()
  const { openOAuth } = useOAuthPopup()
  const [accounts, setAccounts] = useState<SocialAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [connecting, setConnecting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SocialAccount | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [assignTarget, setAssignTarget] = useState<SocialAccount | null>(null)
  const toast = useToast()

  const loadAccounts = async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const result = await listSocialAccounts(organizationId, true)
      if (result.success) {
        setAccounts(result.accounts)
      } else {
        toast.error('Failed to load accounts')
      }
    } catch {
      toast.error('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrganization(); loadAccounts() }, [organizationId])

  const connectInstagram = () => {
    if (!organizationId || !token) return
    setConnecting(true)
    openOAuth('instagram', organizationId, token, (result) => {
      setConnecting(false)
      if (result.success) {
        toast.success(`Instagram account @${result.username} connected!`)
        loadAccounts()
        loadOrganization()
      } else {
        toast.error(result.error || 'Failed to connect Instagram')
      }
    })
  }

  const connectTwitter = () => {
    if (!organizationId || !token) return
    setConnecting(true)
    openOAuth('twitter', organizationId, token, (result) => {
      setConnecting(false)
      if (result.success) {
        toast.success(`X account @${result.username} connected!`)
        loadAccounts()
        loadOrganization()
      } else {
        toast.error(result.error || 'Failed to connect X')
      }
    })
  }

  const handleToggleActive = async (account: SocialAccount, active: boolean) => {
    if (!organizationId) return
    try {
      const result = await updateSocialAccount(organizationId, account.id, { is_active: active })
      if (result.success) {
        toast.success(`Account ${active ? 'activated' : 'deactivated'}`)
        loadAccounts()
      } else { toast.error(result.error || 'Failed to update account') }
    } catch { toast.error('Failed to update account') }
  }

  const handleRefreshToken = async (account: SocialAccount) => {
    if (!organizationId) return
    try {
      const result = await refreshAccountToken(organizationId, account.id)
      if (result.success) { toast.success('Token refresh initiated') }
      else { toast.error(result.error || 'Failed to refresh token') }
    } catch { toast.error('Failed to refresh token') }
  }

  const handleDelete = async () => {
    if (!deleteTarget || !organizationId) return
    setDeleting(true)
    try {
      const result = await deleteSocialAccount(organizationId, deleteTarget.id)
      if (result.success) {
        setAccounts(prev => prev.filter(a => a.id !== deleteTarget.id))
        setDeleteTarget(null)
        toast.success('Account disconnected')
        loadOrganization()
      } else {
        toast.error(result.error || 'Failed to disconnect account')
      }
    } catch {
      toast.error('Failed to disconnect account')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <PageLayout icon={Globe} title="Social Accounts">
      <div className="w-full flex flex-col gap-8 max-w-[1400px] mx-auto p-6">
        {/* Page Heading */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-white tracking-[-0.02em] m-0 mb-1.5">Social Accounts</h1>
          <p className="text-sm text-zinc-500 m-0 leading-relaxed">Connect and manage social media platforms for your organization</p>
        </div>

        {/* Quick Actions Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-amber-500/15 text-amber-500">
              <Zap className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-[1.0625rem] font-semibold text-white tracking-[-0.01em] m-0">Quick Actions</h2>
              <p className="text-xs text-zinc-500 mt-0.5 m-0">Connect new platforms to your organization</p>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-5 bg-zinc-900/50 border border-zinc-800 rounded-[10px]">
            {/* Instagram - Active */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white/[0.02] border border-white/[0.06] rounded-[10px] transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0" style={{ background: 'linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)' }}>
                  <Instagram className="w-[22px] h-[22px] text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[0.9375rem] font-semibold text-white m-0">Instagram</h3>
                  <p className="text-[0.8125rem] text-zinc-500 m-0 leading-[1.4]">Connect your Instagram Business or Creator account to publish Reels directly</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  className="flex items-center gap-2 h-10 px-5 bg-gradient-to-br from-cyan-400 to-cyan-600 text-black border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 shrink-0 hover:opacity-90 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                  onClick={connectInstagram}
                  disabled={connecting}
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {connecting ? 'Connecting...' : 'Connect Account'}
                </button>
              )}
            </div>

            {/* TikTok - Coming Soon */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white/[0.02] border border-white/[0.06] rounded-[10px] opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-black">
                  <TikTokIcon className="w-6 h-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[0.9375rem] font-semibold text-white m-0 flex items-center gap-2">
                    TikTok
                    <span className="text-[0.625rem] font-bold uppercase tracking-[0.05em] px-2 py-[3px] bg-purple-500/15 text-purple-400 rounded">Coming Soon</span>
                  </h3>
                  <p className="text-[0.8125rem] text-zinc-500 m-0 leading-[1.4]">Share your clips directly to TikTok</p>
                </div>
              </div>
            </div>

            {/* YouTube Shorts - Coming Soon */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white/[0.02] border border-white/[0.06] rounded-[10px] opacity-50">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-gradient-to-br from-red-500 to-red-700">
                  <Youtube className="w-[22px] h-[22px] text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[0.9375rem] font-semibold text-white m-0 flex items-center gap-2">
                    YouTube Shorts
                    <span className="text-[0.625rem] font-bold uppercase tracking-[0.05em] px-2 py-[3px] bg-purple-500/15 text-purple-400 rounded">Coming Soon</span>
                  </h3>
                  <p className="text-[0.8125rem] text-zinc-500 m-0 leading-[1.4]">Upload clips as YouTube Shorts automatically</p>
                </div>
              </div>
            </div>

            {/* X (Twitter) - Active */}
            <div className="flex items-center justify-between gap-4 px-5 py-4 bg-white/[0.02] border border-white/[0.06] rounded-[10px] transition-all duration-200 hover:border-white/[0.12] hover:bg-white/[0.04]">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-11 h-11 rounded-xl shrink-0 bg-black">
                  <XIcon className="w-[22px] h-[22px] text-white" />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-[0.9375rem] font-semibold text-white m-0">X (Twitter)</h3>
                  <p className="text-[0.8125rem] text-zinc-500 m-0 leading-[1.4]">Post your clips directly to X</p>
                </div>
              </div>
              {isAdmin && (
                <button
                  className="flex items-center gap-2 h-10 px-5 bg-gradient-to-br from-cyan-400 to-cyan-600 text-black border-none rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 shrink-0 hover:opacity-90 hover:-translate-y-px disabled:opacity-60 disabled:cursor-not-allowed disabled:translate-y-0"
                  onClick={connectTwitter}
                  disabled={connecting}
                >
                  {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {connecting ? 'Connecting...' : 'Connect Account'}
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Connected Accounts Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5 flex-wrap">
            <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-purple-500/15 text-purple-500">
              <Link2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h2 className="text-[1.0625rem] font-semibold text-white tracking-[-0.01em] m-0">Connected Accounts</h2>
              <p className="text-xs text-zinc-500 mt-0.5 m-0">Manage your linked social media platforms</p>
            </div>
            <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-semibold text-purple-500 bg-purple-500/15 rounded-full">
              {accounts.length}
            </span>
            <button
              className="flex items-center gap-2 h-9 px-4 bg-zinc-800 text-white border border-zinc-800 rounded-lg text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 ml-auto hover:bg-zinc-700 hover:border-white/[0.15] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={loadAccounts}
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Loading State */}
          {loading && accounts.length === 0 && (
            <div className="flex flex-col gap-2">
              {[1, 2].map(i => (
                <div key={i} className="flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden pointer-events-none">
                  <div className="w-[3px] shrink-0 bg-zinc-800" />
                  <div className="flex-1 flex items-center gap-4 p-3.5 px-4">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%] animate-shimmer shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-4 w-[120px] bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%] animate-shimmer rounded" style={{ animationDelay: '0.1s' }} />
                      <div className="h-3 w-[180px] bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%] animate-shimmer rounded" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <div className="flex gap-1.5">
                      <div className="w-8 h-8 bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%] animate-shimmer rounded-lg" style={{ animationDelay: '0.3s' }} />
                      <div className="w-8 h-8 bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%] animate-shimmer rounded-lg" style={{ animationDelay: '0.3s' }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && accounts.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-zinc-800 mb-5">
                <Globe className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white m-0 mb-2">No accounts connected</h3>
              <p className="text-sm text-zinc-500 m-0 mb-6 max-w-[340px]">
                Connect your social media accounts to start publishing clips directly from the platform
              </p>
            </div>
          )}

          {/* Accounts List */}
          {!loading && accounts.length > 0 && (
            <div className="flex flex-col gap-2">
              {accounts.map(account => {
                const PlatformIcon = getPlatformIcon(account.platform)
                const gradient = getPlatformGradient(account.platform)
                const expiring = isTokenExpiringSoon(account)

                const indicatorClass = !account.is_active
                  ? 'bg-gradient-to-b from-zinc-500 to-zinc-600'
                  : expiring
                    ? 'bg-gradient-to-b from-amber-500 to-amber-600'
                    : 'bg-gradient-to-b from-emerald-500 to-emerald-600'

                return (
                  <div
                    key={account.id}
                    className="flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden transition-all duration-200 hover:border-white/[0.12] hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
                  >
                    {/* Left color indicator */}
                    <div className={`w-[3px] shrink-0 ${indicatorClass}`} />

                    {/* Card content */}
                    <div className="flex-1 flex items-center gap-4 p-3.5 px-4">
                      {/* Avatar */}
                      <div className="relative w-14 h-14 shrink-0">
                        {account.profile_image_url ? (
                          <img src={account.profile_image_url} alt={account.username} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <div className={`w-full h-full rounded-full flex items-center justify-center bg-gradient-to-br ${gradient}`}>
                            <PlatformIcon className="w-6 h-6 text-white" />
                          </div>
                        )}
                        {/* Platform badge */}
                        <div className={`absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center ring-2 ring-zinc-900`}>
                          <PlatformIcon className="w-3 h-3 text-white" />
                        </div>
                      </div>

                      {/* Account info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[0.9375rem] font-semibold text-white">@{account.username}</span>
                          {!account.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded text-[0.625rem] font-bold uppercase tracking-wide bg-red-500/15 text-red-500">
                              Inactive
                            </span>
                          ) : expiring ? (
                            <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded text-[0.625rem] font-bold uppercase tracking-wide bg-amber-500/15 text-amber-500">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              Token Expiring
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-[3px] rounded text-[0.625rem] font-bold uppercase tracking-wide bg-emerald-500/15 text-emerald-500">
                              Active
                            </span>
                          )}
                        </div>
                        {account.display_name && (
                          <p className="text-[0.8125rem] text-zinc-500 m-0 mb-1.5 leading-[1.4]">{account.display_name}</p>
                        )}
                        <div className="flex items-center flex-wrap gap-3">
                          <span className="flex items-center gap-1 text-[0.6875rem] text-zinc-500">
                            <Clock className="w-3 h-3" />
                            Connected {formatDate(account.connected_at || account.inserted_at)}
                          </span>
                          {account.assignments && account.assignments.length > 0 && (
                            <span className="flex items-center gap-1 text-[0.6875rem] text-zinc-500">
                              <Users className="w-3 h-3" />
                              {account.assignments.length} member{account.assignments.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden md:flex items-center gap-6 px-6 border-l border-zinc-800 shrink-0">
                        <div className="flex flex-col items-center gap-0.5 min-w-[60px]">
                          <Users className="w-4 h-4 text-zinc-500 mb-0.5" />
                          <span className="text-base font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{account.assignments?.length || 0}</span>
                          <span className="text-[0.625rem] text-zinc-500 uppercase tracking-wide">Assigned</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <AccountActions
                        account={account}
                        isAdmin={!!isAdmin}
                        onManageAssignments={setAssignTarget}
                        onRefreshToken={handleRefreshToken}
                        onToggleActive={handleToggleActive}
                        onDisconnect={setDeleteTarget}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Assignments Dialog */}
      {assignTarget && (
        <AssignmentsDialog
          account={assignTarget}
          open={!!assignTarget}
          onClose={() => setAssignTarget(null)}
          organizationId={organizationId}
          members={members}
          onUpdated={loadAccounts}
        />
      )}

      {/* Delete Dialog */}
      <DeleteAccountDialog
        account={deleteTarget}
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />
    </PageLayout>
  )
}
