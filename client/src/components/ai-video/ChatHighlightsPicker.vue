<template>
  <div class="highlights-picker">
    <div class="highlights-picker__header">
      <Sparkles :size="14" />
      <span>Key Moments</span>
      <span class="highlights-picker__count">{{ selectedCount }}/{{ highlights.length }} selected</span>
    </div>
    <div class="highlights-picker__list">
      <label
        v-for="(h, i) in localHighlights"
        :key="i"
        class="highlight-item"
        :class="{ 'highlight-item--selected': h.selected }"
      >
        <input
          type="checkbox"
          :checked="h.selected"
          class="highlight-item__check"
          @change="toggleHighlight(i)"
        />
        <div class="highlight-item__content">
          <span class="highlight-item__quote">"{{ h.text }}"</span>
          <span class="highlight-item__time">{{ formatTime(h.startTime) }} — {{ formatTime(h.endTime) }}</span>
        </div>
      </label>
    </div>
    <div class="highlights-picker__actions">
      <button class="hp-btn hp-btn--secondary" @click="$emit('skip')">
        Use Everything
      </button>
      <button class="hp-btn hp-btn--primary" @click="confirmSelection">
        <Check :size="14" />
        Confirm Selection
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { Sparkles, Check } from 'lucide-vue-next';
import type { TranscriptHighlight } from '@/types/ai-video';

const props = defineProps<{
  highlights: TranscriptHighlight[];
}>();

const emit = defineEmits<{
  confirm: [selected: TranscriptHighlight[]];
  skip: [];
}>();

const localHighlights = ref<TranscriptHighlight[]>([]);

watch(() => props.highlights, (val) => {
  localHighlights.value = val.map(h => ({ ...h }));
}, { immediate: true });

const selectedCount = computed(() =>
  localHighlights.value.filter(h => h.selected).length
);

function toggleHighlight(index: number) {
  localHighlights.value[index].selected = !localHighlights.value[index].selected;
}

function confirmSelection() {
  emit('confirm', localHighlights.value.filter(h => h.selected));
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.highlights-picker {
  background: rgba(168, 85, 247, 0.06);
  border: 1px solid rgba(168, 85, 247, 0.15);
  border-radius: 10px;
  overflow: hidden;
  margin: 6px 0;
}

.highlights-picker__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #c084fc;
  border-bottom: 1px solid rgba(168, 85, 247, 0.1);
}

.highlights-picker__count {
  margin-left: auto;
  font-size: 10px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.35);
}

.highlights-picker__list {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 240px;
  overflow-y: auto;
}

.highlight-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: background 0.15s;
}

.highlight-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.highlight-item--selected {
  background: rgba(168, 85, 247, 0.08);
}

.highlight-item__check {
  margin-top: 2px;
  accent-color: #a855f7;
  flex-shrink: 0;
}

.highlight-item__content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.highlight-item__quote {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.85);
  line-height: 1.4;
  font-style: italic;
}

.highlight-item__time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.35);
  font-variant-numeric: tabular-nums;
}

.highlights-picker__actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
  padding: 8px 12px;
  border-top: 1px solid rgba(168, 85, 247, 0.08);
}

.hp-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 5px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.hp-btn--primary {
  background: rgba(168, 85, 247, 0.2);
  color: #c084fc;
}

.hp-btn--primary:hover {
  background: rgba(168, 85, 247, 0.3);
}

.hp-btn--secondary {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.6);
}

.hp-btn--secondary:hover {
  background: rgba(255, 255, 255, 0.1);
}
</style>
