<template>
  <Modal
    :open="modelValue"
    title="Creator clip defaults"
    description='Crop regions and subtitle style applied when "Use creator layout" is checked on download'
    :icon="LayoutDashboardIcon"
    size="2xl"
    flush
    :dismissible="false"
    body-class="flex flex-col"
    @close="close"
  >
    <!-- Output ratio comes from creator profile clip defaults only (no picker here) -->
    <div class="mt-3 flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 border-y border-line-subtle bg-surface px-5 py-2">
      <span class="text-xs font-medium text-fg-muted">Output preview</span>
      <span class="tabular text-xs font-semibold text-fg">{{ targetAspectRatio }}</span>
      <span class="text-2xs text-fg-subtle">
        · Set default ratio in creator profile Clip Defaults · Source {{ sourceAspectRatio }}
      </span>
    </div>

    <!-- Main Content -->
    <div class="flex min-h-[280px] flex-1 overflow-hidden">
      <!-- Source Panel (Left) — swapped for SubtitlePropertiesPanel when editing subtitles -->
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <template v-if="subtitleSettingsMode">
          <POIPanelHeader title="Subtitles" @cancel="cancelSubtitleSettings" @done="doneSubtitleSettings" />
          <SubtitlePropertiesPanel
            class="flex-1 min-h-0 overflow-hidden"
            variant="embedded"
            :settings="localSubtitleSettings"
            :segments="demoSubtitleSegments"
            :current-time="0"
            @updateSettings="onSubtitleSettingsPatch"
            @draft-segment-text="onDemoSegmentTextChange"
            @commit-segment-text="onDemoSegmentTextChange"
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

      <POIExportRail />

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
    <div class="flex shrink-0 border-t border-line-subtle bg-surface">
      <POIFeatureCell :icon="CaptionsIcon" label="Subtitles" :ratio="targetAspectRatio">
        <template #control>
          <Checkbox
            :model-value="subtitlePositioningEnabled"
            aria-label="Enable subtitle positioning"
            class="shrink-0"
            @update:model-value="(v) => (subtitlePositioningEnabled = v === true)"
          />
        </template>
        <template v-if="subtitlePositioningEnabled">Drag on export preview to position · drag corner to resize</template>
        <template #action>
          <Button variant="secondary" size="xs" class="shrink-0" @click="openSubtitleSettings">Edit…</Button>
        </template>
      </POIFeatureCell>
    </div>

    <template #footer>
      <div class="mr-auto min-w-0 truncate text-xs">
        <span v-if="!canApply" class="inline-flex items-center gap-1.5 text-warning">
          <AlertCircleIcon class="size-3.5 shrink-0" />
          Add a region or enable Scale 16:9 / Use 16:9 to save layout
        </span>
        <span v-else-if="sourceFrameMode !== 'none' && regions.length === 0" class="text-fg-subtle">
          {{ sourceFrameMode === 'use16x9' ? 'Use 16:9' : 'Scale 16:9' }} configured
        </span>
        <span v-else class="text-fg-subtle">
          {{ regions.length }} region{{ regions.length !== 1 ? 's' : '' }} configured
        </span>
      </div>
      <Button variant="ghost" @click="close">Cancel</Button>
      <Button variant="primary" :disabled="!canApply" @click="confirmConfig">
        <CheckIcon />
        Save defaults
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { computed, ref, watch } from 'vue';
  import { AlertCircleIcon, CaptionsIcon, CheckIcon, LayoutDashboardIcon } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import POIPanelHeader from './POIPanelHeader.vue';
  import POIExportRail from './POIExportRail.vue';
  import POIFeatureCell from './POIFeatureCell.vue';
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

  /** Demo transcript for subtitle styling preview — synced from SubtitlePropertiesPanel draft/commit */
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
