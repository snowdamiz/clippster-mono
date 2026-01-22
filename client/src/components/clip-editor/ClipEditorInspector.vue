<template>
  <Transition name="inspector-slide">
    <div v-if="selectedItem" class="w-[280px] flex-shrink-0 flex flex-col border-l" 
         style="background-color: var(--editor-surface); border-color: var(--editor-border);">
      <div class="flex items-center justify-between p-4 border-b" 
           style="background: linear-gradient(180deg, var(--editor-surface-elevated) 0%, var(--editor-surface) 100%); border-color: var(--editor-border);">
        <h3 class="text-sm font-semibold m-0 uppercase tracking-wider" style="color: var(--editor-accent);">Inspector</h3>
        <button class="flex items-center justify-center w-6 h-6 bg-transparent border-none rounded cursor-pointer transition-all duration-150 hover:bg-white/8" 
                style="color: var(--editor-text-muted);"
                @click="$emit('close')" 
                title="Close inspector">
          <X :size="16" />
        </button>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <div class="flex flex-col gap-6">
          <!-- Audio Track Inspector -->
          <AudioInspector
            v-if="selectedItemType === 'audio' && selectedItem"
            :audio-track="selectedItem"
            @update="handlePropertyUpdate"
            @delete="handleDelete"
          />

          <!-- Text Overlay Inspector -->
          <TextInspector
            v-else-if="selectedItemType === 'text' && selectedItem"
            :text-overlay="selectedItem"
            @update="handlePropertyUpdate"
            @delete="handleDelete"
          />

          <!-- Sticker Inspector -->
          <StickerInspector
            v-else-if="selectedItemType === 'sticker' && selectedItem"
            :sticker="selectedItem"
            @update="handlePropertyUpdate"
            @delete="handleDelete"
          />

          <!-- Placeholder for other inspectors -->
          <div v-else class="flex flex-col gap-3">
            <h4 class="text-sm font-semibold m-0 uppercase tracking-wider" style="color: var(--editor-text);">
              {{ selectedItemTypeLabel }}
            </h4>
            <div class="text-sm p-4 text-center rounded-md border border-dashed" 
                 style="color: var(--editor-text-muted); background-color: var(--editor-surface-elevated); border-color: var(--editor-border);">
              Properties for {{ selectedItemTypeLabel }} coming soon...
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Info, X } from 'lucide-vue-next';
import AudioInspector from './inspector/AudioInspector.vue';
import TextInspector from './inspector/TextInspector.vue';
import StickerInspector from './inspector/StickerInspector.vue';
import { 
  updateVideoEditorAudioTrack, 
  deleteVideoEditorAudioTrack,
  updateVideoEditorTextOverlay,
  deleteVideoEditorTextOverlay,
  updateVideoEditorSticker,
  deleteVideoEditorSticker,
} from '@/services/database/video-editor-edits';

const props = defineProps<{
  selectedItem: any;
  selectedItemType: string | null;
  editId: string | null;
}>();

const emit = defineEmits<{
  (e: 'update', data: any): void;
  (e: 'itemDeleted'): void;
  (e: 'close'): void;
}>();

// Handle property updates
async function handlePropertyUpdate(property: string, value: any) {
  if (!props.selectedItem || !props.selectedItem.id) return;

  try {
    if (props.selectedItemType === 'audio') {
      await updateVideoEditorAudioTrack(props.selectedItem.id, { [property]: value });
      emit('update', { property, value });
    } else if (props.selectedItemType === 'text') {
      await updateVideoEditorTextOverlay(props.selectedItem.id, { [property]: value });
      emit('update', { property, value });
    } else if (props.selectedItemType === 'sticker') {
      await updateVideoEditorSticker(props.selectedItem.id, { [property]: value });
      emit('update', { property, value });
    }
  } catch (error) {
    console.error('[ClipEditorInspector] Failed to update property:', error);
  }
}

// Handle item deletion
async function handleDelete() {
  if (!props.selectedItem || !props.selectedItem.id) return;

  try {
    if (props.selectedItemType === 'audio') {
      await deleteVideoEditorAudioTrack(props.selectedItem.id);
      emit('itemDeleted');
    } else if (props.selectedItemType === 'text') {
      await deleteVideoEditorTextOverlay(props.selectedItem.id);
      emit('itemDeleted');
    } else if (props.selectedItemType === 'sticker') {
      await deleteVideoEditorSticker(props.selectedItem.id);
      emit('itemDeleted');
    }
  } catch (error) {
    console.error('[ClipEditorInspector] Failed to delete item:', error);
  }
}

const selectedItemTypeLabel = computed(() => {
  const labels: Record<string, string> = {
    segment: 'Video Segment',
    audio: 'Audio Track',
    text: 'Text Overlay',
    sticker: 'Sticker',
    effect: 'Effect',
    transition: 'Transition',
    watermark: 'Watermark',
  };

  return labels[props.selectedItemType || ''] || 'Item';
});
</script>

<style scoped>
/* Slide transition */
.inspector-slide-enter-active,
.inspector-slide-leave-active {
  transition: all 0.3s ease;
}

.inspector-slide-enter-from {
  transform: translateX(100%);
  opacity: 0;
}

.inspector-slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>

