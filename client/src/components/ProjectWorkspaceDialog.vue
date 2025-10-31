<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="close"
    >
      <div class="bg-card rounded-t-2xl rounded-b-2xl w-full h-full border border-border shadow-2xl"
           style="margin: 30px; max-height: calc(100vh - 60px); max-width: calc(100vw - 60px);">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2 border-b border-border bg-[#0a0a0a]/50 backdrop-blur-sm rounded-t-xl">
          <div class="flex-1 min-w-0">
            <h2 class="text-sm font-medium text-foreground/90 truncate">{{ project?.name || 'New Project' }}</h2>
          </div>
          <button
            @click="close"
            class="p-1.5 hover:bg-[#ffffff]/10 rounded-md transition-colors"
            title="Close"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-foreground/70 hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Main Content Area -->
        <div class="flex flex-col h-full" style="height: calc(100% - 52px);">
          <!-- Top Row: Video Player, Transcript, and Clips -->
          <div class="flex flex-1 min-h-0 border-b border-border">
            <!-- Video Player Section -->
            <div class="w-3/5 min-w-0 p-8 border-r border-border flex flex-col">
              <!-- Video Player Container -->
              <VideoPlayer
                :video-src="videoSrc"
                :video-loading="videoLoading"
                :video-error="videoError"
                :is-playing="isPlaying"
                @togglePlayPause="togglePlayPause"
                @timeUpdate="onTimeUpdate"
                @loadedMetadata="onLoadedMetadata"
                @videoEnded="onVideoEnded"
                @videoError="onVideoError"
                @loadStart="onLoadStart"
                @canPlay="onCanPlay"
                @retryLoad="loadVideoForProject"
                @videoElementReady="onVideoElementReady"
              />

              <!-- Video Controls Bar -->
              <VideoControls
                :video-src="videoSrc"
                :video-loading="videoLoading"
                :is-playing="isPlaying"
                :current-time="currentTime"
                :duration="duration"
                :volume="volume"
                :is-muted="isMuted"
                @togglePlayPause="togglePlayPause"
                @toggleMute="toggleMute"
                @updateVolume="updateVolume"
              />
            </div>

            <!-- Right Side: Transcript and Clips -->
            <div class="w-2/5 min-w-0 flex flex-col">
              <!-- Transcript Section -->
              <TranscriptPanel
                :transcript-collapsed="transcriptCollapsed"
                :clips-collapsed="clipsCollapsed"
                :transcript-data="transcriptData"
                @toggleTranscript="toggleTranscript"
                @transcribeAudio="onTranscribeAudio"
              />

              <!-- Generated Clips Section -->
              <ClipsPanel
                :transcript-collapsed="transcriptCollapsed"
                :clips-collapsed="clipsCollapsed"
                @toggleClips="toggleClips"
                @detectClips="onDetectClips"
              />
            </div>
          </div>

          <!-- Bottom Row: Timeline -->
          <Timeline
            :video-src="videoSrc"
            :current-time="currentTime"
            :duration="duration"
            :timeline-hover-time="timelineHoverTime"
            :timeline-hover-position="timelineHoverPosition"
            :timestamps="timelineTimestamps"
            @seekTimeline="seekTimeline"
            @timelineTrackHover="onTimelineTrackHover"
            @timelineMouseLeave="onTimelineMouseLeave"
          />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* Backdrop blur effects */
.backdrop-blur-sm {
  backdrop-filter: blur(4px);
}

/* Smooth transitions */
.transition-colors {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Ensure proper z-index layering */
.z-50 {
  z-index: 50;
}
</style>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { type Project } from '@/services/database'
import { invoke } from '@tauri-apps/api/core'
import VideoPlayer from './VideoPlayer.vue'
import VideoControls from './VideoControls.vue'
import TranscriptPanel from './TranscriptPanel.vue'
import ClipsPanel from './ClipsPanel.vue'
import Timeline from './Timeline.vue'
import { useVideoPlayer } from '@/composables/useVideoPlayer'

console.log('[ProjectWorkspaceDialog] Script setup running')

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

console.log('[ProjectWorkspaceDialog] Props defined:', props.modelValue, props.project?.name)

// Initialize reactive state
const transcriptCollapsed = ref(false)
const clipsCollapsed = ref(false)

// Transcript data
const transcriptData = ref(null) // Will hold actual transcript data when available

// Use video player composable
const projectRef = computed(() => props.project)
const {
  videoElement,
  videoSrc,
  videoLoading,
  videoError,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  timelineHoverTime,
  timelineHoverPosition,
  timelineTimestamps,
  togglePlayPause,
  seekTimeline,
  onTimelineTrackHover,
  updateVolume,
  toggleMute,
  onTimeUpdate,
  onLoadedMetadata,
  onVideoEnded,
  onLoadStart,
  onCanPlay,
  onVideoError,
  loadVideos,
  loadVideoForProject,
  resetVideoState
} = useVideoPlayer(projectRef)

// Debug: Log state changes
watch([videoLoading, videoSrc, videoElement], () => {
  console.log('[ProjectWorkspaceDialog] State update:', {
    loading: videoLoading.value,
    src: videoSrc.value?.substring(0, 50) + '...',
    element: !!videoElement.value
  })
}, { immediate: true })

function close() {
  emit('update:modelValue', false)
}

function toggleTranscript() {
  transcriptCollapsed.value = !transcriptCollapsed.value

  // If we're collapsing transcript, auto-expand clips
  if (transcriptCollapsed.value) {
    clipsCollapsed.value = false
  }
}

function toggleClips() {
  clipsCollapsed.value = !clipsCollapsed.value

  // If we're collapsing clips, auto-expand transcript
  if (clipsCollapsed.value) {
    transcriptCollapsed.value = false
  }
}

async function onDetectClips() {
  if (!props.project) {
    console.error('[ProjectWorkspaceDialog] No project available')
    return
  }

  try {
    console.log('[ProjectWorkspaceDialog] Starting clip detection process...')

    // Get the video path from the project's associated raw video
    const { getAllRawVideos } = await import('@/services/database')
    const rawVideos = await getAllRawVideos()
    const projectVideo = rawVideos.find(v => v.project_id === props.project?.id)

    if (!projectVideo) {
      console.error('[ProjectWorkspaceDialog] No video found for project')
      return
    }

    console.log('[ProjectWorkspaceDialog] Found video for project:', projectVideo.file_path)

    // Step 1: Generate MP3 audio file from video using FFmpeg - EXACTLY like prototype
    const audioFile = await generateAudioFromVideo(projectVideo.file_path)

    // Step 2: Transmit audio to server for processing
    const formData = new FormData()
    formData.append('audio', audioFile, audioFile.name)
    formData.append('project_id', props.project.id.toString())

    const response = await fetch(`${API_BASE}/api/clips/detect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: formData
    })

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`)
    }

    const result = await response.json()

    // Step 3: Display test dialog with returned data
    showClipDetectionResult(result)

  } catch (error) {
    console.error('[ProjectWorkspaceDialog] Clip detection failed:', error)
    // You might want to show an error message to the user here
  }
}

async function generateAudioFromVideo(videoPath: string): Promise<File> {
  // This uses the bundled FFmpeg to extract audio as MP3 - EXACTLY like prototype
  console.log('[ProjectWorkspaceDialog] Generating MP3 audio from video:', videoPath)

  try {
    // Call Tauri command to extract audio using FFmpeg - now returns (filename, base64_data)
    const [filename, base64Data] = await invoke<[string, string]>('extract_audio_from_video', {
      videoPath: videoPath,
      outputPath: 'temp_audio_audio_only.mp3'
    })

    console.log('[ProjectWorkspaceDialog] Audio file extracted:', filename)
    console.log('[ProjectWorkspaceDialog] Base64 data length:', base64Data.length)

    // Convert base64 back to binary
    const binaryString = atob(base64Data)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }

    // Create Blob from binary data
    const blob = new Blob([bytes], { type: 'audio/mp3' })

    // Convert Blob to File object
    return new File([blob], filename, { type: 'audio/mp3' })
  } catch (error) {
    console.error('[ProjectWorkspaceDialog] FFmpeg audio extraction failed:', error)
    throw new Error('Failed to extract audio from video')
  }
}

