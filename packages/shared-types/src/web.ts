import type { ClipSegment, WordInfo } from './clip';
import type { TargetAspectRatio } from './editor';
import type { ManualFramingConfig } from './manualFraming';
import type { SubtitleSettings } from './subtitle';
import type { ClipTextBoxState } from './clipTextBox';
import type { ActiveVodPresetConfig } from './editor';
export interface WebBranding {
  organizationId?: number;
  brandingProfileId?: number;
  campaignId?: number;
  creatorId?: number;
  introId?: number | null;
  outroId?: number | null;
  watermarkId?: number | null;
  watermarkCustom?: boolean;
  watermarkOpacity?: number;
  watermarkX: number;
  watermarkY: number;
  watermarkWidth: number;
}

/** Browser workspace records contain opaque IDs, never machine-local media paths. */
export interface WebClip {
  linkedProjectId?: string;
  detection?: { viralityScore?: number; confidenceScore?: number; reason?: string; promptName?: string; sessionId?: string };
  builds?: Array<{ id: string; revision: number; aspectRatio: TargetAspectRatio; format: 'mp4' | 'mov'; completedAt: number; duration?: number; publishedAt?: number; organizationId?: number; campaignId?: number }>;
  id: string;
  name: string;
  segments: ClipSegment[];
  aspectRatio: TargetAspectRatio;
  captions: boolean;
  subtitleWords?: WordInfo[] | null;
  framingConfig?: ManualFramingConfig | null;
  framingConfigs?: Record<string, ManualFramingConfig>;
  subtitleSettings?: SubtitleSettings | null;
  textBox?: ClipTextBoxState | null;
  branding?: WebBranding | null;
  revision: number;
  builtRevision: number | null;
  exportSettings?: { quality: 'low' | 'medium' | 'high'; frameRate: 30 | 60; format: 'mp4' | 'mov' } | null;
  exportRatios?: TargetAspectRatio[];
}
export interface WebProject {
  vodPresetConfig?: ActiveVodPresetConfig | null;
  sourcePlatform?: string;
  sourceChannel?: string;
  transcriptRanges?: Array<{ start: number; end: number }>;
  id: string;
  name: string;
  folder?: string;
  description?: string | null;
  creatorId?: number | null;
  sourceUrl: string | null;
  sourceRange?: { startTime: number; endTime: number } | null;
  status: 'empty' | 'importing' | 'ready' | 'error';
  duration: number;
  width: number;
  height: number;
  hasAudio: boolean;
  clips: WebClip[];
  words: WordInfo[];
  error: string | null;
  createdAt: number;
  updatedAt: number;
}
export interface WebJob {
  clipId?: string;
  id: string;
  projectId: string;
  kind: 'import' | 'detect' | 'transcribe' | 'build';
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  createdAt: number;
}
export interface WebWorkspace {
  project: WebProject;
  jobs: WebJob[];
}
export interface WebClipInput {
  name: string;
  segments: Pick<ClipSegment, 'start_time' | 'end_time'>[];
  aspectRatio: TargetAspectRatio;
  captions: boolean;
  subtitleWords?: WordInfo[] | null;
  framingConfig?: ManualFramingConfig | null;
  framingConfigs?: Record<string, ManualFramingConfig>;
  subtitleSettings?: SubtitleSettings | null;
  textBox?: ClipTextBoxState | null;
  branding?: WebBranding | null;
  exportSettings?: WebClip['exportSettings'];
}
export const WEB_PUBLISH_PLATFORMS: readonly string[] = ['instagram', 'twitter', 'x', 'tiktok', 'youtube', 'tokend']
