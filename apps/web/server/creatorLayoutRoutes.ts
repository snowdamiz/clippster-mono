import { Router } from 'express'
import type { Store } from './store'
import type { Auth } from './auth'
import type { Jobs } from './jobs'
import type { Config } from './config'
import type { ActiveVodPresetConfig } from '@clippster/shared-types'
import { validateClipSettings } from './clipSettings'
import { requireValue } from './errors'
import { materializeCreatorLayout, type CreatorLayoutAsset } from './creatorLayoutAssets'
export function creatorLayoutRoutes(store: Store, auth: Auth, jobs: Jobs, config: Config) {
  const router = Router()
  router.post('/projects/:id/creator-layout', async (req, res) => {
    const owner = res.locals.session.owner, project = store.get(String(req.params.id), owner)
    jobs.assertIdle(project.id, owner)
    requireValue(Number.isSafeInteger(req.body?.creatorId) && req.body.creatorId > 0, 400, 'Choose a creator profile.')
    const bundle = await auth.upstream(auth.token(res.locals.session)).get<{ success: boolean; profiles: Array<{ id: number; clip_build_defaults?: string }>; assets: CreatorLayoutAsset[] }>('/user/branding')
    const profile = bundle.profiles.find(value => value.id === req.body.creatorId)
    requireValue(bundle.success && profile?.clip_build_defaults, 404, 'Creator layout is no longer available.')
    let defaults: any
    try { defaults = JSON.parse(profile.clip_build_defaults) } catch { /* Validate below. */ }
    requireValue(defaults && ['16:9', '9:16', '1:1', '4:5'].includes(defaults.targetAspectRatio), 400, 'Save a valid layout on the creator profile first.')
    validateClipSettings({ framingConfig: defaults.framingConfig, subtitleSettings: defaults.subtitleDefaults })
    requireValue(defaults.layoutOverlays == null || Array.isArray(defaults.layoutOverlays) && defaults.layoutOverlays.length <= 30, 400, 'Use up to 30 creator layout overlays.')
    await materializeCreatorLayout(defaults, bundle.assets || [], project.id, owner, store, config)
    const settings = validateClipSettings({ framingConfig: defaults.framingConfig, subtitleSettings: defaults.subtitleDefaults })
    project.vodPresetConfig = { presetId: null, targetAspectRatio: defaults.targetAspectRatio, framingConfig: settings.framingConfig, subtitleDefaults: settings.subtitleSettings, layoutOverlays: defaults.layoutOverlays || [], watermarkMode: defaults.watermarkMode || 'creator', customWatermarkSettings: defaults.customWatermarkSettings || null } as ActiveVodPresetConfig
    project.creatorId = profile.id; store.save(project, owner)
    res.json({ project, jobs: [] })
  })
  return router
}
