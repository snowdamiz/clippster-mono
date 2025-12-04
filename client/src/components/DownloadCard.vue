<template>
  <div
    class="group relative bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20 cursor-default"
  >
    <!-- Thumbnail background/placeholder -->
    <div class="aspect-video bg-muted/20 relative">
      <!-- Background for processing/queued states -->
      <div class="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-black/40"></div>

      <!-- Content overlay -->
      <div class="relative z-10 h-full flex flex-col items-center justify-center p-4">
        <!-- Cancel Button -->
        <button
          @click.stop="handleCancel"
          class="absolute top-2 right-2 p-1.5 rounded-full bg-black/40 text-white/70 hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 backdrop-blur-sm z-50"
          title="Cancel Download (Shift+Click to cancel all segments)"
        >
          <X class="h-4 w-4" />
        </button>

        <!-- Loading/Queued State -->
        <div class="flex flex-col items-center gap-3 -mt-5">
          <div v-if="download.isQueued" class="flex flex-col items-center gap-2">
            <div class="h-8 w-8 rounded-full border-2 border-dashed border-muted-foreground/50"></div>
            <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Queued</span>
          </div>
          <div v-else class="flex flex-col items-center gap-3">
            <Loader2 class="animate-spin h-8 w-8 text-purple-500" />
            <span
              v-if="download.progress.current_time && download.progress.total_time"
              class="text-xs text-white/70 font-mono"
            >
              {{ formatDuration(download.progress.current_time) }} / {{ formatDuration(download.progress.total_time) }}
            </span>
          </div>
        </div>
      </div>

      <!-- Progress bar at bottom -->
      <div v-if="!download.isQueued" class="absolute bottom-0 left-0 right-0 h-1 bg-white/10 z-50">
        <div
          class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-300 ease-out"
          :style="{ width: `${download.progress.progress}%` }"
        ></div>
      </div>
    </div>

    <!-- Info Section (Matching Project/Vod Card Style) -->
    <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
      <h4 class="text-sm font-semibold text-white truncate mb-1" :title="download.title">{{ download.title }}</h4>
      <div class="flex items-center justify-between text-xs">
        <span class="text-white/70">
          {{ download.isQueued ? 'Waiting...' : 'Downloading...' }}
        </span>
        <span class="font-medium" :class="download.isQueued ? 'text-muted-foreground' : 'text-purple-400'">
          {{ Math.round(download.progress.progress) }}%
        </span>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :show="showConfirm"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-text="Yes, Cancel"
      suffix=""
      @close="showConfirm = false"
      @confirm="confirmAction"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useDownloads, type ActiveDownload } from '@/composables/useDownloads';
  import { Loader2, X } from 'lucide-vue-next';
  import ConfirmationModal from './ConfirmationModal.vue';

  const { cancelDownload, cancelGroup } = useDownloads();

  interface Props {
    download: ActiveDownload;
  }

  const props = defineProps<Props>();

  // Confirmation state
  const showConfirm = ref(false);
  const confirmTitle = ref('');
  const confirmMessage = ref('');
  const pendingAction = ref<(() => Promise<void | boolean>) | null>(null);

  async function handleCancel(event: MouseEvent) {
    if (props.download.groupId) {
      // Check if Shift is held to cancel ALL segments
      if (event.shiftKey) {
        confirmTitle.value = 'Cancel Download Series';
        confirmMessage.value = `This download is part of a series (Segment ${
          props.download.segmentNumber || '?'
        }). Cancel ALL segments in this group?`;
        pendingAction.value = async () => await cancelGroup(props.download.groupId!);
      } else {
        // Default: Cancel ONLY this segment
        confirmTitle.value = 'Cancel Segment';
        confirmMessage.value = `Are you sure you want to cancel just this segment ("${props.download.title}")? The other segments in the queue will continue processing.`;
        pendingAction.value = async () => await cancelDownload(props.download.id);
      }
    } else {
      confirmTitle.value = 'Cancel Download';
      confirmMessage.value = `Are you sure you want to cancel "${props.download.title}"?`;
      pendingAction.value = async () => await cancelDownload(props.download.id);
    }
    showConfirm.value = true;
  }

  async function confirmAction() {
    if (pendingAction.value) {
      await pendingAction.value();
    }
    showConfirm.value = false;
    pendingAction.value = null;
  }

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
