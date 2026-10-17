import { createCanvas, loadImage } from '@napi-rs/canvas'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { TARGET_DIMENSIONS, type TargetAspectRatio, type LayoutOverlay } from '@clippster/shared-types'
import { requireValue } from './errors'
export async function renderLayoutRaster(overlays: LayoutOverlay[], ratio: TargetAspectRatio, directory: string, work: string) {
  if (!overlays.length) return undefined
  const { width, height } = TARGET_DIMENSIONS[ratio], canvas = createCanvas(width, height), context = canvas.getContext('2d')
  for (const overlay of overlays) {
    const settings = (overlay.perRatioSettings as Record<string, any> | undefined)?.[ratio]
    if (settings === null) continue
    const value = { ...overlay, ...settings }, id = value.imagePath
    requireValue(typeof id === 'string' && /^[\da-f-]{36}$/i.test(id), 400, 'Creator layout image is no longer available.')
    const image = await loadImage(join(directory, 'assets', `${id}.png`))
    const percent = (input: unknown, fallback: number) => typeof input === 'number' && Number.isFinite(input) ? Math.min(100, Math.max(0, input)) / 100 : fallback
    let imageWidth = width * percent(value.scale, 1), imageHeight = imageWidth * image.height / image.width
    let x = width * percent(value.x, .5), y = height * percent(value.y, .5)
    if (value.isFullFrameOverlay) { const scale = Math.min(width / image.width, height / image.height); imageWidth = image.width * scale; imageHeight = image.height * scale; x = width / 2; y = height / 2 }
    context.save(); context.translate(x, y); context.rotate(typeof value.rotation === 'number' ? value.rotation * Math.PI / 180 : 0); context.globalAlpha = percent(value.opacity, 1); context.drawImage(image, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight); context.restore()
  }
  const path = join(work, 'layout.png'); await writeFile(path, canvas.toBuffer('image/png')); return path
}
