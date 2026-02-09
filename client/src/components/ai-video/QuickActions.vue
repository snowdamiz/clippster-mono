<template>
  <div class="quick-actions">
    <button
      v-for="action in actions"
      :key="action.id"
      class="quick-action-btn"
      :disabled="disabled"
      @click="$emit('action', action.id)"
    >
      <component :is="action.icon" :size="14" />
      <span>{{ action.label }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { Type, Music, Palette, PlayCircle, StopCircle } from 'lucide-vue-next';

defineProps<{
  disabled?: boolean;
}>();

defineEmits<{
  (e: 'action', id: string): void;
}>();

const actions = [
  { id: 'add_captions', label: 'Add Captions', icon: Type },
  { id: 'add_music', label: 'Add Music', icon: Music },
  { id: 'color_grade', label: 'Color Grade', icon: Palette },
  { id: 'add_intro', label: 'Add Intro', icon: PlayCircle },
  { id: 'add_outro', label: 'Add Outro', icon: StopCircle },
];
</script>

<style scoped>
.quick-actions {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.quick-action-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--foreground);
  font-size: 11px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.quick-action-btn:hover:not(:disabled) {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 10%, var(--card));
  color: var(--primary);
}

.quick-action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
