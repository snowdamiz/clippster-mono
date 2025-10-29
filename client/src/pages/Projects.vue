<template>
  <PageLayout
    title="Projects"
    description="Manage and organize your video projects"
    :show-header="!loading && projects.length > 0"
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
      <div v-for="project in projects" :key="project.id" class="bg-card border border-border rounded-xl overflow-hidden hover:border-foreground/20 cursor-pointer group">
        <div class="p-4.5 pb-5">
          <div class="flex items-start justify-between mb-5">
            <div class="p-3 bg-muted rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
            </div>
            <span class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">{{ getRelativeTime(project.updated_at) }}</span>
          </div>
          <h3 class="text-lg font-semibold text-foreground mb-2 group-hover:text-foreground/80">{{ project.name }}</h3>
          <p class="text-sm text-muted-foreground line-clamp-2">{{ project.description || 'No description' }}</p>
        </div>
        <div class="flex items-center justify-between px-4 py-2 border-t border-border">
          <span class="text-sm text-muted-foreground font-medium">{{ getClipCount(project.id) }} clips</span>
          <div class="flex items-center gap-1">
            <button class="p-2 hover:bg-muted rounded-md" title="Edit" @click.stop="editProject(project)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button class="p-2 hover:bg-muted rounded-md" title="Delete" @click.stop="confirmDelete(project)">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-muted-foreground hover:text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
    
    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showDeleteDialog = false"
    >
      <div class="bg-card rounded-2xl p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">Delete Project</h2>
        
        <div class="space-y-4">
          <p class="text-muted-foreground">
            Are you sure you want to delete "<span class="font-semibold text-foreground">{{ projectToDelete?.name }}</span>"? This action cannot be undone.
          </p>

          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="deleteProjectConfirmed"
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
import { getAllProjects, getClipsByProjectId, deleteProject, createProject, updateProject, type Project } from '@/services/database'
import { useFormatters } from '@/composables/useFormatters'
import { useToast } from '@/composables/useToast'
import PageLayout from '@/components/PageLayout.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'
import ProjectDialog from '@/components/ProjectDialog.vue'

const projects = ref<Project[]>([])
const loading = ref(true)
const clipCounts = ref<Record<string, number>>({})
const showDialog = ref(false)
const selectedProject = ref<Project | null>(null)
const showDeleteDialog = ref(false)
const projectToDelete = ref<Project | null>(null)
const { getRelativeTime } = useFormatters()
const { success, error } = useToast()

async function loadProjects() {
  loading.value = true
  try {
    projects.value = await getAllProjects()
    
    // Load clip counts for each project
    for (const project of projects.value) {
      const clips = await getClipsByProjectId(project.id)
      clipCounts.value[project.id] = clips.length
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

function openCreateDialog() {
  selectedProject.value = null
  showDialog.value = true
}

function editProject(project: Project) {
  selectedProject.value = project
  showDialog.value = true
}

async function handleProjectSubmit(data: { name: string; description: string; rawVideoPath: string }) {
  try {
    if (selectedProject.value) {
      // Update existing project
      await updateProject(
        selectedProject.value.id,
        data.name,
        data.description || undefined,
        data.rawVideoPath || undefined
      )
      success('Project updated', `"${data.name}" has been updated successfully`)
    } else {
      // Create new project
      await createProject(
        data.name,
        data.description || undefined,
        data.rawVideoPath || undefined
      )
      success('Project created', `"${data.name}" has been created successfully`)
    }
    
    // Reload projects and close dialog
    await loadProjects()
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

function confirmDelete(project: Project) {
  projectToDelete.value = project
  showDeleteDialog.value = true
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
    projectToDelete.value = null
  }
}

onMounted(() => {
  loadProjects()
})
</script>
