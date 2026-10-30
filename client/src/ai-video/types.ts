/** Shared types for the AI video editor. Field names match the server JSON and the agent prompt. */
import type { SupportedTargetAspectRatio } from '@/lib/creatorClipBuildDefaults';

export type MediaKind = 'video' | 'photo' | 'audio';

export interface MediaItem {
  id: string;
  name: string;
  kind: MediaKind;
  /** Absolute local path. Stripped by the server before anything reaches the model. */
  path: string;
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  contentHash: string;
}

// -- Measurement (Tauri `measure_video`) ------------------------------------------

export type MeasuredTransition = 'start' | 'cut' | 'flash' | 'dissolve' | 'dip' | 'continuous';

export interface MeasuredShot {
  index: number;
  start: number;
  end: number;
  duration: number;
  transitionIn: MeasuredTransition;
  motion: number;
  motionPeak: number;
  brightness: number;
  saturation: number;
  averageColor: string;
  speedRampHint: boolean;
  freezeHint: boolean;
  flashes: number[];
  keyframePath: string | null;
}

export interface VideoMeasurement {
  duration: number;
  width: number;
  height: number;
  fps: number;
  frameCount: number;
  cutThreshold: number;
  shots: MeasuredShot[];
}

export interface ProgressEvent {
  stage: string;
  progress: number;
  message: string;
}

// -- Example blueprint (server `VideoBlueprint` + summary) ------------------------------

export interface ShotLabel {
  shotType?: string;
  subject?: string;
  action?: string;
  camera?: string;
  onScreenText?: string | null;
  textStyle?: string | null;
  effects?: string[];
  color?: string;
  role?: string;
  confidence?: number;
}

export type BlueprintShot = Omit<MeasuredShot, 'keyframePath'> & { label: ShotLabel | null };

export interface BlueprintSection {
  name: string;
  start: number;
  end: number;
}

export interface Blueprint {
  duration: number;
  width: number;
  height: number;
  fps: number;
  shots: BlueprintShot[];
  beats: {
    bpm: number | null;
    confidence: string;
    beats: Array<{ time: number; strength: number }>;
  } | null;
  stats: {
    shots: number;
    medianShot: number;
    shortestShot: number;
    longestShot: number;
    cutsPerMinute: number | null;
    cutsOnBeat: number | null;
    transitions: Record<string, number>;
  };
  sections?: BlueprintSection[];
  hero?: { start: number; end: number } | null;
  techniques?: string[];
  summary?: string;
}

export interface ReferenceInfo {
  path: string;
  displayName: string;
  sourceUrl: string | null;
  sourceType: string;
  duration: number;
  width: number;
  height: number;
  fps: number;
}

// -- Source index -------------------------------------------------------------------

export interface SourceSegment {
  index: number;
  start: number;
  end: number;
  motion: number;
  brightness: number;
  saturation: number;
  description?: string;
  shotType?: string;
  subject?: string;
  camera?: string;
  quality?: 'good' | 'soft' | 'shaky' | 'dark' | 'overexposed' | 'unusable';
  hero?: number;
  text?: string | null;
  focus?: { x: number; y: number };
}

/** content hash → chunk key → labelled segments. */
export type SourceIndex = Record<string, Record<string, { segments: SourceSegment[] }>>;

// -- Edit document ------------------------------------------------------------------

export const SHOT_MOVES = [
  'none',
  'push-in',
  'pull-out',
  'pan-left',
  'pan-right',
  'punch',
  'shake',
] as const;
export const SHOT_TRANSITIONS = ['cut', 'flash', 'dip', 'dissolve'] as const;
export const OVERLAY_LANES = ['graphics', 'text'] as const;

export type ShotMove = (typeof SHOT_MOVES)[number];
export type ShotTransition = (typeof SHOT_TRANSITIONS)[number];
export type OverlayLane = (typeof OVERLAY_LANES)[number];
export type AspectRatio = SupportedTargetAspectRatio;

export interface ShotAlternate {
  mediaId: string;
  sourceIn: number;
  description: string;
}

export type VariableValue = string | number | boolean;

