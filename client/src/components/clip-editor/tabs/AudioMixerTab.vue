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
          <!-- Track fill - centered at 0 dB -->
          <div
            class="absolute top-0 h-full rounded-md transition-all duration-200"
            :class="originalDb >= 0 ? 'bg-green-500' : 'bg-orange-500'"
            :style="getGainTrackStyle(originalDb)"
          ></div>
          <!-- Center marker (0 dB) -->
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

    <!-- Add Music Button -->
    <button
      @click="openAudioPicker"
      class="w-full py-3 border-2 border-dashed border-white/20 hover:border-violet-500/50 rounded-lg text-sm text-white/60 hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
    >
      <Plus :size="16" />
      Add Music Track
    </button>

    <!-- Audio Picker Modal -->
    <Teleport to="body">
      <div
        v-if="showAudioPicker"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]"
      >
        <div class="bg-zinc-900 rounded-xl border border-white/10 w-full max-w-md mx-4 overflow-hidden">
          <!-- Header -->
          <div class="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <h3 class="text-sm font-medium text-white">Add Music Track</h3>
            <button @click="closeAudioPicker" class="p-1 hover:bg-white/10 rounded transition-colors">
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
                class="w-full p-3 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg text-sm text-emerald-400 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Loader2 v-if="isUploading" :size="16" class="animate-spin" />
                <Upload v-else :size="16" />
                {{ isUploading ? 'Uploading...' : 'Upload New Audio' }}
              </button>
              <p class="text-[10px] text-white/40 mt-1.5 text-center">MP3, WAV, FLAC, AAC, M4A, OGG</p>
            </div>

            <!-- Divider -->
            <div class="flex items-center gap-3">
              <div class="h-px flex-1 bg-white/10"></div>
              <span class="text-xs text-white/40">or select from library</span>
              <div class="h-px flex-1 bg-white/10"></div>
            </div>

            <!-- Audio Library -->
            <div>
              <div v-if="loadingAssets" class="flex items-center justify-center py-8">
                <Loader2 :size="20" class="animate-spin text-white/40" />
              </div>

              <div v-else-if="audioAssets.length === 0" class="py-8 text-center">
                <Library :size="32" class="mx-auto text-white/20 mb-2" />
                <p class="text-sm text-white/40">No audio assets yet</p>
                <p class="text-xs text-white/30 mt-1">Upload audio to build your library</p>
              </div>

              <div v-else class="space-y-2">
                <button
                  v-for="asset in audioAssets"
                  :key="asset.id"
                  @click="selectAsset(asset)"
                  class="w-full p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-emerald-500/30 rounded-lg transition-colors text-left group"
                >
                  <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <Music :size="14" class="text-emerald-400" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <p class="text-sm text-white truncate">{{ asset.name }}</p>
                      <p class="text-xs text-white/40">
                        {{ asset.duration ? formatDuration(asset.duration) : 'Unknown duration' }}
                      </p>
                    </div>
                    <Plus :size="16" class="text-white/30 group-hover:text-emerald-400 transition-colors" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Music Tracks -->
    <div v-if="audioTracks.length > 0" class="space-y-3">
      <h4 class="text-sm font-medium text-white">Music Tracks</h4>

      <div v-for="track in audioTracks" :key="track.id" class="p-4 bg-white/5 rounded-lg border border-white/10">
        <div class="flex items-center justify-between mb-3">
          <div class="flex items-center gap-2">
            <Music :size="16" class="text-emerald-400" />
            <span class="text-sm text-white truncate max-w-[200px]">{{ track.name }}</span>
          </div>
          <div class="flex items-center gap-1">
            <button
              @click="toggleTrackMute(track)"
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              :title="track.isMuted ? 'Unmute' : 'Mute'"
            >
              <component
                :is="track.isMuted ? VolumeX : Volume2"
                :size="14"
                :class="track.isMuted ? 'text-white/30' : 'text-white/70'"
              />
            </button>
            <button
              @click="toggleTrackSolo(track)"
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              :class="track.isSolo ? 'bg-amber-500/20' : ''"
              title="Solo"
            >
              <Headphones :size="14" :class="track.isSolo ? 'text-amber-400' : 'text-white/50'" />
            </button>
            <button
              @click="emit('deleteTrack', track.id)"
              class="p-1.5 rounded hover:bg-white/10 transition-colors"
              title="Remove"
            >
              <Trash2 :size="14" class="text-red-400" />
            </button>
          </div>
        </div>

        <!-- Gain Slider -->
        <div class="space-y-2 mb-3">
          <div class="flex justify-between items-center">
            <span class="text-xs text-white/50">Gain</span>
            <span
              :class="[
                'text-[10px] font-mono px-1.5 py-0.5 rounded',
                getTrackDb(track.id) === 0
                  ? 'text-white/50 bg-white/5'
                  : getTrackDb(track.id) > 0
                    ? 'text-green-400 bg-green-500/10'
                    : 'text-orange-400 bg-orange-500/10',
              ]"
            >
              {{ getTrackDb(track.id) > 0 ? '+' : '' }}{{ getTrackDb(track.id).toFixed(1) }} dB
            </span>
          </div>
          <div class="relative h-2 bg-white/10 rounded-md">
            <!-- Track fill - centered at 0 dB -->
            <div
              class="absolute top-0 h-full rounded-md transition-all duration-200"
              :class="getTrackDb(track.id) >= 0 ? 'bg-green-500' : 'bg-orange-500'"
              :style="getGainTrackStyle(getTrackDb(track.id))"
            ></div>
            <!-- Center marker (0 dB) -->
            <div class="absolute top-0 left-1/2 w-0.5 h-full bg-white/20 -translate-x-1/2"></div>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.5"
              :value="getTrackDb(track.id)"
              @input="(e) => updateTrackDb(track, e)"
              class="absolute inset-0 w-full h-full cursor-pointer gain-slider z-10"
            />
          </div>
          <div class="flex justify-between text-[9px] text-white/30 px-0.5">
            <span>-20 dB</span>
            <span>0 dB</span>
            <span>+20 dB</span>
          </div>
        </div>

        <!-- Fade Controls -->
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs text-white/50 mb-1">Fade In</label>
            <div class="flex items-center gap-2">
              <input
                type="number"
                :value="track.fadeIn"
                @input="(e) => updateTrackFadeIn(track, e)"
                min="0"
                max="10"
                step="0.1"
                class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
              />
              <span class="text-xs text-white/40">s</span>
            </div>
          </div>
          <div>
            <label class="block text-xs text-white/50 mb-1">Fade Out</label>
            <div class="flex items-center gap-2">
              <input
                type="number"
                :value="track.fadeOut"
                @input="(e) => updateTrackFadeOut(track, e)"
                min="0"
                max="10"
                step="0.1"
                class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
              />
              <span class="text-xs text-white/40">s</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, onMounted, onUnmounted } from 'vue';
  import { Volume2, VolumeX, Music, Plus, Headphones, Trash2, Upload, Library, X, Loader2 } from 'lucide-vue-next';
  import type { AudioTrack } from '@/types';
  import { getAllAudioAssets, type AudioAsset } from '@/services/database';
  import { useAudioAssetOperations } from '@/composables/useAudioAssetOperations';

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

  // Audio asset selection state
  const showAudioPicker = ref(false);
  const audioAssets = ref<AudioAsset[]>([]);
  const loadingAssets = ref(false);
  const isUploading = ref(false);
  const { uploadAudioAsset, onUploadComplete } = useAudioAssetOperations();

  // Format duration for display
  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Get dB value for a track
  function getTrackDb(trackId: string): number {
    return props.trackDbValues[trackId] ?? 0;
  }

  // Get the style for the gain track fill (centered at 0 dB)
  function getGainTrackStyle(db: number): { left: string; width: string } {
    const center = 50; // 50% is center (0 dB)

    if (db >= 0) {
      // Positive: fill from center to right
      const width = (db / 20) * 50;
      return {
        left: `${center}%`,
        width: `${width}%`,
      };
    } else {
      // Negative: fill from left of center
      const width = (Math.abs(db) / 20) * 50;
      return {
        left: `${center - width}%`,
        width: `${width}%`,
      };
    }
  }

  // Audio picker functions
  async function openAudioPicker() {
    showAudioPicker.value = true;
    await loadAudioAssets();
  }

  function closeAudioPicker() {
    showAudioPicker.value = false;
  }

  async function loadAudioAssets() {
    loadingAssets.value = true;
    try {
      audioAssets.value = await getAllAudioAssets();
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
      if (result.success && result.audioAssetId) {
        // Reload assets and close picker - the asset will be in the list
        await loadAudioAssets();
        // Find and select the newly uploaded asset
        const newAsset = audioAssets.value.find((a) => a.id === result.audioAssetId);
        if (newAsset) {
          await selectAsset(newAsset);
        }
      }
    } catch (err) {
      console.error('[AudioMixerTab] Upload failed:', err);
    } finally {
      isUploading.value = false;
    }
  }

  async function selectAsset(asset: AudioAsset) {
    // Emit the actual file path - the parent component will construct the streaming URL
    // This ensures URLs use the current port and don't break if the server port changes
    emit('addTrack', asset.file_path, asset.name, asset.duration || 0);
    closeAudioPicker();
  }

  function toggleOriginalMute() {
    if (!isOriginalMuted.value) {
      previousDb.value = props.originalDb || 0;
      isOriginalMuted.value = true;
      emit('updateOriginalDb', -60); // Effectively silent
    } else {
      isOriginalMuted.value = false;
      emit('updateOriginalDb', previousDb.value);
    }
  }

  function onOriginalDbChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const db = parseFloat(target.value);
    emit('updateOriginalDb', db);
  }

  function toggleTrackMute(track: AudioTrack) {
    emit('updateTrack', track.id, { isMuted: !track.isMuted });
  }

  function toggleTrackSolo(track: AudioTrack) {
    emit('updateTrack', track.id, { isSolo: !track.isSolo });
  }

  function updateTrackDb(track: AudioTrack, e: Event) {
    const target = e.target as HTMLInputElement;
    const db = parseFloat(target.value);
    emit('updateTrackDb', track.id, db);
  }

  function updateTrackFadeIn(track: AudioTrack, e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateTrack', track.id, { fadeIn: parseFloat(target.value) });
  }

  function updateTrackFadeOut(track: AudioTrack, e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateTrack', track.id, { fadeOut: parseFloat(target.value) });
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

  // Register for upload completion to refresh the asset list
  let unregisterUploadCallback: (() => void) | null = null;

  onMounted(() => {
    unregisterUploadCallback = onUploadComplete(() => {
      if (showAudioPicker.value) {
        loadAudioAssets();
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
  /* Custom gain slider styling */
  .gain-slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    outline: none;
  }

  .gain-slider::-webkit-slider-track {
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

  .gain-slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .gain-slider::-webkit-slider-thumb:active {
    transform: scale(1.1);
  }

  .gain-slider::-moz-range-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
    border: none;
  }

  .gain-slider::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .gain-slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .gain-slider::-moz-range-thumb:active {
    transform: scale(1.1);
  }
</style>
