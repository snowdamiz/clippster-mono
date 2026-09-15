import {
  TEMPLATE_ANALYZER_VERSION,
  TEMPLATE_COMPILER_VERSION,
  rationalToMilliseconds,
  type TemplateBinding,
  type TemplateInstanceProvenance,
  type TemplateManifest,
} from '@clippster/template-schema';
import type { MediaAsset } from '../types/assets';
import type { TCanvasSize } from '../types/project';
import type { Transition } from '../types/transitions';
import {
  DEFAULT_COLOR_ADJUSTMENTS,
  type EffectElement,
  type ImageElement,
  type TextElement,
  type TimelineTrack,
  type VideoElement,
} from '../types/timeline';
import { generateUUID } from '../utils/id';

export interface CompiledTemplatePlan {
  tracks: TimelineTrack[];
  canvasSize: TCanvasSize;
  provenance: TemplateInstanceProvenance;
  durationSeconds: number;
  transitions: Transition[];
}

export class TemplateCompileError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'unsupported-platform'
      | 'missing-required-slot'
      | 'missing-media'
      | 'incompatible-media'
      | 'invalid-range',
    readonly slotId?: string
  ) {
    super(message);
    this.name = 'TemplateCompileError';
  }
}

function canvasSizeFor(aspect: string): TCanvasSize {
  switch (aspect) {
    case '16:9':
      return { width: 1920, height: 1080 };
    case '1:1':
      return { width: 1080, height: 1080 };
    case '4:5':
      return { width: 1080, height: 1350 };
    default:
      return { width: 1080, height: 1920 };
  }
}

function colorAdjustmentsFor(
  treatment: TemplateManifest['presentation']['colorTreatment']
): typeof DEFAULT_COLOR_ADJUSTMENTS {
  const adjustments = { ...DEFAULT_COLOR_ADJUSTMENTS };
  if (treatment === 'warm') return { ...adjustments, temperature: 12, saturation: 6 };
  if (treatment === 'cool') return { ...adjustments, temperature: -10, contrast: 6 };
  if (treatment === 'vibrant') return { ...adjustments, saturation: 18, contrast: 8 };
  if (treatment === 'cinematic')
    return { ...adjustments, contrast: 12, saturation: -8, fade: 5 };
  if (treatment === 'monochrome') return { ...adjustments, saturation: -100, contrast: 8 };
  return adjustments;
}

export function createTemplateTransitions(
  manifest: TemplateManifest,
  tracks: TimelineTrack[]
): Transition[] {
  if (manifest.presentation.transition === 'cut') return [];
  const videoTrack = tracks.find((track) => track.type === 'video');
  if (!videoTrack) return [];
  const typeByStyle = {
    crossfade: 'crossfade',
    dissolve: 'dissolve',
    wipe: 'wipeLeft',
    flash: 'shutterFlash',
  } as const;
  const type = typeByStyle[manifest.presentation.transition];
  const duration = rationalToMilliseconds(manifest.presentation.transitionDuration) / 1000;
  return [...videoTrack.elements]
    .sort((left, right) => left.startTime - right.startTime)
    .slice(1)
    .map((element) => ({
      id: generateUUID(),
      type,
      duration: Math.min(duration, element.duration / 2),
      targetElementId: element.id,
      trackId: videoTrack.id,
    }));
}

