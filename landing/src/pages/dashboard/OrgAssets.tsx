import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { PageLayout } from '@/components/dashboard/PageLayout'
import { useOrganization } from '@/hooks/useOrganization'
import { uploadOrganizationAsset, deleteOrganizationAsset } from '@/services/organizationApi'
import { listOrganizationCampaigns } from '@/services/campaignApi'
import { useToast } from '@/hooks/useToast'
import type { ServerOrganizationAsset, Campaign } from '@/types/organization'
import {
  FolderOpen, Upload, Trash2, Film, Image, Music, Package,
  ChevronDown, Play, Pause, MoreVertical, Clock, Maximize2,
  Megaphone, X, Loader2,
} from 'lucide-react'

const AUDIO_THUMBNAIL =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiB2aWV3Qm94PSIwIDAgMjAwIDEyMCIgZmlsbD0ibm9uZSI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMTIwIiBmaWxsPSIjMDY0RTNCIi8+CjxyZWN0IHg9IjMwIiB5PSI0NSIgd2lkdGg9IjgiIGhlaWdodD0iMzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjQ1IiB5PSIzNSIgd2lkdGg9IjgiIGhlaWdodD0iNTAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjYwIiB5PSIyNSIgd2lkdGg9IjgiIGhlaWdodD0iNzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9Ijc1IiB5PSI0MCIgd2lkdGg9IjgiIGhlaWdodD0iNDAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjkwIiB5PSIzMCIgd2lkdGg9IjgiIGhlaWdodD0iNjAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjEwNSIgeT0iMjAiIHdpZHRoPSI4IiBoZWlnaHQ9IjgwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgo8cmVjdCB4PSIxMjAiIHk9IjM1IiB3aWR0aD0iOCIgaGVpZ2h0PSI1MCIgcng9IjIiIGZpbGw9IiMxMEI5ODEiLz4KPHJlY3QgeD0iMTM1IiB5PSI0NSIgd2lkdGg9IjgiIGhlaWdodD0iMzAiIHJ4PSIyIiBmaWxsPSIjMTBCOTgxIi8+CjxyZWN0IHg9IjE1MCIgeT0iMzAiIHdpZHRoPSI4IiBoZWlnaHQ9IjYwIiByeD0iMiIgZmlsbD0iIzEwQjk4MSIvPgo8cmVjdCB4PSIxNjUiIHk9IjQwIiB3aWR0aD0iOCIgaGVpZ2h0PSI0MCIgcng9IjIiIGZpbGw9IiMxMEI5ODEiLz4KPC9zdmc+'

type AssetType = 'intro' | 'outro' | 'watermark' | 'audio' | 'image'

const ASSET_TYPE_CONFIG: Record<AssetType, {
  label: string
  description: string
  icon: typeof Film
  color: string
  bgColor: string
  badgeBg: string
  badgeColor: string
  indicatorGradient: string
}> = {
  intro: {
    label: 'Intro', description: 'Video introductions for your content',
    icon: Film, color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)',
    badgeBg: 'rgba(59, 130, 246, 0.15)', badgeColor: '#60a5fa',
    indicatorGradient: 'linear-gradient(to bottom, #3b82f6, #2563eb)',
  },
  outro: {
    label: 'Outro', description: 'Video endings and outros',
    icon: Film, color: '#a855f7', bgColor: 'rgba(168, 85, 247, 0.15)',
    badgeBg: 'rgba(168, 85, 247, 0.15)', badgeColor: '#c084fc',
    indicatorGradient: 'linear-gradient(to bottom, #a855f7, #9333ea)',
  },
  watermark: {
    label: 'Watermark', description: 'Brand watermarks and overlays',
    icon: Image, color: '#f59e0b', bgColor: 'rgba(245, 158, 11, 0.15)',
    badgeBg: 'rgba(245, 158, 11, 0.15)', badgeColor: '#fbbf24',
    indicatorGradient: 'linear-gradient(to bottom, #f59e0b, #d97706)',
  },
  audio: {
    label: 'Audio', description: 'Sound effects and music',
    icon: Music, color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)',
    badgeBg: 'rgba(16, 185, 129, 0.15)', badgeColor: '#34d399',
    indicatorGradient: 'linear-gradient(to bottom, #10b981, #059669)',
  },
  image: {
    label: 'Image', description: 'Stickers and image assets',
    icon: Image, color: '#06b6d4', bgColor: 'rgba(6, 182, 212, 0.15)',
    badgeBg: 'rgba(6, 182, 212, 0.15)', badgeColor: '#22d3ee',
    indicatorGradient: 'linear-gradient(to bottom, #06b6d4, #0891b2)',
  },
}

