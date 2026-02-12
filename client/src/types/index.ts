// Timeline and Media Types
export interface WordInfo {
  word: string;
  start: number;
  end: number;
  confidence?: number;
}

export interface WhisperSegment {
  id: number;
  start: number;
  end: number;
  text: string;
  words?: WordInfo[];
}

export interface Timestamp {
  time: number;
  position: number;
  label: string;
  isMajor: boolean;
}

export interface ClipSegment {
  start_time: number;
  end_time: number;
  duration: number;
  transcript: string;
}

export interface Clip {
  id: string;
  title: string;
  filename: string;
  type: 'continuous' | 'spliced';
  segments: ClipSegment[];
  total_duration: number;
  combined_transcript: string;
  virality_score: number;
  reason: string;
  socialMediaPost: string;
  run_number?: number;
  run_color?: string;
}

// Database Types
export interface Project {
  id: string;
  name: string;
  description: string | null;
  thumbnail_path: string | null;
  parent_id: string | null;
  created_at: number;
  updated_at: number;
}

export interface Prompt {
  id: string;
  name: string;
  content: string;
  created_at: number;
  updated_at: number;
}

export interface Transcript {
  id: string;
  raw_video_id: string;
  content: string;
  words: WordInfo[];
  created_at: number;
  updated_at: number;
}

// Timeline Component Props and Emits
export interface TimelineProps {
  videoSrc: string | null;
  currentTime: number;
  duration: number;
  timelineHoverTime: number | null;
  timelineHoverPosition: number;
  clips?: Clip[];
  hoveredClipId?: string | null;
  hoveredTimelineClipId?: string | null;
  currentlyPlayingClipId?: string | null;
  projectId?: string | null;
  audioGainDb?: number; // dB gain (-20 to +20) to apply to waveform visualization
}

export interface TimelineEmits {
  (e: 'seekTimeline', event: MouseEvent): void;
  (e: 'timelineTrackHover', event: MouseEvent): void;
  (e: 'timelineMouseLeave'): void;
  (e: 'timelineClipHover', clipId: string): void;
  (e: 'timelineSegmentClick', clipId: string, segmentIndex: number, event?: MouseEvent): void;
  (e: 'scrollToMediaPanel', clipId: string): void;
  (e: 'zoomChanged', zoomLevel: number): void;
  (
    e: 'segmentUpdated',
    clipId: string,
    segmentIndex: number,
    newStartTime: number,
    newEndTime: number
  ): void;
  (e: 'refreshClipsData'): void;
  (e: 'playFromTime', time: number): void;
  (e: 'editClip', clipId: string): void;
}

export interface TimelineClipTrackProps {
  clips: Clip[];
  duration: number;
  currentlyPlayingClipId?: string | null;
  hoveredClipId?: string | null;
  hoveredTimelineClipId?: string | null;
  selectedSegmentKeys?: Set<string>;
  isMovingSegment?: boolean;
  segmentMoveDirection?: 'left' | 'right' | null;
  isDraggingSegment: boolean;
  draggedSegmentInfo?: DraggedSegmentInfo | null;
  isResizingSegment: boolean;
  resizeHandleInfo?: ResizeHandleInfo | null;
  isCutToolActive: boolean;
  cutHoverInfo?: CutHoverInfo | null;
  getSegmentAdjacency: (
    clipId: string,
    segmentIndex: number
  ) => { hasPrevious: boolean; hasNext: boolean };
  setTimelineClipRef: (el: any, clipId: string) => void;
  onSegmentHoverForCut: (
    event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    segment: ClipSegment
  ) => void;
  onSegmentClickForCut: (
    event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    segment: ClipSegment
  ) => void;
  onSegmentMouseDown: (
    event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    segment: ClipSegment
  ) => void;
  onResizeMouseDown: (
    event: MouseEvent,
    clipId: string,
    segmentIndex: number,
    segment: ClipSegment,
    handleType: 'left' | 'right'
  ) => void;
}

export interface TimelineVideoTrackProps {
  videoSrc: string | null;
  currentTime: number;
  duration: number;
  zoomLevel?: number;
  audioGainDb?: number; // dB gain (-20 to +20) to apply to waveform visualization
}

export interface TimelineVideoTrackEmits {
  (e: 'videoTrackClick', event: MouseEvent): void;
  (e: 'timelineTrackHover', event: MouseEvent): void;
  (e: 'timelineMouseLeave'): void;
}

// Subtitle Types
export interface SubtitleSettings {
  enabled: boolean;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  backgroundColor: string;
  backgroundEnabled: boolean;
  border1Width: number;
  border1Color: string;
  border2Width: number;
  border2Color: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowColor: string;
  position: 'top' | 'middle' | 'bottom';
  positionPercentage: number;
  maxWidth: number;
  animationStyle:
    | 'none'
    | 'karaoke'
    | 'zoom'
    | 'pop'
    | 'glow'
    | 'box-highlight'
    | 'typewriter'
    | 'wave';
  highlightColor: string;
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  textOffsetX: number;
  textOffsetY: number;
  padding: number;
  borderRadius: number;
  wordSpacing: number;
  selectedPresetId?: string | null;
  // Per-aspect-ratio configurations for subtitle position and size overrides
  perRatioConfigs?: Record<string, SubtitleOverride>;
}

export interface SubtitlePreset {
  id: string;
  name: string;
  description: string;
  settings: SubtitleSettings;
}

// Per-aspect-ratio subtitle overrides for export
// Only includes settings that make sense to adjust per aspect ratio
export interface SubtitleOverride {
  fontSize: number; // Override font size for this aspect ratio
  positionPercentage: number; // Override vertical position (0-100)
  position?: { x: number; y: number }; // Override position as x,y coordinates (0-100)
  maxWidth?: number; // Override max width for this aspect ratio
}

// Map of aspect ratio to subtitle overrides
export interface SubtitleOverrides {
  '16:9'?: SubtitleOverride;
  '9:16'?: SubtitleOverride;
  '1:1'?: SubtitleOverride;
  '4:5'?: SubtitleOverride;
}

// Watermark position for a specific aspect ratio
export interface WatermarkPositionSettings {
  x: number;
  y: number;
  opacity: number;
  scale: number;
  isFullFrameOverlay?: boolean; // When true, position at 0,0 with 100% scale (full-frame overlay)
}

