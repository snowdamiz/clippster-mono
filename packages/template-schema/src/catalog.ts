import {
  TEMPLATE_ANALYZER_VERSION,
  TEMPLATE_SCHEMA_VERSION,
  type TemplateAspectRatio,
  type TemplateKind,
  type TemplateManifest,
  type TemplatePresentation,
  type TemplateSemanticRole,
  type TemplateSlot,
  type TemplateSlotType
} from './types'

const SHA256_EMPTY = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'

interface BuiltInSpec {
  id: string
  name: string
  description: string
  kind: TemplateKind
  category: string
  aspects: TemplateAspectRatio[]
  minMs: number
  maxMs: number
  roles: TemplateSemanticRole[]
  type?: TemplateSlotType
  audio?: 'keep' | 'mute' | 'duck' | 'replace' | 'creator-selectable'
  transitions?: boolean
  reducedMotion?: boolean
}

const SPECS: BuiltInSpec[] = [
  {
    id: 'clean-podcast',
    name: 'Clean Podcast',
    description: 'Readable captions, restrained punch-ins, and an optional speaker lower third.',
    kind: 'style',
    category: 'Talking',
    aspects: ['9:16', '16:9'],
    minMs: 20_000,
    maxMs: 60_000,
    roles: ['speech'],
    audio: 'duck'
  },
  {
    id: 'story-hook',
    name: 'Story Hook',
    description:
      'Headline-led story pacing with a hook, progressive captions, and payoff emphasis.',
    kind: 'style',
    category: 'Talking',
    aspects: ['9:16', '4:5'],
    minMs: 12_000,
    maxMs: 35_000,
    roles: ['hook', 'speech', 'payoff'],
    audio: 'duck'
  },
  {
    id: 'news-breakdown',
    name: 'News Breakdown',
    description: 'Neutral documentary treatment with headline and optional contextual B-roll.',
    kind: 'hybrid',
    category: 'Information',
    aspects: ['9:16', '16:9'],
    minMs: 20_000,
    maxMs: 60_000,
    roles: ['hook', 'speech', 'b-roll', 'outro'],
    audio: 'duck'
  },
  {
    id: 'fast-tutorial',
    name: 'Fast Tutorial',
    description: 'Numbered steps, clean transitions, and optional detail shots.',
    kind: 'hybrid',
    category: 'Information',
    aspects: ['9:16', '1:1', '16:9'],
    minMs: 15_000,
    maxMs: 45_000,
    roles: ['hook', 'step', 'step', 'step', 'payoff'],
    audio: 'duck',
    transitions: true
  },
  {
    id: 'streamer-reaction',
    name: 'Streamer Reaction',
    description: 'Gameplay and reaction pacing with action and payoff emphasis.',
    kind: 'hybrid',
    category: 'Gaming',
    aspects: ['9:16', '16:9'],
    minMs: 10_000,
    maxMs: 35_000,
    roles: ['hook', 'action', 'reaction-shot', 'payoff'],
    audio: 'keep',
    transitions: true
  },
  {
    id: 'product-spotlight',
    name: 'Product Spotlight',
    description: 'Presenter, product details, feature callouts, and a closing CTA.',
    kind: 'hybrid',
    category: 'Business',
    aspects: ['9:16', '1:1', '16:9'],
    minMs: 12_000,
    maxMs: 30_000,
    roles: ['hook', 'product', 'detail', 'cta'],
    audio: 'duck',
    transitions: true
  },
  {
    id: 'gaming-hype',
    name: 'Gaming Hype',
    description: 'Fast action cuts, reaction hold, and restrained beat accents.',
    kind: 'montage',
    category: 'Gaming',
    aspects: ['9:16', '16:9'],
    minMs: 12_000,
    maxMs: 16_000,
    roles: [
      'hook',
      'action',
      'action',
      'action',
      'action',
      'reaction-shot',
      'action',
      'action',
      'payoff',
      'outro'
    ],
    audio: 'mute',
    transitions: true
  },
  {
    id: 'beat-drop',
    name: 'Beat Drop',
    description: 'Build-up shots followed by a downbeat reveal and rapid cuts.',
    kind: 'montage',
    category: 'Beat Sync',
    aspects: ['9:16'],
    minMs: 10_000,
    maxMs: 14_000,
    roles: ['establishing', 'detail', 'hook', 'payoff', 'action', 'action', 'detail', 'outro'],
    type: 'media',
    audio: 'mute',
    transitions: true
  },
  {
    id: 'best-moments',
    name: 'Best Moments',
    description: 'A chronological highlight arc from hook through strongest moment and outro.',
    kind: 'montage',
    category: 'Highlights',
    aspects: ['9:16', '16:9'],
    minMs: 16_000,
    maxMs: 24_000,
    roles: ['hook', 'action', 'action', 'reaction-shot', 'payoff', 'outro'],
    audio: 'keep',
    transitions: true
  },
  {
    id: 'cinematic-recap',
    name: 'Cinematic Recap',
    description: 'Measured establishing, detail, people, and payoff shots with soft transitions.',
    kind: 'montage',
    category: 'Lifestyle',
    aspects: ['9:16', '4:5', '16:9'],
    minMs: 18_000,
    maxMs: 30_000,
    roles: ['establishing', 'detail', 'detail', 'reaction-shot', 'action', 'payoff'],
    audio: 'duck',
    transitions: true,
    reducedMotion: true
  },
  {
    id: 'photo-motion',
    name: 'Photo Motion',
    description: 'Animated photo and video holds with an optional date caption.',
    kind: 'montage',
    category: 'Photos',
    aspects: ['9:16', '1:1'],
    minMs: 12_000,
    maxMs: 18_000,
    roles: [
      'establishing',
      'detail',
      'detail',
      'item',
      'item',
      'item',
      'item',
      'reaction-shot',
      'payoff',
      'outro'
    ],
    type: 'media',
    audio: 'mute',
    transitions: true,
    reducedMotion: true
  },
  {
    id: 'before-after',
    name: 'Before & After',
    description: 'Clear before, transition, after, and detail comparison.',
    kind: 'montage',
    category: 'Transformation',
    aspects: ['9:16', '1:1', '16:9'],
    minMs: 8_000,
    maxMs: 14_000,
    roles: ['before', 'detail', 'after', 'payoff'],
    type: 'media',
    audio: 'mute',
    transitions: true
  },
  {
    id: 'event-recap',
    name: 'Event Recap',
    description: 'Establishing, crowd, detail, action, speaker, and closing event coverage.',
    kind: 'montage',
    category: 'Events',
    aspects: ['9:16', '16:9'],
    minMs: 18_000,
    maxMs: 30_000,
    roles: [
      'establishing',
      'detail',
      'reaction-shot',
      'action',
      'detail',
      'speech',
      'payoff',
      'outro'
    ],
    audio: 'duck',
    transitions: true
  },
  {
    id: 'fast-listicle',
    name: 'Fast Listicle',
    description: 'Hook plus ranked items synchronized with simple title cards.',
    kind: 'hybrid',
    category: 'Information',
    aspects: ['9:16', '1:1'],
    minMs: 15_000,
    maxMs: 30_000,
    roles: ['hook', 'item', 'item', 'item', 'item', 'payoff'],
    audio: 'duck',
    transitions: true
  }
]

