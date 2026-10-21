import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { validateConfig, createHttp, loadState, writeJson, withLock, safeBase } from './core.mjs'
import { channelFromUrl, addXPage, discoverX, discoverStreams, selectLeads, Providers } from './discovery.mjs'
import { twitchDuration, findVod, ensureJob, verifyArtifacts } from './clippster.mjs'
import { writeReport } from './report.mjs'

const quiet = () => {}
const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...headers } })
async function temporary(t) {
  const path = await mkdtemp(resolve(tmpdir(), 'streamer-test-'))
  t.after(() => rm(path, { recursive: true, force: true }))
  return path
}

test('configuration rejects invalid batches, unsupported crop, and typoed settings', () => {
  assert.equal(validateConfig().targetStreamers, 150)
  for (const value of [
    { targetStreamers: 201 },
    { clipsPerStreamer: 4 },
    { minViewers: 10, maxViewers: 5 },
    { captions: 'false' },
    { sources: ['twitter'] },
    { aspectRatio: '1:1' },
    { xDays: 0 },
    { clipCount: 3 }
  ])
    assert.throws(() => validateConfig(value))
  assert.throws(() => safeBase('http://example.com/api', 'API'))
  assert.throws(() => safeBase('https://key:secret@example.com', 'API'))
  assert.equal(safeBase('http://localhost:8090/api/', 'API'), 'http://localhost:8090/api')
})

test('HTTP reads retry rate limits; mutations are never replayed and credentials are redacted', async () => {
  let calls = 0
  const waits = []
  const http = createHttp({
    fetchImpl: async () => (++calls === 1 ? json({ error: 'wait' }, 429, { 'retry-after': '2' }) : json({ ok: true })),
    wait: async (delay) => waits.push(delay),
    log: quiet
  })
  assert.deepEqual(await http.json('https://api.example.com/records'), { ok: true })
  assert.equal(calls, 2)
  assert.deepEqual(waits, [2000])
  calls = 0
  const mutation = createHttp({
    fetchImpl: async () => {
      calls++
      return json({ error: 'secret-value' }, 503)
    },
    secrets: ['secret-value']
  })
  await assert.rejects(mutation.json('https://api.example.com/jobs', { method: 'POST', body: {} }), /redacted/)
  assert.equal(calls, 1)
})

test('very long API cooldowns stop instead of retrying early', async () => {
  let calls = 0
  const http = createHttp({
    fetchImpl: async () => {
      calls++
      return json({}, 429, { 'retry-after': '900' })
    },
    wait: async () => assert.fail('must not sleep')
  })
  await assert.rejects(http.json('https://api.example.com/records'), /429/)
  assert.equal(calls, 1)
})

test('only actual channel URLs are accepted; post links do not identify their authors', () => {
  assert.deepEqual(channelFromUrl('https://www.twitch.tv/Creator/videos'), {
    platform: 'twitch',
    login: 'creator',
    channelUrl: 'https://www.twitch.tv/creator'
  })
  for (const url of [
    'https://twitch.tv.evil.test/creator',
    'https://twitch.tv/videos/123',
    'https://kick.com/categories',
    'https://clips.twitch.tv/someclip',
    'https://kick.com/a/unknown'
  ])
    assert.equal(channelFromUrl(url), null)
  const state = { leads: {}, posts: {} }
  addXPage(state, {
    data: [
      { id: '1', author_id: 'a', text: 'Looking for clippers https://kick.com/someoneelse' },
      { id: '2', author_id: 'b', text: 'Need a clipper https://t.co/short' }
    ],
    includes: {
      users: [
        { id: 'a', username: 'recruiter', description: 'Hiring manager' },
        {
          id: 'b',
          username: 'creator_x',
          description: 'Streamer. business@example.com',
          entities: { url: { urls: [{ expanded_url: 'https://twitch.tv/creator' }] } }
        }
      ]
    }
  })
  assert.equal(state.posts['1'].channelStatus, 'post_mentions_only_review')
  assert.equal(state.leads['kick:someoneelse'], undefined)
  assert.equal(state.leads['twitch:creator'].contacts[0].value, 'business@example.com')
  assert.equal(state.leads['twitch:creator'].contacts[1].value, 'creator_x')
  assert.equal(state.leads['twitch:creator'].viewerCount, undefined)
})

