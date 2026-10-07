import { Router } from 'express'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { randomUUID } from 'node:crypto'
import { rateLimit } from 'express-rate-limit'
import type { Store, Session } from './store'
import { publicJob } from './store'
import type { Config } from './config'
import type { Auth } from './auth'
import type { Jobs } from './jobs'
import { requireValue, HttpError } from './errors'
import { textField, sourceUrl, clipInput } from './validation'
import { checkStorage, projectDirectory } from './storage'
export function workspaceRoutes(store: Store, config: Config, auth: Auth, jobs: Jobs) {
  const router = Router()
  const uploads = new Map<string, string>()
  router.use(auth.requireSession)
  router.use(
    rateLimit({
      windowMs: 60_000,
      limit: 180,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: (_req, res) => res.locals.session.owner,
      message: { error: 'Too many requests. Please wait a moment.' }
    })
  )
  router.use((_req, res, next) => {
    res.set('Cache-Control', 'private, no-store')
    next()
  })
  const workspace = (id: string, owner: string) => ({
    project: store.get(id, owner),
    jobs: store.jobs(id, owner).map(publicJob)
  })
  function idle(id: string, owner: string) {
    jobs.assertIdle(id, owner)
    requireValue(
      !Array.from(uploads.values()).includes(owner),
      409,
      'Wait for the current upload to finish.'
    )
  }
  router.get('/projects', (_req, res) =>
    res.json({ projects: store.list(res.locals.session.owner) })
  )
  router.post('/projects', (req, res) => {
    const session = res.locals.session as Session
    requireValue(
      store.list(session.owner).length < config.maxProjects,
      400,
      'You can keep up to 20 projects. Delete a project to make room.'
    )
    const project = store.create(textField(req.body?.name, 'Project name', 120), session.owner)
    res.status(201).json(workspace(project.id, session.owner))
  })
  router.get('/projects/:id', (req, res) =>
    res.json(workspace(String(req.params.id), res.locals.session.owner))
  )
  router.delete('/projects/:id', async (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    uploads.set(project.id, owner)
    try {
      await rm(projectDirectory(config, project.id), { recursive: true, force: true })
      store.delete(project.id, owner)
    } finally {
      uploads.delete(project.id)
    }
    res.status(204).end()
  })
  router.post('/projects/:id/import', async (req, res) => {
    const session = res.locals.session as Session
    const project = store.get(String(req.params.id), session.owner)
    idle(project.id, session.owner)
    requireValue(project.status !== 'ready', 409, 'Create a new project to import another source.')
    const url = sourceUrl(req.body?.url)
    res.status(202).json(publicJob(jobs.enqueue(project.id, session, 'import', { url })))
  })
  router.put('/projects/:id/source', async (req, res) => {
    const session = res.locals.session as Session
    const project = store.get(String(req.params.id), session.owner)
    idle(project.id, session.owner)
    requireValue(project.status !== 'ready', 409, 'Create a new project to upload another source.')
    requireValue(
      req.is('application/octet-stream') || req.is('video/*'),
      415,
      'Upload a video file.'
    )
    const size = Number(req.headers['content-length'])
    requireValue(
      !Number.isFinite(size) || size <= config.maxSourceBytes,
      413,
      'Videos must be 2 GB or smaller.'
    )
    // Reserve the project before awaiting I/O so concurrent uploads cannot overwrite it.
    requireValue(uploads.size < 2, 503, 'The upload queue is full. Please try again shortly.')
    requireValue(
      !store.activeJobs().some((job) => job.owner === session.owner),
      409,
      'Wait for your current media jobs before uploading.'
    )
    uploads.set(project.id, session.owner)
    const directory = projectDirectory(config, project.id)
    const path = join(directory, 'upload')
    try {
      await checkStorage(store, config, session.owner)
      await mkdir(directory, { recursive: true })
      let bytes = 0
      const limiter = new Transform({
        transform(chunk, _encoding, callback) {
          bytes += chunk.length
          callback(
            bytes > config.maxSourceBytes
              ? new HttpError(413, 'Videos must be 2 GB or smaller.')
              : null,
            chunk
          )
        }
      })
      await pipeline(req, limiter, createWriteStream(path, { flags: 'wx', mode: 0o600 }))
      requireValue(bytes > 0, 400, 'The uploaded file was empty.')
      res.status(202).json(publicJob(jobs.enqueue(project.id, session, 'import', {})))
    } catch (error) {
      await rm(path, { force: true })
      throw error
    } finally {
      uploads.delete(project.id)
    }
  })
  router.get('/projects/:id/source', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    requireValue(project.status === 'ready', 404, 'Source is not ready.')
    res
      .type('video/mp4')
      .sendFile(join(projectDirectory(config, project.id), 'source.mp4'), { cacheControl: false })
  })
  router.post('/projects/:id/detect', (req, res) => {
    const session = res.locals.session as Session
    const project = store.get(String(req.params.id), session.owner)
    idle(project.id, session.owner)
    requireValue(project.status === 'ready', 409, 'Import a source first.')
    requireValue(project.hasAudio, 400, 'AI clipping needs a source with audio.')
    requireValue(project.clips.length <= 50, 400, 'Delete some clips before finding more.')
    res
      .status(202)
      .json(
        publicJob(
          jobs.enqueue(project.id, session, 'detect', {
            prompt: textField(req.body?.prompt, 'Prompt', 4000)
          })
        )
      )
  })
  router.post('/projects/:id/clips', (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    requireValue(project.status === 'ready', 409, 'Import a source first.')
    requireValue(project.clips.length < 100, 400, 'A project may contain up to 100 clips.')
    project.clips.push({
      ...clipInput(req.body, project.duration),
      id: randomUUID(),
      revision: 1,
      builtRevision: null
    })
    store.save(project, owner)
    res.status(201).json(workspace(project.id, owner))
  })
  router.put('/projects/:id/clips/:clipId', (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    const clip = project.clips.find((clip) => clip.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    requireValue(
      req.body?.revision === clip.revision,
      409,
      'This clip changed in another window. Reopen it to load the latest version.'
    )
    Object.assign(clip, clipInput(req.body, project.duration), { revision: clip.revision + 1 })
    store.save(project, owner)
    res.json(workspace(project.id, owner))
  })
  router.delete('/projects/:id/clips/:clipId', async (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    const clip = project.clips.find((clip) => clip.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    project.clips = project.clips.filter((item) => item.id !== clip.id)
    store.save(project, owner)
    await rm(join(projectDirectory(config, project.id), `${clip.id}.mp4`), { force: true })
    res.json(workspace(project.id, owner))
  })
  router.post('/projects/:id/clips/:clipId/build', (req, res) => {
    const session = res.locals.session as Session
    const project = store.get(String(req.params.id), session.owner)
    idle(project.id, session.owner)
    const clip = project.clips.find((clip) => clip.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    res.status(202).json(publicJob(jobs.enqueue(project.id, session, 'build', { clipId: clip.id })))
  })
  router.get('/projects/:id/clips/:clipId/download', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find((clip) => clip.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    requireValue(
      clip.builtRevision === clip.revision,
      409,
      'Build this version of the clip before downloading.'
    )
    res.download(
      join(projectDirectory(config, project.id), `${clip.id}.mp4`),
      `${clip.name.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 100) || 'clip'}.mp4`,
      { cacheControl: false }
    )
  })
  router.delete('/jobs/:id', async (req, res) => {
    await jobs.cancel(String(req.params.id), res.locals.session.owner)
    res.status(204).end()
  })
  return router
}
