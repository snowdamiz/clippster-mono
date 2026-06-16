<template>
  <PageLayout
    title="Recording"
    description="Record camera, screen, and layouts with personal branding"
    :show-header="true"
    :icon="Disc"
  >
    <template #actions>
      <div class="videoeditor-header-actions">
        <div class="videoeditor-header__search">
          <Search class="videoeditor-header__search-icon" />
          <Input
            v-model="searchQuery"
            placeholder="Search recordings..."
            class="videoeditor-header__search-input"
          />
        </div>

        <CustomDropdown
          v-model="sortBy"
          :options="sortOptions"
          placeholder="Sort By"
          class="videoeditor-header__sort"
          trigger-class="videoeditor-header__dropdown-trigger"
        />

        <button type="button" class="videoeditor-create-btn" @click="startNewRecording">
          <Plus class="videoeditor-create-btn__icon" />
          New Recording
        </button>
      </div>
    </template>

    <div class="videoeditor__content" :class="{ 'videoeditor__content--empty': !loading && projects.length === 0 }">
      <div v-if="projects.length > 0 || loading" class="videoeditor__heading">
        <h1 class="videoeditor__title">Recording Projects</h1>
        <p class="videoeditor__subtitle">Your saved studio recordings ready for clipping and editing</p>
      </div>

      <div v-if="loading" class="videoeditor__loading">
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

      <div v-else-if="projects.length > 0" class="videoeditor__main">
        <Transition name="selection-bar">
          <div v-if="selectedProjects.size > 0" class="videoeditor__selection-bar">
            <div class="videoeditor__selection-info">
              <Check class="videoeditor__selection-icon" />
              <span>{{ selectedProjects.size }} selected</span>
            </div>
            <div class="videoeditor__selection-actions">
              <button type="button" class="videoeditor__selection-clear" @click="clearSelection">Clear</button>
              <button type="button" class="videoeditor__selection-delete" @click="confirmBulkDelete">
                <Trash2 class="videoeditor__selection-delete-icon" />
                Delete Selected
              </button>
            </div>
          </div>
        </Transition>

        <div v-if="filteredProjects.length > 0" class="videoeditor__section">
          <div v-for="group in groupedProjects" :key="group.dateLabel" class="videoeditor__date-group">
            <h3 class="videoeditor__section-header">{{ group.dateLabel }}</h3>

            <div class="videoeditor__grid">
              <div
                v-for="project in group.projects"
                :key="project.id"
                class="videoeditor-card"
                :class="{ 'videoeditor-card--selected': isProjectSelected(project.id) }"
                @click="openRecording(project)"
              >
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

                <div class="videoeditor-card__badge videoeditor-card__badge--sources">
                  <Disc class="videoeditor-card__badge-icon" />
                  <span>Studio</span>
                </div>

                <div
                  v-if="getThumbnail(project.id)"
                  class="videoeditor-card__thumbnail"
                  :style="{ backgroundImage: `url(${getThumbnail(project.id)})` }"
                >
                  <div class="videoeditor-card__vignette"></div>
                </div>
                <div v-else class="videoeditor-card__thumbnail videoeditor-card__thumbnail--empty">
                  <div class="videoeditor-card__thumbnail-gradient"></div>
                  <div class="videoeditor-card__empty-icon">
                    <Disc class="videoeditor-card__folder-icon" />
                  </div>
                </div>

                <div class="videoeditor-card__bottom">
                  <h3 class="videoeditor-card__title" :title="project.name">
                    {{ project.name }}
                  </h3>

                  <div class="videoeditor-card__meta">
                    <div v-if="getDuration(project.id) > 0" class="videoeditor-card__duration">
                      <Clock class="videoeditor-card__duration-icon" />
                      <span>{{ formatDuration(getDuration(project.id)) }}</span>
                    </div>
                    <span v-else class="videoeditor-card__meta-text videoeditor-card__meta-text--muted">
                      Processing
                    </span>

                    <span class="videoeditor-card__dot"></span>
                    <span class="videoeditor-card__meta-text">{{ getRelativeTime(project.updated_at) }}</span>
                  </div>
                </div>

                <div class="videoeditor-card__hover-actions">
                  <button
                    type="button"
                    class="videoeditor-card__action-btn"
                    title="Open Project"
                    @click.stop="openRecording(project)"
                  >
                    <Play class="videoeditor-card__action-icon" />
                  </button>

                  <button
                    type="button"
                    class="videoeditor-card__action-btn"
                    title="Open in Editor"
                    @click.stop="openInEditor(project)"
                  >
                    <Clapperboard class="videoeditor-card__action-icon" />
                  </button>

                  <button
                    type="button"
                    class="videoeditor-card__action-btn"
                    title="Delete"
                    @click.stop="confirmDelete(project)"
                  >
                    <Trash2 class="videoeditor-card__action-icon" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="filteredProjects.length === 0" class="videoeditor__no-results">
          <div class="videoeditor__no-results-icon-wrapper">
            <Search class="videoeditor__no-results-icon" />
          </div>
          <h3 class="videoeditor__no-results-title">No recordings found</h3>
          <p class="videoeditor__no-results-description">
            We couldn't find any recordings matching your search. Try adjusting your search query.
          </p>
          <button type="button" class="videoeditor__no-results-btn" @click="searchQuery = ''">Clear search</button>
        </div>
      </div>

      <div v-else class="videoeditor__empty">
        <div class="videoeditor__empty-icon-wrapper">
          <Disc class="videoeditor__empty-icon" />
        </div>
        <h3 class="videoeditor__empty-title">No recordings yet</h3>
        <p class="videoeditor__empty-description">
          Start a new recording to capture camera, screen, or both with your branding
        </p>
        <button type="button" class="videoeditor-create-btn studio-record__empty-btn" @click="startNewRecording">
          <Plus class="videoeditor-create-btn__icon" />
          New Recording
        </button>
      </div>
    </div>

    <ProjectWorkspaceDialog v-model="showWorkspaceDialog" :project="workspaceProject" />

    <ConfirmationModal
      :show="showDeleteDialog"
      title="Delete Recording"
      :message="deleteMessage"
      suffix="This action cannot be undone."
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
  import { Check, Clapperboard, Clock, Disc, Play, Plus, Search, Trash2 } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import { Input } from '@/components/ui/input';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
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
    { value: 'updated', label: 'Last Updated' },
    { value: 'created', label: 'Date Created' },
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

  const groupedProjects = computed(() => {
    const groups: { dateLabel: string; projects: Project[] }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
    const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    const todayProjects: Project[] = [];
    const yesterdayProjects: Project[] = [];
    const lastWeekProjects: Project[] = [];
    const olderProjects: Project[] = [];

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
    try {
      const allProjects = await getAllProjects();
      projects.value = allProjects.filter((p) => p.description === STUDIO_RECORDING_DESCRIPTION);

      const durations = new Map<string, number>();
      await Promise.all(
        projects.value.map(async (project) => {
          const rawVideos = await getRawVideosByProjectId(project.id);
          durations.set(project.id, rawVideos[0]?.duration ?? 0);
          await loadThumbnailsForProject(project);
        })
      );
      projectDurations.value = durations;
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

<style scoped>
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

  .videoeditor-create-btn__icon {
    width: 14px;
    height: 14px;
  }

  .studio-record__empty-btn {
    margin-top: 1.25rem;
    height: 36px;
    padding: 0 1rem;
    font-size: 0.8125rem;
  }

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

  .videoeditor__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1.25rem;
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

  .videoeditor-card--skeleton {
    pointer-events: none;
  }

  .videoeditor-card__skeleton-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, var(--sidebar-hover) 0%, var(--sidebar-surface) 100%);
  }

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

  .videoeditor-card__checkbox-inner--checked {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .videoeditor-card__checkbox-icon {
    width: 16px;
    height: 16px;
  }

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
    background-color: rgba(6, 182, 212, 0.25);
    color: #67e8f9;
  }

  .videoeditor-card__badge-icon {
    width: 10px;
    height: 10px;
  }

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

  .videoeditor-card__duration {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.375rem;
    background-color: rgba(6, 182, 212, 0.2);
    border: 1px solid rgba(6, 182, 212, 0.3);
    border-radius: 4px;
    color: #67e8f9;
    font-weight: 600;
  }

  .videoeditor-card__duration-icon {
    width: 10px;
    height: 10px;
  }

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
