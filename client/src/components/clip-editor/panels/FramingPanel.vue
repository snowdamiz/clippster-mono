<template>
  <div class="framing-panel">
    <div class="framing-panel__header">
      <h3 class="framing-panel__title">Aspect Ratio & Framing</h3>
    </div>

    <!-- Aspect Ratio Selection -->
    <div class="framing-panel__section">
      <label class="framing-panel__label">Export Aspect Ratios</label>
      <div class="framing-panel__ratio-grid">
        <button
          v-for="ratio in aspectRatios"
          :key="ratio"
          class="framing-panel__ratio-card"
          :class="{ 'framing-panel__ratio-card--active': selectedRatios.includes(ratio) }"
          @click="toggleRatio(ratio)"
        >
          <span class="framing-panel__ratio-label">{{ ratio }}</span>
          <Check v-if="selectedRatios.includes(ratio)" :size="14" class="framing-panel__ratio-check" />
        </button>
      </div>
    </div>

    <!-- Framing Mode -->
    <div class="framing-panel__section">
      <label class="framing-panel__label">Framing Mode</label>
      <div class="framing-panel__mode-options">
        <label
          v-for="mode in framingModes"
          :key="mode.id"
          class="framing-panel__mode-option"
          :class="{ 'framing-panel__mode-option--active': framingMode === mode.id }"
        >
          <input
            v-model="framingMode"
            type="radio"
            :value="mode.id"
            class="framing-panel__radio"
          />
          <div class="framing-panel__mode-content">
            <component :is="mode.icon" :size="18" />
            <div class="framing-panel__mode-info">
              <span class="framing-panel__mode-name">{{ mode.name }}</span>
              <span class="framing-panel__mode-desc">{{ mode.description }}</span>
            </div>
          </div>
        </label>
      </div>
    </div>

    <!-- Manual Framing Button -->
    <div v-if="framingMode === 'manual'" class="framing-panel__section">
      <button class="framing-panel__edit-button" @click="handleOpenFramingEditor">
        <Crop :size="16" />
        <span>Edit Crop Regions</span>
      </button>
      <p class="framing-panel__hint">
        Define custom crop regions for each aspect ratio
      </p>
    </div>

    <!-- Info -->
    <div class="framing-panel__info">
      <Info :size="14" />
      <p>Configure how your video is framed for different aspect ratios when exporting.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Check, Crop, Info, Scan, Users, Hand } from 'lucide-vue-next';

const props = defineProps<{
  editId: string | null;
}>();

const emit = defineEmits<{
  (e: 'ratiosChanged', ratios: string[]): void;
  (e: 'framingModeChanged', mode: string): void;
  (e: 'openFramingEditor'): void;
}>();

const aspectRatios = ['16:9', '9:16', '1:1', '4:5'];
const selectedRatios = ref(['16:9']);
const framingMode = ref('auto');

const framingModes = [
  {
    id: 'auto',
    name: 'Auto (Face Detection)',
    description: 'AI tracks faces automatically',
    icon: Scan,
  },
  {
    id: 'speaker',
    name: 'Speaker Tracking',
    description: 'Follow active speaker',
    icon: Users,
  },
  {
    id: 'manual',
    name: 'Manual Framing',
    description: 'Custom crop regions',
    icon: Hand,
  },
];

function toggleRatio(ratio: string) {
  const index = selectedRatios.value.indexOf(ratio);
  if (index > -1) {
    // Don't allow removing if it's the only one
    if (selectedRatios.value.length > 1) {
      selectedRatios.value.splice(index, 1);
    }
  } else {
    selectedRatios.value.push(ratio);
  }
  emit('ratiosChanged', selectedRatios.value);
}

function handleOpenFramingEditor() {
  emit('openFramingEditor');
}
</script>

<style scoped>
.framing-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.framing-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.framing-panel__title {
  font-size: 1rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.framing-panel__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.framing-panel__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.framing-panel__ratio-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.framing-panel__ratio-card {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 150ms ease;
  font-weight: 600;
}

.framing-panel__ratio-card:hover {
  background-color: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.framing-panel__ratio-card--active {
  background-color: rgba(14, 165, 233, 0.15);
  border-color: rgba(14, 165, 233, 0.4);
  color: var(--editor-accent);
}

.framing-panel__ratio-check {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
}

.framing-panel__mode-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.framing-panel__mode-option {
  display: flex;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms ease;
}

.framing-panel__mode-option:hover {
  background-color: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.framing-panel__mode-option--active {
  background-color: rgba(14, 165, 233, 0.15);
  border-color: rgba(14, 165, 233, 0.4);
}

.framing-panel__radio {
  margin-right: 0.75rem;
}

.framing-panel__mode-content {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  flex: 1;
  color: rgba(255, 255, 255, 0.9);
}

.framing-panel__mode-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.framing-panel__mode-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: #f4f4f5;
}

.framing-panel__mode-desc {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
}

.framing-panel__edit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(14, 165, 233, 0.3);
  border-radius: 6px;
  color: var(--editor-accent);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.framing-panel__edit-button:hover {
  background-color: rgba(14, 165, 233, 0.25);
  border-color: rgba(14, 165, 233, 0.5);
}

.framing-panel__hint {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
  text-align: center;
}

.framing-panel__info {
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

.framing-panel__info p {
  margin: 0;
}
</style>