function slotCopy(role: TemplateSemanticRole): { label: string; description: string } {
  const label = role.replaceAll('-', ' ')
  const article = /^[aeiou]/i.test(label) ? 'an' : 'a'
  const noun = /\bshot$/.test(label) ? label : `${label} shot`
  return {
    label,
    description: `Choose ${article} ${noun} with clear framing and enough duration.`
  }
}

function makeSlot(spec: BuiltInSpec, role: TemplateSemanticRole, index: number): TemplateSlot {
  const count = spec.roles.length
  const durationMs = Math.floor(spec.maxMs / count)
  const startMs = durationMs * index
  const id = `${role}-${index + 1}`
  const type = spec.type ?? 'video'
  const copy = slotCopy(role)
  return {
    id,
    label: `${copy.label} ${index + 1}`,
    role,
    description: copy.description,
    type,
    required: index < Math.max(1, count - 1),
    acceptedMimeTypes: type === 'media' ? ['video/*', 'image/*'] : ['video/*'],
    orientation: 'any',
    sourceDurationMs: {
      min: Math.min(500, durationMs),
      preferred: durationMs,
      max: Math.max(durationMs * 3, 3000)
    },
    targetDuration: { value: durationMs, timescale: 1000 },
    targetStart: { value: startMs, timescale: 1000 },
    allowSourceReuse: true,
    groupId: role,
    minimumSeparationMs: Math.min(1500, durationMs),
    fit: 'cover',
    focalPolicy: 'subject',
    sourceAudioPolicy: spec.audio ?? 'creator-selectable',
    trimBehavior: 'slip',
    allowSpeed: true,
    allowReverse: false,
    allowLoop: type === 'image',
    mutableProperties: [
      'source',
      'trim',
      'crop',
      'focalPoint',
      'fit',
      'sourceAudioPolicy',
      'volume'
    ],
    lockedProperties: ['targetStart', 'targetDuration'],
    fallback: index === 0 ? 'error' : 'reuse',
    bindings: [{ sceneId: 'scene-main', trackId: 'track-video-main', elementId: `element-${id}` }]
  }
}

