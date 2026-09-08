import { DEFAULT_CAPTION_PRESET_ID, settingsFromPresetId } from '@/lib/captionPresets';

import type { EditorIdFactory } from './ids';
import {
  EDITOR_MAX_TICKS,
  MOBILE_EDIT_SCHEMA_VERSION,
  createDefaultCanvas,
  createDefaultRatioAwareTransform,
  secondsToTicks,
  type CanvasRatio,
  type MobileEditProjectV3,
  type VideoSourceKind,
} from './schema';
import { parseMobileEditProject } from './validation';

export interface CreateMobileEditProjectInput {
  kind: 'project' | 'clip';
  targetId: string;
  projectId?: string;
  linkedClipId?: string;
  source: {
    uri: string;
    fingerprint: string;
    durationSeconds: number;
    sourceKind: VideoSourceKind;
    sourceId?: string;
    width?: number;
    height?: number;
    hasAudio?: boolean;
    thumbnailUri?: string;
  };
  ranges: { startSeconds: number; endSeconds: number }[];
  ratio?: CanvasRatio;
  now?: number;
  idFactory: EditorIdFactory;
}

export interface CreateBlankMobileEditProjectInput {
  targetId: string;
  ratio?: CanvasRatio;
  now?: number;
  idFactory: EditorIdFactory;
}

export function createBlankMobileEditProject(
  input: CreateBlankMobileEditProjectInput,
): MobileEditProjectV3 {
  const id = input.idFactory;
  const now = input.now ?? Date.now();
  return parseMobileEditProject({
    schemaVersion: MOBILE_EDIT_SCHEMA_VERSION,
    id: id('edit'),
    kind: 'project',
    targetId: input.targetId,
    canvas: createDefaultCanvas(input.ratio),
    assets: {},
    tracks: [
      { id: id('track_video'), kind: 'video', items: [], transitions: [] },
      { id: id('track_text'), kind: 'text', items: [] },
      { id: id('track_overlay'), kind: 'overlay', items: [] },
      { id: id('track_audio'), kind: 'audio', items: [] },
    ],
    createdAt: now,
    updatedAt: now,
  });
}

export function createMobileEditProject(input: CreateMobileEditProjectInput): MobileEditProjectV3 {
  const id = input.idFactory;
  const now = input.now ?? Date.now();
  const projectId = id('edit');
  const assetId = id('asset');
  let cursor = 0;
  const videos = input.ranges.map((range) => {
    const sourceStart = secondsToTicks(range.startSeconds);
    const sourceEnd = secondsToTicks(range.endSeconds);
    if (sourceEnd <= sourceStart) throw new Error('Source ranges must have positive duration');
    const duration = sourceEnd - sourceStart;
    const video = {
      id: id('video'),
      kind: 'video' as const,
      assetId,
      timelineStart: cursor,
      timelineEnd: cursor + duration,
      sourceStart,
      sourceEnd,
      speed: 1,
      volume: 1,
      pitchPolicy: 'preserve' as const,
      transform: createDefaultRatioAwareTransform(),
      effectStack: [],
      label: input.kind === 'clip' ? 'Clip' : 'Video',
    };
    cursor += duration;
    return video;
  });
  if (videos.length === 0) throw new Error('At least one source range is required');
  if (cursor > EDITOR_MAX_TICKS) throw new Error('Edit exceeds the 120 second mobile policy');

  return parseMobileEditProject({
    schemaVersion: MOBILE_EDIT_SCHEMA_VERSION,
    id: projectId,
    kind: input.kind,
    targetId: input.targetId,
    projectId: input.projectId,
    linkedClipId: input.linkedClipId,
    canvas: createDefaultCanvas(input.ratio),
    assets: {
      [assetId]: {
        id: assetId,
        kind: 'video',
        sourceKind: input.source.sourceKind,
        sourceId: input.source.sourceId,
        sourceUri: input.source.uri,
        sourceFingerprint: input.source.fingerprint,
        durationTicks: secondsToTicks(input.source.durationSeconds),
        width: input.source.width,
        height: input.source.height,
        hasAudio: input.source.hasAudio,
        thumbnail: input.source.thumbnailUri
          ? { uri: input.source.thumbnailUri, createdAt: now }
          : undefined,
      },
    },
    tracks: [
      { id: id('track_video'), kind: 'video', items: videos, transitions: [] },
      { id: id('track_text'), kind: 'text', items: [] },
      { id: id('track_overlay'), kind: 'overlay', items: [] },
      { id: id('track_audio'), kind: 'audio', items: [] },
    ],
    captionDocument: {
      id: id('captions'),
      enabled: true,
      source: 'transcript',
      words: [],
      phrases: [],
      presetId: DEFAULT_CAPTION_PRESET_ID,
      settings: settingsFromPresetId(DEFAULT_CAPTION_PRESET_ID),
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
  });
}
