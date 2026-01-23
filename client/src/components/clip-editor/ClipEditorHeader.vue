<template>
  <div class="flex items-center justify-between px-4 py-3 h-14 flex-shrink-0 relative z-10 m-0 box-border backdrop-blur-[12px] border-b" 
       style="background: linear-gradient(180deg, var(--editor-surface) 0%, var(--editor-bg) 100%); border-color: var(--editor-border);">
    <div class="flex items-center gap-4 min-w-0">
      <!-- Title -->
      <div class="flex items-center gap-2 min-w-0 flex-1 max-w-[500px]">
        <Film :size="16" class="flex-shrink-0" style="color: var(--editor-accent);" />
        <div v-if="isEditingTitle" class="flex-1 min-w-0">
          <input
            ref="titleInputRef"
            v-model="editedTitle"
            class="w-full text-[0.9375rem] font-semibold rounded-md px-3 py-2 outline-none tracking-tight border focus:shadow-[0_0_0_2px_rgba(14,165,233,0.2)]"
            style="color: var(--editor-text); background-color: var(--editor-surface-elevated); border-color: var(--editor-accent);"
            @blur="saveTitle"
            @keydown.enter="saveTitle"
            @keydown.esc="cancelEdit"
            @keydown="stopPropagation"
          />
        </div>
        <button
          v-else
          class="flex items-center gap-2 bg-transparent border border-transparent rounded-md px-3 py-2 cursor-pointer transition-all duration-150 min-w-0 flex-1 text-left hover:bg-white/5 hover:border-white/10 group"
          :title="'Click to edit title'"
          @click="startEditingTitle"
        >
          <h2 class="text-[0.9375rem] font-semibold m-0 overflow-hidden text-ellipsis whitespace-nowrap tracking-tight flex-1 min-w-0" 
              style="color: var(--editor-text);">
            {{ title }}
          </h2>
          <Pencil :size="14" class="flex-shrink-0 opacity-50 transition-opacity duration-150 group-hover:opacity-100" 
                  style="color: var(--editor-text-muted);" />
        </button>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <!-- Export Button -->
      <button
        class="flex items-center justify-center gap-2 px-4 py-2 bg-transparent border rounded text-sm font-medium cursor-pointer transition-all duration-150 hover:border-sky-500/50"
        style="background-color: rgba(14, 165, 233, 0.15); border-color: rgba(14, 165, 233, 0.3); color: var(--editor-accent);"
        title="Export (Ctrl+E)"
        @click="$emit('export')"
      >
        <Download :size="16" />
        <span>Export</span>
      </button>

      <!-- Close Button -->
      <button
        class="flex items-center justify-center w-8 h-8 p-2 bg-transparent border-none rounded cursor-pointer transition-all duration-150 hover:bg-red-500/20"
        style="color: var(--editor-text);"
        title="Close (Esc)"
        @click="$emit('close')"
      >
        <X :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Film, Download, X, Pencil } from 'lucide-vue-next';
import { useInlineEdit } from '@/composables/clip-editor';

const props = defineProps<{
  title: string;
}>();

const emit = defineEmits<{
  (e: 'export'): void;
  (e: 'close'): void;
  (e: 'titleUpdate', newTitle: string): void;
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



