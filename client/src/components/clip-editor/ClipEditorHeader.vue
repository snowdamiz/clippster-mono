<template>
  <div class="flex flex-col flex-shrink-0 relative z-10 m-0 box-border">
    <!-- Accent gradient bar at top -->
    <div class="h-0.5 bg-gradient-to-r from-cyan-500 via-sky-500 to-blue-500" />

    <!-- Header content -->
    <header class="flex items-center justify-between px-3 h-11 backdrop-blur-[12px] border-b"
            style="background: linear-gradient(180deg, var(--editor-surface-elevated) 0%, var(--editor-surface) 100%); border-color: var(--editor-border);">
      <div class="flex items-center gap-3 min-w-0">
        <!-- Title -->
        <div class="flex items-center gap-2 min-w-0 flex-1 max-w-[500px]">
          <Film :size="16" class="flex-shrink-0 text-[var(--editor-accent)]" />
          <div v-if="isEditingTitle" class="flex-1 min-w-0">
            <input
              ref="titleInputRef"
              v-model="editedTitle"
              class="w-full text-[0.9375rem] font-semibold rounded-md px-3 py-2 outline-none tracking-tight border text-[var(--editor-text)] bg-[var(--editor-surface-elevated)] border-[var(--editor-accent)] focus:ring-2 focus:ring-[var(--editor-focus-ring)]"
              @blur="saveTitle"
              @keydown.enter="saveTitle"
              @keydown.esc="cancelEdit"
              @keydown="stopPropagation"
            />
          </div>
          <button
            v-else
            class="flex items-center gap-2 bg-transparent border border-transparent rounded-md px-3 py-2 cursor-pointer transition-all duration-150 min-w-0 flex-1 text-left hover:bg-[var(--editor-hover)] hover:border-white/10 group"
            :title="'Click to edit title'"
            @click="startEditingTitle"
          >
            <h2 class="text-[0.9375rem] font-semibold m-0 overflow-hidden text-ellipsis whitespace-nowrap tracking-tight flex-1 min-w-0 text-[var(--editor-text)]">
              {{ title }}
            </h2>
            <Pencil :size="14" class="flex-shrink-0 opacity-50 transition-opacity duration-150 group-hover:opacity-100 text-[var(--editor-text-muted)]" />
          </button>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- Keyboard Shortcuts Button -->
        <button
          class="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--editor-text-muted)] bg-transparent border-none cursor-pointer transition-all duration-150 hover:bg-[var(--editor-hover)] hover:text-[var(--editor-text)]"
          title="Keyboard shortcuts (?)"
          @click="$emit('showShortcuts')"
        >
          <Keyboard :size="16" />
        </button>

        <!-- Export Button -->
        <button
          class="flex items-center justify-center gap-2 h-8 px-3.5 bg-[var(--editor-accent)] border-none rounded-md text-xs font-semibold text-[var(--editor-surface)] cursor-pointer transition-all duration-150 hover:opacity-90"
          title="Export (Ctrl+E)"
          @click="$emit('export')"
        >
          <Download :size="14" />
          <span>Export</span>
        </button>

        <!-- Close Button -->
        <button
          class="flex items-center justify-center w-8 h-8 p-2 bg-transparent border-none rounded-lg text-[var(--editor-text)] cursor-pointer transition-all duration-150 hover:bg-red-500/20 hover:text-red-400"
          title="Close (Esc)"
          @click="$emit('close')"
        >
          <X :size="16" />
        </button>
      </div>
    </header>
  </div>
</template>

<script setup lang="ts">
import { Film, Download, X, Pencil, Keyboard } from 'lucide-vue-next';
import { useInlineEdit } from '@/composables/clip-editor';

const props = defineProps<{
  title: string;
}>();

const emit = defineEmits<{
  (e: 'export'): void;
  (e: 'close'): void;
  (e: 'titleUpdate', newTitle: string): void;
  (e: 'showShortcuts'): void;
}>();

// Use inline edit composable for title editing
const {
  isEditing: isEditingTitle,
  editedValue: editedTitle,
  inputRef: titleInputRef,
  startEditing,
  saveEdit: saveTitle,
  cancelEdit,
  stopPropagation,
} = useInlineEdit({
  onSave: (newTitle) => emit('titleUpdate', newTitle),
});

// Wrapper to start editing with current title
function startEditingTitle() {
  startEditing(props.title);
}
</script>



