<template>
  <div class="download-card" :class="{ 'download-card--queued': download.isQueued }">
    <!-- Thumbnail/Background -->
    <div class="download-card__thumbnail">
      <!-- Cancel Button -->
      <button
        @click.stop="handleCancel"
        class="download-card__cancel"
        title="Cancel Download (Shift+Click to cancel all segments)"
      >
        <X class="download-card__cancel-icon" />
      </button>

      <!-- Badge -->
      <div
        class="download-card__badge"
        :class="download.isQueued ? 'download-card__badge--queued' : 'download-card__badge--downloading'"
      >
        <Clock v-if="download.isQueued" class="download-card__badge-icon" />
        <Loader2 v-else class="download-card__badge-icon download-card__badge-icon--spin" />
        <span>{{ download.isQueued ? 'Queued' : 'Downloading' }}</span>
      </div>

      <!-- Center Content -->
      <div class="download-card__center">
        <div v-if="download.isQueued" class="download-card__queued-icon">
          <div class="download-card__queued-ring"></div>
        </div>
        <div v-else class="download-card__progress-ring">
          <Loader2 class="download-card__spinner" />
        </div>
        <span
          v-if="!download.isQueued && download.progress.current_time && download.progress.total_time"
          class="download-card__time"
        >
          {{ formatDuration(download.progress.current_time) }} / {{ formatDuration(download.progress.total_time) }}
        </span>
      </div>
    </div>

    <!-- Vignette -->
    <div class="download-card__vignette"></div>

    <!-- Progress Bar -->
    <div v-if="!download.isQueued" class="download-card__progress-bar">
      <div class="download-card__progress-fill" :style="{ width: `${download.progress.progress}%` }"></div>
    </div>

    <!-- Bottom Info -->
    <div class="download-card__bottom">
      <h3 class="download-card__title" :title="download.title">{{ download.title }}</h3>
      <div class="download-card__meta">
        <span class="download-card__status">{{ download.isQueued ? 'Waiting...' : 'Downloading...' }}</span>
        <span class="download-card__dot"></span>
        <span class="download-card__percent">{{ Math.round(download.progress.progress) }}%</span>
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
  import { Loader2, X, Clock } from 'lucide-vue-next';
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
  /* ===== Download Card ===== */
  .download-card {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: default;
    transition: all 200ms ease;
    aspect-ratio: 16 / 9;
  }

  .download-card:hover {
    border-color: rgba(6, 182, 212, 0.3);
  }

  .download-card--queued {
    opacity: 0.8;
  }

  /* ===== Thumbnail/Background ===== */
  .download-card__thumbnail {
    position: absolute;
    inset: 0;
    background-color: var(--sidebar-hover);
    z-index: 0;
  }

  /* ===== Vignette ===== */
  .download-card__vignette {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0.2) 50%, transparent 100%);
    pointer-events: none;
  }

  /* ===== Cancel Button ===== */
  .download-card__cancel {
    position: absolute;
    top: 0.75rem;
    right: 0.75rem;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    background-color: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    border: none;
    border-radius: 6px;
    color: rgba(255, 255, 255, 0.6);
    cursor: pointer;
    opacity: 0;
    transition: all 150ms ease;
  }

  .download-card:hover .download-card__cancel {
    opacity: 1;
  }

  .download-card__cancel:hover {
    background-color: rgba(239, 68, 68, 0.9);
    color: white;
  }

  .download-card__cancel-icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Badge ===== */
  .download-card__badge {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.3125rem 0.5rem;
    backdrop-filter: blur(8px);
    border-radius: 5px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
  }

  .download-card__badge--downloading {
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .download-card__badge--queued {
    background-color: rgba(255, 255, 255, 0.1);
    color: rgba(255, 255, 255, 0.5);
  }

  .download-card__badge-icon {
    width: 10px;
    height: 10px;
  }

  .download-card__badge-icon--spin {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Center Content ===== */
  .download-card__center {
    position: absolute;
    inset: 0;
    z-index: 5;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
  }

  .download-card__queued-icon {
    position: relative;
    width: 44px;
    height: 44px;
  }

  .download-card__queued-ring {
    width: 100%;
    height: 100%;
    border: 2px dashed var(--sidebar-text-muted);
    border-radius: 50%;
    opacity: 0.3;
  }

  .download-card__progress-ring {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
  }

  .download-card__spinner {
    width: 32px;
    height: 32px;
    color: var(--sidebar-accent);
    animation: spin 0.8s linear infinite;
  }

  .download-card__time {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Consolas, monospace;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
    letter-spacing: 0.02em;
  }

  /* ===== Progress Bar ===== */
  .download-card__progress-bar {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 3px;
    background-color: rgba(255, 255, 255, 0.1);
    z-index: 30;
  }

  .download-card__progress-fill {
    height: 100%;
    background-color: var(--sidebar-accent);
    transition: width 300ms ease-out;
  }

  /* ===== Bottom Info ===== */
  .download-card__bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 10;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .download-card__title {
    font-size: 1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    line-height: 1.3;
  }

  .download-card__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.6);
  }

  .download-card__status {
    white-space: nowrap;
  }

  .download-card__dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.3);
    flex-shrink: 0;
  }

  .download-card__percent {
    color: var(--sidebar-accent);
    font-weight: 600;
  }

  .download-card--queued .download-card__percent {
    color: var(--sidebar-text-muted);
  }

  /* ===== Animations ===== */
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
