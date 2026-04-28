<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[10001]"
      >
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
                  <h2 class="text-base font-semibold text-white">Creator clip defaults</h2>
                  <span class="text-[11px] text-zinc-500">
                    · Crop regions and subtitle style applied when "Use creator layout" is checked on download
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

            <!-- Output ratio comes from creator profile clip defaults only (no picker here) -->
            <div class="flex items-center gap-2 px-4 py-2 border-b border-zinc-800 bg-zinc-900/30">
              <span class="text-xs font-medium text-zinc-400">Output preview</span>
              <span class="text-xs font-semibold tabular-nums text-zinc-200">{{ targetAspectRatio }}</span>
              <span class="text-[10px] text-zinc-500">
                · Set default ratio in creator profile Clip Defaults · Source {{ sourceAspectRatio }}
              </span>
            </div>

            <!-- Main Content -->
            <div class="flex-1 overflow-hidden flex flex-col">
              <div class="flex-1 flex overflow-hidden">
                <!-- Source Panel (Left) — swapped for SubtitlePropertiesPanel when editing subtitles -->
                <div class="flex-1 border-r border-zinc-800 min-h-0 flex flex-col overflow-hidden">
                  <template v-if="subtitleSettingsMode">
                    <div
                      class="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800 shrink-0 bg-zinc-900/80"
                    >
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
                      :segments="demoSubtitleSegments"
                      :current-time="0"
                      @updateSettings="onSubtitleSettingsPatch"
                      @updateSegmentText="onDemoSegmentTextChange"
                      @close="doneSubtitleSettings"
                    />
                  </template>
                  <POISourcePanel
                    v-else
                    :regions="regions"
                    :selected-region-id="selectedRegionId"
                    :thumbnail-url="referenceImageUrl"
                    :source-aspect-ratio="sourceAspectRatio"
                    :video-url="null"
                    :video-time="0"
                    :is-playing="false"
                    :allow-media-upload="false"
                    @add-region="addRegion"
                    @update-region="updateRegion"
                    @delete-region="deleteRegion"
                    @select-region="selectRegion"
                  />
                </div>

                <!-- Arrow indicator -->
                <div class="flex items-center justify-center w-12 bg-zinc-900/50">
                  <div class="flex flex-col items-center gap-2">
                    <ArrowRightIcon class="w-5 h-5 text-zinc-500" />
                    <span
                      class="text-[9px] text-zinc-600 font-medium tracking-wider rotate-90 whitespace-nowrap"
                    >
                      EXPORT
                    </span>
                  </div>
                </div>

                <!-- Target Panel (Right) -->
                <div class="flex-1">
                  <POITargetPanel
                    :regions="regions"
                    :selected-region-id="selectedRegionId"
                    :thumbnail-url="referenceImageUrl"
                    :target-aspect-ratio="targetAspectRatio"
                    :source-aspect-ratio="sourceAspectRatio"
                    :video-url="null"
                    :video-time="0"
                    :clip-start-time="0"
                    :is-playing="false"
                    :subtitle-settings="localSubtitleSettings"
                    :subtitle-position="localSubtitlePosition"
                    :subtitle-positioning-enabled="subtitlePositioningEnabled"
                    :transcript-words="previewWords"
                    :transcript-segments="demoSubtitleSegments"
                    :initial-source-framing="targetPanelInitialFraming"
                    @update-region="updateRegion"
                    @select-region="selectRegion"
                    @update-source-transform="handleSourceTransformUpdate"
                    @subtitlePositionChange="onSubtitlePositionChange"
                    @subtitleSettingsChange="onSubtitleSettingsChange"
                  />
                </div>
              </div>

              <!-- Subtitle controls -->
              <div class="border-t border-zinc-800">
                <div class="px-4 py-2.5 bg-zinc-900/50">
                  <div class="flex items-center gap-3">
                    <input
                      type="checkbox"
                      v-model="subtitlePositioningEnabled"
                      class="w-3.5 h-3.5 rounded border-zinc-600 bg-zinc-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 shrink-0"
                    />
                    <CaptionsIcon class="h-3.5 w-3.5 text-purple-400 shrink-0" />

                    <div class="flex-1 min-w-0 flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2">
                      <span class="text-xs font-medium text-white leading-tight">Subtitles</span>
                      <span
                        v-if="subtitlePositioningEnabled"
                        class="text-[10px] text-zinc-500 leading-snug sm:ml-0"
                      >
                        Drag on export preview to position · drag corner to resize
                      </span>
                    </div>

                    <button
                      type="button"
                      class="shrink-0 px-2 py-1 text-[11px] font-medium rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-600"
                      @click="openSubtitleSettings"
                    >
                      Edit…
                    </button>
                    <span class="text-[10px] text-zinc-500 shrink-0 font-mono tabular-nums">
                      {{ targetAspectRatio }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/50">
              <div class="text-sm text-zinc-400">
                <span v-if="!canApply" class="text-amber-400">
                  <AlertCircleIcon class="w-4 h-4 inline mr-1" />
                  Add a region or enable Scale 16:9 / Use 16:9 to save layout
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
                  @click="close"
                  class="px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="confirmConfig"
                  :disabled="!canApply"
                  class="flex items-center gap-2 px-4 py-1.5 text-sm font-semibold rounded-lg transition-all relative overflow-hidden group"
                  :class="
                    !canApply
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500'
                  "
                >
                  <CheckIcon class="h-4 w-4" />
                  Save defaults
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
  import { computed, ref, watch } from 'vue';
  import {
    AlertCircleIcon,
    ArrowRightIcon,
    CaptionsIcon,
    CheckIcon,
    LayoutDashboardIcon,
    XIcon,
  } from 'lucide-vue-next';
  import POISourcePanel from './POISourcePanel.vue';
  import POITargetPanel from './POITargetPanel.vue';
  import SubtitlePropertiesPanel from '@/components/SubtitlePropertiesPanel.vue';
  import type {
    ManualFramingConfig,
    ManualRegion,
    ManualSourceFrameMode,
    ManualSourceFramingPayload,
    SubtitleSettings,
    WordInfo,
  } from '@/types';

  interface Props {
    modelValue: boolean;
    initialFraming: ManualFramingConfig | null;
    initialSubtitle: SubtitleSettings | null;
    targetAspectRatio: string;
    sourceAspectRatio?: string;
    referenceImageUrl: string | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    sourceAspectRatio: '16:9',
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [payload: { framing: ManualFramingConfig; subtitle: SubtitleSettings }];
  }>();

  // Region state
  const regions = ref<ManualRegion[]>([]);
  const selectedRegionId = ref<string | null>(null);
  const sourceFrameMode = ref<ManualSourceFrameMode>('none');
  const sourceTransform = ref<{ scale: number; x: number; y: number } | null>(null);
  const blurEnabled = ref(false);
  const blurAmount = ref(12);

  const targetPanelInitialFraming = computed<ManualSourceFramingPayload>(() => ({
    mode: sourceFrameMode.value,
    blurEnabled: blurEnabled.value,
    blurAmount: blurAmount.value,
    scale: sourceTransform.value?.scale ?? 1,
    x: sourceTransform.value?.x ?? 0,
    y: sourceTransform.value?.y ?? 0,
  }));

  const canApply = computed(
    () => regions.value.length > 0 || sourceFrameMode.value !== 'none'
  );

  function addRegion(region: ManualRegion) {
    regions.value.push(region);
  }

  function updateRegion(id: string, update: Partial<ManualRegion>) {
    const idx = regions.value.findIndex((r) => r.id === id);
    if (idx !== -1) regions.value[idx] = { ...regions.value[idx], ...update };
  }

  function deleteRegion(id: string) {
    regions.value = regions.value.filter((r) => r.id !== id);
    if (selectedRegionId.value === id) selectedRegionId.value = null;
  }

  function selectRegion(id: string | null) {
    selectedRegionId.value = id;
  }

  function handleSourceTransformUpdate(payload: ManualSourceFramingPayload) {
    sourceFrameMode.value = payload.mode;
    blurEnabled.value = payload.blurEnabled;
    blurAmount.value = payload.blurAmount;
    sourceTransform.value =
      payload.mode === 'none' ? null : { scale: payload.scale, x: payload.x, y: payload.y };
  }

  // Subtitle state
  const localSubtitleSettings = ref<SubtitleSettings>(
    props.initialSubtitle
      ? { ...props.initialSubtitle }
      : createDefaultProfileSubtitleSettings()
  );
  const localSubtitlePosition = ref<{ x: number; y: number; width?: number }>({
    x: 50,
    y: 85,
    width: 80,
  });
  const subtitlePositioningEnabled = ref(true);

  /** Demo transcript for subtitle styling preview — synced from SubtitlePropertiesPanel via @updateSegmentText */
  const demoSubtitleSegments = ref<Array<{ start: number; end: number; text: string }>>([
    { start: 0, end: 10, text: 'Subtitles preview' },
  ]);

  function splitDemoSegmentToWords(seg: { start: number; end: number; text: string }): WordInfo[] {
    const tokens = seg.text.trim().split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];
    const dur = Math.max(seg.end - seg.start, 0.001);
    const step = dur / tokens.length;
    return tokens.map((word, i) => ({
      word,
      start: seg.start + i * step,
      end: seg.start + (i + 1) * step,
    }));
  }

  const previewWords = computed(() => demoSubtitleSegments.value.flatMap(splitDemoSegmentToWords));

  function onDemoSegmentTextChange(index: number, text: string) {
    demoSubtitleSegments.value = demoSubtitleSegments.value.map((s, i) =>
      i === index ? { ...s, text } : s
    );
  }

  const subtitleSettingsMode = ref(false);
  let subtitleRevert: SubtitleSettings | null = null;

  function openSubtitleSettings() {
    subtitleRevert = JSON.parse(JSON.stringify(localSubtitleSettings.value));
    subtitleSettingsMode.value = true;
  }
  function doneSubtitleSettings() {
    subtitleSettingsMode.value = false;
    subtitleRevert = null;
  }
  function cancelSubtitleSettings() {
    if (subtitleRevert) localSubtitleSettings.value = subtitleRevert;
    subtitleSettingsMode.value = false;
    subtitleRevert = null;
  }
  function onSubtitleSettingsPatch(patch: Record<string, unknown>) {
    localSubtitleSettings.value = {
      ...localSubtitleSettings.value,
      ...(patch as Partial<SubtitleSettings>),
    };
  }
  function onSubtitleSettingsChange(settings: SubtitleSettings) {
    localSubtitleSettings.value = { ...settings };
  }
  function onSubtitlePositionChange(position: { x: number; y: number; width?: number }) {
    localSubtitlePosition.value = { ...position };
    // Persist into per-ratio overrides so it survives a save
    const ratio = props.targetAspectRatio;
    const overrides = { ...(localSubtitleSettings.value.perRatioConfigs ?? {}) };
    overrides[ratio] = {
      ...(overrides[ratio] ?? { fontSize: localSubtitleSettings.value.fontSize, positionPercentage: position.y }),
      position: { x: position.x, y: position.y },
      positionPercentage: position.y,
      maxWidth: position.width ?? overrides[ratio]?.maxWidth,
    };
    localSubtitleSettings.value = {
      ...localSubtitleSettings.value,
      perRatioConfigs: overrides,
    };
  }

  // Hydrate from props when dialog opens
  watch(
    () => props.modelValue,
    (open) => {
      if (!open) return;

      if (props.initialFraming) {
        regions.value = JSON.parse(JSON.stringify(props.initialFraming.regions ?? []));
        sourceFrameMode.value = props.initialFraming.sourceFrameMode ?? 'none';
        blurEnabled.value = props.initialFraming.blurEnabled ?? false;
        blurAmount.value = props.initialFraming.blurAmount ?? 12;
        sourceTransform.value = props.initialFraming.sourceTransform
          ? { ...props.initialFraming.sourceTransform }
          : sourceFrameMode.value !== 'none'
            ? { scale: 1, x: 0, y: 0 }
            : null;
      } else {
        regions.value = [];
        sourceFrameMode.value = 'none';
        blurEnabled.value = false;
        blurAmount.value = 12;
        sourceTransform.value = null;
      }
      selectedRegionId.value = regions.value[0]?.id ?? null;

      demoSubtitleSegments.value = [{ start: 0, end: 10, text: 'Subtitles preview' }];

      localSubtitleSettings.value = props.initialSubtitle
        ? { ...props.initialSubtitle }
        : createDefaultProfileSubtitleSettings();

      // Hydrate position from per-ratio override if present
      const override = localSubtitleSettings.value.perRatioConfigs?.[props.targetAspectRatio];
      if (override?.position) {
        localSubtitlePosition.value = {
          x: override.position.x,
          y: override.position.y,
          width: override.maxWidth ?? localSubtitleSettings.value.maxWidth,
        };
      } else {
        localSubtitlePosition.value = {
          x: 50,
          y: localSubtitleSettings.value.positionPercentage ?? 85,
          width: localSubtitleSettings.value.maxWidth ?? 80,
        };
      }
      subtitlePositioningEnabled.value = !!localSubtitleSettings.value.enabled;
      subtitleSettingsMode.value = false;
    },
    { immediate: true }
  );

  function close() {
    emit('update:modelValue', false);
  }

  function confirmConfig() {
    if (!canApply.value) return;

    const framing: ManualFramingConfig = {
      mode: 'manual',
      regions: JSON.parse(JSON.stringify(regions.value)),
      targetAspectRatio: props.targetAspectRatio,
      sourceAspectRatio: props.sourceAspectRatio,
      sourceTransform: sourceTransform.value
        ? JSON.parse(JSON.stringify(sourceTransform.value))
        : undefined,
      sourceFrameMode: sourceFrameMode.value !== 'none' ? sourceFrameMode.value : undefined,
      blurEnabled: sourceFrameMode.value !== 'none' ? blurEnabled.value : undefined,
      blurAmount: sourceFrameMode.value !== 'none' ? blurAmount.value : undefined,
    };

    const subtitle: SubtitleSettings = {
      ...localSubtitleSettings.value,
      enabled: subtitlePositioningEnabled.value,
    };

    emit('confirm', { framing, subtitle });
    close();
  }

  function createDefaultProfileSubtitleSettings(): SubtitleSettings {
    return {
      enabled: true,
      fontFamily: 'Montserrat',
      fontSize: 48,
      fontWeight: 700,
      textColor: '#FFFFFF',
      backgroundColor: 'rgba(0,0,0,0)',
      backgroundEnabled: false,
      border1Width: 0,
      border1Color: '#000000',
      border2Width: 3,
      border2Color: '#000000',
      shadowOffsetX: 2,
      shadowOffsetY: 2,
      shadowBlur: 0,
      shadowColor: '#000000',
      position: 'bottom',
      positionPercentage: 85,
      maxWidth: 80,
      animationStyle: 'karaoke',
      highlightColor: '#22D3EE',
      multiColorEnabled: false,
      multiColorMode: 'default',
      colorPalette: [],
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: 'center',
      textOffsetX: 0,
      textOffsetY: 0,
      padding: 0,
      borderRadius: 0,
      wordSpacing: 0,
      selectedPresetId: null,
    };
  }
</script>

<style scoped>
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
  .dialog-enter-active {
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(8px);
  }
</style>
