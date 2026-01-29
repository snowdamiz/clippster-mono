<template>
  <div class="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-[var(--editor-surface)] to-[var(--editor-bg)] border-b border-[var(--editor-border)] shrink-0 h-12">
    <div class="flex items-center gap-2">
      <!-- Zoom Controls -->
      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-[var(--editor-active)] hover:enabled:text-[var(--editor-accent)]"
        title="Zoom Out (-)"
        @click="$emit('zoomOut')"
      >
        <ZoomOut :size="16" />
      </button>
      <span class="text-[0.8125rem] font-medium text-[var(--editor-text-muted)] min-w-[48px] text-center [font-variant-numeric:tabular-nums]">
        {{ Math.round(zoomLevel * 100) }}%
      </span>
      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-[var(--editor-active)] hover:enabled:text-[var(--editor-accent)]"
        title="Zoom In (+)"
        @click="$emit('zoomIn')"
      >
        <ZoomIn :size="16" />
      </button>

      <!-- Visual divider -->
      <div class="w-px h-6 bg-white/10 mx-2" />

      <!-- Time Display -->
      <span class="text-[0.8125rem] font-medium text-[var(--editor-text-muted)] [font-variant-numeric:tabular-nums]">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>
    </div>

    <div class="flex items-center gap-2">
      <!-- Undo/Redo -->
      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-[var(--editor-active)] hover:enabled:text-[var(--editor-accent)] disabled:opacity-30 disabled:cursor-not-allowed"
        :disabled="!canUndo"
        :title="undoDescription ? `Undo: ${undoDescription}` : 'Undo (Ctrl+Z)'"
        @click="$emit('undo')"
      >
        <Undo2 :size="16" />
        <span>Undo</span>
      </button>

      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-[var(--editor-active)] hover:enabled:text-[var(--editor-accent)] disabled:opacity-30 disabled:cursor-not-allowed"
        :disabled="!canRedo"
        :title="redoDescription ? `Redo: ${redoDescription}` : 'Redo (Ctrl+Y)'"
        @click="$emit('redo')"
      >
        <Redo2 :size="16" />
        <span>Redo</span>
      </button>

      <!-- Visual divider between button groups -->
      <div class="w-px h-6 bg-white/10 mx-2" />

      <!-- Tools -->
      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-[var(--editor-active)] hover:enabled:text-[var(--editor-accent)]"
        title="Split at Playhead (S)"
        @click="$emit('split')"
      >
        <Scissors :size="16" />
        <span>Split</span>
      </button>

      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-[var(--editor-active)] hover:enabled:text-[var(--editor-accent)]"
        title="Delete Selected (Delete)"
        @click="$emit('delete')"
      >
        <Trash2 :size="16" />
        <span>Delete</span>
      </button>

      <!-- Visual divider between button groups -->
      <div class="w-px h-6 bg-white/10 mx-2" />

      <button
        class="flex items-center justify-center gap-2 px-3 py-2 bg-transparent border-none rounded-md text-[var(--editor-text-muted)] cursor-pointer transition-all duration-150 ease-in-out text-[0.8125rem] font-medium hover:enabled:bg-[var(--editor-active)] hover:enabled:text-[var(--editor-accent)]"
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
import { formatTimeWithCentiseconds as formatTime } from '@/composables/clip-editor';

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
</script>



