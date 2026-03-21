<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="vod-preset-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div class="vod-preset-dialog">
            <!-- Top accent -->
            <div class="vod-preset-dialog__accent" />

            <!-- Header -->
            <div class="vod-preset-dialog__header">
              <button class="vod-preset-dialog__close" @click="close" title="Close">
                <XIcon :size="18" />
              </button>
              <div class="vod-preset-dialog__icon">
                <LayoutDashboardIcon :size="24" />
              </div>
              <h2 class="vod-preset-dialog__title">VOD Pre-Edit Settings</h2>
              <p class="vod-preset-dialog__subtitle">
                Configure aspect ratio, framing, overlays &amp; watermark before clip detection
              </p>
            </div>

            <!-- Main Content - Scrollable -->
            <div class="vod-preset-dialog__content">
              <!-- Section 1: Aspect Ratio & Template -->
              <div class="vod-preset-dialog__section">
                <div class="vod-preset-dialog__section-header">
                  <RatioIcon class="vod-preset-dialog__section-icon" />
                  <h3 class="vod-preset-dialog__section-title">Aspect Ratio & Template</h3>
                </div>

                <!-- Aspect Ratio Buttons -->
                <div class="flex gap-2 mb-2">
                  <button
                    v-for="ratio in aspectRatioOptions"
                    :key="ratio.value"
                    @click="selectedAspectRatio = ratio.value"
                    class="vod-preset-dialog__ratio-btn"
                    :class="selectedAspectRatio === ratio.value
                      ? 'vod-preset-dialog__ratio-btn--selected'
                      : 'vod-preset-dialog__ratio-btn--idle'"
                  >
                    <div class="flex items-center gap-1.5">
                      <div
                        class="border border-current rounded-sm"
                        :style="{ width: ratio.previewW + 'px', height: ratio.previewH + 'px' }"
                      />
                      {{ ratio.label }}
                    </div>
                  </button>
                </div>

                <!-- Template Picker -->
                <div class="flex items-center gap-2">
                  <div class="flex-1 min-w-0">
                    <CustomDropdown
                      :model-value="selectedTemplateId"
                      :options="availableTemplatesOptions"
                      placeholder="— No template —"
                      trigger-class="vod-preset-dialog__select-trigger"
                      :show-delete="true"
                      @update:model-value="handleTemplateChange"
                      @delete="deleteTemplate"
                    />
                  </div>
                  <button
                    @click="showSaveTemplate = true"
                    class="vod-preset-dialog__action-btn"
                  >
                    <SaveIcon class="vod-preset-dialog__action-btn-icon" />
                    Save Template
                  </button>
                </div>

              </div>

              <!-- Section 2: Framing -->
              <div class="vod-preset-dialog__section">
                <div class="vod-preset-dialog__section-header vod-preset-dialog__section-header--row">
                  <div class="vod-preset-dialog__section-header-left">
                    <CropIcon class="vod-preset-dialog__section-icon" />
                    <h3 class="vod-preset-dialog__section-title">Framing</h3>
                    <span class="vod-preset-dialog__section-badge">
                      {{ framingConfig?.regions?.length || 0 }} region{{ (framingConfig?.regions?.length || 0) !== 1 ? 's' : '' }}
                    </span>
                  </div>
                  <button
                    @click="openFramingEditor"
                    class="vod-preset-dialog__action-btn"
                  >
                    <LayoutDashboardIcon class="vod-preset-dialog__action-btn-icon" />
                    {{ (framingConfig?.regions?.length || 0) > 0 ? 'Edit Framing' : 'Configure Framing' }}
                  </button>
                </div>

                <!-- Framing Preview -->
                <div v-if="framingConfig?.regions && framingConfig.regions.length > 0" class="flex gap-3">
                  <div
                    v-for="(region, idx) in framingConfig.regions"
                    :key="region.id"
                    class="vod-preset-dialog__region-chip"
                  >
                    <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: region.color }" />
                    <span class="text-xs text-zinc-300">{{ region.label || `Region ${idx + 1}` }}</span>
                    <span class="text-[10px] text-zinc-500 font-mono">
                      {{ Math.round(region.source.width * 100) }}×{{ Math.round(region.source.height * 100) }}%
                    </span>
                  </div>
                </div>
                <div v-else class="vod-preset-dialog__empty-hint">
                  No framing configured — clips will use default center crop for {{ selectedAspectRatio }}
                </div>
              </div>

              <!-- Section 3: Layout Overlays -->
              <div class="vod-preset-dialog__section">
                <div class="vod-preset-dialog__section-header vod-preset-dialog__section-header--row">
                  <div class="vod-preset-dialog__section-header-left">
                    <LayersIcon class="vod-preset-dialog__section-icon" />
                    <h3 class="vod-preset-dialog__section-title">Layout Overlays</h3>
                    <span class="vod-preset-dialog__section-badge">
                      {{ layoutOverlays.length }} overlay{{ layoutOverlays.length !== 1 ? 's' : '' }}
                    </span>
                  </div>
                  <button
                    v-if="!hasCreatorProfile"
                    @click="addLayoutOverlay"
                    class="vod-preset-dialog__action-btn"
                  >
                    <PlusIcon class="vod-preset-dialog__action-btn-icon" />
                    Add Overlay
                  </button>
                </div>

                <!-- Creator Profile Restriction Notice -->
                <div v-if="hasCreatorProfile" class="vod-preset-dialog__info-notice mb-3">
                  <InfoIcon class="vod-preset-dialog__info-notice-icon" />
                  <span class="vod-preset-dialog__info-notice-text">
                    Layout overlay settings are managed by the creator profile and cannot be changed here.
                  </span>
                </div>

                <!-- Overlay List -->
                <div v-if="layoutOverlays.length > 0" class="space-y-2">
                  <div
                    v-for="(overlay, idx) in layoutOverlays"
                    :key="overlay.id"
                    class="vod-preset-dialog__overlay-item"
                  >
                    <!-- Thumbnail -->
                    <div class="w-10 h-10 rounded bg-zinc-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img
                        v-if="overlayPreviews[overlay.id]"
                        :src="overlayPreviews[overlay.id]"
                        class="w-full h-full object-contain"
                        alt=""
                      />
                      <ImageIcon v-else class="w-4 h-4 text-zinc-500" />
                    </div>

                    <!-- Info -->
                    <div class="flex-1 min-w-0">
                      <input
                        v-model="overlay.label"
                        class="text-xs text-zinc-300 bg-transparent border-none outline-none w-full placeholder-zinc-600"
                        :placeholder="`Overlay ${idx + 1}`"
                      />
                      <div class="text-[10px] text-zinc-500 font-mono mt-0.5">
                        {{ overlay.x.toFixed(0) }}%, {{ overlay.y.toFixed(0) }}% · {{ overlay.width.toFixed(0) }}×{{ overlay.height.toFixed(0) }}% · {{ overlay.opacity }}% opacity
                        <span v-if="overlayConfiguredRatioCount(overlay) > 0" class="vod-preset-dialog__overlay-ratio-count ml-1">
                          · {{ overlayConfiguredRatioCount(overlay) }}/4 ratios
                        </span>
                      </div>
                    </div>

                    <!-- Controls -->
                    <div v-if="!hasCreatorProfile" class="flex items-center gap-1.5">
                      <button
                        @click="openOverlayPositionPicker(idx)"
                        class="vod-preset-dialog__action-btn vod-preset-dialog__action-btn--sm"
                        title="Configure position per aspect ratio"
                      >
                        <MoveIcon class="vod-preset-dialog__action-btn-icon" />
                        Position
                      </button>
                      <button
                        @click="removeLayoutOverlay(idx)"
                        class="vod-preset-dialog__overlay-remove"
                        title="Remove overlay"
                      >
                        <Trash2Icon class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="vod-preset-dialog__empty-hint">
                  No layout overlays — add border images, dividers, or decorative elements
                </div>
              </div>

              <!-- Section 4: Watermark -->
              <div class="vod-preset-dialog__section vod-preset-dialog__section--last">
                <div class="vod-preset-dialog__section-header">
                  <StampIcon class="vod-preset-dialog__section-icon" />
                  <h3 class="vod-preset-dialog__section-title">Watermark</h3>
                </div>

                <!-- Creator Profile Restriction Notice -->
                <div v-if="hasCreatorProfile" class="vod-preset-dialog__info-notice">
                  <InfoIcon class="vod-preset-dialog__info-notice-icon" />
                  <span class="vod-preset-dialog__info-notice-text">
                    This project has a creator profile attached. Watermark settings are managed by the creator profile and cannot be changed here.
                  </span>
                </div>

                <!-- Watermark Mode Selection (only shown when NO creator profile) -->
                <div v-if="!hasCreatorProfile" class="vod-preset-dialog__wm-toggle">
                  <button
                    @click="watermarkMode = 'custom'"
                    class="vod-preset-dialog__toggle-btn"
                    :class="watermarkMode === 'custom'
                      ? 'vod-preset-dialog__toggle-btn--selected'
                      : 'vod-preset-dialog__toggle-btn--idle'"
                  >
                    <ImageIcon class="w-3.5 h-3.5" />
                    Custom Watermark
                  </button>

                  <button
                    @click="watermarkMode = 'none'"
                    class="vod-preset-dialog__toggle-btn"
                    :class="watermarkMode === 'none'
                      ? 'vod-preset-dialog__toggle-btn--selected'
                      : 'vod-preset-dialog__toggle-btn--idle'"
                  >
                    <EyeOffIcon class="w-3.5 h-3.5" />
                    No Watermark
                  </button>
                </div>

                <!-- Custom Watermark Settings (only when mode is 'custom' AND no creator profile) -->
                <div v-if="watermarkMode === 'custom' && !hasCreatorProfile" class="mt-3 space-y-3">
                  <!-- Watermark Image Selection -->
                  <div class="vod-preset-dialog__wm-card">
                    <div class="flex items-center justify-between mb-2">
                      <span class="text-xs text-zinc-400">Watermark Image</span>
                      <button
                        @click="uploadCustomWatermark"
                        :disabled="uploadingCustomWatermark"
                        class="vod-preset-dialog__upload-link"
                      >
                        {{ uploadingCustomWatermark ? 'Uploading...' : '+ Upload New' }}
                      </button>
                    </div>
                    <div class="relative">
                      <button
                        type="button"
                        @click.stop="showCustomWatermarkDropdown = !showCustomWatermarkDropdown"
                        class="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-left flex items-center justify-between hover:border-zinc-600 transition-all text-xs text-zinc-300"
                      >
                        <div class="flex items-center gap-2">
                          <div class="w-6 h-6 rounded bg-zinc-700 border border-zinc-600 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <img
                              v-if="selectedCustomWatermarkPreview"
                              :src="selectedCustomWatermarkPreview"
                              class="max-w-full max-h-full object-contain"
                              alt=""
                            />
                            <ImageIcon v-else class="w-3 h-3 text-zinc-500" />
                          </div>
                          <span class="truncate">{{ selectedCustomWatermarkName || 'Select watermark...' }}</span>
                        </div>
                        <ChevronDownIcon class="h-3.5 w-3.5 text-zinc-500 transition-transform flex-shrink-0 ml-1" :class="{ 'rotate-180': showCustomWatermarkDropdown }" />
                      </button>

                      <!-- Dropdown -->
                      <div
                        v-if="showCustomWatermarkDropdown"
                        class="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-y-auto max-h-40"
                        @click.stop
                      >
                        <button
                          v-for="wm in customWatermarkList"
                          :key="wm.id"
                          @click="selectCustomWatermark(wm)"
                          class="w-full text-left px-2.5 py-2 hover:bg-zinc-800 transition-colors text-xs flex items-center gap-2"
                          :class="{ 'vod-preset-dialog__wm-option--selected': selectedCustomWatermarkId === wm.id }"
                        >
                          <div class="w-6 h-6 rounded bg-zinc-800 border border-zinc-700 flex items-center justify-center overflow-hidden">
                            <img
                              v-if="customWatermarkPreviews[wm.id]"
                              :src="customWatermarkPreviews[wm.id]"
                              class="max-w-full max-h-full object-contain"
                              alt=""
                            />
                            <ImageIcon v-else class="w-3 h-3 text-zinc-500" />
                          </div>
                          <span class="truncate text-zinc-300">{{ wm.name }}</span>
                        </button>
                        <div v-if="customWatermarkList.length === 0" class="px-2.5 py-3 text-xs text-center text-zinc-500">
                          No watermarks available. Upload one above.
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Position Configuration -->
                  <div v-if="selectedCustomWatermarkId" class="flex items-center gap-2">
                    <button
                      @click="openWatermarkPositionPicker"
                      class="vod-preset-dialog__action-btn vod-preset-dialog__action-btn--full"
                    >
                      <MoveIcon class="vod-preset-dialog__action-btn-icon" />
                      Configure Position
                    </button>
                    <span v-if="watermarkConfiguredRatioCount > 0" class="vod-preset-dialog__wm-ratio-count">
                      {{ watermarkConfiguredRatioCount }}/4 ratios
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="vod-preset-dialog__footer">
              <div class="vod-preset-dialog__footer-info">
                Target: <span class="font-medium" style="color: var(--sidebar-text)">{{ selectedAspectRatio }}</span>
                <span v-if="framingConfig?.regions && framingConfig.regions.length > 0" class="ml-2">
                  · {{ framingConfig.regions.length }} region{{ framingConfig.regions.length !== 1 ? 's' : '' }}
                </span>
                <span v-if="layoutOverlays.length > 0" class="ml-2">
                  · {{ layoutOverlays.length }} overlay{{ layoutOverlays.length !== 1 ? 's' : '' }}
                </span>
              </div>
              <div class="flex items-center gap-3">
                <button
                  v-if="hasExistingConfig"
                  @click="clearPreset"
                  class="vod-preset-dialog__btn vod-preset-dialog__btn--danger"
                >
                  Remove Pre-Edit
                </button>
                <button
                  @click="close"
                  class="vod-preset-dialog__btn vod-preset-dialog__btn--secondary"
                >
                  Cancel
                </button>
                <button
                  @click="confirmConfig"
                  class="vod-preset-dialog__btn vod-preset-dialog__btn--primary"
                >
                  <CheckIcon :size="16" />
                  Apply Pre-Edit
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Framing Editor Sub-Dialog -->
  <ManualPOIEditor
    v-model="showFramingEditor"
    :initial-config="currentFramingConfig"
    :target-aspect-ratio="selectedAspectRatio"
    :source-aspect-ratio="sourceAspectRatio"
    :thumbnail-url="thumbnailUrl"
    :video-path="videoPath"
    :clip-start-time="0"
    :clip-end-time="videoDuration"
    :full-video-duration="videoDuration"
    :watermark-settings="null"
    :layout-overlays="layoutOverlays"
    :overlay-preview-urls="overlayPreviewsRef"
    @confirm="onFramingConfirmed"
  />

  <!-- Save Template Dialog -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showSaveTemplate" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10002]">
        <div class="vod-preset-dialog__save-template-card">
          <h3 class="text-sm font-semibold text-white mb-3">Save as Template</h3>
          <input
            v-model="templateName"
            class="vod-preset-dialog__save-template-input"
            placeholder="Template name..."
            @keydown.enter="saveTemplate"
          />
          <div class="flex justify-end gap-2">
            <button
              @click="showSaveTemplate = false"
              class="vod-preset-dialog__btn vod-preset-dialog__btn--secondary"
            >
              Cancel
            </button>
            <button
              @click="saveTemplate"
              :disabled="!templateName.trim()"
              class="vod-preset-dialog__btn vod-preset-dialog__btn--primary"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Watermark Position Picker Sub-Dialog -->
  <WatermarkPositionPicker
    :show="showWatermarkPositionPickerDialog"
    :watermark-file-path="selectedCustomWatermarkFilePath"
    :watermark-id="selectedCustomWatermarkId"
    :watermark-width="selectedCustomWatermarkDimensions.width"
    :watermark-height="selectedCustomWatermarkDimensions.height"
    :settings="customWatermarkPositionSettings || undefined"
    @close="showWatermarkPositionPickerDialog = false"
    @save="handleWatermarkPositionSave"
  />

  <!-- Overlay Position Picker Sub-Dialog -->
  <OverlayPositionPicker
    :show="showOverlayPositionPickerDialog"
    :overlay-image-path="activeOverlayForPosition?.imagePath || ''"
    :overlay-image-url="activeOverlayForPosition ? overlayPreviews[activeOverlayForPosition.id] || '' : ''"
    :overlay-asset-id="activeOverlayForPosition?.assetId"
    :overlay-label="activeOverlayForPosition?.label || ''"
    :settings="activeOverlayForPosition?.perRatioSettings || undefined"
    @close="showOverlayPositionPickerDialog = false"
    @save="handleOverlayPositionSave"
  />