const ASSET_TYPE_ORDER: AssetType[] = ['intro', 'outro', 'watermark', 'audio', 'image']

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'avi', 'mkv', 'webm']
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp']
const AUDIO_EXTENSIONS = ['mp3', 'wav', 'aac', 'm4a', 'ogg']
const ALL_EXTENSIONS = [...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS, ...AUDIO_EXTENSIONS]

function getAssetOptionsForFileType(ext: string): Array<{ value: AssetType; label: string; icon: typeof Film; recommended?: boolean }> {
  if (VIDEO_EXTENSIONS.includes(ext)) {
    return [
      { value: 'intro', label: 'Intro', icon: Film, recommended: true },
      { value: 'outro', label: 'Outro', icon: Film },
    ]
  }
  if (IMAGE_EXTENSIONS.includes(ext)) {
    return [
      { value: 'watermark', label: 'Watermark', icon: Image, recommended: true },
      { value: 'image', label: 'Sticker / Image', icon: Image },
    ]
  }
  if (AUDIO_EXTENSIONS.includes(ext)) {
    return [{ value: 'audio', label: 'Audio', icon: Music, recommended: true }]
  }
  return []
}

function getFileTypeIcon(ext: string) {
  if (VIDEO_EXTENSIONS.includes(ext)) return Film
  if (IMAGE_EXTENSIONS.includes(ext)) return Image
  if (AUDIO_EXTENSIONS.includes(ext)) return Music
  return Package
}

function getFileTypeIconBg(ext: string): string {
  if (VIDEO_EXTENSIONS.includes(ext)) return 'bg-blue-500/15'
  if (IMAGE_EXTENSIONS.includes(ext)) return 'bg-amber-500/15'
  if (AUDIO_EXTENSIONS.includes(ext)) return 'bg-emerald-500/15'
  return 'bg-zinc-800'
}

