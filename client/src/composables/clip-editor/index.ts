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
  formatTimeWithCentiseconds,
  formatDuration,
  formatPanLabel,
  extractFileName,
  truncateText,
  formatVolumePercent,
  formatVolumeDb,
  formatPercentage,
  formatRawPercentage,
  formatRotation,
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

// Phase 3: New Composables - Component Logic Extraction
export {
  useTimelineSegmentStyles,
  type TimelineSegmentStylesOptions,
  type TimelineSegmentStylesReturn,
} from './useTimelineSegmentStyles';

export {
  useStickerFormatting,
  getStickerPreview,
  getStickerName,
  type StickerFormattingReturn,
} from './useStickerFormatting';

export {
  useStickerUpload,
  type StickerUploadOptions,
  type StickerUploadReturn,
} from './useStickerUpload';

export {
  useInlineEdit,
  type InlineEditOptions,
  type InlineEditReturn,
} from './useInlineEdit';

export {
  useAudioTrackToggles,
  type AudioTrackTogglesOptions,
  type AudioTrackTogglesReturn,
} from './useAudioTrackToggles';

export {
  useOriginalAudioControl,
  type OriginalAudioControlOptions,
  type OriginalAudioControlReturn,
} from './useOriginalAudioControl';

export {
  useEmojiStickerCreation,
  COMMON_EMOJIS,
  type EmojiStickerCreationOptions,
  type EmojiStickerCreationReturn,
} from './useEmojiStickerCreation';

// Phase 4: Component Logic Extraction - Inspector & Panel Business Logic
export {
  useTextInspectorLogic,
  parseStyle,
  mergeStyle,
  serializeStyle,
  validateStyleProperty,
  FONT_FAMILIES,
  FONT_WEIGHTS,
  TEXT_ANIMATIONS,
  TEXT_STYLE_CONSTRAINTS,
  type TextInspectorLogicOptions,
  type TextInspectorLogicReturn,
} from './useTextInspectorLogic';

export {
  useWatermarkSettings,
  formatScale,
  formatOpacity,
  WATERMARK_ASPECT_RATIOS,
  POSITION_PRESETS,
  DEFAULT_WATERMARK_CONFIG,
  WATERMARK_CONSTRAINTS,
  type WatermarkConfig,
  type PositionPreset,
  type WatermarkAspectRatio,
  type WatermarkSettingsOptions,
  type WatermarkSettingsReturn,
} from './useWatermarkSettings';

export {
  useFramingSettings,
  ASPECT_RATIOS,
  FRAMING_MODES,
  type FramingMode,
  type AspectRatio,
  type FramingModeId,
  type FramingSettingsOptions,
  type FramingSettingsReturn,
} from './useFramingSettings';

export {
  useStickerInspectorLogic,
  formatStickerScale,
  formatStickerRotation,
  validateStickerScale,
  validateStickerRotation,
  validateStickerPosition,
  STICKER_ANIMATIONS,
  STICKER_CONSTRAINTS,
  type StickerAnimation,
  type StickerInspectorLogicOptions,
  type StickerInspectorLogicReturn,
} from './useStickerInspectorLogic';

export {
  useAudioInspectorLogic,
  validateAudioVolume,
  validateAudioPan,
  validateAudioFade,
  toBinary,
  fromBinary,
  AUDIO_CONSTRAINTS,
  type AudioInspectorLogicOptions,
  type AudioInspectorLogicReturn,
} from './useAudioInspectorLogic';

export {
  usePanelDefinitions,
  getPanelById,
  getPanelLabel,
  getPanelIcon,
  isPanelImplemented,
  PANEL_DEFINITIONS,
  IMPLEMENTED_PANELS,
  type PanelDefinition,
  type PanelId,
  type PanelDefinitionsReturn,
} from './usePanelDefinitions';

// Phase 5: Additional Refactoring - Business Logic Extraction
export {
  useTimelineZoomControl,
  type TimelineZoomControlOptions,
  type TimelineZoomControlReturn,
} from './useTimelineZoomControl';

export {
  useWatermarkSettingsTransform,
  type WatermarkSettingsInput,
  type WatermarkSettingsTransformOptions,
  type WatermarkSettingsTransformReturn,
} from './useWatermarkSettingsTransform';

export {
  useAudioTrackCreation,
  AUDIO_FILE_EXTENSIONS,
  DEFAULT_AUDIO_TRACK_VALUES,
  type AudioTrackData,
  type AudioTrackCreationOptions,
  type AudioTrackCreationReturn,
} from './useAudioTrackCreation';

export {
  useMediaTypeStyles,
  getMediaTypeColors,
  getThumbnailStyles,
  getBadgeStyles,
  getHoverClasses,
  getIconColor,
  MEDIA_TYPE_COLORS,
  type MediaType as MediaTypeEnum,
  type MediaTypeColorScheme,
  type MediaTypeStylesReturn,
} from './useMediaTypeStyles';

export {
  useTextOverlayCreation,
  type TextOverlayCreationOptions,
  type TextOverlayCreationReturn,
} from './useTextOverlayCreation';

export {
  useTimelineAudioTransform,
  transformAudioTrack,
  type AudioTrackRecord,
  type PlayerAudioTrack,
  type TimelineAudioState,
  type TimelineAudioTransformOptions,
  type TimelineAudioTransformReturn,
} from './useTimelineAudioTransform';

export {
  useDateTimeFormatters,
  formatDate,
  formatShortDate,
  formatTimeFromTimestamp,
  formatRelativeTime,
  formatLongDuration,
  type DateTimeFormattersReturn,
} from './useDateTimeFormatters';

export {
  usePanelToggle,
  type PanelToggleEmit,
  type PanelToggleOptions,
  type PanelToggleReturn,
} from './usePanelToggle';

// Phase 6: Dialog Business Logic Extraction
export {
  useEditorDataLoader,
  type EditorDataLoaderOptions,
  type EditorDataLoaderReturn,
} from './useEditorDataLoader';

export {
  useEditorAutoSave,
  type EditorAutoSaveOptions,
  type EditorAutoSaveReturn,
} from './useEditorAutoSave';

export {
  useTitleManagement,
  type TitleManagementOptions,
  type TitleManagementReturn,
} from './useTitleManagement';

export {
  useTimelineFadeHandles,
  type FadeHandleOptions,
  type FadeHandleReturn,
} from './useTimelineFadeHandles';

export {
  useAudioSegmentDrag,
  type AudioSegmentDragOptions,
  type AudioSegmentDragReturn,
} from './useAudioSegmentDrag';

export {
  useVideoSourceDrag,
  type VideoSourceDragOptions,
  type VideoSourceDragReturn,
} from './useVideoSourceDrag';
