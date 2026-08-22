<template>
  <div class="style-preset-selector">
    <div class="preset-grid">
      <button
        v-for="pack in AI_VIDEO_STYLE_PACKS"
        :key="pack.id"
        type="button"
        class="preset-card"
        :class="{ 'preset-card--active': modelValue === pack.id }"
        @click="selectPreset(pack.id)"
      >
        <div class="preset-label">{{ pack.name }}</div>
        <div class="preset-description">{{ pack.description }}</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StylePackId } from '@/types/ai-video';
import { AI_VIDEO_STYLE_PACKS } from '@/data/ai-video-style-packs';

const props = defineProps<{
  modelValue: StylePackId | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: StylePackId): void;
}>();

function selectPreset(id: StylePackId) {
  emit('update:modelValue', id);
}
</script>

<style scoped>
.style-preset-selector {
  padding: 0;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.preset-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  cursor: pointer;
  transition: all 0.15s ease;
}

.preset-card:hover {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, var(--card));
}

.preset-card--active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 15%, var(--card));
  box-shadow: 0 0 0 1px var(--primary);
}

.preset-label {
  font-size: 11px;
  font-weight: 650;
  color: var(--foreground);
  text-align: left;
  line-height: 1.2;
}

.preset-description {
  font-size: 9px;
  color: var(--muted-foreground);
  text-align: left;
  line-height: 1.35;
}

.preset-card--active .preset-label {
  color: var(--primary);
  font-weight: 600;
}
</style>
