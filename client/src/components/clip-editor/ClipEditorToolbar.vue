<template>
  <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-[var(--editor-surface)] to-[var(--editor-bg)] border-b border-[var(--editor-border)] shrink-0 h-12">
    <div class="flex items-center gap-4">
      <!-- Zoom Controls -->
      <div class="flex items-center gap-2 px-2 py-1 bg-[var(--editor-surface-elevated)] rounded-md border border-[var(--editor-border)]">
        <button
          class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-sky-500/15 hover:enabled:text-[var(--editor-accent)]"
          title="Zoom Out (-)"
          @click="$emit('zoomOut')"
        >
          <ZoomOut :size="16" />
        </button>
        <span class="text-[0.8125rem] font-medium text-[var(--editor-text)] min-w-[48px] text-center [font-variant-numeric:tabular-nums]">
          {{ Math.round(zoomLevel * 100) }}%
        </span>
        <button
          class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-sky-500/15 hover:enabled:text-[var(--editor-accent)]"
          title="Zoom In (+)"
          @click="$emit('zoomIn')"
        >
          <ZoomIn :size="16" />
        </button>
      </div>

      <!-- Time Display -->
      <div class="text-[0.875rem] font-medium text-[var(--editor-text)] [font-variant-numeric:tabular-nums] px-3 py-1.5 bg-[var(--editor-surface-elevated)] rounded-md border border-[var(--editor-border)]">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </div>
    </div>

    <div class="flex items-center gap-4">
      <!-- Undo/Redo -->
      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-sky-500/15 hover:enabled:text-[var(--editor-accent)]"
        :class="{ 'opacity-30 cursor-not-allowed': !canUndo }"
        :disabled="!canUndo"
        :title="undoDescription ? `Undo: ${undoDescription}` : 'Undo (Ctrl+Z)'"
        @click="$emit('undo')"
      >
        <Undo2 :size="16" />
        <span>Undo</span>
      </button>

      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-sky-500/15 hover:enabled:text-[var(--editor-accent)]"
        :class="{ 'opacity-30 cursor-not-allowed': !canRedo }"
        :disabled="!canRedo"
        :title="redoDescription ? `Redo: ${redoDescription}` : 'Redo (Ctrl+Y)'"
        @click="$emit('redo')"
      >
        <Redo2 :size="16" />
        <span>Redo</span>
      </button>

      <!-- Tools -->
      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-sky-500/15 hover:enabled:text-[var(--editor-accent)]"
        title="Split at Playhead (S)"
        @click="$emit('split')"
      >
        <Scissors :size="16" />
        <span>Split</span>
      </button>

      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-sky-500/15 hover:enabled:text-[var(--editor-accent)]"
        title="Delete Selected (Delete)"
        @click="$emit('delete')"
      >
        <Trash2 :size="16" />
        <span>Delete</span>
      </button>

      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-sky-500/15 hover:enabled:text-[var(--editor-accent)]"
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
import { ZoomIn, ZoomOut, Scissors, Trash2, Music, Undo2, Redo2 } from 'lucide-vue-next';

defineProps<{
  zoomLevel: number;
  currentTime: number;
  duration: number;
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
}>();

defineEmits<{
  (e: 'split'): void;
  (e: 'delete'): void;
  (e: 'detachAudio'): void;
  (e: 'zoomIn'): void;
  (e: 'zoomOut'): void;
  (e: 'undo'): void;
  (e: 'redo'): void;
}>();

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
</script>



