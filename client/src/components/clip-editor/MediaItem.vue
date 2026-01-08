<template>
  <div
    class="group relative aspect-video bg-white/5 rounded-lg overflow-hidden border border-white/10 hover:border-violet-500/30 cursor-pointer transition-all"
    @click="$emit('click')"
  >
    <!-- Thumbnail -->
    <div class="absolute inset-0">
      <img
        v-if="media.thumbnail_path && thumbnailUrl"
        :src="thumbnailUrl"
        class="w-full h-full object-cover"
      />
      <div v-else class="w-full h-full flex items-center justify-center bg-black/30">
        <component :is="typeIcon" :size="20" class="text-white/30" />
      </div>
    </div>

    <!-- Type badge -->
    <div
      class="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-medium"
      :class="typeBadgeClass"
    >
      {{ media.media_type }}
    </div>

    <!-- Favorite button -->
    <button
      @click.stop="$emit('toggleFavorite')"
      class="absolute top-1 right-1 p-1 rounded bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
      :class="media.is_favorite ? 'text-yellow-400' : 'text-white/50 hover:text-yellow-400'"
    >
      <Star :size="12" :fill="media.is_favorite ? 'currentColor' : 'none'" />
    </button>

    <!-- Duration badge (for video/audio) -->
    <div
      v-if="media.duration"
      class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-[9px] text-white/80 font-mono"
    >
      {{ formatDuration(media.duration) }}
    </div>

    <!-- Name overlay on hover -->
    <div
      class="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <p class="text-[10px] text-white truncate">{{ media.file_name }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue';
import { Video, Music, Image as ImageIcon, Star } from 'lucide-vue-next';
import type { ProjectMedia } from '@/services/database/project-media';
import { invoke } from '@tauri-apps/api/core';

const props = defineProps<{
  media: ProjectMedia;
}>();

defineEmits<{
  (e: 'click'): void;
  (e: 'toggleFavorite'): void;
}>();

const thumbnailUrl = ref<string | null>(null);

const typeIcon = computed(() => {
  switch (props.media.media_type) {
    case 'video':
      return Video;
    case 'audio':
      return Music;
    case 'image':
      return ImageIcon;
    default:
      return Video;
  }
});

const typeBadgeClass = computed(() => {
  switch (props.media.media_type) {
    case 'video':
      return 'bg-violet-500/80 text-white';
    case 'audio':
      return 'bg-emerald-500/80 text-white';
    case 'image':
      return 'bg-cyan-500/80 text-white';
    default:
      return 'bg-white/20 text-white';
  }
});

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

async function loadThumbnail() {
  if (!props.media.thumbnail_path) return;
  
  try {
    const exists = await invoke<boolean>('check_file_exists', { path: props.media.thumbnail_path });
    if (exists) {
      thumbnailUrl.value = await invoke<string>('read_file_as_data_url', { filePath: props.media.thumbnail_path });
    }
  } catch (err) {
    console.warn('[MediaItem] Failed to load thumbnail:', err);
  }
}

onMounted(() => {
  loadThumbnail();
});
</script>
