import { createCanvas, GlobalFonts } from '@napi-rs/canvas'
import { existsSync } from 'node:fs'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { computeSubtitleFrames, renderSubtitleFrame } from '../../../packages/clip-export/src/subtitleRaster'
import type { SubtitleSettings, WordInfo, TargetAspectRatio } from '@clippster/shared-types'
import { TARGET_DIMENSIONS } from '@clippster/shared-types'
import type { Config } from './config'
import { run } from './process'
import { drawClipText } from '../../../packages/clip-export/src/textRaster'
import type { ClipTextBoxState } from '@clippster/shared-types'
import { maxWordsChunkForAspectRatioString } from '../../../client/src/utils/subtitleVisibleWords'

for (const path of [resolve('dist/public/fonts'), resolve('../../client/public/fonts'), '/usr/local/share/fonts/clippster']) if (existsSync(path)) GlobalFonts.loadFontsFromDir(path)

export function canvasAdapter(width: number, height: number) {
  const canvas = createCanvas(width, height)
  return Object.assign(canvas, { toBlob(callback: (blob: Blob | null) => void) { canvas.encode('png').then(buffer => callback(new Blob([new Uint8Array(buffer)], { type: 'image/png' }))).catch(() => callback(null)) } }) as unknown as HTMLCanvasElement
}

export async function renderTextRaster(box: ClipTextBoxState, ratio: TargetAspectRatio, work: string) {
  const { width, height } = TARGET_DIMENSIONS[ratio], canvas = createCanvas(width, height)
  drawClipText(canvas.getContext('2d') as unknown as CanvasRenderingContext2D, box, width, height)
  const path = join(work, 'text.png'); await writeFile(path, canvas.toBuffer('image/png')); return path
}

/** Uses the desktop rasterizer, including its word grouping, backgrounds and animation states. */
export async function renderSubtitleRaster(settings: SubtitleSettings, words: WordInfo[], duration: number, ratio: TargetAspectRatio, work: string, config: Config, signal: AbortSignal) {
  const { width, height } = TARGET_DIMENSIONS[ratio], directory = join(work, 'subtitle-frames')
  await mkdir(directory, { recursive: true })
  const blank = join(directory, 'blank.png')
  await writeFile(blank, createCanvas(width, height).toBuffer('image/png'))
  const entries: string[] = ['ffconcat version 1.0'], frames = computeSubtitleFrames(settings, words, [{ start: 0, end: duration, transcript: words.map(word => word.word).join(' ') }], maxWordsChunkForAspectRatioString(ratio, settings.animationStyle), 0)
  let cursor = 0, index = 0
  const append = (file: string, length: number) => { if (length > 0.001) entries.push(`file '${file.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`, `duration ${length.toFixed(6)}`) }
  for (const frame of frames) {
    signal.throwIfAborted()
    const start = Math.max(cursor, frame.startTime), end = Math.min(duration, frame.endTime)
    if (end <= start) continue
    append(blank, start - cursor)
    const result = await renderSubtitleFrame({ settings, frame, canvasWidth: width, canvasHeight: height, aspectRatio: ratio, allWords: words, canvasFactory: () => canvasAdapter(width, height) })
    if (!result) throw new Error('Subtitle rendering failed')
    const file = join(directory, `${index++}.png`)
    await writeFile(file, new Uint8Array(await result.blob.arrayBuffer())); append(file, end - start); cursor = end
  }
  append(blank, duration - cursor); entries.push(`file '${blank.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`)
  const list = join(directory, 'frames.ffconcat'), output = join(work, 'subtitles.mkv')
  await writeFile(list, entries.join('\n'))
  await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'concat,png_pipe', '-f', 'concat', '-safe', '0', '-i', list, '-vf', 'fps=30', '-t', String(duration), '-c:v', 'ffv1', '-pix_fmt', 'bgra', '-threads', '2', '-y', output], signal)
  await rm(directory, { recursive: true, force: true })
  return output
}
