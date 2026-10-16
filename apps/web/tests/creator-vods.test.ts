import { it, expect, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { startFixture, waitForJob } from './fixtures'
let source = ''
vi.mock('../server/media', async importOriginal => {
  const original = await importOriginal<typeof import('../server/media')>()
  return { ...original, downloadSource: vi.fn(async (_url, directory, config, _signal, _progress, range) => {
    const output = join(directory, 'download.mp4')
    execFileSync(config.ffmpeg, ['-v', 'error', '-ss', String(range.startTime), '-i', source, '-t', String(range.endTime - range.startTime), '-c:v', 'libx264', '-c:a', 'aac', output])
    return output
  }) }
})
it('lists creator VODs through authenticated account APIs and queues bounded source selections', async () => {
  const fixture = await startFixture()
  source = fixture.source
  try {
    const headers = { Cookie: await fixture.login(), Origin: fixture.config.origin, 'Content-Type': 'application/json' }
    const request = (path: string, body?: unknown) => fetch(fixture.url + '/api/web' + path, { method: body ? 'POST' : 'GET', headers, ...(body ? { body: JSON.stringify(body) } : {}) })
    expect((await fetch(fixture.url + '/api/web/account/media/vods?platform=twitch&channel=fixture')).status).toBe(401)
    const listing = await request('/account/media/vods?platform=twitch&channel=fixture')
    expect(listing.status).toBe(200)
    expect((await listing.json()).vods[0].id).toBe('fixture-vod')
    const kick = await (await request('/account/media/vods?platform=kick&channel=fixture')).json()
    expect(kick.vods).toHaveLength(19)
    expect(kick.vods[0].duration_seconds).toBe(26073)
    expect(kick.vods[0].thumbnail_url).toContain('/api/web/account/media/vod-thumbnail?')
    expect(kick.vods[0].url).toBe('https://kick.com/fixture/videos/kick-0')
    expect(kick.has_more).toBe(false)
    expect(fixture.kickRequests()[0]).toBe('/api/kick/channels/fixture/videos?limit=20&offset=0')
    const older = await (await request('/account/media/vods?platform=kick&channel=fixture&offset=10')).json()
    expect(older.vods).toHaveLength(9)
    expect(older.vods[0].id).toBe('kick-10')
    expect((await request('/account/media/vods?platform=twitch&channel=https://localhost')).status).toBe(400)
    expect((await request('/account/media/vods?platform=unknown&channel=fixture')).status).toBe(400)
    expect((await request('/account/media/vods?platform=twitch&channel=fixture&offset=-1')).status).toBe(400)
    expect((await request('/account/media/vods?platform=twitch&channel=fixture&tab=bad')).status).toBe(400)
    expect((await request('/account/media/vod-thumbnail?platform=twitch&channel=fixture&id=other&url=http://localhost')).status).toBe(404)
    const workspace = await (await request('/projects', { name: 'Creator selection' })).json()
    for (const range of [{ startTime: -1, endTime: 3 }, { startTime: 3, endTime: 1 }, { startTime: 0, endTime: 100000 }]) expect((await request(`/projects/${workspace.project.id}/import`, { url: 'https://www.twitch.tv/videos/123', range })).status).toBe(400)
    expect((await request(`/projects/${workspace.project.id}/import`, { url: 'https://www.twitch.tv/videos/123', range: { startTime: 1, endTime: 3 } })).status).toBe(202)
    const finished = await waitForJob(fixture.url, headers.Cookie, workspace.project.id)
    expect(finished.jobs[0].status, finished.jobs[0].message).toBe('completed')
    expect(finished.project.duration).toBeCloseTo(2, 0)
    expect(finished.project.sourceRange).toEqual({ startTime: 1, endTime: 3 })
    const { downloadSource } = await import('../server/media')
    expect(vi.mocked(downloadSource).mock.calls[0][5]).toEqual({ startTime: 1, endTime: 3 })
  } finally { await fixture.dispose() }
}, 30_000)
