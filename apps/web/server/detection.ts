import { randomUUID } from 'node:crypto'
import type { WebClip, WebProject, WordInfo } from '@clippster/shared-types'
import { clipInput } from './validation'
import type { Config } from './config'
import { audioForDetection } from './media'
interface DetectionResponse {
  success: boolean
  error?: string
  details?: string
  clips?: unknown[] | { clips?: unknown[] }
  transcript?: { words?: unknown[]; segments?: { words?: unknown[] }[] }
}
export function normalizeDetection(
  result: DetectionResponse,
  project: WebProject
): { clips: WebClip[]; words: WordInfo[] } {
  const detected = Array.isArray(result.clips) ? result.clips : result.clips?.clips
  if (!Array.isArray(detected)) throw new Error('The AI returned an invalid clip response.')
  const words = (
    result.transcript?.words ||
    result.transcript?.segments?.flatMap((segment) => segment.words || []) ||
    []
  ).filter(
    (word): word is WordInfo =>
      !!word &&
      typeof word === 'object' &&
      typeof (word as WordInfo).word === 'string' &&
      Number.isFinite((word as WordInfo).start) &&
      Number.isFinite((word as WordInfo).end) &&
      (word as WordInfo).start >= 0 &&
      (word as WordInfo).end > (word as WordInfo).start &&
      (word as WordInfo).end <= project.duration + 1
  )
  const clips: WebClip[] = []
  for (const candidate of detected.slice(0, 50)) {
    if (!candidate || typeof candidate !== 'object') continue
    const data = candidate as Record<string, unknown>
    const rawSegments =
      Array.isArray(data.segments) && data.segments.length
        ? data.segments
        : [{ start_time: data.start_time, end_time: data.end_time }]
    try {
      const input = clipInput(
        {
          name: String(data.name || data.title || `AI clip ${clips.length + 1}`).slice(0, 120),
          segments: rawSegments,
          aspectRatio: '9:16',
          captions: words.length > 0
        },
        project.duration
      )
      clips.push({ ...input, id: randomUUID(), revision: 1, builtRevision: null })
    } catch {
      /* Invalid model timestamps cannot enter the editor or renderer. */
    }
  }
  if (detected.length && !clips.length)
    throw new Error('The AI returned no valid clip times. Refine your prompt and try again.')
  return { clips, words }
}
export async function detect(
  project: WebProject,
  prompt: string,
  token: string,
  directory: string,
  work: string,
  config: Config,
  signal: AbortSignal
) {
  if (!project.hasAudio)
    throw new Error('AI clipping needs a source with audio. You can still create clips manually.')
  const audio = await audioForDetection(directory, work, config, signal)
  const form = new FormData()
  form.append('audio', audio, 'audio.mp3')
  form.append('project_id', project.id)
  form.append('prompt', prompt)
  form.append('duration', String(project.duration))
  const response = await fetch(`${config.apiUrl}/clips/detect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Client-Platform': 'web' },
    body: form,
    signal: AbortSignal.any([signal, AbortSignal.timeout(30 * 60_000)])
  })
  const result = (await response.json()) as DetectionResponse
  if (!response.ok || !result.success)
    throw new Error(result.details || result.error || 'AI detection failed.')
  return normalizeDetection(result, project)
}
