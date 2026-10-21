import { createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat, open } from 'node:fs/promises'
import { resolve } from 'node:path'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { createHash } from 'node:crypto'
import { safeBase, required, sleep, iso, writeJson, HttpError } from './core.mjs'
import { enrichLead } from './discovery.mjs'

export class Clippster {
  constructor(env, http) {
    this.env = env
    this.http = http
    this.apiBase = safeBase(env.CLIPPSTER_API_URL || 'http://127.0.0.1:4000/api', 'CLIPPSTER_API_URL')
    this.webBase = safeBase(env.CLIPPSTER_WORKSPACE_URL || 'http://127.0.0.1:8090/api', 'CLIPPSTER_WORKSPACE_URL')
    this.accountOrigin = safeBase(env.CLIPPSTER_ACCOUNT_ORIGIN || 'http://localhost:5173', 'CLIPPSTER_ACCOUNT_ORIGIN')
  }
  async login() {
    this.token = this.env.CLIPPSTER_API_TOKEN
    if (!this.token) {
      const result = await this.http.json(`${this.apiBase}/auth/email/login`, {
        method: 'POST',
        body: {
          email: required(this.env, 'CLIPPSTER_EMAIL'),
          password: required(this.env, 'CLIPPSTER_PASSWORD')
        }
      })
      if (!result.token) throw new Error('Clippster login needs a verified account or CLIPPSTER_API_TOKEN.')
      this.token = result.token
    }
    const response = await this.http.request(`${this.webBase}/auth/session`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, Origin: this.accountOrigin }
    })
    this.cookie = response.headers
      .getSetCookie()
      .map((c) => c.split(';')[0])
      .join('; ')
    if (!this.cookie) throw new Error('Workspace did not establish a session. Check its URL and ACCOUNT_ORIGIN.')
    const result = await response.json()
    if (!result.user?.id) throw new Error('Workspace did not identify the signed-in user.')
    this.ownerId = String(result.user.id)
  }
  web(path, method = 'GET', body) {
    return this.http.json(`${this.webBase}/web${path}`, {
      method,
      body,
      headers: { Cookie: this.cookie, Origin: this.accountOrigin }
    })
  }
  get(projectId) {
    return this.web(`/projects/${encodeURIComponent(projectId)}`)
  }
  async download(projectId, clipId, destination) {
    const response = await this.http.request(
      `${this.webBase}/web/projects/${encodeURIComponent(projectId)}/clips/${encodeURIComponent(clipId)}/download`,
      { headers: { Cookie: this.cookie }, timeoutMs: 600000 }
    )
    if (!response.headers.get('content-type')?.includes('video/mp4'))
      throw new Error('Clip download did not return an MP4.')
    await mkdir(resolve(destination, '..'), { recursive: true, mode: 0o700 })
    const temp = `${destination}.part`
    let bytes = 0
    const hash = createHash('sha256')
    try {
      await pipeline(
        Readable.fromWeb(response.body),
        new Transform({
          transform(chunk, _encoding, callback) {
            bytes += chunk.length
            hash.update(chunk)
            callback(bytes > 2 * 1024 ** 3 ? new Error('Clip exceeds 2 GB download limit.') : null, chunk)
          }
        }),
        createWriteStream(temp, { mode: 0o600 })
      )
      if (bytes < 12) throw new Error('Clip download is empty or invalid.')
      const expected = response.headers.get('content-length')
      if (expected && bytes !== Number(expected)) throw new Error('Clip download is incomplete.')
      const file = await open(temp, 'r')
      try {
        await file.sync()
      } finally {
        await file.close()
      }
      await rename(temp, destination)
      return { bytes, sha256: hash.digest('hex') }
    } finally {
      await rm(temp, { force: true })
    }
  }
}