/** A full-frame composition the AI designed, played as a shot instead of footage. */
export interface ShotScene {
  composition: string;
  label: string;
  variables: Record<string, VariableValue>;
}

/** One block on the video lane: the user's footage or photo (`mediaId`), or a designed `scene`. */
export interface EditShot {
  id: string;
  mediaId: string | null;
  scene: ShotScene | null;
  sourceIn: number;
  duration: number;
  speed: number;
  move: ShotMove;
  transitionIn: ShotTransition;
  refShot: number | null;
  description: string;
  alternates: ShotAlternate[];
}

export interface EditOverlay {
  id: string;
  lane: OverlayLane;
  start: number;
  duration: number;
  label: string;
  composition: string;
  variables: Record<string, VariableValue>;
}

export interface EditFormat {
  width: number;
  height: number;
  fps: number;
}

export interface EditDocument {
  title: string;
  format: EditFormat;
  music: { mediaId: string; start: number; volume: number } | null;
  clipAudio: number;
  shots: EditShot[];
  overlays: EditOverlay[];
}

// -- Server records -------------------------------------------------------------------

export type SessionStatus = 'draft' | 'working' | 'ready';
export type RunKind = 'generate' | 'revise' | 'reference' | 'plan';

/** One step of the plan agreed in the planning chat: footage filling the frame, or a designed scene. */
export interface PlanBeat {
  seconds: number;
  kind: 'scene' | 'footage';
  what: string;
  words?: string;
  /** Media ids shown in this beat. */
  media?: string[];
}

export interface VideoPlan {
  title: string;
  /** Total length in seconds. */
  seconds: number;
  /** Only without an example. */
  aspect?: AspectRatio;
  tone?: string;
  /** Facts and must-haves the user gave. */
  notes?: string;
  beats: PlanBeat[];
}

export interface VideoRun {
  id: number;
  kind: RunKind;
  status: 'running' | 'completed' | 'failed';
  credits_charged: number;
  refunded: boolean;
  turns: number;
  label_calls: number;
  error: string | null;
}

export interface SessionMessage {
  id: number;
  role: 'user' | 'assistant';
  content: string;
  /** `phase: 'plan'` marks the planning chat; its replies carry the plan when it changed. */
  metadata: { run_id?: number; refunded?: boolean; phase?: 'plan'; plan?: VideoPlan } | null;
  inserted_at: string;
}

export interface VideoSession {
  id: number;
  name: string | null;
  status: SessionStatus;
  media_items: MediaItem[];
  reference: ReferenceInfo | null;
  reference_blueprint: Blueprint | null;
  /** Chosen shape for a video without an example; null uses the clips' shape. */
  aspect_ratio: AspectRatio | null;
  source_index: SourceIndex | null;
  document: EditDocument | null;
  composition_files: Record<string, string> | null;
  thumbnail_url: string | null;
  running_run: VideoRun | null;
  messages: SessionMessage[];
  inserted_at: string;
  updated_at: string;
}

export interface SessionSummary {
  id: number;
  name: string | null;
  status: SessionStatus;
  thumbnail_url: string | null;
  inserted_at: string;
  updated_at: string;
}

export interface VideoPolicy {
  credits: { generate: number; revise: number; reference: number };
  max_output_seconds: number;
  max_label_calls: number;
  max_reference_chunks: number;
}

// -- Agent protocol -------------------------------------------------------------------

export interface ToolCall {
  id: string;
  name:
    | 'set_edit'
    | 'write_file'
    | 'read_file'
    | 'list_files'
    | 'delete_file'
    | 'check'
    | 'snapshot';
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  content: string;
  images?: Array<{ label: string; data: string }>;
}

export type TurnResponse =
  | { type: 'tools'; calls: ToolCall[]; text: string }
  | { type: 'finish'; message: string }
  | { type: 'limit' };

export interface Candidate {
  mediaId: string;
  sourceIn: number;
  maxDuration: number;
  score: number;
  description: string;
}

export interface GenerateBrief {
  format: EditFormat;
  /** Only with an example: the best footage for each of its shots. */
  candidates?: Array<{ refShot: number; duration: number; options: Candidate[] }>;
  music: { mediaId: string; duration: number; bpm: number | null; beats: number[] } | null;
}
