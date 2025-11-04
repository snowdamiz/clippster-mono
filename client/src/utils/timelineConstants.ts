/**
 * Timeline constants and configuration values extracted from Timeline.vue
 */

// Height constants for timeline calculations
export const TIMELINE_HEIGHTS = {
  HEADER: 56,           // Header section height (pt-3 + content + mb-3 + spacing)
  RULER: 32,            // Timeline ruler height
  MAIN_TRACK: 86,       // Main video track height
  CLIP_TRACK: 48,       // Height per clip track
  BOTTOM_PADDING_NO_CLIPS: 8,  // Bottom padding when no clips
  BOTTOM_PADDING_WITH_CLIPS: 34 // Bottom padding when there are clips
} as const

// Timeline height bounds
export const TIMELINE_BOUNDS = {
  MIN_HEIGHT: 148,      // Minimum height when no clips (56 + 32 + 56)
  MAX_HEIGHT: 400       // Maximum height to allow more clips before scrollbar
} as const

// Zoom configuration
export const ZOOM_CONFIG = {
  MIN: 0.1,             // Minimum zoom level (10%)
  MAX: 3.0,             // Maximum zoom level (300%)
  STEP: 0.01,           // Zoom step for slider
  DEFAULT: 1.0          // Default zoom level (100%)
} as const

// Track dimensions
export const TRACK_DIMENSIONS = {
  LABEL_WIDTH: 64,      // Width of track labels (w-16 = 4rem = 64px)
  MIN_SEGMENT_DURATION: 0.5,  // Minimum segment duration in seconds
  DEBOUNCE_DELAY: 100,  // Debounce delay for database updates (ms)
  TOOLTIP_THROTTLE: 16  // Throttle delay for tooltip updates (~60fps)
} as const

// Continuous seeking configuration
export const SEEKING_CONFIG = {
  INTERVAL_MS: 100,     // Interval between seeks in continuous mode
  SECONDS_PER_INTERVAL: 1,  // Seconds to seek per interval
  SPEED_MULTIPLIER: 10  // Effective speed: seconds per second
} as const

// Cut tool configuration
export const CUT_CONFIG = {
  MIN_SEGMENT_DURATION: 0.5,  // Minimum duration for cut segments
  DEAD_SPACE_THRESHOLD: 1.0,  // Threshold for dead space detection (seconds)
  WORD_CONTEXT_RADIUS: 2,     // Number of words to show around center word
  MAX_DISTANCE_THRESHOLD: 2.0 // Maximum distance for word association
} as const

// Animation and transition durations
export const ANIMATION_CONFIG = {
  PLAYHEAD_UPDATE: 100,     // Playhead transition duration (ms)
  TOOLTIP_POSITION: 0,      // Tooltip position transition (ms)
  SEGMENT_TRANSITION: 200,  // Segment hover/resize transition (ms)
  HOVER_LINE_FADE: 150      // Hover line fade duration (ms)
} as const

// Cursor and interaction states
export const CURSOR_STATES = {
  GRAB: 'grab',
  GRABBING: 'grabbing',
  EW_RESIZE: 'ew-resize',
  CROSSHAIR: 'crosshair',
  POINTER: 'pointer',
  DEFAULT: 'default'
} as const

// CSS selectors used frequently
export const SELECTORS = {
  VIDEO_TRACK: '.flex-1.h-8.bg-\\[\\#0a0a0a\\]\\/50.rounded-md.relative',
  TIMELINE_CONTENT: '.timeline-content-wrapper',
  TIMELINE_CONTAINER: '.timeline-scroll-container'
} as const