import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { validateConfig, createHttp, loadState, writeJson, withLock, safeBase } from './core.mjs'
import { channelFromUrl, addXPage, discoverX, discoverStreams, discover, selectLeads } from './discovery.mjs'
import { Providers, STREAM_PROVIDERS } from './providers.mjs'
import { findVod, ensureJob, verifyArtifacts } from './clippster.mjs'
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
    searchX: async (path, pairs) => {
      const p = new URLSearchParams(pairs)
      calls.push(p)
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
      searchX: async (path) => {
        assert.equal(path, '/tweets/search/all')
        return { meta: { next_token: 'more' } }
      }
    }
  })
  assert.equal(state.discovery.x.truncated, true)
  assert.equal(state.discovery.x.done, false)
})

test('directory pagination filters viewer counts, languages and categories locally; deduplicates channels', async () => {
  const state = { leads: {}, discovery: {} }
  let page = 0
  const stream = (login, viewerCount, language = 'en', categoryId = 'game') => ({
    login,
    broadcasterId: login,
    name: login,
    viewerCount,
    language,
    categoryId,
    description: 'Business: hello@example.com'
  })
  await discoverStreams(
    {
      state,
      config: validateConfig({ targetStreamers: 3, twitchGameIds: ['game'] }),
      save: async () => {},
      log: quiet,
      providers: {
        listStreams: async (platform, checkpoint) => {
          assert.equal(platform, 'twitch')
          if (++page === 2) assert.equal(checkpoint.cursor, 'next')
          return page === 1
            ? { streams: [stream('large', 5000), stream('small', 25)], cursor: 'next' }
            : {
                streams: [
                  stream('small', 24),
                  stream('tiny', 5),
                  stream('zero', 0),
                  stream('spanish', 10, 'es'),
                  stream('other', 10, 'en', 'other')
                ],
                cursor: null
              }
        }
      }
    },
    'twitch'
  )
  assert.equal(Object.keys(state.leads).length, 2)
  assert.equal(state.leads['twitch:small'].viewerCount, 24)
  assert.equal(state.leads['twitch:small'].contacts[0].value, 'hello@example.com')
  assert.ok(state.leads['twitch:small'].enrichedAt)
  assert.equal(page, 2)
})

test('Kick directory cursor and snapshot version resume together after a failed page', async () => {
  const state = { leads: {}, discovery: {} }
  let fail = true
  const context = {
    state,
    config: validateConfig(),
    save: async () => {},
    log: quiet,
    providers: {
      listStreams: async (platform, checkpoint) => {
        assert.equal(platform, 'kick')
        if (checkpoint.cursor) {
          assert.equal(checkpoint.cursor, 'next')
          assert.equal(checkpoint.version, 'snapshot')
          if (fail) throw new Error('temporary failure')
        }
        return {
          streams: [
            { login: 'kick_creator', broadcasterId: '123', name: 'KickCreator', viewerCount: 15, language: 'en' }
          ],
          cursor: checkpoint.cursor ? null : 'next',
          version: 'snapshot'
        }
      }
    }
  }
  await assert.rejects(discoverStreams(context, 'kick'), /temporary failure/)
  assert.equal(state.discovery.kick.done, false)
  fail = false
  await discoverStreams(context, 'kick')
  assert.equal(Object.keys(state.leads).length, 1)
  assert.equal(state.leads['kick:kick_creator'].broadcasterId, '123')
  assert.equal(state.discovery.kick.done, true)
})

test('upgrading old OAuth checkpoints preserves selected leads and completed clip work', async () => {
  const lead = {
    id: 'twitch:creator',
    platform: 'twitch',
    status: 'ready_for_review',
    artifacts: [{ file: 'clip.mp4' }]
  }
  const state = {
    leads: { [lead.id]: lead },
    selected: [lead.id],
    selectionLocked: true,
    discovery: { twitch: { cursor: 'oauth-cursor', pages: 999, done: true }, x: { pages: 2, cursor: 'keep' } }
  }
  await discoverStreams(
    {
      state,
      config: validateConfig(),
      save: async () => {},
      log: quiet,
      providers: {
        listStreams: async (_platform, checkpoint) => {
          assert.equal(checkpoint.cursor, null)
          assert.equal(checkpoint.pages, 0)
          return { streams: [], cursor: null }
        }
      }
    },
    'twitch'
  )
  assert.equal(state.discovery.twitch.provider, STREAM_PROVIDERS.twitch)
  assert.equal(state.leads[lead.id], lead)
  assert.deepEqual(state.selected, [lead.id])
  assert.deepEqual(state.discovery.x, { pages: 2, cursor: 'keep' })
})

