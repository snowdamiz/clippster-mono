<template>
  <div class="editor-header">
    <div class="editor-header__left">
      <!-- Title -->
      <div class="editor-header__title-section">
        <Film :size="16" class="editor-header__icon" />
        <div v-if="isEditingTitle" class="editor-header__title-edit-wrapper">
          <input
            ref="titleInputRef"
            v-model="editedTitle"
            class="editor-header__title-input"
            @blur="saveTitle"
            @keydown.enter="saveTitle"
            @keydown.esc="cancelEdit"
          />
        </div>
        <button
          v-else
          class="editor-header__title-button"
          :title="'Click to edit title'"
          @click="startEditingTitle"
        >
          <h2 class="editor-header__title">
            {{ title }}
          </h2>
          <Pencil :size="14" class="editor-header__title-edit-icon" />
        </button>
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
import { ref, nextTick } from 'vue';
import { Film, Download, X, Pencil } from 'lucide-vue-next';

const props = defineProps<{
  title: string;
}>();

const emit = defineEmits<{
  (e: 'export'): void;
  (e: 'close'): void;
  (e: 'titleUpdate', newTitle: string): void;
}>();

const isEditingTitle = ref(false);
const editedTitle = ref('');
const titleInputRef = ref<HTMLInputElement | null>(null);

function startEditingTitle() {
  isEditingTitle.value = true;
  editedTitle.value = props.title;
  nextTick(() => {
    titleInputRef.value?.focus();
    titleInputRef.value?.select();
  });
}

function saveTitle() {
  if (editedTitle.value.trim() && editedTitle.value !== props.title) {
    emit('titleUpdate', editedTitle.value.trim());
  }
  isEditingTitle.value = false;
}

function cancelEdit() {
  isEditingTitle.value = false;
  editedTitle.value = '';
}
</script>

<style scoped>
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background: linear-gradient(180deg, var(--editor-surface) 0%, var(--editor-bg) 100%);
  border-bottom: 1px solid var(--editor-border);
  flex-shrink: 0;
  height: 56px;
  backdrop-filter: blur(12px);
  box-sizing: border-box;
  margin: 0;
  position: relative;
  z-index: 10;
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

.editor-header__button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--editor-text);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.editor-header__button:hover:not(:disabled) {
  background-color: rgba(255, 255, 255, 0.08);
  color: #fff;
}

.editor-header__button--export {
  background-color: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(14, 165, 233, 0.3);
  color: var(--editor-accent);
  padding: 0.5rem 1rem;
}

.editor-header__button--export:hover {
  background-color: rgba(14, 165, 233, 0.25);
  border-color: rgba(14, 165, 233, 0.5);
  color: var(--editor-accent-hover);
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
  flex: 1;
  max-width: 500px;
}

.editor-header__icon {
  flex-shrink: 0;
  color: var(--editor-accent);
}

.editor-header__title-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: all 150ms ease;
  min-width: 0;
  flex: 1;
  text-align: left;
}

.editor-header__title-button:hover {
  background-color: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.1);
}

.editor-header__title-button:hover .editor-header__title-edit-icon {
  opacity: 1;
}

.editor-header__title {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--editor-text);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  letter-spacing: -0.01em;
  flex: 1;
  min-width: 0;
}

.editor-header__title-edit-icon {
  flex-shrink: 0;
  color: var(--editor-text-muted);
  opacity: 0.5;
  transition: opacity 150ms ease;
}

.editor-header__title-edit-wrapper {
  flex: 1;
  min-width: 0;
}

.editor-header__title-input {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--editor-text);
  background-color: var(--editor-surface-elevated);
  border: 1px solid var(--editor-accent);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  outline: none;
  width: 100%;
  letter-spacing: -0.01em;
}

.editor-header__title-input:focus {
  border-color: var(--editor-accent-hover);
  box-shadow: 0 0 0 2px rgba(14, 165, 233, 0.2);
}
</style>

