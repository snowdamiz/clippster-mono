<template>
  <div class="ref-card">
    <div class="ref-card__header">
      <Palette :size="14" />
      <span>Reference Style</span>
      <button v-if="!isAnalyzing" class="ref-card__remove" @click="$emit('remove')" title="Remove">
        <X :size="12" />
      </button>
    </div>

    <div v-if="isAnalyzing" class="ref-card__loading">
      <Loader2 :size="16" class="animate-spin" />
      <span>Analyzing reference...</span>
    </div>

    <div v-else-if="analysis" class="ref-card__body">
      <div class="ref-row">
        <span class="ref-label">Mood</span>
        <span class="ref-value ref-badge">{{ analysis.mood }}</span>
      </div>
      <div class="ref-row">
        <span class="ref-label">Genre</span>
        <span class="ref-value ref-badge">{{ analysis.genre }}</span>
      </div>
      <div v-if="analysis.colorPalette" class="ref-row">
        <span class="ref-label">Colors</span>
        <div class="ref-swatches">
          <div
            v-for="(color, key) in paletteColors"
            :key="key"
            class="ref-swatch"
            :style="{ background: color }"
            :title="`${key}: ${color}`"
          />
        </div>
      </div>
      <div v-if="analysis.motionStyle" class="ref-row">
        <span class="ref-label">Pacing</span>
        <span class="ref-value">{{ analysis.motionStyle.pacing }} · Energy {{ analysis.motionStyle.energyLevel }}/10</span>
      </div>
      <div v-if="analysis.summary" class="ref-summary">{{ analysis.summary }}</div>
    </div>

    <div v-else-if="error" class="ref-card__error">
      <AlertCircle :size="12" />
      <span>{{ error }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Palette, X, Loader2, AlertCircle } from 'lucide-vue-next';
import type { ReferenceStyleProfile } from '@/types/ai-video';

const props = defineProps<{
  analysis: ReferenceStyleProfile | null;
  isAnalyzing: boolean;
  error?: string | null;
}>();

defineEmits<{
  remove: [];
}>();

const paletteColors = computed(() => {
  if (!props.analysis?.colorPalette) return {};
  const p = props.analysis.colorPalette;
  return {
    primary: p.primary,
    secondary: p.secondary,
    accent: p.accent,
    background: p.background,
    text: p.text,
  };
});
</script>

<style scoped>
.ref-card {
  background: rgba(59, 130, 246, 0.06);
  border: 1px solid rgba(59, 130, 246, 0.15);
  border-radius: 10px;
  overflow: hidden;
  margin: 6px 0;
}

.ref-card__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 600;
  color: #60a5fa;
  border-bottom: 1px solid rgba(59, 130, 246, 0.1);
}

.ref-card__remove {
  margin-left: auto;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  padding: 2px;
}

.ref-card__remove:hover {
  color: rgba(255, 255, 255, 0.6);
}

.ref-card__loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.5);
}

.ref-card__body {
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.ref-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11px;
}

.ref-label {
  color: rgba(255, 255, 255, 0.4);
  min-width: 50px;
  flex-shrink: 0;
}

.ref-value {
  color: rgba(255, 255, 255, 0.8);
}

.ref-badge {
  background: rgba(59, 130, 246, 0.12);
  padding: 1px 8px;
  border-radius: 4px;
  text-transform: capitalize;
}

.ref-swatches {
  display: flex;
  gap: 3px;
}

.ref-swatch {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.ref-summary {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
  margin-top: 2px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.04);
}

.ref-card__error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px;
  font-size: 11px;
  color: #f87171;
}
</style>
