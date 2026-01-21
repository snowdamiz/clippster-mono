<template>
  <div class="stickers-panel">
    <div class="stickers-panel__header">
      <h3 class="stickers-panel__title">Stickers</h3>
      <button class="stickers-panel__add-button" @click="handleUploadSticker" title="Upload Sticker">
        <Upload :size="16" />
        <span>Upload</span>
      </button>
    </div>

    <!-- Sticker List -->
    <div v-if="stickers.length > 0" class="stickers-panel__list">
      <div
        v-for="sticker in stickers"
        :key="sticker.id"
        class="stickers-panel__item"
        :class="{ 'stickers-panel__item--selected': selectedStickerId === sticker.id }"
        @click="selectSticker(sticker)"
      >
        <div class="stickers-panel__item-content">
          <span class="stickers-panel__item-icon">{{ getStickerPreview(sticker) }}</span>
          <span class="stickers-panel__item-name">{{ getStickerName(sticker) }}</span>
        </div>
        <button
          class="stickers-panel__item-delete"
          @click.stop="deleteSticker(sticker.id)"
          title="Delete"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Emoji Picker -->
    <div class="stickers-panel__emoji-section">
      <h4 class="stickers-panel__section-title">Quick Emojis</h4>
      <div class="stickers-panel__emoji-grid">
        <button
          v-for="emoji in commonEmojis"
          :key="emoji"
          class="stickers-panel__emoji-button"
          @click="addEmoji(emoji)"
          :title="`Add ${emoji}`"
        >
          {{ emoji }}
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="stickers.length === 0" class="stickers-panel__empty">
      <Smile :size="32" class="stickers-panel__empty-icon" />
      <p class="stickers-panel__empty-text">No stickers added yet</p>
      <button class="stickers-panel__empty-button" @click="handleUploadSticker">
        <Upload :size="16" />
        <span>Upload Your First Sticker</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { open } from '@tauri-apps/plugin-dialog';
import { Plus, Upload, Smile, Trash2 } from 'lucide-vue-next';
import {
  getVideoEditorStickersByEditId,
  createVideoEditorSticker,
  deleteVideoEditorSticker,
  type VideoEditorStickerRecord,
} from '@/services/database/video-editor-edits';

const props = defineProps<{
  editId: string | null;
  currentTime?: number;
}>();

const emit = defineEmits<{
  (e: 'stickerAdded', stickerId: string): void;
  (e: 'stickerSelected', sticker: VideoEditorStickerRecord): void;
  (e: 'stickersUpdated'): void;
}>();

// State
const stickers = ref<VideoEditorStickerRecord[]>([]);
const selectedStickerId = ref<string | null>(null);

// Common emojis
const commonEmojis = [
  '😀', '😂', '🤣', '😍', '😎', '🔥', '💯', '👍',
  '❤️', '✨', '🎉', '🎊', '🎈', '🏆', '⭐', '💪',
  '👏', '🙌', '🤝', '💰', '💎', '🚀', '⚡', '💥',
];

// Load stickers
async function loadStickers() {
  if (!props.editId) return;
  
  try {
    stickers.value = await getVideoEditorStickersByEditId(props.editId);
    console.log('[StickersPanel] Loaded stickers:', stickers.value.length);
  } catch (error) {
    console.error('[StickersPanel] Failed to load stickers:', error);
  }
}

// Upload sticker
async function handleUploadSticker() {
  try {
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Images',
        extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
      }],
    });

    if (!selected || !props.editId) return;

    const filePath = selected as string;
    const fileName = filePath.split(/[\\/]/).pop() || 'Sticker';
    
    await createVideoEditorSticker(props.editId, {
      sticker_path: filePath,
      sticker_type: filePath.endsWith('.gif') ? 'gif' : 'image',
      start_time: props.currentTime || 0,
      end_time: (props.currentTime || 0) + 3,
      position_x: 50,
      position_y: 50,
      scale: 1.0,
      rotation: 0,
      animation: 'none',
    });

    await loadStickers();
    emit('stickersUpdated');
    
    console.log('[StickersPanel] Uploaded sticker:', fileName);
  } catch (error) {
    console.error('[StickersPanel] Failed to upload sticker:', error);
  }
}

