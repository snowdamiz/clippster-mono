<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Watermarks</h3>
      <p class="text-xs text-white/50 mb-4">Add logos and watermarks to your video.</p>
    </div>

    <!-- Active Watermarks List -->
    <div v-if="watermarks.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-white">Active Watermarks</h4>
        <span class="text-[10px] text-white/40">
          {{ watermarks.length }} watermark{{ watermarks.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <div
        v-for="watermark in watermarks"
        :key="watermark.id"
        class="p-3 bg-white/5 rounded-lg border border-white/10"
        :class="{ 'ring-1 ring-amber-500/50': selectedWatermarkId === watermark.id }"
      >
        <!-- Header -->
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <div class="w-8 h-8 rounded bg-black/50 overflow-hidden flex-shrink-0">
              <img
                v-if="watermark.previewUrl"
                :src="watermark.previewUrl"
                alt="Watermark"
                class="w-full h-full object-contain"
              />
              <ImageIcon v-else :size="16" class="m-auto text-white/30 mt-1.5" />
            </div>
            <span class="text-xs text-white truncate">Watermark</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="selectWatermark(watermark.id)"
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              :class="selectedWatermarkId === watermark.id ? 'bg-amber-500/20' : ''"
              title="Edit"
            >
              <Pencil :size="12" :class="selectedWatermarkId === watermark.id ? 'text-amber-400' : 'text-white/50'" />
            </button>
            <button
              @click="emit('deleteWatermark', watermark.id)"
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Remove"
            >
              <Trash2 :size="12" class="text-red-400" />
            </button>
          </div>
        </div>

        <!-- Quick Info -->
        <div class="flex items-center gap-3 text-[10px] text-white/40">
          <span>{{ formatTime(watermark.startTime) }} - {{ formatTime(watermark.endTime) }}</span>
          <span>{{ watermark.scale }}%</span>
          <span>{{ watermark.opacity }}% opacity</span>
        </div>

        <!-- Aspect Ratio Config Buttons -->
        <div v-if="configuredAspectRatios.length > 0" class="mt-2 flex flex-wrap items-center gap-1.5">
          <span class="text-[9px] text-white/40 uppercase tracking-wide">Configure:</span>
          <button
            @click="switchToRatio('16:9')"
            :class="[
              'px-1.5 py-0.5 rounded text-[9px] font-medium transition-all',
              previewAspectRatio === '16:9'
                ? 'bg-amber-500 text-white ring-1 ring-amber-400'
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
                ? 'bg-amber-500 text-white ring-1 ring-amber-400'
                : watermark.perRatioConfigs?.[ratio]
                  ? 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30'
                  : 'bg-white/10 text-white/60 hover:bg-white/20',
            ]"
          >
            {{ ratio }}
            <span v-if="watermark.perRatioConfigs?.[ratio]" class="w-1 h-1 bg-emerald-400 rounded-full"></span>
          </button>
        </div>

        <!-- Expanded Edit Panel -->
        <div v-if="selectedWatermarkId === watermark.id" class="mt-3 pt-3 border-t border-white/10 space-y-3">
          <!-- Timing -->
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Start Time</label>
              <div class="flex items-center gap-1">
                <input
                  type="number"
                  :value="watermark.startTime.toFixed(1)"
                  @input="
                    (e) => updateWatermark(watermark.id, 'startTime', parseFloat((e.target as HTMLInputElement).value))
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
                  :value="watermark.endTime.toFixed(1)"
                  @input="
                    (e) => updateWatermark(watermark.id, 'endTime', parseFloat((e.target as HTMLInputElement).value))
                  "
                  step="0.1"
                  :min="watermark.startTime"
                  :max="duration"
                  class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                />
                <span class="text-[10px] text-white/40">s</span>
              </div>
            </div>
          </div>

          <!-- Opacity -->
          <div>
            <label class="block text-[10px] text-white/50 mb-1">Opacity</label>
            <div class="flex items-center gap-1">
              <input
                type="range"
                min="10"
                max="100"
                step="5"
                :value="getWatermarkConfig(watermark).opacity"
                @input="
                  (e) =>
                    updateWatermarkConfig(watermark.id, 'opacity', parseFloat((e.target as HTMLInputElement).value))
                "
                class="flex-1 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer"
              />
              <span class="text-[10px] text-white/50 w-8 text-right">{{ getWatermarkConfig(watermark).opacity }}%</span>
            </div>
          </div>

          <!-- Preview Instructions -->
          <div class="p-2 bg-white/5 rounded-md text-[10px] text-white/40">
            <p>
              <strong class="text-white/60">Drag</strong>
              to reposition in preview
            </p>
            <p>
              <strong class="text-white/60">Drag corners</strong>
              to resize
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Divider (hidden when watermark is active - only one allowed) -->
    <div v-if="watermarks.length === 0" class="h-px bg-white/10"></div>

    <!-- Watermark Library Section (hidden when watermark is active - only one allowed) -->
    <div v-if="watermarks.length === 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-white">Watermark Library</h4>
      </div>

      <!-- Upload Button -->
      <button
        @click="handleUploadNew"
        :disabled="isUploading"
        class="w-full py-2.5 border-2 border-dashed border-white/20 hover:border-amber-500/50 rounded-lg text-sm text-white/60 hover:text-amber-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Loader2 v-if="isUploading" :size="16" class="animate-spin" />
        <Upload v-else :size="16" />
        {{ isUploading ? 'Uploading...' : 'Upload Watermark' }}
      </button>

      <!-- Search -->
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search watermarks..."
          class="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-amber-500/50"
        />
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
        <button
          @click="activeTab = 'personal'"
          :class="[
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            activeTab === 'personal' ? 'bg-amber-500/20 text-amber-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          My Watermarks ({{ personalWatermarksFiltered.length }})
        </button>
        <button
          v-if="hasOrganizations"
          @click="activeTab = 'organization'"
          :class="[
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            activeTab === 'organization' ? 'bg-orange-500/20 text-orange-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          Organization ({{ orgWatermarksFiltered.length }})
        </button>
      </div>

      <!-- Watermark Grid -->
      <div class="max-h-[250px] overflow-y-auto pr-1">
        <!-- Loading -->
        <div v-if="loadingAssets" class="flex items-center justify-center py-6">
          <Loader2 :size="20" class="animate-spin text-white/40" />
        </div>

        <!-- Personal Watermarks -->
        <template v-else-if="activeTab === 'personal'">
          <div v-if="personalWatermarksFiltered.length === 0" class="py-6 text-center">
            <ImageIcon :size="24" class="mx-auto text-white/20 mb-2" />
            <p class="text-xs text-white/40">No watermarks yet</p>
            <p class="text-[10px] text-white/30 mt-1">Upload a logo or watermark image</p>
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="wm in personalWatermarksFiltered"
              :key="wm.id"
              @click="addWatermarkFromLibrary(wm)"
              class="group p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-amber-500/30 rounded-lg transition-all cursor-pointer"
            >
              <div class="flex items-center gap-3">
                <!-- Thumbnail -->
                <div class="w-16 h-10 rounded overflow-hidden bg-black/50 flex-shrink-0">
                  <img
                    v-if="getThumbnail(wm)"
                    :src="getThumbnail(wm)"
                    :alt="wm.name"
                    class="w-full h-full object-contain"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <ImageIcon :size="14" class="text-white/30" />
                  </div>
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <p class="text-sm text-white truncate">{{ wm.name }}</p>
                  <p class="text-xs text-white/40">
                    {{ wm.width && wm.height ? `${wm.width}x${wm.height}` : 'Watermark' }}
                  </p>
                </div>

                <!-- Add button -->
                <button
                  @click.stop="addWatermarkFromLibrary(wm)"
                  class="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Add to timeline"
                >
                  <Plus :size="14" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- Organization Watermarks -->
        <template v-else-if="activeTab === 'organization'">
          <div v-if="orgWatermarksFiltered.length === 0" class="py-6 text-center">
            <Building2 :size="24" class="mx-auto text-white/20 mb-2" />
            <p class="text-xs text-white/40">No organization watermarks</p>
            <p class="text-[10px] text-white/30 mt-1">Organization admins can upload watermarks</p>
          </div>

          <div v-else class="space-y-1.5">
            <div
              v-for="wm in orgWatermarksFiltered"
              :key="wm.id"
              @click="addWatermarkFromLibrary(wm)"
              class="group p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-orange-500/30 rounded-lg transition-all cursor-pointer"
            >
              <div class="flex items-center gap-3">
                <!-- Thumbnail -->
                <div class="w-16 h-10 rounded overflow-hidden bg-black/50 flex-shrink-0">
                  <img
                    v-if="getThumbnail(wm)"
                    :src="getThumbnail(wm)"
                    :alt="wm.name"
                    class="w-full h-full object-contain"
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <ImageIcon :size="14" class="text-white/30" />
                  </div>
                </div>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-1.5">
                    <p class="text-sm text-white truncate">{{ wm.name }}</p>
                    <Building2 :size="10" class="text-orange-400 flex-shrink-0" />
                  </div>
                  <p class="text-xs text-white/40">
                    {{ wm.width && wm.height ? `${wm.width}x${wm.height}` : 'Watermark' }}
                    <span v-if="wm.organization_name" class="text-orange-400/60">• {{ wm.organization_name }}</span>
                  </p>
                </div>

                <!-- Add button -->
                <button
                  @click.stop="addWatermarkFromLibrary(wm)"
                  class="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
  import { Image as ImageIcon, Plus, Trash2, Pencil, Upload, Search, Loader2, Building2 } from 'lucide-vue-next';
  import type { ClipWatermark, ManualFramingConfigs } from '@/types';
  import { getAllWatermarkImages, type WatermarkImage } from '@/services/database/watermarks';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { useAuthStore } from '@/stores/auth';
  import { invoke } from '@tauri-apps/api/core';

  // Extended WatermarkImage type that includes org asset properties
  interface WatermarkItem extends Omit<WatermarkImage, 'id' | 'organization_id' | 'organization_name'> {
    id: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
    organization_id?: string | null;
    organization_name?: string | null;
    thumbnail_path?: string | null;
  }

  // Auth store for checking org memberships
  const authStore = useAuthStore();

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
  const selectedWatermarkId = ref<string | null>(null);
  const personalWatermarks = ref<WatermarkItem[]>([]);
  const orgWatermarks = ref<WatermarkItem[]>([]);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const loadingAssets = ref(false);
  const isUploading = ref(false);
  const searchQuery = ref('');
  const activeTab = ref<'personal' | 'organization'>('personal');
  const { uploadWatermark, onUploadComplete } = useWatermarkOperations();

  // Computed
  const hasOrganizations = computed(() => {
    const user = authStore.user;
    return user && (user.owned_organization_id || user.created_by_organization_id);
  });

  const personalWatermarksFiltered = computed(() => {
    if (!searchQuery.value) return personalWatermarks.value;
    const query = searchQuery.value.toLowerCase();
    return personalWatermarks.value.filter((w) => w.name.toLowerCase().includes(query));
  });

  const orgWatermarksFiltered = computed(() => {
    if (!searchQuery.value) return orgWatermarks.value;
    const query = searchQuery.value.toLowerCase();
    return orgWatermarks.value.filter(
      (w) => w.name.toLowerCase().includes(query) || w.organization_name?.toLowerCase().includes(query)
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

  function getWatermarkConfig(watermark: ClipWatermark) {
    const ratio = props.previewAspectRatio;
    const ratioConfig = watermark.perRatioConfigs?.[ratio];
    return ratioConfig || { position: watermark.position, scale: watermark.scale, opacity: watermark.opacity };
  }

  function selectWatermark(id: string) {
    selectedWatermarkId.value = selectedWatermarkId.value === id ? null : id;
  }

  function switchToRatio(ratio: string) {
    emit('update:previewAspectRatio', ratio);
  }

  function updateWatermark(watermarkId: string, key: keyof ClipWatermark, value: any) {
    emit('updateWatermark', watermarkId, { [key]: value });
  }

  function updateWatermarkConfig(watermarkId: string, key: 'scale' | 'opacity' | 'position', value: any) {
    const watermark = props.watermarks.find((w) => w.id === watermarkId);
    if (!watermark) return;

    const ratio = props.previewAspectRatio;
    const perRatioConfigs = watermark.perRatioConfigs ? { ...watermark.perRatioConfigs } : {};
    const currentConfig = perRatioConfigs[ratio] || {
      position: { ...watermark.position },
      scale: watermark.scale,
      opacity: watermark.opacity,
    };

    if (key === 'position') {
      currentConfig.position = value;
    } else {
      currentConfig[key] = value;
    }
    perRatioConfigs[ratio] = currentConfig;

    emit('updateWatermark', watermarkId, { perRatioConfigs });
  }

  function getThumbnail(wm: WatermarkItem): string {
    const cached = thumbnailCache.value.get(wm.id);
    if (cached) return cached;

    if (wm.isOrgAsset && wm.thumbnail_path) {
      return wm.thumbnail_path;
    }
    if (wm.isOrgAsset && wm.serverUrl) {
      return wm.serverUrl;
    }

    return '';
  }

  async function loadThumbnail(wm: WatermarkItem): Promise<void> {
    if (thumbnailCache.value.has(wm.id)) return;

    try {
      if (wm.isOrgAsset) {
        const url = wm.thumbnail_path || wm.serverUrl || wm.file_path;
        if (url) {
          thumbnailCache.value.set(wm.id, url);
        }
      } else if (wm.file_path) {
        const exists = await invoke<boolean>('check_file_exists', { path: wm.file_path });
        if (exists) {
          const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: wm.file_path });
          thumbnailCache.value.set(wm.id, dataUrl);
        }
      }
    } catch (err) {
      console.warn('[WatermarkTab] Failed to load thumbnail:', wm.id, err);
    }
  }

  async function loadWatermarkImages() {
    loadingAssets.value = true;
    try {
      const localWatermarks = await getAllWatermarkImages();
      personalWatermarks.value = localWatermarks
        .filter((w) => !w.organization_id)
        .map((w) => ({ ...w, isOrgAsset: false }));

      if (hasOrganizations.value) {
        try {
          const serverResponse = await getUserOrganizationAssets();
          if (serverResponse.success && serverResponse.assets) {
            orgWatermarks.value = serverResponse.assets
              .filter((a: ServerOrganizationAsset) => a.asset_type === 'watermark')
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
                created_at: new Date(a.inserted_at).getTime(),
                updated_at: new Date(a.updated_at).getTime(),
                isOrgAsset: true,
                serverId: a.id,
                serverUrl: a.url,
              }));
          }
        } catch (orgError) {
          console.warn('[WatermarkTab] Failed to load organization watermarks:', orgError);
        }
      }

      const allWatermarks = [...personalWatermarks.value, ...orgWatermarks.value];
      await Promise.all(allWatermarks.map((wm) => loadThumbnail(wm)));
    } catch (err) {
      console.error('[WatermarkTab] Failed to load watermarks:', err);
    } finally {
      loadingAssets.value = false;
    }
  }

  async function handleUploadNew() {
    isUploading.value = true;
    try {
      const result = await uploadWatermark();
      if (result.success) {
        await loadWatermarkImages();
      }
    } catch (err) {
      console.error('[WatermarkTab] Upload failed:', err);
    } finally {
      isUploading.value = false;
    }
  }

  async function addWatermarkFromLibrary(wm: WatermarkItem) {
    try {
      let previewUrl: string;
      let filePathForEmit: string;

      if (wm.isOrgAsset) {
        previewUrl = wm.serverUrl || wm.file_path;
        filePathForEmit = wm.serverUrl || wm.file_path;
      } else {
        previewUrl =
          thumbnailCache.value.get(wm.id) ||
          (await invoke<string>('read_file_as_data_url', { filePath: wm.file_path }));
        filePathForEmit = wm.file_path;
      }

      emit('addWatermark', wm.id, filePathForEmit, previewUrl);
    } catch (err) {
      console.error('[WatermarkTab] Failed to add watermark:', err);
    }
  }

  let unregisterUploadCallback: (() => void) | null = null;

  onMounted(() => {
    loadWatermarkImages();
    unregisterUploadCallback = onUploadComplete(() => {
      loadWatermarkImages();
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
