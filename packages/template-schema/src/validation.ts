import {
  TEMPLATE_SCHEMA_VERSION,
  type RationalTime,
  type TemplateManifest,
} from './types'

export interface TemplateValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

const ID_PATTERN = /^[a-z0-9][a-z0-9._-]*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const WINDOWS_ABSOLUTE_PATTERN = /^[a-zA-Z]:[\\/]/
const SLOT_TYPES = new Set([
  'video',
  'image',
  'media',
  'text',
  'caption',
  'audio',
  'brand',
  'parameter'
])
const ASPECT_RATIOS = new Set(['9:16', '16:9', '1:1', '4:5'])
const TEMPLATE_KINDS = new Set(['style', 'montage', 'hybrid'])
const VISIBILITIES = new Set(['built-in', 'private', 'organization', 'unlisted', 'public'])
const CAPABILITIES = new Set([
  'video',
  'image',
  'audio',
  'text',
  'captions',
  'transitions',
  'effects',
  'keyframes',
  'reverse',
  'speed',
  'crop',
  'mobile-basic'
])

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function validRational(value: unknown): value is RationalTime {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.value) &&
    (value.value as number) >= 0 &&
    Number.isSafeInteger(value.timescale) &&
    (value.timescale as number) > 0
  )
}

export function rationalToMilliseconds(time: RationalTime): number {
  return (time.value * 1000) / time.timescale
}

export function millisecondsToRational(milliseconds: number, timescale = 60_000): RationalTime {
  if (!Number.isFinite(milliseconds) || milliseconds < 0) {
    throw new Error('Milliseconds must be a finite non-negative number')
  }
  if (!Number.isSafeInteger(timescale) || timescale <= 0) {
    throw new Error('Timescale must be a positive integer')
  }
  return { value: Math.round((milliseconds * timescale) / 1000), timescale }
}

function validateSlot(raw: unknown, index: number, errors: string[]): void {
  const path = `slots[${index}]`
  if (!isRecord(raw)) {
    errors.push(`${path} must be an object`)
    return
  }
  const slot = raw as Record<string, unknown>
  const id = typeof slot.id === 'string' ? slot.id : ''
  if (!ID_PATTERN.test(id)) errors.push(`${path}.id is invalid`)
  if (typeof slot.label !== 'string' || !slot.label.trim()) errors.push(`${path}.label is required`)
  if (typeof slot.description !== 'string' || !slot.description.trim())
    errors.push(`${path}.description is required`)
  if (typeof slot.type !== 'string' || !SLOT_TYPES.has(slot.type))
    errors.push(`${path}.type is invalid`)
  if (typeof slot.required !== 'boolean') errors.push(`${path}.required must be boolean`)
  if (!validRational(slot.targetStart)) errors.push(`${path}.targetStart is invalid`)
  if (!validRational(slot.targetDuration) || (slot.targetDuration as RationalTime).value <= 0) {
    errors.push(`${path}.targetDuration must be positive`)
  }
  const sourceDuration = slot.sourceDurationMs
  if (
    !isRecord(sourceDuration) ||
    !Number.isFinite(sourceDuration.min) ||
    (sourceDuration.min as number) < 0 ||
    !Number.isFinite(sourceDuration.preferred) ||
    !Number.isFinite(sourceDuration.max) ||
    (sourceDuration.preferred as number) < (sourceDuration.min as number) ||
    (sourceDuration.max as number) < (sourceDuration.preferred as number)
  ) {
    errors.push(`${path}.sourceDurationMs must be ordered min/preferred/max`)
  }
  if (
    slot.type !== 'text' &&
    slot.type !== 'caption' &&
    slot.type !== 'parameter' &&
    (!Array.isArray(slot.acceptedMimeTypes) ||
      slot.acceptedMimeTypes.length === 0 ||
      slot.acceptedMimeTypes.some((mime) => typeof mime !== 'string' || !mime.trim()))
  ) {
    errors.push(`${path}.acceptedMimeTypes cannot be empty`)
  }
  if (!Array.isArray(slot.mutableProperties) || slot.mutableProperties.some((item) => typeof item !== 'string'))
    errors.push(`${path}.mutableProperties must be a string array`)
  if (!Array.isArray(slot.lockedProperties) || slot.lockedProperties.some((item) => typeof item !== 'string'))
    errors.push(`${path}.lockedProperties must be a string array`)
  if (!Array.isArray(slot.bindings) || slot.bindings.length === 0) {
    errors.push(`${path}.bindings cannot be empty`)
    return
  }
  const bindingIds = new Set<string>()
  slot.bindings.forEach((binding, bindingIndex) => {
    const bindingPath = `${path}.bindings[${bindingIndex}]`
    if (
      !isRecord(binding) ||
      typeof binding.sceneId !== 'string' ||
      !binding.sceneId ||
      typeof binding.trackId !== 'string' ||
      !binding.trackId ||
      typeof binding.elementId !== 'string' ||
      !binding.elementId
    ) {
      errors.push(`${bindingPath} must identify a scene, track, and element`)
      return
    }
    const key = `${binding.sceneId}/${binding.trackId}/${binding.elementId}`
    if (bindingIds.has(key)) errors.push(`${bindingPath} is duplicated`)
    bindingIds.add(key)
  })
}

