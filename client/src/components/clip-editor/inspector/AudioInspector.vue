<template>
  <div class="audio-inspector">
    <div class="audio-inspector__header">
      <Music :size="18" />
      <h4 class="audio-inspector__title">Audio Track</h4>
    </div>

    <!-- Track Name -->
    <div class="audio-inspector__section">
      <label class="audio-inspector__label">Track Name</label>
      <input
        :value="audioTrack.name"
        type="text"
        class="audio-inspector__input"
        placeholder="Track name"
        @input="updateProperty('name', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Volume Control -->
    <div class="audio-inspector__section">
      <label class="audio-inspector__label">
        Volume: {{ Math.round(audioTrack.volume * 100) }}%
      </label>
      <input
        :value="audioTrack.volume"
        type="range"
        min="0"
        max="2"
        step="0.01"
        class="audio-inspector__slider"
        @input="updateProperty('volume', parseFloat(($event.target as HTMLInputElement).value))"
      />
      <div class="audio-inspector__range-labels">
        <span>0%</span>
        <span>100%</span>
        <span>200%</span>
      </div>
    </div>

    <!-- Pan Control -->
    <div class="audio-inspector__section">
      <label class="audio-inspector__label">
        Pan: {{ panLabel }}
      </label>
      <input
        :value="audioTrack.pan"
        type="range"
        min="-1"
        max="1"
        step="0.01"
        class="audio-inspector__slider"
        @input="updateProperty('pan', parseFloat(($event.target as HTMLInputElement).value))"
      />
      <div class="audio-inspector__range-labels">
        <span>Left</span>
        <span>Center</span>
        <span>Right</span>
      </div>
    </div>

    <!-- Fade Controls -->
    <div class="audio-inspector__section">
      <label class="audio-inspector__label">Fade In (seconds)</label>
      <input
        :value="audioTrack.fade_in"
        type="number"
        min="0"
        max="10"
        step="0.1"
        class="audio-inspector__input"
        @input="updateProperty('fade_in', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="audio-inspector__section">
      <label class="audio-inspector__label">Fade Out (seconds)</label>
      <input
        :value="audioTrack.fade_out"
        type="number"
        min="0"
        max="10"
        step="0.1"
        class="audio-inspector__input"
        @input="updateProperty('fade_out', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- Toggle Controls -->
    <div class="audio-inspector__section">
      <div class="audio-inspector__toggles">
        <button
          class="audio-inspector__toggle"
          :class="{ 'audio-inspector__toggle--active': audioTrack.is_muted }"
          @click="updateProperty('is_muted', audioTrack.is_muted ? 0 : 1)"
        >
          <VolumeX :size="16" />
          <span>Mute</span>
        </button>

        <button
          class="audio-inspector__toggle"
          :class="{ 'audio-inspector__toggle--active': audioTrack.is_solo }"
          @click="updateProperty('is_solo', audioTrack.is_solo ? 0 : 1)"
        >
          <Headphones :size="16" />
          <span>Solo</span>
        </button>
      </div>
    </div>

    <!-- Time Range -->
    <div class="audio-inspector__section">
      <label class="audio-inspector__label">Start Time</label>
      <input
        :value="audioTrack.start_time.toFixed(2)"
        type="number"
        min="0"
        step="0.1"
        class="audio-inspector__input"
        @input="updateProperty('start_time', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="audio-inspector__section">
      <label class="audio-inspector__label">End Time</label>
      <input
        :value="audioTrack.end_time.toFixed(2)"
        type="number"
        min="0"
        step="0.1"
        class="audio-inspector__input"
        @input="updateProperty('end_time', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- Delete Button -->
    <div class="audio-inspector__section">
      <button class="audio-inspector__delete-button" @click="$emit('delete')">
        <Trash2 :size="16" />
        <span>Delete Track</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Music, VolumeX, Headphones, Trash2 } from 'lucide-vue-next';
import type { VideoEditorAudioTrackRecord } from '@/services/database/video-editor-edits';

const props = defineProps<{
  audioTrack: VideoEditorAudioTrackRecord;
}>();

const emit = defineEmits<{
  (e: 'update', property: string, value: any): void;
  (e: 'delete'): void;
}>();

const panLabel = computed(() => {
  const pan = props.audioTrack.pan;
  if (pan === 0) return 'Center';
  if (pan < 0) return `${Math.abs(pan * 100).toFixed(0)}% Left`;
  return `${(pan * 100).toFixed(0)}% Right`;
});

function updateProperty(property: string, value: any) {
  emit('update', property, value);
}
</script>

<style scoped>
.audio-inspector {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.audio-inspector__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.audio-inspector__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.audio-inspector__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.audio-inspector__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.audio-inspector__input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #f4f4f5;
  font-size: 0.875rem;
  outline: none;
  transition: all 150ms ease;
}

.audio-inspector__input:focus {
  border-color: rgba(14, 165, 233, 0.5);
  background-color: rgba(255, 255, 255, 0.08);
}

.audio-inspector__slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.audio-inspector__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #a78bfa;
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.audio-inspector__slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #a78bfa;
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.audio-inspector__range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.6875rem;
  color: rgba(255, 255, 255, 0.5);
}

.audio-inspector__toggles {
  display: flex;
  gap: 0.5rem;
}

.audio-inspector__toggle {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  font-weight: 500;
}

.audio-inspector__toggle:hover {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
}

.audio-inspector__toggle--active {
  background-color: rgba(14, 165, 233, 0.2);
  border-color: rgba(14, 165, 233, 0.4);
  color: var(--editor-accent);
}

.audio-inspector__delete-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem;
  background-color: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  color: #f87171;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.audio-inspector__delete-button:hover {
  background-color: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.5);
}
</style>

