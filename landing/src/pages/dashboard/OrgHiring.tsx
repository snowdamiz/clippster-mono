import { useEffect, useState, useCallback } from 'react'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { useToast } from '@/hooks/useToast'
import {
  getOrgHiringPost,
  saveOrgHiringPost,
  deleteOrgHiringPost,
  listHiringApplications,
  acceptHiringApplication,
  rejectHiringApplication,
  PAYMENT_TYPES,
  getPaymentTypeLabel,
  type HiringPost,
  type HiringApplication,
  type HiringPostFormData
} from '@/services/hiringApi'
import {
  SPECIALTY_TAGS,
  PREFERRED_PLATFORMS,
  LANGUAGES,
  EXPERIENCE_LEVELS,
  getExperienceLevelLabel,
  getSpecialtyTagLabel
} from '@/services/clipperApi'
import {
  Briefcase,
  Loader2,
  Plus,
  Pencil,
  Pause,
  Play,
  Trash2,
  Video,
  Star,
  DollarSign,
  UserCircle,
  CheckCircle,
  X,
  RefreshCw,
  FileText,
  UserCheck,
  MessageCircle
} from 'lucide-react'

function getPlatformLabel(value: string): string {
  return PREFERRED_PLATFORMS.find((p) => p.value === value)?.label || value
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString()
}

function toggleArrayItem(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value]
}

const EMPTY_FORM: HiringPostFormData = {
  title: '',
  description: '',
  content_types: [],
  languages: [],
  platforms: [],
  payment_type: '',
  payment_details: '',
  streamer_count: undefined,
  clipper_slots: undefined,
  experience_level: '',
  status: 'active',
  is_public: true
}

