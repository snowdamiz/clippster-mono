<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-3">Watermark</h3>
      <p class="text-xs text-white/50 mb-4">Add a watermark to your clip. Position and configure per aspect ratio.</p>
    </div>

    <!-- Add Watermark Button -->
    <div v-if="watermarks.length === 0">
      <button
        @click="openWatermarkPicker"
        class="w-full py-3 border-2 border-dashed border-white/20 hover:border-violet-500/50 rounded-lg text-sm text-white/60 hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
      >
        <Plus :size="16" />
        Add Watermark
      </button>
    </div>

    <!-- Watermark Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showWatermarkPicker"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
        @click.self="closeWatermarkPicker"
      >
        <div class="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-md mx-4 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 class="text-sm font-medium text-white">Select Watermark</h3>
            <button @click="closeWatermarkPicker" class="p-1 hover:bg-white/10 rounded transition-colors">
              <X :size="16" class="text-white/60" />
            </button>
          </div>

          <!-- Content -->
          <div class="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
            <!-- Upload New -->
            <div>
              <button
                @click="handleUploadNew"
                :disabled="isUploading"
                class="w-full p-3 bg-violet-500/10 hover:bg-violet-500/20 border border-violet-500/30 rounded-lg text-sm text-violet-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Loader2 v-if="isUploading" :size="16" class="animate-spin" />
                <Upload v-else :size="16" />
                {{ isUploading ? 'Uploading...' : 'Upload New Watermark' }}
              </button>
              <p class="text-[10px] text-white/40 mt-1.5 text-center">PNG, JPG, WebP, GIF</p>
            </div>

            <!-- Divider -->
            <div class="flex items-center gap-3">
              <div class="h-px flex-1 bg-white/10"></div>
              <span class="text-xs text-white/40">or select from library</span>
              <div class="h-px flex-1 bg-white/10"></div>
            </div>

            <!-- Watermark Library -->
            <div>
              <div v-if="loadingAssets" class="flex items-center justify-center py-8">
                <Loader2 :size="20" class="animate-spin text-white/40" />
              </div>

              <div v-else-if="watermarkImages.length === 0" class="py-8 text-center">
                <ImageIcon :size="32" class="mx-auto text-white/20 mb-2" />
                <p class="text-sm text-white/40">No watermarks yet</p>
                <p class="text-xs text-white/30 mt-1">Upload watermarks to build your library</p>
              </div>

              <div v-else class="grid grid-cols-3 gap-2">
                <button
                  v-for="wm in watermarkImages"
                  :key="wm.id"
                  @click="selectWatermark(wm)"
                  class="aspect-square bg-white/5 hover:bg-white/10 border border-white/10 hover:border-violet-500/30 rounded-lg transition-colors overflow-hidden group relative"
                >
                  <img :src="getWatermarkThumbnail(wm)" :alt="wm.name" class="w-full h-full object-contain" />
                  <div
                    class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"
                  >
                    <Plus :size="20" class="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div class="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent">
                    <p class="text-[9px] text-white/70 truncate">{{ wm.name }}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Watermarks List -->
    <div v-if="watermarks.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-white">Active Watermark</h4>
        <button
          @click="openWatermarkPicker"
          class="px-2 py-1 text-xs text-violet-400 hover:text-violet-300 hover:bg-violet-500/10 rounded transition-colors"
        >
          Change
        </button>
      </div>

      <div v-for="watermark in watermarks" :key="watermark.id" class="p-4 bg-white/5 rounded-lg border border-white/10">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 flex items-center justify-center bg-white/5 rounded overflow-hidden">
              <img :src="watermark.watermarkPath" class="max-w-full max-h-full object-contain" alt="Watermark" />
            </div>
            <div class="text-sm text-white">Watermark</div>
          </div>
          <button
            @click="emit('deleteWatermark', watermark.id)"
            class="p-1.5 rounded hover:bg-white/10 transition-colors"
          >
            <Trash2 :size="14" class="text-red-400" />
          </button>
        </div>

        <!-- Aspect Ratio Configuration Buttons -->
        <div v-if="configuredAspectRatios.length > 0" class="mb-3 flex flex-wrap items-center gap-2">
          <span class="text-[10px] text-white/40 uppercase tracking-wide">Configure for:</span>
          <button
            @click="switchToRatio('16:9')"
            :class="[
              'px-2 py-1 rounded text-[10px] font-medium transition-all',
              previewAspectRatio === '16:9'
                ? 'bg-violet-500 text-white ring-2 ring-violet-400 ring-offset-1 ring-offset-zinc-900'
                : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white',
            ]"
          >
            16:9
          </button>
          <button
            v-for="ratio in configuredAspectRatios"
            :key="ratio"
            @click="switchToRatio(ratio)"
            :class="[
              'px-2 py-1 rounded text-[10px] font-medium transition-all flex items-center gap-1',
              previewAspectRatio === ratio
                ? 'bg-violet-500 text-white ring-2 ring-violet-400 ring-offset-1 ring-offset-zinc-900'
                : watermark.perRatioConfigs?.[ratio]
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white',
            ]"
          >
            {{ ratio }}
            <span v-if="watermark.perRatioConfigs?.[ratio]" class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
          </button>
        </div>

        <!-- Opacity -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <h5 class="text-xs text-white/60 font-medium">Opacity</h5>
            <span class="text-xs font-mono text-white/70">{{ getWatermarkConfig(watermark).opacity }}%</span>
          </div>
          <input
            type="range"
            :value="getWatermarkConfig(watermark).opacity"
            @input="(e) => updateWatermarkOpacity(watermark.id, parseFloat((e.target as HTMLInputElement).value))"
            min="10"
            max="100"
            step="5"
            class="w-full h-1.5 bg-white/10 rounded appearance-none cursor-pointer slider-watermark"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { Plus, Trash2, X, Loader2, Image as ImageIcon, Upload } from 'lucide-vue-next';
  import type { ClipWatermark, ManualFramingConfigs, WatermarkRatioConfig } from '@/types';
  import { getAllWatermarkImages, type WatermarkImage } from '@/services/database';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import { invoke } from '@tauri-apps/api/core';

  const props = defineProps<{
    watermarks: ClipWatermark[];
    currentTime: number;
    duration: number;
    previewAspectRatio: string;
    selectedAspectRatios: string[];
    framingConfigs: ManualFramingConfigs;
  }>();

  const emit = defineEmits<{
    (e: 'addWatermark', watermarkId: string, filePath: string, previewUrl: string): void;
    (e: 'updateWatermark', watermarkId: string, updates: Partial<ClipWatermark>): void;
    (e: 'deleteWatermark', watermarkId: string): void;
    (e: 'update:previewAspectRatio', ratio: string): void;
  }>();

  // State
  const showWatermarkPicker = ref(false);
  const watermarkImages = ref<WatermarkImage[]>([]);
  const loadingAssets = ref(false);
  const isUploading = ref(false);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const { uploadWatermark, onUploadComplete } = useWatermarkOperations();

  // Check if an aspect ratio has been configured with custom framing
  function isRatioConfigured(ratio: string): boolean {
    const config = props.framingConfigs[ratio as keyof ManualFramingConfigs];
    return !!(config && config.regions && config.regions.length > 0);
  }

  // Get list of aspect ratios that have been configured with custom framing
  const configuredAspectRatios = computed(() => {
    return props.selectedAspectRatios.filter((ratio) => isRatioConfigured(ratio));
  });

  function switchToRatio(ratio: string) {
    emit('update:previewAspectRatio', ratio);
  }

  // Get watermark config for current aspect ratio
  function getWatermarkConfig(watermark: ClipWatermark): WatermarkRatioConfig {
    const ratio = props.previewAspectRatio;
    const perRatioConfig = watermark.perRatioConfigs?.[ratio];

    if (perRatioConfig) {
      return perRatioConfig;
    }

    // Fall back to default values
    return {
      position: watermark.position,
      scale: watermark.scale,
      opacity: watermark.opacity,
    };
  }

  function updateWatermarkOpacity(watermarkId: string, opacity: number) {
    const watermark = props.watermarks.find((w) => w.id === watermarkId);
    if (!watermark) return;

    const ratio = props.previewAspectRatio;
    const currentConfig = getWatermarkConfig(watermark);
    const perRatioConfigs = { ...watermark.perRatioConfigs };
    perRatioConfigs[ratio] = {
      ...currentConfig,
      opacity,
    };

    emit('updateWatermark', watermarkId, { perRatioConfigs });
  }

  // Watermark picker functions
  async function openWatermarkPicker() {
    showWatermarkPicker.value = true;
    await loadWatermarkImages();
  }

  function closeWatermarkPicker() {
    showWatermarkPicker.value = false;
  }

  async function handleUploadNew() {
    isUploading.value = true;
    try {
      const result = await uploadWatermark();
      if (result.success && result.watermarkId) {
        // Reload watermarks to include the new one
        await loadWatermarkImages();
        // Find and select the newly uploaded watermark
        const newWatermark = watermarkImages.value.find((w) => w.id === result.watermarkId);
        if (newWatermark) {
          await selectWatermark(newWatermark);
        }
      }
    } catch (err) {
      console.error('[WatermarkTab] Upload failed:', err);
    } finally {
      isUploading.value = false;
    }
  }

  async function loadWatermarkImages() {
    loadingAssets.value = true;
    try {
      watermarkImages.value = await getAllWatermarkImages();
      // Load thumbnails for all watermarks
      for (const wm of watermarkImages.value) {
        await loadWatermarkThumbnail(wm);
      }
    } catch (err) {
      console.error('[WatermarkTab] Failed to load watermark images:', err);
    } finally {
      loadingAssets.value = false;
    }
  }

  async function loadWatermarkThumbnail(wm: WatermarkImage) {
    if (!thumbnailCache.value.has(wm.id)) {
      try {
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: wm.file_path,
        });
        thumbnailCache.value.set(wm.id, dataUrl);
      } catch (err) {
        console.warn('[WatermarkTab] Failed to load watermark thumbnail:', wm.id, err);
      }
    }
  }

  function getWatermarkThumbnail(wm: WatermarkImage): string {
    return thumbnailCache.value.get(wm.id) || '';
  }

  async function selectWatermark(wm: WatermarkImage) {
    try {
      // Get the data URL for preview (displayed in editor)
      const dataUrl =
        thumbnailCache.value.get(wm.id) ||
        (await invoke<string>('read_file_as_data_url', {
          filePath: wm.file_path,
        }));

      // Pass both the watermark ID and file path (for export)
      // The dataUrl is used for preview, file_path is stored for export
      emit('addWatermark', wm.id, wm.file_path, dataUrl);
      closeWatermarkPicker();
    } catch (err) {
      console.error('[WatermarkTab] Failed to select watermark:', err);
    }
  }

  // Register for upload completion to refresh the watermark list
  let unregisterUploadCallback: (() => void) | null = null;

  onMounted(async () => {
    await loadWatermarkImages();
    unregisterUploadCallback = onUploadComplete(() => {
      if (showWatermarkPicker.value) {
        loadWatermarkImages();
      }
    });
  });

  // Cleanup on unmount
  onUnmounted(() => {
    if (unregisterUploadCallback) {
      unregisterUploadCallback();
    }
  });
</script>

<style scoped>
  .slider-watermark {
    -webkit-appearance: none;
    appearance: none;
    outline: none;
  }

  .slider-watermark::-webkit-slider-track {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.1);
  }

  .slider-watermark::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.15s ease;
  }

  .slider-watermark::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  .slider-watermark::-moz-range-track {
    width: 100%;
    height: 6px;
    border-radius: 3px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.1);
    border: none;
  }

  .slider-watermark::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }
</style>
