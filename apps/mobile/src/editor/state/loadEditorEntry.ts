import type {
  Clip,
  ClipSegment,
  ClipTextBoxState,
  Project,
  RawVideo,
  SubtitleSettings,
  Transcript,
  WordInfo,
} from '@clippster/shared-types';
import { parseActiveVodPresetConfig } from '@clippster/shared-types';

import { mapTranscriptToEditorCaptions } from '../captions/transcriptAdapter';
import { defaultTextStyle } from '../commands/trackCommands';
import { createMobileEditProject } from '../model/createProject';
import type { EditorIdFactory } from '../model/ids';
import { DEFAULT_EDITOR_SESSION, type EditorSessionState } from '../model/session';
import {
  createDefaultRatioAwareTransform,
  secondsToTicks,
  type MobileEditProjectV3,
  type TimedTextItem,
} from '../model/schema';
import { parseMobileEditProject } from '../model/validation';
import type { LocalDraftRepository } from '../persistence/draftRepository';
import { findUnavailableMedia, type MediaProbe, type MissingMedia } from '../persistence/mediaRecovery';

export interface EditorEntryDataSource {
  getClipById(id: string): Promise<Clip | null>;
  getClipSegmentsByClipId(id: string): Promise<ClipSegment[]>;
  getClipSubtitleSettings(id: string): Promise<SubtitleSettings | null>;
  getClipTextOverlay(id: string): Promise<ClipTextBoxState | null>;
  getProject(id: string): Promise<Project | null>;
  getRawVideoByProjectId(id: string): Promise<RawVideo | null>;
  getTranscriptByProjectId(id: string): Promise<Transcript | null>;
}

export interface LoadEditorEntryDependencies {
  data: EditorEntryDataSource;
  drafts: LocalDraftRepository;
  idFactory: EditorIdFactory;
  fingerprint(uri: string): Promise<string>;
  probeMedia: MediaProbe;
  now(): number;
}

export interface LoadedEditorEntry {
  title: string;
  document: MobileEditProjectV3;
  revision: number;
  recovered: boolean;
  missingMedia: MissingMedia[];
  wordsBySourceUri: Record<string, WordInfo[]>;
  session: EditorSessionState;
}

export async function loadEditorEntry(
  kind: 'project' | 'clip',
  targetId: string,
  dependencies: LoadEditorEntryDependencies,
): Promise<LoadedEditorEntry> {
  const context =
    kind === 'clip'
      ? await loadClipContext(targetId, dependencies)
      : await loadProjectContext(targetId, dependencies);
  const stored = await dependencies.drafts.load(kind, targetId);
  const document = withSourceThumbnail(
    stored?.document ?? (await createFromContext(context, dependencies)),
    context.raw.thumbnail_path,
    dependencies.now(),
  );
  const missingMedia = await findUnavailableMedia(document, dependencies.probeMedia);
  return {
    title: context.title,
    document,
    revision: stored?.revision ?? 0,
    recovered: stored?.recovered ?? false,
    missingMedia,
    wordsBySourceUri: { [context.sourceUri]: context.words },
    session: stored?.session ?? DEFAULT_EDITOR_SESSION,
  };
}

interface EditorSourceContext {
  kind: 'project' | 'clip';
  targetId: string;
  title: string;
  project: Project;
  clip?: Clip;
  raw: RawVideo;
  sourceUri: string;
  ranges: { startSeconds: number; endSeconds: number }[];
  words: WordInfo[];
  subtitleSettings?: SubtitleSettings | null;
  textOverlay?: ClipTextBoxState | null;
}

