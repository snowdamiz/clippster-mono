import AsyncStorage from '@react-native-async-storage/async-storage'
import { File, Paths } from 'expo-file-system'
import * as LegacyFileSystem from 'expo-file-system/legacy'
import { fetch as expoFetch } from 'expo/fetch'
import type { CreatorSkillDocumentName, WebClip, WebJob, WebWorkspace } from '@clippster/shared-types'
import { WEB_UPLOAD_CHUNK_BYTES, creatorSkillFormatForDuration } from '@clippster/shared-types'
import { getWorkspaceApiBaseUrl } from '@/lib/config'
import { getStoredToken, getStoredUser } from './authStorage'

const base = () => `${getWorkspaceApiBaseUrl()}/web`

async function headers(json = false): Promise<Record<string, string>> {
  const token = await getStoredToken()
  if (!token) throw new Error('Sign in before using Clippster Skill.')
  return {
    Authorization: `Bearer ${token}`,
    'X-Client-Platform': 'mobile',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  }
}

async function request<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await expoFetch(`${base()}${path}`, {
    method, headers: await headers(body !== undefined),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal,
  })
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null
    throw new Error(payload?.error || `Workspace request failed (${response.status}).`)
  }
  if (response.status === 204) return undefined as T
  return await response.json() as T
}

export async function creatorSkillPolicy(signal?: AbortSignal): Promise<{ credits: { generate: number } }> {
  return request('/ai/video/policy', 'GET', undefined, signal)
}

async function projectKey(localProjectId: string): Promise<string> {
  const user = await getStoredUser()
  if (!user) throw new Error('Sign in before using Clippster Skill.')
  return `clippster.creatorSkill.webProject.${user.id}.${localProjectId}`
}

export async function ensureCreatorSkillWebProject(localProjectId: string, name: string, vodPath: string, onProgress: (ratio: number) => void, signal?: AbortSignal, creatorProfileId?: number | null): Promise<WebWorkspace> {
  const key = await projectKey(localProjectId)
  const storedId = await AsyncStorage.getItem(key)
  const existing = storedId ? await request<WebWorkspace>(`/projects/${storedId}`, 'GET', undefined, signal).catch(() => null) : null
  if (existing?.project.status === 'ready') return creatorProfileId === undefined || existing.project.creatorId === creatorProfileId
    ? existing : request<WebWorkspace>(`/projects/${existing.project.id}`, 'PATCH', { creatorId: creatorProfileId }, signal)
  const importJob = existing?.jobs.find(job => job.kind === 'import' && ['queued', 'running'].includes(job.status))
  if (importJob) {
    const ready = await waitForCreatorSkillWebJob(importJob, () => {}, signal)
    return creatorProfileId === undefined || ready.project.creatorId === creatorProfileId
      ? ready : request<WebWorkspace>(`/projects/${ready.project.id}`, 'PATCH', { creatorId: creatorProfileId }, signal)
  }
  let project = existing ?? await request<WebWorkspace>('/projects', 'POST', { name: `${name} · Mobile Clippster Skill` }, signal)
  if (creatorProfileId !== undefined && project.project.creatorId !== creatorProfileId) project = await request<WebWorkspace>(`/projects/${project.project.id}`, 'PATCH', { creatorId: creatorProfileId }, signal)
  await AsyncStorage.setItem(key, project.project.id)
  const file = new File(vodPath.startsWith('file://') ? vodPath : `file://${vodPath}`)
  if (!file.exists || !file.size) throw new Error('The downloaded VOD is unavailable on this device.')
  const staged = await request<{ id: string }>('/uploads', 'POST', { size: file.size }, signal)
  let offset = 0
  try {
    while (offset < file.size) {
      signal?.throwIfAborted()
      const end = Math.min(offset + WEB_UPLOAD_CHUNK_BYTES, file.size)
      let delivered = false
      for (let attempt = 0; attempt < 3 && !delivered; attempt++) {
        try {
          const response = await expoFetch(`${base()}/uploads/${staged.id}?offset=${offset}`, {
            method: 'PUT',
            headers: { ...await headers(), 'Content-Type': 'application/octet-stream' },
            body: file.slice(offset, end), signal,
          })
          const result = await response.json() as { received?: number; error?: string }
          if (response.status === 409 && typeof result.received === 'number') {
            offset = result.received
            delivered = true
          } else if (!response.ok || result.received !== end) {
            throw new Error(result.error || `VOD upload failed (${response.status}).`)
          } else { offset = end; delivered = true }
        } catch (error) {
          if (signal?.aborted || attempt === 2) throw error
        }
      }
      onProgress(offset / file.size)
    }
    const uploaded = await request<WebJob>(`/projects/${project.project.id}/source?upload=${staged.id}`, 'PUT', undefined, signal)
    return await waitForCreatorSkillWebJob(uploaded, () => {}, signal)
  } catch (error) {
    await request(`/uploads/${staged.id}`, 'DELETE').catch(() => {})
    throw error
  }
}

