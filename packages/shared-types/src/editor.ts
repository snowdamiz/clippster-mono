import type { ManualFramingConfig } from './manualFraming';
import type { SubtitleSettings } from './subtitle';

export interface LayoutOverlay {
  id: string;
  type: string;
  [key: string]: unknown;
}

export interface WatermarkSettings {
  enabled: boolean;
  [key: string]: unknown;
}

export interface ActiveVodPresetConfig {
  presetId: string | null;
  targetAspectRatio: string;
  framingConfig: ManualFramingConfig | null;
  layoutOverlays: LayoutOverlay[];
  watermarkMode: 'creator' | 'custom' | 'none';
  customWatermarkSettings: WatermarkSettings | null;
  subtitleDefaults?: SubtitleSettings | null;
  orgBranding?: {
    brandingConfig?: Record<string, unknown>;
    brandingRequired?: boolean;
    organizationId?: number;
    campaignId?: number;
  } | null;
}

export interface ClipBuild {
  id: string;
  clip_id: string;
  aspect_ratios: string | null;
  quality: string | null;
  frame_rate: number | null;
  output_format: string | null;
  include_subtitles: number;
  file_path: string;
  thumbnail_path: string | null;
  file_size: number | null;
  duration: number | null;
  build_number: number;
  status: 'building' | 'completed' | 'failed';
  error_message: string | null;
  progress: number;
  started_at: number;
  completed_at: number | null;
  created_at: number;
}

export type TargetAspectRatio = '9:16' | '16:9';

export const TARGET_DIMENSIONS: Record<TargetAspectRatio, { width: number; height: number }> = {
  '9:16': { width: 1080, height: 1920 },
  '16:9': { width: 1920, height: 1080 },
};

export function parseActiveVodPresetConfig(raw: string | null | undefined): ActiveVodPresetConfig | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveVodPresetConfig;
  } catch {
    return null;
  }
}

export function createDefaultActiveVodPresetConfig(
  targetAspectRatio: TargetAspectRatio = '9:16',
): ActiveVodPresetConfig {
  return {
    presetId: null,
    targetAspectRatio,
    framingConfig: null,
    layoutOverlays: [],
    watermarkMode: 'none',
    customWatermarkSettings: null,
    subtitleDefaults: null,
  };
}