export function compileTemplatePlan(input: {
  manifest: TemplateManifest;
  bindings: TemplateBinding[];
  mediaAssets: MediaAsset[];
  aspectRatio?: string;
  seed?: number;
  now?: Date;
}): CompiledTemplatePlan {
  if (!input.manifest.compatibility.desktop) {
    throw new TemplateCompileError(
      `${input.manifest.name} is not compatible with desktop`,
      'unsupported-platform'
    );
  }
  const aspect = input.aspectRatio ?? input.manifest.defaultAspectRatio;
  if (!input.manifest.supportedAspectRatios.includes(aspect as never)) {
    throw new TemplateCompileError(
      `${input.manifest.name} does not support ${aspect}`,
      'unsupported-platform'
    );
  }
  const bindingBySlot = new Map(input.bindings.map((binding) => [binding.slotId, binding]));
  const assetById = new Map(input.mediaAssets.map((asset) => [asset.id, asset]));
  // Source muting/ducking is only meaningful when replacement music is bound.
  // Built-ins intentionally ship without redistributable music, so preserve the
  // creator's source audio instead of producing a silent or arbitrarily quiet export.
  const hasReplacementAudio = input.manifest.slots.some(
    (slot) => slot.type === 'audio' && bindingBySlot.has(slot.id)
  );
  const elements: Array<VideoElement | ImageElement> = [];
  let styleCursorSeconds = 0;

  for (const slot of input.manifest.slots) {
    if (!['video', 'image', 'media'].includes(slot.type)) continue;
    const binding = bindingBySlot.get(slot.id);
    if (!binding) {
      if (slot.required) {
        throw new TemplateCompileError(
          `Required slot "${slot.label}" is not filled`,
          'missing-required-slot',
          slot.id
        );
      }
      continue;
    }
    const asset = assetById.get(binding.assetId);
    if (!asset) {
      throw new TemplateCompileError(
        `Media for slot "${slot.label}" is unavailable`,
        'missing-media',
        slot.id
      );
    }
    if (
      (slot.type === 'video' && asset.type !== 'video') ||
      (slot.type === 'image' && asset.type !== 'image') ||
      (slot.type === 'media' && asset.type === 'audio')
    ) {
      throw new TemplateCompileError(
        `Media for slot "${slot.label}" has an incompatible type`,
        'incompatible-media',
        slot.id
      );
    }
    const targetStart = rationalToMilliseconds(slot.targetStart) / 1000;
    const targetDuration = rationalToMilliseconds(slot.targetDuration) / 1000;
    const trimStart = binding.sourceStartMs / 1000;
    const sourceDuration = (binding.sourceEndMs - binding.sourceStartMs) / 1000;
    if (
      sourceDuration <= 0 ||
      trimStart < 0 ||
      (asset.duration != null && binding.sourceEndMs > asset.duration * 1000 + 0.5)
    ) {
      throw new TemplateCompileError(
        `Slot "${slot.label}" has an invalid source range`,
        'invalid-range',
        slot.id
      );
    }
    const duration =
      input.manifest.kind === 'style'
        ? Math.min(
            sourceDuration,
            Math.max(0.001, input.manifest.duration.maxMs / 1000 - styleCursorSeconds)
          )
        : targetDuration;
    const startTime = input.manifest.kind === 'style' ? styleCursorSeconds : targetStart;
    if (input.manifest.kind === 'style') styleCursorSeconds += duration;
    const common = {
      id: generateUUID(),
      name: slot.label,
      mediaId: asset.id,
      duration,
      startTime,
      trimStart,
      trimEnd: Math.max(
        0,
        (asset.duration ?? binding.sourceEndMs / 1000) - binding.sourceEndMs / 1000
      ),
      hidden: false,
      mediaFit: slot.fit,
      transform: {
        scale:
          input.manifest.presentation.motion === 'punch-in'
            ? 1.08
            : input.manifest.presentation.motion === 'none'
              ? 1
              : 1.04,
        position: { x: 0, y: 0 },
        rotate: 0,
      },
      opacity: 1,
      colorAdjustments: colorAdjustmentsFor(input.manifest.presentation.colorTreatment),
      orderIndex: elements.length,
      templateSlotId: slot.id,
      templateProvenance: {
        templateId: input.manifest.id,
        templateVersionId: input.manifest.versionId,
        logicalElementId: slot.bindings[0].elementId,
      },
    };
    elements.push(
      asset.type === 'video'
        ? {
            ...common,
            type: 'video',
            muted:
              hasReplacementAudio &&
              (slot.sourceAudioPolicy === 'mute' || slot.sourceAudioPolicy === 'replace'),
            volume:
              hasReplacementAudio && slot.sourceAudioPolicy === 'duck' ? 0.3 : 1,
            speed: Math.max(0.1, sourceDuration / duration),
          }
        : { ...common, type: 'image' }
    );
  }

  const durationSeconds = elements.reduce(
    (maximum, element) => Math.max(maximum, element.startTime + element.duration),
    0
  );
  const trackId = generateUUID();
  const canvasSize = canvasSizeFor(aspect);
  const videoTrack: TimelineTrack = {
    id: trackId,
    name: `${input.manifest.name} shots`,
    type: 'video',
    elements,
    isMain: true,
    muted: false,
    hidden: false,
  };
  const titleDuration = Math.min(
    durationSeconds,
    rationalToMilliseconds(input.manifest.presentation.title.duration) / 1000
  );
  const title: TextElement = {
    id: generateUUID(),
    type: 'text',
    name: `${input.manifest.name} title`,
    content: input.manifest.presentation.title.text,
    duration: titleDuration,
    startTime: 0,
    trimStart: 0,
    trimEnd: 0,
    fontSize: input.manifest.presentation.title.style === 'bold' ? 72 : 58,
    fontFamily: 'Inter',
    color: '#ffffff',
    backgroundColor: 'transparent',
    textAlign: 'center',
    fontWeight: input.manifest.presentation.title.style === 'clean' ? '600' : '900',
    fontStyle: 'normal',
    textDecoration: 'none',
    letterSpacing: input.manifest.presentation.title.style === 'documentary' ? 2 : 0,
    lineHeight: 1.1,
    textCase:
      input.manifest.presentation.title.style === 'clean' ? 'none' : 'uppercase',
    stroke: { color: '#000000', width: 3 },
    glow:
      input.manifest.presentation.title.style === 'neon'
        ? { color: input.manifest.presentation.accentColor, intensity: 12 }
        : undefined,
    bubbleStyle:
      input.manifest.presentation.title.style === 'label' ? 'label' : 'none',
    bubbleColor: input.manifest.presentation.accentColor,
    bubblePadding: 12,
    transform: {
      scale: 1,
      position: {
        x: 0,
        y:
          input.manifest.presentation.title.position === 'top'
            ? -canvasSize.height * 0.32
            : input.manifest.presentation.title.position === 'bottom'
              ? canvasSize.height * 0.3
              : 0,
      },
      rotate: 0,
    },
    opacity: 1,
    orderIndex: 0,
    templateProvenance: {
      templateId: input.manifest.id,
      templateVersionId: input.manifest.versionId,
      logicalElementId: 'presentation-title',
    },
  };
  const tracks: TimelineTrack[] = [videoTrack];
  if (titleDuration > 0) {
    tracks.push({
      id: generateUUID(),
      name: `${input.manifest.name} titles`,
      type: 'text',
      elements: [title],
      hidden: false,
    });
  }
  if (
    input.manifest.presentation.effect !== 'none' &&
    input.manifest.presentation.effectIntensity > 0 &&
    durationSeconds > 0
  ) {
    const effectType =
      input.manifest.presentation.effect === 'grain'
        ? 'noise'
        : input.manifest.presentation.effect;
    const params: Record<string, number | string> =
      effectType === 'vignette'
        ? { radius: 50, softness: 60 }
        : effectType === 'noise'
          ? { amount: 30 }
          : effectType === 'sharpen'
            ? { amount: 3 }
            : effectType === 'glitch'
              ? { sliceCount: 8, maxOffset: 15, colorBleed: 40 }
              : {};
    const effect: EffectElement = {
      id: generateUUID(),
      type: 'effect',
      name: `${input.manifest.name} ${input.manifest.presentation.effect}`,
      startTime: 0,
      duration: durationSeconds,
      trimStart: 0,
      trimEnd: 0,
      effectType,
      enabled: true,
      intensity: input.manifest.presentation.effectIntensity,
      params,
      orderIndex: 0,
      templateProvenance: {
        templateId: input.manifest.id,
        templateVersionId: input.manifest.versionId,
        logicalElementId: 'presentation-effect',
      },
    };
    tracks.push({
      id: generateUUID(),
      name: `${input.manifest.name} treatment`,
      type: 'effect',
      elements: [effect],
      hidden: false,
    });
  }
  const provenance: TemplateInstanceProvenance = {
    templateId: input.manifest.id,
    templateVersionId: input.manifest.versionId,
    compilerVersion: TEMPLATE_COMPILER_VERSION,
    analyzerVersion: TEMPLATE_ANALYZER_VERSION,
    seed: input.seed ?? 1,
    sourceLineage: Array.from(
      new Map(
        input.bindings.map((binding) => [
          binding.sourceFingerprint,
          { assetId: binding.assetId, sourceFingerprint: binding.sourceFingerprint },
        ])
      ).values()
    ),
    bindings: input.bindings.map((binding) => ({ ...binding })),
    createdAt: (input.now ?? new Date()).toISOString(),
  };
  return {
    tracks,
    canvasSize,
    provenance,
    durationSeconds,
    transitions: createTemplateTransitions(input.manifest, tracks),
  };
}
