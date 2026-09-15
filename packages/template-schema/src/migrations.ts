import { TEMPLATE_SCHEMA_VERSION, type TemplateManifest } from './types'
import { parseTemplateManifest } from './validation'

export interface MigratedTemplateManifest {
  manifest: TemplateManifest
  sourceSchemaVersion: number
  migrated: boolean
}

/**
 * Definitions are cloned before migration so imported source packages remain immutable.
 * Unknown optional fields survive because migrations use object spreads.
 */
export function migrateTemplateManifest(raw: unknown): MigratedTemplateManifest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Template manifest must be an object')
  }
  const cloned = JSON.parse(JSON.stringify(raw)) as Record<string, unknown>
  const sourceSchemaVersion = Number(cloned.schemaVersion)
  if (!Number.isSafeInteger(sourceSchemaVersion) || sourceSchemaVersion < 1) {
    throw new Error('Template schemaVersion is missing or invalid')
  }
  if (sourceSchemaVersion > TEMPLATE_SCHEMA_VERSION) {
    throw new Error(`Unsupported template schema version ${sourceSchemaVersion}`)
  }
  // Version 1 is the first public schema. Future migrations are appended here,
  // one deterministic step at a time, without mutating `raw`.
  return {
    manifest: parseTemplateManifest(cloned),
    sourceSchemaVersion,
    migrated: sourceSchemaVersion !== TEMPLATE_SCHEMA_VERSION
  }
}
