<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[10001]">
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl w-full max-w-5xl mx-4 border border-white/10 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <!-- Top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-emerald-500 via-blue-500 to-violet-500 flex-shrink-0" />

            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 flex items-center justify-center border border-emerald-500/30"
                >
                  <LayoutDashboardIcon class="h-5 w-5 text-emerald-400" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-white">VOD Pre-Edit Settings</h2>
                  <p class="text-xs text-zinc-400">
                    Configure aspect ratio, framing, overlays &amp; watermark before clip detection
                  </p>
                </div>
              </div>
              <button
                @click="close"
                class="p-2 hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-800"
                title="Close"
              >
                <XIcon class="h-5 w-5 text-zinc-400 hover:text-white" />
              </button>
            </div>

            <!-- Main Content - Scrollable -->
            <div class="flex-1 overflow-y-auto">
              <!-- Section 1: Aspect Ratio & Template -->
              <div class="px-5 py-4 border-b border-zinc-800/50">
                <div class="flex items-center gap-2 mb-3">
                  <RatioIcon class="w-4 h-4 text-blue-400" />
                  <h3 class="text-sm font-semibold text-white">Aspect Ratio & Template</h3>
                </div>

                <div class="flex items-center gap-4">
                  <!-- Aspect Ratio Buttons -->
                  <div class="flex gap-2">
                    <button
                      v-for="ratio in aspectRatioOptions"
                      :key="ratio.value"
                      @click="selectedAspectRatio = ratio.value"
                      class="px-3 py-2 text-xs font-medium rounded-lg border transition-all"
                      :class="selectedAspectRatio === ratio.value
                        ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                        : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'"
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
                  <div class="flex-1 flex items-center gap-2">
                    <select
                      v-model="selectedTemplateId"
                      @change="onTemplateSelected"
                      class="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-blue-500"
                    >
                      <option value="">— No template —</option>
                      <option v-for="t in availableTemplates" :key="t.id" :value="t.id">
                        {{ t.name }} ({{ t.targetAspectRatio }})
                      </option>
                    </select>
                    <button
                      @click="showSaveTemplate = true"
                      class="px-3 py-2 text-xs font-medium text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <SaveIcon class="w-3.5 h-3.5 inline mr-1" />
                      Save Template
                    </button>
                  </div>
                </div>
              </div>

              <!-- Section 2: Framing -->
              <div class="px-5 py-4 border-b border-zinc-800/50">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <CropIcon class="w-4 h-4 text-violet-400" />
                    <h3 class="text-sm font-semibold text-white">Framing</h3>
                    <span class="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                      {{ framingRegions.length }} region{{ framingRegions.length !== 1 ? 's' : '' }}
                    </span>
                  </div>
                  <button
                    @click="openFramingEditor"
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-400 hover:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg transition-colors"
                  >
                    <LayoutDashboardIcon class="w-3.5 h-3.5" />
                    {{ framingRegions.length > 0 ? 'Edit Framing' : 'Configure Framing' }}
                  </button>
                </div>

                <!-- Framing Preview -->
                <div v-if="framingRegions.length > 0" class="flex gap-3">
                  <div
                    v-for="(region, idx) in framingRegions"
                    :key="region.id"
                    class="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 border border-zinc-700/50 rounded-lg"
                  >
                    <div class="w-3 h-3 rounded-full" :style="{ backgroundColor: region.color }" />
                    <span class="text-xs text-zinc-300">{{ region.label || `Region ${idx + 1}` }}</span>
                    <span class="text-[10px] text-zinc-500 font-mono">
                      {{ Math.round(region.source.width * 100) }}×{{ Math.round(region.source.height * 100) }}%
                    </span>
                  </div>
                </div>
                <div v-else class="text-xs text-zinc-500 italic">
                  No framing configured — clips will use default center crop for {{ selectedAspectRatio }}
                </div>
              </div>

              <!-- Section 3: Layout Overlays -->
              <div class="px-5 py-4 border-b border-zinc-800/50">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <LayersIcon class="w-4 h-4 text-amber-400" />
                    <h3 class="text-sm font-semibold text-white">Layout Overlays</h3>
                    <span class="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
                      {{ layoutOverlays.length }} overlay{{ layoutOverlays.length !== 1 ? 's' : '' }}
                    </span>
                  </div>
                  <button
                    @click="addLayoutOverlay"
                    class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors"
                  >
                    <PlusIcon class="w-3.5 h-3.5" />
                    Add Overlay
                  </button>
                </div>

                <!-- Overlay List -->
                <div v-if="layoutOverlays.length > 0" class="space-y-2">
                  <div
                    v-for="(overlay, idx) in layoutOverlays"
                    :key="overlay.id"
                    class="flex items-center gap-3 px-3 py-2.5 bg-zinc-800/50 border border-zinc-700/50 rounded-lg group"
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
                      </div>
                    </div>

                    <!-- Controls -->
                    <div class="flex items-center gap-1.5">
                      <div class="flex items-center gap-1">
                        <label class="text-[10px] text-zinc-500">Opacity</label>
                        <input
                          type="range"
                          v-model.number="overlay.opacity"
                          min="0"
                          max="100"
                          class="w-16 h-1 accent-amber-500"
                        />
                      </div>
                      <button
                        @click="removeLayoutOverlay(idx)"
                        class="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors opacity-0 group-hover:opacity-100"
                        title="Remove overlay"
                      >
                        <Trash2Icon class="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                <div v-else class="text-xs text-zinc-500 italic">
                  No layout overlays — add border images, dividers, or decorative elements
                </div>
              </div>

              <!-- Section 4: Watermark -->
              <div class="px-5 py-4">
                <div class="flex items-center gap-2 mb-3">
                  <StampIcon class="w-4 h-4 text-pink-400" />
                  <h3 class="text-sm font-semibold text-white">Watermark</h3>
                </div>

                <!-- Creator Profile Restriction Notice -->
                <div v-if="hasCreatorProfile" class="mb-3 px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <div class="flex items-center gap-2">
                    <InfoIcon class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <span class="text-xs text-blue-300">
                      This project has a creator profile attached. Watermark settings are managed by the creator profile.
                    </span>
                  </div>
                </div>

                <!-- Watermark Mode Selection -->
                <div class="flex gap-2">
                  <button
                    v-if="hasCreatorProfile"
                    @click="watermarkMode = 'creator'"
                    class="flex-1 px-3 py-2.5 text-xs font-medium rounded-lg border transition-all text-center"
                    :class="watermarkMode === 'creator'
                      ? 'bg-pink-600/20 border-pink-500/50 text-pink-300'
                      : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'"
                  >
                    <UserIcon class="w-3.5 h-3.5 inline mr-1" />
                    Creator Profile Watermark
                  </button>

                  <button
                    v-if="!hasCreatorProfile"
                    @click="watermarkMode = 'custom'"
                    class="flex-1 px-3 py-2.5 text-xs font-medium rounded-lg border transition-all text-center"
                    :class="watermarkMode === 'custom'
                      ? 'bg-pink-600/20 border-pink-500/50 text-pink-300'
                      : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'"
                  >
                    <ImageIcon class="w-3.5 h-3.5 inline mr-1" />
                    Custom Watermark
                  </button>

                  <button
                    v-if="!hasCreatorProfile"
                    @click="watermarkMode = 'none'"
                    class="flex-1 px-3 py-2.5 text-xs font-medium rounded-lg border transition-all text-center"
                    :class="watermarkMode === 'none'
                      ? 'bg-zinc-600/20 border-zinc-500/50 text-zinc-300'
                      : 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600'"
                  >
                    <EyeOffIcon class="w-3.5 h-3.5 inline mr-1" />
                    No Watermark
                  </button>
                </div>

                <!-- Custom Watermark Settings (only when mode is 'custom') -->
                <div v-if="watermarkMode === 'custom' && !hasCreatorProfile" class="mt-3 p-3 bg-zinc-800/30 border border-zinc-700/30 rounded-lg">
                  <p class="text-xs text-zinc-400 mb-2">
                    Custom watermark settings will be applied during clip build. Configure position and opacity in the build dialog.
                  </p>
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between px-5 py-4 border-t border-zinc-800 bg-zinc-900/50">
              <div class="text-xs text-zinc-500">
                Target: <span class="text-zinc-300 font-medium">{{ selectedAspectRatio }}</span>
                <span v-if="framingRegions.length > 0" class="ml-2">
                  · {{ framingRegions.length }} region{{ framingRegions.length !== 1 ? 's' : '' }}
                </span>
                <span v-if="layoutOverlays.length > 0" class="ml-2">
                  · {{ layoutOverlays.length }} overlay{{ layoutOverlays.length !== 1 ? 's' : '' }}
                </span>
              </div>
              <div class="flex items-center gap-3">
                <button
                  v-if="hasExistingConfig"
                  @click="clearPreset"
                  class="px-4 py-2 text-sm font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg transition-colors"
                >
                  Remove Pre-Edit
                </button>
                <button
                  @click="close"
                  class="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="confirmConfig"
                  class="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all relative overflow-hidden group bg-gradient-to-r from-emerald-600 to-blue-600 text-white hover:from-emerald-500 hover:to-blue-500"
                >
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <CheckIcon class="h-4 w-4 relative" />
                  <span class="relative">Apply Pre-Edit</span>
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
    :watermark-settings="null"
    @confirm="onFramingConfirmed"
  />

  <!-- Save Template Dialog -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showSaveTemplate" class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[10002]">
        <div class="bg-zinc-900 rounded-xl border border-zinc-700 p-5 w-full max-w-sm mx-4 shadow-2xl">
          <h3 class="text-sm font-semibold text-white mb-3">Save as Template</h3>
          <input
            v-model="templateName"
            class="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 mb-3"
            placeholder="Template name..."
            @keydown.enter="saveTemplate"
          />
          <label class="flex items-center gap-2 text-xs text-zinc-400 mb-4">
            <input
              type="checkbox"
              v-model="templateLinkToCreator"
              class="rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-blue-500"
              :disabled="!hasCreatorProfile"
            />
            Link to creator profile
          </label>
          <div class="flex justify-end gap-2">
            <button
              @click="showSaveTemplate = false"
              class="px-3 py-1.5 text-xs text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              @click="saveTemplate"
              :disabled="!templateName.trim()"
              class="px-3 py-1.5 text-xs font-medium text-emerald-300 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch, computed, reactive } from 'vue';
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
  } from 'lucide-vue-next';
  import ManualPOIEditor from './poi/ManualPOIEditor.vue';
  import type {
    ManualRegion,
    ManualFramingConfig,
    LayoutOverlay,
    ActiveVodPresetConfig,
    VodPreset,
    WatermarkSettings,
  } from '@/types';
  import {
    getAllVodPresets,
    getVodPresetsByCreator,
    getVodPresetsUnlinked,
    createVodPreset,
    updateVodPreset as updateVodPresetDb,
  } from '@/services/database/vod-presets';

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
  const framingRegions = ref<ManualRegion[]>([]);
  const layoutOverlays = ref<LayoutOverlay[]>([]);
  const watermarkMode = ref<'creator' | 'custom' | 'none'>('none');
  const customWatermarkSettings = ref<WatermarkSettings | null>(null);
  const overlayPreviews = reactive<Record<string, string>>({});

  // Template state
  const selectedTemplateId = ref('');
  const availableTemplates = ref<VodPreset[]>([]);
  const showSaveTemplate = ref(false);
  const templateName = ref('');
  const templateLinkToCreator = ref(false);

  // Framing editor state
  const showFramingEditor = ref(false);

  const hasCreatorProfile = computed(() => !!props.creatorProfileId);
  const hasExistingConfig = computed(() => !!props.initialConfig);

  const currentFramingConfig = computed((): ManualFramingConfig | null => {
    if (framingRegions.value.length === 0) return null;
    return {
      mode: 'manual',
      regions: framingRegions.value,
      targetAspectRatio: selectedAspectRatio.value,
      sourceAspectRatio: props.sourceAspectRatio,
    };
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
    framingRegions.value = template.framingConfig?.regions
      ? JSON.parse(JSON.stringify(template.framingConfig.regions))
      : [];
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
    framingRegions.value = JSON.parse(JSON.stringify(config.regions));
  }

  // Layout overlay management
  async function addLayoutOverlay() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        multiple: false,
        filters: [{ name: 'Images', extensions: ['png', 'svg', 'webp', 'jpg', 'jpeg'] }],
      });

      if (!result) return;
      const filePath = result as string;

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
    }
    layoutOverlays.value.splice(index, 1);
  }

  async function loadOverlayPreview(overlay: LayoutOverlay) {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: overlay.imagePath });
      overlayPreviews[overlay.id] = dataUrl;
    } catch (error) {
      console.warn('[VodPresetEditor] Failed to load overlay preview:', error);
    }
  }

  async function loadOverlayPreviews() {
    for (const overlay of layoutOverlays.value) {
      await loadOverlayPreview(overlay);
    }
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
        // Load from initial config or defaults
        if (props.initialConfig) {
          selectedAspectRatio.value = props.initialConfig.targetAspectRatio;
          framingRegions.value = props.initialConfig.framingConfig?.regions
            ? JSON.parse(JSON.stringify(props.initialConfig.framingConfig.regions))
            : [];
          layoutOverlays.value = props.initialConfig.layoutOverlays
            ? JSON.parse(JSON.stringify(props.initialConfig.layoutOverlays))
            : [];
          watermarkMode.value = props.initialConfig.watermarkMode;
          customWatermarkSettings.value = props.initialConfig.customWatermarkSettings
            ? JSON.parse(JSON.stringify(props.initialConfig.customWatermarkSettings))
            : null;
          selectedTemplateId.value = props.initialConfig.presetId || '';
        } else {
          selectedAspectRatio.value = '9:16';
          framingRegions.value = [];
          layoutOverlays.value = [];
          watermarkMode.value = hasCreatorProfile.value ? 'creator' : 'none';
          customWatermarkSettings.value = null;
          selectedTemplateId.value = '';
        }

        // Load templates and overlay previews
        await loadTemplates();
        await loadOverlayPreviews();
      }
    },
    { immediate: true }
  );
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
