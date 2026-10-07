import type { Config } from './config'
import { run } from './process'
export async function verifyMediaTools(config: Config) {
  const signal = AbortSignal.timeout(30_000)
  const [filters] = await Promise.all([
    run(config.ffmpeg, ['-hide_banner', '-filters'], signal, 15_000),
    run(config.ffprobe, ['-version'], signal, 15_000),
    run(config.ytdlp, ['--version'], signal, 15_000)
  ])
  if (!/\bass\s+V->V/.test(filters))
    throw new Error(
      'FFmpeg must include the ass filter (libass) for captions. On macOS install ffmpeg-full and set FFMPEG_PATH.'
    )
}