// Per-aspect-ratio watermark configuration
// Allows using different watermark images for different aspect ratios
export interface WatermarkRatioConfig {
  watermarkId: string | null; // Different watermark image for this ratio
  position: WatermarkPositionSettings | null; // Position settings for this ratio
}

// Per-aspect-ratio watermark settings from creator profile
// Settings can be null to indicate watermark is disabled for that ratio
// Each ratio can have a completely different watermark image
export interface PerRatioWatermarkSettings {
  '16:9': WatermarkRatioConfig | null;
  '9:16': WatermarkRatioConfig | null;
  '1:1': WatermarkRatioConfig | null;
  '4:5': WatermarkRatioConfig | null;
}

// Watermark Types
export interface WatermarkSettings {
  enabled: boolean;
  watermarkId: string | null;
  positionX: number; // 0-100 (percentage from left)
  positionY: number; // 0-100 (percentage from top)
  opacity: number; // 0-100
  scale: number; // 0-100 (percentage of video width)
  width?: number | null; // original watermark width (px) if known
  height?: number | null; // original watermark height (px) if known
  isFullFrameOverlay?: boolean; // When true, position at 0,0 with 100% scale (full-frame overlay)
  // Optional per-aspect-ratio settings from creator profile
  perRatioSettings?: PerRatioWatermarkSettings | null;
}

export interface MediaPanelProps {
  isGenerating?: boolean;
  generationProgress?: number;
  generationStage?: string;
  generationMessage?: string;
  generationError?: string;
  projectId?: string | null;
  hoveredTimelineClipId?: string | null;
  playingClipId?: string | null;
  isPlayingSegments?: boolean;
  videoDuration?: number | null; // Duration in seconds
  currentTime?: number | null; // Current video playback time in seconds
  aspectRatio: { width: number; height: number };
  // Subtitle settings for clip building
  subtitleSettings?: SubtitleSettings | null;
  // Creator profile default assets (auto-applied when building clips)
  creatorDefaultIntro?: IntroOutroRef | null;
  creatorDefaultOutro?: IntroOutroRef | null;
  // Transcription progress
  isTranscribing?: boolean;
  transcribeProgress?: number;
  transcribeStage?: string;
  transcribeMessage?: string;
  // VOD preset config for pre-edit settings
  vodPresetConfig?: ActiveVodPresetConfig | null;
}

// Reference type for intro/outro (matches database IntroOutro type)
export interface IntroOutroRef {
  id: string;
  type: 'intro' | 'outro';
  name: string;
  file_path: string;
  duration: number | null;
  thumbnail_path?: string | null;
}

export interface AudioSettings {
  volume: number; // dB gain (-20 to +20) - project level
  normalize: boolean; // enable audio normalization (export only)
  // Clip-level audio mixer settings (optional, from clip editor)
  originalAudioDb?: number; // dB gain for original audio track (-20 to +20)
  musicTracks?: MusicTrackSettings[]; // Music tracks to mix in
}

// Music track settings for export
export interface MusicTrackSettings {
  filePath: string; // Path to audio file
  gainDb: number; // dB gain (-20 to +20)
  fadeIn: number; // Fade in duration in seconds
  fadeOut: number; // Fade out duration in seconds
  startTime: number; // When audio starts in clip timeline
  endTime: number; // When audio ends in clip timeline
  isMuted: boolean; // Whether track is muted
}

export interface MediaPanelEmits {
  (e: 'clipHover', clipId: string): void;
  (e: 'clipLeave'): void;
  (e: 'detectClips'): void;
  (e: 'cancelDetection'): void;
  (e: 'scrollToTimeline'): void;
  (e: 'deleteClip', clipId: string): void;
  (e: 'playClip', clip: any): void; // Using any for ClipWithVersion for now
  (e: 'seekVideo', time: number): void;
  (e: 'watermarkSettingsChanged', settings: WatermarkSettings): void;
  (e: 'editClip', clipId: string): void;
  (e: 'adjustClip', clipId: string): void;
  (e: 'addClip'): void;
  (e: 'transcribeProject'): void;
  (e: 'cancelTranscription'): void;
  (e: 'viewTranscript'): void;
}

export interface TimelinePlayheadProps {
  videoSrc: string | null;
  duration: number;
  position: number;
  timelineBoundsTop: number;
  timelineBoundsBottom: number;
  timelineBoundsLeft: number;
  isCutToolActive?: boolean;
  isDraggingToZoom?: boolean;
}

export interface TimelinePlayheadEmits {
  (e: 'playheadDragStart', event: MouseEvent): void;
}

export interface TimelineTooltipProps {
  showTooltip: boolean;
  position: TooltipPosition;
  time: number;
  transcriptWords: WordInfo[];
  centerWordIndex: number;
  isPanning: boolean;
  isDragging: boolean;
  isDraggingSegment: boolean;
  isResizingSegment: boolean;
}

export interface TimelineHoverLineProps {
  showLine: boolean;
  position: number;
  timelineBoundsTop: number;
  timelineBoundsBottom: number;
  timelineBoundsLeft: number;
  isPanning: boolean;
  isDragging: boolean;
  isCutToolActive: boolean;
}

// Timeline State Types
export interface DraggedSegmentInfo {
  clipId: string;
  segmentIndex: number;
  originalStartTime: number;
  originalEndTime: number;
  originalMouseX: number;
  dragStartTime: number;
  currentStartTime: number;
  currentEndTime: number;
  tooltipX?: number;
  tooltipY?: number;
}

export interface ResizeHandleInfo {
  clipId: string;
  segmentIndex: number;
  handleType: 'left' | 'right';
  originalStartTime: number;
  originalEndTime: number;
  originalMouseX: number;
  resizeStartTime: number;
  currentStartTime: number;
  currentEndTime: number;
  minStartTime: number;
  maxEndTime: number;
  tooltipX?: number;
  tooltipY?: number;
}

export interface CutHoverInfo {
  clipId: string;
  segmentIndex: number;
  cutTime: number;
  cutPosition: number; // percentage (0-100)
  cursorPosition: number; // percentage (0-100) for custom cursor position
}

export interface MovementConstraints {
  minStartTime: number;
  maxEndTime: number;
}

export interface SegmentToDelete {
  clipId: string;
  segmentIndex: number;
  clipTitle: string;
}

export interface SegmentsToMerge {
  clipId: string;
  segmentIndices: number[];
  clipTitle: string;
}

