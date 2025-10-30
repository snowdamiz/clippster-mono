<template>
  <div class="videos-page">
    <PageLayout
      title="Raw Videos"
      description="Browse and manage your raw video files"
      :show-header="!loading && videos.length > 0"
      icon="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
    >
    <template #actions>
      <div class="flex items-center gap-2">
        <button
          @click="openVideosFolder"
          title="Open videos folder"
          class="p-3 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
        </button>
        <button
          @click="handleUpload"
          :disabled="uploading"
          class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {{ uploading ? 'Uploading...' : 'Upload Video' }}
        </button>
      </div>
    </template>

    <!-- Loading State -->
    <LoadingState v-if="loading" message="Loading videos..." />

    <!-- Content when not loading -->
    <div v-else>
        <!-- Header with stats -->
        <div v-if="videos.length > 0 || uploading || activeDownloads.length > 0" class="flex items-center justify-between mb-4">
          <p class="text-sm text-muted-foreground">
            <span v-if="activeDownloads.length > 0">
              {{ activeDownloads.length }} download{{ activeDownloads.length !== 1 ? 's' : '' }} in progress
              <span v-if="videos.length > 0">• {{ videos.length }} video{{ videos.length !== 1 ? 's' : '' }}</span>
            </span>
            <span v-else-if="videos.length > 0">
              {{ videos.length }} video{{ videos.length !== 1 ? 's' : '' }}
            </span>
          </p>
        </div>

        <!-- Videos Grid -->
        <div v-if="videos.length > 0 || uploading || activeDownloads.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      <!-- Skeleton loader card for uploading -->
      <div v-if="uploading" class="relative bg-card border border-border rounded-lg overflow-hidden animate-pulse">
        <!-- Thumbnail skeleton -->
        <div class="aspect-video bg-muted/50 relative">
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="flex flex-col items-center gap-3">
              <svg class="animate-spin h-8 w-8 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span class="text-sm text-muted-foreground">Uploading...</span>
            </div>
          </div>
        </div>
        <!-- Info skeleton -->
        <div class="p-4">
          <div class="h-5 bg-muted/50 rounded mb-2 w-3/4"></div>
          <div class="h-3 bg-muted/50 rounded mb-2 w-1/2"></div>
          <div class="h-3 bg-muted/50 rounded w-2/3"></div>
        </div>
      </div>

      <!-- Active download cards -->
      <DownloadCard
        v-for="download in activeDownloads"
        :key="download.id"
        :download="download"
      />

      <!-- Existing video cards -->
      <VideoCard
        v-for="video in paginatedVideos"
        :key="video.id"
        :video="video"
        :thumbnail-url="getThumbnailUrl(video)"
        @play="playVideo(video)"
        @delete="confirmDelete(video)"
      />
    </div>

  
        <!-- Empty State -->
        <EmptyState
          v-if="videos.length === 0 && !uploading && activeDownloads.length === 0"
          title="No videos yet"
          description="Upload your first raw video or download directly from Pump.fun to get started"
          button-text="Upload Video"
          @action="handleUpload"
        >
      <template #icon>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-16 w-16 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
      </template>
    </EmptyState>
      </div> <!-- Close content when not loading -->
  </PageLayout>

  <!-- Video Player Dialog -->
  <VideoPlayerDialog
    :video="videoToPlay"
    :show-video-player="showVideoPlayer"
    @close="showVideoPlayer = false"
  />

    <!-- Delete Confirmation Modal -->
  <DeleteConfirmationModal
    :show="showDeleteDialog"
    title="Delete Video"
    :item-name="videoToDelete?.original_filename || videoToDelete?.file_path.split(/[\\\/]/).pop()"
    confirm-text="Delete"
    @close="showDeleteDialog = false"
    @confirm="deleteVideoConfirmed"
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
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { getAllRawVideos, getDatabase, type RawVideo } from '@/services/database'
import { useToast } from '@/composables/useToast'
import { useDownloads } from '@/composables/useDownloads'
import { useVideoOperations } from '@/composables/useVideoOperations'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { getStoragePath } from '@/services/storage'
import PageLayout from '@/components/PageLayout.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import VideoPlayerDialog from '@/components/VideoPlayerDialog.vue'
import DeleteConfirmationModal from '@/components/DeleteConfirmationModal.vue'
import VideoCard from '@/components/VideoCard.vue'
import DownloadCard from '@/components/DownloadCard.vue'
import PaginationFooter from '@/components/PaginationFooter.vue'

const videos = ref<RawVideo[]>([])
const loading = ref(true)
const showDeleteDialog = ref(false)
const videoToDelete = ref<RawVideo | null>(null)
const showVideoPlayer = ref(false)
const videoToPlay = ref<RawVideo | null>(null)
const thumbnailCache = ref<Map<string, string>>(new Map())
const { success, error } = useToast()

// Video operations composable
const { uploading, uploadVideo, deleteVideo, loadVideoThumbnail } = useVideoOperations()

// Pagination state
const currentPage = ref(1)
const videosPerPage = 20

// Downloads setup
const {
  initialize: initializeDownloads,
  getActiveDownloads,
  cleanupOldDownloads,
  getAllDownloads,
  onDownloadComplete
} = useDownloads()

const activeDownloads = computed(() => getActiveDownloads())

