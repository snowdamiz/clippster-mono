import type { ClipEffect } from '@clippster/clip-export';
import type { SubtitleSettings, TargetAspectRatio } from '@clippster/shared-types';

export const MOBILE_EDIT_SCHEMA_VERSION = 3 as const;
export const EDITOR_TICKS_PER_SECOND = 60_000;
export const EDITOR_MAX_SECONDS = 120;
export const EDITOR_MAX_TICKS = EDITOR_MAX_SECONDS * EDITOR_TICKS_PER_SECOND;

export type EditorId = string;
export type EditorTick = number;
export type CanvasRatio = TargetAspectRatio;
export type EditorFrameRate = 30 | 60;
export type MediaKind = 'video' | 'image' | 'audio';
export type VideoSourceKind = 'vod' | 'clip' | 'build' | 'upload' | 'recording';
export type SelectionKind = 'video' | 'text' | 'caption' | 'overlay' | 'audio' | 'transition';
export type TransitionKind = 'cut' | 'fade' | 'dissolve' | 'wipe';

export interface CanvasOutput {
  width: number;
  height: number;
  fps: EditorFrameRate;
}

export interface EditorCanvas {
  activeRatio: CanvasRatio;
  outputByRatio: Record<CanvasRatio, CanvasOutput>;
  safeAreaVisible: boolean;
}

export interface Transform {
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  rotationDeg: number;
  anchorX: number;
  anchorY: number;
  fit: 'contain' | 'cover' | 'fill';
}

export interface RatioAwareTransform {
  base: Transform;
  overrides?: Partial<Record<CanvasRatio, Transform>>;
}

export interface MediaDerivativeRef {
  uri: string;
  width?: number;
  height?: number;
  durationTicks?: EditorTick;
  byteSize?: number;
  createdAt: number;
}

export interface MediaAssetRef {
  id: EditorId;
  kind: MediaKind;
  sourceKind: VideoSourceKind | 'image' | 'audio';
  sourceId?: string;
  sourceUri: string;
  sourceFingerprint: string;
  durationTicks: EditorTick;
  width?: number;
  height?: number;
  rotationDeg?: number;
  hasAudio?: boolean;
  proxy?: MediaDerivativeRef;
  thumbnail?: MediaDerivativeRef;
}

export interface TimedItem {
  id: EditorId;
  timelineStart: EditorTick;
  timelineEnd: EditorTick;
}

export interface VideoItem extends TimedItem {
  kind: 'video';
  assetId: EditorId;
  sourceStart: EditorTick;
  sourceEnd: EditorTick;
  speed: number;
  volume: number;
  pitchPolicy: 'preserve' | 'resample';
  transform: RatioAwareTransform;
  effectStack: ClipEffect[];
  label: string;
}

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  color: string;
  outlineColor?: string;
  outlineWidth?: number;
  backgroundColor?: string;
  alignment: 'left' | 'center' | 'right';
}

export interface TimedTextItem extends TimedItem {
  kind: 'text';
  content: string;
  style: TextStyle;
  transform: RatioAwareTransform;
  animationIn?: string;
  animationOut?: string;
}

export interface OverlayItem extends TimedItem {
  kind: 'overlay';
  assetId: EditorId;
  sourceStart: EditorTick;
  sourceEnd: EditorTick;
  speed: number;
  volume: number;
  opacity: number;
  crop: { x: number; y: number; width: number; height: number };
  transform: RatioAwareTransform;
  effectStack: ClipEffect[];
}

export interface AudioItem extends TimedItem {
  kind: 'audio';
  assetId: EditorId;
  sourceStart: EditorTick;
  sourceEnd: EditorTick;
  speed: number;
  volume: number;
  fadeInTicks: EditorTick;
  fadeOutTicks: EditorTick;
  role: 'music' | 'sound' | 'voiceover';
  label: string;
}

