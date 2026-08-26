export interface ManualRegionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ManualRegion {
  id: string;
  color: string;
  label?: string;
  source: ManualRegionRect;
  output: ManualRegionRect;
  cornerRadiusEnabled?: boolean;
  cornerRadiusPx?: number;
  mediaAssetId?: string;
  mediaType?: 'video-crop' | 'image' | 'video';
  aspectRatioLocked?: boolean;
}

export interface SegmentRegionConfig {
  segmentId: string;
  startTime: number;
  endTime: number;
  regions: ManualRegion[];
}

export type ManualSourceFrameMode = 'none' | 'scale' | 'use16x9';

export interface ManualFramingConfig {
  mode: 'manual';
  regions: ManualRegion[];
  targetAspectRatio: string;
  sourceAspectRatio?: string;
  segmentConfigs?: SegmentRegionConfig[];
  sourceFrameMode?: ManualSourceFrameMode;
  blurEnabled?: boolean;
  blurAmount?: number;
  sourceTransform?: {
    scale: number;
    x: number;
    y: number;
  };
}

export const POI_REGION_COLORS = [
  '#4F9DFF',
  '#FF6B6B',
  '#4ECB71',
  '#FFB84D',
  '#A78BFA',
  '#F472B6',
  '#22D3EE',
  '#FBBF24',
] as const;

export const MAX_POI_REGIONS = 6;

export function createDefaultManualRegion(index: number): ManualRegion {
  const color = POI_REGION_COLORS[index % POI_REGION_COLORS.length];
  return {
    id: `region-${Date.now()}-${index}`,
    color,
    label: `Region ${index + 1}`,
    source: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 },
    output: { x: 0.05, y: 0.05 + index * 0.15, width: 0.9, height: 0.25 },
    aspectRatioLocked: true,
  };
}

export function createDefaultManualFramingConfig(targetAspectRatio = '9:16'): ManualFramingConfig {
  return {
    mode: 'manual',
    regions: [],
    targetAspectRatio,
    sourceAspectRatio: '16:9',
    sourceFrameMode: 'scale',
    blurEnabled: false,
    blurAmount: 12,
    sourceTransform: { scale: 1, x: 0, y: 0 },
    segmentConfigs: [],
  };
}

export function parseManualFramingConfig(raw: string | null | undefined): ManualFramingConfig | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ManualFramingConfig;
    if (parsed?.mode !== 'manual') return null;
    return parsed;
  } catch {
    return null;
  }
}
