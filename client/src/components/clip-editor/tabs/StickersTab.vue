<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Stickers & Emojis</h3>
      <p class="text-xs text-white/50 mb-4">
        Add emojis, stickers, and images to your clip. Drag in preview to reposition.
      </p>
    </div>

    <!-- Add Image Button -->
    <div>
      <button
        @click="openImagePicker"
        class="w-full py-3 border-2 border-dashed border-white/20 hover:border-violet-500/50 rounded-lg text-sm text-white/60 hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
      >
        <Plus :size="16" />
        Add Image
      </button>
    </div>

    <!-- Image Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showImagePicker"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
        @click.self="closeImagePicker"
      >
        <div class="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-md mx-4 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 class="text-sm font-medium text-white">Add Image</h3>
            <button @click="closeImagePicker" class="p-1 hover:bg-white/10 rounded transition-colors">
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
                class="w-full p-3 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-sm text-cyan-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Loader2 v-if="isUploading" :size="16" class="animate-spin" />
                <Upload v-else :size="16" />
                {{ isUploading ? 'Uploading...' : 'Upload New Image' }}
              </button>
              <p class="text-[10px] text-white/40 mt-1.5 text-center">PNG, JPG, WebP, GIF, BMP, TIFF</p>
            </div>

            <!-- Divider -->
            <div class="flex items-center gap-3">
              <div class="h-px flex-1 bg-white/10"></div>
              <span class="text-xs text-white/40">or select from library</span>
              <div class="h-px flex-1 bg-white/10"></div>
            </div>

            <!-- Image Library -->
            <div>
              <div v-if="loadingAssets" class="flex items-center justify-center py-8">
                <Loader2 :size="20" class="animate-spin text-white/40" />
              </div>

              <div v-else-if="imageAssets.length === 0" class="py-8 text-center">
                <ImageIcon :size="32" class="mx-auto text-white/20 mb-2" />
                <p class="text-sm text-white/40">No image assets yet</p>
                <p class="text-xs text-white/30 mt-1">Upload images to build your library</p>
              </div>

              <div v-else class="grid grid-cols-3 gap-2">
                <button
                  v-for="asset in imageAssets"
                  :key="asset.id"
                  @click="selectAsset(asset)"
                  class="aspect-square bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 rounded-lg transition-colors overflow-hidden group relative"
                >
                  <img :src="getAssetThumbnail(asset)" :alt="asset.name" class="w-full h-full object-contain" />
                  <div
                    class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center"
                  >
                    <Plus :size="20" class="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div class="absolute bottom-0 left-0 right-0 p-1 bg-gradient-to-t from-black/80 to-transparent">
                    <p class="text-[9px] text-white/70 truncate">{{ asset.name }}</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Stickers List -->
    <div v-if="stickers.length > 0" class="space-y-3">
      <h4 class="text-sm font-medium text-white">Your Stickers</h4>

      <div v-for="sticker in stickers" :key="sticker.id" class="p-4 bg-white/5 rounded-lg border border-white/10">
        <div class="flex items-start justify-between mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 flex items-center justify-center bg-white/5 rounded">
              <span v-if="sticker.stickerType === 'emoji'" class="text-2xl">
                {{ sticker.stickerPath }}
              </span>
              <img v-else :src="sticker.stickerPath" class="w-full h-full object-contain" alt="Sticker" />
            </div>
            <div>
              <div class="text-sm text-white">
                {{ sticker.stickerType === 'emoji' ? 'Emoji' : 'Sticker' }}
              </div>
              <div class="text-xs text-white/50">
                {{ formatTime(sticker.startTime) }} - {{ formatTime(sticker.endTime) }}
              </div>
            </div>
          </div>
          <button @click="emit('deleteSticker', sticker.id)" class="p-1.5 rounded hover:bg-white/10 transition-colors">
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
                : sticker.perRatioConfigs?.[ratio]
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-white/10 text-white/60 hover:bg-white/20 hover:text-white',
            ]"
          >
            {{ ratio }}
            <span v-if="sticker.perRatioConfigs?.[ratio]" class="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span>
          </button>
        </div>

        <!-- Timing -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-white/60 mb-1">Start</label>
            <input
              type="number"
              :value="sticker.startTime"
              @input="(e) => updateSticker(sticker.id, 'startTime', parseFloat((e.target as HTMLInputElement).value))"
              step="0.1"
              min="0"
              :max="duration"
              class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
            />
          </div>
          <div>
            <label class="block text-xs text-white/60 mb-1">End</label>
            <input
              type="number"
              :value="sticker.endTime"
              @input="(e) => updateSticker(sticker.id, 'endTime', parseFloat((e.target as HTMLInputElement).value))"
              step="0.1"
              :min="sticker.startTime"
              :max="duration"
              class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import { Upload, Trash2, Plus, X, Loader2, Image as ImageIcon } from 'lucide-vue-next';
  import type { Sticker, ManualFramingConfigs } from '@/types';
  import { getAllImageAssets, type ImageAsset } from '@/services/database';
  import { useImageAssetOperations } from '@/composables/useImageAssetOperations';
  import { invoke } from '@tauri-apps/api/core';

  const props = defineProps<{
    stickers: Sticker[];
    currentTime: number;
    duration: number;
    previewAspectRatio: string; // Currently previewed aspect ratio
    selectedAspectRatios: string[]; // All selected aspect ratios
    framingConfigs: ManualFramingConfigs; // Framing configurations per aspect ratio
  }>();

  const emit = defineEmits<{
    (e: 'addSticker', stickerPath: string, type: 'emoji' | 'image' | 'gif'): void;
    (e: 'updateSticker', stickerId: string, updates: Partial<Sticker>): void;
    (e: 'deleteSticker', stickerId: string): void;
    (e: 'update:previewAspectRatio', ratio: string): void;
  }>();

  // Image picker state
  const showImagePicker = ref(false);
  const imageAssets = ref<ImageAsset[]>([]);
  const loadingAssets = ref(false);
  const isUploading = ref(false);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const { uploadImageAsset, onUploadComplete } = useImageAssetOperations();

  const popularEmojis = [
    '😀',
    '😂',
    '🤣',
    '😍',
    '🥰',
    '😎',
    '🤩',
    '🥳',
    '🔥',
    '💯',
    '⭐',
    '✨',
    '💫',
    '🎉',
    '🎊',
    '🏆',
    '❤️',
    '💜',
    '💙',
    '💚',
    '💛',
    '🧡',
    '🖤',
    '💗',
    '👍',
    '👏',
    '🙌',
    '💪',
    '🤝',
    '✌️',
    '🤟',
    '👊',
  ];

  // Check if an aspect ratio has been configured with custom framing
  function isRatioConfigured(ratio: string): boolean {
    const config = props.framingConfigs[ratio as keyof ManualFramingConfigs];
    return !!(config && config.regions && config.regions.length > 0);
  }

  // Get list of aspect ratios that have been configured with custom framing
  const configuredAspectRatios = computed(() => {
    return props.selectedAspectRatios.filter((ratio) => isRatioConfigured(ratio));
  });

  // Switch preview to a specific aspect ratio
  function switchToRatio(ratio: string) {
    emit('update:previewAspectRatio', ratio);
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Image picker functions
  async function openImagePicker() {
    showImagePicker.value = true;
    await loadImageAssets();
  }

  function closeImagePicker() {
    showImagePicker.value = false;
  }

  async function loadImageAssets() {
    loadingAssets.value = true;
    try {
      imageAssets.value = await getAllImageAssets();
      // Load thumbnails for all assets
      for (const asset of imageAssets.value) {
        await loadAssetThumbnail(asset);
      }
    } catch (err) {
      console.error('[StickersTab] Failed to load image assets:', err);
    } finally {
      loadingAssets.value = false;
    }
  }

  async function loadAssetThumbnail(asset: ImageAsset) {
    if (!thumbnailCache.value.has(asset.id)) {
      try {
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: asset.file_path,
        });
        thumbnailCache.value.set(asset.id, dataUrl);
      } catch (err) {
        console.warn('[StickersTab] Failed to load asset thumbnail:', asset.id, err);
      }
    }
  }

  function getAssetThumbnail(asset: ImageAsset): string {
    return thumbnailCache.value.get(asset.id) || '';
  }

  async function handleUploadNew() {
    isUploading.value = true;
    try {
      const result = await uploadImageAsset();
      if (result.success && result.imageAssetId) {
        // Reload assets to include the new one
        await loadImageAssets();
        // Find and select the newly uploaded asset
        const newAsset = imageAssets.value.find((a) => a.id === result.imageAssetId);
        if (newAsset) {
          await selectAsset(newAsset);
        }
      }
    } catch (err) {
      console.error('[StickersTab] Upload failed:', err);
    } finally {
      isUploading.value = false;
    }
  }

  async function selectAsset(asset: ImageAsset) {
    try {
      // Get the streaming URL for the image file
      const port = await invoke<number>('get_video_server_port');
      const encodedPath = btoa(unescape(encodeURIComponent(asset.file_path)));
      const imageUrl = `http://localhost:${port}/video/${encodedPath}`;

      // Determine if it's a gif
      const isGif = asset.file_path.toLowerCase().endsWith('.gif') || asset.mime_type?.includes('gif');
      const type = isGif ? 'gif' : 'image';

      emit('addSticker', imageUrl, type);
      closeImagePicker();
    } catch (err) {
      console.error('[StickersTab] Failed to select asset:', err);
    }
  }

  function updateSticker(stickerId: string, key: string, value: any) {
    emit('updateSticker', stickerId, { [key]: value });
  }

  // Register for upload completion to refresh the asset list
  let unregisterUploadCallback: (() => void) | null = null;

  onMounted(() => {
    unregisterUploadCallback = onUploadComplete(() => {
      if (showImagePicker.value) {
        loadImageAssets();
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
  select {
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1.5em 1.5em;
    padding-right: 2.5rem;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }

  select option {
    background-color: #18181b;
    color: white;
  }
</style>
