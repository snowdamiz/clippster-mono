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
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-14 w-14 text-white/60"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
              />

              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
          <button
            class="p-2.5 bg-white/90 hover:bg-white rounded-md transition-colors"
            title="Delete"
            @click.stop="$emit('delete')"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
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
