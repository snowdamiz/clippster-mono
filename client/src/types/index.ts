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
  dialogHeight?: number | null;
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
  // Creator profile default assets (auto-applied when building clips)
  creatorDefaultIntro?: IntroOutroRef | null;
  creatorDefaultOutro?: IntroOutroRef | null;
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
  (e: 'addClip'): void;
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
export interface WaveformPeak {
  min: number;
  max: number;
}

export interface WaveformResolution {
  peaks: WaveformPeak[];
  peakCount: number;
  samplesPerPeak: number;
}

export interface WaveformData {
  sampleRate: number;
  duration: number;
  resolutions: Record<string, WaveformResolution>;
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

// Per-aspect-ratio manual framing configurations
export interface ManualFramingConfigs {
  '9:16'?: ManualFramingConfig;
  '4:5'?: ManualFramingConfig;
  '1:1'?: ManualFramingConfig;
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
  fadeIn: number; // Duration in seconds
  fadeOut: number; // Duration in seconds
  trackOrder: number;
  isMuted: boolean;
  isSolo: boolean;
}

// Per-aspect-ratio configuration for text overlays
export interface TextOverlayRatioConfig {
  position: { x: number; y: number }; // 0-100 percentage
  style: TextOverlayStyle;
  // Future: could add scale, rotation, etc.
}

// Text overlay configuration
export interface TextOverlay {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  position: { x: number; y: number }; // 0-100 percentage - default/fallback position
  style: TextOverlayStyle; // Default/fallback style
  animation: TextAnimation;
  // Per-aspect-ratio configurations (key is aspect ratio string like "16:9", "9:16", "1:1")
  perRatioConfigs?: Record<string, TextOverlayRatioConfig>;
  // Height of preview container when overlay was configured (for proper font scaling on export)
  previewHeight?: number;
}

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
  // Per-aspect-ratio configurations (key is aspect ratio string like "16:9", "9:16", "1:1")
  perRatioConfigs?: Record<string, StickerRatioConfig>;
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
  | 'shake';

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

// Clip Editor Dialog Props
export interface ClipEditorDialogProps {
  modelValue: boolean;
  clipId: string;
  videoSrc: string | null;
  clipStartTime: number;
  clipEndTime: number;
  clipTitle: string;
}

// Editor tab types
export type ClipEditorTab =
  | 'sources'
  | 'intro-outro'
  | 'audio'
  | 'filters'
  | 'text'
  | 'stickers'
  | 'watermark'
  | 'subtitles'
  | 'aspect'
  | 'transcript'
  | 'export';

// Timeline track types for clip editor
export interface EditorTimelineTrack {
  id: string;
  type: 'video' | 'audio' | 'text' | 'sticker' | 'effect';
  name: string;
  items: EditorTimelineItem[];
  isLocked: boolean;
  isVisible: boolean;
  isMuted?: boolean;
}

export interface EditorTimelineItem {
  id: string;
  trackId: string;
  type: 'video-segment' | 'audio-clip' | 'text-overlay' | 'sticker' | 'effect';
  startTime: number;
  endTime: number;
  data: AudioTrack | TextOverlay | Sticker | Effect | TrimSegment;
}

// Editor preview state
export interface EditorPreviewState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  activeOverlays: (TextOverlay | Sticker)[];
  activeEffects: Effect[];
}

// ==========================================
// Clip Subtitle Types (for Clip Editor)
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
  trim_start: number; // Trim from source start
  trim_end: number | null; // Trim from source end (null = use full duration)
  order_index: number;
  created_at: number;
}

// Project with all sources loaded
export interface VideoEditorProjectWithSources extends VideoEditorProject {
  sources: VideoEditorSource[];
}

// Editor tab types for standalone video editor (includes 'sources' tab)
export type VideoEditorTab =
  | 'sources'
  | 'intro-outro'
  | 'audio'
  | 'filters'
  | 'text'
  | 'stickers'
  | 'watermark'
  | 'subtitles'
  | 'aspect'
  | 'transcript'
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

// Represents a crossfade transition between two overlapping video sources
export interface VideoEditorTransition {
  id: string;
  sourceAId: string; // First source (ending)
  sourceBId: string; // Second source (starting)
  startTime: number; // When transition starts (sourceB.start_time)
  endTime: number; // When transition ends (sourceA.end_time)
  duration: number; // Length of the crossfade
  type: 'crossfade'; // Future: could support 'wipe', 'dissolve', etc.
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
          type: 'crossfade',
        });
      }
    }
  }

  return transitions;
}

// Calculate crossfade opacity for preview playback
// Returns { opacityA, opacityB } where values are 0-1
export function calculateCrossfadeOpacity(
  currentTime: number,
  transition: VideoEditorTransition
): { opacityA: number; opacityB: number } {
  if (currentTime < transition.startTime) {
    return { opacityA: 1, opacityB: 0 };
  }
  if (currentTime >= transition.endTime) {
    return { opacityA: 0, opacityB: 1 };
  }

  // Linear crossfade
  const progress = (currentTime - transition.startTime) / transition.duration;
  return {
    opacityA: 1 - progress,
    opacityB: progress,
  };
}
