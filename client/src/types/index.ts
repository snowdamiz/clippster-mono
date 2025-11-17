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

// Phoenix types are defined in phoenix.d.ts
