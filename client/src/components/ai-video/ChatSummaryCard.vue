<template>
  <div class="summary-card">
    <div class="summary-card__header">
      <ClipboardList :size="14" />
      <span>Generation Plan</span>
    </div>
    <div class="summary-card__body">
      <div v-if="summary.description" class="summary-row">
        <span class="summary-label">Description</span>
        <span class="summary-value">{{ summary.description }}</span>
      </div>
      <div v-if="summary.style" class="summary-row">
        <span class="summary-label">Style</span>
        <span class="summary-value summary-badge">{{ summary.style }}</span>
      </div>
      <div v-if="summary.duration" class="summary-row">
        <span class="summary-label">Duration</span>
        <span class="summary-value">{{ summary.duration }}s</span>
      </div>
      <div v-if="summary.aspectRatio" class="summary-row">
        <span class="summary-label">Aspect Ratio</span>
        <span class="summary-value">{{ summary.aspectRatio }}</span>
      </div>
      <div v-if="summary.colorPalette?.length" class="summary-row">
        <span class="summary-label">Colors</span>
        <div class="color-swatches">
          <div
            v-for="(color, i) in summary.colorPalette"
            :key="i"
            class="color-swatch"
            :style="{ background: color }"
            :title="color"
          />
        </div>
      </div>
      <div v-if="summary.keyFeatures?.length" class="summary-row">
        <span class="summary-label">Features</span>
        <div class="feature-tags">
          <span v-for="(f, i) in summary.keyFeatures" :key="i" class="feature-tag">{{ f }}</span>
        </div>
      </div>
      <div v-if="(summary as any).sceneCount" class="summary-row">
        <span class="summary-label">Scenes</span>
        <span class="summary-value">{{ (summary as any).sceneCount }} scenes planned</span>
      </div>
    </div>
    <button class="summary-card__generate" :disabled="disabled" @click="$emit('generate')">
      <Wand2 :size="16" />
      <span>Generate Video</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ClipboardList, Wand2 } from 'lucide-vue-next';
import type { GenerationSummary } from '@/types/ai-video';

defineProps<{
  summary: GenerationSummary;
  disabled?: boolean;
}>();

defineEmits<{
  generate: [];
}>();
</script>

<style scoped>
.summary-card {
  background: rgba(139, 92, 246, 0.08);
  border: 1px solid rgba(139, 92, 246, 0.2);
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
  color: #a78bfa;
  border-bottom: 1px solid rgba(139, 92, 246, 0.12);
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
  min-width: 70px;
  flex-shrink: 0;
}

.summary-value {
  color: rgba(255, 255, 255, 0.85);
}

.summary-badge {
  background: rgba(139, 92, 246, 0.15);
  padding: 1px 8px;
  border-radius: 4px;
  font-size: 11px;
  text-transform: capitalize;
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
  cursor: pointer;
}

.feature-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.feature-tag {
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.summary-card__generate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 10px;
  background: rgba(139, 92, 246, 0.2);
  border: none;
  border-top: 1px solid rgba(139, 92, 246, 0.12);
  color: #c4b5fd;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s;
}

.summary-card__generate:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.3);
}

.summary-card__generate:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
