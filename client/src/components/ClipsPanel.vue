<template>
  <div class="p-4 flex flex-col flex-1 h-full" data-clips-panel>
    <div class="flex items-center justify-between mb-3">
      <h3 class="text-sm font-medium text-foreground">Clips</h3>
      <div class="flex items-center gap-1">
        <!-- Re-run button (only show when not generating and clips exist) -->
        <button
          v-if="!isGenerating && clips.length > 0"
          @click="handleDetectClips"
          :disabled="!selectedPrompt"
          class="p-1 hover:bg-purple-500/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Detect more clips"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>
    <div class="flex-1 overflow-y-auto">
        <div class="flex-1 flex items-start justify-center">
          <!-- Progress State -->
          <div v-if="isGenerating" class="text-center text-foreground w-full max-w-xs mx-4">
            <!-- Stage Icon -->
            <div class="mb-4 flex justify-center">
              <div class="relative">
                <component :is="stageIcon" :class="stageIconClass" class="h-8 w-8" />
              </div>
            </div>

            <!-- Stage Title -->
            <h4 class="font-medium text-foreground mb-1">{{ stageTitle }}</h4>
            <p class="text-sm text-foreground/70 mb-4">{{ stageDescription }}</p>

            <!-- Progress Bar -->
            <div class="mb-4">
              <div class="flex justify-between items-center mb-2">
                <span class="text-xs text-foreground/50">Progress</span>
                <span class="text-xs font-medium text-foreground/70">{{ generationProgress }}%</span>
              </div>
              <div class="relative">
                <div class="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all duration-500 ease-out"
                    :class="progressBarClass"
                    :style="{ width: `${generationProgress}%` }"
                  />
                </div>
                <!-- Animated shine effect -->
                <div
                  v-if="generationProgress > 0 && generationProgress < 100"
                  class="absolute inset-0 h-full overflow-hidden rounded-full"
                >
                  <div class="h-full w-20 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-shine" />
                </div>
              </div>
            </div>

            <!-- Status Message -->
            <div v-if="generationMessage" class="text-sm text-foreground/60 bg-muted/30 rounded-lg p-3 mb-4">
              {{ generationMessage }}
            </div>

            <!-- Error State -->
            <div v-if="generationError" class="bg-destructive/10 border border-destructive/20 rounded-lg p-3 mb-4">
              <div class="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div class="text-left">
                  <h4 class="font-medium text-destructive text-sm">Error</h4>
                  <p class="text-xs text-destructive/80 mt-1">{{ generationError }}</p>
                </div>
              </div>
            </div>
          </div>

  
          <!-- Clips List State -->
          <div v-else-if="clips.length > 0 && !isGenerating" class="w-full">

            <!-- Clips Grid -->
            <div class="space-y-3">
              <div
                v-for="clip in clips"
                :key="clip.id"
                class="p-3 bg-muted/15 border border-border rounded-lg hover:border-border/80 transition-colors"
              >
                <div class="flex items-start justify-between">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                      <h5 class="text-xs font-medium text-foreground/90 truncate">
                        {{ clip.current_version?.name || clip.name || 'Untitled Clip' }}
                      </h5>
                      <!-- Run Number Badge -->
                      <span
                        v-if="clip.run_number"
                        class="text-xs bg-purple-500/20 text-purple-400 px-2 py-0.5 rounded-full font-medium"
                        title="Detection run"
                      >
                        Run {{ clip.run_number }}
                      </span>
                    </div>

                    <!-- Clip Info -->
                    <div class="flex items-center gap-2 mb-2 text-xs text-foreground/60">
                      <span>{{ formatDuration((clip.current_version?.end_time || 0) - (clip.current_version?.start_time || 0)) }}</span>
                      <span>•</span>
                      <span>{{ Math.floor(clip.current_version?.start_time || 0) }}s - {{ Math.floor(clip.current_version?.end_time || 0) }}s</span>
                      <span v-if="clip.current_version?.confidence_score" class="flex items-center gap-1">
                        <TrendingUpIcon class="h-2 w-2" />
                        {{ Math.round((clip.current_version.confidence_score || 0) * 100) }}%
                      </span>
                      <span v-if="clip.session_created_at" class="flex items-center gap-1">
                        <ClockIcon class="h-2 w-2" />
                        {{ formatTimestamp(clip.session_created_at) }}
                      </span>
                    </div>

                    <!-- Description -->
                    <p v-if="clip.current_version?.description" class="text-xs text-foreground/70 line-clamp-2">
                      {{ clip.current_version.description }}
                    </p>
                  </div>

                  <!-- Clip Actions -->
                  <div class="flex items-center gap-1 ml-2">
                    <button
                      class="p-1 hover:bg-muted/50 rounded transition-colors"
                      title="Play clip"
                    >
                      <PlayIcon class="h-3 w-3 text-foreground/60" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Default State -->
          <div v-else class="text-center text-muted-foreground">
            <div class="mb-4 flex flex-col items-center">
              <label class="block text-xs font-medium text-foreground/70 mb-2 text-center">
                Detection Prompt
              </label>
              <div class="relative">
                <button
                  @click="togglePromptDropdown"
                  class="flex px-3 py-2 text-xs bg-background border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent text-left items-center justify-between min-w-[150px]"
                >
                  <span class="truncate flex-1 mr-2">
                    {{ selectedPrompt ? prompts.find(p => p.id === selectedPromptId)?.name || 'Select a prompt...' : 'Select a prompt...' }}
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                <!-- Dropdown Menu -->
                <div
                  v-if="showPromptDropdown"
                  class="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-[60] max-h-48 overflow-y-auto"
                  @click.stop
                >
                  <div class="p-1 min-w-[150px]">
                    <button
                      v-for="prompt in prompts"
                      :key="prompt.id"
                      @click="onPromptChange(prompt.id, prompt.content)"
                      class="block w-full text-left px-3 py-2 rounded-md hover:bg-muted/80 transition-colors text-xs whitespace-nowrap"
                      :title="`Use prompt: ${prompt.name}`"
                    >
                      {{ prompt.name }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <button
              @click="handleDetectClips"
              :disabled="!selectedPrompt"
              class="px-4 py-2 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 disabled:from-gray-500/50 disabled:to-gray-600/50 disabled:cursor-not-allowed text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all mx-auto text-xs"
              title="Detect Clips"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Detect Clips
            </button>
          </div>
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { getAllPrompts, getClipsWithVersionsByProjectId, getClipDetectionSessionsByProjectId, type Prompt, type ClipWithVersion, type ClipDetectionSession } from '@/services/database'
import {
  PlayIcon,
  BrainIcon,
  CheckCircleIcon,
  XCircleIcon,
  ActivityIcon,
  MicIcon,
  ClockIcon,
  TrendingUpIcon
} from 'lucide-vue-next'

interface Props {
  transcriptCollapsed: boolean
  clipsCollapsed: boolean
  isGenerating?: boolean
  generationProgress?: number
  generationStage?: string
  generationMessage?: string
  generationError?: string
  projectId?: string
}

const props = withDefaults(defineProps<Props>(), {
  isGenerating: false,
  generationProgress: 0,
  generationStage: '',
  generationMessage: '',
  generationError: ''
})

interface Emits {
  (e: 'detectClips', prompt: string): void
}

const emit = defineEmits<Emits>()

const clipsContent = ref<HTMLElement>()
const prompts = ref<Prompt[]>([])
const selectedPromptId = ref<string>('')
const selectedPrompt = ref<string>('')
const showPromptDropdown = ref(false)

// Clips state
const clips = ref<ClipWithVersion[]>([])
const detectionSessions = ref<ClipDetectionSession[]>([])
const loadingClips = ref(false)

onMounted(async () => {
  try {
    prompts.value = await getAllPrompts()
    // Select the default prompt if available
    const defaultPrompt = prompts.value.find(p => p.name === 'Default Clip Detector')
    if (defaultPrompt) {
      selectedPromptId.value = defaultPrompt.id
      onPromptChange(defaultPrompt.id, defaultPrompt.content)
    } else if (prompts.value.length > 0) {
      const firstPrompt = prompts.value[0]
      selectedPromptId.value = firstPrompt.id
      onPromptChange(firstPrompt.id, firstPrompt.content)
    }
  } catch (error) {
    console.error('Failed to load prompts:', error)
  }

  // Add click outside handler to close dropdown
  document.addEventListener('click', handleClickOutside)
})

// Watch for project changes and load clips
watch(() => props.projectId, async (projectId) => {
  if (projectId) {
    await loadClipsAndHistory(projectId)
  } else {
    clips.value = []
    detectionSessions.value = []
  }
}, { immediate: true })

// Watch for generation state changes to refresh clips when generation completes
watch([() => props.isGenerating, () => props.generationProgress], async ([isGenerating, progress]) => {
  if (!isGenerating && progress === 100 && props.projectId) {
    console.log('[ClipsPanel] Generation completed, refreshing clips...')
    // Add a small delay to ensure database writes are committed
    setTimeout(async () => {
      await loadClipsAndHistory(props.projectId!)
    }, 500)
  }
})

// Load clips and detection history
async function loadClipsAndHistory(projectId: string) {
  if (!projectId) return

  loadingClips.value = true
  try {
    console.log('[ClipsPanel] Loading clips for project:', projectId)

    // Load current clips with versions
    clips.value = await getClipsWithVersionsByProjectId(projectId)
    console.log('[ClipsPanel] Loaded clips:', clips.value.length)
    if (clips.value.length > 0) {
      const firstClip = clips.value[0]
      console.log('[ClipsPanel] Sample clip data:', {
        id: firstClip.id,
        name: firstClip.current_version?.name || firstClip.name,
        hasCurrentVersion: !!firstClip.current_version,
        sessionId: firstClip.detection_session_id,
        runNumber: firstClip.run_number,
        // Timing data from different sources
        base_start_time: firstClip.start_time,
        base_end_time: firstClip.end_time,
        version_start_time: firstClip.current_version?.start_time,
        version_end_time: firstClip.current_version?.end_time,
        // Final calculated values used in UI
        final_start_time: firstClip.current_version?.start_time || firstClip.start_time || 0,
        final_end_time: firstClip.current_version?.end_time || firstClip.end_time || 0,
        final_duration: (firstClip.current_version?.end_time || firstClip.end_time || 0) - (firstClip.current_version?.start_time || firstClip.start_time || 0)
      })
    }

    // Load detection sessions for history
    detectionSessions.value = await getClipDetectionSessionsByProjectId(projectId)
    console.log('[ClipsPanel] Loaded detection sessions:', detectionSessions.value.length)

  } catch (error) {
    console.error('[ClipsPanel] Failed to load clips:', error)
  } finally {
    loadingClips.value = false
  }
}

function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getTags(tagsString?: string): string[] {
  if (!tagsString) return []
  try {
    return JSON.parse(tagsString)
  } catch {
    return []
  }
}

async function refreshClips() {
  console.log('[ClipsPanel] Manual refresh triggered')
  if (props.projectId) {
    await loadClipsAndHistory(props.projectId)
  }
}

function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement
  if (!target.closest('.relative')) {
    showPromptDropdown.value = false
  }
}


