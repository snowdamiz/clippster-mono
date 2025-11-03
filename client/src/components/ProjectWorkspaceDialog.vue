<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="close"
    >
      <div class="bg-card rounded-t-lg rounded-b-lg w-full h-full border border-border shadow-2xl"
           style="margin: 30px; max-height: calc(100vh - 60px); max-width: calc(100vw - 60px);">
        <!-- Header -->
        <div class="flex items-center justify-between pl-3 pr-1.5 py-1.5 border-b border-border bg-muted/12 rounded-t-xl">
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
        <div class="flex flex-col" style="height: calc(100% - 22px); min-height: 0;">
          <!-- Top Row: Video Player, Transcript, and Clips -->
          <div class="flex min-h-0 border-b border-border" style="flex: 1; overflow: hidden; max-height: calc(100% - 170px);">
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

            <!-- Right Side: Clips Section -->
            <div class="w-2/5 min-w-0 flex flex-col flex-1">
              <!-- Clips Section -->
              <ClipsPanel
                ref="clipsPanelRef"
                :transcript-collapsed="transcriptCollapsed"
                :clips-collapsed="clipsCollapsed"
                :is-generating="clipGenerationInProgress"
                :generation-progress="clipProgress"
                :generation-stage="clipStage"
                :generation-message="clipMessage"
                :generation-error="clipError"
                :project-id="project?.id"
                :hovered-timeline-clip-id="hoveredTimelineClipId"
                @detectClips="onDetectClips"
                @clipHover="onClipHover"
                @scrollToTimeline="onScrollToTimeline"
                @deleteClip="onDeleteClip"
              />
            </div>
          </div>

          <!-- Bottom Row: Timeline -->
          <Timeline
            ref="timelineRef"
            :video-src="videoSrc"
            :current-time="currentTime"
            :duration="duration"
            :timeline-hover-time="timelineHoverTime"
            :timeline-hover-position="timelineHoverPosition"
            :clips="timelineClips"
            :hovered-clip-id="hoveredClipId"
            :hovered-timeline-clip-id="hoveredTimelineClipId"
            @seekTimeline="seekTimeline"
            @timelineTrackHover="onTimelineTrackHover"
            @timelineMouseLeave="onTimelineMouseLeave"
            @timelineClipHover="onTimelineClipHover"
            @scrollToClipsPanel="onScrollToClipsPanel"
            @zoomChanged="handleTimelineZoomChanged"
          />
        </div>
      </div>
    </div>
  </Teleport>

  <!-- Progress Modal (for error states or detailed view) -->
  <ClipGenerationProgress
    :visible="showProgress"
    :progress="clipProgress"
    :stage="clipStage"
    :message="clipMessage"
    :error="clipError"
    :is-connected="progressConnected"
    :can-close="!clipGenerationInProgress"
    @close="closeProgress"
  />

  <!-- Delete Confirmation Modal -->
  <DeleteConfirmationModal
    :show="showDeleteDialog"
    title="Delete Clip"
    message="Are you sure you want to delete this clip?"
    suffix="This action cannot be undone."
    confirm-text="Delete"
    @close="handleDeleteDialogClose"
    @confirm="deleteClipConfirmed"
  />
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
import { type Project, type ClipWithVersion, getClipsWithVersionsByProjectId, deleteClip } from '@/services/database'
import { invoke } from '@tauri-apps/api/core'
import VideoPlayer from './VideoPlayer.vue'
import VideoControls from './VideoControls.vue'
import ClipsPanel from './ClipsPanel.vue'
import Timeline from './Timeline.vue'
import ClipGenerationProgress from './ClipGenerationProgress.vue'
import DeleteConfirmationModal from './DeleteConfirmationModal.vue'
import { useVideoPlayer } from '@/composables/useVideoPlayer'
import { useProgressSocket } from '@/composables/useProgressSocket'
import { useToast } from '@/composables/useToast'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
const { error: showError } = useToast()

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()

// Progress state
const showProgress = ref(false)
const clipGenerationInProgress = ref(false)

// Delete state
const showDeleteDialog = ref(false)
const clipToDelete = ref<string | null>(null)

// Panel collapse state
const transcriptCollapsed = ref(false)
const clipsCollapsed = ref(false)

// Timeline clips state
const timelineClips = ref<any[]>([])

// Hover state for bidirectional highlighting
const hoveredClipId = ref<string | null>(null)
const hoveredTimelineClipId = ref<string | null>(null)

