import type { Config } from './config'
import { run } from './process'

type Frame = { time: number; luma: number }

/** Find short, bright pulses in an export. The result is a review aid, not a seizure-safety certification. */
export function detectCreatorSkillFlashes(frames: Frame[]): number[] {
  const flashes: number[] = []
  for (let start = 1; start < frames.length - 1; start++) {
    if (frames[start].luma - frames[start - 1].luma < 45) continue
    const endLimit = Math.min(frames.length - 1, start + 6)
    for (let end = start; end < endLimit; end++) {
      if (frames[end].luma - frames[end + 1].luma >= 35) {
        flashes.push(frames[start].time)
        start = end + 1
        break
      }
    }
  }
  return flashes
}

export async function scanCreatorSkillFlashes(path: string, config: Config, signal: AbortSignal): Promise<number[]> {
  const output = await run(config.ffmpeg, [
    '-nostdin', '-v', 'error', '-i', path, '-an', '-sn', '-dn',
    '-vf', 'scale=160:-2,signalstats,metadata=mode=print:key=lavfi.signalstats.YAVG:file=-',
    '-f', 'null', '-',
  ], signal, 10 * 60_000)
  const frames: Frame[] = []
  let time: number | undefined
  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('frame:')) {
      const value = Number(line.match(/pts_time:([\d.]+)/)?.[1])
      time = Number.isFinite(value) ? value : undefined
    } else if (time !== undefined && line.startsWith('lavfi.signalstats.YAVG=')) {
      const luma = Number(line.slice('lavfi.signalstats.YAVG='.length))
      if (Number.isFinite(luma)) frames.push({ time, luma })
      time = undefined
    }
  }
  if (!frames.length) throw new Error('FFmpeg returned no frame brightness measurements.')
  return detectCreatorSkillFlashes(frames)
}
