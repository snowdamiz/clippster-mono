<template>
  <PageLayout
    title="Videos"
    description="Browse and manage your raw video files"
    :show-header="!loading && videos.length > 0"
  >
    <template #actions>
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
    </template>

    <!-- Loading State -->
    <LoadingState v-if="loading" message="Loading videos..." />

    <!-- Videos Grid -->
    <div v-else-if="videos.length > 0" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
      <div v-for="video in videos" :key="video.id" class="group relative bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 cursor-pointer">
        <!-- Thumbnail -->
        <div class="aspect-video bg-muted/50 relative">
          <div class="absolute inset-0 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-14 w-14 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <!-- Hover Overlay -->
          <div class="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2">
            <button class="p-2.5 bg-white rounded-lg hover:bg-white/90" title="Play">
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
          <h4 class="font-semibold text-foreground truncate mb-1">{{ video.file_path.split(/[\\\/]/).pop() || 'Untitled Video' }}</h4>
          <p class="text-xs text-muted-foreground mb-2" v-if="video.duration">Duration: {{ Math.round(video.duration) }}s</p>
          <p class="text-xs text-muted-foreground">Added {{ getRelativeTime(video.created_at) }}</p>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
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
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAllRawVideos, createRawVideo, deleteRawVideo, type RawVideo } from '@/services/database'
import { useFormatters } from '@/composables/useFormatters'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import PageLayout from '@/components/PageLayout.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'

const videos = ref<RawVideo[]>([])
const loading = ref(true)
const uploading = ref(false)
const { getRelativeTime } = useFormatters()

async function loadVideos() {
  loading.value = true
  try {
    videos.value = await getAllRawVideos()
  } catch (error) {
    console.error('Failed to load videos:', error)
  } finally {
    loading.value = false
  }
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
    const destinationPath = await invoke<string>('copy_video_to_storage', {
      sourcePath: selected
    })
    
    // Create raw_videos record
    await createRawVideo(destinationPath)
    
    // Reload videos list
    await loadVideos()
  } catch (error) {
    console.error('Failed to upload video:', error)
    alert(`Failed to upload video: ${error}`)
  } finally {
    uploading.value = false
  }
}

async function confirmDelete(video: RawVideo) {
  const videoName = video.file_path.split(/[\\/]/).pop() || 'this video'
  if (confirm(`Are you sure you want to delete "${videoName}"?`)) {
    try {
      await deleteRawVideo(video.id)
      await loadVideos()
    } catch (error) {
      console.error('Failed to delete video:', error)
    }
  }
}

onMounted(() => {
  loadVideos()
})
</script>
