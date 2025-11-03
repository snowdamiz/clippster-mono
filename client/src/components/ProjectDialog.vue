<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="close"
    >
      <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-6">{{ isEdit ? 'Edit Project' : 'Create Project' }}</h2>
        
        <form @submit.prevent="handleSubmit" class="space-y-5">
          <!-- Project Name -->
          <div>
            <label for="project-name" class="block text-sm font-medium text-foreground mb-2">
              Project Name <span class="text-red-500">*</span>
            </label>
            <input
              id="project-name"
              v-model="formData.name"
              type="text"
              required
              placeholder="Enter project name"
              class="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all"
              :class="{ 'border-red-500': errors.name }"
            />
            <p v-if="errors.name" class="mt-1 text-sm text-red-500">{{ errors.name }}</p>
          </div>

          <!-- Description -->
          <div>
            <label for="project-description" class="block text-sm font-medium text-foreground mb-2">
              Description
            </label>
            <textarea
              id="project-description"
              v-model="formData.description"
              rows="3"
              placeholder="Enter project description (optional)"
              class="w-full px-4 py-3 bg-muted border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500 transition-all resize-none"
            />
          </div>

          <!-- Video Selection -->
          <div>
            <label class="block text-sm font-medium text-foreground mb-2">
              Raw Video <span class="text-red-500">*</span>
            </label>
            
            <!-- Selected Video Display -->
            <div v-if="selectedVideo" class="mb-3 p-3 bg-muted/50 rounded-lg border border-border flex items-center gap-3">
              <div class="w-20 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
                <img 
                  v-if="getThumbnailUrl(selectedVideo)"
                  :src="getThumbnailUrl(selectedVideo)!"
                  :alt="selectedVideo.original_filename || 'Video thumbnail'"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-foreground truncate">
                  {{ selectedVideo.original_filename || selectedVideo.file_path.split(/[\\\/]/).pop() || 'Untitled Video' }}
                </p>
                <p class="text-xs text-muted-foreground" v-if="selectedVideo.duration">
                  Duration: {{ formatDuration(selectedVideo.duration) }}
                </p>
              </div>
              <button
                type="button"
                @click="clearVideoSelection"
                class="p-1 hover:bg-muted rounded"
                title="Remove selection"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <!-- Select Video Button -->
            <button
              type="button"
              @click="showVideoSelector = true"
              class="w-full px-4 py-3 bg-muted hover:bg-muted/80 border rounded-lg text-foreground transition-all flex items-center justify-center gap-2"
              :class="{ 'border-red-500': errors.selectedVideoId }"
            >
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Select from Video Library
            </button>
            <p v-if="errors.selectedVideoId" class="mt-1 text-sm text-red-500">{{ errors.selectedVideoId }}</p>
          </div>

          <!-- Action Buttons -->
          <div class="flex gap-3 pt-4">
            <button
              type="submit"
              :disabled="loading"
              class="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {{ loading ? 'Saving...' : (isEdit ? 'Update Project' : 'Create Project') }}
            </button>
            <button
              type="button"
              @click="close"
              :disabled="loading"
              class="flex-1 py-3 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
    
    <!-- Video Selector Modal -->
    <div
      v-if="showVideoSelector"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60]"
      @click.self="showVideoSelector = false"
    >
      <div class="bg-card rounded-2xl p-6 max-w-4xl w-full mx-4 border border-border max-h-[80vh] flex flex-col relative">
        <!-- Close Button (Top Right) -->
        <button
          @click="showVideoSelector = false"
          class="absolute top-6 right-6 z-30 p-2 bg-black/40 hover:bg-black/60 backdrop-blur-sm rounded-lg transition-colors"
          title="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <h3 class="text-xl font-bold mb-4">Select a Video</h3>
        
        <!-- Videos Grid -->
        <div class="flex-1 overflow-y-auto">
          <!-- Header with video count -->
          <div v-if="availableVideos.length > 0" class="flex items-center justify-between mb-4">
            <p class="text-sm text-muted-foreground">
              {{ videoCountInfo }}
              <span v-if="totalPages > 1">• Page {{ currentPage }} of {{ totalPages }}</span>
            </p>
          </div>

          <div v-if="availableVideos.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            <button
              v-for="video in paginatedVideos"
              :key="video.id"
              type="button"
              @click="selectVideoFromLibrary(video)"
              class="group relative bg-card border-2 rounded-lg overflow-hidden transition-all"
              :class="[
                selectedVideo?.id === video.id ? 'border-purple-500' : 'border-border',
                isVideoAvailable(video) ? 'hover:border-foreground/20' : 'opacity-60 cursor-not-allowed'
              ]"
              :disabled="!isVideoAvailable(video)"
            >
              <!-- Thumbnail -->
              <div class="aspect-video bg-muted/50 relative">
                <img
                  v-if="getThumbnailUrl(video)"
                  :src="getThumbnailUrl(video)!"
                  :alt="video.original_filename || 'Video thumbnail'"
                  class="w-full h-full object-cover"
                  :class="{ 'filter brightness-75': !isVideoAvailable(video) }"
                />
                <div v-else class="absolute inset-0 flex items-center justify-center" :class="{ 'opacity-50': !isVideoAvailable(video) }">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>

                <!-- Status Badge -->
                <div class="absolute top-2 left-2">
                  <span
                    class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm"
                    :class="[
                      isVideoAvailable(video)
                        ? 'bg-green-500/80 text-white'
                        : video.project_id === props.project?.id
                          ? 'bg-blue-500/80 text-white'
                          : 'bg-orange-500/80 text-white'
                    ]"
                  >
                    {{ getVideoStatusText(video) }}
                  </span>
                </div>

                <!-- Selected Indicator -->
                <div v-if="selectedVideo?.id === video.id" class="absolute inset-0 bg-purple-500/20 flex items-center justify-center">
                  <div class="bg-purple-600 rounded-full p-1">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-white" viewBox="0 0 20 20" fill="currentColor">
                      <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              <!-- Info -->
              <div class="p-2">
                <p class="text-xs font-medium text-foreground truncate">
                  {{ video.original_filename || video.file_path.split(/[\\\/]/).pop() || 'Video' }}
                </p>
                <p class="text-xs text-muted-foreground" v-if="video.duration">
                  {{ formatDuration(video.duration) }}
                </p>
              </div>
            </button>
          </div>
          
          <!-- Empty State -->
          <div v-else class="py-12 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-muted-foreground mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p class="text-muted-foreground">{{ emptyStateMessage }}</p>
          </div>
        </div>
        
        <!-- Pagination Controls (shown when there are multiple pages) -->
        <div
          v-if="totalPages > 1"
          class="mt-6 pt-5 px-5 -mx-6 border-t border-border"
        >
          <div class="flex items-center justify-between">
            <!-- Page info -->
            <div class="text-sm text-muted-foreground">
              Page {{ currentPage }} of {{ totalPages }}
            </div>

            <!-- Pagination Controls -->
            <div class="flex items-center gap-2 rounded-md">
              <!-- Previous Button -->
              <button
                @click="previousPage"
                :disabled="currentPage === 1"
                class="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all text-sm"
                title="Previous page"
              >
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                </svg>
                Previous
              </button>

              <!-- Page Numbers -->
              <div class="flex items-center gap-1">
                <!-- Generate page numbers with smart ellipsis -->
                <template v-for="page in totalPages" :key="page">
                  <!-- Show first page -->
                  <button
                    v-if="page === 1"
                    @click="goToPage(page)"
                    :class="[
                      'px-2.5 py-1.5 rounded-md transition-all text-sm font-medium',
                      currentPage === page
                        ? 'text-purple-500'
                        : 'hover:bg-muted/80 text-foreground'
                    ]"
                  >
                    {{ page }}
                  </button>

                  <!-- Show ellipsis before current page range -->
                  <span v-else-if="page === currentPage - 2 && page > 2" class="px-1.5 text-muted-foreground text-sm">...</span>

                  <!-- Show pages around current -->
                  <button
                    v-else-if="page >= currentPage - 1 && page <= currentPage + 1"
                    @click="goToPage(page)"
                    :class="[
                      'px-2.5 py-1.5 rounded-md transition-all text-sm font-medium',
                      currentPage === page
                        ? 'text-purple-500'
                        : 'hover:bg-muted/80 text-foreground'
                    ]"
                  >
                    {{ page }}
                  </button>

                  <!-- Show ellipsis after current page range -->
                  <span v-else-if="page === currentPage + 2 && page < totalPages - 1" class="px-1.5 text-muted-foreground text-sm">...</span>

                  <!-- Show last page -->
                  <button
                    v-else-if="page === totalPages && totalPages > 1"
                    @click="goToPage(page)"
                    :class="[
                      'px-2.5 py-1.5 rounded-md transition-all text-sm font-medium',
                      currentPage === page
                        ? 'bg-purple-500 text-white'
                        : 'hover:bg-muted/80 text-foreground'
                    ]"
                  >
                    {{ page }}
                  </button>
                </template>
              </div>

              <!-- Next Button -->
              <button
                @click="nextPage"
                :disabled="currentPage === totalPages"
                class="flex items-center gap-2 px-3 py-1.5 hover:bg-muted/80 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-all text-sm"
                title="Next page"
              >
                Next
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, reactive, computed } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getAllRawVideos, getProject, type Project, type RawVideo } from '@/services/database'
import { useFormatters } from '@/composables/useFormatters'

