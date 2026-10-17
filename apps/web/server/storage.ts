import { readdir, stat, statfs, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { Store } from './store'
import type { Config } from './config'
import { requireValue } from './errors'
export async function directoryBytes(directory: string): Promise<number> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => [])
  let bytes = 0
  for (const entry of entries) {
    const path = join(directory, entry.name)
    bytes += entry.isDirectory()
      ? await directoryBytes(path)
      : (await stat(path).catch(() => ({ size: 0 }))).size
  }
  return bytes
}
export function projectDirectory(config: Config, id: string) {
  return join(config.dataDir, 'media', id)
}
export async function checkStorage(store: Store, config: Config, owner: string) {
  let total = 0
  for (const project of store.list(owner))
    total += await directoryBytes(projectDirectory(config, project.id))
  requireValue(
    total + config.maxSourceBytes <= config.userStorageBytes,
    413,
    'Storage limit reached. Delete a project before importing or building more media.'
  )
  const disk = await statfs(config.dataDir)
  requireValue(
    disk.bavail * disk.bsize > config.maxSourceBytes * 2,
    507,
    'Media storage is full. Please try later.'
  )
}
export async function resetWorkDirectory(directory: string) {
  const work = join(directory, 'work')
  await rm(work, { recursive: true, force: true })
  await mkdir(work, { recursive: true })
  return work
}