function recordingDate(value) {
  // yt-dlp supplies YYYYMMDD or Unix seconds; Kick supplies an ISO timestamp.
  if (/^\d{8}$/.test(String(value))) {
    const day = String(value)
    return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6, 8)}`
  }
  if (typeof value === 'number') return Number.isFinite(value) ? iso(value * 1000) : null
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : null
}

export async function findVod(lead, config, client) {
  // Reuse the web workspace's actual recording-browser route for both platforms.
  // It delegates to Clippster's yt-dlp / Kick archive resolver, without provider credentials.
  const result = await client.web(
    `/account/media/vods?${new URLSearchParams({
      platform: lead.platform,
      channel: lead.login,
      limit: String(config.vodsToCheck),
      offset: '0',
      tab: 'streams'
    })}`
  )
  if (!Array.isArray(result.vods)) throw new Error('Clippster returned an invalid recording list.')
  const vods = result.vods
    .filter((v) => !v.isLive && !v.is_live)
    .map((v) => ({
      id: v.id,
      url: v.url,
      title: v.title,
      duration: Number(v.duration_seconds),
      createdAt: recordingDate(v.upload_date)
    }))
  return (
    vods
      .filter((v) => {
        let url
        try {
          url = new URL(v.url)
        } catch {
          return false
        }
        const host = url.hostname.replace(/^www\./, '')
        const validUrl =
          url.protocol === 'https:' &&
          !url.username &&
          !url.password &&
          (lead.platform === 'twitch'
            ? host === 'twitch.tv' && /^\/videos\/\d+/.test(url.pathname)
            : host === 'kick.com' && /^\/[^/]+\/videos\//.test(url.pathname))
        // A currently live broadcast may already appear in its archive listing. The import service checks again.
        const liveStart = Date.parse(lead.liveStartedAt)
        // Day-only timestamps cannot distinguish completed and active broadcasts on that day.
        const cutoff =
          Number.isFinite(liveStart) && v.createdAt?.length === 10
            ? Date.parse(iso(liveStart).slice(0, 10))
            : liveStart - 60000
        const current = Date.parse(v.createdAt) >= cutoff
        return validUrl && !current && v.duration >= config.minClipSeconds && v.duration <= config.maxSourceSeconds
      })
      .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0))[0] || null
  )
}

export function clipDuration(clip) {
  return (clip.segments || []).reduce((total, segment) => total + segment.end_time - segment.start_time, 0)
}

// Persist the intent before a billed/non-idempotent operation. Reconcile against server job IDs on resume.
export async function ensureJob(context, lead, key, kind, submit) {
  const { client, save, config, log, wait = sleep } = context
  lead.operations ||= {}
  let operation = lead.operations[key]
  let workspace = await client.get(lead.projectId)
  if (!operation) {
    operation = lead.operations[key] = { previousIds: workspace.jobs.map((j) => j.id), intentAt: iso(Date.now()) }
    await save()
    try {
      const job = await submit()
      if (!job?.id) throw new Error('Server did not return a job ID; inspect the workspace before retrying.')
      operation.jobId = job.id
      await save()
    } catch (error) {
      operation.error = context.http.redact(error.message)
      operation.rejected = error instanceof HttpError && [400, 401, 403, 404, 409, 422, 429].includes(error.status)
      await save()
      throw error
    }
  } else if (!operation.jobId) {
    const matches = workspace.jobs.filter((j) => j.kind === kind && !operation.previousIds.includes(j.id))
    if (matches.length !== 1)
      throw new Error(
        `${key}: previous submission is unconfirmed. Check the workspace, then use retry --lead ${lead.id} if it did not run.`
      )
    operation.jobId = matches[0].id
    await save()
  }
  const deadline = Date.now() + config.jobTimeoutMinutes * 60000
  let previousProgress = ''
  while (Date.now() < deadline) {
    workspace = await client.get(lead.projectId)
    const job = workspace.jobs.find((j) => j.id === operation.jobId)
    if (!job) throw new Error(`${key}: saved job is missing. Inspect the workspace before retrying.`)
    if (job.status === 'completed') {
      operation.completed = true
      await save()
      return workspace
    }
    if (['failed', 'cancelled'].includes(job.status)) {
      operation.failed = true
      await save()
      throw new Error(`${kind}: ${job.message || job.status}. Use retry --lead ${lead.id} after resolving the cause.`)
    }
    const progress = `${job.status}:${Math.floor((job.progress || 0) / 10)}`
    if (progress !== previousProgress) {
      log(`${lead.id} — ${kind}: ${job.message || job.status} (${job.progress || 0}%)`)
      previousProgress = progress
    }
    await wait(config.pollSeconds * 1000)
  }
  throw new Error(
    `${key}: still running after ${config.jobTimeoutMinutes} minutes. Resume this campaign to continue waiting.`
  )
}

async function createProject(context, lead) {
  const { client, state, save } = context
  if (lead.projectId) return
  lead.projectName ||= `Outreach ${state.runId.slice(0, 8)} ${lead.id}`
  if (lead.createPending) {
    const { projects } = await client.web('/projects')
    const matches = projects.filter((p) => p.name === lead.projectName)
    if (matches.length !== 1)
      throw new Error(`Project creation is unconfirmed. Inspect the workspace, then retry --lead ${lead.id}.`)
    lead.projectId = matches[0].id
  } else {
    lead.createPending = true
    await save()
    const result = await client.web('/projects', 'POST', { name: lead.projectName })
    lead.projectId = result.project.id
  }
  lead.createPending = false
  await save()
}

export async function verifyArtifacts(lead, directory) {
  if (!lead.artifacts?.length) throw new Error('No completed clip files to archive.')
  for (const artifact of lead.artifacts) {
    const path = resolve(directory, artifact.file)
    const info = await stat(path)
    if (info.size !== artifact.bytes) throw new Error(`Saved clip changed or is incomplete: ${artifact.file}`)
    // Clips are bounded, but stream the hash to keep memory independent of batch size.
    const hash = createHash('sha256')
    const file = await open(path, 'r')
    try {
      for await (const chunk of file.createReadStream({ autoClose: false })) hash.update(chunk)
    } finally {
      await file.close()
    }
    if (hash.digest('hex') !== artifact.sha256) throw new Error(`Saved clip checksum mismatch: ${artifact.file}`)
  }
}

export async function archiveProject(context, lead) {
  try {
    await verifyArtifacts(lead, context.config.outputDir)
  } catch (error) {
    lead.status = 'artifact_error'
    await context.save()
    throw error
  }
  if (lead.status === 'artifact_error') lead.status = 'ready_for_review'
  if (!context.config.archiveCompletedProjects || lead.archivedAt) {
    lead.error = null
    await context.save()
    return
  }
  // Only the project created and recorded by this campaign is eligible for deletion.
  try {
    const { project } = await context.client.get(lead.projectId)
    if (project.name !== lead.projectName)
      throw new Error('Temporary project was renamed; archive it manually or restore its name.')
    await context.client.web(`/projects/${lead.projectId}`, 'DELETE')
  } catch (error) {
    if (!(error instanceof HttpError && error.status === 404)) throw error
  }
  lead.archivedAt = iso(Date.now())
  lead.error = null
  await context.save()
}

export async function processLead(context, lead) {
  const { client, providers, config, save } = context
  if (['ready_for_review', 'artifact_error'].includes(lead.status)) {
    await archiveProject(context, lead)
    return
  }
  if (lead.status === 'skipped_no_vod') return
  if (!lead.vod) {
    // X prospects use the same anonymous profile lookup as the desktop app.
    await enrichLead(lead, providers)
    lead.vod = await findVod(lead, config, client)
    if (!lead.vod) {
      lead.status = 'skipped_no_vod'
      lead.error = 'No eligible completed public recording found within the configured duration limit.'
      await save()
      return
    }
    await save()
  }
  await createProject(context, lead)
  lead.status = 'processing'
  lead.error = null
  await save()
  let workspace = await client.get(lead.projectId)
  if (workspace.project.status !== 'ready') {
    workspace = await ensureJob(context, lead, 'import', 'import', () =>
      client.web(`/projects/${lead.projectId}/import`, 'POST', { url: lead.vod.url })
    )
  }
  if (!lead.selectedClipIds) {
    const prompt = `Find ${config.clipsPerStreamer} strong, self-contained highlights, each ${config.minClipSeconds}-${config.maxClipSeconds} seconds long. Favor entertaining reactions, clear stories, surprising moments, and useful insights. Keep the setup and payoff, avoid dead air and overlapping highlights. Return only moments supported by this recording.`
    workspace = await ensureJob(context, lead, 'detect', 'detect', () =>
      client.web(`/projects/${lead.projectId}/detect`, 'POST', { prompt })
    )
    const clips = workspace.project.clips
      .filter((c) => clipDuration(c) >= config.minClipSeconds && clipDuration(c) <= config.maxClipSeconds)
      .slice(0, config.clipsPerStreamer)
    if (!clips.length)
      throw new Error(
        'AI found no clips within the configured length limits. Review the project before retrying detection.'
      )
    lead.selectedClipIds = clips.map((c) => c.id)
    await save()
  }
  lead.artifacts ||= []
  for (const [index, clipId] of lead.selectedClipIds.entries()) {
    if (lead.artifacts.some((a) => a.clipId === clipId)) continue
    workspace = await client.get(lead.projectId)
    let clip = workspace.project.clips.find((c) => c.id === clipId)
    if (!clip) throw new Error(`Selected clip ${clipId} was removed. Review the project.`)
    const captions = config.captions && workspace.project.words.length > 0
    if (clip.aspectRatio !== config.aspectRatio || clip.captions !== captions) {
      workspace = await client.web(`/projects/${lead.projectId}/clips/${clipId}`, 'PUT', {
        ...clip,
        aspectRatio: config.aspectRatio,
        captions
      })
      clip = workspace.project.clips.find((c) => c.id === clipId)
    }
    if (clip.builtRevision !== clip.revision) {
      workspace = await ensureJob(context, lead, `build:${clipId}:${clip.revision}`, 'build', () =>
        client.web(`/projects/${lead.projectId}/clips/${clipId}/build`, 'POST')
      )
      clip = workspace.project.clips.find((c) => c.id === clipId)
    }
    const file = `clips/${lead.platform}-${lead.login}/clip-${String(index + 1).padStart(2, '0')}.mp4`
    const integrity = await client.download(lead.projectId, clipId, resolve(config.outputDir, file))
    lead.artifacts.push({ clipId, name: clip.name, file, ...integrity })
    await save()
  }
  // Save edit metadata before releasing the full-size source and temporary project.
  workspace = await client.get(lead.projectId)
  await writeJson(resolve(config.outputDir, `clips/${lead.platform}-${lead.login}/project.json`), workspace.project)
  lead.status = 'ready_for_review'
  lead.error = null
  await save()
  await archiveProject(context, lead)
}

export async function bindCampaign(context) {
  const { state, client, save } = context
  await client.login()
  const binding = { owner: client.ownerId, workspace: client.webBase, api: client.apiBase }
  if (state.binding && JSON.stringify(state.binding) !== JSON.stringify(binding))
    throw new Error(
      'This campaign belongs to a different Clippster account or server. Use its original settings or a new outputDir.'
    )
  state.binding = binding
  await save()
}

export async function processCampaign(context) {
  const { state, config, save, log, http } = context
  await bindCampaign(context)
  state.selectionLocked = true
  await save()
  for (const id of state.selected || []) {
    const lead = state.leads[id]
    log(`Processing ${id} (${(state.selected || []).indexOf(id) + 1}/${state.selected.length})`)
    try {
      await processLead(context, lead)
    } catch (error) {
      lead.error = http.redact(error.message)
      if (!['ready_for_review', 'artifact_error'].includes(lead.status)) lead.status = 'error'
      await save()
      log(`${id}: ${lead.error}`)
      if (error instanceof HttpError && [401, 403, 429].includes(error.status)) throw error
    }
  }
  log(
    `Batch finished: ${Object.values(state.leads).filter((l) => l.status === 'ready_for_review').length} streamers have clips ready for review (target ${config.targetStreamers}).`
  )
}

export async function resetFailedLead(context, id) {
  const lead = context.state.leads[id]
  if (!lead) throw new Error(`Unknown lead: ${id}`)
  if (['ready_for_review', 'artifact_error'].includes(lead.status))
    throw new Error(
      'This lead already has finished clips. Resolve its reported cleanup/file issue instead of resetting it.'
    )
  if (lead.projectId) {
    const workspace = await context.client.get(lead.projectId)
    if (workspace.jobs.some((j) => ['running', 'queued'].includes(j.status)))
      throw new Error('This project still has an active job; resume it instead.')
    for (const [key, operation] of Object.entries(lead.operations || {})) {
      const job = workspace.jobs.find((j) => j.id === operation.jobId)
      if (!operation.completed && job?.status !== 'completed') delete lead.operations[key]
    }
    // A successful detection with no suitable clips needs an explicit new detection attempt.
    if (!lead.selectedClipIds) delete lead.operations?.detect
  } else if (lead.createPending) {
    const { projects } = await context.client.web('/projects')
    if (projects.some((p) => p.name === lead.projectName))
      throw new Error('The project exists; run clips to reconcile it instead.')
    lead.createPending = false
  }
  lead.error = null
  lead.status = 'discovered'
  await context.save()
}
