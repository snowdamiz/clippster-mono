import {
  TEMPLATE_ANALYZER_VERSION,
  TEMPLATE_SCHEMA_VERSION,
  parseTemplateManifest,
  type TemplateManifest,
  type TemplateSlot,
} from '@clippster/template-schema';
import type { EditorCore } from '../core';

const STORAGE_KEY = 'clippster.video-template-drafts.v1';
const EMPTY_SHA256 = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';

function safeId(value: string): string {
  return (
    value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 48) || 'template'
  );
}

export function extractTemplateDraft(
  editor: EditorCore,
  input: {
    name: string;
    description?: string;
  }
): TemplateManifest {
  const project = editor.project.getActive();
  const mediaElements = editor.timeline
    .getTracks()
    .flatMap((track) =>
      track.type === 'video'
        ? track.elements
            .filter((element) => element.type === 'video' || element.type === 'image')
            .map((element) => ({ track, element }))
        : []
    );
  if (mediaElements.length === 0)
    throw new Error('Add at least one video or image before saving a template');
  const id = `local-${safeId(input.name)}`;
  const now = Date.now();
  const slots: TemplateSlot[] = mediaElements.map(({ track, element }, index) => ({
    id: `media-${index + 1}`,
    label: element.name || `Media ${index + 1}`,
    role: index === 0 ? 'hook' : index === mediaElements.length - 1 ? 'payoff' : 'action',
    description: `Replace ${element.name || `media ${index + 1}`} with compatible creator media.`,
    type: element.type,
    required: true,
    acceptedMimeTypes: [element.type === 'video' ? 'video/*' : 'image/*'],
    orientation: 'any',
    sourceDurationMs: {
      min: Math.min(500, element.duration * 1000),
      preferred: element.duration * 1000,
      max: Math.max(element.duration * 3000, 3000),
    },
    targetDuration: { value: Math.round(element.duration * 60_000), timescale: 60_000 },
    targetStart: { value: Math.round(element.startTime * 60_000), timescale: 60_000 },
    allowSourceReuse: true,
    groupId: 'authored-media',
    minimumSeparationMs: 500,
    fit: element.mediaFit ?? 'cover',
    focalPolicy: 'creator',
    sourceAudioPolicy: element.type === 'video' && element.muted ? 'mute' : 'creator-selectable',
    trimBehavior: 'slip',
    allowSpeed: element.type === 'video',
    allowReverse: element.type === 'video',
    allowLoop: element.type === 'image',
    mutableProperties: [
      'source',
      'trim',
      'crop',
      'focalPoint',
      'fit',
      'sourceAudioPolicy',
      'volume',
    ],
    lockedProperties: ['targetStart', 'targetDuration'],
    fallback: 'error',
    bindings: [{ sceneId: project.currentSceneId, trackId: track.id, elementId: element.id }],
  }));
  const coverId = `${id}-cover`;
  const previewId = `${id}-preview`;
  const generatedAsset = (assetId: string, role: 'cover' | 'preview') => ({
    id: assetId,
    role,
    sha256: EMPTY_SHA256,
    byteSize: 0,
    mimeType: 'application/vnd.clippster.generated-preview+json',
    path: `generated/${assetId}.json`,
    required: true,
    fallback: 'error' as const,
    redistributable: true,
    rights: {
      rightsHolder: 'Template creator',
      license: 'LicenseRef-Private-Draft',
      proofReference: 'private-local-draft',
      commercialUse: false,
      redistribution: true,
      platformRestrictions: [],
      territoryRestrictions: [],
    },
  });
  return parseTemplateManifest({
    schemaVersion: TEMPLATE_SCHEMA_VERSION,
    id,
    versionId: `${id}-${now}`,
    version: '0.1.0',
    name: input.name.trim(),
    description:
      input.description?.trim() || `Private editable template from ${project.metadata.name}`,
    kind: 'montage',
    categories: ['My Templates'],
    tags: ['private', 'authored'],
    supportedAspectRatios: ['9:16', '16:9', '1:1', '4:5'],
    defaultAspectRatio:
      project.settings.canvasSize.height > project.settings.canvasSize.width ? '9:16' : '16:9',
    duration: {
      mode: 'fixed',
      minMs: Math.max(1, Math.round(project.metadata.duration * 1000)),
      maxMs: Math.max(1, Math.round(project.metadata.duration * 1000)),
    },
    fps: { numerator: project.settings.fps, denominator: 1 },
    minimumAppVersion: '0.1.1',
    requiredCapabilities: ['video', 'crop', 'speed', 'mobile-basic'],
    coverAssetId: coverId,
    previewAssetId: previewId,
    slots,
    anchors: slots.slice(1).map((slot, index) => ({
      id: `cut-${index + 1}`,
      type: 'cut',
      time: slot.targetStart,
      confidence: 1,
      analyzerVersion: TEMPLATE_ANALYZER_VERSION,
      manuallyCorrected: true,
      timingPolicy: 'locked',
      targetElementIds: [slot.bindings[0].elementId],
    })),
    assets: [generatedAsset(coverId, 'cover'), generatedAsset(previewId, 'preview')],
    accessibility: {
      reducedMotion: true,
      flashesPerSecond: 0,
      captionSafeZone: { top: 0.08, right: 0.08, bottom: 0.2, left: 0.08 },
      description:
        'Private draft defaults to reduced motion and no flashes; validate before distribution.',
    },
    rights: {
      clearedForEditableRedistribution: false,
      attributionRequired: false,
      notes: 'Private draft; asset rights must be completed before package export.',
    },
    author: { id: 'local-user', name: 'Local user' },
    visibility: 'private',
    compatibility: {
      desktop: true,
      android: true,
      ios: false,
      unsupportedByPlatform: { ios: ['not-yet-validated'] },
    },
    presentation: {
      transition: 'crossfade',
      transitionDuration: { value: 250, timescale: 1000 },
      colorTreatment: 'neutral',
      effect: 'none',
      effectIntensity: 0,
      motion: 'none',
      accentColor: '#3b82f6',
      title: {
        text: input.name.trim(),
        duration: { value: 2000, timescale: 1000 },
        position: 'top',
        style: 'clean',
      },
    },
  });
}

export function loadLocalTemplateDrafts(): TemplateManifest[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as unknown[];
    return parsed.flatMap((item) => {
      try {
        return [parseTemplateManifest(item)];
      } catch {
        return [];
      }
    });
  } catch {
    return [];
  }
}

export function saveLocalTemplateDraft(manifest: TemplateManifest): void {
  const current = loadLocalTemplateDrafts();
  localStorage.setItem(STORAGE_KEY, JSON.stringify([manifest, ...current]));
}
