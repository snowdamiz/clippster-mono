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
      <div v-if="summary.audience" class="summary-row">
        <span class="summary-label">Audience</span>
        <span class="summary-value">{{ summary.audience }}</span>
      </div>
      <div v-if="summary.platform" class="summary-row">
        <span class="summary-label">Platform</span>
        <span class="summary-value summary-badge">{{ summary.platform }}</span>
      </div>
      <div v-if="summary.narrative" class="summary-row">
        <span class="summary-label">Narrative</span>
        <span class="summary-value">{{ summary.narrative }}</span>
      </div>
    </div>
    <!-- Scene plan -->
    <div v-if="summary.scenes?.length" class="summary-card__scenes">
      <div class="scenes-header">
        <Film :size="13" />
        <span>Scene Plan ({{ summary.scenes.length }} scenes)</span>
      </div>
      <div class="scenes-list">
        <div v-for="scene in summary.scenes" :key="scene.index" class="scene-item">
          <div class="scene-number">{{ scene.index + 1 }}</div>
          <div class="scene-details">
            <div class="scene-description">{{ scene.description }}</div>
            <div class="scene-meta">
              <span class="scene-duration">{{ scene.duration }}s</span>
              <span v-if="scene.mood" class="scene-mood">{{ scene.mood }}</span>
              <span v-if="scene.textOverlay" class="scene-text-hint" :title="scene.textOverlay">"{{ scene.textOverlay }}"</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <button class="summary-card__generate" :disabled="disabled" @click="$emit('generate')">
      <Wand2 :size="16" />
      <span>Generate Video</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ClipboardList, Film, Wand2 } from 'lucide-vue-next';
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

.summary-card__scenes {
  border-top: 1px solid rgba(139, 92, 246, 0.12);
  padding: 10px 12px;
}

.scenes-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 600;
  color: #a78bfa;
  margin-bottom: 8px;
}

.scenes-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.scene-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.scene-number {
  width: 20px;
  height: 20px;
  border-radius: 5px;
  background: rgba(139, 92, 246, 0.15);
  color: #c4b5fd;
  font-size: 11px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.scene-details {
  flex: 1;
  min-width: 0;
}

.scene-description {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.8);
  line-height: 1.3;
}

.scene-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 3px;
}

.scene-duration {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.4);
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
}

.scene-mood {
  font-size: 10px;
  color: rgba(167, 139, 250, 0.7);
  background: rgba(139, 92, 246, 0.1);
  padding: 1px 5px;
  border-radius: 3px;
}

.scene-text-hint {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  font-style: italic;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