export function OrgHiring() {
  const { organizationId } = useOrganization()
  const toast = useToast()

  const [loadingPost, setLoadingPost] = useState(true)
  const [hiringPost, setHiringPost] = useState<HiringPost | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<HiringPostFormData>({ ...EMPTY_FORM })

  const [applications, setApplications] = useState<HiringApplication[]>([])
  const [loadingApps, setLoadingApps] = useState(false)

  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const [showAcceptDialog, setShowAcceptDialog] = useState(false)
  const [acceptTarget, setAcceptTarget] = useState<HiringApplication | null>(null)
  const [accepting, setAccepting] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState<number | null>(null)

  const loadPost = useCallback(async () => {
    if (!organizationId) return
    setLoadingPost(true)
    try {
      const res = await getOrgHiringPost(organizationId)
      if (res.success) setHiringPost(res.hiring_post)
    } catch (err) {
      console.error('Failed to load hiring post:', err)
    } finally {
      setLoadingPost(false)
    }
  }, [organizationId])

  const loadApplications = useCallback(async () => {
    if (!organizationId) return
    setLoadingApps(true)
    try {
      const res = await listHiringApplications(organizationId)
      if (res.success) setApplications(res.applications)
    } catch (err) {
      console.error('Failed to load applications:', err)
    } finally {
      setLoadingApps(false)
    }
  }, [organizationId])

  useEffect(() => {
    loadPost()
  }, [loadPost])
  useEffect(() => {
    if (hiringPost) loadApplications()
  }, [hiringPost?.id])

  function startEdit() {
    if (!hiringPost) return
    setForm({
      title: hiringPost.title,
      description: hiringPost.description || '',
      content_types: [...(hiringPost.content_types || [])],
      languages: [...(hiringPost.languages || [])],
      platforms: [...(hiringPost.platforms || [])],
      payment_type: hiringPost.payment_type || '',
      payment_details: hiringPost.payment_details || '',
      streamer_count: hiringPost.streamer_count || undefined,
      clipper_slots: hiringPost.clipper_slots || undefined,
      experience_level: hiringPost.experience_level || '',
      status: hiringPost.status,
      is_public: hiringPost.is_public
    })
    setShowForm(true)
  }

  async function savePost() {
    if (!organizationId) return
    setSaving(true)
    try {
      const res = await saveOrgHiringPost(organizationId, form)
      if (res.success) {
        setHiringPost(res.hiring_post)
        setShowForm(false)
        toast.success('Post saved', 'Your hiring post has been saved.')
      } else {
        toast.error('Error', res.error || 'Failed to save')
      }
    } catch (err: any) {
      toast.error('Error', err.message || 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function togglePause() {
    if (!hiringPost || !organizationId) return
    const newStatus = hiringPost.status === 'active' ? 'paused' : 'active'
    setSaving(true)
    try {
      const res = await saveOrgHiringPost(organizationId, { title: hiringPost.title, status: newStatus })
      if (res.success) {
        setHiringPost(res.hiring_post)
        toast.success(`Post ${newStatus}`)
      }
    } finally {
      setSaving(false)
    }
  }

  async function deletePost() {
    if (!organizationId) return
    setDeleting(true)
    try {
      const res = await deleteOrgHiringPost(organizationId)
      if (res.success) {
        setHiringPost(null)
        setApplications([])
        setShowDeleteDialog(false)
        toast.success('Post deleted')
      }
    } finally {
      setDeleting(false)
    }
  }

  function handleAccept(app: HiringApplication) {
    setAcceptTarget(app)
    setShowAcceptDialog(true)
  }

  async function confirmAccept() {
    if (!acceptTarget || !organizationId) return
    setAccepting(acceptTarget.id)
    try {
      const res = await acceptHiringApplication(organizationId, acceptTarget.id)
      if (res.success) {
        toast.success('Clipper hired!', 'They have been added to your organization.')
        setShowAcceptDialog(false)
        await loadApplications()
        await loadPost()
      } else {
        toast.error('Error', res.error || 'Failed to accept')
      }
    } finally {
      setAccepting(null)
    }
  }

  async function handleReject(app: HiringApplication) {
    if (!organizationId) return
    setRejecting(app.id)
    try {
      const res = await rejectHiringApplication(organizationId, app.id)
      if (res.success) {
        toast.success('Application rejected')
        await loadApplications()
      }
    } finally {
      setRejecting(null)
    }
  }

  function updateForm(patch: Partial<HiringPostFormData>) {
    setForm((prev) => ({ ...prev, ...patch }))
  }

  const pendingCount = applications.filter((a) => a.status === 'pending').length

  const postStatusLabel = !hiringPost ? '—' : hiringPost.status.charAt(0).toUpperCase() + hiringPost.status.slice(1)
  const postStatusColor = !hiringPost
    ? 'text-zinc-500'
    : hiringPost.status === 'active'
      ? 'text-green-500'
      : hiringPost.status === 'paused'
        ? 'text-yellow-500'
        : 'text-zinc-500'

  function StatsHeader() {
    return (
      <>
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-white tracking-tight m-0">Hiring Management</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Create a hiring post, review applications, and recruit clippers to your organization
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Post Status */}
          <div className="relative flex bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-white/10 hover:shadow-lg transition-all">
            <div className="w-1 shrink-0 bg-gradient-to-b from-orange-400 to-orange-600" />
            <div className="flex-1 flex items-center gap-4 px-5 py-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-orange-500/15 text-orange-400 shrink-0">
                <Briefcase className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white m-0 tracking-tight">Post Status</h3>
                <p className="text-[0.6875rem] text-zinc-500 mt-0.5 truncate">
                  {hiringPost ? hiringPost.title : 'No active post'}
                </p>
              </div>
              <span className={`text-[1.75rem] font-bold tracking-tight tabular-nums shrink-0 ${postStatusColor}`}>
                {postStatusLabel}
              </span>
            </div>
          </div>
          {/* Applicants */}
          <div className="relative flex bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-white/10 hover:shadow-lg transition-all">
            <div className="w-1 shrink-0 bg-gradient-to-b from-violet-400 to-violet-600" />
            <div className="flex-1 flex items-center gap-4 px-5 py-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-violet-500/15 text-violet-400 shrink-0">
                <FileText className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white m-0 tracking-tight">Applicants</h3>
                <p className="text-[0.6875rem] text-zinc-500 mt-0.5">{pendingCount} pending review</p>
              </div>
              <span className="text-[1.75rem] font-bold tracking-tight tabular-nums shrink-0 text-violet-400">
                {applications.length}
              </span>
            </div>
          </div>
          {/* Slots Filled */}
          <div className="relative flex bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-white/10 hover:shadow-lg transition-all">
            <div className="w-1 shrink-0 bg-gradient-to-b from-emerald-400 to-emerald-600" />
            <div className="flex-1 flex items-center gap-4 px-5 py-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-emerald-500/15 text-emerald-400 shrink-0">
                <UserCheck className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-sm font-semibold text-white m-0 tracking-tight">Slots Filled</h3>
                <p className="text-[0.6875rem] text-zinc-500 mt-0.5">
                  {hiringPost?.clipper_slots
                    ? `${hiringPost.clipper_slots - (hiringPost.clipper_slots_filled || 0)} remaining`
                    : 'No limit set'}
                </p>
              </div>
              <span className="text-[1.75rem] font-bold tracking-tight tabular-nums shrink-0 text-emerald-400">
                {hiringPost
                  ? `${hiringPost.clipper_slots_filled || 0}${hiringPost.clipper_slots ? '/' + hiringPost.clipper_slots : ''}`
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ===== Render =====

  if (loadingPost) {
    return (
      <PageLayout icon={Briefcase} title="Hiring">
        <StatsHeader />
        <div className="flex items-center justify-center gap-2 py-16 text-zinc-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading hiring post...</span>
        </div>
      </PageLayout>
    )
  }

  // Empty state
  if (!hiringPost && !showForm) {
    return (
      <PageLayout icon={Briefcase} title="Hiring">
        <StatsHeader />
        <div className="flex flex-col items-center justify-center text-center py-16 px-8">
          <div className="flex items-center justify-center w-[72px] h-[72px] rounded-2xl bg-orange-500/10 mb-6">
            <Briefcase className="w-9 h-9 text-orange-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">No hiring post yet</h3>
          <p className="text-sm text-zinc-500 mb-6 max-w-[320px]">
            Create a hiring post to let clippers know you're looking for talent
          </p>
          <button
            onClick={() => {
              setForm({ ...EMPTY_FORM })
              setShowForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold border-none cursor-pointer hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            Create Hiring Post
          </button>
        </div>
      </PageLayout>
    )
  }

  // Form view
  if (showForm) {
    return (
      <PageLayout icon={Briefcase} title="Hiring">
        <StatsHeader />
        <div className="max-w-[800px] mx-auto p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-white m-0">{hiringPost ? 'Edit' : 'Create'} Hiring Post</h2>
            {hiringPost && (
              <button
                onClick={() => setShowForm(false)}
                className="px-3 py-1.5 rounded-md border border-zinc-700 bg-transparent text-zinc-400 text-[0.8125rem] cursor-pointer hover:text-white hover:border-zinc-600 transition-all"
              >
                Cancel
              </button>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              savePost()
            }}
            className="flex flex-col gap-6"
          >
            <div className="grid grid-cols-2 gap-4">
              {/* Title */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Title *</label>
                <input
                  value={form.title}
                  onChange={(e) => updateForm({ title: e.target.value })}
                  required
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm outline-none focus:border-cyan-400 transition-colors"
                  placeholder="e.g. Looking for Gaming Clippers"
                />
              </div>

              {/* Description */}
              <div className="col-span-2 flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Description</label>
                <textarea
                  value={form.description || ''}
                  onChange={(e) => updateForm({ description: e.target.value })}
                  rows={4}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm outline-none focus:border-cyan-400 transition-colors resize-y min-h-[80px] font-[inherit]"
                  placeholder="Describe what you're looking for..."
                />
              </div>

              {/* Content Types */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Content Types</label>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALTY_TAGS.map((tag) => (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() =>
                        updateForm({ content_types: toggleArrayItem(form.content_types || [], tag.value) })
                      }
                      className={`px-2.5 py-1 rounded-full border text-xs cursor-pointer transition-all ${
                        (form.content_types || []).includes(tag.value)
                          ? 'bg-cyan-400/15 border-cyan-400 text-cyan-400'
                          : 'border-zinc-700 bg-transparent text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Platforms */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Platforms</label>
                <div className="flex flex-wrap gap-1.5">
                  {PREFERRED_PLATFORMS.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => updateForm({ platforms: toggleArrayItem(form.platforms || [], p.value) })}
                      className={`px-2.5 py-1 rounded-full border text-xs cursor-pointer transition-all ${
                        (form.platforms || []).includes(p.value)
                          ? 'bg-cyan-400/15 border-cyan-400 text-cyan-400'
                          : 'border-zinc-700 bg-transparent text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Languages */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Languages</label>
                <div className="flex flex-wrap gap-1.5">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => updateForm({ languages: toggleArrayItem(form.languages || [], lang.code) })}
                      className={`px-2.5 py-1 rounded-full border text-xs cursor-pointer transition-all ${
                        (form.languages || []).includes(lang.code)
                          ? 'bg-cyan-400/15 border-cyan-400 text-cyan-400'
                          : 'border-zinc-700 bg-transparent text-zinc-400 hover:border-zinc-500'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment Type */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Payment Type</label>
                <select
                  value={form.payment_type || ''}
                  onChange={(e) => updateForm({ payment_type: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm outline-none focus:border-cyan-400 cursor-pointer appearance-none"
                >
                  <option value="">Select...</option>
                  {PAYMENT_TYPES.map((pt) => (
                    <option key={pt.value} value={pt.value}>
                      {pt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Details */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Payment Details</label>
                <input
                  value={form.payment_details || ''}
                  onChange={(e) => updateForm({ payment_details: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm outline-none focus:border-cyan-400 transition-colors"
                  placeholder="e.g. $5 CPM or $50/video"
                />
              </div>

              {/* Experience Level */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Minimum Experience
                </label>
                <select
                  value={form.experience_level || ''}
                  onChange={(e) => updateForm({ experience_level: e.target.value })}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm outline-none focus:border-cyan-400 cursor-pointer appearance-none"
                >
                  <option value="">Any</option>
                  {EXPERIENCE_LEVELS.map((lvl) => (
                    <option key={lvl.value} value={lvl.value}>
                      {lvl.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Streamer Count */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Number of Streamers
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.streamer_count ?? ''}
                  onChange={(e) => updateForm({ streamer_count: e.target.value ? Number(e.target.value) : undefined })}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm outline-none focus:border-cyan-400 transition-colors"
                  placeholder="e.g. 5"
                />
              </div>

              {/* Clipper Slots */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Clippers Needed</label>
                <input
                  type="number"
                  min={1}
                  value={form.clipper_slots ?? ''}
                  onChange={(e) => updateForm({ clipper_slots: e.target.value ? Number(e.target.value) : undefined })}
                  className="px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-900 text-white text-sm outline-none focus:border-cyan-400 transition-colors"
                  placeholder="e.g. 10"
                />
              </div>

              {/* Public Toggle */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Visibility</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => updateForm({ is_public: !form.is_public })}
                    className={`relative w-9 h-5 rounded-full border-none cursor-pointer transition-colors ${form.is_public ? 'bg-cyan-400' : 'bg-zinc-700'}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${form.is_public ? 'translate-x-4' : ''}`}
                    />
                  </button>
                  <span className="text-[0.8125rem] text-zinc-400">
                    {form.is_public ? 'Visible to all clippers' : 'Hidden from directory'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {!hiringPost && (
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-700 bg-transparent text-zinc-400 text-sm font-semibold cursor-pointer hover:text-white transition-colors"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-cyan-400 text-[#0a0a0b] text-sm font-semibold border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {hiringPost ? 'Save Changes' : 'Create Post'}
              </button>
            </div>
          </form>
        </div>
      </PageLayout>
    )
  }

  // Post view
  return (
    <PageLayout icon={Briefcase} title="Hiring">
      <StatsHeader />
      {hiringPost && (
        <>
          {/* Post Card (Campaign-style, no banner) */}
          <div className="flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden max-w-[420px]">
            <div className="flex flex-col gap-3.5 p-4 flex-1">
              {/* Title + Badges */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-semibold text-white m-0 leading-tight">{hiringPost.title}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-[5px] text-[0.625rem] font-bold uppercase tracking-wider backdrop-blur-sm shadow-sm ${
                      hiringPost.status === 'active'
                        ? 'bg-emerald-500/95 text-white'
                        : hiringPost.status === 'paused'
                          ? 'bg-amber-500/95 text-white'
                          : 'bg-zinc-500/90 text-white'
                    }`}
                  >
                    {hiringPost.status}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-[5px] text-[0.625rem] font-bold uppercase tracking-wider ${
                      hiringPost.is_public ? 'bg-blue-500/15 text-blue-400' : 'bg-zinc-500/15 text-zinc-400'
                    }`}
                  >
                    {hiringPost.is_public ? 'Public' : 'Hidden'}
                  </span>
                </div>
                {hiringPost.description && (
                  <p className="text-[0.8125rem] text-zinc-400 m-0 leading-relaxed line-clamp-2">
                    {hiringPost.description}
                  </p>
                )}

                {/* Meta */}
                <div className="flex items-center flex-wrap gap-2.5">
                  {hiringPost.payment_type && (
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <DollarSign className="w-3 h-3" />
                      {getPaymentTypeLabel(hiringPost.payment_type)}
                      {hiringPost.payment_details ? ` — ${hiringPost.payment_details}` : ''}
                    </span>
                  )}
                  {hiringPost.experience_level && (
                    <span className="flex items-center gap-1 text-xs text-zinc-400">
                      <Star className="w-3 h-3" />
                      {getExperienceLevelLabel(hiringPost.experience_level)}
                    </span>
                  )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  {(hiringPost.content_types || []).slice(0, 4).map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[0.6875rem] bg-white/[0.06] text-zinc-400">
                      {getSpecialtyTagLabel(t)}
                    </span>
                  ))}
                  {(hiringPost.platforms || []).slice(0, 3).map((p) => (
                    <span key={p} className="px-2 py-0.5 rounded-full text-[0.6875rem] bg-cyan-400/10 text-cyan-400">
                      {getPlatformLabel(p)}
                    </span>
                  ))}
                </div>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 bg-zinc-800/50 rounded-lg overflow-hidden">
                <div className="flex flex-col items-center justify-center gap-0.5 py-3 px-2 text-center border-r border-zinc-700/50">
                  <span className="text-[0.9375rem] font-bold text-white tabular-nums leading-tight">
                    {hiringPost.clipper_slots_filled || 0}
                    {hiringPost.clipper_slots ? '/' + hiringPost.clipper_slots : ''}
                  </span>
                  <span className="text-[0.5625rem] text-zinc-400 uppercase tracking-wider font-medium">
                    slots filled
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5 py-3 px-2 text-center border-r border-zinc-700/50">
                  <span className="text-[0.9375rem] font-bold text-white tabular-nums leading-tight">
                    {applications.length}
                  </span>
                  <span className="text-[0.5625rem] text-zinc-400 uppercase tracking-wider font-medium">
                    applicants
                  </span>
                </div>
                <div className="flex flex-col items-center justify-center gap-0.5 py-3 px-2 text-center">
                  <span className="text-[0.9375rem] font-bold text-white tabular-nums leading-tight">
                    {hiringPost.streamer_count || 0}
                  </span>
                  <span className="text-[0.5625rem] text-zinc-400 uppercase tracking-wider font-medium">streamers</span>
                </div>
              </div>

              {/* Slots Progress */}
              {hiringPost.clipper_slots && (
                <div className="flex flex-col gap-1.5">
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-zinc-700/50">
                    <div
                      className={`h-full rounded-full transition-all duration-400 ${
                        (hiringPost.clipper_slots_filled || 0) / hiringPost.clipper_slots >= 0.8
                          ? 'bg-gradient-to-r from-red-500 to-red-600'
                          : (hiringPost.clipper_slots_filled || 0) / hiringPost.clipper_slots >= 0.5
                            ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                            : 'bg-gradient-to-r from-emerald-500 to-emerald-600'
                      }`}
                      style={{
                        width: `${Math.min(100, ((hiringPost.clipper_slots_filled || 0) / hiringPost.clipper_slots) * 100)}%`
                      }}
                    />
                  </div>
                  <span className="text-xs text-zinc-400 text-center tabular-nums font-medium">
                    {hiringPost.clipper_slots_filled || 0} / {hiringPost.clipper_slots} slots filled
                  </span>
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-center gap-2 pt-3 mt-auto border-t border-zinc-700/50">
                <button
                  onClick={startEdit}
                  title="Edit"
                  className="flex items-center justify-center flex-1 h-[34px] max-w-[100px] bg-transparent border border-zinc-700 rounded-lg text-zinc-400 cursor-pointer transition-all hover:bg-zinc-800 hover:border-cyan-400 hover:text-cyan-400"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={togglePause}
                  title={hiringPost.status === 'active' ? 'Pause' : 'Activate'}
                  className="flex items-center justify-center flex-1 h-[34px] max-w-[100px] bg-transparent border border-zinc-700 rounded-lg text-zinc-400 cursor-pointer transition-all hover:bg-zinc-800 hover:border-cyan-400 hover:text-cyan-400"
                >
                  {hiringPost.status === 'active' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <button
                  onClick={() => setShowDeleteDialog(true)}
                  title="Delete"
                  className="flex items-center justify-center flex-1 h-[34px] max-w-[100px] bg-transparent border border-zinc-700 rounded-lg text-zinc-400 cursor-pointer transition-all hover:bg-zinc-800 hover:border-red-500 hover:text-red-500"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Applications */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-white m-0 flex items-center gap-2">
                Applications
                {applications.length > 0 && (
                  <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-cyan-400/15 text-cyan-400 text-[0.6875rem] font-bold">
                    {applications.length}
                  </span>
                )}
              </h3>
              <button
                onClick={loadApplications}
                disabled={loadingApps}
                className="p-1.5 rounded-md border border-zinc-700 bg-transparent text-zinc-400 cursor-pointer hover:text-white hover:bg-zinc-800 transition-colors disabled:opacity-50"
              >
                {loadingApps ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              </button>
            </div>

            {loadingApps && !applications.length ? (
              <div className="flex items-center justify-center py-8 text-zinc-500 text-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
              </div>
            ) : !applications.length ? (
              <p className="text-center py-8 text-zinc-500 text-sm">
                No applications yet. Clippers will appear here when they apply.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {applications.map((app) => (
                  <div
                    key={app.id}
                    className="flex flex-col bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden transition-all hover:border-white/15 hover:shadow-lg hover:shadow-black/20"
                  >
                    {/* Status Bar */}
                    <div className="flex items-center justify-between px-4 py-2 bg-gradient-to-r from-black/20 to-black/10 border-b border-zinc-800">
                      <span
                        className={`flex items-center gap-1.5 px-2.5 py-0.5 text-[0.6875rem] font-semibold uppercase tracking-wider rounded-full ${
                          app.status === 'pending'
                            ? 'bg-gradient-to-r from-yellow-500/20 to-yellow-500/10 text-yellow-500'
                            : app.status === 'accepted'
                              ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-500/10 text-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.15)]'
                              : 'bg-gradient-to-r from-red-500/20 to-red-500/10 text-red-500'
                        }`}
                      >
                        {app.status}
                      </span>
                      <span className="text-[0.6875rem] text-zinc-500">Applied {formatDate(app.inserted_at)}</span>
                    </div>

                    {/* Main Content */}
                    {app.clipper_profile?.slug ? (
                      <a
                        href={`/clippers/${app.clipper_profile.slug}`}
                        className="flex flex-col gap-3.5 p-4 no-underline text-inherit transition-colors hover:bg-white/[0.02]"
                      >
                        <div className="flex gap-3.5">
                          <div className="w-[52px] h-[52px] rounded-[10px] overflow-hidden shrink-0 bg-zinc-800">
                            {app.clipper_profile?.avatar_url ? (
                              <img src={app.clipper_profile.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <UserCircle className="w-full h-full text-zinc-600 opacity-60" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 text-[0.9375rem] font-semibold text-white mb-0.5">
                              {app.clipper_profile?.display_name || app.user?.name || app.user?.email || 'Unknown'}
                              {app.clipper_profile?.is_verified && (
                                <CheckCircle className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                              )}
                            </div>
                            {app.clipper_profile?.experience_level && (
                              <div className="text-[0.6875rem] font-medium text-cyan-400 uppercase tracking-wider mb-1.5">
                                {getExperienceLevelLabel(app.clipper_profile.experience_level)}
                              </div>
                            )}
                            {app.message && (
                              <p className="text-[0.8125rem] text-zinc-400 m-0 leading-relaxed line-clamp-2">
                                {app.message}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Stats Row */}
                        {app.clipper_profile && (
                          <div className="flex items-center gap-4 px-3 py-2.5 bg-black/15 rounded-lg">
                            <span className="flex items-center gap-1">
                              <Video className="w-[13px] h-[13px] text-zinc-400 opacity-70" />
                              <span className="text-[0.8125rem] font-semibold text-white">
                                {app.clipper_profile.total_clips_delivered || 0}
                              </span>
                              <span className="text-[0.6875rem] text-zinc-400">clips</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Star className="w-[13px] h-[13px] text-yellow-500" />
                              <span className="text-[0.8125rem] font-semibold text-white">
                                {app.clipper_profile.total_endorsements || 0}
                              </span>
                              <span className="text-[0.6875rem] text-zinc-400">reviews</span>
                            </span>
                            <span className="flex items-center gap-1">
                              <Briefcase className="w-[13px] h-[13px] text-cyan-400 opacity-80" />
                              <span className="text-[0.8125rem] font-semibold text-white">
                                {app.clipper_profile.total_campaigns_completed || 0}
                              </span>
                              <span className="text-[0.6875rem] text-zinc-400">campaigns</span>
                            </span>
                          </div>
                        )}

                        {/* Tags */}
                        {app.clipper_profile?.specialty_tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {app.clipper_profile.specialty_tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full text-[0.6875rem] bg-white/[0.06] text-zinc-400 border border-zinc-700/50"
                              >
                                {getSpecialtyTagLabel(tag)}
                              </span>
                            ))}
                            {app.clipper_profile.specialty_tags.length > 3 && (
                              <span className="text-[0.6875rem] text-zinc-400 font-semibold ml-0.5">
                                +{app.clipper_profile.specialty_tags.length - 3}
                              </span>
                            )}
                          </div>
                        )}
                      </a>
                    ) : (
                      <div className="flex flex-col gap-3.5 p-4">
                        <div className="flex gap-3.5">
                          <div className="w-[52px] h-[52px] rounded-[10px] overflow-hidden shrink-0 bg-zinc-800">
                            <UserCircle className="w-full h-full text-zinc-600 opacity-60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[0.9375rem] font-semibold text-white mb-0.5">
                              {app.user?.name || app.user?.email || 'Unknown'}
                            </div>
                            {app.message && (
                              <p className="text-[0.8125rem] text-zinc-400 m-0 leading-relaxed line-clamp-2">
                                {app.message}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 px-4 py-3 border-t border-zinc-800">
                      {app.clipper_profile?.user_id && (
                        <a
                          href={`/dashboard/org/${organizationId}/messages?to=${app.clipper_profile.user_id}`}
                          className="flex items-center justify-center gap-1.5 flex-1 h-[34px] bg-transparent border border-zinc-700 rounded-lg text-zinc-400 text-xs font-semibold no-underline cursor-pointer transition-all hover:bg-zinc-800 hover:border-cyan-400 hover:text-cyan-400"
                        >
                          <MessageCircle className="w-3.5 h-3.5" /> Message
                        </a>
                      )}
                      {app.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleAccept(app)}
                            disabled={accepting === app.id}
                            className="flex items-center justify-center gap-1.5 flex-1 h-[34px] bg-transparent border border-emerald-500/30 rounded-lg text-emerald-500 text-xs font-semibold cursor-pointer transition-all hover:bg-emerald-500/10 hover:border-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {accepting === app.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3.5 h-3.5" />
                            )}{' '}
                            Hire
                          </button>
                          <button
                            onClick={() => handleReject(app)}
                            disabled={rejecting === app.id}
                            className="flex items-center justify-center gap-1.5 flex-1 h-[34px] bg-transparent border border-red-500/20 rounded-lg text-red-500 text-xs font-semibold cursor-pointer transition-all hover:bg-red-500/10 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {rejecting === app.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <X className="w-3.5 h-3.5" />
                            )}{' '}
                            Reject
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowDeleteDialog(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-[420px] w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white m-0 mb-2">Delete Hiring Post</h3>
            <p className="text-sm text-zinc-400 m-0 mb-6">
              This will permanently delete your hiring post and all applications. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteDialog(false)}
                className="px-4 py-2 rounded-md border border-zinc-700 bg-transparent text-zinc-400 text-sm font-semibold cursor-pointer hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={deletePost}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-red-500 text-white text-sm font-semibold border-none cursor-pointer hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />} Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Accept Confirmation Dialog */}
      {showAcceptDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowAcceptDialog(false)}
        >
          <div
            className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-[420px] w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-white m-0 mb-2">Hire Clipper</h3>
            <p className="text-sm text-zinc-400 m-0 mb-6">
              This will accept{' '}
              {acceptTarget?.clipper_profile?.display_name || acceptTarget?.user?.name || 'this clipper'}'s application
              and automatically add them as a member of your organization.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowAcceptDialog(false)}
                className="px-4 py-2 rounded-md border border-zinc-700 bg-transparent text-zinc-400 text-sm font-semibold cursor-pointer hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmAccept}
                disabled={accepting !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-cyan-400 text-[#0a0a0b] text-sm font-semibold border-none cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {accepting !== null && <Loader2 className="w-4 h-4 animate-spin" />} Confirm Hire
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