</template>

<script setup lang="ts">
  import { ref, watch, computed, reactive } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import {
    LayoutDashboardIcon,
    XIcon,
    CheckIcon,
    PlusIcon,
    Trash2Icon,
    SaveIcon,
    CropIcon,
    LayersIcon,
    ImageIcon,
    EyeOffIcon,
    UserIcon,
    InfoIcon,
    RatioIcon,
    StampIcon,
    MoveIcon,
    ChevronDownIcon,
    XCircleIcon,
  } from 'lucide-vue-next';
  import ManualPOIEditor from './poi/ManualPOIEditor.vue';
  import WatermarkPositionPicker, { type CreatorWatermarkSettings } from './WatermarkPositionPicker.vue';
  import OverlayPositionPicker from './OverlayPositionPicker.vue';
  import CustomDropdown, { type DropdownOption } from './CustomDropdown.vue';
  import { getAllWatermarkImages, resolveOverlayImagePath, type WatermarkImage } from '@/services/database/watermarks';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import type {
    ManualRegion,
    ManualFramingConfig,
    LayoutOverlay,
    ActiveVodPresetConfig,
    VodPreset,
    WatermarkSettings,
    PerRatioOverlaySettings,
  } from '@/types';
  import {
    getAllVodPresets,
    getVodPresetsByCreator,
    getVodPresetsUnlinked,
    createVodPreset,
    updateVodPreset as updateVodPresetDb,
    deleteVodPreset,
  } from '@/services/database/vod-presets';
  import { resolveApplicableProfiles } from '@/composables/useBrandingProfileSelection';

  interface Props {
    modelValue: boolean;
    projectId: string;
    initialConfig?: ActiveVodPresetConfig | null;
    creatorProfileId?: string | null;
    thumbnailUrl?: string | null;
    videoPath?: string | null;
    videoDuration?: number;
    sourceAspectRatio?: string;
  }

  const props = withDefaults(defineProps<Props>(), {
    initialConfig: null,
    creatorProfileId: null,
    thumbnailUrl: null,
    videoPath: null,
    videoDuration: 0,
    sourceAspectRatio: '16:9',
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [config: ActiveVodPresetConfig];
    clear: [];
    'save-template': [preset: VodPreset];
  }>();

  // Aspect ratio options
  const aspectRatioOptions = [
    { value: '16:9', label: '16:9', previewW: 16, previewH: 9 },
    { value: '9:16', label: '9:16', previewW: 9, previewH: 16 },
    { value: '1:1', label: '1:1', previewW: 12, previewH: 12 },
    { value: '4:5', label: '4:5', previewW: 10, previewH: 12 },
  ];

  // State
  const selectedAspectRatio = ref('9:16');
  const framingConfig = ref<ManualFramingConfig | null>(null);
  const layoutOverlays = ref<LayoutOverlay[]>([]);
  const watermarkMode = ref<'creator' | 'custom' | 'none'>('none');
  const customWatermarkSettings = ref<WatermarkSettings | null>(null);
  const overlayPreviews = reactive<Record<string, string>>({});
  // Ref-based copy to trigger prop reactivity in child components (ManualPOIEditor)
  // reactive() mutations don't propagate as prop changes; ref does
  const overlayPreviewsRef = ref<Record<string, string>>({});

  // Template state
  const selectedTemplateId = ref('');
  const availableTemplates = ref<VodPreset[]>([]);
  const showSaveTemplate = ref(false);
  const templateName = ref('');
  const templateLinkToCreator = ref(false);

  // Framing editor state
  const showFramingEditor = ref(false);

  // Watermark operations
  const { uploadWatermark } = useWatermarkOperations();

  // Custom watermark state
  const customWatermarkList = ref<WatermarkImage[]>([]);
  const customWatermarkPreviews = reactive<Record<string, string>>({});
  const selectedCustomWatermarkId = ref<string | null>(null);
  const showCustomWatermarkDropdown = ref(false);
  const uploadingCustomWatermark = ref(false);
  const customWatermarkPositionSettings = ref<CreatorWatermarkSettings | null>(null);

  // Watermark position picker dialog state
  const showWatermarkPositionPickerDialog = ref(false);

  // Overlay position picker dialog state
  const showOverlayPositionPickerDialog = ref(false);
  const activeOverlayIndex = ref<number>(-1);

  // Track if any profile (creator, org-streamer, or campaign) is being applied
  const hasResolvedProfile = ref(false);
  const activeOverlayForPosition = computed(() => {
    if (activeOverlayIndex.value < 0 || activeOverlayIndex.value >= layoutOverlays.value.length) return null;
    return layoutOverlays.value[activeOverlayIndex.value];
  });

  // Computed watermark properties
  const selectedCustomWatermarkPreview = computed(() => {
    if (!selectedCustomWatermarkId.value) return null;
    return customWatermarkPreviews[selectedCustomWatermarkId.value] || null;
  });

  const selectedCustomWatermarkName = computed(() => {
    if (!selectedCustomWatermarkId.value) return null;
    const wm = customWatermarkList.value.find((w) => w.id === selectedCustomWatermarkId.value);
    return wm?.name || null;
  });

  const selectedCustomWatermarkFilePath = computed(() => {
    if (!selectedCustomWatermarkId.value) return undefined;
    const wm = customWatermarkList.value.find((w) => w.id === selectedCustomWatermarkId.value);
    return wm?.file_path;
  });

  const selectedCustomWatermarkDimensions = computed(() => {
    if (!selectedCustomWatermarkId.value) return { width: null, height: null };
    const wm = customWatermarkList.value.find((w) => w.id === selectedCustomWatermarkId.value);
    return { width: wm?.width ?? null, height: wm?.height ?? null };
  });

  const watermarkConfiguredRatioCount = computed(() => {
    if (!customWatermarkPositionSettings.value) return 0;
    const s = customWatermarkPositionSettings.value;
    return [s['16:9'], s['9:16'], s['1:1'], s['4:5']].filter((v) => v !== null && v !== undefined).length;
  });

  function overlayConfiguredRatioCount(overlay: LayoutOverlay): number {
    if (!overlay.perRatioSettings) return 0;
    const s = overlay.perRatioSettings;
    return [s['16:9'], s['9:16'], s['1:1'], s['4:5']].filter((v) => v !== null && v !== undefined).length;
  }

  const hasCreatorProfile = computed(() => {
    const result = !!props.creatorProfileId || hasResolvedProfile.value;
    console.log('[VodPresetEditor] hasCreatorProfile:', result, 'creatorProfileId:', props.creatorProfileId, 'hasResolvedProfile:', hasResolvedProfile.value);
    return result;
  });
  const hasExistingConfig = computed(() => !!props.initialConfig);

  const availableTemplatesOptions = computed<DropdownOption[]>(() =>
    availableTemplates.value.map((t) => ({
      label: `${t.name} (${t.targetAspectRatio})`,
      value: t.id,
    }))
  );

  function handleTemplateChange(val: string) {
    selectedTemplateId.value = val;
    onTemplateSelected();
  }

  const currentFramingConfig = computed((): ManualFramingConfig | null => {
    return framingConfig.value;
  });

  // Load templates
  async function loadTemplates() {
    try {
      if (props.creatorProfileId) {
        const creatorPresets = await getVodPresetsByCreator(props.creatorProfileId);
        const globalPresets = await getVodPresetsUnlinked();
        availableTemplates.value = [...creatorPresets, ...globalPresets];
      } else {
        availableTemplates.value = await getAllVodPresets();
      }
    } catch (error) {
      console.error('[VodPresetEditor] Failed to load templates:', error);
    }
  }

  // Handle template selection
  function onTemplateSelected() {
    if (!selectedTemplateId.value) return;
    const template = availableTemplates.value.find((t) => t.id === selectedTemplateId.value);
    if (!template) return;

    selectedAspectRatio.value = template.targetAspectRatio;
    framingConfig.value = template.framingConfig
      ? JSON.parse(JSON.stringify(template.framingConfig))
      : null;
    layoutOverlays.value = template.layoutOverlays
      ? JSON.parse(JSON.stringify(template.layoutOverlays))
      : [];
    watermarkMode.value = template.watermarkMode;
    customWatermarkSettings.value = template.customWatermarkSettings
      ? JSON.parse(JSON.stringify(template.customWatermarkSettings))
      : null;

    // Load overlay previews
    loadOverlayPreviews();
  }

  // Open framing editor
  function openFramingEditor() {
    showFramingEditor.value = true;
  }

  // Handle framing confirmed from ManualPOIEditor
  function onFramingConfirmed(config: ManualFramingConfig) {
    framingConfig.value = JSON.parse(JSON.stringify(config));
  }

  // Layout overlay management
  async function addLayoutOverlay() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        multiple: false,
        filters: [{ name: 'Images & Videos', extensions: ['png', 'svg', 'webp', 'jpg', 'jpeg', 'mp4', 'mov', 'webm'] }],
      });

      if (!result) return;
      const filePath = result as string;

      // Auto-configure the overlay for the currently selected aspect ratio
      const ratioKey = selectedAspectRatio.value as '16:9' | '9:16' | '1:1' | '4:5';
      const defaultRatioPosition = {
        x: 50,
        y: 50,
        width: 100,
        height: 10,
        opacity: 100,
        rotation: 0,
        scale: 20,
        isFullFrameOverlay: false,
        imagePath: filePath,
      };

      const newOverlay: LayoutOverlay = {
        id: crypto.randomUUID(),
        imagePath: filePath,
        x: 50,
        y: 50,
        width: 100,
        height: 10,
        opacity: 100,
        rotation: 0,
        label: '',
        perRatioSettings: {
          '16:9': ratioKey === '16:9' ? defaultRatioPosition : null,
          '9:16': ratioKey === '9:16' ? defaultRatioPosition : null,
          '1:1': ratioKey === '1:1' ? defaultRatioPosition : null,
          '4:5': ratioKey === '4:5' ? defaultRatioPosition : null,
        },
      };

      layoutOverlays.value.push(newOverlay);
      await loadOverlayPreview(newOverlay);
    } catch (error) {
      console.error('[VodPresetEditor] Failed to add overlay:', error);
    }
  }

  function removeLayoutOverlay(index: number) {
    const overlay = layoutOverlays.value[index];
    if (overlay) {
      delete overlayPreviews[overlay.id];
      const copy = { ...overlayPreviewsRef.value };
      delete copy[overlay.id];
      overlayPreviewsRef.value = copy;
    }
    layoutOverlays.value.splice(index, 1);
  }

  async function loadOverlayPreview(overlay: LayoutOverlay) {
    try {
      console.log('[VodPresetEditor] loadOverlayPreview:', overlay.id, 'imagePath:', overlay.imagePath, 'assetId:', overlay.assetId);
      // Resolve the overlay image path (handles both local files and org-asset- prefixed IDs)
      const resolvedPath = await resolveOverlayImagePath(overlay.imagePath, overlay.assetId);
      console.log('[VodPresetEditor] resolvedPath:', resolvedPath);
      if (!resolvedPath) {
        console.warn('[VodPresetEditor] Could not resolve overlay image path for:', overlay.id, 'assetId:', overlay.assetId);
        return;
      }
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: resolvedPath });
      overlayPreviews[overlay.id] = dataUrl;
      // Sync to ref for ManualPOIEditor prop reactivity
      overlayPreviewsRef.value = { ...overlayPreviewsRef.value, [overlay.id]: dataUrl };
      console.log('[VodPresetEditor] Overlay preview loaded successfully for:', overlay.id, 'dataUrl length:', dataUrl?.length);
    } catch (error) {
      console.warn('[VodPresetEditor] Failed to load overlay preview:', error);
    }
  }

  async function loadOverlayPreviews() {
    console.log('[VodPresetEditor] loadOverlayPreviews called, count:', layoutOverlays.value.length);
    for (const overlay of layoutOverlays.value) {
      await loadOverlayPreview(overlay);
    }
    console.log('[VodPresetEditor] overlayPreviews after load:', Object.keys(overlayPreviews));
  }

  // ==========================================
  // Custom Watermark Management
  // ==========================================

  async function loadCustomWatermarks() {
    try {
      customWatermarkList.value = await getAllWatermarkImages();
      for (const wm of customWatermarkList.value) {
        if (!customWatermarkPreviews[wm.id]) {
          try {
            const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: wm.file_path });
            customWatermarkPreviews[wm.id] = dataUrl;
          } catch (err) {
            console.warn('[VodPresetEditor] Failed to load watermark preview:', wm.id, err);
          }
        }
      }
    } catch (error) {
      console.error('[VodPresetEditor] Failed to load watermarks:', error);
    }
  }

  function selectCustomWatermark(wm: WatermarkImage) {
    selectedCustomWatermarkId.value = wm.id;
    showCustomWatermarkDropdown.value = false;

    // Update the customWatermarkSettings with the selected watermark ID
    if (!customWatermarkSettings.value) {
      customWatermarkSettings.value = {
        enabled: true,
        watermarkId: wm.id,
        positionX: 12,
        positionY: 92,
        opacity: 80,
        scale: 20,
        width: wm.width ?? null,
        height: wm.height ?? null,
      };
    } else {
      customWatermarkSettings.value.watermarkId = wm.id;
      customWatermarkSettings.value.enabled = true;
      customWatermarkSettings.value.width = wm.width ?? null;
      customWatermarkSettings.value.height = wm.height ?? null;
    }
  }

  async function uploadCustomWatermark() {
    if (uploadingCustomWatermark.value) return;
    uploadingCustomWatermark.value = true;

    try {
      const result = await uploadWatermark();
      if (result.success && result.watermarkId) {
        await loadCustomWatermarks();
        const newWm = customWatermarkList.value.find((w) => w.id === result.watermarkId);
        if (newWm) {
          selectCustomWatermark(newWm);
        }
      }
    } catch (err) {
      console.error('[VodPresetEditor] Failed to upload watermark:', err);
    } finally {
      uploadingCustomWatermark.value = false;
    }
  }

  function openWatermarkPositionPicker() {
    if (!selectedCustomWatermarkId.value) return;
    showWatermarkPositionPickerDialog.value = true;
  }

  function handleWatermarkPositionSave(settings: CreatorWatermarkSettings) {
    customWatermarkPositionSettings.value = settings;
    showWatermarkPositionPickerDialog.value = false;

    // Also update the customWatermarkSettings with per-ratio data
    if (customWatermarkSettings.value) {
      // Map CreatorWatermarkSettings to WatermarkSettings.perRatioSettings
      customWatermarkSettings.value.perRatioSettings = {
        '16:9': settings['16:9'] ? {
          watermarkId: settings['16:9'].watermarkId,
          position: settings['16:9'].position,
        } : null,
        '9:16': settings['9:16'] ? {
          watermarkId: settings['9:16'].watermarkId,
          position: settings['9:16'].position,
        } : null,
        '1:1': settings['1:1'] ? {
          watermarkId: settings['1:1'].watermarkId,
          position: settings['1:1'].position,
        } : null,
        '4:5': settings['4:5'] ? {
          watermarkId: settings['4:5'].watermarkId,
          position: settings['4:5'].position,
        } : null,
      };

      // Update main position from the first enabled ratio
      const firstEnabled = settings['16:9'] || settings['9:16'] || settings['1:1'] || settings['4:5'];
      if (firstEnabled?.position) {
        customWatermarkSettings.value.positionX = firstEnabled.position.x;
        customWatermarkSettings.value.positionY = firstEnabled.position.y;
        customWatermarkSettings.value.opacity = firstEnabled.position.opacity;
        customWatermarkSettings.value.scale = firstEnabled.position.scale;
        customWatermarkSettings.value.isFullFrameOverlay = firstEnabled.position.isFullFrameOverlay;
      }
    }
  }

  // ==========================================
  // Overlay Position Management
  // ==========================================

  function openOverlayPositionPicker(idx: number) {
    activeOverlayIndex.value = idx;
    showOverlayPositionPickerDialog.value = true;
  }

  function handleOverlayPositionSave(settings: PerRatioOverlaySettings) {
    if (activeOverlayIndex.value < 0 || activeOverlayIndex.value >= layoutOverlays.value.length) return;

    const overlay = layoutOverlays.value[activeOverlayIndex.value];
    overlay.perRatioSettings = settings;

    // Also update the flat position fields from the first enabled ratio as defaults
    const firstEnabled = settings['16:9'] || settings['9:16'] || settings['1:1'] || settings['4:5'];
    if (firstEnabled) {
      overlay.x = firstEnabled.x;
      overlay.y = firstEnabled.y;
      overlay.width = firstEnabled.width;
      overlay.height = firstEnabled.height;
      overlay.opacity = firstEnabled.opacity;
      overlay.rotation = firstEnabled.rotation;
    }

    showOverlayPositionPickerDialog.value = false;
  }

  // Save template
  async function saveTemplate() {
    if (!templateName.value.trim()) return;

    try {
      const id = await createVodPreset({
        name: templateName.value.trim(),
        creatorProfileId: templateLinkToCreator.value ? props.creatorProfileId : null,
        targetAspectRatio: selectedAspectRatio.value,
        framingConfig: currentFramingConfig.value,
        layoutOverlays: layoutOverlays.value,
        watermarkMode: watermarkMode.value,
        customWatermarkSettings: customWatermarkSettings.value,
      });

      console.log('[VodPresetEditor] Template saved:', id);
      showSaveTemplate.value = false;
      templateName.value = '';
      templateLinkToCreator.value = false;

      // Reload templates
      await loadTemplates();
      selectedTemplateId.value = id;
    } catch (error) {
      console.error('[VodPresetEditor] Failed to save template:', error);
    }
  }

  // Delete template
  async function deleteTemplate(templateId: string, event: Event) {
    event.stopPropagation();
    
    try {
      await deleteVodPreset(templateId);
      console.log('[VodPresetEditor] Template deleted:', templateId);
      
      // If the deleted template was selected, clear selection
      if (selectedTemplateId.value === templateId) {
        selectedTemplateId.value = '';
      }
      
      // Reload templates
      await loadTemplates();
    } catch (error) {
      console.error('[VodPresetEditor] Failed to delete template:', error);
    }
  }

  // Clear preset
  function clearPreset() {
    emit('clear');
    close();
  }

  // Confirm config
  function confirmConfig() {
    const config: ActiveVodPresetConfig = {
      presetId: selectedTemplateId.value || null,
      targetAspectRatio: selectedAspectRatio.value,
      framingConfig: currentFramingConfig.value,
      layoutOverlays: JSON.parse(JSON.stringify(layoutOverlays.value)),
      watermarkMode: watermarkMode.value,
      customWatermarkSettings: customWatermarkSettings.value
        ? JSON.parse(JSON.stringify(customWatermarkSettings.value))
        : null,
    };

    emit('confirm', config);
    close();
  }

  // Close
  function close() {
    emit('update:modelValue', false);
  }

  // Initialize when dialog opens
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        console.log('[VodPresetEditor] Dialog opened with creatorProfileId:', props.creatorProfileId, 'hasCreatorProfile:', hasCreatorProfile.value);
        // Load from initial config or defaults
        if (props.initialConfig) {
          selectedAspectRatio.value = props.initialConfig.targetAspectRatio;
          framingConfig.value = props.initialConfig.framingConfig
            ? JSON.parse(JSON.stringify(props.initialConfig.framingConfig))
            : null;
          layoutOverlays.value = props.initialConfig.layoutOverlays
            ? JSON.parse(JSON.stringify(props.initialConfig.layoutOverlays))
            : [];
          watermarkMode.value = props.initialConfig.watermarkMode;
          customWatermarkSettings.value = props.initialConfig.customWatermarkSettings
            ? JSON.parse(JSON.stringify(props.initialConfig.customWatermarkSettings))
            : null;
          selectedTemplateId.value = props.initialConfig.presetId || '';

          // Restore custom watermark selection from saved settings
          if (customWatermarkSettings.value?.watermarkId) {
            selectedCustomWatermarkId.value = customWatermarkSettings.value.watermarkId;
          } else {
            selectedCustomWatermarkId.value = null;
          }

          // Restore watermark position settings from perRatioSettings
          if (customWatermarkSettings.value?.perRatioSettings) {
            const prs = customWatermarkSettings.value.perRatioSettings;
            customWatermarkPositionSettings.value = {
              '16:9': prs['16:9'] ? { watermarkId: prs['16:9'].watermarkId, position: prs['16:9'].position } : null,
              '9:16': prs['9:16'] ? { watermarkId: prs['9:16'].watermarkId, position: prs['9:16'].position } : null,
              '1:1': prs['1:1'] ? { watermarkId: prs['1:1'].watermarkId, position: prs['1:1'].position } : null,
              '4:5': prs['4:5'] ? { watermarkId: prs['4:5'].watermarkId, position: prs['4:5'].position } : null,
            };
          } else {
            customWatermarkPositionSettings.value = null;
          }
        } else {
          selectedAspectRatio.value = '9:16';
          framingConfig.value = null;
          layoutOverlays.value = [];
          watermarkMode.value = hasCreatorProfile.value ? 'creator' : 'none';
          customWatermarkSettings.value = null;
          selectedTemplateId.value = '';
          selectedCustomWatermarkId.value = null;
          customWatermarkPositionSettings.value = null;

          // Auto-pull creator profile settings (handles local + org-assigned + campaign profiles)
          if (props.projectId) {
            try {
              const candidates = await resolveApplicableProfiles(props.projectId);
              const profile = candidates.length > 0 ? candidates[0].profile : null;

              if (profile) {
                hasResolvedProfile.value = true;
                console.log('[VodPresetEditor] Auto-pulling settings from profile:', profile.name, `(${candidates[0].source})`);

                // Pull layout overlays
                if (profile.layout_overlays) {
                  try {
                    const overlays = JSON.parse(profile.layout_overlays) as LayoutOverlay[];
                    if (Array.isArray(overlays) && overlays.length > 0) {
                      layoutOverlays.value = overlays;
                      console.log('[VodPresetEditor] Loaded', overlays.length, 'overlay(s) from creator profile');
                    }
                  } catch (parseErr) {
                    console.warn('[VodPresetEditor] Failed to parse creator profile overlays:', parseErr);
                  }
                }

                // Pull watermark settings
                if (profile.watermark_settings) {
                  try {
                    const wmSettings = JSON.parse(profile.watermark_settings) as WatermarkSettings;
                    if (wmSettings) {
                      watermarkMode.value = 'custom';
                      customWatermarkSettings.value = wmSettings;
                      if (wmSettings.watermarkId) {
                        selectedCustomWatermarkId.value = wmSettings.watermarkId;
                      }
                      if (wmSettings.perRatioSettings) {
                        const prs = wmSettings.perRatioSettings;
                        customWatermarkPositionSettings.value = {
                          '16:9': prs['16:9'] ? { watermarkId: prs['16:9'].watermarkId, position: prs['16:9'].position } : null,
                          '9:16': prs['9:16'] ? { watermarkId: prs['9:16'].watermarkId, position: prs['9:16'].position } : null,
                          '1:1': prs['1:1'] ? { watermarkId: prs['1:1'].watermarkId, position: prs['1:1'].position } : null,
                          '4:5': prs['4:5'] ? { watermarkId: prs['4:5'].watermarkId, position: prs['4:5'].position } : null,
                        };
                      }
                      console.log('[VodPresetEditor] Loaded watermark settings from creator profile');
                    }
                  } catch (parseErr) {
                    console.warn('[VodPresetEditor] Failed to parse creator profile watermark settings:', parseErr);
                  }
                }
              } else {
                hasResolvedProfile.value = false;
                console.log('[VodPresetEditor] No applicable creator profile found for project:', props.projectId);
              }
            } catch (err) {
              console.warn('[VodPresetEditor] Failed to resolve creator profile:', err);
            }
          }
        }

        // Reset dropdown state
        showCustomWatermarkDropdown.value = false;

        // Load templates, overlay previews, and watermarks
        await loadTemplates();
        await loadOverlayPreviews();
        await loadCustomWatermarks();
      }
    },
    { immediate: true }
  );
