<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-3">Audio Mixer</h3>
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

      <!-- Volume Slider -->
      <div class="flex items-center gap-3 mb-3">
        <span class="text-xs text-white/50 w-12">Volume</span>
        <span class="text-xs text-white/50 w-10 text-right">{{ Math.round(originalVolume * 100) }}%</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          :value="originalVolume"
          @input="onOriginalVolumeChange"
          class="flex-1 accent-violet-500"
        />
      </div>

      <!-- dB Slider -->
      <div class="flex items-center gap-3">
        <span class="text-xs text-white/50 w-12">Gain</span>
        <span class="text-xs text-white/50 w-10 text-right font-mono">{{ formatDb(originalDb) }}</span>
        <input
          type="range"
          min="-20"
          max="20"
          step="0.5"
          :value="originalDb"
          @input="onOriginalDbChange"
          class="flex-1 accent-violet-500"
        />
      </div>
    </div>

    <!-- Add Music Button -->
    <button
      @click="handleAddTrack"
      class="w-full py-3 border-2 border-dashed border-white/20 hover:border-violet-500/50 rounded-lg text-sm text-white/60 hover:text-violet-400 transition-colors flex items-center justify-center gap-2"
    >
      <Plus :size="16" />
      Add Music Track
    </button>

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

        <!-- Volume Slider -->
        <div class="flex items-center gap-3 mb-2">
          <span class="text-xs text-white/50 w-12">Volume</span>
          <span class="text-xs text-white/50 w-10 text-right">{{ Math.round(track.volume * 100) }}%</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            :value="track.volume"
            @input="(e) => updateTrackVolume(track, e)"
            class="flex-1 accent-emerald-500"
          />
        </div>

        <!-- dB Slider -->
        <div class="flex items-center gap-3 mb-3">
          <span class="text-xs text-white/50 w-12">Gain</span>
          <span class="text-xs text-white/50 w-10 text-right font-mono">{{ formatDb(getTrackDb(track.id)) }}</span>
          <input
            type="range"
            min="-20"
            max="20"
            step="0.5"
            :value="getTrackDb(track.id)"
            @input="(e) => updateTrackDb(track, e)"
            class="flex-1 accent-emerald-500"
          />
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

    <!-- Hidden file input -->
    <input ref="fileInputRef" type="file" accept="audio/*" class="hidden" @change="onFileSelected" />
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Volume2, VolumeX, Music, Plus, Headphones, Trash2 } from 'lucide-vue-next';
  import type { AudioTrack } from '@/types';

  const props = defineProps<{
    audioTracks: AudioTrack[];
    originalVolume: number;
    originalDb: number;
    trackDbValues: Record<string, number>;
  }>();

  const emit = defineEmits<{
    (e: 'addTrack', filePath: string, name: string, duration: number): void;
    (e: 'updateTrack', trackId: string, updates: Partial<AudioTrack>): void;
    (e: 'deleteTrack', trackId: string): void;
    (e: 'updateOriginalVolume', volume: number): void;
    (e: 'updateOriginalDb', db: number): void;
    (e: 'updateTrackDb', trackId: string, db: number): void;
  }>();

  const fileInputRef = ref<HTMLInputElement | null>(null);
  const isOriginalMuted = ref(false);
  const previousVolume = ref(props.originalVolume || 1);

  // Format dB value for display
  function formatDb(db: number): string {
    if (db === 0) return '0 dB';
    return `${db > 0 ? '+' : ''}${db.toFixed(1)} dB`;
  }

  // Get dB value for a track
  function getTrackDb(trackId: string): number {
    return props.trackDbValues[trackId] ?? 0;
  }

  function handleAddTrack() {
    fileInputRef.value?.click();
  }

  function onFileSelected(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      // Check file size (warn if > 10MB)
      if (file.size > 10 * 1024 * 1024) {
        console.warn('[AudioMixerTab] Large audio file selected:', (file.size / 1024 / 1024).toFixed(2), 'MB');
      }

      // First, get the audio duration using a temporary Audio element
      const tempUrl = URL.createObjectURL(file);
      const audio = new Audio(tempUrl);

      audio.onloadedmetadata = () => {
        const duration = audio.duration;
        URL.revokeObjectURL(tempUrl); // Clean up temp URL

        // Read file as data URL (base64) so it persists in the database
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result as string;
          emit('addTrack', dataUrl, file.name.replace(/\.[^/.]+$/, ''), duration);
        };
        reader.onerror = () => {
          console.error('[AudioMixerTab] Error reading audio file');
        };
        reader.readAsDataURL(file);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(tempUrl);
        console.error('[AudioMixerTab] Error loading audio file');
      };

      target.value = '';
    }
  }

  function toggleOriginalMute() {
    if (!isOriginalMuted.value) {
      previousVolume.value = props.originalVolume || 1;
      isOriginalMuted.value = true;
      emit('updateOriginalVolume', 0);
    } else {
      isOriginalMuted.value = false;
      emit('updateOriginalVolume', previousVolume.value);
    }
  }

  function onOriginalVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const volume = parseFloat(target.value);
    emit('updateOriginalVolume', volume);
    if (volume > 0) {
      isOriginalMuted.value = false;
      previousVolume.value = volume;
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

  function updateTrackVolume(track: AudioTrack, e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateTrack', track.id, { volume: parseFloat(target.value) });
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

  // Watch for external volume changes
  watch(
    () => props.originalVolume,
    (newVolume) => {
      if (newVolume > 0) {
        isOriginalMuted.value = false;
      }
    }
  );
</script>
