<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="poi-dialog__overlay">
        <Transition name="dialog" appear>
          <div class="poi-dialog" role="dialog" aria-modal="true">
            <!-- Top accent -->
            <div class="poi-dialog__accent" />

            <!-- Header -->
            <div class="poi-dialog__header">
              <div class="flex items-center gap-2.5 min-w-0">
                <div class="poi-dialog__icon">
                  <LayoutDashboardIcon class="h-4 w-4" />
                </div>
                <div class="flex items-baseline gap-2 min-w-0">
                  <h2 class="poi-dialog__title">Manual Framing Editor</h2>
                  <span class="poi-dialog__subtitle truncate">
                    · Define crop regions on the source and arrange them in the {{ targetAspectRatio }} output
                  </span>
                </div>
              </div>
              <button
                @click="close"
                class="poi-dialog__close"
                title="Close"
              >
                <XIcon :size="16" />
              </button>
            </div>

            <!-- Main Content - Side by Side Panels -->
            <div class="flex-1 overflow-hidden flex flex-col">
              <div class="flex-1 flex overflow-hidden">
                <!-- Source Panel (Left) — swapped for text box settings when editing -->
                <div class="flex-1 poi-dialog__divider-r min-h-0 flex flex-col overflow-hidden">
                  <!-- Subtitle Settings Mode -->
                  <template v-if="subtitleSettingsMode && localSubtitleSettings">
                    <div class="poi-dialog__sub-header">
                      <span class="poi-dialog__sub-title">Subtitles</span>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="poi-dialog__btn poi-dialog__btn--secondary poi-dialog__btn--sm"
                          @click="cancelSubtitleSettings"
                        >Cancel</button>
                        <button
                          type="button"
                          class="poi-dialog__btn poi-dialog__btn--purple poi-dialog__btn--sm"
                          @click="doneSubtitleSettings"
                        >Done</button>
                      </div>
                    </div>
                    <SubtitlePropertiesPanel
                      class="flex-1 min-h-0 overflow-hidden"
                      variant="embedded"
                      :settings="localSubtitleSettings"
                      :segments="transcriptSegments"
                      :current-time="currentTime"
                      @updateSettings="onSubtitleSettingsPanelUpdate"
                      @close="doneSubtitleSettings"
                    />
                  </template>
                  <template v-else-if="textBoxSettingsMode && clipTextLocal">
                    <div class="poi-dialog__sub-header">
                      <span class="poi-dialog__sub-title">Text box</span>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="poi-dialog__btn poi-dialog__btn--secondary poi-dialog__btn--sm"
                          @click="cancelTextBoxSettings"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          class="poi-dialog__btn poi-dialog__btn--amber poi-dialog__btn--sm"
                          @click="doneTextBoxSettings"
                        >
                          Done
                        </button>
                      </div>
                    </div>
                    <ClipTextBoxPropertiesPanel
                      class="flex-1 min-h-0 overflow-hidden"
                      variant="embedded"
                      :state="clipTextLocal"
                      :clip-duration="clipDuration"
                      @update-state="onClipTextPanelPatch"
                      @delete="onClipTextPanelDelete"
                      @close="doneTextBoxSettings"
                    />
                  </template>
                  <template v-else-if="showAiBrollPanel">
                    <AIBrollPanel
                      class="flex-1 min-h-0"
                      :suggestions="aiBroll.suggestions.value"
                      :is-generating="aiBroll.isGenerating.value"
                      :is-fetching="aiBroll.isFetching.value"
                      :error="aiBroll.error.value"
                      :can-generate="canGenerateAiBroll"
                      :planner-options="aiBroll.options.value"
                      :clip-duration="clipDuration"
                      :playhead-time="currentTime"
                      :manual-search-query="aiBroll.manualSearchQuery.value"
                      :manual-search-media-type="aiBroll.manualSearchMediaType.value"
                      :manual-search-results="aiBroll.manualSearchResults.value"
                      :selected-manual-candidate-id="aiBroll.selectedManualCandidateId.value"
                      :is-manual-searching="aiBroll.isManualSearching.value"
                      :manual-search-error="aiBroll.manualSearchError.value"
                      :is-manual-adding="isManualBrollAdding"
                      @close="showAiBrollPanel = false"
                      @generate="onAiBrollGenerate"
                      @fetch-all="onAiBrollFetchAll"
                      @apply="onAiBrollApply"
                      @apply-all="onAiBrollApplyAll"
                      @regenerate="onAiBrollRegenerate"
                      @reject="onAiBrollReject"
                      @select-candidate="onAiBrollSelectCandidate"
                      @manual-search="onManualBrollSearch"
                      @manual-select-candidate="onManualBrollSelectCandidate"
                      @manual-add="onManualBrollAdd"
                      @update:manual-search-query="aiBroll.manualSearchQuery.value = $event"
                      @update:manual-search-media-type="aiBroll.manualSearchMediaType.value = $event"
                    />
                  </template>
                  <POISourcePanel
                    v-else
                    :regions="regions"
                    :selected-region-id="selectedRegionId"
                    :thumbnail-url="thumbnailUrl"
                    :source-aspect-ratio="sourceAspectRatio"
                    :target-aspect-ratio="targetAspectRatio"
                    :social-overlay-preset="socialOverlayPreset"
                    :video-url="videoUrl"
                    :video-time="absoluteVideoTime"
                    :is-playing="isPlaying"
                    :volume="poiVolume"
                    :is-muted="poiMuted"
                    @add-region="addRegion"
                    @update-region="updateRegion"
                    @delete-region="deleteRegion"
                    @select-region="selectRegion"
                    @time-update="onTimeUpdate"
                    @upload-media="handleMediaUpload"
                    @update:socialOverlayPreset="socialOverlayPreset = $event"
                  />
                </div>

                <!-- Arrow indicator -->
                <div class="flex items-center justify-center w-8 poi-dialog__rail">
                  <div class="flex flex-col items-center gap-1.5">
                    <ArrowRightIcon class="w-4 h-4 poi-dialog__muted" />
                    <span class="text-[9px] poi-dialog__faint font-medium tracking-wider rotate-90 whitespace-nowrap">
                      EXPORT
                    </span>
                  </div>
                </div>

                <!-- Target Panel (Right) -->
                <div class="flex-1">
                  <POITargetPanel
                    :regions="regions"
                    :selected-region-id="selectedRegionId"
                    :thumbnail-url="thumbnailUrl"
                    :target-aspect-ratio="targetAspectRatio"
                    :source-aspect-ratio="sourceAspectRatio"
                    :video-url="videoUrl"
                    :video-time="absoluteVideoTime"
                    :clip-start-time="clipStartTime"
                    :is-playing="isPlaying"
                    :watermark-preview="resolvedWatermark"
                    :overlay-previews="resolvedOverlays"
                    :subtitle-settings="localSubtitleSettings"
                    :subtitle-position="localSubtitlePosition"
                    :subtitle-positioning-enabled="subtitlePositioningEnabled"
                    :transcript-words="transcriptWords"
                    :transcript-segments="transcriptSegments"
                    :initial-source-framing="targetPanelInitialFraming"
                    :clip-text-box-display="clipTextBoxForTarget"
                    :clip-text-box-positioning-enabled="clipTextBoxPositioningActive"
                    :social-overlay-preset="socialOverlayPreset"
                    @update-region="updateRegion"
                    @select-region="selectRegion"
                    @update-source-transform="handleSourceTransformUpdate"
                    @subtitlePositionChange="onSubtitlePositionChange"
                    @subtitleSettingsChange="onSubtitleSettingsChange"
                    @clipTextBoxPositionChange="onClipTextBoxPositionChange"
                  />
                </div>
              </div>

              <!-- Video Playback Controls -->
              <div v-if="clipDuration > 0" class="poi-dialog__playback">
                <div class="flex items-center gap-2">
                  <!-- Play/Pause button -->
                  <button
                    @click="togglePlayback"
                    class="poi-dialog__play-btn"
                    :disabled="!videoUrl"
                    :class="{ 'opacity-50 cursor-not-allowed': !videoUrl }"
                  >
                    <PlayIcon v-if="!isPlaying" class="w-4 h-4 ml-0.5" />
                    <PauseIcon v-else class="w-4 h-4" />
                  </button>

                  <!-- Time display -->
                  <span class="text-xs font-mono w-20 poi-dialog__muted">
                    {{ formatTime(currentTime) }} / {{ formatTime(clipDuration) }}
                  </span>

                  <!-- Progress bar -->
                  <div class="flex-1 relative group cursor-pointer" ref="progressBarRef" @mousedown="onSeekStart">
                    <div class="poi-dialog__progress-track">
                      <div
                        class="poi-dialog__progress-fill"
                        :class="{ 'transition-all duration-100': !isSeeking }"
                        :style="{ width: `${(currentTime / clipDuration) * 100}%` }"
                      />
                    </div>
                    <!-- Seek handle -->
                    <div
                      class="poi-dialog__progress-handle"
                      :class="{
                        'opacity-100': isSeeking || currentTime === 0,
                        'opacity-0 group-hover:opacity-100': !isSeeking && currentTime !== 0
                      }"
                      :style="{ left: `calc(${(currentTime / clipDuration) * 100}% - 6px)` }"
                    />
                  </div>

                  <!-- Volume control -->
                  <div class="flex items-center gap-1.5 shrink-0">
                    <button
                      @click="togglePoiMute"
                      class="poi-dialog__icon-btn"
                      :title="poiMuted ? 'Unmute' : 'Mute'"
                    >
                      <VolumeXIcon v-if="poiMuted || poiVolume === 0" class="w-4 h-4" />
                      <Volume2Icon v-else class="w-4 h-4" />
                    </button>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.02"
                      :value="poiMuted ? 0 : poiVolume"
                      class="poi-dialog__volume-slider"
                      @input="onPoiVolumeChange"
                    />
                  </div>

                  <!-- Reset button -->
                  <button
                    @click="
                      currentTime = 0;
                      isPlaying = false;
                    "
                    class="poi-dialog__icon-btn"
                    title="Reset to start"
                  >
                    <RotateCcwIcon class="w-4 h-4" />
                  </button>
                </div>

                <!-- Loading/Error state -->
                <div v-if="videoLoading" class="text-[10px] mt-2 poi-dialog__faint">Loading video preview...</div>
                <div v-else-if="videoError" class="text-[10px] mt-2 poi-dialog__warning">
                  {{ videoError }}
                </div>
              </div>

              <!-- Segment Timeline -->
              <POISegmentTimeline
                v-if="clipDuration > 0"
                :segments="segmentConfigs"
                :broll-markers="aiBroll.brollMarkers.value"
                :active-segment-id="activeSegmentId"
                :duration="clipDuration"
                :current-time="currentTime"
                :video-url="videoUrl"
                :thumbnail-url="thumbnailUrl"
                :clip-start-time="clipStartTime"
                :clip-end-time="clipEndTime"
                @add-segment="addSegment"
                @delete-segment="deleteSegment"
                @select-segment="selectSegment"
                @update-segment="updateSegment"
                @seek-time="handleSeekTime"
              />

            </div>

            <!-- Feature controls: Subtitles + Clip text box + AI B-roll -->
            <div
              v-if="subtitleSettings || clipId || projectId"
              class="poi-dialog__divider-t poi-dialog__feature-grid"
            >
              <!-- Subtitles cell -->
              <div v-if="subtitleSettings" class="poi-dialog__feature-cell">
                <Checkbox
                  v-model:checked="subtitlePositioningEnabled"
                  aria-label="Enable subtitle positioning"
                  class="poi-dialog__checkbox poi-dialog__checkbox--purple shrink-0"
                />
                <CaptionsIcon class="h-4 w-4 poi-dialog__icon-purple shrink-0" />
                <div class="flex-1 min-w-0">
                  <span class="poi-dialog__feature-label">Subtitles</span>
                  <span v-if="subtitlePositioningEnabled" class="text-[10px] ml-2 poi-dialog__muted">
                    · Drag to reposition
                  </span>
                </div>
                <button
                  type="button"
                  class="poi-dialog__btn poi-dialog__btn--secondary poi-dialog__btn--sm shrink-0"
                  @click="openSubtitleSettings"
                >
                  Edit
                </button>
                <span class="text-[10px] shrink-0 font-mono poi-dialog__faint">{{ targetAspectRatio }}</span>
              </div>

              <!-- Clip text box cell -->
              <div v-if="clipId" class="poi-dialog__feature-cell">
                <Type class="h-4 w-4 poi-dialog__icon-amber shrink-0" />
                <div class="flex-1 min-w-0">
                  <span class="poi-dialog__feature-label">Clip text box</span>
                  <span v-if="clipTextBoxPositioningActive" class="text-[10px] ml-2 poi-dialog__muted">
                    · Drag on export preview
                  </span>
                </div>
                <button
                  type="button"
                  class="poi-dialog__btn poi-dialog__btn--secondary poi-dialog__btn--sm shrink-0"
                  @click="openTextBoxSettings"
                >
                  {{ clipTextLocal?.enabled ? 'Edit' : 'Add text' }}
                </button>
                <span class="text-[10px] shrink-0 font-mono poi-dialog__faint">{{ targetAspectRatio }}</span>
              </div>

              <!-- AI B-roll cell -->
              <div v-if="projectId && clipId" class="poi-dialog__feature-cell">
                <Sparkles class="h-4 w-4 poi-dialog__icon-cyan shrink-0" />
                <div class="flex-1 min-w-0">
                  <span class="poi-dialog__feature-label">B-roll</span>
                  <span v-if="aiBroll.appliedCount.value > 0" class="text-[10px] ml-2 poi-dialog__muted">
                    · {{ aiBroll.appliedCount.value }} applied
                  </span>
                </div>
                <button
                  type="button"
                  class="poi-dialog__btn poi-dialog__btn--secondary poi-dialog__btn--sm shrink-0"
                  @click="openAiBrollPanel"
                >
                  {{ showAiBrollPanel ? 'Hide' : 'Open' }}
                </button>
              </div>
            </div>

            <!-- Footer -->
            <div class="poi-dialog__footer">
              <div class="text-sm poi-dialog__muted">
                <span v-if="!canApplyFraming" class="poi-dialog__warning">
                  <AlertCircleIcon class="w-4 h-4 inline mr-1" />
                  Add a region, enable Scale 16:9 / Use 16:9, or enable the clip text box
                </span>
                <span v-else-if="sourceFrameMode !== 'none' && regions.length === 0" class="poi-dialog__faint">
                  {{ sourceFrameMode === 'use16x9' ? 'Use 16:9' : 'Scale 16:9' }} configured
                </span>
                <span v-else class="poi-dialog__faint">
                  {{ regions.length }} region{{ regions.length !== 1 ? 's' : '' }} configured
                </span>
              </div>
              <div class="flex items-center gap-2.5">
                <button
                  @click="resetRegions"
                  class="poi-dialog__btn poi-dialog__btn--secondary"
                  :disabled="!canApplyFraming"
                  :class="{ 'opacity-50 cursor-not-allowed': !canApplyFraming }"
                >
                  Reset
                </button>
                <button
                  @click="close"
                  class="poi-dialog__btn poi-dialog__btn--secondary"
                >
                  Cancel
                </button>
                <button
                  @click="confirmConfig"
                  :disabled="!canApplyFraming"
                  class="poi-dialog__btn poi-dialog__btn--primary"
                >
                  <CheckIcon class="h-4 w-4" />
                  <span>Apply Configuration</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
  import {
    LayoutDashboardIcon,
    XIcon,
    ArrowRightIcon,
    CheckIcon,
    AlertCircleIcon,
    PlayIcon,
    PauseIcon,
    RotateCcwIcon,
    CaptionsIcon,
    ChevronDownIcon,
    Type,
    Volume2Icon,
    VolumeXIcon,
    Sparkles,
  } from 'lucide-vue-next';
  import Hls from 'hls.js';
  import POISourcePanel from './POISourcePanel.vue';
  import POITargetPanel from './POITargetPanel.vue';
  import POISegmentTimeline from './POISegmentTimeline.vue';
  import AIBrollPanel from './AIBrollPanel.vue';
  import ClipTextBoxPropertiesPanel from '@/components/ClipTextBoxPropertiesPanel.vue';
  import SubtitlePropertiesPanel from '@/components/SubtitlePropertiesPanel.vue';
  import { Checkbox } from '@/components/ui/checkbox';
  import type {
    ManualRegion,
    ManualFramingConfig,
    ManualSourceFramingPayload,
    ManualSourceFrameMode,
    WatermarkSettings,
    LayoutOverlay,
    SegmentRegionConfig,
    SubtitleSettings,
  } from '@/types';
  import { utf8ToBase64 } from '@/utils/encoding';
  import type { ClipTextBoxState } from '@/utils/clipTextBox';
  import {
    createDefaultClipTextBoxState,
    mergeClipTextBoxForRatio,
    parseClipTextOverlayJson,
    serializeClipTextBoxState,
    upsertClipTextPerRatioGeometry,
  } from '@/utils/clipTextBox';
  import type { SocialOverlayPreset } from '@/editor/types/social-overlays';
  import { useAiBroll } from '@/composables/useAiBroll';
  import type { ManualBrollMediaType } from '@/composables/useAiBroll';
  import type { AiBrollPlannerOptions } from '@/types/ai-broll';

  // Animation styles shown in the subtitle section (matches SubtitlePropertiesPanel)
  const ANIMATION_STYLES = [
    { id: 'karaoke', name: 'Karaoke', desc: 'Word-by-word color highlight' },
    { id: 'zoom', name: 'Zoom', desc: 'Current word scales up' },
    { id: 'pop', name: 'Pop', desc: 'Bouncy emphasis effect' },
    { id: 'glow', name: 'Glow', desc: 'Glowing word highlight' },
    { id: 'wave', name: 'Wave', desc: 'Floating wave motion' },
    { id: 'single-word', name: 'Single Word', desc: 'One word at a time' },
    { id: 'none', name: 'None', desc: 'Static text, no animation' },
  ];

  // Preset colors for karaoke highlight
  const PRESET_COLORS = [
    { name: 'Cyan', value: '#22D3EE' },
    { name: 'Purple', value: '#A855F7' },
    { name: 'Pink', value: '#EC4899' },
    { name: 'Green', value: '#10B981' },
    { name: 'Yellow', value: '#FBBF24' },
    { name: 'Orange', value: '#F97316' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Blue', value: '#3B82F6' },
  ];

  interface WatermarkPreview {
    filePath: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
  }

  interface OverlayPreviewData {
    id: string;
    dataUrl: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    isFullFrame: boolean;
    label?: string;
  }

  interface WordInfo {
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }

  interface WhisperSegment {
    text: string;
    start: number;
    end: number;
    words?: WordInfo[];
  }

  interface Props {
    modelValue: boolean;
    initialConfig?: ManualFramingConfig | null;
    targetAspectRatio: string;
    sourceAspectRatio?: string;
    thumbnailUrl?: string | null;
    videoPath?: string | null;
    clipStartTime?: number;
    clipEndTime?: number;
    // Optional full video duration (for VOD pre-edit use case)
    fullVideoDuration?: number;
    // Optional watermark preview for the target aspect ratio
    watermarkSettings?: WatermarkSettings | null;
    // Optional layout overlays to display in target preview
    layoutOverlays?: LayoutOverlay[];
    // Pre-resolved overlay preview data URLs (keyed by overlay id)
    overlayPreviewUrls?: Record<string, string>;
    // Optional subtitle settings for preview
    subtitleSettings?: SubtitleSettings | null;
    // Optional subtitle position override for this aspect ratio
    subtitlePositionOverride?: { x: number; y: number; width?: number } | null;
    // Optional transcript data for subtitle rendering
    transcriptWords?: WordInfo[];
    transcriptSegments?: WhisperSegment[];
    clipId?: string | null;
    projectId?: string | null;
    /** Raw JSON from clips.clip_text_overlay */
    clipTextOverlayJson?: string | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    sourceAspectRatio: '16:9',
    clipStartTime: 0,
    clipEndTime: 0,
    fullVideoDuration: 0,
    watermarkSettings: null,
    subtitleSettings: null,
    subtitlePositionOverride: null,
    transcriptWords: () => [],
    transcriptSegments: () => [],
    clipId: null,
    projectId: null,
    clipTextOverlayJson: null,
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [config: ManualFramingConfig];
    subtitlePositionChange: [position: { x: number; y: number; width?: number; presetId?: string }];
    subtitleSettingsChange: [settings: SubtitleSettings];
    clipTextOverlayChange: [json: string | null];
  }>();

  // Local state
  const regions = ref<ManualRegion[]>([]);
  const selectedRegionId = ref<string | null>(null);

  /** Preview-only TikTok / Reels / Shorts chrome on the 9:16 output (toggle lives on source panel). */
  const socialOverlayPreset = ref<SocialOverlayPreset | null>(null);

  // Base regions - apply to entire clip when no segment is active
  const baseRegions = ref<ManualRegion[]>([]);

  // Segment management state
  const segmentConfigs = ref<SegmentRegionConfig[]>([]);
  const activeSegmentId = ref<string | null>(null);

  const showAiBrollPanel = ref(false);
  const isManualBrollAdding = ref(false);
  const aiBroll = useAiBroll();

  const clipDuration = computed(() => {
    if (props.clipEndTime !== undefined && props.clipStartTime !== undefined) {
      return Math.max(0, props.clipEndTime - props.clipStartTime);
    }
    return props.fullVideoDuration || 0;
  });

  const canGenerateAiBroll = computed(
    () =>
      Boolean(props.clipId) &&
      (props.transcriptWords.length > 0 || props.transcriptSegments.length > 0),
  );

  const brollOrientation = computed<'portrait' | 'landscape'>(() =>
    props.targetAspectRatio === '16:9' ? 'landscape' : 'portrait',
  );

  // Source frame transform (16:9 scaling in 9:16) + mode / blur (synced from POITargetPanel)
  const sourceTransform = ref<{ scale: number; x: number; y: number } | null>(null);
  const sourceFrameMode = ref<ManualSourceFrameMode>('none');
  const poiBlurEnabled = ref(false);
  const poiBlurAmount = ref(12);

  const canApplyFraming = computed(
    () =>
      regions.value.length > 0 ||
      baseRegions.value.length > 0 ||
      segmentConfigs.value.some((s) => s.regions.length > 0) ||
      sourceFrameMode.value !== 'none' ||
      Boolean(clipTextLocal.value?.enabled),
  );

  const textBoxSettingsMode = ref(false);
  const textBoxRevertJson = ref<string | null>(null);

  // Subtitle settings mode (left panel swapped to SubtitlePropertiesPanel)
  const subtitleSettingsMode = ref(false);
  let subtitleSettingsRevert: SubtitleSettings | null = null;

  function openSubtitleSettings() {
    if (!localSubtitleSettings.value) return;
    subtitleSettingsRevert = JSON.parse(JSON.stringify(localSubtitleSettings.value));
    subtitleSettingsMode.value = true;
  }

  function doneSubtitleSettings() {
    subtitleSettingsMode.value = false;
    subtitleSettingsRevert = null;
  }

  function cancelSubtitleSettings() {
    if (subtitleSettingsRevert) {
      localSubtitleSettings.value = subtitleSettingsRevert;
      emit('subtitleSettingsChange', subtitleSettingsRevert);
    }
    subtitleSettingsMode.value = false;
    subtitleSettingsRevert = null;
  }

  function onSubtitleSettingsPanelUpdate(patch: Record<string, unknown>) {
    if (!localSubtitleSettings.value) return;
    localSubtitleSettings.value = { ...localSubtitleSettings.value, ...(patch as Partial<SubtitleSettings>) };
    emit('subtitleSettingsChange', localSubtitleSettings.value);
  }
  const clipTextLocal = ref<ClipTextBoxState | null>(null);
  const clipTextPositioningEnabled = ref(false);

  const clipTextBoxForTarget = computed(() => {
    if (!clipTextLocal.value?.enabled) return null;
    return mergeClipTextBoxForRatio(clipTextLocal.value, props.targetAspectRatio);
  });

  const clipTextBoxPositioningActive = computed(
    () => Boolean(clipTextLocal.value?.enabled && clipTextPositioningEnabled.value)
  );

  watch(
    () => [props.modelValue, props.clipTextOverlayJson] as const,
    ([open, raw]) => {
      if (!open) {
        textBoxSettingsMode.value = false;
        return;
      }
      clipTextLocal.value = parseClipTextOverlayJson(raw);
      if (clipTextLocal.value?.enabled) {
        clipTextPositioningEnabled.value = true;
      }
    },
    { immediate: true }
  );

  const targetPanelInitialFraming = computed((): ManualSourceFramingPayload | null => {
    if (!props.modelValue || !props.initialConfig) return null;
    const c = props.initialConfig;
    const mode = c.sourceFrameMode ?? 'none';
    const st = c.sourceTransform;
    return {
      mode,
      blurEnabled: c.blurEnabled ?? false,
      blurAmount: c.blurAmount ?? 12,
      scale: st?.scale ?? 1,
      x: st?.x ?? 0,
      y: st?.y ?? 0,
    };
  });

  // Video playback state
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const videoUrl = ref<string | null>(null);
  const videoLoading = ref(false);
  const videoError = ref<string | null>(null);

  // Subtitle positioning state
  const localSubtitlePosition = ref<{ x: number; y: number; width?: number }>(
    props.subtitlePositionOverride ? { ...props.subtitlePositionOverride } : { x: 50, y: 85, width: 80 }
  );
  const subtitlePositioningEnabled = ref(false);
  
  // Local copy of subtitle settings that can be modified
  const localSubtitleSettings = ref<SubtitleSettings>(
    props.subtitleSettings ? { ...props.subtitleSettings } : {
      enabled: true,
      selectedPresetId: 'neon-glow',
      animationStyle: 'glow',
      textColor: '#FFFFFF',
      highlightColor: '#22D3EE',
      multiColorEnabled: false,
    } as SubtitleSettings
  );
  
  const showStyleDropdown = ref(false);
  const showColorDropdown = ref(false);
  const isSeeking = ref(false);
  const progressBarRef = ref<HTMLElement | null>(null);

  // Store seek listeners for cleanup
  let seekMoveListener: ((e: MouseEvent) => void) | null = null;
  let seekUpListener: (() => void) | null = null;

  // Volume state (persisted)
  const POI_VOLUME_KEY = 'manualPoi.volume';
  const POI_MUTED_KEY = 'manualPoi.muted';
  const poiVolume = ref<number>(parseFloat(localStorage.getItem(POI_VOLUME_KEY) ?? '1'));
  const poiMuted = ref<boolean>(localStorage.getItem(POI_MUTED_KEY) === 'true');

  watch([poiVolume, poiMuted], ([vol, muted]) => {
    localStorage.setItem(POI_VOLUME_KEY, String(vol));
    localStorage.setItem(POI_MUTED_KEY, String(muted));
  });

  function togglePoiMute() {
    poiMuted.value = !poiMuted.value;
  }

  function onPoiVolumeChange(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    poiVolume.value = val;
    if (val === 0) poiMuted.value = true;
    else if (poiMuted.value) poiMuted.value = false;
  }

  // HLS.js instance for proper MPEG-TS (.ts) file playback with A/V sync
  let hlsInstance: Hls | null = null;

  function isHlsUrl(url: string | null | undefined): boolean {
    return !!url && url.includes('.m3u8');
  }

  function cleanupHls(): void {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
  }

  function constructVideoUrl(filePath: string, port: number): string {
    const encodedPath = utf8ToBase64(filePath);
    const isTsFile = filePath.toLowerCase().endsWith('.ts');
    if (isTsFile) {
      return `http://localhost:${port}/ts-hls/${encodedPath}/playlist.m3u8`;
    }
    return `http://localhost:${port}/video/${encodedPath}`;
  }

  // Keyboard controls for precision scrubbing
  function handleKeyDown(e: KeyboardEvent) {
    // Only handle if dialog is open and not typing in an input
    if (!props.modelValue) return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    
    // Close dropdown on Escape
    if (e.key === 'Escape' && showStyleDropdown.value) {
      showStyleDropdown.value = false;
      return;
    }
    
    const microStep = 0.01; // 10ms - ultra precise
    const fineStep = 0.1; // 100ms - fine control
    const jumpTime = 1.0; // 1 second for shift+arrow
    
    switch(e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey) {
          // Jump back 1 second
          currentTime.value = Math.max(0, currentTime.value - jumpTime);
        } else if (e.ctrlKey || e.metaKey) {
          // Ultra precise: 10ms steps
          currentTime.value = Math.max(0, currentTime.value - microStep);
        } else {
          // Fine: 100ms steps (0.1 second)
          currentTime.value = Math.max(0, currentTime.value - fineStep);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey) {
          // Jump forward 1 second
          currentTime.value = Math.min(clipDuration.value, currentTime.value + jumpTime);
        } else if (e.ctrlKey || e.metaKey) {
          // Ultra precise: 10ms steps
          currentTime.value = Math.min(clipDuration.value, currentTime.value + microStep);
        } else {
          // Fine: 100ms steps (0.1 second)
          currentTime.value = Math.min(clipDuration.value, currentTime.value + fineStep);
        }
        break;
      case ' ':
        e.preventDefault();
        togglePlayback();
        break;
    }
  }

  // Click outside to close dropdown
  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (showStyleDropdown.value && !target.closest('.relative')) {
      showStyleDropdown.value = false;
    }
    if (showColorDropdown.value && !target.closest('.relative')) {
      showColorDropdown.value = false;
    }
  }

  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleClickOutside);

    // Debug: Log transcript props
    console.log('[ManualPOIEditor] Mounted with transcript data:', {
      transcriptWordsLength: props.transcriptWords?.length,
      transcriptSegmentsLength: props.transcriptSegments?.length,
      firstWord: props.transcriptWords?.[0]
    });
  });

  onUnmounted(() => {
    cleanupHls();
    cleanupSeekListeners();
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('click', handleClickOutside);
  });

  // Format time as MM:SS
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Load video URL using the app's video server
  async function loadVideoUrl() {
    cleanupHls();
    if (!props.videoPath) return;

    videoLoading.value = true;
    videoError.value = null;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const port = await invoke<number>('get_video_server_port');
      const timestamp = Date.now();
      const baseUrl = constructVideoUrl(props.videoPath, port);
      videoUrl.value = baseUrl.includes('?') ? `${baseUrl}&t=${timestamp}` : `${baseUrl}?t=${timestamp}`;
      console.log('[POIEditor] Video URL loaded:', videoUrl.value);
    } catch (error) {
      console.error('[POIEditor] Failed to load video:', error);
      videoError.value = 'Failed to load video preview';
    } finally {
      videoLoading.value = false;
    }
  }

  // Play/Pause toggle
  function togglePlayback() {
    isPlaying.value = !isPlaying.value;
  }

  // Handle time update from video
  function onTimeUpdate(time: number) {
    // Convert absolute time to clip-relative time
    currentTime.value = time - props.clipStartTime;

    // Loop back to start if we've reached the end (while still playing)
    if (currentTime.value >= clipDuration.value && isPlaying.value) {
      currentTime.value = 0;
      // The video will be seeked back to start via the watch on absoluteVideoTime
    }
  }

  // Get absolute video time from clip-relative time
  const absoluteVideoTime = computed(() => {
    return props.clipStartTime + currentTime.value;
  });

  // Resolve watermark settings for the target aspect ratio
  const resolvedWatermark = computed((): WatermarkPreview | null => {
    if (!props.watermarkSettings?.enabled) return null;

    const ratioKey = props.targetAspectRatio as '16:9' | '9:16' | '1:1' | '4:5';
    const perRatioConfig = props.watermarkSettings.perRatioSettings?.[ratioKey];

    // If config is explicitly null, watermark is disabled for this ratio
    if (perRatioConfig === null) return null;

    // Use per-ratio position if available, otherwise default
    const position = perRatioConfig?.position;

    return {
      filePath: '', // Will be loaded by POITargetPanel
      x: position?.x ?? props.watermarkSettings.positionX,
      y: position?.y ?? props.watermarkSettings.positionY,
      scale: position?.scale ?? props.watermarkSettings.scale,
      opacity: position?.opacity ?? props.watermarkSettings.opacity,
    };
  });

  // Resolve overlay data for the target aspect ratio
  const resolvedOverlays = computed((): OverlayPreviewData[] => {
    if (!props.layoutOverlays?.length) {
      console.log('[ManualPOIEditor] resolvedOverlays: no layoutOverlays');
      return [];
    }

    const ratioKey = props.targetAspectRatio as '16:9' | '9:16' | '1:1' | '4:5';
    const urlKeys = props.overlayPreviewUrls ? Object.keys(props.overlayPreviewUrls) : [];
    console.log('[ManualPOIEditor] resolvedOverlays evaluating:', {
      overlayCount: props.layoutOverlays.length,
      overlayIds: props.layoutOverlays.map(o => o.id),
      previewUrlKeys: urlKeys,
      previewUrlLengths: urlKeys.map(k => props.overlayPreviewUrls?.[k]?.length || 0),
      ratioKey,
    });

    return props.layoutOverlays
      .map((overlay) => {
        const dataUrl = props.overlayPreviewUrls?.[overlay.id];
        if (!dataUrl) {
          console.log('[ManualPOIEditor] No dataUrl for overlay:', overlay.id);
          return null;
        }
        console.log('[ManualPOIEditor] Found dataUrl for overlay:', overlay.id, 'length:', dataUrl.length);

        // Check per-ratio settings first
        const perRatio = overlay.perRatioSettings?.[ratioKey];
        const settings = perRatio || overlay;

        return {
          id: overlay.id,
          dataUrl,
          x: settings.x ?? 50,
          y: settings.y ?? 50,
          scale: (perRatio as any)?.scale ?? 100,
          opacity: settings.opacity ?? 100,
          isFullFrame: (settings as any).isFullFrameOverlay ?? false,
          label: overlay.label,
        } as OverlayPreviewData;
      })
      .filter((o): o is OverlayPreviewData => o !== null);
  });

  // Clean up any existing seek listeners
  function cleanupSeekListeners() {
    if (seekMoveListener) {
      window.removeEventListener('mousemove', seekMoveListener);
      seekMoveListener = null;
    }
    if (seekUpListener) {
      window.removeEventListener('mouseup', seekUpListener);
      seekUpListener = null;
    }
  }

  // Handle seek drag start
  function onSeekStart(event: MouseEvent) {
    if (!progressBarRef.value) return;
    event.preventDefault();
    
    // Clean up any existing listeners first
    cleanupSeekListeners();
    
    const wasPlaying = isPlaying.value;
    isPlaying.value = false; // Pause during seek
    isSeeking.value = true;
    
    // Store initial mouse position and time for precision mode
    const startX = event.clientX;
    const startTime = currentTime.value;

    seekMoveListener = (e: MouseEvent) => {
      if (!progressBarRef.value) return;
      const rect = progressBarRef.value.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percent = Math.max(0, Math.min(1, x / rect.width));
      
      if (e.shiftKey) {
        // Precision mode: quantize to 0.01 second increments
        const rawTime = percent * clipDuration.value;
        const quantized = Math.round(rawTime / 0.01) * 0.01;
        currentTime.value = Math.max(0, Math.min(clipDuration.value, quantized));
      } else {
        // Normal mode: direct position mapping
        currentTime.value = percent * clipDuration.value;
      }
    };

    seekUpListener = () => {
      isSeeking.value = false;
      if (wasPlaying) {
        isPlaying.value = true; // Resume if it was playing
      }
      cleanupSeekListeners();
    };

    // Initial seek position
    seekMoveListener(event);

    // Add listeners to window for better drag tracking
    window.addEventListener('mousemove', seekMoveListener);
    window.addEventListener('mouseup', seekUpListener);
  }

  // Initialize from initial config when dialog opens
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        // Load initial configuration
        if (props.initialConfig && props.initialConfig.regions.length > 0) {
          // Deep clone the regions
          regions.value = JSON.parse(JSON.stringify(props.initialConfig.regions));
          
          // Load segment configurations if present
          if (props.initialConfig.segmentConfigs && props.initialConfig.segmentConfigs.length > 0) {
            segmentConfigs.value = JSON.parse(JSON.stringify(props.initialConfig.segmentConfigs));
            // Don't auto-activate first segment - let the watch on currentTime determine active segment
            activeSegmentId.value = null;
            // Save base regions if we have regions but no active segment
            if (regions.value.length > 0) {
              baseRegions.value = JSON.parse(JSON.stringify(regions.value));
            }
          } else {
            segmentConfigs.value = [];
            activeSegmentId.value = null;
          }
        } else {
          regions.value = [];
          segmentConfigs.value = [];
          activeSegmentId.value = null;
        }

        if (props.initialConfig) {
          sourceFrameMode.value = props.initialConfig.sourceFrameMode ?? 'none';
          poiBlurEnabled.value = props.initialConfig.blurEnabled ?? false;
          poiBlurAmount.value = props.initialConfig.blurAmount ?? 12;
          if (props.initialConfig.sourceTransform) {
            sourceTransform.value = { ...props.initialConfig.sourceTransform };
          } else if (sourceFrameMode.value !== 'none') {
            sourceTransform.value = { scale: 1, x: 0, y: 0 };
          } else {
            sourceTransform.value = null;
          }
        } else {
          sourceFrameMode.value = 'none';
          poiBlurEnabled.value = false;
          poiBlurAmount.value = 12;
          sourceTransform.value = null;
        }

        selectedRegionId.value = regions.value.length > 0 ? regions.value[0].id : null;

        // Reset playback state
        isPlaying.value = false;
        currentTime.value = 0;

        // Auto-enable subtitle positioning if clip has subtitles
        if (props.subtitleSettings && props.subtitleSettings.enabled) {
          subtitlePositioningEnabled.value = true;
          console.log('[ManualPOIEditor] Auto-enabled subtitle positioning');
        }

        console.log('[ManualPOIEditor] Dialog opened:', {
          clipStartTime: props.clipStartTime,
          clipEndTime: props.clipEndTime,
          clipDuration: clipDuration.value,
          absoluteVideoTime: absoluteVideoTime.value,
          videoPath: props.videoPath,
          hasSubtitleSettings: !!props.subtitleSettings,
          transcriptWordsCount: props.transcriptWords?.length || 0,
          transcriptSegmentsCount: props.transcriptSegments?.length || 0,
          firstWord: props.transcriptWords?.[0],
          firstSegment: props.transcriptSegments?.[0]
        });

        // Load video URL
        await loadVideoUrl();
      } else {
        // Cleanup when closing
        isPlaying.value = false;
        videoUrl.value = null;
        // Reset subtitle positioning state
        subtitlePositioningEnabled.value = false;
        sourceFrameMode.value = 'none';
        poiBlurEnabled.value = false;
        poiBlurAmount.value = 12;
        sourceTransform.value = null;
        socialOverlayPreset.value = null;
      }
    },
    { immediate: true }
  );

  watch(
    () => props.targetAspectRatio,
    (r) => {
      if (r !== '9:16') socialOverlayPreset.value = null;
    }
  );

  // Add a new region
  function addRegion(region: ManualRegion) {
    regions.value.push(region);
  }

  // Update a region
  function updateRegion(id: string, update: Partial<ManualRegion>) {
    const index = regions.value.findIndex((r) => r.id === id);
    if (index !== -1) {
      regions.value[index] = { ...regions.value[index], ...update };
    }
  }

  // Delete a region
  function deleteRegion(id: string) {
    const index = regions.value.findIndex((r) => r.id === id);
    if (index !== -1) {
      regions.value.splice(index, 1);
    }
    if (selectedRegionId.value === id) {
      selectedRegionId.value = regions.value.length > 0 ? regions.value[0].id : null;
    }
  }

  // Select a region
  function selectRegion(id: string | null) {
    selectedRegionId.value = id;
  }

  // Handle source framing updates from POITargetPanel (scale / use16x9 / blur / transform)
  function handleSourceTransformUpdate(payload: ManualSourceFramingPayload) {
    sourceFrameMode.value = payload.mode;
    poiBlurEnabled.value = payload.blurEnabled;
    poiBlurAmount.value = payload.blurAmount;
    if (payload.mode === 'none') {
      sourceTransform.value = null;
    } else {
      sourceTransform.value = {
        scale: payload.scale,
        x: payload.x,
        y: payload.y,
      };
    }
  }

  // Handle media upload for a region
  async function handleMediaUpload(regionId: string) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';

    input.onchange = async (e: Event) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      try {
        const buf = new Uint8Array(await file.arrayBuffer());
        const { invoke } = await import('@tauri-apps/api/core');
        const tempPath = await invoke<string>('save_temp_media_file', {
          fileName: file.name,
          data: Array.from(buf),
        });
        const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
        updateRegion(regionId, {
          mediaAssetId: tempPath,
          mediaType: mediaType as 'image' | 'video',
        });
        console.log('[ManualPOIEditor] Media saved for region:', regionId, tempPath);
      } catch (error) {
        console.error('[ManualPOIEditor] Failed to save media:', error);
      }
    };

    input.click();
  }

  function openAiBrollPanel() {
    showAiBrollPanel.value = !showAiBrollPanel.value;
    if (showAiBrollPanel.value && props.clipId) {
      void aiBroll.loadSuggestions(props.clipId);
    }
  }

  async function onAiBrollGenerate(options: AiBrollPlannerOptions) {
    if (!props.clipId) return;
    // Transcript props are already clip-relative (0..duration), same as subtitles in POITargetPanel.
    await aiBroll.generateSuggestions({
      clipId: props.clipId,
      clipStart: 0,
      clipEnd: clipDuration.value,
      aspectRatio: props.targetAspectRatio,
      transcriptWords: props.transcriptWords,
      transcriptSegments: props.transcriptSegments,
      plannerOptions: options,
    });
    await aiBroll.fetchAllCandidates(brollOrientation.value);
  }

  async function onAiBrollFetchAll() {
    await aiBroll.fetchAllCandidates(brollOrientation.value);
  }

  async function onAiBrollApply(suggestionId: string) {
    if (!props.projectId) return;
    const suggestion = aiBroll.suggestions.value.find((s) => s.id === suggestionId);
    if (!suggestion) return;
    try {
      const result = await aiBroll.applySuggestionToConfig(
        suggestion,
        segmentConfigs.value,
        props.projectId,
        segmentConfigs.value.length,
      );
      segmentConfigs.value = result.segmentConfigs;
      const appliedSeg = segmentConfigs.value.find((seg) => seg.startTime === suggestion.startTime);
      activeSegmentId.value = appliedSeg?.segmentId ?? activeSegmentId.value;
      if (appliedSeg) {
        regions.value = JSON.parse(JSON.stringify(appliedSeg.regions));
      }
    } catch (e) {
      console.error('[ManualPOIEditor] Failed to apply B-roll:', e);
    }
  }

  async function onAiBrollApplyAll() {
    for (const s of aiBroll.suggestions.value.filter((x) => x.status === 'ready')) {
      await onAiBrollApply(s.id);
    }
  }

  async function onAiBrollRegenerate(suggestionId: string) {
    const suggestion = aiBroll.suggestions.value.find((s) => s.id === suggestionId);
    if (!suggestion) return;
    await aiBroll.regenerateSuggestion(suggestion, brollOrientation.value);
  }

  async function onAiBrollReject(suggestionId: string) {
    const suggestion = aiBroll.suggestions.value.find((s) => s.id === suggestionId);
    if (!suggestion) return;
    await aiBroll.rejectSuggestion(suggestion);
  }

  function onAiBrollSelectCandidate(suggestionId: string, candidateId: string) {
    const idx = aiBroll.suggestions.value.findIndex((s) => s.id === suggestionId);
    if (idx < 0) return;
    aiBroll.suggestions.value[idx] = {
      ...aiBroll.suggestions.value[idx],
      selectedCandidateId: candidateId,
    };
  }

  async function onManualBrollSearch(query: string, mediaType: ManualBrollMediaType) {
    aiBroll.manualSearchMediaType.value = mediaType;
    await aiBroll.searchManualStock(query, brollOrientation.value, mediaType);
  }

  function onManualBrollSelectCandidate(candidateId: string) {
    aiBroll.selectManualCandidate(candidateId);
  }

  async function onManualBrollAdd(payload: { candidateId: string; duration: number; startTime: number }) {
    if (!props.projectId || !props.clipId) return;
    const candidate = aiBroll.manualSearchResults.value.find((c) => c.id === payload.candidateId);
    if (!candidate) return;

    isManualBrollAdding.value = true;
    try {
      const maxDuration = Math.max(0.5, clipDuration.value - payload.startTime);
      const duration = Math.min(payload.duration, maxDuration);
      const result = await aiBroll.applyManualCandidateToConfig(candidate, {
        clipId: props.clipId,
        projectId: props.projectId,
        startTime: payload.startTime,
        duration,
        segmentConfigs: segmentConfigs.value,
        regionIndex: segmentConfigs.value.length,
      });
      segmentConfigs.value = result.segmentConfigs;
      const appliedSeg = segmentConfigs.value.find((seg) => seg.startTime === payload.startTime);
      activeSegmentId.value = appliedSeg?.segmentId ?? activeSegmentId.value;
      if (appliedSeg) {
        regions.value = JSON.parse(JSON.stringify(appliedSeg.regions));
      }
    } catch (e) {
      console.error('[ManualPOIEditor] Failed to add manual B-roll:', e);
    } finally {
      isManualBrollAdding.value = false;
    }
  }

  // Handle subtitle position changes (from dragging in POITargetPanel)
  function onSubtitlePositionChange(position: { x: number; y: number; width?: number }) {
    localSubtitlePosition.value = { ...position };
    emit('subtitlePositionChange', { ...position });
  }

  // Handle subtitle settings change (e.g., font size from resize)
  function onSubtitleSettingsChange(settings: SubtitleSettings) {
    console.log('[ManualPOIEditor] onSubtitleSettingsChange called:', {
      newFontSize: settings.fontSize,
      oldFontSize: localSubtitleSettings.value.fontSize
    });
    localSubtitleSettings.value = { ...settings };
    emit('subtitleSettingsChange', { ...settings });
  }

  async function persistClipTextToDb() {
    if (!props.clipId || !clipTextLocal.value) return;
    const { updateClipTextOverlay } = await import('@/services/database/clips');
    await updateClipTextOverlay(props.clipId, clipTextLocal.value);
    emit('clipTextOverlayChange', serializeClipTextBoxState(clipTextLocal.value));
  }

  async function persistClipTextClearDb() {
    if (!props.clipId) return;
    const { updateClipTextOverlay } = await import('@/services/database/clips');
    await updateClipTextOverlay(props.clipId, null);
    emit('clipTextOverlayChange', null);
  }

  async function onClipTextPanelDelete() {
    clipTextLocal.value = null;
    await persistClipTextClearDb();
  }

  function onClipTextPanelPatch(patch: Partial<ClipTextBoxState>) {
    if (!clipTextLocal.value) return;
    const cur = clipTextLocal.value;
    const mergedStyle = patch.style
      ? ({ ...cur.style, ...patch.style } as import('@/types').TextOverlayStyle)
      : cur.style;
    clipTextLocal.value = { ...cur, ...patch, style: mergedStyle };
    void persistClipTextToDb();
  }

  function onClipTextBoxPositionChange(payload: {
    x: number;
    y: number;
    widthPct: number;
    fontSize?: number;
  }) {
    if (!clipTextLocal.value) return;
    clipTextLocal.value = upsertClipTextPerRatioGeometry(
      clipTextLocal.value,
      props.targetAspectRatio,
      payload
    );
    void persistClipTextToDb();
  }

  async function openTextBoxSettings() {
    textBoxRevertJson.value =
      clipTextLocal.value == null ? null : serializeClipTextBoxState(clipTextLocal.value);
    if (!clipTextLocal.value) {
      clipTextLocal.value = createDefaultClipTextBoxState(clipDuration.value);
    }
    textBoxSettingsMode.value = true;
    clipTextPositioningEnabled.value = true;
    await persistClipTextToDb();
  }

  function doneTextBoxSettings() {
    textBoxSettingsMode.value = false;
  }

  async function cancelTextBoxSettings() {
    const revert = textBoxRevertJson.value;
    if (revert == null) {
      clipTextLocal.value = null;
      await persistClipTextClearDb();
    } else {
      clipTextLocal.value = parseClipTextOverlayJson(revert);
      if (clipTextLocal.value) await persistClipTextToDb();
    }
    textBoxSettingsMode.value = false;
  }

  // Get default settings for a specific animation style
  function getStyleDefaults(styleId: string): Partial<SubtitleSettings> {
    const defaults: Record<string, Partial<SubtitleSettings>> = {
      'single-word': {
        // CapCut-style defaults for single-word
        fontFamily: 'Montserrat',
        fontSize: 80,
        fontWeight: 900,
        textColor: '#FFFFFF',
        border1Width: 8,
        border1Color: '#000000',
        border2Width: 0,
        border2Color: '#000000',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
        shadowColor: '#000000',
        backgroundEnabled: false,
        backgroundColor: 'transparent',
        multiColorEnabled: false,
        highlightColor: '#FFFFFF',
      },
      'karaoke': {
        fontFamily: 'Montserrat',
        fontSize: 48,
        fontWeight: 700,
        textColor: '#FFFFFF',
        border1Width: 3,
        border1Color: '#000000',
        border2Width: 0,
        border2Color: '#000000',
        shadowBlur: 0,
        highlightColor: '#FACC15',
        backgroundEnabled: false,
        backgroundColor: 'transparent',
      },
      'zoom': {
        fontFamily: 'Montserrat',
        fontSize: 48,
        fontWeight: 700,
        textColor: '#FFFFFF',
        border1Width: 3,
        border1Color: '#000000',
        border2Width: 0,
        shadowBlur: 0,
        highlightColor: '#22D3EE',
        backgroundEnabled: false,
      },
      'pop': {
        fontFamily: 'Montserrat',
        fontSize: 48,
        fontWeight: 700,
        textColor: '#FFFFFF',
        border1Width: 3,
        border1Color: '#000000',
        border2Width: 0,
        shadowBlur: 0,
        highlightColor: '#EC4899',
        backgroundEnabled: false,
      },
      'glow': {
        fontFamily: 'Montserrat',
        fontSize: 44,
        fontWeight: 700,
        textColor: '#FFFFFF',
        border1Width: 0,
        border1Color: '#000000',
        border2Width: 0,
        shadowBlur: 15,
        shadowColor: '#22D3EE',
        highlightColor: '#22D3EE',
        backgroundEnabled: false,
      },
      'wave': {
        fontFamily: 'Montserrat',
        fontSize: 42,
        fontWeight: 600,
        textColor: '#FFFFFF',
        border1Width: 2,
        border1Color: '#000000',
        border2Width: 0,
        shadowBlur: 4,
        shadowColor: 'rgba(0,0,0,0.8)',
        backgroundEnabled: false,
      },
      'none': {
        fontFamily: 'Montserrat',
        fontSize: 42,
        fontWeight: 600,
        textColor: '#FFFFFF',
        border1Width: 0,
        border1Color: '#000000',
        border2Width: 0,
        shadowBlur: 4,
        shadowColor: 'rgba(0,0,0,0.8)',
        backgroundEnabled: false,
      },
    };
    
    return defaults[styleId] || {};
  }

  // Handle animation style change
  function onStyleChange(styleId: string) {
    console.log('[ManualPOIEditor] Style changed:', {
      oldStyle: localSubtitleSettings.value.animationStyle,
      newStyle: styleId,
      border1Width: localSubtitleSettings.value.border1Width,
      border2Width: localSubtitleSettings.value.border2Width,
      fontSize: localSubtitleSettings.value.fontSize,
      highlightColor: localSubtitleSettings.value.highlightColor
    });
    
    // Apply style-specific defaults when switching styles
    const styleDefaults = getStyleDefaults(styleId);
    localSubtitleSettings.value = {
      ...localSubtitleSettings.value,
      ...styleDefaults,
      animationStyle: styleId as any,
    };
    
    showStyleDropdown.value = false;
    console.log('[ManualPOIEditor] After style change with defaults, full settings:', {
      ...localSubtitleSettings.value
    });
    emit('subtitleSettingsChange', { ...localSubtitleSettings.value });
  }

  // Get current style display name
  function getCurrentStyleName(): string {
    const style = ANIMATION_STYLES.find(s => s.id === localSubtitleSettings.value.animationStyle);
    return style ? style.name : 'None';
  }

  // Handle karaoke highlight color change
  function onHighlightColorChange(colorValue: string) {
    localSubtitleSettings.value.highlightColor = colorValue;
    showColorDropdown.value = false;
    emit('subtitleSettingsChange', { ...localSubtitleSettings.value });
  }

  // Get color name from value
  function getColorName(colorValue: string): string {
    const color = PRESET_COLORS.find(c => c.value === colorValue);
    return color ? color.name : 'Custom';
  }

  // Handle single-word multi-color toggle
  function onMultiColorToggle(event: Event) {
    const target = event.target as HTMLInputElement;
    localSubtitleSettings.value.multiColorEnabled = target.checked;
    emit('subtitleSettingsChange', { ...localSubtitleSettings.value });
  }

  // Watch for subtitleSettings prop changes to sync local copy
  watch(
    () => props.subtitleSettings,
    (settings) => {
      if (settings) {
        console.log('[ManualPOIEditor] Syncing subtitle settings from props:', {
          animationStyle: settings.animationStyle,
          border1Width: settings.border1Width,
          border1Color: settings.border1Color,
          border2Width: settings.border2Width,
          border2Color: settings.border2Color,
          highlightColor: settings.highlightColor,
          fontSize: settings.fontSize
        });
        localSubtitleSettings.value = { ...settings };
      }
    },
    { immediate: true, deep: true }
  );

  // Sync subtitle position when prop changes (dialog reopened for a different ratio)
  watch(
    () => props.subtitlePositionOverride,
    (pos) => { if (pos) localSubtitlePosition.value = { ...pos }; },
    { deep: true }
  );

  // Add a new segment
  function addSegment() {
    // Create segment at current playhead position (or at end if no playhead)
    const startTime = currentTime.value !== null ? currentTime.value : 
                      (segmentConfigs.value.length > 0 ? segmentConfigs.value[segmentConfigs.value.length - 1].endTime : 0);
    
    // Default duration: 5 seconds or 1/4 of clip duration, whichever is smaller
    const defaultDuration = Math.min(5, clipDuration.value / 4);
    const endTime = Math.min(startTime + defaultDuration, clipDuration.value);
    
    if (startTime >= clipDuration.value) return;
    
    // If this is the first segment and we're not currently in a segment, save current regions as base
    if (segmentConfigs.value.length === 0 && activeSegmentId.value === null) {
      baseRegions.value = JSON.parse(JSON.stringify(regions.value));
    }
    
    const newSegment: SegmentRegionConfig = {
      segmentId: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime,
      endTime,
      regions: JSON.parse(JSON.stringify(regions.value)), // Copy current regions
    };
    
    segmentConfigs.value.push(newSegment);
    
    // Sort segments by start time
    segmentConfigs.value.sort((a, b) => a.startTime - b.startTime);
    
    activeSegmentId.value = newSegment.segmentId;
  }

  // Delete a segment
  function deleteSegment(segmentId: string) {
    const index = segmentConfigs.value.findIndex(s => s.segmentId === segmentId);
    if (index !== -1) {
      segmentConfigs.value.splice(index, 1);
      if (activeSegmentId.value === segmentId) {
        activeSegmentId.value = segmentConfigs.value[0]?.segmentId || null;
      }
    }
  }

  // Select a segment
  function selectSegment(segmentId: string) {
    const segment = segmentConfigs.value.find(s => s.segmentId === segmentId);
    if (!segment) return;
    
    // Check if current time is actually within this segment's range
    const isWithinSegment = currentTime.value >= segment.startTime && currentTime.value <= segment.endTime;
    
    if (isWithinSegment) {
      // Save current regions before switching
      if (activeSegmentId.value && activeSegmentId.value !== segmentId) {
        // Save current segment's regions
        const currentSegment = segmentConfigs.value.find(s => s.segmentId === activeSegmentId.value);
        if (currentSegment) {
          currentSegment.regions = JSON.parse(JSON.stringify(regions.value));
        }
      } else if (activeSegmentId.value === null) {
        // Save base regions
        baseRegions.value = JSON.parse(JSON.stringify(regions.value));
      }
      
      // Switch to segment and load its regions
      activeSegmentId.value = segmentId;
      regions.value = JSON.parse(JSON.stringify(segment.regions));
    } else {
      // We're outside the segment - don't activate it, just seek to its start time
      // This will trigger the watch on currentTime which will handle the segment switch
      currentTime.value = segment.startTime;
    }
  }

  // Update segment times (from timeline drag/resize)
  function updateSegment(segmentId: string, updates: { startTime?: number; endTime?: number }) {
    const segment = segmentConfigs.value.find(s => s.segmentId === segmentId);
    if (segment) {
      if (updates.startTime !== undefined) {
        segment.startTime = updates.startTime;
      }
      if (updates.endTime !== undefined) {
        segment.endTime = updates.endTime;
      }
    }
  }

  // Handle seek time from timeline playhead drag
  function handleSeekTime(time: number) {
    currentTime.value = time;
    // Video elements in POISourcePanel and POITargetPanel will sync via their watch on videoTime prop
  }

  // Watch for time changes and auto-switch segments (works during playback AND manual scrubbing)
  watch(currentTime, (time) => {
    if (segmentConfigs.value.length === 0) {
      // No segments - ensure we're using base regions
      if (activeSegmentId.value !== null) {
        activeSegmentId.value = null;
        if (baseRegions.value.length > 0) {
          regions.value = JSON.parse(JSON.stringify(baseRegions.value));
        }
      }
      return;
    }
    
    // Find which segment the current time falls into
    const activeSegment = segmentConfigs.value.find(
      seg => time >= seg.startTime && time <= seg.endTime
    );
    
    if (activeSegment) {
      // We're inside a segment
      if (activeSegment.segmentId !== activeSegmentId.value) {
        // Save current regions before switching
        if (activeSegmentId.value) {
          const currentSegment = segmentConfigs.value.find(s => s.segmentId === activeSegmentId.value);
          if (currentSegment) {
            currentSegment.regions = JSON.parse(JSON.stringify(regions.value));
          }
        } else {
          // We were in base regions, save them
          baseRegions.value = JSON.parse(JSON.stringify(regions.value));
        }
        
        // Switch to the segment
        activeSegmentId.value = activeSegment.segmentId;
        regions.value = JSON.parse(JSON.stringify(activeSegment.regions));
      }
    } else {
      // We're outside all segments - use base regions
      if (activeSegmentId.value !== null) {
        // Save current segment's regions
        const currentSegment = segmentConfigs.value.find(s => s.segmentId === activeSegmentId.value);
        if (currentSegment) {
          currentSegment.regions = JSON.parse(JSON.stringify(regions.value));
        }
        
        // Switch to base regions
        activeSegmentId.value = null;
        if (baseRegions.value.length > 0) {
          regions.value = JSON.parse(JSON.stringify(baseRegions.value));
        }
      }
    }
  }, { immediate: true });

  // Reset all regions
  function resetRegions() {
    regions.value = [];
    selectedRegionId.value = null;
  }

  // Close the dialog
  function close() {
    textBoxSettingsMode.value = false;
    subtitleSettingsMode.value = false;
    emit('update:modelValue', false);
  }

  // Confirm and emit the configuration
  function confirmConfig() {
    if (!canApplyFraming.value) return;

    // Save current regions
    if (activeSegmentId.value) {
      // Save current segment's regions
      const activeSegment = segmentConfigs.value.find(s => s.segmentId === activeSegmentId.value);
      if (activeSegment) {
        activeSegment.regions = JSON.parse(JSON.stringify(regions.value));
      }
    } else {
      // Save base regions
      baseRegions.value = JSON.parse(JSON.stringify(regions.value));
    }

    // Use base regions as the default regions in config
    // Segments will override these for their specific time ranges
    const finalRegions = baseRegions.value.length > 0 ? baseRegions.value : regions.value;

    const config: ManualFramingConfig = {
      mode: 'manual',
      regions: JSON.parse(JSON.stringify(finalRegions)),
      targetAspectRatio: props.targetAspectRatio,
      sourceAspectRatio: props.sourceAspectRatio,
      segmentConfigs: segmentConfigs.value.length > 0 ? JSON.parse(JSON.stringify(segmentConfigs.value)) : undefined,
      sourceTransform: sourceTransform.value ? JSON.parse(JSON.stringify(sourceTransform.value)) : undefined,
      sourceFrameMode: sourceFrameMode.value !== 'none' ? sourceFrameMode.value : undefined,
      blurEnabled: sourceFrameMode.value !== 'none' ? poiBlurEnabled.value : undefined,
      blurAmount: sourceFrameMode.value !== 'none' ? poiBlurAmount.value : undefined,
    };

    console.log('[ManualPOIEditor] confirmAndClose - final config:', {
      sourceFrameMode: config.sourceFrameMode,
      blurEnabled: config.blurEnabled,
      blurAmount: config.blurAmount,
      sourceTransform: config.sourceTransform,
      regions: config.regions.length,
    });

    emit('confirm', config);
    close();
  }
