<template>
  <Transition name="inspector-slide">
    <div v-if="selectedItem" class="editor-inspector">
      <div class="editor-inspector__header">
        <h3 class="editor-inspector__title">Inspector</h3>
      </div>

      <div class="editor-inspector__content">
        <div class="editor-inspector__properties">
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
          <div v-else class="editor-inspector__section">
            <h4 class="editor-inspector__section-title">
              {{ selectedItemTypeLabel }}
            </h4>
            <div class="editor-inspector__placeholder">
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
import { Info } from 'lucide-vue-next';
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
  (e: 'update', updates: any): void;
  (e: 'itemDeleted'): void;
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
.editor-inspector {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  background-color: var(--editor-surface);
  border-left: 1px solid var(--editor-border);
}

.editor-inspector__header {
  padding: 1rem;
  border-bottom: 1px solid var(--editor-border);
  background: linear-gradient(180deg, var(--editor-surface-elevated) 0%, var(--editor-surface) 100%);
}

.editor-inspector__title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--editor-accent);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.editor-inspector__content {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}


.editor-inspector__properties {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.editor-inspector__section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.editor-inspector__section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--editor-text);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.editor-inspector__placeholder {
  color: var(--editor-text-muted);
  font-size: 0.875rem;
  padding: 1rem;
  text-align: center;
  background-color: var(--editor-surface-elevated);
  border-radius: 6px;
  border: 1px dashed var(--editor-border);
}

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

