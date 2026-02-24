import { useEffect, useState, useRef, useMemo } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Dialog } from '@/components/ui/Dialog'
import { ShareClipDialog } from '@/components/organization/ShareClipDialog'
import { listOrganizationSharedClips, deleteSharedClip, getExpirationBadgeColor, getExpirationText } from '@/services/sharedClipsApi'
import { useToast } from '@/hooks/useToast'
import { formatRelativeTime } from '@/utils/dateTimeUtils'
import type { SharedClip } from '@/types/organization'
import {
  Film, Eye, Download, Send, Filter, Share2, Plus, RefreshCw,
  Users, UserCheck, Shield, ShieldOff, Clock, User, Calendar,
  HardDrive, BarChart3, MoreVertical, Trash2, AlertCircle, X,
  Loader2, ChevronDown
} from 'lucide-react'

/* ───── Helpers ───── */

function formatFileSize(bytes: number | null): string {
  if (!bytes) return 'Unknown'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--:--'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/* ───── Filter Dropdown ───── */

function FilterDropdown({ options, value, onChange }: {
  options: { value: string; label: string; icon?: React.ReactNode; dot?: string }[]
  value: string
  onChange: (value: string) => void
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

  const selected = options.find(o => o.value === value)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between gap-2 min-w-[130px] h-9 px-3 bg-white/[0.04] text-white border rounded-md text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 ${
          open ? 'bg-white/[0.08] border-cyan-400' : 'border-white/[0.08] hover:bg-white/[0.08] hover:border-white/[0.12]'
        }`}
      >
        <span>{selected?.label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 min-w-[160px] max-h-80 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-lg p-1 z-[100] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false) }}
              className={`flex items-center gap-2 w-full px-3 py-2 rounded-[5px] text-[0.8125rem] cursor-pointer transition-colors border-none ${
                value === opt.value
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-white hover:bg-zinc-800 bg-transparent'
              }`}
            >
              {opt.dot && <span className={`w-2 h-2 rounded-full shrink-0 ${opt.dot}`} />}
              {opt.icon}
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ───── Clip Actions ───── */

function ClipActions({ clip, isAdmin, onDelete, onViewStats }: {
  clip: SharedClip
  isAdmin: boolean
  onDelete: (clip: SharedClip) => void
  onViewStats: (clip: SharedClip) => void
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
    <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
      <button
        onClick={e => { e.stopPropagation(); onViewStats(clip) }}
        className="flex items-center justify-center w-8 h-8 bg-transparent border border-zinc-800 rounded-lg text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:border-white/[0.15] hover:text-white"
        title="View Stats"
      >
        <BarChart3 className="w-4 h-4" />
      </button>
      {isAdmin && (
        <div ref={ref} className="relative">
          <button
            onClick={e => { e.stopPropagation(); setOpen(!open) }}
            className={`flex items-center justify-center w-8 h-8 bg-transparent border border-zinc-800 rounded-lg cursor-pointer transition-all duration-150 ${
              open ? 'bg-zinc-800 border-white/[0.15] text-white' : 'text-zinc-500 hover:bg-zinc-800 hover:border-white/[0.15] hover:text-white'
            }`}
          >
            <MoreVertical className="w-4 h-4" />
          </button>
          {open && (
            <div
              className="absolute right-0 top-full mt-1 w-[180px] bg-zinc-900 backdrop-blur-xl border border-zinc-800 rounded-[10px] shadow-[0_10px_40px_rgba(0,0,0,0.4)] p-2 z-[9999]"
              onClick={e => e.stopPropagation()}
            >
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 text-[0.8125rem] text-white bg-transparent border-none rounded-md cursor-pointer transition-all duration-150 text-left hover:bg-cyan-500/10 hover:text-cyan-400"
                onClick={e => { e.stopPropagation(); onViewStats(clip); setOpen(false) }}
              >
                <BarChart3 className="w-4 h-4" />
                <span>View Stats</span>
              </button>
              <div className="my-2 border-t border-zinc-800" />
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 text-[0.8125rem] text-red-500 bg-transparent border-none rounded-md cursor-pointer transition-all duration-150 text-left hover:bg-red-500/10 hover:text-red-400"
                onClick={e => { e.stopPropagation(); onDelete(clip); setOpen(false) }}
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Clip</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ───── Delete Dialog ───── */

function DeleteClipDialog({ clip, open, onClose, onConfirm, loading }: {
  clip: SharedClip | null
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

  if (!open || !clip) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => !loading && onClose()} />
      <div className="relative w-full max-w-[420px] bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)] flex flex-col max-h-[85vh]">
        {/* Accent bar */}
        <div className="h-[3px] shrink-0 bg-gradient-to-r from-red-500 to-red-500/50" />

        {/* Header */}
        <div className="relative flex flex-col items-center px-6 pt-6 pb-4 text-center">
          <button
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-md text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={onClose}
            disabled={loading}
          >
            <X size={18} />
          </button>
          <div className="flex items-center justify-center w-[52px] h-[52px] rounded-xl mb-3.5 bg-red-500/15 text-red-500">
            <Trash2 size={24} />
          </div>
          <h2 className="text-xl font-bold text-white tracking-[-0.02em] m-0">Delete Shared Clip</h2>
          <p className="text-[0.8125rem] text-zinc-500 mt-1">This action cannot be undone</p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6">
          <div className="flex items-center gap-3.5 p-3.5 bg-zinc-800 rounded-[10px] mb-4">
            <div className="w-16 h-12 rounded-md overflow-hidden shrink-0 bg-zinc-900">
              {clip.thumbnail_url ? (
                <img src={clip.thumbnail_url} alt={clip.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/15 to-zinc-900">
                  <Film className="w-5 h-5 text-zinc-500 opacity-60" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-1">
              <span className="text-sm font-semibold text-white truncate">{clip.name}</span>
              <span className="text-xs text-zinc-500">
                {formatFileSize(clip.file_size)} &bull; {formatDuration(clip.duration)}
              </span>
            </div>
          </div>

          <p className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-[0.8125rem] text-red-400 m-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            This will remove the clip from all members and cannot be undone.
          </p>
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
            {loading ? 'Deleting...' : 'Delete Clip'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ───── Main Component ───── */

export function OrgShared() {
  const { loadOrganization, organizationId, isAdmin } = useOrganization()
  const [clips, setClips] = useState<SharedClip[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<SharedClip | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [previewClip, setPreviewClip] = useState<SharedClip | null>(null)
  const [downloading, setDownloading] = useState<number | null>(null)
  const toast = useToast()

  // Filters
  const [expirationFilter, setExpirationFilter] = useState('all')
  const [sharingFilter, setSharingFilter] = useState('all')
  const [brandingFilter, setBrandingFilter] = useState('all')

  const loadClips = async () => {
    if (!organizationId) return
    setLoading(true)
    setError(null)
    try {
      const result = await listOrganizationSharedClips(organizationId)
      if (result.success) {
        setClips(result.clips)
      } else {
        setError(result.error || 'Failed to load shared clips')
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load shared clips')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadOrganization(); loadClips() }, [organizationId])

  // Filtered + sorted clips
  const filteredClips = useMemo(() => {
    let result = [...clips]

    if (expirationFilter === 'active') result = result.filter(c => c.days_until_expiration >= 5)
    else if (expirationFilter === 'expiring') result = result.filter(c => c.days_until_expiration >= 2 && c.days_until_expiration < 5)
    else if (expirationFilter === 'urgent') result = result.filter(c => c.days_until_expiration < 2)

    if (sharingFilter === 'everyone') result = result.filter(c => c.share_with_all)
    else if (sharingFilter === 'specific') result = result.filter(c => !c.share_with_all)

    if (brandingFilter === 'required') result = result.filter(c => c.branding_required)
    else if (brandingFilter === 'optional') result = result.filter(c => !c.branding_required)

    return result.sort((a, b) => new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime())
  }, [clips, expirationFilter, sharingFilter, brandingFilter])

  const handleDelete = async () => {
    if (!deleteTarget || !organizationId) return
    setDeleting(true)
    try {
      const result = await deleteSharedClip(organizationId, deleteTarget.id)
      if (result.success) {
        setClips(prev => prev.filter(c => c.id !== deleteTarget.id))
        setDeleteTarget(null)
        toast.success('Clip deleted successfully')
      } else {
        toast.error(result.error || 'Failed to delete clip')
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete clip')
    } finally {
      setDeleting(false)
    }
  }

  const handleDownload = async (clip: SharedClip) => {
    if (!clip.url) return
    setDownloading(clip.id)
    try {
      const res = await fetch(clip.url)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${clip.name}.mp4`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Download failed')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <PageLayout
      icon={Share2}
      title="Shared Clips"
      actions={isAdmin && (
        <button
          className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-cyan-400 text-[#0a0a0b] border-none cursor-pointer transition-opacity duration-150 hover:opacity-90"
          onClick={() => setShowShareDialog(true)}
        >
          <Plus className="w-3.5 h-3.5" />
          Share Clip
        </button>
      )}
    >
      <div className="w-full flex flex-col gap-8 max-w-[1400px] mx-auto p-6">
        {/* Page Heading */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-white tracking-[-0.02em] m-0 mb-1.5">Clip Distribution</h1>
          <p className="text-sm text-zinc-500 m-0 leading-relaxed">Manage and track video clips shared with your team members</p>
        </div>

        {/* Filters Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-cyan-500/15 text-cyan-400">
              <Filter className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-[1.0625rem] font-semibold text-white tracking-[-0.01em] m-0">Filters</h2>
              <p className="text-xs text-zinc-500 mt-0.5 m-0">Refine your shared clips view</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 p-4 px-5 bg-zinc-900/50 border border-zinc-800 rounded-[10px]">
            <FilterDropdown
              value={expirationFilter}
              onChange={setExpirationFilter}
              options={[
                { value: 'all', label: 'All Clips' },
                { value: 'active', label: 'Active (5+ days)', dot: 'bg-emerald-500' },
                { value: 'expiring', label: 'Expiring Soon', dot: 'bg-amber-500' },
                { value: 'urgent', label: 'Urgent (<2 days)', dot: 'bg-red-500' },
              ]}
            />
            <FilterDropdown
              value={sharingFilter}
              onChange={setSharingFilter}
              options={[
                { value: 'all', label: 'All Sharing' },
                { value: 'everyone', label: 'All Members', icon: <Users className="w-3.5 h-3.5 shrink-0 text-zinc-500" /> },
                { value: 'specific', label: 'Specific Members', icon: <UserCheck className="w-3.5 h-3.5 shrink-0 text-zinc-500" /> },
              ]}
            />
            <FilterDropdown
              value={brandingFilter}
              onChange={setBrandingFilter}
              options={[
                { value: 'all', label: 'All Branding' },
                { value: 'required', label: 'Branding Required', icon: <Shield className="w-3.5 h-3.5 shrink-0 text-zinc-500" /> },
                { value: 'optional', label: 'Branding Optional', icon: <ShieldOff className="w-3.5 h-3.5 shrink-0 text-zinc-500" /> },
              ]}
            />
            <div className="flex-1" />
            <button
              className="flex items-center gap-2 h-9 px-4 bg-zinc-800 text-white border border-zinc-800 rounded-lg text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-zinc-700 hover:border-white/[0.15] disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={loadClips}
              disabled={loading}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </section>

        {/* Shared Content Section */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-3.5">
            <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-purple-500/15 text-purple-500">
              <Share2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h2 className="text-[1.0625rem] font-semibold text-white tracking-[-0.01em] m-0">Shared Content</h2>
              <p className="text-xs text-zinc-500 mt-0.5 m-0">Video clips distributed to team members</p>
            </div>
            <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-semibold text-purple-500 bg-purple-500/15 rounded-full">
              {filteredClips.length}
            </span>
          </div>

          {/* Loading State */}
          {loading && clips.length === 0 && (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden pointer-events-none">
                  <div className="w-[3px] shrink-0 bg-zinc-800" />
                  <div className="flex-1 flex items-center gap-4 p-3.5 px-4">
                    <div className="w-[100px] h-[72px] rounded-lg bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%] animate-shimmer" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-4 w-[60%] bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%] animate-shimmer rounded" style={{ animationDelay: '0.1s' }} />
                      <div className="h-3 w-[40%] bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%] animate-shimmer rounded" style={{ animationDelay: '0.2s' }} />
                    </div>
                    <div className="hidden lg:flex gap-5 pl-5 border-l border-zinc-800">
                      {[1, 2, 3].map(j => (
                        <div key={j} className="w-10 h-9 bg-gradient-to-r from-white/10 via-white/20 to-white/10 bg-[length:200%_100%] animate-shimmer rounded-md" style={{ animationDelay: '0.3s' }} />
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error State */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-zinc-900/50 border border-red-500/30 rounded-xl">
              <div className="flex items-center justify-center w-[72px] h-[72px] bg-gradient-to-br from-red-500/15 to-zinc-800 rounded-[20px] mb-6">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-semibold text-white m-0 mb-2">Failed to load clips</h3>
              <p className="text-sm text-red-400 m-0 mb-6 max-w-[320px]">{error}</p>
              <button
                className="py-3 px-5 bg-zinc-800 text-white border border-zinc-800 rounded-lg text-sm font-semibold cursor-pointer transition-all duration-150 hover:bg-zinc-700 hover:border-white/[0.15]"
                onClick={loadClips}
              >
                Try Again
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredClips.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-zinc-800 mb-5">
                <Share2 className="w-8 h-8 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-white m-0 mb-2">No shared clips yet</h3>
              <p className="text-sm text-zinc-500 m-0 mb-6 max-w-[320px]">
                {isAdmin
                  ? 'Share a video clip with your organization members to get started'
                  : 'No clips have been shared with you yet'
                }
              </p>
            </div>
          )}

          {/* Clips List */}
          {!loading && !error && filteredClips.length > 0 && (
            <div className="flex flex-col gap-2">
              {filteredClips.map(clip => {
                const indicatorClass = clip.days_until_expiration >= 5
                  ? 'bg-gradient-to-b from-emerald-500 to-emerald-600'
                  : clip.days_until_expiration >= 2
                    ? 'bg-gradient-to-b from-amber-500 to-amber-600'
                    : 'bg-gradient-to-b from-red-500 to-red-600'

                const expirationBadgeClass = clip.days_until_expiration >= 5
                  ? 'bg-emerald-500/90'
                  : clip.days_until_expiration >= 2
                    ? 'bg-amber-500/90'
                    : 'bg-red-500/90'

                return (
                  <div
                    key={clip.id}
                    className="flex bg-zinc-900/50 border border-zinc-800 rounded-[10px] overflow-hidden transition-all duration-200 cursor-pointer hover:border-white/[0.12] hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)]"
                    onClick={() => setPreviewClip(clip)}
                  >
                    {/* Left color indicator */}
                    <div className={`w-[3px] shrink-0 ${indicatorClass}`} />

                    {/* Card content */}
                    <div className="flex-1 flex items-center gap-4 p-3.5 px-4">
                      {/* Thumbnail */}
                      <div className="relative w-[100px] h-[72px] rounded-lg overflow-hidden shrink-0 bg-zinc-800">
                        {clip.thumbnail_url ? (
                          <img src={clip.thumbnail_url} alt={clip.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500/15 to-zinc-800">
                            <Film className="w-6 h-6 text-zinc-500 opacity-60" />
                          </div>
                        )}
                        {/* Duration badge */}
                        {clip.duration && (
                          <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded-[3px] text-[0.625rem] font-semibold bg-black/75 text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>
                            {formatDuration(clip.duration)}
                          </span>
                        )}
                        {/* Expiration badge */}
                        <span className={`absolute top-1 left-1 flex items-center gap-1 px-[7px] py-[3px] rounded text-[0.5625rem] font-bold uppercase tracking-wide backdrop-blur-sm ${expirationBadgeClass} text-white`}>
                          <Clock className="w-2.5 h-2.5" />
                          {getExpirationText(clip.days_until_expiration)}
                        </span>
                      </div>

                      {/* Clip info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {/* Sharing indicator */}
                          {clip.share_with_all ? (
                            <div className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] bg-purple-500/20 text-purple-500">
                              <Users className="w-3 h-3" />
                            </div>
                          ) : (
                            <div className="flex items-center justify-center w-[22px] h-[22px] rounded-[5px] bg-cyan-500/20 text-cyan-400">
                              <UserCheck className="w-3 h-3" />
                            </div>
                          )}
                          {/* Name */}
                          <span className="text-sm font-semibold text-white truncate">{clip.name}</span>
                          {/* Branding badge */}
                          {clip.branding_required && (
                            <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/15 text-amber-500 rounded text-[0.625rem] font-semibold uppercase shrink-0">
                              <Shield className="w-2.5 h-2.5" />
                              Branding
                            </span>
                          )}
                        </div>
                        {/* Description */}
                        {clip.description && (
                          <p className="text-[0.8125rem] text-zinc-500 m-0 mb-2 leading-[1.4] line-clamp-2">{clip.description}</p>
                        )}
                        {/* Meta */}
                        <div className="flex items-center flex-wrap gap-3">
                          {clip.uploaded_by && (
                            <span className="flex items-center gap-1 text-[0.6875rem] text-zinc-500">
                              <User className="w-3 h-3" />
                              {clip.uploaded_by.name || clip.uploaded_by.email}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[0.6875rem] text-zinc-500">
                            <Calendar className="w-3 h-3" />
                            {formatRelativeTime(clip.inserted_at)}
                          </span>
                          <span className="flex items-center gap-1 text-[0.6875rem] text-zinc-500">
                            <HardDrive className="w-3 h-3" />
                            {formatFileSize(clip.file_size)}
                          </span>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="hidden lg:flex items-center gap-5 px-5 border-l border-zinc-800 shrink-0">
                        <div className="flex flex-col items-center gap-0.5 min-w-[50px]">
                          <Eye className="w-3.5 h-3.5 text-zinc-500 mb-0.5" />
                          <span className="text-[0.9375rem] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{clip.stats?.viewed || 0}</span>
                          <span className="text-[0.5625rem] text-zinc-500 uppercase tracking-wide">Viewed</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5 min-w-[50px]">
                          <Download className="w-3.5 h-3.5 text-zinc-500 mb-0.5" />
                          <span className="text-[0.9375rem] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{clip.stats?.downloaded || 0}</span>
                          <span className="text-[0.5625rem] text-zinc-500 uppercase tracking-wide">Downloads</span>
                        </div>
                        <div className="flex flex-col items-center gap-0.5 min-w-[50px]">
                          <Send className="w-3.5 h-3.5 text-zinc-500 mb-0.5" />
                          <span className="text-[0.9375rem] font-bold text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{clip.stats?.posted || 0}</span>
                          <span className="text-[0.5625rem] text-zinc-500 uppercase tracking-wide">Posted</span>
                        </div>
                      </div>

                      {/* Actions */}
                      <ClipActions
                        clip={clip}
                        isAdmin={!!isAdmin}
                        onDelete={setDeleteTarget}
                        onViewStats={(c) => console.log('View stats:', c)}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* Delete Dialog */}
      <DeleteClipDialog
        clip={deleteTarget}
        open={!!deleteTarget}
        onClose={() => !deleting && setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
      />

      {/* Video Preview Dialog */}
      {previewClip && (
        <Dialog open={!!previewClip} onClose={() => setPreviewClip(null)} title={previewClip.name} maxWidth="max-w-4xl">
          <div className="space-y-4">
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              {previewClip.url ? (
                <video src={previewClip.url} controls autoPlay className="w-full h-full" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-sm">No video URL available</div>
              )}
            </div>
            {previewClip.description && (
              <p className="text-sm text-zinc-400">{previewClip.description}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-zinc-500">
              <span>{formatFileSize(previewClip.file_size)}</span>
              <span>{formatDuration(previewClip.duration)}</span>
              <Badge variant={getExpirationBadgeColor(previewClip.days_until_expiration) === 'green' ? 'success' : getExpirationBadgeColor(previewClip.days_until_expiration) === 'yellow' ? 'warning' : 'danger'}>
                {getExpirationText(previewClip.days_until_expiration)}
              </Badge>
            </div>
            {previewClip.branding_required && (
              <div className="p-3 bg-zinc-800/50 rounded-lg">
                <p className="text-sm text-zinc-400 m-0">
                  <strong className="text-zinc-300">Note:</strong> This clip has mandatory branding. When exported, the organization's watermark, intro, and/or outro will be automatically applied.
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setPreviewClip(null)}>Close</Button>
              <Button onClick={() => handleDownload(previewClip)} loading={downloading === previewClip.id} disabled={!previewClip.url}>
                <Download className="w-4 h-4" />
                Download
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      <ShareClipDialog open={showShareDialog} onClose={() => setShowShareDialog(false)} onSuccess={loadClips} />
    </PageLayout>
  )
}
