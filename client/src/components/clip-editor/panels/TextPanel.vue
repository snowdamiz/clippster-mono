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
          <span class="flex-1 text-sm truncate">{{ truncateText(textOverlay.text) }}</span>
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
  import { ref } from 'vue';
  import { Plus, Type, Trash2 } from 'lucide-vue-next';
  import {
    getVideoEditorTextOverlaysByEditId,
    createVideoEditorTextOverlay,
    deleteVideoEditorTextOverlay,
    type VideoEditorTextOverlayRecord,
  } from '@/services/database/video-editor-edits';

  const props = defineProps<{
    editId: string | null;
    currentTime?: number;
  }>();

  const emit = defineEmits<{
    (e: 'textAdded', textId: string): void;
    (e: 'textSelected', text: VideoEditorTextOverlayRecord): void;
    (e: 'textsUpdated'): void;
  }>();

  // State
  const textOverlays = ref<VideoEditorTextOverlayRecord[]>([]);
  const selectedTextId = ref<string | null>(null);

  // Templates
  const textTemplates = [
    { id: 'title', label: 'Title', preset: 'title' },
    { id: 'subtitle', label: 'Subtitle', preset: 'lower-third' },
    { id: 'caption', label: 'Caption', preset: 'caption' },
    { id: 'quote', label: 'Quote', preset: 'quote' },
  ];

  // Load text overlays
  async function loadTextOverlays() {
    if (!props.editId) return;

    try {
      textOverlays.value = await getVideoEditorTextOverlaysByEditId(props.editId);
      console.log('[TextPanel] Loaded text overlays:', textOverlays.value.length);
    } catch (error) {
      console.error('[TextPanel] Failed to load text overlays:', error);
    }
  }

  // Add text overlay
  async function handleAddText() {
    if (!props.editId) return;

    try {
      const defaultStyle = {
        fontFamily: 'Inter',
        fontSize: 48,
        fontWeight: 700,
        color: '#ffffff',
        backgroundColor: null,
        backgroundEnabled: false,
        strokeEnabled: true,
        strokeColor: '#000000',
        strokeWidth: 2,
        shadowEnabled: true,
        shadowColor: '#000000',
        shadowBlur: 4,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        border1Width: 0,
        border1Color: '#000000',
        border2Width: 0,
        border2Color: '#000000',
        padding: 16,
        borderRadius: 8,
        letterSpacing: 0,
        lineHeight: 1.2,
        textAlign: 'center' as const,
        maxWidth: 80,
      };

      const newText = await createVideoEditorTextOverlay(props.editId, {
        text: 'New Text',
        start_time: props.currentTime || 0,
        end_time: (props.currentTime || 0) + 3,
        position_x: 50,
        position_y: 50,
        style_data: JSON.stringify(defaultStyle),
        animation: 'fade',
      });

      await loadTextOverlays();
      emit('textAdded', newText.id);
      emit('textsUpdated');

      console.log('[TextPanel] Added text overlay:', newText.id);
    } catch (error) {
      console.error('[TextPanel] Failed to add text:', error);
    }
  }

  // Add text from template
  async function addTextFromTemplate(template: any) {
    if (!props.editId) return;

    try {
      const templateStyles = {
        title: {
          fontSize: 64,
          fontWeight: 800,
          position_y: 20,
        },
        'lower-third': {
          fontSize: 32,
          fontWeight: 600,
          position_y: 85,
          backgroundEnabled: true,
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
        },
        caption: {
          fontSize: 28,
          fontWeight: 600,
          position_y: 90,
        },
        quote: {
          fontSize: 40,
          fontWeight: 500,
          fontStyle: 'italic',
        },
      };

      const style = templateStyles[template.preset as keyof typeof templateStyles] || {};

      const defaultStyle = {
        fontFamily: 'Inter',
        color: '#ffffff',
        backgroundColor: null,
        backgroundEnabled: false,
        strokeEnabled: true,
        strokeColor: '#000000',
        strokeWidth: 2,
        shadowEnabled: true,
        shadowColor: '#000000',
        shadowBlur: 4,
        shadowOffsetX: 2,
        shadowOffsetY: 2,
        border1Width: 0,
        border1Color: '#000000',
        border2Width: 0,
        border2Color: '#000000',
        padding: 16,
        borderRadius: 8,
        letterSpacing: 0,
        lineHeight: 1.2,
        textAlign: 'center' as const,
        maxWidth: 80,
        ...style,
      };

      const newText = await createVideoEditorTextOverlay(props.editId, {
        text: template.label,
        start_time: props.currentTime || 0,
        end_time: (props.currentTime || 0) + 3,
        position_x: 50,
        position_y: (style as any).position_y || 50,
        style_data: JSON.stringify(defaultStyle),
        animation: 'fade',
      });

      await loadTextOverlays();
      emit('textAdded', newText.id);
      emit('textsUpdated');

      console.log('[TextPanel] Added text from template:', template.label);
    } catch (error) {
      console.error('[TextPanel] Failed to add text from template:', error);
    }
  }

  // Select text
  function selectText(text: VideoEditorTextOverlayRecord) {
    selectedTextId.value = text.id;
    emit('textSelected', text);
  }

  // Delete text
  async function deleteText(textId: string) {
    try {
      await deleteVideoEditorTextOverlay(textId);
      await loadTextOverlays();

      if (selectedTextId.value === textId) {
        selectedTextId.value = null;
      }

      emit('textsUpdated');
      console.log('[TextPanel] Deleted text:', textId);
    } catch (error) {
      console.error('[TextPanel] Failed to delete text:', error);
    }
  }

  // Truncate text
  function truncateText(text: string): string {
    return text.length > 30 ? text.substring(0, 30) + '...' : text;
  }

  // Load texts on mount
  if (props.editId) {
    loadTextOverlays();
  }
</script>
