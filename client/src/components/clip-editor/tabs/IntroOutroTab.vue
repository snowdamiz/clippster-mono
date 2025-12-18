<template>
  <div class="space-y-6">
    <!-- Header -->
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Intro & Outro</h3>
      <p class="text-xs text-white/50">Add intro and outro videos to your timeline.</p>
    </div>

    <!-- Current Status -->
    <div v-if="currentIntro || currentOutro" class="space-y-2">
      <label class="text-xs font-medium text-white/70">Currently Applied</label>
      <div class="space-y-2">
        <!-- Current Intro -->
        <div
          v-if="currentIntro"
          class="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
        >
          <div class="w-12 h-8 rounded overflow-hidden bg-black/50 flex-shrink-0">
            <img
              v-if="currentIntro.thumbnailUrl"
              :src="currentIntro.thumbnailUrl"
              class="w-full h-full object-cover"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Play :size="10" class="text-white/30" />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium text-emerald-300 truncate">{{ currentIntro.name }}</div>
            <div class="text-[10px] text-white/40">Intro • {{ formatDuration(currentIntro.duration || 0) }}</div>
          </div>
          <button
            @click="removeIntro"
            class="p-1.5 rounded bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
            title="Remove intro"
          >
            <X :size="12" />
          </button>
        </div>

        <!-- Current Outro -->
        <div
          v-if="currentOutro"
          class="flex items-center gap-3 p-3 bg-violet-500/10 border border-violet-500/20 rounded-lg"
        >
          <div class="w-12 h-8 rounded overflow-hidden bg-black/50 flex-shrink-0">
            <img
              v-if="currentOutro.thumbnailUrl"
              :src="currentOutro.thumbnailUrl"
              class="w-full h-full object-cover"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Play :size="10" class="text-white/30" />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium text-violet-300 truncate">{{ currentOutro.name }}</div>
            <div class="text-[10px] text-white/40">Outro • {{ formatDuration(currentOutro.duration || 0) }}</div>
          </div>
          <button
            @click="removeOutro"
            class="p-1.5 rounded bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-400 transition-colors"
            title="Remove outro"
          >
            <X :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-px bg-white/10" />

    <!-- Library Section -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-white">Asset Library</h4>
      </div>

      <!-- Upload Buttons -->
      <div class="grid grid-cols-2 gap-2">
        <button
          @click="uploadIntro"
          :disabled="isUploadingIntro"
          class="py-2.5 border-2 border-dashed border-white/20 hover:border-emerald-500/50 rounded-lg text-sm text-white/60 hover:text-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Loader2 v-if="isUploadingIntro" :size="14" class="animate-spin" />
          <Upload v-else :size="14" />
          {{ isUploadingIntro ? 'Uploading...' : 'Upload Intro' }}
        </button>
        <button
          @click="uploadOutro"
          :disabled="isUploadingOutro"
          class="py-2.5 border-2 border-dashed border-white/20 hover:border-violet-500/50 rounded-lg text-sm text-white/60 hover:text-violet-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <Loader2 v-if="isUploadingOutro" :size="14" class="animate-spin" />
          <Upload v-else :size="14" />
          {{ isUploadingOutro ? 'Uploading...' : 'Upload Outro' }}
        </button>
      </div>

      <!-- Search -->
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search intros & outros..."
          class="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-violet-500/50"
        />
      </div>

      <!-- Source Tabs (Personal / Organization) -->
      <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
        <button
          @click="activeSourceTab = 'personal'"
          :class="[
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            activeSourceTab === 'personal' ? 'bg-violet-500/20 text-violet-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          My Assets ({{ personalAssetsFiltered.length }})
        </button>
        <button
          v-if="hasOrganizations"
          @click="activeSourceTab = 'organization'"
          :class="[
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            activeSourceTab === 'organization' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          Organization ({{ orgAssetsFiltered.length }})
        </button>
      </div>

      <!-- Asset List -->
      <div class="max-h-[350px] overflow-y-auto pr-1 space-y-1.5">
        <!-- Loading State -->
        <div v-if="loadingAssets" class="flex items-center justify-center py-6">
          <Loader2 :size="20" class="animate-spin text-white/40" />
        </div>

        <!-- Empty State -->
        <div v-else-if="currentAssetsFiltered.length === 0" class="py-6 text-center">
          <Play :size="24" class="mx-auto text-white/20 mb-2" />
          <p class="text-xs text-white/40">No intros or outros available</p>
          <p class="text-[10px] text-white/30 mt-1">Upload videos above to get started</p>
        </div>

        <!-- Combined Assets List -->
        <template v-else>
          <div
            v-for="asset in currentAssetsFiltered"
            :key="asset.id"
            @click="handleAssetClick(asset)"
            :class="[
              'group p-3 rounded-lg border transition-all',
              isAssetApplied(asset)
                ? asset.type === 'intro'
                  ? 'bg-emerald-500/20 border-emerald-500/40 cursor-default'
                  : 'bg-violet-500/20 border-violet-500/40 cursor-default'
                : asset.type === 'intro'
                  ? 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-emerald-500/30 cursor-pointer'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 hover:border-violet-500/30 cursor-pointer',
            ]"
          >
            <div class="flex items-center gap-3">
              <!-- Thumbnail -->
              <div class="w-16 h-10 rounded overflow-hidden bg-black/50 flex-shrink-0 relative">
                <img
                  v-if="getThumbnail(asset)"
                  :src="getThumbnail(asset)!"
                  class="w-full h-full object-cover"
                  @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <Play :size="14" class="text-white/30" />
                </div>
                <!-- Type Badge -->
                <div
                  :class="[
                    'absolute bottom-0.5 left-0.5 px-1 py-0.5 text-[8px] font-medium rounded',
                    asset.type === 'intro' ? 'bg-emerald-500/90 text-white' : 'bg-violet-500/90 text-white',
                  ]"
                >
                  {{ asset.type === 'intro' ? 'INTRO' : 'OUTRO' }}
                </div>
              </div>

              <!-- Info -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="text-sm text-white truncate">{{ asset.name }}</p>
                  <Building2
                    v-if="asset.isOrgAsset"
                    :size="10"
                    class="text-cyan-400 flex-shrink-0"
                    title="Organization asset"
                  />
                </div>
                <p class="text-xs text-white/40">
                  {{ formatDuration(asset.duration || 0) }}
                  <span v-if="asset.organization_name" class="text-cyan-400/60">• {{ asset.organization_name }}</span>
                </p>
              </div>

              <!-- Applied badge or Add button -->
              <div
                v-if="isAssetApplied(asset)"
                :class="[
                  'px-2 py-1 text-[10px] font-medium rounded',
                  asset.type === 'intro' ? 'bg-emerald-500/30 text-emerald-300' : 'bg-violet-500/30 text-violet-300',
                ]"
              >
                Applied
              </div>
              <button
                v-else
                @click.stop="handleAssetClick(asset)"
                :class="[
                  'p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity',
                  asset.type === 'intro' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-violet-500/20 text-violet-400',
                ]"
                title="Add to timeline"
              >
                <Plus :size="14" />
              </button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { Play, Plus, X, Loader2, Upload, Building2, Search } from 'lucide-vue-next';
  import { getAllIntroOutros, createIntroOutro, type IntroOutro } from '@/services/database';
  import { invoke } from '@tauri-apps/api/core';
  import { open } from '@tauri-apps/plugin-dialog';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { useAuthStore } from '@/stores/auth';

  // Extended IntroOutro type that can be a local asset or server org asset
  interface IntroOutroItem extends Omit<IntroOutro, 'id'> {
    id: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
  }

  interface AppliedIntroOutro {
    id: string;
    name: string;
    duration: number | null;
    filePath: string;
    thumbnailUrl?: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
    organization_id?: string;
    organization_name?: string;
    created_at?: string;
    updated_at?: string;
  }

  const props = defineProps<{
    currentIntro?: AppliedIntroOutro | null;
    currentOutro?: AppliedIntroOutro | null;
  }>();

  const emit = defineEmits<{
    (e: 'addIntro', intro: IntroOutroItem): void;
    (e: 'addOutro', outro: IntroOutroItem): void;
    (e: 'removeIntro'): void;
    (e: 'removeOutro'): void;
  }>();

  // Auth store for checking org memberships
  const authStore = useAuthStore();

  // State
  const personalIntros = ref<IntroOutroItem[]>([]);
  const personalOutros = ref<IntroOutroItem[]>([]);
  const orgIntros = ref<IntroOutroItem[]>([]);
  const orgOutros = ref<IntroOutroItem[]>([]);
  const loadingAssets = ref(false);
  const introThumbnails = ref<Map<string, string>>(new Map());
  const outroThumbnails = ref<Map<string, string>>(new Map());
  const isUploadingIntro = ref(false);
  const isUploadingOutro = ref(false);
  const searchQuery = ref('');
  const activeSourceTab = ref<'personal' | 'organization'>('personal');

  // Computed
  const hasOrganizations = computed(() => {
    const user = authStore.user;
    return user && (user.owned_organization_id || user.created_by_organization_id);
  });

  // Combine intros and outros, sorted by type (intros first) then by name
  const personalAssets = computed(() => {
    return [...personalIntros.value, ...personalOutros.value].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'intro' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  });

  const orgAssets = computed(() => {
    return [...orgIntros.value, ...orgOutros.value].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'intro' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  });

  const personalAssetsFiltered = computed(() => {
    if (!searchQuery.value) return personalAssets.value;
    const query = searchQuery.value.toLowerCase();
    return personalAssets.value.filter((a) => a.name.toLowerCase().includes(query));
  });

  const orgAssetsFiltered = computed(() => {
    if (!searchQuery.value) return orgAssets.value;
    const query = searchQuery.value.toLowerCase();
    return orgAssets.value.filter(
      (a) => a.name.toLowerCase().includes(query) || a.organization_name?.toLowerCase().includes(query)
    );
  });

  const currentAssetsFiltered = computed(() => {
    return activeSourceTab.value === 'personal' ? personalAssetsFiltered.value : orgAssetsFiltered.value;
  });

  // Methods
  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getThumbnail(asset: IntroOutroItem): string | undefined {
    if (asset.type === 'intro') {
      return introThumbnails.value.get(asset.id);
    } else {
      return outroThumbnails.value.get(asset.id);
    }
  }

  function isAssetApplied(asset: IntroOutroItem): boolean {
    if (asset.type === 'intro') {
      return props.currentIntro?.id === asset.id;
    } else {
      return props.currentOutro?.id === asset.id;
    }
  }

  function handleAssetClick(asset: IntroOutroItem) {
    if (isAssetApplied(asset)) return;
    if (asset.type === 'intro') {
      addIntro(asset);
    } else {
      addOutro(asset);
    }
  }

  async function loadIntroOutros() {
    loadingAssets.value = true;
    try {
      // Load local assets from database
      const localAssets = await getAllIntroOutros();
      personalIntros.value = localAssets
        .filter((a) => a.type === 'intro' && !a.organization_id)
        .map((a) => ({ ...a, isOrgAsset: false }));
      personalOutros.value = localAssets
        .filter((a) => a.type === 'outro' && !a.organization_id)
        .map((a) => ({ ...a, isOrgAsset: false }));

      // Load organization assets from server API
      if (hasOrganizations.value) {
        try {
          const serverResponse = await getUserOrganizationAssets();
          if (serverResponse.success && serverResponse.assets) {
            orgIntros.value = serverResponse.assets
              .filter((a: ServerOrganizationAsset) => a.asset_type === 'intro')
              .map((a: ServerOrganizationAsset) => ({
                id: `org_${a.id}`,
                name: a.name,
                file_path: a.url,
                type: 'intro' as const,
                duration: a.duration || null,
                thumbnail_path: a.thumbnail_url || null,
                thumbnail_generation_status: 'completed' as const,
                created_at: new Date(a.inserted_at).getTime(),
                updated_at: new Date(a.updated_at).getTime(),
                organization_id: String(a.organization_id),
                organization_name: a.organization_name,
                isOrgAsset: true,
                serverId: a.id,
                serverUrl: a.url,
              }));

            orgOutros.value = serverResponse.assets
              .filter((a: ServerOrganizationAsset) => a.asset_type === 'outro')
              .map((a: ServerOrganizationAsset) => ({
                id: `org_${a.id}`,
                name: a.name,
                file_path: a.url,
                type: 'outro' as const,
                duration: a.duration || null,
                thumbnail_path: a.thumbnail_url || null,
                thumbnail_generation_status: 'completed' as const,
                created_at: new Date(a.inserted_at).getTime(),
                updated_at: new Date(a.updated_at).getTime(),
                organization_id: String(a.organization_id),
                organization_name: a.organization_name,
                isOrgAsset: true,
                serverId: a.id,
                serverUrl: a.url,
              }));
          }
        } catch (orgError) {
          console.warn('[IntroOutroTab] Failed to load organization assets:', orgError);
        }
      }

      // Load thumbnails for local assets
      for (const item of [...personalIntros.value, ...personalOutros.value]) {
        if (item.thumbnail_path) {
          try {
            const exists = await invoke<boolean>('check_file_exists', { path: item.thumbnail_path });
            if (exists) {
              const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: item.thumbnail_path });
              if (item.type === 'intro') {
                introThumbnails.value.set(item.id, dataUrl);
              } else {
                outroThumbnails.value.set(item.id, dataUrl);
              }
            }
          } catch (err) {
            console.warn('[IntroOutroTab] Failed to load thumbnail:', item.id, err);
          }
        }
      }

      // For org assets, use the thumbnail_path directly (it's a URL)
      for (const item of [...orgIntros.value, ...orgOutros.value]) {
        if (item.thumbnail_path) {
          if (item.type === 'intro') {
            introThumbnails.value.set(item.id, item.thumbnail_path);
          } else {
            outroThumbnails.value.set(item.id, item.thumbnail_path);
          }
        }
      }
    } catch (error) {
      console.error('[IntroOutroTab] Failed to load intros/outros:', error);
    } finally {
      loadingAssets.value = false;
    }
  }

  const videoExtensions = ['mp4', 'mov', 'webm', 'mkv', 'avi'];

  async function uploadIntro() {
    await uploadVideo('intro');
  }

  async function uploadOutro() {
    await uploadVideo('outro');
  }

  async function uploadVideo(type: 'intro' | 'outro') {
    const isUploading = type === 'intro' ? isUploadingIntro : isUploadingOutro;
    isUploading.value = true;

    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Video Files', extensions: videoExtensions }],
      });

      if (!selected) {
        isUploading.value = false;
        return;
      }

      const filePath = typeof selected === 'string' ? selected : (selected as { path?: string })?.path;
      if (!filePath) {
        isUploading.value = false;
        return;
      }

      const pathParts = filePath.replace(/\\/g, '/').split('/');
      const filename = pathParts[pathParts.length - 1];
      const name = filename.replace(/\.[^/.]+$/, '');

      let duration: number | undefined;
      try {
        const durationResult = await invoke<number>('get_video_duration', { videoPath: filePath });
        duration = durationResult;
      } catch (err) {
        console.warn('[IntroOutroTab] Failed to get video duration:', err);
      }

      let thumbnailPath: string | null = null;
      try {
        thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
          videoPath: filePath,
          timestampSeconds: 1,
          outputFilename: `${type}_${Date.now()}`,
        });
      } catch (err) {
        console.warn('[IntroOutroTab] Failed to generate thumbnail:', err);
      }

      await createIntroOutro(type, name, filePath, duration, thumbnailPath, thumbnailPath ? 'completed' : 'pending');
      await loadIntroOutros();
    } catch (error) {
      console.error(`[IntroOutroTab] Failed to upload ${type}:`, error);
    } finally {
      isUploading.value = false;
    }
  }

  function addIntro(intro: IntroOutroItem) {
    emit('addIntro', intro);
  }

  function addOutro(outro: IntroOutroItem) {
    emit('addOutro', outro);
  }

  function removeIntro() {
    emit('removeIntro');
  }

  function removeOutro() {
    emit('removeOutro');
  }

  // Lifecycle
  onMounted(() => {
    loadIntroOutros();
  });

  watch(
    () => authStore.user,
    (newUser, oldUser) => {
      const oldOrgId = oldUser?.owned_organization_id || oldUser?.created_by_organization_id;
      const newOrgId = newUser?.owned_organization_id || newUser?.created_by_organization_id;
      if (oldOrgId !== newOrgId) {
        loadIntroOutros();
      }
    },
    { deep: true }
  );
</script>

<style scoped>
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
