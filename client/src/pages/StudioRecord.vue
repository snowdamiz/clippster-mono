<template>
  <PageLayout
    title="Recording"
    description="Record camera, screen, and layouts with personal branding"
    :show-header="true"
    :icon="Disc"
  >
    <template #actions>
      <Button variant="primary" @click="startNewRecording"><Plus /> New recording</Button>
    </template>

    <template v-if="projects.length > 0" #toolbar>
      <SelectionBar
        v-if="selectedProjects.size > 0"
        :count="selectedProjects.size"
        :total="filteredProjects.length"
        @clear="clearSelection"
        @select-all="selectAllProjects"
      >
        <Button variant="destructive-soft" size="sm" @click="confirmBulkDelete"><Trash2 /> Delete</Button>
      </SelectionBar>
      <template v-else>
        <SearchField v-model="searchQuery" placeholder="Search recordings…" class="min-w-[120px] max-w-64 flex-1" />
        <div class="w-40 shrink-0">
          <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort by" />
        </div>
      </template>
    </template>

    <ProjectGrid
      v-if="(loading && !projects.length) || filteredProjects.length > 0"
      :items="filteredProjects"
      :loading="loading"
      :item-key="(project) => project.id"
      :group-date="groupDate"
    >
      <template #tile="{ item: project }">
        <MediaTile
          :title="project.name"
          :thumbnail="getThumbnail(project.id)"
          :icon="Disc"
          :meta="[getRelativeTime(project.updated_at)]"
          selectable
          :selected="isProjectSelected(project.id)"
          @open="openRecording(project)"
          @toggle-select="toggleProjectSelection(project.id)"
        >
          <template #badges>
            <MediaChip v-if="getDuration(project.id) > 0">
              <Clock /> <span class="tabular">{{ formatDuration(getDuration(project.id)) }}</span>
            </MediaChip>
            <MediaChip v-else>Processing</MediaChip>
          </template>
          <template #actions>
            <Button
              variant="secondary"
              size="icon-xs"
              title="Open in editor"
              aria-label="Open in editor"
              @click.stop="openInEditor(project)"
            >
              <Clapperboard />
            </Button>
            <Button
              variant="secondary"
              size="icon-xs"
              class="hover:text-danger"
              title="Delete"
              aria-label="Delete"
              @click.stop="confirmDelete(project)"
            >
              <Trash2 />
            </Button>
          </template>
        </MediaTile>
      </template>
    </ProjectGrid>

    <EmptyState
      v-else-if="projects.length > 0"
      :icon="SearchX"
      title="No matching recordings"
      description="Try a different search."
    >
      <Button variant="secondary" @click="searchQuery = ''">Clear search</Button>
    </EmptyState>

    <EmptyState
      v-else
      :icon="Disc"
      title="No recordings yet"
      description="Start a new recording to capture camera, screen, or both with your branding."
    >
      <Button variant="secondary" @click="startNewRecording"><Plus /> New recording</Button>
    </EmptyState>

    <ProjectWorkspaceDialog v-model="showWorkspaceDialog" :project="workspaceProject" />

    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete recording"
      :message="deleteMessage"
      suffix=""
      confirm-text="Delete"
      variant="destructive"
      @close="showDeleteDialog = false"
      @confirm="handleDeleteConfirm"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Clapperboard, Clock, Disc, Plus, SearchX, Trash2 } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import { MediaChip, MediaTile } from '@/components/ui/media-tile';
  import { SelectionBar } from '@/components/ui/selection-bar';
  import ProjectGrid from '@/components/create/ProjectGrid.vue';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SearchField } from '@/components/ui/search-field';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import ProjectWorkspaceDialog from '@/components/ProjectWorkspaceDialog.vue';
  import { deleteProject, getAllProjects } from '@/services/database';
  import { getRawVideosByProjectId } from '@/services/database/raw-videos';
  import { createVideoEditorProjectFromRawVideo } from '@/services/video-editor-project-creator';
  import { useFormatters } from '@/composables/useFormatters';
  import { useToast } from '@/composables/useToast';
  import { STUDIO_RECORDING_DESCRIPTION } from '@/types/studio';
  import type { Project } from '@/services/database/types';

  const router = useRouter();
  const { getRelativeTime: formatRelativeTime } = useFormatters();
  const { success, error: showError } = useToast();

  const loading = ref(true);
  const projects = ref<Project[]>([]);
  const thumbnailCache = ref<Map<string, string>>(new Map());
  const projectDurations = ref<Map<string, number>>(new Map());
  const searchQuery = ref('');
  const sortBy = ref('updated');
  const selectedProjects = ref<Set<string>>(new Set());

  const showWorkspaceDialog = ref(false);
  const workspaceProject = ref<Project | null>(null);

  const showDeleteDialog = ref(false);
  const projectToDelete = ref<Project | null>(null);
  const bulkDeleteMode = ref(false);

  const sortOptions = [
    { value: 'updated', label: 'Last updated' },
    { value: 'created', label: 'Date created' },
    { value: 'name', label: 'Name' },
    { value: 'duration', label: 'Duration' },
  ];

  const filteredProjects = computed(() => {
    let result = [...projects.value];

    if (searchQuery.value) {
      const query = searchQuery.value.toLowerCase();
      result = result.filter(
        (p) => p.name.toLowerCase().includes(query) || p.description?.toLowerCase().includes(query)
      );
    }

    result.sort((a, b) => {
      switch (sortBy.value) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return b.created_at - a.created_at;
        case 'duration':
          return getDuration(b.id) - getDuration(a.id);
        case 'updated':
        default:
          return b.updated_at - a.updated_at;
      }
    });

    return result;
  });

  // Date sections follow the active sort (none for name / duration)
  const groupDate = computed(() => {
    if (sortBy.value === 'created') return (project: Project) => project.created_at;
    if (sortBy.value === 'updated') return (project: Project) => project.updated_at;
    return undefined;
  });

  const deleteMessage = computed(() => {
    if (bulkDeleteMode.value && selectedProjects.value.size > 0) {
      return `Are you sure you want to delete ${selectedProjects.value.size} recording${selectedProjects.value.size > 1 ? 's' : ''}?`;
    }
    return `Are you sure you want to delete "${projectToDelete.value?.name}"?`;
  });

  function getDuration(projectId: string): number {
    return projectDurations.value.get(projectId) ?? 0;
  }

  function getThumbnail(projectId: string): string | null {
    return thumbnailCache.value.get(projectId) ?? null;
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

  function startNewRecording() {
    router.push('/studio/record/session');
  }

  function openRecording(project: Project) {
    workspaceProject.value = project;
    showWorkspaceDialog.value = true;
  }

  async function openInEditor(project: Project) {
    try {
      const rawVideos = await getRawVideosByProjectId(project.id);
      const rawVideo = rawVideos[0];
      if (!rawVideo) {
        showError('No video found', 'This recording does not have a source video yet.');
        return;
      }

      const editor = await createVideoEditorProjectFromRawVideo({
        rawVideo,
        projectName: project.name,
      });
      router.push({ path: '/editor', query: { projectId: editor.projectId } });
    } catch (err) {
      showError('Failed to open editor', String(err));
    }
  }

  function isProjectSelected(projectId: string): boolean {
    return selectedProjects.value.has(projectId);
  }

  function toggleProjectSelection(projectId: string) {
    const next = new Set(selectedProjects.value);
    if (next.has(projectId)) {
      next.delete(projectId);
    } else {
      next.add(projectId);
    }
    selectedProjects.value = next;
  }

  function clearSelection() {
    selectedProjects.value = new Set();
  }

  function selectAllProjects() {
    selectedProjects.value = new Set(filteredProjects.value.map((p) => p.id));
  }

  function confirmDelete(project: Project) {
    bulkDeleteMode.value = false;
    projectToDelete.value = project;
    showDeleteDialog.value = true;
  }

  function confirmBulkDelete() {
    bulkDeleteMode.value = true;
    projectToDelete.value = null;
    showDeleteDialog.value = true;
  }

  async function handleDeleteConfirm() {
    try {
      if (bulkDeleteMode.value && selectedProjects.value.size > 0) {
        for (const id of selectedProjects.value) {
          await deleteProject(id);
          thumbnailCache.value.delete(id);
          projectDurations.value.delete(id);
        }
        selectedProjects.value = new Set();
      } else if (projectToDelete.value) {
        await deleteProject(projectToDelete.value.id);
        thumbnailCache.value.delete(projectToDelete.value.id);
        projectDurations.value.delete(projectToDelete.value.id);
      }

      await loadRecordings();
      success('Recording deleted');
    } catch (err) {
      showError('Delete failed', String(err));
    } finally {
      showDeleteDialog.value = false;
      projectToDelete.value = null;
      bulkDeleteMode.value = false;
    }
  }

  async function loadThumbnailsForProject(project: Project) {
    if (thumbnailCache.value.has(project.id)) return;

    let thumbPath = project.thumbnail_path;
    if (!thumbPath) {
      const rawVideos = await getRawVideosByProjectId(project.id);
      thumbPath = rawVideos[0]?.thumbnail_path ?? null;
    }

    if (!thumbPath) return;

    try {
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: thumbPath });
      thumbnailCache.value.set(project.id, dataUrl);
    } catch {
      // Ignore missing thumbnail files
    }
  }

  async function loadRecordings() {
    loading.value = true;
    // Published together with its durations so tiles never flash "Processing"
    let recordings: Project[] | null = null;
    try {
      const allProjects = await getAllProjects();
      recordings = allProjects.filter((p) => p.description === STUDIO_RECORDING_DESCRIPTION);

      const durations = new Map<string, number>();
      await Promise.all(
        recordings.map(async (project) => {
          const rawVideos = await getRawVideosByProjectId(project.id);
          durations.set(project.id, rawVideos[0]?.duration ?? 0);
          await loadThumbnailsForProject(project);
        })
      );
      projects.value = recordings;
      projectDurations.value = durations;
    } catch (err) {
      if (recordings) projects.value = recordings;
      throw err;
    } finally {
      loading.value = false;
    }
  }

  function handleVideoAdded(event: Event) {
    const detail = (event as CustomEvent<{ projectId?: string }>).detail;
    if (!detail?.projectId) {
      void loadRecordings();
      return;
    }

    void loadRecordings();
  }

  onMounted(async () => {
    await loadRecordings();
    window.addEventListener('video-added', handleVideoAdded as EventListener);
  });

  onUnmounted(() => {
    window.removeEventListener('video-added', handleVideoAdded as EventListener);
  });
</script>
