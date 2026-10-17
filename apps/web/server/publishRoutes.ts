import { Router } from 'express'
import { openAsBlob } from 'node:fs'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { WEB_PUBLISH_PLATFORMS, isFreePlan } from '@clippster/shared-types'
import type { Auth } from './auth'
import type { Store } from './store'
import type { Config } from './config'
import type { Jobs } from './jobs'
import { requireValue } from './errors'
import { projectDirectory } from './storage'

export function publishRoutes(store: Store, auth: Auth, config: Config, jobs: Jobs) {
  const router = Router()
  router.post('/projects/:id/clips/:clipId/publish', async (req, res) => {
    const owner = res.locals.session.owner
    const project = store.get(String(req.params.id), owner)
    jobs.assertIdle(project.id, owner)
    const clip = project.clips.find(clip => clip.id === req.params.clipId)
    requireValue(clip, 404, 'Clip not found.')
    requireValue(req.body?.buildId || clip.builtRevision === clip.revision, 409, 'Build the latest clip before publishing.')
    const { accountId, organizationId, caption = '', scheduledAt, requestId } = req.body || {}
    requireValue(typeof requestId === 'string' && /^[\da-f-]{36}$/i.test(requestId), 400, 'Invalid publish request.')
    requireValue(Number.isSafeInteger(accountId) && accountId > 0, 400, 'Choose a social account.')
    requireValue(organizationId === undefined || Number.isSafeInteger(organizationId) && organizationId > 0, 400, 'Invalid organization.')
    requireValue(typeof caption === 'string' && caption.length <= 5000, 400, 'Caption is too long.')
    requireValue(!scheduledAt || typeof scheduledAt === 'string' && Number.isFinite(Date.parse(scheduledAt)) && Date.parse(scheduledAt) > Date.now() + 5 * 60_000, 400, 'Schedule at least five minutes in the future.')
    requireValue(!scheduledAt || !isFreePlan(res.locals.user), 403, 'Post scheduling requires a paid subscription.')
    const upstream = auth.upstream(auth.token(res.locals.session), 5 * 60_000)
    if (organizationId) {
      const subscription = await upstream.get<{ success: boolean; subscription?: { status?: string } }>(`/organizations/${organizationId}/subscription`)
      requireValue(subscription.success && subscription.subscription?.status && !['none', 'expired'].includes(subscription.subscription.status), 403, 'An active organization plan is required to publish.')
    }
    const permissions = await upstream.get<{ success: boolean; restricted?: boolean; restrictions?: { allow_personal_social?: boolean; require_clip_approval?: boolean } }>('/user/restrictions')
    requireValue(permissions.success && (organizationId || !permissions.restricted || permissions.restrictions?.allow_personal_social !== false) && (organizationId || !permissions.restrictions?.require_clip_approval), 403, 'Choose your organization account to submit this clip for approval.')
    type SocialAccount = { id: number; platform: string; is_active: boolean }
    const accounts = await upstream.get<{ success: boolean; social_accounts?: SocialAccount[]; accounts?: SocialAccount[] }>(organizationId ? `/organizations/${organizationId}/social-accounts` : '/user/social-accounts')
    const account = (organizationId ? accounts.accounts : accounts.social_accounts)?.find(account => account.id === accountId && account.is_active !== false)
    requireValue(accounts.success && account && WEB_PUBLISH_PLATFORMS.includes(account.platform), 400, 'Choose an active supported social account.')
    const build = req.body?.buildId ? clip.builds?.find(value => value.id === req.body.buildId) : undefined
    requireValue(!req.body?.buildId || build, 404, 'This build is no longer available. Rebuild the clip before publishing.')
    const fingerprint = createHash('sha256').update(JSON.stringify([project.id, clip.id, build?.revision ?? clip.revision, req.body?.buildId || null, accountId, organizationId || null, caption, scheduledAt || null])).digest('hex')
    const previous = store.db.prepare('SELECT * FROM publications WHERE id = ?').get(requestId) as { owner: string; fingerprint: string; status: string; result: string } | undefined
    if (previous) {
      requireValue(previous.owner === owner && previous.fingerprint === fingerprint, 409, 'Publish request has changed. Start a new request.')
      requireValue(previous.status === 'completed', 409, 'This request may already have been submitted. Check Posts or Calendar before retrying.')
      res.json(JSON.parse(previous.result)); return
    }
    store.db.prepare('INSERT INTO publications VALUES (?, ?, ?, ?, NULL)').run(requestId, owner, fingerprint, 'pending')
    const file = await openAsBlob(join(projectDirectory(config, project.id), `${build?.id || clip.id}.mp4`), { type: 'video/mp4' })
    const form = new FormData(); form.append('file', file, `${clip.id}.mp4`)
    const media = await upstream.post<{ success: boolean; error?: string; media_url?: string }>(organizationId ? `/organizations/${organizationId}/posts/upload-media` : '/user/posts/upload-media', form)
    requireValue(media.success && media.media_url, 502, media.error || 'Unable to upload the built clip.')
    const payload = { media_url: media.media_url, caption, media_type: 'video', clip_id: clip.id,
      ...(organizationId ? { organization_id: organizationId, social_account_id: account.id } : scheduledAt ? { user_social_account_id: account.id } : { account_id: account.id }),
      ...(scheduledAt ? { platform: account.platform, scheduled_at: scheduledAt } : { title: caption || clip.name }) }
    const platformRoute = account.platform === 'x' ? 'twitter' : account.platform
    const result = await upstream.post<{ success: boolean; error?: string }>(scheduledAt ? '/social/schedule' : organizationId ? `/organizations/${organizationId}/posts/publish` : `/user/${platformRoute}/publish`, payload)
    requireValue(result.success, 502, result.error || 'Publishing was not confirmed. Check Posts before retrying.')
    store.db.prepare('UPDATE publications SET status = ?, result = ? WHERE id = ? AND owner = ?').run('completed', JSON.stringify(result), requestId, owner)
    if (build && !scheduledAt) { const current = store.get(project.id, owner); const saved = current.clips.find(value => value.id === clip.id)?.builds?.find(value => value.id === build.id); if (saved) { saved.publishedAt = Date.now(); store.save(current, owner) } }
    res.json(result)
  })
  return router
}
