import { Router, type Request } from 'express'
import { createWriteStream, openAsBlob } from 'node:fs'
import { mkdtemp, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import type { Auth } from './auth'
import type { Config } from './config'
import { requireValue, HttpError } from './errors'
import { isFreePlan } from '@clippster/shared-types'
import { downloadAsset, downloadProxy } from './network'
import { run } from './process'
import { probe } from './media'

const limit = 128 * 1024 ** 2
async function receive(req: Request, path: string) {
  requireValue(req.is('application/octet-stream'), 415, 'Upload the original file.')
  let bytes = 0
  await pipeline(req, new Transform({ transform(chunk, _encoding, callback) {
    bytes += chunk.length
    callback(bytes > limit ? new HttpError(413, 'Branding assets must be under 128 MB.') : null, chunk)
  } }), createWriteStream(path, { flags: 'wx', mode: 0o600 }))
  requireValue(bytes > 0, 400, 'The file was empty.')
}
export function creatorMediaRoutes(auth: Auth, config: Config) {
  const router = Router()
  const active = new Set<string>()
  router.post(['/user/assets', '/organizations/:organizationId/assets'], async (req, res) => {
    const owner = res.locals.session.owner
    requireValue(!active.has(owner) && active.size < 4, 409, 'Wait for the current branding upload.')
    requireValue(req.params.organizationId || !isFreePlan(res.locals.user), 403, 'Upgrade your plan to upload branding.')
    const type = String(req.query.asset_type || '')
    const filename = String(req.query.filename || 'asset').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200)
    const name = String(req.query.name || filename).slice(0, 255)
    requireValue(['intro', 'outro', 'watermark', 'image', 'overlay'].includes(type), 400, 'Unsupported branding asset type.')
    const mime = String(req.query.mime || '')
    requireValue(/^(image\/(png|jpeg|webp|gif|svg\+xml)|video\/(mp4|webm|quicktime|x-matroska|x-msvideo|x-flv|x-ms-wmv|x-m4v))$/.test(mime), 415, 'Choose a supported image or video.')
    requireValue(!['watermark', 'image'].includes(type) || mime.startsWith('image/'), 415, 'Choose an image.')
    requireValue(!['intro', 'outro'].includes(type) || mime.startsWith('video/'), 415, 'Choose a video.')
    const upstream = auth.upstream(auth.token(res.locals.session), 5 * 60_000)
    const permissions = await upstream.get<{ success: boolean; restricted?: boolean }>('/user/restrictions')
    requireValue(permissions.success && (req.params.organizationId || !permissions.restricted), 403, 'Your organization restricts personal branding.')
    active.add(owner)
    let directory: string | undefined
    try {
      directory = await mkdtemp(join(tmpdir(), 'clippster-branding-'))
      const path = join(directory, 'source')
      await receive(req, path)
      const form = new FormData()
      form.append('file', await openAsBlob(path, { type: mime }), filename)
      form.append('asset_type', type); form.append('name', name)
      if (mime.startsWith('video/')) {
        const info = await probe(path, config, AbortSignal.timeout(30_000))
        for (const key of ['width', 'height', 'duration'] as const) form.append(key, String(info[key]))
      } else {
        for (const key of ['width', 'height']) { const value = Number(req.query[key]); if (Number.isFinite(value) && value > 0 && value <= 32768) form.append(key, String(value)) }
      }
      const target = req.params.organizationId ? '/organizations/' + req.params.organizationId + '/assets' : '/user/assets'
      const result = await upstream.requestWithStatus(target, { method: 'POST', body: form })
      res.status(result.status).json(result.data)
    } finally { active.delete(owner); if (directory) await rm(directory, { recursive: true, force: true }) }
  })
  router.get(['/user/assets/:id/content', '/organizations/:organizationId/assets/:id/content'], async (req, res) => {
    const upstream = auth.upstream(auth.token(res.locals.session))
    // Resolve the URL from the authenticated account, never from a client-supplied URL.
    const target = req.params.organizationId ? '/organizations/' + req.params.organizationId + '/assets' : '/user/assets'
    const result = await upstream.get<{ success: boolean; assets: { id: number; url: string; mime_type?: string }[] }>(target)
    const asset = result.assets?.find(asset => String(asset.id) === req.params.id)
    requireValue(result.success && asset?.url, 404, 'Branding asset was not found.')
    const directory = await mkdtemp(join(tmpdir(), 'clippster-branding-preview-'))
    try {
      const path = join(directory, 'preview')
      await downloadAsset(asset.url, path, AbortSignal.timeout(60_000), limit)
      res.type(asset.mime_type || 'application/octet-stream')
      await new Promise<void>((resolve, reject) => res.sendFile(path, error => error ? reject(error) : resolve()))
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  router.get('/creator-avatar/:scope/:id', async (req, res) => {
    requireValue(['personal', 'assigned', 'campaign'].includes(String(req.params.scope)), 400, 'Unsupported creator scope.')
    const upstream = auth.upstream(auth.token(res.locals.session))
    type AvatarProfile = { id: number; profile_image_url?: string; platform_links?: { is_primary?: boolean; profile_image_url?: string }[] }
    const result = req.params.scope === 'campaign'
      ? await upstream.get<{ success: boolean; campaigns: { creator_profiles?: AvatarProfile[]; creator_profile?: AvatarProfile }[] }>('/user/campaigns')
        .then(bundle => ({ success: bundle.success, profiles: bundle.campaigns?.flatMap(campaign => campaign.creator_profiles?.length ? campaign.creator_profiles : campaign.creator_profile ? [campaign.creator_profile] : []) }))
      : await upstream.get<{ success: boolean; profiles: AvatarProfile[] }>(req.params.scope === 'personal' ? '/user/creator-profiles' : '/user/assigned-creator-profiles')
    const profile = result.profiles?.find(profile => String(profile.id) === req.params.id)
    const url = profile?.profile_image_url || profile?.platform_links?.find(link => link.is_primary && link.profile_image_url)?.profile_image_url || profile?.platform_links?.find(link => link.profile_image_url)?.profile_image_url
    requireValue(result.success && url, 404, 'Creator avatar was not found.')
    const directory = await mkdtemp(join(tmpdir(), 'clippster-creator-avatar-'))
    try {
      const path = join(directory, 'avatar')
      await downloadAsset(url, path, AbortSignal.timeout(30_000), 8 * 1024 ** 2)
      const { readFile } = await import('node:fs/promises')
      const bytes = await readFile(path)
      const type = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png' : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : bytes.subarray(0, 4).toString() === 'RIFF' ? 'image/webp' : bytes.subarray(0, 3).toString() === 'GIF' ? 'image/gif' : null
      requireValue(type, 415, 'Unsupported creator avatar.')
      res.type(type).send(bytes)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  router.post('/creator-media/convert', async (req, res) => {
    requireValue(!isFreePlan(res.locals.user), 403, 'Upgrade your plan to upload branding.')
    const owner = res.locals.session.owner
    requireValue(!active.has(owner) && active.size < 4, 409, 'Wait for the current branding upload.')
    active.add(owner)
    let directory: string | undefined
    try {
      directory = await mkdtemp(join(tmpdir(), 'clippster-branding-convert-'))
      const source = join(directory, 'source'), output = join(directory, 'converted.mp4')
      await receive(req, source)
      await probe(source, config, AbortSignal.timeout(30_000))
      await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', source, '-map', '0:v:0', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-movflags', '+faststart', output], AbortSignal.timeout(5 * 60_000))
      requireValue((await stat(output)).size <= limit, 400, 'Converted branding video exceeds 128 MB.')
      res.type('video/mp4')
      await new Promise<void>((resolve, reject) => res.sendFile(output, error => error ? reject(error) : resolve()))
    } finally { active.delete(owner); if (directory) await rm(directory, { recursive: true, force: true }) }
  })
  router.get('/creator-channel', async (req, res) => {
    const platform = String(req.query.platform), channel = String(req.query.channel || '')
    requireValue(/^[\w@.-]{1,200}$/.test(channel), 400, 'Invalid channel.')
    const urls: Record<string, string> = {
      kick: 'https://kick.com/' + channel, twitch: 'https://www.twitch.tv/' + channel,
      youtube: 'https://www.youtube.com/' + (channel.startsWith('UC') ? 'channel/' : channel.startsWith('@') ? '' : '@') + channel,
      rumble: 'https://rumble.com/c/' + channel
    }
    requireValue(urls[platform], 400, 'Unsupported platform.')
    const proxy = await downloadProxy()
    try {
      const result = JSON.parse(await run(config.ytdlp, ['--proxy', proxy.url, '--no-warnings', '--skip-download', '--flat-playlist', '--playlist-items', '1', '--dump-single-json', '--', urls[platform]], AbortSignal.timeout(30_000), 30_000))
      const displayName = result.uploader || result.channel || result.title || channel
      res.json({ username: displayName, displayName, channelName: displayName, profileImageUrl: result.channel_thumbnail || result.thumbnails?.find((thumbnail: { id?: string }) => thumbnail.id === 'avatar')?.url || null, isLive: Boolean(result.is_live) })
    } finally { await proxy.close() }
  })
  return router
}