export function setCreatorSkillWebTranscript(projectId: string, words: Array<{ word: string; start: number; end: number }>, signal?: AbortSignal) {
  return request<WebWorkspace>(`/projects/${projectId}/transcript`, 'POST', { words }, signal)
}

export function getCreatorSkillWebProject(projectId: string, signal?: AbortSignal) {
  return request<WebWorkspace>(`/projects/${projectId}`, 'GET', undefined, signal)
}

export function reviewCreatorSkillWebClaim(projectId: string, clipId: string, claimIndex: number, decision: 'source_checked' | 'label_checked' | 'needs_changes', note: string) {
  return request<WebWorkspace>(`/projects/${projectId}/clips/${clipId}/creator-skill/claim-review`, 'PATCH', { claimIndex, decision, note })
}

export function reviewCreatorSkillWebFootage(projectId: string, clipId: string, footageIndex: number, decision: 'frame_checked' | 'needs_changes', note: string) {
  return request<WebWorkspace>(`/projects/${projectId}/clips/${clipId}/creator-skill/footage-review`, 'PATCH', { footageIndex, decision, note })
}
export function reviewCreatorSkillWebFinding(projectId: string, clipId: string, finding: { reviewer: string; severity: 'fix_first' | 'should_fix' | 'ok'; outputTime: number; finding: string }) {
  return request<WebWorkspace>(`/projects/${projectId}/clips/${clipId}/creator-skill/independent-review`, 'PATCH', finding)
}
export function signOffCreatorSkillWebReview(projectId: string, clipId: string, input: { reviewer: string; note: string }) {
  return request<WebWorkspace>(`/projects/${projectId}/clips/${clipId}/creator-skill/independent-signoff`, 'PATCH', input)
}

export function addCreatorSkillWebClip(projectId: string, clip: { name: string; segments: Array<{ start_time: number; end_time: number }> }, signal?: AbortSignal) {
  const duration = clip.segments.reduce((total, segment) => total + Math.max(0, segment.end_time - segment.start_time), 0)
  return request<WebWorkspace>(`/projects/${projectId}/clips`, 'POST', { ...clip, aspectRatio: creatorSkillFormatForDuration(duration), captions: false }, signal)
}

export function startCreatorSkillWebClip(projectId: string, clipId: string, maxCreditsPerClip: number, signal?: AbortSignal) {
  return request<WebJob>(`/projects/${projectId}/clips/${clipId}/creator-skill`, 'POST', { maxCreditsPerClip }, signal)
}

export function cancelCreatorSkillWebJob(jobId: string) {
  return request<void>(`/jobs/${jobId}`, 'DELETE')
}

export async function waitForCreatorSkillWebJob(job: WebJob, onProgress: (job: WebJob) => void, signal?: AbortSignal): Promise<WebWorkspace> {
  while (true) {
    signal?.throwIfAborted()
    const workspace = await request<WebWorkspace>(`/projects/${job.projectId}`, 'GET', undefined, signal)
    const current = workspace.jobs.find(item => item.id === job.id)
    if (!current) throw new Error('The Clippster Skill job is no longer available.')
    onProgress(current)
    if (current.status === 'completed') return workspace
    if (current.status === 'failed' || current.status === 'cancelled') throw new Error(current.message)
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
}

export async function downloadCreatorSkillWebClip(projectId: string, clip: WebClip): Promise<string> {
  if (clip.creatorSkill?.status !== 'needs_review' || clip.builtRevision !== clip.revision) throw new Error('The edited clip is not ready.')
  const target = new File(Paths.document, `creator-skill-${clip.id}-${Date.now()}.mp4`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clip.id}/download`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download the edited clip (${result.status}).`)
  return target.uri
}

