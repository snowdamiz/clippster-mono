import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { createHttp, validateConfig, loadState, writeJson } from './core.mjs'
import { Clippster, processCampaign, bindCampaign, resetFailedLead } from './clippster.mjs'
import { writeReport } from './report.mjs'

// A real HTTP boundary with the existing workspace request/response shapes.
// The provider, model and MP4 payload are fixtures, so this never spends credits or sends messages.
async function fixture(t, overrides = {}) {
  const directory = await mkdtemp(resolve(tmpdir(), 'outreach-workflow-'))
  const config = { ...validateConfig({ targetStreamers: 2, clipsPerStreamer: 2, ...overrides }), outputDir: directory }
  const state = await loadState(directory, config)
  const requests = []
  const counts = { create: 0, import: 0, detect: 0, build: 0, delete: 0, maxProjects: 1 }
  const projects = new Map([
    ['manual-project', { project: { id: 'manual-project', name: 'Existing user work' }, jobs: [] }]
  ])
  let sequence = 0
  let failDetection = false
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost')
      requests.push(`${req.method} ${url.pathname}`)
      const send = (value, status = 200) => {
        res.writeHead(status, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(value))
      }
      let body = ''
      for await (const chunk of req) body += chunk
      const data = body ? JSON.parse(body) : {}
      if (url.pathname === '/api/auth/email/login') {
        assert.deepEqual(data, { email: 'fixture@example.com', password: 'fixture-password' })
        return send({ success: true, token: 'fixture-token', user: { id: 42 } })
      }
      if (url.pathname === '/api/auth/session') {
        assert.equal(req.headers.authorization, 'Bearer fixture-token')
        assert.equal(req.headers.origin, 'http://localhost:5173')
        res.setHeader('Set-Cookie', 'clippster_web=fixture-cookie; Path=/; HttpOnly; SameSite=Lax')
        return send({ success: true, user: { id: 42 } })
      }
      if (url.pathname === '/api/media/vods') {
        assert.equal(req.headers.authorization, 'Bearer fixture-token')
        assert.equal(url.searchParams.get('platform'), 'kick')
        return send({
          success: true,
          vods: [
            {
              id: 'kickvod',
              url: `https://kick.com/${url.searchParams.get('channel')}/videos/abcdef`,
              duration_seconds: 300,
              upload_date: '2026-10-18T12:00:00Z'
            }
          ]
        })
      }
      assert.equal(req.headers.cookie, 'clippster_web=fixture-cookie')
      if (req.method !== 'GET') assert.equal(req.headers.origin, 'http://localhost:5173')
      if (url.pathname === '/api/web/projects') {
        if (req.method === 'GET') return send({ projects: [...projects.values()].map((w) => w.project) })
        assert.equal(req.method, 'POST')
        if (projects.size >= 20) return send({ error: '20 project limit' }, 400)
        const id = `project-${++sequence}`
        const workspace = {
          project: { id, name: data.name, status: 'empty', clips: [], words: [], hasAudio: false },
          jobs: []
        }
        projects.set(id, workspace)
        counts.create++
        counts.maxProjects = Math.max(counts.maxProjects, projects.size)
        return send(workspace, 201)
      }
      const match = url.pathname.match(/^\/api\/web\/projects\/([^/]+)(.*)$/)
      if (!match || !projects.has(match[1])) return send({ error: 'not found' }, 404)
      const workspace = projects.get(match[1])
      const project = workspace.project
      const path = match[2]
      const job = (kind, status = 'completed') => {
        const j = {
          id: `job-${++sequence}`,
          projectId: project.id,
          kind,
          status,
          progress: 100,
          message: status,
          createdAt: Date.now()
        }
        workspace.jobs.push(j)
        return j
      }
      if (!path && req.method === 'GET') return send(workspace)
      if (!path && req.method === 'DELETE') {
        assert.notEqual(project.id, 'manual-project')
        projects.delete(project.id)
        counts.delete++
        res.writeHead(204)
        return res.end()
      }
      if (path === '/import') {
        assert.equal(req.method, 'POST')
        assert.match(data.url, /^https:\/\/(?:www\.twitch\.tv|kick\.com)\//)
        Object.assign(project, {
          sourceUrl: data.url,
          status: 'ready',
          hasAudio: true,
          duration: 300,
          width: 1280,
          height: 720
        })
        counts.import++
        return send(job('import'), 202)
      }
      if (path === '/detect') {
        counts.detect++
        assert.equal(req.method, 'POST')
        assert.match(data.prompt, /self-contained highlights/)
        if (failDetection) return send(job('detect', 'failed'), 202)
        project.words = [{ word: 'Hi', start: 0, end: 1 }]
        project.clips = Array.from({ length: 4 }, (_, i) => ({
          id: `clip-${project.id}-${i}`,
          name: `Highlight ${i + 1}`,
          segments: [{ start_time: i * 30, end_time: i * 30 + 20 }],
          aspectRatio: '16:9',
          captions: false,
          revision: 1,
          builtRevision: null
        }))
        return send(job('detect'), 202)
      }
      const cm = path.match(/^\/clips\/([^/]+)(.*)$/)
      assert.ok(cm, `Unexpected route ${req.method} ${url.pathname}`)
      const clip = project.clips.find((c) => c.id === cm[1])
      assert.ok(clip)
      if (!cm[2] && req.method === 'PUT') {
        assert.equal(data.revision, clip.revision)
        Object.assign(clip, data, { revision: clip.revision + 1 })
        return send(workspace)
      }
      if (cm[2] === '/build') {
        assert.equal(req.method, 'POST')
        clip.builtRevision = clip.revision
        counts.build++
        return send(job('build'), 202)
      }
      if (cm[2] === '/download') {
        assert.equal(req.method, 'GET')
        assert.equal(clip.builtRevision, clip.revision)
        const bytes = Buffer.from('0000ftypisom-fixture-media-bytes')
        res.writeHead(200, { 'Content-Type': 'video/mp4', 'Content-Length': bytes.length })
        return res.end(bytes)
      }
      throw new Error(`Unexpected request ${req.method} ${url.pathname}`)
    } catch (error) {
      res.writeHead(500)
      res.end(error.message)
    }
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  t.after(async () => {
    server.closeAllConnections()
    await new Promise((done) => server.close(done))
    await rm(directory, { recursive: true, force: true })
  })
  const base = `http://127.0.0.1:${server.address().port}/api`
  const env = {
    CLIPPSTER_API_URL: base,
    CLIPPSTER_WORKSPACE_URL: base,
    CLIPPSTER_EMAIL: 'fixture@example.com',
    CLIPPSTER_PASSWORD: 'fixture-password'
  }
  const http = createHttp({ wait: async () => {}, log: () => {} })
  const client = new Clippster(env, http)
  const providers = {
    get: async (platform, path, pairs) => {
      const params = new URLSearchParams(pairs)
      if (path === '/users')
        return { data: [{ id: '123', description: 'Business: hello@example.com https://x.com/creator' }] }
      if (path === '/v1/channels')
        return { data: [{ broadcaster_user_id: 123, channel_description: 'Business: kick@example.com' }] }
      assert.equal(platform, 'twitch')
      assert.equal(path, '/videos')
      assert.equal(params.get('user_id'), '123')
      return {
        data: [
          {
            id: '12345',
            url: 'https://www.twitch.tv/videos/12345',
            title: 'Completed recording',
            duration: '5m',
            created_at: '2026-10-18T12:00:00Z'
          }
        ]
      }
    }
  }
  state.selected = []
  for (let i = 0; i < config.targetStreamers; i++) {
    const platform = i % 2 ? 'kick' : 'twitch'
    const login = `creator${i}`
    const id = `${platform}:${login}`
    state.selected.push(id)
    state.leads[id] = {
      id,
      platform,
      login,
      channelUrl: `https://${platform === 'twitch' ? 'twitch.tv' : 'kick.com'}/${login}`,
      status: 'discovered',
      contacts: [],
      evidence: [],
      xPostIds: [],
      viewerCount: 10
    }
  }
  const save = () => writeJson(resolve(directory, 'state.json'), state)
  const context = { state, config, env, http, client, providers, save, log: () => {}, wait: async () => {} }
  return {
    context,
    counts,
    projects,
    requests,
    directory,
    fail: (value) => {
      failDetection = value
    }
  }
}

