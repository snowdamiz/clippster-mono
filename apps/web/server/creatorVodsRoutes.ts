import { Router } from 'express'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Auth } from './auth'
import { downloadAsset } from './network'
import { requireValue } from './errors'
interface Vod { id: string; thumbnail_url?: string; [key: string]: unknown }
interface KickClip { clipId: string; title: string; duration: number; thumbnailUrl?: string; pageUrl?: string; playlistUrl?: string; createdAt?: string; isLive?: boolean }
export function creatorVodsRoutes(auth: Auth) {
  const router = Router(), catalogues = new Map<string, { time: number; vods: Vod[] }>()
  const query = (params: Record<string, unknown>) => {
    const platform = String(params.platform).toLowerCase(), channel = String(params.channel || ''), limit = Number(params.limit || 20), offset = Number(params.offset || 0), tab = String(params.tab || 'streams')
    requireValue(['twitch', 'kick', 'youtube', 'rumble'].includes(platform), 400, 'VOD browsing is not supported for this platform.')
    requireValue(/^[\w@.-]{1,200}$/.test(channel), 400, 'Invalid creator channel.')
    requireValue(Number.isInteger(limit) && limit >= 1 && limit <= 50 && Number.isInteger(offset) && offset >= 0 && offset <= 1000, 400, 'Invalid VOD page.')
    requireValue(['streams', 'videos'].includes(tab), 400, 'Invalid VOD tab.')
    return new URLSearchParams({ platform, channel, limit: String(limit), offset: String(offset), tab }).toString()
  }
  router.get('/media/vods', async (req, res) => {
    const params = query(req.query), owner = String(res.locals.session.owner)
    const api = auth.upstream(auth.token(res.locals.session)), parsed = new URLSearchParams(params)
    let upstream: { success: boolean; vods: Vod[]; has_more?: boolean; total?: number }
    if (parsed.get('platform') === 'kick') {
      const response = await api.get<{ success: boolean; clips: KickClip[]; hasMore: boolean; total: number }>(`/kick/channels/${encodeURIComponent(parsed.get('channel')!)}/videos?limit=${parsed.get('limit')}&offset=${parsed.get('offset')}`)
      requireValue(response.success && Array.isArray(response.clips), 502, 'Unable to load Kick videos.')
      upstream = { success: true, has_more: response.hasMore, total: response.total, vods: response.clips.filter(clip => !clip.isLive).map(clip => ({ id: clip.clipId, title: clip.title, duration_seconds: clip.duration, thumbnail_url: clip.thumbnailUrl, url: clip.pageUrl || clip.playlistUrl, upload_date: clip.createdAt })) }
    } else upstream = await api.get<{ success: boolean; vods: Vod[] }>('/media/vods?' + params)
    requireValue(upstream.success && Array.isArray(upstream.vods), 502, 'Unable to load completed videos.')
    const vods = upstream.vods.slice(0, 50)
    catalogues.set(owner + ':' + params, { time: Date.now(), vods })
    if (catalogues.size > 64) catalogues.delete(catalogues.keys().next().value!)
    const prefix = req.originalUrl.split('/account/')[0] + '/account/media/vod-thumbnail?'
    res.json({ ...upstream, vods: vods.map(vod => ({ ...vod, thumbnail_url: vod.thumbnail_url ? prefix + params + '&id=' + encodeURIComponent(vod.id) : undefined })) })
  })
  router.get('/media/vod-thumbnail', async (req, res) => {
    const params = query(req.query), catalogue = catalogues.get(String(res.locals.session.owner) + ':' + params)
    const url = catalogue && Date.now() - catalogue.time < 300_000 && catalogue.vods.find(vod => String(vod.id) === String(req.query.id))?.thumbnail_url
    requireValue(url, 404, 'Search again to refresh this thumbnail.')
    const directory = await mkdtemp(join(tmpdir(), 'clippster-vod-thumb-'))
    try {
      const path = join(directory, 'thumbnail')
      await downloadAsset(url, path, AbortSignal.timeout(30_000), 8 * 1024 ** 2)
      const bytes = await readFile(path)
      const type = bytes[0] === 0x89 && bytes[1] === 0x50 ? 'image/png' : bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : bytes.subarray(0, 4).toString() === 'RIFF' ? 'image/webp' : bytes.subarray(0, 3).toString() === 'GIF' ? 'image/gif' : null
      requireValue(type, 415, 'Unsupported video thumbnail.')
      res.set('Cache-Control', 'private, max-age=120').type(type).send(bytes)
    } finally { await rm(directory, { recursive: true, force: true }) }
  })
  return router
}
