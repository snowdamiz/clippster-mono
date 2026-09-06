import type { TargetAspectRatio } from '@clippster/shared-types';
import type { MobileEditProjectV3 } from '../model/schema';

export type EditorTime = number;
export type PreviewQuality = 'proxy' | 'balanced' | 'full';

export interface EditorChangeSet {
  document: MobileEditProjectV3;
}

export interface ExportRequest {
  ratios: TargetAspectRatio[];
  outputDirectory?: string;
}

export interface ExportJob {
  outputPaths: string[];
}

/**
 * Bridge contract for the clean-room native editor engine.
 * React Native owns gestures/selection; the engine owns playback time + render.
 */
export interface MobileEditorEngine {
  load(project: MobileEditProjectV3): Promise<void>;
  apply(change: EditorChangeSet): Promise<void>;
  play(): void;
  pause(): void;
  seek(time: EditorTime, mode: 'interactive' | 'precise'): Promise<void>;
  setPreviewQuality(quality: PreviewQuality): void;
  export(request: ExportRequest): Promise<ExportJob>;
  dispose(): Promise<void>;
}
