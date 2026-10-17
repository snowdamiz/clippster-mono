import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { WebProject, WordInfo } from '@clippster/shared-types'
import type { Config } from './config'
import { run } from './process'
import { normalizeDetection } from './detection'
import { captionPresetSettings } from '../../../client/src/utils/captionPresetSettings'
import { requireValue } from './errors'
export interface WorkspaceDetectionOptions { organizationId?: number | null; startTime?: number; endTime?: number; subtitlePreset?: string | null; enhanced?: boolean }
export function detectionOptions(value: any, duration: number): WorkspaceDetectionOptions {
  const startTime = value?.startTime ?? 0, endTime = value?.endTime ?? duration, organizationId = value?.organizationId
  requireValue(Number.isFinite(startTime) && Number.isFinite(endTime) && startTime >= 0 && endTime > startTime && endTime <= duration + .05, 400, 'Choose a time range inside the video.')
  requireValue(organizationId == null || Number.isSafeInteger(organizationId) && organizationId > 0, 400, 'Choose a valid credit source.')
  requireValue(value?.enhanced === undefined || typeof value.enhanced === 'boolean', 400, 'Invalid detection mode.')
  requireValue(value?.subtitlePreset == null || typeof value.subtitlePreset === 'string' && !!captionPresetSettings(value.subtitlePreset), 400, 'Choose a valid subtitle preset.')
  return { startTime, endTime, organizationId, enhanced: value?.enhanced === true, subtitlePreset: value?.subtitlePreset || null }
}
export async function detectWorkspace(project: WebProject, prompt: string, token: string, directory: string, work: string, config: Config, signal: AbortSignal, options: WorkspaceDetectionOptions, transcriptionOnly: boolean, progress: (value: number, message: string) => void) {
  const start = options.startTime ?? 0, end = options.endTime ?? project.duration
  const headers = { Authorization: `Bearer ${token}`, 'X-Client-Platform': 'web' }
  async function request(endpoint: string, form: FormData) {
    const response = await fetch(`${config.apiUrl}/clips/${endpoint}`, { method: 'POST', headers, body: form, signal: AbortSignal.any([signal, AbortSignal.timeout(60 * 60_000)]) })
    const result = await response.json() as any
    if (!response.ok || !result.success) throw new Error(result.details || result.error || 'AI processing failed.')
    return result
  }
  const chunks: Array<{ chunk_id: string; raw_json: string; start_time: number; end_time: number }> = [], words: WordInfo[] = []
  const count = Math.ceil((end - start) / 900), form = new FormData()
  for (let index = 0; index < count; index++) {
    signal.throwIfAborted()
    const left = start + index * 900, right = Math.min(end, left + 900), duration = right - left
    let chunkWords = project.words.filter(word => word.end > left && word.start < right).map(word => ({ ...word, start: Math.max(0, word.start - left), end: Math.min(duration, word.end - left) }))
    progress(10 + Math.round(index / count * 40), `Preparing transcript ${index + 1} of ${count}…`)
    const cachedRanges = project.transcriptRanges || (project.words.length ? [{ start: 0, end: project.duration }] : [])
    const covered = [...cachedRanges].sort((a, b) => a.start - b.start).reduce((until, range) => range.start <= until ? Math.max(until, range.end) : until, left)
    if (covered < right || transcriptionOnly) {
      const path = join(work, `audio-${index}.mp3`)
      await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-ss', String(left), '-i', join(directory, 'source.mp4'), '-t', String(duration), '-vn', '-ac', '1', '-ar', '16000', '-b:a', '24k', '-y', path], signal)
      const audio = new FormData(); audio.append('audio', new Blob([await readFile(path)], { type: 'audio/mpeg' }), 'audio.mp3'); audio.append('project_id', project.id); audio.append('duration', String(duration))
      if (options.organizationId) audio.append('organization_id', String(options.organizationId))
      const result = await request('transcribe', audio)
      chunkWords = normalizeDetection({ ...result, clips: [] }, { ...project, duration }).words
    }
    words.push(...chunkWords.map(word => ({ ...word, start: word.start + left, end: word.end + left })))
    chunks.push({ chunk_id: `${project.id}-${index}`, start_time: left, end_time: right, raw_json: JSON.stringify({ text: chunkWords.map(word => word.word).join(' '), words: chunkWords, segments: chunkWords.map(word => ({ text: word.word, start: word.start, end: word.end, words: [word] })), language: 'en', duration }) })
    if (options.enhanced && !transcriptionOnly) {
      const path = join(work, `video-${index}.mp4`)
      await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-ss', String(left), '-i', join(directory, 'source.mp4'), '-t', String(duration), '-vf', 'scale=-2:480', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-maxrate', '400k', '-bufsize', '800k', '-c:a', 'aac', '-b:a', '64k', '-movflags', '+faststart', '-threads', '2', '-y', path], signal)
      form.append(`video_chunk_${index}`, new Blob([await readFile(path)], { type: 'video/mp4' }), `video_chunk_${index}.mp4`)
    }
  }
  const mergedWords = [...project.words.filter(word => word.end <= start || word.start >= end), ...words].sort((a, b) => a.start - b.start)
  if (transcriptionOnly) return { clips: [], words: mergedWords }
  form.append('project_id', project.id); form.append('prompt', prompt); form.append('chunks', JSON.stringify(chunks)); form.append('using_cached_transcript', 'true'); form.append('total_duration', String(project.duration)); form.append('language', 'english'); form.append('start_time', String(start)); form.append('end_time', String(end))
  if (options.organizationId) form.append('organization_id', String(options.organizationId))
  if (options.enhanced) form.append('enhanced', 'true')
  progress(60, options.enhanced ? 'Analyzing video and transcript…' : 'Detecting clips from transcript…')
  const result = normalizeDetection(await request('detect-chunked', form), project)
  for (const clip of result.clips) clip.segments = clip.segments.filter(segment => segment.start_time >= start && segment.end_time <= end + .05)
  result.clips = result.clips.filter(clip => clip.segments.length > 0)
  const preset = options.subtitlePreset ? captionPresetSettings(options.subtitlePreset) : null
  for (const clip of result.clips) { clip.captions = !!preset; if (preset) clip.subtitleSettings = preset }
  return { clips: result.clips, words: mergedWords }
}
