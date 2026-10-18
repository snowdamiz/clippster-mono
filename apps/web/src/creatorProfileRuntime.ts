import { reactive } from 'vue'
import { auth, workspaceClient } from './api'
import type { CreatorProfileForm } from '@/services/creatorProfileForm'
import type { CreatorProfileWithLinks, IntroOutro, WatermarkImage } from '@/services/database/types'
import type { ServerOrganizationAsset } from '@/services/organizationAssetsApi'
import type { ServerOrganizationCreatorProfile } from '@/services/organizationProfilesApi'
export { extractMintId, extractChannelSlug, extractChannelName, extractYouTubeChannel, extractRumbleChannel } from '@/lib/creatorPlatformIds'

const account = '/web/account'
export const submitPersonalExternalPost = (data: import('@/services/schedulingApi').SubmitExternalPostData) => workspaceClient.post<import('@/services/schedulingApi').ExternalPostResponse>(account + '/user/external-posts', data)
export const submitExternalPost = (id: number | string, data: import('@/services/schedulingApi').SubmitExternalPostData) => workspaceClient.post<import('@/services/schedulingApi').ExternalPostResponse>(account + `/organizations/${id}/external-posts`, data)
export const getUserAssignedCreatorProfiles = () => workspaceClient.get<{ success: boolean; profiles: ServerOrganizationCreatorProfile[] }>(account + '/user/assigned-creator-profiles')
export async function getAllCreatorProfiles(): Promise<CreatorProfileWithLinks[]> { const result = await workspaceClient.get<{ profiles: any[] }>(account + '/user/creator-profiles'); return result.profiles.map(profile => ({ ...profile, id: String(profile.id) })) }
export function selectedVideoFile(path: string) { const file = files.get(path); if (!file) throw new Error('Choose the video file again.'); return file }
const prefix = new URLSearchParams(location.search).has('embedded') ? '/workspace/api' : '/api'
export function creatorAvatarUrl(id: number | string, assigned: boolean) {
  const campaign = /^campaign-\d+-(\d+)$/.exec(String(id))
  return prefix + account + '/creator-avatar/' + (campaign ? 'campaign/' : assigned ? 'assigned/' : 'personal/') + (campaign?.[1] || String(id).replace(/^org-/, ''))
}
type Asset = ServerOrganizationAsset & { user_id?: number }
const files = new Map<string, File>()
const uploadedFiles = new Map<string, Asset>()
const previewUrls = new Map<string, string>()
const listeners = new Map<string, Set<(event: { payload: unknown }) => unknown>>()
const userState = reactive<{ user: any }>({ user: null })
const assetUrl = (asset: Asset, organizationId?: string | number) =>
  prefix + '/web/account/' + (organizationId ? 'organizations/' + organizationId : 'user') + '/assets/' + asset.id + '/content?media=' + (asset.mime_type?.startsWith('video/') ? 'video' : 'image')

