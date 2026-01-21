<template>
  <div class="audio-panel">
    <div class="audio-panel__header">
      <h3 class="audio-panel__title">Audio Tracks</h3>
      <button class="audio-panel__add-button" @click="handleAddMusic" title="Add Music Track">
        <Plus :size="16" />
        <span>Add Music</span>
      </button>
    </div>

    <!-- Original Audio Track -->
    <div class="audio-panel__section">
      <div class="audio-panel__section-header">
        <Music :size="16" />
        <span>Original Audio</span>
      </div>
      
      <div class="audio-panel__track-item">
        <div class="audio-panel__track-controls">
          <button
            class="audio-panel__icon-button"
            :class="{ 'audio-panel__icon-button--active': originalAudioMuted }"
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
            class="audio-panel__volume-slider"
            :disabled="originalAudioMuted"
          />
          
          <span class="audio-panel__volume-value">{{ originalAudioVolume.toFixed(1) }} dB</span>
        </div>

        <button
          class="audio-panel__detach-button"
          @click="handleDetachAudio"
          title="Detach audio to separate track for independent editing"
        >
          <Unlink :size="14" />
          <span>Detach Audio</span>
        </button>
      </div>
    </div>

    <!-- Music Tracks -->
    <div v-if="audioTracks.length > 0" class="audio-panel__section">
      <div class="audio-panel__section-header">
        <Disc3 :size="16" />
        <span>Music Tracks ({{ audioTracks.length }})</span>
      </div>

      <div
        v-for="(track, index) in audioTracks"
        :key="track.id"
        class="audio-panel__track-item"
      >
        <div class="audio-panel__track-header">
          <input
            :value="track.name"
            class="audio-panel__track-name"
            placeholder="Track name"
            @input="updateTrackName(track.id, ($event.target as HTMLInputElement).value)"
          />
          
          <button
            class="audio-panel__icon-button audio-panel__icon-button--danger"
            title="Remove Track"
            @click="removeTrack(track.id)"
          >
            <Trash2 :size="14" />
          </button>
        </div>

        <div class="audio-panel__track-controls">
          <button
            class="audio-panel__icon-button"
            :class="{ 'audio-panel__icon-button--active': track.is_muted }"
            title="Mute"
            @click="toggleTrackMute(track.id)"
          >
            <Volume2 v-if="!track.is_muted" :size="16" />
            <VolumeX v-else :size="16" />
          </button>

          <button
            class="audio-panel__icon-button"
            :class="{ 'audio-panel__icon-button--active': track.is_solo }"
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
            class="audio-panel__volume-slider"
            :disabled="track.is_muted"
            @input="updateTrackVolume(track.id, parseFloat(($event.target as HTMLInputElement).value))"
          />
          
          <span class="audio-panel__volume-value">{{ Math.round(track.volume * 100) }}%</span>
        </div>

        <!-- Fade Controls -->
        <div class="audio-panel__fade-controls">
          <div class="audio-panel__fade-control">
            <label class="audio-panel__fade-label">Fade In</label>
            <input
              :value="track.fade_in"
              type="number"
              min="0"
              max="10"
              step="0.1"
              class="audio-panel__fade-input"
              @input="updateTrackFadeIn(track.id, parseFloat(($event.target as HTMLInputElement).value))"
            />
            <span class="audio-panel__fade-unit">s</span>
          </div>

          <div class="audio-panel__fade-control">
            <label class="audio-panel__fade-label">Fade Out</label>
            <input
              :value="track.fade_out"
              type="number"
              min="0"
              max="10"
              step="0.1"
              class="audio-panel__fade-input"
              @input="updateTrackFadeOut(track.id, parseFloat(($event.target as HTMLInputElement).value))"
            />
            <span class="audio-panel__fade-unit">s</span>
          </div>
        </div>

        <!-- Pan Control -->
        <div class="audio-panel__pan-control">
          <label class="audio-panel__pan-label">Pan</label>
          <input
            :value="track.pan"
            type="range"
            min="-1"
            max="1"
            step="0.01"
            class="audio-panel__pan-slider"
            @input="updateTrackPan(track.id, parseFloat(($event.target as HTMLInputElement).value))"
          />
          <span class="audio-panel__pan-value">
            {{ track.pan === 0 ? 'Center' : track.pan < 0 ? `${Math.abs(track.pan * 100).toFixed(0)}% L` : `${(track.pan * 100).toFixed(0)}% R` }}
          </span>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="audioTracks.length === 0" class="audio-panel__empty">
      <Music :size="32" class="audio-panel__empty-icon" />
      <p class="audio-panel__empty-text">No music tracks added yet</p>
      <button class="audio-panel__empty-button" @click="handleAddMusic">
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
      filters: [{
        name: 'Audio',
        extensions: ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'],
      }],
    });

    if (!selected || !props.editId) return;

    const filePath = selected as string;
    
    // Get audio duration
    const duration = await invoke<number>('get_audio_duration', { filePath });
    
    // Create audio track
    await createVideoEditorAudioTrack(props.editId, {
      file_path: filePath,
      name: filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') || 'Music',
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
  const track = audioTracks.value.find(t => t.id === trackId);
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
  const track = audioTracks.value.find(t => t.id === trackId);
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

<style scoped>
.audio-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.audio-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.audio-panel__title {
  font-size: 1rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.audio-panel__add-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 6px;
  color: #4ade80;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  font-weight: 500;
}

.audio-panel__add-button:hover {
  background-color: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.5);
}

.audio-panel__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.audio-panel__section-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.audio-panel__track-item {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
}

.audio-panel__track-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.audio-panel__track-name {
  flex: 1;
  background-color: transparent;
  border: none;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #f4f4f5;
  font-size: 0.875rem;
  padding: 0.25rem 0;
  outline: none;
}

.audio-panel__track-name:focus {
  border-bottom-color: rgba(14, 165, 233, 0.5);
}

.audio-panel__track-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.audio-panel__icon-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 150ms ease;
}