// Add emoji
async function addEmoji(emoji: string) {
  if (!props.editId) return;
  
  try {
    const newSticker = await createVideoEditorSticker(props.editId, {
      sticker_path: emoji,
      sticker_type: 'emoji',
      start_time: props.currentTime || 0,
      end_time: (props.currentTime || 0) + 3,
      position_x: 50,
      position_y: 50,
      scale: 1.0,
      rotation: 0,
      animation: 'bounce',
    });

    await loadStickers();
    emit('stickerAdded', newSticker.id);
    emit('stickersUpdated');
    
    console.log('[StickersPanel] Added emoji:', emoji);
  } catch (error) {
    console.error('[StickersPanel] Failed to add emoji:', error);
  }
}

// Select sticker
function selectSticker(sticker: VideoEditorStickerRecord) {
  selectedStickerId.value = sticker.id;
  emit('stickerSelected', sticker);
}

// Delete sticker
async function deleteSticker(stickerId: string) {
  try {
    await deleteVideoEditorSticker(stickerId);
    await loadStickers();
    
    if (selectedStickerId.value === stickerId) {
      selectedStickerId.value = null;
    }
    
    emit('stickersUpdated');
    console.log('[StickersPanel] Deleted sticker:', stickerId);
  } catch (error) {
    console.error('[StickersPanel] Failed to delete sticker:', error);
  }
}

// Get sticker preview
function getStickerPreview(sticker: VideoEditorStickerRecord): string {
  if (sticker.sticker_type === 'emoji') {
    return sticker.sticker_path;
  }
  return '🖼️';
}

// Get sticker name
function getStickerName(sticker: VideoEditorStickerRecord): string {
  if (sticker.sticker_type === 'emoji') {
    return 'Emoji';
  }
  const fileName = sticker.sticker_path.split(/[\\/]/).pop() || 'Sticker';
  return fileName.length > 20 ? fileName.substring(0, 20) + '...' : fileName;
}

// Load stickers on mount
if (props.editId) {
  loadStickers();
}
</script>

<style scoped>
.stickers-panel {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stickers-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.stickers-panel__title {
  font-size: 1rem;
  font-weight: 600;
  color: #f4f4f5;
  margin: 0;
}

.stickers-panel__add-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: rgba(236, 72, 153, 0.15);
  border: 1px solid rgba(236, 72, 153, 0.3);
  border-radius: 6px;
  color: #ec4899;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  font-weight: 500;
}

.stickers-panel__add-button:hover {
  background-color: rgba(236, 72, 153, 0.25);
  border-color: rgba(236, 72, 153, 0.5);
}

.stickers-panel__list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 200px;
  overflow-y: auto;
}

.stickers-panel__item {
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

.stickers-panel__item:hover {
  background-color: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
}

.stickers-panel__item--selected {
  background-color: rgba(236, 72, 153, 0.15);
  border-color: rgba(236, 72, 153, 0.4);
}

.stickers-panel__item-content {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex: 1;
  min-width: 0;
}

.stickers-panel__item-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.stickers-panel__item-name {
  flex: 1;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.9);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stickers-panel__item-delete {
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

.stickers-panel__item-delete:hover {
  background-color: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.4);
  color: #f87171;
}

.stickers-panel__emoji-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.stickers-panel__section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.7);
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stickers-panel__emoji-grid {
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.375rem;
}

.stickers-panel__emoji-button {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 1;
  padding: 0.5rem;
  background-color: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  font-size: 1.25rem;
  cursor: pointer;
  transition: all 150ms ease;
}

.stickers-panel__emoji-button:hover {
  background-color: rgba(236, 72, 153, 0.15);
  border-color: rgba(236, 72, 153, 0.3);
  transform: scale(1.1);
}

.stickers-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 2rem 1.5rem;
  text-align: center;
}

.stickers-panel__empty-icon {
  color: rgba(255, 255, 255, 0.3);
}

.stickers-panel__empty-text {
  color: rgba(255, 255, 255, 0.5);
  font-size: 0.875rem;
  margin: 0;
}

.stickers-panel__empty-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background-color: rgba(236, 72, 153, 0.15);
  border: 1px solid rgba(236, 72, 153, 0.3);
  border-radius: 6px;
  color: #ec4899;
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.875rem;
  font-weight: 500;
}

.stickers-panel__empty-button:hover {
  background-color: rgba(236, 72, 153, 0.25);
  border-color: rgba(236, 72, 153, 0.5);
}
</style>

