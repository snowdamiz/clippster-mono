import { join } from 'node:path'
import { readFile, unlink } from 'node:fs/promises'
import { normalizeCreatorSkillTranscriptionWords, type WebClip, type WebProject, type WordInfo } from '@clippster/shared-types'
import type { Store } from './store'
import type { Config } from './config'
import { prepareClipPreview } from './clipPreviewRoutes'
import { run } from './process'
export async function transcribeClip(store: Store, config: Config, owner: string, token: string, project: WebProject, clip: WebClip, work: string, signal: AbortSignal, organizationId?: number | null) {
  const source = await prepareClipPreview(store, config, owner, project.id, clip.id), duration = clip.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0)
  const words = await transcribeVideoWords(config, token, project.id, source, duration, work, signal, organizationId)
  let offset = 0; clip.subtitleWords = []
  for (const segment of clip.segments) { const length = segment.end_time - segment.start_time; clip.subtitleWords.push(...words.filter(word => word.end > offset && word.start < offset + length).map(word => ({ ...word, start: segment.start_time + Math.max(0, word.start - offset), end: segment.start_time + Math.min(length, word.end - offset) }))); offset += length }
  clip.revision++
}

/** Reuse the existing zero-personal-credit single-clip transcription path for final QA. */
export async function transcribeVideoWords(config: Config, token: string, projectId: string, source: string, duration: number, work: string, signal: AbortSignal, organizationId?: number | null): Promise<WordInfo[]> {
  if (!Number.isFinite(duration) || duration <= 0 || duration > 30 * 60) throw new Error('Final speech re-transcription supports clips up to 30 minutes.')
  const path = join(work, 'clip-audio.mp3')
  await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', source, '-vn', '-ac', '1', '-ar', '16000', '-b:a', '24k', '-y', path], signal)
  try {
    const form = new FormData(); form.append('audio', new Blob([await readFile(path)], { type: 'audio/mpeg' }), 'clip.mp3'); form.append('project_id', projectId); form.append('duration', String(duration)); form.append('free_single_clip', 'true'); form.append('free_single_clip_total_duration', String(duration))
    if (organizationId) form.append('organization_id', String(organizationId))
    const response = await fetch(`${config.apiUrl}/clips/transcribe`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'X-Client-Platform': 'web' }, body: form, signal: AbortSignal.any([signal, AbortSignal.timeout(30 * 60_000)]) })
    const result = await response.json() as { success?: boolean; details?: string; error?: string; transcript?: { words?: unknown[]; segments?: { words?: unknown[] }[] } }
    if (!response.ok || !result.success) throw new Error(result.details || result.error || 'Clip transcription failed.')
    return normalizeCreatorSkillTranscriptionWords(result.transcript, duration)
  } finally {
    await unlink(path).catch(() => {})
  }
}
