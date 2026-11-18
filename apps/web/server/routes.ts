import { Router } from 'express'
import { createWriteStream } from 'node:fs'
import { mkdir, rm, readdir } from 'node:fs/promises'
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
import { creatorLayoutRoutes } from './creatorLayoutRoutes'
import { textField, sourceUrl, clipInput } from './validation'
import { checkStorage, projectDirectory } from './storage'
import { needsPlanSelection, isFreePlan } from '@clippster/shared-types'
import { promptRoutes } from './promptRoutes'
import { accountRoutes } from './accountRoutes'
import { publishRoutes } from './publishRoutes'
import { framingAssetRoutes } from './framingAssets'
import { brollRoutes } from './brollRoutes'
import { brollPreviewRoutes } from './brollPreviewRoutes'
import { clipPreviewRoutes } from './clipPreviewRoutes'
import { manualClipProjectRoutes } from './manualClipProjectRoutes'
import { creatorMediaRoutes } from './creatorMediaRoutes'
import { creatorVodsRoutes } from './creatorVodsRoutes'
import { waveformRoutes } from './waveformRoutes'
import { detectionOptions } from './workspaceDetection'
import { run } from './process'
import { access } from 'node:fs/promises'
import { builtClipRoutes } from './builtClipRoutes'
import { profileMediaRoutes } from './profileMediaRoutes'
import { settingsStorageRoutes } from './settingsStorageRoutes'
import { stagedUploads } from './stagedUploads'
import { CreatorSkillApi } from './creatorSkillApi'
import { creatorSkillMediaRoutes } from './creatorSkillMediaRoutes'
import { recordCreatorSkillClaimReview, recordCreatorSkillFootageReview, recordCreatorSkillIndependentFinding, recordCreatorSkillIndependentSignoff } from '../../../client/src/services/creatorSkillPackage'
import { extractCreatorSkillSource } from './creatorSkillSource'
export function workspaceRoutes(store: Store, config: Config, auth: Auth, jobs: Jobs) {
  const router = Router()
  const uploads = new Map<string, string>()
  const staged = stagedUploads(config)
  router.use(auth.requireSession)
  router.use((_req, res, next) => {
    requireValue(!needsPlanSelection(res.locals.user), 403, 'Choose Free or a paid plan in Billing to continue.')
    next()
  })
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
  router.patch('/projects/:id/transcript', (req, res) => {
    const owner = res.locals.session.owner, project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    const index = req.body?.index, text = textField(req.body?.text, 'Transcript word', 200)
    requireValue(Number.isInteger(index) && index >= 0 && index < project.words.length, 400, 'Choose a valid transcript word.')
    const word = project.words[index]; project.words[index] = { ...word, word: text }
    for (const clip of project.clips) if (clip.captions && !clip.subtitleWords && clip.segments.some(segment => word.end > segment.start_time && word.start < segment.end_time)) clip.revision++
    store.save(project, owner)
    res.json(workspace(project.id, owner))
  })
  router.post('/projects/:id/transcript', (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    requireValue(project.status === 'ready', 409, 'Import a source before its transcript.')
    const input: unknown = req.body?.words
    requireValue(Array.isArray(input) && input.length <= 100_000, 400, 'Provide at most 100,000 timed words.')
    const words = input.map((value: unknown) => {
      requireValue(value && typeof value === 'object', 400, 'Invalid timed word.')
      const item = value as Record<string, unknown>
      requireValue(typeof item.word === 'string' && item.word.length > 0 && item.word.length <= 200 &&
        typeof item.start === 'number' && typeof item.end === 'number' &&
        Number.isFinite(item.start) && Number.isFinite(item.end) &&
        item.start >= 0 && item.end > item.start && item.end <= project.duration + 0.05,
      400, 'Transcript words must have valid text and times inside the VOD.')
      return { word: item.word, start: item.start, end: item.end }
    })
    project.words = words
    project.transcriptRanges = [{ start: 0, end: project.duration }]
    store.save(project, owner)
    res.json(workspace(project.id, owner))
  })
  router.use(staged.router)
  router.use('/prompts', promptRoutes(store, auth))
  router.get('/ai/video/policy', async (_req, res) => {
    const api = new CreatorSkillApi(config, auth.token(res.locals.session))
    res.json(await api.policy())
  })
  router.use(waveformRoutes(store, config))
  router.use(creatorSkillMediaRoutes(store, config))
  router.use(builtClipRoutes(store, config, jobs))
  router.use(profileMediaRoutes(auth))
  router.use(settingsStorageRoutes(store, config))
  router.use('/account', creatorMediaRoutes(auth, config, staged))
  router.use('/account', creatorVodsRoutes(auth))
  router.use('/account', accountRoutes(auth))
  router.use(publishRoutes(store, auth, config, jobs))
  function idle(id: string, owner: string) {
    jobs.assertIdle(id, owner)
    requireValue(
      !Array.from(uploads.values()).includes(owner),
      409,
      'Wait for the current upload to finish.'
    )
  }
  router.use(framingAssetRoutes(store, config, uploads, idle, staged))
  router.use(brollRoutes(store))
  router.use(brollPreviewRoutes(config))
  router.use(clipPreviewRoutes(store, config))
  router.use(manualClipProjectRoutes(store, config, jobs))
  router.use(creatorLayoutRoutes(store, auth, jobs, config))
  router.get('/vod-searches', (_req, res) => res.json({ searches: store.recentVodSearches(res.locals.session.owner) }))
  router.post('/vod-searches', (req, res) => {
    const id = textField(req.body?.id, 'Channel', 300), displayText = textField(req.body?.displayText, 'Search', 2000), platform = String(req.body?.platform)
    requireValue(['pumpfun', 'kick', 'twitch', 'YouTube', 'rumble', 'twitter', 'tokend'].includes(platform), 400, 'Invalid search platform.')
    const owner = res.locals.session.owner
    const searches = [{ id, displayText, platform, timestamp: Date.now() }, ...store.recentVodSearches(owner).filter(search => search.id !== id || search.platform !== platform)].slice(0, 20)
    store.saveVodSearches(owner, searches)
    res.json({ searches })
  })
  router.delete('/vod-searches', (_req, res) => { store.saveVodSearches(res.locals.session.owner, []); res.json({ searches: [] }) })
  router.get('/projects', (_req, res) =>
    res.json({ projects: store.list(res.locals.session.owner), jobs: store.activeJobs().filter(job => job.owner === res.locals.session.owner).map(publicJob) })
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
  router.patch('/projects/:id', (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    if (req.body?.name !== undefined) project.name = textField(req.body.name, 'Project name', 120)
    if (req.body?.folder !== undefined) {
      requireValue(typeof req.body.folder === 'string' && req.body.folder.length <= 120, 400, 'Folder must be at most 120 characters.')
      project.folder = req.body.folder.trim()
    }
    if (req.body?.description !== undefined) { requireValue(typeof req.body.description === 'string' && req.body.description.length <= 2000, 400, 'Description must be at most 2000 characters.'); project.description = req.body.description.trim() }
    if (req.body?.creatorId !== undefined) { requireValue(req.body.creatorId === null || Number.isSafeInteger(req.body.creatorId) && req.body.creatorId > 0, 400, 'Invalid creator.'); project.creatorId = req.body.creatorId }
    if (req.body?.sourcePlatform !== undefined) { requireValue(['kick', 'twitch', 'youtube', 'pumpfun', 'rumble', 'twitter', 'tokend'].includes(req.body.sourcePlatform), 400, 'Invalid source platform.'); project.sourcePlatform = req.body.sourcePlatform }
    if (req.body?.sourceChannel !== undefined) project.sourceChannel = textField(req.body.sourceChannel, 'Source channel', 400)
    store.save(project, owner)
    res.json(workspace(project.id, owner))
  })
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
    const range = req.body?.range
    if (range !== undefined) requireValue(range && Number.isFinite(range.startTime) && Number.isFinite(range.endTime) && range.startTime >= 0 && range.endTime > range.startTime && range.endTime - range.startTime <= config.maxDuration, 400, `Choose a valid video range up to ${Math.floor(config.maxDuration / 3600)} hours long.`)
    if (isFreePlan(res.locals.user)) store.consumeFreeUsage(session.owner, 'vod_download')
    const job = jobs.enqueue(project.id, session, 'import', { url, ...(range ? { range } : {}) })
    project.sourceUrl = url
    project.sourceRange = range || null
    store.save(project, session.owner)
    res.status(202).json(publicJob(job))
  })
  router.put('/projects/:id/source', async (req, res) => {
    const session = res.locals.session as Session
    const project = store.get(String(req.params.id), session.owner)
    idle(project.id, session.owner)
    requireValue(project.status !== 'ready', 409, 'Create a new project to upload another source.')
    requireValue(
      req.query.upload || req.is('application/octet-stream') || req.is('video/*'),
      415,
      'Upload a video file.'
    )
    const size = Number(req.headers['content-length'])
    requireValue(
      !Number.isFinite(size) || size <= config.maxSourceBytes,
      413,
      `Videos must be ${Math.round(config.maxSourceBytes / 1024 ** 3)} GB or smaller.`
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
              ? new HttpError(413, `Videos must be ${Math.round(config.maxSourceBytes / 1024 ** 3)} GB or smaller.`)
              : null,
            chunk
          )
        }
      })
      await pipeline(staged.body(req, session.owner), limiter, createWriteStream(path, { flags: 'wx', mode: 0o600 }))
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
  const thumbnails = new Map<string, Promise<string>>()
  router.get('/projects/:id/thumbnail', async (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    requireValue(project.status === 'ready', 404, 'Source is not ready.')
    const time = req.query.time === undefined ? Math.min(1, project.duration / 2) : Number(req.query.time)
    requireValue(Number.isFinite(time) && time >= 0 && time < project.duration && (req.query.time === undefined || time === 0 || project.clips.some(clip => clip.segments.some(segment => Math.abs(segment.start_time - time) < 0.001))), 400, 'Choose a clip thumbnail time.')
    const key = `${project.id}-${time}`
    let pending = thumbnails.get(key)
    if (!pending) {
      pending = (async () => {
        const directory = projectDirectory(config, project.id), output = join(directory, `thumbnail-${time.toFixed(3)}.jpg`)
        try { await access(output) } catch { await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-ss', String(time), '-i', join(directory, 'source.mp4'), '-frames:v', '1', '-vf', 'scale=640:-2', '-threads', '1', '-y', output], AbortSignal.timeout(30_000)) }
        return output
      })()
      thumbnails.set(key, pending)
    }
    try { res.type('image/jpeg').sendFile(await pending) } finally { thumbnails.delete(key) }
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
            prompt: textField(req.body?.prompt, 'Prompt', 32000), ...detectionOptions(req.body, project.duration)
          })
        )
      )
  })
  router.post('/projects/:id/transcribe', (req, res) => {
    const session = res.locals.session as Session
    const project = store.get(String(req.params.id), session.owner)
    idle(project.id, session.owner)
    requireValue(project.status === 'ready' && project.hasAudio, 409, 'Import a source with audio first.')
    res.status(202).json(publicJob(jobs.enqueue(project.id, session, 'transcribe', detectionOptions(req.body, project.duration) as Record<string, unknown>)))
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
  router.patch('/projects/:id/clips/:clipId/version', (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    const clip = project.clips.find(value => value.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    requireValue(req.body?.version === 'raw' || req.body?.version === 'edited', 400, 'Choose Raw or Edited.')
    requireValue(req.body.version === 'raw' || clip.builtRevision === clip.revision, 409, 'Build the current clip before selecting Edited.')
    clip.selectedVersion = req.body.version
    store.save(project, owner)
    res.json(workspace(project.id, owner))
  })
  router.patch('/projects/:id/clips/:clipId/creator-skill/claim-review', (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    const clip = project.clips.find(value => value.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.playbookPackage, 404, 'Claim package not found.')
    try {
      clip.creatorSkill.playbookPackage = recordCreatorSkillClaimReview(
        clip.creatorSkill.playbookPackage, req.body?.claimIndex, req.body?.decision, req.body?.note,
      )
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid claim review.')
    }
    store.save(project, owner)
    res.json(workspace(project.id, owner))
  })
  router.patch('/projects/:id/clips/:clipId/creator-skill/footage-review', (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    const clip = project.clips.find(value => value.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.playbookPackage, 404, 'Footage package not found.')
    try {
      clip.creatorSkill.playbookPackage = recordCreatorSkillFootageReview(
        clip.creatorSkill.playbookPackage, req.body?.footageIndex, req.body?.decision, req.body?.note,
      )
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid footage review.')
    }
    store.save(project, owner)
    res.json(workspace(project.id, owner))
  })
  router.patch('/projects/:id/clips/:clipId/creator-skill/independent-review', (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    const clip = project.clips.find(value => value.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.playbookPackage && clip.creatorSkill.masterMd5, 404, 'Checked edited master not found.')
    try {
      clip.creatorSkill.playbookPackage = recordCreatorSkillIndependentFinding(clip.creatorSkill.playbookPackage, {
        reviewer: req.body?.reviewer, severity: req.body?.severity, outputTime: req.body?.outputTime,
        finding: req.body?.finding, masterMd5: clip.creatorSkill.masterMd5,
      })
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid reviewer finding.')
    }
    store.save(project, owner)
    res.json(workspace(project.id, owner))
  })
  router.patch('/projects/:id/clips/:clipId/creator-skill/independent-signoff', (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    idle(project.id, owner)
    const clip = project.clips.find(value => value.id === req.params.clipId)
    requireValue(clip?.creatorSkill?.playbookPackage && clip.creatorSkill.masterMd5, 404, 'Checked edited master not found.')
    try {
      clip.creatorSkill.playbookPackage = recordCreatorSkillIndependentSignoff(clip.creatorSkill.playbookPackage, {
        reviewer: req.body?.reviewer, note: req.body?.note, masterMd5: clip.creatorSkill.masterMd5,
      })
    } catch (error) {
      throw new HttpError(400, error instanceof Error ? error.message : 'Invalid reviewer signoff.')
    }
    store.save(project, owner)
    res.json(workspace(project.id, owner))
  })
  router.post('/projects/:id/clips/:clipId/creator-skill', (req, res) => {
    const session = res.locals.session as Session
    const project = store.get(String(req.params.id), session.owner)
    idle(project.id, session.owner)
    requireValue(project.status === 'ready' && project.hasAudio, 409, 'Import a source with audio first.')
    const clip = project.clips.find(value => value.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    requireValue(!clip.creatorSkill || clip.creatorSkill.status === 'failed', 409, 'This clip already has a Clippster Skill edit.')
    requireValue(Number.isSafeInteger(req.body?.maxCreditsPerClip) && req.body.maxCreditsPerClip >= 0, 400, 'Confirm the current AI edit price before starting.')
    clip.creatorSkill = { ...clip.creatorSkill, status: 'queued', reviewItems: [] }
    clip.selectedVersion = 'raw'
    store.save(project, session.owner)
    res.status(202).json(publicJob(jobs.enqueue(project.id, session, 'creator_skill', { clipId: clip.id, maxCreditsPerClip: req.body.maxCreditsPerClip })))
  })
  router.post('/projects/:id/creator-skill/batch', (req, res) => {
    const session = res.locals.session as Session
    const project = store.get(String(req.params.id), session.owner)
    idle(project.id, session.owner)
    const pending = project.clips.filter(clip => clip.creatorSkill?.status === 'awaiting_approval')
    requireValue(pending.length > 0, 409, 'There are no detected clips awaiting pre-edit approval.')
    requireValue(Number.isSafeInteger(req.body?.maxCreditsPerClip) && req.body.maxCreditsPerClip >= 0, 400, 'Confirm the current AI edit price before starting.')
    const job = jobs.enqueue(project.id, session, 'creator_skill_batch', { clipIds: pending.map(clip => clip.id), maxCreditsPerClip: req.body.maxCreditsPerClip })
    for (const clip of pending) clip.creatorSkill!.status = 'queued'
    store.save(project, session.owner)
    res.status(202).json(publicJob(job))
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
    if (clip.creatorSkill) await rm(join(projectDirectory(config, project.id), 'creator-skill', clip.id), { recursive: true, force: true })
    for (const build of clip.builds || []) for (const format of new Set(['mp4', build.format])) await rm(join(projectDirectory(config, project.id), `${build.id}.${format}`), { force: true })
    for (const file of await readdir(projectDirectory(config, project.id)).catch(() => [])) if (file.startsWith(`${clip.id}-preview-`) && file.endsWith('.mp4')) await rm(join(projectDirectory(config, project.id), file), { force: true })
    store.db.prepare('DELETE FROM broll_suggestions WHERE clip_id = ? AND project_id = ? AND owner = ?').run(clip.id, project.id, owner)
    res.json(workspace(project.id, owner))
  })
  router.post('/projects/:id/clips/:clipId/build', (req, res) => {
    const session = res.locals.session as Session
    const project = store.get(String(req.params.id), session.owner)
    idle(project.id, session.owner)
    const clip = project.clips.find((clip) => clip.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    const requested = req.body?.targets
    requireValue(requested === undefined || Array.isArray(requested) && requested.length > 0 && requested.length <= 20, 400, 'Choose 1–20 build targets.')
    const targets = requested?.map((target: unknown) => ({ ...clip, ...clipInput({ ...clip, ...(target as object) }, project.duration), id: clip.id }))
    if (isFreePlan(res.locals.user)) store.consumeFreeUsage(session.owner, 'clip_build')
    if (targets?.length) {
      clip.exportRatios = [...new Set(targets.map((target: typeof clip) => target.aspectRatio))] as typeof clip.exportRatios
      for (const target of targets) if (target.framingConfig) (clip.framingConfigs ||= {})[target.aspectRatio] = target.framingConfig
      Object.assign(clip, { aspectRatio: targets[0].aspectRatio, exportSettings: targets[0].exportSettings, framingConfig: targets[0].framingConfig, branding: targets[0].branding, builtRevision: null })
      store.save(project, session.owner)
    }
    res.status(202).json(publicJob(jobs.enqueue(project.id, session, 'build', { clipId: clip.id, targets })))
  })
  router.post('/projects/:id/clips/:clipId/transcribe', (req, res) => {
    const session = res.locals.session as Session, project = store.get(String(req.params.id), session.owner)
    idle(project.id, session.owner)
    requireValue(project.status === 'ready' && project.hasAudio && project.clips.some(clip => clip.id === req.params.clipId), 404, 'Choose a clip with audio.')
    const options = detectionOptions(req.body, project.duration)
    res.status(202).json(publicJob(jobs.enqueue(project.id, session, 'transcribe', { clipId: String(req.params.clipId), organizationId: options.organizationId })))
  })
  router.get('/projects/:id/clips/:clipId/playback', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner), clip = project.clips.find(value => value.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    const build = req.query.buildId ? clip.builds?.find(value => value.id === req.query.buildId) : undefined
    requireValue(!req.query.buildId || build, 404, 'Build not found.')
    requireValue(build || clip.builtRevision === clip.revision, 409, 'Build the latest clip before previewing this export.')
    res.type('video/mp4').sendFile(join(projectDirectory(config, project.id), `${build?.id || clip.id}.mp4`), { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/creator-skill/raw', async (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find(value => value.id === req.params.clipId)
    requireValue(clip?.creatorSkill, 404, 'Detected Raw clip not found.')
    requireValue(!(['queued', 'editing', 'rendering'].includes(clip.creatorSkill.status) && !clip.creatorSkill.rawClipMd5), 409, 'Raw extraction is still in progress.')
    const directory = projectDirectory(config, project.id)
    const work = join(directory, 'creator-skill', clip.id)
    const path = join(work, `creator-skill-${clip.id}.mp4`)
    if (!clip.creatorSkill.rawClipMd5 || await access(path).then(() => false, () => true)) {
      await mkdir(work, { recursive: true })
      await extractCreatorSkillSource(clip, directory, work, config, AbortSignal.timeout(10 * 60_000))
    }
    res.download(path, `${clip.name.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 100) || 'clip'}-Raw.mp4`, { cacheControl: false })
  })
  router.get('/projects/:id/clips/:clipId/download', (req, res) => {
    const project = store.get(String(req.params.id), res.locals.session.owner)
    const clip = project.clips.find((clip) => clip.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    const build = req.query.buildId ? clip.builds?.find(value => value.id === req.query.buildId) : undefined
    requireValue(!req.query.buildId || build, 404, 'Build not found.')
    requireValue(
      !!build || clip.builtRevision === clip.revision,
      409,
      'Build this version of the clip before downloading.'
    )
    res.download(
        join(projectDirectory(config, project.id), build ? `${build.id}.${build.format}` : `${clip.id}.mp4`),
        `${clip.name.replace(/[^\p{L}\p{N} _-]/gu, '').slice(0, 100) || 'clip'}${build ? `-${build.aspectRatio.replace(':', 'x')}` : ''}.${build?.format || 'mp4'}`,
      { cacheControl: false }
    )
  })
  router.delete('/jobs/:id', async (req, res) => {
    await jobs.cancel(String(req.params.id), res.locals.session.owner)
    res.status(204).end()
  })
  return router
}
