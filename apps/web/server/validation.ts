import type { WebClipInput, ClipSegment, TargetAspectRatio } from '@clippster/shared-types'
import { HttpError, requireValue } from './errors'
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
  requireValue(['16:9', '9:16'].includes(String(input.aspectRatio)), 400, 'Invalid aspect ratio.')
  requireValue(typeof input.captions === 'boolean', 400, 'Invalid captions setting.')
  requireValue(
    Array.isArray(input.segments) && input.segments.length > 0 && input.segments.length <= 20,
    400,
    'A clip needs 1–20 segments.'
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
    .sort((a, b) => a.start_time - b.start_time)
  requireValue(
    segments.every(
      (segment, index) => index === 0 || segment.start_time >= segments[index - 1].end_time
    ),
    400,
    'Clip segments must not overlap.'
  )
  requireValue(
    segments.reduce((sum, segment) => sum + segment.duration, 0) <= 600,
    400,
    'Clips may be up to 10 minutes long.'
  )
  return {
    name,
    segments,
    aspectRatio: input.aspectRatio as TargetAspectRatio,
    captions: input.captions
  }
}
