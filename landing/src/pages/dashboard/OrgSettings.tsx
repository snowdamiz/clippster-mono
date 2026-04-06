import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { OrganizationSelector } from '@/components/dashboard/OrganizationSelector'
import { useOrganizationSelector } from '@/hooks/useOrganizationSelector'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  Settings,
  Save,
  Building2,
  Type,
  Sparkles,
  Zap,
  Archive,
  CheckCircle,
  UserCircle,
  Upload,
  Loader2,
  AlertTriangle,
  Trash2,
  X,
  Pencil,
  Shield,
  Users,
  Megaphone
} from 'lucide-react'
import type { OrganizationRestrictionDefaults } from '@/types/organization'
import { SPECIALTY_TAGS } from '@/services/clipperApi'

interface EditData {
  name: string
  description: string
  bio: string
  website_url: string
  public_contact_email: string
  public_discord: string
  public_telegram: string
  content_type_tags: string[]
  settings: { allow_ai: boolean }
  restriction_defaults: Required<OrganizationRestrictionDefaults>
}

const DEFAULT_RESTRICTIONS: Required<OrganizationRestrictionDefaults> = {
  allow_ai: true,
  allow_asset_uploads: false,
  allow_custom_prompts: false,
  allow_clipper_profile: false,
  allow_personal_social: true,
  allow_clip_deletion: false,
  allow_hiring_browse: true,
  force_org_watermark: true,
  require_clip_approval: false,
  clips_visible_to_admins: true
}

type ActiveTab = 'basic' | 'ai' | 'restrictions' | 'danger'

