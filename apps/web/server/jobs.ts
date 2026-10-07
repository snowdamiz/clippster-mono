import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { rename, rm, mkdir, readdir } from 'node:fs/promises'
import type { WebJob } from '@clippster/shared-types'
import type { Store, Session, StoredJob } from './store'
import type { Config } from './config'
import type { Auth } from './auth'
import { requireValue } from './errors'
import { checkStorage, projectDirectory, resetWorkDirectory } from './storage'
import { downloadSource, normalizeSource, renderClip } from './media'
import { detect } from './detection'
export class Jobs {
  private running: { job: StoredJob; abort: AbortController; promise: Promise<void> } | null = null
  private stopped = false
  private cancellations = new Set<string>()
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
      this.store.activeJobs().filter((job) => job.owner === session.owner).length < 2,
      429,
      'You can queue two jobs at a time.'
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
    requireValue(
      !(job.kind === 'detect' && job.status === 'running'),
      409,
      'AI analysis is already running. Wait for it to finish to avoid an uncertain credit charge.'
    )
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
      await checkStorage(this.store, this.config, job.owner)
      await mkdir(directory, { recursive: true })
      const work = await resetWorkDirectory(directory)
      if (job.kind === 'import') {
        project.status = 'importing'
        project.error = null
        this.store.save(project, job.owner)
        const input =
          typeof job.payload.url === 'string'
            ? await downloadSource(job.payload.url, work, this.config, signal, progress)
            : join(directory, 'upload')
        progress(60, 'Preparing browser playback…')
        const metadata = await normalizeSource(input, work, this.config, signal)
        signal.throwIfAborted()
        await rename(join(work, 'source.mp4'), join(directory, 'source.mp4'))
        Object.assign(project, metadata, { status: 'ready', sourceUrl: job.payload.url || null })
      } else if (job.kind === 'detect') {
        progress(10, 'Analyzing audio with Clippster AI…')
        const result = await detect(
          project,
          String(job.payload.prompt),
          this.auth.token(session),
          directory,
          work,
          this.config,
          signal
        )
        signal.throwIfAborted()
        requireValue(
          project.clips.length + result.clips.length <= 100,
          400,
          'Project clip limit reached. Delete some clips before detecting again.'
        )
        project.clips.push(...result.clips)
        project.words = result.words
        job.message = result.clips.length
          ? `${result.clips.length} clips found`
          : 'Analysis complete. No matching moments found. Try a different prompt.'
      } else {
        const clip = project.clips.find((clip) => clip.id === job.payload.clipId)
        requireValue(clip, 404, 'Clip not found.')
        progress(20, 'Building your clip…')
        await renderClip(project, clip, directory, work, this.config, signal)
        signal.throwIfAborted()
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
    if (this.running) {
      this.running.abort.abort()
      await this.running.promise
    }
  }
}
