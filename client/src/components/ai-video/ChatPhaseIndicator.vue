<template>
  <div class="phase-indicator">
    <div
      v-for="(phase, i) in phases"
      :key="phase.key"
      class="phase-step"
      :class="{
        'phase-step--active': phase.key === currentStep,
        'phase-step--completed': isCompleted(phase.key, i),
      }"
    >
      <div class="phase-step__dot">
        <Check v-if="isCompleted(phase.key, i)" :size="10" />
        <span v-else class="phase-step__num">{{ i + 1 }}</span>
      </div>
      <span class="phase-step__label">{{ phase.label }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Check } from 'lucide-vue-next';
import type { ConversationStep } from '@/types/ai-video';

const props = defineProps<{
  currentStep: ConversationStep;
}>();

const phases = [
  { key: 'welcome', label: 'Media' },
  { key: 'transcript_review', label: 'Transcript' },
  { key: 'purpose', label: 'Purpose' },
  { key: 'audience', label: 'Audience' },
  { key: 'vibe', label: 'Style' },
  { key: 'highlights', label: 'Highlights' },
  { key: 'scene_plan', label: 'Scenes' },
  { key: 'confirmation', label: 'Generate' },
] as const;

const currentIndex = computed(() =>
  phases.findIndex(p => p.key === props.currentStep)
);

function isCompleted(key: string, index: number) {
  return index < currentIndex.value;
}
</script>

<style scoped>
.phase-indicator {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  overflow-x: auto;
  flex-shrink: 0;
}

.phase-step {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 6px;
  border-radius: 4px;
  white-space: nowrap;
  flex-shrink: 0;
}

.phase-step__dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.phase-step__num {
  font-size: 9px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.3);
}

.phase-step__label {
  font-size: 10px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.25);
  transition: color 0.2s;
}

.phase-step--active .phase-step__dot {
  background: #0ea5e9;
  box-shadow: 0 0 8px rgba(14, 165, 233, 0.4);
}

.phase-step--active .phase-step__num {
  color: white;
}

.phase-step--active .phase-step__label {
  color: #0ea5e9;
  font-weight: 600;
}

.phase-step--completed .phase-step__dot {
  background: rgba(34, 197, 94, 0.3);
  color: #22c55e;
}

.phase-step--completed .phase-step__label {
  color: rgba(255, 255, 255, 0.4);
}
</style>