function getFileTypeIconColor(ext: string): string {
  if (VIDEO_EXTENSIONS.includes(ext)) return 'text-blue-400'
  if (IMAGE_EXTENSIONS.includes(ext)) return 'text-amber-400'
  if (AUDIO_EXTENSIONS.includes(ext)) return 'text-emerald-400'
  return 'text-zinc-500'
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function formatDuration(seconds: number | string): string {
  const s = typeof seconds === 'string' ? parseFloat(seconds) : seconds
  const mins = Math.floor(s / 60)
  const secs = Math.floor(s % 60)
  return `${mins}:${String(secs).padStart(2, '0')}`
}

function isPlayableAsset(asset: ServerOrganizationAsset): boolean {
  return ['intro', 'outro', 'audio', 'image', 'watermark'].includes(asset.asset_type)
}

function getBaseUrl(url: string | null | undefined): string {
  if (!url) return ''
  try {
    const parsed = new URL(url)
    return parsed.origin + parsed.pathname
  } catch {
    return url.split('?')[0]
  }
}

export function OrgAssets() {
  const { orgAssets, assetsLoading, loadOrgAssets, organizationId, isAdmin } = useOrganization()
  const toast = useToast()

  // Collapsed groups
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  // Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>([])

  // Upload dialog state
  const [showUploadDialog, setShowUploadDialog] = useState(false)
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploadFileExt, setUploadFileExt] = useState('')
  const [uploadAssetType, setUploadAssetType] = useState<AssetType | ''>('')
  const [uploadAssetName, setUploadAssetName] = useState('')
  const [uploading, setUploading] = useState(false)
  const uploadFileInputRef = useRef<HTMLInputElement>(null)

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<ServerOrganizationAsset | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Asset menu state
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const menuButtonRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  // Audio playback state
  const [playingAudioId, setPlayingAudioId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Video player state
  const [videoAsset, setVideoAsset] = useState<ServerOrganizationAsset | null>(null)

  // Image preview state
  const [imageAsset, setImageAsset] = useState<ServerOrganizationAsset | null>(null)

  useEffect(() => { loadOrgAssets() }, [loadOrgAssets])

  useEffect(() => {
    if (!organizationId) return
    listOrganizationCampaigns(Number(organizationId)).then(res => {
      if (res.success) setCampaigns(res.campaigns)
    }).catch(() => {})
  }, [organizationId])

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (openMenuId === null) return
    const handler = (e: MouseEvent) => {
      const btn = menuButtonRefs.current.get(openMenuId)
      if (btn && btn.contains(e.target as Node)) return
      setOpenMenuId(null)
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [openMenuId])

  const groupedAssets = useMemo(() => {
    const groups: { type: AssetType; assets: ServerOrganizationAsset[] }[] = []
    for (const type of ASSET_TYPE_ORDER) {
      const assets = orgAssets.filter(a => a.asset_type === type)
      if (assets.length > 0) groups.push({ type, assets })
    }
    return groups
  }, [orgAssets])

  const toggleGroup = (type: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const getAttachedCampaign = useCallback((asset: ServerOrganizationAsset): Campaign | null => {
    if (asset.asset_type !== 'image') return null
    const assetBaseUrl = getBaseUrl(asset.url)
    return campaigns.find(c => c.status === 'active' && getBaseUrl(c.cover_image_url) === assetBaseUrl) || null
  }, [campaigns])

  const isAttachedToActiveCampaign = useCallback((asset: ServerOrganizationAsset): boolean => {
    return getAttachedCampaign(asset) !== null
  }, [getAttachedCampaign])

  // Asset click handling
  const handleAssetClick = (asset: ServerOrganizationAsset) => {
    if (asset.asset_type === 'intro' || asset.asset_type === 'outro') {
      setVideoAsset(asset)
    } else if (asset.asset_type === 'audio') {
      toggleAudioPlayback(asset)
    } else if (asset.asset_type === 'image' || asset.asset_type === 'watermark') {
      setImageAsset(asset)
    }
  }

  const toggleAudioPlayback = (asset: ServerOrganizationAsset) => {
    if (playingAudioId === asset.id) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current.currentTime = 0
      }
      setPlayingAudioId(null)
    } else {
      if (audioRef.current) audioRef.current.pause()
      audioRef.current = new Audio(asset.url)
      audioRef.current.onended = () => setPlayingAudioId(null)
      audioRef.current.onerror = () => {
        toast.error('Failed to play audio file')
        setPlayingAudioId(null)
      }
      audioRef.current.play()
      setPlayingAudioId(asset.id)
    }
  }

  // Menu positioning
  const getMenuPosition = (assetId: number): React.CSSProperties => {
    const button = menuButtonRefs.current.get(assetId)
    if (!button) return { top: 0, left: 0 }
    const rect = button.getBoundingClientRect()
    const menuWidth = 210
    const menuMaxHeight = 120
    const padding = 8
    let top = rect.bottom + padding
    let left = rect.right - menuWidth
    if (top + menuMaxHeight > window.innerHeight - padding) top = rect.top - menuMaxHeight - padding
    if (left < padding) left = padding
    if (left + menuWidth > window.innerWidth - padding) left = window.innerWidth - menuWidth - padding
    return { position: 'fixed', top, left, zIndex: 9999 }
  }

  // Upload dialog
  const openUploadDialog = () => {
    setShowUploadDialog(true)
    setUploadFile(null)
    setUploadFileExt('')
    setUploadAssetType('')
    setUploadAssetName('')
  }

  const closeUploadDialog = () => {
    if (uploading) return
    setShowUploadDialog(false)
    setUploadFile(null)
    setUploadFileExt('')
    setUploadAssetType('')
    setUploadAssetName('')
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    setUploadFile(file)
    setUploadFileExt(ext)
    const options = getAssetOptionsForFileType(ext)
    const recommended = options.find(o => o.recommended)
    if (recommended) setUploadAssetType(recommended.value)
    else if (options.length > 0) setUploadAssetType(options[0].value)
    else setUploadAssetType('')
    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  const executeUpload = async () => {
    if (!uploadFile || !uploadAssetType || !organizationId) return
    setUploading(true)
    try {
      const assetName = uploadAssetName.trim() || uploadFile.name
      const result = await uploadOrganizationAsset(Number(organizationId), uploadFile, uploadAssetType, assetName)
      if (result.success) {
        toast.success('Asset uploaded')
        loadOrgAssets()
        closeUploadDialog()
      } else {
        toast.error('Upload failed', result.error)
      }
    } catch {
      toast.error('Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // Delete
  const executeDelete = async () => {
    if (!deleteTarget || !organizationId) return
    setDeleting(true)
    try {
      const result = await deleteOrganizationAsset(Number(organizationId), deleteTarget.id)
      if (result.success) {
        toast.success('Asset deleted')
        loadOrgAssets()
      } else {
        toast.error('Delete failed', result.error)
      }
    } catch {
      toast.error('Delete failed')
    } finally {
      setDeleting(false)
      setDeleteTarget(null)
    }
  }

  // Loading state
  if (assetsLoading && orgAssets.length === 0) {
    return (
      <PageLayout icon={FolderOpen} title="Assets" actions={
        isAdmin ? (
          <button className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-cyan-400 text-[#0a0a0b] border-none cursor-pointer transition-opacity duration-150 hover:opacity-90" onClick={openUploadDialog}>
            <Upload className="w-3.5 h-3.5" /> Upload Asset
          </button>
        ) : undefined
      }>
        <div className="w-full flex flex-col gap-8 p-6 max-w-[1400px] mx-auto">
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-zinc-500 text-sm">
            <div className="w-8 h-8 border-2 border-zinc-700 border-t-cyan-500 rounded-full animate-spin" />
            Loading assets...
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout icon={FolderOpen} title="Assets" actions={
      isAdmin ? (
        <button className="flex items-center gap-2 h-8 px-3.5 text-xs font-semibold rounded-md bg-cyan-400 text-[#0a0a0b] border-none cursor-pointer transition-opacity duration-150 hover:opacity-90" onClick={openUploadDialog}>
          <Upload className="w-3.5 h-3.5" /> Upload Asset
        </button>
      ) : undefined
    }>
      <div className="w-full flex flex-col gap-8 p-6 max-w-[1400px] mx-auto">
        {/* Page Heading */}
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-white tracking-tight mb-1">Asset Library</h1>
          <p className="text-sm text-zinc-500 leading-relaxed">Manage intros, outros, watermarks, audio files, and images for your organization</p>
        </div>

        {groupedAssets.length > 0 ? (
          groupedAssets.map(group => {
            const config = ASSET_TYPE_CONFIG[group.type]
            const Icon = config.icon
            const collapsed = collapsedGroups.has(group.type)
            return (
              <section key={group.type} className="flex flex-col gap-4">
                {/* Section Header */}
                <button onClick={() => toggleGroup(group.type)} className="flex items-center gap-3.5 text-left bg-transparent border-none cursor-pointer p-0">
                  <div className="flex items-center justify-center w-10 h-10 rounded-[10px]" style={{ backgroundColor: config.bgColor, color: config.color }}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <h2 className="text-[1.0625rem] font-semibold text-white tracking-tight m-0">{config.label}s</h2>
                    <p className="text-xs text-zinc-500 mt-0.5 m-0">{config.description}</p>
                  </div>
                  <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 text-xs font-semibold rounded-full" style={{ backgroundColor: config.bgColor, color: config.color }}>
                    {group.assets.length}
                  </span>
                  <ChevronDown className={`w-[18px] h-[18px] text-zinc-500 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
                </button>

                {/* Asset Cards */}
                {!collapsed && (
                  <div className="flex flex-col gap-2">
                    {group.assets.map(asset => {
                      const assetConfig = ASSET_TYPE_CONFIG[asset.asset_type as AssetType] || ASSET_TYPE_CONFIG.image
                      const AssetIcon = assetConfig.icon
                      const isPlaying = playingAudioId === asset.id
                      const playable = isPlayableAsset(asset)
                      const attachedCampaign = getAttachedCampaign(asset)

                      return (
                        <div
                          key={asset.id}
                          className={`relative flex rounded-[10px] border overflow-hidden transition-all duration-200 hover:shadow-[0_4px_16px_rgba(0,0,0,0.15)] ${
                            isPlaying
                              ? 'border-emerald-500/30 bg-emerald-500/[0.03]'
                              : 'bg-zinc-900/50 border-zinc-800 hover:border-white/[0.12]'
                          }`}
                        >
                          {/* Left Indicator */}
                          <div className="w-[3px] shrink-0" style={{ background: assetConfig.indicatorGradient }} />

                          {/* Card Content */}
                          <div className="flex-1 flex flex-col py-3.5 px-4">
                            <div className="flex items-center gap-4">
                              {/* Thumbnail */}
                              <div
                                className={`w-12 h-12 rounded-lg shrink-0 overflow-hidden border-2 border-zinc-700/50 relative ${playable ? 'cursor-pointer' : ''}`}
                                onClick={() => playable && handleAssetClick(asset)}
                              >
                                {asset.asset_type === 'audio' ? (
                                  <img src={AUDIO_THUMBNAIL} alt={asset.name} className="w-full h-full object-cover" />
                                ) : asset.thumbnail_url || (asset.url && ['image', 'watermark'].includes(asset.asset_type)) ? (
                                  <img src={asset.thumbnail_url || asset.url} alt={asset.name} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/15 to-zinc-800/50">
                                    <AssetIcon className="w-5 h-5 text-zinc-500 opacity-60" />
                                  </div>
                                )}
                                {playable && (
                                  <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity duration-150 ${
                                    isPlaying ? 'opacity-100' : 'opacity-0 hover:opacity-100'
                                  }`}>
                                    {asset.asset_type === 'audio' && isPlaying ? (
                                      <Pause className="w-[18px] h-[18px] text-white" />
                                    ) : (
                                      <Play className="w-[18px] h-[18px] text-white" />
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="text-[0.9375rem] font-semibold text-white truncate leading-tight" title={asset.name}>{asset.name}</div>
                                <div className="flex items-center gap-3 mt-1">
                                  {asset.duration && (
                                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                                      <Clock className="w-3 h-3" /> {formatDuration(asset.duration)}
                                    </span>
                                  )}
                                  {asset.width && asset.height && (
                                    <span className="flex items-center gap-1 text-xs text-zinc-500">
                                      <Maximize2 className="w-3 h-3" /> {asset.width}&times;{asset.height}
                                    </span>
                                  )}
                                  {asset.file_size && (
                                    <span className="text-xs text-zinc-600">{formatFileSize(asset.file_size)}</span>
                                  )}
                                </div>
                              </div>

                              {/* Type Badge */}
                              <span
                                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.625rem] font-bold uppercase tracking-wide shrink-0"
                                style={{ backgroundColor: assetConfig.badgeBg, color: assetConfig.badgeColor }}
                              >
                                <AssetIcon className="w-[11px] h-[11px]" />
                                {asset.asset_type}
                              </span>

                              {/* Campaign Badge */}
                              {attachedCampaign && (
                                <button
                                  className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.625rem] font-bold uppercase tracking-wide shrink-0 bg-amber-500/15 text-amber-400 border-none cursor-pointer hover:bg-amber-500/25 hover:-translate-y-px transition-all duration-150"
                                  title={`Used in campaign: ${attachedCampaign.title}`}
                                >
                                  <Megaphone className="w-[11px] h-[11px]" />
                                  Campaign
                                </button>
                              )}

                              {/* Actions */}
                              <div className="flex items-center gap-1 shrink-0">
                                {playable && (
                                  <button
                                    onClick={() => handleAssetClick(asset)}
                                    className="flex items-center justify-center w-7 h-7 bg-transparent border border-transparent rounded-md text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:border-zinc-700 hover:text-white"
                                    title={asset.asset_type === 'audio' ? (isPlaying ? 'Pause' : 'Play') : 'Preview'}
                                  >
                                    {asset.asset_type === 'audio' && isPlaying ? (
                                      <Pause className="w-3.5 h-3.5" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5" />
                                    )}
                                  </button>
                                )}
                                {isAdmin && (
                                  <button
                                    ref={el => { if (el) menuButtonRefs.current.set(asset.id, el); else menuButtonRefs.current.delete(asset.id) }}
                                    onClick={e => { e.stopPropagation(); setOpenMenuId(openMenuId === asset.id ? null : asset.id) }}
                                    className={`flex items-center justify-center w-7 h-7 bg-transparent border border-transparent rounded-md text-zinc-500 cursor-pointer transition-all duration-150 hover:bg-zinc-800 hover:border-zinc-700 hover:text-white ${openMenuId === asset.id ? 'bg-zinc-800 border-zinc-700 text-white' : ''}`}
                                    title="Asset actions"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              {/* Dropdown Menu */}
                              {openMenuId === asset.id && createPortal(
                                <div
                                  style={getMenuPosition(asset.id)}
                                  className="w-[210px] bg-zinc-900 backdrop-blur-xl border border-zinc-800 rounded-[10px] shadow-[0_10px_40px_rgba(0,0,0,0.4)] p-2"
                                  onClick={e => e.stopPropagation()}
                                >
                                  {playable && (
                                    <>
                                      <button
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-[0.8125rem] text-white bg-transparent border-none rounded-md cursor-pointer text-left transition-all duration-150 hover:bg-cyan-500/10 hover:text-cyan-400"
                                        onClick={() => { handleAssetClick(asset); setOpenMenuId(null) }}
                                      >
                                        <Play className="w-4 h-4" />
                                        {asset.asset_type === 'audio' ? 'Play Audio' : 'Preview'}
                                      </button>
                                      <div className="my-2 border-t border-zinc-800" />
                                    </>
                                  )}
                                  {attachedCampaign && (
                                    <>
                                      <button
                                        className="w-full flex items-center gap-3 px-3 py-2.5 text-[0.8125rem] text-white bg-transparent border-none rounded-md cursor-pointer text-left transition-all duration-150 hover:bg-cyan-500/10 hover:text-cyan-400"
                                        onClick={() => setOpenMenuId(null)}
                                      >
                                        <Megaphone className="w-4 h-4" />
                                        View attached campaign
                                      </button>
                                      <div className="my-2 border-t border-zinc-800" />
                                    </>
                                  )}
                                  <button
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-[0.8125rem] bg-transparent border-none rounded-md text-left transition-all duration-150 ${
                                      isAttachedToActiveCampaign(asset)
                                        ? 'text-zinc-600 cursor-not-allowed opacity-50'
                                        : 'text-red-400 cursor-pointer hover:bg-red-500/10'
                                    }`}
                                    disabled={isAttachedToActiveCampaign(asset)}
                                    onClick={() => {
                                      if (!isAttachedToActiveCampaign(asset)) {
                                        setDeleteTarget(asset)
                                        setOpenMenuId(null)
                                      }
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                    {isAttachedToActiveCampaign(asset) ? 'In use by campaign' : 'Delete Asset'}
                                  </button>
                                </div>,
                                document.body
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })
        ) : (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-zinc-900/50 border border-dashed border-zinc-800 rounded-xl">
            <div className="flex items-center justify-center w-[72px] h-[72px] bg-gradient-to-br from-cyan-500/15 to-zinc-800 rounded-[20px] mb-6">
              <Package className="w-8 h-8 text-cyan-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2 m-0">No assets uploaded yet</h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-xs m-0">Upload intros, outros, watermarks, or audio files to build your asset library.</p>
            {isAdmin && (
              <button
                className="flex items-center gap-2 px-6 py-3 text-sm font-semibold bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-none rounded-[10px] cursor-pointer transition-all duration-150 hover:opacity-90 hover:-translate-y-0.5"
                onClick={openUploadDialog}
              >
                <Upload className="w-[18px] h-[18px]" /> Upload First Asset
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload Asset Dialog */}
      {showUploadDialog && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={closeUploadDialog}>
          <div
            className="relative w-full max-w-[440px] mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Accent bar */}
            <div className="h-[3px] shrink-0 bg-gradient-to-r from-cyan-500 to-cyan-500/50" />

            {/* Header */}
            <div className="relative flex flex-col items-center px-6 pt-6 pb-4 text-center">
              <button className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-md text-zinc-500 cursor-pointer hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" onClick={closeUploadDialog} disabled={uploading}>
                <X className="w-[18px] h-[18px]" />
              </button>
              <div className="flex items-center justify-center w-[52px] h-[52px] rounded-xl bg-cyan-500/15 text-cyan-400 mb-3.5">
                <Upload className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight m-0">Upload Asset</h2>
              <p className="text-[0.8125rem] text-zinc-500 mt-1 m-0">
                {uploadFile ? 'Configure your asset' : 'Select a file to upload'}
              </p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6">
              {!uploadFile ? (
                <div className="mb-4">
                  <button
                    onClick={() => uploadFileInputRef.current?.click()}
                    className="w-full p-8 border-2 border-dashed border-zinc-700 rounded-xl bg-transparent cursor-pointer transition-all duration-150 hover:border-cyan-500/50 hover:bg-cyan-500/[0.05] group"
                  >
                    <div className="flex flex-col items-center gap-3">
                      <FolderOpen className="w-7 h-7 text-zinc-500 group-hover:text-cyan-400 transition-colors" />
                      <p className="font-medium text-white m-0">Click to browse files</p>
                      <p className="text-xs text-zinc-500 m-0">Video, image, or audio files</p>
                    </div>
                  </button>
                  <input
                    ref={uploadFileInputRef}
                    type="file"
                    className="hidden"
                    accept={ALL_EXTENSIONS.map(e => `.${e}`).join(',')}
                    onChange={handleFileSelect}
                  />
                </div>
              ) : (
                <>
                  {/* File card */}
                  <div className="flex items-center gap-3 p-3 bg-zinc-800/50 rounded-[10px] border border-zinc-700/50 mb-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${getFileTypeIconBg(uploadFileExt)}`}>
                      {(() => { const FIcon = getFileTypeIcon(uploadFileExt); return <FIcon className={`w-5 h-5 ${getFileTypeIconColor(uploadFileExt)}`} /> })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate m-0" title={uploadFile.name}>{uploadFile.name}</p>
                      <p className="text-xs text-zinc-500 m-0">{formatFileSize(uploadFile.size)} &bull; {uploadFileExt.toUpperCase()}</p>
                    </div>
                    <button onClick={() => { setUploadFile(null); setUploadFileExt(''); setUploadAssetType(''); setUploadAssetName('') }} className="flex items-center justify-center w-7 h-7 bg-transparent border-none rounded-md text-zinc-500 cursor-pointer hover:bg-zinc-800 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Asset type selection */}
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">Asset Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      {getAssetOptionsForFileType(uploadFileExt).map(option => {
                        const OptIcon = option.icon
                        return (
                          <button
                            key={option.value}
                            onClick={() => setUploadAssetType(option.value)}
                            className={`flex items-center gap-3 p-3 rounded-[10px] border text-left cursor-pointer transition-all duration-150 ${
                              uploadAssetType === option.value
                                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-400'
                                : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-500 hover:border-white/10 hover:text-white'
                            }`}
                          >
                            <OptIcon className="w-4 h-4 shrink-0" />
                            <span className="text-sm font-medium">{option.label}</span>
                            {option.recommended && (
                              <span className="ml-auto text-[0.625rem] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400">likely</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Name input */}
                  <div className="mb-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-white mb-2">
                      Name <span className="text-zinc-500 font-normal text-[0.8125rem]">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={uploadAssetName}
                      onChange={e => setUploadAssetName(e.target.value)}
                      placeholder={uploadFile.name}
                      className="w-full px-4 py-3 text-sm bg-zinc-800/50 border border-zinc-700/50 rounded-lg text-white placeholder:text-zinc-600 focus:outline-none focus:border-cyan-500 focus:shadow-[0_0_0_2px_rgba(6,182,212,0.15)] transition-all"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Footer */}
            <div className="flex gap-2.5 px-6 py-5 border-t border-zinc-800 mt-4">
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold bg-zinc-800/50 text-white border border-zinc-700/50 rounded-lg cursor-pointer transition-all duration-150 hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={closeUploadDialog}
                disabled={uploading}
              >
                Cancel
              </button>
              {uploadFile && (
                <button
                  className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold bg-gradient-to-br from-cyan-500 to-cyan-600 text-white border-none rounded-lg cursor-pointer transition-all duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={executeUpload}
                  disabled={uploading || !uploadAssetType}
                >
                  {uploading && <Loader2 className="w-4 h-4 animate-spin" />}
                  {uploading ? 'Uploading...' : 'Upload Asset'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Asset Dialog */}
      {deleteTarget && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[60]" onClick={() => !deleting && setDeleteTarget(null)}>
          <div
            className="relative w-full max-w-[440px] mx-4 bg-zinc-900 border border-zinc-800 rounded-xl shadow-[0_20px_60px_rgba(0,0,0,0.4)] overflow-hidden flex flex-col max-h-[85vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Accent bar */}
            <div className="h-[3px] shrink-0 bg-gradient-to-r from-red-500 to-red-500/50" />

            {/* Header */}
            <div className="relative flex flex-col items-center px-6 pt-6 pb-4 text-center">
              <button className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-transparent border-none rounded-md text-zinc-500 cursor-pointer hover:bg-zinc-800 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed" onClick={() => setDeleteTarget(null)} disabled={deleting}>
                <X className="w-[18px] h-[18px]" />
              </button>
              <div className="flex items-center justify-center w-[52px] h-[52px] rounded-xl bg-red-500/15 text-red-400 mb-3.5">
                <Trash2 className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight m-0">Delete Asset</h2>
              <p className="text-[0.8125rem] text-zinc-500 mt-1 m-0">This action cannot be undone</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6">
              {/* Asset preview */}
              <div className="flex items-center gap-3.5 p-4 bg-zinc-800/50 rounded-lg mb-4">
                <div className="w-11 h-11 rounded-lg bg-zinc-800 flex items-center justify-center overflow-hidden shrink-0">
                  {deleteTarget.asset_type === 'audio' ? (
                    <img src={AUDIO_THUMBNAIL} alt={deleteTarget.name} className="w-full h-full object-cover" />
                  ) : deleteTarget.thumbnail_url || (deleteTarget.url && ['image', 'watermark'].includes(deleteTarget.asset_type)) ? (
                    <img src={deleteTarget.thumbnail_url || deleteTarget.url} alt={deleteTarget.name} className="w-full h-full object-cover" />
                  ) : (
                    (() => { const DIcon = (ASSET_TYPE_CONFIG[deleteTarget.asset_type as AssetType] || ASSET_TYPE_CONFIG.image).icon; return <DIcon className="w-5 h-5 text-zinc-500" /> })()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[0.9375rem] font-semibold text-white truncate">{deleteTarget.name}</div>
                  <div className="text-[0.8125rem] text-zinc-500 capitalize mt-0.5">{deleteTarget.asset_type}</div>
                </div>
              </div>

              {/* Warning */}
              <div className="p-4 bg-red-500/[0.08] border border-red-500/15 rounded-lg">
                <p className="text-sm text-zinc-400 leading-relaxed m-0">
                  Are you sure you want to delete <strong className="text-white">"{deleteTarget.name}"</strong>? This will permanently remove the asset from your organization.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex gap-2.5 px-6 py-5 border-t border-zinc-800 mt-4">
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold bg-zinc-800/50 text-white border border-zinc-700/50 rounded-lg cursor-pointer transition-all duration-150 hover:bg-zinc-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3 px-4 text-sm font-semibold bg-gradient-to-br from-red-500 to-red-600 text-white border-none rounded-lg cursor-pointer transition-all duration-150 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={executeDelete}
                disabled={deleting}
              >
                {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
                {deleting ? 'Deleting...' : 'Delete Asset'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Video Player Dialog */}
      {videoAsset && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60]" onClick={() => setVideoAsset(null)}>
          <div className="relative max-w-4xl w-full mx-4" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-full text-white/70 cursor-pointer hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setVideoAsset(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <video
              src={videoAsset.url}
              controls
              autoPlay
              className="w-full rounded-xl border border-white/10"
            />
            <div className="mt-4 text-center">
              <p className="font-medium text-white m-0">{videoAsset.name}</p>
              {videoAsset.duration && (
                <p className="text-sm text-zinc-500 mt-1 m-0">{formatDuration(videoAsset.duration)}</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Image Preview Dialog */}
      {imageAsset && createPortal(
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[60]" onClick={() => setImageAsset(null)}>
          <div className="relative max-w-[90vw] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <button
              className="absolute -top-10 right-0 flex items-center justify-center w-8 h-8 bg-transparent border-none rounded-full text-white/70 cursor-pointer hover:text-white hover:bg-white/10 transition-colors"
              onClick={() => setImageAsset(null)}
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={imageAsset.url}
              alt={imageAsset.name}
              className="max-w-[85vw] max-h-[80vh] object-contain rounded-xl border border-white/10"
            />
            <div className="mt-4 text-center">
              <p className="font-medium text-white m-0">{imageAsset.name}</p>
              {imageAsset.width && imageAsset.height && (
                <p className="text-sm text-zinc-500 mt-1 m-0">{imageAsset.width}&times;{imageAsset.height}</p>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </PageLayout>
  )
}
