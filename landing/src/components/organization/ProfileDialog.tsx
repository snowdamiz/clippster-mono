import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  createOrganizationCreatorProfile,
  updateOrganizationCreatorProfile,
  addPlatformLink,
  deletePlatformLink,
  listOrganizationAssets,
  uploadOrganizationAsset,
} from '@/services/organizationApi'
import { useOrganization } from '@/hooks/useOrganization'
import { useToast } from '@/hooks/useToast'
import type { ServerOrganizationCreatorProfile, ServerOrganizationAsset, LayoutOverlay } from '@/types/organization'
import {
  UserCircle, Plus, X, Play, SkipForward, Image as ImageIcon,
  Loader2, Upload, ChevronDown, Trash2, Users, Paintbrush, Layers, Settings2,
} from 'lucide-react'
import { WatermarkPositionPicker, type CreatorWatermarkSettings } from './WatermarkPositionPicker'
import { OverlayPositionPicker, type PerRatioOverlaySettings } from './OverlayPositionPicker'
import { IntroOutroRatioPicker, type RatioAssetMap } from './IntroOutroRatioPicker'

type PlatformId = 'pumpfun' | 'kick' | 'twitch' | 'youtube'

interface PlatformLinkInput {
  platform: PlatformId
  platform_id: string
  display_name: string
  profile_image_url?: string
  is_primary: boolean
  id?: number
  isNew?: boolean
}

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
  profile?: ServerOrganizationCreatorProfile | null
  scope?: 'streamer' | 'global'
}

const PLATFORMS = [
  { id: 'pumpfun' as PlatformId, name: 'PumpFun', disabled: false },
  { id: 'kick' as PlatformId, name: 'Kick', disabled: false },
  { id: 'twitch' as PlatformId, name: 'Twitch', disabled: false },
  { id: 'youtube' as PlatformId, name: 'YouTube', disabled: true },
]

function getPlatformIcon(platform: string): string {
  const icons: Record<string, string> = { pumpfun: '/capsule.svg', kick: '/kick.svg', twitch: '/twitch.svg', youtube: '/youtube.svg' }
  return icons[platform] || '/capsule.svg'
}

function getPlatformColor(platform: string): string {
  const colors: Record<string, string> = { pumpfun: '#10b981', kick: '#53FC18', twitch: '#9146FF', youtube: '#dc2626' }
  return colors[platform] || '#6b7280'
}

function getPlatformName(platform: string): string {
  const names: Record<string, string> = { pumpfun: 'PumpFun', kick: 'Kick', twitch: 'Twitch', youtube: 'YouTube' }
  return names[platform] || platform
}

