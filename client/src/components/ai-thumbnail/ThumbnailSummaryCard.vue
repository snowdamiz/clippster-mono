<template>
  <div class="summary-card">
    <div class="summary-card__header">
      <ClipboardList :size="14" />
      <span>Thumbnail Plan</span>
    </div>
    <div class="summary-card__body">
      <div v-if="summary.description" class="summary-row">
        <span class="summary-label">Concept</span>
        <span class="summary-value">{{ summary.description }}</span>
      </div>
      <div v-if="summary.hook_text" class="summary-row">
        <span class="summary-label">Hook</span>
        <span class="summary-value summary-badge">{{ summary.hook_text }}</span>
      </div>
      <div v-if="summary.cta_text" class="summary-row">
        <span class="summary-label">CTA</span>
        <span class="summary-value">{{ summary.cta_text }}</span>
      </div>
      <div v-if="summary.emotion" class="summary-row">
        <span class="summary-label">Emotion</span>
        <span class="summary-value summary-badge">{{ summary.emotion }}</span>
      </div>
      <div v-if="summary.focal_subject" class="summary-row">
        <span class="summary-label">Subject</span>
        <span class="summary-value">{{ summary.focal_subject }}</span>
      </div>
      <div v-if="summary.layout" class="summary-row">
        <span class="summary-label">Layout</span>
        <span class="summary-value">{{ summary.layout }}</span>
      </div>
      <div v-if="summary.aspect_ratio || summary.canvas_width" class="summary-row">
        <span class="summary-label">Canvas</span>
        <span class="summary-value">
          {{ summary.aspect_ratio || '16:9' }}
          <template v-if="summary.canvas_width && summary.canvas_height">
            · {{ summary.canvas_width }}×{{ summary.canvas_height }}
          </template>
        </span>
      </div>
      <div v-if="palette.length" class="summary-row">
        <span class="summary-label">Colors</span>
        <div class="color-swatches">
          <div
            v-for="(color, i) in palette"
            :key="i"
            class="color-swatch"
            :style="{ background: color }"
            :title="color"
          />
        </div>
      </div>
      <div v-if="summary.style_notes" class="summary-row">
        <span class="summary-label">Style</span>
        <span class="summary-value">{{ summary.style_notes }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { ClipboardList } from 'lucide-vue-next';

export interface ThumbnailBriefSummary {
  description?: string;
  hook_text?: string;
  cta_text?: string | null;
  emotion?: string;
  focal_subject?: string;
  layout?: string;
  color_palette?: string[];
  aspect_ratio?: string;
  canvas_width?: number;
  canvas_height?: number;
  style_notes?: string;
  [key: string]: unknown;
}

const props = defineProps<{
  summary: ThumbnailBriefSummary;
}>();

const palette = computed(() => {
  const raw = props.summary.color_palette;
  if (!Array.isArray(raw)) return [] as string[];
  return raw.filter((c) => typeof c === 'string' && c.length > 0);
});
</script>

<style scoped>
.summary-card {
  background: rgba(168, 85, 247, 0.08);
  border: 1px solid rgba(168, 85, 247, 0.25);
  border-radius: 10px;
  overflow: hidden;
  margin: 8px 0;
}

.summary-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #c084fc;
  border-bottom: 1px solid rgba(168, 85, 247, 0.15);
}

.summary-card__body {
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
}

.summary-label {
  color: rgba(255, 255, 255, 0.45);
  min-width: 56px;
  flex-shrink: 0;
}

.summary-value {
  color: rgba(255, 255, 255, 0.85);
}

.summary-badge {
  background: rgba(168, 85, 247, 0.2);
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
}

.color-swatches {
  display: flex;
  gap: 4px;
}

.color-swatch {
  width: 18px;
  height: 18px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
</style>