function handleDetectClips() {
  emit('detectClips', selectedPrompt.value)
}

function onPromptChange(promptId: string, promptContent: string) {
  selectedPromptId.value = promptId
  selectedPrompt.value = promptContent
  showPromptDropdown.value = false
}

function togglePromptDropdown() {
  showPromptDropdown.value = !showPromptDropdown.value
}

// Computed properties for progress display
const stageIcon = computed(() => {
  switch (props.generationStage) {
    case 'starting':
      return PlayIcon
    case 'transcribing':
      return MicIcon
    case 'analyzing':
      return BrainIcon
    case 'validating':
      return ActivityIcon
    case 'completed':
      return CheckCircleIcon
    case 'error':
      return XCircleIcon
    default:
      return PlayIcon
  }
})

const stageIconClass = computed(() => {
  switch (props.generationStage) {
    case 'starting':
      return 'text-blue-500'
    case 'transcribing':
      return 'text-yellow-500'
    case 'analyzing':
      return 'text-purple-500'
    case 'validating':
      return 'text-orange-500'
    case 'completed':
      return 'text-green-500'
    case 'error':
      return 'text-red-500'
    default:
      return 'text-gray-500'
  }
})

const stageTitle = computed(() => {
  switch (props.generationStage) {
    case 'starting':
      return 'Initializing'
    case 'transcribing':
      return 'Transcribing Audio'
    case 'analyzing':
      return 'Detecting Clips'
    case 'validating':
      return 'Validating Results'
    case 'completed':
      return 'Completed'
    case 'error':
      return 'Error'
    default:
      return 'Processing'
  }
})

