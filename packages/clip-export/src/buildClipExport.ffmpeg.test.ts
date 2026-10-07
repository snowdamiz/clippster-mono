import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, expect, it } from 'vitest'
import {
  createDefaultManualFramingConfig,
  createDefaultManualRegion
} from '@clippster/shared-types'
import { buildClipExportPlan } from './buildClipExport'

const ffmpeg = process.env.FFMPEG_PATH || 'ffmpeg'
const ffprobe = process.env.FFPROBE_PATH || 'ffprobe'
const directory = mkdtempSync(join(tmpdir(), 'clip-export-regression-'))
const source = join(directory, 'source.mp4')
function run(args: string[]) {
  return execFileSync(ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], {
    timeout: 60_000,
    maxBuffer: 1024 * 1024
  })
}
beforeAll(() => {
  run([
    '-f',
    'lavfi',
    '-i',
    'color=c=red:s=320x180:r=24:d=2',
    '-f',
    'lavfi',
    '-i',
    'color=c=blue:s=320x180:r=24:d=2',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=4',
    '-filter_complex',
    '[0:v][1:v]concat=n=2:v=1:a=0[v]',
    '-map',
    '[v]',
    '-map',
    '2:a',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-y',
    source
  ])
}, 60_000)
afterAll(() => rmSync(directory, { recursive: true, force: true }))

it.each([false, true])(
  'preserves both segments and full video duration with manual framing=%s',
  (manual) => {
    const outputPath = join(directory, `${manual}.mp4`)
    const framing = createDefaultManualFramingConfig('16:9')
    if (manual)
      framing.regions = [0, 1].map((index) => ({
        ...createDefaultManualRegion(index),
        source: { x: 0, y: 0, width: 1, height: 1 },
        output: { x: index * 0.5, y: 0, width: 0.5, height: 1 }
      }))
    const plan = buildClipExportPlan({
      videoPath: source,
      outputPath,
      targetRatio: '16:9',
      framingConfig: framing,
      segments: [
        { start_time: 0.25, end_time: 1.5, duration: 1.25, transcript: null },
        { start_time: 2.25, end_time: 3.5, duration: 1.25, transcript: null }
      ]
    })
    run(plan.ffmpegArgs)
    const metadata = JSON.parse(
      execFileSync(ffprobe, ['-v', 'error', '-show_streams', '-of', 'json', outputPath], {
        encoding: 'utf8'
      })
    )
    const video = metadata.streams.find(
      (stream: { codec_type: string }) => stream.codec_type === 'video'
    )
    expect(Number(video.duration)).toBeCloseTo(2.5, 1)
    expect(
      metadata.streams.some((stream: { codec_type: string }) => stream.codec_type === 'audio')
    ).toBe(true)
    for (const [time, channel] of [
      [0.5, 0],
      [2, 2]
    ]) {
      const pixel = run([
        '-ss',
        String(time),
        '-i',
        outputPath,
        '-vf',
        'scale=1:1',
        '-frames:v',
        '1',
        '-f',
        'rawvideo',
        '-pix_fmt',
        'rgb24',
        'pipe:1'
      ])
      expect(pixel[channel]).toBeGreaterThan(200)
      expect(pixel[channel === 0 ? 2 : 0]).toBeLessThan(30)
    }
  },
  90_000
)
