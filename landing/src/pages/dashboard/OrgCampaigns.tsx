import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { useToast } from '@/hooks/useToast'
import { formatDate } from '@/utils/dateTimeUtils'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  listOrganizationCampaigns,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  pauseCampaign,
  activateCampaign,
  completeCampaign,
  uploadCampaignCoverImage,
  setCampaignCreatorProfiles,
  listCampaignParticipants,
  approveParticipant,
  rejectParticipant,
  listOrganizationCampaignSubmissions,
  verifySubmission,
  rejectSubmission
} from '@/services/campaignApi'
import type { Campaign } from '@/types/organization'
import {
  Megaphone,
  Plus,
  DollarSign,
  Wallet,
  Users,
  Eye,
  Pencil,
  MoreVertical,
  Play,
  Pause,
  CheckCircle,
  Trash2,
  Loader2,
  User,
  Check,
  X,
  Calendar,
  Globe,
  Clock,
  Upload,
  Film,
  UserCheck,
  ShieldCheck,
  ExternalLink,
  AlertTriangle
} from 'lucide-react'

function formatCpm(cpm: string | number) {
  const v = typeof cpm === 'string' ? parseFloat(cpm) : cpm
  return isNaN(v) ? '0.00' : v.toFixed(2)
}
function formatViews(views: number) {
  if (views >= 1000000) return `${(views / 1000000).toFixed(0)}M`
  if (views >= 1000) return `${(views / 1000).toFixed(0)}K`
  return views.toString()
}
function formatBudget(budget: string | number) {
  const v = typeof budget === 'string' ? parseFloat(budget) : budget
  if (isNaN(v)) return '0'
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
  return v.toFixed(0)
}
function getDaysRemaining(campaign: Campaign): number | null {
  if (!campaign.ends_at) return null
  const diff = Math.ceil((new Date(campaign.ends_at).getTime() - Date.now()) / 86400000)
  return diff >= 0 ? diff : 0
}
function getBudgetPercentage(campaign: Campaign): number {
  const budget = parseFloat(campaign.budget || '0')
  const spent = parseFloat(campaign.spent || '0')
  return budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
}
function getPlatformDisplayName(p: string) {
  return { tiktok: 'TikTok', instagram: 'Instagram', x: 'X (Twitter)', youtube: 'YouTube' }[p] || p
}
function getPlatformClass(p: string) {
  return (
    {
      tiktok: 'cp-platform--tiktok',
      instagram: 'cp-platform--instagram',
      x: 'cp-platform--x',
      twitter: 'cp-platform--x',
      youtube: 'cp-platform--youtube'
    }[p] || ''
  )
}

const AVAILABLE_PLATFORMS = [
  { label: 'TikTok', value: 'tiktok' },
  { label: 'Instagram', value: 'instagram' },
  { label: 'X (Twitter)', value: 'x' },
  { label: 'YouTube', value: 'youtube' }
]
const AVAILABLE_PAYMENT_METHODS = [
  { label: 'PayPal', value: 'paypal' },
  { label: 'Crypto', value: 'crypto' },
  { label: 'CashApp', value: 'cashapp' },
  { label: 'Venmo', value: 'venmo' }
]
const CPM_VIEWS_OPTIONS = [
  { label: '500 views', value: 500 },
  { label: '1,000 views', value: 1000 },
  { label: '5,000 views', value: 5000 },
  { label: '10,000 views', value: 10000 },
  { label: '100,000 views', value: 100000 }
]

interface CampaignForm {
  title: string
  description: string
  cpm: number
  cpm_views: number
  budget: number
  min_views_for_payment: number
  join_type: 'open' | 'application_required'
  allowed_platforms: string[]
  payment_methods: string[]
  cover_image_url: string
  starts_at: string
  ends_at: string
}

const emptyForm = (): CampaignForm => ({
  title: '',
  description: '',
  cpm: 0,
  cpm_views: 1000,
  budget: 0,
  min_views_for_payment: 1000,
  join_type: 'open',
  allowed_platforms: [],
  payment_methods: [],
  cover_image_url: '',
  starts_at: '',
  ends_at: ''
})