export interface ProjectFormData {
  name: string
  description: string
  selectedVideoId?: string
}

const props = defineProps<{
  modelValue: boolean
  project?: Project | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'submit': [data: ProjectFormData]
}>()

const loading = ref(false)
const isEdit = ref(false)
const formData = reactive<ProjectFormData>({
  name: '',
  description: '',
  selectedVideoId: ''
})

const errors = reactive<Partial<Record<keyof ProjectFormData, string>>>({})
const showVideoSelector = ref(false)
const availableVideos = ref<RawVideo[]>([])
const selectedVideo = ref<RawVideo | null>(null)
const thumbnailCache = ref<Map<string, string>>(new Map())
const projectCache = ref<Map<string, string>>(new Map())
const { formatDuration } = useFormatters()

// Pagination state
const currentPage = ref(1)
const videosPerPage = 8

// Pagination computed properties
const totalPages = computed(() => Math.ceil(availableVideos.value.length / videosPerPage))
const paginatedVideos = computed(() => {
  const startIndex = (currentPage.value - 1) * videosPerPage
  const endIndex = startIndex + videosPerPage
  return availableVideos.value.slice(startIndex, endIndex)
})

// Computed property for empty state message
const emptyStateMessage = computed(() => {
  return 'No videos found. Upload some videos to get started.'
})

