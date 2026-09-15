export const TEMPLATE_SCHEMA_VERSION = 1 as const
export const TEMPLATE_COMPILER_VERSION = '1.0.0'
export const TEMPLATE_ANALYZER_VERSION = 'local-heuristic-1'

export type TemplateKind = 'style' | 'montage' | 'hybrid'
export type TemplateAspectRatio = '9:16' | '16:9' | '1:1' | '4:5'
export type TemplateSlotType =
  | 'video'
  | 'image'
  | 'media'
  | 'text'
  | 'caption'
  | 'audio'
  | 'brand'
  | 'parameter'
export type TemplateSemanticRole =
  | 'hook'
  | 'speech'
  | 'action'
  | 'reaction-shot'
  | 'product'
  | 'establishing'
  | 'detail'
  | 'payoff'
  | 'outro'
  | 'b-roll'
  | 'before'
  | 'after'
  | 'step'
  | 'item'
  | 'headline'
  | 'cta'
  | 'music'
export type SourceAudioPolicy = 'keep' | 'mute' | 'duck' | 'replace' | 'creator-selectable'
export type TemplateCapability =
  | 'video'
  | 'image'
  | 'audio'
  | 'text'
  | 'captions'
  | 'transitions'
  | 'effects'
  | 'keyframes'
  | 'reverse'
  | 'speed'
  | 'crop'
  | 'mobile-basic'

export interface RationalTime {
  value: number
  timescale: number
}

export interface TemplateBindingTarget {
  sceneId: string
  trackId: string
  elementId: string
}

export interface TemplateSlot {
  id: string
  label: string
  role: TemplateSemanticRole
  description: string
  type: TemplateSlotType
  required: boolean
  acceptedMimeTypes: string[]
  orientation: 'any' | 'portrait' | 'landscape' | 'square'
  sourceDurationMs: { min: number; preferred: number; max: number }
  targetDuration: RationalTime
  targetStart: RationalTime
  allowSourceReuse: boolean
  groupId?: string
  minimumSeparationMs?: number
  fit: 'cover' | 'contain'
  focalPolicy: 'center' | 'subject' | 'creator'
  sourceAudioPolicy: SourceAudioPolicy
  trimBehavior: 'trim' | 'slip' | 'fit'
  allowSpeed: boolean
  allowReverse: boolean
  allowLoop: boolean
  mutableProperties: string[]
  lockedProperties: string[]
  fallback: 'error' | 'omit' | 'reuse' | 'freeze' | 'default'
  bindings: TemplateBindingTarget[]
}

export interface TemplateAnchor {
  id: string
  type: 'beat' | 'downbeat' | 'cut' | 'lyric' | 'effect' | 'custom'
  time: RationalTime
  confidence: number
  analyzerVersion: string
  manuallyCorrected: boolean
  timingPolicy: 'locked' | 'elastic' | 'free'
  targetElementIds?: string[]
}

export interface TemplateAssetRights {
  rightsHolder: string
  license: string
  licenseUrl?: string
  proofReference: string
  attribution?: string
  commercialUse: boolean
  redistribution: boolean
  platformRestrictions: string[]
  territoryRestrictions: string[]
  expiresAt?: string
  aiDisclosure?: string
}

export interface TemplateAssetRef {
  id: string
  role: 'cover' | 'preview' | 'music' | 'font' | 'effect' | 'sticker' | 'lut' | 'other'
  sha256: string
  byteSize: number
  mimeType: string
  path: string
  required: boolean
  fallback: 'error' | 'omit' | 'substitute'
  redistributable: boolean
  rights: TemplateAssetRights
}

export interface TemplateAccessibility {
  reducedMotion: boolean
  reducedMotionVariantId?: string
  flashesPerSecond: number
  captionSafeZone: { top: number; right: number; bottom: number; left: number }
  description: string
}

export interface TemplateRightsSummary {
  clearedForEditableRedistribution: boolean
  attributionRequired: boolean
  notes: string
}

export interface TemplateAuthor {
  id: string
  name: string
  organizationId?: string
}

export interface TemplateCompatibility {
  desktop: boolean
  android: boolean
  ios: boolean
  unsupportedByPlatform: Partial<Record<'desktop' | 'android' | 'ios', string[]>>
}

export interface TemplatePresentation {
  transition: 'cut' | 'crossfade' | 'dissolve' | 'wipe' | 'flash'
  transitionDuration: RationalTime
  colorTreatment: 'neutral' | 'warm' | 'cool' | 'vibrant' | 'cinematic' | 'monochrome'
  effect: 'none' | 'vignette' | 'grain' | 'sharpen' | 'glitch'
  effectIntensity: number
  motion: 'none' | 'subtle-zoom' | 'punch-in' | 'pan-zoom'
  accentColor: string
  title: {
    text: string
    duration: RationalTime
    position: 'top' | 'center' | 'bottom'
    style: 'clean' | 'bold' | 'documentary' | 'neon' | 'label'
  }
}

export interface TemplateManifest {
  schemaVersion: number
  id: string
  versionId: string
  version: string
  name: string
  description: string
  kind: TemplateKind
  categories: string[]
  tags: string[]
  supportedAspectRatios: TemplateAspectRatio[]
  defaultAspectRatio: TemplateAspectRatio
  duration: { mode: 'fixed' | 'elastic' | 'source'; minMs: number; maxMs: number }
  fps: { numerator: number; denominator: number }
  minimumAppVersion: string
  requiredCapabilities: TemplateCapability[]
  coverAssetId: string
  previewAssetId: string
  slots: TemplateSlot[]
  anchors: TemplateAnchor[]
  assets: TemplateAssetRef[]
  accessibility: TemplateAccessibility
  rights: TemplateRightsSummary
  author: TemplateAuthor
  visibility: 'built-in' | 'private' | 'organization' | 'unlisted' | 'public'
  compatibility: TemplateCompatibility
  presentation: TemplatePresentation
}

export interface TemplateSourceRange {
  assetId: string
  sourceFingerprint: string
  type: 'video' | 'image' | 'audio'
  mimeType?: string
  startMs: number
  endMs: number
  durationMs: number
  width?: number
  height?: number
  hasAudio?: boolean
  transcriptText?: string
  score?: number
  tags?: string[]
}

export interface TemplateBinding {
  slotId: string
  assetId: string
  sourceFingerprint: string
  sourceStartMs: number
  sourceEndMs: number
  score: number
  reasonCodes: string[]
  locked: boolean
}

export interface TemplateInstanceProvenance {
  templateId: string
  templateVersionId: string
  compilerVersion: string
  analyzerVersion: string
  seed: number
  sourceLineage: Array<{ assetId: string; sourceFingerprint: string }>
  bindings: TemplateBinding[]
  createdAt: string
}

export interface TemplateAssignmentResult {
  bindings: TemplateBinding[]
  alternatives: Record<string, TemplateBinding[]>
  warnings: string[]
  analyzerVersion: string
  seed: number
}

export interface BeatMap {
  sourceFingerprint: string
  analyzerVersion: string
  sampleRate: number
  bpm: number | null
  confidence: number
  beats: RationalTime[]
  downbeats: RationalTime[]
  manuallyCorrected: boolean
}
