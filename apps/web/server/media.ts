import { join } from 'node:path'
import { readdir, writeFile, rename } from 'node:fs/promises'
import { buildClipExportPlan } from '@clippster/clip-export'
import { renderSubtitleRaster, renderTextRaster } from './rasterOverlays'
import {
  createDefaultSubtitleSettings,
  clipWords,
  createDefaultManualFramingConfig
} from '@clippster/shared-types'
import type { WebProject, WebClip, WordInfo, ClipSegment } from '@clippster/shared-types'
import type { Config } from './config'
import { run } from './process'
import { downloadProxy } from './network'
import { directoryBytes } from './storage'
import { kickArchivedSource } from './kickSource'
import { downloadProgress } from './downloadProgress'
import { resolveCaptionSettings } from '../../../client/src/utils/captionPresetSettings'
import { renderLayoutRaster } from './layoutRaster'
const LOCAL_INPUT = [
  '-protocol_whitelist',
  'file,pipe',
  '-format_whitelist',
  'mov,matroska,webm,avi,flv,mpegts'
]
export async function probe(path: string, config: Config, signal: AbortSignal) {
  const result = JSON.parse(
    await run(
      config.ffprobe,
      ['-v', 'error', ...LOCAL_INPUT, '-show_format', '-show_streams', '-of', 'json', path],
      signal,
      30_000
    )
  )
  const video = result.streams?.find(
    (stream: { codec_type: string }) => stream.codec_type === 'video'
  )
  const duration = Number(result.format?.duration)
  if (
    !video ||
    !Number.isFinite(duration) ||
    duration < 0.1 ||
    duration > config.maxDuration ||
    video.width > 7680 ||
    video.height > 4320
  ) {
    throw new Error(`Use a video up to ${Math.floor(config.maxDuration / 3600)} hours long and at most 8K resolution.`)
  }
  return {
    duration,
    width: Number(video.width),
    height: Number(video.height),
    hasAudio: result.streams.some((stream: { codec_type: string }) => stream.codec_type === 'audio'),
    videoCodec: video.codec_name, pixelFormat: video.pix_fmt,
    audioCodec: result.streams.find((stream: { codec_type: string }) => stream.codec_type === 'audio')?.codec_name
  }
}
export async function downloadSource(
  url: string,
  directory: string,
  config: Config,
  signal: AbortSignal,
  progress: (value: number, message: string) => void,
  range?: { startTime: number; endTime: number }
) {
  const proxy = await downloadProxy()
  const limit = new AbortController()
  const combined = AbortSignal.any([signal, limit.signal])
  const monitor = setInterval(() => {
    void directoryBytes(directory)
      .then((bytes) => {
        if (bytes > config.maxSourceBytes) limit.abort()
      })
      .catch(() => limit.abort())
  }, 1000)
  const options = [
    '--ignore-config',
    '--no-plugin-dirs',
    '--no-remote-components',
    '--js-runtimes',
    'node',
    '--no-playlist',
    '--no-cache-dir',
    '--proxy',
    proxy.url,
    '--socket-timeout',
    '30',
    '--retries',
    '2',
    '--fragment-retries',
    '2',
    '--max-filesize',
    String(config.maxSourceBytes),
    '--match-filter',
    range ? '!is_live' : `!is_live & duration <= ${config.maxDuration}`,
    '--no-warnings'
  ]
  if (new URL(url).hostname.endsWith('kick.com')) options.push('--impersonate', 'chrome')
  try {
    let downloadUrl = url
    let info
    try { info = JSON.parse(
      await run(
        config.ytdlp,
        [...options, '--dump-single-json', '--skip-download', '--', url],
        combined,
        90_000
      )
    ) } catch (error) {
      if (!['kick.com', 'www.kick.com'].includes(new URL(url).hostname)) throw error
      info = await kickArchivedSource(url, proxy.url, config, combined)
      downloadUrl = info.source
      const filter = options.indexOf('--match-filter')
      if (filter >= 0) options.splice(filter, 2)
    }
    if (
      !info ||
      info.is_live ||
      !Number.isFinite(info.duration) ||
      (range ? range.endTime > info.duration || range.endTime - range.startTime > config.maxDuration : info.duration > config.maxDuration)
    )
      throw new Error(`Use a completed video or selection up to ${Math.floor(config.maxDuration / 3600)} hours long.`)
    progress(10, 'Downloading source…')
    await run(
      config.ytdlp,
      [
        ...options,
        ...(range ? ['--download-sections', `*${range.startTime}-${range.endTime}`,
          ...(range.startTime > 0 ? ['--force-keyframes-at-cuts', '--downloader-args', 'ffmpeg_o:-c:v libx264 -preset ultrafast -c:a aac -b:a 128k -avoid_negative_ts make_zero -progress pipe:2 -nostats'] : ['--downloader-args', 'ffmpeg_o:-progress pipe:2 -nostats'])] : []),
        '--downloader',
        'native',
        '--hls-prefer-native',
        ...(/[\\/]/.test(config.ffmpeg) ? ['--ffmpeg-location', config.ffmpeg] : []),
        '-f',
        'best[protocol=https][ext=mp4]/bestvideo[protocol=https][height<=1080]+bestaudio[protocol=https]/best[protocol=m3u8_native][height<=1080]',
        '--merge-output-format',
        'mp4',
        '--newline',
        '-o',
        join(directory, 'download.%(ext)s'),
        '--',
        downloadUrl
      ],
      combined,
      30 * 60_000,
      downloadProgress(range ? range.endTime - range.startTime : info.duration, progress)
    )
    const files = (await readdir(directory)).filter((name) =>
      /^download\.(mp4|mkv|webm)$/.test(name)
    )
    if (files.length !== 1)
      throw new Error('The source did not produce a supported video. Try uploading the file.')
    return join(directory, files[0])
  } finally {
    clearInterval(monitor)
    proxy.close()
  }
}
export async function normalizeSource(
  input: string,
  directory: string,
  config: Config,
  signal: AbortSignal,
  progress?: (value: number, message: string) => void
) {
  const metadata = await probe(input, config, signal)
  const output = join(directory, 'source.mp4')
  await run(
    config.ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      '-progress',
      'pipe:1',
      '-nostats',
      ...LOCAL_INPUT,
      '-i',
      input,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      ...(metadata.videoCodec === 'h264' && ['yuv420p', 'yuvj420p'].includes(metadata.pixelFormat) && metadata.width <= 1920 && metadata.height <= 1080
        ? ['-c:v', 'copy']
        : ['-vf', "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1", '-c:v', 'libx264', '-threads', '2', '-preset', 'veryfast', '-crf', '23', '-pix_fmt', 'yuv420p']),
      ...(metadata.audioCodec === 'aac' ? ['-c:a', 'copy'] : ['-c:a', 'aac', '-b:a', '128k']),
      '-movflags',
      '+faststart',
      '-fs',
      String(config.maxSourceBytes),
      '-y',
      output
    ],
    signal,
    30 * 60_000,
    progress ? downloadProgress(metadata.duration, value => progress(60 + (value - 10) / 45 * 35, 'Preparing browser playback…')) : undefined
  )
  const normalized = await probe(output, config, signal)
  if (normalized.duration < metadata.duration - 1)
    throw new Error(`This video exceeds the ${Math.round(config.maxSourceBytes / 1024 ** 3)} GB source limit. Choose a shorter selection.`)
  return normalized
}
export async function renderClip(
  project: WebProject,
  clip: WebClip,
  directory: string,
  work: string,
  config: Config,
  signal: AbortSignal,
  publishOutput = true,
  mediaAssets: Array<{ id: string; type: 'image' | 'video'; path: string }> = []
) {
  const settings = resolveCaptionSettings(clip.subtitleSettings, clip.aspectRatio, clip.captions)
  const words = clipWords(clip.subtitleWords || project.words, clip.segments)
  const duration = clip.segments.reduce((sum, segment) => sum + segment.end_time - segment.start_time, 0)
  const subtitleRasterPath = settings.enabled && words.length ? await renderSubtitleRaster(settings, words, duration, clip.aspectRatio, work, config, signal) : undefined
  const textRasterPath = clip.textBox?.enabled && clip.textBox.text ? await renderTextRaster(clip.textBox, clip.aspectRatio, work) : undefined
  const layoutRasterPath = await renderLayoutRaster(project.vodPresetConfig?.layoutOverlays || [], clip.aspectRatio, directory, work)
  const plan = buildClipExportPlan({
    videoPath: join(directory, 'source.mp4'),
    outputPath: join(work, 'clip.mp4'),
    segments: clip.segments,
    targetRatio: clip.aspectRatio,
    framingConfig: clip.framingConfig || null,
    hasAudio: project.hasAudio,
    fit: 'cover',
    subtitleSettings: settings,
    textBox: clip.textBox,
    textRasterPath,
    subtitleWords: words,
    subtitleRasterPath,
    layoutRasterPath,
    assPath: join(work, 'captions.ass'),
    mediaAssets,
    quality: clip.exportSettings?.quality, frameRate: clip.exportSettings?.frameRate
  })
  if (plan.assContent) await writeFile(join(work, 'captions.ass'), plan.assContent)
  // Every input is generated locally. Decoder networking and external playlists are disabled.
  const args = plan.ffmpegArgs.flatMap((arg, index, all) => arg === '-i' ? [...(all[index + 1].endsWith('.png') ? ['-protocol_whitelist', 'file,pipe', '-format_whitelist', 'png_pipe'] : LOCAL_INPUT), '-i'] : [arg])
  args.splice(
    args.length - 2,
    0,
    '-threads',
    '2',
    '-pix_fmt',
    'yuv420p',
    '-fs',
    String(config.maxSourceBytes)
  )
  await run(config.ffmpeg, ['-hide_banner', '-loglevel', 'error', ...args], signal)
  const output = await probe(join(work, 'clip.mp4'), config, signal)
  if (Math.abs(output.duration - plan.totalDuration) > 0.5)
    throw new Error('Rendered duration did not match the clip. Please retry with a shorter clip.')
  if (publishOutput) await rename(join(work, 'clip.mp4'), join(directory, `${clip.id}.mp4`))
}
