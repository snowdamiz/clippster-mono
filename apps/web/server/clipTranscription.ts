import { join } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { WebClip, WebProject } from '@clippster/shared-types'
import type { Store } from './store'
import type { Config } from './config'
import { prepareClipPreview } from './clipPreviewRoutes'
import { run } from './process'
import { normalizeDetection } from './detection'
export async function transcribeClip(store: Store, config: Config, owner: string, token: string, project: WebProject, clip: WebClip, work: string, signal: AbortSignal, organizationId?: number | null) {
  const source = await prepareClipPreview(store, config, owner, project.id, clip.id), duration = clip.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0), path = join(work, 'clip-audio.mp3')
  await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', source, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '24k', '-y', path], signal)
  const form = new FormData(); form.append('audio', new Blob([await readFile(path)], { type: 'audio/mpeg' }), 'clip.mp3'); form.append('project_id', project.id); form.append('duration', String(duration)); form.append('free_single_clip', 'true'); form.append('total_clip_seconds', String(duration))
  if (organizationId) form.append('organization_id', String(organizationId))
  const response = await fetch(`${config.apiUrl}/clips/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Client-Platform': 'web' }, body: form, signal: AbortSignal.any([signal, AbortSignal.timeout(30 * 60_000)]) })
  const result = await response.json() as any
  if (!response.ok || !result.success) throw new Error(result.details || result.error || 'Clip transcription failed.')
  const words = normalizeDetection({ ...result, clips: [] }, { ...project, duration }).words
  let offset = 0; clip.subtitleWords = []
  for (const segment of clip.segments) { const length = segment.end_time - segment.start_time; clip.subtitleWords.push(...words.filter(word => word.end > offset && word.start < offset + length).map(word => ({ ...word, start: segment.start_time + Math.max(0, word.start - offset), end: segment.start_time + Math.min(length, word.end - offset) }))); offset += length }
  clip.revision++
}
