import { beforeAll, afterAll, describe, it, expect } from 'vitest'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { startFixture, waitForJob } from './fixtures'
import { isPublicAddress, downloadProxy } from '../server/network'
import { clipInput, sourceUrl } from '../server/validation'
import { readConfig } from '../server/config'
import { clipWords } from '../server/media'
import type { WebWorkspace } from '@clippster/shared-types'
let fixture: Awaited<ReturnType<typeof startFixture>>
let cookie: string
let second: string
let workspace: WebWorkspace
async function request(path: string, method = 'GET', body?: unknown, session = cookie) {
  return fetch(fixture.url + '/api/web' + path, {
    method,
    headers: { Cookie: session, Origin: fixture.config.origin, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}
beforeAll(async () => {
  fixture = await startFixture()
  cookie = await fixture.login()
  second = await fixture.login('second@example.com')
})
afterAll(async () => {
  await fixture.dispose()
})
describe('private browser workspace with real FFmpeg', () => {
  it('requires sessions, rejects cross-origin mutations, and stores encrypted tokens', async () => {
    expect((await request('/projects', 'GET', undefined, '')).status).toBe(401)
    const response = await fetch(fixture.url + '/api/web/projects', {
      method: 'POST',
      headers: {
        Cookie: cookie,
        Origin: 'https://evil.example',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: 'bad' })
    })
    expect(response.status).toBe(403)
    const sessions = fixture.store.db.prepare('SELECT token FROM sessions').all()
    expect(JSON.stringify(sessions)).not.toContain('fixture-token')
    expect(
      (await fetch(fixture.url + '/api/auth/me', { headers: { Cookie: cookie } })).headers.get(
        'set-cookie'
      )
    ).toBeNull()
  })
  it('creates and isolates projects by account', async () => {
    const response = await request('/projects', 'POST', { name: 'Local verification' })
    expect(response.status).toBe(201)
    workspace = await response.json()
    expect(
      (await request(`/projects/${workspace.project.id}`, 'GET', undefined, second)).status
    ).toBe(404)
    expect((await (await request('/projects', 'GET', undefined, second)).json()).projects).toEqual(
      []
    )
    expect(
      (
        await request(`/projects/${workspace.project.id}/import`, 'POST', {
          url: 'http://127.0.0.1/secret'
        })
      ).status
    ).toBe(400)
  })
  it('uploads and normalizes a real source, then serves authenticated byte ranges', async () => {
    const response = await fetch(`${fixture.url}/api/web/projects/${workspace.project.id}/source`, {
      method: 'PUT',
      headers: {
        Cookie: cookie,
        Origin: fixture.config.origin,
        'Content-Type': 'application/octet-stream'
      },
      body: await readFile(fixture.source)
    })
    expect(response.status).toBe(202)
    workspace = await waitForJob(fixture.url, cookie, workspace.project.id)
    expect(workspace.jobs[0].status, workspace.jobs[0].message).toBe('completed')
    expect(workspace.project.status).toBe('ready')
    const media = await fetch(`${fixture.url}/api/web/projects/${workspace.project.id}/source`, {
      headers: { Cookie: cookie, Range: 'bytes=0-99' }
    })
    expect(media.status).toBe(206)
    expect((await media.arrayBuffer()).byteLength).toBe(100)
    expect(
      (await request(`/projects/${workspace.project.id}/source`, 'GET', undefined, second)).status
    ).toBe(404)
  })
  it('sends real extracted audio to the existing AI contract and preserves segment times', async () => {
    expect(
      (
        await request(`/projects/${workspace.project.id}/detect`, 'POST', {
          prompt: 'Find highlights'
        })
      ).status
    ).toBe(202)
    workspace = await waitForJob(fixture.url, cookie, workspace.project.id)
    expect(workspace.jobs[0].status, workspace.jobs[0].message).toBe('completed')
    expect(fixture.detectionCalls()).toBe(1)
    expect(workspace.project.clips[0].segments).toHaveLength(2)
    expect(workspace.project.words).toHaveLength(2)
    expect(JSON.stringify(workspace)).not.toContain('sessionId')
    expect(JSON.stringify(workspace)).not.toContain('fixture-token')
  })
  it('renders all segments and captions to a downloadable H.264 MP4', async () => {
    const clip = workspace.project.clips[0]
    expect(
      (await request(`/projects/${workspace.project.id}/clips/${clip.id}/build`, 'POST')).status
    ).toBe(202)
    workspace = await waitForJob(fixture.url, cookie, workspace.project.id)
    expect(workspace.jobs[0].status, workspace.jobs[0].message).toBe('completed')
    const response = await request(`/projects/${workspace.project.id}/clips/${clip.id}/download`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain('attachment')
    const output = join(fixture.directory, 'downloaded.mp4')
    await writeFile(output, Buffer.from(await response.arrayBuffer()))
    const info = JSON.parse(
      execFileSync(
        process.env.FFPROBE_PATH || 'ffprobe',
        ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', output],
        { encoding: 'utf8' }
      )
    )
    expect(Number(info.format.duration)).toBeCloseTo(2, 0)
    expect(info.streams[0].codec_name).toBe('h264')
    expect(info.streams[0].width).toBe(1080)
    expect(info.streams[0].height).toBe(1920)
  })
  it('rejects stale edits, invalid ranges, cross-user downloads, and outdated builds', async () => {
    const clip = workspace.project.clips[0]
    const base = `/projects/${workspace.project.id}/clips/${clip.id}`
    expect((await request(base, 'PUT', { ...clip, revision: 0 })).status).toBe(409)
    expect(
      (await request(base, 'PUT', { ...clip, segments: [{ start_time: 5, end_time: 50 }] })).status
    ).toBe(400)
    expect((await request(base + '/download', 'GET', undefined, second)).status).toBe(404)
    expect((await request(base, 'PUT', { ...clip, name: 'Revised highlight' })).status).toBe(200)
    expect((await request(base + '/download')).status).toBe(409)
  })
})
describe('media boundary validation', () => {
  it('allows only supported HTTPS source pages', () => {
    expect(sourceUrl('https://www.youtube.com/watch?v=example')).toContain('youtube.com')
    for (const value of [
      'not a url',
      'file:///etc/passwd',
      'https://youtube.com.evil.test/v',
      'https://user:pass@youtube.com/v',
      'https://youtube.com:444/v'
    ])
      expect(() => sourceUrl(value)).toThrow()
  })
  it('blocks loopback, private, metadata, mapped IPv6, and link-local destinations', () => {
    for (const address of [
      '127.0.0.1',
      '10.0.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '::1',
      'fe80::1',
      'fc00::1',
      '::ffff:127.0.0.1'
    ])
      expect(isPublicAddress(address), address).toBe(false)
    expect(isPublicAddress('8.8.8.8')).toBe(true)
  })
  it('rejects malformed clips and prevents invalid production sessions', () => {
    expect(() =>
      clipInput(
        {
          name: 'clip',
          aspectRatio: '9:16',
          captions: false,
          segments: [{ start_time: 0, end_time: Infinity }]
        },
        6
      )
    ).toThrow()
    expect(() => readConfig({ NODE_ENV: 'production' })).toThrow('SESSION_SECRET')
  })
  it('maps caption timing through discontiguous segments', () => {
    expect(
      clipWords(
        [{ word: 'two', start: 3.5, end: 4 }],
        [
          { start_time: 0, end_time: 1, duration: 1, transcript: null },
          { start_time: 3, end_time: 5, duration: 2, transcript: null }
        ]
      )
    ).toEqual([{ word: 'two', start: 1.5, end: 2 }])
  })
})

describe('durability and worker recovery', () => {
  it('keeps completed projects and marks interrupted jobs failed without replaying AI charges', async () => {
    const { Store } = await import('../server/store')
    const { Jobs } = await import('../server/jobs')
    const { createAuth } = await import('../server/auth')
    const { mkdtemp, mkdir, rm, access } = await import('node:fs/promises')
    const { tmpdir } = await import('node:os')
    const directory = await mkdtemp(join(tmpdir(), 'clippster-restart-'))
    let store = new Store(directory)
    const project = store.create('Survives restart', '1')
    project.status = 'ready'
    store.save(project, '1')
    const job = {
      id: 'interrupted',
      projectId: project.id,
      owner: '1',
      sessionId: 'old-session',
      payload: {},
      kind: 'detect' as const,
      status: 'running' as const,
      progress: 20,
      message: 'Analyzing',
      createdAt: Date.now()
    }
    store.saveJob(job)
    const media = join(directory, 'media', project.id)
    await mkdir(join(media, 'work'), { recursive: true })
    await writeFile(join(media, 'upload'), 'partial')
    store.close()
    store = new Store(directory)
    const config = { ...fixture.config, dataDir: directory }
    const jobs = new Jobs(store, config, createAuth(store, config))
    try {
      await jobs.start()
      expect(store.get(project.id, '1').name).toBe('Survives restart')
      expect(store.job(job.id, '1').status).toBe('failed')
      expect(store.activeJobs()).toHaveLength(0)
      await expect(access(join(media, 'upload'))).rejects.toThrow()
      await expect(access(join(media, 'work'))).rejects.toThrow()
    } finally {
      await jobs.stop()
      store.close()
      await rm(directory, { recursive: true, force: true })
    }
  })
  it('blocks private destinations through the actual downloader proxy', async () => {
    const { request: httpRequest } = await import('node:http')
    const proxy = await downloadProxy()
    try {
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const req = httpRequest(proxy.url, { path: 'http://127.0.0.1:80/metadata' }, (res) => {
          res.resume()
          resolve(res.statusCode)
        })
        req.on('error', reject)
        req.end()
      })
      expect(status).toBe(403)
    } finally {
      proxy.close()
    }
  })
})
