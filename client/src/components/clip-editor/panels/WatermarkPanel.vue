<template>
  <div class="watermark-panel">
    <div class="watermark-panel__header">
      <h3 class="watermark-panel__title">Watermark</h3>
    </div>

    <!-- Creator Default Watermark Info -->
    <div v-if="creatorWatermarkId" class="watermark-panel__creator-default">
      <div class="watermark-panel__info-badge">
        <Sparkles :size="14" />
        <span>Creator Profile Default</span>
      </div>
      <p class="watermark-panel__info-text">
        This clip will use the watermark configured in your creator profile.
      </p>
    </div>

    <!-- Enable/Disable Toggle -->
    <div class="watermark-panel__section">
      <label class="watermark-panel__toggle-label">
        <input
          v-model="watermarkEnabled"
          type="checkbox"
          class="watermark-panel__checkbox"
        />
        <span>Enable Watermark</span>
      </label>
    </div>

    <!-- Per-Ratio Settings -->
    <div v-if="watermarkEnabled" class="watermark-panel__settings">
      <!-- Aspect Ratio Selector -->
      <div class="watermark-panel__section">
        <label class="watermark-panel__label">Active Aspect Ratio</label>
        <div class="watermark-panel__ratio-buttons">
          <button
            v-for="ratio in aspectRatios"
            :key="ratio"
            class="watermark-panel__ratio-button"
            :class="{ 'watermark-panel__ratio-button--active': selectedRatio === ratio }"
            @click="selectedRatio = ratio"
          >
            {{ ratio }}
          </button>
        </div>
      </div>

      <!-- Position Presets -->
      <div class="watermark-panel__section">
        <label class="watermark-panel__label">Position Preset</label>
        <div class="watermark-panel__position-grid">
          <button
            v-for="preset in positionPresets"
            :key="preset.id"
            class="watermark-panel__position-button"
            :title="preset.label"
            @click="applyPositionPreset(preset)"
          >
            {{ preset.label }}
          </button>
        </div>
      </div>

      <!-- Manual Position -->
      <div class="watermark-panel__row">
        <div class="watermark-panel__section">
          <label class="watermark-panel__label">X Position (%)</label>
          <input
            v-model.number="positionX"
            type="number"
            min="0"
            max="100"
            class="watermark-panel__input"
          />
        </div>

        <div class="watermark-panel__section">
          <label class="watermark-panel__label">Y Position (%)</label>
          <input
            v-model.number="positionY"
            type="number"
            min="0"
            max="100"
            class="watermark-panel__input"
          />
        </div>
      </div>

      <!-- Scale -->
      <div class="watermark-panel__section">
        <label class="watermark-panel__label">Scale: {{ scale }}%</label>
        <input
          v-model.number="scale"
          type="range"
          min="5"
          max="100"
          step="1"
          class="watermark-panel__slider"
        />
      </div>

      <!-- Opacity -->
      <div class="watermark-panel__section">
        <label class="watermark-panel__label">Opacity: {{ opacity }}%</label>
        <input
          v-model.number="opacity"
          type="range"
          min="0"
          max="100"
          step="1"
          class="watermark-panel__slider"
        />
      </div>

      <!-- Time Range -->
      <div class="watermark-panel__section">
        <label class="watermark-panel__label">Visibility</label>
        <div class="watermark-panel__time-range">
          <input
            v-model.number="startTime"
            type="number"
            min="0"
            step="0.1"
            class="watermark-panel__input"
            placeholder="Start (s)"
          />
          <span class="watermark-panel__time-separator">to</span>
          <input
            v-model.number="endTime"
            type="number"
            min="0"
            step="0.1"
            class="watermark-panel__input"
            placeholder="End (s)"
          />
        </div>
      </div>

      <!-- Apply Button -->
      <button class="watermark-panel__apply-button" @click="handleApply">
        <Save :size="16" />
        <span>Apply Settings</span>
      </button>
    </div>

    <!-- Info -->
    <div class="watermark-panel__info">
      <Info :size="14" />
      <p>Watermark settings can be configured per aspect ratio for optimal placement.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Sparkles, Info, Save } from 'lucide-vue-next';

const props = defineProps<{
  creatorWatermarkId: string | null;
  creatorWatermarkSettings: any;
  editId: string | null;
}>();

const emit = defineEmits<{
  (e: 'watermarkUpdated'): void;
}>();

// State
const watermarkEnabled = ref(!!props.creatorWatermarkId);
const selectedRatio = ref('16:9');
const positionX = ref(12);
const positionY = ref(92);
const scale = ref(20);
const opacity = ref(80);
const startTime = ref(0);
const endTime = ref(0);

const aspectRatios = ['16:9', '9:16', '1:1', '4:5'];

const positionPresets = [
  { id: 'top-left', label: 'Top Left', x: 8, y: 8 },
  { id: 'top-right', label: 'Top Right', x: 92, y: 8 },
  { id: 'bottom-left', label: 'Bottom Left', x: 8, y: 92 },
  { id: 'bottom-right', label: 'Bottom Right', x: 92, y: 92 },
  { id: 'center', label: 'Center', x: 50, y: 50 },
];

function applyPositionPreset(preset: any) {
  positionX.value = preset.x;
  positionY.value = preset.y;
}

async function handleApply() {
  console.log('[WatermarkPanel] Applying watermark settings for', selectedRatio.value);
  // TODO: Save watermark settings to database
  emit('watermarkUpdated');
}
</script>

<style scoped>
.watermark-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.watermark-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.watermark-panel__title {
  font-size: 1rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.watermark-panel__creator-default {
  padding: 0.75rem;
  background-color: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
}

.watermark-panel__info-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #60a5fa;
  font-size: 0.8125rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.watermark-panel__info-text {
  font-size: 0.8125rem;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  line-height: 1.5;
}

.watermark-panel__section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.watermark-panel__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.watermark-panel__toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
}

.watermark-panel__checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.watermark-panel__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}

.watermark-panel__ratio-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.375rem;
}

.watermark-panel__ratio-button {
  padding: 0.5rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  font-weight: 500;
}

.watermark-panel__ratio-button:hover {
  background-color: rgba(255, 255, 255, 0.08);
}

.watermark-panel__ratio-button--active {
  background-color: rgba(59, 130, 246, 0.2);
  border-color: rgba(59, 130, 246, 0.4);
  color: #60a5fa;
}

.watermark-panel__position-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.375rem;
}

.watermark-panel__position-button {
  padding: 0.5rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.75rem;
  font-weight: 500;
}

.watermark-panel__position-button:hover {
  background-color: rgba(59, 130, 246, 0.15);
  border-color: rgba(59, 130, 246, 0.3);
  color: #60a5fa;
}

.watermark-panel__input {
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

.watermark-panel__input:focus {
  border-color: rgba(59, 130, 246, 0.5);
  background-color: rgba(255, 255, 255, 0.08);
}

.watermark-panel__slider {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.1);
  outline: none;
  -webkit-appearance: none;
  appearance: none;
}

.watermark-panel__slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #60a5fa;
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.watermark-panel__slider::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #60a5fa;
  border: 2px solid #fff;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
}

.watermark-panel__time-range {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.watermark-panel__time-separator {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.875rem;
}

.watermark-panel__apply-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: rgba(59, 130, 246, 0.15);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 6px;
  color: #60a5fa;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.watermark-panel__apply-button:hover {
  background-color: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.5);
}

.watermark-panel__info {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  line-height: 1.5;
}

.watermark-panel__info p {
  margin: 0;
}
</style>

