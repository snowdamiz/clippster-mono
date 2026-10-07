import { createServer, type Plugin } from 'vite'
import { fileURLToPath } from 'node:url'
import { mkdtemp, rm } from 'node:fs/promises'
import express from 'express'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import base from '../vite.config'
const directory = await mkdtemp(join(tmpdir(), 'clippster-shared-ui-'))
const source = join(directory, 'fixture.mp4')
execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', [
  '-hide_banner',
  '-loglevel',
  'error',
  '-f',
  'lavfi',
  '-i',
  'testsrc2=size=320x180:rate=24:duration=4',
  '-c:v',
  'libx264',
  '-pix_fmt',
  'yuv420p',
  '-y',
  source
])
const fixtureMedia: Plugin = {
  name: 'fixture-media',
  configureServer(server) {
    server.middlewares.use(express().use(express.static(directory)))
    server.middlewares.use((req, res, next) => {
      if (req.url === '/fixture.svg') {
        res.setHeader('Content-Type', 'image/svg+xml')
        res.end(
          '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#00ff00"/></svg>'
        )
      } else next()
    })
  }
}
const server = await createServer({
  ...base,
  configFile: false,
  root: fileURLToPath(new URL('./shared-ui', import.meta.url)),
  plugins: [...(base.plugins || []), fixtureMedia],
  cacheDir: '../../node_modules/.vite-shared-tests',
  server: {
    hmr: false,
    watch: null,
    port: 8093,
    strictPort: true,
    host: '127.0.0.1',
    fs: { allow: [fileURLToPath(new URL('../../..', import.meta.url))] }
  }
})
await server.listen()
async function close() {
  await server.close()
  await rm(directory, { recursive: true, force: true })
  process.exit(0)
}
process.on('SIGTERM', close)
process.on('SIGINT', close)