test('HTTP workflow: both platforms -> recordings -> AI clips -> downloads -> review drafts; resume makes no duplicate jobs', async (t) => {
  const f = await fixture(t)
  await processCampaign(f.context)
  const { state } = f.context
  assert.equal(Object.values(state.leads).filter((l) => l.status === 'ready_for_review').length, 2)
  assert.equal(f.counts.detect, 2)
  assert.equal(f.counts.build, 4)
  assert.equal(f.counts.delete, 2)
  assert.equal(f.projects.size, 1)
  assert.ok(f.projects.has('manual-project'))
  await writeReport(state, f.directory)
  const drafts = JSON.parse(await readFile(resolve(f.directory, 'drafts.json'), 'utf8'))
  assert.equal(drafts.length, 2)
  assert.equal(drafts[0].email.attachments.length, 2)
  assert.equal(drafts[0].email.toCandidates[0].value, 'hello@example.com')
  const before = { ...f.counts }
  await processCampaign(f.context)
  assert.deepEqual(f.counts, before)
  assert.ok(!f.requests.some((r) => /publish|messages|send|schedule/.test(r)))
  const diskState = await readFile(resolve(f.directory, 'state.json'), 'utf8')
  assert.ok(!diskState.includes('fixture-password'))
  assert.ok(!diskState.includes('fixture-token'))
  assert.ok(!diskState.includes('fixture-cookie'))
})

