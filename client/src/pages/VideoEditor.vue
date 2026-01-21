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
          <Input
            v-model="searchQuery"
            placeholder="Search projects..."
            class="videoeditor-header__search-input"
            @focus="openSearchPalette"
            readonly
          />
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
        <h1 class="videoeditor__title">Editor Projects</h1>
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
        <Transition name="selection-bar">
          <div v-if="selectedProjects.size > 0" class="videoeditor__selection-bar">
            <div class="videoeditor__selection-info">
              <Check class="videoeditor__selection-icon" />
              <span>{{ selectedProjects.size }} selected</span>
            </div>
            <div class="videoeditor__selection-actions">
              <button @click="clearSelection" class="videoeditor__selection-clear">Clear</button>
              <button @click="confirmBulkDelete" class="videoeditor__selection-delete">
                <Trash2 class="videoeditor__selection-delete-icon" />
                Delete Selected
              </button>
            </div>
          </div>
        </Transition>

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

                <!-- Clip Project Badge -->
                <div
                  v-if="isClipBasedProject(project.id)"
                  class="videoeditor-card__badge videoeditor-card__badge--clip"
                >
                  <Film class="videoeditor-card__badge-icon" />
                  <span>Clip Project</span>
                </div>

                <!-- Source Count Badge (only show if not a clip project or has multiple sources) -->
                <div
                  v-else-if="getSourceCount(project.id) > 0"
                  class="videoeditor-card__badge videoeditor-card__badge--sources"
                >
                  <Film class="videoeditor-card__badge-icon" />
                  <span>{{ getSourceCount(project.id) }} Sources</span>
                </div>

                <!-- In Editor Badge -->
                <div
                  v-if="hasInEditorClips(project.id)"
                  class="videoeditor-card__badge videoeditor-card__badge--in-editor"
                >
                  <Edit class="videoeditor-card__badge-icon" />
                  <span>{{ getInEditorClipCount(project.id) }} In Editor</span>
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

    <!-- Video Editor Dialog (placeholder during rebuild) -->
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
      variant="destructive"
      @close="showDeleteDialog = false"
      @confirm="handleDeleteConfirm"
    />

    <!-- Search Palette Modal -->
    <SearchPalette
      v-model="showSearchPalette"
      :search-query="paletteSearchQuery"
      :active-tab="paletteActiveTab"
      :placeholder="
        paletteActiveTab === 'search'
          ? 'Search projects by name or description...'
          : paletteActiveTab === 'with_sources'
            ? 'Filter projects with sources...'
            : 'Filter projects with edits...'
      "
      :tabs="videoEditorPaletteTabs"
      @update:search-query="paletteSearchQuery = $event"
      @update:active-tab="onPaletteTabChange"
      @close="closeSearchPalette"
    >
      <!-- Search Results -->
      <template v-if="paletteSearchResults.length > 0">
        <div class="search-palette__results">
          <div class="search-palette__results-header">
            <span class="search-palette__results-label">
              {{
                paletteActiveTab === 'with_sources'
                  ? 'Projects with Sources'
                  : paletteActiveTab === 'has_edits'
                    ? 'Projects with Edits'
                    : 'Results'
              }}
            </span>
            <span class="search-palette__results-count">{{ paletteSearchResults.length }} found</span>
          </div>
          <div class="search-palette__list">
            <div
              v-for="item in paletteSearchResults"
              :key="item.id"
              class="search-palette__item"
              @click="selectPaletteResult(item)"
            >
              <div class="search-palette__item-thumb-wrap">
                <div
                  v-if="item.thumbnailUrl"
                  class="search-palette__item-thumb"
                  :style="{ backgroundImage: `url(${item.thumbnailUrl})` }"
                ></div>
                <div v-else class="search-palette__item-thumb search-palette__item-thumb--empty">
                  <Clapperboard class="w-5 h-5" />
                </div>
              </div>

              <div class="search-palette__item-content">
                <div class="search-palette__item-title">{{ item.project.name }}</div>
                <div class="search-palette__item-meta">
                  <!-- Source count -->
                  <span v-if="item.sourceCount > 0" class="search-palette__item-sources">
                    {{ item.sourceCount }} source{{ item.sourceCount !== 1 ? 's' : '' }}
                  </span>
                  <!-- Edit types -->
                  <span v-if="item.hasEdits" class="search-palette__item-edits-tag">
                    {{ item.editTypes.join(', ') }}
                  </span>
                  <!-- Duration -->
                  <span v-if="item.project.total_duration > 0" class="search-palette__item-duration">
                    {{ formatDuration(item.project.total_duration) }}
                  </span>
                </div>
              </div>

              <div class="search-palette__item-arrow">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M6 4L10 8L6 12"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- No Results -->
      <template v-else-if="paletteSearchQuery || paletteActiveTab !== 'search'">
        <div class="search-palette__empty-state">
          <div class="search-palette__empty-icon-wrap">
            <Search v-if="paletteActiveTab === 'search'" class="search-palette__empty-icon" />
            <Film v-else-if="paletteActiveTab === 'with_sources'" class="search-palette__empty-icon" />
            <Edit v-else class="search-palette__empty-icon" />
          </div>
          <h3 class="search-palette__empty-title">
            {{
              paletteActiveTab === 'with_sources'
                ? 'No projects with sources'
                : paletteActiveTab === 'has_edits'
                  ? 'No projects with edits'
                  : 'No projects found'
            }}
          </h3>
          <p class="search-palette__empty-desc">
            {{
              paletteActiveTab === 'with_sources'
                ? 'Add video sources to your projects to see them here'
                : paletteActiveTab === 'has_edits'
                  ? 'Add text, audio, or effects to your projects'
                  : 'Try a different search term'
            }}
          </p>
        </div>
      </template>

      <!-- Initial State -->
      <template v-else>
        <div class="search-palette__empty-state">
          <div class="search-palette__empty-icon-wrap search-palette__empty-icon-wrap--subtle">
            <Search class="search-palette__empty-icon" />
          </div>
          <h3 class="search-palette__empty-title">Search your editor projects</h3>
          <p class="search-palette__empty-desc">Find projects by name or description</p>
        </div>
      </template>
    </SearchPalette>

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch, Transition } from 'vue';
  import { useRouter } from 'vue-router';
  import { Clapperboard, Plus, Trash2, Search, Check, Play, Edit, Film, Clock } from 'lucide-vue-next';
  import { Input } from '@/components/ui/input';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import VideoEditorProjectDialog from '@/components/video-editor/VideoEditorProjectDialog.vue';
  import ClipEditorDialog from '@/components/clip-editor/ClipEditorDialogPlaceholder.vue';
  import SearchPalette, { type SearchPaletteTab } from '@/components/SearchPalette.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import { useAuthStore } from '@/stores/auth';
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
  import { useInEditorClips } from '@/stores/useInEditorClips';
  import { invoke } from '@tauri-apps/api/core';

  const { getRelativeTime: formatRelativeTime } = useFormatters();

  // In-editor clips store
  const inEditorStore = useInEditorClips();
  inEditorStore.hydrate();

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

  // Search palette state
  const showSearchPalette = ref(false);
  const paletteSearchQuery = ref('');
  const paletteActiveTab = ref<'search' | 'with_sources' | 'has_edits'>('search');

  // Dialog state
  const showDialog = ref(false);
  const selectedProject = ref<VideoEditorProject | null>(null);
  const showEditorDialog = ref(false);
  const editorProjectId = ref<string | null>(null);
  const editorProjectName = ref('Video Project');
  const showAuthModal = ref(false);

  const authStore = useAuthStore();
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

  // Count projects with sources
  const projectsWithSourcesCount = computed(() => {
    return projects.value.filter((p) => getSourceCount(p.id) > 0).length;
  });

  // Count projects with edits
  const projectsWithEditsCount = computed(() => {
    return projects.value.filter((p) => {
      const editInfo = projectEdits.value.get(p.id);
      return (
        editInfo &&
        (editInfo.hasAudio || editInfo.hasText || editInfo.hasStickers || editInfo.hasWatermarks || editInfo.hasEffects)
      );
    }).length;
  });

  // Computed tabs for search palette
  const videoEditorPaletteTabs = computed((): SearchPaletteTab[] => [
    { id: 'search', label: 'Search All', icon: Search },
    {
      id: 'with_sources',
      label: 'With Sources',
      icon: Film,
      badge: projectsWithSourcesCount.value > 0 ? projectsWithSourcesCount.value : undefined,
    },
    {
      id: 'has_edits',
      label: 'Has Edits',
      icon: Edit,
      badge: projectsWithEditsCount.value > 0 ? projectsWithEditsCount.value : undefined,
    },
  ]);

  // Search results for the palette
  interface PaletteProjectResult {
    id: string;
    project: VideoEditorProject;
    thumbnailUrl: string | null;
    sourceCount: number;
    hasEdits: boolean;
    editTypes: string[];
  }

  const paletteSearchResults = computed((): PaletteProjectResult[] => {
    if (!paletteSearchQuery.value && paletteActiveTab.value === 'search') return [];

    let result = [...projects.value];

    // Apply search query filter
    if (paletteSearchQuery.value) {
      const query = paletteSearchQuery.value.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(query) || (p.description && p.description.toLowerCase().includes(query))
      );
    }

    // Apply tab-specific filters
    if (paletteActiveTab.value === 'with_sources') {
      result = result.filter((p) => getSourceCount(p.id) > 0);
    } else if (paletteActiveTab.value === 'has_edits') {
      result = result.filter((p) => {
        const editInfo = projectEdits.value.get(p.id);
        return (
          editInfo &&
          (editInfo.hasAudio ||
            editInfo.hasText ||
            editInfo.hasStickers ||
            editInfo.hasWatermarks ||
            editInfo.hasEffects)
        );
      });
    }

    // Sort by updated_at descending
    result.sort((a, b) => b.updated_at - a.updated_at);

    // Limit results
    return result.slice(0, 20).map((project) => {
      const editInfo = projectEdits.value.get(project.id);
      const editTypes: string[] = [];
      if (editInfo) {
        if (editInfo.hasAudio) editTypes.push('Audio');
        if (editInfo.hasText) editTypes.push('Text');
        if (editInfo.hasStickers) editTypes.push('Stickers');
        if (editInfo.hasWatermarks) editTypes.push('Watermarks');
        if (editInfo.hasEffects) editTypes.push('Effects');
      }

      return {
        id: project.id,
        project,
        thumbnailUrl: getSourceThumbnails(project.id)[0] || null,
        sourceCount: getSourceCount(project.id),
        hasEdits: editTypes.length > 0,
        editTypes,
      };
    });
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

  // Check if a project has any in-editor clips as sources
  function hasInEditorClips(projectId: string): boolean {
    const sources = projectSources.value.get(projectId) || [];
    return sources.some(
      (source) => source.source_type === 'clip' && source.source_id && inEditorStore.isInEditor(source.source_id)
    );
  }

  // Get count of in-editor clips in a project
  function getInEditorClipCount(projectId: string): number {
    const sources = projectSources.value.get(projectId) || [];
    return sources.filter(
      (source) => source.source_type === 'clip' && source.source_id && inEditorStore.isInEditor(source.source_id)
    ).length;
  }

  // Check if a project is a clip-based project (has clip sources)
  function isClipBasedProject(projectId: string): boolean {
    const sources = projectSources.value.get(projectId) || [];
    return sources.some((source) => source.source_type === 'clip' && source.source_id);
  }

  // Get the primary clip ID for a clip-based project
  function getPrimaryClipId(projectId: string): string | null {
    const sources = projectSources.value.get(projectId) || [];
    const clipSource = sources.find((source) => source.source_type === 'clip' && source.source_id);
    return clipSource?.source_id || null;
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
    if (!authStore.isAuthenticated) {
      showAuthModal.value = true;
      return;
    }
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
          // Clear in-editor clips for this project before deleting
          clearInEditorClipsForProject(id);
          await deleteVideoEditorProject(id);
        }
        selectedProjects.value.clear();
      } else if (projectToDelete.value) {
        // Clear in-editor clips for this project before deleting
        clearInEditorClipsForProject(projectToDelete.value.id);
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

  // Clear in-editor clips that belong to a video editor project
  function clearInEditorClipsForProject(projectId: string) {
    const sources = projectSources.value.get(projectId) || [];
    const clipIdsToRemove = sources
      .filter((source) => source.source_type === 'clip' && source.source_id && inEditorStore.isInEditor(source.source_id))
      .map((source) => source.source_id!);

    if (clipIdsToRemove.length > 0) {
      inEditorStore.clearMany(clipIdsToRemove);
      console.log('[VideoEditor] Cleared in-editor clips for deleted project:', projectId, clipIdsToRemove);
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

  // Search palette functions
  function openSearchPalette() {
    showSearchPalette.value = true;
    paletteSearchQuery.value = searchQuery.value;
  }

  function closeSearchPalette() {
    showSearchPalette.value = false;
    paletteSearchQuery.value = '';
    paletteActiveTab.value = 'search';
  }

  function onPaletteTabChange(tabId: string) {
    paletteActiveTab.value = tabId as 'search' | 'with_sources' | 'has_edits';
    paletteSearchQuery.value = '';
  }

  function selectPaletteResult(result: PaletteProjectResult) {
    closeSearchPalette();
    openProject(result.project);
  }

  // Lifecycle
  onMounted(async () => {
    const router = useRouter();
    await loadProjects();
    
    // Check if we should auto-open a project (from navigation state)
    const state = history.state as { openProjectId?: string };
    if (state?.openProjectId && projects.value.length > 0) {
      const projectToOpen = projects.value.find(p => p.id === state.openProjectId);
      if (projectToOpen) {
        openProject(projectToOpen);
        // Clear the state so it doesn't auto-open again on refresh
        router.replace({ path: '/video-editor' });
      }
    }
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
    margin: 0 0 0.2rem;
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
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .videoeditor__selection-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    color: var(--sidebar-text);
    font-weight: 500;
  }

  .videoeditor__selection-icon {
    width: 16px;
    height: 16px;
    color: var(--sidebar-accent);
  }

  .videoeditor__selection-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .videoeditor__selection-clear {
    padding: 0.375rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    background: transparent;
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .videoeditor__selection-clear:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
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

  .videoeditor__selection-delete-icon {
    width: 13px;
    height: 13px;
  }

  /* Selection Bar Transitions */
  .selection-bar-enter-active {
    animation: slideDown 0.2s ease-out;
  }

  .selection-bar-leave-active {
    animation: slideUp 0.15s ease-in;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-8px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes slideUp {
    from {
      opacity: 1;
      transform: translateY(0);
    }
    to {
      opacity: 0;
      transform: translateY(-8px);
    }
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
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
  }

  .videoeditor-card--selected:hover {
    border-color: var(--sidebar-accent);
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

  .videoeditor-card__checkbox-inner--checked:hover {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
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
    gap: 0.25rem;
    padding: 0.3125rem 0.5rem;
    border-radius: 5px;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.02em;
    backdrop-filter: blur(8px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  }

  .videoeditor-card__badge--sources {
    background-color: rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
  }

  .videoeditor-card__badge--clip {
    background-color: rgba(139, 92, 246, 0.3);
    color: #c4b5fd;
  }

  .videoeditor-card__badge--in-editor {
    top: auto;
    bottom: 52px;
    background-color: rgba(59, 130, 246, 0.3);
    color: #93c5fd;
  }

  .videoeditor-card__badge-icon {
    width: 10px;
    height: 10px;
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

  /* ===== Search Palette Content Styles ===== */
  /* Results */
  .search-palette__results {
    display: flex;
    flex-direction: column;
  }

  .search-palette__results-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1.25rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  }

  .search-palette__results-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.35);
  }

  .search-palette__results-count {
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.4);
  }

  .search-palette__list {
    display: flex;
    flex-direction: column;
  }

  /* Item */
  .search-palette__item {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding: 0.75rem 1.25rem;
    cursor: pointer;
    transition: all 120ms ease;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03);
  }

  .search-palette__item:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .search-palette__item:last-child {
    border-bottom: none;
  }

  .search-palette__item:active {
    background: rgba(255, 255, 255, 0.06);
  }

  .search-palette__item-thumb-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .search-palette__item-thumb {
    width: 72px;
    height: 42px;
    border-radius: 6px;
    background-size: cover;
    background-position: center;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .search-palette__item-thumb--empty {
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255, 255, 255, 0.25);
  }

  .search-palette__item-content {
    flex: 1;
    min-width: 0;
  }

  .search-palette__item-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 0.25rem;
    letter-spacing: -0.01em;
  }

  .search-palette__item:hover .search-palette__item-title {
    color: white;
  }

  .search-palette__item-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    flex-wrap: wrap;
  }

  .search-palette__item-sources {
    color: rgba(255, 255, 255, 0.45);
    font-weight: 450;
  }

  .search-palette__item-edits-tag {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    background: rgba(139, 92, 246, 0.15);
    border-radius: 4px;
    color: #c4b5fd;
    font-weight: 600;
    font-size: 0.6875rem;
  }

  .search-palette__item-duration {
    color: rgba(255, 255, 255, 0.4);
    font-weight: 450;
  }

  .search-palette__item-arrow {
    flex-shrink: 0;
    color: rgba(255, 255, 255, 0.2);
    transition: all 150ms ease;
  }

  .search-palette__item:hover .search-palette__item-arrow {
    color: rgba(255, 255, 255, 0.5);
    transform: translateX(2px);
  }

  /* Empty State */
  .search-palette__empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3.5rem 1.5rem;
    text-align: center;
  }

  .search-palette__empty-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    margin-bottom: 1.25rem;
  }

  .search-palette__empty-icon-wrap--subtle {
    background: rgba(255, 255, 255, 0.03);
    border-color: rgba(255, 255, 255, 0.05);
  }

  .search-palette__empty-icon {
    width: 26px;
    height: 26px;
    color: rgba(255, 255, 255, 0.3);
  }

  .search-palette__empty-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.85);
    margin: 0 0 0.375rem;
    letter-spacing: -0.01em;
  }

  .search-palette__empty-desc {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.4);
    margin: 0;
    max-width: 280px;
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
