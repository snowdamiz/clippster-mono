<template>
  <div class="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20">
    <!-- Thumbnail with progress overlay -->
    <div class="aspect-video bg-muted/50 relative">
      <div class="absolute inset-0 flex items-center justify-center">
        <div class="flex flex-col items-center gap-3">
          <Loader2 class="animate-spin h-8 w-8 text-purple-500" />
          <span
            v-if="download.progress.current_time && download.progress.total_time"
            class="text-xs text-muted-foreground"
          >
            {{ formatDuration(download.progress.current_time) }} / {{ formatDuration(download.progress.total_time) }}
          </span>
        </div>
      </div>
      <!-- Progress bar at bottom of thumbnail -->
      <div class="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
        <div
          class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 ease-out"
          :style="{ width: `${download.progress.progress}%` }"
        ></div>
      </div>
      <!-- Hover overlay -->
      <div
        class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <div class="text-center">
          <DownloadCloud class="h-12 w-12 text-white mx-auto mb-2" />
          <p class="text-white text-sm font-medium">Downloading...</p>

          <p class="text-white/80 text-xs">{{ Math.round(download.progress.progress) }}% complete</p>
        </div>
      </div>
    </div>
    <!-- Download info -->
    <div class="p-4">
      <h4 class="font-semibold text-foreground truncate mb-1">{{ download.title }}</h4>

      <div class="flex items-center justify-between">
        <p class="text-xs text-muted-foreground">PumpFun Stream</p>

        <p class="text-xs text-purple-400 font-medium">{{ Math.round(download.progress.progress) }}%</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { ActiveDownload } from '@/composables/useDownloads';
  import { Loader2, DownloadCloud } from 'lucide-vue-next';

  interface Props {
    download: ActiveDownload;
  }

  defineProps<Props>();

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

<style scoped>
  /* Loading indicator animation */
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>
