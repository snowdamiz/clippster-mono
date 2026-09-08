import { migrateEditDocument, type EditDocument } from '@/lib/timeline/editDocument';

import { deterministicMigrationId } from './ids';
import {
  MOBILE_EDIT_SCHEMA_VERSION,
  createDefaultCanvas,
  createDefaultRatioAwareTransform,
  secondsToTicks,
  type AudioItem,
  type MediaAssetRef,
  type MobileEditProjectV3,
  type OverlayItem,
  type TransitionItem,
  type VideoItem,
} from './schema';
import { parseMobileEditProject } from './validation';

export interface MigrationContext {
  now?: number;
  sourceFingerprint?: (sourceUri: string) => string;
}

function legacyFingerprint(sourceUri: string): string {
  return `legacy-uri:${encodeURIComponent(sourceUri)}`;
}

function migrateV2(document: EditDocument, context: MigrationContext): MobileEditProjectV3 {
  const now = context.now ?? Date.now();
  const key = `${document.kind}_${document.targetId}`;
  const assets: Record<string, MediaAssetRef> = {};
  const assetIdBySource = new Map<string, string>();

  function assetFor(
    sourceUri: string,
    kind: MediaAssetRef['kind'],
    sourceKind: MediaAssetRef['sourceKind'],
    durationSeconds: number,
    sourceId?: string,
  ): string {
    const assetKey = `${kind}:${sourceUri}`;
    const existing = assetIdBySource.get(assetKey);
    if (existing) return existing;
    const id = deterministicMigrationId('asset', key, assetIdBySource.size);
    assets[id] = {
      id,
      kind,
      sourceKind,
      sourceId,
      sourceUri,
      sourceFingerprint: context.sourceFingerprint?.(sourceUri) ?? legacyFingerprint(sourceUri),
      durationTicks: secondsToTicks(durationSeconds),
    };
    assetIdBySource.set(assetKey, id);
    return id;
  }

  let timelineCursor = 0;
  const transitions: TransitionItem[] = [];
  const videos: VideoItem[] = document.videos.map((video, index) => {
    const duration = (video.sourceEnd - video.sourceStart) / video.speed;
    const transitionDuration = index > 0 && video.transitionIn !== 'none' ? 0.5 : 0;
    const timelineStart = Math.max(0, timelineCursor - secondsToTicks(transitionDuration));
    const timelineEnd = timelineStart + secondsToTicks(duration);
    const id = video.id || deterministicMigrationId('video', key, index);
    if (index > 0 && video.transitionIn !== 'none') {
      transitions.push({
        id: deterministicMigrationId('transition', key, index - 1),
        kind: 'transition',
        fromItemId: document.videos[index - 1].id,
        toItemId: id,
        transition: video.transitionIn,
        durationTicks: secondsToTicks(transitionDuration),
      });
    }
    timelineCursor = timelineEnd;
    return {
      id,
      kind: 'video',
      assetId: assetFor(
        video.sourcePath,
        'video',
        video.sourceKind,
        video.sourceDuration,
        video.sourceId,
      ),
      timelineStart,
      timelineEnd,
      sourceStart: secondsToTicks(video.sourceStart),
      sourceEnd: secondsToTicks(video.sourceEnd),
      speed: video.speed,
      volume: video.muted ? 0 : 1,
      pitchPolicy: 'preserve',
      transform: createDefaultRatioAwareTransform(),
      effectStack: video.effect ? [{ ...video.effect }] : [],
      label: video.label,
    };
  });

  const overlays: OverlayItem[] = document.images.map((image, index) => ({
    id: image.id || deterministicMigrationId('overlay', key, index),
    kind: 'overlay',
    assetId: assetFor(image.sourcePath, 'image', 'image', image.duration),
    timelineStart: secondsToTicks(image.timelineStart),
    timelineEnd: secondsToTicks(image.timelineStart + image.duration),
    sourceStart: 0,
    sourceEnd: secondsToTicks(image.duration),
    speed: 1,
    volume: 0,
    opacity: 1,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    transform: createDefaultRatioAwareTransform({
      positionX: image.x + image.widthPct / 2,
      positionY: image.y + image.widthPct / 2,
      scaleX: image.widthPct,
      scaleY: image.widthPct,
      rotationDeg: 0,
      anchorX: 0.5,
      anchorY: 0.5,
      fit: 'contain',
    }),
    effectStack: [],
  }));

  const audio: AudioItem[] = document.audio.map((item, index) => {
    const duration = item.sourceEnd - item.sourceStart;
    return {
      id: item.id || deterministicMigrationId('audio', key, index),
      kind: 'audio',
      assetId: assetFor(item.sourcePath, 'audio', 'audio', item.sourceDuration),
      timelineStart: secondsToTicks(item.timelineStart),
      timelineEnd: secondsToTicks(item.timelineStart + duration),
      sourceStart: secondsToTicks(item.sourceStart),
      sourceEnd: secondsToTicks(item.sourceEnd),
      speed: 1,
      volume: item.volume,
      fadeInTicks: 0,
      fadeOutTicks: 0,
      role: 'music',
      label: item.label,
    };
  });

  const project: MobileEditProjectV3 = {
    schemaVersion: MOBILE_EDIT_SCHEMA_VERSION,
    id: deterministicMigrationId('edit', key, 0),
    kind: document.kind,
    targetId: document.targetId,
    projectId: document.projectId,
    linkedClipId: document.linkedClipId,
    canvas: createDefaultCanvas('9:16'),
    assets,
    tracks: [
      {
        id: deterministicMigrationId('track_video', key, 0),
        kind: 'video',
        items: videos,
        transitions,
      },
      {
        id: deterministicMigrationId('track_text', key, 0),
        kind: 'text',
        items: [],
      },
      {
        id: deterministicMigrationId('track_overlay', key, 0),
        kind: 'overlay',
        items: overlays,
      },
      {
        id: deterministicMigrationId('track_audio', key, 0),
        kind: 'audio',
        items: audio,
      },
    ],
    captionDocument: {
      id: deterministicMigrationId('captions', key, 0),
      enabled: document.captions.enabled,
      source: 'transcript',
      words: [],
      phrases: [],
      presetId: document.captions.presetId,
      settings: { ...document.captions.settings },
      transform: createDefaultRatioAwareTransform({
        positionX: 0.5,
        positionY: 0.82,
        scaleX: 1,
        scaleY: 1,
        rotationDeg: 0,
        anchorX: 0.5,
        anchorY: 0.5,
        fit: 'contain',
      }),
      effect: { mode: 'phrase', animation: 'none' },
    },
    createdAt: now,
    updatedAt: now,
  };
  return parseMobileEditProject(project);
}

export function migrateMobileEditProject(
  raw: unknown,
  context: MigrationContext = {},
): MobileEditProjectV3 {
  if (
    raw != null &&
    typeof raw === 'object' &&
    'schemaVersion' in raw &&
    raw.schemaVersion === MOBILE_EDIT_SCHEMA_VERSION
  ) {
    return parseMobileEditProject(raw);
  }
  const legacy = migrateEditDocument(raw);
  if (!legacy) throw new Error('Unsupported or invalid mobile edit document');
  return migrateV2(legacy, context);
}
