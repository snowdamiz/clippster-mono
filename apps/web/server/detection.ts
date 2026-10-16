import { randomUUID } from 'node:crypto'
import type { WebClip, WebProject, WordInfo } from '@clippster/shared-types'
import { clipInput } from './validation'
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
      const score = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : undefined
      clips.push({ ...input, id: randomUUID(), revision: 1, builtRevision: null, detection: { viralityScore: score(data.virality_score), confidenceScore: score(data.confidence_score), reason: typeof data.reason === 'string' ? data.reason.slice(0, 10000) : undefined } })
    } catch {
      /* Invalid model timestamps cannot enter the editor or renderer. */
    }
  }
  if (detected.length && !clips.length)
    throw new Error('The AI returned no valid clip times. Refine your prompt and try again.')
  return { clips, words }
}