test('X full-archive search preserves its date window and resumes its cursor after a failed page', async () => {
  const config = validateConfig({ xPageLimit: 3 })
  const state = {
    leads: {},
    posts: {},
    discovery: {},
    xWindow: { start: '2026-08-21T00:00:00.000Z', end: '2026-10-20T00:00:00.000Z' }
  }
  let fail = true
  const calls = []
  const providers = {
    get: async (platform, path, pairs) => {
      const p = new URLSearchParams(pairs)
      calls.push(p)
      assert.equal(platform, 'x')
      assert.equal(path, '/tweets/search/all')
      assert.equal(p.get('start_time'), state.xWindow.start)
      if (!p.has('next_token')) return { data: [{ id: '1', text: 'Need clippers' }], meta: { next_token: 'page2' } }
      if (fail) throw new Error('temporary')
      return { data: [{ id: '2', text: 'Looking for clippers' }], meta: {} }
    }
  }
  const context = { state, config, providers, save: async () => {}, log: quiet }
  await assert.rejects(discoverX(context), /temporary/)
  assert.equal(state.discovery.x.cursor, 'page2')
  fail = false
  await discoverX(context)
  assert.equal(calls[2].get('next_token'), 'page2')
  assert.equal(Object.keys(state.posts).length, 2)
  assert.equal(state.discovery.x.done, true)
})

test('X page budget reports truncation and never silently falls back to seven days', async () => {
  const state = { leads: {}, posts: {}, discovery: {}, xWindow: {} }
  await discoverX({
    state,
    config: validateConfig({ xPageLimit: 1 }),
    save: async () => {},
    log: quiet,
    providers: {
      get: async (_platform, path) => {
        assert.equal(path, '/tweets/search/all')
        return { meta: { next_token: 'more' } }
      }
    }
  })
  assert.equal(state.discovery.x.truncated, true)
  assert.equal(state.discovery.x.done, false)
})

test('Twitch pagination reaches small channels and deduplicates fluctuating listings', async () => {
  const state = { leads: {}, discovery: {} }
  let page = 0
  const stream = (name, viewers) => ({ user_login: name, user_id: name, user_name: name, viewer_count: viewers })
  await discoverStreams(
    {
      state,
      config: validateConfig({ targetStreamers: 3 }),
      save: async () => {},
      log: quiet,
      providers: {
        get: async (_p, path, pairs) => {
          assert.equal(path, '/streams')
          assert.equal(new URLSearchParams(pairs).get('first'), '100')
          return ++page === 1
            ? { data: [stream('large', 5000), stream('small', 25)], pagination: { cursor: 'next' } }
            : { data: [stream('small', 24), stream('tiny', 5), stream('zero', 0)], pagination: {} }
        }
      }
    },
    'twitch'
  )
  assert.equal(Object.keys(state.leads).length, 2)
  assert.equal(state.leads['twitch:small'].viewerCount, 24)
  assert.equal(page, 2)
})

test('Kick uses the current paginated v2 endpoint and channel.slug', async () => {
  const state = { leads: {}, discovery: {} }
  let page = 0
  await discoverStreams(
    {
      state,
      config: validateConfig(),
      save: async () => {},
      log: quiet,
      providers: {
        get: async (_p, path, pairs) => {
          assert.equal(path, '/v2/livestreams')
          const params = new URLSearchParams(pairs)
          assert.equal(params.get('language_code'), 'en')
          assert.equal(params.get('limit'), '1000')
          if (++page === 2) assert.equal(params.get('cursor'), 'next')
          return {
            data: [
              {
                channel: { slug: 'kick_creator' },
                broadcaster_user: { id: 123, username: 'KickCreator' },
                viewer_count: 15
              }
            ],
            pagination: { next_cursor: page === 1 ? 'next' : '' }
          }
        }
      }
    },
    'kick'
  )
  assert.equal(Object.keys(state.leads).length, 1)
  assert.equal(state.leads['kick:kick_creator'].broadcasterId, '123')
})

test('selection is deterministic, capped, and prioritizes explicit clipper requests', () => {
  const state = {
    leads: Object.fromEntries(
      Array.from({ length: 220 }, (_, i) => [
        `twitch:c${i}`,
        { id: `twitch:c${i}`, viewerCount: 20, wantsClippers: i === 219 }
      ])
    )
  }
  const ids = selectLeads(state, validateConfig())
  assert.equal(ids.length, 150)
  assert.equal(ids[0], 'twitch:c219')
})

test('provider credentials are kept out of URLs and Kick tokens use form encoding', async () => {
  const calls = []
  const http = createHttp({
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return url.includes('/oauth/token')
        ? json({ access_token: 'generated-token', expires_in: 3600 })
        : json({ data: [] })
    }
  })
  const p = new Providers({ KICK_CLIENT_ID: 'client', KICK_CLIENT_SECRET: 'secret' }, http)
  await p.get('kick', '/v2/livestreams')
  await p.get('kick', '/v2/livestreams')
  assert.equal(calls.length, 3)
  assert.equal(calls[0].init.body, 'grant_type=client_credentials&client_id=client&client_secret=secret')
  assert.equal(calls[1].init.headers.Authorization, 'Bearer generated-token')
  assert.ok(!calls[0].url.includes('secret'))
})

