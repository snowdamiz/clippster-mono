import { reactive } from 'vue'
import { projects, workspaceClient } from './api'
import type { PlatformClip } from '@/stores/platform'
export { extractMintId } from '@/lib/creatorPlatformIds'
export interface CreatorVod { id: string; title: string; duration_seconds: number | null; url: string; upload_date?: string | number; thumbnail_url?: string; is_live?: boolean }
export function normalizeVodDate(value?: string | number) { if (!value) return undefined; const text = String(value); return /^\d{8}$/.test(text) ? `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}T00:00:00` : typeof value === 'number' ? new Date(value * 1000).toISOString() : text }
export async function listCreatorVods(platform: string, channel: string, offset = 0, tab: 'streams' | 'videos' = 'streams') {
  const result = await workspaceClient.get<{ success: boolean; vods: CreatorVod[]; has_more?: boolean; total?: number }>(`/web/account/media/vods?platform=${encodeURIComponent(platform.toLowerCase())}&channel=${encodeURIComponent(channel)}&limit=20&offset=${offset}&tab=${tab}`)
  if (new URLSearchParams(location.search).has('embedded')) result.vods = result.vods.map(vod => ({ ...vod, thumbnail_url: vod.thumbnail_url?.startsWith('/api/web/account/media/vod-thumbnail?') ? '/workspace' + vod.thumbnail_url : vod.thumbnail_url }))
  return result
}
export function useCreatorDownloadRuntime() {
  let activePlatform = '', startedProject = ''
  const platformStore = reactive({
    clips: [] as PlatformClip[],
    setActivePlatform: (platform: string) => { activePlatform = platform },
    async searchClips(channel: string, _limit: number) {
      const response = await listCreatorVods(activePlatform, channel)
      platformStore.clips = response.vods.filter(vod => !vod.is_live && Number(vod.duration_seconds) >= 180).map(vod => ({ clipId: vod.id, title: vod.title, duration: Number(vod.duration_seconds), mp4Url: vod.url, clipType: 'COMPLETE' as const, createdAt: normalizeVodDate(vod.upload_date) }))
      return { success: response.success, total: platformStore.clips.length, error: undefined as string | undefined }
    }
  })
  async function startDownload(title: string, url: string, channel: string, range?: { startTime: number; endTime: number }, _vodId?: string, duration?: number, options?: { autoSegment?: boolean; segmentDuration?: number; provider?: string; creatorWatermarkSettings?: unknown; creatorProfileId?: number; applyCreatorClipLayout?: boolean }) {
    const start = range?.startTime || 0, end = range?.endTime ?? duration
    if (!Number.isFinite(end) || Number(end) <= start) throw new Error('This VOD has no usable duration. Choose another completed video.')
    const seconds = options?.autoSegment ? options.segmentDuration || 1800 : Number(end) - start
    const count = Math.ceil((Number(end) - start) / seconds)
    const existing = await projects.list()
    if (existing.projects.length + count > 20) throw new Error('There is not enough library space for these parts. Remove older projects or choose larger parts.')
    startedProject = ''
    for (let index = 0; index < count; index++) {
      const workspace = await projects.create((title + (count > 1 ? ` · Part ${index + 1}` : '')).slice(0, 120))
      try {
        const platform = (options?.provider || activePlatform).toLowerCase()
        if (platform && channel) await workspaceClient.patch(`/web/projects/${workspace.project.id}`, { name: workspace.project.name, sourcePlatform: platform, sourceChannel: channel })
        if (options?.applyCreatorClipLayout && options.creatorProfileId) await workspaceClient.post(`/web/projects/${workspace.project.id}/creator-layout`, { creatorId: options.creatorProfileId })
        const partStart = start + index * seconds, partEnd = Math.min(Number(end), partStart + seconds)
        await workspaceClient.post(`/web/projects/${workspace.project.id}/import`, { url, ...(range || count > 1 ? { range: { startTime: partStart, endTime: partEnd } } : {}) })
        startedProject ||= workspace.project.id
      } catch (error) {
        await projects.remove(workspace.project.id).catch(() => {})
        throw error
      }
    }
  }
  return { platformStore, startDownload, cancelDownload: async (id: string) => { await projects.cancel(id); window.dispatchEvent(new CustomEvent('clippster-refresh-library')) }, cancelGroup: async (id: string) => { await projects.cancel(id); window.dispatchEvent(new CustomEvent('clippster-refresh-library')) }, navigateProjects: () => {
    if (startedProject) window.dispatchEvent(new CustomEvent('clippster-show-library'))
  } }
}
