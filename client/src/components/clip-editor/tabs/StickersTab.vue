<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Stickers & Images</h3>
      <p class="text-xs text-white/50 mb-4">Add images, GIFs, and stickers to your video.</p>
    </div>

    <!-- Active Stickers List -->
    <div v-if="stickers.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-white">Active Stickers</h4>
        <span class="text-[10px] text-white/40">
          {{ stickers.length }} sticker{{ stickers.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <div
        v-for="sticker in stickers"
        :key="sticker.id"
        class="p-3 bg-white/5 rounded-lg border border-white/10"
        :class="{ 'ring-1 ring-cyan-500/50': selectedStickerId === sticker.id }"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <Sticker :size="14" class="text-cyan-400 flex-shrink-0" />
            <span class="text-xs text-white truncate">Sticker {{ sticker.stickerType }}</span>
            <span
              v-if="sticker.stickerType === 'gif'"
              class="text-[10px] px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 rounded"
            >
              GIF
            </span>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="selectSticker(sticker.id)"
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              :class="selectedStickerId === sticker.id ? 'bg-cyan-500/20' : ''"
              title="Edit"
            >
              <Pencil :size="12" :class="selectedStickerId === sticker.id ? 'text-cyan-400' : 'text-white/50'" />
            </button>
            <button
              @click="emit('deleteSticker', sticker.id)"
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Remove"
            >
              <Trash2 :size="12" class="text-red-400" />
            </button>
          </div>
        </div>

        <!-- Quick Info -->
        <div class="flex items-center gap-3 text-[10px] text-white/40">
          <span>{{ formatTime(sticker.startTime) }} - {{ formatTime(sticker.endTime) }}</span>
          <span>{{ Math.round(sticker.scale * 100) }}%</span>
        </div>

        <!-- Aspect Ratio Config Buttons -->
        <div v-if="configuredAspectRatios.length > 0" class="mt-2 flex flex-wrap items-center gap-1.5">
          <span class="text-[9px] text-white/40 uppercase tracking-wide">Configure:</span>
          <button
            @click="switchToRatio('16:9')"
            :class="[
              'px-1.5 py-0.5 rounded text-[9px] font-medium transition-all',
              previewAspectRatio === '16:9'
                ? 'bg-cyan-500 text-white ring-1 ring-cyan-400'
                : 'bg-white/10 text-white/60 hover:bg-white/20',
            ]"
          >
            16:9
          </button>
          <button
            v-for="ratio in configuredAspectRatios"
            :key="ratio"
            @click="switchToRatio(ratio)"
            :class="[
              'px-1.5 py-0.5 rounded text-[9px] font-medium transition-all flex items-center gap-0.5',
              previewAspectRatio === ratio
                ? 'bg-cyan-500 text-white ring-1 ring-cyan-400'
                : sticker.perRatioConfigs?.[ratio]
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-white/10 text-white/60 hover:bg-white/20',
            ]"
          >
            {{ ratio }}
            <span v-if="sticker.perRatioConfigs?.[ratio]" class="w-1 h-1 bg-emerald-400 rounded-full"></span>
          </button>
        </div>

        <!-- Expanded Edit Panel -->
        <div v-if="selectedStickerId === sticker.id" class="mt-3 pt-3 border-t border-white/10 space-y-3">
          <!-- Timing -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Start Time</label>
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  :value="sticker.startTime.toFixed(1)"
                  @input="
                    (e) => updateSticker(sticker.id, 'startTime', parseFloat((e.target as HTMLInputElement).value))
                  "
                  step="0.1"
                  min="0"
                  :max="duration"
                  class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                />
                <span class="text-[10px] text-white/40">s</span>
              </div>
            </div>
            <div>
              <label class="block text-[10px] text-white/50 mb-1">End Time</label>
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  :value="sticker.endTime.toFixed(1)"
                  @input="(e) => updateSticker(sticker.id, 'endTime', parseFloat((e.target as HTMLInputElement).value))"
                  step="0.1"
                  :min="sticker.startTime"
                  :max="duration"
                  class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                />
                <span class="text-[10px] text-white/40">s</span>
              </div>
            </div>
          </div>

          <!-- Scale & Rotation -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Scale</label>
              <div class="flex items-center gap-1">
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  :value="getStickerConfig(sticker).scale"
                  @input="
                    (e) => updateStickerConfig(sticker.id, 'scale', parseFloat((e.target as HTMLInputElement).value))
                  "
                  class="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span class="text-[10px] text-white/50 w-8 text-right">
                  {{ Math.round(getStickerConfig(sticker).scale * 100) }}%
                </span>
              </div>
            </div>
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Rotation</label>
              <div class="flex items-center gap-1">
                <input
                  type="range"
                  min="-180"
                  max="180"
                  step="5"
                  :value="getStickerConfig(sticker).rotation"
                  @input="
                    (e) => updateStickerConfig(sticker.id, 'rotation', parseFloat((e.target as HTMLInputElement).value))
                  "
                  class="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
                />
                <span class="text-[10px] text-white/50 w-8 text-right">{{ getStickerConfig(sticker).rotation }}°</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-px bg-white/10"></div>

    <!-- Image Library Section -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-white">Image Library</h4>
      </div>

      <!-- Upload Button -->
      <button
        @click="handleUploadNew"
        :disabled="isUploading"
        class="w-full py-2.5 border-2 border-dashed border-white/20 hover:border-cyan-500/50 rounded-lg text-sm text-white/60 hover:text-cyan-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Loader2 v-if="isUploading" :size="16" class="animate-spin" />
        <Upload v-else :size="16" />
        {{ isUploading ? 'Uploading...' : 'Upload Image' }}
      </button>

      <!-- Search -->
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search images..."
          class="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-cyan-500/50"
        />
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
        <button
          @click="activeTab = 'personal'"
          :class="[
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            activeTab === 'personal' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          My Images ({{ personalImagesFiltered.length }})
        </button>
        <button
          v-if="hasOrganizations"
          @click="activeTab = 'organization'"
          :class="[
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            activeTab === 'organization' ? 'bg-teal-500/20 text-teal-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          Organization ({{ orgImagesFiltered.length }})
        </button>
      </div>

      <!-- Image Grid -->
      <div class="max-h-[300px] overflow-y-auto pr-1">
        <!-- Loading -->
        <div v-if="loadingAssets" class="flex items-center justify-center py-6">
          <Loader2 :size="20" class="animate-spin text-white/40" />
        </div>

        <!-- Personal Images -->
        <template v-else-if="activeTab === 'personal'">
          <div v-if="personalImagesFiltered.length === 0" class="py-6 text-center">
            <ImageIcon :size="24" class="mx-auto text-white/20 mb-2" />
            <p class="text-xs text-white/40">No images yet</p>
            <p class="text-[10px] text-white/30 mt-1">Upload images to build your library</p>
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="asset in personalImagesFiltered"
              :key="asset.id"
              @click="selectAsset(asset)"
              class="group p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-500/30 rounded-lg transition-all cursor-pointer"
            >
              <div class="flex items-center gap-3">
                <!-- Thumbnail -->
                <div class="w-16 h-10 rounded overflow-hidden bg-black/50 flex-shrink-0">
                  <img
                    v-if="getThumbnail(asset)"
                    :src="getThumbnail(asset)"
                    :alt="asset.name"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <ImageIcon :size="14" class="text-white/30" />
                  </div>
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-white truncate">{{ asset.name }}</p>
                  <p class="text-xs text-white/40">
                    {{ asset.width && asset.height ? `${asset.width}x${asset.height}` : 'Image' }}
                    <span v-if="isGifAsset(asset)" class="text-cyan-400">• GIF</span>
                  </p>
                </div>

                <!-- Add button -->
                <button
                  @click.stop="selectAsset(asset)"
                  class="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Add to timeline"
                >
                  <Plus :size="14" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Organization Images -->
        <template v-else-if="activeTab === 'organization'">
          <div v-if="orgImagesFiltered.length === 0" class="py-6 text-center">
            <Building2 :size="24" class="mx-auto text-white/20 mb-2" />
            <p class="text-xs text-white/40">No organization images</p>
            <p class="text-[10px] text-white/30 mt-1">Organization admins can upload image assets</p>
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="asset in orgImagesFiltered"
              :key="asset.id"
              @click="selectAsset(asset)"
              class="group p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-teal-500/30 rounded-lg transition-all cursor-pointer"
            >
              <div class="flex items-center gap-3">
                <!-- Thumbnail -->
                <div class="w-16 h-10 rounded overflow-hidden bg-black/50 flex-shrink-0">
                  <img
                    v-if="getThumbnail(asset)"
                    :src="getThumbnail(asset)"
                    :alt="asset.name"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <ImageIcon :size="14" class="text-white/30" />
                  </div>
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <p class="text-sm text-white truncate">{{ asset.name }}</p>
                    <Building2 :size="10" class="text-teal-400 flex-shrink-0" />
                  </div>
                  <p class="text-xs text-white/40">
                    {{ asset.width && asset.height ? `${asset.width}x${asset.height}` : 'Image' }}
                    <span v-if="asset.organization_name" class="text-teal-400/60">• {{ asset.organization_name }}</span>
                  </p>
                </div>

                <!-- Add button -->
                <button
                  @click.stop="selectAsset(asset)"
                  class="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Add to timeline"
                >
                  <Plus :size="14" />
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted } from 'vue';
  import {
    Sticker,
    Plus,
    Trash2,
    Pencil,
    Upload,
    Search,
    Loader2,
    Building2,
    Image as ImageIcon,
    Sparkles,
  } from 'lucide-vue-next';
  import type { Sticker as StickerType, ManualFramingConfigs } from '@/types';
  import { getAllImageAssets, type ImageAsset } from '@/services/database';
  import { useImageAssetOperations } from '@/composables/useImageAssetOperations';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { useAuthStore } from '@/stores/auth';
  import { invoke } from '@tauri-apps/api/core';

  // Extended ImageAsset type that includes org asset properties
  interface ImageItem extends Omit<ImageAsset, 'id'> {
    id: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
    thumbnail_path?: string | null;
  }

  // Auth store for checking org memberships
  const authStore = useAuthStore();

  const props = defineProps<{
    stickers: StickerType[];
    currentTime: number;
    duration: number;
    previewAspectRatio: string;
    selectedAspectRatios: string[];
    framingConfigs: ManualFramingConfigs;
  }>();

  const emit = defineEmits<{
    (e: 'addSticker', stickerPath: string, type: 'emoji' | 'image' | 'gif'): void;
    (e: 'updateSticker', stickerId: string, updates: Partial<StickerType>): void;
    (e: 'deleteSticker', stickerId: string): void;
    (e: 'selectSticker', stickerId: string): void;
    (e: 'update:previewAspectRatio', ratio: string): void;
  }>();

  // State
  const selectedStickerId = ref<string | null>(null);
  const personalImages = ref<ImageItem[]>([]);
  const orgImages = ref<ImageItem[]>([]);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const loadingAssets = ref(false);
  const isUploading = ref(false);
  const searchQuery = ref('');
  const activeTab = ref<'personal' | 'organization'>('personal');
  const { uploadImageAsset, onUploadComplete } = useImageAssetOperations();


  // Computed
  const hasOrganizations = computed(() => {
    const user = authStore.user;
    return user && (user.owned_organization_id || user.created_by_organization_id);
  });

  const selectedSticker = computed(() => {
    if (!selectedStickerId.value) return null;
    return props.stickers.find((s) => s.id === selectedStickerId.value) || null;
  });

  const personalImagesFiltered = computed(() => {
    if (!searchQuery.value) return personalImages.value;
    const query = searchQuery.value.toLowerCase();
    return personalImages.value.filter((a) => a.name.toLowerCase().includes(query));
  });

  const orgImagesFiltered = computed(() => {
    if (!searchQuery.value) return orgImages.value;
    const query = searchQuery.value.toLowerCase();
    return orgImages.value.filter(
      (a) => a.name.toLowerCase().includes(query) || a.organization_name?.toLowerCase().includes(query)
    );
  });

  function isRatioConfigured(ratio: string): boolean {
    const config = props.framingConfigs[ratio as keyof ManualFramingConfigs];
    return !!(config && config.regions && config.regions.length > 0);
  }

  const configuredAspectRatios = computed(() => {
    return props.selectedAspectRatios.filter((ratio) => isRatioConfigured(ratio));
  });

  // Methods
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getStickerConfig(sticker: StickerType) {
    const ratio = props.previewAspectRatio;
    const ratioConfig = sticker.perRatioConfigs?.[ratio];
    return ratioConfig || { position: sticker.position, scale: sticker.scale, rotation: sticker.rotation };
  }

  function selectSticker(id: string) {
    selectedStickerId.value = selectedStickerId.value === id ? null : id;
    if (selectedStickerId.value) {
      emit('selectSticker', id);
    }
  }

  function switchToRatio(ratio: string) {
    emit('update:previewAspectRatio', ratio);
  }

  function updateSticker(stickerId: string, key: keyof StickerType, value: any) {
    emit('updateSticker', stickerId, { [key]: value });
  }

  function updateStickerConfig(stickerId: string, key: 'scale' | 'rotation' | 'position', value: any) {
    const sticker = props.stickers.find((s) => s.id === stickerId);
    if (!sticker) return;

    const ratio = props.previewAspectRatio;
    const perRatioConfigs = sticker.perRatioConfigs ? { ...sticker.perRatioConfigs } : {};
    const currentConfig = perRatioConfigs[ratio] || {
      position: { ...sticker.position },
      scale: sticker.scale,
      rotation: sticker.rotation,
    };

    if (key === 'position') {
      currentConfig.position = value;
    } else {
      currentConfig[key] = value;
    }
    perRatioConfigs[ratio] = currentConfig;

    emit('updateSticker', stickerId, { perRatioConfigs });
  }

  function getThumbnail(asset: ImageItem): string {
    const cached = thumbnailCache.value.get(asset.id);
    if (cached) return cached;

    if (asset.isOrgAsset && asset.thumbnail_path) {
      return asset.thumbnail_path;
    }
    if (asset.isOrgAsset && asset.serverUrl) {
      return asset.serverUrl;
    }

    return '';
  }

  function isGifAsset(asset: ImageItem): boolean {
    return asset.file_path?.toLowerCase().endsWith('.gif') || asset.mime_type?.includes('gif') || false;
  }

  async function loadThumbnail(asset: ImageItem): Promise<void> {
    if (thumbnailCache.value.has(asset.id)) return;

    try {
      if (asset.isOrgAsset) {
        const url = asset.thumbnail_path || asset.serverUrl || asset.file_path;
        if (url) {
          thumbnailCache.value.set(asset.id, url);
        }
      } else if (asset.file_path) {
        const exists = await invoke<boolean>('check_file_exists', { path: asset.file_path });
        if (exists) {
          const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: asset.file_path });
          thumbnailCache.value.set(asset.id, dataUrl);
        }
      }
    } catch (err) {
      console.warn('[StickersTab] Failed to load thumbnail:', asset.id, err);
    }
  }

  async function loadImageAssets() {
    loadingAssets.value = true;
    try {
      const localAssets = await getAllImageAssets();
      personalImages.value = localAssets.filter((a) => !a.organization_id).map((a) => ({ ...a, isOrgAsset: false }));

      if (hasOrganizations.value) {
        try {
          const serverResponse = await getUserOrganizationAssets();
          if (serverResponse.success && serverResponse.assets) {
            orgImages.value = serverResponse.assets
              .filter((a: ServerOrganizationAsset) => a.asset_type === 'image')
              .map((a: ServerOrganizationAsset) => ({
                id: `org_${a.id}`,
                name: a.name,
                file_path: a.url,
                thumbnail_path: a.thumbnail_url || null,
                organization_id: String(a.organization_id),
                organization_name: a.organization_name,
                width: a.width,
                height: a.height,
                file_size: null,
                mime_type: a.mime_type,
                created_at: new Date(a.inserted_at).getTime(),
                updated_at: new Date(a.updated_at).getTime(),
                isOrgAsset: true,
                serverId: a.id,
                serverUrl: a.url,
              }));
          }
        } catch (orgError) {
          console.warn('[StickersTab] Failed to load organization images:', orgError);
        }
      }

      const allAssets = [...personalImages.value, ...orgImages.value];
      await Promise.all(allAssets.map((asset) => loadThumbnail(asset)));
    } catch (err) {
      console.error('[StickersTab] Failed to load image assets:', err);
    } finally {
      loadingAssets.value = false;
    }
  }

  async function handleUploadNew() {
    isUploading.value = true;
    try {
      const result = await uploadImageAsset();
      if (result.success) {
        await loadImageAssets();
      }
    } catch (err) {
      console.error('[StickersTab] Upload failed:', err);
    } finally {
      isUploading.value = false;
    }
  }

  async function selectAsset(asset: ImageItem) {
    try {
      let imageUrl: string;

      if (asset.isOrgAsset) {
        imageUrl = asset.serverUrl || asset.file_path;
      } else {
        const port = await invoke<number>('get_video_server_port');
        const encodedPath = btoa(unescape(encodeURIComponent(asset.file_path)));
        imageUrl = `http://localhost:${port}/video/${encodedPath}`;
      }

      const isGif = asset.file_path.toLowerCase().endsWith('.gif') || asset.mime_type?.includes('gif');
      const type = isGif ? 'gif' : 'image';

      emit('addSticker', imageUrl, type);
    } catch (err) {
      console.error('[StickersTab] Failed to select asset:', err);
    }
  }

  let unregisterUploadCallback: (() => void) | null = null;

  onMounted(() => {
    loadImageAssets();
    unregisterUploadCallback = onUploadComplete(() => {
      loadImageAssets();
    });
  });

  onUnmounted(() => {
    if (unregisterUploadCallback) {
      unregisterUploadCallback();
    }
  });
</script>

<style scoped>
  input[type='range'] {
    -webkit-appearance: none;
    appearance: none;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 4px;
  }

  input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
  }

  input[type='range']::-moz-range-thumb {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
  }

  select {
    background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
    background-position: right 0.5rem center;
    background-repeat: no-repeat;
    background-size: 1.5em 1.5em;
    padding-right: 2rem;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }

  select option {
    background-color: #18181b;
    color: white;
  }

  .overflow-y-auto::-webkit-scrollbar {
    width: 4px;
  }

  .overflow-y-auto::-webkit-scrollbar-track {
    background: transparent;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 2px;
  }

  .overflow-y-auto::-webkit-scrollbar-thumb:hover {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
