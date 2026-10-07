import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { readConfig } from '../server/config'
import { createWebApp } from '../server/app'
/** Test-only upstream. Exercises the real web service/FFmpeg without billing accounts. */
export async function startFixture(
  options: { port?: number; origin?: string; directory?: string } = {}
) {
  const directory = options.directory || (await mkdtemp(join(tmpdir(), 'clippster-web-')))
  const oauth = new Map<string, { origin: string; client_state: string; code_challenge: string }>()
  const pendingEmails = new Set<string>()
  let detectionCalls = 0
  const upstream = createServer(async (req, res) => {
    res.setHeader('Content-Type', 'application/json')
    const chunks: Buffer[] = []
    for await (const chunk of req) chunks.push(Buffer.from(chunk))
    if (req.url === '/api/auth/google/start') {
      const input = JSON.parse(Buffer.concat(chunks).toString())
      oauth.set(`fixture-google-${input.client_state}`, input)
      res.end(
        JSON.stringify({
          url: `https://accounts.google.com/o/oauth2/v2/auth?state=${input.client_state}`
        })
      )
    } else if (req.url === '/api/auth/google/exchange') {
      const input = JSON.parse(Buffer.concat(chunks).toString())
      const attempt = oauth.get(input.code)
      if (
        !attempt ||
        attempt.origin !== input.origin ||
        createHash('sha256')
          .update(input.code_verifier || '')
          .digest('base64url') !== attempt.code_challenge
      ) {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Invalid OAuth handoff' }))
      } else {
        oauth.delete(input.code)
        res.end(JSON.stringify({ success: true, token: 'fixture-token-1', user: { id: 1 } }))
      }
    } else if (req.url === '/api/auth/email/register') {
      const input = JSON.parse(Buffer.concat(chunks).toString())
      pendingEmails.add(input.email)
      res.end(JSON.stringify({ success: true, message: 'Check your email' }))
    } else if (req.url === '/api/auth/email/verify-otp') {
      const input = JSON.parse(Buffer.concat(chunks).toString())
      if (input.otp !== '123456' || !pendingEmails.has(input.email)) {
        res.statusCode = 400
        res.end(JSON.stringify({ success: false, error: 'Invalid verification code' }))
      } else {
        pendingEmails.delete(input.email)
        res.end(
          JSON.stringify({
            success: true,
            token: 'fixture-token-1',
            user: { id: 1, email: input.email }
          })
        )
      }
    } else if (
      [
        '/api/auth/email/forgot-password',
        '/api/auth/email/reset-password',
        '/api/auth/email/resend-verification'
      ].includes(req.url || '')
    ) {
      res.end(JSON.stringify({ success: true }))
    } else if (req.url === '/api/auth/email/login') {
      const input = JSON.parse(Buffer.concat(chunks).toString())
      if (pendingEmails.has(input.email)) {
        res.statusCode = 403
        res.end(
          JSON.stringify({ success: false, code: 'EMAIL_NOT_VERIFIED', error: 'Verify your email' })
        )
        return
      }
      if (input.password !== 'test-password') {
        res.statusCode = 401
        res.end(JSON.stringify({ success: false, error: 'Invalid credentials' }))
        return
      }
      const id = input.email === 'second@example.com' ? 2 : 1
      res.end(
        JSON.stringify({
          success: true,
          token: `fixture-token-${id}`,
          user: { id, email: input.email }
        })
      )
    } else if (req.url === '/api/auth/me') {
      const token = req.headers.authorization?.replace('Bearer ', '')
      if (!['fixture-token-1', 'fixture-token-2'].includes(token || '')) {
        res.statusCode = 401
        res.end(JSON.stringify({ success: false }))
      } else
        res.end(
          JSON.stringify({
            success: true,
            user: { id: token === 'fixture-token-1' ? 1 : 2, email: 'test@example.com' }
          })
        )
    } else if (req.url === '/api/clips/detect') {
      detectionCalls++
      const body = Buffer.concat(chunks).toString('latin1')
      if (!body.includes('name="audio"') || !body.includes('name="duration"')) {
        res.statusCode = 400
        res.end(JSON.stringify({ success: false, error: 'Missing audio or duration' }))
        return
      }
      res.end(
        JSON.stringify({
          success: true,
          clips: {
            clips: [
              {
                name: 'AI highlight',
                segments: [
                  { start_time: 0.4, end_time: 1.4 },
                  { start_time: 3.4, end_time: 4.4 }
                ]
              }
            ]
          },
          transcript: {
            words: [
              { word: 'Hello', start: 0.5, end: 1 },
              { word: 'Clippster', start: 3.5, end: 4 }
            ]
          }
        })
      )
    } else {
      res.statusCode = 404
      res.end('{}')
    }
  })
  await new Promise<void>((resolve) => upstream.listen(0, '127.0.0.1', resolve))
  const upstreamPort = (upstream.address() as { port: number }).port
  const config = readConfig({
    CLIPPSTER_API_URL: `http://127.0.0.1:${upstreamPort}/api`,
    WEB_DATA_DIR: directory,
    WEB_ORIGIN: options.origin || 'http://localhost:5175',
    SESSION_SECRET: 'fixture-only-secret-not-valid-for-production',
    NODE_ENV: 'test',
    FFMPEG_PATH: process.env.FFMPEG_PATH,
    FFPROBE_PATH: process.env.FFPROBE_PATH
  })
  // Small fixtures need small reservations; production retains its 2 GB source cap.
  config.maxSourceBytes = 64 * 1024 ** 2
  const web = await createWebApp(config)
  const server = web.app.listen(options.port || 0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}`
  const source = join(directory, 'fixture.mp4')
  execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', [
    '-hide_banner',
    '-loglevel',
    'error',
    '-f',
    'lavfi',
    '-i',
    'testsrc2=size=320x180:rate=24:duration=6',
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:duration=6',
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-shortest',
    '-y',
    source
  ])
  async function login(email = 'test@example.com') {
    const response = await fetch(url + '/api/auth/email/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: config.origin },
      body: JSON.stringify({ email, password: 'test-password' })
    })
    return response.headers.get('set-cookie')!.split(';')[0]
  }
  return {
    ...web,
    config,
    url,
    source,
    directory,
    login,
    detectionCalls: () => detectionCalls,
    dispose: async () => {
      await web.close()
      await Promise.all(
        [server, upstream].map(
          (server) =>
            new Promise<void>((resolve) => {
              server.closeAllConnections()
              server.close(() => resolve())
            })
        )
      )
      if (!options.directory) await rm(directory, { recursive: true, force: true })
    }
  }
}
export async function waitForJob(url: string, cookie: string, projectId: string) {
  const deadline = Date.now() + 80_000
  while (Date.now() < deadline) {
    const response = await fetch(`${url}/api/web/projects/${projectId}`, {
      headers: { Cookie: cookie }
    })
    const workspace = await response.json()
    const job = workspace.jobs[0]
    if (job && ['completed', 'failed', 'cancelled'].includes(job.status)) return workspace
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Job did not finish.')
}
