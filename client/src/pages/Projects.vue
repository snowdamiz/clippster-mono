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

    <!-- Projects Content -->
    <div v-else-if="projects.length > 0" class="space-y-8">
      <!-- Filter Toolbar -->
      <div class="-mt-4 bg-card flex flex-col md:flex-row gap-4 items-center justify-between">
        <!-- Left: Search -->
        <div class="relative w-full md:w-72">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input v-model="searchQuery" placeholder="Search projects..." class="pl-9 bg-background/50" />
        </div>

        <!-- Right: Filters & View Mode -->
        <div class="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <!-- Status Filter -->
          <CustomDropdown v-model="statusFilter" :options="statusOptions" placeholder="Status" class="w-[140px]" />

          <!-- Sort Filter -->
          <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort By" class="w-[160px]" />

          <div class="h-8 w-px bg-border mx-1"></div>

          <!-- View Mode -->
          <div
            class="bg-muted/50 rounded-md p-1 flex items-center gap-1 transition-opacity"
            :class="{ 'opacity-50 pointer-events-none': searchQuery }"
          >
            <button
              @click="viewMode = 'folders'"
              :disabled="!!searchQuery"
              :class="[
                'p-2 rounded transition-colors',
                viewMode === 'folders'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ]"
              title="Folder View"
            >
              <Folder class="h-4 w-4" />
            </button>
            <button
              @click="viewMode = 'list'"
              :disabled="!!searchQuery"
              :class="[
                'p-2 rounded transition-colors',
                viewMode === 'list'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              ]"
              title="List View"
            >
              <List class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Projects Grid -->
      <div v-if="filteredProjects.length > 0" class="space-y-8">
        <div v-for="group in groupedProjects" :key="group.dateLabel" class="space-y-4">
          <!-- Date Header -->
          <h3 class="text-sm font-medium text-muted-foreground border-b border-border pb-2">{{ group.dateLabel }}</h3>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div
              v-for="project in group.projects"
              :key="project.id"
              class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all"
              @click="handleProjectClick(project)"
            >
              <!-- Live Badge -->
              <div
                v-if="isProjectLive(project.id)"
                class="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-red-600/90 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm animate-pulse"
              >
                <Radio class="w-3 h-3" />
                <span>LIVE</span>
              </div>

              <!-- Folder Badge (if has children and in folder view) -->
              <div
                v-if="viewMode === 'folders' && hasChildren(project.id)"
                class="absolute top-4 left-4 z-20 flex items-center gap-1.5 bg-blue-600/90 text-white px-2.5 py-1 rounded-full text-xs font-bold shadow-sm backdrop-blur-sm"
              >
                <FolderOpen class="w-3 h-3" />
                <span>{{ getChildCount(project.id) }} Parts</span>
              </div>

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
                <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/40 to-black/60"></div>
              </div>
              <!-- Fallback background for projects without thumbnails -->
              <div v-else class="absolute inset-0 z-0 bg-muted">
                <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/40 to-black/50"></div>

                <!-- Live Empty State -->
                <div
                  v-if="isProjectLive(project.id)"
                  class="absolute inset-0 flex flex-col items-center justify-center gap-3 opacity-50"
                >
                  <div class="relative">
                    <div class="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
                    <Radio class="h-12 w-12 text-red-500 relative z-10" />
                  </div>
                  <span class="text-xs font-medium text-muted-foreground uppercase tracking-wider">Monitoring</span>
                </div>
                <!-- Standard Empty State -->
                <div v-else class="absolute inset-0 flex items-center justify-center opacity-20">
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

                <p
                  v-if="!(viewMode === 'folders' && hasChildren(project.id))"
                  :class="[
                    'text-xs line-clamp-2',
                    getThumbnailUrl(project.id) ? 'text-white/80' : 'text-muted-foreground',
                  ]"
                >
                  {{ project.description || 'No description' }} • {{ getClipCount(project.id) }} clips
                </p>
              </div>
              <!-- Hover Overlay Buttons -->
              <div
                class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-5 flex items-center justify-center gap-4"
              >
                <button
                  v-if="viewMode === 'folders' && hasChildren(project.id)"
                  class="p-3 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="View Folder"
                  @click.stop="handleProjectClick(project)"
                >
                  <FolderOpen class="h-6 w-6" />
                </button>
                <button
                  v-else
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
        </div>
      </div>
      <!-- Pagination Footer -->
      <PaginationFooter
        v-if="!loading && filteredProjects.length > 0"
        :current-page="currentPage"
        :total-pages="totalPages"
        :total-items="filteredProjects.length"
        item-label="project"
        @go-to-page="goToPage"
        @previous="previousPage"
        @next="nextPage"
      />
      <!-- No Results State -->
      <div
        v-if="filteredProjects.length === 0"
        class="flex flex-col items-center justify-center py-16 text-center space-y-4"
      >
        <div class="bg-muted rounded-full p-4">
          <Search class="h-8 w-8 text-muted-foreground" />
        </div>
        <div class="space-y-1">
          <h3 class="font-semibold text-lg">No projects found</h3>
          <p class="text-muted-foreground text-sm max-w-sm">
            We couldn't find any projects matching your search filters. Try adjusting your search query or filters.
          </p>
        </div>
        <button
          @click="
            searchQuery = '';
            statusFilter = 'all';
          "
          class="text-primary hover:underline text-sm font-medium"
        >
          Clear filters
        </button>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="No projects found"
      description="Create a new project to get started"
      button-text="Create Project"
      @action="openCreateDialog"
    />
    <!-- Project Dialog -->
    <ProjectDialog v-model="showDialog" :project="selectedProject" @submit="handleProjectSubmit" />
    <!-- Project Workspace Dialog -->
    <ProjectWorkspaceDialog v-model="showWorkspaceDialog" :project="workspaceProject" />
    <!-- Folder Contents Dialog -->
    <div
      v-if="showFolderDialog && folderProject"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="showFolderDialog = false"
    >
      <div
        class="bg-card rounded-lg w-full mx-4 border border-border flex flex-col overflow-hidden shadow-2xl transition-all duration-200 max-h-[80vh]"
        :class="{
          'max-w-lg': getFolderChildren(folderProject.id).length <= 1,
          'max-w-3xl': getFolderChildren(folderProject.id).length === 2,
          'max-w-5xl': getFolderChildren(folderProject.id).length >= 3,
        }"
      >
        <!-- Header -->
        <div class="py-2 px-3 border-b border-border flex items-center justify-between bg-black/30">
          <div class="flex items-center justify-center gap-2.5">
            <div class="bg-primary/10 p-1.5 rounded-md">
              <FolderOpen class="h-4 w-4 text-primary" />
            </div>
            <h2 class="text-md font-medium text-foreground -mt-1">{{ folderProject.name }}</h2>
          </div>
          <button
            @click="showFolderDialog = false"
            class="p-2 hover:bg-muted rounded-md transition-colors text-muted-foreground hover:text-foreground"
          >
            <X class="h-5 w-5" />
          </button>
        </div>

        <!-- Content -->
        <div class="flex-1 overflow-y-auto p-6">
          <div
            class="grid gap-5"
            :class="{
              'grid-cols-1': paginatedFolderChildren.length <= 1,
              'grid-cols-1 md:grid-cols-2': paginatedFolderChildren.length === 2,
              'grid-cols-1 md:grid-cols-2 lg:grid-cols-3': paginatedFolderChildren.length >= 3,
            }"
          >
            <div
              v-for="project in paginatedFolderChildren"
              :key="project.id"
              class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all border border-border shadow-sm"
              @click="openWorkspace(project)"
            >
              <!-- Thumbnail background -->
              <div
                v-if="getThumbnailUrl(project.id)"
                class="absolute inset-0 z-0 rounded-md"
                :style="{
                  backgroundImage: `url(${getThumbnailUrl(project.id)})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  backgroundRepeat: 'no-repeat',
                }"
              >
                <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/20 to-black/60"></div>
              </div>
              <div v-else class="absolute inset-0 z-0 bg-muted">
                <div class="absolute inset-0 bg-gradient-to-br from-black/20 via-transparent to-black/40"></div>
                <div class="absolute inset-0 flex items-center justify-center opacity-20">
                  <Play class="h-12 w-12 text-foreground" />
                </div>
              </div>

              <!-- Time badge -->
              <div class="absolute top-3 right-3 z-5">
                <span class="text-xs px-2 py-1 rounded-md text-white/70 bg-black/40 backdrop-blur-sm">
                  {{ getRelativeTime(project.updated_at) }}
                </span>
              </div>

              <!-- Info -->
              <div class="absolute bottom-0 left-0 right-0 z-5 bg-black/60 backdrop-blur-sm p-3 rounded-b-md">
                <h3 class="text-sm font-semibold text-white line-clamp-1">{{ project.name }}</h3>
                <p class="text-xs text-white/70 line-clamp-1 mt-0.5">{{ project.description || 'No description' }}</p>
              </div>

              <!-- Hover Overlay -->
              <div
                class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 flex items-center justify-center gap-3"
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
                  title="Delete"
                  @click.stop="confirmDelete(project)"
                >
                  <Trash2 class="h-6 w-6" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer with Pagination -->
        <div v-if="folderTotalPages > 1" class="px-6 py-4 border-t border-border bg-muted/10 flex justify-center">
          <PaginationFooter
            :current-page="folderCurrentPage"
            :total-pages="folderTotalPages"
            :total-items="getFolderChildren(folderProject.id).length"
            item-label="part"
            @go-to-page="(page) => (folderCurrentPage = page)"
            @previous="folderCurrentPage--"
            @next="folderCurrentPage++"
          />
        </div>
      </div>
    </div>

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
              structure, but all videos and clips will remain in your library.
            </span>
            <span v-else-if="projectHasVideos">
              This project contains videos. Deleting this project will remove the project structure, but all videos will
              remain in your library.
            </span>
            <span v-else-if="projectHasClips">
              This project contains detected clips. Deleting this project will remove the project structure, but all
              clips will remain in your library.
            </span>
            <span v-else>Are you sure you want to delete</span>
            "
            <span class="font-semibold text-foreground">{{ projectToDelete?.name }}</span>
            "?
            <span v-if="hasChildren(projectToDelete?.id || '')" class="block mt-2 text-red-400">
              Warning: This project contains {{ getChildCount(projectToDelete?.id || '') }} sub-projects (segments).
              They will be un-grouped but not deleted.
            </span>
            <span class="block mt-1">This action cannot be undone.</span>
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
  import { Folder, Plus, Play, Edit, Trash2, Radio, List, FolderOpen, X, Search } from 'lucide-vue-next';
  import {
    getAllProjects,
    getClipsWithVersionsByProjectId,
    deleteProject,
    createProject,
    updateProject,
    getRawVideosByProjectId,
    hasRawVideosForProject,
    hasClipsForProject,
    type Project,
    type RawVideo,
  } from '@/services/database';
  import { useFormatters } from '@/composables/useFormatters';
  import { useToast } from '@/composables/useToast';
  import { useLivestreamMonitoring } from '@/composables/useLivestreamMonitoring';
  import { useVideoOperations } from '@/composables/useVideoOperations';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';
  import ProjectDialog, { type ProjectFormData } from '@/components/ProjectDialog.vue';
  import ProjectWorkspaceDialog from '@/components/ProjectWorkspaceDialog.vue';
  import PaginationFooter from '@/components/PaginationFooter.vue';
  import { Input } from '@/components/ui/input';
  import CustomDropdown from '@/components/CustomDropdown.vue';

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
  const { activeSessions } = useLivestreamMonitoring();
  const { processVideoFile } = useVideoOperations();

  // View state
  const viewMode = ref<'folders' | 'list'>('folders');
  const showFolderDialog = ref(false);
  const folderProject = ref<Project | null>(null);

  // Filter state
  const searchQuery = ref('');
  const sortBy = ref('updated-desc');
  const statusFilter = ref('all');

  const statusOptions = [
    { label: 'All Status', value: 'all' },
    { label: 'Live Now', value: 'live' },
    { label: 'Has Clips', value: 'has_clips' },
  ];

  const sortOptions = [
    { label: 'Updated: Newest', value: 'updated-desc' },
    { label: 'Updated: Oldest', value: 'updated-asc' },
    { label: 'Created: Newest', value: 'created-desc' },
    { label: 'Created: Oldest', value: 'created-asc' },
    { label: 'Name: A-Z', value: 'name-asc' },
    { label: 'Name: Z-A', value: 'name-desc' },
  ];

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

  function isProjectLive(projectId: string) {
    for (const session of activeSessions.value.values()) {
      if (session.projectId === projectId) {
        return true;
      }
    }
    return false;
  }

  // Helper to map parentId -> children
  const childrenMap = computed(() => {
    const map = new Map<string, Project[]>();
    for (const p of projects.value) {
      if (p.parent_id) {
        if (!map.has(p.parent_id)) {
          map.set(p.parent_id, []);
        }
        map.get(p.parent_id)?.push(p);
      }
    }
    return map;
  });

  function hasChildren(projectId: string): boolean {
    return (childrenMap.value.get(projectId)?.length || 0) > 0;
  }

  function getChildCount(projectId: string): number {
    return childrenMap.value.get(projectId)?.length || 0;
  }

  // Folder dialog pagination
  const folderCurrentPage = ref(1);
  const folderItemsPerPage = 6;

  function getFolderChildren(projectId: string): Project[] {
    return childrenMap.value.get(projectId) || [];
  }

  const paginatedFolderChildren = computed(() => {
    if (!folderProject.value) return [];
    const children = getFolderChildren(folderProject.value.id);
    const startIndex = (folderCurrentPage.value - 1) * folderItemsPerPage;
    return children.slice(startIndex, startIndex + folderItemsPerPage);
  });

  const folderTotalPages = computed(() => {
    if (!folderProject.value) return 0;
    return Math.ceil(getFolderChildren(folderProject.value.id).length / folderItemsPerPage);
  });

  function handleProjectClick(project: Project) {
    if (viewMode.value === 'folders' && hasChildren(project.id)) {
      // Open folder dialog
      folderProject.value = project;
      folderCurrentPage.value = 1; // Reset to first page
      showFolderDialog.value = true;
    } else {
      openWorkspace(project);
    }
  }

  // Filter projects based on view mode and filters
  const filteredProjects = computed(() => {
    let result = projects.value;

    // 1. Filter by View Mode (only if NOT searching)
    // If user is searching, we want to search across all projects regardless of folder structure
    if (!searchQuery.value) {
      if (viewMode.value === 'folders') {
        result = result.filter((p) => !p.parent_id);
      } else if (viewMode.value === 'list') {
        // In list view, hide "parent" projects (folders) - show only leaf nodes
        result = result.filter((p) => !hasChildren(p.id));
      }
    }

    // 2. Search Text
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // 3. Status Filter
    if (statusFilter.value !== 'all') {
      switch (statusFilter.value) {
        case 'live':
          result = result.filter((p) => isProjectLive(p.id));
          break;
        case 'has_clips':
          result = result.filter((p) => getClipCount(p.id) > 0);
          break;
        case 'has_videos':
          result = result.filter((p) => (projectVideos.value[p.id]?.length || 0) > 0);
          break;
        case 'empty':
          result = result.filter((p) => getClipCount(p.id) === 0 && (projectVideos.value[p.id]?.length || 0) === 0);
          break;
      }
    }

    // 4. Sorting
    // Note: projects are already sorted by updated_at desc from DB, but we apply client side sort here
    const [field, direction] = sortBy.value.split('-');

    result = [...result].sort((a, b) => {
      let valA: string | number = '';
      let valB: string | number = '';

      if (field === 'updated') {
        valA = a.updated_at;
        valB = b.updated_at;
      } else if (field === 'created') {
        valA = a.created_at;
        valB = b.created_at;
      } else if (field === 'name') {
        valA = a.name.toLowerCase();
        valB = b.name.toLowerCase();
      }

      if (valA < valB) return direction === 'asc' ? -1 : 1;
      if (valA > valB) return direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  });

  // Pagination logic
  const totalPages = computed(() => Math.ceil(filteredProjects.value.length / projectsPerPage));

  const paginatedProjects = computed(() => {
    const startIndex = (currentPage.value - 1) * projectsPerPage;
    const endIndex = startIndex + projectsPerPage;
    return filteredProjects.value.slice(startIndex, endIndex);
  });

  // Group by date logic
  const groupedProjects = computed(() => {
    // If we are sorting by name, or filtering specifically, we might want to skip grouping or adjust it.
    // For now, if sorting by name, we skip date grouping.
    if (sortBy.value.startsWith('name')) {
      return [{ dateLabel: 'Projects', projects: paginatedProjects.value }];
    }

    const groups: { dateLabel: string; projects: Project[] }[] = [];

    let currentLabel = '';
    let currentProjects: Project[] = [];

    // Use paginatedProjects which are already sorted by filteredProjects
    const projectsToGroup = paginatedProjects.value;

    for (const project of projectsToGroup) {
      // Determine which date to use for grouping
      const timestamp = sortBy.value.startsWith('created') ? project.created_at : project.updated_at;
      const label = getDateLabel(timestamp);

      if (label !== currentLabel) {
        if (currentLabel) {
          groups.push({ dateLabel: currentLabel, projects: currentProjects });
        }
        currentLabel = label;
        currentProjects = [project];
      } else {
        currentProjects.push(project);
      }
    }

    if (currentLabel) {
      groups.push({ dateLabel: currentLabel, projects: currentProjects });
    } else if (projectsToGroup.length > 0 && groups.length === 0) {
      // Fallback if loop didn't produce groups (shouldn't happen if list not empty)
      groups.push({ dateLabel: 'Projects', projects: projectsToGroup });
    }

    return groups;
  });

  function getDateLabel(timestamp: number): string {
    // Wait, services/database/core.ts usually uses Date.now() which is ms.
    // But let's verify. The migration says INTEGER.
    // In useFormatters: const now = Math.floor(Date.now() / 1000) -> input timestamp is in seconds.
    // Let's check if updated_at in DB is seconds or ms.
    // In database/projects.ts: const now = timestamp();
    // In database/core.ts: export const timestamp = () => Math.floor(Date.now() / 1000);
    // So it is SECONDS.

    const d = new Date(timestamp * 1000);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const projectDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (projectDate.getTime() === today.getTime()) return 'Today';
    if (projectDate.getTime() === yesterday.getTime()) return 'Yesterday';

    return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }

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

  // Reset to first page when projects change or filters change
  watch([projects, viewMode, searchQuery, sortBy, statusFilter], () => {
    currentPage.value = 1;
  });

  function openCreateDialog() {
    selectedProject.value = null;
    showDialog.value = true;
  }

  function openWorkspace(project: Project) {
    workspaceProject.value = project;
    showWorkspaceDialog.value = true;
    showFolderDialog.value = false; // Close folder dialog if open
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

        // Add newly selected videos if any
        if (data.selectedVideoPaths && data.selectedVideoPaths.length > 0) {
          for (const path of data.selectedVideoPaths) {
            await processVideoFile(path, selectedProject.value.id);
          }
        }

        success('Project updated', `"${data.name}" has been updated successfully`);
      } else {
        // Create new project

        // Check if we have multiple videos - if so, create a parent project with child projects
        if (data.selectedVideoPaths && data.selectedVideoPaths.length > 1) {
          // Create parent project
          const parentId = await createProject(data.name, data.description || undefined);

          // Create child projects for each video
          for (const path of data.selectedVideoPaths) {
            // Use filename as child project name
            const filename = path.split(/[\\/]/).pop() || 'Part';
            // Remove extension
            const childName = filename.replace(/\.[^/.]+$/, '');

            // Create child project
            const childId = await createProject(childName, data.description || undefined, parentId);

            // Process video and associate with child project
            await processVideoFile(path, childId);
          }

          success('Project created', `"${data.name}" has been created with ${data.selectedVideoPaths.length} parts`);
        } else {
          // Standard creation for single video or no video
          const projectId = await createProject(data.name, data.description || undefined);

          // Import and associate selected video (if any)
          if (data.selectedVideoPaths && data.selectedVideoPaths.length > 0) {
            for (const path of data.selectedVideoPaths) {
              await processVideoFile(path, projectId);
            }
          }

          success('Project created', `"${data.name}" has been created successfully`);
        }
      }

      // Reload projects
      await loadProjects();

      if (!selectedProject.value) {
        // For new projects, find the newly created project
        const newProject = projects.value.find((p) => p.name === data.name);

        if (newProject) {
          // Check if it's a folder project (has children)
          const isFolder = hasChildren(newProject.id);

          if (isFolder) {
            // If it's a folder, open the folder view
            folderProject.value = newProject;
            showFolderDialog.value = true;
          } else {
            // If it's a regular project, open the workspace
            workspaceProject.value = newProject;
            showWorkspaceDialog.value = true;
          }
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

      // If we deleted the currently open folder project, close the dialog
      if (folderProject.value && folderProject.value.id === projectToDelete.value.id) {
        showFolderDialog.value = false;
        folderProject.value = null;
      }
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

  // Listen for video added events (to update project thumbnails)
  function handleVideoAdded(_event: CustomEvent) {
    loadProjects();
  }

  onMounted(() => {
    loadProjects();

    // Add event listener for clip refresh events
    document.addEventListener('refresh-clips-projects', handleClipRefreshEvent as EventListener);
    // Add event listener for video added events
    document.addEventListener('video-added', handleVideoAdded as EventListener);
  });

  onUnmounted(() => {
    // Clean up event listener
    document.removeEventListener('refresh-clips-projects', handleClipRefreshEvent as EventListener);
    document.removeEventListener('video-added', handleVideoAdded as EventListener);
  });
</script>
