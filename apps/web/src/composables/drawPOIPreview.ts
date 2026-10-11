import { manualSourceRect, TARGET_DIMENSIONS, type ManualFramingConfig, type ManualRegion, type TargetAspectRatio } from '@clippster/shared-types'

export function drawPOIPreview(context: CanvasRenderingContext2D, source: HTMLVideoElement, config: ManualFramingConfig, regions: ManualRegion[], media: Map<string, HTMLImageElement | HTMLVideoElement>, time: number) {
  const w = context.canvas.width, h = context.canvas.height
  context.filter = 'none'; context.fillStyle = '#000'; context.fillRect(0, 0, w, h)
  const blur = config.blurEnabled ? (config.blurAmount ?? 12) * h / 1080 : 0
  if (config.sourceFrameMode === 'use16x9') {
    const scale = Math.max(w / source.videoWidth, h / source.videoHeight)
    context.filter = `blur(${blur}px)`
    context.drawImage(source, (w - source.videoWidth * scale) / 2, (h - source.videoHeight * scale) / 2, source.videoWidth * scale, source.videoHeight * scale)
  }
  if (config.sourceFrameMode && config.sourceFrameMode !== 'none') {
    const dims = TARGET_DIMENSIONS[config.targetAspectRatio as TargetAspectRatio]
    const rect = manualSourceRect(config, dims.width, dims.height)
    context.filter = `blur(${config.sourceFrameMode === 'scale' ? blur : 0}px)`
    context.drawImage(source, rect.x * w / dims.width, rect.y * h / dims.height, rect.width * w / dims.width, rect.height * h / dims.height)
  }
  context.filter = 'none'
  const broll = config.brollConfigs?.filter(part => time >= part.startTime && time < part.endTime) || []
  for (const region of [...regions, ...broll.map(part => part.region)]) {
    const element = region.mediaAssetId ? media.get(region.mediaAssetId) : source
    if (!element) continue
    if (element instanceof HTMLVideoElement) {
      if (element.readyState < 2) continue
      if (element !== source && Number.isFinite(element.duration) && element.duration > 0) {
        const start = broll.find(part => part.region.id === region.id)?.startTime || 0
        const desired = (time - start + (region.mediaSourceOffset || 0)) % element.duration
        if (Math.abs(element.currentTime - desired) > 0.15 && !element.seeking) element.currentTime = desired
      }
    } else if (!element.complete || !element.naturalWidth) continue
    const sw = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth
    const sh = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight
    const s = region.source, o = region.output
    context.save(); context.beginPath()
    const radius = region.cornerRadiusEnabled ? (region.cornerRadiusPx ?? 0) * o.width * w / 1080 : 0
    context.roundRect(o.x * w, o.y * h, o.width * w, o.height * h, Math.min(radius, o.width * w / 2, o.height * h / 2)); context.clip()
    if (region.mediaAssetId) {
      const scale = Math.max(o.width * w / (s.width * sw), o.height * h / (s.height * sh))
      const cw = o.width * w / scale, ch = o.height * h / scale
      context.drawImage(element, s.x * sw + (s.width * sw - cw) / 2, s.y * sh + (s.height * sh - ch) / 2, cw, ch, o.x * w, o.y * h, o.width * w, o.height * h)
    } else context.drawImage(element, s.x * sw, s.y * sh, s.width * sw, s.height * sh, o.x * w, o.y * h, o.width * w, o.height * h)
    context.restore()
  }
}