export interface ContextMenuInfo {
  clipId: string;
  segmentIndex: number;
  clipTitle: string;
  segmentStart: number;
  segmentEnd: number;
  x: number;
  y: number;
}

export interface ClipContextMenuInfo {
  clipId: string;
  clipTitle: string;
  x: number;
  y: number;
}

// Timeline Component Internal State Types
export interface TimelineBounds {
  top: number;
  bottom: number;
}

export interface TooltipPosition {
  x: number;
  y: number;
}

// Timeline Interaction Types
export interface DragSelectionState {
  isDragging: boolean;
  dragStartX: number;
  dragEndX: number;
  dragStartPercent: number;
  dragEndPercent: number;
}

export interface PanState {
  isPanning: boolean;
  panStartX: number;
  panScrollLeft: number;
}

export interface ZoomState {
  zoomLevel: number;
  minZoom: number;
  maxZoom: number;
  zoomStep: number;
}

// Audio Waveform Types
// Simplified single-resolution structure - frontend downsamples as needed
export interface WaveformPeak {
  min: number;
  max: number;
}

export interface WaveformData {
  sampleRate: number;
  duration: number;
  peaks: WaveformPeak[];
  peakCount: number;
}

export interface WaveformRenderOptions {
  width: number;
  height: number;
  peaks: WaveformPeak[];
  barWidth?: number;
  barSpacing?: number;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  style?: 'bars' | 'line' | 'filled';
  amplitude?: number; // 0-1, multiplier for peak height
}

export interface WaveformRenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
}

// Additional database types that are commonly used
export interface RawVideo {
  id: string;
  project_id: string;
  file_path: string;
  filename: string;
  file_size: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  codec: string | null;
  bitrate: number | null;
  created_at: number;
  updated_at: number;
}

export interface IntroOutro {
  id: string;
  type: 'intro' | 'outro';
  name: string;
  file_path: string;
  duration: number | null;
  thumbnail_path: string | null;
  thumbnail_generation_status: 'pending' | 'processing' | 'completed' | 'failed' | null;
  created_at: number;
  updated_at: number;
  // Organization asset fields (optional for local assets)
  organization_id?: string | null;
  organization_name?: string | null;
  server_id?: number | null;
  sync_status?: 'synced' | 'downloading' | 'error' | null;
}

export type VideoLike = RawVideo | IntroOutro;

// Video Player Dialog Types
export interface VideoPlayerDialogProps {
  video: VideoLike | null;
  showVideoPlayer: boolean;
}

export interface VideoPlayerDialogEmits {
  (e: 'close'): void;
}

// Time Range Picker Types
export interface TimeRangePickerProps {
  totalDuration: number; // in seconds
  modelValue?: {
    startTime: number;
    endTime: number;
  };
}

export interface TimeRangePickerEmits {
  (e: 'update:modelValue', value: { startTime: number; endTime: number }): void;
  (e: 'change', value: { startTime: number; endTime: number }): void;
}

// Download Types
export interface DownloadProgress {
  download_id: string;
  progress: number;
  current_time?: number;
  total_time?: number;
  status: string;
}

export interface DownloadResult {
  download_id: string;
  success: boolean;
  file_path?: string;
  thumbnail_path?: string;
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
}

export interface ActiveDownload {
  id: string;
  title: string;
  mintId: string;
  progress: DownloadProgress;
  result?: DownloadResult;
  rawVideoId?: string;
  // Segment tracking information
  sourceClipId?: string;
  segmentNumber?: number;
  isSegment?: boolean;
  segmentStartTime?: number;
  segmentEndTime?: number;
  // Queue and video info
  videoUrl?: string;
}

// Manual POI (Point of Interest) Framing Types
export interface ManualRegionRect {
  x: number; // Normalized 0-1
  y: number; // Normalized 0-1
  width: number; // Normalized 0-1
  height: number; // Normalized 0-1
}

export interface ManualRegion {
  id: string;
  color: string; // e.g., "#4F9DFF" for visual distinction
  label?: string; // Optional label like "Speaker", "Gameplay"
  // Source crop (normalized 0-1 coordinates on source video)
  source: ManualRegionRect;
  // Output position (normalized 0-1 coordinates on target canvas)
  output: ManualRegionRect;
}

export interface ManualFramingConfig {
  mode: 'manual';
  regions: ManualRegion[];
  targetAspectRatio: string; // "9:16", "4:5", etc.
  sourceAspectRatio?: string; // "16:9" typically
}

// Segment-specific framing configuration
export interface SegmentFramingConfig {
  segmentIds: string[]; // Which segment IDs this framing applies to
  config: ManualFramingConfig;
}

// Per-aspect-ratio manual framing configurations (legacy - global per aspect ratio)
export interface ManualFramingConfigs {
  '9:16'?: ManualFramingConfig;
  '4:5'?: ManualFramingConfig;
  '1:1'?: ManualFramingConfig;
  '16:9'?: ManualFramingConfig;
}

// Per-aspect-ratio segment-specific framing configurations (new - per segment)
export interface SegmentFramingConfigs {
  '9:16'?: SegmentFramingConfig[];
  '4:5'?: SegmentFramingConfig[];
  '1:1'?: SegmentFramingConfig[];
  '16:9'?: SegmentFramingConfig[];
}

// Predefined colors for POI regions
export const POI_REGION_COLORS = [
  '#4F9DFF', // Blue
  '#FF6B6B', // Red/Coral
  '#4ECB71', // Green
  '#FFB84D', // Orange
  '#A78BFA', // Purple
  '#F472B6', // Pink
  '#22D3EE', // Cyan
  '#FBBF24', // Yellow
] as const;

// Phoenix types are defined in phoenix.d.ts

// ==========================================
// Clip Editor Types
// ==========================================

// Main clip edit configuration
export interface ClipEdit {
  id: string;
  clipId: string;
  trim: TrimSettings;
  audioTracks: AudioTrack[];
  textOverlays: TextOverlay[];
  stickers: Sticker[];
  effects: Effect[];
  filter: FilterSettings | null;
  speed: number;
  createdAt: number;
  updatedAt: number;
}

// Trim/Cut settings
export interface TrimSettings {
  startTime: number;
  endTime: number;
  segments?: TrimSegment[]; // For multi-segment clips
}

export interface TrimSegment {
  id: string;
  startTime: number;
  endTime: number;
  isDeleted: boolean;
}