export function useAuthStore() { return userState }
export function useSubscription() {
  return { fetchSubscriptionStatus: async () => { const result = await auth.me(); userState.user = { ...result.user, subscription_status: (result.user as any).subscription?.status || (result.user as any).subscription_status } } }
}
type FileDialogOptions = { filters?: { name?: string; extensions: string[] }[]; multiple?: boolean; directory?: boolean }
export function openFileDialog(options: FileDialogOptions & { multiple: true }): Promise<string[] | null>
export function openFileDialog(options?: FileDialogOptions & { multiple?: false }): Promise<string | null>
export async function openFileDialog(options: FileDialogOptions = {}): Promise<string | string[] | null> {
  const selected = await new Promise<File[] | null>(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = options.multiple === true
    input.accept = options.filters?.flatMap(filter => filter.extensions.map(extension => '.' + extension)).join(',') || ''
    input.style.display = 'none'
    document.body.append(input)
    const finish = (files: File[] | null) => { input.remove(); resolve(files) }
    input.addEventListener('change', () => finish(input.files?.length ? Array.from(input.files) : null), { once: true })
    input.addEventListener('cancel', () => finish(null), { once: true })
    input.click()
  })
  if (!selected) return null
  const keys = selected.map(file => { const key = 'browser-file/' + crypto.randomUUID() + '/' + file.name; files.set(key, file); return key })
  return options.multiple ? keys : keys[0]
}
export const convertFileSrc = (path: string) => {
  const file = files.get(path)
  if (!file) return path
  let url = previewUrls.get(path)
  if (!url) { url = URL.createObjectURL(file); previewUrls.set(path, url) }
  return url
}
export function releaseSelectedFiles() {
  for (const url of previewUrls.values()) URL.revokeObjectURL(url)
  previewUrls.clear(); files.clear(); uploadedFiles.clear()
}
export async function readFile(path: string) {
  const file = files.get(path)
  if (file) return new Uint8Array(await file.arrayBuffer())
  const response = await fetch(path)
  if (!response.ok) throw new Error('Could not read branding asset.')
  return new Uint8Array(await response.arrayBuffer())
}
async function dimensions(file: File): Promise<Record<string, number>> {
  const url = URL.createObjectURL(file)
  try {
    if (file.type.startsWith('video/')) return await new Promise((resolve, reject) => {
      const video = document.createElement('video')
      video.preload = 'metadata'
      const timer = setTimeout(() => { video.removeAttribute('src'); video.load(); reject(new Error('Video metadata could not be read. Use MP4 or WebM.')) }, 15_000)
      video.onloadedmetadata = () => { clearTimeout(timer); resolve({ width: video.videoWidth, height: video.videoHeight, duration: video.duration }); video.removeAttribute('src'); video.load() }
      video.onerror = () => { clearTimeout(timer); reject(new Error('Video metadata could not be read. Use MP4 or WebM.')) }
      video.src = url
    })
    return await new Promise((resolve, reject) => {
      const image = new Image()
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
      image.onerror = () => reject(new Error('Image could not be read.'))
      image.src = url
    })
  } finally { URL.revokeObjectURL(url) }
}
async function uploadAsset(file: File, type: string, organizationId?: string | number, metadata: Record<string, unknown> = {}) {
  const measured = await dimensions(file).catch(error => { if (file.type.startsWith('video/')) return {}; throw error })
  const query = new URLSearchParams({ asset_type: type, name: String(metadata.name || file.name.replace(/\.[^/.]+$/, '')), filename: file.name, mime: file.type })
  for (const [key, value] of Object.entries({ ...measured, ...metadata })) if (typeof value === 'number' && Number.isFinite(value)) query.set(key, String(value))
  const response = await fetch(prefix + account + '/' + (organizationId ? 'organizations/' + organizationId : 'user') + '/assets?' + query, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file, signal: AbortSignal.timeout(5 * 60_000) })
  const result = await response.json() as { success: boolean; asset: Asset; error?: string }
  if (!response.ok || !result.success) throw new Error(result.error || 'Branding upload failed.')
  result.asset.url = assetUrl(result.asset, organizationId)
  return result.asset
}
async function listAssets(organizationId?: string | number) {
  const result = await workspaceClient.get<{ success: boolean; assets: Asset[] }>(account + '/' + (organizationId ? 'organizations/' + organizationId : 'user') + '/assets')
  return result.assets.map(asset => ({ ...asset, url: assetUrl(asset, organizationId) }))
}
const localAsset = (asset: Asset) => ({ ...asset, id: String(asset.id), file_path: asset.url, type: asset.asset_type, created_at: Date.parse(asset.inserted_at), updated_at: Date.parse(asset.updated_at), upload_status: 'completed', thumbnail_path: asset.thumbnail_url })
export async function getAllIntroOutros(type?: string): Promise<IntroOutro[]> {
  return (await listAssets()).filter(asset => ['intro', 'outro'].includes(asset.asset_type) && (!type || asset.asset_type === type)).map(localAsset) as unknown as IntroOutro[]
}
export async function getWatermarkImage(id: string) { return (await getAllWatermarkImages()).find(value => value.id === id) || null }
export async function getAllWatermarkImages(): Promise<WatermarkImage[]> {
  return (await listAssets()).filter(asset => asset.asset_type === 'watermark').map(localAsset) as unknown as WatermarkImage[]
}
export async function resolveOverlayImagePath(path: string | null, id: string) {
  return path || (await listAssets()).find(asset => String(asset.id) === id)?.url || null
}
export function useAssetOperations() {
  const callbacks = new Set<() => unknown>()
  return {
    onUploadComplete: (callback: () => unknown) => { callbacks.add(callback); return () => { callbacks.delete(callback) } },
    uploadAsset: async (type: 'intro' | 'outro') => {
      const selected = await openFileDialog({ filters: [{ extensions: ['mp4', 'mov', 'webm', 'm4v'] }] })
      if (!selected) return
      await uploadAsset(files.get(selected)!, type)
      files.delete(selected)
      for (const callback of callbacks) await callback()
    }
  }
}
export function useWatermarkOperations() {
  return { uploadWatermark: async () => {
    const selected = await openFileDialog({ filters: [{ extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'gif'] }] })
    if (!selected) return { success: false }
    const asset = await uploadAsset(files.get(selected)!, 'watermark')
    files.delete(selected)
    return { success: true, watermarkId: String(asset.id) }
  } }
}
export async function listOrganizationAssets(id: string | number) { return { success: true, assets: await listAssets(id) } }
export async function uploadOrganizationAsset(id: string | number, file: File, type: string, metadata: Record<string, unknown> = {}): Promise<{ success: boolean; asset?: Asset; error?: string }> { return { success: true, asset: await uploadAsset(file, type, id, metadata) } }
export function createOrganizationCreatorProfile(id: string | number, body: unknown) { return workspaceClient.post<{ success: boolean; profile?: ServerOrganizationCreatorProfile; error?: string }>(account + '/organizations/' + id + '/creator-profiles', body) }
export function updateOrganizationCreatorProfile(id: string | number, profileId: number, body: unknown) { return workspaceClient.put<{ success: boolean; profile?: ServerOrganizationCreatorProfile; error?: string }>(account + '/organizations/' + id + '/creator-profiles/' + profileId, body) }
export function apiAddPlatformLink(id: string | number, profileId: number, body: unknown) { return workspaceClient.post(account + '/organizations/' + id + '/creator-profiles/' + profileId + '/platform-links', body) }
export function apiDeletePlatformLink(id: string | number, profileId: number, linkId: number) { return workspaceClient.delete(account + '/organizations/' + id + '/creator-profiles/' + profileId + '/platform-links/' + linkId) }
async function persistImagePath(path: string, type: 'image' | 'overlay') {
  const file = files.get(path)
  if (!file) return path
  let asset = uploadedFiles.get(path)
  if (!asset) { asset = await uploadAsset(file, type); uploadedFiles.set(path, asset); uploadedFiles.set(asset.url, asset) }
  return asset.url
}
export async function saveLocalCreator(form: CreatorProfileForm, creator: CreatorProfileWithLinks | null, hasDefaults: boolean) {
  const overlays = JSON.parse(JSON.stringify(form.layout_overlays))
  for (const overlay of overlays) {
    if (overlay.imagePath) {
      const path = await persistImagePath(overlay.imagePath, 'overlay')
      const asset = uploadedFiles.get(path)
      if (asset) overlay.assetId = asset.id
      if (overlay.assetId) delete overlay.imagePath
    }
    for (const config of Object.values(overlay.perRatioSettings || {}) as { imagePath?: string; assetId?: number }[]) if (config?.imagePath) {
      const path = await persistImagePath(config.imagePath, 'overlay')
      const asset = uploadedFiles.get(path)
      if (asset) config.assetId = asset.id
      if (config.assetId) delete config.imagePath
    }
  }
  const defaults = JSON.parse(JSON.stringify(form.clip_build_defaults))
  if (defaults.referenceImageUrl) {
    const path = await persistImagePath(defaults.referenceImageUrl, 'image')
    const asset = uploadedFiles.get(path)
    if (asset) defaults.referenceImageAssetId = asset.id
    if (defaults.referenceImageAssetId) defaults.referenceImageUrl = null
  }
  const body = {
    name: form.name.trim(), description: form.description.trim() || null, scope: form.scope,
    intro_id: form.intro_id ? Number(form.intro_id) : null, outro_id: form.outro_id ? Number(form.outro_id) : null,
    watermark_id: form.watermark_id ? Number(form.watermark_id) : null, watermark_settings: form.watermark_settings,
    intro_outro_settings: parseSettings(form.intro_outro_settings), intro_ratio_settings: form.intro_ratio_settings,
    outro_ratio_settings: form.outro_ratio_settings, layout_overlays: overlays, auto_dvr_enabled: form.auto_dvr_enabled,
    clip_build_defaults: hasDefaults || defaults.referenceImageSource !== 'none' ? defaults : null,
    platform_links: form.platformLinks.filter(link => link.platform_id.trim()).map(({ platform, platform_id, display_name, profile_image_url, is_primary }) => ({ platform, platform_id: platform_id.trim(), display_name, profile_image_url, is_primary })),
    profile_image_url: form.platformLinks.find(link => link.is_primary && link.profile_image_url)?.profile_image_url || form.platformLinks.find(link => link.profile_image_url)?.profile_image_url || null
  }
  return creator ? workspaceClient.put(account + '/user/creator-profiles/' + creator.id, body) : workspaceClient.post(account + '/user/creator-profiles', body)
}
/** Hydrate stored asset IDs with authenticated previews; profile JSON never stores expiring preview URLs. */
export async function hydrateCreatorAssets<T extends Record<string, any>>(profiles: T[]): Promise<T[]> {
  const assets = await listAssets()
  const url = (id: unknown) => assets.find(asset => String(asset.id) === String(id))?.url
  return profiles.map(profile => {
    const result = JSON.parse(JSON.stringify(profile))
    for (const overlay of result.layout_overlays || []) {
      if (overlay.assetId) overlay.imagePath = url(overlay.assetId) || ''
      for (const config of Object.values(overlay.perRatioSettings || {}) as { assetId?: number; imagePath?: string }[]) if (config?.assetId) config.imagePath = url(config.assetId) || ''
    }
    if (result.clip_build_defaults?.referenceImageAssetId) result.clip_build_defaults.referenceImageUrl = url(result.clip_build_defaults.referenceImageAssetId) || null
    return result
  })
}
function parseSettings(value: string | null) { return value ? JSON.parse(value) : null }
export const generateId = () => crypto.randomUUID()
export async function createIntroOutro(_type: string, _name: string, path: string, ..._rest: unknown[]) {
  const asset = uploadedFiles.get(path)
  if (!asset) throw new Error('Uploaded intro/outro was not found.')
  return String(asset.id)
}
export async function listen(name: string, callback: (event: { payload: unknown }) => unknown) {
  const handlers = listeners.get(name) || new Set()
  handlers.add(callback); listeners.set(name, handlers)
  return () => { handlers.delete(callback) }
}
/** Media operations consumed by the shared creator dialogs; never calls native IPC on web. */
export async function invoke<T>(command: string, args: Record<string, any>): Promise<T> {
  switch (command) {
    case 'read_file_as_data_url': return convertFileSrc(args.filePath) as T
    case 'download_url_as_data_url': return args.url as T
    case 'convert_video_to_mp4': {
      const file = files.get(args.inputPath)
      if (!file) throw new Error('Select a video to convert.')
      const response = await fetch(prefix + account + '/creator-media/convert', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file, signal: AbortSignal.timeout(5 * 60_000) })
      if (!response.ok) { const result = await response.json(); throw new Error(result.error || 'Video conversion failed.') }
      const key = 'browser-file/' + crypto.randomUUID() + '/overlay.mp4'
      files.set(key, new File([await response.blob()], 'overlay.mp4', { type: 'video/mp4' }))
      files.delete(args.inputPath)
      return key as T
    }
    case 'copy_creator_reference_frame_to_storage': return { destination_path: await persistImagePath(args.sourcePath, 'image') } as T
    case 'upload_asset_async': {
      const file = files.get(args.sourcePath)
      if (!file) throw new Error('Select a video to upload.')
      const asset = await uploadAsset(file, args.assetType)
      uploadedFiles.set(asset.url, asset)
      for (const callback of listeners.get('asset-upload-complete') || []) await callback({ payload: { upload_id: args.uploadId, success: true, file_path: asset.url, duration: asset.duration } })
      files.delete(args.sourcePath)
      return undefined as T
    }
    default: throw new Error('Unsupported creator media operation: ' + command)
  }
}
const channelInfo = (platform: string, channel: string) => workspaceClient.get<any>(account + '/creator-channel?platform=' + platform + '&channel=' + encodeURIComponent(channel))
export const checkKickLivestream = (channel: string) => channelInfo('kick', channel)
export const checkTwitchLivestream = (channel: string) => channelInfo('twitch', channel)
export const getYouTubeChannelInfo = (channel: string) => channelInfo('youtube', channel)
export const getRumbleChannelInfo = (channel: string) => channelInfo('rumble', channel)
export async function fetchTokenMetadataFromServer(mint: string) {
  const result = await workspaceClient.get<{ success: boolean; metadata?: { name: string; symbol: string; image?: string } }>(account + '/metadata/' + encodeURIComponent(mint))
  return result.success && result.metadata ? { ...result.metadata, mint, pairAddress: '' } : null
}
export async function searchPumpFunTokens(query: string) { const result = await fetchTokenMetadataFromServer(query); return result ? [result] : [] }
