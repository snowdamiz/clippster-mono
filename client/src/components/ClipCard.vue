<template>
  <div
    class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
    @click="$emit('play', clip)"
  >
    <!-- Thumbnail background with vignette -->
    <div
      v-if="thumbnailUrl"
      class="absolute inset-0 z-0"
      :style="{
        backgroundImage: `url(${thumbnailUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }"
    >
      <!-- Dark vignette overlay -->
      <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/20 to-black/60"></div>
    </div>
    <!-- Top right status badge -->
    <div class="absolute top-4 right-4 z-5">
      <span
        :class="[
          'text-xs px-2 py-1 rounded-md border',
          thumbnailUrl ? getClipStatusBadgeClass(clip.status) : 'text-muted-foreground bg-muted border-border',
        ]"
      >
        {{ getClipStatusText(clip.status) }}
      </span>
    </div>
    <!-- Bottom left title and description -->
    <div class="absolute bottom-2 left-2 right-2 z-5 bg-black/40 backdrop-blur-sm p-2 rounded-md">
      <h3
        :class="[
          'text-md font-semibold mb-1 group-hover:transition-colors line-clamp-2',
          thumbnailUrl ? 'text-white group-hover:text-white/80' : 'text-foreground group-hover:text-foreground/80',
        ]"
      >
        {{ clip.name || 'Untitled Clip' }}
      </h3>

      <p
        :class="['text-xs mb-1 line-clamp-1', thumbnailUrl ? 'text-white/70' : 'text-muted-foreground/80']"
        v-if="projectName"
      >
        Project: {{ projectName }}
      </p>

      <p :class="['text-sm line-clamp-1', thumbnailUrl ? 'text-white/80' : 'text-muted-foreground']">
        {{ formattedDate }}
      </p>
    </div>
    <!-- Hover Overlay Buttons -->
    <div
      v-if="thumbnailUrl"
      class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-4"
    >
      <button
        class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
        :title="clip.status === 'detected' && !clip.file_path ? 'Clip not generated yet' : 'Play'"
        @click.stop="$emit('play', clip)"
        :disabled="clip.status === 'detected' && !clip.file_path"
      >
        <Play class="h-6 w-6" />
      </button>
      <button
        class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
        title="Delete"
        @click.stop="$emit('delete', clip)"
      >
        <Trash2 class="h-6 w-6" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Play, Trash2 } from 'lucide-vue-next';
  import type { Clip } from '@/services/database';
  import { useFormatters } from '@/composables/useFormatters';

  const props = defineProps<{
    clip: Clip;
    thumbnailUrl: string | null;
    projectName: string | null;
  }>();

  defineEmits<{
    (e: 'play', clip: Clip): void;
    (e: 'delete', clip: Clip): void;
  }>();

  const { getRelativeTime } = useFormatters();

  const formattedDate = computed(() => getRelativeTime(props.clip.created_at));

  function getClipStatusBadgeClass(status: string | null): string {
    switch (status) {
      case 'generated':
      case 'completed':
        return 'bg-emerald-600 text-white border-emerald-500 shadow-sm font-medium';
      case 'detected':
        return 'bg-amber-400 text-black border-amber-500 shadow-sm font-medium';
      case 'processing':
        return 'bg-blue-600 text-white border-blue-500 shadow-sm font-medium';
      default:
        return 'bg-gray-600 text-gray-100 border-gray-500 shadow-sm';
    }
  }

  function getClipStatusText(status: string | null): string {
    switch (status) {
      case 'generated':
      case 'completed':
        return 'Generated';
      case 'detected':
        return 'Detected';
      case 'processing':
        return 'Processing';
      default:
        return 'Unknown';
    }
  }
</script>
