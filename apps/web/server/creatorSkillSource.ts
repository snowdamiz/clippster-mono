import { join } from 'node:path'
import type { WebClip } from '@clippster/shared-types'
import type { Config } from './config'
import { run } from './process'
import { probe } from './media'

/** Extract the detected VOD ranges in order for the AI editor; the project's source.mp4 is untouched. */
export async function extractCreatorSkillSource(
  clip: Pick<WebClip, 'segments' | 'id'>,
  directory: string,
  work: string,
  config: Config,
  signal: AbortSignal,
): Promise<{ path: string; duration: number; width: number; height: number; hasAudio: boolean }> {
  const segments = clip.segments
  if (!segments.length || segments.some(part => !Number.isFinite(part.start_time) || !Number.isFinite(part.end_time) || part.start_time < 0 || part.end_time <= part.start_time)) {
    throw new Error('The detected clip has no valid source ranges.')
  }
  const output = join(work, `creator-skill-${clip.id}.mp4`)
  const filters = segments.flatMap((part, index) => [
    `[0:v]trim=start=${part.start_time}:end=${part.end_time},setpts=PTS-STARTPTS[v${index}]`,
    `[0:a]atrim=start=${part.start_time}:end=${part.end_time},asetpts=PTS-STARTPTS[a${index}]`,
  ])
  filters.push(`${segments.map((_, index) => `[v${index}][a${index}]`).join('')}concat=n=${segments.length}:v=1:a=1[v][a]`)
  await run(config.ffmpeg, [
    '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', join(directory, 'source.mp4'),
    '-filter_complex', filters.join(';'), '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-threads', '2', '-y', output,
  ], signal)
  const info = await probe(output, config, signal)
  const expected = segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0)
  if (!info.hasAudio || Math.abs(info.duration - expected) > Math.max(0.5, expected * 0.02)) {
    throw new Error('The extracted clip did not preserve its expected duration and audio.')
  }
  return { path: output, duration: info.duration, width: info.width, height: info.height, hasAudio: info.hasAudio }
}
