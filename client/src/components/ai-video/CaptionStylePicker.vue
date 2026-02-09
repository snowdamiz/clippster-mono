<template>
  <div class="caption-style-picker">
    <div class="caption-options">
      <button
        v-for="option in options"
        :key="option.id"
        class="caption-option"
        :class="{ 'caption-option--active': modelValue === option.id }"
        @click="select(option.id)"
      >
        <div class="caption-preview" :style="option.previewStyle">
          {{ option.previewText }}
        </div>
        <span class="caption-option-label">{{ option.name }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { CSSProperties } from 'vue';
import type { CaptionStylePreset } from '@/types/ai-video';

const props = defineProps<{
  modelValue: CaptionStylePreset;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: CaptionStylePreset): void;
}>();

interface CaptionOption {
  id: CaptionStylePreset;
  name: string;
  previewText: string;
  previewStyle: CSSProperties;
}

const options: CaptionOption[] = [
  {
    id: 'bold_tiktok',
    name: 'Bold TikTok',
    previewText: 'BOLD',
    previewStyle: {
      fontWeight: '900',
      fontSize: '14px',
      color: '#ffffff',
      textShadow: '2px 2px 0 #000, -2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000',
    },
  },
  {
    id: 'clean_subtitle',
    name: 'Clean',
    previewText: 'Clean',
    previewStyle: {
      fontWeight: '500',
      fontSize: '13px',
      color: '#ffffff',
      backgroundColor: 'rgba(0,0,0,0.6)',
      padding: '2px 6px',
      borderRadius: '3px',
    },
  },
  {
    id: 'neon_glow',
    name: 'Neon',
    previewText: 'Neon',
    previewStyle: {
      fontWeight: '700',
      fontSize: '14px',
      color: '#00ffff',
      textShadow: '0 0 6px #00ffff, 0 0 12px #00ffff',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    previewText: 'minimal',
    previewStyle: {
      fontWeight: '400',
      fontSize: '12px',
      color: '#cccccc',
      letterSpacing: '1px',
    },
  },
  {
    id: 'none',
    name: 'None',
    previewText: '—',
    previewStyle: {
      fontWeight: '400',
      fontSize: '14px',
      color: '#666666',
    },
  },
];

function select(id: CaptionStylePreset) {
  emit('update:modelValue', id);
}
</script>

<style scoped>
.caption-style-picker {
  padding: 0;
}

.caption-options {
  display: flex;
  gap: 6px;
}

.caption-option {
  flex: 1;
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
  min-width: 0;
}

.caption-option:hover {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, var(--card));
}

.caption-option--active {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 15%, var(--card));
  box-shadow: 0 0 0 1px var(--primary);
}

.caption-preview {
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  overflow: hidden;
}

.caption-option-label {
  font-size: 9px;
  font-weight: 500;
  color: var(--muted-foreground);
  text-align: center;
}

.caption-option--active .caption-option-label {
  color: var(--primary);
  font-weight: 600;
}
</style>