// Component refs for scrolling
const clipsPanelRef = ref<InstanceType<typeof ClipsPanel> | null>(null)
const timelineRef = ref<InstanceType<typeof Timeline> | null>(null)

// Use video player composable
const projectRef = computed(() => props.project)

// Initialize progress socket
const {
  isConnected: progressConnected,
  progress: clipProgress,
  stage: clipStage,
  message: clipMessage,
  error: clipError,
  setProjectId: setProgressProjectId,
  reset: resetProgress
} = useProgressSocket(props.project?.id || null)
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
  togglePlayPause,
  seekTimeline,
  onTimelineTrackHover,
  onTimelineZoomChanged,
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

function close() {
  emit('update:modelValue', false)
}

function closeProgress() {
  showProgress.value = false
  resetProgress()
  if (!clipGenerationInProgress.value) {
    setProgressProjectId(null)
  }
}




async function onDetectClips(prompt: string) {
  if (!props.project) {
    console.error('[ProjectWorkspaceDialog] No project available')
    return
  }

  try {
    // Initialize progress tracking
    clipGenerationInProgress.value = true
    showProgress.value = false // Show progress in the clips panel, not modal
    resetProgress()
    setProgressProjectId(props.project.id.toString())

    // Get the video path from the project's associated raw video
    const { getAllRawVideos, persistClipDetectionResults } = await import('@/services/database')
    const rawVideos = await getAllRawVideos()
    const projectVideo = rawVideos.find(v => v.project_id === props.project?.id)

    if (!projectVideo) {
      console.error('[ProjectWorkspaceDialog] No video found for project')
      throw new Error('No video found for project')
    }

    // Step 1: Generate MP3 audio file from video using FFmpeg - EXACTLY like prototype
    const audioFile = await generateAudioFromVideo(projectVideo.file_path)
    const processingStartTime = Date.now()

    // Step 2: Transmit audio to server for processing
    const formData = new FormData()
    formData.append('audio', audioFile, audioFile.name)
    formData.append('project_id', props.project.id.toString())
    formData.append('prompt', prompt)

    const response = await fetch(`${API_BASE}/api/clips/detect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
      },
      body: formData
    })

    if (!response.ok) {
      let errorMessage = `Server error: ${response.status}`

      // Try to get more detailed error from response
      try {
        const errorData = await response.json()
        if (errorData.error) {
          errorMessage = errorData.error
          if (errorData.details) {
            errorMessage += `: ${errorData.details}`
          }
        }
      } catch (e) {
        // If we can't parse JSON, use the status-based message
      }

      throw new Error(errorMessage)
    }

    const result = await response.json()

    // Check if the response indicates an error even with 200 status
    if (!result.success && result.error) {
      throw new Error(result.error)
    }
    const processingTimeMs = Date.now() - processingStartTime

    // Check for nested structure
    if (result.clips && typeof result.clips === 'object' && result.clips.clips) {
      result.clips = result.clips.clips
    }

    // Step 3: Persist detected clips to database with versioning
    const sessionId = await persistClipDetectionResults(
      props.project.id,
      prompt,
      result,
      {
        processingTimeMs,
        detectionModel: 'claude-3.5-sonnet',
        serverResponseId: result.jobId || null
      }
    )

    // Step 5: Trigger UI refresh to show the new clips
    if (props.project) {
      // Force the ClipsPanel to reload clips by directly calling the refresh function
      setTimeout(() => {
        const clipsPanel = document.querySelector('[data-clips-panel]') as any
        if (clipsPanel && clipsPanel.__vueParentComponent && clipsPanel.__vueParentComponent.exposed) {
          // Try to access the exposed refreshClips method
          clipsPanel.__vueParentComponent.exposed.refreshClips?.()
        } else {
          // Fallback: emit a custom event to trigger refresh
          const refreshEvent = new CustomEvent('refresh-clips', { detail: { projectId: props.project!.id } })
          document.dispatchEvent(refreshEvent)
        }
      }, 1000)
    }

    // Step 4: Display results with session information
    showClipDetectionResult(result, sessionId)

  } catch (error) {
    console.error('[ProjectWorkspaceDialog] Clip detection failed:', error)

    // Show error toast to user
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const isNetworkError = errorMessage.includes('TLS') || errorMessage.includes('network') || errorMessage.includes('fetch')

    if (isNetworkError) {
      showError(
        'Network Error',
        'AI service temporarily unavailable. No credits were charged. Please try again in a few moments.',
        8000
      )
    } else if (errorMessage.includes('Server error: 500')) {
      showError(
        'Service Error',
        'AI processing failed. No credits were charged. Please try again.',
        8000
      )
    } else {
      showError(
        'Clip Detection Failed',
        `${errorMessage}. No credits were charged.`,
        8000
      )
    }

    // Keep progress dialog open to show the error
  } finally {
    // Don't immediately hide progress - let the user see the completion/error state
    setTimeout(() => {
      clipGenerationInProgress.value = false
    }, 1000)
  }
}

async function generateAudioFromVideo(videoPath: string): Promise<File> {
  // This uses the bundled FFmpeg to extract audio as MP3 - EXACTLY like prototype
  try {
    // Call Tauri command to extract audio using FFmpeg - now returns (filename, base64_data)
    const [filename, base64Data] = await invoke<[string, string]>('extract_audio_from_video', {
      videoPath: videoPath,
      outputPath: 'temp_audio_audio_only.mp3'
    })

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

function showClipDetectionResult(result: any, sessionId?: string) {
  // Create a test dialog to show the returned data with validation information
  const validation = result.validation || {}
  const qualityScore = validation.qualityScore || 0
  const issues = validation.issues || []
  const corrections = validation.corrections || []
  const clipsProcessed = validation.clipsProcessed || 0
  const clipsFound = result.clips?.length || 0

  // Determine quality score color
  let qualityColor = 'text-red-400'
  let qualityLabel = 'Poor'
  if (qualityScore >= 0.8) {
    qualityColor = 'text-green-400'
    qualityLabel = 'Excellent'
  } else if (qualityScore >= 0.6) {
    qualityColor = 'text-yellow-400'
    qualityLabel = 'Good'
  } else if (qualityScore >= 0.4) {
    qualityColor = 'text-orange-400'
    qualityLabel = 'Fair'
  }

  // Create validation summary HTML
  const validationSummary = `
    <div class="bg-[#0a0a0a] rounded-lg p-4 space-y-3">
      ${sessionId ? `
        <div class="flex items-center justify-between">
          <span class="text-foreground/70 text-sm">Detection Session:</span>
          <span class="text-blue-400 font-mono text-xs">${sessionId.substring(0, 8)}...</span>
        </div>
      ` : ''}
      <div class="flex items-center justify-between">
        <span class="text-foreground/70 text-sm">Overall Quality Score:</span>
        <span class="${qualityColor} font-semibold">${qualityLabel} (${Math.round(qualityScore * 100)}%)</span>
      </div>
      <div class="grid grid-cols-3 gap-4 text-sm">
        <div class="text-center">
          <div class="text-2xl font-bold text-white">${clipsFound}</div>
          <div class="text-foreground/50 text-xs">Clips Found</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-yellow-400">${issues.length}</div>
          <div class="text-foreground/50 text-xs">Issues Found</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-400">${corrections.length}</div>
          <div class="text-foreground/50 text-xs">Corrections Applied</div>
        </div>
      </div>
      ${clipsFound === 0 ? `
        <div class="border-t border-border/30 pt-3">
          <div class="text-foreground/70 text-sm mb-2">No Clips Found</div>
          <div class="text-orange-300 text-xs">
            The AI didn't find any clip-worthy moments in this video. This could be because:
            <ul class="mt-2 ml-4 list-disc space-y-1">
              <li>The content doesn't match the detection criteria</li>
              <li>The audio quality or speech is unclear</li>
              <li>The video duration is too short</li>
            </ul>
            Try using a different detection prompt or check if the video has clear speech content.
          </div>
        </div>
      ` : ''}
      ${issues.length > 0 ? `
        <div class="border-t border-border/30 pt-3">
          <div class="text-foreground/70 text-sm mb-2">Key Issues:</div>
          <ul class="space-y-1">
            ${issues.slice(0, 3).map((issue: string) => `<li class="text-yellow-300 text-xs flex items-center gap-1"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd" /></svg>${issue}</li>`).join('')}
            ${issues.length > 3 ? `<li class="text-foreground/50 text-xs">... and ${issues.length - 3} more issues</li>` : ''}
          </ul>
        </div>
      ` : ''}
      ${corrections.length > 0 ? `
        <div class="border-t border-border/30 pt-3">
          <div class="text-foreground/70 text-sm mb-2">Applied Corrections:</div>
          <ul class="space-y-1">
            ${corrections.slice(0, 3).map((correction: string) => `<li class="text-blue-300 text-xs flex items-center gap-1"><svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" /></svg>${correction}</li>`).join('')}
            ${corrections.length > 3 ? `<li class="text-foreground/50 text-xs">... and ${corrections.length - 3} more corrections</li>` : ''}
          </ul>
        </div>
      ` : ''}
    </div>
  `

  // Create modal dialog
  const modal = document.createElement('div')
  modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50'
  modal.innerHTML = `
    <div class="bg-card rounded-2xl p-6 max-w-5xl max-h-[85vh] overflow-auto border border-border shadow-2xl">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-lg font-semibold text-foreground">Clip Detection Results</h3>
        <button onclick="this.closest('.fixed').remove()" class="p-2 hover:bg-[#ffffff]/10 rounded-md">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>

      ${validation ? validationSummary : ''}

      <div class="mt-6 space-y-4">
        <div>
          <h4 class="font-medium text-foreground/80 mb-2 flex items-center gap-2">
            Validated Clips
            <span class="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded-full">${clipsProcessed} clips</span>
            ${sessionId ? '<span class="text-xs bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full">Saved to database</span>' : ''}
          </h4>
          <pre class="bg-[#0a0a0a] p-4 rounded-lg text-xs overflow-auto max-h-60 text-white/90">${JSON.stringify(result.clips, null, 2)}</pre>
        </div>
        <div>
          <h4 class="font-medium text-foreground/80 mb-2">Original Transcript:</h4>
          <pre class="bg-[#0a0a0a] p-4 rounded-lg text-xs overflow-auto max-h-60 text-white/90">${JSON.stringify(result.transcript, null, 2)}</pre>
        </div>
      </div>
    </div>
  `
  document.body.appendChild(modal)
}


function onTimelineMouseLeave() {
  timelineHoverTime.value = null
}

function handleTimelineZoomChanged(zoomLevel: number) {
  onTimelineZoomChanged(zoomLevel)
}

// Clip hover event handlers
function onClipHover(clipId: string) {
  // Clear both states first to ensure no duplicates
  hoveredClipId.value = null
  hoveredTimelineClipId.value = null

  // Then set the new state
  hoveredClipId.value = clipId

  // Check if this is the first clip - if so, scroll timeline to top
  const isFirstClip = timelineClips.value.length > 0 && timelineClips.value[0].id === clipId

  if (timelineRef.value) {
    if (isFirstClip) {
      // Scroll timeline to the very top with smooth animation
      const timelineContainer = timelineRef.value.$el?.querySelector('.overflow-y-auto')
      if (timelineContainer) {
        timelineContainer.scrollTo({
          top: 0,
          behavior: 'smooth'
        })
      }
    } else {
      // Scroll to the corresponding timeline clip
      timelineRef.value.scrollTimelineClipIntoView(clipId)
    }
  }
}


// Timeline clip hover/click event handler
function onTimelineClipHover(clipId: string) {
  // Clear both states first to ensure no duplicates
  hoveredClipId.value = null
  hoveredTimelineClipId.value = null

  // Then set the new state
  hoveredTimelineClipId.value = clipId
}

// Scroll event handlers
function onScrollToTimeline() {
  // Scroll timeline into view if it's not visible
  if (timelineRef.value) {
    const timelineElement = (timelineRef.value as any).$el as HTMLElement
    if (timelineElement) {
      timelineElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }
}

function onScrollToClipsPanel(clipId: string) {
  // Scroll to the specific clip
  if (clipId && clipsPanelRef.value) {
    clipsPanelRef.value.scrollClipIntoView(clipId)
  } else {
    console.log('[ProjectWorkspaceDialog] Cannot scroll - missing clipId or ref')
  }
}

// Delete clip handlers
function onDeleteClip(clipId: string) {
  console.log('[ProjectWorkspaceDialog] onDeleteClip called with clipId:', clipId)
  clipToDelete.value = clipId
  showDeleteDialog.value = true
  console.log('[ProjectWorkspaceDialog] showDeleteDialog set to:', showDeleteDialog.value)
  console.log('[ProjectWorkspaceDialog] clipToDelete set to:', clipToDelete.value)
}

function handleDeleteDialogClose() {
  showDeleteDialog.value = false
  clipToDelete.value = null
}

async function deleteClipConfirmed() {
  if (!clipToDelete.value) return

  try {
    await deleteClip(clipToDelete.value)

    // Refresh clips and timeline
    if (props.project) {
      // Refresh clips panel
      setTimeout(() => {
        const refreshEvent = new CustomEvent('refresh-clips', { detail: { projectId: props.project!.id } })
        document.dispatchEvent(refreshEvent)
      }, 100)

      // Refresh timeline clips
      await loadTimelineClips(props.project.id)
    }

    // Show success message
    const { success } = useToast()
    success('Clip Deleted', 'The clip has been permanently deleted.')
  } catch (error) {
    console.error('[ProjectWorkspaceDialog] Failed to delete clip:', error)

    // Show error message
    const { error: showError } = useToast()
    showError('Delete Failed', 'Failed to delete the clip. Please try again.')
  } finally {
    handleDeleteDialogClose()
  }
}

// Transform ClipWithVersion to Timeline's Clip format
function transformClipsForTimeline(clipsWithVersion: ClipWithVersion[]): any[] {
  return clipsWithVersion.map(clip => {
    const version = clip.current_version

    if (!version) {
      console.warn('[ProjectWorkspaceDialog] Clip missing current version:', clip.id)
      return null
    }

    // Use segments from database if available, otherwise create single segment from version timing
    let segments: any[] = []
    if (clip.current_version_segments && Array.isArray(clip.current_version_segments) && clip.current_version_segments.length > 0) {
      // Use the proper segments from database
      segments = clip.current_version_segments.map((segment: any) => ({
        start_time: segment.start_time,
        end_time: segment.end_time,
        duration: segment.duration || (segment.end_time - segment.start_time),
        transcript: segment.transcript || version.description || 'No transcript available'
      }))
    } else {
      // Fallback: create single segment from version timing
      segments = [
        {
          start_time: version.start_time,
          end_time: version.end_time,
          duration: version.end_time - version.start_time,
          transcript: version.description || 'No transcript available'
        }
      ]
    }

    // Determine clip type based on segments
    const clipType = segments.length > 1 ? 'spliced' : 'continuous'

    // Transform to Timeline's Clip interface
    return {
      id: clip.id,
      title: version.name || clip.name || 'Untitled Clip',
      filename: clip.file_path || 'clip.mp4',
      type: clipType,
      segments: segments,
      total_duration: version.end_time - version.start_time,
      combined_transcript: version.description || 'No transcript available',
      virality_score: Math.round((version.confidence_score || 0) * 100),
      reason: version.detection_reason || 'AI detected clip-worthy moment',
      socialMediaPost: `${version.name || 'Clip'} - ${version.description || 'Interesting moment'}`,
      run_number: clip.run_number,
      run_color: clip.session_run_color
    }
  }).filter(Boolean) // Remove any null entries
}

// Load clips for timeline
async function loadTimelineClips(projectId: string) {
  if (!projectId) {
    timelineClips.value = []
    return
  }

  try {
    const clipsWithVersion = await getClipsWithVersionsByProjectId(projectId)

    timelineClips.value = transformClipsForTimeline(clipsWithVersion)
  } catch (error) {
    timelineClips.value = []
  }
}

function onVideoElementReady(element: HTMLVideoElement) {
  videoElement.value = element
}

// Watch for dialog open/close
watch(() => props.modelValue, async (newValue) => {
  if (newValue) {
    await loadVideos()
    await loadVideoForProject()
    // Load timeline clips when dialog opens
    if (props.project) {
      await loadTimelineClips(props.project.id)
    }
  } else {
    // Reset video state when dialog closes
    resetVideoState()
    showProgress.value = false
    // Clear timeline clips
    timelineClips.value = []
  }
})

// Watch for project changes
watch(() => props.project?.id, (newProjectId) => {
  if (newProjectId) {
    setProgressProjectId(newProjectId.toString())
  } else {
    setProgressProjectId(null)
  }
})

// Watch for dialog close to disconnect socket
watch(() => props.modelValue, (newValue) => {
  if (!newValue) {
    // Disconnect progress socket when dialog closes
    setProgressProjectId(null)
  }
})

// Watch for progress socket errors and show toasts
watch(clipError, (newError) => {
  if (newError && clipGenerationInProgress.value) {
    showError(
      'Processing Error',
      newError.includes('No credits were charged') ? newError : `${newError}. No credits were charged.`,
      8000
    )
  }
})

// Watch for generation completion to trigger clips refresh
watch([clipGenerationInProgress, clipProgress], async ([isInProgress, progress]) => {
  if (!isInProgress && progress === 100 && props.project) {
    // Trigger clips refresh with a longer delay to ensure all database operations are complete
    setTimeout(async () => {
      const refreshEvent = new CustomEvent('refresh-clips', { detail: { projectId: props.project!.id } })
      document.dispatchEvent(refreshEvent)

      // Also refresh timeline clips
      await loadTimelineClips(props.project!.id)
    }, 1500)
  }
})

</script>