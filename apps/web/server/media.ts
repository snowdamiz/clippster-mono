import { join } from 'node:path'
import { readdir, readFile, writeFile, rename, stat } from 'node:fs/promises'
import { buildClipExportPlan } from '@clippster/clip-export'
import {
  createDefaultSubtitleSettings,
  createDefaultManualFramingConfig
} from '@clippster/shared-types'
import type { WebProject, WebClip, WordInfo, ClipSegment } from '@clippster/shared-types'
import type { Config } from './config'
import { run } from './process'
import { downloadProxy } from './network'
import { directoryBytes } from './storage'
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
    throw new Error('Use a video up to 2 hours long and at most 8K resolution.')
  }
  return {
    duration,
    width: Number(video.width),
    height: Number(video.height),
    hasAudio: result.streams.some((stream: { codec_type: string }) => stream.codec_type === 'audio')
  }
}
export async function downloadSource(
  url: string,
  directory: string,
  config: Config,
  signal: AbortSignal,
  progress: (value: number, message: string) => void
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
    `!is_live & duration <= ${config.maxDuration}`,
    '--no-warnings'
  ]
  try {
    const info = JSON.parse(
      await run(
        config.ytdlp,
        [...options, '--dump-single-json', '--skip-download', '--', url],
        combined,
        90_000
      )
    )
    if (
      !info ||
      info.is_live ||
      !Number.isFinite(info.duration) ||
      info.duration > config.maxDuration
    )
      throw new Error('Use a completed video up to 2 hours long.')
    progress(10, 'Downloading source…')
    await run(
      config.ytdlp,
      [
        ...options,
        '--downloader',
        'native',
        '--hls-prefer-native',
        '--ffmpeg-location',
        config.ffmpeg,
        '-f',
        'best[protocol=https][ext=mp4]/bestvideo[protocol=https][height<=1080]+bestaudio[protocol=https]/best[protocol=m3u8_native][height<=1080]',
        '--merge-output-format',
        'mp4',
        '--newline',
        '-o',
        join(directory, 'download.%(ext)s'),
        '--',
        url
      ],
      combined,
      30 * 60_000,
      (output) => {
        const match = output.match(/\[download\]\s+(\d+(?:\.\d+)?)%/)
        if (match) progress(10 + Number(match[1]) * 0.45, 'Downloading source…')
      }
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
  signal: AbortSignal
) {
  const metadata = await probe(input, config, signal)
  const output = join(directory, 'source.mp4')
  await run(
    config.ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      ...LOCAL_INPUT,
      '-i',
      input,
      '-map',
      '0:v:0',
      '-map',
      '0:a:0?',
      '-vf',
      "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,setsar=1",
      '-c:v',
      'libx264',
      '-threads',
      '2',
      '-preset',
      'veryfast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-movflags',
      '+faststart',
      '-fs',
      String(config.maxSourceBytes),
      '-y',
      output
    ],
    signal
  )
  const normalized = await probe(output, config, signal)
  if (normalized.duration < metadata.duration - 1)
    throw new Error('The normalized source exceeds the 2 GB limit. Use a shorter video.')
  return normalized
}
export function clipWords(words: WordInfo[], segments: ClipSegment[]): WordInfo[] {
  const result: WordInfo[] = []
  let offset = 0
  for (const segment of [...segments].sort((a, b) => a.start_time - b.start_time)) {
    for (const word of words)
      if (word.end > segment.start_time && word.start < segment.end_time) {
        result.push({
          ...word,
          start: Math.max(word.start, segment.start_time) - segment.start_time + offset,
          end: Math.min(word.end, segment.end_time) - segment.start_time + offset
        })
      }
    offset += segment.end_time - segment.start_time
  }
  return result
}
export async function renderClip(
  project: WebProject,
  clip: WebClip,
  directory: string,
  work: string,
  config: Config,
  signal: AbortSignal
) {
  const settings = createDefaultSubtitleSettings()
  settings.enabled = clip.captions
  settings.animationStyle = 'none'
  settings.fontFamily = 'DejaVu Sans'
  const plan = buildClipExportPlan({
    videoPath: join(directory, 'source.mp4'),
    outputPath: join(work, 'clip.mp4'),
    segments: clip.segments,
    targetRatio: clip.aspectRatio,
    framingConfig: createDefaultManualFramingConfig(clip.aspectRatio),
    hasAudio: project.hasAudio,
    fit: 'cover',
    subtitleSettings: settings,
    subtitleWords: clipWords(project.words, clip.segments),
    assPath: join(work, 'captions.ass')
  })
  if (plan.assContent) await writeFile(join(work, 'captions.ass'), plan.assContent)
  // Every input is generated locally. Decoder networking and external playlists are disabled.
  const args = plan.ffmpegArgs.flatMap((arg) => (arg === '-i' ? [...LOCAL_INPUT, '-i'] : [arg]))
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
  await rename(join(work, 'clip.mp4'), join(directory, `${clip.id}.mp4`))
}
export async function audioForDetection(
  directory: string,
  work: string,
  config: Config,
  signal: AbortSignal
): Promise<Blob> {
  const path = join(work, 'audio.mp3')
  await run(
    config.ffmpeg,
    [
      '-hide_banner',
      '-loglevel',
      'error',
      ...LOCAL_INPUT,
      '-i',
      join(directory, 'source.mp4'),
      '-vn',
      '-ac',
      '1',
      '-ar',
      '16000',
      '-b:a',
      '24k',
      '-y',
      path
    ],
    signal
  )
  if ((await stat(path)).size > 24 * 1024 ** 2)
    throw new Error('Audio is too large for AI detection. Please use a shorter source.')
  return new Blob([await readFile(path)], { type: 'audio/mpeg' })
}
