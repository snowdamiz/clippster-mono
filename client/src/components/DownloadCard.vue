<template>
  <div
    class="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-line-subtle bg-surface transition-colors hover:border-line-strong"
  >
    <!-- Media well -->
    <div class="relative grid aspect-video w-full place-items-center border-b border-line-subtle bg-surface-sunken">
      <div class="flex flex-col items-center gap-2">
        <span v-if="download.isQueued" class="size-8 rounded-full border-2 border-dashed border-line-strong" />
        <Loader2 v-else class="size-7 animate-spin text-brand" />
        <span
          v-if="!download.isQueued && download.progress.current_time && download.progress.total_time"
          class="tabular font-mono text-2xs text-fg-subtle"
        >
          {{ formatDuration(download.progress.current_time) }} / {{ formatDuration(download.progress.total_time) }}
        </span>
      </div>

      <!-- Status -->
      <Badge :variant="download.isQueued ? 'neutral' : 'brand'" class="absolute left-2 top-2">
        <Clock v-if="download.isQueued" />
        <Loader2 v-else class="animate-spin" />
        {{ download.isQueued ? 'Queued' : 'Downloading' }}
      </Badge>

      <!-- Cancel -->
      <button
        type="button"
        class="absolute right-2 top-2 grid size-[var(--control-sm)] place-items-center rounded-[var(--radius-control)] bg-black/60 text-white/80 opacity-0 backdrop-blur-sm transition hover:bg-danger-solid hover:text-white focus-visible:opacity-100 focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none group-hover:opacity-100"
        title="Cancel download (Shift+click to cancel all segments)"
        aria-label="Cancel download"
        @click.stop="handleCancel"
      >
        <X class="size-3.5" />
      </button>

      <!-- Progress -->
      <div v-if="!download.isQueued" class="absolute inset-x-0 bottom-0 h-[3px] bg-surface-active">
        <div
          class="h-full bg-brand transition-[width] duration-300 ease-out"
          :style="{ width: `${download.progress.progress}%` }"
        />
      </div>
    </div>

    <!-- Info -->
    <div class="flex min-w-0 flex-col gap-1 px-3 pb-2.5 pt-2" :class="{ 'opacity-70': download.isQueued }">
      <h3 class="truncate text-sm font-medium text-fg" :title="download.title">{{ download.title }}</h3>
      <div class="flex h-[18px] items-center gap-1.5 text-xs text-fg-muted">
        <span class="whitespace-nowrap">{{ download.isQueued ? 'Waiting…' : 'Downloading…' }}</span>
        <span class="size-[3px] shrink-0 rounded-full bg-fg-subtle" />
        <span class="tabular font-medium" :class="download.isQueued ? 'text-fg-muted' : 'text-brand'">
          {{ Math.round(download.progress.progress) }}%
        </span>
      </div>
    </div>

    <!-- Confirmation Modal -->
    <ConfirmationModal
      :show="showConfirm"
      :title="confirmTitle"
      :message="confirmMessage"
      confirm-text="Yes, cancel"
      close-text="Keep downloading"
      suffix=""
      :show-cannot-undone-text="false"
      @close="showConfirm = false"
      @confirm="confirmAction"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref } from 'vue';
  import { useCreatorDownloadRuntime } from '@/services/creatorDownloadRuntime';
  import { Loader2, X, Clock } from 'lucide-vue-next';
  import ConfirmationModal from './ConfirmationModal.vue';
  import { Badge } from '@/components/ui/badge';

  const { cancelDownload, cancelGroup } = useCreatorDownloadRuntime();

  interface Props {
    download: {
      id: string;
      title: string;
      message?: string;
      groupId?: string;
      segmentNumber?: number;
      isQueued?: boolean;
      progress: { progress: number; download_id?: string; current_time?: number; total_time?: number; status?: string };
    };
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
        confirmTitle.value = 'Cancel download series';
        confirmMessage.value = `This download is part of a series (Segment ${
          props.download.segmentNumber || '?'
        }). Cancel ALL segments in this group?`;
        pendingAction.value = async () => await cancelGroup(props.download.groupId!);
      } else {
        // Default: Cancel ONLY this segment
        confirmTitle.value = 'Cancel segment';
        confirmMessage.value = `Are you sure you want to cancel just this segment ("${props.download.title}")? The other segments in the queue will continue processing.`;
        pendingAction.value = async () => await cancelDownload(props.download.id);
      }
    } else {
      confirmTitle.value = 'Cancel download';
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