function presentationFor(spec: BuiltInSpec): TemplatePresentation {
  const styleById: Record<
    string,
    Pick<
      TemplatePresentation,
      'transition' | 'colorTreatment' | 'effect' | 'effectIntensity' | 'motion' | 'accentColor'
    >
  > = {
    'clean-podcast': {
      transition: 'crossfade',
      colorTreatment: 'neutral',
      effect: 'sharpen',
      effectIntensity: 12,
      motion: 'subtle-zoom',
      accentColor: '#3b82f6'
    },
    'story-hook': {
      transition: 'crossfade',
      colorTreatment: 'vibrant',
      effect: 'sharpen',
      effectIntensity: 18,
      motion: 'punch-in',
      accentColor: '#f97316'
    },
    'news-breakdown': {
      transition: 'dissolve',
      colorTreatment: 'cool',
      effect: 'vignette',
      effectIntensity: 14,
      motion: 'subtle-zoom',
      accentColor: '#dc2626'
    },
    'fast-tutorial': {
      transition: 'wipe',
      colorTreatment: 'vibrant',
      effect: 'sharpen',
      effectIntensity: 16,
      motion: 'punch-in',
      accentColor: '#22c55e'
    },
    'streamer-reaction': {
      transition: 'wipe',
      colorTreatment: 'vibrant',
      effect: 'glitch',
      effectIntensity: 12,
      motion: 'punch-in',
      accentColor: '#a855f7'
    },
    'product-spotlight': {
      transition: 'dissolve',
      colorTreatment: 'warm',
      effect: 'vignette',
      effectIntensity: 10,
      motion: 'pan-zoom',
      accentColor: '#06b6d4'
    },
    'gaming-hype': {
      transition: 'wipe',
      colorTreatment: 'vibrant',
      effect: 'glitch',
      effectIntensity: 18,
      motion: 'punch-in',
      accentColor: '#e879f9'
    },
    'beat-drop': {
      transition: 'dissolve',
      colorTreatment: 'cool',
      effect: 'glitch',
      effectIntensity: 14,
      motion: 'punch-in',
      accentColor: '#22d3ee'
    },
    'best-moments': {
      transition: 'crossfade',
      colorTreatment: 'vibrant',
      effect: 'sharpen',
      effectIntensity: 15,
      motion: 'subtle-zoom',
      accentColor: '#facc15'
    },
    'cinematic-recap': {
      transition: 'dissolve',
      colorTreatment: 'cinematic',
      effect: 'vignette',
      effectIntensity: 22,
      motion: 'pan-zoom',
      accentColor: '#d97706'
    },
    'photo-motion': {
      transition: 'dissolve',
      colorTreatment: 'warm',
      effect: 'grain',
      effectIntensity: 8,
      motion: 'pan-zoom',
      accentColor: '#fb7185'
    },
    'before-after': {
      transition: 'wipe',
      colorTreatment: 'neutral',
      effect: 'sharpen',
      effectIntensity: 20,
      motion: 'none',
      accentColor: '#14b8a6'
    },
    'event-recap': {
      transition: 'crossfade',
      colorTreatment: 'warm',
      effect: 'vignette',
      effectIntensity: 12,
      motion: 'pan-zoom',
      accentColor: '#f43f5e'
    },
    'fast-listicle': {
      transition: 'wipe',
      colorTreatment: 'vibrant',
      effect: 'sharpen',
      effectIntensity: 16,
      motion: 'punch-in',
      accentColor: '#8b5cf6'
    }
  }
  const style = styleById[spec.id]
  return {
    ...style,
    transitionDuration: { value: style.transition === 'flash' ? 120 : 250, timescale: 1000 },
    title: {
      text: spec.name,
      duration: { value: Math.min(2200, spec.minMs), timescale: 1000 },
      position: spec.id === 'fast-listicle' || spec.id === 'story-hook' ? 'center' : 'top',
      style:
        spec.category === 'Gaming'
          ? 'neon'
          : spec.id === 'news-breakdown'
            ? 'documentary'
            : spec.kind === 'montage'
              ? 'bold'
              : 'clean'
    }
  }
}