// Audio track for music overlay
export interface AudioTrack {
  id: string;
  filePath: string;
  name: string;
  startTime: number; // When audio starts in clip timeline
  endTime: number;
  volume: number; // 0-1
  pan?: number; // -1 (left) to 1 (right), 0 is center
  fadeIn: number; // Duration in seconds
  fadeOut: number; // Duration in seconds
  trackOrder: number;
  isMuted: boolean;
  isSolo: boolean;
  isLocked?: boolean;
  isHidden?: boolean;
  keyframes?: Keyframe[];
  linkedSourceId?: string; // ID of linked video source (for extracted audio)
}

// Per-aspect-ratio configuration for text overlays
export interface TextOverlayRatioConfig {
  position: { x: number; y: number }; // 0-100 percentage
  style: TextOverlayStyle;
  rotation?: number; // Rotation in degrees
  scale?: number; // Scale factor (1.0 = 100%)
}

import type { Keyframe } from './timeline-model';

// Text overlay configuration
export interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  position: { x: number; y: number }; // 0-100 percentage - default/fallback position
  style: TextOverlayStyle; // Default/fallback style
  animation: TextAnimation;
  keyframes?: Keyframe[];
  // Per-aspect-ratio configurations (key is aspect ratio string like "16:9", "9:16", "1:1")
  perRatioConfigs?: Record<string, TextOverlayRatioConfig>;
  previewWidth?: number;
  previewHeight?: number;
  // UI-only motion preset for editor preview (does not affect export)
  motionPreset?: 'none' | 'fade' | 'slide-up' | 'pop';
  motionDuration?: number; // seconds
  layer?: number; // Visual track layer (0 = bottom, higher = on top)
  rotation?: number; // Default rotation in degrees
  scale?: number; // Default scale factor (1.0 = 100%)
}

// Gradient configuration for text or background
export interface GradientConfig {
  enabled: boolean;
  type: 'linear' | 'radial';
  angle: number; // degrees for linear gradient
  colors: Array<{ color: string; position: number }>; // position 0-100
}

// Glow effect configuration
export interface GlowConfig {
  enabled: boolean;
  color: string;
  blur: number;
  spread: number;
  opacity: number; // 0-1
}

// Shadow configuration for multiple shadows
export interface ShadowConfig {
  offsetX: number;
  offsetY: number;
  blur: number;
  color: string;
}

// Chat bubble configuration
export interface ChatBubbleConfig {
  enabled: boolean;
  shape: 'rounded' | 'pointed' | 'cloud' | 'square';
  tailPosition: 'left' | 'right' | 'bottom-left' | 'bottom-right' | 'none';
  tailSize: number; // pixels
  platform?: 'imessage' | 'discord' | 'twitch' | 'whatsapp' | 'custom';
  showAvatar?: boolean;
  avatarUrl?: string;
  avatarPosition?: 'left' | 'right';
  avatarSize?: number; // pixels
  showUsername?: boolean;
  username?: string;
  usernameColor?: string;
  showTimestamp?: boolean;
  timestamp?: string;
}

// Animation preset configuration
export interface TextAnimationPreset {
  entry: TextEntryAnimation;
  exit: TextExitAnimation;
  emphasis: TextEmphasisAnimation;
  entryDuration: number;
  exitDuration: number;
  emphasisDuration: number;
  entryDelay: number;
  entryEasing: string;
  exitEasing: string;
}

export type TextEntryAnimation =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'pop'
  | 'bounce'
  | 'flip'
  | 'rotate'
  | 'blur-in'
  | 'typewriter'
  | 'wave'
  | 'glitch';

export type TextExitAnimation =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'zoom-in'
  | 'zoom-out'
  | 'pop'
  | 'bounce'
  | 'flip'
  | 'rotate'
  | 'blur-out'
  | 'glitch';

export type TextEmphasisAnimation =
  | 'none'
  | 'pulse'
  | 'shake'
  | 'wiggle'
  | 'glow-pulse'
  | 'bounce-loop'
  | 'float'
  | 'rainbow';

export interface TextOverlayStyle {
  // Font settings
  fontFamily: string;
  fontSize: number;
  fontWeight: number;

  // Colors
  color: string; // Text color (kept for backward compatibility, same as textColor in subtitles)
  backgroundColor: string | null;
  backgroundEnabled: boolean;
  highlightColor: string; // Used for animation effects like karaoke, box-highlight

  // Dual border system (matches SubtitleSettings)
  border1Width: number; // Inner border width
  border1Color: string; // Inner border color
  border2Width: number; // Outer border width
  border2Color: string; // Outer border color

  // Legacy stroke properties (for backward compatibility)
  strokeEnabled: boolean;
  strokeColor: string;
  strokeWidth: number;

  // Shadow
  shadowEnabled: boolean;
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;

  // Layout & spacing
  borderRadius: number;
  padding: number;
  letterSpacing: number;
  lineHeight: number;
  wordSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  maxWidth: number; // Maximum width as percentage (0-100)
  width?: number; // Explicit width as percentage (0-100), undefined means auto-size

  // Position offsets (fine-tuning within the overlay)
  textOffsetX: number;
  textOffsetY: number;

  // === EXTENDED PROPERTIES ===

  // Text Transform
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  textDecoration?: 'none' | 'underline' | 'line-through';

  // Gradient Text
  gradient?: GradientConfig;

  // Outer Glow (separate from shadow)
  glow?: GlowConfig;

  // Multiple Shadows (for layered effects like 3D, glitch)
  shadows?: ShadowConfig[];

  // Background enhancements
  backgroundGradient?: GradientConfig;
  backgroundBlur?: number; // Glass effect blur amount in pixels
  backgroundOpacity?: number; // 0-1

  // Border enhancements
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderWidth?: number;
  borderColor?: string;

  // Chat bubble configuration
  chatBubble?: ChatBubbleConfig;

  // Animation preset (stored with style for presets)
  animationPreset?: TextAnimationPreset;
}

export type TextAnimation =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'typewriter'
  | 'bounce'
  | 'zoom'
  | 'pop'
  | 'karaoke'
  | 'glow'
  | 'box-highlight'
  | 'wave';

export type TextStylePreset = 'title' | 'lower-third' | 'caption' | 'quote' | 'custom';

// Per-aspect-ratio configuration for stickers
export interface StickerRatioConfig {
  position: { x: number; y: number }; // 0-100 percentage
  scale: number; // 0.1-3
  rotation: number; // Degrees
}

