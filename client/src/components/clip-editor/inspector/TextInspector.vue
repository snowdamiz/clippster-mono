<template>
  <div class="text-inspector">
    <div class="text-inspector__header">
      <Type :size="18" />
      <h4 class="text-inspector__title">Text Overlay</h4>
    </div>

    <!-- Text Content -->
    <div class="text-inspector__section">
      <label class="text-inspector__label">Text</label>
      <textarea
        :value="textOverlay.text"
        class="text-inspector__textarea"
        placeholder="Enter text..."
        rows="3"
        @input="updateProperty('text', ($event.target as HTMLTextAreaElement).value)"
      />
    </div>

    <!-- Font Settings -->
    <div class="text-inspector__section">
      <label class="text-inspector__label">Font Family</label>
      <select
        :value="style.fontFamily"
        class="text-inspector__select"
        @change="updateStyle('fontFamily', ($event.target as HTMLSelectElement).value)"
      >
        <option value="Inter">Inter</option>
        <option value="Arial">Arial</option>
        <option value="Helvetica">Helvetica</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Georgia">Georgia</option>
        <option value="Impact">Impact</option>
        <option value="Courier New">Courier New</option>
      </select>
    </div>

    <div class="text-inspector__row">
      <div class="text-inspector__section">
        <label class="text-inspector__label">Size</label>
        <input
          :value="style.fontSize"
          type="number"
          min="12"
          max="200"
          class="text-inspector__input"
          @input="updateStyle('fontSize', parseInt(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="text-inspector__section">
        <label class="text-inspector__label">Weight</label>
        <select
          :value="style.fontWeight"
          class="text-inspector__select"
          @change="updateStyle('fontWeight', parseInt(($event.target as HTMLSelectElement).value))"
        >
          <option :value="400">Normal</option>
          <option :value="500">Medium</option>
          <option :value="600">Semi-Bold</option>
          <option :value="700">Bold</option>
          <option :value="800">Extra-Bold</option>
          <option :value="900">Black</option>
        </select>
      </div>
    </div>

    <!-- Color Settings -->
    <div class="text-inspector__section">
      <label class="text-inspector__label">Text Color</label>
      <input
        :value="style.color"
        type="color"
        class="text-inspector__color"
        @input="updateStyle('color', ($event.target as HTMLInputElement).value)"
      />
    </div>

    <!-- Position -->
    <div class="text-inspector__row">
      <div class="text-inspector__section">
        <label class="text-inspector__label">X Position (%)</label>
        <input
          :value="textOverlay.position_x"
          type="number"
          min="0"
          max="100"
          class="text-inspector__input"
          @input="updateProperty('position_x', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="text-inspector__section">
        <label class="text-inspector__label">Y Position (%)</label>
        <input
          :value="textOverlay.position_y"
          type="number"
          min="0"
          max="100"
          class="text-inspector__input"
          @input="updateProperty('position_y', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Animation -->
    <div class="text-inspector__section">
      <label class="text-inspector__label">Animation</label>
      <select
        :value="textOverlay.animation"
        class="text-inspector__select"
        @change="updateProperty('animation', ($event.target as HTMLSelectElement).value)"
      >
        <option value="none">None</option>
        <option value="fade">Fade</option>
        <option value="slide-up">Slide Up</option>
        <option value="slide-down">Slide Down</option>
        <option value="zoom">Zoom</option>
        <option value="pop">Pop</option>
        <option value="typewriter">Typewriter</option>
      </select>
    </div>

    <!-- Time Range -->
    <div class="text-inspector__row">
      <div class="text-inspector__section">
        <label class="text-inspector__label">Start (s)</label>
        <input
          :value="textOverlay.start_time.toFixed(2)"
          type="number"
          min="0"
          step="0.1"
          class="text-inspector__input"
          @input="updateProperty('start_time', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>

      <div class="text-inspector__section">
        <label class="text-inspector__label">End (s)</label>
        <input
          :value="textOverlay.end_time.toFixed(2)"
          type="number"
          min="0"
          step="0.1"
          class="text-inspector__input"
          @input="updateProperty('end_time', parseFloat(($event.target as HTMLInputElement).value))"
        />
      </div>
    </div>

    <!-- Delete Button -->
    <div class="text-inspector__section">
      <button class="text-inspector__delete-button" @click="$emit('delete')">
        <Trash2 :size="16" />
        <span>Delete Text</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Type, Trash2 } from 'lucide-vue-next';
import type { VideoEditorTextOverlayRecord } from '@/services/database/video-editor-edits';

const props = defineProps<{
  textOverlay: VideoEditorTextOverlayRecord;
}>();

const emit = defineEmits<{
  (e: 'update', property: string, value: any): void;
  (e: 'delete'): void;
}>();

const style = computed(() => {
  try {
    return JSON.parse(props.textOverlay.style_data || '{}');
  } catch {
    return {};
  }
});

function updateProperty(property: string, value: any) {
  emit('update', property, value);
}

function updateStyle(property: string, value: any) {
  const newStyle = { ...style.value, [property]: value };
  emit('update', 'style_data', JSON.stringify(newStyle));
}
</script>

<style scoped>
.text-inspector {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.text-inspector__header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  color: #fbbf24;
}

.text-inspector__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.text-inspector__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.text-inspector__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.text-inspector__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.text-inspector__input,
.text-inspector__select {
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

.text-inspector__input:focus,
.text-inspector__select:focus {
  border-color: rgba(251, 191, 36, 0.5);
  background-color: rgba(255, 255, 255, 0.08);
}

.text-inspector__textarea {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: #f4f4f5;
  font-size: 0.875rem;
  outline: none;
  transition: all 150ms ease;
  resize: vertical;
  font-family: inherit;
}

.text-inspector__textarea:focus {
  border-color: rgba(251, 191, 36, 0.5);
  background-color: rgba(255, 255, 255, 0.08);
}

.text-inspector__color {
  width: 100%;
  height: 40px;
  padding: 0.25rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  cursor: pointer;
}

.text-inspector__delete-button {
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

.text-inspector__delete-button:hover {
  background-color: rgba(239, 68, 68, 0.25);
  border-color: rgba(239, 68, 68, 0.5);
}
</style>

