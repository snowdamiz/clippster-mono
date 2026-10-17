import type { WebClipInput, ClipSegment, TargetAspectRatio, WordInfo } from '@clippster/shared-types'
import { HttpError, requireValue } from './errors'
import { validateClipSettings, validateFramingConfigs } from './clipSettings'
export function textField(value: unknown, name: string, max: number): string {
  requireValue(
    typeof value === 'string' && value.trim().length > 0 && value.length <= max,
    400,
    `${name} must contain 1–${max} characters.`
  )
  return value.trim()
}
export function sourceUrl(value: unknown): string {
  const text = textField(value, 'Source URL', 2000)
  let url: URL
  try {
    url = new URL(text)
  } catch {
    throw new HttpError(400, 'Enter a valid source URL.')
  }
  const hosts = [
    'youtube.com',
    'www.youtube.com',
    'm.youtube.com',
    'youtu.be',
    'twitch.tv',
    'www.twitch.tv',
    'clips.twitch.tv',
    'kick.com',
    'www.kick.com',
    'vimeo.com',
    'www.vimeo.com',
    'rumble.com',
    'www.rumble.com',
    'twitter.com',
    'www.twitter.com',
    'x.com',
    'www.x.com'
  ]
  requireValue(
    url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      hosts.includes(url.hostname),
    400,
    'Use a public YouTube, Twitch, Kick, Vimeo, Rumble, or X video URL.'
  )
  return url.href
}
export function clipInput(
  value: unknown,
  duration: number
): WebClipInput & { segments: ClipSegment[] } {
  requireValue(value && typeof value === 'object', 400, 'Invalid clip.')
  const input = value as Record<string, unknown>
  const name = textField(input.name, 'Clip name', 120)
  requireValue(['16:9', '9:16', '1:1', '4:5'].includes(String(input.aspectRatio)), 400, 'Invalid aspect ratio.')
  requireValue(typeof input.captions === 'boolean', 400, 'Invalid captions setting.')
  requireValue(
    Array.isArray(input.segments) && input.segments.length > 0 && input.segments.length <= 100,
    400,
    'A clip needs 1–100 segments.'
  )
  const segments = input.segments
    .map((segment) => {
      const start = segment?.start_time
      const end = segment?.end_time
      requireValue(
        typeof start === 'number' &&
          typeof end === 'number' &&
          Number.isFinite(start) &&
          Number.isFinite(end) &&
          start >= 0 &&
          end <= duration + 0.05 &&
          end - start >= 0.1,
        400,
        'Clip times must be within the source and at least 0.1 seconds long.'
      )
      return {
        start_time: start,
        end_time: Math.min(end, duration),
        duration: Math.min(end, duration) - start,
        transcript: null
      }
    })
  requireValue(
    segments.reduce((sum, segment) => sum + segment.duration, 0) <= 86400,
    400,
    'Clips may contain up to 24 hours of media.'
  )
  return {
    name,
    ...(input.exportSettings !== undefined ? { exportSettings: validateExportSettings(input.exportSettings) } : {}),
    ...(input.subtitleWords !== undefined ? { subtitleWords: validateSubtitleWords(input.subtitleWords, duration) } : {}),
    ...validateClipSettings(input),
    ...(input.framingConfigs !== undefined ? { framingConfigs: validateFramingConfigs(input.framingConfigs) } : {}),
    segments,
    aspectRatio: input.aspectRatio as TargetAspectRatio,
    captions: input.captions
  }
}
function validateExportSettings(value: unknown): WebClipInput['exportSettings'] {
  if (value === null) return null
  requireValue(value && typeof value === 'object', 400, 'Invalid export settings.')
  const settings = value as NonNullable<WebClipInput['exportSettings']>
  requireValue(['low', 'medium', 'high'].includes(settings.quality) && [30, 60].includes(settings.frameRate) && ['mp4', 'mov'].includes(settings.format), 400, 'Invalid export settings.')
  return { quality: settings.quality, frameRate: settings.frameRate, format: settings.format }
}
function validateSubtitleWords(value: unknown, duration: number): WordInfo[] | null {
  if (value === null) return null
  requireValue(Array.isArray(value) && value.length <= 100000, 400, 'A clip may contain up to 100,000 subtitle words.')
  return value.map(word => {
    requireValue(word && typeof word.word === 'string' && word.word.length <= 200 && Number.isFinite(word.start) && Number.isFinite(word.end) && word.start >= 0 && word.end >= word.start && word.end <= duration + .05, 400, 'Invalid subtitle word timing.')
    return { word: word.word, start: word.start, end: word.end }
  })
}
