import type { ManualFramingConfig } from './manualFraming'

/** Export-pixel coordinates, shared by browser preview and FFmpeg. */
export function manualSourceRect(config: ManualFramingConfig, width: number, height: number) {
  const [sw, sh] = (config.sourceFrameMode === 'use16x9' ? '16:9' : config.sourceAspectRatio || '16:9').split(':').map(Number)
  const scale = config.sourceTransform?.scale ?? 1
  const w = width * scale, h = w * (sh || 9) / (sw || 16)
  return { x: (width - w) / 2 + (config.sourceTransform?.x || 0) * width, y: (height - h) / 2 + (config.sourceTransform?.y || 0) * height, width: w, height: h }
}
