<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-base font-semibold text-zinc-100 m-0">Audio Tracks</h3>
      <button
        class="flex items-center gap-2 px-3 py-2 bg-green-500/15 border border-green-500/30 rounded-md text-green-400 cursor-pointer transition-all duration-150 text-xs font-medium hover:bg-green-500/25 hover:border-green-500/50"
        @click="handleAddMusic"
        title="Add Music Track"
      >
        <Plus :size="16" />
        <span>Add Music</span>
      </button>
    </div>

    <!-- Original Audio Track -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center gap-2 text-sm font-semibold text-white/90 pb-2 border-b border-white/10">
        <Music :size="16" />
        <span>Original Audio</span>
      </div>

      <div class="flex flex-col gap-3 p-3 bg-white/3 border border-white/8 rounded-md">
        <div class="flex items-center gap-2">
          <button
            class="flex items-center justify-center w-8 h-8 bg-transparent border border-white/10 rounded text-white/70 cursor-pointer transition-all duration-150 hover:bg-white/8 hover:border-white/20 hover:text-white/95"
            :class="{ 'bg-red-500/20 border-red-500/40 text-red-400': originalAudioMuted }"
            title="Mute"
            @click="toggleOriginalAudioMute"
          >
            <Volume2 v-if="!originalAudioMuted" :size="16" />
            <VolumeX v-else :size="16" />
          </button>

          <input
            v-model.number="originalAudioVolume"
            type="range"
            min="-20"
            max="20"
            step="0.5"
            class="flex-1 h-1 rounded bg-white/10 outline-none appearance-none disabled:opacity-30 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:shadow-black/30 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-green-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:shadow-black/30"
            :disabled="originalAudioMuted"
          />

          <span class="text-xs font-medium text-white/70 min-w-12 text-right tabular-nums">
            {{ originalAudioVolume.toFixed(1) }} dB
          </span>
        </div>

        <button
          class="flex items-center justify-center gap-2 p-2 bg-blue-500/15 border border-blue-500/30 rounded text-blue-400 cursor-pointer transition-all duration-150 text-xs font-medium hover:bg-blue-500/25 hover:border-blue-500/50"
          @click="handleDetachAudio"
          title="Detach audio to separate track for independent editing"
        >
          <Unlink :size="14" />
          <span>Detach Audio</span>
        </button>
      </div>
    </div>

    <!-- Music Tracks -->
    <div v-if="audioTracks.length > 0" class="flex flex-col gap-3">
      <div class="flex items-center gap-2 text-sm font-semibold text-white/90 pb-2 border-b border-white/10">
        <Disc3 :size="16" />
        <span>Music Tracks ({{ audioTracks.length }})</span>
      </div>

      <div
        v-for="(track, index) in audioTracks"
        :key="track.id"
        class="flex flex-col gap-3 p-3 bg-white/3 border border-white/8 rounded-md"
      >
        <div class="flex items-center gap-2">
          <input
            :value="track.name"
            class="flex-1 bg-transparent border-none border-b border-white/10 text-zinc-100 text-sm py-1 outline-none focus:border-sky-500/50"
            placeholder="Track name"
            @input="updateTrackName(track.id, ($event.target as HTMLInputElement).value)"
          />

          <button
            class="flex items-center justify-center w-8 h-8 bg-transparent border border-white/10 rounded text-white/70 cursor-pointer transition-all duration-150 hover:bg-white/8 hover:border-white/20 hover:text-white/95 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400"
            title="Remove Track"
            @click="removeTrack(track.id)"
          >
            <Trash2 :size="14" />
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button
            class="flex items-center justify-center w-8 h-8 bg-transparent border border-white/10 rounded text-white/70 cursor-pointer transition-all duration-150 hover:bg-white/8 hover:border-white/20 hover:text-white/95"
            :class="{ 'bg-red-500/20 border-red-500/40 text-red-400': track.is_muted }"
            title="Mute"
            @click="toggleTrackMute(track.id)"
          >
            <Volume2 v-if="!track.is_muted" :size="16" />
            <VolumeX v-else :size="16" />
          </button>

          <button
            class="flex items-center justify-center w-8 h-8 bg-transparent border border-white/10 rounded text-white/70 cursor-pointer transition-all duration-150 hover:bg-white/8 hover:border-white/20 hover:text-white/95"
            :class="{ 'bg-red-500/20 border-red-500/40 text-red-400': track.is_solo }"
            title="Solo"
            @click="toggleTrackSolo(track.id)"
          >
            <Headphones :size="16" />
          </button>

          <input
            :value="track.volume"
            type="range"
            min="0"
            max="2"
            step="0.01"
            class="flex-1 h-1 rounded bg-white/10 outline-none appearance-none disabled:opacity-30 disabled:cursor-not-allowed [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-green-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:shadow-black/30 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-green-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:shadow-black/30"
            :disabled="!!track.is_muted"
            @input="updateTrackVolume(track.id, parseFloat(($event.target as HTMLInputElement).value))"
          />

          <span class="text-xs font-medium text-white/70 min-w-12 text-right tabular-nums">
            {{ Math.round(track.volume * 100) }}%
          </span>
        </div>

        <!-- Fade Controls -->
        <div class="flex gap-3">
          <div class="flex-1 flex items-center gap-2">
            <label class="text-xs text-white/70 min-w-12">Fade In</label>
            <input
              :value="track.fade_in"
              type="number"
              min="0"
              max="10"
              step="0.1"
              class="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-zinc-100 text-xs outline-none focus:border-sky-500/50 focus:bg-white/8"
              @input="updateTrackFadeIn(track.id, parseFloat(($event.target as HTMLInputElement).value))"
            />
            <span class="text-xs text-white/50">s</span>
          </div>

          <div class="flex-1 flex items-center gap-2">
            <label class="text-xs text-white/70 min-w-12">Fade Out</label>
            <input
              :value="track.fade_out"
              type="number"
              min="0"
              max="10"
              step="0.1"
              class="flex-1 px-2 py-1.5 bg-white/5 border border-white/10 rounded text-zinc-100 text-xs outline-none focus:border-sky-500/50 focus:bg-white/8"
              @input="updateTrackFadeOut(track.id, parseFloat(($event.target as HTMLInputElement).value))"
            />
            <span class="text-xs text-white/50">s</span>
          </div>
        </div>

        <!-- Pan Control -->
        <div class="flex items-center gap-2">
          <label class="text-xs text-white/70 min-w-8">Pan</label>
          <input
            :value="track.pan"
            type="range"
            min="-1"
            max="1"
            step="0.01"
            class="flex-1 h-1 rounded bg-white/10 outline-none appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-purple-400 [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow [&::-webkit-slider-thumb]:shadow-black/30 [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-purple-400 [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-white [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow [&::-moz-range-thumb]:shadow-black/30"
            @input="updateTrackPan(track.id, parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="text-xs font-medium text-white/70 min-w-16 text-right tabular-nums">
            {{
              track.pan === 0
                ? 'Center'
                : track.pan < 0
                  ? `${Math.abs(track.pan * 100).toFixed(0)}% L`
                  : `${(track.pan * 100).toFixed(0)}% R`
            }}
          </span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="audioTracks.length === 0" class="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
      <Music :size="32" class="text-white/30" />
      <p class="text-white/50 text-sm m-0">No music tracks added yet</p>
      <button
        class="flex items-center gap-2 px-4 py-2.5 bg-green-500/15 border border-green-500/30 rounded-md text-green-400 cursor-pointer transition-all duration-150 text-sm font-medium hover:bg-green-500/25 hover:border-green-500/50"
        @click="handleAddMusic"
      >
        <Plus :size="16" />
        <span>Add Your First Track</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { open } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
  import { Plus, Music, Disc3, Volume2, VolumeX, Headphones, Trash2, Unlink } from 'lucide-vue-next';
  import {
    getVideoEditorAudioTracksByEditId,
    createVideoEditorAudioTrack,
    updateVideoEditorAudioTrack,
    deleteVideoEditorAudioTrack,
    type VideoEditorAudioTrackRecord,
  } from '@/services/database/video-editor-edits';

  const props = defineProps<{
    editId: string | null;
  }>();

  const emit = defineEmits<{
    (e: 'detachAudio'): void;
    (e: 'tracksUpdated'): void;
  }>();

  // State
  const audioTracks = ref<VideoEditorAudioTrackRecord[]>([]);
  const originalAudioVolume = ref(0); // dB
  const originalAudioMuted = ref(false);

  // Load audio tracks
  async function loadAudioTracks() {
    if (!props.editId) return;

    try {
      audioTracks.value = await getVideoEditorAudioTracksByEditId(props.editId);
      console.log('[AudioPanel] Loaded audio tracks:', audioTracks.value.length);
    } catch (error) {
      console.error('[AudioPanel] Failed to load audio tracks:', error);
    }
  }

  // Add music track
  async function handleAddMusic() {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: 'Audio',
            extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'],
          },
        ],
      });

      if (!selected || !props.editId) return;

      const filePath = selected as string;

      // Get audio duration
      const duration = await invoke<number>('get_audio_duration', { filePath });

      // Create audio track
      await createVideoEditorAudioTrack(props.editId, {
        file_path: filePath,
        name:
          filePath
            .split(/[\\/]/)
            .pop()
            ?.replace(/\.[^.]+$/, '') || 'Music',
        start_time: 0,
        end_time: duration,
        volume: 1.0,
        pan: 0,
        fade_in: 0,
        fade_out: 0,
        track_order: audioTracks.value.length,
        is_muted: 0,
        is_solo: 0,
      });

      await loadAudioTracks();
      emit('tracksUpdated');

      console.log('[AudioPanel] Added music track:', filePath);
    } catch (error) {
      console.error('[AudioPanel] Failed to add music:', error);
    }
  }

  // Handle detach audio
  function handleDetachAudio() {
    emit('detachAudio');
  }

  // Toggle original audio mute
  function toggleOriginalAudioMute() {
    originalAudioMuted.value = !originalAudioMuted.value;
  }

  // Update track name
  async function updateTrackName(trackId: string, name: string) {
    try {
      await updateVideoEditorAudioTrack(trackId, { name });
      await loadAudioTracks();
      emit('tracksUpdated');
    } catch (error) {
      console.error('[AudioPanel] Failed to update track name:', error);
    }
  }

  // Toggle track mute
  async function toggleTrackMute(trackId: string) {
    const track = audioTracks.value.find((t) => t.id === trackId);
    if (!track) return;

    try {
      await updateVideoEditorAudioTrack(trackId, { is_muted: track.is_muted ? 0 : 1 });
      await loadAudioTracks();
      emit('tracksUpdated');
    } catch (error) {
      console.error('[AudioPanel] Failed to toggle mute:', error);
    }
  }

  // Toggle track solo
  async function toggleTrackSolo(trackId: string) {
    const track = audioTracks.value.find((t) => t.id === trackId);
    if (!track) return;

    try {
      await updateVideoEditorAudioTrack(trackId, { is_solo: track.is_solo ? 0 : 1 });
      await loadAudioTracks();
      emit('tracksUpdated');
    } catch (error) {
      console.error('[AudioPanel] Failed to toggle solo:', error);
    }
  }

  // Update track volume
  async function updateTrackVolume(trackId: string, volume: number) {
    try {
      await updateVideoEditorAudioTrack(trackId, { volume });
      emit('tracksUpdated');
    } catch (error) {
      console.error('[AudioPanel] Failed to update volume:', error);
    }
  }

  // Update track fade in
  async function updateTrackFadeIn(trackId: string, fadeIn: number) {
    try {
      await updateVideoEditorAudioTrack(trackId, { fade_in: fadeIn });
      emit('tracksUpdated');
    } catch (error) {
      console.error('[AudioPanel] Failed to update fade in:', error);
    }
  }

  // Update track fade out
  async function updateTrackFadeOut(trackId: string, fadeOut: number) {
    try {
      await updateVideoEditorAudioTrack(trackId, { fade_out: fadeOut });
      emit('tracksUpdated');
    } catch (error) {
      console.error('[AudioPanel] Failed to update fade out:', error);
    }
  }

  // Update track pan
  async function updateTrackPan(trackId: string, pan: number) {
    try {
      await updateVideoEditorAudioTrack(trackId, { pan });
      emit('tracksUpdated');
    } catch (error) {
      console.error('[AudioPanel] Failed to update pan:', error);
    }
  }

  // Remove track
  async function removeTrack(trackId: string) {
    try {
      await deleteVideoEditorAudioTrack(trackId);
      await loadAudioTracks();
      emit('tracksUpdated');
      console.log('[AudioPanel] Removed track:', trackId);
    } catch (error) {
      console.error('[AudioPanel] Failed to remove track:', error);
    }
  }

  // Load tracks on mount
  if (props.editId) {
    loadAudioTracks();
  }
</script>
