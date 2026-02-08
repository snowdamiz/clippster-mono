<template>
  <div class="style-preset-selector">
    <div class="preset-grid">
      <button
        v-for="preset in presets"
        :key="preset.id"
        class="preset-card"
        :class="{ 'preset-card--active': modelValue === preset.id }"
        @click="selectPreset(preset.id)"
      >
        <div class="preset-icon">{{ preset.icon }}</div>
        <div class="preset-label">{{ preset.name }}</div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { StylePreset } from '@/types/ai-video';

const props = defineProps<{
  modelValue: StylePreset | null;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: StylePreset | null): void;
}>();

const presets: Array<{ id: StylePreset; name: string; icon: string }> = [
  { id: 'hype', name: 'Hype', icon: '🔥' },
  { id: 'professional', name: 'Professional', icon: '✨' },
  { id: 'gaming', name: 'Gaming', icon: '🎮' },
  { id: 'cinematic', name: 'Cinematic', icon: '🎬' },
  { id: 'tutorial', name: 'Tutorial', icon: '📚' },
  { id: 'vlog', name: 'Vlog', icon: '📹' },
  { id: 'music_video', name: 'Music', icon: '🎵' },
  { id: 'product', name: 'Product', icon: '🛍️' },
];

function selectPreset(id: StylePreset) {
  emit('update:modelValue', props.modelValue === id ? null : id);
}
</script>

<style scoped>
.style-preset-selector {
  padding: 0;
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.preset-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 4px;
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

.preset-icon {
  font-size: 20px;
  line-height: 1;
}

.preset-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--muted-foreground);
  text-align: center;
  line-height: 1.2;
}

.preset-card--active .preset-label {
  color: var(--primary);
  font-weight: 600;
}
</style>
