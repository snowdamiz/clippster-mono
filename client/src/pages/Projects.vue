<template>
  <PageLayout
    title="Projects"
    description="Manage and organize your video projects"
    :show-header="!loading && projects.length > 0"
    icon="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
  >
    <template #actions>
      <button 
        @click="openCreateDialog"
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Project
      </button>
    </template>

    <!-- Loading State -->
    <LoadingState v-if="loading" message="Loading projects..." />

    <!-- Projects Grid -->
    <div v-else-if="projects.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div v-for="project in projects" :key="project.id" class="relative bg-card border border-border rounded-lg overflow-hidden hover:border-foreground/20 cursor-pointer group" @click="openWorkspace(project)">
        <!-- Thumbnail background with vignette -->
        <div
          v-if="getThumbnailUrl(project.id)"
          class="absolute inset-0 z-0"
          :style="{
            backgroundImage: `url(${getThumbnailUrl(project.id)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat'
          }"
        >
          <!-- Dark vignette overlay -->
          <div class="absolute inset-0 bg-gradient-to-br from-black/80 via-black/60 to-black/90"></div>
        </div>

        <div class="relative z-10 p-4.5 pb-5">
          <div class="flex items-start justify-between mb-5">
            <div :class="[
              'p-3 rounded-lg',
              getThumbnailUrl(project.id)
                ? 'bg-white/10 backdrop-blur-sm'
                : 'bg-muted'
            ]">
              <svg :class="[
                'h-6 w-6',
                getThumbnailUrl(project.id)
                  ? 'text-white'
                  : 'text-foreground'
              ]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span :class="[
              'text-xs px-2 py-1 rounded-md',
              getThumbnailUrl(project.id)
                ? 'text-white/70 bg-white/10 backdrop-blur-sm'
                : 'text-muted-foreground bg-muted'
            ]">{{ getRelativeTime(project.updated_at) }}</span>
          </div>
          <h3 :class="[
            'text-lg font-semibold mb-2 group-hover:transition-colors',
            getThumbnailUrl(project.id)
              ? 'text-white group-hover:text-white/80'
              : 'text-foreground group-hover:text-foreground/80'
          ]">{{ project.name }}</h3>
          <p :class="[
            'text-sm line-clamp-2',
            getThumbnailUrl(project.id)
              ? 'text-white/80'
              : 'text-muted-foreground'
          ]">{{ project.description || 'No description' }}</p>
        </div>
        <div :class="[
          'flex items-center justify-between px-4 py-2 border-t',
          getThumbnailUrl(project.id)
            ? 'border-white/10 bg-black/40 backdrop-blur-sm'
            : 'border-border bg-[#141414]'
        ]">
          <span :class="[
            'text-sm font-medium',
            getThumbnailUrl(project.id)
              ? 'text-white/80'
              : 'text-muted-foreground'
          ]">{{ getClipCount(project.id) }} clips</span>
          <div class="flex items-center gap-1">
            <button :class="[
              'p-2 rounded-md transition-colors',
              getThumbnailUrl(project.id)
                ? 'hover:bg-white/10'
                : 'hover:bg-muted'
            ]" title="Edit" @click.stop="editProject(project)">
              <svg :class="[
                'h-4 w-4 transition-colors',
                getThumbnailUrl(project.id)
                  ? 'text-white/60 hover:text-white'
                  : 'text-muted-foreground hover:text-foreground'
              ]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button :class="[
              'p-2 rounded-md transition-colors',
              getThumbnailUrl(project.id)
                ? 'hover:bg-white/10'
                : 'hover:bg-muted'
            ]" title="Delete" @click.stop="confirmDelete(project)">
              <svg :class="[
                'h-4 w-4 transition-colors',
                getThumbnailUrl(project.id)
                  ? 'text-white/60 hover:text-white'
                  : 'text-muted-foreground hover:text-foreground'
              ]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="No projects yet"
      description="Create your first project to get started"
      button-text="Create Project"
      @action="openCreateDialog"
    />
    
    <!-- Project Dialog -->
    <ProjectDialog
      v-model="showDialog"
      :project="selectedProject"
      @submit="handleProjectSubmit"
    />

    <!-- Project Workspace Dialog -->
    <ProjectWorkspaceDialog
      v-model="showWorkspaceDialog"
      :project="workspaceProject"
    />

    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="handleDeleteDialogClose"
    >
      <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">
          {{ (projectHasVideos || projectHasClips) ? 'Delete Project with Content' : 'Delete Project' }}
        </h2>

        <div class="space-y-4">
          <p class="text-muted-foreground">
            <span v-if="projectHasVideos && projectHasClips">
              This project contains both videos and detected clips. Deleting this project will remove the project structure, but all videos and clips will remain in your library. Are you sure you want to delete
            </span>
            <span v-else-if="projectHasVideos">
              This project contains videos. Deleting this project will remove the project structure, but all videos will remain in your library. Are you sure you want to delete
            </span>
            <span v-else-if="projectHasClips">
              This project contains detected clips. Deleting this project will remove the project structure, but all clips will remain in your library. Are you sure you want to delete
            </span>
            <span v-else>
              Are you sure you want to delete
            </span>
            "<span class="font-semibold text-foreground">{{ projectToDelete?.name }}</span>"? This action cannot be undone.
          </p>

          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="deleteProjectConfirmed"
          >
            Delete Project
          </button>

          <button
            class="w-full py-3 bg-muted text-foreground rounded-lg font-semibold hover:bg-muted/80 transition-all"
            @click="handleDeleteDialogClose"
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
import { invoke } from '@tauri-apps/api/core'
import { getAllProjects, getClipsByProjectId, deleteProject, createProject, updateProject, getRawVideosByProjectId, getAllRawVideos, updateRawVideo, hasRawVideosForProject, hasClipsForProject, type Project, type RawVideo } from '@/services/database'
import { useFormatters } from '@/composables/useFormatters'
import { useToast } from '@/composables/useToast'
import PageLayout from '@/components/PageLayout.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ProjectDialog, { type ProjectFormData } from '@/components/ProjectDialog.vue'
import ProjectWorkspaceDialog from '@/components/ProjectWorkspaceDialog.vue'

const projects = ref<Project[]>([])
const loading = ref(true)
const clipCounts = ref<Record<string, number>>({})
const showDialog = ref(false)
const selectedProject = ref<Project | null>(null)
const showDeleteDialog = ref(false)
const projectToDelete = ref<Project | null>(null)
const projectHasVideos = ref(false)
const projectHasClips = ref(false)
const showWorkspaceDialog = ref(false)
const workspaceProject = ref<Project | null>(null)
const projectVideos = ref<Record<string, RawVideo[]>>({})
const thumbnailCache = ref<Map<string, string>>(new Map())
const { getRelativeTime } = useFormatters()
const { success, error } = useToast()

async function loadProjects() {
  loading.value = true
  try {
    projects.value = await getAllProjects()

    // Get all available videos to help with recovery
    const allVideos = await getAllRawVideos()
    console.log(`[Projects] Total videos in database: ${allVideos.length}`)

    // Load clip counts and video thumbnails for each project
    for (const project of projects.value) {
      const clips = await getClipsByProjectId(project.id)
      clipCounts.value[project.id] = clips.length

      // Load videos for this project
      const videos = await getRawVideosByProjectId(project.id)
      projectVideos.value[project.id] = videos

      console.log(`[Projects] Project ${project.name} (${project.id}):`)
      console.log(`  - Videos: ${videos.length}`)

      // Load project thumbnail or use first video's thumbnail
      if (!thumbnailCache.value.has(project.id)) {
        if (project.thumbnail_path) {
          // Use project's stored thumbnail if available
          try {
            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: project.thumbnail_path
            })
            thumbnailCache.value.set(project.id, dataUrl)
            console.log(`  - Project thumbnail loaded: ${project.thumbnail_path}`)
          } catch (error) {
            console.warn('Failed to load project thumbnail:', project.id, error)
          }
        } else if (videos.length > 0 && videos[0].thumbnail_path) {
          // Fall back to first video's thumbnail
          try {
            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: videos[0].thumbnail_path
            })
            thumbnailCache.value.set(project.id, dataUrl)
            console.log(`  - Video thumbnail loaded: ${videos[0].thumbnail_path}`)

            // Save this thumbnail to the project for future use
            await updateProject(project.id, undefined, undefined, videos[0].thumbnail_path)
          } catch (error) {
            console.warn('Failed to load video thumbnail for project:', project.id, error)
          }
        }
      }
    }
  } catch (error) {
    console.error('Failed to load projects:', error)
  } finally {
    loading.value = false
  }
}

function getClipCount(projectId: string): number {
  return clipCounts.value[projectId] || 0
}

function getThumbnailUrl(projectId: string): string | null {
  return thumbnailCache.value.get(projectId) || null
}

function openCreateDialog() {
  selectedProject.value = null
  showDialog.value = true
}

function openWorkspace(project: Project) {
  workspaceProject.value = project
  showWorkspaceDialog.value = true
}

function editProject(project: Project) {
  selectedProject.value = project
  showDialog.value = true
}

async function handleProjectSubmit(data: ProjectFormData) {
  try {
    if (selectedProject.value) {
      // Update existing project
      await updateProject(
        selectedProject.value.id,
        data.name,
        data.description || undefined
      )

      // Update video association if changed
      if (data.selectedVideoId !== undefined) {
        // First, remove existing video associations for this project
        const existingVideos = await getRawVideosByProjectId(selectedProject.value.id)
        for (const video of existingVideos) {
          await updateRawVideo(video.id, { project_id: null })
        }

        // Then associate the new video
        if (data.selectedVideoId) {
          await updateRawVideo(data.selectedVideoId, { project_id: selectedProject.value.id })
        }
      }

      success('Project updated', `"${data.name}" has been updated successfully`)
    } else {
      // Create new project
      const projectId = await createProject(
        data.name,
        data.description || undefined
      )

      // Associate the selected video with the new project
      if (data.selectedVideoId) {
        await updateRawVideo(data.selectedVideoId, { project_id: projectId })
      }

      success('Project created', `"${data.name}" has been created successfully`)
    }

    // Reload projects
    await loadProjects()

    if (!selectedProject.value) {
      // For new projects, find the newly created project and open workspace
      const newProject = projects.value.find(p => p.name === data.name)
      if (newProject) {
        workspaceProject.value = newProject
        showWorkspaceDialog.value = true
      }
    }

    // Close dialog
    showDialog.value = false
    selectedProject.value = null
  } catch (err) {
    console.error('Failed to save project:', err)
    error(
      selectedProject.value ? 'Failed to update project' : 'Failed to create project',
      'An error occurred while saving the project. Please try again.'
    )
  }
}

async function confirmDelete(project: Project) {
  projectToDelete.value = project

  // Check if project has videos and clips
  try {
    projectHasVideos.value = await hasRawVideosForProject(project.id)
    projectHasClips.value = await hasClipsForProject(project.id)
    showDeleteDialog.value = true
  } catch (err) {
    console.error('Failed to check project contents:', err)
    // If we can't check, proceed with normal deletion
    projectHasVideos.value = false
    projectHasClips.value = false
    showDeleteDialog.value = true
  }
}

function handleDeleteDialogClose() {
  showDeleteDialog.value = false
  projectHasVideos.value = false
  projectHasClips.value = false
  projectToDelete.value = null
}

async function deleteProjectConfirmed() {
  if (!projectToDelete.value) return

  const deletedProjectName = projectToDelete.value.name

  try {
    await deleteProject(projectToDelete.value.id)
    success('Project deleted', `"${deletedProjectName}" has been deleted successfully`)
    await loadProjects()
  } catch (err) {
    console.error('Failed to delete project:', err)
    error('Failed to delete project', 'An error occurred while deleting the project. Please try again.')
  } finally {
    showDeleteDialog.value = false
    projectHasVideos.value = false
    projectHasClips.value = false
    projectToDelete.value = null
  }
}

onMounted(() => {
  loadProjects()
})
</script>
