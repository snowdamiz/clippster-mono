export type EditorTime = number;
export type PreviewQuality = 'proxy' | 'balanced' | 'full' | 'auto' | 'low' | 'medium' | 'high';
export type SeekMode = 'interactive' | 'precise';

export interface CapabilitySpec {
  id: string;
  hasGraphNode: boolean;
  hasAndroidRenderer: boolean;
  hasIosRenderer: boolean;
  hasExport: boolean;
  hasValidation: boolean;
  hasGoldenFixture: boolean;
}

export interface ExportRequest {
  ratios: Array<'9:16' | '16:9'>;
  outputDirectory?: string;
  width?: number;
  height?: number;
  fps?: number;
}

export interface ExportJob {
  outputPaths: string[];
}

export interface TimeUpdateEvent {
  timeSeconds: number;
  mode?: SeekMode;
}

export interface ExportProgressEvent {
  progress: number;
  message?: string;
}

export function isCapabilityVisible(spec: CapabilitySpec): boolean {
  return (
    spec.hasGraphNode &&
    spec.hasAndroidRenderer &&
    spec.hasIosRenderer &&
    spec.hasExport &&
    spec.hasValidation &&
    spec.hasGoldenFixture
  );
}
