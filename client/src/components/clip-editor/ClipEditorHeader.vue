<template>
  <div class="editor-header">
    <div class="editor-header__left">
      <!-- Undo/Redo -->
      <div class="editor-header__undo-redo">
        <button
          class="editor-header__button"
          :class="{ 'editor-header__button--disabled': !canUndo }"
          :disabled="!canUndo"
          :title="undoDescription ? `Undo: ${undoDescription}` : 'Undo (Ctrl+Z)'"
          @click="$emit('undo')"
        >
          <Undo2 :size="16" />
        </button>
        <button
          class="editor-header__button"
          :class="{ 'editor-header__button--disabled': !canRedo }"
          :disabled="!canRedo"
          :title="redoDescription ? `Redo: ${redoDescription}` : 'Redo (Ctrl+Y)'"
          @click="$emit('redo')"
        >
          <Redo2 :size="16" />
        </button>
      </div>

      <!-- Title -->
      <div class="editor-header__title-section">
        <Film :size="16" class="editor-header__icon" />
        <h2 class="editor-header__title" :title="title">{{ title }}</h2>
      </div>
    </div>

    <div class="editor-header__right">
      <!-- Export Button -->
      <button
        class="editor-header__button editor-header__button--export"
        title="Export (Ctrl+E)"
        @click="$emit('export')"
      >
        <Download :size="16" />
        <span>Export</span>
      </button>

      <!-- Close Button -->
      <button
        class="editor-header__button editor-header__button--close"
        title="Close (Esc)"
        @click="$emit('close')"
      >
        <X :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Undo2, Redo2, Film, Download, X } from 'lucide-vue-next';

defineProps<{
  title: string;
  canUndo: boolean;
  canRedo: boolean;
  undoDescription: string | null;
  redoDescription: string | null;
}>();

defineEmits<{
  (e: 'undo'): void;
  (e: 'redo'): void;
  (e: 'export'): void;
  (e: 'close'): void;
}>();
</script>

<style scoped>
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: rgba(0, 0, 0, 0.6);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  height: 56px;
  backdrop-filter: blur(8px);
}

.editor-header__left {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}

.editor-header__right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.editor-header__undo-redo {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.editor-header__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.editor-header__button:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.editor-header__button--disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.editor-header__button--export {
  background-color: rgba(139, 92, 246, 0.15);
  border: 1px solid rgba(139, 92, 246, 0.3);
  color: #a78bfa;
  padding: 0.5rem 1rem;
}

.editor-header__button--export:hover {
  background-color: rgba(139, 92, 246, 0.25);
  border-color: rgba(139, 92, 246, 0.5);
  color: #c4b5fd;
}

.editor-header__button--close {
  width: 32px;
  height: 32px;
}

.editor-header__button--close:hover {
  background-color: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.editor-header__title-section {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.editor-header__icon {
  flex-shrink: 0;
  color: #a78bfa;
}

.editor-header__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
}
</style>

