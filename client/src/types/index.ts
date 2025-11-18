// Timeline and Media Types
export interface WordInfo {
  word: string;
  start: number;
  end: number;
  confidence?: number;
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
  outlineWidth: number;
  outlineColor: string;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowBlur: number;
  shadowColor: string;
  position: 'top' | 'middle' | 'bottom';
  positionPercentage: number;
  maxWidth: number;
  animationStyle: 'none' | 'fade' | 'word-by-word';
  lineHeight: number;
  letterSpacing: number;
  textAlign: 'left' | 'center' | 'right';
  padding: number;
  borderRadius: number;
}

export interface SubtitlePreset {
  id: string;
  name: string;
  description: string;
  settings: SubtitleSettings;
}

export interface MediaPanelProps {
  transcriptCollapsed: boolean;
  clipsCollapsed: boolean;
  isGenerating?: boolean;
  generationProgress?: number;
  generationStage?: string;
  generationMessage?: string;
  generationError?: string;
  projectId?: string;
  hoveredTimelineClipId?: string | null;
  playingClipId?: string | null;
  isPlayingSegments?: boolean;
  videoDuration?: number; // Duration in seconds
  currentTime?: number; // Current video playback time in seconds
}

export interface MediaPanelEmits {
  (e: 'clipHover', clipId: string): void;
  (e: 'clipLeave'): void;
  (e: 'detectClips'): void;
  (e: 'scrollToTimeline'): void;
  (e: 'deleteClip', clipId: string): void;
  (e: 'playClip', clip: any): void; // Using any for ClipWithVersion for now
  (e: 'seekVideo', time: number): void;
  (e: 'subtitleSettingsChanged', settings: SubtitleSettings): void;
}

export interface TimelinePlayheadProps {
  videoSrc: string | null;
  duration: number;
  position: number;
  timelineBoundsTop: number;
  timelineBoundsBottom: number;
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

// Phoenix types are defined in phoenix.d.ts
