<template>
  <PageLayout
    title="Videos"
    description="Browse and manage your raw video files"
    :show-header="!loading && videos.length > 0"
  >
    <template #actions>
      <div class="flex items-center gap-2">
        <button
          @click="openVideosFolder"
          title="Open videos folder"
          class="p-2.5 bg-muted hover:bg-muted/80 text-foreground rounded-lg transition-all"
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

    <!-- Videos Grid -->
    <div v-else-if="videos.length > 0 || uploading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      <!-- Skeleton loader card for uploading -->
      <div v-if="uploading" class="relative bg-card border border-border rounded-xl overflow-hidden animate-pulse">
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
      
      <!-- Existing video cards -->
      <div v-for="video in videos" :key="video.id" class="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 cursor-pointer">
        <!-- Thumbnail -->
        <div class="aspect-video bg-muted/50 relative">
          <img 
            v-if="getThumbnailUrl(video)"
            :src="getThumbnailUrl(video)!"
            :alt="video.original_filename || 'Video thumbnail'"
            class="w-full h-full object-cover"
          />
          <div v-else class="absolute inset-0 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-14 w-14 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <!-- Hover Overlay -->
          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2">
            <button class="p-2.5 bg-white rounded-lg hover:bg-white/90" title="Play" @click.stop="playVideo(video)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            <button class="p-2.5 bg-white rounded-lg hover:bg-white/90" title="Process">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </button>
            <button class="p-2.5 bg-white rounded-lg hover:bg-white/90" title="Delete" @click.stop="confirmDelete(video)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
        <!-- Info -->
        <div class="p-4">
          <h4 class="font-semibold text-foreground truncate mb-1">{{ video.original_filename || video.file_path.split(/[\\\/]/).pop() || 'Untitled Video' }}</h4>
          <p class="text-xs text-muted-foreground mb-2" v-if="video.duration">Duration: {{ Math.round(video.duration) }}s</p>
          <p class="text-xs text-muted-foreground">Added {{ getRelativeTime(video.created_at) }}</p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else-if="!uploading"
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

    <!-- Video Player Dialog -->
    <Dialog v-model:open="showVideoPlayer">
      <DialogContent class="max-w-[calc(100vw-80px)] max-h-[calc(100vh-80px)] p-0">
        <div class="relative w-full h-full">
          <DialogTitle class="sr-only">
            {{ videoToPlay?.original_filename || videoToPlay?.file_path.split(/[\\\/]/).pop() || 'Video Player' }}
          </DialogTitle>
          <DialogDescription class="sr-only">
            Video player for {{ videoToPlay?.original_filename || 'selected video' }}
          </DialogDescription>
          <video
            v-if="videoSrc"
            :src="videoSrc"
            controls
            autoplay
            class="w-full h-full max-h-[calc(100vh-80px)] bg-black"
          />
        </div>
      </DialogContent>
    </Dialog>

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showDeleteDialog = false"
    >
      <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">Delete Video</h2>
        
        <div class="space-y-4">
          <p class="text-muted-foreground">
            Are you sure you want to delete "<span class="font-semibold text-foreground">{{ videoToDelete?.original_filename || videoToDelete?.file_path.split(/[\\\\/]/).pop() }}</span>"? This action cannot be undone.
          </p>

          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="deleteVideoConfirmed"
          >
            Delete
          </button>

          <button
            class="w-full py-3 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 transition-all"
            @click="showDeleteDialog = false"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAllRawVideos, createRawVideo, deleteRawVideo, type RawVideo } from '@/services/database'
import { useFormatters } from '@/composables/useFormatters'
import { useToast } from '@/composables/useToast'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { revealItemInDir } from '@tauri-apps/plugin-opener'
import { getStoragePath } from '@/services/storage'
import PageLayout from '@/components/PageLayout.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import Dialog from '@/components/ui/dialog/Dialog.vue'
import DialogContent from '@/components/ui/dialog/DialogContent.vue'
import DialogTitle from '@/components/ui/dialog/DialogTitle.vue'
import DialogDescription from '@/components/ui/dialog/DialogDescription.vue'

