<template>
  <div class="space-y-3">
    <!-- Intro/Outro Upload Dialog -->
    <IntroOutroUploadDialog
      :show="showUploadDialog"
      @close="showUploadDialog = false"
      @uploaded="handleUploadComplete"
    />

    <!-- Current Status -->
    <div v-if="currentIntro || currentOutro" class="space-y-2">
      <label class="text-xs font-medium" style="color: var(--sidebar-text-muted)">Currently Applied</label>
      <div class="space-y-2">
        <!-- Current Intro -->
        <div
          v-if="currentIntro"
          class="flex items-center gap-3 p-3 rounded-lg border"
          style="background-color: var(--sidebar-active); border-color: var(--sidebar-accent); opacity: 0.8"
        >
          <div class="w-12 h-8 rounded overflow-hidden flex-shrink-0" style="background-color: var(--sidebar-surface)">
            <img
              v-if="currentIntro.thumbnailUrl"
              :src="currentIntro.thumbnailUrl"
              class="w-full h-full object-cover"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Play :size="10" style="color: var(--sidebar-text-muted)" />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium truncate" style="color: var(--sidebar-accent)">{{ currentIntro.name }}</div>
            <div class="text-[10px]" style="color: var(--sidebar-text-muted)">
              Intro • {{ formatDuration(currentIntro.duration || 0) }}
            </div>
          </div>
          <button
            @click="removeIntro"
            class="p-1.5 rounded transition-colors"
            style="background-color: var(--sidebar-hover); color: var(--sidebar-text-muted)"
            @mouseenter="
              (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                (e.currentTarget as HTMLElement).style.color = '#f87171';
              }
            "
            @mouseleave="
              (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)';
                (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-muted)';
              }
            "
            title="Remove intro"
          >
            <X :size="12" />
          </button>
        </div>

        <!-- Current Outro -->
        <div
          v-if="currentOutro"
          class="flex items-center gap-3 p-3 rounded-lg border"
          style="background-color: var(--sidebar-active); border-color: var(--sidebar-accent); opacity: 0.8"
        >
          <div class="w-12 h-8 rounded overflow-hidden flex-shrink-0" style="background-color: var(--sidebar-surface)">
            <img
              v-if="currentOutro.thumbnailUrl"
              :src="currentOutro.thumbnailUrl"
              class="w-full h-full object-cover"
              @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <Play :size="10" style="color: var(--sidebar-text-muted)" />
            </div>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs font-medium truncate" style="color: var(--sidebar-accent)">{{ currentOutro.name }}</div>
            <div class="text-[10px]" style="color: var(--sidebar-text-muted)">
              Outro • {{ formatDuration(currentOutro.duration || 0) }}
            </div>
          </div>
          <button
            @click="removeOutro"
            class="p-1.5 rounded transition-colors"
            style="background-color: var(--sidebar-hover); color: var(--sidebar-text-muted)"
            @mouseenter="
              (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(239, 68, 68, 0.2)';
                (e.currentTarget as HTMLElement).style.color = '#f87171';
              }
            "
            @mouseleave="
              (e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)';
                (e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-muted)';
              }
            "
            title="Remove outro"
          >
            <X :size="12" />
          </button>
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-1 justify-end">
      <button
        @click="openUploadDialog"
        class="p-1.5 rounded-md transition-all"
        style="color: var(--sidebar-text-muted)"
        @mouseenter="(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--sidebar-accent)')"
        @mouseleave="(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--sidebar-text-muted)')"
        title="Upload intro or outro"
      >
        <Plus :size="14" />
      </button>
    </div>

    <!-- Asset List -->
    <div class="max-h-[350px] overflow-y-auto pr-1 space-y-1.5 intro-outro-list">
      <!-- Loading State -->
      <div v-if="loadingAssets" class="flex items-center justify-center py-6">
        <Loader2 :size="20" class="animate-spin" style="color: var(--sidebar-text-muted)" />
      </div>

      <!-- Empty State -->
      <div v-else-if="allAssetsFiltered.length === 0" class="py-6 text-center">
        <Clapperboard :size="24" class="mx-auto mb-2" style="color: var(--sidebar-text-muted); opacity: 0.5" />
        <p class="text-xs" style="color: var(--sidebar-text-muted)">
          {{ props.searchQuery ? 'No matching intros or outros found' : 'No intros or outros available' }}
        </p>
      </div>

      <!-- Combined Assets List -->
      <template v-else>
        <div
          v-for="asset in allAssetsFiltered"
          :key="asset.id"
          @click="handleAssetClick(asset)"
          class="intro-outro-asset group p-3 rounded-lg border transition-all"
          :class="isAssetApplied(asset) ? 'cursor-default' : 'cursor-pointer'"
          :style="
            isAssetApplied(asset)
              ? 'background-color: var(--sidebar-active); border-color: var(--sidebar-accent)'
              : 'background-color: var(--sidebar-hover); border-color: var(--sidebar-border)'
          "
          @mouseenter="
            (e) => {
              if (!isAssetApplied(asset)) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-active)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-accent)';
              }
            }
          "
          @mouseleave="
            (e) => {
              if (!isAssetApplied(asset)) {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--sidebar-hover)';
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-border)';
              }
            }
          "
        >
          <div class="flex items-center gap-3">
            <!-- Thumbnail -->
            <div
              class="w-16 h-10 rounded overflow-hidden flex-shrink-0 relative"
              style="background-color: var(--sidebar-surface)"
            >
              <img
                v-if="getThumbnail(asset)"
                :src="getThumbnail(asset)!"
                class="w-full h-full object-cover"
                @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
              />
              <div v-else class="w-full h-full flex items-center justify-center">
                <Play :size="14" style="color: var(--sidebar-text-muted)" />
              </div>
              <!-- Type Badge -->
              <div
                class="absolute bottom-0.5 left-0.5 px-1 py-0.5 text-[8px] font-medium rounded"
                :class="asset.type === 'intro' ? 'bg-emerald-500/90 text-white' : 'bg-sky-500/90 text-white'"
              >
                {{ asset.type === 'intro' ? 'INTRO' : 'OUTRO' }}
              </div>
              <!-- Organization Badge -->
              <div
                v-if="asset.isOrgAsset"
                class="absolute top-0.5 right-0.5 px-1 py-0.5 text-[8px] font-medium rounded bg-cyan-500/90 text-white flex items-center gap-0.5"
                :title="asset.organization_name || 'Organization asset'"
              >
                <Building2 :size="8" />
              </div>
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <p class="text-sm truncate" style="color: var(--sidebar-text)">{{ asset.name }}</p>
              </div>
              <p class="text-xs" style="color: var(--sidebar-text-muted)">
                {{ formatDuration(asset.duration || 0) }}
                <span v-if="asset.organization_name" class="text-cyan-400/60">• {{ asset.organization_name }}</span>
              </p>
            </div>

            <!-- Applied badge or action button -->
            <div
              v-if="isAssetApplied(asset)"
              class="px-2 py-1 text-[10px] font-medium rounded"
              style="background-color: var(--sidebar-active); color: var(--sidebar-accent)"
            >
              Applied
            </div>
            <button
              v-else
              @click.stop="handleAssetClick(asset)"
              class="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style="background-color: var(--sidebar-active); color: var(--sidebar-accent)"
              title="Add to timeline"
            >
              <Plus :size="14" />
            </button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { Play, Plus, X, Loader2, Building2, Clapperboard } from 'lucide-vue-next';
  import { getAllIntroOutros, type IntroOutro } from '@/services/database';
  import { invoke } from '@tauri-apps/api/core';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { useAuthStore } from '@/stores/auth';
  import IntroOutroUploadDialog from '@/components/IntroOutroUploadDialog.vue';

  // Extended IntroOutro type that can be a local asset or server org asset
  interface IntroOutroItem extends Omit<IntroOutro, 'id'> {
    id: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
  }

  interface AppliedIntroOutro {
    id: string;
    sourceId?: string;
    name: string;
    duration: number | null;
    filePath: string;
    thumbnailUrl?: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
    organization_id?: string | null;
    organization_name?: string | null;
    created_at?: string;
    updated_at?: string;
  }

  const props = defineProps<{
    currentIntro?: AppliedIntroOutro | null;
    currentOutro?: AppliedIntroOutro | null;
    searchQuery: string;
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
  const showUploadDialog = ref(false);

  // Computed
  const hasOrganizations = computed(() => {
    const user = authStore.user;
    return user && (user.owned_organization_id || user.created_by_organization_id);
  });

  // Combine all intros and outros (both personal and organization), sorted by type (intros first) then by name
  const allAssets = computed(() => {
    return [...personalIntros.value, ...personalOutros.value, ...orgIntros.value, ...orgOutros.value].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'intro' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  });

  const allAssetsFiltered = computed(() => {
    let filtered = allAssets.value;

    // Filter by search
    if (props.searchQuery) {
      const query = props.searchQuery.toLowerCase();
      filtered = filtered.filter(
        (a) => a.name.toLowerCase().includes(query) || a.organization_name?.toLowerCase().includes(query)
      );
    }

    return filtered;
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

  function handleUploadComplete() {
    showUploadDialog.value = false;
    loadIntroOutros();
  }

  function openUploadDialog() {
    showUploadDialog.value = true;
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
  /* Custom scrollbar styling */
  .intro-outro-list::-webkit-scrollbar {
    width: 6px;
  }

  .intro-outro-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .intro-outro-list::-webkit-scrollbar-thumb {
    background-color: var(--sidebar-border);
    border-radius: 3px;
  }

  .intro-outro-list::-webkit-scrollbar-thumb:hover {
    background-color: var(--sidebar-text-muted);
  }

  /* Firefox scrollbar */
  .intro-outro-list {
    scrollbar-width: thin;
    scrollbar-color: var(--sidebar-border) transparent;
  }

  /* Smooth transitions */
  .intro-outro-asset {
    transition: all 150ms ease;
  }

  /* Input placeholder styling */
  input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  /* Button transitions */
  button {
    transition: all 150ms ease;
  }
</style>
