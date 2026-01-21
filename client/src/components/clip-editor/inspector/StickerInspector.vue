<template>
  <div class="sticker-inspector">
    <div class="sticker-inspector__header">
      <Smile :size="18" />
      <h4 class="sticker-inspector__title">Sticker</h4>
    </div>

    <!-- Preview -->
    <div class="sticker-inspector__preview">
      <span class="sticker-inspector__preview-icon">{{ getStickerPreview() }}</span>
    </div>

    <!-- Transform -->
    <div class="sticker-inspector__section">
      <label class="sticker-inspector__label">Scale: {{ Math.round(sticker.scale * 100) }}%</label>
      <input
        :value="sticker.scale"
        type="range"
        min="0.1"
        max="3"
        step="0.05"
        class="sticker-inspector__slider"
        @input="updateProperty('scale', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <div class="sticker-inspector__section">
      <label class="sticker-inspector__label">Rotation: {{ Math.round(sticker.rotation) }}°</label>
      <input
        :value="sticker.rotation"
        type="range"
        min="-180"
        max="180"
        step="1"
        class="sticker-inspector__slider"
        @input="updateProperty('rotation', parseFloat(($event.target as HTMLInputElement).value))"
      />
    </div>

    <!-- Position -->
    <div class="sticker-inspector__row">
      <div class="sticker-inspector__section">
        <label class="sticker-inspector__label">X Position (%)</label>
        <input
          :value="sticker.position_x"
          type="number"
          min="0"
          max="100"
          class="sticker-inspector__input"
          @input="updateProperty('position_x', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="sticker-inspector__section">
        <label class="sticker-inspector__label">Y Position (%)</label>
        <input
          :value="sticker.position_y"
          type="number"
          min="0"
          max="100"
          class="sticker-inspector__input"
          @input="updateProperty('position_y', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Animation -->
    <div class="sticker-inspector__section">
      <label class="sticker-inspector__label">Animation</label>
      <select
        :value="sticker.animation"
        class="sticker-inspector__select"
        @change="updateProperty('animation', ($event.target as HTMLSelectElement).value)"
      >
        <option value="none">None</option>
        <option value="bounce">Bounce</option>
        <option value="spin">Spin</option>
        <option value="pulse">Pulse</option>
        <option value="shake">Shake</option>
        <option value="float">Float</option>
      </select>
    </div>

    <!-- Time Range -->
    <div class="sticker-inspector__row">
      <div class="sticker-inspector__section">
        <label class="sticker-inspector__label">Start (s)</label>
        <input
          :value="sticker.start_time.toFixed(2)"
          type="number"
          min="0"
          step="0.1"
          class="sticker-inspector__input"
          @input="updateProperty('start_time', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="sticker-inspector__section">
        <label class="sticker-inspector__label">End (s)</label>
        <input
          :value="sticker.end_time.toFixed(2)"
          type="number"
          min="0"
          step="0.1"
          class="sticker-inspector__input"
          @input="updateProperty('end_time', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Delete Button -->
    <div class="sticker-inspector__section">
      <button class="sticker-inspector__delete-button" @click="$emit('delete')">
        <Trash2 :size="16" />
        <span>Delete Sticker</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Smile, Trash2 } from 'lucide-vue-next';
import type { VideoEditorStickerRecord } from '@/services/database/video-editor-edits';

const props = defineProps<{
  sticker: VideoEditorStickerRecord;
}>();

const emit = defineEmits<{
  (e: 'update', property: string, value: any): void;
  (e: 'delete'): void;
}>();

function getStickerPreview(): string {
  if (props.sticker.sticker_type === 'emoji') {
    return props.sticker.sticker_path;
  }
  return '🖼️';
}

function updateProperty(property: string, value: any) {
  emit('update', property, value);
}
</script>

<style scoped>
.sticker-inspector {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.sticker-inspector__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #ec4899;
}

.sticker-inspector__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.sticker-inspector__preview {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
}

.sticker-inspector__preview-icon {
  font-size: 4rem;
}

.sticker-inspector__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.sticker-inspector__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.sticker-inspector__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.sticker-inspector__input,
.sticker-inspector__select {
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

.sticker-inspector__input:focus,
.sticker-inspector__select:focus {
  border-color: rgba(236, 72, 153, 0.5);
  background-color: rgba(255, 255, 255, 0.08);
}

.sticker-inspector__slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.sticker-inspector__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ec4899;
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.sticker-inspector__slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #ec4899;
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.sticker-inspector__delete-button {
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

.sticker-inspector__delete-button:hover {
  background-color: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.5);
}
</style>

