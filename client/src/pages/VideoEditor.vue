<template>
  <PageLayout
    title="Video Editor"
    description="Create and edit video projects from multiple sources"
    :show-header="true"
    :icon="Clapperboard"
  >
    <template #actions>
      <Button variant="primary" @click="openCreateDialog">
        <Plus />
        New project
      </Button>
    </template>

    <template #toolbar>
      <SelectionBar v-if="selectedProjects.size > 0" :count="selectedProjects.size" @clear="clearSelection">
        <Button variant="destructive-soft" size="sm" @click="confirmBulkDelete">
          <Trash2 />
          Delete
        </Button>
      </SelectionBar>
      <template v-else>
        <!-- Opens the search palette (quick open + filters) -->
        <SearchPaletteTrigger
          placeholder="Search projects…"
          :query="searchQuery"
          class="w-64 shrink"
          @open="openSearchPalette"
          @clear="searchQuery = ''"
        />
        <div class="w-40 shrink-0">
          <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort by" />
        </div>
      </template>
    </template>

    <!-- Skeleton on the first load only, then projects grouped by last update -->
    <ProjectGrid
      v-if="(loading && !projects.length) || filteredProjects.length > 0"
      :items="filteredProjects"
      :loading="loading"
      :item-key="(project) => project.id"
      :group-date="(project) => project.updated_at"
    >
      <template #tile="{ item: project }">
        <VideoEditorProjectCard
          :name="project.name"
          :thumbnail-url="getSourceThumbnails(project.id)[0]"
          :selected="isProjectSelected(project.id)"
          :is-clip-project="isClipBasedProject(project.id)"
          :source-count="getSourceCount(project.id)"
          :in-editor-count="hasInEditorClips(project.id) ? getInEditorClipCount(project.id) : 0"
          :duration="project.total_duration > 0 ? formatDuration(project.total_duration) : ''"
          :updated-label="getRelativeTime(project.updated_at)"
          @open="openProject(project)"
          @edit="editProject(project)"
          @delete="confirmDelete(project)"
          @toggle-select="toggleProjectSelection(project.id)"
        />
      </template>
    </ProjectGrid>

    <!-- No results -->
    <EmptyState
      v-else-if="projects.length > 0"
      :icon="Search"
      title="No projects found"
      description="No projects match your search. Try a different name."
    >
      <Button variant="secondary" size="sm" @click="searchQuery = ''">Clear search</Button>
    </EmptyState>

    <!-- Empty -->
    <EmptyState
      v-else
      :icon="Clapperboard"
      title="No editor projects yet"
      description="Combine clips, videos and audio into a new edit on the multi-track timeline."
    >
      <Button variant="primary" @click="openCreateDialog">
        <Plus />
        New project
      </Button>
    </EmptyState>

    <!-- Create/Edit Dialog -->
    <VideoEditorProjectDialog v-model="showDialog" :project="selectedProject" @submit="handleProjectSubmit" />

    <!-- Delete Confirmation Modal -->
    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete project"
      :message="deleteMessage"
      suffix="This action cannot be undone."
      confirm-text="Delete"
      variant="destructive"
      :show-cannot-undone-text="false"
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
      <div v-if="paletteSearchResults.length > 0" class="flex flex-col">
        <div class="flex items-center justify-between border-b border-line-subtle px-5 py-2.5">
          <span class="eyebrow">
            {{
              paletteActiveTab === 'with_sources'
                ? 'Projects with sources'
                : paletteActiveTab === 'has_edits'
                  ? 'Projects with edits'
                  : 'Results'
            }}
          </span>
          <span class="tabular text-xs text-fg-subtle">{{ paletteSearchResults.length }} found</span>
        </div>
        <div class="flex flex-col p-1.5">
          <button
            v-for="item in paletteSearchResults"
            :key="item.id"
            type="button"
            class="group flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-surface-hover"
            @click="selectPaletteResult(item)"
          >
            <div
              v-if="item.thumbnailUrl"
              class="h-[42px] w-[72px] shrink-0 rounded-md border border-line-subtle bg-surface-sunken bg-cover bg-center"
              :style="{ backgroundImage: `url(${item.thumbnailUrl})` }"
            />
            <div
              v-else
              class="grid h-[42px] w-[72px] shrink-0 place-items-center rounded-md border border-line-subtle bg-surface-sunken text-fg-disabled"
            >
              <Clapperboard class="size-5" />
            </div>

            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-fg">{{ item.project.name }}</div>
              <div class="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
                <span v-if="item.sourceCount > 0">
                  {{ item.sourceCount }} source{{ item.sourceCount !== 1 ? 's' : '' }}
                </span>
                <Badge v-if="item.hasEdits" variant="neutral">{{ item.editTypes.join(', ') }}</Badge>
                <span v-if="item.project.total_duration > 0" class="tabular">
                  {{ formatDuration(item.project.total_duration) }}
                </span>
              </div>
            </div>

            <ChevronRight class="size-4 shrink-0 text-fg-disabled transition-colors group-hover:text-fg-muted" />
          </button>
        </div>
      </div>

      <!-- No Results -->
      <EmptyState
        v-else-if="paletteSearchQuery || paletteActiveTab !== 'search'"
        size="sm"
        :icon="paletteActiveTab === 'with_sources' ? Film : paletteActiveTab === 'has_edits' ? Edit : Search"
        :title="
          paletteActiveTab === 'with_sources'
            ? 'No projects with sources'
            : paletteActiveTab === 'has_edits'
              ? 'No projects with edits'
              : 'No projects found'
        "
        :description="
          paletteActiveTab === 'with_sources'
            ? 'Add video sources to your projects to see them here'
            : paletteActiveTab === 'has_edits'
              ? 'Add text, audio, or effects to your projects'
              : 'Try a different search term'
        "
      />

      <!-- Initial State -->
      <EmptyState
        v-else
        size="sm"
        :icon="Search"
        title="Search your editor projects"
        description="Find projects by name or description"
      />
    </SearchPalette>

    <!-- Auth Modal -->
    <AuthModal v-model="showAuthModal" />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { useRouter, useRoute } from 'vue-router';
  import { Clapperboard, Plus, Trash2, Search, Edit, Film, ChevronRight } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Badge } from '@/components/ui/badge';
  import { EmptyState } from '@/components/ui/empty-state';
  import SearchPaletteTrigger from '@/components/SearchPaletteTrigger.vue';
  import PageLayout from '@/components/PageLayout.vue';
  import { SelectionBar } from '@/components/ui/selection-bar';
  import VideoEditorProjectCard from '@/components/video-editor/VideoEditorProjectCard.vue';
  import ProjectGrid from '@/components/create/ProjectGrid.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import VideoEditorProjectDialog from '@/components/video-editor/VideoEditorProjectDialog.vue';
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
    updateVideoEditorSource,
  } from '@/services/database/video-editor-projects';
  import { storageService } from '@/editor/storage/tauri-storage-adapter';
  import { getFullVideoEditorEdit } from '@/services/database/video-editor-edits';
  import { getRawVideo } from '@/services/database/raw-videos';
  import { getClipWithBuildStatus } from '@/services/database/clip-build';
  import { useFormatters } from '@/composables/useFormatters';
  import { useInEditorClips } from '@/stores/useInEditorClips';
  import { invoke } from '@tauri-apps/api/core';

  const router = useRouter();
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
  const showAuthModal = ref(false);

  const authStore = useAuthStore();
  const showDeleteDialog = ref(false);
  const projectToDelete = ref<VideoEditorProject | null>(null);

  // Sort options
  const sortOptions = [
    { value: 'updated', label: 'Last updated' },
    { value: 'created', label: 'Date created' },
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
    { id: 'search', label: 'Search all', icon: Search },
    {
      id: 'with_sources',
      label: 'With sources',
      icon: Film,
      badge: projectsWithSourcesCount.value > 0 ? projectsWithSourcesCount.value : undefined,
    },
    {
      id: 'has_edits',
      label: 'Has edits',
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
    // Published together with its metadata so tiles never render half-loaded
    let loadedProjects: VideoEditorProject[] | null = null;
    try {
      const allProjects = await getAllVideoEditorProjects();
      // Purge leftover ephemeral tour projects from the old delete-on-exit flow
      const leftovers = allProjects.filter((p) => p.name === 'Tour Demo');
      for (const project of leftovers) {
        try {
          await deleteVideoEditorProject(project.id);
        } catch (err) {
          console.warn('[VideoEditor] Failed to delete leftover Tour Demo project', project.id, err);
        }
      }
      loadedProjects = leftovers.length
        ? allProjects.filter((p) => p.name !== 'Tour Demo')
        : allProjects;

      // Load source counts, sources, thumbnails, and edit info for each project
      const counts = new Map<string, number>();
      const sources = new Map<string, VideoEditorSource[]>();
      const thumbnails = new Map<string, (string | null)[]>();
      const edits = new Map<string, ProjectEditInfo>();

      for (const project of loadedProjects) {
        // Load sources for this project
        const projectSourceList = await getVideoEditorSourcesByProjectId(project.id);
        sources.set(project.id, projectSourceList);
        counts.set(project.id, projectSourceList.length);

        // Load source thumbnails — two-tier strategy
        const thumbnailUrls: (string | null)[] = [];

        // Tier 1: read from opencut_media_assets (if project was ever opened in editor)
        try {
          const timelineThumbnail = await storageService.getProjectFirstVideoThumbnail({ projectId: project.id });
          if (timelineThumbnail) {
            thumbnailUrls.push(timelineThumbnail);
          }
        } catch (err) {
          console.warn('[VideoEditor] Failed to get timeline thumbnail:', project.id, err);
        }

        // Tier 2: fall back to video_editor_sources cascade
        if (!thumbnailUrls[0]) {
          // Sources are ordered by order_index ASC from getVideoEditorSourcesByProjectId
          const firstSource = projectSourceList[0];
          if (firstSource) {
            let thumbnailPath = firstSource.source_thumbnail;

            if (!thumbnailPath && firstSource.source_id) {
              try {
                if (firstSource.source_type === 'raw_video') {
                  const rawVideo = await getRawVideo(firstSource.source_id);
                  thumbnailPath = rawVideo?.thumbnail_path || null;
                } else if (firstSource.source_type === 'clip') {
                  const clip = await getClipWithBuildStatus(firstSource.source_id);
                  thumbnailPath = clip?.built_thumbnail_path || null;
                }
              } catch (err) {
                console.warn('[VideoEditor] Failed to lookup source thumbnail:', err);
              }
            }

            if (!thumbnailPath && firstSource.source_path) {
              try {
                const videoExists = await invoke<boolean>('check_file_exists', { path: firstSource.source_path });
                if (videoExists) {
                  thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
                    videoPath: firstSource.source_path,
                    timestampSeconds: firstSource.trim_start || 1,
                    outputFilename: `editor_thumb_${firstSource.id}`,
                  });
                  // Persist so we don't regenerate on every listing load
                  if (thumbnailPath) {
                    updateVideoEditorSource(firstSource.id, { source_thumbnail: thumbnailPath }).catch(() => {});
                  }
                }
              } catch (err) {
                console.warn('[VideoEditor] Failed to generate thumbnail:', err);
              }
            }

            if (thumbnailPath) {
              try {
                const exists = await invoke<boolean>('check_file_exists', { path: thumbnailPath });
                if (exists) {
                  const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumbnailPath });
                  thumbnailUrls.push(dataUrl);
                } else {
                  thumbnailUrls.push(null);
                }
              } catch {
                thumbnailUrls.push(null);
              }
            } else {
              thumbnailUrls.push(null);
            }
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

      projects.value = loadedProjects;
      sourceCounts.value = counts;
      projectSources.value = sources;
      sourceThumbnails.value = thumbnails;
      projectEdits.value = edits;
    } catch (error) {
      console.error('[VideoEditor] Failed to load projects:', error);
      if (loadedProjects) projects.value = loadedProjects;
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
    // Navigate to the new OpenCut editor
    router.push({ path: '/editor', query: { projectId: project.id } });
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
        router.push({ path: '/editor', query: { projectId } });
      }
      await loadProjects();
    } catch (error) {
      console.error('[VideoEditor] Failed to save project:', error);
    }
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

</script>
