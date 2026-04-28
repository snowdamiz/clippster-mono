<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[10001]">
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl w-full max-w-5xl mx-4 border border-white/10 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <!-- Top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500 flex-shrink-0" />

            <!-- Header -->
            <div class="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 bg-zinc-900/50">
              <div class="flex items-center gap-2.5">
                <div
                  class="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center border border-blue-500/30"
                >
                  <LayoutDashboardIcon class="h-4 w-4 text-blue-400" />
                </div>
                <div class="flex items-baseline gap-2">
                  <h2 class="text-base font-semibold text-white">Manual Framing Editor</h2>
                  <span class="text-[11px] text-zinc-500">
                    · Define crop regions on the source and arrange them in the {{ targetAspectRatio }} output
                  </span>
                </div>
              </div>
              <button
                @click="close"
                class="p-1.5 hover:bg-zinc-800 rounded-lg transition-colors border border-zinc-800"
                title="Close"
              >
                <XIcon class="h-4 w-4 text-zinc-400 hover:text-white" />
              </button>
            </div>

            <!-- Main Content - Side by Side Panels -->
            <div class="flex-1 overflow-hidden flex flex-col">
              <div class="flex-1 flex overflow-hidden">
                <!-- Source Panel (Left) — swapped for text box settings when editing -->
                <div class="flex-1 border-r border-zinc-800 min-h-0 flex flex-col overflow-hidden">
                  <!-- Subtitle Settings Mode -->
                  <template v-if="subtitleSettingsMode && localSubtitleSettings">
                    <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800 shrink-0 bg-zinc-900/80">
                      <span class="text-sm font-medium text-white">Subtitles</span>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="px-2.5 py-1 text-xs rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                          @click="cancelSubtitleSettings"
                        >Cancel</button>
                        <button
                          type="button"
                          class="px-2.5 py-1 text-xs rounded-lg bg-purple-600 text-white hover:bg-purple-500"
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
                    <div
                      class="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800 shrink-0 bg-zinc-900/80"
                    >
                      <span class="text-sm font-medium text-white">Text box</span>
                      <div class="flex items-center gap-2">
                        <button
                          type="button"
                          class="px-2.5 py-1 text-xs rounded-lg border border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                          @click="cancelTextBoxSettings"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          class="px-2.5 py-1 text-xs rounded-lg bg-amber-600 text-white hover:bg-amber-500"
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
                <div class="flex items-center justify-center w-12 bg-zinc-900/50">
                  <div class="flex flex-col items-center gap-2">
                    <ArrowRightIcon class="w-5 h-5 text-zinc-500" />
                    <span class="text-[9px] text-zinc-600 font-medium tracking-wider rotate-90 whitespace-nowrap">
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
              <div v-if="clipDuration > 0" class="px-4 py-1 border-t border-zinc-800 bg-zinc-900/70">
                <div class="flex items-center gap-2">
                  <!-- Play/Pause button -->
                  <button
                    @click="togglePlayback"
                    class="w-8 h-8 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors shadow-lg"
                    :disabled="!videoUrl"
                    :class="{ 'opacity-50 cursor-not-allowed': !videoUrl }"
                  >
                    <PlayIcon v-if="!isPlaying" class="w-4 h-4 ml-0.5" />
                    <PauseIcon v-else class="w-4 h-4" />
                  </button>

                  <!-- Time display -->
                  <span class="text-xs text-zinc-400 font-mono w-20">
                    {{ formatTime(currentTime) }} / {{ formatTime(clipDuration) }}
                  </span>

                  <!-- Progress bar -->
                  <div class="flex-1 relative group cursor-pointer" ref="progressBarRef" @mousedown="onSeekStart">
                    <div class="h-1 bg-zinc-700 rounded-full overflow-hidden">
                      <div
                        class="h-full bg-gradient-to-r from-blue-500 to-violet-500"
                        :class="{ 'transition-all duration-100': !isSeeking }"
                        :style="{ width: `${(currentTime / clipDuration) * 100}%` }"
                      />
                    </div>
                    <!-- Seek handle -->
                    <div
                      class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md transition-opacity pointer-events-none"
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
                      class="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
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
                      class="w-16 h-1 accent-blue-500 cursor-pointer"
                      @input="onPoiVolumeChange"
                    />
                  </div>

                  <!-- Reset button -->
                  <button
                    @click="
                      currentTime = 0;
                      isPlaying = false;
                    "
                    class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Reset to start"
                  >
                    <RotateCcwIcon class="w-4 h-4" />
                  </button>
                </div>

                <!-- Loading/Error state -->
                <div v-if="videoLoading" class="text-[10px] text-zinc-500 mt-2">Loading video preview...</div>
                <div v-else-if="videoError" class="text-[10px] text-amber-400 mt-2">
                  {{ videoError }}
                </div>
              </div>

              <!-- Segment Timeline -->
              <POISegmentTimeline
                v-if="clipDuration > 0"
                :segments="segmentConfigs"
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

              <!-- Subtitle Controls (shown when clip has subtitle settings) -->
              <div v-if="subtitleSettings" class="border-t border-zinc-800">
                <!-- Single line: Checkbox + Icon + Label + Edit button -->
                <div class="px-4 py-1.5 bg-zinc-900/50">
                  <div class="flex items-center gap-3">
                    <!-- Checkbox toggles overlay visibility -->
                    <input
                      type="checkbox"
                      v-model="subtitlePositioningEnabled"
                      class="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 shrink-0"
                    />
                    <CaptionsIcon class="h-4 w-4 text-purple-400 shrink-0" />
                    
                    <!-- Subtitles label -->
                    <div class="flex-1 min-w-0">
                      <span class="text-sm font-medium text-white">Subtitles</span>
                      <span v-if="subtitlePositioningEnabled" class="text-[10px] text-zinc-400 ml-2">
                        · Drag to reposition · drag corner to resize
                      </span>
                    </div>

                    <!-- Edit button — opens SubtitlePropertiesPanel in left panel (like text box) -->
                    <button
                      type="button"
                      class="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600"
                      @click="openSubtitleSettings"
                    >
                      Edit…
                    </button>
                    <span class="text-[10px] text-zinc-500 shrink-0 font-mono">{{ targetAspectRatio }}</span>
                  </div>
                </div>
              </div>

            </div>

            <!-- Clip text box (per-clip pill) — optional POI authoring -->
            <div v-if="clipId" class="border-t border-zinc-800">
              <div class="px-4 py-1.5 bg-zinc-900/50">
                <div class="flex items-center gap-3">
                  <input
                    type="checkbox"
                    :checked="clipTextLocal?.enabled === true"
                    class="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-0 shrink-0"
                    @change="toggleClipTextEnabled"
                  />
                  <Type class="h-4 w-4 text-amber-400 shrink-0" />
                  <div class="flex-1 min-w-0">
                    <span class="text-sm font-medium text-white">Clip text box</span>
                    <span v-if="clipTextBoxPositioningActive" class="text-[10px] text-zinc-400 ml-2">
                      · Drag on export preview · corners resize width
                    </span>
                  </div>
                  <button
                    type="button"
                    class="shrink-0 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600"
                    @click="openTextBoxSettings"
                  >
                    {{ clipTextLocal?.enabled ? 'Edit…' : 'Add text' }}
                  </button>
                  <span class="text-[10px] text-zinc-500 shrink-0 font-mono">{{ targetAspectRatio }}</span>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/50">
              <div class="text-sm text-zinc-400">
                <span v-if="!canApplyFraming" class="text-amber-400">
                  <AlertCircleIcon class="w-4 h-4 inline mr-1" />
                  Add a region, enable Scale 16:9 / Use 16:9, or enable the clip text box
                </span>
                <span v-else-if="sourceFrameMode !== 'none' && regions.length === 0" class="text-zinc-500">
                  {{ sourceFrameMode === 'use16x9' ? 'Use 16:9' : 'Scale 16:9' }} configured
                </span>
                <span v-else class="text-zinc-500">
                  {{ regions.length }} region{{ regions.length !== 1 ? 's' : '' }} configured
                </span>
              </div>
              <div class="flex items-center gap-3">
                <button
                  @click="resetRegions"
                  class="px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                  :disabled="!canApplyFraming"
                  :class="{ 'opacity-50 cursor-not-allowed': !canApplyFraming }"
                >
                  Reset
                </button>
                <button
                  @click="close"
                  class="px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="confirmConfig"
                  :disabled="!canApplyFraming"
                  class="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-lg transition-all relative overflow-hidden group"
                  :class="
                    !canApplyFraming
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500'
                  "
                >
                  <div
                    v-if="canApplyFraming"
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <CheckIcon class="h-4 w-4 relative" />
                  <span class="relative">Apply Configuration</span>
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
  } from 'lucide-vue-next';
  import Hls from 'hls.js';
  import POISourcePanel from './POISourcePanel.vue';
  import POITargetPanel from './POITargetPanel.vue';
  import POISegmentTimeline from './POISegmentTimeline.vue';
  import ClipTextBoxPropertiesPanel from '@/components/ClipTextBoxPropertiesPanel.vue';
  import SubtitlePropertiesPanel from '@/components/SubtitlePropertiesPanel.vue';
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

  // Source frame transform (16:9 scaling in 9:16) + mode / blur (synced from POITargetPanel)
  const sourceTransform = ref<{ scale: number; x: number; y: number } | null>(null);
  const sourceFrameMode = ref<ManualSourceFrameMode>('none');
  const poiBlurEnabled = ref(false);
  const poiBlurAmount = ref(12);

  const canApplyFraming = computed(
    () =>
      regions.value.length > 0 ||
      baseRegions.value.length > 0 ||
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

  // Computed clip duration
  const clipDuration = computed(() => {
    if (props.clipEndTime !== undefined && props.clipStartTime !== undefined) {
      return props.clipEndTime - props.clipStartTime;
    }
    // Fallback to full video duration for VOD pre-edit use case
    return props.fullVideoDuration || 0;
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

  async function toggleClipTextEnabled(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    if (checked) {
      // Enable — same as clicking "Add text"
      await openTextBoxSettings();
    } else {
      // Disable — clear the text box
      clipTextLocal.value = null;
      clipTextPositioningEnabled.value = false;
      await persistClipTextClearDb();
    }
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
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
