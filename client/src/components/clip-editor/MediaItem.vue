<template>
  <div
    class="group relative aspect-video rounded-lg overflow-hidden border cursor-pointer transition-all"
    style="background-color: var(--sidebar-hover); border-color: var(--sidebar-border)"
    @click="$emit('click')"
    @mouseenter="(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-accent)')"
    @mouseleave="(e) => ((e.currentTarget as HTMLElement).style.borderColor = 'var(--sidebar-border)')"
  >
    <!-- Thumbnail -->
    <div class="absolute inset-0">
      <img v-if="media.thumbnail_path && thumbnailUrl" :src="thumbnailUrl" class="w-full h-full object-cover" />
      <div
        v-else
        class="w-full h-full flex items-center justify-center"
        style="background-color: var(--sidebar-surface)"
      >
        <component :is="typeIcon" :size="20" style="color: var(--sidebar-text-muted)" />
      </div>
    </div>

    <!-- Type badge -->
    <div class="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-medium" :class="typeBadgeClass">
      {{ media.media_type }}
    </div>

    <!-- Organization badge -->
    <div
      v-if="media.isOrgAsset"
      class="absolute top-1 left-1 mt-6 px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/80 text-white flex items-center gap-0.5"
      :title="media.organization_name || 'Organization asset'"
    >
      <Building2 :size="8" />
      <span>ORG</span>
    </div>

    <!-- Duration badge (for video/audio) -->
    <div
      v-if="media.duration"
      class="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[9px] font-mono"
      style="background-color: rgba(0, 0, 0, 0.8); color: var(--sidebar-text)"
    >
      {{ formatDuration(media.duration) }}
    </div>

    <!-- Name overlay on hover -->
    <div
      class="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <p class="text-[10px] truncate" style="color: var(--sidebar-text)">{{ media.file_name }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref, onMounted } from 'vue';
  import { Video, Music, Image as ImageIcon, Building2 } from 'lucide-vue-next';
  import type { ProjectMedia } from '@/services/database/project-media';
  import { invoke } from '@tauri-apps/api/core';

  const props = defineProps<{
    media: ProjectMedia & { isOrgAsset?: boolean; organization_name?: string };
  }>();

  defineEmits<{
    (e: 'click'): void;
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
        return 'bg-sky-500/80 text-white';
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

    // For organization assets, use the URL directly
    if (props.media.isOrgAsset) {
      thumbnailUrl.value = props.media.thumbnail_path;
      return;
    }

    // For local assets, load from file system
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

<style scoped>
  /* Smooth hover transitions */
  .group {
    transition: all 200ms ease;
  }

  /* Ensure thumbnail images cover properly */
  img {
    object-fit: cover;
    width: 100%;
    height: 100%;
  }

  /* Type badge styling */
  .absolute.top-1.left-1 {
    backdrop-filter: blur(4px);
  }

  /* Favorite button hover effect */
  button:hover {
    transform: scale(1.05);
  }
</style>
