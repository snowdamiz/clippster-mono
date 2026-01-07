<template>
  <div class="space-y-4">
    <!-- Aspect Ratio content directly (no sub-tabs needed) -->
    <AspectTab
      :framing-configs="framingConfigs"
      :selected-aspect-ratios="selectedAspectRatios"
      :framing-mode-value="framingMode"
      :thumbnail-url="thumbnailUrl"
      :video-path="videoPath"
      :clip-start-time="clipStartTime"
      :clip-end-time="clipEndTime"
      :preview-aspect-ratio="previewAspectRatio"
      @update:framing-configs="(configs: ManualFramingConfigs) => emit('update:framingConfigs', configs)"
      @update:selected-aspect-ratios="(ratios: string[]) => emit('update:selectedAspectRatios', ratios)"
      @update:framing-mode="(mode: 'auto' | 'manual') => emit('update:framingMode', mode)"
      @update:preview-aspect-ratio="(ratio: string) => emit('update:previewAspectRatio', ratio)"
    />
  </div>
</template>

<script setup lang="ts">
import type { ManualFramingConfigs } from '@/types';
import AspectTab from './AspectTab.vue';

defineProps<{
  framingConfigs: ManualFramingConfigs;
  selectedAspectRatios: string[];
  framingMode: 'auto' | 'manual';
  thumbnailUrl: string | null;
  videoPath: string | null;
  clipStartTime: number;
  clipEndTime: number;
  previewAspectRatio: string;
}>();

const emit = defineEmits<{
  (e: 'update:framingConfigs', configs: ManualFramingConfigs): void;
  (e: 'update:selectedAspectRatios', ratios: string[]): void;
  (e: 'update:framingMode', mode: 'auto' | 'manual'): void;
  (e: 'update:previewAspectRatio', ratio: string): void;
}>();
</script>