test('stream discovery cap is reported as incomplete coverage', async () => {
  const state = { leads: {}, discovery: {} }
  await discoverStreams(
    {
      state,
      config: validateConfig({ streamPageLimit: 1 }),
      save: async () => {},
      log: quiet,
      providers: { listStreams: async () => ({ streams: [], cursor: 'more' }) }
    },
    'kick'
  )
  assert.equal(state.discovery.kick.done, false)
  assert.equal(state.discovery.kick.truncated, true)
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

test('Twitch public directory and profile work with an empty environment and no authorization', async () => {
  const calls = []
  const p = new Providers(
    {},
    createHttp({
      fetchImpl: async (url, init) => {
        calls.push(JSON.parse(init.body).query)
        assert.equal(url, 'https://gql.twitch.tv/gql')
        assert.equal(init.headers.Authorization, undefined)
        assert.equal(init.headers['Client-Id'], 'kimne78kx3ncx6brgo4mv6wki5h1ko')
        if (calls.at(-1).includes('user(login:'))
          return json({ data: { user: { id: '1', description: 'Public bio' } } })
        assert.match(calls.at(-1), /first: 30/)
        return json({
          data: {
            streams: {
              edges: [
                {
                  cursor: 'next',
                  node: {
                    id: 'stream',
                    viewersCount: 15,
                    language: 'EN',
                    createdAt: '2026-10-20T12:00:00Z',
                    broadcaster: { id: '1', login: 'creator', displayName: 'Creator', description: 'Public bio' },
                    game: { id: 'game', name: 'Game' }
                  }
                }
              ],
              pageInfo: { hasNextPage: calls.length === 1 }
            }
          }
        })
      }
    })
  )
  const first = await p.listStreams('twitch')
  assert.equal(first.streams[0].viewerCount, 15)
  assert.equal(first.streams[0].language, 'en')
  const next = await p.listStreams('twitch', first)
  assert.match(calls[1], /after: "next"/)
  assert.equal(next.cursor, null)
  assert.deepEqual(await p.profile('twitch', 'creator'), { broadcasterId: '1', description: 'Public bio' })
})

test('Kick anonymous directory and profiles use the desktop app API, with versioned cursors', async () => {
  const urls = []
  const p = new Providers(
    {},
    createHttp({
      fetchImpl: async (url, init) => {
        const parsed = new URL(url)
        urls.push(parsed)
        assert.equal(parsed.origin, 'https://api.kick.com')
        assert.equal(init.headers.Authorization, undefined)
        if (parsed.pathname.endsWith('/channels/creator'))
          return json({
            status: { error: false },
            data: {
              account: { user: { id: '1' }, channel: { slug: 'creator', description: 'Public bio' } }
            }
          })
        assert.equal(parsed.pathname, '/private/v1/livestreams')
        return json({
          status: { error: false },
          data: {
            livestreams: [
              {
                streamer: {
                  user: { id: '1', username: 'Creator' },
                  channel: { slug: 'creator', description: 'Public bio' }
                },
                metadata: { language: 'en', category: { id: 'category' } },
                viewers_count: 15
              }
            ],
            next_cursor: urls.length === 1 ? 'next' : null,
            version: 'snapshot'
          }
        })
      }
    })
  )
  const first = await p.listStreams('kick')
  assert.equal(first.streams[0].login, 'creator')
  assert.equal(first.streams[0].viewerCount, 15)
  assert.equal(first.streams[0].categoryId, 'category')
  await p.listStreams('kick', first)
  assert.equal(urls[1].searchParams.get('cursor'), 'next')
  assert.equal(urls[1].searchParams.get('version'), 'snapshot')
  assert.deepEqual(await p.profile('kick', 'creator'), { broadcasterId: '1', description: 'Public bio' })
})

test('public provider errors and changed response shapes fail visibly', async () => {
  for (const [platform, payload] of [
    ['twitch', { errors: [{ message: 'failed integrity check' }] }],
    ['twitch', { data: { streams: { edges: [], pageInfo: { hasNextPage: true } } } }],
    ['kick', { status: { error: true, message: 'Unavailable' } }],
    ['kick', { data: { livestreams: [] } }]
  ]) {
    const p = new Providers({}, createHttp({ fetchImpl: async () => json(payload) }))
    await assert.rejects(p.listStreams(platform))
  }
})

test('a restricted Twitch directory preserves its checkpoint and continues Kick discovery', async () => {
  const state = { leads: {}, discovery: {} }
  let twitchPages = 0
  await discover({
    state,
    config: validateConfig({ sources: ['twitch', 'kick'], targetStreamers: 1 }),
    save: async () => {},
    log: quiet,
    http: createHttp(),
    providers: {
      listStreams: async (platform) => {
        if (platform === 'twitch') {
          if (++twitchPages === 1) return { streams: [], cursor: 'resume-here' }
          throw new Error('Twitch public lookup: failed integrity check')
        }
        return { streams: [{ login: 'small', viewerCount: 25, language: 'en' }], cursor: null }
      }
    }
  })
  assert.match(state.discovery.twitch.error, /integrity check/)
  assert.equal(state.discovery.twitch.cursor, 'resume-here')
  assert.equal(state.discovery.twitch.done, false)
  assert.equal(state.discovery.kick.done, true)
  assert.deepEqual(state.selected, ['kick:small'])
})

test('X alone requires a token and keeps it out of the URL', async () => {
  const calls = []
  const http = createHttp({
    fetchImpl: async (url, init) => {
      calls.push({ url, init })
      return json({ data: [] })
    }
  })
  await assert.rejects(new Providers({}, http).searchX('/tweets/search/all'), /X_BEARER_TOKEN/)
  await new Providers({ X_BEARER_TOKEN: 'token' }, http).searchX('/tweets/search/all', [['query', 'clippers']])
  assert.equal(calls.length, 1)
  assert.equal(new URL(calls[0].url).searchParams.get('query'), 'clippers')
  assert.ok(!calls[0].url.includes('token'))
  assert.equal(calls[0].init.headers.Authorization, 'Bearer token')
})

test('both platforms reuse Clippster recording browser; exclude live, oversized and unsafe sources', async () => {
  for (const platform of ['twitch', 'kick']) {
    const source = (id) =>
      platform === 'twitch' ? `https://www.twitch.tv/videos/${id}` : `https://kick.com/creator/videos/${id}`
    const lead = { platform, login: 'creator', liveStartedAt: '2026-10-20T20:00:00Z' }
    const vod = await findVod(lead, validateConfig(), {
      web: async (path) => {
        const url = new URL(path, 'http://localhost')
        assert.equal(url.pathname, '/account/media/vods')
        assert.equal(url.searchParams.get('platform'), platform)
        assert.equal(url.searchParams.get('channel'), 'creator')
        assert.equal(url.searchParams.get('limit'), '20')
        assert.equal(url.searchParams.get('tab'), 'streams')
        return {
          vods: [
            { id: '1', url: source('1'), duration_seconds: 3600, upload_date: '2026-10-20T20:00:00Z' },
            { id: '2', url: source('2'), duration_seconds: 18000, upload_date: '2026-10-19T20:00:00Z' },
            { id: '3', url: 'https://evil.test/secret', duration_seconds: 1800, upload_date: '2026-10-18T20:00:00Z' },
            { id: '4', url: source('4'), duration_seconds: 2700, upload_date: '2026-10-17T20:00:00Z' },
            { id: '5', url: source('5'), duration_seconds: 2700, isLive: true, upload_date: '2026-10-18T20:00:00Z' }
          ]
        }
      }
    })
    assert.equal(vod.id, '4')
  }
})

test('yt-dlp day stamps and Unix timestamps select the latest completed recording', async () => {
  const rows = [
    { id: '1', upload_date: '20261020' },
    { id: '2', upload_date: '20261018' },
    { id: '3', upload_date: Date.parse('2026-10-19T12:00:00Z') / 1000 },
    { id: '4', upload_date: null }
  ].map((v) => ({ ...v, url: `https://www.twitch.tv/videos/${v.id}`, duration_seconds: 300 }))
  const vod = await findVod(
    { platform: 'twitch', login: 'creator', liveStartedAt: '2026-10-20T20:00:00Z' },
    validateConfig(),
    { web: async () => ({ vods: rows }) }
  )
  assert.equal(vod.id, '3')
  assert.equal(vod.createdAt, '2026-10-19T12:00:00.000Z')
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
