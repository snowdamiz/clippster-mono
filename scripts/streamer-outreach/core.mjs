import { readFile, rename, mkdir, open, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { parseEnv } from 'node:util'
import { randomUUID } from 'node:crypto'

export const DEFAULTS = {
  sources: ['twitch', 'kick', 'x'],
  targetStreamers: 150,
  minViewers: 5,
  maxViewers: 100,
  languages: ['en'],
  twitchGameIds: [],
  kickCategoryIds: [],
  streamPageLimit: 300,
  xDays: 60,
  xPageLimit: 100,
  xQuery:
    '("looking for clippers" OR "looking for a clipper" OR "need clippers" OR "need a clipper" OR "hiring clippers" OR "hiring a clipper") -is:retweet',
  clipsPerStreamer: 3,
  minClipSeconds: 15,
  maxClipSeconds: 90,
  maxSourceSeconds: 7200,
  vodsToCheck: 20,
  aspectRatio: '9:16',
  captions: true,
  archiveCompletedProjects: true,
  pollSeconds: 10,
  jobTimeoutMinutes: 120,
  outputDir: './output'
}

export function validateConfig(input = {}) {
  for (const key of Object.keys(input)) {
    if (!(key in DEFAULTS)) throw new Error(`Unknown config setting: ${key}`)
  }
  const c = { ...DEFAULTS, ...input }
  for (const [key, min, max] of [
    ['targetStreamers', 1, 200],
    ['minViewers', 0, 100000],
    ['maxViewers', 0, 100000],
    ['streamPageLimit', 1, 10000],
    ['xDays', 1, 3650],
    ['xPageLimit', 1, 10000],
    ['clipsPerStreamer', 1, 3],
    ['minClipSeconds', 1, 600],
    ['maxClipSeconds', 1, 600],
    ['maxSourceSeconds', 1, 7200],
    ['vodsToCheck', 1, 50],
    ['pollSeconds', 2, 60],
    ['jobTimeoutMinutes', 1, 1440]
  ]) {
    if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max)
      throw new Error(`${key} must be an integer between ${min} and ${max}.`)
  }
  if (c.minViewers > c.maxViewers || c.minClipSeconds > c.maxClipSeconds)
    throw new Error('Minimums must not exceed maximums.')
  if (!Array.isArray(c.sources) || !c.sources.length || c.sources.some((s) => !['twitch', 'kick', 'x'].includes(s)))
    throw new Error('sources must contain twitch, kick, and/or x.')
  for (const key of ['languages', 'twitchGameIds', 'kickCategoryIds']) {
    if (!Array.isArray(c[key]) || c[key].some((v) => typeof v !== 'string' || !v.trim()))
      throw new Error(`${key} must be an array of nonempty strings.`)
  }
  if (c.languages.length > 25 || c.kickCategoryIds.length > 25 || c.twitchGameIds.length > 100)
    throw new Error('Too many language/category filters for the provider API.')
  if (typeof c.xQuery !== 'string' || !c.xQuery.trim() || c.xQuery.length > (c.xDays > 7 ? 1024 : 512))
    throw new Error('xQuery is empty or exceeds the X endpoint query limit.')
  for (const key of ['captions', 'archiveCompletedProjects'])
    if (typeof c[key] !== 'boolean') throw new Error(`${key} must be a boolean.`)
  if (!['9:16', '16:9'].includes(c.aspectRatio))
    throw new Error('aspectRatio must be 9:16 or 16:9 (supported by the web workspace).')
  if (typeof c.outputDir !== 'string' || !c.outputDir.trim()) throw new Error('outputDir is required.')
  return c
}

