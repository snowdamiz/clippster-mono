<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center justify-between gap-2">
      <h3 class="text-base font-semibold text-zinc-100 m-0">Stickers</h3>
      <button
        class="flex items-center gap-2 px-3 py-2 bg-pink-500/15 border border-pink-500/30 rounded-md text-pink-500 cursor-pointer transition-all duration-150 text-xs font-medium hover:bg-pink-500/25 hover:border-pink-500/50"
        @click="handleUploadSticker"
        title="Upload Sticker"
      >
        <Upload :size="16" />
        <span>Upload</span>
      </button>
    </div>

    <!-- Sticker List -->
    <div v-if="stickers.length > 0" class="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
      <div
        v-for="sticker in stickers"
        :key="sticker.id"
        class="flex items-center justify-between gap-2 p-3 bg-white/5 border border-white/10 rounded-md cursor-pointer transition-all duration-150 hover:bg-white/10 hover:border-white/15"
        :class="{ 'bg-pink-500/15 border-pink-500/40': selectedStickerId === sticker.id }"
        @click="selectSticker(sticker)"
      >
        <div class="flex items-center gap-2 flex-1 min-w-0">
          <span class="text-2xl flex-shrink-0">{{ getStickerPreview(sticker) }}</span>
          <span class="flex-1 text-sm text-white/90 overflow-hidden text-ellipsis whitespace-nowrap">
            {{ getStickerName(sticker) }}
          </span>
        </div>
        <button
          class="flex items-center justify-center w-7 h-7 bg-transparent border border-white/10 rounded text-white/50 cursor-pointer transition-all duration-150 hover:bg-red-500/20 hover:border-red-500/40 hover:text-red-400"
          @click.stop="deleteSticker(sticker.id)"
          title="Delete"
        >
          <Trash2 :size="14" />
        </button>
      </div>
    </div>

    <!-- Emoji Picker -->
    <div class="flex flex-col gap-3">
      <h4 class="text-sm font-semibold text-white/70 m-0 uppercase tracking-widest">Quick Emojis</h4>
      <div class="grid grid-cols-8 gap-1.5">
        <button
          v-for="emoji in commonEmojis"
          :key="emoji"
          class="flex items-center justify-center aspect-square p-2 bg-white/5 border border-white/10 rounded-md text-xl cursor-pointer transition-all duration-150 hover:bg-pink-500/15 hover:border-pink-500/30 hover:scale-110"
          @click="addEmoji(emoji)"
          :title="`Add ${emoji}`"
        >
          {{ emoji }}
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <div v-if="stickers.length === 0" class="flex flex-col items-center justify-center gap-4 p-8 text-center">
      <Smile :size="32" class="text-white/30" />
      <p class="text-white/50 text-sm m-0">No stickers added yet</p>
      <button
        class="flex items-center gap-2 px-4 py-2.5 bg-pink-500/15 border border-pink-500/30 rounded-md text-pink-500 cursor-pointer transition-all duration-150 text-sm font-medium hover:bg-pink-500/25 hover:border-pink-500/50"
        @click="handleUploadSticker"
      >
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
    '😀',
    '😂',
    '🤣',
    '😍',
    '😎',
    '🔥',
    '💯',
    '👍',
    '❤️',
    '✨',
    '🎉',
    '🎊',
    '🎈',
    '🏆',
    '⭐',
    '💪',
    '👏',
    '🙌',
    '🤝',
    '💰',
    '💎',
    '🚀',
    '⚡',
    '💥',
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
        filters: [
          {
            name: 'Images',
            extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'],
          },
        ],
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