async function loadClipContext(
  targetId: string,
  dependencies: LoadEditorEntryDependencies,
): Promise<EditorSourceContext> {
  const clip = await dependencies.data.getClipById(targetId);
  if (!clip) throw new Error('Clip not found');
  if (!clip.project_id) throw new Error('The clip has no source project');
  const [project, raw, segments, transcript, subtitleSettings, textOverlay] = await Promise.all([
    dependencies.data.getProject(clip.project_id),
    dependencies.data.getRawVideoByProjectId(clip.project_id),
    dependencies.data.getClipSegmentsByClipId(targetId),
    dependencies.data.getTranscriptByProjectId(clip.project_id),
    dependencies.data.getClipSubtitleSettings(targetId),
    dependencies.data.getClipTextOverlay(targetId),
  ]);
  if (!project) throw new Error('Clip project not found');
  if (!raw?.file_path && !clip.file_path) throw new Error('Clip source media reference is missing');
  const start = clip.start_time ?? 0;
  const end = clip.end_time ?? start + Math.min(30, clip.duration ?? 30);
  return {
    kind: 'clip',
    targetId,
    title: clip.name || project.name || 'Clip',
    project,
    clip,
    raw: raw ?? {
      id: clip.id,
      project_id: clip.project_id,
      file_path: clip.file_path,
      duration: clip.duration,
      width: null,
      height: null,
      codec: null,
      file_size: null,
      created_at: clip.created_at,
      updated_at: clip.updated_at,
    },
    sourceUri: raw?.file_path || clip.file_path,
    ranges:
      segments.length > 0
        ? segments.map((segment) => ({
            startSeconds: segment.start_time,
            endSeconds: segment.end_time,
          }))
        : [{ startSeconds: start, endSeconds: end }],
    words: transcriptWords(transcript),
    subtitleSettings,
    textOverlay,
  };
}

async function loadProjectContext(
  targetId: string,
  dependencies: LoadEditorEntryDependencies,
): Promise<EditorSourceContext> {
  const [project, raw, transcript] = await Promise.all([
    dependencies.data.getProject(targetId),
    dependencies.data.getRawVideoByProjectId(targetId),
    dependencies.data.getTranscriptByProjectId(targetId),
  ]);
  if (!project) throw new Error('Project not found');
  if (!raw?.file_path) throw new Error('Project source media reference is missing');
  const duration = raw.duration ?? 30;
  return {
    kind: 'project',
    targetId,
    title: project.name,
    project,
    raw,
    sourceUri: raw.file_path,
    ranges: [{ startSeconds: 0, endSeconds: Math.min(30, duration) }],
    words: transcriptWords(transcript),
  };
}

async function createFromContext(
  context: EditorSourceContext,
  dependencies: LoadEditorEntryDependencies,
): Promise<MobileEditProjectV3> {
  let sourceFingerprint: string;
  try {
    sourceFingerprint = await dependencies.fingerprint(context.sourceUri);
  } catch {
    sourceFingerprint = `missing:${context.sourceUri}`;
  }
  let document = createMobileEditProject({
    kind: context.kind,
    targetId: context.targetId,
    projectId: context.project.id,
    source: {
      uri: context.sourceUri,
      fingerprint: sourceFingerprint,
      durationSeconds: context.raw.duration ?? Math.max(...context.ranges.map((range) => range.endSeconds)),
      sourceKind: context.kind === 'clip' ? 'clip' : 'vod',
      sourceId: context.kind === 'clip' ? context.clip?.id : context.raw.id,
      width: context.raw.width ?? undefined,
      height: context.raw.height ?? undefined,
      hasAudio: true,
      thumbnailUri: context.raw.thumbnail_path ?? undefined,
    },
    ranges: context.ranges,
    now: dependencies.now(),
    idFactory: dependencies.idFactory,
  });
  const captions = document.captionDocument;
  if (captions) {
    const mapped = mapTranscriptToEditorCaptions(
      document,
      { [context.sourceUri]: context.words },
      dependencies.idFactory,
    );
    const presetId = context.clip?.subtitle_preset_id || captions.presetId;
    document = {
      ...document,
      captionDocument: {
        ...captions,
        enabled: context.clip?.subtitle_enabled == null ? true : context.clip.subtitle_enabled !== 0,
        presetId,
        settings: context.subtitleSettings ?? captions.settings,
        words: mapped.words,
        phrases: mapped.phrases,
      },
    };
  }
  document = withLegacyTextOverlay(document, context.textOverlay, dependencies.idFactory);
  const preset = parseActiveVodPresetConfig(context.project.active_vod_preset_config);
  if (preset) {
    document = {
      ...document,
      branding: {
        watermarkMode: preset.watermarkMode,
        presetId: preset.presetId ?? undefined,
        organizationId: preset.orgBranding?.organizationId,
        campaignId: preset.orgBranding?.campaignId,
      },
    };
  }
  return parseMobileEditProject(document);
}