test('150-streamer campaign stays under the 20-project cap and exports exactly one clip per streamer', async (t) => {
  const f = await fixture(t, { targetStreamers: 150, clipsPerStreamer: 1 })
  await processCampaign(f.context)
  assert.equal(Object.values(f.context.state.leads).filter((l) => l.status === 'ready_for_review').length, 150)
  assert.equal(f.counts.create, 150)
  assert.equal(f.counts.build, 150)
  assert.equal(f.counts.delete, 150)
  assert.equal(f.counts.maxProjects, 2)
  assert.equal(f.projects.size, 1)
})

test('keep-projects mode preserves created projects and blocks account switching on resume', async (t) => {
  const f = await fixture(t, { targetStreamers: 1, archiveCompletedProjects: false })
  await processCampaign(f.context)
  assert.equal(f.projects.size, 2)
  assert.equal(f.counts.delete, 0)
  f.context.state.binding.owner = 'another-account'
  await assert.rejects(bindCampaign(f.context), /different Clippster account/)
})

test('failed AI jobs require explicit retry and do not discard the source', async (t) => {
  const f = await fixture(t, { targetStreamers: 1 })
  f.fail(true)
  await processCampaign(f.context)
  await processCampaign(f.context)
  assert.equal(f.counts.detect, 1)
  assert.equal(f.projects.size, 2)
  const lead = f.context.state.leads['twitch:creator0']
  assert.equal(lead.status, 'error')
  f.fail(false)
  await resetFailedLead(f.context, lead.id)
  await processCampaign(f.context)
  assert.equal(f.counts.detect, 2)
  assert.equal(f.counts.import, 1)
  assert.equal(lead.status, 'ready_for_review')
})

test('missing archived output is reported instead of regenerated or marked complete', async (t) => {
  const f = await fixture(t, { targetStreamers: 1 })
  await processCampaign(f.context)
  const lead = f.context.state.leads['twitch:creator0']
  await writeFile(resolve(f.directory, lead.artifacts[0].file), 'damaged')
  await processCampaign(f.context)
  assert.match(lead.error, /changed or is incomplete/)
  assert.equal(f.counts.detect, 1)
  assert.equal(lead.status, 'artifact_error')
})
