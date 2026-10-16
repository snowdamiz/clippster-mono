import { Router } from 'express'
import { mkdtemp, rm, mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Config } from './config'
import { requireValue } from './errors'
import { downloadAsset } from './network'
import { run } from './process'
export function brollPreviewRoutes(config: Config) {
  const router = Router(); let processing = 0
  router.get('/broll-preview', async (req, res) => {
    let url: URL | undefined
    try { url = new URL(String(req.query.url)) } catch { /* Validation below. */ }
    requireValue(url && url.protocol === 'https:' && /(?:^|\.)(pexels|pixabay)\.com$/.test(url.hostname), 400, 'Choose a stock preview from Pexels or Pixabay.')
    requireValue(processing < 4, 503, 'Wait for the other previews to load.')
    processing++
    let work: string | undefined
    try {
      const root = join(config.dataDir, 'stock-previews'); await mkdir(root, { recursive: true })
      work = await mkdtemp(join(root, 'preview-'))
      const signal = AbortSignal.timeout(30000)
      await downloadAsset(url.href, join(work, 'input'), signal, 8 * 1024 ** 2)
      const probe = JSON.parse(await run(config.ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'png_pipe,jpeg_pipe,mjpeg,webp_pipe', '-show_streams', '-of', 'json', join(work, 'input')], signal)).streams?.[0]
      requireValue(probe?.width > 0 && probe.width <= 7680 && probe.height > 0 && probe.height <= 4320, 400, 'Unsupported stock preview.')
      await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'png_pipe,jpeg_pipe,mjpeg,webp_pipe', '-i', join(work, 'input'), '-frames:v', '1', '-vf', 'scale=640:-2', '-threads', '1', '-y', join(work, 'output.png')], signal)
      res.type('image/png').send(await readFile(join(work, 'output.png')))
    } finally { processing--; if (work) await rm(work, { recursive: true, force: true }) }
  })
  return router
}
