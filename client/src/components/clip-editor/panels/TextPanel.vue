<template>
  <div class="text-panel">
    <div class="text-panel__header">
      <h3 class="text-panel__title">Text Overlays</h3>
      <button class="text-panel__add-button" @click="handleAddText" title="Add Text">
        <Plus :size="16" />
        <span>Add Text</span>
      </button>
    </div>

    <!-- Text List -->
    <div v-if="textOverlays.length > 0" class="text-panel__list">
      <div
        v-for="textOverlay in textOverlays"
        :key="textOverlay.id"
        class="text-panel__item"
        :class="{ 'text-panel__item--selected': selectedTextId === textOverlay.id }"
        @click="selectText(textOverlay)"
      >
        <div class="text-panel__item-content">
          <Type :size="16" />
          <span class="text-panel__item-text">{{ truncateText(textOverlay.text) }}</span>
        </div>
        <button
          class="text-panel__item-delete"
          @click.stop="deleteText(textOverlay.id)"
          title="Delete"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="text-panel__empty">
      <Type :size="32" class="text-panel__empty-icon" />
      <p class="text-panel__empty-text">No text overlays added yet</p>
      <button class="text-panel__empty-button" @click="handleAddText">
        <Plus :size="16" />
        <span>Add Your First Text</span>
      </button>
    </div>

    <!-- Quick Templates -->
    <div class="text-panel__templates">
      <h4 class="text-panel__section-title">Quick Templates</h4>
      <div class="text-panel__template-grid">
        <button
          v-for="template in textTemplates"
          :key="template.id"
          class="text-panel__template"
          @click="addTextFromTemplate(template)"
        >
          <span class="text-panel__template-label">{{ template.label }}</span>
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

<style scoped>
.text-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.text-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.text-panel__title {
  font-size: 1rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.text-panel__add-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 6px;
  color: #fbbf24;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  font-weight: 500;
}

.text-panel__add-button:hover {
  background-color: rgba(251, 191, 36, 0.25);
  border-color: rgba(251, 191, 36, 0.5);
}

.text-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.text-panel__item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms ease;
}

.text-panel__item:hover {
  background-color: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.text-panel__item--selected {
  background-color: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.4);
}

.text-panel__item-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
  color: rgba(255, 255, 255, 0.9);
}

.text-panel__item-text {
  flex: 1;
  font-size: 0.875rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.text-panel__item-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: rgba(255, 255, 255, 0.5);
  cursor: pointer;
  transition: all 150ms ease;
}

.text-panel__item-delete:hover {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.text-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem 1.5rem;
  text-align: center;
}

.text-panel__empty-icon {
  color: rgba(255, 255, 255, 0.3);
}

.text-panel__empty-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.875rem;
  margin: 0;
}

.text-panel__empty-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background-color: rgba(251, 191, 36, 0.15);
  border: 1px solid rgba(251, 191, 36, 0.3);
  border-radius: 6px;
  color: #fbbf24;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.text-panel__empty-button:hover {
  background-color: rgba(251, 191, 36, 0.25);
  border-color: rgba(251, 191, 36, 0.5);
}

.text-panel__templates {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.text-panel__section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.text-panel__template-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.text-panel__template {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem;
  background-color: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  color: rgba(255, 255, 255, 0.9);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  font-weight: 500;
}

.text-panel__template:hover {
  background-color: rgba(251, 191, 36, 0.15);
  border-color: rgba(251, 191, 36, 0.3);
  color: #fbbf24;
}

.text-panel__template-label {
  text-align: center;
}
</style>

