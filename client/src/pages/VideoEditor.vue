<template>
  <PageLayout
    title="Video Editor"
    description="Create and edit video projects from multiple sources"
    :show-header="true"
    :icon="Clapperboard"
  >
    <template #actions>
      <Button @click="openCreateDialog" class="flex items-center gap-2">
        <Plus class="h-5 w-5" />
        New Project
      </Button>
    </template>

    <!-- Loading State -->
    <div v-if="loading" class="space-y-6">
      <SkeletonGrid />
    </div>

    <!-- Projects Content -->
    <div v-else-if="projects.length > 0" class="space-y-8">
      <!-- Filter Toolbar -->
      <div class="-mt-2 bg-card flex flex-col md:flex-row gap-4 items-center justify-between">
        <!-- Left: Search or Selection Info -->
        <div class="flex items-center gap-3 w-full md:w-auto">
          <!-- Selection Controls (visible when items selected) -->
          <div v-if="selectedProjects.size > 0" class="flex items-center gap-3">
            <button
              @click="confirmBulkDelete"
              class="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md flex items-center gap-2 font-medium text-sm transition-all"
            >
              <Trash2 class="h-4 w-4" />
              Delete ({{ selectedProjects.size }})
            </button>
            <span class="text-sm text-muted-foreground">{{ selectedProjects.size }} selected</span>
            <button @click="clearSelection" class="text-xs text-muted-foreground hover:text-foreground font-medium">
              Clear
            </button>
          </div>

          <!-- Search (hidden when items selected) -->
          <div v-else class="relative w-full md:w-72">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input v-model="searchQuery" placeholder="Search projects..." class="pl-9 bg-background/50" />
          </div>
        </div>

        <!-- Right: Sort Filter -->
        <div class="flex items-center gap-3 w-full md:w-auto overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
          <!-- Reset Filters Button -->
          <button
            v-if="searchQuery"
            @click="searchQuery = ''"
            class="text-xs px-2 py-1 text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-md transition-colors whitespace-nowrap font-medium flex items-center gap-1"
          >
            <X class="h-3 w-3" />
            Reset
          </button>

          <!-- Sort Filter -->
          <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort By" class="w-[160px]" />
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
              class="relative bg-card rounded-md overflow-hidden cursor-pointer group aspect-video hover:scale-102 transition-all border border-border"
              :class="{ 'ring-2 ring-primary ring-offset-2 ring-offset-background': isProjectSelected(project.id) }"
              @click="openProject(project)"
            >
              <!-- Selection Checkbox (visible on hover or when selected) -->
              <div
                class="absolute top-4 right-4 z-30 transition-opacity"
                :class="isProjectSelected(project.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                @click.stop="toggleProjectSelection(project.id)"
              >
                <div
                  :class="[
                    'w-6 h-6 rounded-md flex items-center justify-center transition-all cursor-pointer shadow-md border border-white/45',
                    isProjectSelected(project.id)
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-black/60 text-white hover:bg-black/80',
                  ]"
                >
                  <Check v-if="isProjectSelected(project.id)" class="w-4 h-4" />
                </div>
              </div>

              <!-- Project Card with Sources -->
              <template v-if="getSourceCount(project.id) > 0">
                <!-- First source thumbnail as background -->
                <div class="absolute inset-0 z-0">
                  <img
                    v-if="getSourceThumbnails(project.id)[0]"
                    :src="getSourceThumbnails(project.id)[0]"
                    class="w-full h-full object-cover"
                  />
                  <div v-else class="w-full h-full bg-muted flex items-center justify-center">
                    <Film class="w-12 h-12 text-muted-foreground/40" />
                  </div>
                </div>

                <!-- Bottom Overlay with Info -->
                <div
                  class="absolute bottom-0 left-0 right-0 z-5 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-28 flex flex-col gap-1.5"
                >
                  <!-- Title -->
                  <h3
                    class="text-base font-bold text-white leading-tight line-clamp-1 group-hover:text-white/90 transition-colors"
                    :title="project.name"
                  >
                    {{ project.name }}
                  </h3>

                  <!-- Metadata Row -->
                  <div class="flex items-center gap-2 text-xs text-white/70 font-medium">
                    <!-- Source count badge -->
                    <div
                      class="flex items-center gap-1 bg-violet-500/30 text-violet-200 px-1.5 py-0.5 rounded font-medium"
                    >
                      <Film class="w-3 h-3" />
                      <span>{{ getSourceCount(project.id) }}</span>
                    </div>

                    <!-- Duration -->
                    <span v-if="project.total_duration > 0" class="truncate">
                      {{ formatDuration(project.total_duration) }}
                    </span>

                    <span class="w-0.5 h-0.5 rounded-full bg-white/40"></span>

                    <!-- Time -->
                    <span class="truncate">{{ getRelativeTime(project.updated_at) }}</span>
                  </div>
                </div>
              </template>

              <!-- Empty Project State (no sources) - Original styling -->
              <template v-else>
                <!-- Fallback background for projects without sources -->
                <div class="absolute inset-0 z-0 bg-muted">
                  <div class="absolute inset-0 bg-gradient-to-br from-black/50 via-black/40 to-black/50"></div>
                  <div class="absolute inset-0 flex items-center justify-center opacity-20">
                    <Clapperboard class="h-16 w-16 text-foreground" />
                  </div>
                </div>

                <!-- Bottom Overlay with Info -->
                <div
                  class="absolute bottom-0 left-0 right-0 z-5 bg-gradient-to-t from-black via-black/80 to-transparent p-4 pt-28 flex flex-col gap-1.5"
                >
                  <!-- Title -->
                  <h3
                    class="text-base font-bold text-white leading-tight line-clamp-1 group-hover:text-white/90 transition-colors"
                    :title="project.name"
                  >
                    {{ project.name }}
                  </h3>

                  <!-- Metadata Row -->
                  <div class="flex items-center gap-2 text-xs text-white/70 font-medium">
                    <span class="truncate text-white/50">Empty project</span>

                    <span class="w-0.5 h-0.5 rounded-full bg-white/40"></span>

                    <!-- Time -->
                    <span class="truncate">{{ getRelativeTime(project.updated_at) }}</span>
                  </div>
                </div>
              </template>

              <!-- Hover Overlay Buttons -->
              <div
                class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-20 flex items-center justify-center gap-3"
              >
                <button
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="Open Editor"
                  @click.stop="openProject(project)"
                >
                  <Play class="h-5 w-5" />
                </button>

                <button
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="Edit"
                  @click.stop="editProject(project)"
                >
                  <Edit class="h-5 w-5" />
                </button>

                <button
                  class="p-2 bg-white/90 hover:bg-white text-gray-900 rounded-full transition-all transform hover:scale-110 shadow-lg"
                  title="Delete"
                  @click.stop="confirmDelete(project)"
                >
                  <Trash2 class="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
            We couldn't find any projects matching your search. Try adjusting your search query.
          </p>
        </div>
        <button @click="searchQuery = ''" class="text-primary hover:underline text-sm font-medium">Clear search</button>
      </div>
    </div>

    <!-- Empty State -->
    <EmptyState
      v-else
      title="No editor projects yet"
      description="Create your first video editing project to get started"
    >
      <template #icon>
        <Clapperboard class="h-16 w-16 text-muted-foreground" />
      </template>
      <template #default>
        <Button @click="openCreateDialog" class="mt-6 flex items-center gap-2">
          <Plus class="w-4 h-4" />
          Create Project
        </Button>
      </template>
    </EmptyState>

    <!-- Create/Edit Dialog -->
    <VideoEditorProjectDialog v-model="showDialog" :project="selectedProject" @submit="handleProjectSubmit" />

    <!-- Video Editor Dialog (using ClipEditorDialog in editor mode) -->
    <ClipEditorDialog
      v-model="showEditorDialog"
      :editor-mode="true"
      :editor-project-id="editorProjectId"
      :editor-project-name="editorProjectName"
      @editor-save="handleEditorSave"
    />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete Project"
      :message="deleteMessage"
      suffix="This action cannot be undone."
      confirm-text="Delete"
      @close="showDeleteDialog = false"
      @confirm="handleDeleteConfirm"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { Clapperboard, Plus, Trash2, Search, X, Check, Play, Edit, Film } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import PageLayout from '@/components/PageLayout.vue';
  import EmptyState from '@/components/EmptyState.vue';
  import SkeletonGrid from '@/components/SkeletonGrid.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import VideoEditorProjectDialog from '@/components/video-editor/VideoEditorProjectDialog.vue';
  import ClipEditorDialog from '@/components/clip-editor/ClipEditorDialog.vue';
  import type { VideoEditorProject, VideoEditorSource } from '@/types';
  import {
    getAllVideoEditorProjects,
    createVideoEditorProject,
    updateVideoEditorProject,
    deleteVideoEditorProject,
    getVideoEditorSourceCount,
    getVideoEditorSourcesByProjectId,
  } from '@/services/database/video-editor-projects';
  import { getFullVideoEditorEdit } from '@/services/database/video-editor-edits';
  import { getRawVideo } from '@/services/database/raw-videos';
  import { getClipWithBuildStatus } from '@/services/database/clip-build';
  import { useFormatters } from '@/composables/useFormatters';
  import { invoke } from '@tauri-apps/api/core';

  const { getRelativeTime: formatRelativeTime } = useFormatters();

  // Types for project metadata
  interface ProjectEditInfo {
    hasAudio: boolean;
    hasText: boolean;
    hasStickers: boolean;
    hasWatermarks: boolean;
    hasEffects: boolean;
  }

  // State
  const loading = ref(true);
  const projects = ref<VideoEditorProject[]>([]);
  const sourceCounts = ref<Map<string, number>>(new Map());
  const projectSources = ref<Map<string, VideoEditorSource[]>>(new Map());
  const sourceThumbnails = ref<Map<string, (string | null)[]>>(new Map()); // projectId -> array of thumbnail data URLs (null if not available)
  const projectEdits = ref<Map<string, ProjectEditInfo>>(new Map());
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const searchQuery = ref('');
  const sortBy = ref('updated');
  const selectedProjects = ref<Set<string>>(new Set());

  // Dialog state
  const showDialog = ref(false);
  const selectedProject = ref<VideoEditorProject | null>(null);
  const showEditorDialog = ref(false);
  const editorProjectId = ref<string | null>(null);
  const editorProjectName = ref('Video Project');
  const showDeleteDialog = ref(false);
  const projectToDelete = ref<VideoEditorProject | null>(null);

  // Sort options
  const sortOptions = [
    { value: 'updated', label: 'Last Updated' },
    { value: 'created', label: 'Date Created' },
    { value: 'name', label: 'Name' },
    { value: 'duration', label: 'Duration' },
  ];

  // Filtered and sorted projects
  const filteredProjects = computed(() => {
    let result = [...projects.value];

    // Filter by search
    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy.value) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return b.created_at - a.created_at;
        case 'duration':
          return b.total_duration - a.total_duration;
        case 'updated':
        default:
          return b.updated_at - a.updated_at;
      }
    });

    return result;
  });

  // Group projects by date
  const groupedProjects = computed(() => {
    const groups: { dateLabel: string; projects: VideoEditorProject[] }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayProjects: VideoEditorProject[] = [];
    const yesterdayProjects: VideoEditorProject[] = [];
    const lastWeekProjects: VideoEditorProject[] = [];
    const olderProjects: VideoEditorProject[] = [];

    for (const project of filteredProjects.value) {
      const date = new Date(project.updated_at * 1000);
      if (date >= today) {
        todayProjects.push(project);
      } else if (date >= yesterday) {
        yesterdayProjects.push(project);
      } else if (date >= lastWeek) {
        lastWeekProjects.push(project);
      } else {
        olderProjects.push(project);
      }
    }

    if (todayProjects.length > 0) groups.push({ dateLabel: 'Today', projects: todayProjects });
    if (yesterdayProjects.length > 0) groups.push({ dateLabel: 'Yesterday', projects: yesterdayProjects });
    if (lastWeekProjects.length > 0) groups.push({ dateLabel: 'Last 7 Days', projects: lastWeekProjects });
    if (olderProjects.length > 0) groups.push({ dateLabel: 'Older', projects: olderProjects });

    return groups;
  });

  const deleteMessage = computed(() => {
    if (selectedProjects.value.size > 0) {
      return `Are you sure you want to delete ${selectedProjects.value.size} project${selectedProjects.value.size > 1 ? 's' : ''}?`;
    }
    return `Are you sure you want to delete "${projectToDelete.value?.name}"?`;
  });

  // Methods
  async function loadProjects() {
    loading.value = true;
    try {
      projects.value = await getAllVideoEditorProjects();

      // Load source counts, sources, thumbnails, and edit info for each project
      const counts = new Map<string, number>();
      const sources = new Map<string, VideoEditorSource[]>();
      const thumbnails = new Map<string, (string | null)[]>();
      const edits = new Map<string, ProjectEditInfo>();

      for (const project of projects.value) {
        // Load sources for this project
        const projectSourceList = await getVideoEditorSourcesByProjectId(project.id);
        sources.set(project.id, projectSourceList);
        counts.set(project.id, projectSourceList.length);

        // Load source thumbnails (up to 3 for display) - look up from original source if needed
        const thumbnailUrls: (string | null)[] = [];
        const sourcesToLoad = projectSourceList.slice(0, 3);
        for (const source of sourcesToLoad) {
          let thumbnailPath = source.source_thumbnail;

          // If no thumbnail stored, look it up from the original source
          if (!thumbnailPath && source.source_id) {
            try {
              if (source.source_type === 'raw_video') {
                const rawVideo = await getRawVideo(source.source_id);
                thumbnailPath = rawVideo?.thumbnail_path || null;
              } else if (source.source_type === 'clip') {
                const clip = await getClipWithBuildStatus(source.source_id);
                thumbnailPath = clip?.built_thumbnail_path || null;
              }
            } catch (err) {
              console.warn('[VideoEditor] Failed to lookup source thumbnail:', source.id, err);
            }
          }

          // If still no thumbnail, try to generate one from the video file
          if (!thumbnailPath && source.source_path) {
            try {
              const videoExists = await invoke<boolean>('check_file_exists', { path: source.source_path });
              if (videoExists) {
                thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
                  videoPath: source.source_path,
                  timestampSeconds: source.trim_start || 1,
                  outputFilename: `editor_thumb_${source.id}`,
                });
              }
            } catch (err) {
              console.warn('[VideoEditor] Failed to generate thumbnail:', source.id, err);
            }
          }

          if (thumbnailPath) {
            try {
              const exists = await invoke<boolean>('check_file_exists', { path: thumbnailPath });
              if (exists) {
                const dataUrl = await invoke<string>('read_file_as_data_url', {
                  filePath: thumbnailPath,
                });
                thumbnailUrls.push(dataUrl);
              } else {
                thumbnailUrls.push(null); // Preserve position
              }
            } catch (err) {
              console.warn('[VideoEditor] Failed to load source thumbnail:', source.id, err);
              thumbnailUrls.push(null); // Preserve position on error
            }
          } else {
            thumbnailUrls.push(null); // No thumbnail path for this source
          }
        }
        thumbnails.set(project.id, thumbnailUrls);

        // Load edit info to determine what types of edits exist
        try {
          const fullEdit = await getFullVideoEditorEdit(project.id);
          edits.set(project.id, {
            hasAudio: fullEdit ? fullEdit.audioTracks.length > 0 : false,
            hasText: fullEdit ? fullEdit.textOverlays.length > 0 : false,
            hasStickers: fullEdit ? fullEdit.stickers.length > 0 : false,
            hasWatermarks: fullEdit ? fullEdit.watermarks.length > 0 : false,
            hasEffects: fullEdit ? fullEdit.effects.length > 0 : false,
          });
        } catch (err) {
          console.warn('[VideoEditor] Failed to load edit info for project:', project.id, err);
          edits.set(project.id, {
            hasAudio: false,
            hasText: false,
            hasStickers: false,
            hasWatermarks: false,
            hasEffects: false,
          });
        }

        // Load project thumbnail if available (fallback)
        if (project.thumbnail_path && !thumbnailCache.value.has(project.id)) {
          try {
            const exists = await invoke<boolean>('check_file_exists', { path: project.thumbnail_path });
            if (exists) {
              const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: project.thumbnail_path });
              thumbnailCache.value.set(project.id, dataUrl);
            }
          } catch (err) {
            console.warn('[VideoEditor] Failed to load thumbnail for project:', project.id, err);
          }
        }
      }

      sourceCounts.value = counts;
      projectSources.value = sources;
      sourceThumbnails.value = thumbnails;
      projectEdits.value = edits;
    } catch (error) {
      console.error('[VideoEditor] Failed to load projects:', error);
    } finally {
      loading.value = false;
    }
  }

  function getSourceCount(projectId: string): number {
    return sourceCounts.value.get(projectId) || 0;
  }

  function getThumbnailUrl(projectId: string): string | null {
    return thumbnailCache.value.get(projectId) || null;
  }

  function getSourceThumbnails(projectId: string): (string | null)[] {
    return sourceThumbnails.value.get(projectId) || [];
  }

  function getProjectEditInfo(projectId: string): ProjectEditInfo {
    return (
      projectEdits.value.get(projectId) || {
        hasAudio: false,
        hasText: false,
        hasStickers: false,
        hasWatermarks: false,
        hasEffects: false,
      }
    );
  }

  function hasAnyEdits(projectId: string): boolean {
    const info = getProjectEditInfo(projectId);
    return info.hasAudio || info.hasText || info.hasStickers || info.hasWatermarks || info.hasEffects;
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours}h ${remainingMins}m`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getRelativeTime(timestamp: number): string {
    return formatRelativeTime(timestamp);
  }

  function openCreateDialog() {
    selectedProject.value = null;
    showDialog.value = true;
  }

  function editProject(project: VideoEditorProject) {
    selectedProject.value = project;
    showDialog.value = true;
  }

  function openProject(project: VideoEditorProject) {
    editorProjectId.value = project.id;
    editorProjectName.value = project.name;
    showEditorDialog.value = true;
  }

  async function handleProjectSubmit(data: { name: string; description?: string }) {
    try {
      if (selectedProject.value) {
        // Update existing project
        await updateVideoEditorProject(selectedProject.value.id, {
          name: data.name,
          description: data.description || null,
        });
      } else {
        // Create new project
        const projectId = await createVideoEditorProject(data.name, data.description);
        // Open the editor for the new project
        editorProjectId.value = projectId;
        editorProjectName.value = data.name;
        showEditorDialog.value = true;
      }
      await loadProjects();
    } catch (error) {
      console.error('[VideoEditor] Failed to save project:', error);
    }
  }

  function handleEditorSave() {
    loadProjects();
  }

  function confirmDelete(project: VideoEditorProject) {
    projectToDelete.value = project;
    showDeleteDialog.value = true;
  }

  function confirmBulkDelete() {
    projectToDelete.value = null;
    showDeleteDialog.value = true;
  }

  async function handleDeleteConfirm() {
    try {
      if (selectedProjects.value.size > 0) {
        // Bulk delete
        for (const id of selectedProjects.value) {
          await deleteVideoEditorProject(id);
        }
        selectedProjects.value.clear();
      } else if (projectToDelete.value) {
        // Single delete
        await deleteVideoEditorProject(projectToDelete.value.id);
      }
      await loadProjects();
    } catch (error) {
      console.error('[VideoEditor] Failed to delete project:', error);
    } finally {
      showDeleteDialog.value = false;
      projectToDelete.value = null;
    }
  }

  function isProjectSelected(id: string): boolean {
    return selectedProjects.value.has(id);
  }

  function toggleProjectSelection(id: string) {
    if (selectedProjects.value.has(id)) {
      selectedProjects.value.delete(id);
    } else {
      selectedProjects.value.add(id);
    }
    // Force reactivity
    selectedProjects.value = new Set(selectedProjects.value);
  }

  function clearSelection() {
    selectedProjects.value.clear();
    selectedProjects.value = new Set();
  }

  // Lifecycle
  onMounted(() => {
    loadProjects();
  });

  // Watch for editor dialog close to refresh projects
  watch(showEditorDialog, (isOpen) => {
    if (!isOpen) {
      loadProjects();
    }
  });
</script>

<style scoped>
  .hover\:scale-102:hover {
    transform: scale(1.02);
  }
</style>