// Sticker/emoji overlay
export interface Sticker {
  id: string;
  stickerPath: string; // Path to sticker image or emoji code
  stickerType: 'emoji' | 'image' | 'gif';
  startTime: number;
  endTime: number;
  position: { x: number; y: number }; // 0-100 percentage - default/fallback position
  scale: number; // 0.1-3 - default/fallback scale
  rotation: number; // Degrees - default/fallback rotation
  animation: StickerAnimation;
  keyframes?: Keyframe[];
  // UI-only motion preset for editor preview (does not affect export)
  motionPreset?: 'none' | 'fade' | 'slide-up' | 'pop';
  motionDuration?: number; // seconds
  // Per-aspect-ratio configurations (key is aspect ratio string like "16:9", "9:16", "1:1")
  perRatioConfigs?: Record<string, StickerRatioConfig>;
  layer?: number; // Visual track layer (0 = bottom, higher = on top)
}

export type StickerAnimation = 'none' | 'bounce' | 'spin' | 'pulse' | 'shake' | 'float' | 'fade';

// Per-aspect-ratio configuration for clip watermarks (time-based in clip editor)
export interface ClipWatermarkRatioConfig {
  position: { x: number; y: number }; // 0-100 percentage
  scale: number; // 0-100 (percentage of video width)
  opacity: number; // 0-100
  isFullFrameOverlay?: boolean; // When true, position at 0,0 with 100% scale
}

// Watermark overlay for clip editor (time-based)
export interface ClipWatermark {
  id: string;
  watermarkId: string; // Reference to watermark image asset
  filePath: string; // Actual file path for export (used by FFmpeg)
  previewUrl: string; // Data URL or preview URL for UI display
  startTime: number;
  endTime: number;
  position: { x: number; y: number }; // 0-100 percentage - default/fallback position
  scale: number; // 0-100 (percentage of video width) - default/fallback scale
  opacity: number; // 0-100 - default/fallback opacity
  // Per-aspect-ratio configurations (key is aspect ratio string like "16:9", "9:16", "1:1")
  perRatioConfigs?: Record<string, ClipWatermarkRatioConfig>;
  keyframes?: Keyframe[];
  layer?: number; // Visual track layer (0 = bottom, higher = on top)
}

// Visual effects
export interface Effect {
  id: string;
  type: EffectType;
  startTime: number;
  endTime: number;
  settings: EffectSettings;
}

export type EffectType =
  | 'filter'
  | 'speed'
  | 'zoom'
  | 'pan'
  | 'transition'
  | 'blur'
  | 'freeze'
  | 'flash'
  | 'shake'
  | 'adjustment_layer'
  | 'chroma';

export interface EffectSettings {
  // Filter settings
  filterPreset?: string;

  // Speed settings
  speedMultiplier?: number;
  isReverse?: boolean;

  // Zoom/Pan settings (Ken Burns)
  startZoom?: number;
  endZoom?: number;
  startPosition?: { x: number; y: number };
  endPosition?: { x: number; y: number };

  // Blur settings
  blurAmount?: number;
  blurType?: 'gaussian' | 'motion' | 'radial';

  // Transition settings
  transitionType?: 'fade' | 'dissolve' | 'slide' | 'wipe' | 'zoom';
  transitionDuration?: number;

  // Flash/Shake settings
  intensity?: number;
  frequency?: number;

  // Chroma Key (Green Screen) settings
  keyColor?: string; // Hex color to key out (default: #00ff00)
  tolerance?: number; // 0-1, how much color variation to include
  softness?: number; // 0-1, edge softness

  // Adjustment Layer settings (inherits filter settings)
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  temperature?: number;
  vignette?: number;
  sharpen?: number;
  fade?: number;
  blendMode?:
    | 'normal'
    | 'screen'
    | 'multiply'
    | 'overlay'
    | 'soft-light'
    | 'hard-light'
    | 'difference';

  // Generic settings for future effects
  [key: string]: any;
}

// Filter presets
export interface FilterSettings {
  preset: FilterPreset | null;
  brightness: number; // -100 to 100
  contrast: number; // -100 to 100
  saturation: number; // -100 to 100
  hue: number; // -180 to 180
  temperature: number; // -100 to 100 (warm/cool)
  vignette: number; // 0 to 100
  sharpen: number; // 0 to 100
  fade: number; // 0 to 100
}

// Time-based filter segment for timeline
export interface FilterSegment {
  id: string;
  startTime: number;
  endTime: number;
  settings: FilterSettings;
}

export type FilterPreset =
  | 'none'
  | 'warm'
  | 'cool'
  | 'vintage'
  | 'bw'
  | 'sepia'
  | 'dramatic'
  | 'vivid'
  | 'muted'
  | 'cinematic'
  | 'retro'
  | 'noir';

// ==========================================
// Clip Subtitle Types
// ==========================================

// Per-aspect-ratio configuration for subtitles (position, size, and width overrides)
export interface ClipSubtitleRatioConfig {
  position: { x: number; y: number }; // 0-100 percentage (center point)
  fontSize: number; // Font size for this aspect ratio
  maxWidth?: number; // Max width percentage for this aspect ratio (0-100)
}

// Clip-level subtitle settings stored in clip edit data
export interface ClipSubtitleSettings {
  enabled: boolean;
  // Base style settings (applies to all aspect ratios unless overridden)
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  textColor: string;
  backgroundColor: string;
  backgroundEnabled: boolean;
  border1Width: number;
  border1Color: string;
  border2Width: number;
  border2Color: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowColor: string;
  position: 'top' | 'middle' | 'bottom';
  positionX: number; // 0-100 percentage (horizontal center point)
  positionY: number; // 0-100 percentage (vertical center point)
  maxWidth: number;
  animationStyle:
    | 'none'
    | 'karaoke'
    | 'zoom'
    | 'pop'
    | 'glow'
    | 'box-highlight'
    | 'typewriter'
    | 'wave';
  highlightColor: string;
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  padding: number;
  borderRadius: number;
  wordSpacing: number;
  // Per-aspect-ratio configurations (key is aspect ratio string like "16:9", "9:16", "1:1")
  perRatioConfigs?: Record<string, ClipSubtitleRatioConfig>;
  // Selected preset ID (for tracking which preset was applied)
  selectedPresetId?: string | null;
}

