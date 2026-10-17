import { randomUUID } from 'node:crypto'
import { mkdir, mkdtemp, rm, rename } from 'node:fs/promises'
import { join } from 'node:path'
import type { Config } from './config'
import type { Store } from './store'
import { projectDirectory, checkStorage } from './storage'
import { downloadAsset } from './network'
import { run } from './process'
import { requireValue } from './errors'
export interface CreatorLayoutAsset { id: number; url: string; asset_type: string }
/** Resolve profile images through the authenticated account asset list, never arbitrary layout paths. */
export async function materializeCreatorLayout(defaults: any, assets: CreatorLayoutAsset[], projectId: string, owner: string, store: Store, config: Config) {
  const directory = join(projectDirectory(config, projectId), 'assets'), imported = new Map<number, string>()
  const count = store.db.prepare('SELECT COUNT(*) AS count FROM framing_assets WHERE project_id = ?').get(projectId) as { count: number }
  await mkdir(directory, { recursive: true })
  async function image(reference: string, assetId?: number) {
    const asset = assets.find(value => assetId ? value.id === assetId : value.url === reference)
    requireValue(asset, 400, 'Upload this creator layout image to your account before using it on web.')
    if (imported.has(asset.id)) return imported.get(asset.id)!
    requireValue(count.count + imported.size < 30, 400, 'This layout exceeds the project media limit.')
    await checkStorage(store, config, owner)
    const work = await mkdtemp(join(directory, 'creator-')), id = randomUUID(), signal = AbortSignal.timeout(60000)
    try {
      await downloadAsset(asset.url, join(work, 'input'), signal, 32 * 1024 ** 2)
      const metadata = JSON.parse(await run(config.ffprobe, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'png_pipe,jpeg_pipe,mjpeg,webp_pipe', '-show_streams', '-of', 'json', join(work, 'input')], signal)).streams?.[0]
      requireValue(metadata?.width > 0 && metadata.width <= 7680 && metadata.height > 0 && metadata.height <= 4320, 400, 'Use a creator layout image up to 8K.')
      await run(config.ffmpeg, ['-v', 'error', '-protocol_whitelist', 'file,pipe', '-format_whitelist', 'png_pipe,jpeg_pipe,mjpeg,webp_pipe', '-i', join(work, 'input'), '-frames:v', '1', '-threads', '1', '-y', join(work, 'image.png')], signal)
      await rename(join(work, 'image.png'), join(directory, `${id}.png`))
      store.db.prepare('INSERT INTO framing_assets VALUES (?, ?, ?, ?, ?)').run(id, projectId, owner, 'Creator layout image', 'image')
      imported.set(asset.id, id); return id
    } finally { await rm(work, { recursive: true, force: true }) }
  }
  try {
    const configs = [defaults.framingConfig]
    for (const config of configs.filter(Boolean)) for (const region of [...(config.regions || []), ...(config.segmentConfigs?.flatMap((part: any) => part.regions) || []), ...(config.brollConfigs?.map((part: any) => part.region) || [])]) {
      if (region.mediaType === 'image' && region.mediaLocalPath) { region.mediaAssetId = await image(region.mediaLocalPath, region.assetId); delete region.mediaLocalPath }
    }
    for (const overlay of defaults.layoutOverlays || []) {
      overlay.imagePath = await image(overlay.imagePath, overlay.assetId)
      for (const setting of Object.values(overlay.perRatioSettings || {}) as any[]) if (setting?.imagePath || setting?.assetId) setting.imagePath = await image(setting.imagePath || '', setting.assetId)
    }
  } catch (cause) {
    for (const id of imported.values()) { store.db.prepare('DELETE FROM framing_assets WHERE id = ? AND project_id = ? AND owner = ?').run(id, projectId, owner); await rm(join(directory, `${id}.png`), { force: true }) }
    throw cause
  }
}
