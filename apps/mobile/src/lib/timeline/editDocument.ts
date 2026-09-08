import type { ClipEffect } from '@clippster/clip-export';
import type { SubtitleSettings, WordInfo } from '@clippster/shared-types';
import { DEFAULT_CAPTION_PRESET_ID, settingsFromPresetId } from '@/lib/captionPresets';

export const TIMELINE_MAX_SECONDS = 120;
export const MIN_CLIP_SECONDS = 0.5;
export const DEFAULT_IMAGE_SECONDS = 5;
export const DEFAULT_INITIAL_SLICE_SECONDS = 30;
export const TRANSITION_SECONDS = 0.5;

export type TransitionKind = 'none' | 'fade' | 'dissolve' | 'wipe';
export type ClipSpeed = 0.5 | 1 | 1.5 | 2;
export type VideoSourceKind = 'vod' | 'clip' | 'build' | 'upload';

export interface TimelineVideo {
  id: string;
  sourceKind: VideoSourceKind;
  sourceId?: string;
  sourcePath: string;
  sourceDuration: number;
  sourceStart: number;
  sourceEnd: number;
  speed: ClipSpeed;
  muted: boolean;
  transitionIn: TransitionKind;
  effect?: ClipEffect | null;
  label: string;
}

export interface TimelineOverlay {
  id: string;
  sourcePath: string;
  timelineStart: number;
  duration: number;
  label: string;
  x: number;
  y: number;
  widthPct: number;
}

export interface TimelineAudio {
  id: string;
  sourcePath: string;
  sourceDuration: number;
  sourceStart: number;
  sourceEnd: number;
  timelineStart: number;
  volume: number;
  label: string;
}

export interface EditCaptions {
  enabled: boolean;
  presetId: string;
  settings: SubtitleSettings;
}

export interface EditDocument {
  version: 2;
  kind: 'project' | 'clip';
  targetId: string;
  projectId?: string;
  linkedClipId?: string;
  videos: TimelineVideo[];
  images: TimelineOverlay[];
  audio: TimelineAudio[];
  captions: EditCaptions;
}

export interface TimelineRange {
  clip: TimelineVideo;
  clipIndex: number;
  start: number;
  end: number;
}

export interface PlayheadResolve {
  clip: TimelineVideo;
  clipIndex: number;
  sourceTime: number;
  timelineStart: number;
}

export interface ActiveTransition {
  kind: Exclude<TransitionKind, 'none'>;
  progress: number;
  outgoing: TimelineVideo;
  incoming: TimelineVideo;
  outgoingSourceTime: number;
  incomingSourceTime: number;
}

