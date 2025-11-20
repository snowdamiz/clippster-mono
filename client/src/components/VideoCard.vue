<template>
  <div
    class="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20 cursor-pointer"
  >
    <!-- Thumbnail with vignette background -->
    <div class="aspect-video bg-muted/50 relative">
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
        <div class="absolute inset-0 bg-gradient-to-br from-black/70 via-black/50 to-black/80"></div>
      </div>
      <!-- Content overlay -->
      <div class="relative z-10 h-full flex flex-col">
        <!-- Duration overlay -->
        <div
          v-if="video.duration"
          class="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm"
        >
          {{ formatDuration(video.duration) }}
        </div>
        <!-- Center placeholder if no thumbnail -->
        <div v-if="!thumbnailUrl" class="flex-1 flex items-center justify-center">
          <Video class="h-14 w-14 text-white/60" />
        </div>
        <!-- Hover Overlay -->
        <div
          class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity"
        >
          <button
            class="p-2.5 bg-white/90 hover:bg-white rounded-md transition-colors"
            title="Play"
            @click.stop="$emit('play')"
          >
            <Play class="h-5 w-5 text-black" />
          </button>
          <button
            class="p-2.5 bg-white/90 hover:bg-white rounded-md transition-colors"
            title="Delete"
            @click.stop="$emit('delete')"
          >
            <Trash2 class="h-5 w-5 text-black" />
          </button>
        </div>
      </div>
    </div>
    <!-- Info -->
    <div
      :class="['p-4 border-t', thumbnailUrl ? 'border-white/10 bg-black/20 backdrop-blur-sm' : 'border-border bg-card']"
    >
      <h4 :class="['font-semibold truncate mb-2', thumbnailUrl ? 'text-white' : 'text-foreground']">
        {{ videoTitle }}
      </h4>

      <p :class="['text-xs', thumbnailUrl ? 'text-white/80' : 'text-muted-foreground']">
        Added {{ getRelativeTime(video.created_at) }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import type { RawVideo } from '@/services/database';
  import { useFormatters } from '@/composables/useFormatters';
  import { Video, Play, Trash2 } from 'lucide-vue-next';

  interface Props {
    video: RawVideo;
    thumbnailUrl?: string | null;
  }

  interface Emits {
    (e: 'play'): void;
    (e: 'delete'): void;
  }

  const props = defineProps<Props>();
  defineEmits<Emits>();

  const { getRelativeTime } = useFormatters();

  const videoTitle = computed(
    () => props.video.original_filename || props.video.file_path.split(/[\\\/]/).pop() || 'Untitled Video'
  );

  // Helper function to format duration in seconds to human readable format
  function formatDuration(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';

    if (seconds < 60) {
      return `0:${Math.round(seconds).toString().padStart(2, '0')}`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = Math.round(seconds % 60);
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }
</script>
