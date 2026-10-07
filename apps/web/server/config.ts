import { resolve } from 'node:path'
export interface Config {
  port: number
  host: string
  origin: string
  apiUrl: string
  dataDir: string
  sessionSecret: string
  secureCookies: boolean
  ffmpeg: string
  ffprobe: string
  ytdlp: string
  maxSourceBytes: number
  maxDuration: number
  maxProjects: number
  userStorageBytes: number
}
export function readConfig(env = process.env): Config {
  const production = env.NODE_ENV === 'production'
  if (production && (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32)) {
    throw new Error('Set SESSION_SECRET to at least 32 random characters in production.')
  }
  const origin = env.WEB_ORIGIN || 'http://localhost:5175'
  if (production && !origin.startsWith('https://'))
    throw new Error('WEB_ORIGIN must use HTTPS in production.')
  return {
    port: Number(env.PORT || 8090),
    host: env.HOST || (production ? '0.0.0.0' : '127.0.0.1'),
    origin,
    apiUrl: (env.CLIPPSTER_API_URL || 'http://127.0.0.1:4000/api').replace(/\/$/, ''),
    dataDir: resolve(env.WEB_DATA_DIR || 'data'),
    sessionSecret: env.SESSION_SECRET || 'local-development-only-clippster-web-secret',
    secureCookies: production,
    ffmpeg: env.FFMPEG_PATH || 'ffmpeg',
    ffprobe: env.FFPROBE_PATH || 'ffprobe',
    ytdlp: env.YTDLP_PATH || 'yt-dlp',
    maxSourceBytes: 2 * 1024 ** 3,
    maxDuration: 2 * 3600,
    maxProjects: 20,
    userStorageBytes: 10 * 1024 ** 3
  }
}