// ==========================================
// Video Editor Types (Standalone Editor)
// ==========================================

// Video editor project metadata
export interface VideoEditorProject {
  id: string;
  name: string;
  description: string | null;
  thumbnail_path: string | null;
  total_duration: number;
  created_at: number;
  updated_at: number;
}

// Video source in the editor timeline
export interface VideoEditorSource {
  id: string;
  project_id: string;
  source_type: 'clip' | 'raw_video' | 'imported';
  source_id: string | null; // Reference to clips/raw_videos table (null for imported)
  source_path: string; // File path for preview/export
  source_name: string | null;
  source_thumbnail: string | null;
  source_duration: number | null; // Original duration of source
  start_time: number; // Position in timeline
  end_time: number; // End position in timeline
  trim_start: number; // Trim from source start (video)
  trim_end: number | null; // Trim from source end (null = use full duration)
  // J/L Cut support: Independent audio trim points
  // When null, audio uses the same trim as video (default behavior)
  audio_trim_start?: number | null; // Audio trim start (J-cut: earlier than video)
  audio_trim_end?: number | null; // Audio trim end (L-cut: later than video)
  order_index: number;
  track_index?: number; // Video track index (0 = main track, 1+ = additional tracks)
  created_at: number;
  isMuted?: boolean;
  isLocked?: boolean;
  isHidden?: boolean;
  audioExtracted?: boolean; // True if audio has been extracted to a separate track
  speed?: number; // Playback speed multiplier (1.0 = normal, 0.5 = half speed, 2.0 = double speed)
  speedKeyframes?: SpeedKeyframe[]; // Keyframes for speed ramping/time remapping
  freezePoints?: FreezePoint[]; // Time freeze points within the segment
}

// Speed keyframe for time remapping
export interface SpeedKeyframe {
  id: string;
  time: number; // Time within the segment (relative to trim_start)
  speed: number; // Speed at this point (0.25 - 4.0, negative for reverse)
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier';
  controlPoints?: { x1: number; y1: number; x2: number; y2: number }; // For bezier easing
}

// Time freeze point - pauses playback at a specific moment
export interface FreezePoint {
  id: string;
  time: number; // Time within the segment to freeze
  duration: number; // How long to freeze (in seconds)
}

// Project with all sources loaded
export interface VideoEditorProjectWithSources extends VideoEditorProject {
  sources: VideoEditorSource[];
}

// Editor tab types for standalone video editor
export type VideoEditorTab =
  | 'media'
  | 'audio'
  | 'overlays'
  | 'watermark'
  | 'captions'
  | 'aspect'
  | 'effects'
  | 'export';

// Source item displayed in the Sources tab (unified format for clips and raw videos)
export interface SourceItem {
  id: string;
  type: 'clip' | 'raw_video';
  name: string;
  path: string; // For clips: raw video path; For raw_video: file path
  thumbnailPath: string | null;
  duration: number | null; // Duration of the playable segment
  projectId: string | null;
  projectName: string | null;
  // Clip-specific: segment times within the source video
  clipStartTime?: number | null; // Start time in source video (for detected clips)
  clipEndTime?: number | null; // End time in source video (for detected clips)
  sourceDuration?: number | null; // Full duration of the source video
}

// Video Editor Dialog Props
export interface VideoEditorDialogProps {
  modelValue: boolean;
  projectId: string | null;
}

// Video Editor Dialog Emits
export interface VideoEditorDialogEmits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', projectId: string): void;
  (e: 'delete', projectId: string): void;
}

// ==========================================
// Video Editor Transition Types
// ==========================================

// Represents a transition between two overlapping video sources
export interface VideoEditorTransition {
  id: string;
  sourceAId: string; // First source (ending)
  sourceBId: string; // Second source (starting)
  startTime: number; // When transition starts (sourceB.start_time)
  endTime: number; // When transition ends (sourceA.end_time)
  duration: number; // Length of the transition
  type:
    | 'crossfade'
    | 'slide-left'
    | 'slide-right'
    | 'slide-up'
    | 'slide-down'
    | 'wipe-left'
    | 'wipe-right'
    | 'zoom-in'
    | 'zoom-out';
}

// Utility function to detect transitions between overlapping sources
export function detectSourceTransitions(sources: VideoEditorSource[]): VideoEditorTransition[] {
  const transitions: VideoEditorTransition[] = [];

  // Sort sources by start time
  const sortedSources = [...sources].sort((a, b) => a.start_time - b.start_time);

  for (let i = 0; i < sortedSources.length - 1; i++) {
    const sourceA = sortedSources[i];
    const sourceB = sortedSources[i + 1];

    // Check if sources overlap
    if (sourceA.end_time > sourceB.start_time) {
      const overlapStart = sourceB.start_time;
      const overlapEnd = Math.min(sourceA.end_time, sourceB.end_time);
      const duration = overlapEnd - overlapStart;

      if (duration > 0) {
        transitions.push({
          id: `transition-${sourceA.id}-${sourceB.id}`,
          sourceAId: sourceA.id,
          sourceBId: sourceB.id,
          startTime: overlapStart,
          endTime: overlapEnd,
          duration,
          type: 'crossfade', // Default to crossfade
        });
      }
    }
  }

  return transitions;
}

// Calculate transition state for preview playback
export interface TransitionState {
  opacityA: number;
  opacityB: number;
  transformA?: string;
  transformB?: string;
  clipPathA?: string;
  clipPathB?: string;
  zIndexA: number;
  zIndexB: number;
}