.audio-panel__icon-button:hover {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.95);
}

.audio-panel__icon-button--active {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.audio-panel__icon-button--danger:hover {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.audio-panel__volume-slider {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.audio-panel__volume-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #4ade80;
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.audio-panel__volume-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #4ade80;
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.audio-panel__volume-slider:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.audio-panel__volume-value {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  min-width: 48px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.audio-panel__detach-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 4px;
  color: #60a5fa;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  font-weight: 500;
}

.audio-panel__detach-button:hover {
  background-color: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.5);
}

.audio-panel__fade-controls {
  display: flex;
  gap: 0.75rem;
}

.audio-panel__fade-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.audio-panel__fade-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  min-width: 48px;
}

.audio-panel__fade-input {
  flex: 1;
  padding: 0.375rem 0.5rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #f4f4f5;
  font-size: 0.8125rem;
  outline: none;
}

.audio-panel__fade-input:focus {
  border-color: rgba(14, 165, 233, 0.5);
  background-color: rgba(255, 255, 255, 0.08);
}

.audio-panel__fade-unit {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
}

.audio-panel__pan-control {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.audio-panel__pan-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.7);
  min-width: 32px;
}

.audio-panel__pan-slider {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.audio-panel__pan-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #a78bfa;
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.audio-panel__pan-slider::-moz-range-thumb {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #a78bfa;
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.audio-panel__pan-value {
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  min-width: 64px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.audio-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem 1.5rem;
  text-align: center;
}

.audio-panel__empty-icon {
  color: rgba(255, 255, 255, 0.3);
}

.audio-panel__empty-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.875rem;
  margin: 0;
}

.audio-panel__empty-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background-color: rgba(34, 197, 94, 0.15);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 6px;
  color: #4ade80;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.audio-panel__empty-button:hover {
  background-color: rgba(34, 197, 94, 0.25);
  border-color: rgba(34, 197, 94, 0.5);
}
</style>