export function validateTemplateManifest(raw: unknown): TemplateValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  if (!isRecord(raw)) return { valid: false, errors: ['manifest must be an object'], warnings }
  if (!Number.isSafeInteger(raw.schemaVersion)) errors.push('schemaVersion must be an integer')
  else if ((raw.schemaVersion as number) > TEMPLATE_SCHEMA_VERSION) {
    errors.push(`unsupported template schema version ${raw.schemaVersion}`)
  } else if ((raw.schemaVersion as number) < 1) {
    errors.push('schemaVersion must be at least 1')
  }
  const manifest = raw as unknown as TemplateManifest
  for (const [field, value] of [
    ['id', manifest.id],
    ['versionId', manifest.versionId],
    ['name', manifest.name],
    ['version', manifest.version]
  ] as const) {
    if (typeof value !== 'string' || !value.trim()) errors.push(`${field} is required`)
  }
  if (manifest.id && !ID_PATTERN.test(manifest.id)) errors.push('id is invalid')
  if (manifest.versionId && !ID_PATTERN.test(manifest.versionId))
    errors.push('versionId is invalid')
  if (!TEMPLATE_KINDS.has(manifest.kind)) errors.push('kind is invalid')
  if (
    !Array.isArray(manifest.categories) ||
    manifest.categories.length === 0 ||
    manifest.categories.some((item) => typeof item !== 'string' || !item.trim())
  ) {
    errors.push('categories must be a non-empty string array')
  }
  if (!Array.isArray(manifest.tags) || manifest.tags.some((item) => typeof item !== 'string')) {
    errors.push('tags must be a string array')
  }
  if (
    !Array.isArray(manifest.supportedAspectRatios) ||
    manifest.supportedAspectRatios.length === 0
  ) {
    errors.push('supportedAspectRatios cannot be empty')
  } else if (
    manifest.supportedAspectRatios.some(
      (aspect) => typeof aspect !== 'string' || !ASPECT_RATIOS.has(aspect)
    )
  ) {
    errors.push('supportedAspectRatios contains an invalid value')
  } else if (!manifest.supportedAspectRatios.includes(manifest.defaultAspectRatio)) {
    errors.push('defaultAspectRatio must be supported')
  }
  if (
    !manifest.duration ||
    !Number.isFinite(manifest.duration.minMs) ||
    !Number.isFinite(manifest.duration.maxMs) ||
    manifest.duration.minMs <= 0 ||
    manifest.duration.maxMs < manifest.duration.minMs
  ) {
    errors.push('duration range is invalid')
  }
  if (
    !manifest.fps ||
    !Number.isSafeInteger(manifest.fps.numerator) ||
    manifest.fps.numerator <= 0 ||
    !Number.isSafeInteger(manifest.fps.denominator) ||
    manifest.fps.denominator <= 0
  ) {
    errors.push('fps must be a positive rational')
  }
  if (
    !Array.isArray(manifest.requiredCapabilities) ||
    manifest.requiredCapabilities.some(
      (capability) => typeof capability !== 'string' || !CAPABILITIES.has(capability)
    )
  ) {
    errors.push('requiredCapabilities contains an invalid value')
  }
  if (!Array.isArray(manifest.slots) || manifest.slots.length === 0) {
    errors.push('slots cannot be empty')
  } else {
    const slotIds = new Set<string>()
    manifest.slots.forEach((slot, index) => {
      validateSlot(slot, index, errors)
      if (!isRecord(slot) || typeof slot.id !== 'string') return
      if (slotIds.has(slot.id)) errors.push(`slots[${index}].id is duplicated`)
      slotIds.add(slot.id)
    })
  }
  const anchorIds = new Set<string>()
  if (!Array.isArray(manifest.anchors)) errors.push('anchors must be an array')
  else {
    manifest.anchors.forEach((rawAnchor, index) => {
      const path = `anchors[${index}]`
      if (!isRecord(rawAnchor)) {
        errors.push(`${path} must be an object`)
        return
      }
      const id = typeof rawAnchor.id === 'string' ? rawAnchor.id : ''
      if (!ID_PATTERN.test(id)) errors.push(`${path}.id is invalid`)
      if (anchorIds.has(id)) errors.push(`${path}.id is duplicated`)
      anchorIds.add(id)
      if (
        typeof rawAnchor.type !== 'string' ||
        !['beat', 'downbeat', 'cut', 'lyric', 'effect', 'custom'].includes(rawAnchor.type)
      )
        errors.push(`${path}.type is invalid`)
      if (!validRational(rawAnchor.time)) errors.push(`${path}.time is invalid`)
      if (
        !Number.isFinite(rawAnchor.confidence) ||
        (rawAnchor.confidence as number) < 0 ||
        (rawAnchor.confidence as number) > 1
      )
        errors.push(`${path}.confidence must be between 0 and 1`)
      if (typeof rawAnchor.analyzerVersion !== 'string' || !rawAnchor.analyzerVersion.trim())
        errors.push(`${path}.analyzerVersion is required`)
      if (typeof rawAnchor.manuallyCorrected !== 'boolean')
        errors.push(`${path}.manuallyCorrected must be boolean`)
      if (
        typeof rawAnchor.timingPolicy !== 'string' ||
        !['locked', 'elastic', 'free'].includes(rawAnchor.timingPolicy)
      )
        errors.push(`${path}.timingPolicy is invalid`)
      if (
        rawAnchor.targetElementIds !== undefined &&
        (!Array.isArray(rawAnchor.targetElementIds) ||
          rawAnchor.targetElementIds.some((target) => typeof target !== 'string'))
      )
        errors.push(`${path}.targetElementIds must be a string array`)
    })
  }
  const assetIds = new Set<string>()
  if (!Array.isArray(manifest.assets)) errors.push('assets must be an array')
  else {
    manifest.assets.forEach((rawAsset, index) => {
      const path = `assets[${index}]`
      if (!isRecord(rawAsset)) {
        errors.push(`${path} must be an object`)
        return
      }
      const asset = rawAsset as unknown as TemplateManifest['assets'][number]
      if (!ID_PATTERN.test(asset.id)) errors.push(`${path}.id is invalid`)
      if (assetIds.has(asset.id)) errors.push(`${path}.id is duplicated`)
      assetIds.add(asset.id)
      if (!SHA256_PATTERN.test(asset.sha256)) errors.push(`${path}.sha256 is invalid`)
      if (!Number.isSafeInteger(asset.byteSize) || asset.byteSize < 0)
        errors.push(`${path}.byteSize is invalid`)
      if (
        typeof asset.path !== 'string' ||
        !asset.path ||
        asset.path.startsWith('/') ||
        asset.path.startsWith('\\\\') ||
        WINDOWS_ABSOLUTE_PATTERN.test(asset.path) ||
        asset.path.split(/[\\/]/).includes('..') ||
        asset.path.includes('\0')
      ) {
        errors.push(`${path}.path must be a safe relative path`)
      }
      if (asset.redistributable && !asset.rights?.redistribution) {
        errors.push(`${path}.rights do not permit redistribution`)
      }
      if (!asset.rights?.proofReference) errors.push(`${path}.rights.proofReference is required`)
      if (
        typeof asset.mimeType !== 'string' ||
        !asset.mimeType.includes('/') ||
        typeof asset.required !== 'boolean' ||
        typeof asset.redistributable !== 'boolean'
      ) {
        errors.push(`${path} has invalid media metadata`)
      }
    })
  }
  if (typeof manifest.coverAssetId !== 'string' || !assetIds.has(manifest.coverAssetId))
    errors.push('coverAssetId does not reference an asset')
  if (!assetIds.has(manifest.previewAssetId))
    errors.push('previewAssetId does not reference an asset')
  if (typeof manifest.accessibility?.reducedMotion !== 'boolean')
    errors.push('accessibility.reducedMotion must be boolean')
  if (
    typeof manifest.accessibility?.description !== 'string' ||
    !manifest.accessibility.description.trim()
  )
    errors.push('accessibility.description is required')
  if (
    !Number.isFinite(manifest.accessibility?.flashesPerSecond) ||
    manifest.accessibility.flashesPerSecond < 0 ||
    manifest.accessibility.flashesPerSecond > 3
  ) {
    errors.push('accessibility.flashesPerSecond must be between 0 and 3')
  }
  const safeZone = manifest.accessibility?.captionSafeZone
  if (
    !safeZone ||
    [safeZone.top, safeZone.right, safeZone.bottom, safeZone.left].some(
      (value) => !Number.isFinite(value) || value < 0 || value > 1
    )
  ) {
    errors.push('accessibility.captionSafeZone must contain values between 0 and 1')
  }
  if (!manifest.rights?.clearedForEditableRedistribution) {
    warnings.push('template is not cleared for editable redistribution')
  }
  if (
    typeof manifest.rights?.clearedForEditableRedistribution !== 'boolean' ||
    typeof manifest.rights?.attributionRequired !== 'boolean' ||
    typeof manifest.rights?.notes !== 'string'
  ) {
    errors.push('rights summary is invalid')
  }
  if (
    !manifest.author ||
    typeof manifest.author.id !== 'string' ||
    !manifest.author.id ||
    typeof manifest.author.name !== 'string' ||
    !manifest.author.name.trim()
  ) {
    errors.push('author is invalid')
  }
  if (!VISIBILITIES.has(manifest.visibility)) errors.push('visibility is invalid')
  const presentation = manifest.presentation
  if (!presentation || typeof presentation !== 'object') {
    errors.push('presentation is required')
  } else {
    if (!['cut', 'crossfade', 'dissolve', 'wipe', 'flash'].includes(presentation.transition))
      errors.push('presentation.transition is invalid')
    if (!validRational(presentation.transitionDuration))
      errors.push('presentation.transitionDuration is invalid')
    if (
      !['neutral', 'warm', 'cool', 'vibrant', 'cinematic', 'monochrome'].includes(
        presentation.colorTreatment
      )
    )
      errors.push('presentation.colorTreatment is invalid')
    if (!['none', 'vignette', 'grain', 'sharpen', 'glitch'].includes(presentation.effect))
      errors.push('presentation.effect is invalid')
    if (
      !Number.isFinite(presentation.effectIntensity) ||
      presentation.effectIntensity < 0 ||
      presentation.effectIntensity > 100
    )
      errors.push('presentation.effectIntensity must be between 0 and 100')
    if (!['none', 'subtle-zoom', 'punch-in', 'pan-zoom'].includes(presentation.motion))
      errors.push('presentation.motion is invalid')
    if (typeof presentation.accentColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(presentation.accentColor))
      errors.push('presentation.accentColor is invalid')
    if (
      !presentation.title ||
      typeof presentation.title.text !== 'string' ||
      !validRational(presentation.title.duration) ||
      !['top', 'center', 'bottom'].includes(presentation.title.position) ||
      !['clean', 'bold', 'documentary', 'neon', 'label'].includes(presentation.title.style)
    )
      errors.push('presentation.title is invalid')
  }
  if (
    typeof manifest.compatibility?.desktop !== 'boolean' ||
    typeof manifest.compatibility?.android !== 'boolean' ||
    typeof manifest.compatibility?.ios !== 'boolean'
  ) {
    errors.push('compatibility flags must be boolean')
  } else if (
    !manifest.compatibility.desktop &&
    !manifest.compatibility.android &&
    !manifest.compatibility.ios
  ) {
    errors.push('at least one platform must be compatible')
  }
  return { valid: errors.length === 0, errors, warnings }
}

export function parseTemplateManifest(raw: unknown): TemplateManifest {
  const result = validateTemplateManifest(raw)
  if (!result.valid) throw new Error(`Invalid template manifest: ${result.errors.join('; ')}`)
  return raw as TemplateManifest
}