test('VOD selection excludes a live archive, oversized recordings, and malicious URLs', async () => {
  assert.equal(twitchDuration('2h3m4s'), 7384)
  const lead = { platform: 'twitch', broadcasterId: '123', liveStartedAt: '2026-10-20T20:00:00Z' }
  const vod = await findVod(lead, validateConfig(), {
    get: async () => ({
      data: [
        { id: '1', url: 'https://www.twitch.tv/videos/1', duration: '1h', created_at: '2026-10-20T20:00:00Z' },
        { id: '2', url: 'https://www.twitch.tv/videos/2', duration: '5h', created_at: '2026-10-19T20:00:00Z' },
        { id: '3', url: 'https://evil.test/secret', duration: '30m', created_at: '2026-10-18T20:00:00Z' },
        { id: '4', url: 'https://www.twitch.tv/videos/4', duration: '45m', created_at: '2026-10-17T20:00:00Z' }
      ]
    })
  })
  assert.equal(vod.id, '4')
})

test('lost mutation responses reconcile by server job ID and never repeat detection', async () => {
  const lead = { id: 'twitch:creator', projectId: 'p1' }
  let jobs = []
  let submissions = 0
  const context = {
    client: { get: async () => ({ jobs }) },
    save: async () => {},
    config: validateConfig(),
    http: createHttp(),
    log: quiet,
    wait: async () => {}
  }
  const submit = async () => {
    submissions++
    jobs = [{ id: 'job1', kind: 'detect', status: 'completed' }]
    throw new Error('connection lost')
  }
  await assert.rejects(ensureJob(context, lead, 'detect', 'detect', submit), /connection lost/)
  await ensureJob(context, lead, 'detect', 'detect', submit)
  assert.equal(submissions, 1)
  assert.equal(lead.operations.detect.completed, true)
})

test('an ambiguous mutation with no corresponding server job is not silently replayed', async () => {
  const lead = { id: 'twitch:creator', projectId: 'p1', operations: { detect: { previousIds: [] } } }
  await assert.rejects(
    ensureJob({ client: { get: async () => ({ jobs: [] }) }, config: validateConfig() }, lead, 'detect', 'detect', () =>
      assert.fail('must not submit')
    ),
    /unconfirmed/
  )
})

test('campaign state freezes settings and lock prevents concurrent batches', async (t) => {
  const directory = await temporary(t)
  const config = validateConfig()
  const state = await loadState(directory, config)
  await writeJson(resolve(directory, 'state.json'), state)
  assert.equal((await loadState(directory, config)).runId, state.runId)
  await assert.rejects(loadState(directory, validateConfig({ clipsPerStreamer: 1 })), /Config changed/)
  await withLock(directory, async () => {
    await assert.rejects(
      withLock(directory, () => {}),
      /locked/
    )
  })
  await withLock(directory, async () => {})
})

test('corrupted downloaded files cannot be treated as safely archived', async (t) => {
  const directory = await temporary(t)
  await writeFile(resolve(directory, 'clip.mp4'), 'corrupt')
  await assert.rejects(
    verifyArtifacts({ artifacts: [{ file: 'clip.mp4', bytes: 7, sha256: 'bad' }] }, directory),
    /checksum mismatch/
  )
})

test('review report escapes remote content, preserves unresolved X evidence, and emits drafts only', async (t) => {
  const directory = await temporary(t)
  const config = validateConfig()
  const state = await loadState(directory, config)
  state.leads['twitch:creator'] = {
    id: 'twitch:creator',
    platform: 'twitch',
    login: 'creator',
    name: '<img src=x onerror=alert(1)>',
    channelUrl: 'https://twitch.tv/creator',
    contacts: [],
    evidence: [],
    status: 'ready_for_review',
    artifacts: [{ file: 'clips/test.mp4', name: 'Highlight' }]
  }
  state.posts['1'] = {
    id: '1',
    text: '</script><script>alert(1)</script>',
    url: 'https://x.com/i/status/1',
    author: { id: 'a' },
    channelStatus: 'unresolved',
    mentionedChannels: []
  }
  await writeReport(state, directory)
  const html = await readFile(resolve(directory, 'review.html'), 'utf8')
  assert.ok(!html.includes('<img src=x'))
  assert.ok(html.includes('&lt;img'))
  assert.ok(!html.includes('</script><script>alert'))
  const drafts = JSON.parse(await readFile(resolve(directory, 'drafts.json'), 'utf8'))
  assert.equal(drafts[0].status, 'draft_only')
  assert.deepEqual(drafts[0].email.toCandidates, [])
  assert.equal(drafts[0].email.attachments[0], 'clips/test.mp4')
})