export async function downloadCreatorSkillDocument(projectId: string, clipId: string, name: CreatorSkillDocumentName): Promise<string> {
  const target = new File(Paths.cache, `creator-skill-${clipId}-${name}`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/documents/${name}`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download ${name} (${result.status}).`)
  return target.uri
}

export async function downloadCreatorSkillDelivery(projectId: string, clipId: string): Promise<string> {
  const target = new File(Paths.document, `creator-skill-${clipId}-${Date.now()}.zip`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/delivery`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download the full delivery (${result.status}).`)
  return target.uri
}

export async function downloadCreatorSkillThumbnailDraft(projectId: string, clipId: string, index: number): Promise<string> {
  if (!Number.isSafeInteger(index) || index < 0 || index > 3) throw new Error('Choose a valid thumbnail draft.')
  const target = new File(Paths.cache, `creator-skill-${clipId}-thumbnail-${index}.png`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/thumbnail-variants/${index}`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download thumbnail draft (${result.status}).`)
  return target.uri
}
export async function downloadCreatorSkillThumbnailCandidate(projectId: string, clipId: string, index: number): Promise<string> {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 12) throw new Error('Choose a valid VOD frame.')
  const target = new File(Paths.cache, `creator-skill-${clipId}-vod-frame-${index}.jpg`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/thumbnails/${index}`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download the VOD frame (${result.status}).`)
  return target.uri
}

export async function downloadCreatorSkillContactSheet(projectId: string, clipId: string): Promise<string> {
  const target = new File(Paths.cache, `creator-skill-${clipId}-contact-sheet.jpg`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/contact-sheet`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download the visual contact sheet (${result.status}).`)
  return target.uri
}

export async function downloadCreatorSkillPhonePreview(projectId: string, clipId: string): Promise<string> {
  const target = new File(Paths.cache, `creator-skill-${clipId}-phone-preview.mp4`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/phone-preview`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download the phone preview (${result.status}).`)
  return target.uri
}

export async function downloadCreatorSkillNoMusic(projectId: string, clipId: string): Promise<string> {
  const target = new File(Paths.cache, `creator-skill-${clipId}-no-music.mp4`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/no-music`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download the no-music edit (${result.status}).`)
  return target.uri
}

export async function downloadCreatorSkillTikTokCut(projectId: string, clipId: string): Promise<string> {
  const target = new File(Paths.cache, `creator-skill-${clipId}-tiktok-no-sponsor.mp4`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/tiktok-no-sponsor`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download the sponsor-free TikTok cut (${result.status}).`)
  return target.uri
}

export async function downloadCreatorSkillTikTokCaptions(projectId: string, clipId: string): Promise<string> {
  const target = new File(Paths.cache, `creator-skill-${clipId}-tiktok-no-sponsor.srt`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/tiktok-no-sponsor-captions`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download the TikTok cut captions (${result.status}).`)
  return target.uri
}

export async function downloadCreatorSkillSourceCapture(projectId: string, clipId: string, index: number): Promise<string> {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 12) throw new Error('Choose a valid source capture.')
  const target = new File(Paths.cache, `creator-skill-${clipId}-source-${index}.txt`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/source-captures/${index}`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download the source capture (${result.status}).`)
  return target.uri
}

export async function downloadCreatorSkillSourceScreenshot(projectId: string, clipId: string, index: number): Promise<string> {
  if (!Number.isSafeInteger(index) || index < 0 || index >= 12) throw new Error('Choose a valid source screenshot.')
  const target = new File(Paths.cache, `creator-skill-${clipId}-source-${index}.png`)
  const result = await LegacyFileSystem.downloadAsync(`${base()}/projects/${projectId}/clips/${clipId}/creator-skill/source-captures/${index}/screenshot`, target.uri, { headers: await headers() })
  if (result.status < 200 || result.status >= 300) throw new Error(`Could not download the static source screenshot (${result.status}).`)
  return target.uri
}
