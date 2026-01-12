<template>
  <PageLayout
    title="Video Editor"
    description="Create and edit video projects from multiple sources"
    :show-header="true"
    :icon="Clapperboard"
  >
    <template #actions>
      <div class="videoeditor-header-actions">
        <!-- Search -->
        <div class="videoeditor-header__search">
          <Search class="videoeditor-header__search-icon" />
          <Input v-model="searchQuery" placeholder="Search projects..." class="videoeditor-header__search-input" />
        </div>

        <!-- Sort Filter -->
        <CustomDropdown
          v-model="sortBy"
          :options="sortOptions"
          placeholder="Sort By"
          class="videoeditor-header__sort"
          trigger-class="videoeditor-header__dropdown-trigger"
        />

        <!-- New Project Button -->
        <button @click="openCreateDialog" class="videoeditor-create-btn">
          <Plus class="videoeditor-create-btn__icon" />
          New Project
        </button>
      </div>
    </template>

    <div class="videoeditor__content" :class="{ 'videoeditor__content--empty': !loading && projects.length === 0 }">
      <!-- Page Heading -->
      <div v-if="projects.length > 0 || loading" class="videoeditor__heading">
        <h1 class="videoeditor__title">Your Editor Projects</h1>
        <p class="videoeditor__subtitle">Create multi-source video projects with professional editing tools</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="videoeditor__loading">
        <!-- Skeleton Cards Grid -->
        <div class="videoeditor__grid">
          <div v-for="i in 6" :key="`skeleton-${i}`" class="videoeditor-card videoeditor-card--skeleton">
            <div class="videoeditor-card__skeleton-bg"></div>
            <div class="videoeditor-card__bottom">
              <div class="videoeditor-skeleton__card-title"></div>
              <div class="videoeditor-skeleton__card-meta"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Projects Content -->
      <div v-else-if="projects.length > 0" class="videoeditor__main">
        <!-- Selection Bar (shown when items selected) -->
        <div v-if="selectedProjects.size > 0" class="videoeditor__selection-bar">
          <button @click="confirmBulkDelete" class="videoeditor__selection-delete">
            <Trash2 class="videoeditor__selection-icon" />
            Delete ({{ selectedProjects.size }})
          </button>
          <span class="videoeditor__selection-count">{{ selectedProjects.size }} selected</span>
          <button @click="clearSelection" class="videoeditor__selection-clear">Clear</button>
        </div>

        <!-- Projects Grid -->
        <div v-if="filteredProjects.length > 0" class="videoeditor__section">
          <div v-for="group in groupedProjects" :key="group.dateLabel" class="videoeditor__date-group">
            <!-- Date Header -->
            <h3 class="videoeditor__section-header">{{ group.dateLabel }}</h3>

            <div class="videoeditor__grid">
              <div
                v-for="project in group.projects"
                :key="project.id"
                class="videoeditor-card"
                :class="{ 'videoeditor-card--selected': isProjectSelected(project.id) }"
                @click="openProject(project)"
              >
                <!-- Selection Checkbox (visible on hover or when selected) -->
                <div
                  class="videoeditor-card__checkbox"
                  :class="{ 'videoeditor-card__checkbox--visible': isProjectSelected(project.id) }"
                  @click.stop="toggleProjectSelection(project.id)"
                >
                  <div
                    class="videoeditor-card__checkbox-inner"
                    :class="{ 'videoeditor-card__checkbox-inner--checked': isProjectSelected(project.id) }"
                  >
                    <Check v-if="isProjectSelected(project.id)" class="videoeditor-card__checkbox-icon" />
                  </div>
                </div>

                <!-- Source Count Badge -->
                <div
                  v-if="getSourceCount(project.id) > 0"
                  class="videoeditor-card__badge videoeditor-card__badge--sources"
                >
                  <Film class="videoeditor-card__badge-icon" />
                  <span>{{ getSourceCount(project.id) }} Sources</span>
                </div>

                <!-- Thumbnail background with vignette -->
                <div
                  v-if="getSourceThumbnails(project.id)[0]"
                  class="videoeditor-card__thumbnail"
                  :style="{ backgroundImage: `url(${getSourceThumbnails(project.id)[0]})` }"
                >
                  <!-- Vignette overlay -->
                  <div class="videoeditor-card__vignette"></div>
                </div>
                <!-- Fallback background for projects without thumbnails -->
                <div v-else class="videoeditor-card__thumbnail videoeditor-card__thumbnail--empty">
                  <div class="videoeditor-card__thumbnail-gradient"></div>
                  <div class="videoeditor-card__empty-icon">
                    <Clapperboard class="videoeditor-card__folder-icon" />
                  </div>
                </div>

                <!-- Bottom Overlay with Info -->
                <div class="videoeditor-card__bottom">
                  <!-- Title -->
                  <h3 class="videoeditor-card__title" :title="project.name">
                    {{ project.name }}
                  </h3>

                  <!-- Metadata Row -->
                  <div class="videoeditor-card__meta">
                    <!-- Duration Badge -->
                    <div v-if="project.total_duration > 0" class="videoeditor-card__duration">
                      <Clock class="videoeditor-card__duration-icon" />
                      <span>{{ formatDuration(project.total_duration) }}</span>
                    </div>
                    <span v-else class="videoeditor-card__meta-text videoeditor-card__meta-text--muted">
                      Empty project
                    </span>

                    <span class="videoeditor-card__dot"></span>

                    <!-- Time -->
                    <span class="videoeditor-card__meta-text">{{ getRelativeTime(project.updated_at) }}</span>
                  </div>
                </div>

                <!-- Hover Overlay Buttons -->
                <div class="videoeditor-card__hover-actions">
                  <button class="videoeditor-card__action-btn" title="Open Editor" @click.stop="openProject(project)">
                    <Play class="videoeditor-card__action-icon" />
                  </button>

                  <button class="videoeditor-card__action-btn" title="Edit Details" @click.stop="editProject(project)">
                    <Edit class="videoeditor-card__action-icon" />
                  </button>

                  <button class="videoeditor-card__action-btn" title="Delete" @click.stop="confirmDelete(project)">
                    <Trash2 class="videoeditor-card__action-icon" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- No Results State -->
        <div v-if="filteredProjects.length === 0" class="videoeditor__no-results">
          <div class="videoeditor__no-results-icon-wrapper">
            <Search class="videoeditor__no-results-icon" />
          </div>
          <h3 class="videoeditor__no-results-title">No projects found</h3>
          <p class="videoeditor__no-results-description">
            We couldn't find any projects matching your search. Try adjusting your search query.
          </p>
          <button @click="searchQuery = ''" class="videoeditor__no-results-btn">Clear search</button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="videoeditor__empty">
        <div class="videoeditor__empty-icon-wrapper">
          <Clapperboard class="videoeditor__empty-icon" />
        </div>
        <h3 class="videoeditor__empty-title">No editor projects yet</h3>
        <p class="videoeditor__empty-description">Create your first video editing project to get started</p>
      </div>
    </div>

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
  import { Clapperboard, Plus, Trash2, Search, Check, Play, Edit, Film, Clock } from 'lucide-vue-next';
  import { Input } from '@/components/ui/input';
  import PageLayout from '@/components/PageLayout.vue';
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
  const sourceThumbnails = ref<Map<string, (string | null)[]>>(new Map());
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
                thumbnailUrls.push(null);
              }
            } catch (err) {
              console.warn('[VideoEditor] Failed to load source thumbnail:', source.id, err);
              thumbnailUrls.push(null);
            }
          } else {
            thumbnailUrls.push(null);
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

  function getSourceThumbnails(projectId: string): (string | null)[] {
    return sourceThumbnails.value.get(projectId) || [];
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
  /* ===== Content Container ===== */
  .videoeditor__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    width: 100%;
    flex: 1;
  }

  .videoeditor__content--empty {
    justify-content: center;
    align-items: center;
  }

  .videoeditor__main {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .videoeditor__loading {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* ===== Page Heading ===== */
  .videoeditor__heading {
    margin-bottom: 0.5rem;
  }

  .videoeditor__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .videoeditor__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Header Actions ===== */
  .videoeditor-header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .videoeditor-header__search {
    position: relative;
    width: 200px;
  }

  .videoeditor-header__search-icon {
    position: absolute;
    left: 0.625rem;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .videoeditor-header__search-input {
    width: 100%;
    padding-left: 2rem;
    height: 32px;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
  }

  .videoeditor-header__search-input:focus {
    border-color: var(--sidebar-accent);
    outline: none;
  }

  .videoeditor-header__sort {
    width: 140px;
    flex-shrink: 0;
  }

  /* Dropdown trigger button styling */
  :deep(.videoeditor-header__dropdown-trigger) {
    height: 32px !important;
    padding: 0 0.625rem !important;
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 6px !important;
    font-size: 0.75rem !important;
    color: var(--sidebar-text) !important;
    transition: all 150ms ease !important;
  }

  :deep(.videoeditor-header__dropdown-trigger:hover) {
    border-color: rgba(255, 255, 255, 0.15) !important;
  }

  :deep(.videoeditor-header__dropdown-trigger span) {
    color: var(--sidebar-text) !important;
  }

  :deep(.videoeditor-header__dropdown-trigger svg) {
    width: 12px !important;
    height: 12px !important;
    color: var(--sidebar-text-muted) !important;
  }

  .videoeditor-create-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
    border: none;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .videoeditor-create-btn:hover:not(:disabled) {
    opacity: 0.9;
  }

  .videoeditor-create-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .videoeditor-create-btn__icon {
    width: 14px;
    height: 14px;
  }

  /* ===== Skeleton Loading States ===== */
  .videoeditor-skeleton__card-title {
    height: 16px;
    width: 70%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 4px;
    margin-bottom: 0.5rem;
  }

  .videoeditor-skeleton__card-meta {
    height: 12px;
    width: 50%;
    background: linear-gradient(
      90deg,
      rgba(255, 255, 255, 0.1) 25%,
      rgba(255, 255, 255, 0.2) 50%,
      rgba(255, 255, 255, 0.1) 75%
    );
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    animation-delay: 0.15s;
    border-radius: 4px;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  /* ===== Selection Bar ===== */
  .videoeditor__selection-bar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.625rem 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .videoeditor__selection-delete {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: white;
    background-color: #ef4444;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .videoeditor__selection-delete:hover:not(:disabled) {
    background-color: #dc2626;
  }

  .videoeditor__selection-icon {
    width: 13px;
    height: 13px;
  }

  .videoeditor__selection-count {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  .videoeditor__selection-clear {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    padding: 0.375rem 0.75rem;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .videoeditor__selection-clear:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  /* ===== Sections ===== */
  .videoeditor__section {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .videoeditor__date-group {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .videoeditor__section-header {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
    padding-bottom: 0.1rem;
  }

  /* ===== Projects Grid ===== */
  .videoeditor__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1.25rem;
  }

  @media (min-width: 640px) {
    .videoeditor__grid {
      grid-template-columns: repeat(1, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .videoeditor__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1400px) {
    .videoeditor__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  @media (min-width: 1800px) {
    .videoeditor__grid {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  @media (min-width: 2200px) {
    .videoeditor__grid {
      grid-template-columns: repeat(5, 1fr);
    }
  }

  /* ===== Video Editor Card ===== */
  .videoeditor-card {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: all 200ms ease;
    aspect-ratio: 16 / 9;
  }

  .videoeditor-card:hover {
    border-color: rgba(255, 255, 255, 0.15);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    transform: scale(1.02);
  }

  .videoeditor-card--selected {
    border-color: var(--sidebar-accent);
    box-shadow:
      0 0 0 2px var(--sidebar-accent),
      0 8px 32px rgba(0, 0, 0, 0.25);
  }

  .videoeditor-card--skeleton {
    pointer-events: none;
  }

  .videoeditor-card__skeleton-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--sidebar-hover) 0%, var(--sidebar-surface) 100%);
  }

  /* Checkbox */
  .videoeditor-card__checkbox {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 30;
    opacity: 0;
    transition: opacity 150ms ease;
  }

  .videoeditor-card:hover .videoeditor-card__checkbox,
  .videoeditor-card__checkbox--visible {
    opacity: 1;
  }

  .videoeditor-card__checkbox-inner {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.6);
    border: 1px solid rgba(255, 255, 255, 0.45);
    color: white;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    transition: all 150ms ease;
  }

  .videoeditor-card__checkbox-inner:hover {
    background-color: rgba(0, 0, 0, 0.8);
  }

  .videoeditor-card__checkbox-inner--checked {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .videoeditor-card__checkbox-icon {
    width: 16px;
    height: 16px;
  }

  /* Badges */
  .videoeditor-card__badge {
    position: absolute;
    top: 1rem;
    left: 1rem;
    z-index: 20;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 700;
    backdrop-filter: blur(4px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .videoeditor-card__badge--sources {
    background-color: rgba(139, 92, 246, 0.9);
    color: white;
  }

  .videoeditor-card__badge-icon {
    width: 12px;
    height: 12px;
  }

  /* Thumbnail */
  .videoeditor-card__thumbnail {
    position: absolute;
    inset: 0;
    z-index: 0;
    background-size: cover;
    background-position: center;
    background-repeat: no-repeat;
  }

  .videoeditor-card__vignette {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 40%, transparent 70%);
  }

  .videoeditor-card__thumbnail--empty {
    background-color: var(--sidebar-hover);
  }

  .videoeditor-card__thumbnail-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.5) 100%);
  }

  /* Empty State Icons */
  .videoeditor-card__empty-icon {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0.2;
  }

  .videoeditor-card__folder-icon {
    width: 64px;
    height: 64px;
    color: var(--sidebar-text);
  }

  /* Bottom Info */
  .videoeditor-card__bottom {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 5;
    padding: 1rem;
    padding-top: 7rem;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 50%, transparent 100%);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .videoeditor-card__title {
    font-size: 1rem;
    font-weight: 700;
    color: white;
    margin: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
    line-height: 1.3;
    transition: color 150ms ease;
  }

  .videoeditor-card:hover .videoeditor-card__title {
    color: rgba(255, 255, 255, 0.9);
  }

  .videoeditor-card__meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.7);
    flex-wrap: wrap;
  }

  .videoeditor-card__meta-text {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .videoeditor-card__meta-text--muted {
    color: rgba(255, 255, 255, 0.5);
  }

  .videoeditor-card__dot {
    width: 3px;
    height: 3px;
    border-radius: 50%;
    background-color: rgba(255, 255, 255, 0.4);
    flex-shrink: 0;
  }

  /* Duration Badge */
  .videoeditor-card__duration {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    background-color: rgba(139, 92, 246, 0.2);
    border: 1px solid rgba(139, 92, 246, 0.3);
    border-radius: 4px;
    color: #c4b5fd;
    font-weight: 600;
  }

  .videoeditor-card__duration-icon {
    width: 10px;
    height: 10px;
  }

  /* Hover Actions */
  .videoeditor-card__hover-actions {
    position: absolute;
    inset: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    background-color: rgba(0, 0, 0, 0.4);
    opacity: 0;
    transition: opacity 200ms ease;
  }

  .videoeditor-card:hover .videoeditor-card__hover-actions {
    opacity: 1;
  }

  .videoeditor-card__action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.5rem;
    background-color: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 9999px;
    color: #1f2937;
    cursor: pointer;
    transition: all 150ms ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
  }

  .videoeditor-card__action-btn:hover {
    background-color: white;
    transform: scale(1.1);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
  }

  .videoeditor-card__action-icon {
    width: 20px;
    height: 20px;
  }

  /* ===== No Results State ===== */
  .videoeditor__no-results {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 1rem;
    text-align: center;
  }

  .videoeditor__no-results-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    background-color: var(--sidebar-hover);
    border-radius: 9999px;
    margin-bottom: 1rem;
  }

  .videoeditor__no-results-icon {
    width: 32px;
    height: 32px;
    color: var(--sidebar-text-muted);
  }

  .videoeditor__no-results-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.25rem;
  }

  .videoeditor__no-results-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem;
    max-width: 24rem;
  }

  .videoeditor__no-results-btn {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-accent);
    background: transparent;
    border: none;
    cursor: pointer;
    transition: opacity 150ms ease;
  }

  .videoeditor__no-results-btn:hover {
    opacity: 0.8;
    text-decoration: underline;
  }

  /* ===== Empty State ===== */
  .videoeditor__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .videoeditor__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .videoeditor__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .videoeditor__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .videoeditor__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }
</style>

<!-- Global styles for dropdown menu (rendered via Teleport outside component scope) -->
<style>
  /* Video Editor page dropdown menu styling */
  .videoeditor-header__sort + div[class*='fixed'],
  div.fixed.bg-popover {
    background-color: var(--sidebar-surface) !important;
    border: 1px solid var(--sidebar-border) !important;
    border-radius: 8px !important;
    padding: 0.25rem !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
    animation: videoeditorDropdownFade 100ms ease-out !important;
  }

  @keyframes videoeditorDropdownFade {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
</style>