function showClipDetectionResult(result: any) {
  // Create a test dialog to show the returned data
  console.log('[ProjectWorkspaceDialog] Clip detection result:', result)

  // Create a simple modal dialog to display the data
  const modal = document.createElement('div')
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50'
  modal.innerHTML = `
    <div class="bg-card rounded-2xl p-6 max-w-4xl max-h-[80vh] overflow-auto border border-border shadow-2xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-foreground">Clip Detection Results</h3>
        <button onclick="this.closest('.fixed').remove()" class="p-2 hover:bg-[#ffffff]/10 rounded-md">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <div class="space-y-4">
        <div>
          <h4 class="font-medium text-foreground/80 mb-2">AI Generated Clips:</h4>
          <pre class="bg-[#0a0a0a] p-4 rounded-lg text-xs overflow-auto max-h-60 text-white/90">${JSON.stringify(result.clips, null, 2)}</pre>
        </div>
        <div>
          <h4 class="font-medium text-foreground/80 mb-2">Whisper Transcript:</h4>
          <pre class="bg-[#0a0a0a] p-4 rounded-lg text-xs overflow-auto max-h-60 text-white/90">${JSON.stringify(result.transcript, null, 2)}</pre>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(modal)
}

function onTranscribeAudio() {
  // Handle audio transcription - this would integrate with your transcription service
  console.log('[ProjectWorkspaceDialog] Transcribe audio requested')
}

function onTimelineMouseLeave() {
  timelineHoverTime.value = null
}

function onVideoElementReady(element: HTMLVideoElement) {
  console.log('[ProjectWorkspaceDialog] Video element ready:', !!element)
  videoElement.value = element
}

// Watch for dialog open/close
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    await loadVideos()
    await loadVideoForProject()
  } else {
    // Reset video state when dialog closes
    resetVideoState()
  }
})

</script>