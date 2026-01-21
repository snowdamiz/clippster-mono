<template>
  <div class="editor-toolbar">
    <div class="editor-toolbar__left">
      <!-- Zoom Controls -->
      <div class="editor-toolbar__zoom">
        <button
          class="editor-toolbar__button"
          title="Zoom Out (-)"
          @click="$emit('zoomOut')"
        >
          <ZoomOut :size="16" />
        </button>
        <span class="editor-toolbar__zoom-label">
          {{ Math.round(zoomLevel * 100) }}%
        </span>
        <button
          class="editor-toolbar__button"
          title="Zoom In (+)"
          @click="$emit('zoomIn')"
        >
          <ZoomIn :size="16" />
        </button>
      </div>

      <!-- Time Display -->
      <div class="editor-toolbar__time">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </div>
    </div>

    <div class="editor-toolbar__right">
      <!-- Tools -->
      <button
        class="editor-toolbar__button"
        title="Split at Playhead (S)"
        @click="$emit('split')"
      >
        <Scissors :size="16" />
        <span>Split</span>
      </button>

      <button
        class="editor-toolbar__button"
        title="Delete Selected (Delete)"
        @click="$emit('delete')"
      >
        <Trash2 :size="16" />
        <span>Delete</span>
      </button>

      <button
        class="editor-toolbar__button"
        title="Detach Audio"
        @click="$emit('detachAudio')"
      >
        <Music :size="16" />
        <span>Detach Audio</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ZoomIn, ZoomOut, Scissors, Trash2, Music } from 'lucide-vue-next';

defineProps<{
  zoomLevel: number;
  currentTime: number;
  duration: number;
}>();

defineEmits<{
  (e: 'split'): void;
  (e: 'delete'): void;
  (e: 'detachAudio'): void;
  (e: 'zoomIn'): void;
  (e: 'zoomOut'): void;
}>();

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
</script>

<style scoped>
.editor-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: rgba(0, 0, 0, 0.4);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  height: 48px;
}

.editor-toolbar__left,
.editor-toolbar__right {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.editor-toolbar__zoom {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0.5rem;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.editor-toolbar__zoom-label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  min-width: 48px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.editor-toolbar__time {
  font-size: 0.875rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  font-variant-numeric: tabular-nums;
  padding: 0.375rem 0.75rem;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.editor-toolbar__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  font-weight: 500;
}

.editor-toolbar__button:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.95);
}
</style>

