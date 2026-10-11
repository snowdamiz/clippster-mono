import type { ManualFramingConfig } from '@clippster/shared-types'
import { buildFramingFilterGraph } from '@clippster/clip-export'
import * as FileSystem from 'expo-file-system/legacy'
import { runFfmpeg } from '@/services/ffmpeg'
import type { MobileEditProjectV3 } from '../model/schema'
import { ticksToSeconds } from '../model/schema'
import { getVideoTrack } from '../model/timeline'
import type { NativeMobileEditorEngine } from '../engine/NativeMobileEditorEngine'
import { framedExportDocument } from './framedExportDocument'

export function needsManualFraming(
  config: ManualFramingConfig | null | undefined
): config is ManualFramingConfig {
  return Boolean(
    config &&
    (config.regions.length ||
      config.segmentConfigs?.length ||
      config.brollConfigs?.length ||
      config.sourceFrameMode === 'scale')
  )
}

/** Frame only the video source, then let the native editor compose text/audio above it. */
export async function prepareManualFraming(
  engine: NativeMobileEditorEngine,
  document: MobileEditProjectV3,
  framing: ManualFramingConfig,
  directory: string
): Promise<{ document: MobileEditProjectV3; cleanup: () => Promise<void> }> {
  const temporaryDirectory = directory + 'framing-' + Date.now() + '/'
  await FileSystem.makeDirectoryAsync(temporaryDirectory, { intermediates: true })
  const cleanup = () => FileSystem.deleteAsync(temporaryDirectory, { idempotent: true })
  try {
    const videoTrack = getVideoTrack(document)
    const duration = Math.max(0, ...videoTrack.items.map((item) => item.timelineEnd))
    if (!duration) throw new Error('Add a video before applying framing.')
    await engine.load({
      ...document,
      id: document.id + '__framing_source',
      canvas: { ...document.canvas, activeRatio: '16:9' },
      tracks: [videoTrack],
      captionDocument: undefined,
      branding: undefined
    })
    const base = await engine.export({ ratios: ['16:9'], outputDirectory: temporaryDirectory })
    const source = base.outputPaths[0]
    if (!source) throw new Error('The framing source could not be rendered.')
    const regions = [
      ...framing.regions,
      ...(framing.segmentConfigs ?? []).flatMap((segment) => segment.regions),
      ...(framing.brollConfigs ?? []).map((part) => part.region)
    ]
    const media = [
      ...new Map(
        regions.flatMap((region) =>
          region.mediaAssetId ? [[region.mediaAssetId, region.mediaType] as const] : []
        )
      ).entries()
    ]
    for (const [uri] of media) {
      if (!uri.startsWith('file://') || !(await FileSystem.getInfoAsync(uri)).exists)
        throw new Error('A framing media asset is unavailable. Replace it before exporting.')
    }
    const graph = buildFramingFilterGraph({
      framingConfig: framing,
      targetRatio: '9:16',
      sourceWidth: 1920,
      sourceHeight: 1080,
      mediaSources: Object.fromEntries(media.map(([uri], index) => [uri, index + 1]))
    })
    if (!graph) throw new Error('The framing layout could not be rendered.')
    const output = temporaryDirectory + 'framed.mp4'
    const path = (uri: string) => decodeURI(uri.replace(/^file:\/\//, ''))
    await runFfmpeg([
      '-y',
      '-i',
      path(source),
      ...media.flatMap(([uri, type]) =>
        type === 'image' ? ['-loop', '1', '-i', path(uri)] : ['-stream_loop', '-1', '-i', path(uri)]
      ),
      '-filter_complex',
      graph.filterComplex,
      '-map',
      '[' + graph.outputLabel + ']',
      '-map',
      '0:a?',
      '-t',
      String(ticksToSeconds(duration)),
      '-c:v',
      'libx264',
      '-preset',
      'veryfast',
      '-crf',
      '20',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-movflags',
      '+faststart',
      path(output)
    ])
    return { document: framedExportDocument(document, output, duration), cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}