function makeManifest(spec: BuiltInSpec): TemplateManifest {
  const coverId = `${spec.id}-cover`
  const previewId = `${spec.id}-preview`
  const asset = (id: string, role: 'cover' | 'preview') => ({
    id,
    role,
    sha256: SHA256_EMPTY,
    byteSize: 0,
    mimeType: 'application/vnd.clippster.generated-preview+json',
    path: `generated/${id}.json`,
    required: true,
    fallback: 'error' as const,
    redistributable: true,
    rights: {
      rightsHolder: 'Clippster',
      license: 'LicenseRef-Clippster-First-Party',
      proofReference: 'repository:docs/video-templates/assets-and-licensing.md',
      commercialUse: true,
      redistribution: true,
      platformRestrictions: [],
      territoryRestrictions: []
    }
  })
  const slots = spec.roles.map((role, index) => makeSlot(spec, role, index))
  return {
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    id: spec.id,
    versionId: `${spec.id}-v1`,
    version: '1.0.0',
    name: spec.name,
    description: spec.description,
    kind: spec.kind,
    categories: [spec.category],
    tags: [spec.kind, ...spec.roles],
    supportedAspectRatios: spec.aspects,
    defaultAspectRatio: '9:16',
    duration: {
      mode: spec.kind === 'style' ? 'source' : 'elastic',
      minMs: spec.minMs,
      maxMs: spec.maxMs
    },
    fps: { numerator: 30, denominator: 1 },
    minimumAppVersion: '0.1.1',
    requiredCapabilities: [
      'video',
      'text',
      'captions',
      ...(spec.transitions ? ['transitions' as const] : []),
      'crop',
      'speed',
      'mobile-basic'
    ],
    coverAssetId: coverId,
    previewAssetId: previewId,
    slots,
    anchors: slots.slice(1).map((slot, index) => ({
      id: `cut-${index + 1}`,
      type: spec.category === 'Beat Sync' || spec.id === 'gaming-hype' ? 'beat' : 'cut',
      time: slot.targetStart,
      confidence: 1,
      analyzerVersion: TEMPLATE_ANALYZER_VERSION,
      manuallyCorrected: true,
      timingPolicy: spec.kind === 'style' ? 'elastic' : 'locked',
      targetElementIds: [slot.bindings[0].elementId]
    })),
    assets: [asset(coverId, 'cover'), asset(previewId, 'preview')],
    accessibility: {
      reducedMotion: spec.reducedMotion ?? true,
      flashesPerSecond: 0,
      captionSafeZone: { top: 0.08, right: 0.08, bottom: 0.2, left: 0.08 },
      description: `${spec.name} uses readable text, keyboard-addressable slots, and a no-flash reduced-motion treatment.`
    },
    rights: {
      clearedForEditableRedistribution: true,
      attributionRequired: false,
      notes:
        'Definition and generated preview styling are original Clippster work; user media is never redistributed.'
    },
    author: { id: 'clippster', name: 'Clippster' },
    visibility: 'built-in',
    compatibility: {
      desktop: true,
      android: true,
      ios: false,
      unsupportedByPlatform: { ios: ['not-yet-validated'] }
    },
    presentation: presentationFor(spec)
  }
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    Object.values(value as Record<string, unknown>).forEach(deepFreeze)
  }
  return value
}

export const BUILT_IN_VIDEO_TEMPLATES: readonly TemplateManifest[] = deepFreeze(
  SPECS.map(makeManifest)
)

export function getBuiltInTemplate(id: string, versionId?: string): TemplateManifest | null {
  return (
    BUILT_IN_VIDEO_TEMPLATES.find(
      (template) => template.id === id && (!versionId || template.versionId === versionId)
    ) ?? null
  )
}