export function calculateTransitionState(
  currentTime: number,
  transition: VideoEditorTransition
): TransitionState {
  // Default state (no transition active)
  if (currentTime < transition.startTime) {
    return { opacityA: 1, opacityB: 0, zIndexA: 1, zIndexB: 0 };
  }
  if (currentTime >= transition.endTime) {
    return { opacityA: 0, opacityB: 1, zIndexA: 0, zIndexB: 1 };
  }

  const progress = (currentTime - transition.startTime) / transition.duration;

  switch (transition.type) {
    case 'slide-left':
      // B slides in from right, A slides out to left
      return {
        opacityA: 1,
        opacityB: 1,
        transformA: `translateX(${-progress * 100}%)`,
        transformB: `translateX(${(1 - progress) * 100}%)`,
        zIndexA: 1,
        zIndexB: 2, // B on top
      };

    case 'slide-right':
      // B slides in from left, A slides out to right
      return {
        opacityA: 1,
        opacityB: 1,
        transformA: `translateX(${progress * 100}%)`,
        transformB: `translateX(${-(1 - progress) * 100}%)`,
        zIndexA: 1,
        zIndexB: 2,
      };

    case 'slide-up':
      // B slides in from bottom
      return {
        opacityA: 1,
        opacityB: 1,
        transformA: `translateY(${-progress * 100}%)`,
        transformB: `translateY(${(1 - progress) * 100}%)`,
        zIndexA: 1,
        zIndexB: 2,
      };

    case 'slide-down':
      // B slides in from top
      return {
        opacityA: 1,
        opacityB: 1,
        transformA: `translateY(${progress * 100}%)`,
        transformB: `translateY(${-(1 - progress) * 100}%)`,
        zIndexA: 1,
        zIndexB: 2,
      };

    case 'wipe-left':
      // B wipes over A from right to left
      return {
        opacityA: 1,
        opacityB: 1,
        clipPathB: `inset(0 0 0 ${(1 - progress) * 100}%)`, // Reveal B from right
        zIndexA: 1,
        zIndexB: 2,
      };

    case 'wipe-right':
      // B wipes over A from left to right
      return {
        opacityA: 1,
        opacityB: 1,
        clipPathB: `inset(0 ${(1 - progress) * 100}% 0 0)`, // Reveal B from left
        zIndexA: 1,
        zIndexB: 2,
      };

    case 'zoom-in':
      // A zooms in and fades out, B fades in
      return {
        opacityA: 1 - progress,
        opacityB: progress,
        transformA: `scale(${1 + progress})`,
        transformB: `scale(1)`,
        zIndexA: 2,
        zIndexB: 1,
      };

    case 'zoom-out':
      // A zooms out and fades out
      return {
        opacityA: 1 - progress,
        opacityB: progress,
        transformA: `scale(${1 - progress * 0.5})`,
        transformB: `scale(1)`,
        zIndexA: 2,
        zIndexB: 1,
      };

    case 'crossfade':
    default:
      return {
        opacityA: 1 - progress,
        opacityB: progress,
        zIndexA: 1,
        zIndexB: 1, // Equal z-index for blend
      };
  }
}

// Deprecated: use calculateTransitionState instead
export function calculateCrossfadeOpacity(
  currentTime: number,
  transition: VideoEditorTransition
): { opacityA: number; opacityB: number } {
  const state = calculateTransitionState(currentTime, transition);
  return { opacityA: state.opacityA, opacityB: state.opacityB };
}

export * from './timeline-model';

// ==========================================
// Effects & Transitions Types
// ==========================================

// Transition Categories
export type TransitionCategory =
  | 'basic'
  | 'wipe'
  | 'slide'
  | 'zoom'
  | 'stylized'
  | 'shape'
  | 'directional';

// Effect Categories
export type EffectCategory = 'basic' | 'color' | 'stylized' | 'distortion' | 'motion' | 'overlay';

// Transition Preset (built-in library)
export interface TransitionPreset {
  id: string;
  name: string;
  type: string;
  category: TransitionCategory;
  description?: string;
  parametersSchema?: Record<string, unknown>;
  defaultParameters?: Record<string, unknown>;
  previewUrl?: string;
  ffmpegFilter?: string;
  cssAnimation?: string;
  isBuiltin: boolean;
  sortOrder: number;
}

// Effect Preset (built-in library)
export interface EffectPreset {
  id: string;
  name: string;
  type: string;
  category: EffectCategory;
  description?: string;
  parametersSchema?: Record<string, unknown>;
  defaultParameters?: Record<string, unknown>;
  previewUrl?: string;
  ffmpegFilter?: string;
  cssFilter?: string;
  isBuiltin: boolean;
  sortOrder: number;
}

// Applied Transition (clip mode)
export interface ClipTransition {
  id: string;
  clipEditId: string;
  presetId?: string;
  transitionType: string;
  positionIndex: number; // Position between segments
  duration: number;
  parameters?: Record<string, unknown>;
  easing: string;
  createdAt: number;
}

// Applied Effect (clip mode)
export interface ClipEffect {
  id: string;
  clipEditId: string;
  presetId?: string;
  effectType: string;
  startTime: number;
  endTime: number;
  intensity: number; // 0-1
  parameters?: Record<string, unknown>;
  keyframes?: EffectKeyframe[];
  blendMode: string;
  layer: number;
  isEnabled: boolean;
  createdAt: number;
}

// Effect Keyframe for animated parameters
export interface EffectKeyframe {
  time: number;
  parameter: string;
  value: number;
  easing?: string;
}

// Applied Transition (video editor mode)
export interface VideoEditorTransitionEffect {
  id: string;
  editId: string;
  presetId?: string;
  transitionType: string;
  fromSourceId?: string;
  toSourceId?: string;
  duration: number;
  parameters?: Record<string, unknown>;
  easing: string;
  createdAt: number;
}

// Applied Effect (video editor mode)
export interface VideoEditorEffect {
  id: string;
  editId: string;
  presetId?: string;
  effectType: string;
  targetSourceId?: string;
  startTime: number;
  endTime: number;
  intensity: number;
  parameters?: Record<string, unknown>;
  keyframes?: EffectKeyframe[];
  blendMode: string;
  layer: number;
  isEnabled: boolean;
  createdAt: number;
}

// Effect Parameters by Type
export interface BlurEffectParams {
  radius: number;
  type?: 'gaussian' | 'motion' | 'radial';
  angle?: number; // For motion blur
  centerX?: number; // For radial blur
  centerY?: number;
}

export interface ColorEffectParams {
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  temperature?: number;
  tint?: number;
  vibrance?: number;
}

export interface GlitchEffectParams {
  intensity: number;
  frequency: number;
  colorShift?: boolean;
  scanlines?: boolean;
}

export interface VHSEffectParams {
  tracking: number;
  noise: number;
  colorBleed: number;
  scanlines: boolean;
}

export interface ShakeEffectParams {
  intensity: number;
  speed: number;
  rotationAmount?: number;
}

// Transition Parameters
export interface TransitionParams {
  direction?: 'left' | 'right' | 'up' | 'down';
  color?: string; // For dip to color
  softness?: number; // Edge softness for wipes
  angle?: number; // For diagonal wipes
  segments?: number; // For kaleidoscope/blinds
}