export async function loadSettings(directory, configPath, envPath) {
  let fileEnv = {}
  try {
    fileEnv = parseEnv(await readFile(envPath || resolve(directory, '.env'), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT' || envPath) throw error
  }
  const env = { ...fileEnv, ...process.env }
  let input = {}
  try {
    input = JSON.parse(await readFile(configPath || resolve(directory, 'config.json'), 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT' || configPath) throw error
  }
  const config = validateConfig(input)
  config.outputDir = resolve(configPath ? dirname(resolve(configPath)) : directory, config.outputDir)
  return { config, env }
}

export function required(env, name) {
  if (!env[name]?.trim()) throw new Error(`Set ${name} in scripts/streamer-outreach/.env.`)
  return env[name].trim()
}

export function safeBase(value, label) {
  const url = new URL(value)
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))
  )
    throw new Error(
      `${label} must use HTTPS (HTTP is allowed for localhost), without embedded credentials or query parameters.`
    )
  return url.href.replace(/\/$/, '')
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
export const iso = (value) => new Date(value).toISOString()
export const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )

export class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// Bound every request and retry reads only. Mutations can have succeeded even if their response was lost.
export function createHttp({ fetchImpl = fetch, wait = sleep, log = console.log, secrets = [] } = {}) {
  const redact = (value) =>
    secrets
      .filter((s) => typeof s === 'string' && s.length >= 4)
      .reduce((text, secret) => text.split(secret).join('[redacted]'), String(value))
  async function request(url, options = {}) {
    const { timeoutMs = 120000, ...init } = options
    const method = init.method || 'GET'
    const attempts = method === 'GET' ? 4 : 1
    for (let attempt = 0; attempt < attempts; attempt++) {
      let response
      try {
        response = await fetchImpl(url, { ...init, redirect: 'error', signal: AbortSignal.timeout(timeoutMs) })
      } catch {
        if (attempt + 1 < attempts) {
          await wait(1000 * 2 ** attempt)
          continue
        }
        throw new Error(
          `${method} ${new URL(url).hostname}: connection failed or timed out${method !== 'GET' ? '; outcome may be unknown' : ''}.`
        )
      }
      if (response.ok) return response
      const text = (await response.text()).slice(0, 1000)
      if ((response.status === 429 || response.status >= 500) && attempt + 1 < attempts) {
        const retry = response.headers.get('retry-after')
        const reset = Number(response.headers.get('x-rate-limit-reset') || response.headers.get('ratelimit-reset'))
        const delay = retry
          ? Number.isFinite(Number(retry))
            ? Number(retry) * 1000
            : Date.parse(retry) - Date.now()
          : reset
            ? reset * 1000 - Date.now()
            : 1000 * 2 ** attempt
        if (delay <= 60000 && Number.isFinite(delay)) {
          log(
            `${new URL(url).hostname}: HTTP ${response.status}, retrying read in ${Math.ceil(Math.max(delay, 1000) / 1000)}s.`
          )
          await wait(Math.max(delay, 1000))
          continue
        }
      }
      const hint =
        [401, 403].includes(response.status) && new URL(url).hostname === 'api.x.com'
          ? ' Check X_BEARER_TOKEN and full-archive access for the 60-day search.'
          : ''
      throw new HttpError(
        response.status,
        redact(`${method} ${new URL(url).hostname}${new URL(url).pathname}: HTTP ${response.status}. ${text}${hint}`)
      )
    }
  }
  async function json(url, options = {}) {
    const { body, headers, ...rest } = options
    const response = await request(url, {
      ...rest,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {})
    })
    if (response.status === 204) return null
    let data
    try {
      data = await response.json()
    } catch {
      throw new Error(`${new URL(url).hostname}: expected JSON response.`)
    }
    if (data?.success === false) throw new Error(redact(data.error || 'API reported failure.'))
    return data
  }
  return { request, json, redact }
}

export async function atomicWrite(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  const temp = `${path}.${randomUUID()}.tmp`
  try {
    const file = await open(temp, 'wx', 0o600)
    try {
      await file.writeFile(value)
      await file.sync()
    } finally {
      await file.close()
    }
    await rename(temp, path)
  } finally {
    await rm(temp, { force: true })
  }
}
export const writeJson = (path, value) => atomicWrite(path, JSON.stringify(value, null, 2) + '\n')

export async function loadState(directory, config) {
  try {
    const state = JSON.parse(await readFile(resolve(directory, 'state.json'), 'utf8'))
    if (state.version !== 1) throw new Error('Unsupported state version. Use a new outputDir.')
    // A resumed campaign must keep its original query, time window, and processing settings.
    if (JSON.stringify(state.config) !== JSON.stringify(config))
      throw new Error('Config changed for an existing campaign. Restore it or set a new outputDir.')
    return state
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    const end = Date.now() - 30000
    return {
      version: 1,
      runId: randomUUID(),
      config,
      createdAt: iso(Date.now()),
      xWindow: { start: iso(end - config.xDays * 86400000 + (config.xDays <= 7 ? 60000 : 0)), end: iso(end) },
      discovery: {},
      leads: {},
      posts: {},
      selected: null
    }
  }
}

export async function withLock(directory, action) {
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const path = resolve(directory, '.lock')
  let file
  try {
    file = await open(path, 'wx', 0o600)
  } catch (error) {
    if (error.code === 'EEXIST') throw new Error(`Campaign is locked. If no run is active, remove ${path} and resume.`)
    throw error
  }
  try {
    await file.writeFile(String(process.pid))
    return await action()
  } finally {
    await file.close()
    await rm(path, { force: true })
  }
}
