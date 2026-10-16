import { beforeAll, afterAll, it, expect } from 'vitest'
import { readFile, writeFile, access } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import type { WebWorkspace } from '@clippster/shared-types'
import { startFixture, waitForJob } from './fixtures'

let fixture: Awaited<ReturnType<typeof startFixture>>, cookie: string, other: string, workspace: WebWorkspace
const request = (path: string, method = 'GET', body?: unknown, session = cookie) => fetch(`${fixture.url}/api/web${path}`, {
  method, headers: { Cookie: session, Origin: fixture.config.origin, 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body)
})
const inspect = (path: string) => JSON.parse(execFileSync(fixture.config.ffprobe, ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', path], { encoding: 'utf8' }))
beforeAll(async () => {
  fixture = await startFixture(); cookie = await fixture.login(); other = await fixture.login('second@example.com')
  workspace = await (await request('/projects', 'POST', { name: 'Workspace parity' })).json()
  const uploaded = await fetch(`${fixture.url}/api/web/projects/${workspace.project.id}/source`, { method: 'PUT', headers: { Cookie: cookie, Origin: fixture.config.origin, 'Content-Type': 'application/octet-stream' }, body: await readFile(fixture.source) })
  expect(uploaded.status).toBe(202); workspace = await waitForJob(fixture.url, cookie, workspace.project.id)
  workspace = await (await request(`/projects/${workspace.project.id}/clips`, 'POST', { name: 'Spliced clip', aspectRatio: '16:9', captions: false, segments: [{ start_time: .4, end_time: 1.4 }, { start_time: 3.4, end_time: 4.4 }] })).json()
})
afterAll(async () => { await fixture.dispose() })

it('serves actual waveform peaks and clip-specific thumbnails only to the owner', async () => {
  const path = `/projects/${workspace.project.id}`
  const waveform = await (await request(`${path}/waveform?width=100`)).json()
  expect(waveform.peaks).toHaveLength(100)
  expect(waveform.peaks.some((peak: { max: number }) => peak.max > .01)).toBe(true)
  expect((await request(`${path}/waveform`, 'GET', undefined, other)).status).toBe(404)
  expect((await request(`${path}/thumbnail?time=.4`)).status).toBe(200)
  expect((await request(`${path}/thumbnail?time=2.3`)).status).toBe(400)
})

it('assembles spliced preview without gaps and maps clip transcription back to source time', async () => {
  const clip = workspace.project.clips[0], path = `/projects/${workspace.project.id}/clips/${clip.id}`
  expect((await request(`${path}/preview`, 'GET', undefined, other)).status).toBe(404)
  const preview = await request(`${path}/preview`), file = join(fixture.directory, 'preview-check.mp4')
  expect(preview.status).toBe(200); await writeFile(file, Buffer.from(await preview.arrayBuffer()))
  expect(Number(inspect(file).format.duration)).toBeCloseTo(2, 1)
  expect((await request(`${path}/transcribe`, 'POST')).status).toBe(202)
  workspace = await waitForJob(fixture.url, cookie, workspace.project.id)
  expect(workspace.jobs[0].status, workspace.jobs[0].message).toBe('completed')
  expect(workspace.project.clips[0].subtitleWords?.[0]).toMatchObject({ word: 'Hello', start: .9 })
  const submitted = fixture.aiRequests().at(-1)!
  expect(submitted.fields).toMatchObject({ free_single_clip: 'true', total_clip_seconds: '2.0000000000000004' })
  expect(Number(submitted.fields.audio)).toBeGreaterThan(100)
})

it('builds all formats with their own history and keeps old builds downloadable after edits', async () => {
  const clip = workspace.project.clips[0], path = `/projects/${workspace.project.id}/clips/${clip.id}`
  const response = await request(`${path}/build`, 'POST', { targets: [
    { aspectRatio: '16:9', exportSettings: { quality: 'low', frameRate: 30, format: 'mp4' } },
    { aspectRatio: '1:1', exportSettings: { quality: 'low', frameRate: 60, format: 'mov' } }
  ] })
  expect(response.status, await response.text()).toBe(202)
  workspace = await waitForJob(fixture.url, cookie, workspace.project.id)
  expect(workspace.jobs[0].status, workspace.jobs[0].message).toBe('completed')
  const built = workspace.project.clips[0]
  expect(built.builds).toHaveLength(2)
  for (const build of built.builds!) {
    const download = await request(`${path}/download?buildId=${build.id}`), file = join(fixture.directory, `export.${build.format}`)
    expect(download.status).toBe(200); await writeFile(file, Buffer.from(await download.arrayBuffer()))
    const metadata = inspect(file), video = metadata.streams.find((stream: { codec_type: string }) => stream.codec_type === 'video')
    expect(video.codec_name).toBe(build.format === 'mov' ? 'prores' : 'h264')
    expect(video.r_frame_rate).toBe(build.format === 'mov' ? '60/1' : '30/1')
    expect(Number(metadata.format.duration)).toBeCloseTo(2, 1)
    expect((await request(`${path}/download?buildId=${build.id}`, 'GET', undefined, other)).status).toBe(404)
  }
  const requestId = randomUUID()
  expect((await request(`${path}/publish`, 'POST', { accountId: 10, requestId, buildId: randomUUID() })).status).toBe(404)
  expect(fixture.store.db.prepare('SELECT * FROM publications WHERE id = ?').get(requestId)).toBeUndefined()
  workspace = await (await request(path, 'PUT', { ...built, name: 'Edited title' })).json()
  expect((await request(`${path}/download`)).status).toBe(409)
  expect((await request(`${path}/download?buildId=${built.builds![0].id}`)).status).toBe(200)
}, 60000)

it('saves Not Now as an owned manual project and cleans links when it is deleted', async () => {
  const clip = workspace.project.clips[0], path = `/projects/${workspace.project.id}/clips/${clip.id}/project`
  expect((await request(path, 'POST', undefined, other)).status).toBe(404)
  const created = await request(path, 'POST'), saved = await created.json() as WebWorkspace
  expect(created.status).toBe(201); expect(saved.project.name).toBe('Manual Clip - Edited title')
  expect(saved.project.status).toBe('ready'); expect(saved.project.duration).toBeCloseTo(2, 1)
  expect(saved.project.clips[0].segments).toHaveLength(1)
  expect((await (await request(path, 'POST')).json()).project.id).toBe(saved.project.id)
  expect((await request(`/projects/${saved.project.id}`, 'DELETE')).status).toBe(204)
  workspace = await (await request(`/projects/${workspace.project.id}`)).json()
  expect(workspace.project.clips[0].linkedProjectId).toBeUndefined()
})

it('forwards enhanced detection, range, credit source and subtitle preset and reuses its transcript', async () => {
  const path = `/projects/${workspace.project.id}/detect`
  const options = { prompt: 'Find highlights', startTime: 0, endTime: 5, organizationId: 7, enhanced: true, subtitlePreset: 'neon-glow' }
  expect((await request(path, 'POST', options)).status).toBe(202)
  workspace = await waitForJob(fixture.url, cookie, workspace.project.id)
  expect(workspace.jobs[0].status, workspace.jobs[0].message).toBe('completed')
  const submitted = fixture.aiRequests().at(-1)!
  expect(submitted.endpoint).toBe('/api/clips/detect-chunked')
  expect(submitted.fields).toMatchObject({ start_time: '0', end_time: '5', organization_id: '7', enhanced: 'true', using_cached_transcript: 'true' })
  expect(Number(submitted.fields.video_chunk_0)).toBeGreaterThan(100)
  expect(submitted.video).toEqual({ height: 480, codecs: ['h264', 'aac'] })
  expect(workspace.project.clips.at(-1)?.captions).toBe(true)
  const transcriptions = fixture.aiRequests().filter(value => value.endpoint === '/api/clips/transcribe').length
  expect((await request(path, 'POST', { ...options, enhanced: false })).status).toBe(202)
  workspace = await waitForJob(fixture.url, cookie, workspace.project.id)
  expect(workspace.jobs[0].status, workspace.jobs[0].message).toBe('completed')
  expect(fixture.aiRequests().filter(value => value.endpoint === '/api/clips/transcribe')).toHaveLength(transcriptions)
})

it('persists B-roll suggestions privately and removes media builds with a clip', async () => {
  const clip = workspace.project.clips[0], path = `/projects/${workspace.project.id}/clips/${clip.id}`
  const suggestions = [{ id: randomUUID(), clipId: clip.id, startTime: 0, endTime: 1, transcriptText: 'Hello', reason: 'Visual context', visualQuery: 'Hello', sourceType: 'stock', status: 'suggested', confidence: .8, candidates: [] }]
  expect((await request(`${path}/broll-suggestions`, 'PUT', { suggestions })).status).toBe(200)
  expect((await (await request(`${path}/broll-suggestions`)).json()).suggestions).toEqual(suggestions)
  expect((await request(`${path}/broll-suggestions`, 'GET', undefined, other)).status).toBe(404)
  expect((await request(path, 'DELETE')).status).toBe(200)
  for (const build of clip.builds!) await expect(access(join(fixture.directory, 'media', workspace.project.id, `${build.id}.mp4`))).rejects.toThrow()
  expect((await request(`${path}/broll-suggestions`)).status).toBe(404)
})
