import type { TemplateKind, TemplateManifest, TemplatePresentation } from './types'

export interface TemplatePreviewLook {
  id: string
  name: string
  description: string
  actionLabel: string
  durationLabel: string
  slotCount: number
  slotLabels: string[]
  accentColor: string
  gradientFrom: string
  gradientTo: string
  cssFilter: string
  plateCount: number
  titleText: string
  titlePosition: TemplatePresentation['title']['position']
  titleStyle: TemplatePresentation['title']['style']
  transitionLabel: string
  motionLabel: string
  effectLabel: string
  kind: TemplateKind
}

const KIND_ACTION: Record<TemplateKind, string> = {
  style: 'Keeps your cuts and restyles them',
  montage: 'Cuts a new edit from your footage',
  hybrid: 'Restyles and rearranges your shots'
}

const TRANSITION_LABEL: Record<TemplatePresentation['transition'], string> = {
  cut: 'Hard cuts',
  crossfade: 'Crossfades',
  dissolve: 'Dissolves',
  wipe: 'Wipes',
  flash: 'Flash cuts'
}

const MOTION_LABEL: Record<TemplatePresentation['motion'], string> = {
  none: 'Locked frame',
  'subtle-zoom': 'Slow zoom',
  'punch-in': 'Punch-ins',
  'pan-zoom': 'Pan and zoom'
}

const EFFECT_LABEL: Record<TemplatePresentation['effect'], string> = {
  none: 'Clean picture',
  vignette: 'Vignette',
  grain: 'Film grain',
  sharpen: 'Sharpened',
  glitch: 'Glitch accents'
}

const TREATMENTS: Record<
  TemplatePresentation['colorTreatment'],
  { from: string; to: string; cssFilter: string }
> = {
  neutral: {
    from: '#1f2937',
    to: '#0f172a',
    cssFilter: 'saturate(1) contrast(1)'
  },
  warm: {
    from: '#7c2d12',
    to: '#1c1917',
    cssFilter: 'saturate(1.2) sepia(0.18) brightness(1.05)'
  },
  cool: {
    from: '#164e63',
    to: '#0f172a',
    cssFilter: 'saturate(0.9) hue-rotate(12deg) brightness(0.95)'
  },
  vibrant: {
    from: '#9a3412',
    to: '#3b0764',
    cssFilter: 'saturate(1.45) contrast(1.12)'
  },
  cinematic: {
    from: '#1e1b4b',
    to: '#111827',
    cssFilter: 'saturate(0.82) contrast(1.22) brightness(0.9)'
  },
  monochrome: {
    from: '#27272a',
    to: '#09090b',
    cssFilter: 'grayscale(1) contrast(1.15)'
  }
}

export function templatePreviewLook(manifest: TemplateManifest): TemplatePreviewLook {
  const presentation = manifest.presentation
  const treatment = TREATMENTS[presentation.colorTreatment]
  const plateCount =
    manifest.kind === 'style' ? 1 : Math.min(4, Math.max(2, manifest.slots.length))
  return {
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    actionLabel: KIND_ACTION[manifest.kind],
    durationLabel: `${manifest.duration.minMs / 1000}–${manifest.duration.maxMs / 1000}s`,
    slotCount: manifest.slots.length,
    slotLabels: manifest.slots.slice(0, 4).map((slot) => slot.label),
    accentColor: presentation.accentColor,
    gradientFrom: treatment.from,
    gradientTo: treatment.to,
    cssFilter: treatment.cssFilter,
    plateCount,
    titleText: presentation.title.text,
    titlePosition: presentation.title.position,
    titleStyle: presentation.title.style,
    transitionLabel: TRANSITION_LABEL[presentation.transition],
    motionLabel: MOTION_LABEL[presentation.motion],
    effectLabel: EFFECT_LABEL[presentation.effect],
    kind: manifest.kind
  }
}
