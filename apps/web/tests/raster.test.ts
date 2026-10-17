import { expect, it } from 'vitest'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import { computeSubtitleFrames, renderSubtitleFrame } from '../../../packages/clip-export/src/subtitleRaster'
import { createDefaultSubtitleSettings } from '@clippster/shared-types'
import { canvasAdapter } from '../server/rasterOverlays'

it.each(['none', 'karaoke', 'zoom', 'pop', 'glow', 'box-highlight', 'typewriter', 'wave', 'single-word'] as const)('rasterizes desktop subtitle style %s with transparent surroundings', async animationStyle => {
  const settings = { ...createDefaultSubtitleSettings(), animationStyle, backgroundEnabled: true, borderRadius: 20, multiColorEnabled: true }
  const words = [{ word: 'Browser', start: 0, end: 0.5 }, { word: 'captions', start: 0.5, end: 1 }]
  const frames = computeSubtitleFrames(settings, words, [{ start: 0, end: 1, transcript: 'Browser captions' }], 4, 0)
  expect(frames.length).toBeGreaterThan(0)
  const result = await renderSubtitleFrame({ settings, frame: frames[0], canvasWidth: 540, canvasHeight: 960, aspectRatio: '9:16', allWords: words, canvasFactory: () => canvasAdapter(540, 960) })
  expect(result).not.toBeNull()
  const canvas = createCanvas(540, 960), context = canvas.getContext('2d')
  context.drawImage(await loadImage(Buffer.from(await result!.blob.arrayBuffer())), 0, 0)
  const pixels = context.getImageData(0, 0, 540, 960).data
  expect(pixels[3]).toBe(0)
  expect(pixels.some((value, index) => index % 4 === 3 && value > 100)).toBe(true)
})