export function ProfileDialog({ open, onClose, onSuccess, profile, scope: scopeProp }: Props) {
  const { organizationId } = useOrganization()
  const toast = useToast()

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [scope, setScope] = useState<'streamer' | 'global'>('streamer')
  const [introId, setIntroId] = useState<number | null>(null)
  const [outroId, setOutroId] = useState<number | null>(null)
  const [watermarkId, setWatermarkId] = useState<number | null>(null)
  const [watermarkSettings, setWatermarkSettings] = useState<Record<string, unknown> | null>(null)
  const [layoutOverlays, setLayoutOverlays] = useState<LayoutOverlay[]>([])
  const [platformLinks, setPlatformLinks] = useState<PlatformLinkInput[]>([])

  // UI state
  const [saving, setSaving] = useState(false)
  const [assets, setAssets] = useState<ServerOrganizationAsset[]>([])
  const [openPlatformDropdown, setOpenPlatformDropdown] = useState<number | null>(null)
  const [openAssetDropdown, setOpenAssetDropdown] = useState<'intro' | 'outro' | 'watermark' | null>(null)
  const [uploadingIntro, setUploadingIntro] = useState(false)
  const [uploadingOutro, setUploadingOutro] = useState(false)
  const [uploadingWatermark, setUploadingWatermark] = useState(false)
  const [uploadingOverlay, setUploadingOverlay] = useState(false)
  const [showOverlayDropdown, setShowOverlayDropdown] = useState(false)
  const [showWatermarkPositionPicker, setShowWatermarkPositionPicker] = useState(false)
  const [showOverlayPositionPicker, setShowOverlayPositionPicker] = useState(false)
  const [activeOverlayIndex, setActiveOverlayIndex] = useState(-1)
  const [showIntroOutroRatioPicker, setShowIntroOutroRatioPicker] = useState(false)
  const [ratioPickerMode, setRatioPickerMode] = useState<'intro' | 'outro'>('intro')
  const [introRatioSettings, setIntroRatioSettings] = useState<string | null>(null)
  const [outroRatioSettings, setOutroRatioSettings] = useState<string | null>(null)
  const [fetchingMetadata, setFetchingMetadata] = useState<number | null>(null)

  // Refs
  const introFileRef = useRef<HTMLInputElement>(null)
  const outroFileRef = useRef<HTMLInputElement>(null)
  const watermarkFileRef = useRef<HTMLInputElement>(null)
  const overlayFileRef = useRef<HTMLInputElement>(null)

  const isEditing = !!profile

  // Computed asset lists
  const introAssets = assets.filter(a => a.asset_type === 'intro')
  const outroAssets = assets.filter(a => a.asset_type === 'outro')
  const watermarkAssets = assets.filter(a => a.asset_type === 'watermark')

  // Load assets and populate form when dialog opens
  useEffect(() => {
    if (!open) return
    setOpenPlatformDropdown(null)
    setOpenAssetDropdown(null)

    // Load org assets
    if (organizationId) {
      listOrganizationAssets(Number(organizationId)).then(res => {
        if (res.success) setAssets(res.assets)
      })
    }

    // Populate form
    if (profile) {
      setName(profile.name)
      setDescription(profile.description || '')
      setIntroId(profile.intro_id ?? null)
      setOutroId(profile.outro_id ?? null)
      setWatermarkId(profile.watermark_id ?? null)
      setWatermarkSettings((profile.watermark_settings as Record<string, unknown>) || null)
      setLayoutOverlays((profile.layout_overlays as LayoutOverlay[]) || [])
      setIntroRatioSettings((profile as any).intro_ratio_settings || null)
      setOutroRatioSettings((profile as any).outro_ratio_settings || null)
      setScope(((profile as any).scope as 'streamer' | 'global') || scopeProp || 'streamer')
      setPlatformLinks(
        (profile.platform_links || []).map(link => ({
          id: link.id,
          platform: link.platform as PlatformId,
          platform_id: link.platform_id,
          display_name: link.display_name || '',
          profile_image_url: link.profile_image_url || '',
          is_primary: link.is_primary,
          isNew: false,
        }))
      )
    } else {
      setName('')
      setDescription('')
      setIntroId(null)
      setOutroId(null)
      setWatermarkId(null)
      setWatermarkSettings(null)
      setLayoutOverlays([])
      setIntroRatioSettings(null)
      setOutroRatioSettings(null)
      setScope(scopeProp || 'streamer')
      setPlatformLinks([])
    }
  }, [open, profile, organizationId, scopeProp])

  // Close dropdowns on outside click
  useEffect(() => {
    if (!open) return
    const handler = () => { setOpenPlatformDropdown(null); setOpenAssetDropdown(null); setShowOverlayDropdown(false) }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [open])

  // Platform link helpers
  const addNewPlatformLink = () => {
    setPlatformLinks(prev => [...prev, {
      platform: 'pumpfun',
      platform_id: '',
      display_name: '',
      is_primary: prev.length === 0,
      isNew: true,
    }])
  }

  const removePlatformLink = (index: number) => {
    setPlatformLinks(prev => {
      const next = [...prev]
      const removed = next.splice(index, 1)[0]
      if (removed.is_primary && next.length > 0) next[0].is_primary = true
      return next
    })
  }

  const updateLink = (index: number, patch: Partial<PlatformLinkInput>) => {
    setPlatformLinks(prev => prev.map((l, i) => i === index ? { ...l, ...patch } : l))
  }

  const setPrimaryLink = (index: number) => {
    setPlatformLinks(prev => prev.map((l, i) => ({ ...l, is_primary: i === index })))
  }

  // Asset name helpers
  const getAssetName = (id: number | null, fallback: string) => {
    if (!id) return fallback
    const asset = assets.find(a => a.id === id)
    return asset?.name || fallback
  }

  // Profile image from platform links
  const getProfileImageFromLinks = (): string | undefined => {
    const primary = platformLinks.find(l => l.is_primary && l.profile_image_url)
    if (primary?.profile_image_url) return primary.profile_image_url
    const any = platformLinks.find(l => l.profile_image_url)
    return any?.profile_image_url || undefined
  }

  // Fetch platform metadata (avatar) when platform ID is entered
  const fetchPlatformMetadata = async (index: number, platform: PlatformId, platformId: string) => {
    if (!platformId.trim()) return
    
    setFetchingMetadata(index)
    try {
      if (platform === 'kick') {
        // Use server proxy to avoid CORS
        const response = await fetch(`/api/kick/channels/${platformId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.profileImageUrl) {
            updateLink(index, { 
              profile_image_url: data.profileImageUrl, 
              display_name: data.username || platformId 
            })
          }
        }
      } else if (platform === 'twitch') {
        // Use server proxy to avoid CORS
        const response = await fetch(`/api/twitch/channels/${platformId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.profileImageUrl) {
            updateLink(index, { 
              profile_image_url: data.profileImageUrl, 
              display_name: data.displayName || platformId 
            })
          }
        }
      } else if (platform === 'pumpfun') {
        // Use server proxy for PumpFun metadata
        const response = await fetch(`/api/metadata/${platformId}`)
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.metadata?.image) {
            updateLink(index, { 
              profile_image_url: data.metadata.image, 
              display_name: data.metadata.name || platformId 
            })
          }
        }
      }
    } catch (err) {
      console.error('[ProfileDialog] Failed to fetch platform metadata:', err)
    } finally {
      setFetchingMetadata(null)
    }
  }

  // Upload handlers
  const handleFileUpload = async (file: File, type: 'intro' | 'outro' | 'watermark') => {
    if (!organizationId) return
    const setUploading = type === 'intro' ? setUploadingIntro : type === 'outro' ? setUploadingOutro : setUploadingWatermark
    setUploading(true)
    try {
      const assetName = file.name.replace(/\.[^/.]+$/, '')
      const res = await uploadOrganizationAsset(Number(organizationId), file, type, assetName)
      if (res.success && res.asset) {
        setAssets(prev => [...prev, res.asset!])
        if (type === 'intro') setIntroId(res.asset.id)
        else if (type === 'outro') setOutroId(res.asset.id)
        else setWatermarkId(res.asset.id)
        toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded`, `"${res.asset.name}" has been uploaded`)
      } else {
        toast.error('Upload failed', res.error || 'Failed to upload asset')
      }
    } catch (err: any) {
      toast.error('Upload failed', err.message || 'Failed to upload asset')
    } finally {
      setUploading(false)
    }
  }

  // Intro/Outro ratio picker handlers
  const openRatioPicker = (mode: 'intro' | 'outro') => {
    setRatioPickerMode(mode)
    setShowIntroOutroRatioPicker(true)
  }

  const handleRatioSettingsSave = (settings: RatioAssetMap) => {
    const settingsJson = JSON.stringify(settings)
    if (ratioPickerMode === 'intro') {
      setIntroRatioSettings(settingsJson)
    } else {
      setOutroRatioSettings(settingsJson)
    }
    setShowIntroOutroRatioPicker(false)
  }

  const getInitialRatioSettings = (mode: 'intro' | 'outro'): RatioAssetMap | null => {
    const raw = mode === 'intro' ? introRatioSettings : outroRatioSettings
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  }

  const hasIntroRatioConfig = (): boolean => {
    if (!introRatioSettings) return false
    try {
      const settings = JSON.parse(introRatioSettings)
      return Object.values(settings).some(config => config !== null)
    } catch {
      return false
    }
  }

  const hasOutroRatioConfig = (): boolean => {
    if (!outroRatioSettings) return false
    try {
      const settings = JSON.parse(outroRatioSettings)
      return Object.values(settings).some(config => config !== null)
    } catch {
      return false
    }
  }

  // Position picker handlers
  const openWatermarkPositionPicker = () => {
    setShowWatermarkPositionPicker(true)
  }

  const handleWatermarkSettingsSave = (settings: CreatorWatermarkSettings) => {
    setWatermarkSettings(settings as unknown as Record<string, unknown>)
    setShowWatermarkPositionPicker(false)
  }

  const openOverlayPositionPicker = (idx: number) => {
    setActiveOverlayIndex(idx)
    setShowOverlayPositionPicker(true)
  }

  const handleOverlayPositionSave = (settings: PerRatioOverlaySettings) => {
    if (activeOverlayIndex < 0 || activeOverlayIndex >= layoutOverlays.length) return

    const updatedOverlays = [...layoutOverlays]
    updatedOverlays[activeOverlayIndex] = {
      ...updatedOverlays[activeOverlayIndex],
      perRatioSettings: settings as unknown as Record<string, unknown>,
    }
    setLayoutOverlays(updatedOverlays)
    setShowOverlayPositionPicker(false)
  }

  // Clean overlay data for server - strip local-only fields
  const cleanOverlaysForServer = (overlays: LayoutOverlay[]): LayoutOverlay[] => {
    return overlays.map(overlay => {
      const { imagePath, imageUrl, ...rest } = overlay as any
      const cleaned: any = { ...rest }
      // Strip imagePath/imageUrl from perRatioSettings too
      if (cleaned.perRatioSettings && typeof cleaned.perRatioSettings === 'object') {
        const cleanedPRS: any = {}
        for (const [ratio, config] of Object.entries(cleaned.perRatioSettings)) {
          if (config && typeof config === 'object') {
            const { imagePath: _ip, imageUrl: _iu, ...ratioRest } = config as any
            cleanedPRS[ratio] = ratioRest
          } else {
            cleanedPRS[ratio] = config
          }
        }
        cleaned.perRatioSettings = cleanedPRS
      }
      return cleaned
    })
  }

  // Submit
  const handleSubmit = async () => {
    if (!name.trim() || !organizationId) return
    setSaving(true)
    try {
      const profileImageUrl = getProfileImageFromLinks()
      let savedProfile: ServerOrganizationCreatorProfile | undefined

      if (isEditing && profile) {
        const res = await updateOrganizationCreatorProfile(Number(organizationId), profile.id, {
          name: name.trim(),
          description: description.trim() || null,
          profile_image_url: profileImageUrl || null,
          intro_id: introId,
          outro_id: outroId,
          watermark_id: watermarkId,
          watermark_settings: watermarkSettings,
          layout_overlays: layoutOverlays.length > 0 ? cleanOverlaysForServer(layoutOverlays) : null,
          intro_ratio_settings: introRatioSettings,
          outro_ratio_settings: outroRatioSettings,
          scope,
        })
        if (!res.success || !res.profile) throw new Error(res.error || 'Failed to update profile')
        savedProfile = res.profile

        // Delete removed links
        const existingLinks = profile.platform_links || []
        for (const existing of existingLinks) {
          if (!platformLinks.some(l => l.id === existing.id)) {
            await deletePlatformLink(Number(organizationId), profile.id, existing.id)
          }
        }

        // Add new links
        for (const link of platformLinks) {
          if (link.isNew && link.platform_id.trim()) {
            await addPlatformLink(Number(organizationId), profile.id, {
              platform: link.platform,
              platform_id: link.platform_id.trim(),
              display_name: link.display_name || undefined,
              profile_image_url: link.profile_image_url || undefined,
              is_primary: link.is_primary,
            })
          }
        }

        toast.success('Profile Updated', `"${savedProfile.name}" has been updated`)
      } else {
        const res = await createOrganizationCreatorProfile(Number(organizationId), {
          name: name.trim(),
          description: description.trim() || undefined,
          profile_image_url: profileImageUrl,
          intro_id: introId,
          outro_id: outroId,
          watermark_id: watermarkId,
          watermark_settings: watermarkSettings || undefined,
          layout_overlays: layoutOverlays.length > 0 ? cleanOverlaysForServer(layoutOverlays) : undefined,
          intro_ratio_settings: introRatioSettings || undefined,
          outro_ratio_settings: outroRatioSettings || undefined,
          scope,
        })
        if (!res.success || !res.profile) throw new Error(res.error || 'Failed to create profile')
        savedProfile = res.profile

        // Add platform links
        for (const link of platformLinks) {
          if (link.platform_id.trim()) {
            await addPlatformLink(Number(organizationId), savedProfile.id, {
              platform: link.platform,
              platform_id: link.platform_id.trim(),
              display_name: link.display_name || undefined,
              profile_image_url: link.profile_image_url || undefined,
              is_primary: link.is_primary,
            })
          }
        }

        toast.success('Profile Created', `"${savedProfile.name}" has been created`)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      toast.error('Save Failed', err.message || 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  return createPortal(
    <div className="org-dialog__overlay" onClick={e => { if (e.target === e.currentTarget && !saving) onClose() }}>
      <div className="org-dialog org-dialog--cyan org-dialog--lg" onClick={() => { setOpenPlatformDropdown(null); setOpenAssetDropdown(null) }}>
        {/* Accent Bar */}
        <div className="org-dialog__accent org-dialog__accent--cyan" />

        {/* Header */}
        <div className="org-dialog__header">
          <button className="org-dialog__close" onClick={onClose} title="Close"><X size={18} /></button>
          <div className="org-dialog__icon org-dialog__icon--cyan">
            {scope === 'global' ? <Paintbrush size={24} /> : <UserCircle size={24} />}
          </div>
          <h2 className="org-dialog__title">
            {scope === 'global'
              ? (isEditing ? 'Edit Global Branding' : 'Create Global Branding')
              : (isEditing ? 'Edit Creator Profile' : 'Create Creator Profile')}
          </h2>
          <p className="org-dialog__subtitle">
            {scope === 'global'
              ? (isEditing
                ? 'Update default branding applied to content without a creator profile'
                : 'Set default intro, outro, and watermark for content without a specific creator profile')
              : (isEditing ? 'Update profile details and platform links' : 'Add a new creator with platform connections')}
          </p>
        </div>

        {/* Content */}
        <div className="org-dialog__content">
          {/* Basic Info */}
          <div className="org-dialog__section">
            <h3 className="org-dialog__section-title">Basic Info</h3>
            <div className="org-dialog__section-items">
              <div className="org-dialog__field">
                <label className="org-dialog__label">Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder={scope === 'global' ? 'Branding profile name' : 'Creator name'} className="org-dialog__input" />
              </div>
              <div className="org-dialog__field">
                <label className="org-dialog__label">Description <span className="org-dialog__label-hint">(optional)</span></label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder={scope === 'global' ? 'e.g. Default branding for all content' : 'Brief description of this creator...'} className="org-dialog__input org-dialog__textarea" />
              </div>
            </div>
          </div>

          {/* Platform Links (hidden for global branding profiles) */}
          {scope !== 'global' && <div className="org-dialog__section">
            <div className="org-dialog__section-header">
              <h3 className="org-dialog__section-title">Platform Links</h3>
              <button type="button" onClick={addNewPlatformLink} className="org-dialog__add-btn">
                <Plus size={14} /><span>Add Platform</span>
              </button>
            </div>

            {platformLinks.length === 0 ? (
              <div className="org-dialog__empty-state">
                <p className="org-dialog__empty-text">No platforms added yet</p>
                <button onClick={addNewPlatformLink} className="org-dialog__empty-link">Add your first platform</button>
              </div>
            ) : (
              <div className="org-dialog__section-items">
                {platformLinks.map((link, index) => (
                  <div key={index} className="org-dialog__platform-card">
                    <div className="org-dialog__platform-header">
                      <div className="org-dialog__platform-left">
                        {/* Avatar */}
                        <div className="org-dialog__platform-avatar">
                          {link.profile_image_url ? (
                            <img src={link.profile_image_url} className="org-dialog__platform-avatar-img" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                          ) : (
                            <Users className="org-dialog__platform-avatar-icon" />
                          )}
                        </div>

                        {/* Platform Dropdown */}
                        <div className="org-dialog__dropdown-wrapper">
                          <button type="button" onClick={e => { e.stopPropagation(); setOpenPlatformDropdown(openPlatformDropdown === index ? null : index) }} className="org-dialog__platform-select">
                            <div className="org-dialog__platform-select-icon" style={{ backgroundColor: getPlatformColor(link.platform) }}>
                              <img src={getPlatformIcon(link.platform)} className="org-dialog__platform-select-icon-img" />
                            </div>
                            <span className="org-dialog__platform-select-label">{getPlatformName(link.platform)}</span>
                            <ChevronDown className={`org-dialog__chevron ${openPlatformDropdown === index ? 'org-dialog__chevron--open' : ''}`} />
                          </button>

                          {openPlatformDropdown === index && (
                            <div className="org-dialog__dropdown" onClick={e => e.stopPropagation()}>
                              <div className="org-dialog__dropdown-list">
                                {PLATFORMS.map(p => (
                                  <button key={p.id} type="button" disabled={p.disabled}
                                    className={`org-dialog__dropdown-item ${p.disabled ? 'org-dialog__dropdown-item--disabled' : ''} ${link.platform === p.id ? 'org-dialog__dropdown-item--active' : ''}`}
                                    onClick={() => { updateLink(index, { platform: p.id }); setOpenPlatformDropdown(null) }}
                                  >
                                    <div className="org-dialog__platform-select-icon" style={{ backgroundColor: getPlatformColor(p.id) }}>
                                      <img src={getPlatformIcon(p.id)} className="org-dialog__platform-select-icon-img" />
                                    </div>
                                    <span className={p.disabled ? 'org-dialog__text-muted' : ''}>{p.name}</span>
                                    {p.disabled && <span className="org-dialog__dropdown-badge">Soon</span>}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="org-dialog__platform-actions">
                        <label className="org-dialog__platform-primary">
                          <input type="radio" name={`primary-${index}`} checked={link.is_primary} onChange={() => setPrimaryLink(index)} />
                          Primary
                        </label>
                        <button type="button" onClick={() => removePlatformLink(index)} className="org-dialog__platform-delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <div className="org-dialog__platform-fields">
                      <div className="org-dialog__field">
                        <label className="org-dialog__label org-dialog__label--sm">
                          {link.platform === 'pumpfun' ? 'Mint ID or URL' : 'Channel Slug or URL'} *
                        </label>
                        <input
                          value={link.platform_id}
                          onChange={e => updateLink(index, { platform_id: e.target.value })}
                          onBlur={e => {
                            const value = e.target.value.trim()
                            if (value && !link.profile_image_url) {
                              fetchPlatformMetadata(index, link.platform, value)
                            }
                          }}
                          placeholder={link.platform === 'pumpfun' ? 'Enter mint ID or paste PumpFun URL' : 'Enter channel slug or paste URL'}
                          className="org-dialog__input org-dialog__input--sm"
                          disabled={fetchingMetadata === index}
                        />
                        {fetchingMetadata === index && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.75rem', color: '#6b7280' }}>
                            <Loader2 size={12} className="org-dialog__spin" />
                            <span>Fetching avatar...</span>
                          </div>
                        )}
                      </div>
                      <div className="org-dialog__field">
                        <label className="org-dialog__label org-dialog__label--sm">Display Name</label>
                        <input
                          value={link.display_name}
                          onChange={e => updateLink(index, { display_name: e.target.value })}
                          placeholder="Optional display name"
                          className="org-dialog__input org-dialog__input--sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>}

          {/* Asset Selection */}
          <div className="org-dialog__section" onClick={e => { e.stopPropagation(); setOpenAssetDropdown(null) }}>
            <h3 className="org-dialog__section-title">Default Assets</h3>
            <p className="org-dialog__section-desc">Configure default intro, outro, and watermark for this creator's content.</p>

            <div className="org-dialog__section-items">
              {/* Intro */}
              <div className="org-dialog__asset-row">
                <label className="org-dialog__asset-label">Intro</label>
                <div className="org-dialog__asset-controls">
                  <div className="org-dialog__dropdown-wrapper org-dialog__flex-1">
                    <button type="button" onClick={e => { e.stopPropagation(); setOpenAssetDropdown(openAssetDropdown === 'intro' ? null : 'intro') }} disabled={uploadingIntro} className="org-dialog__asset-select">
                      <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--intro"><Play size={14} /></div>
                      <span className="org-dialog__asset-select-label">{getAssetName(introId, 'No intro')}</span>
                      <ChevronDown className={`org-dialog__chevron ${openAssetDropdown === 'intro' ? 'org-dialog__chevron--open' : ''}`} />
                    </button>
                    {openAssetDropdown === 'intro' && (
                      <div className="org-dialog__dropdown org-dialog__dropdown--full" onClick={e => e.stopPropagation()}>
                        <div className="org-dialog__dropdown-list org-dialog__dropdown-list--scrollable">
                          <button type="button" onClick={() => { setIntroId(null); setOpenAssetDropdown(null) }} className={`org-dialog__dropdown-item ${introId === null ? 'org-dialog__dropdown-item--active' : ''}`}>
                            <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--none"><X size={14} /></div>
                            <span className="org-dialog__text-muted">No intro</span>
                          </button>
                          {introAssets.map(a => (
                            <button key={a.id} type="button" onClick={() => { setIntroId(a.id); setOpenAssetDropdown(null) }} className={`org-dialog__dropdown-item ${introId === a.id ? 'org-dialog__dropdown-item--active' : ''}`}>
                              <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--intro"><Play size={14} /></div>
                              <span className="org-dialog__truncate">{a.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openRatioPicker('intro')}
                    className={`org-dialog__asset-upload${hasIntroRatioConfig() ? ' org-dialog__asset-upload--active' : ''}`}
                    title="Configure intro per aspect ratio"
                  >
                    <Settings2 size={16} />
                  </button>
                  <input ref={introFileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="org-dialog__hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'intro'); e.target.value = '' }} />
                  <button type="button" onClick={() => introFileRef.current?.click()} disabled={uploadingIntro} className="org-dialog__asset-upload" title="Upload new intro">
                    {uploadingIntro ? <Loader2 size={16} className="org-dialog__spin" /> : <Upload size={16} />}
                  </button>
                </div>
                {hasIntroRatioConfig() && (
                  <p className="org-dialog__asset-hint">
                    <Settings2 size={12} />
                    Per-ratio intros configured
                  </p>
                )}
              </div>

              {/* Outro */}
              <div className="org-dialog__asset-row">
                <label className="org-dialog__asset-label">Outro</label>
                <div className="org-dialog__asset-controls">
                  <div className="org-dialog__dropdown-wrapper org-dialog__flex-1">
                    <button type="button" onClick={e => { e.stopPropagation(); setOpenAssetDropdown(openAssetDropdown === 'outro' ? null : 'outro') }} disabled={uploadingOutro} className="org-dialog__asset-select">
                      <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--outro"><SkipForward size={14} /></div>
                      <span className="org-dialog__asset-select-label">{getAssetName(outroId, 'No outro')}</span>
                      <ChevronDown className={`org-dialog__chevron ${openAssetDropdown === 'outro' ? 'org-dialog__chevron--open' : ''}`} />
                    </button>
                    {openAssetDropdown === 'outro' && (
                      <div className="org-dialog__dropdown org-dialog__dropdown--full" onClick={e => e.stopPropagation()}>
                        <div className="org-dialog__dropdown-list org-dialog__dropdown-list--scrollable">
                          <button type="button" onClick={() => { setOutroId(null); setOpenAssetDropdown(null) }} className={`org-dialog__dropdown-item ${outroId === null ? 'org-dialog__dropdown-item--active' : ''}`}>
                            <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--none"><X size={14} /></div>
                            <span className="org-dialog__text-muted">No outro</span>
                          </button>
                          {outroAssets.map(a => (
                            <button key={a.id} type="button" onClick={() => { setOutroId(a.id); setOpenAssetDropdown(null) }} className={`org-dialog__dropdown-item ${outroId === a.id ? 'org-dialog__dropdown-item--active' : ''}`}>
                              <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--outro"><SkipForward size={14} /></div>
                              <span className="org-dialog__truncate">{a.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => openRatioPicker('outro')}
                    className={`org-dialog__asset-upload${hasOutroRatioConfig() ? ' org-dialog__asset-upload--active' : ''}`}
                    title="Configure outro per aspect ratio"
                  >
                    <Settings2 size={16} />
                  </button>
                  <input ref={outroFileRef} type="file" accept="video/mp4,video/webm,video/quicktime" className="org-dialog__hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'outro'); e.target.value = '' }} />
                  <button type="button" onClick={() => outroFileRef.current?.click()} disabled={uploadingOutro} className="org-dialog__asset-upload" title="Upload new outro">
                    {uploadingOutro ? <Loader2 size={16} className="org-dialog__spin" /> : <Upload size={16} />}
                  </button>
                </div>
                {hasOutroRatioConfig() && (
                  <p className="org-dialog__asset-hint">
                    <Settings2 size={12} />
                    Per-ratio outros configured
                  </p>
                )}
              </div>

              {/* Watermark */}
              <div className="org-dialog__asset-row">
                <label className="org-dialog__asset-label">Watermark</label>
                <div className="org-dialog__asset-controls">
                  <div className="org-dialog__dropdown-wrapper org-dialog__flex-1">
                    <button type="button" onClick={e => { e.stopPropagation(); setOpenAssetDropdown(openAssetDropdown === 'watermark' ? null : 'watermark') }} disabled={uploadingWatermark} className="org-dialog__asset-select">
                      <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--watermark"><ImageIcon size={14} /></div>
                      <span className="org-dialog__asset-select-label">{getAssetName(watermarkId, 'No watermark')}</span>
                      <ChevronDown className={`org-dialog__chevron ${openAssetDropdown === 'watermark' ? 'org-dialog__chevron--open' : ''}`} />
                    </button>
                    {openAssetDropdown === 'watermark' && (
                      <div className="org-dialog__dropdown org-dialog__dropdown--full" onClick={e => e.stopPropagation()}>
                        <div className="org-dialog__dropdown-list org-dialog__dropdown-list--scrollable">
                          <button type="button" onClick={() => { setWatermarkId(null); setWatermarkSettings(null); setOpenAssetDropdown(null) }} className={`org-dialog__dropdown-item ${watermarkId === null ? 'org-dialog__dropdown-item--active' : ''}`}>
                            <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--none"><X size={14} /></div>
                            <span className="org-dialog__text-muted">No watermark</span>
                          </button>
                          {watermarkAssets.map(a => (
                            <button key={a.id} type="button" onClick={() => { setWatermarkId(a.id); setOpenAssetDropdown(null) }} className={`org-dialog__dropdown-item ${watermarkId === a.id ? 'org-dialog__dropdown-item--active' : ''}`}>
                              <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--watermark"><ImageIcon size={14} /></div>
                              <span className="org-dialog__truncate">{a.name}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={openWatermarkPositionPicker}
                    disabled={!watermarkId}
                    className={`org-dialog__asset-upload${watermarkSettings ? ' org-dialog__asset-upload--active' : ''}`}
                    title="Configure watermark position"
                  >
                    <Settings2 size={16} />
                  </button>
                  <input ref={watermarkFileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm" className="org-dialog__hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFileUpload(f, 'watermark'); e.target.value = '' }} />
                  <button type="button" onClick={() => watermarkFileRef.current?.click()} disabled={uploadingWatermark} className="org-dialog__asset-upload" title="Upload new watermark">
                    {uploadingWatermark ? <Loader2 size={16} className="org-dialog__spin" /> : <Upload size={16} />}
                  </button>
                </div>
              </div>

              {/* Layout Overlays */}
              <div className="org-dialog__asset-row">
                <label className="org-dialog__asset-label">Layout Overlays</label>
                <div className="org-dialog__asset-controls">
                  <div className="org-dialog__dropdown-wrapper org-dialog__flex-1">
                    <button
                      type="button"
                      disabled={uploadingOverlay}
                      className="org-dialog__asset-select"
                      onClick={e => { e.stopPropagation(); setShowOverlayDropdown(!showOverlayDropdown) }}
                    >
                      <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--overlay">
                        <Layers size={14} />
                      </div>
                      <span className="org-dialog__asset-select-label">
                        {layoutOverlays.length > 0
                          ? `${layoutOverlays.length} overlay${layoutOverlays.length > 1 ? 's' : ''}`
                          : 'No overlays'}
                      </span>
                      <ChevronDown className={`org-dialog__chevron ${showOverlayDropdown ? 'org-dialog__chevron--open' : ''}`} />
                    </button>

                    {/* Overlay Dropdown */}
                    {showOverlayDropdown && (
                      <div className="org-dialog__dropdown org-dialog__dropdown--full" onClick={e => e.stopPropagation()}>
                        <div className="org-dialog__dropdown-list org-dialog__dropdown-list--scrollable">
                          {layoutOverlays.length === 0 && (
                            <button type="button" className="org-dialog__dropdown-item org-dialog__dropdown-item--active" disabled>
                              <div className="org-dialog__asset-select-icon org-dialog__asset-select-icon--none"><X size={14} /></div>
                              <span className="org-dialog__text-muted">No overlays added</span>
                            </button>
                          )}
                          {layoutOverlays.map((overlay, idx) => (
                            <div key={overlay.id} className="org-dialog__dropdown-item org-dialog__dropdown-item--overlay">
                              <div className="org-dialog__overlay-thumb">
                                {overlay.imageUrl ? (
                                  <img src={overlay.imageUrl} className="org-dialog__overlay-thumb-img" alt="" />
                                ) : (
                                  <Layers size={12} style={{ color: 'var(--sidebar-text-muted)' }} />
                                )}
                              </div>
                              <div className="org-dialog__overlay-info">
                                <input
                                  value={overlay.label}
                                  onChange={e => {
                                    setLayoutOverlays(prev => prev.map((o, i) => i === idx ? { ...o, label: e.target.value } : o))
                                  }}
                                  className="org-dialog__overlay-name"
                                  placeholder={`Overlay ${idx + 1}`}
                                  onClick={e => e.stopPropagation()}
                                />
                                <span className="org-dialog__overlay-meta">
                                  {overlay.opacity}% opacity
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); openOverlayPositionPicker(idx) }}
                                className={`org-dialog__overlay-action${overlay.perRatioSettings ? ' org-dialog__overlay-action--active' : ''}`}
                                title="Configure position per aspect ratio"
                              >
                                <Settings2 size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setLayoutOverlays(prev => prev.filter((_, i) => i !== idx)) }}
                                className="org-dialog__overlay-action org-dialog__overlay-action--danger"
                                title="Remove overlay"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <button type="button" disabled={layoutOverlays.length === 0} className={`org-dialog__asset-upload${layoutOverlays.some(o => o.perRatioSettings) ? ' org-dialog__asset-upload--active' : ''}`} onClick={() => openOverlayPositionPicker(0)} title="Configure overlay position">
                    <Settings2 size={16} />
                  </button>
                  <input
                    ref={overlayFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
                    className="org-dialog__hidden"
                    onChange={async e => {
                      const f = e.target.files?.[0]
                      if (f && organizationId) {
                        setUploadingOverlay(true)
                        try {
                          const assetName = f.name.replace(/\.[^/.]+$/, '')
                          const res = await uploadOrganizationAsset(Number(organizationId), f, 'overlay', assetName)
                          if (res.success && res.asset) {
                            setAssets(prev => [...prev, res.asset!])
                            const newOverlay: LayoutOverlay = {
                              id: crypto.randomUUID(),
                              imagePath: '',
                              imageUrl: res.asset.url,
                              assetId: res.asset.id,
                              label: assetName,
                              opacity: 100,
                              perRatioSettings: null,
                            }
                            setLayoutOverlays(prev => [...prev, newOverlay])
                            toast.success('Overlay uploaded', `"${assetName}" has been uploaded`)
                          } else {
                            toast.error('Upload failed', res.error || 'Failed to upload overlay')
                          }
                        } catch (err: any) {
                          toast.error('Upload failed', err.message || 'Failed to upload overlay')
                        } finally {
                          setUploadingOverlay(false)
                        }
                      }
                      e.target.value = ''
                    }}
                  />
                  <button type="button" disabled={layoutOverlays.length === 0} className={`org-dialog__asset-upload${layoutOverlays.some(o => o.perRatioSettings) ? ' org-dialog__asset-upload--active' : ''}`} title="Configure overlay position">
                    <Settings2 size={16} />
                  </button>
                  <button type="button" onClick={() => overlayFileRef.current?.click()} disabled={uploadingOverlay} className="org-dialog__asset-upload" title="Upload new overlay">
                    {uploadingOverlay ? <Loader2 size={16} className="org-dialog__spin" /> : <Upload size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="org-dialog__footer">
          <button type="button" onClick={onClose} disabled={saving} className="org-dialog__btn org-dialog__btn--secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={!name.trim() || saving} className="org-dialog__btn org-dialog__btn--primary">
            {saving && <Loader2 size={16} className="org-dialog__btn-spinner" />}
            {saving ? 'Saving...' : isEditing ? 'Update Profile' : 'Create Profile'}
          </button>
        </div>
      </div>

      {/* Watermark Position Picker */}
      <WatermarkPositionPicker
        show={showWatermarkPositionPicker}
        watermarkUrl={watermarkAssets.find(a => a.id === watermarkId)?.url}
        watermarkId={watermarkId || undefined}
        watermarkWidth={watermarkAssets.find(a => a.id === watermarkId)?.width || undefined}
        watermarkHeight={watermarkAssets.find(a => a.id === watermarkId)?.height || undefined}
        settings={watermarkSettings as unknown as CreatorWatermarkSettings | undefined}
        watermarkAssets={watermarkAssets.map(a => ({ ...a, width: a.width || undefined, height: a.height || undefined }))}
        organizationId={organizationId ? Number(organizationId) : undefined}
        onClose={() => setShowWatermarkPositionPicker(false)}
        onSave={handleWatermarkSettingsSave}
      />

      {/* Overlay Position Picker */}
      {activeOverlayIndex >= 0 && activeOverlayIndex < layoutOverlays.length && (
        <OverlayPositionPicker
          show={showOverlayPositionPicker}
          overlayImageUrl={layoutOverlays[activeOverlayIndex]?.imageUrl || ''}
          overlayLabel={layoutOverlays[activeOverlayIndex]?.label}
          settings={layoutOverlays[activeOverlayIndex]?.perRatioSettings as PerRatioOverlaySettings | undefined}
          orgAssets={assets}
          onClose={() => setShowOverlayPositionPicker(false)}
          onSave={handleOverlayPositionSave}
        />
      )}

      {/* Intro/Outro Ratio Picker */}
      <IntroOutroRatioPicker
        show={showIntroOutroRatioPicker}
        mode={ratioPickerMode}
        initialSettings={getInitialRatioSettings(ratioPickerMode)}
        organizationId={organizationId ? Number(organizationId) : undefined}
        onClose={() => setShowIntroOutroRatioPicker(false)}
        onSave={handleRatioSettingsSave}
      />
    </div>,
    document.body
  )
}