const stageDescription = computed(() => {
  switch (props.generationStage) {
    case 'starting':
      return 'Preparing to process your video...'
    case 'transcribing':
      return 'Converting audio to text using AI...'
    case 'analyzing':
      return 'Analyzing transcript for clip-worthy moments...'
    case 'validating':
      return 'Validating timestamps and refining clips...'
    case 'completed':
      return 'Clips have been successfully generated!'
    case 'error':
      return 'An error occurred during processing.'
    default:
      return 'Processing your request...'
  }
})

const progressBarClass = computed(() => {
  switch (props.generationStage) {
    case 'transcribing':
      return 'bg-yellow-500'
    case 'analyzing':
      return 'bg-purple-500'
    case 'validating':
      return 'bg-orange-500'
    case 'completed':
      return 'bg-green-500'
    case 'error':
      return 'bg-red-500'
    default:
      return 'bg-blue-500'
  }
})

// Expose methods for external access
defineExpose({
  refreshClips
})

// Event listener for fallback refresh mechanism
function handleRefreshEvent(event: CustomEvent) {
  console.log('[ClipsPanel] Received refresh event for project:', event.detail?.projectId)
  if (event.detail?.projectId === props.projectId) {
    refreshClips()
  }
}

onMounted(() => {
  // Add event listener for refresh events
  document.addEventListener('refresh-clips', handleRefreshEvent as EventListener)
})

onUnmounted(() => {
  // Remove event listener to prevent memory leaks
  document.removeEventListener('refresh-clips', handleRefreshEvent as EventListener)
})
</script>

<style scoped>
/* Smooth transitions */
.transition-colors {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

.transition-transform {
  transition-property: transform;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 300ms;
}

.ease-in-out {
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
}

.rotate-180 {
  transform: rotate(180deg);
}

.transition-all {
  transition-property: all;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 200ms;
}

@keyframes shine {
  0% {
    transform: translateX(-100%) skewX(-12deg);
  }
  100% {
    transform: translateX(200%) skewX(-12deg);
  }
}

.animate-shine {
  animation: shine 2s infinite;
}
</style>