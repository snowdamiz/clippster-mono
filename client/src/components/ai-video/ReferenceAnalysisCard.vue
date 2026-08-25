<template>
  <section class="ref-card" aria-label="Reference video analysis">
    <header class="ref-card__header">
      <Palette :size="14" />
      <span>Reference edit recipe</span>
      <span v-if="analysis" class="ref-card__version">v{{ analysis.schemaVersion }}</span>
    </header>

    <div v-if="isAnalyzing" class="ref-card__progress" role="status">
      <div class="ref-card__progress-label">
        <span>{{ progress?.message || 'Analyzing the full timeline…' }}</span>
        <span>{{ progress?.progress || 0 }}%</span>
      </div>
      <div class="ref-card__track"><div :style="{ width: `${progress?.progress || 0}%` }" /></div>
      <button type="button" @click="$emit('cancel')">Cancel</button>
    </div>

    <div v-else-if="analysis" class="ref-card__body">
      <p>{{ analysis.summary }}</p>
      <dl>
        <div>
          <dt>Pacing</dt>
          <dd>{{ analysis.pacing.description }}</dd>
        </div>
        <div>
          <dt>Captions</dt>
          <dd>{{ analysis.captions.detected ? analysis.captions.treatment : 'None detected' }}</dd>
        </div>
        <div>
          <dt>Motion</dt>
          <dd>{{ analysis.motion.intensity }} · {{ analysis.motion.cameraBehaviors.join(', ') }}</dd>
        </div>
        <div>
          <dt>Transitions</dt>
          <dd>{{ analysis.transitions.families.join(', ') || 'Cuts only' }}</dd>
        </div>
        <div>
          <dt>Layout</dt>
          <dd>{{ analysis.layout.patterns.join(', ') }}</dd>
        </div>
      </dl>
      <div class="ref-card__swatches" aria-label="Detected color palette">
        <span v-for="color in analysis.colorGrade.palette" :key="color" :style="{ background: color }" :title="color" />
      </div>
      <p v-if="analysis.unsupported.length" class="ref-card__fallback">
        {{ analysis.unsupported.length }} unsupported technique{{ analysis.unsupported.length === 1 ? '' : 's' }} will
        use declared fallbacks.
      </p>
      <div class="ref-card__actions">
        <button type="button" @click="$emit('replace')">Replace</button>
        <button type="button" @click="$emit('remove')">
          <X :size="11" />
          Remove
        </button>
      </div>
    </div>

    <div v-else-if="error" class="ref-card__error" role="alert">
      <AlertCircle :size="13" />
      <span>{{ error }}</span>
      <button type="button" @click="$emit('retry')">Retry</button>
    </div>
  </section>
</template>

<script setup lang="ts">
  import { Palette, X, AlertCircle } from 'lucide-vue-next';
  import type { ReferenceAnalysisProgress, ReferenceEditRecipe } from '@/types/ai-video';

  defineProps<{
    analysis: ReferenceEditRecipe | null;
    isAnalyzing: boolean;
    progress?: ReferenceAnalysisProgress | null;
    error?: string | null;
  }>();

  defineEmits<{ remove: []; cancel: []; replace: []; retry: [] }>();
</script>

<style scoped>
  .ref-card {
    margin: 6px 0;
    overflow: hidden;
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 10px;
    background: rgba(59, 130, 246, 0.06);
    color: rgba(255, 255, 255, 0.78);
  }
  .ref-card__header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 10px;
    border-bottom: 1px solid rgba(59, 130, 246, 0.12);
    color: #60a5fa;
    font-size: 12px;
    font-weight: 650;
  }
  .ref-card__version {
    margin-left: auto;
    color: rgba(255, 255, 255, 0.35);
    font-size: 10px;
  }
  .ref-card__progress,
  .ref-card__body,
  .ref-card__error {
    padding: 10px;
    font-size: 11px;
  }
  .ref-card__progress-label {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }
  .ref-card__track {
    height: 4px;
    margin: 8px 0;
    overflow: hidden;
    border-radius: 3px;
    background: rgba(255, 255, 255, 0.1);
  }
  .ref-card__track div {
    height: 100%;
    background: #3b82f6;
    transition: width 0.2s ease;
  }
  .ref-card button {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    border: 0;
    background: transparent;
    color: #93c5fd;
    cursor: pointer;
    font-size: 10px;
  }
  .ref-card__body > p {
    margin: 0 0 7px;
    line-height: 1.4;
  }
  .ref-card dl {
    display: grid;
    gap: 5px;
    margin: 0;
  }
  .ref-card dl div {
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 6px;
  }
  .ref-card dt {
    color: rgba(255, 255, 255, 0.4);
  }
  .ref-card dd {
    margin: 0;
  }
  .ref-card__swatches {
    display: flex;
    gap: 4px;
    margin-top: 8px;
  }
  .ref-card__swatches span {
    width: 17px;
    height: 17px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 4px;
  }
  .ref-card__fallback {
    color: #fbbf24;
  }
  .ref-card__actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
  .ref-card__error {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #f87171;
  }
  .ref-card__error button {
    margin-left: auto;
  }
</style>