export function OrgCampaigns() {
  const { organizationId, isAdmin, creatorProfiles, loadCreatorProfiles } = useOrganization()
  const navigate = useNavigate()
  const toast = useToast()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  // Wizard state
  const [showWizard, setShowWizard] = useState(false)
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null)
  const [currentStep, setCurrentStep] = useState(1)
  const [form, setForm] = useState<CampaignForm>(emptyForm())
  const [saving, setSaving] = useState(false)
  const [selectedCreatorProfileIds, setSelectedCreatorProfileIds] = useState<number[]>([])
  const [coverImagePreview, setCoverImagePreview] = useState('')
  const [uploadingCoverImage, setUploadingCoverImage] = useState(false)
  const coverImageInputRef = useRef<HTMLInputElement>(null)
  const [wizardError, setWizardError] = useState<string | null>(null)

  // Detail dialog
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [detailTab, setDetailTab] = useState<'overview' | 'participants' | 'submissions'>('overview')
  const [participants, setParticipants] = useState<any[]>([])
  const [submissions, setSubmissions] = useState<any[]>([])
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [loadingSubmissions, setLoadingSubmissions] = useState(false)

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [campaignToDelete, setCampaignToDelete] = useState<Campaign | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Card menu
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const menuBtnRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  const totalSteps = 7

  const loadCampaigns = useCallback(async () => {
    if (!organizationId) return
    setLoading(true)
    try {
      const result = await listOrganizationCampaigns(Number(organizationId))
      if (result.success) setCampaigns(result.campaigns || [])
    } finally {
      setLoading(false)
    }
  }, [organizationId])

  useEffect(() => {
    loadCampaigns()
  }, [loadCampaigns])

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (openMenuId !== null) {
        const btn = menuBtnRefs.current.get(openMenuId)
        if (btn && btn.contains(e.target as Node)) return
        setOpenMenuId(null)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [openMenuId])

  // Stats
  const totalBudget = useMemo(() => campaigns.reduce((s, c) => s + parseFloat(c.budget || '0'), 0), [campaigns])
  const totalParticipants = useMemo(() => campaigns.reduce((s, c) => s + (c.participants_count || 0), 0), [campaigns])
  const activeCampaigns = useMemo(() => campaigns.filter((c) => c.status === 'active').length, [campaigns])

  function getMenuPosition(id: number): React.CSSProperties {
    const btn = menuBtnRefs.current.get(id)
    if (!btn) return { top: 0, left: 0 }
    const rect = btn.getBoundingClientRect()
    const mw = 180
    const mh = 200
    const pad = 8
    let top = rect.bottom + pad
    let left = rect.right - mw
    if (top + mh > window.innerHeight - pad) top = rect.top - mh - pad
    if (left < pad) left = pad
    return { top, left }
  }

  // Wizard
  function openCreateWizard() {
    setEditingCampaign(null)
    setForm(emptyForm())
    setCurrentStep(1)
    setSelectedCreatorProfileIds([])
    setCoverImagePreview('')
    setWizardError(null)
    setShowWizard(true)
    loadCreatorProfiles()
  }
  function openEditWizard(campaign: Campaign) {
    setEditingCampaign(campaign)
    setForm({
      title: campaign.title,
      description: campaign.description || '',
      cpm: parseFloat(campaign.cpm || '0'),
      cpm_views: campaign.cpm_views || 1000,
      budget: parseFloat(campaign.budget || '0'),
      min_views_for_payment: campaign.min_views_for_payment || 1000,
      join_type: campaign.join_type || 'open',
      allowed_platforms: campaign.allowed_platforms || [],
      payment_methods: campaign.payment_methods || [],
      cover_image_url: campaign.cover_image_url || '',
      starts_at: campaign.starts_at || '',
      ends_at: campaign.ends_at || ''
    })
    setSelectedCreatorProfileIds(campaign.creator_profiles?.map((p) => p.id) || [])
    setCoverImagePreview('')
    setWizardError(null)
    setShowWizard(true)
    loadCreatorProfiles()
  }

  const canProceed = currentStep === 1 ? form.title.trim().length >= 2 : true

  async function saveWizardCampaign() {
    if (!organizationId) return
    setSaving(true)
    setWizardError(null)
    try {
      const data: any = {
        title: form.title,
        description: form.description || undefined,
        cpm: String(form.cpm),
        cpm_views: form.cpm_views,
        budget: String(form.budget),
        min_views_for_payment: form.min_views_for_payment,
        join_type: form.join_type,
        allowed_platforms: form.allowed_platforms,
        payment_methods: form.payment_methods,
        cover_image_url: form.cover_image_url || undefined,
        starts_at: form.starts_at || undefined,
        ends_at: form.ends_at || undefined,
        status: editingCampaign ? undefined : 'draft'
      }
      const result = editingCampaign
        ? await updateCampaign(Number(organizationId), editingCampaign.id, data)
        : await createCampaign(Number(organizationId), data)
      if (result.success) {
        const cid = editingCampaign?.id || result.campaign?.id
        if (cid && selectedCreatorProfileIds.length > 0) {
          await setCampaignCreatorProfiles(Number(organizationId), cid, selectedCreatorProfileIds)
        }
        toast.success(editingCampaign ? 'Campaign updated' : 'Campaign created')
        setShowWizard(false)
        loadCampaigns()
      } else {
        setWizardError(result.error || 'Failed to save campaign')
      }
    } catch (err: any) {
      setWizardError(err.message || 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  function togglePlatform(p: string) {
    setForm((f) => ({
      ...f,
      allowed_platforms: f.allowed_platforms.includes(p)
        ? f.allowed_platforms.filter((x) => x !== p)
        : [...f.allowed_platforms, p]
    }))
  }
  function togglePaymentMethod(m: string) {
    setForm((f) => ({
      ...f,
      payment_methods: f.payment_methods.includes(m)
        ? f.payment_methods.filter((x) => x !== m)
        : [...f.payment_methods, m]
    }))
  }
  function toggleCreatorProfile(id: number) {
    setSelectedCreatorProfileIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleCoverImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !organizationId) return
    setUploadingCoverImage(true)
    try {
      const result = await uploadCampaignCoverImage(Number(organizationId), file)
      if (result.success && result.asset?.url) {
        setForm((f) => ({ ...f, cover_image_url: result.asset!.url }))
        setCoverImagePreview(URL.createObjectURL(file))
      }
    } finally {
      setUploadingCoverImage(false)
    }
  }

  // Status actions
  async function toggleStatus(campaign: Campaign) {
    if (!organizationId) return
    const r =
      campaign.status === 'active'
        ? await pauseCampaign(Number(organizationId), campaign.id)
        : await activateCampaign(Number(organizationId), campaign.id)
    if (r.success) loadCampaigns()
  }
  async function completeCampaignAction(campaign: Campaign) {
    if (!organizationId) return
    const r = await completeCampaign(Number(organizationId), campaign.id)
    if (r.success) loadCampaigns()
  }

  // Navigate to detail page
  function viewCampaign(campaign: Campaign) {
    navigate(`/dashboard/org/${organizationId}/campaigns/${campaign.id}`)
  }

  async function handleApproveParticipant(participant: any) {
    if (!organizationId || !selectedCampaign) return
    const r = await approveParticipant(Number(organizationId), selectedCampaign.id, participant.id)
    if (r.success) {
      setParticipants((prev) => prev.map((p) => (p.id === participant.id ? { ...p, status: 'approved' } : p)))
      toast.success('Participant approved')
    }
  }
  async function handleRejectParticipant(participant: any) {
    if (!organizationId || !selectedCampaign) return
    const r = await rejectParticipant(Number(organizationId), selectedCampaign.id, participant.id)
    if (r.success) {
      setParticipants((prev) => prev.map((p) => (p.id === participant.id ? { ...p, status: 'rejected' } : p)))
      toast.success('Participant rejected')
    }
  }
  async function handleVerifySubmission(submission: any) {
    if (!organizationId) return
    const r = await verifySubmission(Number(organizationId), submission.id)
    if (r.success) {
      setSubmissions((prev) => prev.map((s) => (s.id === submission.id ? { ...s, status: 'verified' } : s)))
      toast.success('Submission verified')
    }
  }
  async function handleRejectSubmission(submission: any) {
    if (!organizationId) return
    const r = await rejectSubmission(Number(organizationId), submission.id, 'Rejected by admin')
    if (r.success) {
      setSubmissions((prev) => prev.map((s) => (s.id === submission.id ? { ...s, status: 'rejected' } : s)))
      toast.success('Submission rejected')
    }
  }

  // Delete
  async function executeDelete() {
    if (!campaignToDelete || !organizationId) return
    setDeleting(true)
    try {
      const r = await deleteCampaign(Number(organizationId), campaignToDelete.id)
      if (r.success) {
        toast.success('Campaign deleted')
        loadCampaigns()
        setShowDeleteDialog(false)
        setCampaignToDelete(null)
      }
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <PageLayout icon={Megaphone} title="Campaigns">
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      icon={Megaphone}
      title="Campaigns"
      description="Create and manage clipping campaigns"
      actions={
        isAdmin && (
          <button
            onClick={openCreateWizard}
            className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-cyan-400 text-[#0a0a0b] border-none cursor-pointer transition-opacity duration-150 hover:opacity-90"
          >
            <Plus className="w-3.5 h-3.5" /> New Campaign
          </button>
        )
      }
    >
      <div className="cp">
        <div className="cp-heading">
          <h1 className="cp-heading__title">Clipping Campaigns</h1>
          <p className="cp-heading__subtitle">Create and manage campaigns for clippers to promote your content</p>
        </div>

        {/* Stats */}
        <div className="oc-stats">
          <div className="oc-stats__card">
            <div className="oc-stats__indicator oc-stats__indicator--green" />
            <div className="oc-stats__inner">
              <div className="oc-stats__icon oc-stats__icon--green">
                <Megaphone className="w-5 h-5" />
              </div>
              <div className="oc-stats__text">
                <h3 className="oc-stats__title">Active Campaigns</h3>
                <p className="oc-stats__desc">Currently running</p>
              </div>
              <div className="oc-stats__value oc-stats__value--green">{activeCampaigns}</div>
            </div>
          </div>
          <div className="oc-stats__card">
            <div className="oc-stats__indicator oc-stats__indicator--purple" />
            <div className="oc-stats__inner">
              <div className="oc-stats__icon oc-stats__icon--purple">
                <Wallet className="w-5 h-5" />
              </div>
              <div className="oc-stats__text">
                <h3 className="oc-stats__title">Total Budget</h3>
                <p className="oc-stats__desc">Across all campaigns</p>
              </div>
              <div className="oc-stats__value oc-stats__value--purple">${formatBudget(totalBudget)}</div>
            </div>
          </div>
          <div className="oc-stats__card">
            <div className="oc-stats__indicator oc-stats__indicator--amber" />
            <div className="oc-stats__inner">
              <div className="oc-stats__icon oc-stats__icon--amber">
                <Users className="w-5 h-5" />
              </div>
              <div className="oc-stats__text">
                <h3 className="oc-stats__title">Total Clippers</h3>
                <p className="oc-stats__desc">Participants</p>
              </div>
              <div className="oc-stats__value oc-stats__value--amber">{totalParticipants}</div>
            </div>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <div className="oc-empty">
            <div className="oc-empty__icon-wrapper">
              <Megaphone className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="oc-empty__title">No campaigns yet</h3>
            <p className="oc-empty__text">Create your first campaign to start working with clippers</p>
            {isAdmin && (
              <button onClick={openCreateWizard} className="oc-empty__btn">
                <Plus className="w-[18px] h-[18px]" />
                Create First Campaign
              </button>
            )}
          </div>
        ) : (
          <div className="cp-grid">
            {campaigns.map((campaign) => (
              <div key={campaign.id} className="cp-card">
                {/* Cover */}
                <div className="cp-card__cover">
                  {campaign.cover_image_url ? (
                    <img src={campaign.cover_image_url} className="cp-card__cover-img" />
                  ) : (
                    <div className="cp-card__cover-fallback">
                      <Megaphone className="w-8 h-8 text-zinc-600" />
                    </div>
                  )}
                  <div className="cp-card__cover-badges">
                    <span className={`cp-card__status cp-card__status--${campaign.status}`}>{campaign.status}</span>
                    <span
                      className={`cp-card__join-type ${campaign.join_type === 'open' ? 'cp-card__join-type--open' : 'cp-card__join-type--application'}`}
                    >
                      {campaign.join_type === 'open' ? (
                        <UserCheck className="w-3 h-3" />
                      ) : (
                        <ShieldCheck className="w-3 h-3" />
                      )}
                      {campaign.join_type === 'open' ? 'Open' : 'Apply'}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="cp-card__content">
                  <div className="cp-card__info">
                    <h3 className="cp-card__name">{campaign.title}</h3>
                    {campaign.description && <p className="cp-card__desc">{campaign.description}</p>}
                    {/* Meta */}
                    {(campaign.starts_at ||
                      campaign.ends_at ||
                      (campaign.status === 'active' && getDaysRemaining(campaign) !== null)) && (
                      <div className="cp-card__meta">
                        {(campaign.starts_at || campaign.ends_at) && (
                          <span className="cp-card__meta-item">
                            <Calendar className="w-3 h-3" />
                            {campaign.starts_at && formatDate(campaign.starts_at)}
                            {campaign.starts_at && campaign.ends_at && ' – '}
                            {campaign.ends_at && formatDate(campaign.ends_at)}
                          </span>
                        )}
                        {campaign.status === 'active' && getDaysRemaining(campaign) !== null && (
                          <span className="cp-card__meta-item cp-card__meta-item--highlight">
                            <Clock className="w-3 h-3" />
                            {getDaysRemaining(campaign)! > 0 ? `${getDaysRemaining(campaign)}d left` : 'Ending today'}
                          </span>
                        )}
                      </div>
                    )}
                    {/* Platforms & Creators */}
                    <div className="cp-card__platforms-creators">
                      {campaign.allowed_platforms?.length > 0 && (
                        <div className="cp-card__platforms">
                          {campaign.allowed_platforms.map((p) => (
                            <span
                              key={p}
                              className={`cp-platform ${getPlatformClass(p)}`}
                              title={getPlatformDisplayName(p)}
                            >
                              {getPlatformDisplayName(p).charAt(0)}
                            </span>
                          ))}
                        </div>
                      )}
                      {campaign.creator_profiles && campaign.creator_profiles.length > 0 && (
                        <div className="cp-card__creators">
                          {campaign.creator_profiles.slice(0, 3).map((p) => (
                            <div key={p.id} className="cp-card__creator-avatar" title={p.name}>
                              {p.profile_image_url ? (
                                <img src={p.profile_image_url} className="cp-card__creator-img" />
                              ) : (
                                <div className="cp-card__creator-fallback">{p.name?.charAt(0)}</div>
                              )}
                            </div>
                          ))}
                          {campaign.creator_profiles.length > 3 && (
                            <span className="oc-card__more-badge">+{campaign.creator_profiles.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="cp-card__stats">
                    <div className="cp-card__stat">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                      <div className="cp-card__stat-data">
                        <span className="cp-card__stat-value">${formatCpm(campaign.cpm)}</span>
                        <span className="cp-card__stat-label">per {formatViews(campaign.cpm_views || 1000)}</span>
                      </div>
                    </div>
                    <div className="cp-card__stat">
                      <Wallet className="w-3.5 h-3.5 text-purple-400" />
                      <div className="cp-card__stat-data">
                        <span className="cp-card__stat-value">${formatBudget(campaign.budget)}</span>
                        <span className="cp-card__stat-label">budget</span>
                      </div>
                    </div>
                    <div className="cp-card__stat">
                      <Users className="w-3.5 h-3.5 text-amber-400" />
                      <div className="cp-card__stat-data">
                        <span className="cp-card__stat-value">{campaign.participants_count || 0}</span>
                        <span className="cp-card__stat-label">clippers</span>
                      </div>
                    </div>
                  </div>

                  {/* Budget Progress */}
                  <div className="cp-card__budget-progress">
                    <div className="cp-card__budget-bar">
                      <div
                        className={`cp-card__budget-fill ${getBudgetPercentage(campaign) < 50 ? 'cp-card__budget-fill--low' : getBudgetPercentage(campaign) < 80 ? 'cp-card__budget-fill--medium' : 'cp-card__budget-fill--high'}`}
                        style={{ width: `${getBudgetPercentage(campaign)}%` }}
                      />
                    </div>
                    <span className="cp-card__budget-text">
                      ${formatBudget(campaign.spent || '0')} / ${formatBudget(campaign.budget)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="cp-card__actions">
                    <button title="View" className="cp-card__action-btn" onClick={() => viewCampaign(campaign)}>
                      <Eye className="w-4 h-4" />
                    </button>
                    {isAdmin && (
                      <button
                        title="Edit"
                        className="cp-card__action-btn"
                        onClick={() => {
                          openEditWizard(campaign)
                          setOpenMenuId(null)
                        }}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <div className="cp-card__menu-wrapper">
                        <button
                          ref={(el) => {
                            if (el) menuBtnRefs.current.set(campaign.id, el)
                            else menuBtnRefs.current.delete(campaign.id)
                          }}
                          title="Menu"
                          className={`cp-card__action-btn ${openMenuId === campaign.id ? 'cp-card__action-btn--active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(openMenuId === campaign.id ? null : campaign.id)
                          }}
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === campaign.id &&
                          createPortal(
                            <div
                              className="oc-dropdown"
                              style={getMenuPosition(campaign.id)}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {campaign.status === 'draft' && (
                                <button
                                  className="oc-dropdown__item"
                                  onClick={() => {
                                    activateCampaign(Number(organizationId), campaign.id).then((r) => {
                                      if (r.success) loadCampaigns()
                                    })
                                    setOpenMenuId(null)
                                  }}
                                >
                                  <Play className="w-4 h-4" />
                                  <span>Activate</span>
                                </button>
                              )}
                              {campaign.status === 'active' && (
                                <button
                                  className="oc-dropdown__item"
                                  onClick={() => {
                                    toggleStatus(campaign)
                                    setOpenMenuId(null)
                                  }}
                                >
                                  <Pause className="w-4 h-4" />
                                  <span>Pause</span>
                                </button>
                              )}
                              {campaign.status === 'paused' && (
                                <button
                                  className="oc-dropdown__item"
                                  onClick={() => {
                                    toggleStatus(campaign)
                                    setOpenMenuId(null)
                                  }}
                                >
                                  <Play className="w-4 h-4" />
                                  <span>Resume</span>
                                </button>
                              )}
                              {campaign.status !== 'completed' && (
                                <button
                                  className="oc-dropdown__item"
                                  onClick={() => {
                                    completeCampaignAction(campaign)
                                    setOpenMenuId(null)
                                  }}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                  <span>Complete</span>
                                </button>
                              )}
                              <div className="oc-dropdown__divider" />
                              <button
                                className="oc-dropdown__item oc-dropdown__item--danger"
                                onClick={() => {
                                  setCampaignToDelete(campaign)
                                  setShowDeleteDialog(true)
                                  setOpenMenuId(null)
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Delete</span>
                              </button>
                            </div>,
                            document.body
                          )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== Create/Edit Campaign Wizard ===== */}
      {showWizard &&
        createPortal(
          <div
            className="om-dialog__overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && !saving) setShowWizard(false)
            }}
          >
            <div className="cp-wizard">
              <div className="cp-wizard__accent" />
              {/* Progress dots (create mode only) */}
              {!editingCampaign && (
                <div className="cp-wizard__progress">
                  {Array.from({ length: totalSteps }).map((_, i) => (
                    <div
                      key={i}
                      className={`cp-wizard__progress-dot ${i + 1 <= currentStep ? 'cp-wizard__progress-dot--active' : ''}`}
                    />
                  ))}
                </div>
              )}
              <button className="om-dialog__close" onClick={() => setShowWizard(false)} disabled={saving}>
                <X size={18} />
              </button>

              {!editingCampaign ? (
                /* ===== Wizard Steps ===== */
                <div className="cp-wizard__content">
                  {currentStep === 1 && (
                    <div className="cp-wizard__step">
                      <div className="cp-wizard__header">
                        <div className="cp-wizard__icon">
                          <Megaphone size={28} />
                        </div>
                        <h2 className="cp-wizard__title">Let's name your campaign</h2>
                        <p className="cp-wizard__subtitle">Give your campaign a title and description</p>
                      </div>
                      <div className="cp-wizard__fields">
                        <div className="cp-wizard__field">
                          <label className="cp-wizard__label">Campaign Title</label>
                          <input
                            value={form.title}
                            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                            className="cp-wizard__input"
                            placeholder="Enter campaign title"
                          />
                        </div>
                        <div className="cp-wizard__field">
                          <label className="cp-wizard__label">
                            Description <span className="cp-wizard__optional">(optional)</span>
                          </label>
                          <textarea
                            value={form.description}
                            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                            rows={3}
                            className="cp-wizard__textarea"
                            placeholder="Describe your campaign..."
                          />
                          <p className="cp-wizard__hint">{form.description.length}/500 characters</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {currentStep === 2 && (
                    <div className="cp-wizard__step">
                      <div className="cp-wizard__header">
                        <div className="cp-wizard__icon">
                          <DollarSign size={28} />
                        </div>
                        <h2 className="cp-wizard__title">Set your pricing</h2>
                        <p className="cp-wizard__subtitle">Configure CPM rates and budget</p>
                      </div>
                      <div className="cp-wizard__fields">
                        <div className="cp-wizard__row">
                          <div className="cp-wizard__field">
                            <label className="cp-wizard__label">CPM Price ($)</label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={form.cpm || ''}
                              onChange={(e) => setForm((f) => ({ ...f, cpm: parseFloat(e.target.value) || 0 }))}
                              className="cp-wizard__input"
                              placeholder="0.00"
                            />
                          </div>
                          <div className="cp-wizard__field">
                            <label className="cp-wizard__label">Per Views</label>
                            <select
                              value={form.cpm_views}
                              onChange={(e) => setForm((f) => ({ ...f, cpm_views: Number(e.target.value) }))}
                              className="cp-wizard__input"
                            >
                              {CPM_VIEWS_OPTIONS.map((o) => (
                                <option key={o.value} value={o.value}>
                                  {o.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <p className="cp-wizard__hint">
                          ${form.cpm} per {formatViews(form.cpm_views)} views
                        </p>
                        <div className="cp-wizard__row">
                          <div className="cp-wizard__field">
                            <label className="cp-wizard__label">Budget ($)</label>
                            <input
                              type="number"
                              step="1"
                              min="0"
                              value={form.budget || ''}
                              onChange={(e) => setForm((f) => ({ ...f, budget: parseFloat(e.target.value) || 0 }))}
                              className="cp-wizard__input"
                              placeholder="0"
                            />
                          </div>
                          <div className="cp-wizard__field">
                            <label className="cp-wizard__label">Min Views for Payment</label>
                            <input
                              type="number"
                              min="0"
                              value={form.min_views_for_payment || ''}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, min_views_for_payment: parseInt(e.target.value) || 0 }))
                              }
                              className="cp-wizard__input"
                              placeholder="1000"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {currentStep === 3 && (
                    <div className="cp-wizard__step">
                      <div className="cp-wizard__header">
                        <div className="cp-wizard__icon">
                          <Calendar size={28} />
                        </div>
                        <h2 className="cp-wizard__title">When will this run?</h2>
                        <p className="cp-wizard__subtitle">Set campaign duration and access type</p>
                      </div>
                      <div className="cp-wizard__fields">
                        <div className="cp-wizard__field">
                          <label className="cp-wizard__label">Join Type</label>
                          <select
                            value={form.join_type}
                            onChange={(e) => setForm((f) => ({ ...f, join_type: e.target.value as any }))}
                            className="cp-wizard__input"
                          >
                            <option value="open">Open</option>
                            <option value="application_required">Application Required</option>
                          </select>
                          <p className="cp-wizard__hint">
                            Open: Anyone can join. Application Required: You approve each clipper.
                          </p>
                        </div>
                        <div className="cp-wizard__row">
                          <div className="cp-wizard__field">
                            <label className="cp-wizard__label">
                              Start Date <span className="cp-wizard__optional">(optional)</span>
                            </label>
                            <input
                              type="datetime-local"
                              value={form.starts_at}
                              onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))}
                              className="cp-wizard__input"
                            />
                          </div>
                          <div className="cp-wizard__field">
                            <label className="cp-wizard__label">
                              End Date <span className="cp-wizard__optional">(optional)</span>
                            </label>
                            <input
                              type="datetime-local"
                              value={form.ends_at}
                              onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                              className="cp-wizard__input"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {currentStep === 4 && (
                    <div className="cp-wizard__step">
                      <div className="cp-wizard__header">
                        <div className="cp-wizard__icon">
                          <Globe size={28} />
                        </div>
                        <h2 className="cp-wizard__title">Where can clippers post?</h2>
                        <p className="cp-wizard__subtitle">Select platforms and payment methods</p>
                      </div>
                      <div className="cp-wizard__fields">
                        <div className="cp-wizard__field">
                          <label className="cp-wizard__label">Allowed Platforms</label>
                          <div className="cp-wizard__tags">
                            {AVAILABLE_PLATFORMS.map((p) => (
                              <button
                                key={p.value}
                                type="button"
                                onClick={() => togglePlatform(p.value)}
                                className={`cp-wizard__tag ${form.allowed_platforms.includes(p.value) ? 'cp-wizard__tag--selected' : ''}`}
                              >
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <p className="cp-wizard__hint">{form.allowed_platforms.length} platform(s) selected</p>
                        </div>
                        <div className="cp-wizard__field">
                          <label className="cp-wizard__label">Payment Methods</label>
                          <div className="cp-wizard__tags">
                            {AVAILABLE_PAYMENT_METHODS.map((m) => (
                              <button
                                key={m.value}
                                type="button"
                                onClick={() => togglePaymentMethod(m.value)}
                                className={`cp-wizard__tag ${form.payment_methods.includes(m.value) ? 'cp-wizard__tag--selected' : ''}`}
                              >
                                {m.label}
                              </button>
                            ))}
                          </div>
                          <p className="cp-wizard__hint">{form.payment_methods.length} method(s) selected</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {currentStep === 5 && (
                    <div className="cp-wizard__step">
                      <div className="cp-wizard__header">
                        <div className="cp-wizard__icon">
                          <Users size={28} />
                        </div>
                        <h2 className="cp-wizard__title">Select creator profiles</h2>
                        <p className="cp-wizard__subtitle">Choose which creator profiles clippers can use</p>
                      </div>
                      <div className="cp-wizard__fields">
                        {creatorProfiles.length === 0 ? (
                          <p className="cp-wizard__hint">
                            No creator profiles available. Create profiles in the Creator Profiles tab first.
                          </p>
                        ) : (
                          <div className="cp-wizard__profiles-list">
                            {creatorProfiles.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleCreatorProfile(p.id)}
                                className={`cp-wizard__profile ${selectedCreatorProfileIds.includes(p.id) ? 'cp-wizard__profile--selected' : ''}`}
                              >
                                <div className="cp-wizard__profile-avatar">
                                  {p.profile_image_url ? (
                                    <img src={p.profile_image_url} />
                                  ) : (
                                    <User className="w-5 h-5 text-zinc-500" />
                                  )}
                                </div>
                                <div className="cp-wizard__profile-info">
                                  <span className="cp-wizard__profile-name">{p.name}</span>
                                  {p.description && <span className="cp-wizard__profile-desc">{p.description}</span>}
                                </div>
                                {selectedCreatorProfileIds.includes(p.id) && (
                                  <div className="cp-wizard__profile-check">
                                    <Check className="w-3.5 h-3.5 text-white" />
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        <p className="cp-wizard__hint">{selectedCreatorProfileIds.length} profile(s) selected.</p>
                      </div>
                    </div>
                  )}
                  {currentStep === 6 && (
                    <div className="cp-wizard__step">
                      <div className="cp-wizard__header">
                        <div className="cp-wizard__icon">
                          <Film size={28} />
                        </div>
                        <h2 className="cp-wizard__title">Add campaign assets</h2>
                        <p className="cp-wizard__subtitle">Optional cover image</p>
                      </div>
                      <div className="cp-wizard__fields">
                        <div className="cp-wizard__field">
                          <label className="cp-wizard__label">Cover Image</label>
                          {(form.cover_image_url || coverImagePreview) && (
                            <div className="cp-wizard__cover-preview">
                              <img src={coverImagePreview || form.cover_image_url} />
                              <button
                                type="button"
                                onClick={() => {
                                  setForm((f) => ({ ...f, cover_image_url: '' }))
                                  setCoverImagePreview('')
                                }}
                                className="cp-wizard__cover-remove"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                          <div className="cp-wizard__upload-row">
                            <button
                              type="button"
                              onClick={() => coverImageInputRef.current?.click()}
                              disabled={uploadingCoverImage}
                              className="cp-wizard__upload-btn"
                            >
                              {uploadingCoverImage ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Upload className="w-4 h-4" />
                              )}
                              {uploadingCoverImage ? 'Uploading...' : 'Upload'}
                            </button>
                            <input
                              ref={coverImageInputRef}
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleCoverImageUpload}
                            />
                            <span className="cp-wizard__upload-or">or</span>
                            <input
                              value={form.cover_image_url}
                              onChange={(e) => {
                                setForm((f) => ({ ...f, cover_image_url: e.target.value }))
                                setCoverImagePreview('')
                              }}
                              type="text"
                              placeholder="Paste image URL..."
                              className="cp-wizard__input cp-wizard__input--url"
                            />
                          </div>
                          <p className="cp-wizard__hint">Recommended size: 1200x630px</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {currentStep === 7 && (
                    <div className="cp-wizard__step">
                      <div className="cp-wizard__header">
                        <div className="cp-wizard__icon cp-wizard__icon--success">
                          <Check size={28} />
                        </div>
                        <h2 className="cp-wizard__title">Review your campaign</h2>
                        <p className="cp-wizard__subtitle">Make sure everything looks good</p>
                      </div>
                      <div className="cp-wizard__fields">
                        <div className="cp-wizard__summary">
                          <div className="cp-wizard__summary-header">
                            <div className="cp-wizard__summary-icon">
                              <Megaphone size={20} />
                            </div>
                            <div>
                              <h3 className="cp-wizard__summary-name">{form.title || 'Untitled Campaign'}</h3>
                              {form.description && <p className="cp-wizard__summary-desc">{form.description}</p>}
                            </div>
                          </div>
                          <div className="cp-wizard__summary-grid">
                            <div className="cp-wizard__summary-section">
                              <div className="cp-wizard__summary-label">
                                <DollarSign size={14} /> Pricing
                              </div>
                              <div className="cp-wizard__summary-value">
                                ${formatCpm(form.cpm)} per {formatViews(form.cpm_views)} views
                              </div>
                              <div className="cp-wizard__summary-value">Budget: ${formatBudget(form.budget)}</div>
                            </div>
                            {(form.starts_at || form.ends_at) && (
                              <div className="cp-wizard__summary-section">
                                <div className="cp-wizard__summary-label">
                                  <Calendar size={14} /> Duration
                                </div>
                                {form.starts_at && (
                                  <div className="cp-wizard__summary-value">Start: {formatDate(form.starts_at)}</div>
                                )}
                                {form.ends_at && (
                                  <div className="cp-wizard__summary-value">End: {formatDate(form.ends_at)}</div>
                                )}
                              </div>
                            )}
                            {form.allowed_platforms.length > 0 && (
                              <div className="cp-wizard__summary-section">
                                <div className="cp-wizard__summary-label">
                                  <Globe size={14} /> Platforms
                                </div>
                                <div className="cp-wizard__summary-tags">
                                  {form.allowed_platforms.map((p) => (
                                    <span key={p} className="cp-wizard__summary-tag">
                                      {getPlatformDisplayName(p)}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {selectedCreatorProfileIds.length > 0 && (
                              <div className="cp-wizard__summary-section">
                                <div className="cp-wizard__summary-label">
                                  <Users size={14} /> Creator Profiles
                                </div>
                                <div className="cp-wizard__summary-value">
                                  {selectedCreatorProfileIds.length} profile(s) selected
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {wizardError && (
                    <div className="cp-wizard__alert">
                      <AlertTriangle size={16} />
                      <p>{wizardError}</p>
                    </div>
                  )}
                </div>
              ) : (
                /* ===== Edit Mode ===== */
                <div className="cp-wizard__content">
                  <div className="cp-wizard__step">
                    <div className="cp-wizard__header">
                      <h2 className="cp-wizard__title">Edit Campaign</h2>
                      <p className="cp-wizard__subtitle">Update your campaign details</p>
                    </div>
                    <div className="cp-wizard__fields">
                      <div className="cp-wizard__field">
                        <label className="cp-wizard__label">Title</label>
                        <input
                          value={form.title}
                          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                          className="cp-wizard__input"
                        />
                      </div>
                      <div className="cp-wizard__field">
                        <label className="cp-wizard__label">Description</label>
                        <textarea
                          value={form.description}
                          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                          rows={3}
                          className="cp-wizard__textarea"
                        />
                      </div>
                      <div className="cp-wizard__row">
                        <div className="cp-wizard__field">
                          <label className="cp-wizard__label">CPM ($)</label>
                          <input
                            type="number"
                            step="0.01"
                            value={form.cpm || ''}
                            onChange={(e) => setForm((f) => ({ ...f, cpm: parseFloat(e.target.value) || 0 }))}
                            className="cp-wizard__input"
                          />
                        </div>
                        <div className="cp-wizard__field">
                          <label className="cp-wizard__label">Budget ($)</label>
                          <input
                            type="number"
                            value={form.budget || ''}
                            onChange={(e) => setForm((f) => ({ ...f, budget: parseFloat(e.target.value) || 0 }))}
                            className="cp-wizard__input"
                          />
                        </div>
                      </div>
                      <div className="cp-wizard__field">
                        <label className="cp-wizard__label">Platforms</label>
                        <div className="cp-wizard__tags">
                          {AVAILABLE_PLATFORMS.map((p) => (
                            <button
                              key={p.value}
                              type="button"
                              onClick={() => togglePlatform(p.value)}
                              className={`cp-wizard__tag ${form.allowed_platforms.includes(p.value) ? 'cp-wizard__tag--selected' : ''}`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="cp-wizard__field">
                        <label className="cp-wizard__label">Payment Methods</label>
                        <div className="cp-wizard__tags">
                          {AVAILABLE_PAYMENT_METHODS.map((m) => (
                            <button
                              key={m.value}
                              type="button"
                              onClick={() => togglePaymentMethod(m.value)}
                              className={`cp-wizard__tag ${form.payment_methods.includes(m.value) ? 'cp-wizard__tag--selected' : ''}`}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                  {wizardError && (
                    <div className="cp-wizard__alert">
                      <AlertTriangle size={16} />
                      <p>{wizardError}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Footer */}
              <div className="cp-wizard__footer">
                <div className="cp-wizard__footer-buttons">
                  {!editingCampaign && currentStep > 1 && (
                    <button
                      onClick={() => setCurrentStep((s) => s - 1)}
                      disabled={saving}
                      className="om-dialog__btn om-dialog__btn--secondary"
                    >
                      Back
                    </button>
                  )}
                  {!editingCampaign && currentStep < totalSteps && (
                    <button
                      onClick={() => setCurrentStep((s) => s + 1)}
                      disabled={!canProceed || saving}
                      className="om-dialog__btn om-dialog__btn--primary"
                    >
                      Continue
                    </button>
                  )}
                  {(!editingCampaign && currentStep === totalSteps) || editingCampaign ? (
                    <button
                      onClick={saveWizardCampaign}
                      disabled={!canProceed || saving}
                      className="om-dialog__btn om-dialog__btn--primary"
                    >
                      {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                      {saving ? 'Saving...' : editingCampaign ? 'Save Changes' : 'Create Campaign'}
                    </button>
                  ) : null}
                </div>
                {!editingCampaign && currentStep >= 2 && currentStep <= 6 && (
                  <button onClick={() => setCurrentStep((s) => s + 1)} className="cp-wizard__skip">
                    Skip for now
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===== Campaign Detail Dialog ===== */}
      {showDetailDialog &&
        selectedCampaign &&
        createPortal(
          <div
            className="om-dialog__overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowDetailDialog(false)
            }}
          >
            <div className="om-dialog om-dialog--cyan" style={{ maxWidth: 560 }}>
              <div className="om-dialog__accent om-dialog__accent--cyan" />
              <div className="om-dialog__header">
                <button className="om-dialog__close" onClick={() => setShowDetailDialog(false)}>
                  <X size={18} />
                </button>
                <div className="om-dialog__icon om-dialog__icon--cyan">
                  <Eye size={24} />
                </div>
                <h2 className="om-dialog__title">{selectedCampaign.title}</h2>
                <p className="om-dialog__subtitle">Campaign details and management</p>
              </div>
              {/* Tabs */}
              <div className="cp-detail__tabs">
                {(['overview', 'participants', 'submissions'] as const).map((tab) => (
                  <button
                    key={tab}
                    className={`cp-detail__tab ${detailTab === tab ? 'cp-detail__tab--active' : ''}`}
                    onClick={() => setDetailTab(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
              <div className="om-dialog__content" style={{ paddingBottom: '1.5rem' }}>
                {detailTab === 'overview' && (
                  <div className="cp-detail__stats-grid">
                    <div className="cp-detail__stat-card cp-detail__stat-card--green">
                      <span className="cp-detail__stat-value">${formatCpm(selectedCampaign.cpm)}</span>
                      <span className="cp-detail__stat-label">
                        per {formatViews(selectedCampaign.cpm_views || 1000)} views
                      </span>
                    </div>
                    <div className="cp-detail__stat-card">
                      <span className="cp-detail__stat-value">${formatBudget(selectedCampaign.budget)}</span>
                      <span className="cp-detail__stat-label">budget</span>
                    </div>
                    <div className="cp-detail__stat-card">
                      <span className="cp-detail__stat-value">${formatBudget(selectedCampaign.spent || '0')}</span>
                      <span className="cp-detail__stat-label">spent</span>
                    </div>
                    <div className="cp-detail__stat-card">
                      <span className="cp-detail__stat-value">{selectedCampaign.participants_count || 0}</span>
                      <span className="cp-detail__stat-label">participants</span>
                    </div>
                  </div>
                )}
                {detailTab === 'participants' &&
                  (loadingParticipants ? (
                    <div className="oc-dialog__loading">
                      <div className="oc-dialog__loading-spinner" />
                      <span>Loading...</span>
                    </div>
                  ) : participants.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-8">No participants yet</p>
                  ) : (
                    <div className="cp-detail__list">
                      {participants.map((p) => (
                        <div key={p.id} className="cp-detail__participant">
                          <div className="oc-dialog__member-avatar">
                            {p.user?.avatar_url || p.clipper_profile?.avatar_url ? (
                              <img
                                src={p.clipper_profile?.avatar_url || p.user?.avatar_url}
                                className="oc-dialog__member-avatar-img"
                              />
                            ) : (
                              <User className="w-4 h-4 text-zinc-500" />
                            )}
                          </div>
                          <div className="oc-dialog__member-info">
                            <p className="oc-dialog__member-name">
                              {p.clipper_profile?.display_name || p.user?.display_name || p.user?.email}
                            </p>
                            {p.application_note && <p className="oc-dialog__member-email">"{p.application_note}"</p>}
                          </div>
                          <span className={`cp-detail__status cp-detail__status--${p.status}`}>{p.status}</span>
                          {isAdmin && p.status === 'pending' && (
                            <>
                              <button
                                className="cp-detail__action-btn cp-detail__action-btn--approve"
                                onClick={() => handleApproveParticipant(p)}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                className="cp-detail__action-btn cp-detail__action-btn--reject"
                                onClick={() => handleRejectParticipant(p)}
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                {detailTab === 'submissions' &&
                  (loadingSubmissions ? (
                    <div className="oc-dialog__loading">
                      <div className="oc-dialog__loading-spinner" />
                      <span>Loading...</span>
                    </div>
                  ) : submissions.length === 0 ? (
                    <p className="text-sm text-zinc-500 text-center py-8">No submissions yet</p>
                  ) : (
                    <div className="cp-detail__list">
                      {submissions.map((s) => (
                        <div key={s.id} className="cp-detail__participant">
                          <div className="oc-dialog__member-info">
                            <a
                              href={s.clip_url}
                              target="_blank"
                              className="text-sm text-cyan-400 hover:underline flex items-center gap-1"
                            >
                              {s.clip_url?.substring(0, 40)}... <ExternalLink size={12} />
                            </a>
                            <p className="oc-dialog__member-email">
                              {s.user?.display_name || s.user?.email} · {s.view_count?.toLocaleString()} views
                            </p>
                          </div>
                          <span className={`cp-detail__status cp-detail__status--${s.status}`}>{s.status}</span>
                          {isAdmin && s.status === 'pending' && (
                            <>
                              <button
                                className="cp-detail__action-btn cp-detail__action-btn--approve"
                                onClick={() => handleVerifySubmission(s)}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                className="cp-detail__action-btn cp-detail__action-btn--reject"
                                onClick={() => handleRejectSubmission(s)}
                              >
                                <X size={14} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* ===== Delete Dialog ===== */}
      {showDeleteDialog &&
        createPortal(
          <div
            className="om-dialog__overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget && !deleting) {
                setShowDeleteDialog(false)
                setCampaignToDelete(null)
              }
            }}
          >
            <div className="om-dialog om-dialog--red">
              <div className="om-dialog__accent om-dialog__accent--red" />
              <div className="om-dialog__header">
                <button
                  className="om-dialog__close"
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setCampaignToDelete(null)
                  }}
                  disabled={deleting}
                >
                  <X size={18} />
                </button>
                <div className="om-dialog__icon om-dialog__icon--red">
                  <Trash2 size={24} />
                </div>
                <h2 className="om-dialog__title">Delete Campaign</h2>
                <p className="om-dialog__subtitle">This action cannot be undone</p>
              </div>
              <div className="om-dialog__content">
                <div className="oc-dialog__profile-card">
                  <div className="oc-dialog__profile-avatar">
                    <Megaphone size={20} className="text-zinc-500" />
                  </div>
                  <div className="oc-dialog__profile-info">
                    <div className="oc-dialog__profile-name">{campaignToDelete?.title}</div>
                    <div className="oc-dialog__profile-desc">Campaign</div>
                  </div>
                </div>
              </div>
              <div className="om-dialog__footer">
                <button
                  className="om-dialog__btn om-dialog__btn--secondary"
                  onClick={() => {
                    setShowDeleteDialog(false)
                    setCampaignToDelete(null)
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button className="om-dialog__btn om-dialog__btn--danger" onClick={executeDelete} disabled={deleting}>
                  {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {deleting ? 'Deleting...' : 'Delete Campaign'}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </PageLayout>
  )
}
