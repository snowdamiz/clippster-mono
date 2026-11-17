import { join } from 'node:path'
import { rm } from 'node:fs/promises'
import type { Config } from './config'
import { run } from './process'

export interface CreatorSkillAudioMeasure { lufs: number | null; truePeak: number | null }

export function parseCreatorSkillAudioMeasure(log: string): CreatorSkillAudioMeasure {
  const summary = log.split('Summary:').at(-1) ?? ''
  const lufs = summary.match(/Integrated loudness:[\s\S]*?\bI:\s*(-?\d+(?:\.\d+)?)\s*LUFS/)
  const peak = summary.match(/True peak:[\s\S]*?\bPeak:\s*(-?\d+(?:\.\d+)?)\s*dBFS/)
  return { lufs: lufs ? Number(lufs[1]) : null, truePeak: peak ? Number(peak[1]) : null }
}

export async function measureCreatorSkillAudio(path: string, config: Config, signal: AbortSignal): Promise<CreatorSkillAudioMeasure> {
  let log = ''
  await run(config.ffmpeg, ['-nostdin', '-hide_banner', '-i', path, '-map', '0:a:0', '-af', 'ebur128=peak=true', '-f', 'null', '-'], signal, 10 * 60_000, text => { log = (log + text).slice(-100_000) }, false)
  return parseCreatorSkillAudioMeasure(log)
}

/** Static gain and a safety limiter; never apply a speech-rewriting enhancer. */
export async function normalizeCreatorSkillAudio(path: string, targetDir: string, config: Config, signal: AbortSignal): Promise<{ path: string; measure: CreatorSkillAudioMeasure; issue?: string }> {
  const before = await measureCreatorSkillAudio(path, config, signal).catch(error => {
    if (signal.aborted) throw error
    return null
  })
  if (!before) return { path, measure: { lufs: null, truePeak: null }, issue: 'Could not measure initial audio; using the original master for review.' }
  if (before.lufs === null || before.truePeak === null) return { path, measure: before, issue: 'Could not measure initial audio loudness and true peak; check the master manually.' }
  const gain = Math.max(-12, Math.min(12, -14 - before.lufs))
  if (Math.abs(gain) <= 0.5 && before.truePeak <= -1.0) return { path, measure: before }
  const normalizedPath = join(targetDir, 'normalized-master.mp4')
  try {
    await run(config.ffmpeg, ['-nostdin', '-v', 'error', '-i', path, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=0.841395:level=false`, '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-y', normalizedPath], signal, 10 * 60_000)
    const after = await measureCreatorSkillAudio(normalizedPath, config, signal)
    if (after.lufs === null || after.truePeak === null) {
      await rm(normalizedPath, { force: true }).catch(() => undefined)
      return { path, measure: before, issue: 'Could not verify the normalized audio; using the original master.' }
    }
    if (after.truePeak > -1.0) {
      await rm(normalizedPath, { force: true }).catch(() => undefined)
      return { path, measure: before, issue: `Normalized audio exceeded the -1 dBTP ceiling (${after.truePeak} dBTP); using the original master.` }
    }
    return { path: normalizedPath, measure: after, ...(Math.abs(after.lufs + 14) > 2 ? { issue: `Audio remains ${after.lufs} LUFS after static gain and limiting; review against the -14 LUFS target.` } : {}) }
  } catch (error) {
    if (signal.aborted) throw error
    await rm(normalizedPath, { force: true }).catch(() => undefined)
    return { path, measure: before, issue: `Could not normalize audio; using the original master. ${error instanceof Error ? error.message : String(error)}` }
  }
}
