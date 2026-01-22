<template>
  <div class="flex flex-col h-full">
    <div class="p-4 border-b border-zinc-800">
      <h3 class="text-sm font-semibold mb-3">Media Library</h3>
      
      <div class="flex gap-2">
        <button
          @click="$emit('importLocal')"
          class="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          <Upload class="w-4 h-4 inline mr-2" />
          Import Files
        </button>
        
        <button
          @click="$emit('openAssetPicker')"
          class="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          <Archive class="w-4 h-4 inline mr-2" />
          From Assets
        </button>
        
        <button
          @click="$emit('openClipPicker')"
          class="flex-1 px-3 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm transition-colors"
        >
          <Video class="w-4 h-4 inline mr-2" />
          From Clips
        </button>
      </div>
    </div>

    <div class="flex-1 overflow-y-auto p-4">
      <div v-if="media.length === 0" class="text-center py-12 text-zinc-500">
        <FolderOpen class="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p class="text-sm">No media added yet</p>
        <p class="text-xs mt-1">Import files to get started</p>
      </div>

      <div v-else class="grid grid-cols-2 gap-3">
        <div
          v-for="item in media"
          :key="item.id"
          class="relative group bg-zinc-900 rounded-lg overflow-hidden border border-zinc-800 hover:border-zinc-700 transition-colors"
        >
          <div class="aspect-video bg-zinc-950 flex items-center justify-center">
            <img
              v-if="item.thumbnailUrl"
              :src="item.thumbnailUrl"
              :alt="item.name"
              class="w-full h-full object-cover"
            />
            <component
              v-else
              :is="getMediaIcon(item.type)"
              class="w-8 h-8 text-zinc-600"
            />
          </div>
          
          <div class="p-2">
            <p class="text-xs font-medium truncate">{{ item.name }}</p>
            <p class="text-xs text-zinc-500">{{ item.type }}</p>
            <p v-if="item.duration" class="text-xs text-zinc-500">
              {{ formatDuration(item.duration) }}
            </p>
          </div>

          <button
            @click="$emit('removeMedia', item.id)"
            class="absolute top-2 right-2 p-1 bg-red-600 hover:bg-red-700 rounded opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X class="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Upload, Archive, Video, FolderOpen, X, FileVideo, FileAudio, Image } from 'lucide-vue-next';
import type { AIVideoMediaItem } from '@/types/ai-video';

defineProps<{
  media: AIVideoMediaItem[];
}>();

defineEmits<{
  (e: 'importLocal'): void;
  (e: 'openAssetPicker'): void;
  (e: 'openClipPicker'): void;
  (e: 'removeMedia', id: string): void;
}>();

function getMediaIcon(type: string) {
  switch (type) {
    case 'video':
      return FileVideo;
    case 'audio':
      return FileAudio;
    case 'image':
      return Image;
    default:
      return FileVideo;
  }
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
</script>
