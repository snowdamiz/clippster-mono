import { Router } from 'express'
import { join } from 'node:path'
import { access, rm } from 'node:fs/promises'
import type { Store } from './store'
import type { Config } from './config'
import type { Jobs } from './jobs'
import { requireValue } from './errors'
import { projectDirectory } from './storage'
import { run } from './process'

export function builtClipRoutes(store: Store, config: Config, jobs: Jobs) {
  const router = Router()
  router.get('/projects/:id/clips/:clipId/builds/:buildId/thumbnail', async (req, res) => {
    const owner = res.locals.session.owner, project = store.get(String(req.params.id), owner)
    const clip = project.clips.find(value => value.id === req.params.clipId), build = clip?.builds?.find(value => value.id === req.params.buildId)
    requireValue(build, 404, 'Build not found.')
    const directory = projectDirectory(config, project.id), thumbnail = join(directory, `${build.id}-thumbnail.jpg`)
    try { await access(thumbnail) } catch {
      await run(config.ffmpeg, ['-v', 'error', '-i', join(directory, `${build.id}.mp4`), '-frames:v', '1', '-vf', 'scale=480:480:force_original_aspect_ratio=decrease', '-threads', '1', '-y', thumbnail], AbortSignal.timeout(30000), 30000)
    }
    res.sendFile(thumbnail, { cacheControl: false })
  })
  router.delete('/projects/:id/clips/:clipId/builds/:buildId', async (req, res) => {
    const owner = res.locals.session.owner, project = store.get(String(req.params.id), owner)
    jobs.assertIdle(project.id, owner)
    const clip = project.clips.find(value => value.id === req.params.clipId), build = clip?.builds?.find(value => value.id === req.params.buildId)
    requireValue(clip && build, 404, 'Build not found.')
    const latest = clip.builds!.at(-1)?.id === build.id
    clip.builds = clip.builds!.filter(value => value.id !== build.id)
    if (latest) clip.builtRevision = null
    store.save(project, owner)
    const directory = projectDirectory(config, project.id)
    await Promise.all([`${build.id}.mp4`, `${build.id}.mov`, `${build.id}-thumbnail.jpg`, ...(latest ? [`${clip.id}.mp4`] : [])].map(file => rm(join(directory, file), { force: true })))
    res.json({ project, jobs: [] })
  })
  return router
}