function withSourceThumbnail(
  document: MobileEditProjectV3,
  thumbnailUri: string | null | undefined,
  now: number,
): MobileEditProjectV3 {
  if (!thumbnailUri) return document;
  const uri =
    thumbnailUri.startsWith('file://') ||
    thumbnailUri.startsWith('content://') ||
    thumbnailUri.startsWith('http://') ||
    thumbnailUri.startsWith('https://')
      ? thumbnailUri
      : `file://${thumbnailUri}`;
  let changed = false;
  const assets = Object.fromEntries(
    Object.entries(document.assets).map(([id, asset]) => {
      if (asset.kind !== 'video' || asset.thumbnail) return [id, asset];
      changed = true;
      return [id, { ...asset, thumbnail: { uri, createdAt: now } }];
    }),
  );
  return changed ? parseMobileEditProject({ ...document, assets }) : document;
}

function withLegacyTextOverlay(
  document: MobileEditProjectV3,
  overlay: ClipTextBoxState | null | undefined,
  idFactory: EditorIdFactory,
): MobileEditProjectV3 {
  if (!overlay?.enabled || !overlay.text.trim()) return document;
  const baseTransform = createDefaultRatioAwareTransform({
    positionX: overlay.positionX / 100,
    positionY: overlay.positionY / 100,
    scaleX: overlay.widthPct / 100,
    scaleY: overlay.widthPct / 100,
    rotationDeg: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    fit: 'contain',
  });
  const overrides = Object.fromEntries(
    (['9:16', '16:9'] as const).flatMap((ratio) => {
      const config = overlay.perRatioConfigs?.[ratio];
      return config
        ? [
            [
              ratio,
              {
                ...baseTransform.base,
                positionX: config.position.x / 100,
                positionY: config.position.y / 100,
                scaleX: (config.style.width ?? config.style.maxWidth) / 100,
                scaleY: (config.style.width ?? config.style.maxWidth) / 100,
                rotationDeg: config.rotation ?? 0,
              },
            ],
          ]
        : [];
    }),
  );
  const textItem: TimedTextItem = {
    id: idFactory('text'),
    kind: 'text',
    timelineStart: secondsToTicks(Math.max(0, overlay.startTime)),
    timelineEnd: secondsToTicks(Math.max(overlay.startTime + 0.1, overlay.endTime)),
    content: overlay.text,
    style: {
      ...defaultTextStyle(),
      fontFamily: overlay.style.fontFamily,
      fontSize: overlay.style.fontSize,
      color: overlay.style.color,
      outlineColor: overlay.style.strokeEnabled ? overlay.style.strokeColor : undefined,
      outlineWidth: overlay.style.strokeEnabled ? overlay.style.strokeWidth : undefined,
      backgroundColor: overlay.style.backgroundEnabled
        ? overlay.style.backgroundColor ?? undefined
        : undefined,
      alignment: overlay.style.textAlign,
    },
    transform:
      Object.keys(overrides).length > 0
        ? { ...baseTransform, overrides }
        : baseTransform,
  };
  return {
    ...document,
    tracks: document.tracks.map((track) =>
      track.kind === 'text' ? { ...track, items: [...track.items, textItem] } : track,
    ),
  };
}

function transcriptWords(transcript: Transcript | null): WordInfo[] {
  if (!transcript?.raw_json) return [];
  try {
    const parsed = JSON.parse(transcript.raw_json);
    const words: WordInfo[] =
      parsed.words ??
      parsed.segments?.flatMap((segment: { words?: WordInfo[] }) => segment.words ?? []) ??
      [];
    return words.filter(
      (word) =>
        typeof word.word === 'string' &&
        word.word.trim().length > 0 &&
        Number.isFinite(word.start) &&
        Number.isFinite(word.end) &&
        word.end > word.start,
    );
  } catch {
    return [];
  }
}

