import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { rename, rm, mkdir, readdir, copyFile } from 'node:fs/promises'
import type { WebJob } from '@clippster/shared-types'
import type { Store, Session, StoredJob } from './store'
import type { Config } from './config'
import type { Auth } from './auth'
import { requireValue } from './errors'
import { checkStorage, projectDirectory, resetWorkDirectory } from './storage'
import { downloadSource, normalizeSource, renderClip, probe } from './media'
import { detectWorkspace, type WorkspaceDetectionOptions } from './workspaceDetection'
import { createAuthApi } from '@clippster/api-client'
import { needsPlanSelection } from '@clippster/shared-types'
import { applyBranding } from './branding'
import { run } from './process'
import { transcribeClip } from './clipTranscription'
import { waveformData } from './waveform'
export class Jobs {
  private running: { job: StoredJob; abort: AbortController; promise: Promise<void> } | null = null
  private stopped = false
  private cancellations = new Set<string>()
  private preparationAbort = new AbortController()
  private preparations: Promise<unknown>[] = []
  constructor(
    private store: Store,
    private config: Config,
    private auth: Auth
  ) {}
  async start() {
    // Never replay a potentially billed AI request after an ambiguous restart.
    for (const job of this.store.activeJobs()) {
      job.status = 'failed'
      job.message =
        'The service restarted. Review the project before retrying; an AI request may have used credits.'
      this.store.saveJob(job)
      const project = this.store.get(job.projectId, job.owner)
      if (project.status === 'importing') {
        project.status = 'error'
        project.error = 'Import interrupted. Please retry.'
        this.store.save(project, job.owner)
      }
      await rm(join(projectDirectory(this.config, project.id), 'work'), {
        recursive: true,
        force: true
      })
    }
    // A process can die during an upload, before a job exists. Remove incomplete inputs too.
    const media = join(this.config.dataDir, 'media')
    for (const entry of await readdir(media, { withFileTypes: true }).catch(() => [])) {
      if (!entry.isDirectory()) continue
      await rm(join(media, entry.name, 'work'), { recursive: true, force: true })
      await rm(join(media, entry.name, 'upload'), { force: true })
    }
  }
  assertIdle(projectId: string, owner: string) {
    requireValue(
      !this.cancellations.has(projectId),
      409,
      'Cancellation is still cleaning up. Please wait.'
    )
    requireValue(
      !this.store.activeJobs().some((job) => job.projectId === projectId && job.owner === owner),
      409,
      'Wait for the current project job to finish.'
    )
  }
  enqueue(
    projectId: string,
    session: Session,
    kind: WebJob['kind'],
    payload: Record<string, unknown>
  ) {
    this.assertIdle(projectId, session.owner)
    requireValue(
      this.store.activeJobs().filter((job) => job.owner === session.owner && (kind === 'import' ? job.kind === 'import' : job.kind !== 'import')).length < (kind === 'import' ? 20 : 2),
      429,
      kind === 'import' ? 'You can queue twenty downloads at a time.' : 'You can queue two AI or build jobs at a time.'
    )
    requireValue(
      this.store.activeJobs().length < 20,
      503,
      'The media queue is full. Please try again shortly.'
    )
    const job: StoredJob = {
      id: randomUUID(),
      projectId,
      owner: session.owner,
      sessionId: session.id,
      kind,
      clipId: typeof payload.clipId === 'string' ? payload.clipId : undefined,
      payload,
      status: 'queued',
      progress: 0,
      message: 'Queued',
      createdAt: Date.now()
    }
    this.store.saveJob(job)
    queueMicrotask(() => this.pump())
    return job
  }
  async cancel(id: string, owner: string) {
    const job = this.store.job(id, owner)
    if (!['queued', 'running'].includes(job.status)) return
    if (['detect', 'transcribe'].includes(job.kind) && job.status === 'running') {
      const session = this.store.session(job.sessionId)
      requireValue(session, 401, 'Sign in again before cancelling this analysis.')
      const cancellation = await this.auth.upstream(this.auth.token(session)).requestWithStatus<{ success: boolean }>('/jobs/cancel-by-project', { method: 'POST', body: { project_id: job.projectId } })
      requireValue(cancellation.data.success || cancellation.status === 404, 502, 'The AI service could not confirm cancellation. Please retry.')
    }
    if (this.running?.job.id === id) {
      this.running.abort.abort()
      await this.running.promise
    } else {
      this.cancellations.add(job.projectId)
      try {
        job.status = 'cancelled'
        job.message = 'Cancelled'
        this.store.saveJob(job)
        if (job.kind === 'import')
          await rm(join(projectDirectory(this.config, job.projectId), 'upload'), { force: true })
      } finally {
        this.cancellations.delete(job.projectId)
      }
    }
  }
  private pump() {
    if (this.stopped || this.running) return
    const job = this.store.activeJobs().find((job) => job.status === 'queued')
    if (!job) return
    const abort = new AbortController()
    const promise = this.execute(job, abort.signal).finally(() => {
      this.running = null
      this.pump()
    })
    this.running = { job, abort, promise }
  }
  private async execute(job: StoredJob, signal: AbortSignal) {
    const directory = projectDirectory(this.config, job.projectId)
    const progress = (value: number, message: string) => {
      job.progress = Math.max(job.progress, Math.round(value))
      job.message = message
      this.store.saveJob(job)
    }
    job.status = 'running'
    progress(1, 'Starting…')
    try {
      const project = this.store.get(job.projectId, job.owner)
      const session = this.store.session(job.sessionId)
      requireValue(session, 401, 'Your session expired. Sign in and retry the job.')
      const me = await createAuthApi(this.auth.upstream(this.auth.token(session))).me()
      requireValue(me.success && me.user && String(me.user.id) === job.owner, 401, 'Sign in and retry the job.')
      requireValue(!needsPlanSelection(me.user), 403, 'Choose a plan in Billing before continuing.')
      await checkStorage(this.store, this.config, job.owner)
      await mkdir(directory, { recursive: true })
      const work = await resetWorkDirectory(directory)
      if (job.kind === 'import') {
        project.status = 'importing'
        project.error = null
        this.store.save(project, job.owner)
        const input =
          typeof job.payload.url === 'string'
            ? await downloadSource(job.payload.url, work, this.config, signal, progress, job.payload.range as { startTime: number; endTime: number } | undefined)
            : join(directory, 'upload')
        progress(60, 'Preparing browser playback…')
        const metadata = await normalizeSource(input, work, this.config, signal, progress)
        signal.throwIfAborted()
        await rename(join(work, 'source.mp4'), join(directory, 'source.mp4'))
        Object.assign(project, metadata, { status: 'ready', sourceUrl: job.payload.url || null })
        const preparation = waveformData(project, this.config, this.preparationAbort.signal).catch(() => { /* Opening the timeline can retry preparation. */ })
        this.preparations.push(preparation)
        preparation.finally(() => {
          const index = this.preparations.indexOf(preparation)
          if (index >= 0) this.preparations.splice(index, 1)
        })
      } else if (job.kind === 'transcribe' && job.payload.clipId) {
        const clip = project.clips.find(value => value.id === job.payload.clipId)
        requireValue(clip, 404, 'Clip not found.')
        progress(10, 'Transcribing this clip…')
        await transcribeClip(this.store, this.config, job.owner, this.auth.token(session), project, clip, work, signal, job.payload.organizationId as number | null | undefined)
      } else if (job.kind === 'detect' || job.kind === 'transcribe') {
        progress(10, 'Analyzing audio with Clippster AI…')
        const result = await detectWorkspace(
          project,
          String(job.payload.prompt),
          this.auth.token(session),
          directory,
          work,
          this.config,
          signal,
          job.payload as WorkspaceDetectionOptions,
          job.kind === 'transcribe',
          progress
        )
        signal.throwIfAborted()
        requireValue(
          project.clips.length + result.clips.length <= 100,
          400,
          'Project clip limit reached. Delete some clips before detecting again.'
        )
        project.clips.push(...result.clips)
        for (const clip of result.clips) clip.detection = { ...clip.detection, sessionId: job.id, promptName: String(job.payload.prompt || '').slice(0, 100) }
        project.words = result.words
        ;(project.transcriptRanges ||= []).push({ start: Number(job.payload.startTime ?? 0), end: Number(job.payload.endTime ?? project.duration) })
        job.message = result.clips.length
          ? `${result.clips.length} clips found`
          : 'Analysis complete. No matching moments found. Try a different prompt.'
      } else {
        const clip = project.clips.find((clip) => clip.id === job.payload.clipId)
        requireValue(clip, 404, 'Clip not found.')
        progress(20, 'Building your clip…')
        const targets = Array.isArray(job.payload.targets) && job.payload.targets.length ? job.payload.targets as typeof clip[] : [clip]
        const regions = targets.flatMap(target => [...(target.framingConfig?.regions || []), ...(target.framingConfig?.segmentConfigs?.flatMap(part => part.regions) || []), ...(target.framingConfig?.brollConfigs?.map(part => part.region) || [])])
        const assets = [...new Set(regions.flatMap(region => region.mediaAssetId ? [region.mediaAssetId] : []))].map(id => {
          const asset = this.store.db.prepare('SELECT id,type FROM framing_assets WHERE id = ? AND project_id = ? AND owner = ?').get(id, project.id, job.owner) as { id: string; type: 'image' | 'video' } | undefined
          requireValue(asset, 404, 'Uploaded framing media is no longer available.')
          return { ...asset, path: join(directory, 'assets', `${asset.id}.${asset.type === 'image' ? 'png' : 'mp4'}`) }
        })
        for (const [index, target] of targets.entries()) {
          await checkStorage(this.store, this.config, job.owner)
          progress(20 + Math.round(index / targets.length * 70), `Building ${index + 1} of ${targets.length}…`)
          await renderClip(project, target, directory, work, this.config, signal, false, assets)
          await applyBranding(target, join(work, 'clip.mp4'), work, this.config, signal, this.auth.upstream(this.auth.token(session)), me.user)
          signal.throwIfAborted()
          const id = randomUUID(), format = target.exportSettings?.format || 'mp4'
          if (format === 'mov') {
            await run(this.config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', join(work, 'clip.mp4'), '-c:v', 'prores_ks', '-profile:v', '3', '-threads', '2', '-c:a', 'pcm_s16le', '-fs', String(this.config.maxSourceBytes), '-y', join(work, 'clip.mov')], signal)
            const expected = await probe(join(work, 'clip.mp4'), this.config, signal)
            const converted = await probe(join(work, 'clip.mov'), this.config, signal)
            requireValue(Math.abs(converted.duration - expected.duration) < 0.5, 413, 'The MOV export exceeded the file size limit. Choose MP4 or a shorter clip.')
          }
          await copyFile(join(work, 'clip.mp4'), join(directory, `${id}.mp4`))
          if (format === 'mov') await copyFile(join(work, 'clip.mov'), join(directory, `${id}.mov`))
          const outputInfo = await probe(join(work, 'clip.mp4'), this.config, signal)
          ;(clip.builds ||= []).push({ id, revision: clip.revision, aspectRatio: target.aspectRatio, format, completedAt: Date.now(), duration: outputInfo.duration, organizationId: target.branding?.organizationId, campaignId: target.branding?.campaignId })
          if (target.framingConfig) (clip.framingConfigs ||= {})[target.aspectRatio] = target.framingConfig
          this.store.save(project, job.owner)
        }
        await rename(join(work, 'clip.mp4'), join(directory, `${clip.id}.mp4`))
        clip.builtRevision = clip.revision
      }
      this.store.save(project, job.owner)
      job.status = 'completed'
      progress(100, job.kind === 'detect' ? job.message : 'Complete')
    } catch (error) {
      job.status = signal.aborted ? 'cancelled' : 'failed'
      // Do not expose subprocess output, server paths, credentials, or upstream URLs.
      const message = error instanceof Error ? error.message : 'Job failed.'
      job.message = /failed:|Could not start/.test(message)
        ? 'Media processing failed. The source may be unavailable or unsupported. Try uploading the video.'
        : message
      if (job.kind === 'import') {
        const project = this.store.get(job.projectId, job.owner)
        project.status = 'error'
        project.error = job.message
        this.store.save(project, job.owner)
      }
      this.store.saveJob(job)
      console.error(
        JSON.stringify({
          event: 'media_job_failed',
          jobId: job.id,
          kind: job.kind,
          cancelled: signal.aborted
        })
      )
    } finally {
      await rm(join(directory, 'work'), { recursive: true, force: true })
      await rm(join(directory, 'upload'), { force: true })
    }
  }
  async stop() {
    this.stopped = true
    this.preparationAbort.abort()
    if (this.running) {
      this.running.abort.abort()
      await this.running.promise
    }
    // Import returns before peaks are cached. Wait so shutdown cannot delete files still being written.
    await Promise.allSettled(this.preparations)
  }
}
