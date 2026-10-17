<template>
  <Modal
    :open="modelValue"
    title="Manual framing editor"
    :description="`Define crop regions on the source and arrange them in the ${targetAspectRatio} output`"
    :icon="LayoutDashboardIcon"
    size="2xl"
    flush
    :dismissible="false"
    body-class="flex flex-col"
    @close="close"
  >
    <!-- Main Content - Side by Side Panels -->
    <div class="mt-3 flex min-h-[280px] flex-1 overflow-hidden border-t border-line-subtle">
      <!-- Source Panel (Left) — swapped for text box settings when editing -->
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- Subtitle Settings Mode -->
        <template v-if="subtitleSettingsMode && localSubtitleSettings">
          <POIPanelHeader title="Subtitles" @cancel="cancelSubtitleSettings" @done="doneSubtitleSettings" />
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
          <POIPanelHeader title="Text box" @cancel="cancelTextBoxSettings" @done="doneTextBoxSettings" />
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
          :regions="displayRegions"
          :selected-region-id="selectedRegionId"
          :thumbnail-url="thumbnailUrl"
          :source-aspect-ratio="sourceAspectRatio"
          :target-aspect-ratio="targetAspectRatio"
          :social-overlay-preset="socialOverlayPreset"
          :next-region-number="nextRegionNumber"
          :show-scaled-16x9-tab="sourceFrameMode === 'scale'"
          :show-subtitles-tab="subtitlePositioningEnabled"
          :show-text-box-tab="Boolean(clipTextLocal?.enabled)"
          :video-url="videoUrl"
          :timeline-preview-canvas="timelinePreviewCanvas"
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

      <POIExportRail />

      <!-- Target Panel (Right) -->
      <div class="flex-1">
        <POITargetPanel
          :regions="displayRegions"
          :selected-region-id="selectedRegionId"
          :thumbnail-url="thumbnailUrl"
          :target-aspect-ratio="targetAspectRatio"
          :source-aspect-ratio="sourceAspectRatio"
          :video-url="videoUrl"
          :timeline-preview-canvas="timelinePreviewCanvas"
          :video-time="absoluteVideoTime"
          :clip-start-time="clipStartTime"
          :is-playing="isPlaying"
          :watermark-preview="resolvedWatermark"
          :overlay-previews="resolvedOverlays"
          :subtitle-settings="localSubtitleSettings"
          :subtitle-position="localSubtitlePosition"
          :subtitle-preview-visible="subtitlePositioningEnabled"
          :subtitle-positioning-enabled="subtitlePositioningActive"
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
    <div v-if="clipDuration > 0" class="shrink-0 border-t border-line-subtle bg-surface px-4 py-1.5">
      <div class="flex items-center gap-2">
        <!-- Play/Pause button -->
        <Button
          variant="secondary"
          size="icon-sm"
          :disabled="!videoUrl"
          :title="isPlaying ? 'Pause (Space)' : 'Play (Space)'"
          :aria-label="isPlaying ? 'Pause' : 'Play'"
          @click="togglePlayback"
        >
          <PlayIcon v-if="!isPlaying" class="fill-current" />
          <PauseIcon v-else class="fill-current" />
        </Button>

        <!-- Time display -->
        <span class="tabular w-24 shrink-0 font-mono text-xs text-fg-muted">
          {{ formatTime(currentTime) }} / {{ formatTime(clipDuration) }}
        </span>

        <!-- Progress bar -->
        <div ref="progressBarRef" class="group relative flex-1 cursor-pointer py-1.5" @mousedown="onSeekStart">
          <div class="h-1 overflow-hidden rounded-full bg-line-strong">
            <div
              class="h-full bg-brand"
              :class="{ 'transition-[width] duration-100': !isSeeking }"
              :style="{ width: `${(currentTime / clipDuration) * 100}%` }"
            />
          </div>
          <!-- Seek handle -->
          <div
            class="pointer-events-none absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-fg shadow-[var(--shadow-sm)] transition-opacity"
            :class="{
              'opacity-100': isSeeking || currentTime === 0,
              'opacity-0 group-hover:opacity-100': !isSeeking && currentTime !== 0,
            }"
            :style="{ left: `calc(${(currentTime / clipDuration) * 100}% - 6px)` }"
          />
        </div>

        <!-- Volume control -->
        <div class="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            :title="poiMuted ? 'Unmute' : 'Mute'"
            :aria-label="poiMuted ? 'Unmute' : 'Mute'"
            @click="togglePoiMute"
          >
            <VolumeXIcon v-if="poiMuted || poiVolume === 0" />
            <Volume2Icon v-else />
          </Button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            :value="poiMuted ? 0 : poiVolume"
            class="w-16"
            aria-label="Volume"
            @input="onPoiVolumeChange"
          />
        </div>

        <!-- Reset button -->
        <Button
          variant="ghost"
          size="icon-sm"
          title="Reset to start"
          aria-label="Reset to start"
          @click="resetPlayback"
        >
          <RotateCcwIcon />
        </Button>
      </div>

      <!-- Loading/Error state -->
      <div v-if="videoLoading" class="mt-1 text-2xs text-fg-subtle">Loading video preview...</div>
      <div v-else-if="videoError" class="mt-1 text-2xs text-warning">
        {{ videoError }}
      </div>
    </div>

    <!-- Segment Timeline -->
    <POISegmentTimeline
      v-if="clipDuration > 0"
      :segments="segmentConfigs"
      :broll-regions="brollConfigs"
      :active-broll-id="activeBrollId"
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
      @select-broll="selectBroll"
      @delete-broll="deleteBroll"
      @update-broll="updateBroll"
      @seek-time="handleSeekTime"
    />

    <!-- Feature controls: Subtitles + Clip text box + AI B-roll -->
    <div
      v-if="localSubtitleSettings || clipId || projectId"
      class="flex shrink-0 divide-x divide-line-subtle border-t border-line-subtle bg-surface"
    >
      <!-- Subtitles cell -->
      <POIFeatureCell v-if="localSubtitleSettings" :icon="CaptionsIcon" label="Subtitles" :ratio="targetAspectRatio">
        <template #control>
          <Checkbox
            :model-value="subtitlePositioningEnabled"
            aria-label="Enable subtitle positioning"
            class="shrink-0"
            @update:model-value="onSubtitlePositioningToggle"
          />
        </template>
        <template v-if="isSubtitleTranscribing">· {{ subtitleTranscribeStatusText }}</template>
        <template v-else-if="!hasTranscript">· Transcript needed</template>
        <template v-else-if="subtitlePositioningEnabled">· Select Subtitles tab to position on export preview</template>
        <template #action>
          <Button
            variant="secondary"
            size="xs"
            class="shrink-0"
            :disabled="isSubtitleTranscribing"
            @click="hasTranscript ? openSubtitleSettings() : requestSubtitleTranscription()"
          >
            {{ subtitleButtonLabel }}
          </Button>
        </template>
      </POIFeatureCell>

      <!-- Clip text box cell -->
      <POIFeatureCell v-if="clipId" :icon="Type" label="Clip text box" :ratio="targetAspectRatio">
        <template v-if="clipTextLocal?.enabled">· Select Text box tab to position on export preview</template>
        <template #action>
          <Button variant="secondary" size="xs" class="shrink-0" @click="openTextBoxSettings">
            {{ clipTextLocal?.enabled ? 'Edit' : 'Add text' }}
          </Button>
        </template>
      </POIFeatureCell>

      <!-- AI B-roll cell -->
      <POIFeatureCell v-if="projectId && clipId" :icon="Sparkles" icon-class="text-ai" label="B-roll">
        <template v-if="aiBroll.appliedCount.value > 0">· {{ aiBroll.appliedCount.value }} applied</template>
        <template #action>
          <Button variant="secondary" size="xs" class="shrink-0" @click="openAiBrollPanel">
            {{ showAiBrollPanel ? 'Hide' : 'Open' }}
          </Button>
        </template>
      </POIFeatureCell>
    </div>

    <template #footer>
      <div class="mr-auto min-w-0 truncate text-xs">
        <span v-if="!canApplyFraming" class="inline-flex items-center gap-1.5 text-warning">
          <AlertCircleIcon class="size-3.5 shrink-0" />
          Add a region, enable Scale 16:9 / Use 16:9, or enable the clip text box
        </span>
        <span v-else-if="sourceFrameMode !== 'none' && displayRegions.length === 0" class="text-fg-subtle">
          {{ sourceFrameMode === 'use16x9' ? 'Use 16:9' : 'Scale 16:9' }} configured
        </span>
        <span v-else class="text-fg-subtle">
          {{ totalRegionCount }} region{{ totalRegionCount !== 1 ? 's' : '' }} configured
        </span>
      </div>
      <Button variant="ghost" :disabled="!canApplyFraming" @click="resetRegions">Reset</Button>
      <Button variant="ghost" @click="close">Cancel</Button>
      <Button variant="primary" :disabled="!canApplyFraming" @click="confirmConfig">
        <CheckIcon />
        Apply configuration
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
  import {
    LayoutDashboardIcon,
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
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import POIPanelHeader from './POIPanelHeader.vue';
  import POIExportRail from './POIExportRail.vue';
  import POIFeatureCell from './POIFeatureCell.vue';
  import type {
    BrollRegionConfig,
    ManualRegion,
    ManualFramingConfig,
    ManualSourceFramingPayload,
    ManualSourceFrameMode,
    WatermarkSettings,
    LayoutOverlay,
    SegmentRegionConfig,
    SubtitleSettings,
  } from '@/types';
  import type { ClipTextBoxState } from '@/utils/clipTextBox';
  import {
    createDefaultClipTextBoxState,
    ensureClipTextPerRatioEntry,
    mergeClipTextBoxForRatio,
    parseClipTextOverlayJson,
    serializeClipTextBoxState,
    upsertClipTextPerRatioGeometry,
  } from '@/utils/clipTextBox';
  import type { SocialOverlayPreset } from '@/editor/types/social-overlays';
  import { useAiBroll } from '@/composables/useAiBroll';
  import { getPoiTimelineEditor, resolvePoiVideoSource, savePoiMedia, resolvePoiMedia } from '@/services/poiRuntime';
  import type { ManualBrollMediaType } from '@/composables/useAiBroll';
  import type { AiBrollPlannerOptions } from '@/types/ai-broll';
  import { ensureGlobalDisplayNumbers, getNextRegionDisplayNumber } from '@/utils/poiRegionNumbering';
  import {
    POI_OVERLAY_SCALED_16X9_ID,
    POI_OVERLAY_SUBTITLES_ID,
    POI_OVERLAY_TEXTBOX_ID,
    isPoiOverlaySelection,
  } from '@/utils/poiOverlaySelection';

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
    /** Live composited editor canvas. When present, playback uses the editor timeline clock/audio. */
    timelinePreviewCanvas?: HTMLCanvasElement | null;
    useTimelinePlayback?: boolean;
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
    isSubtitleTranscribing?: boolean;
    subtitleTranscribeProgress?: number;
    subtitleTranscribeStage?: string;
    subtitleTranscribeMessage?: string;
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
    isSubtitleTranscribing: false,
    subtitleTranscribeProgress: 0,
    subtitleTranscribeStage: '',
    subtitleTranscribeMessage: '',
    clipId: null,
    projectId: null,
    clipTextOverlayJson: null,
    timelinePreviewCanvas: null,
    useTimelinePlayback: false,
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [config: ManualFramingConfig];
    subtitlePositionChange: [position: { x: number; y: number; width?: number; presetId?: string }];
    subtitleSettingsChange: [settings: SubtitleSettings];
    clipTextOverlayChange: [json: string | null];
    requestSubtitleTranscription: [];
  }>();

  const selectedRegionId = ref<string | null>(null);

  /** Preview-only TikTok / Reels / Shorts chrome on the 9:16 output (toggle lives on source panel). */
  const socialOverlayPreset = ref<SocialOverlayPreset | null>(null);

  // Base regions — default framing outside all segments
  const baseRegions = ref<ManualRegion[]>([]);

  // Segment management state
  const segmentConfigs = ref<SegmentRegionConfig[]>([]);
  const brollConfigs = ref<BrollRegionConfig[]>([]);

  function segmentAtTime(time: number): SegmentRegionConfig | undefined {
    return segmentConfigs.value.find((seg) => time >= seg.startTime && time <= seg.endTime);
  }

  function brollsAtTime(time: number): BrollRegionConfig[] {
    return brollConfigs.value.filter((broll) => time >= broll.startTime && time <= broll.endTime);
  }

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
    () => Boolean(props.clipId) && (props.transcriptWords.length > 0 || props.transcriptSegments.length > 0)
  );

  const hasTranscript = computed(() => props.transcriptWords.length > 0 || props.transcriptSegments.length > 0);

  const subtitleTranscribeStatusText = computed(() => {
    if (props.subtitleTranscribeMessage) return props.subtitleTranscribeMessage;
    if (props.subtitleTranscribeStage) return props.subtitleTranscribeStage.replace(/_/g, ' ');
    const progress = Math.round(props.subtitleTranscribeProgress || 0);
    return progress > 0 ? `Generating ${progress}%` : 'Generating';
  });

  const subtitleButtonLabel = computed(() => {
    if (props.isSubtitleTranscribing) return 'Generating...';
    return hasTranscript.value ? 'Edit' : 'Generate subtitles';
  });

  const brollOrientation = computed<'portrait' | 'landscape'>(() =>
    props.targetAspectRatio === '16:9' ? 'landscape' : 'portrait'
  );

  // Source frame transform (16:9 scaling in 9:16) + mode / blur (synced from POITargetPanel)
  const sourceTransform = ref<{ scale: number; x: number; y: number } | null>(null);
  const sourceFrameMode = ref<ManualSourceFrameMode>('none');
  const poiBlurEnabled = ref(false);
  const poiBlurAmount = ref(12);

  const canApplyFraming = computed(
    () =>
      baseRegions.value.length > 0 ||
      segmentConfigs.value.some((s) => s.regions.length > 0) ||
      brollConfigs.value.length > 0 ||
      sourceFrameMode.value !== 'none' ||
      Boolean(clipTextLocal.value?.enabled)
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

  function requestSubtitleTranscription() {
    if (props.isSubtitleTranscribing) return;
    emit('requestSubtitleTranscription');
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

  const clipTextBoxForTarget = computed(() => {
    if (!clipTextLocal.value?.enabled) return null;
    return mergeClipTextBoxForRatio(clipTextLocal.value, props.targetAspectRatio);
  });

  const subtitlePositioningActive = computed(
    () => subtitlePositioningEnabled.value && selectedRegionId.value === POI_OVERLAY_SUBTITLES_ID
  );

  const clipTextBoxPositioningActive = computed(
    () => Boolean(clipTextLocal.value?.enabled) && selectedRegionId.value === POI_OVERLAY_TEXTBOX_ID
  );

  watch(
    () => [props.modelValue, props.clipTextOverlayJson] as const,
    ([open, raw]) => {
      if (!open) {
        textBoxSettingsMode.value = false;
        return;
      }
      clipTextLocal.value = parseClipTextOverlayJson(raw);
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
  let unsubscribeTimelinePlayback: (() => void) | null = null;

  function timelineEditor() {
    return props.useTimelinePlayback ? getPoiTimelineEditor() : null;
  }

  function syncTimelinePlaybackState() {
    const editor = timelineEditor();
    if (!editor) return;
    currentTime.value = editor.playback.getCurrentTime();
    isPlaying.value = editor.playback.getIsPlaying();
    poiVolume.value = editor.playback.getVolume();
    poiMuted.value = editor.playback.isMuted();
  }

  function seekPlayback(time: number) {
    const clamped = Math.max(0, Math.min(clipDuration.value, time));
    const editor = timelineEditor();
    if (editor) {
      editor.playback.seek({ time: clamped });
    } else {
      currentTime.value = clamped;
    }
  }

  function resetPlayback() {
    timelineEditor()?.playback.pause();
    isPlaying.value = false;
    seekPlayback(0);
  }

  /** Regions shown in source/target panels — segment regions while playhead is in a segment, else base. */
  const displayRegions = computed(() => {
    const seg = segmentAtTime(currentTime.value);
    const framingRegions = seg ? seg.regions : baseRegions.value;
    return [...framingRegions, ...brollsAtTime(currentTime.value).map((broll) => broll.region)];
  });

  const activeSegmentId = computed(() => segmentAtTime(currentTime.value)?.segmentId ?? null);
  const activeBrollId = computed(() => {
    if (!selectedRegionId.value) return null;
    return brollConfigs.value.find((broll) => broll.region.id === selectedRegionId.value)?.brollId ?? null;
  });

  const nextRegionNumber = computed(() =>
    getNextRegionDisplayNumber([baseRegions.value, ...segmentConfigs.value.map((s) => s.regions)])
  );

  const totalRegionCount = computed(() => {
    const ids = new Set<string>();
    for (const r of baseRegions.value) ids.add(r.id);
    for (const seg of segmentConfigs.value) {
      for (const r of seg.regions) ids.add(r.id);
    }
    for (const broll of brollConfigs.value) ids.add(broll.region.id);
    return ids.size;
  });

  watch(displayRegions, (regions) => {
    if (!selectedRegionId.value || isPoiOverlaySelection(selectedRegionId.value)) return;
    if (!regions.some((r) => r.id === selectedRegionId.value)) {
      selectedRegionId.value = regions[0]?.id ?? null;
    }
  });
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
    props.subtitleSettings
      ? { ...props.subtitleSettings }
      : ({
          enabled: true,
          selectedPresetId: 'neon-glow',
          animationStyle: 'glow',
          textColor: '#FFFFFF',
          highlightColor: '#22D3EE',
          multiColorEnabled: false,
        } as SubtitleSettings)
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
    const editor = timelineEditor();
    if (editor) {
      editor.playback.toggleMute();
      syncTimelinePlaybackState();
      return;
    }
    poiMuted.value = !poiMuted.value;
  }

  function onPoiVolumeChange(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    const editor = timelineEditor();
    if (editor) {
      editor.playback.setVolume({ volume: val });
      syncTimelinePlaybackState();
      return;
    }
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

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault();
        if (e.shiftKey) {
          // Jump back 1 second
          seekPlayback(currentTime.value - jumpTime);
        } else if (e.ctrlKey || e.metaKey) {
          // Ultra precise: 10ms steps
          seekPlayback(currentTime.value - microStep);
        } else {
          // Fine: 100ms steps (0.1 second)
          seekPlayback(currentTime.value - fineStep);
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (e.shiftKey) {
          // Jump forward 1 second
          seekPlayback(currentTime.value + jumpTime);
        } else if (e.ctrlKey || e.metaKey) {
          // Ultra precise: 10ms steps
          seekPlayback(currentTime.value + microStep);
        } else {
          // Fine: 100ms steps (0.1 second)
          seekPlayback(currentTime.value + fineStep);
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
    const editor = timelineEditor();
    if (editor) {
      unsubscribeTimelinePlayback = editor.playback.subscribe(syncTimelinePlaybackState);
      syncTimelinePlaybackState();
    }

    // Debug: Log transcript props
    console.log('[ManualPOIEditor] Mounted with transcript data:', {
      transcriptWordsLength: props.transcriptWords?.length,
      transcriptSegmentsLength: props.transcriptSegments?.length,
      firstWord: props.transcriptWords?.[0],
    });
  });

  onUnmounted(() => {
    unsubscribeTimelinePlayback?.();
    unsubscribeTimelinePlayback = null;
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
    if (props.timelinePreviewCanvas) {
      videoUrl.value = null;
      return;
    }
    if (!props.videoPath) return;

    videoLoading.value = true;
    videoError.value = null;

    try {
      const timestamp = Date.now();
      const baseUrl = await resolvePoiVideoSource(props.videoPath);
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
    const editor = timelineEditor();
    if (editor) {
      editor.playback.toggle();
      return;
    }
    isPlaying.value = !isPlaying.value;
  }

  // Handle time update from video
  function onTimeUpdate(time: number) {
    // Raw VOD previews report absolute source time; extracted clip previews report 0-based time.
    currentTime.value = props.clipStartTime > 0 && time >= props.clipStartTime ? time - props.clipStartTime : time;

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
      overlayIds: props.layoutOverlays.map((o) => o.id),
      previewUrlKeys: urlKeys,
      previewUrlLengths: urlKeys.map((k) => props.overlayPreviewUrls?.[k]?.length || 0),
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
    const editor = timelineEditor();
    if (editor) editor.playback.pause();
    else isPlaying.value = false; // Pause during seek
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
        seekPlayback(quantized);
      } else {
        // Normal mode: direct position mapping
        seekPlayback(percent * clipDuration.value);
      }
    };

    seekUpListener = () => {
      isSeeking.value = false;
      if (wasPlaying) {
        const editor = timelineEditor();
        if (editor) void editor.playback.play();
        else isPlaying.value = true; // Resume if it was playing
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
        if (props.initialConfig) {
          baseRegions.value = JSON.parse(JSON.stringify(props.initialConfig.regions ?? []));
          segmentConfigs.value =
            props.initialConfig.segmentConfigs && props.initialConfig.segmentConfigs.length > 0
              ? JSON.parse(JSON.stringify(props.initialConfig.segmentConfigs))
              : [];
          brollConfigs.value =
            props.initialConfig.brollConfigs && props.initialConfig.brollConfigs.length > 0
              ? JSON.parse(JSON.stringify(props.initialConfig.brollConfigs))
              : [];
          ensureGlobalDisplayNumbers(baseRegions.value, segmentConfigs.value);
        } else {
          baseRegions.value = [];
          segmentConfigs.value = [];
          brollConfigs.value = [];
        }

        selectedRegionId.value = displayRegions.value[0]?.id ?? null;

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

        // Reset playback state
        resetPlayback();

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
          firstSegment: props.transcriptSegments?.[0],
        });

        // Load video URL
        await loadVideoUrl();
      } else {
        // Cleanup when closing
        timelineEditor()?.playback.pause();
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

  watch(
    () => [props.modelValue, props.videoPath] as const,
    ([isOpen, path]) => {
      if (isOpen && path) {
        void loadVideoUrl();
      }
    }
  );

  function editableRegions(): ManualRegion[] {
    const seg = segmentAtTime(currentTime.value);
    return seg ? seg.regions : baseRegions.value;
  }

  // Add a new region to the active time context (base or current segment)
  function addRegion(region: ManualRegion) {
    if (region.displayNumber == null) {
      region.displayNumber = nextRegionNumber.value;
    }
    if (!region.label) {
      region.label = `Region ${region.displayNumber}`;
    }
    editableRegions().push(region);
  }

  // Update a region
  function updateRegion(id: string, update: Partial<ManualRegion>) {
    const list = editableRegions();
    const index = list.findIndex((r) => r.id === id);
    if (index !== -1) {
      list[index] = { ...list[index], ...update };
      return;
    }

    const broll = brollConfigs.value.find((item) => item.region.id === id);
    if (broll) {
      broll.region = { ...broll.region, ...update };
    }
  }

  // Delete a region
  function deleteRegion(id: string) {
    for (const list of [baseRegions.value, ...segmentConfigs.value.map((s) => s.regions)]) {
      const index = list.findIndex((r) => r.id === id);
      if (index !== -1) {
        list.splice(index, 1);
        if (selectedRegionId.value === id) {
          selectedRegionId.value = displayRegions.value[0]?.id ?? null;
        }
        return;
      }
    }
    const brollIndex = brollConfigs.value.findIndex((broll) => broll.region.id === id);
    if (brollIndex !== -1) {
      brollConfigs.value.splice(brollIndex, 1);
    }
    if (selectedRegionId.value === id) {
      selectedRegionId.value = displayRegions.value[0]?.id ?? null;
    }
  }

  // Select a region
  function selectRegion(id: string | null) {
    selectedRegionId.value = id;
  }

  // Handle source framing updates from POITargetPanel (scale / use16x9 / blur / transform)
  function handleSourceTransformUpdate(payload: ManualSourceFramingPayload) {
    const prevMode = sourceFrameMode.value;
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
    if (payload.mode === 'scale' && prevMode !== 'scale') {
      selectedRegionId.value = POI_OVERLAY_SCALED_16X9_ID;
    } else if (payload.mode !== 'scale' && selectedRegionId.value === POI_OVERLAY_SCALED_16X9_ID) {
      selectedRegionId.value = displayRegions.value[0]?.id ?? null;
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
        const tempPath = await savePoiMedia(file, props.projectId);
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
        brollConfigs.value,
        props.projectId,
        brollConfigs.value.length
      );
      brollConfigs.value = result.brollConfigs;
      const appliedBroll = brollConfigs.value.find((broll) => broll.suggestionId === suggestion.id);
      if (appliedBroll) {
        seekPlayback(appliedBroll.startTime);
        selectedRegionId.value = appliedBroll.region.id;
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
        brollConfigs: brollConfigs.value,
        regionIndex: brollConfigs.value.length,
      });
      brollConfigs.value = result.brollConfigs;
      const appliedBroll = brollConfigs.value.find((broll) => broll.suggestionId === result.suggestion.id);
      if (appliedBroll) {
        seekPlayback(appliedBroll.startTime);
        selectedRegionId.value = appliedBroll.region.id;
      }
    } catch (e) {
      console.error('[ManualPOIEditor] Failed to add manual B-roll:', e);
    } finally {
      isManualBrollAdding.value = false;
    }
  }

  function onSubtitlePositioningToggle(checked: boolean | 'indeterminate') {
    const enabled = checked === true;
    subtitlePositioningEnabled.value = enabled;
    if (enabled) {
      selectedRegionId.value = POI_OVERLAY_SUBTITLES_ID;
    } else if (selectedRegionId.value === POI_OVERLAY_SUBTITLES_ID) {
      selectedRegionId.value = displayRegions.value[0]?.id ?? null;
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
      oldFontSize: localSubtitleSettings.value.fontSize,
    });
    localSubtitleSettings.value = { ...settings };
    emit('subtitleSettingsChange', { ...settings });
  }

  async function persistClipTextToDb() {
    if (!props.clipId || !clipTextLocal.value) return;
    clipTextLocal.value = ensureClipTextPerRatioEntry(clipTextLocal.value, props.targetAspectRatio);
    const { updateClipTextOverlay } = await import('@/services/workspaceRuntime');
    await updateClipTextOverlay(props.clipId, clipTextLocal.value);
    emit('clipTextOverlayChange', serializeClipTextBoxState(clipTextLocal.value));
  }

  async function persistClipTextClearDb() {
    if (!props.clipId) return;
    const { updateClipTextOverlay } = await import('@/services/workspaceRuntime');
    await updateClipTextOverlay(props.clipId, null);
    emit('clipTextOverlayChange', null);
  }

  async function onClipTextPanelDelete() {
    clipTextLocal.value = null;
    if (selectedRegionId.value === POI_OVERLAY_TEXTBOX_ID) {
      selectedRegionId.value = displayRegions.value[0]?.id ?? null;
    }
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

  function onClipTextBoxPositionChange(payload: { x: number; y: number; widthPct: number; fontSize?: number }) {
    if (!clipTextLocal.value) return;
    clipTextLocal.value = upsertClipTextPerRatioGeometry(clipTextLocal.value, props.targetAspectRatio, payload);
    void persistClipTextToDb();
  }

  async function openTextBoxSettings() {
    textBoxRevertJson.value = clipTextLocal.value == null ? null : serializeClipTextBoxState(clipTextLocal.value);
    if (!clipTextLocal.value) {
      clipTextLocal.value = createDefaultClipTextBoxState(clipDuration.value);
    }
    textBoxSettingsMode.value = true;
    await persistClipTextToDb();
    selectedRegionId.value = POI_OVERLAY_TEXTBOX_ID;
  }

  async function doneTextBoxSettings() {
    if (clipTextLocal.value?.enabled) {
      clipTextLocal.value = ensureClipTextPerRatioEntry(clipTextLocal.value, props.targetAspectRatio);
      await persistClipTextToDb();
      selectedRegionId.value = POI_OVERLAY_TEXTBOX_ID;
    }
    textBoxSettingsMode.value = false;
  }

  async function cancelTextBoxSettings() {
    const revert = textBoxRevertJson.value;
    if (revert == null) {
      clipTextLocal.value = null;
      if (selectedRegionId.value === POI_OVERLAY_TEXTBOX_ID) {
        selectedRegionId.value = displayRegions.value[0]?.id ?? null;
      }
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
      karaoke: {
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
      zoom: {
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
      pop: {
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
      glow: {
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
      wave: {
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
      none: {
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
      highlightColor: localSubtitleSettings.value.highlightColor,
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
      ...localSubtitleSettings.value,
    });
    emit('subtitleSettingsChange', { ...localSubtitleSettings.value });
  }

  // Get current style display name
  function getCurrentStyleName(): string {
    const style = ANIMATION_STYLES.find((s) => s.id === localSubtitleSettings.value.animationStyle);
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
    const color = PRESET_COLORS.find((c) => c.value === colorValue);
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
          fontSize: settings.fontSize,
        });
        localSubtitleSettings.value = { ...settings };
        // Enable positioning when subtitles are turned on while the editor is already open
        // (e.g. after Generate Transcript → Edit Subtitles from this dialog).
        if (settings.enabled && props.modelValue) {
          subtitlePositioningEnabled.value = true;
        }
      }
    },
    { immediate: true, deep: true }
  );

  // Sync subtitle position when prop changes (dialog reopened for a different ratio)
  watch(
    () => props.subtitlePositionOverride,
    (pos) => {
      if (pos) localSubtitlePosition.value = { ...pos };
    },
    { deep: true }
  );

  // Add a new segment (starts empty — add regions after seeking into the segment)
  function addSegment() {
    const startTime =
      currentTime.value !== null
        ? currentTime.value
        : segmentConfigs.value.length > 0
          ? segmentConfigs.value[segmentConfigs.value.length - 1].endTime
          : 0;

    const defaultDuration = Math.min(5, clipDuration.value / 4);
    const endTime = Math.min(startTime + defaultDuration, clipDuration.value);

    if (startTime >= clipDuration.value) return;

    const newSegment: SegmentRegionConfig = {
      segmentId: `segment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      startTime,
      endTime,
      regions: [],
    };

    segmentConfigs.value.push(newSegment);
    segmentConfigs.value.sort((a, b) => a.startTime - b.startTime);

    seekPlayback(startTime);
    selectedRegionId.value = null;
  }

  // Delete a segment
  function deleteSegment(segmentId: string) {
    const index = segmentConfigs.value.findIndex((s) => s.segmentId === segmentId);
    if (index !== -1) {
      segmentConfigs.value.splice(index, 1);
      selectedRegionId.value = displayRegions.value[0]?.id ?? null;
    }
  }

  // Select a segment — seek to its start so segment regions become active for editing
  function selectSegment(segmentId: string) {
    const segment = segmentConfigs.value.find((s) => s.segmentId === segmentId);
    if (!segment) return;
    seekPlayback(segment.startTime);
    selectedRegionId.value = segment.regions[0]?.id ?? null;
  }

  // Update segment times (from timeline drag/resize)
  function updateSegment(segmentId: string, updates: { startTime?: number; endTime?: number }) {
    const segment = segmentConfigs.value.find((s) => s.segmentId === segmentId);
    if (segment) {
      if (updates.startTime !== undefined) {
        segment.startTime = updates.startTime;
      }
      if (updates.endTime !== undefined) {
        segment.endTime = updates.endTime;
      }
    }
  }

  function selectBroll(brollId: string) {
    const broll = brollConfigs.value.find((item) => item.brollId === brollId);
    if (!broll) return;
    seekPlayback(broll.startTime);
    selectedRegionId.value = broll.region.id;
  }

  function deleteBroll(brollId: string) {
    const index = brollConfigs.value.findIndex((item) => item.brollId === brollId);
    if (index === -1) return;
    const [removed] = brollConfigs.value.splice(index, 1);
    if (selectedRegionId.value === removed.region.id) {
      selectedRegionId.value = displayRegions.value[0]?.id ?? null;
    }
  }

  function updateBroll(brollId: string, updates: { startTime?: number; endTime?: number }) {
    const broll = brollConfigs.value.find((item) => item.brollId === brollId);
    if (!broll) return;
    if (updates.startTime !== undefined) {
      broll.startTime = updates.startTime;
    }
    if (updates.endTime !== undefined) {
      broll.endTime = updates.endTime;
    }
  }

  // Handle seek time from timeline playhead drag
  function handleSeekTime(time: number) {
    seekPlayback(time);
  }

  // Reset all regions and segments
  function resetRegions() {
    baseRegions.value = [];
    segmentConfigs.value = [];
    brollConfigs.value = [];
    selectedRegionId.value = null;
  }

  // Close the dialog
  function close() {
    textBoxSettingsMode.value = false;
    subtitleSettingsMode.value = false;
    emit('update:modelValue', false);
  }

  // Confirm and emit the configuration
  async function confirmConfig() {
    if (!canApplyFraming.value) return;

    if (clipTextLocal.value?.enabled && props.clipId) {
      clipTextLocal.value = ensureClipTextPerRatioEntry(clipTextLocal.value, props.targetAspectRatio);
      await persistClipTextToDb();
    }

    const config: ManualFramingConfig = {
      mode: 'manual',
      regions: JSON.parse(JSON.stringify(baseRegions.value)),
      targetAspectRatio: props.targetAspectRatio,
      sourceAspectRatio: props.sourceAspectRatio,
      segmentConfigs: segmentConfigs.value.length > 0 ? JSON.parse(JSON.stringify(segmentConfigs.value)) : undefined,
      brollConfigs: brollConfigs.value.length > 0 ? JSON.parse(JSON.stringify(brollConfigs.value)) : undefined,
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
