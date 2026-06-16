export const STUDIO_RECORDING_DESCRIPTION = 'Recorded in Clippster Studio';

export type StudioAspectRatio = '16:9' | '9:16' | '4:5' | '1:1';
export type StudioRecordingMode = 'camera' | 'screen' | 'screen_camera';
/** What fills the background when mode is screen or screen_camera. */
export type StudioBackgroundSourceType = 'none' | 'display' | 'media';

export interface StudioMediaSource {
  path: string;
  label: string;
}

export interface StudioDevice {
  id: string;
  label: string;
  kind: 'camera' | 'microphone' | 'display';
  browserDeviceId?: string;
}

export interface StudioRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StudioLayerBorder {
  color: string;
  width: number;
}

export interface StudioLayerGlow {
  color: string;
  blur: number;
}

export type StudioLayerKind = 'background' | 'screen' | 'camera' | 'image' | 'shape' | 'text';
export type StudioLayerFit = 'cover' | 'contain' | 'fill';

export interface StudioLayer {
  id: string;
  kind: StudioLayerKind;
  name: string;
  rect: StudioRect;
  zIndex: number;
  visible: boolean;
  opacity: number;
  fit?: StudioLayerFit;
  borderRadius?: number;
  border?: StudioLayerBorder | null;
  glow?: StudioLayerGlow | null;
  fill?: string | null;
  /** Local file path for image overlays */
  imagePath?: string | null;
  text?: string | null;
  textColor?: string | null;
  fontSize?: number | null;
  fontWeight?: string | null;
}

export interface StudioLayout {
  version: 1;
  aspectRatio: StudioAspectRatio;
  backgroundFill: string;
  layers: StudioLayer[];
}

export interface StudioWatermarkConfig {
  path: string;
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
}

export interface StudioRecordingConfig {
  mode: StudioRecordingMode;
  aspectRatio: StudioAspectRatio;
  width: number;
  height: number;
  fps: number;
  cameraDeviceId?: string | null;
  microphoneDeviceId?: string | null;
  displayId?: string | null;
  includeSystemAudio: boolean;
  hideCursor: boolean;
  micVolume: number;
  shareAudioVolume: number;
  cameraPip?: StudioRect | null;
  watermark?: StudioWatermarkConfig | null;
}

export interface StudioRecordingResult {
  filePath: string;
  duration: number;
  width: number;
  height: number;
  frameRate: number;
  fileSize: number;
  codec?: string | null;
}

export interface StudioTemplate {
  id: string;
  name: string;
  mode: StudioRecordingMode;
  aspectRatio: StudioAspectRatio;
  layout: StudioLayout;
  brandingProfileId?: string | null;
  /** @deprecated migrated into layout layers */
  cameraPip?: StudioRect;
  /** @deprecated migrated into layout layers */
  watermarkOverride?: StudioRect | null;
  createdAt: number;
  updatedAt: number;
}

export const STUDIO_LAYER_IDS = {
  screen: '__screen__',
  camera: '__camera__',
  watermark: '__watermark__',
} as const;

export const STUDIO_ASPECT_PRESETS: Record<
  StudioAspectRatio,
  { width: number; height: number; label: string }
> = {
  '16:9': { width: 1920, height: 1080, label: '16:9 Landscape' },
  '9:16': { width: 1080, height: 1920, label: '9:16 Vertical' },
  '4:5': { width: 1080, height: 1350, label: '4:5 Portrait' },
  '1:1': { width: 1080, height: 1080, label: '1:1 Square' },
};

export const DEFAULT_SOURCE_RECT: StudioRect = {
  x: 0,
  y: 0,
  width: 1,
  height: 1,
};

export const DEFAULT_CAMERA_PIP: StudioRect = {
  x: 0.02,
  y: 0.02,
  width: 0.22,
  height: 0.22,
};

export const DEFAULT_WATERMARK_RECT: StudioRect = {
  x: 0.75,
  y: 0.02,
  width: 0.2,
  height: 0.1,
};
