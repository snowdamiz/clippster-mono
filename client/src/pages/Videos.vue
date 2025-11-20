<template>
  <div class="videos-page">
    <PageLayout
      title="Raw Videos"
      description="Browse and manage your raw video files"
      :show-header="videos.length > 0"
      :icon="Video"
    >
      <template #actions>
        <div class="flex items-center gap-2">
          <button
            @click="openVideosFolder"
            title="Open videos folder"
            class="p-3 bg-muted hover:bg-muted/80 text-foreground rounded-md transition-all"
          >
            <Folder class="h-5 w-5" />
          </button>
          <button
            @click="handleUpload"
            :disabled="uploading"
            class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload class="h-5 w-5" />
            {{ uploading ? 'Uploading...' : 'Upload Video' }}
          </button>
        </div>
      </template>
      <!-- Loading State -->
      <div v-if="loading" class="space-y-6">
        <SkeletonGrid />
      </div>
      <!-- Content when not loading -->

      <div v-else>
        <!-- Header with stats -->
        <div
          v-if="videos.length > 0 || uploading || activeDownloads.length > 0"
          class="flex items-center justify-between mb-4"
        >
          <p class="text-sm text-muted-foreground">
            <span v-if="activeDownloads.length > 0 || queuedDownloads.length > 0">
              <span v-if="activeDownloads.length > 0">
                {{ activeDownloads.length }} download{{ activeDownloads.length !== 1 ? 's' : '' }} in progress (max 1)
              </span>
              <span v-if="activeDownloads.length > 0 && queuedDownloads.length > 0">•</span>
              <span v-if="queuedDownloads.length > 0">{{ queuedDownloads.length }} queued</span>
              <span v-if="videos.length > 0">• {{ videos.length }} video{{ videos.length !== 1 ? 's' : '' }}</span>
            </span>
            <span v-else-if="videos.length > 0">{{ videos.length }} video{{ videos.length !== 1 ? 's' : '' }}</span>
          </p>
        </div>
        <!-- Videos Grid -->
        <div
          v-if="videos.length > 0 || uploading || activeDownloads.length > 0 || queuedDownloads.length > 0"
          class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          <!-- Skeleton loader card for uploading -->
          <div
            v-if="uploading"
            class="relative bg-card border border-border rounded-md overflow-hidden aspect-video animate-pulse"
          >
            <!-- Thumbnail skeleton -->
            <div class="absolute inset-0 bg-muted/50 flex items-center justify-center">
              <div class="flex flex-col items-center gap-3">
                <Loader2 class="animate-spin h-8 w-8 text-muted-foreground" />
                <span class="text-sm text-muted-foreground">Uploading...</span>
              </div>
            </div>
          </div>
          <!-- Active download cards -->
          <div
            v-for="download in activeDownloads"
            :key="download.id"
            class="relative bg-card border border-border rounded-md overflow-hidden hover:border-foreground/20 group aspect-video"
          >
            <!-- Thumbnail background with vignette -->
            <div
              v-if="download.result?.thumbnail_path"
              class="absolute inset-0 z-0"
              :style="{
                backgroundImage: `url(${download.result.thumbnail_path})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }"
            >
              <!-- Dark vignette overlay -->
              <div class="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/90"></div>
            </div>

            <!-- Download progress overlay -->
            <div class="absolute inset-0 bg-black/60 z-10 flex items-center justify-center">
              <div class="text-center text-white p-4 w-full max-w-sm">
                <!-- Download icon -->
                <div
                  class="inline-flex items-center justify-center w-12 h-12 mb-3 bg-white/10 rounded-full backdrop-blur-sm"
                >
                  <Download class="h-6 w-6" />
                </div>

                <!-- Title -->
                <h3 class="font-semibold text-base mb-3 line-clamp-2 px-2">
                  {{ download.title }}
                </h3>

                <!-- Progress percentage -->
                <div class="text-lg font-semibold mb-2">{{ Math.round(download.progress?.progress || 0) }}%</div>

                <!-- Progress bar -->
                <div class="w-[200px] mx-auto mb-3">
                  <div class="bg-white/20 rounded-full h-2 overflow-hidden">
                    <div
                      class="bg-white h-2 rounded-full transition-all duration-300 ease-out"
                      :style="{ width: `${download.progress?.progress || 0}%` }"
                    ></div>
                  </div>
                </div>

                <!-- Time/Status info -->
                <div class="text-xs text-white/80">
                  <span v-if="download.progress?.current_time && download.progress?.total_time">
                    {{ formatDuration(download.progress.current_time) }} /
                    {{ formatDuration(download.progress.total_time) }}
                  </span>
                  <span v-else-if="download.result?.file_size">
                    {{ formatFileSize(download.result.file_size) }}
                  </span>
                  <span v-else>
                    {{ download.progress?.status || 'Downloading...' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Cancel button overlay -->
            <div class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                @click.stop="handleCancelDownload(download.id, download.title)"
                class="p-2 bg-red-500/90 hover:bg-red-500 text-white rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Cancel Download"
              >
                <X class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- Queued download cards -->
          <div
            v-for="download in queuedDownloads"
            :key="download.id"
            class="relative bg-card border border-border rounded-md overflow-hidden hover:border-foreground/20 group aspect-video opacity-70"
          >
            <!-- Queued overlay -->
            <div class="absolute inset-0 bg-black/40 z-10 flex items-center justify-center">
              <div class="text-center text-white p-4">
                <!-- Clock icon -->
                <div
                  class="inline-flex items-center justify-center w-12 h-12 mb-3 bg-white/10 rounded-full backdrop-blur-sm"
                >
                  <Clock class="h-6 w-6" />
                </div>

                <!-- Title -->
                <h3 class="font-semibold text-base mb-2 line-clamp-2 px-2">
                  {{ download.title }}
                </h3>

                <!-- Status -->
                <div class="text-sm mb-1">Queued</div>
                <div class="text-xs text-white/70">Waiting to download...</div>
              </div>
            </div>

            <!-- Cancel button overlay -->
            <div class="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              <button
                @click.stop="handleCancelDownload(download.id, download.title)"
                class="p-2 bg-red-500/90 hover:bg-red-500 text-white rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Cancel Download"
              >
                <X class="h-4 w-4" />
              </button>
            </div>
          </div>
          <!-- Existing video cards -->
          <div
            v-for="video in paginatedVideos"
            :key="video.id"
            class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
            @click="playVideo(video)"
          >
            <!-- Thumbnail background with vignette -->
            <div
              v-if="getThumbnailUrl(video)"
              class="absolute inset-0 z-0"
              :style="{
                backgroundImage: `url(${getThumbnailUrl(video)})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
              }"
            >
              <!-- Dark vignette overlay -->
              <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/20 to-black/60"></div>
            </div>
            <!-- Top left project badge -->
            <div v-if="video.project_id" class="absolute top-4 left-4 z-5">
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md flex items-center gap-1',
                  getThumbnailUrl(video)
                    ? 'text-white/70 bg-white/10 backdrop-blur-sm'
                    : 'text-muted-foreground bg-muted',
                ]"
              >
                <Folder class="h-3 w-3" />
                In Project
              </span>
            </div>
            <!-- Top right video duration -->
            <div class="absolute top-4 right-4 z-5">
              <span
                :class="[
                  'text-xs px-2 py-1 rounded-md',
                  getThumbnailUrl(video)
                    ? 'text-white/70 bg-white/10 backdrop-blur-sm'
                    : 'text-muted-foreground bg-muted',
                ]"
              >
                {{ formatDuration(video.duration || undefined) }}
              </span>
            </div>
            <!-- Bottom left title and description -->
            <div class="absolute bottom-2 left-2 right-2 z-5 bg-black/40 backdrop-blur-sm p-2 rounded-md">
              <h3
                :class="[
                  'text-md font-semibold mb-1 group-hover:transition-colors line-clamp-2',
                  getThumbnailUrl(video)
                    ? 'text-white group-hover:text-white/80'
                    : 'text-foreground group-hover:text-foreground/80',
                ]"
              >
                {{ video.original_filename }}
              </h3>

              <p :class="['text-xs line-clamp-2', getThumbnailUrl(video) ? 'text-white/80' : 'text-muted-foreground']">
                {{ formatRelativeTime(video.created_at) }}
              </p>
            </div>
            <!-- Hover Overlay Buttons -->
            <div
              class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-4"
            >
              <button
                class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Play"
                @click.stop="playVideo(video)"
              >
                <Play class="h-6 w-6" />
              </button>
              <button
                class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                title="Delete"
                @click.stop="confirmDelete(video)"
              >
                <Trash2 class="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>
        <!-- Empty State -->
        <EmptyState
          v-if="videos.length === 0 && !uploading && activeDownloads.length === 0 && queuedDownloads.length === 0"
          title="No videos yet"
          description="Upload your first raw video or download directly from Pump.fun to get started"
          button-text="Upload Video"
          @action="handleUpload"
        >
          <template #icon>
            <Video class="h-16 w-16 text-muted-foreground" />
          </template>
        </EmptyState>
      </div>
      <!-- Close content when not loading -->
    </PageLayout>
    <!-- Video Player Dialog -->
    <VideoPlayerDialog :video="videoToPlay" :show-video-player="showVideoPlayer" @close="handleVideoPlayerClose" />
    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      :title="videoHasClips ? 'Delete Video with Referenced Clips' : 'Delete Video'"
      :message="
        videoHasClips
          ? 'This video has detected clips that reference it. The video file will be deleted, but all detected clips will remain in your projects. Are you sure you want to delete'
          : 'Are you sure you want to delete'
      "
      :item-name="videoToDelete?.original_filename || videoToDelete?.file_path.split(/[\\\/]/).pop()"
      suffix="?"
      confirm-text="Delete"
      @close="handleDeleteDialogClose"
      @confirm="deleteVideoConfirmed"
    />
    <!-- Cancel Download Confirmation Modal -->
    <ConfirmationModal
      :show="showCancelDownloadDialog"
      title="Cancel Download"
      message="Are you sure you want to cancel the download"
      :item-name="downloadToCancel?.title"
      suffix="?"
      confirm-text="Cancel Download"
      :show-cannot-undone-text="false"
      @close="handleCancelDownloadDialogClose"
      @confirm="confirmCancelDownload"
    />
    <!-- Pagination Footer -->
    <PaginationFooter
      v-if="!loading && videos.length > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="videos.length"
      item-label="video"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
  import { Video, Folder, Upload, Loader2, Download, X, Clock, Play, Trash2 } from 'lucide-vue-next';
  import {
    getAllRawVideos,
    hasClipsReferencingRawVideo,
    getProject,
    type RawVideo,
    type Project,
  } from '@/services/database';
  import { useToast } from '@/composables/useToast';
  import { useDownloads } from '@/composables/useDownloads';
  import { useVideoOperations } from '@/composables/useVideoOperations';
  import { revealItemInDir } from '@tauri-apps/plugin-opener';
  import { getStoragePath } from '@/services/storage';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';
  import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';

  const videos = ref<RawVideo[]>([]);
  const loading = ref(true);
  const showDeleteDialog = ref(false);
  const videoToDelete = ref<RawVideo | null>(null);
  const videoHasClips = ref(false); // True if clips reference this video
  const showVideoPlayer = ref(false);
  const videoToPlay = ref<RawVideo | null>(null);
  const showCancelDownloadDialog = ref(false);
  const downloadToCancel = ref<{ id: string; title: string } | null>(null);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const projectCache = ref<Map<string, Project>>(new Map());
  const { success, error } = useToast();

  // Video operations composable
  const { uploading, uploadVideo, deleteVideo, loadVideoThumbnail } = useVideoOperations();

  // Pagination state
  const currentPage = ref(1);
  const videosPerPage = 20;

  // Downloads setup
  const {
    initialize: initializeDownloads,
    getActiveDownloads,
    getQueuedDownloads,
    cancelDownload,
    cleanupOldDownloads,
    onDownloadComplete,
  } = useDownloads();

  const activeDownloads = computed(() => getActiveDownloads());
  const queuedDownloads = computed(() => getQueuedDownloads());

  // Format file size utility
  function formatFileSize(bytes?: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Format relative time for video dates
  function formatRelativeTime(timestamp?: string | Date | number): string {
    if (!timestamp) return 'Added recently';

    // Handle different timestamp formats
    let date: Date;

    try {
      if (typeof timestamp === 'string') {
        // Handle ISO format or other string formats
        date = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        // Handle Unix timestamp (could be seconds or milliseconds)
        // If the number is very small, it's likely seconds, not milliseconds
        date = new Date(timestamp < 10000000000 ? timestamp * 1000 : timestamp);
      } else if (timestamp instanceof Date) {
        date = timestamp;
      } else {
        return 'Added recently';
      }

      // Check if date is valid
      if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
        return 'Added recently';
      }
    } catch (error) {
      return 'Added recently';
    }

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle negative differences (future dates)
    if (diffMs < 0) {
      return 'Added recently';
    }

    const secondsAgo = Math.floor(diffMs / 1000);
    const minutesAgo = Math.floor(secondsAgo / 60);
    const hoursAgo = Math.floor(minutesAgo / 60);
    const daysAgo = Math.floor(hoursAgo / 24);

    if (secondsAgo < 60) return 'Added just now';
    if (minutesAgo < 60) return `Added ${minutesAgo} minute${minutesAgo !== 1 ? 's' : ''} ago`;
    if (hoursAgo < 24) return `Added ${hoursAgo} hour${hoursAgo !== 1 ? 's' : ''} ago`;
    if (daysAgo < 7) return `Added ${daysAgo} day${daysAgo !== 1 ? 's' : ''} ago`;

    // For dates older than a week, show the actual date
    const weeksAgo = Math.floor(daysAgo / 7);
    if (weeksAgo < 4) {
      return `Added ${weeksAgo} week${weeksAgo !== 1 ? 's' : ''} ago`;
    }

    // For very old dates, show formatted date
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    };
    return `Added ${date.toLocaleDateString('en-US', options)}`;
  }

  // Format video duration
  function formatDuration(seconds?: number): string {
    if (!seconds) return 'Unknown';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  // Pagination computed properties
  const totalPages = computed(() => Math.ceil(videos.value.length / videosPerPage));
  const paginatedVideos = computed(() => {
    const startIndex = (currentPage.value - 1) * videosPerPage;
    const endIndex = startIndex + videosPerPage;
    const paginated = videos.value.slice(startIndex, endIndex);
    return paginated;
  });

  // Pagination functions
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  }

  function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  }

  function previousPage() {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  }

  // Reset to first page when videos change
  watch(videos, () => {
    currentPage.value = 1;
  });

  let cleanupInterval: ReturnType<typeof setInterval> | null = null;
  let unregisterDownloadCallback: (() => void) | null = null;

  async function loadVideos() {
    loading.value = true;
    try {
      videos.value = await getAllRawVideos();

      // Reset pagination to first page when loading new videos
      currentPage.value = 1;
      // Load thumbnails and project info
      for (const video of videos.value) {
        await loadVideoThumbnail(video, thumbnailCache.value);

        // Load project info if video has a project
        if (video.project_id) {
          await getProjectInfo(video.project_id);
        }
      }
    } catch (error) {
      console.error('Failed to load videos:', error);
    } finally {
      loading.value = false;
    }
  }

  // Handle download completion - immediately refresh the videos list
  function handleDownloadComplete(download: any) {
    // Immediately refresh the videos list to show the newly completed download
    loadVideos();

    // Handle download result
    if (download.result?.success && download.rawVideoId) {
      // Success case
      success('Download Complete', `"${download.title}" has been downloaded and added to your videos`);
    } else if (download.result?.success === false) {
      // Failure case - show error notification with details
      const errorMessage = download.result?.error || 'Unknown download error';
      error(
        'Download Failed',
        `"${download.title}" failed: ${errorMessage}. The corrupted files have been cleaned up.`
      );
    }
    // If download.result is undefined or success is not explicitly true/false,
    // it might be a download in progress - do nothing
  }

  function getThumbnailUrl(video: RawVideo): string | null {
    const cachedUrl = thumbnailCache.value.get(video.id);
    if (cachedUrl) {
      return cachedUrl;
    }

    // If no cached thumbnail, return error SVG as fallback
    return '/download_error.svg';
  }

  async function getProjectInfo(projectId: string): Promise<Project | null> {
    // Check cache first
    if (projectCache.value.has(projectId)) {
      return projectCache.value.get(projectId) || null;
    }

    try {
      const project = await getProject(projectId);
      if (project) {
        projectCache.value.set(projectId, project);
      }
      return project;
    } catch (error) {
      return null;
    }
  }

  async function handleUpload() {
    const result = await uploadVideo();
    if (result.success) {
      // Reload videos list
      await loadVideos();
    }
  }

  async function playVideo(video: RawVideo) {
    try {
      // Create a fresh copy of the video object to ensure reactivity
      // This helps when reopening the same video
      videoToPlay.value = { ...video };
      showVideoPlayer.value = true;
    } catch (err) {
      console.error('Failed to prepare video:', err);
    }
  }

  function handleVideoPlayerClose() {
    showVideoPlayer.value = false;
    // Clear the video reference to ensure proper reload when reopening
    setTimeout(() => {
      videoToPlay.value = null;
    }, 100);
  }

  async function confirmDelete(video: RawVideo) {
    videoToDelete.value = video;

    // Check if video has clips
    try {
      videoHasClips.value = await hasClipsReferencingRawVideo(video.id);
      showDeleteDialog.value = true;
    } catch (err) {
      // If we can't check, proceed with normal deletion
      videoHasClips.value = false;
      showDeleteDialog.value = true;
    }
  }

  function handleDeleteDialogClose() {
    showDeleteDialog.value = false;
    videoHasClips.value = false;
    videoToDelete.value = null;
  }

  async function deleteVideoConfirmed() {
    if (!videoToDelete.value) return;

    const result = await deleteVideo(videoToDelete.value);

    if (result.success) {
      // Remove from thumbnail cache if exists
      if (videoToDelete.value.id && thumbnailCache.value.has(videoToDelete.value.id)) {
        thumbnailCache.value.delete(videoToDelete.value.id);
      }

      await loadVideos();
    }

    showDeleteDialog.value = false;
    videoHasClips.value = false;
    videoToDelete.value = null;
  }

  function handleCancelDownloadDialogClose() {
    showCancelDownloadDialog.value = false;
    downloadToCancel.value = null;
  }

  async function confirmCancelDownload() {
    if (!downloadToCancel.value) return;

    // Store download info and close dialog immediately (optimistic update)
    const downloadInfo = { ...downloadToCancel.value };
    showCancelDownloadDialog.value = false;
    downloadToCancel.value = null;

    try {
      const cancelled = await cancelDownload(downloadInfo.id);
      if (cancelled) {
        success('Download Cancelled', `"${downloadInfo.title}" has been cancelled.`);
      } else {
        error('Failed to Cancel', 'Unable to cancel the download. It may have already completed.');
      }
    } catch (err) {
      error('Cancel Failed', `Failed to cancel download: ${err}`);
    }
  }

  async function openVideosFolder() {
    try {
      const videosPath = await getStoragePath('videos');
      // Use the first video file if available, otherwise use a dummy path
      if (videos.value.length > 0) {
        // Reveal the first video file, which will open the videos folder
        await revealItemInDir(videos.value[0].file_path);
      } else {
        // If no videos, append a dummy filename to open the videos folder
        // The file doesn't need to exist, revealItemInDir will still open the parent folder
        await revealItemInDir(videosPath + '\\dummy.mp4');
      }
    } catch (err) {
      error('Failed to open folder', 'Unable to open the videos folder');
    }
  }

  function handleCancelDownload(downloadId: string, downloadTitle: string) {
    downloadToCancel.value = { id: downloadId, title: downloadTitle };
    showCancelDownloadDialog.value = true;
  }

  // Listen for video added events (e.g. from livestream segments)
  function handleVideoAdded(_event: CustomEvent) {
    loadVideos();
  }

  onMounted(async () => {
    // Initialize downloads system
    await initializeDownloads();

    // Register for download completion events for immediate updates
    unregisterDownloadCallback = onDownloadComplete(handleDownloadComplete);

    // Listen for video added events
    document.addEventListener('video-added', handleVideoAdded as EventListener);

    // Load videos (will show existing videos + any recently completed downloads)
    await loadVideos();

    // Set up periodic cleanup (no longer need to check for completed downloads)
    cleanupInterval = setInterval(() => {
      cleanupOldDownloads();
    }, 2000); // Cleanup every 2 seconds
  });

  onUnmounted(() => {
    if (cleanupInterval) {
      clearInterval(cleanupInterval);
    }
    if (unregisterDownloadCallback) {
      unregisterDownloadCallback();
    }
    document.removeEventListener('video-added', handleVideoAdded as EventListener);
  });
</script>

<style scoped>
  /* Root wrapper to ensure single root element for Transition */
  .videos-page {
    position: relative;
    width: 100%;
    min-height: 100%;
  }
</style>
