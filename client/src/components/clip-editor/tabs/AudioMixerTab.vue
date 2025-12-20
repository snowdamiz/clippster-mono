<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Audio Mixer</h3>
      <p class="text-xs text-white/50 mb-4">Adjust audio levels and add background music.</p>
    </div>

    <!-- Original Audio Track -->
    <div class="p-4 bg-white/5 rounded-lg border border-white/10">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-2">
          <Volume2 :size="16" class="text-violet-400" />
          <span class="text-sm font-medium text-white">Original Audio</span>
        </div>
        <button
          @click="toggleOriginalMute"
          class="p-1.5 rounded hover:bg-white/10 transition-colors"
          :title="isOriginalMuted ? 'Unmute' : 'Mute'"
        >
          <component
            :is="isOriginalMuted ? VolumeX : Volume2"
            :size="16"
            :class="isOriginalMuted ? 'text-white/30' : 'text-white/70'"
          />
        </button>
      </div>

      <!-- Gain Slider -->
      <div class="space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-xs text-white/50">Gain</span>
          <span
            :class="[
              'text-[10px] font-mono px-1.5 py-0.5 rounded',
              originalDb === 0
                ? 'text-white/50 bg-white/5'
                : originalDb > 0
                  ? 'text-green-400 bg-green-500/10'
                  : 'text-orange-400 bg-orange-500/10',
            ]"
          >
            {{ originalDb > 0 ? '+' : '' }}{{ originalDb.toFixed(1) }} dB
          </span>
        </div>
        <div class="relative h-2 bg-white/10 rounded-md">
          <div
            class="absolute top-0 h-full rounded-md transition-all duration-200"
            :class="originalDb >= 0 ? 'bg-green-500' : 'bg-orange-500'"
            :style="getGainTrackStyle(originalDb)"
          ></div>
          <div class="absolute top-0 left-1/2 w-0.5 h-full bg-white/20 -translate-x-1/2"></div>
          <input
            type="range"
            min="-20"
            max="20"
            step="0.5"
            :value="originalDb"
            @input="onOriginalDbChange"
            class="absolute inset-0 w-full h-full cursor-pointer gain-slider z-10"
          />
        </div>
        <div class="flex justify-between text-[9px] text-white/30 px-0.5">
          <span>-20 dB</span>
          <span>0 dB</span>
          <span>+20 dB</span>
        </div>
      </div>
    </div>

    <!-- Active Music Tracks -->
    <div v-if="audioTracks.length > 0" class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-white">Active Tracks</h4>
        <span class="text-[10px] text-white/40">
          {{ audioTracks.length }} track{{ audioTracks.length !== 1 ? 's' : '' }}
        </span>
      </div>

      <div
        v-for="track in audioTracks"
        :key="track.id"
        class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <Music :size="14" class="text-emerald-400" />
            <span class="text-xs text-white truncate max-w-[150px]">{{ track.name }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="toggleTrackMute(track)"
              class="p-1 rounded hover:bg-white/10 transition-colors"
              :title="track.isMuted ? 'Unmute' : 'Mute'"
            >
              <component
                :is="track.isMuted ? VolumeX : Volume2"
                :size="12"
                :class="track.isMuted ? 'text-white/30' : 'text-white/70'"
              />
            </button>
            <button
              @click="toggleTrackSolo(track)"
              class="p-1 rounded hover:bg-white/10 transition-colors"
              :class="track.isSolo ? 'bg-amber-500/20' : ''"
              title="Solo"
            >
              <Headphones :size="12" :class="track.isSolo ? 'text-amber-400' : 'text-white/50'" />
            </button>
            <button
              @click="emit('deleteTrack', track.id)"
              class="p-1 rounded hover:bg-white/10 transition-colors"
              title="Remove"
            >
              <Trash2 :size="12" class="text-red-400" />
            </button>
          </div>
        </div>

        <!-- Compact Gain + Fades -->
        <div class="flex items-center gap-2">
          <div class="flex-1">
            <div class="relative h-1.5 bg-white/10 rounded">
              <div
                class="absolute top-0 h-full rounded transition-all"
                :class="getTrackDb(track.id) >= 0 ? 'bg-green-500' : 'bg-orange-500'"
                :style="getGainTrackStyle(getTrackDb(track.id))"
              ></div>
              <input
                type="range"
                min="-20"
                max="20"
                step="0.5"
                :value="getTrackDb(track.id)"
                @input="(e) => updateTrackDb(track, e)"
                class="absolute inset-0 w-full h-full cursor-pointer gain-slider-sm z-10"
              />
            </div>
          </div>
          <span class="text-[9px] font-mono text-white/50 w-12 text-right">
            {{ getTrackDb(track.id) > 0 ? '+' : '' }}{{ getTrackDb(track.id).toFixed(1) }}dB
          </span>
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="h-px bg-white/10"></div>

    <!-- Audio Library Section -->
    <div class="space-y-3">
      <div class="flex items-center justify-between">
        <h4 class="text-sm font-medium text-white">Audio Library</h4>
      </div>

      <!-- Upload Button -->
      <button
        @click="handleUploadNew"
        :disabled="isUploading"
        class="w-full py-2.5 border-2 border-dashed border-white/20 hover:border-emerald-500/50 rounded-lg text-sm text-white/60 hover:text-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
      >
        <Loader2 v-if="isUploading" :size="16" class="animate-spin" />
        <Upload v-else :size="16" />
        {{ isUploading ? 'Uploading...' : 'Upload Audio' }}
      </button>

      <!-- Search -->
      <div class="relative">
        <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search audio..."
          class="w-full pl-9 pr-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder:text-white/40 focus:outline-none focus:border-emerald-500/50"
        />
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
        <button
          @click="activeTab = 'personal'"
          :class="[
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            activeTab === 'personal' ? 'bg-emerald-500/20 text-emerald-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          My Audio ({{ personalAudioFiltered.length }})
        </button>
        <button
          v-if="hasOrganizations"
          @click="activeTab = 'organization'"
          :class="[
            'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
            activeTab === 'organization' ? 'bg-cyan-500/20 text-cyan-300' : 'text-white/50 hover:text-white/70',
          ]"
        >
          Organization ({{ orgAudioFiltered.length }})
        </button>
      </div>

      <!-- Audio List -->
      <div class="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
        <!-- Loading -->
        <div v-if="loadingAssets" class="flex items-center justify-center py-6">
          <Loader2 :size="20" class="animate-spin text-white/40" />
        </div>

        <!-- Personal Audio -->
        <template v-else-if="activeTab === 'personal'">
          <div v-if="personalAudioFiltered.length === 0" class="py-6 text-center">
            <Music :size="24" class="mx-auto text-white/20 mb-2" />
            <p class="text-xs text-white/40">No audio files yet</p>
            <p class="text-[10px] text-white/30 mt-1">Upload audio to build your library</p>
          </div>

          <div
            v-for="asset in personalAudioFiltered"
            :key="asset.id"
            @click="selectAsset(asset)"
            class="group p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 rounded-lg transition-all cursor-pointer"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                <Music :size="14" class="text-emerald-400" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm text-white truncate">{{ asset.name }}</p>
                <p class="text-[10px] text-white/40">
                  {{ asset.duration ? formatDuration(asset.duration) : 'Unknown duration' }}
                </p>
              </div>
              <button
                @click.stop="selectAsset(asset)"
                class="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Add to timeline"
              >
                <Plus :size="14" />
              </button>
            </div>
          </div>
        </template>

        <!-- Organization Audio -->
        <template v-else-if="activeTab === 'organization'">
          <div v-if="orgAudioFiltered.length === 0" class="py-6 text-center">
            <Building2 :size="24" class="mx-auto text-white/20 mb-2" />
            <p class="text-xs text-white/40">No organization audio</p>
            <p class="text-[10px] text-white/30 mt-1">Organization admins can upload audio assets</p>
          </div>

          <div
            v-for="asset in orgAudioFiltered"
            :key="asset.id"
            @click="selectAsset(asset)"
            class="group p-2.5 bg-white/5 hover:bg-white/10 border border-cyan-500/20 hover:border-cyan-500/40 rounded-lg transition-all cursor-pointer"
          >
            <div class="flex items-center gap-3">
              <div class="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center flex-shrink-0">
                <Music :size="14" class="text-cyan-400" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1.5">
                  <p class="text-sm text-white truncate">{{ asset.name }}</p>
                  <Building2 :size="10" class="text-cyan-400 flex-shrink-0" />
                </div>
                <p class="text-[10px] text-white/40">
                  {{ asset.duration ? formatDuration(asset.duration) : 'Unknown' }}
                  <span v-if="asset.organization_name" class="text-cyan-400/60">• {{ asset.organization_name }}</span>
                </p>
              </div>
              <button
                @click.stop="selectAsset(asset)"
                class="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import {
    Volume2,
    VolumeX,
    Music,
    Plus,
    Headphones,
    Trash2,
    Upload,
    Search,
    Loader2,
    Building2,
  } from 'lucide-vue-next';
  import type { AudioTrack } from '@/types';
  import { getAllAudioAssets, type AudioAsset } from '@/services/database';
  import { useAudioAssetOperations } from '@/composables/useAudioAssetOperations';
  import { getUserOrganizationAssets, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { useAuthStore } from '@/stores/auth';

  // Extended AudioAsset type that includes org asset properties
  interface AudioItem extends Omit<AudioAsset, 'id' | 'organization_id' | 'organization_name'> {
    id: string;
    isOrgAsset?: boolean;
    serverId?: number;
    serverUrl?: string;
    organization_id?: string | null;
    organization_name?: string | null;
  }

  // Auth store for checking org memberships
  const authStore = useAuthStore();

  const props = defineProps<{
    audioTracks: AudioTrack[];
    originalDb: number;
    trackDbValues: Record<string, number>;
  }>();

  const emit = defineEmits<{
    (e: 'addTrack', filePath: string, name: string, duration: number): void;
    (e: 'updateTrack', trackId: string, updates: Partial<AudioTrack>): void;
    (e: 'deleteTrack', trackId: string): void;
    (e: 'updateOriginalDb', db: number): void;
    (e: 'updateTrackDb', trackId: string, db: number): void;
  }>();

  const isOriginalMuted = ref(false);
  const previousDb = ref(props.originalDb || 0);

  // Audio asset state
  const personalAudio = ref<AudioItem[]>([]);
  const orgAudio = ref<AudioItem[]>([]);
  const loadingAssets = ref(false);
  const isUploading = ref(false);
  const searchQuery = ref('');
  const activeTab = ref<'personal' | 'organization'>('personal');
  const { uploadAudioAsset, onUploadComplete } = useAudioAssetOperations();

  // Computed
  const hasOrganizations = computed(() => {
    const user = authStore.user;
    return user && (user.owned_organization_id || user.created_by_organization_id);
  });

  const personalAudioFiltered = computed(() => {
    if (!searchQuery.value) return personalAudio.value;
    const query = searchQuery.value.toLowerCase();
    return personalAudio.value.filter((a) => a.name.toLowerCase().includes(query));
  });

  const orgAudioFiltered = computed(() => {
    if (!searchQuery.value) return orgAudio.value;
    const query = searchQuery.value.toLowerCase();
    return orgAudio.value.filter(
      (a) => a.name.toLowerCase().includes(query) || a.organization_name?.toLowerCase().includes(query)
    );
  });

  // Methods
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getTrackDb(trackId: string): number {
    return props.trackDbValues[trackId] ?? 0;
  }

  function getGainTrackStyle(db: number): { left: string; width: string } {
    const center = 50;
    if (db >= 0) {
      const width = (db / 20) * 50;
      return { left: `${center}%`, width: `${width}%` };
    } else {
      const width = (Math.abs(db) / 20) * 50;
      return { left: `${center - width}%`, width: `${width}%` };
    }
  }

  async function loadAudioAssets() {
    loadingAssets.value = true;
    try {
      // Load local audio assets (personal assets only)
      const localAssets = await getAllAudioAssets();
      personalAudio.value = localAssets.filter((a) => !a.organization_id).map((a) => ({ ...a, isOrgAsset: false }));

      // Load organization audio assets from server
      if (hasOrganizations.value) {
        try {
          const serverResponse = await getUserOrganizationAssets();
          if (serverResponse.success && serverResponse.assets) {
            orgAudio.value = serverResponse.assets
              .filter((a: ServerOrganizationAsset) => a.asset_type === 'audio')
              .map((a: ServerOrganizationAsset) => ({
                id: `org_${a.id}`,
                name: a.name,
                file_path: a.url,
                duration: a.duration || null,
                file_size: null,
                sample_rate: null,
                channels: null,
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
          console.warn('[AudioMixerTab] Failed to load organization audio:', orgError);
        }
      }
    } catch (err) {
      console.error('[AudioMixerTab] Failed to load audio assets:', err);
    } finally {
      loadingAssets.value = false;
    }
  }

  async function handleUploadNew() {
    isUploading.value = true;
    try {
      const result = await uploadAudioAsset();
      if (result.success) {
        await loadAudioAssets();
      }
    } catch (err) {
      console.error('[AudioMixerTab] Upload failed:', err);
    } finally {
      isUploading.value = false;
    }
  }

  async function selectAsset(asset: AudioItem) {
    const filePath = asset.isOrgAsset && asset.serverUrl ? asset.serverUrl : asset.file_path;
    emit('addTrack', filePath, asset.name, asset.duration || 0);
  }

  function toggleOriginalMute() {
    if (!isOriginalMuted.value) {
      previousDb.value = props.originalDb || 0;
      isOriginalMuted.value = true;
      emit('updateOriginalDb', -60);
    } else {
      isOriginalMuted.value = false;
      emit('updateOriginalDb', previousDb.value);
    }
  }

  function onOriginalDbChange(e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateOriginalDb', parseFloat(target.value));
  }

  function toggleTrackMute(track: AudioTrack) {
    emit('updateTrack', track.id, { isMuted: !track.isMuted });
  }

  function toggleTrackSolo(track: AudioTrack) {
    emit('updateTrack', track.id, { isSolo: !track.isSolo });
  }

  function updateTrackDb(track: AudioTrack, e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateTrackDb', track.id, parseFloat(target.value));
  }

  // Watch for external dB changes
  watch(
    () => props.originalDb,
    (newDb) => {
      if (newDb > -60) {
        isOriginalMuted.value = false;
      }
    }
  );

  // Register for upload completion
  let unregisterUploadCallback: (() => void) | null = null;

  onMounted(() => {
    loadAudioAssets();
    unregisterUploadCallback = onUploadComplete(() => {
      loadAudioAssets();
    });
  });

  onUnmounted(() => {
    if (unregisterUploadCallback) {
      unregisterUploadCallback();
    }
  });
</script>

<style scoped>
  .gain-slider,
  .gain-slider-sm {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    outline: none;
  }

  .gain-slider::-webkit-slider-track,
  .gain-slider-sm::-webkit-slider-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
  }

  .gain-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .gain-slider-sm::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  }

  .gain-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
  }

  .gain-slider::-moz-range-track,
  .gain-slider-sm::-moz-range-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
    border: none;
  }

  .gain-slider::-moz-range-thumb,
  .gain-slider-sm::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  }

  /* Scrollbar styling */
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