</script>

<style scoped>
  /* ===== Overlay ===== */
  .poi-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  }

  /* ===== Dialog Container ===== */
  .poi-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    /* Sized to the actual preview content (source ~400px + arrow ~32px + target ~240px) */
    max-width: 64rem;
    margin: 1rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .poi-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .poi-dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .poi-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .poi-dialog__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .poi-dialog__subtitle {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .poi-dialog__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .poi-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  /* ===== Sub-header (Subtitles / Text box modes) ===== */
  .poi-dialog__sub-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
    flex-shrink: 0;
  }

  .poi-dialog__sub-title {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  /* ===== Dividers ===== */
  .poi-dialog__divider-r {
    border-right: 1px solid var(--sidebar-border);
  }

  .poi-dialog__divider-t {
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Rail (between source / target) ===== */
  .poi-dialog__rail {
    background-color: var(--sidebar-hover);
  }

  /* ===== Text helpers ===== */
  .poi-dialog__muted {
    color: var(--sidebar-text-muted);
  }

  .poi-dialog__faint {
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  .poi-dialog__warning {
    color: #fbbf24;
  }

  /* ===== Feature grid (Subtitles + Clip text box, 2-column) ===== */
  .poi-dialog__feature-grid {
    display: flex;
    background-color: var(--sidebar-hover);
  }

  .poi-dialog__feature-cell {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.5rem 0.875rem;
  }

  .poi-dialog__feature-cell + .poi-dialog__feature-cell {
    border-left: 1px solid var(--sidebar-border);
  }

  .poi-dialog__feature-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .poi-dialog__icon-purple {
    color: #c084fc;
  }

  .poi-dialog__icon-cyan {
    color: var(--sidebar-accent);
  }

  .poi-dialog__icon-amber {
    color: #fbbf24;
  }

  /* ===== Checkboxes ===== */
  .poi-dialog__checkbox {
    width: 1rem;
    height: 1rem;
    border-radius: 0.25rem;
    border: 1px solid rgba(255, 255, 255, 0.35);
    background-color: rgba(255, 255, 255, 0.08);
    color: white;
    cursor: pointer;
    box-shadow: none;
    transition: background-color 150ms ease, border-color 150ms ease, box-shadow 150ms ease;
  }

  .poi-dialog__checkbox:hover {
    border-color: rgba(255, 255, 255, 0.55);
    background-color: rgba(255, 255, 255, 0.12);
  }

  .poi-dialog__checkbox:focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.35);
  }

  .poi-dialog__checkbox--purple[data-state='checked'] {
    background-color: #a855f7;
    border-color: #c084fc;
  }

  /* ===== Playback bar ===== */
  .poi-dialog__playback {
    padding: 0.375rem 1rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
  }

  .poi-dialog__play-btn {
    width: 32px;
    height: 32px;
    border-radius: 9999px;
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 4px 12px rgba(6, 182, 212, 0.25);
  }

  .poi-dialog__play-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .poi-dialog__play-btn:disabled {
    cursor: not-allowed;
  }

  .poi-dialog__progress-track {
    height: 4px;
    background-color: var(--sidebar-border);
    border-radius: 9999px;
    overflow: hidden;
  }

  .poi-dialog__progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--sidebar-accent), #0891b2);
  }

  .poi-dialog__progress-handle {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 12px;
    height: 12px;
    background-color: white;
    border-radius: 9999px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    transition: opacity 150ms ease;
    pointer-events: none;
  }

  .poi-dialog__icon-btn {
    padding: 0.375rem;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .poi-dialog__icon-btn:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .poi-dialog__volume-slider {
    width: 4rem;
    height: 4px;
    accent-color: var(--sidebar-accent);
    cursor: pointer;
  }

  /* ===== Footer ===== */
  .poi-dialog__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-top: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
  }

  /* ===== Buttons ===== */
  .poi-dialog__btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 0.875rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
    line-height: 1;
  }

  .poi-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .poi-dialog__btn--sm {
    padding: 0.3125rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 6px;
  }

  .poi-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border-color: var(--sidebar-border);
  }

  .poi-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .poi-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
    border-color: transparent;
  }

  .poi-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .poi-dialog__btn--primary:disabled {
    background: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
  }

  .poi-dialog__btn--purple {
    background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%);
    color: white;
    border-color: transparent;
  }

  .poi-dialog__btn--purple:hover:not(:disabled) {
    opacity: 0.9;
  }

  .poi-dialog__btn--amber {
    background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
    color: white;
    border-color: transparent;
  }

  .poi-dialog__btn--amber:hover:not(:disabled) {
    opacity: 0.9;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
