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
  FileText,
  Sparkles,
  Zap,
  Archive,
  CheckCircle,
  UserCircle,
  Upload,
  Loader2,
  AlertTriangle,
  Trash2,
  X
} from 'lucide-react'
import type { OrganizationRestrictionDefaults } from '@/types/organization'
import { SPECIALTY_TAGS } from '@/services/clipperApi'

interface EditData {
  name: string
  description: string
  bio: string
  website_url: string
  public_contact_email: string
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
    content_type_tags: [],
    settings: { allow_ai: true },
    restriction_defaults: { ...DEFAULT_RESTRICTIONS }
  })
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmInput, setDeleteConfirmInput] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    loadOrganization()
  }, [loadOrganization])

  // Populate edit form when organization data loads
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

  // Reset logo load error when logo_url changes
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

  function toggleRestriction(key: keyof typeof editData.restriction_defaults) {
    setEditData((prev) => ({
      ...prev,
      restriction_defaults: { ...prev.restriction_defaults, [key]: !prev.restriction_defaults[key] }
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
      title={!hasMultipleOrgs ? "Organization Settings" : undefined}
      titleComponent={hasMultipleOrgs ? <OrganizationSelector /> : undefined}
      description="Manage your organization profile and preferences"
      actions={
        <div className="flex items-center gap-2">
          {organization?.slug && (
            <a href={`/orgs/${organization.slug}`} className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md border border-zinc-700 text-zinc-200 no-underline">
              Preview Public Profile
            </a>
          )}
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
      <div className="w-full max-w-3xl mx-auto space-y-8 pt-4">

        {/* ===== Organization Profile Section ===== */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Basic Information</h3>
          <div className="bg-card border border-border/60 rounded-xl overflow-hidden">
            {/* Logo Row */}
            <div className="p-5 border-b border-zinc-800">
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-white">
                  <Building2 className="w-4 h-4 text-zinc-500" />
                  Organization Logo
                </label>
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
            </div>

            {/* Name Row */}
            <div className="p-5 border-b border-zinc-800">
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-white">
                  <Type className="w-4 h-4 text-zinc-500" />
                  Organization Name
                </label>
                <input
                  value={editData.name}
                  onChange={(e) => setEditData((prev) => ({ ...prev, name: e.target.value }))}
                  type="text"
                  placeholder="Enter organization name"
                  className="w-full px-4 py-3 text-sm bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>

            {/* Description Row */}
            <div className="p-5">
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-white">
                  <FileText className="w-4 h-4 text-zinc-500" />
                  Description
                </label>
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData((prev) => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  placeholder="A brief description of your organization..."
                  className="w-full px-4 py-3 text-sm bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground resize-y min-h-[100px] leading-relaxed transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>
            <div className="p-5 border-t border-zinc-800">
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-white">Bio</label>
                <textarea value={editData.bio} onChange={(e) => setEditData((prev) => ({ ...prev, bio: e.target.value }))} rows={4} className="w-full px-4 py-3 text-sm bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground" />
              </div>
            </div>
            <div className="p-5 border-t border-zinc-800">
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-white">Website URL</label>
                <input value={editData.website_url} onChange={(e) => setEditData((prev) => ({ ...prev, website_url: e.target.value }))} className="w-full px-4 py-3 text-sm bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground" />
              </div>
            </div>
            <div className="p-5 border-t border-zinc-800">
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-white">Public Contact Email</label>
                <input value={editData.public_contact_email} onChange={(e) => setEditData((prev) => ({ ...prev, public_contact_email: e.target.value }))} className="w-full px-4 py-3 text-sm bg-muted/30 border border-border rounded-lg text-foreground placeholder:text-muted-foreground" />
              </div>
            </div>
            <div className="p-5 border-t border-zinc-800">
              <div className="flex flex-col gap-2.5">
                <label className="flex items-center gap-2 text-sm font-medium text-white">Content Type</label>
                <div className="flex flex-wrap gap-1.5">
                  {SPECIALTY_TAGS.map((tag) => (
                    <button
                      key={tag.value}
                      type="button"
                      onClick={() =>
                        setEditData((prev) => ({
                          ...prev,
                          content_type_tags: prev.content_type_tags.includes(tag.value)
                            ? prev.content_type_tags.filter((v) => v !== tag.value)
                            : [...prev.content_type_tags, tag.value]
                        }))
                      }
                      className={`px-2.5 py-1 rounded-full border text-xs cursor-pointer transition-all ${
                        editData.content_type_tags.includes(tag.value)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== AI Features Section ===== */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">AI Features</h3>

          <div
            className="bg-card border border-border/60 rounded-xl cursor-pointer transition-all duration-200 hover:border-border hover:bg-muted/10"
            onClick={() =>
              setEditData((prev) => ({ ...prev, settings: { ...prev.settings, allow_ai: !prev.settings.allow_ai } }))
            }
          >
            <div className="flex items-start gap-4 p-5">
              <div
                className={`flex items-center justify-center w-11 h-11 rounded-[10px] shrink-0 transition-all duration-200 ${
                  editData.settings.allow_ai ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'
                }`}
              >
                <Zap className="w-[22px] h-[22px]" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[0.9375rem] font-semibold text-foreground mb-1.5">Enable AI Features</div>
                <div className="text-[0.8125rem] text-muted-foreground leading-relaxed mb-3">
                  Allow members to use AI-powered features like auto-captions, clip finder, smart transcription, and
                  more
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

        {/* ===== Restricted Member Settings Section ===== */}
        <section className="space-y-4">
          <h3 className="text-lg font-semibold text-foreground">Restricted Member Settings</h3>

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

        {/* ===== Danger Zone (Owner Only) ===== */}
        {isOwner && (
          <section className="flex flex-col gap-4 mt-4">
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

      {/* Save Success Toast */}
      {saveSuccess && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2.5 px-5 py-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-[10px] text-sm font-medium text-emerald-400 backdrop-blur-sm shadow-[0_10px_40px_rgba(0,0,0,0.3)] z-[100] animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle className="w-[18px] h-[18px]" />
          <span>Settings saved successfully</span>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowDeleteConfirm(false)
          }}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-[440px] mx-4 max-h-[85vh] flex flex-col overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
            {/* Red accent bar */}
            <div className="h-[3px] shrink-0 bg-gradient-to-r from-red-500 to-red-500/50" />

            {/* Header */}
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6">
              {/* Preview card */}
              <div className="flex items-center gap-3.5 p-4 bg-zinc-800/30 rounded-[10px] mb-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-[10px] bg-zinc-900 text-zinc-500 shrink-0">
                  <Building2 className="w-5 h-5" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[0.9375rem] font-semibold text-white truncate">{organization?.name}</span>
                  <span className="text-xs text-zinc-500 mt-0.5">Organization</span>
                </div>
              </div>

              {/* Warning */}
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

            {/* Footer */}
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
