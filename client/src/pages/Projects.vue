<template>
  <PageLayout
    title="Projects"
    description="Manage and organize your video projects"
    :show-header="projects.length > 0"
    :icon="Folder"
  >
    <template #actions>
      <button
        @click="openCreateDialog"
        class="px-5 py-2.5 bg-gradient-to-br from-purple-500/80 to-indigo-500/80 hover:from-purple-500/90 hover:to-indigo-500/90 text-white rounded-md flex items-center gap-2 font-medium shadow-sm transition-all"
      >
        <Plus class="h-5 w-5" />
        New Project
      </button>
    </template>
    <!-- Loading State -->
    <div v-if="loading" class="space-y-6">
      <SkeletonGrid />
    </div>
    <!-- Projects Grid -->

    <div v-else-if="projects.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="project in paginatedProjects"
        :key="project.id"
        class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
        @click="openWorkspace(project)"
      >
        <!-- Thumbnail background with vignette -->
        <div
          v-if="getThumbnailUrl(project.id)"
          class="absolute inset-0 z-0"
          :style="{
            backgroundImage: `url(${getThumbnailUrl(project.id)})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }"
        >
          <!-- Dark vignette overlay -->
          <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/20 to-black/60"></div>
        </div>
        <!-- Fallback background for projects without thumbnails -->
        <div v-else class="absolute inset-0 z-0 bg-muted">
          <div class="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/40"></div>
          <!-- Centered folder icon -->
          <div class="absolute inset-0 flex items-center justify-center opacity-20">
            <Folder class="h-16 w-16 text-foreground" />
          </div>
        </div>

        <!-- Top right time badge -->
        <div class="absolute top-4 right-4 z-5">
          <span
            :class="[
              'text-xs px-2 py-1 rounded-md',
              getThumbnailUrl(project.id)
                ? 'text-white/70 bg-white/10 backdrop-blur-sm'
                : 'text-muted-foreground bg-muted',
            ]"
          >
            {{ getRelativeTime(project.updated_at) }}
          </span>
        </div>
        <!-- Bottom left title and description -->
        <div class="absolute bottom-2 left-2 right-2 z-5 bg-black/40 backdrop-blur-sm p-2 rounded-md">
          <h3
            :class="[
              'text-md font-semibold mb-1 group-hover:transition-colors line-clamp-2',
              getThumbnailUrl(project.id)
                ? 'text-white group-hover:text-white/80'
                : 'text-foreground group-hover:text-foreground/80',
            ]"
          >
            {{ project.name }}
          </h3>

          <p :class="['text-xs line-clamp-2', getThumbnailUrl(project.id) ? 'text-white/80' : 'text-muted-foreground']">
            {{ project.description || 'No description' }} • {{ getClipCount(project.id) }} clips
          </p>
        </div>
        <!-- Hover Overlay Buttons -->
        <div
          class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-4"
        >
          <button
            class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
            title="Open Workspace"
            @click.stop="openWorkspace(project)"
          >
            <Play class="h-6 w-6" />
          </button>
          <button
            class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
            title="Edit"
            @click.stop="editProject(project)"
          >
            <Edit class="h-6 w-6" />
          </button>
          <button
            class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
            title="Delete"
            @click.stop="confirmDelete(project)"
          >
            <Trash2 class="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
    <!-- Pagination Footer -->
    <PaginationFooter
      v-if="!loading && projects.length > 0"
      :current-page="currentPage"
      :total-pages="totalPages"
      :total-items="projects.length"
      item-label="project"
      @go-to-page="goToPage"
      @previous="previousPage"
      @next="nextPage"
    />
    <!-- Empty State -->
    <EmptyState
      v-else
      title="No projects yet"
      description="Create your first project to get started"
      button-text="Create Project"
      @action="openCreateDialog"
    />
    <!-- Project Dialog -->
    <ProjectDialog v-model="showDialog" :project="selectedProject" @submit="handleProjectSubmit" />
    <!-- Project Workspace Dialog -->
    <ProjectWorkspaceDialog v-model="showWorkspaceDialog" :project="workspaceProject" />
    <!-- Delete Confirmation Modal -->
    <div
      v-if="showDeleteDialog"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="handleDeleteDialogClose"
    >
      <div class="bg-card rounded-lg p-8 max-w-md w-full mx-4 border border-border">
        <h2 class="text-2xl font-bold mb-4">
          {{ projectHasVideos || projectHasClips ? 'Delete Project with Content' : 'Delete Project' }}
        </h2>

        <div class="space-y-4">
          <p class="text-muted-foreground">
            <span v-if="projectHasVideos && projectHasClips">
              This project contains both videos and detected clips. Deleting this project will remove the project
              structure, but all videos and clips will remain in your library. Are you sure you want to delete
            </span>
            <span v-else-if="projectHasVideos">
              This project contains videos. Deleting this project will remove the project structure, but all videos will
              remain in your library. Are you sure you want to delete
            </span>
            <span v-else-if="projectHasClips">
              This project contains detected clips. Deleting this project will remove the project structure, but all
              clips will remain in your library. Are you sure you want to delete
            </span>
            <span v-else>Are you sure you want to delete</span>
            "
            <span class="font-semibold text-foreground">{{ projectToDelete?.name }}</span>
            "? This action cannot be undone.
          </p>
          <button
            class="w-full py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-md font-semibold hover:from-red-700 hover:to-red-800 transition-all"
            @click="deleteProjectConfirmed"
          >
            Delete Project
          </button>
          <button
            class="w-full py-3 bg-muted text-foreground rounded-md font-semibold hover:bg-muted/80 transition-all"
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
  import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import { Folder, Plus, Play, Edit, Trash2 } from 'lucide-vue-next';
  import {
    getAllProjects,
    getClipsWithVersionsByProjectId,
    deleteProject,
    createProject,
    updateProject,
    getRawVideosByProjectId,
    updateRawVideo,
    hasRawVideosForProject,
    hasClipsForProject,
    type Project,
    type RawVideo,
  } from '@/services/database';
  import { useFormatters } from '@/composables/useFormatters';
  import { useToast } from '@/composables/useToast';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';
  import ProjectDialog, { type ProjectFormData } from '@/components/ProjectDialog.vue';
  import ProjectWorkspaceDialog from '@/components/ProjectWorkspaceDialog.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';

  const projects = ref<Project[]>([]);
  const loading = ref(true);
  const clipCounts = ref<Record<string, number>>({});
  const showDialog = ref(false);
  const selectedProject = ref<Project | null>(null);
  const showDeleteDialog = ref(false);
  const projectToDelete = ref<Project | null>(null);
  const projectHasVideos = ref(false);
  const projectHasClips = ref(false);
  const showWorkspaceDialog = ref(false);
  const workspaceProject = ref<Project | null>(null);
  const projectVideos = ref<Record<string, RawVideo[]>>({});
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const { getRelativeTime } = useFormatters();
  const { success, error } = useToast();

  // Pagination state
  const currentPage = ref(1);
  const projectsPerPage = 20;

  async function loadProjects() {
    loading.value = true;
    try {
      projects.value = await getAllProjects();

      // Load clip counts and video thumbnails for each project
      for (const project of projects.value) {
        const clips = await getClipsWithVersionsByProjectId(project.id);
        clipCounts.value[project.id] = clips.length;

        // Load videos for this project
        const videos = await getRawVideosByProjectId(project.id);
        projectVideos.value[project.id] = videos;

        // Load project thumbnail or use first video's thumbnail
        if (!thumbnailCache.value.has(project.id)) {
          if (project.thumbnail_path) {
            // Use project's stored thumbnail if available
            try {
              const dataUrl = await invoke<string>('read_file_as_data_url', {
                filePath: project.thumbnail_path,
              });
              thumbnailCache.value.set(project.id, dataUrl);
            } catch (error) {
              console.warn('Failed to load project thumbnail:', project.id, error);
            }
          } else if (videos.length > 0 && videos[0].thumbnail_path) {
            // Fall back to first video's thumbnail
            try {
              const dataUrl = await invoke<string>('read_file_as_data_url', {
                filePath: videos[0].thumbnail_path,
              });
              thumbnailCache.value.set(project.id, dataUrl);

              // Save this thumbnail to the project for future use
              await updateProject(project.id, undefined, undefined, videos[0].thumbnail_path);
            } catch (error) {
              console.warn('Failed to load video thumbnail for project:', project.id, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load projects:', error);
    } finally {
      loading.value = false;
    }
  }

  function getClipCount(projectId: string): number {
    return clipCounts.value[projectId] || 0;
  }

  function getThumbnailUrl(projectId: string): string | null {
    return thumbnailCache.value.get(projectId) || null;
  }

  // Pagination computed properties
  const totalPages = computed(() => Math.ceil(projects.value.length / projectsPerPage));
  const paginatedProjects = computed(() => {
    const startIndex = (currentPage.value - 1) * projectsPerPage;
    const endIndex = startIndex + projectsPerPage;
    const paginated = projects.value.slice(startIndex, endIndex);
    return paginated;
  });

  // Pagination functions
  function goToPage(page: number) {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page;
    }
  }

  function nextPage() {
    if (currentPage.value < totalPages.value) {
      currentPage.value++;
    }
  }

  function previousPage() {
    if (currentPage.value > 1) {
      currentPage.value--;
    }
  }

  // Reset to first page when projects change
  watch(projects, () => {
    currentPage.value = 1;
  });

  function openCreateDialog() {
    selectedProject.value = null;
    showDialog.value = true;
  }

  function openWorkspace(project: Project) {
    workspaceProject.value = project;
    showWorkspaceDialog.value = true;
  }

  function editProject(project: Project) {
    selectedProject.value = project;
    showDialog.value = true;
  }

  async function handleProjectSubmit(data: ProjectFormData) {
    try {
      if (selectedProject.value) {
        // Update existing project
        await updateProject(selectedProject.value.id, data.name, data.description || undefined);

        // Update video association if changed
        if (data.selectedVideoId !== undefined) {
          // First, remove existing video associations for this project
          const existingVideos = await getRawVideosByProjectId(selectedProject.value.id);
          for (const video of existingVideos) {
            await updateRawVideo(video.id, { project_id: null });
          }

          // Then associate the new video
          if (data.selectedVideoId) {
            await updateRawVideo(data.selectedVideoId, { project_id: selectedProject.value.id });
          }
        }

        success('Project updated', `"${data.name}" has been updated successfully`);
      } else {
        // Create new project
        const projectId = await createProject(data.name, data.description || undefined);

        // Associate the selected video with the new project
        if (data.selectedVideoId) {
          await updateRawVideo(data.selectedVideoId, { project_id: projectId });
        }

        success('Project created', `"${data.name}" has been created successfully`);
      }

      // Reload projects
      await loadProjects();

      if (!selectedProject.value) {
        // For new projects, find the newly created project and open workspace
        const newProject = projects.value.find((p) => p.name === data.name);
        if (newProject) {
          workspaceProject.value = newProject;
          showWorkspaceDialog.value = true;
        }
      }

      // Close dialog
      showDialog.value = false;
      selectedProject.value = null;
    } catch (err) {
      error(
        selectedProject.value ? 'Failed to update project' : 'Failed to create project',
        'An error occurred while saving the project. Please try again.'
      );
    }
  }

  async function confirmDelete(project: Project) {
    projectToDelete.value = project;

    // Check if project has videos and clips
    try {
      projectHasVideos.value = await hasRawVideosForProject(project.id);
      projectHasClips.value = await hasClipsForProject(project.id);
      showDeleteDialog.value = true;
    } catch (err) {
      // If we can't check, proceed with normal deletion
      projectHasVideos.value = false;
      projectHasClips.value = false;
      showDeleteDialog.value = true;
    }
  }

  function handleDeleteDialogClose() {
    showDeleteDialog.value = false;
    projectHasVideos.value = false;
    projectHasClips.value = false;
    projectToDelete.value = null;
  }

  async function deleteProjectConfirmed() {
    if (!projectToDelete.value) return;

    const deletedProjectName = projectToDelete.value.name;

    try {
      await deleteProject(projectToDelete.value.id);
      success('Project deleted', `"${deletedProjectName}" has been deleted successfully`);
      await loadProjects();
    } catch (err) {
      error('Failed to delete project', 'An error occurred while deleting the project. Please try again.');
    } finally {
      showDeleteDialog.value = false;
      projectHasVideos.value = false;
      projectHasClips.value = false;
      projectToDelete.value = null;
    }
  }

  // Listen for clip refresh events from workspace dialog
  function handleClipRefreshEvent(_event: CustomEvent) {
    loadProjects();
  }

  onMounted(() => {
    loadProjects();

    // Add event listener for clip refresh events
    document.addEventListener('refresh-clips-projects', handleClipRefreshEvent as EventListener);
  });

  onUnmounted(() => {
    // Clean up event listener
    document.removeEventListener('refresh-clips-projects', handleClipRefreshEvent as EventListener);
  });
</script>
