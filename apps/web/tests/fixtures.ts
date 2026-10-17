import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { readConfig } from '../server/config'
import { createWebApp } from '../server/app'
import type { AuthUser, PlanAccount } from '@clippster/shared-types'
/** Test-only upstream. Exercises the real web service/FFmpeg without billing accounts. */
export async function startFixture(
  options: { port?: number; origin?: string; accountOrigin?: string; directory?: string;
    restrictions?: { restricted?: boolean; restrictions?: { allow_custom_prompts?: boolean; allow_personal_social?: boolean; require_clip_approval?: boolean; restricting_org_id?: number } };
    campaignsEnabled?: boolean;
    creatorProfiles?: Array<Record<string, unknown>>;
    user?: Omit<Partial<AuthUser>, 'subscription'> & PlanAccount } = {}
) {
  const directory = options.directory || (await mkdtemp(join(tmpdir(), 'clippster-web-')))
  const oauth = new Map<string, { origin: string; client_state: string; code_challenge: string }>()
  const pendingEmails = new Set<string>()
  let detectionCalls = 0
  const aiRequests: { endpoint: string; fields: Record<string, string | number>; video?: { height: number; codecs: string[] } }[] = []
  let publishCalls = 0
  const kickRequests: string[] = []
  const brandingAssets = new Map<string, Array<Record<string, unknown>>>()
  const brandingUploads: { owner: string; type: string; bytes: number }[] = []
  const fixtureUser = (id: number, email = 'test@example.com') => ({
    id, email, has_selected_plan: true, subscription: { status: 'active' }, ...options.user
  })
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
            user: fixtureUser(1, input.email)
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
          user: fixtureUser(id, input.email)
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
            user: fixtureUser(token === 'fixture-token-1' ? 1 : 2)
          })
        )
    } else if (req.url === '/api/credits/balance') {
      res.end(JSON.stringify({ success: true, balance: { hours_remaining: 100, hours_used: 0 }, organization_allocations: [] }))
    } else if (req.url === '/api/jobs/cancel-by-project') {
      res.end(JSON.stringify({ success: true, cancelled_jobs: 0 }))
    } else if (req.url === '/api/user/restrictions') {
      res.end(JSON.stringify({ success: true, restricted: false, ...options.restrictions }))
    } else if (req.url === '/api/settings/feature-flags') {
      res.end(JSON.stringify({ success: true, feature_flags: { campaigns_enabled: options.campaignsEnabled === true } }))
    } else if (req.url === '/api/app-settings/free-tier-branding') {
      res.end(JSON.stringify({ success: true, branding: null }))
    } else if (req.url === '/api/user/assets') {
      const owner = req.headers.authorization?.replace('Bearer ', '') || ''
      const assets = brandingAssets.get(owner) || []
      if (req.method === 'POST') {
        const form = await new Request('http://fixture/assets', { method: 'POST', headers: { 'Content-Type': String(req.headers['content-type']) }, body: Buffer.concat(chunks) }).formData()
        const file = form.get('file') as File
        const asset = { id: assets.length + 1, asset_type: form.get('asset_type'), name: form.get('name'), url: 'https://fixture.invalid/branding/' + (assets.length + 1), mime_type: file.type, file_size: file.size, width: Number(form.get('width')), height: Number(form.get('height')), duration: Number(form.get('duration')), inserted_at: new Date().toISOString(), updated_at: new Date().toISOString() }
        assets.push(asset); brandingAssets.set(owner, assets)
        brandingUploads.push({ owner, type: String(form.get('asset_type')), bytes: file.size })
        res.statusCode = 201; res.end(JSON.stringify({ success: true, asset }))
      } else res.end(JSON.stringify({ success: true, assets }))
    } else if (req.url === '/api/user/creator-profiles' && req.method === 'GET') {
      res.end(JSON.stringify({ success: true, profiles: req.headers.authorization === 'Bearer fixture-token-1' ? options.creatorProfiles || [] : [] }))
    } else if (req.url === '/api/user/branding') {
      res.end(JSON.stringify({ success: true, profiles: req.headers.authorization === 'Bearer fixture-token-1' ? options.creatorProfiles || [] : [], assets: [] }))
    } else if (req.url === '/api/user/campaigns/global-branding' || req.url?.startsWith('/api/user/campaigns/by-creator/')) {
      res.end(JSON.stringify({ success: true, campaigns: [] }))
    } else if (req.url === '/api/user/assigned-creator-profiles') {
      res.end(JSON.stringify({ success: true, profiles: [] }))
    } else if (req.url === '/api/campaigns') {
      res.end(JSON.stringify({ success: true, campaigns: [] }))
    } else if (req.url === '/api/organizations') {
      res.end(JSON.stringify({ success: true, organizations: options.restrictions?.restrictions?.require_clip_approval ? [{ id: 7, role: 'member' }] : [] }))
    } else if (['/api/organizations/7/social-accounts', '/api/organizations/7/my-social-accounts'].includes(req.url || '')) {
      res.end(JSON.stringify({ success: true, accounts: [{ id: 70, platform: 'youtube', username: 'Assigned organization channel', is_active: true }] }))
    } else if (req.url === '/api/organizations/7/subscription') {
      res.end(JSON.stringify({ success: true, subscription: { status: 'active' } }))
    } else if (req.url === '/api/organizations/7/posts/upload-media') {
      res.end(JSON.stringify({ success: true, media_url: 'https://media.example.test/organization.mp4' }))
    } else if (req.url === '/api/organizations/7/posts/publish') {
      publishCalls++
      res.end(JSON.stringify({ success: true, post: { id: publishCalls, status: 'awaiting_approval' } }))
    } else if (req.url === '/api/user/social-accounts') {
      res.end(JSON.stringify({ success: true, social_accounts: [{ id: 10, platform: 'youtube', username: 'Fixture channel', is_active: true }] }))
    } else if (req.url === '/api/user/posts/upload-media') {
      res.end(JSON.stringify({ success: true, media_url: 'https://media.example.test/fixture.mp4' }))
    } else if (req.url === '/api/user/youtube/publish' || req.url === '/api/social/schedule' && req.method === 'POST') {
      publishCalls++
      res.end(JSON.stringify({ success: true, post: { id: publishCalls } }))
    } else if (req.url === '/api/clips/detect-chunked' || req.url === '/api/clips/transcribe') {
      const submitted = await new Request('http://fixture/ai', { method: 'POST', headers: { 'Content-Type': String(req.headers['content-type']) }, body: Buffer.concat(chunks) }).formData()
      const videoFile = submitted.get('video_chunk_0')
      let videoStreams: Array<{ codec_type: string; codec_name: string; height?: number }> | undefined
      if (videoFile && typeof videoFile !== 'string') {
        const path = join(directory, 'enhanced-video-check.mp4')
        await writeFile(path, Buffer.from(await videoFile.arrayBuffer()))
        videoStreams = JSON.parse(execFileSync(config.ffprobe, ['-v', 'error', '-i', path, '-show_streams', '-of', 'json'], { encoding: 'utf8' })).streams
      }
      aiRequests.push({ endpoint: req.url, fields: Object.fromEntries([...submitted].map(([name, value]) => [name, typeof value === 'string' ? value : value.size])), video: videoStreams ? { height: videoStreams.find(stream => stream.codec_type === 'video')?.height || 0, codecs: videoStreams.map(stream => stream.codec_name) } : undefined })
      if (req.url === '/api/clips/detect-chunked') detectionCalls++
      const body = Buffer.concat(chunks).toString('latin1')
      if (req.url === '/api/clips/transcribe' ? !body.includes('name="audio"') || !body.includes('name="duration"') : !body.includes('name="chunks"') || !body.includes('name="total_duration"')) {
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
    } else if (req.url?.startsWith('/api/kick/channels/fixture/videos?')) {
      kickRequests.push(req.url)
      const query = new URL(req.url, 'http://fixture').searchParams, offset = Number(query.get('offset') || 0), limit = Number(query.get('limit') || 20)
      const clips = Array.from({ length: 19 }, (_, index) => ({ clipId: 'kick-' + index, title: 'Kick archive ' + index, duration: 26073 + index, thumbnailUrl: 'https://fixture.invalid/kick-' + index + '.png', pageUrl: 'https://kick.com/fixture/videos/kick-' + index, createdAt: '2026-10-10T17:34:04Z', isLive: false }))
      res.end(JSON.stringify({ success: true, clips: clips.slice(offset, offset + limit), hasMore: offset + limit < clips.length, total: clips.length }))
    } else if (req.url?.startsWith('/api/media/vods?')) {
      res.end(JSON.stringify({ success: true, vods: [{ id: 'fixture-vod', title: 'Completed fixture stream', duration_seconds: 6, url: 'https://www.twitch.tv/videos/123' }] }))
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
    ACCOUNT_ORIGIN: options.accountOrigin,
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
    aiRequests: () => aiRequests,
    publishCalls: () => publishCalls,
    kickRequests: () => kickRequests,
    brandingUploads: () => brandingUploads,
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
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Job did not finish.')
}
