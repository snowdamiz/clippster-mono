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
  styleMatch?: StyleMatchSummary;
}

export interface AIVideoTrack {
  id: string;
  type:
    | 'video'
    | 'audio'
    | 'image'
    | 'text'
    | 'shape'
    | 'cameraMotion'
    | 'impactFX'
    | 'transition'
    | 'motionGraphic';
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
  | 'spotlightReveal'
  | 'glassMorphCard'
  | 'deviceMockup'
  | 'meshGradientBg'
  | 'heroGradientText'
  | 'featureShowcase'
  | 'floatingMockup'
  | 'sweepingLight'
  | 'animatedUnderline';

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
  intendedParts?: string[];
  addedAt: Date;
}

export interface MediaRequest {
  prompt: string;
  required: boolean;
  parts: string[];
  accepted_types?: Array<'video' | 'audio' | 'image'>;
}

// AI generation
export type StylePackId =
  | 'sports-highlights'
  | 'wedding-film'
  | 'cinematic'
  | 'gaming-stream'
  | 'news-breakdown'
  | 'viral-social';

export interface StylePackRecipe {
  schemaVersion: 1;
  id: StylePackId;
  name: string;
  category: string;
  description: string;
  pacing: {
    targetShotSeconds: [number, number];
    cutsPerMinute: [number, number];
    peakBehavior: string;
  };
  captions: {
    style: string;
    placement: string;
    animation: string;
    font: string;
    weight: number;
    colors: string[];
    stroke?: string;
    background?: string;
  };
  typography: { title: string; lowerThird: string };
  colorGrade: {
    palette: string[];
    contrast: number;
    saturation: number;
    temperature: string;
    treatment: string[];
  };
  transitions: { families: string[]; durationSeconds: [number, number]; frequency: string };
  motion: { camera: string[]; intensity: number; imageBehavior: string };
  effects: { families: string[]; frequency: string };
  layout: { overlays: string[]; safeZones: string; titlePlacement: string };
  aspectRatios: Record<'16:9' | '9:16', { layout: string; captionPlacement: string }>;
  rendererFallbacks: Record<string, string>;
}

export interface AIGenerationRequest {
  prompt: string;
  media: AIVideoMediaItem[];
  style?: string;
  stylePack?: StylePackRecipe;
  intensity?: number; // 0.0 - 1.0
  captionStyle?: string;
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
// AI Chat Session types
export type ChatSessionStatus = 'discovery' | 'generating' | 'generated' | 'refining' | 'completed';

export interface AIChatSession {
  id: number;
  name: string | null;
  status: ChatSessionStatus;
  media_items: AIVideoMediaItem[];
  composition: AIVideoComposition | null;
  refinement_round: number;
  refinement_messages_used: number;
  max_refinement_rounds: number;
  max_messages_per_round: number;
  style_context: Record<string, any>;
  reference_analysis: ReferenceEditRecipe | null;
  media_analysis: MediaAnalysis[] | null;
  reference_url: string | null;
  messages: AIChatMessage[];
  inserted_at: string;
  updated_at: string;
}

export interface AIChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, any> | null;
  inserted_at: string;
}

export interface ChatResponse {
  message: string;
  ready_to_generate: boolean;
  summary: GenerationSummary | null;
  media_request?: MediaRequest | null;
}

export interface RefinementResponse {
  message: string;
  apply_changes: boolean;
  change_description: string | null;
}

export interface GenerationSummary {
  description: string;
  style: string;
  duration: number;
  aspectRatio: string;
  captionStyle: string;
  intensity: number;
  colorPalette: string[];
  keyFeatures: string[];
  audience?: string;
  platform?: string;
  narrative?: string;
  scenes?: Array<{
    index: number;
    description: string;
    mediaNames: string[];
    duration: number;
    mood: string;
    textOverlay?: string;
    effects?: string;
  }>;
}

export interface ReferenceVideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
  aspectRatio: string;
  fileSizeBytes: number;
  sourceType: 'url' | 'upload';
  displayName: string;
  sourceUrl?: string;
}

export interface ReferenceEvidence {
  sampledFrames: Array<{ timestamp: number; kind: 'uniform' | 'cut-before' | 'cut-after' }>;
  cutTimestamps: number[];
  audioPeaks: Array<{ time: number; amplitude: number }>;
}

export interface ReferenceEditRecipe {
  schemaVersion: 1;
  analysisVersion: string;
  metadata: ReferenceVideoMetadata;
  confidence: {
    overall: number;
    pacing: number;
    captions: number;
    motion: number;
    transitions: number;
    color: number;
    layout: number;
  };
  evidence: ReferenceEvidence;
  pacing: {
    description: string;
    cutsPerMinute: number;
    shotLengthSeconds: { min: number; median: number; max: number };
    quietSections: string;
    peakSections: string;
  };
  captions: {
    detected: boolean;
    placement: string;
    size: string;
    weight: string;
    colors: string[];
    treatment: string;
    wordsPerScreen: number;
    cadence: string;
  };
  typography: { heading: string; body: string; lowerThird: string; animation: string };
  colorGrade: {
    palette: string[];
    contrast: string;
    saturation: string;
    temperature: string;
    treatment: string[];
  };
  transitions: {
    families: string[];
    approximateDurationSeconds: number;
    frequency: string;
    evidence: string[];
  };
  motion: {
    cameraBehaviors: string[];
    cropAndReframe: string;
    intensity: string;
    evidence: string[];
  };
  effects: { families: string[]; frequency: string; evidence: string[] };
  layout: { patterns: string[]; overlays: string[]; textPlacement: string; evidence: string[] };
  audioCues: {
    available: boolean;
    rhythm: string;
    relationshipToCuts: string;
    relationshipToCaptions: string;
  };
  aspectRatioAdaptation: Record<string, string>;
  unsupported: Array<{ technique: string; fallback: string; reason: string }>;
  mood: string;
  genre: string;
  summary: string;
}

export interface StyleMatchSummary {
  source: 'reference' | 'style-pack';
  confidence: number;
  summary: string;
}

export interface ReferenceAnalysisFrame {
  timestamp: number;
  kind: 'uniform' | 'cut-before' | 'cut-after';
  mimeType: 'image/jpeg';
  base64Data: string;
}

export interface ReferenceAnalysisPayload {
  metadata: ReferenceVideoMetadata;
  frames: ReferenceAnalysisFrame[];
  cutTimestamps: number[];
  audioPeaks: Array<{ time: number; amplitude: number }>;
}

export interface ReferenceAnalysisProgress {
  stage: 'validating' | 'downloading' | 'probing' | 'sampling' | 'analyzing' | 'model' | 'complete';
  progress: number;
  message: string;
}

export interface MediaAnalysis {
  index: number;
  path: string;
  contentType: string;
  dominantColors: string[];
  textContent: string;
  brandElements: string;
  layout: string;
  suggestedDuration: number;
  suggestedEffects: string;
  suggestedOrder: number;
}

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
