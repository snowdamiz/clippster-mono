<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-base font-semibold text-zinc-100 m-0">Text Overlays</h3>
      <button
        class="flex items-center gap-2 px-3 py-2 bg-amber-500/15 border border-amber-500/30 rounded text-amber-400 cursor-pointer transition-all duration-150 text-xs font-medium hover:bg-amber-500/25 hover:border-amber-500/50"
        @click="handleAddText"
        title="Add Text"
      >
        <Plus :size="16" />
        <span>Add Text</span>
      </button>
    </div>

    <!-- Text List -->
    <div v-if="textOverlays.length > 0" class="flex flex-col gap-2">
      <div
        v-for="textOverlay in textOverlays"
        :key="textOverlay.id"
        class="flex items-center justify-between gap-2 px-3 bg-white/3 border border-white/8 rounded cursor-pointer transition-all duration-150 hover:bg-white/6 hover:border-white/15"
        :class="{ 'bg-amber-500/15 border-amber-500/40': selectedTextId === textOverlay.id }"
        @click="selectText(textOverlay)"
      >
        <div class="flex items-center gap-2 flex-1 min-w-0 text-white/90">
          <Type :size="16" />
          <span class="flex-1 text-sm truncate">{{ truncateText(textOverlay.text, 30) }}</span>
        </div>
        <button
          class="flex items-center justify-center w-7 h-7 bg-transparent border border-white/10 rounded text-white/50 cursor-pointer transition-all duration-150 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400"
          @click.stop="deleteText(textOverlay.id)"
          title="Delete"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center gap-4 px-6 py-12 text-center">
      <Type :size="32" class="text-white/30" />
      <p class="text-white/50 text-sm m-0">No text overlays added yet</p>
      <button
        class="flex items-center gap-2 px-4 py-2.5 bg-amber-500/15 border border-amber-500/30 rounded text-amber-400 cursor-pointer transition-all duration-150 text-sm font-medium hover:bg-amber-500/25 hover:border-amber-500/50"
        @click="handleAddText"
      >
        <Plus :size="16" />
        <span>Add Your First Text</span>
      </button>
    </div>

    <!-- Quick Templates -->
    <div class="flex flex-col gap-3 pt-4 border-t border-white/10">
      <h4 class="text-sm font-semibold text-white/70 m-0 uppercase tracking-widest">Quick Templates</h4>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="template in textTemplates"
          :key="template.id"
          class="flex items-center justify-center px-3 bg-white/5 border border-white/10 rounded text-white/90 cursor-pointer transition-all duration-150 text-xs font-medium hover:bg-amber-500/15 hover:border-amber-500/30 hover:text-amber-400"
          @click="addTextFromTemplate(template)"
        >
          <span class="text-center">{{ template.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { toRef } from 'vue';
  import { Plus, Type, Trash2 } from 'lucide-vue-next';
  import type { VideoEditorTextOverlayRecord } from '@/services/database/video-editor-edits';
  import { truncateText, useTextOverlaysCRUD, useTextTemplates, type TextTemplate } from '@/composables/clip-editor';

  const props = defineProps<{
    editId: string | null;
    currentTime?: number;
  }>();

  const emit = defineEmits<{
    (e: 'textAdded', textId: string): void;
    (e: 'textSelected', text: VideoEditorTextOverlayRecord): void;
    (e: 'textsUpdated'): void;
  }>();

  // Use the CRUD composable for text overlays
  const editIdRef = toRef(props, 'editId');
  const {
    items: textOverlays,
    selectedId: selectedTextId,
    create: createText,
    remove: deleteText,
    select,
  } = useTextOverlaysCRUD(editIdRef, () => emit('textsUpdated'));

  // Use the text templates composable
  const { templates: textTemplates, createTextData, createDefaultTextData } = useTextTemplates();

  // Add text overlay
  async function handleAddText() {
    if (!props.editId) return;

    try {
      const textData = createDefaultTextData(props.currentTime || 0);
      const newText = await createText(textData);

      emit('textAdded', newText.id);
      console.log('[TextPanel] Added text overlay:', newText.id);
    } catch (error) {
      console.error('[TextPanel] Failed to add text:', error);
    }
  }

  // Add text from template
  async function addTextFromTemplate(template: TextTemplate) {
    if (!props.editId) return;

    try {
      const textData = createTextData(template, props.currentTime || 0);
      const newText = await createText(textData);

      emit('textAdded', newText.id);
      console.log('[TextPanel] Added text from template:', template.label);
    } catch (error) {
      console.error('[TextPanel] Failed to add text from template:', error);
    }
  }

  // Select text and emit event
  function selectText(text: VideoEditorTextOverlayRecord) {
    select(text);
    emit('textSelected', text);
  }
</script>
