import { Router } from 'express'
import { copyFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { clipWords } from '@clippster/shared-types'
import type { WebClip } from '@clippster/shared-types'
import type { Store } from './store'
import type { Config } from './config'
import type { Jobs } from './jobs'
import { requireValue } from './errors'
import { prepareClipPreview } from './clipPreviewRoutes'
import { projectDirectory } from './storage'
export function manualClipProjectRoutes(store: Store, config: Config, jobs: Jobs) {
  const router = Router()
  router.post('/projects/:id/clips/:clipId/project', async (req, res) => {
    const owner = res.locals.session.owner, parent = store.get(String(req.params.id), owner), clip = parent.clips.find(value => value.id === req.params.clipId)
    jobs.assertIdle(parent.id, owner); requireValue(clip && parent.status === 'ready', 404, 'Clip not found.')
    if (clip.linkedProjectId) { res.json({ project: store.get(clip.linkedProjectId, owner), jobs: [] }); return }
    requireValue(store.list(owner).length < config.maxProjects, 400, 'Project limit reached. Delete a project first.')
    const source = await prepareClipPreview(store, config, owner, parent.id, clip.id), project = store.create(`Manual Clip - ${clip.name}`.slice(0, 120), owner), directory = projectDirectory(config, project.id), duration = clip.segments.reduce((sum, part) => sum + part.end_time - part.start_time, 0)
    try {
      await mkdir(directory, { recursive: true }); await copyFile(source, join(directory, 'source.mp4'))
      const words = clipWords(clip.subtitleWords || parent.words, clip.segments)
      const saved = JSON.parse(JSON.stringify(clip)) as WebClip, copied = new Map<string, string>()
      const preset = JSON.parse(JSON.stringify(parent.vodPresetConfig || null)) as typeof parent.vodPresetConfig
      const configs = [saved.framingConfig, ...Object.values(saved.framingConfigs || {}), preset?.framingConfig]
      const regions = configs.flatMap(config => [...(config?.regions || []), ...(config?.segmentConfigs?.flatMap(part => part.regions) || []), ...(config?.brollConfigs?.map(part => part.region) || [])])
      const overlays = (preset?.layoutOverlays || []).flatMap(overlay => [overlay, ...Object.values(overlay.perRatioSettings || {}).filter(Boolean)]) as Array<Record<string, any>>
      regions.push(...overlays.filter(value => value.imagePath).map(value => ({ mediaAssetId: value.imagePath } as (typeof regions)[number])))
      for (const region of regions) if (region.mediaAssetId) {
        const originalId = region.mediaAssetId
        if (!copied.has(originalId)) {
          const asset = store.db.prepare('SELECT name,type FROM framing_assets WHERE id = ? AND project_id = ? AND owner = ?').get(originalId, parent.id, owner) as { name: string; type: string } | undefined
          requireValue(asset, 404, 'Framing media is no longer available.')
          const id = randomUUID(), extension = asset.type === 'image' ? 'png' : 'mp4'
          await mkdir(join(directory, 'assets'), { recursive: true }); await copyFile(join(projectDirectory(config, parent.id), 'assets', `${originalId}.${extension}`), join(directory, 'assets', `${id}.${extension}`))
          store.db.prepare('INSERT INTO framing_assets VALUES (?, ?, ?, ?, ?)').run(id, project.id, owner, asset.name, asset.type); copied.set(originalId, id)
        }
        region.mediaAssetId = copied.get(originalId)
      }
      for (const overlay of overlays) if (copied.has(overlay.imagePath)) overlay.imagePath = copied.get(overlay.imagePath)
      Object.assign(project, { status: 'ready', creatorId: parent.creatorId, sourcePlatform: parent.sourcePlatform, sourceChannel: parent.sourceChannel, vodPresetConfig: preset, width: parent.width, height: parent.height, hasAudio: parent.hasAudio, duration, description: 'Manual clip saved from Quick Publish wizard', words, transcriptRanges: words.length ? [{ start: 0, end: duration }] : [], clips: [{ ...saved, id: randomUUID(), linkedProjectId: undefined, segments: [{ start_time: 0, end_time: duration, duration, transcript: words.map(word => word.word).join(' ') }], subtitleWords: words, revision: 1, builtRevision: null, builds: [] }] })
      store.save(project, owner); clip.linkedProjectId = project.id; store.save(parent, owner)
      res.status(201).json({ project, jobs: [] })
    } catch (cause) { store.delete(project.id, owner); await rm(directory, { recursive: true, force: true }); throw cause }
  })
  return router
}
