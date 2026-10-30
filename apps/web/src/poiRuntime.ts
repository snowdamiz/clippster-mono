import { framingAssetPath, prepareUpload } from './api'
export type PoiTimelineEditor = { playback: { getCurrentTime(): number; getIsPlaying(): boolean; getVolume(): number; isMuted(): boolean; seek(options: { time: number }): void; pause(): void; toggleMute(): void; setVolume(options: { volume: number }): void; subscribe(callback: () => void): () => void; toggle(): void; play(): Promise<void> } }
export function getPoiTimelineEditor(): PoiTimelineEditor | null { return null }
export async function resolvePoiVideoSource(path: string, _urlSafe = false) {
  const url = new URL(path, location.origin)
  if (url.origin !== location.origin) throw new Error('Choose a source from this project.')
  return url.href
}
export async function savePoiMedia(file: File, projectId?: string | null) {
  if (!projectId) throw new Error('Open a project before uploading media.')
  const type = file.type.startsWith('image/') ? 'image' : 'video'
  const target = await prepareUpload(`${framingAssetPath(projectId)}?type=${type}&name=${encodeURIComponent(file.name)}`, file)
  const response = await fetch(target.url, { method: 'POST', body: target.body, credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Media upload failed.')
  return result.asset.id as string
}
export function resolvePoiMedia(projectId: string | null | undefined, path: string) {
  return projectId && /^[0-9a-f-]{36}$/i.test(path) ? framingAssetPath(projectId, path) : path
}
