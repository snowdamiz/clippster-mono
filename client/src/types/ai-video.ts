// AI Video Creator Type Definitions

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
  type: 'video' | 'audio' | 'image' | 'text' | 'shape' | 'cameraMotion' | 'impactFX' | 'transition' | 'motionGraphic';
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
  // Transform (can be animated)
  x?: number | KeyframeAnimation;
  y?: number | KeyframeAnimation;
  width?: number | KeyframeAnimation;
  height?: number | KeyframeAnimation;
  scale?: number | KeyframeAnimation;
  rotation?: number | KeyframeAnimation;
  opacity?: number | KeyframeAnimation;
  
  // Video/Audio specific
  trimStart?: number;
  trimEnd?: number;
  playbackRate?: number;
  volume?: number | KeyframeAnimation;
  
  // Text specific
  text?: TextProperties;
  
  // Shape specific
  shape?: ShapeProperties;
  
  // Effects & transitions
  effects?: Effect[];
  enterTransition?: Transition;
  exitTransition?: Transition;

  // Motion graphic specific
  motionGraphic?: MotionGraphicProperties;
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

export interface MotionGraphicProperties {
  templateId: MotionGraphicTemplate;
  variant?: string;
  customText?: string;
  customColors?: string[];
  animationSpeed?: number;
  springConfig?: { mass?: number; damping?: number; stiffness?: number };
  perspective?: number;
  rotateX?: number;
  rotateY?: number;
  blur?: number;
  scale3D?: number;
}

export type MotionGraphicTemplate =
  | 'lowerThird'
  | 'subscribeCTA'
  | 'logoReveal'
  | 'titleCard'
  | 'endScreen'
  | 'numberCounter'
  | 'progressBar'
  | 'timerCountdown'
  | 'neonFrame'
  | 'particleBackground'
  | 'kineticText'
  | 'animatedInfoCard'
  | 'dataCounter'
  | 'calloutBox'
  | 'splitReveal'
  | 'glitchTitle'
  | 'gradientWave'
  | 'floatingBadge'
  | 'animatedDivider'
  | 'spotlightReveal';

export interface KeyframeAnimation {
  keyframes: Keyframe[];
}

export interface Keyframe {
  time: number; // 0-1 normalized within track duration
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

// Media library types
export interface AIVideoMediaItem {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  source: {
    type: 'local' | 'asset' | 'clip';
    path: string;
    thumbnailPath?: string;
    duration?: number;
    assetId?: string;
    clipId?: string;
  };
  thumbnailUrl?: string;
  duration?: number;
  dimensions?: { width: number; height: number };
  transcript?: string;
  audioPeaks?: Array<{ time: number; amplitude: number }>;
  addedAt: Date;
}

// AI generation
export type StylePreset = 'hype' | 'professional' | 'gaming' | 'cinematic' | 'tutorial' | 'vlog' | 'music_video' | 'product';

export type CaptionStylePreset = 'bold_tiktok' | 'clean_subtitle' | 'neon_glow' | 'minimal' | 'none';

export interface AIGenerationRequest {
  prompt: string;
  media: AIVideoMediaItem[];
  style?: string;
  stylePreset?: StylePreset;
  intensity?: number; // 0.0 - 1.0
  captionStyle?: CaptionStylePreset;
  duration?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1' | '4:5';
  existingComposition?: AIVideoComposition | null;
}

// Export
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

// Imported clip data with full edit information
export interface ImportedClipData {
  id: string;
  name: string;
  videoPath: string;
  thumbnailPath?: string;
  duration: number;
  transcript?: string;
  
  // Complete edit data for re-composition
  audioTracks: Array<{
    filePath: string;
    name: string;
    startTime: number;
    endTime: number;
    volume: number;
    pan: number;
    fadeIn: number;
    fadeOut: number;
  }>;
  
  textOverlays: Array<{
    text: string;
    startTime: number;
    endTime: number;
    positionX: number;
    positionY: number;
    styleData: any;
    animation: string;
  }>;
  
  stickers: Array<{
    stickerPath: string;
    startTime: number;
    endTime: number;
    positionX: number;
    positionY: number;
    scale: number;
    rotation: number;
  }>;
  
  watermarks: Array<{
    watermarkPath: string;
    startTime: number;
    endTime: number;
    positionX: number;
    positionY: number;
    scale: number;
    opacity: number;
  }>;
  
  effects: Array<{
    effectType: string;
    startTime: number;
    endTime: number;
    settings: any;
  }>;
}