</script>

<style scoped>
  /* ===== Overlay ===== */
  .vod-preset-dialog__overlay {
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
  .vod-preset-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 680px;
    margin: 1rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ===== Accent Bar ===== */
  .vod-preset-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .vod-preset-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .vod-preset-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .vod-preset-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .vod-preset-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .vod-preset-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .vod-preset-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .vod-preset-dialog__content {
    flex: 1;
    overflow-y: auto;
  }

  .vod-preset-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .vod-preset-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .vod-preset-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Sections ===== */
  .vod-preset-dialog__section {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--sidebar-border);
  }

  .vod-preset-dialog__section--last {
    border-bottom: none;
  }

  /* ===== Footer ===== */
  .vod-preset-dialog__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
    gap: 1rem;
  }

  .vod-preset-dialog__footer-info {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  /* ===== Buttons ===== */
  .vod-preset-dialog__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .vod-preset-dialog__btn--primary {
    background-color: var(--sidebar-accent);
    color: #fff;
    border-color: var(--sidebar-accent);
  }

  .vod-preset-dialog__btn--primary:hover {
    filter: brightness(1.15);
  }

  .vod-preset-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border-color: var(--sidebar-border);
  }

  .vod-preset-dialog__btn--secondary:hover {
    background-color: var(--sidebar-border);
  }

  .vod-preset-dialog__btn--danger {
    background-color: rgba(239, 68, 68, 0.1);
    color: #f87171;
    border-color: rgba(239, 68, 68, 0.3);
  }

  .vod-preset-dialog__btn--danger:hover {
    background-color: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  /* ===== Section Headers ===== */
  .vod-preset-dialog__section-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }

  .vod-preset-dialog__section-header--row {
    justify-content: space-between;
  }

  .vod-preset-dialog__section-header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .vod-preset-dialog__section-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-text-muted);
    flex-shrink: 0;
  }

  .vod-preset-dialog__section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .vod-preset-dialog__section-badge {
    font-size: 0.625rem;
    color: var(--sidebar-text-muted);
    background-color: var(--sidebar-hover);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
  }

  /* ===== Action Buttons ===== */
  .vod-preset-dialog__action-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    white-space: nowrap;
  }

  .vod-preset-dialog__action-btn:hover {
    color: var(--sidebar-text);
    background-color: var(--sidebar-border);
  }

  .vod-preset-dialog__action-btn-icon {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }

  .vod-preset-dialog__action-btn--sm {
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
  }

  .vod-preset-dialog__action-btn--full {
    flex: 1;
    justify-content: center;
  }

  /* ===== Aspect Ratio Buttons ===== */
  .vod-preset-dialog__ratio-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .vod-preset-dialog__ratio-btn--idle {
    background-color: var(--sidebar-hover);
    border-color: var(--sidebar-border);
    color: var(--sidebar-text-muted);
  }

  .vod-preset-dialog__ratio-btn--idle:hover {
    color: var(--sidebar-text);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .vod-preset-dialog__ratio-btn--selected {
    background-color: rgba(14, 165, 233, 0.15);
    border-color: rgba(14, 165, 233, 0.4);
    color: var(--sidebar-accent);
  }

  /* ===== Template Dropdown ===== */
  :deep(.vod-preset-dialog__select-trigger) {
    width: 100% !important;
    padding: 0.5rem 0.75rem !important;
    background-color: var(--sidebar-hover) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: all 150ms ease !important;
    justify-content: space-between !important;
  }

  :deep(.vod-preset-dialog__select-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.1) !important;
  }

  :deep(.vod-preset-dialog__select-trigger span) {
    color: var(--sidebar-text) !important;
    font-size: 0.75rem !important;
  }

  :deep(.vod-preset-dialog__select-trigger svg) {
    width: 13px !important;
    height: 13px !important;
    color: var(--sidebar-text-muted) !important;
  }

  /* ===== Watermark Toggle ===== */
  .vod-preset-dialog__wm-toggle {
    display: flex;
    gap: 0.5rem;
  }

  .vod-preset-dialog__toggle-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border-radius: 8px;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .vod-preset-dialog__toggle-btn--idle {
    background-color: var(--sidebar-hover);
    border-color: var(--sidebar-border);
    color: var(--sidebar-text-muted);
  }

  .vod-preset-dialog__toggle-btn--idle:hover {
    color: var(--sidebar-text);
    border-color: rgba(255, 255, 255, 0.12);
  }

  .vod-preset-dialog__toggle-btn--selected {
    background-color: rgba(14, 165, 233, 0.15);
    border-color: rgba(14, 165, 233, 0.4);
    color: var(--sidebar-accent);
  }

  /* ===== Watermark Card ===== */
  .vod-preset-dialog__wm-card {
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .vod-preset-dialog__upload-link {
    font-size: 0.625rem;
    color: var(--sidebar-accent);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .vod-preset-dialog__upload-link:hover {
    opacity: 0.8;
  }

  .vod-preset-dialog__wm-option--selected {
    background-color: rgba(14, 165, 233, 0.1);
    color: var(--sidebar-accent);
  }

  .vod-preset-dialog__wm-ratio-count {
    font-size: 0.625rem;
    color: var(--sidebar-accent);
  }

  /* ===== Overlay Items ===== */
  .vod-preset-dialog__overlay-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.625rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .vod-preset-dialog__overlay-item:hover .vod-preset-dialog__overlay-remove {
    opacity: 1;
  }

  .vod-preset-dialog__overlay-ratio-count {
    color: var(--sidebar-accent);
  }

  .vod-preset-dialog__overlay-remove {
    padding: 0.375rem;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: all 150ms ease;
    opacity: 0;
  }

  .vod-preset-dialog__overlay-remove:hover {
    color: #f87171;
    background-color: rgba(239, 68, 68, 0.1);
  }

  /* ===== Region Chips ===== */
  .vod-preset-dialog__region-chip {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  /* ===== Empty Hint ===== */
  .vod-preset-dialog__empty-hint {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    font-style: italic;
  }

  /* ===== Info Notice ===== */
  .vod-preset-dialog__info-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background-color: rgba(14, 165, 233, 0.1);
    border: 1px solid rgba(14, 165, 233, 0.2);
    border-radius: 8px;
  }

  .vod-preset-dialog__info-notice-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .vod-preset-dialog__info-notice-text {
    font-size: 0.75rem;
    color: var(--sidebar-accent);
    opacity: 0.85;
  }

  /* ===== Save Template Card ===== */
  .vod-preset-dialog__save-template-card {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    padding: 1.25rem;
    width: 100%;
    max-width: 24rem;
    margin: 0 1rem;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  }

  .vod-preset-dialog__save-template-input {
    width: 100%;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    outline: none;
    margin-bottom: 0.75rem;
    transition: border-color 150ms ease;
  }

  .vod-preset-dialog__save-template-input:focus {
    border-color: var(--sidebar-accent);
  }

  .vod-preset-dialog__save-template-input::placeholder {
    color: var(--sidebar-text-muted);
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
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

<!-- Global styles for template dropdown panel (rendered via Teleport to body) -->
<style>
  div.fixed.bg-popover {
    z-index: 10050 !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
  }

  div.fixed.bg-popover button {
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    border-radius: 5px !important;
    padding: 0.5rem 0.75rem !important;
  }

  div.fixed.bg-popover button:hover {
    background-color: var(--sidebar-hover) !important;
  }

  div.fixed.bg-popover button.bg-primary\/10 {
    background-color: rgba(14, 165, 233, 0.15) !important;
    color: var(--sidebar-accent) !important;
  }
</style>