export interface TransitionItem {
  id: EditorId;
  kind: 'transition';
  fromItemId: EditorId;
  toItemId: EditorId;
  transition: TransitionKind;
  durationTicks: EditorTick;
}

export interface CaptionWord {
  id: EditorId;
  word: string;
  start: EditorTick;
  end: EditorTick;
  confidence?: number;
}

export interface CaptionPhrase {
  id: EditorId;
  wordIds: EditorId[];
  start: EditorTick;
  end: EditorTick;
}

export interface CaptionDocument {
  id: EditorId;
  enabled: boolean;
  source: 'transcript' | 'manual';
  words: CaptionWord[];
  phrases: CaptionPhrase[];
  presetId: string;
  settings: SubtitleSettings;
  transform: RatioAwareTransform;
  effect: {
    mode: 'phrase' | 'word' | 'karaoke' | 'one-word';
    animation?: 'none' | 'pop' | 'bounce';
  };
}

export interface BrandingReference {
  creatorId?: string;
  organizationId?: number;
  campaignId?: number;
  watermarkMode: 'creator' | 'custom' | 'none';
  presetId?: string;
}

export interface VideoTrack {
  id: EditorId;
  kind: 'video';
  items: VideoItem[];
  transitions: TransitionItem[];
}

export interface TextTrack {
  id: EditorId;
  kind: 'text';
  items: TimedTextItem[];
}

export interface OverlayTrack {
  id: EditorId;
  kind: 'overlay';
  items: OverlayItem[];
}

export interface AudioTrack {
  id: EditorId;
  kind: 'audio';
  items: AudioItem[];
}

export type EditorTrack = VideoTrack | TextTrack | OverlayTrack | AudioTrack;

export interface MobileEditProjectV3 {
  schemaVersion: typeof MOBILE_EDIT_SCHEMA_VERSION;
  id: EditorId;
  kind: 'project' | 'clip';
  targetId: string;
  projectId?: string;
  linkedClipId?: string;
  canvas: EditorCanvas;
  assets: Record<EditorId, MediaAssetRef>;
  tracks: EditorTrack[];
  captionDocument?: CaptionDocument;
  branding?: BrandingReference;
  createdAt: number;
  updatedAt: number;
}

export interface EditorSelection {
  kind: SelectionKind;
  id: EditorId;
}

export const DEFAULT_TRANSFORM: Transform = {
  positionX: 0.5,
  positionY: 0.5,
  scaleX: 1,
  scaleY: 1,
  rotationDeg: 0,
  anchorX: 0.5,
  anchorY: 0.5,
  fit: 'contain',
};

export function createDefaultCanvas(activeRatio: CanvasRatio = '9:16'): EditorCanvas {
  return {
    activeRatio,
    outputByRatio: {
      '9:16': { width: 1080, height: 1920, fps: 30 },
      '16:9': { width: 1920, height: 1080, fps: 30 },
    },
    safeAreaVisible: false,
  };
}

export function createDefaultRatioAwareTransform(
  base: Transform = DEFAULT_TRANSFORM,
): RatioAwareTransform {
  return { base: { ...base } };
}

export function transformForRatio(
  transform: RatioAwareTransform,
  ratio: CanvasRatio,
): Transform {
  return { ...transform.base, ...(transform.overrides?.[ratio] ?? {}) };
}

export function secondsToTicks(seconds: number): EditorTick {
  return Math.round(seconds * EDITOR_TICKS_PER_SECOND);
}

export function ticksToSeconds(ticks: EditorTick): number {
  return ticks / EDITOR_TICKS_PER_SECOND;
}

export function frameToTicks(frame: number, fps: EditorFrameRate): EditorTick {
  return Math.round((frame * EDITOR_TICKS_PER_SECOND) / fps);
}

export function ticksToFrame(ticks: EditorTick, fps: EditorFrameRate): number {
  return Math.round((ticks * fps) / EDITOR_TICKS_PER_SECOND);
}
