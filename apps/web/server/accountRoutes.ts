import { Router } from 'express'
import { hasCreatorToolsAccess, isFreePlan } from '@clippster/shared-types'
import type { Auth } from './auth'
import { requireValue } from './errors'

/** Explicitly allow supported account operations; never proxy arbitrary URLs. */
export function accountRoutes(auth: Auth) {
  const router = Router()
  router.use(async (req, res) => {
    const path = req.path
    const method = req.method
    const read = method === 'GET'
    const creator = /^\/user\/creator-profiles(?:\/\d+)?$/.test(path)
    const campaign = /^\/(?:campaigns(?:\/\d+(?:\/(?:apply|submissions))?)?|user\/(?:campaigns|submissions|earnings))$/.test(path)
    const calendar = /^\/social\/scheduled(?:\/\d+(?:\/(?:cancel|retry))?)?$/.test(path)
    const orgRead = /^\/organizations\/\d+\/(?:campaigns|scheduled-posts|social-accounts|my-social-accounts|external-posts)$/.test(path)
    const accountRead = ['/organizations', '/user/branding', '/user/assigned-creator-profiles', '/user/restrictions', '/app-settings/feature-flags', '/user/posts', '/user/external-posts', '/user/social-accounts'].includes(path)
    const broll = read && path === '/ai/broll/search' || method === 'POST' && path === '/ai/broll/suggest'
    requireValue((creator && ['GET', 'POST', 'PUT', 'DELETE'].includes(method)) ||
      (campaign && (read || method === 'POST' && /^\/campaigns\/\d+\/(apply|submissions)$/.test(path))) ||
      (calendar && (read || ['PUT', 'DELETE'].includes(method) && /^\/social\/scheduled\/\d+$/.test(path) || method === 'POST' && /\/(cancel|retry)$/.test(path))) ||
      broll || (read && (orgRead || accountRead)), 404, 'Unsupported account operation.')
    const upstream = auth.upstream(auth.token(res.locals.session))
    if (campaign) {
      requireValue(hasCreatorToolsAccess(res.locals.user), 403, 'Campaigns requires a Creator or Pro plan.')
      const settings = await upstream.get<{ feature_flags?: { campaigns_enabled?: boolean } }>('/app-settings/feature-flags')
      requireValue(settings.feature_flags?.campaigns_enabled || res.locals.user.is_admin || res.locals.user.campaigns_enabled, 403, 'Campaigns is not enabled for this account.')
    }
    if (creator || calendar) {
      const permissions = await upstream.get<{ success: boolean; restricted?: boolean }>('/user/restrictions')
      requireValue(permissions.success && !permissions.restricted, 403, 'Your organization restricts this feature.')
    }
    if (creator && !read) requireValue(!isFreePlan(res.locals.user), 403, 'Upgrade your plan to manage personal creator profiles.')
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
    requireValue(query.length <= 4096, 400, 'Query is too long.')
    const { status, data } = await upstream.requestWithStatus(path + query, { method, ...(read || method === 'DELETE' ? {} : { body: req.body }) })
    res.status(status).json(data)
  })
  return router
}
