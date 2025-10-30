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
import VideoPlayer from './VideoPlayer.vue'
import VideoControls from './VideoControls.vue'
import TranscriptPanel from './TranscriptPanel.vue'
import ClipsPanel from './ClipsPanel.vue'
import Timeline from './Timeline.vue'
import { useVideoPlayer } from '@/composables/useVideoPlayer'

console.log('[ProjectWorkspaceDialog] Script setup running')

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

function onDetectClips() {
  // Handle clip detection - this would integrate with your AI/clip generation logic
  console.log('[ProjectWorkspaceDialog] Detect clips requested')
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