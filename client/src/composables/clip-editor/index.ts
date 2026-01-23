/**
 * Clip Editor Composables
 *
 * This module provides a collection of composables for the clip editor,
 * extracting business logic from components into focused, testable units.
 *
 * Phase 1: Foundation
 * - useEditorFormatters: Pure formatting utilities
 * - useEditorSelection: Centralized selection state
 *
 * Phase 2: Data & Time
 * - useVideoSourceTime: Time conversion between timeline and video source
 * - useTimelineItems: Reactive access to timeline items
 * - useVideoEffects: CSS filter building from effects
 *
 * Phase 3: Business Logic
 * - useDurationCalculator: Calculate timeline duration
 * - useEditorSplit: Split operations for all item types
 * - useEditorDelete: Delete operations for all item types
 * - useEditorExport: Export configuration and execution
 *
 * Phase 4: Infrastructure
 * - useWaveformRenderer: Waveform loading and visualization
 * - usePanelCRUD: Generic panel CRUD operations
 */

// Phase 1: Foundation
export {
  useEditorFormatters,
  formatTime,
  formatTimeWithMs,
  formatDuration,
  formatPanLabel,
  extractFileName,
  truncateText,
  formatVolumePercent,
  formatVolumeDb,
} from './useEditorFormatters';

export {
  useEditorSelection,
  usePanelSelection,
  type SelectionItemType,
  type SelectableItem,
  type EditorSelectionReturn,
} from './useEditorSelection';

// Phase 2: Data & Time
export {
  useVideoSourceTime,
  type VideoSource,
  type VideoSourceTimeReturn,
} from './useVideoSourceTime';

export {
  useTimelineItems,
  type GroupedAudioTrack,
  type TimelineItemsReturn,
} from './useTimelineItems';

export {
  useVideoEffects,
  type EffectSettings,
  type VideoEffectsReturn,
} from './useVideoEffects';

// Phase 3: Business Logic
export {
  useDurationCalculator,
  type VideoSourceData,
  type ProjectWithSources,
  type DurationCalculatorReturn,
} from './useDurationCalculator';

export {
  useEditorSplit,
  type EditorSplitOptions,
  type EditorSplitReturn,
} from './useEditorSplit';

export {
  useEditorDelete,
  type EditorDeleteOptions,
  type EditorDeleteReturn,
} from './useEditorDelete';

export {
  useEditorExport,
  type ExportConfig,
  type EditorExportOptions,
  type EditorExportReturn,
} from './useEditorExport';

export {
  useInspectorOperations,
  type InspectorItemType,
  type InspectorOperationsOptions,
  type InspectorOperationsReturn,
} from './useInspectorOperations';

export {
  useTextTemplates,
  DEFAULT_TEXT_STYLE,
  TEXT_TEMPLATES,
  TEMPLATE_STYLES,
  type TextStyle,
  type TextTemplate,
  type TemplateStyleOverride,
  type TextOverlayData,
  type TextTemplatesReturn,
} from './useTextTemplates';

export {
  useVideoSync,
  type ActiveAudioTrack,
  type AudioMixerInterface,
  type TimelineRendererInterface,
  type VideoSyncOptions,
  type VideoSyncReturn,
} from './useVideoSync';

// Phase 4: Infrastructure

export {
  usePanelCRUD,
  useAudioTracksCRUD,
  useTextOverlaysCRUD,
  useStickersCRUD,
  useMediaCRUD,
  type PanelItem,
  type PanelCRUDOptions,
  type PanelCRUDReturn,
  type MediaType,
  type MediaItem,
  type MediaCRUDOptions,
  type MediaCRUDReturn,
} from './usePanelCRUD';

export {
  usePlayheadDrag,
  type PlayheadDragOptions,
  type PlayheadDragReturn,
} from './usePlayheadDrag';

export {
  useWaveformRenderer,
  type WaveformPeak,
  type WaveformRendererOptions,
  type WaveformRendererReturn,
} from './useWaveformRenderer';

export {
  useEditorKeyboardShortcuts,
  type KeyboardShortcutHandlers,
  type KeyboardShortcutsOptions,
  type KeyboardShortcutsReturn,
} from './useEditorKeyboardShortcuts';

export {
  useVideoUrlBuilder,
  type TimelineData,
  type VideoUrlBuilderOptions,
  type VideoUrlBuilderReturn,
} from './useVideoUrlBuilder';

// Phase 1: New Composables
export {
  useOverlayStyles,
  type OverlayPosition,
  type TextOverlayStyle,
  type StickerStyle,
  type WatermarkStyle,
  type WatermarkSettings,
  type OverlayStylesOptions,
  type OverlayStylesReturn,
} from './useOverlayStyles';

export {
  useTimelineZoom,
  TRACK_LABEL_WIDTH,
  PIXELS_PER_SECOND_BASE,
  MIN_TIMELINE_WIDTH,
  type TimelineZoomOptions,
  type TimelineZoomReturn,
} from './useTimelineZoom';

export {
  useTimelineRuler,
  type TimeMarker,
  type TimelineRulerOptions,
  type TimelineRulerReturn,
} from './useTimelineRuler';

// Phase 2: New Composables
export {
  useAudioDetach,
  type AudioExtractResult,
  type VideoSourceForExtract,
  type AudioDetachOptions,
  type AudioDetachReturn,
} from './useAudioDetach';

export {
  useTimelineReload,
  type TimelineVideoSource,
  type TimelineAudioTrack,
  type TimelineData as ReloadTimelineData,
  type PlaybackEngineInterface,
  type DurationCalculatorFn,
  type TimelineReloadOptions,
  type TimelineReloadReturn,
} from './useTimelineReload';
