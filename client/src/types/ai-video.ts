export interface AIVideoComposition {
  id: string;
  name: string;
  duration: number;
  fps: number;
  width: number;
  height: number;
  aspectRatio: '16:9' | '9:16' | '1:1' | '4:5';
  backgroundColor?: string;
  tracks: AIVideoTrack[];
}

export interface AIVideoTrack {
  id: string;
  type: 'video' | 'audio' | 'image' | 'text' | 'shape';
  name: string;
  source?: MediaSource;
  startTime: number;
  endTime: number;
  layer: number;
  properties: TrackProperties;
}

export interface MediaSource {
  type: 'local' | 'asset' | 'clip';
  path: string;
  thumbnailPath?: string;
  duration?: number;
  assetId?: string;
  clipId?: string;
}

export interface TrackProperties {
  x?: number | KeyframeAnimation;
  y?: number | KeyframeAnimation;
  width?: number | KeyframeAnimation;
  height?: number | KeyframeAnimation;
  scale?: number | KeyframeAnimation;
  rotation?: number | KeyframeAnimation;
  opacity?: number | KeyframeAnimation;
  
  trimStart?: number;
  trimEnd?: number;
  playbackRate?: number;
  volume?: number | KeyframeAnimation;
  
  text?: TextProperties;
  
  shape?: ShapeProperties;
  
  effects?: Effect[];
  enterTransition?: Transition;
  exitTransition?: Transition;
}

export interface TextProperties {
  content: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: 400 | 500 | 600 | 700 | 800 | 900;
  color: string;
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  textAlign: 'left' | 'center' | 'right';
  lineHeight?: number;
  letterSpacing?: number;
  textShadow?: string;
  stroke?: { color: string; width: number };
  animation?: TextAnimation;
}

export type TextAnimation = 
  | { type: 'none' }
  | { type: 'fade'; duration: number }
  | { type: 'slide-up'; duration: number; distance?: number }
  | { type: 'slide-down'; duration: number; distance?: number }
  | { type: 'typewriter'; speed: number }
  | { type: 'bounce'; duration: number }
  | { type: 'scale-in'; duration: number }
  | { type: 'blur-in'; duration: number };

export interface ShapeProperties {
  type: 'rectangle' | 'circle' | 'ellipse' | 'line';
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
}

export interface KeyframeAnimation {
  keyframes: Keyframe[];
}

export interface Keyframe {
  time: number;
  value: number;
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';
}

export interface Effect {
  type: 'blur' | 'brightness' | 'contrast' | 'saturation' | 'hue-rotate' | 'grayscale' | 'sepia';
  value: number | KeyframeAnimation;
}

export interface Transition {
  type: 'fade' | 'slide-left' | 'slide-right' | 'slide-up' | 'slide-down' | 'zoom' | 'wipe';
  duration: number;
  easing?: string;
}

export interface AIVideoMediaItem {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  source: MediaSource;
  thumbnailUrl?: string;
  duration?: number;
  dimensions?: { width: number; height: number };
  addedAt: Date;
}

export interface AIGenerationRequest {
  prompt: string;
  media: AIVideoMediaItem[];
  style?: string;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
}

export interface ExportSettings {
  outputPath: string;
  codec: 'h264' | 'h265';
  quality: 'draft' | 'standard' | 'high';
  crf?: number;
}

export interface ExportProgress {
  id: string;
  status: 'preparing' | 'rendering' | 'complete' | 'error' | 'cancelled';
  progress: number;
  renderedFrames: number;
  totalFrames: number;
  error?: string;
}

export interface StylePreset {
  id: string;
  name: string;
  description: string;
  thumbnailUrl?: string;
  settings: {
    defaultTransitions?: Transition;
    defaultTextStyle?: Partial<TextProperties>;
    defaultEffects?: Effect[];
    backgroundColor?: string;
  };
}
