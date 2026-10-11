import type { ClipSegment, WordInfo } from './clip';
import type { TargetAspectRatio } from './editor';
import type { ManualFramingConfig } from './manualFraming';
import type { SubtitleSettings } from './subtitle';
import type { ClipTextBoxState } from './clipTextBox';
export interface WebBranding {
  creatorId?: number;
  introId?: number;
  outroId?: number;
  watermarkId?: number;
  watermarkX: number;
  watermarkY: number;
  watermarkWidth: number;
}

/** Browser workspace records contain opaque IDs, never machine-local media paths. */
export interface WebClip {
  id: string;
  name: string;
  segments: ClipSegment[];
  aspectRatio: TargetAspectRatio;
  captions: boolean;
  framingConfig?: ManualFramingConfig | null;
  subtitleSettings?: SubtitleSettings | null;
  textBox?: ClipTextBoxState | null;
  branding?: WebBranding | null;
  revision: number;
  builtRevision: number | null;
}
export interface WebProject {
  id: string;
  name: string;
  folder?: string;
  sourceUrl: string | null;
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
  framingConfig?: ManualFramingConfig | null;
  subtitleSettings?: SubtitleSettings | null;
  textBox?: ClipTextBoxState | null;
  branding?: WebBranding | null;
}
export const WEB_PUBLISH_PLATFORMS: readonly string[] = ['instagram', 'twitter', 'x', 'tiktok', 'youtube', 'tokend']
