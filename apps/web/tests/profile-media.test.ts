import { it, expect, vi } from 'vitest'
import express from 'express'
import { Readable } from 'node:stream'
import { profileMediaRoutes } from '../server/profileMediaRoutes'
import { profileMediaUrls } from '../src/profileMediaUrls'
vi.mock('../src/api', () => ({ webApiPath: '/workspace/api/web' }))
const opened = vi.hoisted(() => vi.fn())
vi.mock('../server/network', () => ({ openAsset: opened }))

it('proxies generated thumbnails and keeps personal and organization post identities distinct', () => {
  const posts = profileMediaUrls('/user/posts', { posts: [
    { id: 1, source: 'personal', thumbnail_url: 'https://media.example/personal.jpg' },
    { id: 1, source: 'organization', thumbnail_url: 'https://media.example/org.jpg' },
  ] }).posts
  expect(posts[0].thumbnail_url).toContain('personal%3A1')
  expect(posts[1].thumbnail_url).toContain('organization%3A1')
  expect(profileMediaUrls('/user/posts/1/generate-thumbnail', { thumbnail_url: 'https://media.example/generated.jpg' }).thumbnail_url).toContain('/profile-media/post-thumbnail/')
})

it('serves the thumbnail from the authenticated post list and rejects unowned posts', async () => {
  const app = express()
  app.use((_req, res, next) => { res.locals.session = { owner: 'owner' };next() })
  const upstream = { get: async () => ({ posts: [
    { id: 1, source: 'personal', thumbnail_url: 'https://media.example/personal.jpg' },
    { id: 1, source: 'organization', thumbnail_url: 'https://media.example/org.jpg' },
  ] }) }
  app.use(profileMediaRoutes({ upstream: () => upstream, token: () => 'fixture' } as any))
  opened.mockImplementation(async () => Object.assign(Readable.from(['image']), { statusCode: 200, headers: { 'content-type': 'image/jpeg' } }))
  const server = app.listen(0, '127.0.0.1');await new Promise(resolve => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${(server.address() as any).port}`
  try {
    const response = await fetch(origin + '/profile-media/post-thumbnail/organization%3A1')
    expect(response.status).toBe(200);expect(await response.text()).toBe('image')
    expect(opened.mock.calls.at(-1)?.[0]).toBe('https://media.example/org.jpg')
    expect((await fetch(origin + '/profile-media/post-thumbnail/personal%3A2')).status).toBe(404)
  } finally { server.closeAllConnections();await new Promise(resolve => server.close(resolve)) }
})
