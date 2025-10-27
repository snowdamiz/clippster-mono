<template>
  <PageLayout
    title="Projects"
    description="Manage and organize your video projects"
    :show-header="!loading && projects.length > 0"
  >
    <template #actions>
      <button class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-lg flex items-center gap-2 font-medium shadow-sm transition-all">
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
      <div v-for="project in projects" :key="project.id" class="bg-card border border-border rounded-xl p-6 hover:border-foreground/20 cursor-pointer group">
        <div class="flex items-start justify-between mb-5">
          <div class="p-3 bg-muted rounded-lg">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          </div>
          <span class="text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">{{ getRelativeTime(project.updated_at) }}</span>
        </div>
        <h3 class="text-lg font-semibold text-foreground mb-2 group-hover:text-foreground/80">{{ project.name }}</h3>
        <p class="text-sm text-muted-foreground mb-5 line-clamp-2">{{ project.description || 'No description' }}</p>
        <div class="flex items-center justify-between pt-4 border-t border-border">
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
    />
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getAllProjects, getClipsByProjectId, deleteProject, type Project } from '@/services/database'
import { useFormatters } from '@/composables/useFormatters'
import PageLayout from '@/components/PageLayout.vue'
import LoadingState from '@/components/LoadingState.vue'
import EmptyState from '@/components/EmptyState.vue'

const projects = ref<Project[]>([])
const loading = ref(true)
const clipCounts = ref<Record<string, number>>({})
const { getRelativeTime } = useFormatters()

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

function editProject(project: Project) {
  // TODO: Implement edit functionality
  console.log('Edit project:', project)
}

async function confirmDelete(project: Project) {
  // TODO: Add proper confirmation dialog
  if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
    try {
      await deleteProject(project.id)
      await loadProjects()
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }
}

onMounted(() => {
  loadProjects()
})
</script>
