import { Router } from 'express'
import { createWriteStream } from 'node:fs'
import { mkdir, rm, rename } from 'node:fs/promises'
import { join } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { randomUUID } from 'node:crypto'
import type { Store } from './store'
import type { Config } from './config'
import { checkStorage, projectDirectory } from './storage'
import { requireValue, HttpError } from './errors'
import { normalizeSource, probe } from './media'
import { run } from './process'
import { downloadAsset } from './network'
import type { StagedUploads } from './stagedUploads'

export function framingAssetRoutes(store: Store, config: Config, uploads: Map<string, string>, idle: (id: string, owner: string) => void, staged: StagedUploads) {
  const router = Router()
  router.get('/projects/:id/framing-assets', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    res.json({ assets: store.db.prepare('SELECT id,name,type FROM framing_assets WHERE project_id = ? AND owner = ?').all(project.id, res.locals.session.owner) })
  })
  router.post('/projects/:id/framing-assets', async (req, res) => {
    const owner = res.locals.session.owner, project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    requireValue(uploads.size < 2, 503, 'Wait for another upload to finish.')
    const count = store.db.prepare('SELECT COUNT(*) AS count FROM framing_assets WHERE project_id = ?').get(project.id) as { count: number }
    requireValue(count.count < 30, 400, 'A project can contain up to 30 uploaded framing assets.')
    const type = String(req.query.type)
    requireValue(type === 'image' || type === 'video', 400, 'Choose an image or video.')
    const name = String(req.query.name || 'Uploaded media').slice(0, 120)
    const id = randomUUID(), directory = join(projectDirectory(config, project.id), 'assets'), temporary = join(directory, `${id}-work`)
    uploads.set(project.id, owner)
    try {
      await checkStorage(store, config, owner); await mkdir(temporary, { recursive: true })
      const input = join(temporary, 'upload'), max = 128 * 1024 ** 2
      const signal = AbortSignal.timeout(5 * 60_000)
      if (req.query.url) {
        let url: URL | undefined
        try { url = new URL(String(req.query.url)) } catch { /* Validation below reports the failure. */ }
        requireValue(url && url.protocol === 'https:' && /(?:^|\.)(pexels|pixabay)\.com$/.test(url.hostname), 400, 'Choose stock media from Pexels or Pixabay.')
        await downloadAsset(url.href, input, signal, max)
      } else {
        let bytes = 0
        await pipeline(staged.body(req, owner), new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; callback(bytes > max ? new HttpError(413, 'Framing media must be 128 MB or smaller.') : null, chunk) } }), createWriteStream(input, { flags: 'wx', mode: 0o600 }))
        requireValue(bytes > 0, 400, 'The uploaded file was empty.')
      }
      if (type === 'image') {
        const metadata = JSON.parse(await run(config.ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'png_pipe,jpeg_pipe,mjpeg,webp_pipe', '-show_streams', '-of', 'json', input], signal, 30_000)).streams?.[0]
        requireValue(metadata?.width > 0 && metadata.width <= 7680 && metadata.height > 0 && metadata.height <= 4320, 400, 'Use a PNG, JPEG, or WebP image up to 8K.')
        await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'png_pipe,jpeg_pipe,mjpeg,webp_pipe', '-i', input, '-frames:v', '1', '-threads', '1', '-y', join(temporary, 'image.png')], signal)
        await rename(join(temporary, 'image.png'), join(directory, `${id}.png`))
      } else {
        const limits = { ...config, maxDuration: 600, maxSourceBytes: max }
        await probe(input, limits, signal)
        await normalizeSource(input, temporary, limits, signal)
        await rename(join(temporary, 'source.mp4'), join(directory, `${id}.mp4`))
      }
      store.db.prepare('INSERT INTO framing_assets VALUES (?, ?, ?, ?, ?)').run(id, project.id, owner, name, type)
      res.status(201).json({ asset: { id, name, type } })
    } catch (error) {
      await rm(join(directory, `${id}.${type === 'image' ? 'png' : 'mp4'}`), { force: true }); throw error
    } finally { uploads.delete(project.id); await rm(temporary, { recursive: true, force: true }) }
  })
  router.get('/projects/:id/framing-assets/:assetId', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const asset = store.db.prepare('SELECT id,type FROM framing_assets WHERE id = ? AND project_id = ? AND owner = ?').get(String(req.params.assetId), project.id, res.locals.session.owner) as { id: string; type: string } | undefined
    requireValue(asset, 404, 'Media asset not found.')
    res.type(asset.type === 'image' ? 'image/png' : 'video/mp4').sendFile(join(projectDirectory(config, project.id), 'assets', `${asset.id}.${asset.type === 'image' ? 'png' : 'mp4'}`), { cacheControl: false })
  })
  return router
}
