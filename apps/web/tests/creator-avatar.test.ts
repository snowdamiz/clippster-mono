import { it, expect, vi } from 'vitest'
import express from 'express'
import { writeFile } from 'node:fs/promises'
import { creatorMediaRoutes } from '../server/creatorMediaRoutes'

const download = vi.hoisted(() => vi.fn())
vi.mock('../server/network', () => ({ downloadAsset: download, downloadProxy: vi.fn() }))

it('loads campaign avatars from joined campaigns and rejects unrelated creators', async () => {
  const get = vi.fn(async () => ({ success: true, campaigns: [{ creator_profiles: [{ id: 44, profile_image_url: 'https://media.example/avatar.png' }] }] }))
  download.mockImplementation(async (_url: string, path: string) => writeFile(path, Buffer.from([0x89, 0x50, 0x4e, 0x47])))
  const app = express()
  app.use((_req, res, next) => { res.locals.session = {}; next() })
  app.use(creatorMediaRoutes({ upstream: () => ({ get }), token: () => 'fixture' } as any, {} as any, {} as any))
  const server = app.listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${(server.address() as any).port}`
  try {
    const response = await fetch(origin + '/creator-avatar/campaign/44')
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('image/png')
    expect(get).toHaveBeenCalledWith('/user/campaigns')
    expect(download.mock.calls[0][0]).toBe('https://media.example/avatar.png')
    expect((await fetch(origin + '/creator-avatar/campaign/999')).status).toBe(404)
    expect(download).toHaveBeenCalledTimes(1)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
})