// Pagination computed properties
const totalPages = computed(() => Math.ceil(videos.value.length / videosPerPage))
const paginatedVideos = computed(() => {
  const startIndex = (currentPage.value - 1) * videosPerPage
  const endIndex = startIndex + videosPerPage
  const paginated = videos.value.slice(startIndex, endIndex)
  console.log(`[Videos] Page ${currentPage.value}: Showing ${paginated.length} of ${videos.value.length} videos`)
  return paginated
})

// Pagination functions
function goToPage(page: number) {
  if (page >= 1 && page <= totalPages.value) {
    currentPage.value = page
  }
}

function nextPage() {
  if (currentPage.value < totalPages.value) {
    currentPage.value++
  }
}

function previousPage() {
  if (currentPage.value > 1) {
    currentPage.value--
  }
}

// Reset to first page when videos change
watch(videos, () => {
  currentPage.value = 1
})

let cleanupInterval: ReturnType<typeof setInterval> | null = null
let unregisterDownloadCallback: (() => void) | null = null

async function loadVideos() {
  loading.value = true
  try {
    videos.value = await getAllRawVideos()
    console.log(`[Videos] Loaded ${videos.value.length} videos`)

    // Debug: Check database directly
    const db = await getDatabase()
    try {
      const allTables = await db.select<any[]>("SELECT name FROM sqlite_master WHERE type='table'")
      console.log(`[Videos] Database tables:`, allTables.map(t => t.name))

      const rawVideosCount = await db.select<any[]>("SELECT COUNT(*) as count FROM raw_videos")
      console.log(`[Videos] Raw videos count:`, rawVideosCount[0].count)

      if (rawVideosCount[0].count > 0) {
        const sampleVideos = await db.select<any[]>("SELECT id, file_path, project_id, original_filename FROM raw_videos LIMIT 5")
        console.log(`[Videos] Sample videos:`, sampleVideos)
      }
    } catch (dbError) {
      console.error('[Videos] Database debug error:', dbError)
    }

    // Reset pagination to first page when loading new videos
    currentPage.value = 1
    // Load thumbnails
    for (const video of videos.value) {
      await loadVideoThumbnail(video, thumbnailCache.value)
    }
  } catch (error) {
    console.error('Failed to load videos:', error)
  } finally {
    loading.value = false
  }
}

// Handle download completion - immediately refresh the videos list
function handleDownloadComplete(download: any) {
  console.log('[Videos] Download completed:', download.title)

  // Immediately refresh the videos list to show the newly completed download
  loadVideos()

  // Show a success notification if available
  if (download.result?.success && download.rawVideoId) {
    success('Download Complete', `"${download.title}" has been downloaded and added to your videos`)
  }
}

function getThumbnailUrl(video: RawVideo): string | null {
  return thumbnailCache.value.get(video.id) || null
}

async function handleUpload() {
  const result = await uploadVideo()
  if (result.success) {
    // Reload videos list
    await loadVideos()
  }
}

async function playVideo(video: RawVideo) {
  try {
    videoToPlay.value = video
    showVideoPlayer.value = true
  } catch (err) {
    console.error('Failed to prepare video:', err)
  }
}

function confirmDelete(video: RawVideo) {
  videoToDelete.value = video
  showDeleteDialog.value = true
}

async function deleteVideoConfirmed() {
  if (!videoToDelete.value) return

  const result = await deleteVideo(videoToDelete.value)

  if (result.success) {
    // Remove from thumbnail cache if exists
    if (videoToDelete.value.id && thumbnailCache.value.has(videoToDelete.value.id)) {
      thumbnailCache.value.delete(videoToDelete.value.id)
    }

    await loadVideos()
  }

  showDeleteDialog.value = false
  videoToDelete.value = null
}

async function openVideosFolder() {
  try {
    const videosPath = await getStoragePath('videos')
    // Use the first video file if available, otherwise use a dummy path
    if (videos.value.length > 0) {
      // Reveal the first video file, which will open the videos folder
      await revealItemInDir(videos.value[0].file_path)
    } else {
      // If no videos, append a dummy filename to open the videos folder
      // The file doesn't need to exist, revealItemInDir will still open the parent folder
      await revealItemInDir(videosPath + '\\dummy.mp4')
    }
  } catch (err) {
    console.error('Failed to open videos folder:', err)
    error('Failed to open folder', 'Unable to open the videos folder')
  }
}

onMounted(async () => {
  // Initialize downloads system
  await initializeDownloads()

  // Register for download completion events for immediate updates
  unregisterDownloadCallback = onDownloadComplete(handleDownloadComplete)

  // Check for any completed downloads that might have been missed
  // This handles cases where the user navigates to the page after downloads completed
  const allDownloads = getAllDownloads()
  const completedDownloads = allDownloads.filter(d =>
    d.result?.success && d.rawVideoId
  )

  // Load videos (will show existing videos + any recently completed downloads)
  await loadVideos()

  // If there were completed downloads that might not be in the videos list yet,
  // we'll handle it through the normal loadVideos() process
  console.log(`[Videos] Found ${completedDownloads.length} completed downloads on mount`)

  // Set up periodic cleanup (no longer need to check for completed downloads)
  cleanupInterval = setInterval(() => {
    cleanupOldDownloads()
  }, 2000) // Cleanup every 2 seconds
})

onUnmounted(() => {
  if (cleanupInterval) {
    clearInterval(cleanupInterval)
  }
  if (unregisterDownloadCallback) {
    unregisterDownloadCallback()
  }
})
</script>

<style scoped>
/* Root wrapper to ensure single root element for Transition */
.videos-page {
  position: relative;
  width: 100%;
  min-height: 100%;
}
</style>