// ============================================
// Audio Effects Types
// ============================================

export type AudioEffectCategory =
  | 'volume'
  | 'eq'
  | 'spatial'
  | 'time'
  | 'pitch'
  | 'voice'
  | 'enhancement'
  | 'creative'
  | 'fades';

// Audio Effect Preset (built-in library)
export interface AudioEffectPreset {
  id: string;
  name: string;
  effectType: string;
  category: AudioEffectCategory;
  description?: string;
  icon?: string;
  ffmpegFilter: string;
  webAudioConfig?: WebAudioConfig;
  defaultParameters?: Record<string, unknown>;
  parameterSchema?: AudioEffectParameterSchema[];
  isBuiltIn: boolean;
  createdAt: number;
}

// Web Audio API configuration for preview
export interface WebAudioConfig {
  nodeType:
    | 'gain'
    | 'biquad'
    | 'delay'
    | 'convolver'
    | 'dynamics'
    | 'panner'
    | 'waveshaper'
    | 'worklet'
    | 'chain';
  nodes?: WebAudioNodeConfig[];
  params?: Record<string, number | string>;
}

export interface WebAudioNodeConfig {
  type: string;
  params: Record<string, number | string>;
}

// Parameter schema for UI generation
export interface AudioEffectParameterSchema {
  name: string;
  label: string;
  type: 'number' | 'select' | 'boolean';
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  unit?: string;
  options?: { value: string | number; label: string }[];
}

// Applied Audio Effect (per track)
export interface AudioTrackEffect {
  id: string;
  trackId: string;
  clipEditId?: string;
  videoEditorProjectId?: string;
  effectType: string;
  presetId?: string;
  startTime: number;
  endTime: number;
  intensity: number; // 0-1
  parameters?: Record<string, unknown>;
  isEnabled: boolean;
  orderIndex: number;
  createdAt: number;
}

// Audio Effect Keyframe for automation
export interface AudioEffectKeyframe {
  id: string;
  effectId: string;
  parameterName: string;
  time: number;
  value: number;
  easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  createdAt: number;
}

// Audio Effect Parameter Types
export interface GainParams {
  gain: number; // dB, -60 to +24
}

export interface EQParams {
  frequency: number; // Hz
  gain?: number; // dB
  q?: number; // Quality factor
  type?: 'lowpass' | 'highpass' | 'bandpass' | 'lowshelf' | 'highshelf' | 'peaking' | 'notch';
}

export interface CompressorParams {
  threshold: number; // dB
  ratio: number;
  attack: number; // ms
  release: number; // ms
  knee?: number; // dB
  makeupGain?: number; // dB
}

export interface ReverbParams {
  decay: number; // seconds
  wetDry: number; // 0-1 mix
  preDelay?: number; // ms
  roomSize?: 'small' | 'medium' | 'large' | 'hall';
}

export interface DelayParams {
  time: number; // ms
  feedback: number; // 0-1
  wetDry: number; // 0-1 mix
  pingPong?: boolean;
}

export interface PitchShiftParams {
  semitones: number; // -12 to +12
  cents?: number; // -100 to +100
  preserveFormants?: boolean;
}

export interface PanParams {
  pan: number; // -1 (left) to +1 (right)
}

export interface FadeParams {
  type: 'in' | 'out';
  duration: number; // seconds
  curve?: 'linear' | 'exponential' | 'logarithmic';
}

export interface NoiseReductionParams {
  amount: number; // 0-1
  sensitivity?: number;
}

export interface VoiceEffectParams {
  preset: string; // chipmunk, deep, echo, etc.
  intensity?: number;
}

export interface DistortionParams {
  amount: number; // 0-1
  type?: 'soft' | 'hard' | 'fuzz';
}

export interface ChorusParams {
  rate: number; // Hz
  depth: number; // 0-1
  mix: number; // 0-1
}

export interface FlangerParams {
  rate: number; // Hz
  depth: number; // 0-1
  feedback: number; // 0-1
  mix: number; // 0-1
}

export interface PhaserParams {
  rate: number; // Hz
  depth: number; // 0-1
  stages?: number;
  feedback?: number;
}

// ==========================================
// VOD Preset Types
// ==========================================

// Per-aspect-ratio position settings for a layout overlay
export interface OverlayRatioPosition {
  x: number;                   // 0-100 percentage position (center-based)
  y: number;                   // 0-100 percentage position (center-based)
  width: number;               // 0-100 percentage of target frame width
  height: number;              // 0-100 percentage of target frame height
  opacity: number;             // 0-100
  rotation: number;            // degrees
  scale: number;               // 0-100 percentage scale (like watermark)
  isFullFrameOverlay?: boolean; // When true, position at 0,0 with 100% scale
}

// Per-aspect-ratio overlay configuration (null = disabled for that ratio)
export interface PerRatioOverlaySettings {
  '16:9': OverlayRatioPosition | null;
  '9:16': OverlayRatioPosition | null;
  '1:1': OverlayRatioPosition | null;
  '4:5': OverlayRatioPosition | null;
}

export interface LayoutOverlay {
  id: string;
  imagePath: string;           // Local file path to uploaded PNG
  x: number;                   // 0-100 percentage position (center-based)
  y: number;                   // 0-100 percentage position (center-based)
  width: number;               // 0-100 percentage of target frame width
  height: number;              // 0-100 percentage of target frame height
  opacity: number;             // 0-100
  rotation: number;            // degrees
  label?: string;              // "Speaker Divider", etc.
  perRatioSettings?: PerRatioOverlaySettings | null; // Per-aspect-ratio position overrides
}

export interface VodPreset {
  id: string;
  name: string;
  creatorProfileId: string | null;
  targetAspectRatio: string;
  framingConfig: ManualFramingConfig | null;
  layoutOverlays: LayoutOverlay[];
  watermarkMode: 'creator' | 'custom' | 'none';
  customWatermarkSettings: WatermarkSettings | null;
  createdAt: number;
  updatedAt: number;
}

export interface ActiveVodPresetConfig {
  presetId: string | null;         // reference to saved preset (null if one-off)
  targetAspectRatio: string;
  framingConfig: ManualFramingConfig | null;
  layoutOverlays: LayoutOverlay[];
  watermarkMode: 'creator' | 'custom' | 'none';
  customWatermarkSettings: WatermarkSettings | null;
}
