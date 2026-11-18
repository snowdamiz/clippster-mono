import { stat, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import type { Config } from './config'
import { run } from './process'
import { creatorSkillPreviewLimitMb } from '../../../client/src/services/creatorSkillPreviewLimit'

/** Leave headroom for AAC, container overhead, and the two-pass encoder's rate control. */
export function creatorSkillPreviewVideoKbps(duration: number, maxMb = 30): number {
  if (!Number.isFinite(duration) || duration <= 0) throw new Error('A valid clip duration is required for a phone preview.')
  const budgetMb = creatorSkillPreviewLimitMb(maxMb)
  const videoBudgetMb = budgetMb - Math.min(2, budgetMb * 0.1)
  return Math.max(200, Math.min(7_000, Math.floor((videoBudgetMb * 8 * 1024) / duration - 140)))
}

export async function createCreatorSkillPhonePreview(source: string, work: string, duration: number, config: Config, signal: AbortSignal, maxMb = 30, format: '9:16' | '16:9' = '9:16'): Promise<boolean> {
  const limitMb = creatorSkillPreviewLimitMb(maxMb)
  const bitrate = `${creatorSkillPreviewVideoKbps(duration, limitMb)}k`
  const passlog = join(work, 'phone-preview-pass')
  const output = join(work, 'phone-preview.mp4')
  const common = ['-nostdin', '-v', 'error', '-i', source, '-vf', format === '16:9' ? 'scale=1280:720' : 'scale=720:1280', '-c:v', 'libx264', '-preset', 'medium', '-pix_fmt', 'yuv420p', '-b:v', bitrate, '-passlogfile', passlog, '-threads', '2']
  try {
    await run(config.ffmpeg, [...common, '-pass', '1', '-an', '-f', 'null', '-'], signal, 10 * 60_000)
    await run(config.ffmpeg, [...common, '-pass', '2', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', '-y', output], signal, 10 * 60_000)
    const ready = (await stat(output)).size < limitMb * 1024 * 1024
    if (!ready) await unlink(output).catch(() => {})
    return ready
  } catch (error) {
    await unlink(output).catch(() => {})
    throw error
  } finally {
    await Promise.all(['-0.log', '-0.log.mbtree'].map(suffix => unlink(`${passlog}${suffix}`).catch(() => {})))
  }
}