export function createItemId(prefix = 'titem'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export function cloneDoc(doc: EditDocument): EditDocument {
  return {
    ...doc,
    videos: doc.videos.map((item) => ({ ...item, effect: item.effect ? { ...item.effect } : item.effect })),
    images: doc.images.map((item) => ({ ...item })),
    audio: doc.audio.map((item) => ({ ...item })),
    captions: {
      ...doc.captions,
      settings: { ...doc.captions.settings },
    },
  };
}

export function videoDuration(clip: TimelineVideo): number {
  return Math.max(0, (clip.sourceEnd - clip.sourceStart) / clip.speed);
}

export function clipOverlapSeconds(previous: TimelineVideo, incoming: TimelineVideo): number {
  if (incoming.transitionIn === 'none') return 0;
  return Math.min(TRANSITION_SECONDS, videoDuration(previous) / 2, videoDuration(incoming) / 2);
}

export function videoTrackDuration(doc: EditDocument): number {
  const ranges = clipTimelineRanges(doc);
  return ranges[ranges.length - 1]?.end ?? 0;
}

export function timelineDuration(doc: EditDocument): number {
  const videoEnd = videoTrackDuration(doc);
  const imageEnd = doc.images.reduce((max, item) => Math.max(max, item.timelineStart + item.duration), 0);
  const audioEnd = doc.audio.reduce(
    (max, item) => Math.max(max, item.timelineStart + (item.sourceEnd - item.sourceStart)),
    0,
  );
  return Math.max(videoEnd, imageEnd, audioEnd);
}

export function remainingTimeline(doc: EditDocument): number {
  return Math.max(0, TIMELINE_MAX_SECONDS - timelineDuration(doc));
}

export function clipTimelineRanges(doc: EditDocument): TimelineRange[] {
  let cursor = 0;
  return doc.videos.map((clip, clipIndex) => {
    const duration = videoDuration(clip);
    const overlap = clipIndex === 0 ? 0 : clipOverlapSeconds(doc.videos[clipIndex - 1], clip);
    const start = Math.max(0, cursor - overlap);
    const end = start + duration;
    cursor = end;
    return { clip, clipIndex, start, end };
  });
}

export function getActiveTransition(doc: EditDocument, timelineTime: number): ActiveTransition | null {
  const ranges = clipTimelineRanges(doc);
  for (let i = 1; i < ranges.length; i++) {
    const incoming = ranges[i];
    const outgoing = ranges[i - 1];
    if (incoming.clip.transitionIn === 'none') continue;
    const overlapStart = incoming.start;
    const overlapEnd = outgoing.end;
    if (overlapEnd <= overlapStart) continue;
    if (timelineTime < overlapStart || timelineTime >= overlapEnd) continue;
    return {
      kind: incoming.clip.transitionIn,
      progress: Math.max(0, Math.min(1, (timelineTime - overlapStart) / (overlapEnd - overlapStart))),
      outgoing: outgoing.clip,
      incoming: incoming.clip,
      outgoingSourceTime: outgoing.clip.sourceStart + Math.max(0, timelineTime - outgoing.start) * outgoing.clip.speed,
      incomingSourceTime: incoming.clip.sourceStart + Math.max(0, timelineTime - incoming.start) * incoming.clip.speed,
    };
  }
  return null;
}

export function resolveTimelineTime(doc: EditDocument, timelineTime: number): PlayheadResolve | null {
  if (doc.videos.length === 0) return null;
  const ranges = clipTimelineRanges(doc);
  const total = ranges[ranges.length - 1]?.end ?? 0;
  const clamped = Math.max(0, Math.min(timelineTime, Math.max(0, total - 0.001)));
  const matches = ranges.filter((item) => clamped >= item.start && clamped < item.end);
  const range = matches[matches.length - 1] ?? ranges[ranges.length - 1];
  if (!range) return null;
  const local = Math.max(0, clamped - range.start);
  return {
    clip: range.clip,
    clipIndex: range.clipIndex,
    sourceTime: range.clip.sourceStart + local * range.clip.speed,
    timelineStart: range.start,
  };
}

export function timelineTimeForSource(
  doc: EditDocument,
  clipIndex: number,
  sourceTime: number,
): number {
  const range = clipTimelineRanges(doc)[clipIndex];
  if (!range) return 0;
  return range.start + (sourceTime - range.clip.sourceStart) / range.clip.speed;
}

export function visibleImages(doc: EditDocument, timelineTime: number): TimelineOverlay[] {
  return doc.images.filter(
    (item) => timelineTime >= item.timelineStart && timelineTime < item.timelineStart + item.duration,
  );
}

export function activeAudio(doc: EditDocument, timelineTime: number): TimelineAudio | null {
  return (
    doc.audio.find((item) => {
      const duration = item.sourceEnd - item.sourceStart;
      return timelineTime >= item.timelineStart && timelineTime < item.timelineStart + duration;
    }) ?? null
  );
}

function withinMax(doc: EditDocument): boolean {
  return timelineDuration(doc) <= TIMELINE_MAX_SECONDS + 0.001;
}

function defaultCaptions(presetId = DEFAULT_CAPTION_PRESET_ID): EditCaptions {
  return {
    enabled: true,
    presetId,
    settings: settingsFromPresetId(presetId),
  };
}

export function createVideoClip(input: {
  sourceKind: VideoSourceKind;
  sourcePath: string;
  sourceDuration: number;
  sourceStart?: number;
  sourceEnd?: number;
  sourceId?: string;
  label?: string;
  muted?: boolean;
}): TimelineVideo {
  const sourceDuration = Math.max(0, input.sourceDuration);
  const sourceStart = Math.max(0, input.sourceStart ?? 0);
  const sourceEnd = Math.min(sourceDuration || input.sourceEnd || sourceStart + MIN_CLIP_SECONDS, input.sourceEnd ?? sourceDuration);
  return {
    id: createItemId('tvid'),
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    sourcePath: input.sourcePath,
    sourceDuration,
    sourceStart,
    sourceEnd: Math.max(sourceStart + MIN_CLIP_SECONDS, sourceEnd),
    speed: 1,
    muted: input.muted ?? false,
    transitionIn: 'none',
    effect: null,
    label: input.label ?? 'Video',
  };
}

export function createEditDocument(input: {
  kind: 'project' | 'clip';
  targetId: string;
  projectId?: string;
  sourcePath: string;
  sourceDuration: number;
  sourceStart?: number;
  sourceEnd?: number;
  videos?: TimelineVideo[];
  captions?: EditCaptions;
  linkedClipId?: string;
}): EditDocument {
  const sourceDuration = Math.max(0, input.sourceDuration);
  const start = Math.max(0, input.sourceStart ?? 0);
  const requestedEnd = input.sourceEnd ?? Math.min(sourceDuration || DEFAULT_INITIAL_SLICE_SECONDS, start + DEFAULT_INITIAL_SLICE_SECONDS);
  const end = Math.min(
    sourceDuration || requestedEnd,
    start + TIMELINE_MAX_SECONDS,
    Math.max(start + MIN_CLIP_SECONDS, requestedEnd),
  );

  const videos =
    input.videos && input.videos.length > 0
      ? input.videos
      : [
          createVideoClip({
            sourceKind: input.kind === 'clip' ? 'clip' : 'vod',
            sourcePath: input.sourcePath,
            sourceDuration,
            sourceStart: start,
            sourceEnd: end,
            sourceId: input.kind === 'clip' ? input.targetId : undefined,
            label: input.kind === 'clip' ? 'Clip' : 'Video',
          }),
        ];

  const doc: EditDocument = {
    version: 2,
    kind: input.kind,
    targetId: input.targetId,
    projectId: input.projectId,
    linkedClipId: input.linkedClipId,
    videos,
    images: [],
    audio: [],
    captions: input.captions ?? defaultCaptions(),
  };

  return withinMax(doc) ? doc : trimDocToMax(doc);
}

function trimDocToMax(doc: EditDocument): EditDocument {
  const next = cloneDoc(doc);
  while (timelineDuration(next) > TIMELINE_MAX_SECONDS && next.videos.length > 1) {
    next.videos.pop();
  }
  const overflow = timelineDuration(next) - TIMELINE_MAX_SECONDS;
  const last = next.videos[next.videos.length - 1];
  if (last && overflow > 0) {
    last.sourceEnd = Math.max(last.sourceStart + MIN_CLIP_SECONDS, last.sourceEnd - overflow * last.speed);
  }
  return next;
}

export function withSourceDuration(doc: EditDocument, sourcePath: string, sourceDuration: number): EditDocument {
  if (sourceDuration <= 0) return doc;
  const next = cloneDoc(doc);
  let changed = false;
  for (const clip of next.videos) {
    if (clip.sourcePath !== sourcePath) continue;
    if (clip.sourceDuration === sourceDuration) continue;
    clip.sourceDuration = sourceDuration;
    clip.sourceEnd = Math.min(clip.sourceEnd, sourceDuration);
    if (clip.sourceEnd - clip.sourceStart < MIN_CLIP_SECONDS) {
      clip.sourceEnd = Math.min(sourceDuration, clip.sourceStart + MIN_CLIP_SECONDS);
    }
    changed = true;
  }
  for (const item of next.audio) {
    if (item.sourcePath !== sourcePath || item.sourceDuration === sourceDuration) continue;
    item.sourceDuration = sourceDuration;
    item.sourceEnd = Math.min(item.sourceEnd, sourceDuration);
    changed = true;
  }
  return changed ? next : doc;
}

export function splitAtPlayhead(doc: EditDocument, timelineTime: number): EditDocument {
  const resolved = resolveTimelineTime(doc, timelineTime);
  if (!resolved) return doc;
  const { clip, clipIndex, sourceTime } = resolved;
  const left = sourceTime - clip.sourceStart;
  const right = clip.sourceEnd - sourceTime;
  if (left < MIN_CLIP_SECONDS || right < MIN_CLIP_SECONDS) return doc;

  const next = cloneDoc(doc);
  next.videos.splice(clipIndex, 1, { ...clip, sourceEnd: sourceTime }, {
    ...clip,
    id: createItemId('tvid'),
    sourceStart: sourceTime,
    transitionIn: 'none',
  });
  return next;
}

export function deleteTimelineItem(doc: EditDocument, id: string): EditDocument {
  const next = cloneDoc(doc);
  if (next.videos.some((item) => item.id === id)) {
    if (next.videos.length <= 1) return doc;
    next.videos = next.videos.filter((item) => item.id !== id);
    if (next.videos[0]) next.videos[0] = { ...next.videos[0], transitionIn: 'none' };
    return next;
  }
  next.images = next.images.filter((item) => item.id !== id);
  next.audio = next.audio.filter((item) => item.id !== id);
  return next;
}

export function trimTimelineVideo(
  doc: EditDocument,
  clipId: string,
  edge: 'start' | 'end',
  sourceTime: number,
): EditDocument {
  const next = cloneDoc(doc);
  const clip = next.videos.find((item) => item.id === clipId);
  if (!clip) return doc;
  const sourceMax = clip.sourceDuration > 0 ? clip.sourceDuration : Math.max(clip.sourceEnd, sourceTime);

  if (edge === 'start') {
    const maxStart = clip.sourceEnd - MIN_CLIP_SECONDS * clip.speed;
    clip.sourceStart = Math.max(0, Math.min(sourceTime, maxStart));
  } else {
    const minEnd = clip.sourceStart + MIN_CLIP_SECONDS * clip.speed;
    clip.sourceEnd = Math.min(sourceMax, Math.max(sourceTime, minEnd));
  }

  return withinMax(next) ? next : doc;
}

export function setClipSpeed(doc: EditDocument, clipId: string, speed: ClipSpeed): EditDocument {
  const next = cloneDoc(doc);
  const clip = next.videos.find((item) => item.id === clipId);
  if (!clip) return doc;
  clip.speed = speed;
  return withinMax(next) ? next : doc;
}

export function setVideoMuted(doc: EditDocument, clipId: string, muted: boolean): EditDocument {
  const next = cloneDoc(doc);
  const clip = next.videos.find((item) => item.id === clipId);
  if (!clip) return doc;
  clip.muted = muted;
  return next;
}

export function setTransitionIn(
  doc: EditDocument,
  clipId: string,
  transitionIn: TransitionKind,
): EditDocument {
  const next = cloneDoc(doc);
  const clip = next.videos.find((item) => item.id === clipId);
  if (!clip) return doc;
  clip.transitionIn = transitionIn;
  return next;
}

export function setClipEffect(doc: EditDocument, clipId: string, effect: ClipEffect | null): EditDocument {
  const next = cloneDoc(doc);
  const clip = next.videos.find((item) => item.id === clipId);
  if (!clip) return doc;
  clip.effect = effect;
  return next;
}

export function cycleTransition(kind: TransitionKind): TransitionKind {
  const order: TransitionKind[] = ['none', 'fade', 'dissolve', 'wipe'];
  return order[(order.indexOf(kind) + 1) % order.length];
}

export function setCaptions(doc: EditDocument, captions: EditCaptions): EditDocument {
  const next = cloneDoc(doc);
  next.captions = {
    enabled: captions.enabled,
    presetId: captions.presetId,
    settings: { ...captions.settings, enabled: captions.enabled, selectedPresetId: captions.presetId },
  };
  return next;
}

export function addVideoToTimeline(doc: EditDocument, video: TimelineVideo): EditDocument {
  const next = cloneDoc(doc);
  const room = remainingTimeline(next);
  if (room < MIN_CLIP_SECONDS) return doc;
  const usable = Math.min(videoDuration(video), room);
  video.sourceEnd = video.sourceStart + usable * video.speed;
  if (video.sourceEnd - video.sourceStart < MIN_CLIP_SECONDS) return doc;
  if (next.videos.length > 0) video.transitionIn = 'none';
  next.videos.push(video);
  return withinMax(next) ? next : doc;
}

export function addImageToTimeline(
  doc: EditDocument,
  input: { sourcePath: string; label?: string; timelineStart?: number },
): EditDocument {
  const next = cloneDoc(doc);
  const videoEnd = videoTrackDuration(next);
  if (videoEnd < MIN_CLIP_SECONDS) return doc;
  const start = Math.max(0, Math.min(input.timelineStart ?? 0, Math.max(0, videoEnd - MIN_CLIP_SECONDS)));
  const duration = Math.min(DEFAULT_IMAGE_SECONDS, videoEnd - start);
  if (duration < 0.25) return doc;
  next.images.push({
    id: createItemId('timg'),
    sourcePath: input.sourcePath,
    timelineStart: start,
    duration,
    label: input.label ?? 'Image',
    x: 0.08,
    y: 0.12,
    widthPct: 0.36,
  });
  return next;
}

export function addAudioToTimeline(
  doc: EditDocument,
  input: { sourcePath: string; sourceDuration: number; label?: string; timelineStart?: number },
): EditDocument {
  const next = cloneDoc(doc);
  const videoEnd = videoTrackDuration(next);
  if (videoEnd < MIN_CLIP_SECONDS) return doc;
  const start = Math.max(0, Math.min(input.timelineStart ?? 0, Math.max(0, videoEnd - MIN_CLIP_SECONDS)));
  const available = videoEnd - start;
  const sourceDuration = Math.max(available, input.sourceDuration || available);
  const used = Math.min(sourceDuration, available);
  if (used < 0.25) return doc;
  next.audio.push({
    id: createItemId('taud'),
    sourcePath: input.sourcePath,
    sourceDuration,
    sourceStart: 0,
    sourceEnd: used,
    timelineStart: start,
    volume: 1,
    label: input.label ?? 'Music',
  });
  return next;
}

export function updateOverlay(doc: EditDocument, id: string, patch: Partial<TimelineOverlay>): EditDocument {
  const next = cloneDoc(doc);
  const item = next.images.find((image) => image.id === id);
  if (!item) return doc;
  Object.assign(item, patch);
  return next;
}

export function updateAudio(doc: EditDocument, id: string, patch: Partial<TimelineAudio>): EditDocument {
  const next = cloneDoc(doc);
  const item = next.audio.find((audio) => audio.id === id);
  if (!item) return doc;
  Object.assign(item, patch);
  return withinMax(next) ? next : doc;
}

export function mapWordsToTimeline(
  doc: EditDocument,
  wordsBySourcePath: Record<string, WordInfo[]>,
): WordInfo[] {
  const ranges = clipTimelineRanges(doc);
  const mapped: WordInfo[] = [];
  for (const range of ranges) {
    const words = wordsBySourcePath[range.clip.sourcePath] ?? [];
    for (const word of words) {
      if (word.end <= range.clip.sourceStart || word.start >= range.clip.sourceEnd) continue;
      const startOffset = Math.max(0, word.start - range.clip.sourceStart) / range.clip.speed;
      const endOffset = Math.max(startOffset + 0.05, (word.end - range.clip.sourceStart) / range.clip.speed);
      mapped.push({
        ...word,
        start: range.start + startOffset,
        end: Math.min(range.end, range.start + endOffset),
      });
    }
  }
  return mapped;
}

export function sourceRanges(doc: EditDocument): { start_time: number; end_time: number }[] {
  return doc.videos.map((clip) => ({
    start_time: clip.sourceStart,
    end_time: clip.sourceEnd,
  }));
}

export function migrateEditDocument(raw: unknown): EditDocument | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as {
    version?: number;
    kind?: EditDocument['kind'];
    targetId?: string;
    projectId?: string;
    linkedClipId?: string;
    videos?: TimelineVideo[];
    clips?: TimelineVideo[];
    images?: TimelineOverlay[];
    audio?: TimelineAudio[];
    captions?: EditCaptions;
    sourcePath?: string;
    sourceDuration?: number;
    windowStart?: number;
    windowEnd?: number;
  };
  if (parsed.version === 2 && Array.isArray(parsed.videos) && parsed.kind && parsed.targetId) {
    return {
      version: 2,
      kind: parsed.kind,
      targetId: parsed.targetId,
      projectId: parsed.projectId,
      linkedClipId: parsed.linkedClipId,
      videos: parsed.videos,
      images: parsed.images ?? [],
      audio: parsed.audio ?? [],
      captions: parsed.captions ?? {
        enabled: true,
        presetId: DEFAULT_CAPTION_PRESET_ID,
        settings: settingsFromPresetId(DEFAULT_CAPTION_PRESET_ID),
      },
    };
  }
  if (parsed.version === 1 && Array.isArray(parsed.clips) && parsed.sourcePath && parsed.kind && parsed.targetId) {
    return createEditDocument({
      kind: parsed.kind,
      targetId: parsed.targetId,
      projectId: parsed.projectId,
      sourcePath: parsed.sourcePath,
      sourceDuration: parsed.sourceDuration ?? 0,
      sourceStart: parsed.windowStart,
      sourceEnd: parsed.windowEnd,
      videos: parsed.clips.map((clip) => ({
        ...createVideoClip({
          sourceKind: 'vod',
          sourcePath: parsed.sourcePath!,
          sourceDuration: parsed.sourceDuration ?? clip.sourceEnd,
          sourceStart: clip.sourceStart,
          sourceEnd: clip.sourceEnd,
        }),
        speed: clip.speed ?? 1,
        muted: false,
        transitionIn: clip.transitionIn ?? 'none',
        label: clip.label ?? 'Video',
      })),
      captions: parsed.captions,
      linkedClipId: parsed.linkedClipId,
    });
  }
  return null;
}