// Computed property for video count breakdown
const videoCountInfo = computed(() => {
  const total = availableVideos.value.length
  const available = availableVideos.value.filter(v => isVideoAvailable(v)).length
  const unavailable = total - available

  if (unavailable > 0) {
    return `${total} video${total !== 1 ? 's' : ''} (${available} available, ${unavailable} in projects)`
  }
  return `${total} video${total !== 1 ? 's' : ''} available`
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

// Reset to first page when available videos change
watch(availableVideos, () => {
  currentPage.value = 1
})

// Watch for project prop changes to populate form for editing
watch(() => props.project, (newProject) => {
  if (newProject) {
    isEdit.value = true
    formData.name = newProject.name
    formData.description = newProject.description || ''
    // Try to find a video associated with this project
    if (availableVideos.value.length > 0) {
      const matchingVideo = availableVideos.value.find(v => v.project_id === newProject.id)
      if (matchingVideo) {
        selectedVideo.value = matchingVideo
      }
    }
  } else {
    isEdit.value = false
    resetForm()
  }
}, { immediate: true })

// Reset form when dialog opens/closes
watch(() => props.modelValue, (isOpen) => {
  if (isOpen) {
    loadAvailableVideos()
    if (!props.project) {
      resetForm()
    }
  }
})

function resetForm() {
  formData.name = ''
  formData.description = ''
  selectedVideo.value = null
  Object.keys(errors).forEach(key => delete errors[key as keyof ProjectFormData])
}

function validateForm(): boolean {
  Object.keys(errors).forEach(key => delete errors[key as keyof ProjectFormData])

  if (!formData.name.trim()) {
    errors.name = 'Project name is required'
    return false
  }

  if (formData.name.trim().length < 2) {
    errors.name = 'Project name must be at least 2 characters'
    return false
  }

  // Require video selection for new projects (not when editing)
  if (!isEdit.value && !selectedVideo.value) {
    errors.selectedVideoId = 'Video file is required'
    return false
  }

  return true
}

async function handleSubmit() {
  if (!validateForm()) return
  
  loading.value = true
  try {
    emit('submit', {
      name: formData.name.trim(),
      description: formData.description.trim(),
      selectedVideoId: selectedVideo.value?.id
    })
  } finally {
    loading.value = false
  }
}

function selectVideoFromLibrary(video: RawVideo) {
  if (!isVideoAvailable(video)) {
    // Provide feedback about why the video can't be selected
    if (video.project_id && projectCache.value.has(video.project_id)) {
      const projectName = projectCache.value.get(video.project_id)
      // Could add a toast notification here if you have one available
      console.log(`This video is already assigned to project: ${projectName}`)
    }
    return // Don't allow selection of videos that are already associated with other projects
  }
  selectedVideo.value = video
  showVideoSelector.value = false
}

function clearVideoSelection() {
  selectedVideo.value = null
}

function getThumbnailUrl(video: RawVideo): string | null {
  return thumbnailCache.value.get(video.id) || null
}

function isVideoAvailable(video: RawVideo): boolean {
  // Video is available if it has no project association
  // or if editing and it's associated with the current project
  if (isEdit.value && props.project && video.project_id === props.project.id) {
    return true
  }
  return video.project_id === null
}

async function getProjectName(projectId: string): Promise<string> {
  // Check cache first
  if (projectCache.value.has(projectId)) {
    return projectCache.value.get(projectId)!
  }

  try {
    const project = await getProject(projectId)
    const projectName = project?.name || 'Unknown Project'
    projectCache.value.set(projectId, projectName)
    return projectName
  } catch (error) {
    console.warn('Failed to get project name:', projectId, error)
    const fallbackName = 'Unknown Project'
    projectCache.value.set(projectId, fallbackName)
    return fallbackName
  }
}

function getVideoStatusText(video: RawVideo): string {
  if (isEdit.value && props.project && video.project_id === props.project.id) {
    return 'Current Project'
  }
  if (video.project_id) {
    const projectName = projectCache.value.get(video.project_id)
    return projectName ? `In: ${projectName}` : 'In Project'
  }
  return 'Available'
}

async function loadAvailableVideos() {
  try {
    const allVideos = await getAllRawVideos()
    // Show all videos, but indicate which ones are available
    availableVideos.value = allVideos

    // Load thumbnails and project names
    for (const video of availableVideos.value) {
      // Load thumbnails
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

      // Load project names for videos that have project associations
      if (video.project_id && !projectCache.value.has(video.project_id)) {
        try {
          await getProjectName(video.project_id)
        } catch (error) {
          console.warn('Failed to load project name for video:', video.id, error)
        }
      }
    }
  } catch (error) {
    console.error('Failed to load available videos:', error)
  }
}

function close() {
  if (!loading.value) {
    emit('update:modelValue', false)
  }
}
</script>