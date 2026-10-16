import { Router } from 'express'
import { access, rm } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import type { Store } from './store'
import type { Config } from './config'
import { projectDirectory, checkStorage } from './storage'
import { requireValue } from './errors'
import { run } from './process'
import { probe } from './media'
const pending = new Map<string, Promise<string>>()
export async function prepareClipPreview(store: Store, config: Config, owner: string, projectId: string, clipId: string) {
    const project = store.get(projectId, owner), clip = project.clips.find(value => value.id === clipId)
    requireValue(project.status === 'ready' && clip, 404, 'Clip source is not available.')
    const hash = createHash('sha256').update(JSON.stringify(clip.segments.map(part => [part.start_time, part.end_time]))).digest('hex').slice(0, 24), key = `${project.id}-${clip.id}-${hash}`
    const directory = projectDirectory(config, project.id), output = join(directory, `${clip.id}-preview-${hash}.mp4`)
    let render = pending.get(key)
    if (!render) {
      render = (async () => {
        try { await access(output); return output } catch { /* Generate the assembled original source once. */ }
        requireValue(pending.size < 2, 503, 'Wait for another clip preview to finish preparing.')
        await checkStorage(store, config, owner)
        const input = join(directory, 'source.mp4'), signal = AbortSignal.timeout(5 * 60_000)
        const filters = clip.segments.map((_, index) => `[${index}:v]setpts=PTS-STARTPTS[v${index}];${project.hasAudio ? `[${index}:a]asetpts=PTS-STARTPTS[a${index}];` : ''}`).join('') + clip.segments.map((_, index) => `[v${index}]${project.hasAudio ? `[a${index}]` : ''}`).join('') + `concat=n=${clip.segments.length}:v=1:a=${project.hasAudio ? 1 : 0}[v]${project.hasAudio ? '[a]' : ''}`
        try {
          await run(config.ffmpeg, ['-v', 'error', ...clip.segments.flatMap(part => ['-protocol_whitelist', 'file,pipe', '-ss', String(part.start_time), '-t', String(part.end_time - part.start_time), '-i', input]), '-filter_complex', filters, '-map', '[v]', ...(project.hasAudio ? ['-map', '[a]', '-c:a', 'aac'] : []), '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '20', '-pix_fmt', 'yuv420p', '-threads', '2', '-movflags', '+faststart', '-fs', String(config.maxSourceBytes), '-y', output], signal)
          const metadata = await probe(output, config, signal), duration = clip.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0)
          requireValue(Math.abs(metadata.duration - duration) < .5, 400, 'The assembled clip preview could not finish rendering.')
          return output
        } catch (cause) { await rm(output, { force: true }); throw cause }
      })()
      pending.set(key, render)
    }
    try { return await render } finally { pending.delete(key) }
}
export function clipPreviewRoutes(store: Store, config: Config) {
  const router = Router()
  router.get('/projects/:id/clips/:clipId/preview', async (req, res) => {
    const output = await prepareClipPreview(store, config, res.locals.session.owner, String(req.params.id), String(req.params.clipId))
    res.type('video/mp4').sendFile(output, { cacheControl: false })
  })
  return router
}
