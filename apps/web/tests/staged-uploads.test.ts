import { beforeAll, afterAll, it, expect } from 'vitest'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { startFixture, waitForJob } from './fixtures'

let fixture: Awaited<ReturnType<typeof startFixture>>
let cookie: string
let other: string
const json = { 'Content-Type': 'application/json' }
const binary = { 'Content-Type': 'application/octet-stream' }
function api(path: string, init: RequestInit = {}, session = cookie) {
  return fetch(fixture.url + '/api/web' + path, { ...init, headers: { Cookie: session, Origin: fixture.config.origin, ...init.headers } })
}
async function begin(size: number) {
  const response = await api('/uploads', { method: 'POST', headers: json, body: JSON.stringify({ size }) })
  expect(response.status).toBe(201)
  return (await response.json()).id as string
}
async function stage(bytes: Buffer, parts = 3) {
  const id = await begin(bytes.length), step = Math.ceil(bytes.length / parts)
  for (let offset = 0; offset < bytes.length; offset += step) {
    const response = await api(`/uploads/${id}?offset=${offset}`, { method: 'PUT', headers: binary, body: bytes.subarray(offset, offset + step) })
    expect(await response.json()).toEqual({ received: Math.min(offset + step, bytes.length) })
  }
  return id
}
async function project(name: string) {
  return (await (await api('/projects', { method: 'POST', headers: json, body: JSON.stringify({ name }) })).json()).project.id as string
}
beforeAll(async () => {
  fixture = await startFixture()
  cookie = await fixture.login()
  other = await fixture.login('second@example.com')
})
afterAll(async () => {
  await fixture.dispose()
})

it('imports a source video sent in chunks and consumes the staged upload once', async () => {
  const bytes = await readFile(fixture.source), id = await stage(bytes), projectId = await project('Chunked source')
  expect((await api(`/projects/${projectId}/source?upload=${id}`, { method: 'PUT', headers: binary })).status).toBe(202)
  const finished = await waitForJob(fixture.url, cookie, projectId)
  expect(finished.jobs[0].status, finished.jobs[0].message).toBe('completed')
  expect(finished.project.status).toBe('ready')
  expect((await api(`/uploads/${id}?offset=0`, { method: 'PUT', headers: binary, body: bytes.subarray(0, 1) })).status).toBe(404)
}, 60_000)

it('ingests chunked framing media through the same staged upload', async () => {
  const file = join(fixture.directory, 'staged-framing.png')
  execFileSync(fixture.config.ffmpeg, ['-v', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=64x64', '-frames:v', '1', '-y', file])
  const id = await stage(await readFile(file), 2), projectId = await project('Chunked framing')
  const response = await api(`/projects/${projectId}/framing-assets?type=image&name=Overlay&upload=${id}`, { method: 'POST' })
  expect(response.status).toBe(201)
  expect((await response.json()).asset.type).toBe('image')
})

it('resumes retried chunks, keeps uploads private, and refuses unfinished or oversized ones', async () => {
  const bytes = Buffer.alloc(1000, 1), id = await begin(bytes.length), projectId = await project('Unfinished')
  expect((await api(`/uploads/${id}?offset=0`, { method: 'PUT', headers: binary, body: bytes.subarray(0, 600) })).status).toBe(200)
  const retried = await api(`/uploads/${id}?offset=0`, { method: 'PUT', headers: binary, body: bytes.subarray(0, 600) })
  expect(retried.status).toBe(409)
  expect((await retried.json()).received).toBe(600)
  expect((await api(`/uploads/${id}?offset=600`, { method: 'PUT', headers: binary, body: bytes.subarray(600) }, other)).status).toBe(404)
  expect((await api(`/projects/${projectId}/source?upload=${id}`, { method: 'PUT', headers: binary }, other)).status).toBe(404)
  expect((await api(`/projects/${projectId}/source?upload=${id}`, { method: 'PUT', headers: binary })).status).toBe(409)
  expect((await api(`/uploads/${id}?offset=600`, { method: 'PUT', headers: binary, body: Buffer.alloc(500, 1) })).status).toBe(413)
  expect((await api('/uploads', { method: 'POST', headers: json, body: JSON.stringify({ size: fixture.config.maxSourceBytes + 1 }) })).status).toBe(413)
  expect((await api(`/uploads/${id}`, { method: 'DELETE' })).status).toBe(204)
  expect((await api(`/uploads/${id}`, { method: 'DELETE' })).status).toBe(404)
})
