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
      <div class="flex items-center gap-3">
        <span class="text-xs text-white/50 w-8">{{ Math.round(originalVolume * 100) }}%</span>
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

        <!-- Volume -->
        <div class="flex items-center gap-3 mb-3">
          <span class="text-xs text-white/50 w-8">{{ Math.round(track.volume * 100) }}%</span>
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
  import { ref } from 'vue';
  import { Volume2, VolumeX, Music, Plus, Headphones, Trash2 } from 'lucide-vue-next';
  import type { AudioTrack } from '@/types';

  const props = defineProps<{
    audioTracks: AudioTrack[];
    originalVolume: number;
  }>();

  const emit = defineEmits<{
    (e: 'addTrack', filePath: string, name: string): void;
    (e: 'updateTrack', trackId: string, updates: Partial<AudioTrack>): void;
    (e: 'deleteTrack', trackId: string): void;
    (e: 'updateOriginalVolume', volume: number): void;
  }>();

  const fileInputRef = ref<HTMLInputElement | null>(null);
  const isOriginalMuted = ref(false);

  function handleAddTrack() {
    fileInputRef.value?.click();
  }

  function onFileSelected(e: Event) {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      // In a real implementation, we'd upload the file and get a path
      // For now, we'll use the file name as a placeholder
      emit('addTrack', file.name, file.name.replace(/\.[^/.]+$/, ''));
      target.value = '';
    }
  }

  function toggleOriginalMute() {
    isOriginalMuted.value = !isOriginalMuted.value;
    emit('updateOriginalVolume', isOriginalMuted.value ? 0 : props.originalVolume);
  }

  function onOriginalVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const volume = parseFloat(target.value);
    emit('updateOriginalVolume', volume);
    if (volume > 0) {
      isOriginalMuted.value = false;
    }
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

  function updateTrackFadeIn(track: AudioTrack, e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateTrack', track.id, { fadeIn: parseFloat(target.value) });
  }

  function updateTrackFadeOut(track: AudioTrack, e: Event) {
    const target = e.target as HTMLInputElement;
    emit('updateTrack', track.id, { fadeOut: parseFloat(target.value) });
  }
</script>