const videos = ref<RawVideo[]>([])
const loading = ref(true)
const uploading = ref(false)
const showDeleteDialog = ref(false)
const videoToDelete = ref<RawVideo | null>(null)
const showVideoPlayer = ref(false)
const videoToPlay = ref<RawVideo | null>(null)
const videoSrc = ref<string | null>(null)
const thumbnailCache = ref<Map<string, string>>(new Map())
const { getRelativeTime } = useFormatters()
const { success, error } = useToast()

async function loadVideos() {
  loading.value = true
  try {
    videos.value = await getAllRawVideos()
    // Load thumbnails
    for (const video of videos.value) {
      if (video.thumbnail_path && !thumbnailCache.value.has(video.id)) {
        try {
          const dataUrl = await invoke<string>('read_file_as_data_url', {
            filePath: video.thumbnail_path
          })
          thumbnailCache.value.set(video.id, dataUrl)
        } catch (error) {
          console.warn('Failed to load thumbnail for video:', video.id, error)
        }
      }
    }
  } catch (error) {
    console.error('Failed to load videos:', error)
  } finally {
    loading.value = false
  }
}

function getThumbnailUrl(video: RawVideo): string | null {
  return thumbnailCache.value.get(video.id) || null
}

async function handleUpload() {
  if (uploading.value) return
  
  try {
    // Open file dialog with video file filters
    const selected = await open({
      multiple: false,
      filters: [{
        name: 'Video',
        extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v']
      }]
    })
    
    if (!selected) return // User cancelled
    
    uploading.value = true
    
    // Copy video to storage directory
    const result = await invoke<{ destination_path: string; original_filename: string }>('copy_video_to_storage', {
      sourcePath: selected
    })
    
    // Generate thumbnail
    let thumbnailPath: string | undefined
    try {
      thumbnailPath = await invoke<string>('generate_thumbnail', {
        videoPath: result.destination_path
      })
    } catch (error) {
      console.warn('Failed to generate thumbnail:', error)
    }
    
    // Create raw_videos record with original filename and thumbnail
    await createRawVideo(result.destination_path, {
      originalFilename: result.original_filename,
      thumbnailPath
    })
    
    // Show success toast
    success('Video uploaded', `"${result.original_filename}" has been uploaded successfully`)
    
    // Reload videos list
    await loadVideos()
  } catch (err) {
    console.error('Failed to upload video:', err)
    error('Upload failed', `Failed to upload video: ${err}`)
  } finally {
    uploading.value = false
  }
}

async function playVideo(video: RawVideo) {
  try {
    videoToPlay.value = video
    // Get video server port
    const port = await invoke<number>('get_video_server_port')
    // Encode file path as base64 for URL
    const encodedPath = btoa(video.file_path)
    videoSrc.value = `http://localhost:${port}/video/${encodedPath}`
    showVideoPlayer.value = true
  } catch (err) {
    console.error('Failed to prepare video:', err)
    error('Playback failed', 'Unable to load the video for playback')
  }
}

function confirmDelete(video: RawVideo) {
  videoToDelete.value = video
  showDeleteDialog.value = true
}

async function deleteVideoConfirmed() {
  if (!videoToDelete.value) return
  
  const deletedVideoName = videoToDelete.value.original_filename || videoToDelete.value.file_path.split(/[\\\/]/).pop() || 'Video'
  
  try {
    // Delete the video file and thumbnail from the filesystem first
    await invoke('delete_video_file', {
      filePath: videoToDelete.value.file_path,
      thumbnailPath: videoToDelete.value.thumbnail_path || undefined
    })
    
    // Then delete from database
    await deleteRawVideo(videoToDelete.value.id)
    
    // Remove from thumbnail cache if exists
    if (videoToDelete.value.id && thumbnailCache.value.has(videoToDelete.value.id)) {
      thumbnailCache.value.delete(videoToDelete.value.id)
    }
    
    // Show success toast
    success('Video deleted', `"${deletedVideoName}" has been deleted successfully`)
    
    await loadVideos()
  } catch (err) {
    console.error('Failed to delete video:', err)
    error('Delete failed', `Failed to delete video: ${err}`)
  } finally {
    showDeleteDialog.value = false
    videoToDelete.value = null
  }
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

onMounted(() => {
  loadVideos()
})
</script>