export function OrgSettings() {
  const { hasMultipleOrgs } = useOrganizationSelector()
  const { loading, organization, isOwner, loadOrganization, updateOrganization, uploadLogo, deleteOrganization } =
    useOrganization()
  const navigate = useNavigate()

  const logoInputRef = useRef<HTMLInputElement>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const [logoLoadError, setLogoLoadError] = useState(false)
  const [editData, setEditData] = useState<EditData>({
    name: '',
    description: '',
    bio: '',
    website_url: '',
    public_contact_email: '',
    public_discord: '',
    public_telegram: '',
    content_type_tags: [],
    settings: { allow_ai: true },
    restriction_defaults: { ...DEFAULT_RESTRICTIONS }
  })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showEditProfileDialog, setShowEditProfileDialog] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [activeTab, setActiveTab] = useState<ActiveTab>('basic')

  useEffect(() => {
    loadOrganization()
  }, [loadOrganization])

  useEffect(() => {
    if (organization) {
      const orgSettings = organization.settings || {}
      const rd = organization.restriction_defaults || {}
      setEditData({
        name: organization.name,
        description: organization.description || '',
        bio: organization.bio || '',
        website_url: organization.website_url || '',
        public_contact_email: organization.public_contact_email || '',
        public_discord: organization.public_discord || '',
        public_telegram: organization.public_telegram || '',
        content_type_tags: organization.content_type_tags || [],
        settings: { allow_ai: orgSettings.allow_ai !== false },
        restriction_defaults: {
          allow_ai: rd.allow_ai !== false,
          allow_asset_uploads: rd.allow_asset_uploads === true,
          allow_custom_prompts: rd.allow_custom_prompts === true,
          allow_clipper_profile: rd.allow_clipper_profile === true,
          allow_personal_social: rd.allow_personal_social !== false,
          allow_clip_deletion: rd.allow_clip_deletion === true,
          allow_hiring_browse: rd.allow_hiring_browse !== false,
          force_org_watermark: rd.force_org_watermark !== false,
          require_clip_approval: rd.require_clip_approval === true,
          clips_visible_to_admins: rd.clips_visible_to_admins !== false
        }
      })
    }
  }, [organization])

  useEffect(() => {
    setLogoLoadError(false)
  }, [organization?.logo_url])

  const hasChanges = useMemo(() => {
    if (!organization) return false
    const orgSettings = organization.settings || {}
    const currentAllowAi = orgSettings.allow_ai !== false
    const rd = organization.restriction_defaults || {}

    const restrictionsChanged =
      editData.restriction_defaults.allow_ai !== (rd.allow_ai !== false) ||
      editData.restriction_defaults.allow_asset_uploads !== (rd.allow_asset_uploads === true) ||
      editData.restriction_defaults.allow_custom_prompts !== (rd.allow_custom_prompts === true) ||
      editData.restriction_defaults.allow_clipper_profile !== (rd.allow_clipper_profile === true) ||
      editData.restriction_defaults.allow_personal_social !== (rd.allow_personal_social !== false) ||
      editData.restriction_defaults.allow_clip_deletion !== (rd.allow_clip_deletion === true) ||
      editData.restriction_defaults.allow_hiring_browse !== (rd.allow_hiring_browse !== false) ||
      editData.restriction_defaults.force_org_watermark !== (rd.force_org_watermark !== false) ||
      editData.restriction_defaults.require_clip_approval !== (rd.require_clip_approval === true) ||
      editData.restriction_defaults.clips_visible_to_admins !== (rd.clips_visible_to_admins !== false)

    return (
      editData.name !== organization.name ||
      editData.description !== (organization.description || '') ||
      editData.bio !== (organization.bio || '') ||
      editData.website_url !== (organization.website_url || '') ||
      editData.public_contact_email !== (organization.public_contact_email || '') ||
      editData.public_discord !== (organization.public_discord || '') ||
      editData.public_telegram !== (organization.public_telegram || '') ||
      JSON.stringify(editData.content_type_tags) !== JSON.stringify(organization.content_type_tags || []) ||
      editData.settings.allow_ai !== currentAllowAi ||
      restrictionsChanged
    )
  }, [editData, organization])

  async function handleSave() {
    if (!hasChanges) return
    setSaving(true)
    setSaveSuccess(false)
    const result = await updateOrganization(editData)
    setSaving(false)
    if (result.success) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    }
  }

  async function saveAndCloseProfileDialog() {
    setSaving(true)
    setSaveSuccess(false)
    const result = await updateOrganization(editData)
    setSaving(false)
    if (result.success) {
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      setShowEditProfileDialog(false)
    }
  }

  function toggleRestriction(key: keyof typeof editData.restriction_defaults) {
    setEditData((prev) => ({
      ...prev,
      restriction_defaults: { ...prev.restriction_defaults, [key]: !prev.restriction_defaults[key] }
    }))
  }

  function toggleArrayTag(value: string) {
    setEditData((prev) => ({
      ...prev,
      content_type_tags: prev.content_type_tags.includes(value)
        ? prev.content_type_tags.filter((v) => v !== value)
        : [...prev.content_type_tags, value]
    }))
  }

  async function handleLogoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setUploadingLogo(true)
    setLogoLoadError(false)
    try {
      await uploadLogo(file)
    } catch {
      // handled by hook
    } finally {
      setUploadingLogo(false)
      if (event.target) event.target.value = ''
    }
  }

  async function executeDelete() {
    if (deleteConfirmInput !== organization?.name) return
    setDeleting(true)
    const result = await deleteOrganization()
    setDeleting(false)
    if (result.success) {
      setShowDeleteConfirm(false)
      navigate('/dashboard/org/new')
    }
  }

  if (loading && !organization) {
    return (
      <PageLayout
        icon={Settings}
        title="Organization Settings"
        description="Manage your organization profile and preferences"
      >
        <div className="w-full max-w-[900px] mx-auto p-6 space-y-8">
          <Skeleton className="h-6 w-64 rounded" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      icon={Settings}
      title={!hasMultipleOrgs ? 'Organization Settings' : undefined}
      titleComponent={hasMultipleOrgs ? <OrganizationSelector /> : undefined}
      description="Manage your organization profile and preferences"
      actions={
        <div className="flex items-center gap-2">
          {organization?.slug && (
            <a
              href={`/orgs/${organization.slug}`}
              className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md border border-zinc-700 text-zinc-200 no-underline"
            >
              Preview Public Profile
            </a>
          )}
          <button
            type="button"
            onClick={() => setShowEditProfileDialog(true)}
            className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-gradient-to-br from-cyan-400 to-cyan-600 text-white border-none cursor-pointer hover:opacity-90 transition-opacity"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Profile
          </button>
          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-cyan-400 text-[#0a0a0b] border-none cursor-pointer transition-opacity duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      }
    >
      <div className="w-full min-h-full">
        <div className="flex flex-col max-w-[1400px] mx-auto w-full p-6">

          {/* ===== Profile Header Card ===== */}
          <div className="relative bg-card border border-border rounded-2xl overflow-hidden mb-6">
            <div className="absolute inset-x-0 top-0 h-[120px] bg-gradient-to-br from-cyan-500/15 to-purple-500/15 opacity-50 pointer-events-none" />
            <div className="relative p-8 pb-6">
              <div className="flex items-start gap-6 mb-8 max-sm:flex-col max-sm:items-center max-sm:text-center">
                <div className="w-24 h-24 rounded-[20px] overflow-hidden shrink-0 bg-muted border-[3px] border-card shadow-md flex items-center justify-center">
                  {organization?.logo_url && !logoLoadError ? (
                    <img
                      src={organization.logo_url}
                      className="w-full h-full object-cover"
                      onError={() => setLogoLoadError(true)}
                    />
                  ) : (
                    <Building2 className="w-10 h-10 text-muted-foreground p-0" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h1 className="text-[1.75rem] font-bold text-foreground tracking-tight leading-tight m-0 mb-2">
                    {organization?.name || 'Organization'}
                  </h1>
                  <p className="text-[0.9375rem] text-muted-foreground m-0 mb-3 leading-relaxed max-w-[600px]">
                    {editData.bio || editData.description || 'Add your organization info for members and applicants.'}
                  </p>
                  {editData.content_type_tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {editData.content_type_tags.slice(0, 8).map((tag) => (
                        <span
                          key={tag}
                          className="px-2.5 py-1.5 bg-cyan-500/10 rounded-md text-[0.6875rem] font-semibold text-cyan-400"
                        >
                          {SPECIALTY_TAGS.find((t) => t.value === tag)?.label || tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 max-sm:grid-cols-1">
                <StatCard
                  icon={<Megaphone size={18} />}
                  value="0"
                  label="Campaigns"
                  colorClass="bg-gradient-to-br from-purple-500/20 to-purple-400/20 text-purple-300"
                />
                <StatCard
                  icon={<Users size={18} />}
                  value="0"
                  label="Members"
                  colorClass="bg-gradient-to-br from-cyan-500/20 to-cyan-400/20 text-cyan-400"
                />
                <StatCard
                  icon={<CheckCircle size={18} />}
                  value={String(editData.content_type_tags.length)}
                  label="Content Types"
                  colorClass="bg-gradient-to-br from-emerald-500/20 to-emerald-400/20 text-emerald-400"
                />
              </div>
            </div>
          </div>

          {/* ===== Tab Navigation ===== */}
          <div className="bg-card border border-border rounded-xl p-2 mb-6">
            <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabButton label="Basic" icon={<Type />} active={activeTab === 'basic'} onClick={() => setActiveTab('basic')} />
              <TabButton label="AI" icon={<Sparkles />} active={activeTab === 'ai'} onClick={() => setActiveTab('ai')} />
              <TabButton label="Restrictions" icon={<Shield />} active={activeTab === 'restrictions'} onClick={() => setActiveTab('restrictions')} />
              {isOwner && (
                <TabButton label="Danger" icon={<AlertTriangle />} active={activeTab === 'danger'} onClick={() => setActiveTab('danger')} />
              )}
            </div>
          </div>

          {/* ===== Tab Content ===== */}
          <div className="flex flex-col gap-5 pb-16">

            {/* Basic Tab */}
            {activeTab === 'basic' && (
              <section className="flex flex-col gap-3.5">
                <h3 className="text-lg font-semibold text-foreground tracking-tight m-0">Basic Information</h3>
                <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
                  <div className="p-5">
                    <div className="flex items-center gap-3.5">
                      <div className="w-11 h-11 rounded-[10px] overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                        {organization?.logo_url && !logoLoadError ? (
                          <img src={organization.logo_url} className="w-full h-full object-cover" />
                        ) : (
                          <Building2 className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[0.9375rem] font-semibold text-foreground">
                          {editData.name || 'Organization'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {editData.description || 'No description yet'}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowEditProfileDialog(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-gradient-to-br from-cyan-400 to-cyan-600 text-white border-none cursor-pointer hover:opacity-90 transition-opacity shrink-0"
                      >
                        <Pencil size={14} />
                        Edit Profile
                      </button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* AI Features Tab */}
            {activeTab === 'ai' && (
              <section className="flex flex-col gap-3.5">
                <h3 className="text-lg font-semibold text-foreground tracking-tight m-0">AI Features</h3>
                <div
                  className="bg-card border border-border/60 rounded-xl cursor-pointer transition-all duration-200 hover:border-border hover:bg-muted/10"
                  onClick={() =>
                    setEditData((prev) => ({ ...prev, settings: { ...prev.settings, allow_ai: !prev.settings.allow_ai } }))
                  }
                >
                  <div className="flex items-start gap-4 p-5">
                    <div
                      className={`flex items-center justify-center w-11 h-11 rounded-[10px] shrink-0 transition-all duration-200 ${
                        editData.settings.allow_ai ? 'bg-purple-500/15 text-purple-400' : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <Zap className="w-[22px] h-[22px]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[0.9375rem] font-semibold text-foreground mb-1.5">Enable AI Features</div>
                      <div className="text-[0.8125rem] text-muted-foreground leading-relaxed mb-3">
                        Allow members to use AI-powered features like auto-captions, clip finder, smart transcription, and more
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <span className="inline-flex px-2 py-1 rounded-[5px] text-[0.6875rem] font-medium bg-muted/40 text-muted-foreground">
                          Auto-Captions
                        </span>
                        <span className="inline-flex px-2 py-1 rounded-[5px] text-[0.6875rem] font-medium bg-muted/40 text-muted-foreground">
                          Clip Finder
                        </span>
                        <span className="inline-flex px-2 py-1 rounded-[5px] text-[0.6875rem] font-medium bg-muted/40 text-muted-foreground">
                          Smart Transcription
                        </span>
                      </div>
                    </div>
                    <Toggle
                      active={editData.settings.allow_ai}
                      onToggle={() =>
                        setEditData((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, allow_ai: !prev.settings.allow_ai }
                        }))
                      }
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Restrictions Tab */}
            {activeTab === 'restrictions' && (
              <section className="flex flex-col gap-3.5">
                <h3 className="text-lg font-semibold text-foreground tracking-tight m-0">Restricted Member Settings</h3>
                <div
                  className="grid grid-cols-1 sm:grid-cols-2 gap-4"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
                >
                  {/* AI & Detection Card */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
                      <Sparkles className="w-[18px] h-[18px] text-cyan-400" />
                      <span className="text-sm font-semibold text-white">AI & Detection</span>
                    </div>
                    <RestrictionItem
                      title="Enable AI Features"
                      desc="Auto-detect, captions, transcription"
                      active={editData.restriction_defaults.allow_ai}
                      onToggle={() => toggleRestriction('allow_ai')}
                    />
                  </div>

                  {/* Content & Assets Card */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
                      <Archive className="w-[18px] h-[18px] text-cyan-400" />
                      <span className="text-sm font-semibold text-white">Content & Assets</span>
                    </div>
                    <RestrictionItem
                      title="Allow personal assets"
                      desc="Upload intros, outros, watermarks"
                      active={editData.restriction_defaults.allow_asset_uploads}
                      onToggle={() => toggleRestriction('allow_asset_uploads')}
                    />
                    <RestrictionItem
                      title="Allow custom prompts"
                      desc="Create custom AI prompts"
                      active={editData.restriction_defaults.allow_custom_prompts}
                      onToggle={() => toggleRestriction('allow_custom_prompts')}
                    />
                    <RestrictionItem
                      title="Force organization watermark"
                      desc="Required on all exports"
                      active={editData.restriction_defaults.force_org_watermark}
                      onToggle={() => toggleRestriction('force_org_watermark')}
                    />
                  </div>

                  {/* Publishing & Approval Card */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
                      <CheckCircle className="w-[18px] h-[18px] text-cyan-400" />
                      <span className="text-sm font-semibold text-white">Publishing & Approval</span>
                    </div>
                    <RestrictionItem
                      title="Require clip approval"
                      desc="Admin review before publishing"
                      active={editData.restriction_defaults.require_clip_approval}
                      onToggle={() => toggleRestriction('require_clip_approval')}
                    />
                    <RestrictionItem
                      title="Allow clip deletion"
                      desc="Members can delete their clips"
                      active={editData.restriction_defaults.allow_clip_deletion}
                      onToggle={() => toggleRestriction('allow_clip_deletion')}
                    />
                  </div>

                  {/* Profile & Social Card */}
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-800">
                      <UserCircle className="w-[18px] h-[18px] text-cyan-400" />
                      <span className="text-sm font-semibold text-white">Profile & Social</span>
                    </div>
                    <RestrictionItem
                      title="Allow clipper profile"
                      desc="Create public clipper profile"
                      active={editData.restriction_defaults.allow_clipper_profile}
                      onToggle={() => toggleRestriction('allow_clipper_profile')}
                    />
                    <RestrictionItem
                      title="Allow personal social accounts"
                      desc="Connect their own social accounts"
                      active={editData.restriction_defaults.allow_personal_social}
                      onToggle={() => toggleRestriction('allow_personal_social')}
                    />
                    <RestrictionItem
                      title="Allow hiring browse"
                      desc="Browse companies hiring on Clippster"
                      active={editData.restriction_defaults.allow_hiring_browse}
                      onToggle={() => toggleRestriction('allow_hiring_browse')}
                    />
                  </div>
                </div>
              </section>
            )}

            {/* Danger Tab */}
            {activeTab === 'danger' && isOwner && (
              <section className="flex flex-col gap-4">
                <div className="flex items-center gap-3.5">
                  <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-red-500/15 text-red-400 shrink-0">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-[1.0625rem] font-semibold text-red-400 m-0 tracking-tight">Danger Zone</h2>
                    <p className="text-xs text-zinc-500 m-0 mt-0.5">Irreversible and destructive actions</p>
                  </div>
                </div>

                <div className="bg-red-500/[0.03] border border-red-500/15 rounded-xl overflow-hidden">
                  <div className="flex items-start gap-4 p-5 flex-wrap">
                    <div className="flex items-center justify-center w-11 h-11 rounded-[10px] bg-red-500/10 text-red-400 shrink-0">
                      <Trash2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-[200px]">
                      <h4 className="text-[0.9375rem] font-semibold text-red-400 m-0 mb-1.5">Delete Organization</h4>
                      <p className="text-[0.8125rem] text-zinc-500 m-0 leading-relaxed">
                        Permanently remove your organization and all of its contents. This action is not reversible — all
                        data, members, and settings will be deleted.
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setDeleteConfirmInput('')
                        setShowDeleteConfirm(true)
                      }}
                      disabled={deleting}
                      className="flex items-center gap-2 px-4 py-2.5 text-[0.8125rem] font-semibold bg-transparent text-red-400 border border-red-500/30 rounded-lg cursor-pointer transition-all duration-150 shrink-0 mt-2 hover:bg-red-500/10 hover:border-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      {deleting ? 'Deleting...' : 'Delete Organization'}
                    </button>
                  </div>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {/* ===== Save Success Toast ===== */}
      {saveSuccess && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-5 py-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-[10px] text-sm font-medium text-emerald-400 backdrop-blur-sm shadow-[0_10px_40px_rgba(0,0,0,0.3)] z-[100] animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle className="w-[18px] h-[18px]" />
          <span>Settings saved successfully</span>
        </div>
      )}

      {/* ===== Edit Profile Dialog ===== */}
      {showEditProfileDialog && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowEditProfileDialog(false)
          }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowEditProfileDialog(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-[480px] mx-4 max-h-[85vh] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            {/* Header */}
            <div className="relative flex flex-col items-center px-6 pt-6 pb-4 text-center border-b border-zinc-800 shrink-0">
              <button
                onClick={() => setShowEditProfileDialog(false)}
                disabled={saving}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-md text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
              <div className="flex items-center justify-center w-[52px] h-[52px] rounded-xl bg-cyan-500/15 text-cyan-400 mb-3.5">
                <Building2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white m-0 tracking-tight">Edit Organization Profile</h2>
              <p className="text-[0.8125rem] text-zinc-500 m-0 mt-1">Update your public organization information</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Basic Information */}
              <div>
                <h3 className="text-base font-semibold text-white m-0 mb-4 tracking-tight">Basic Information</h3>

                {/* Logo */}
                <div className="flex flex-col gap-2.5 mb-4">
                  <label className="text-sm font-medium text-white">Organization Logo</label>
                  <div className="flex items-start gap-5">
                    <div className="relative w-20 h-20 rounded-full bg-zinc-800/50 border-2 border-zinc-800 overflow-hidden flex items-center justify-center shrink-0">
                      {organization?.logo_url && !logoLoadError ? (
                        <img
                          src={organization.logo_url}
                          className="w-full h-full object-cover"
                          onError={() => setLogoLoadError(true)}
                        />
                      ) : (
                        <Building2 className="w-8 h-8 text-zinc-500" />
                      )}
                      {uploadingLogo && (
                        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 flex flex-col gap-2">
                      <input
                        ref={logoInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/gif,image/webp"
                        className="hidden"
                        onChange={handleLogoUpload}
                      />
                      <button
                        type="button"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={uploadingLogo}
                        className="flex items-center gap-2 self-start px-4 py-2.5 text-sm font-medium text-foreground bg-muted/40 border border-border rounded-lg cursor-pointer transition-all duration-150 hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Upload className="w-4 h-4" />
                        {organization?.logo_url ? 'Change Logo' : 'Upload Logo'}
                      </button>
                      <p className="text-xs text-zinc-500 m-0">JPEG, PNG, GIF, or WebP. Max 5MB.</p>
                    </div>
                  </div>
                </div>

                {/* Name */}
                <div className="flex flex-col gap-2.5 mb-4">
                  <label className="text-sm font-medium text-white">Organization Name</label>
                  <input
                    value={editData.name}
                    onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))}
                    type="text"
                    placeholder="Enter organization name"
                    className="w-full px-4 py-3 text-sm bg-zinc-800/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600/50 transition-all duration-150 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                  />
                </div>

                {/* Bio */}
                <div className="flex flex-col gap-2.5">
                  <label className="text-sm font-medium text-white">Bio</label>
                  <textarea
                    value={editData.bio}
                    onChange={(e) => setEditData((prev) => ({ ...prev, bio: e.target.value }))}
                    rows={4}
                    placeholder="Tell clippers about your organization..."
                    className="w-full px-4 py-3 text-sm bg-zinc-800/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600/50 resize-y min-h-[100px] leading-relaxed transition-all duration-150 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                  />
                  <p className="text-xs text-zinc-500 m-0">{(editData.bio || '').length}/500 characters</p>
                </div>
              </div>

              {/* Contact & Details */}
              <div>
                <h3 className="text-base font-semibold text-white m-0 mb-4 tracking-tight">Contact & Details</h3>

                <div className="flex flex-col gap-2.5 mb-4">
                  <label className="text-sm font-medium text-white">Website URL</label>
                  <input
                    value={editData.website_url}
                    onChange={(e) => setEditData((prev) => ({ ...prev, website_url: e.target.value }))}
                    type="text"
                    placeholder="https://yourwebsite.com"
                    className="w-full px-4 py-3 text-sm bg-zinc-800/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600/50 transition-all duration-150 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                  />
                </div>

                <div className="flex flex-col gap-2.5 mb-4">
                  <label className="text-sm font-medium text-white">Public Contact Email</label>
                  <input
                    value={editData.public_contact_email}
                    onChange={(e) => setEditData((prev) => ({ ...prev, public_contact_email: e.target.value }))}
                    type="email"
                    placeholder="contact@yourorg.com"
                    className="w-full px-4 py-3 text-sm bg-zinc-800/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600/50 transition-all duration-150 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                  />
                </div>

                <div className="flex flex-col gap-2.5 mb-4">
                  <label className="text-sm font-medium text-white">Discord</label>
                  <input
                    value={editData.public_discord}
                    onChange={(e) => setEditData((prev) => ({ ...prev, public_discord: e.target.value }))}
                    type="text"
                    maxLength={500}
                    placeholder="Invite link (discord.gg/…), server URL, or invite code"
                    className="w-full px-4 py-3 text-sm bg-zinc-800/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600/50 transition-all duration-150 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                  />
                </div>

                <div className="flex flex-col gap-2.5 mb-4">
                  <label className="text-sm font-medium text-white">Telegram</label>
                  <input
                    value={editData.public_telegram}
                    onChange={(e) => setEditData((prev) => ({ ...prev, public_telegram: e.target.value }))}
                    type="text"
                    maxLength={500}
                    placeholder="@username or https://t.me/username"
                    className="w-full px-4 py-3 text-sm bg-zinc-800/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600/50 transition-all duration-150 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                  />
                </div>

                <div className="flex flex-col gap-2.5">
                  <label className="text-sm font-medium text-white">Description</label>
                  <textarea
                    value={editData.description}
                    onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
                    rows={3}
                    placeholder="A brief description for internal use..."
                    className="w-full px-4 py-3 text-sm bg-zinc-800/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600/50 resize-y min-h-[80px] leading-relaxed transition-all duration-150 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/15"
                  />
                </div>
              </div>

              {/* Content Specialties */}
              <div>
                <h3 className="text-base font-semibold text-white m-0 mb-4 tracking-tight">Content Specialties</h3>
                <div className="flex flex-col gap-2.5">
                  <label className="text-sm font-medium text-white">Content Types</label>
                  <div className="flex flex-wrap gap-2">
                    {SPECIALTY_TAGS.map((tag) => (
                      <button
                        key={tag.value}
                        type="button"
                        onClick={() => toggleArrayTag(tag.value)}
                        className={`px-2.5 py-1.5 rounded-full border text-xs cursor-pointer transition-all ${
                          editData.content_type_tags.includes(tag.value)
                            ? 'bg-cyan-500/15 border-cyan-500/45 text-cyan-400'
                            : 'bg-zinc-800/70 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-600'
                        }`}
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2.5 px-6 py-5 border-t border-zinc-800 shrink-0">
              <button
                onClick={() => setShowEditProfileDialog(false)}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg cursor-pointer transition-all duration-150 bg-zinc-800/50 text-white border border-zinc-800 hover:bg-zinc-800 hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={saveAndCloseProfileDialog}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg border-none cursor-pointer transition-all duration-150 bg-gradient-to-br from-cyan-400 to-cyan-600 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Delete Confirmation Modal ===== */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteConfirm(false)
          }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-[440px] mx-4 max-h-[85vh] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            <div className="h-[3px] shrink-0 bg-gradient-to-r from-red-500 to-red-500/50" />

            <div className="relative flex flex-col items-center px-6 pt-6 pb-4 text-center">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-md text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X className="w-[18px] h-[18px]" />
              </button>
              <div className="flex items-center justify-center w-[52px] h-[52px] rounded-xl bg-red-500/15 text-red-400 mb-3.5">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white m-0 tracking-tight">Delete Organization</h2>
              <p className="text-[0.8125rem] text-zinc-500 m-0 mt-1">This action cannot be undone</p>
            </div>

            <div className="flex-1 overflow-y-auto px-6">
              <div className="flex items-center gap-3.5 p-4 bg-zinc-800/30 rounded-[10px] mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-zinc-900 text-zinc-500 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[0.9375rem] font-semibold text-white truncate">{organization?.name}</span>
                  <span className="text-xs text-zinc-500 mt-0.5">Organization</span>
                </div>
              </div>

              <div className="mb-3">
                <p className="text-sm text-zinc-500 leading-relaxed m-0">
                  Type <strong className="text-white">{organization?.name}</strong> to confirm deletion:
                </p>
              </div>

              <input
                value={deleteConfirmInput}
                onChange={(e) => setDeleteConfirmInput(e.target.value)}
                type="text"
                placeholder={organization?.name}
                className="w-full px-4 py-3 text-sm bg-zinc-800/50 border border-zinc-800 rounded-lg text-white placeholder-zinc-600/50 transition-all duration-150 focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/15"
              />
            </div>

            <div className="flex gap-2.5 px-6 py-5 border-t border-zinc-800 mt-4">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg cursor-pointer transition-all duration-150 bg-zinc-800/50 text-white border border-zinc-800 hover:bg-zinc-800 hover:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={executeDelete}
                disabled={deleting || deleteConfirmInput !== organization?.name}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold rounded-lg border-none cursor-pointer transition-all duration-150 bg-gradient-to-br from-red-500 to-red-600 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}

/* ===== Stat Card Component ===== */
function StatCard({ icon, value, label, colorClass }: { icon: React.ReactNode; value: string; label: string; colorClass: string }) {
  return (
    <div className="flex items-center gap-4 p-5 bg-muted/30 border border-border rounded-xl transition-all duration-200 hover:border-white/10 hover:-translate-y-0.5 hover:shadow-md">
      <div className={`flex items-center justify-center w-12 h-12 rounded-xl shrink-0 ${colorClass}`}>
        {icon}
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-[1.75rem] font-bold text-foreground tracking-tight leading-none tabular-nums">{value}</span>
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-widest">{label}</span>
      </div>
    </div>
  )
}

/* ===== Tab Button Component ===== */
function TabButton({ label, icon, active, onClick }: { label: string; icon: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-[1.125rem] py-3 rounded-lg text-[0.8125rem] font-semibold whitespace-nowrap border-none cursor-pointer transition-all duration-[180ms] ${
        active
          ? 'bg-gradient-to-br from-cyan-500/15 to-purple-500/15 text-cyan-400 shadow-[0_2px_8px_rgba(6,182,212,0.2)]'
          : 'bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
      }`}
    >
      <span className="flex items-center justify-center w-[18px] h-[18px] [&>svg]:w-full [&>svg]:h-full">
        {icon}
      </span>
      <span className="max-sm:hidden">{label}</span>
    </button>
  )
}

/* ===== Toggle Switch Component ===== */
function Toggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      className={`relative w-12 h-[26px] rounded-full border-none cursor-pointer transition-colors duration-200 shrink-0 mt-1 ${
        active ? 'bg-purple-500' : 'bg-zinc-600'
      }`}
    >
      <span
        className={`absolute top-[3px] left-[3px] w-5 h-5 bg-white rounded-full shadow-[0_2px_4px_rgba(0,0,0,0.2)] transition-transform duration-200 ${
          active ? 'translate-x-[22px]' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

/* ===== Restriction Item Component ===== */
function RestrictionItem({
  title,
  desc,
  active,
  onToggle
}: {
  title: string
  desc: string
  active: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex items-start gap-3 justify-between">
      <div className="flex-1 min-w-0">
        <div className="text-[0.8125rem] font-medium text-white mb-0.5">{title}</div>
        <div className="text-[0.6875rem] text-zinc-500 leading-snug">{desc}</div>
      </div>
      <Toggle active={active} onToggle={onToggle} />
    </div>
  )
}
