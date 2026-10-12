<template>
  <PageLayout
    title="AI Image Creator"
    description="Create production-ready images or build transcript-backed thumbnails"
    :show-header="true"
    :icon="Images"
  >
    <template #actions>
      <Button variant="primary" :loading="isCreatingProject" @click="showCreateDialog = true">
        <Plus v-if="!isCreatingProject" />
        New project
      </Button>
    </template>

    <template v-if="sessions.length > 0" #toolbar>
      <SearchField v-model="searchQuery" placeholder="Search projects…" class="min-w-[120px] max-w-64 flex-1" />
      <div class="w-36 shrink-0">
        <CustomDropdown v-model="typeFilter" :options="typeOptions" placeholder="Type" />
      </div>
      <div class="w-40 shrink-0">
        <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort by" />
      </div>
    </template>

    <ProjectGrid
      v-if="(isLoadingSessions && !sessions.length) || filteredSessions.length > 0"
      :items="filteredSessions"
      :loading="isLoadingSessions"
      :item-key="(project) => `${project.creator_mode}-${project.id}`"
      :group-date="groupDate"
    >
      <template #tile="{ item: project }">
        <MediaTile
          :title="projectName(project)"
          :thumbnail="project.thumbnail_url"
          :icon="project.creator_mode === 'image' ? Images : ImagePlay"
          :meta="[formatStatus(project.status), relativeTime(project.updated_at)]"
          @open="openProject(project)"
        >
          <template #badges>
            <MediaChip>{{ project.creator_mode === 'image' ? 'Image' : 'Thumbnail' }}</MediaChip>
            <MediaChip v-if="project.creator_mode === 'thumbnail' && project.generation_mode">
              {{ project.generation_mode === 'quick' ? 'Quick' : 'Editable' }}
            </MediaChip>
          </template>
          <template #actions>
            <Button
              variant="secondary"
              size="icon-xs"
              class="hover:text-danger"
              title="Delete project"
              aria-label="Delete project"
              @click.stop="confirmRemove(project)"
            >
              <Trash2 />
            </Button>
          </template>
        </MediaTile>
      </template>
    </ProjectGrid>

    <EmptyState
      v-else-if="sessions.length > 0"
      :icon="SearchX"
      title="No matching projects"
      description="Try a different search or type filter."
    >
      <Button variant="secondary" @click="resetFilters">Clear filters</Button>
    </EmptyState>

    <EmptyState
      v-else
      :icon="Images"
      title="Create your first project"
      description="Start an image or thumbnail project. Both open full-page and can be saved into the Image Editor."
    >
      <Button variant="secondary" @click="showCreateDialog = true"><Plus /> New project</Button>
    </EmptyState>

    <CreateAIImageProjectDialog
      v-model="showCreateDialog"
      :is-creating="isCreatingProject"
      @confirm="confirmCreate"
    />

    <ConfirmationModal
      :show="!!projectToDelete"
      title="Delete project"
      message="Delete"
      :item-name="projectToDelete ? projectName(projectToDelete) : ''"
      suffix="?"
      confirm-text="Delete"
      variant="destructive"
      @close="projectToDelete = null"
      @confirm="removeProject"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { useToast } from '@/composables/useToast';
  import { computed, onMounted, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { ImagePlay, Images, Plus, SearchX, Trash2 } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import { MediaChip, MediaTile } from '@/components/ui/media-tile';
  import ProjectGrid from '@/components/create/ProjectGrid.vue';
  import CreateAIImageProjectDialog from '@/components/ai-image/CreateAIImageProjectDialog.vue';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SearchField } from '@/components/ui/search-field';
  import { useAIImageSession } from '@/composables/useAIImageSession';
  import { useFormatters } from '@/composables/useFormatters';
  import { createThumbnailSession } from '@/services/aiThumbnailApi';
  import { toDate } from '@/utils/dateTimeUtils';
  import type { AIImageSessionSummary } from '@/services/aiImageApi';

  const router = useRouter();
  const { listSessions, createSession, deleteSession } = useAIImageSession();
  const { getRelativeTime } = useFormatters();

  const sessions = ref<AIImageSessionSummary[]>([]);
  // Starts true so the first paint is the (delayed) skeleton, never the empty state
  const isLoadingSessions = ref(true);
  const showCreateDialog = ref(false);
  const isCreatingProject = ref(false);
  const projectToDelete = ref<AIImageSessionSummary | null>(null);

  const searchQuery = ref('');
  const typeFilter = ref<'all' | 'image' | 'thumbnail'>('all');
  const sortBy = ref<'updated' | 'created' | 'name'>('updated');

  const typeOptions = [
    { value: 'all', label: 'All types' },
    { value: 'image', label: 'Images' },
    { value: 'thumbnail', label: 'Thumbnails' },
  ];

  const sortOptions = [
    { value: 'updated', label: 'Last updated' },
    { value: 'created', label: 'Date created' },
    { value: 'name', label: 'Name' },
  ];

  const filteredSessions = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    const result = sessions.value.filter(
      (project) =>
        (typeFilter.value === 'all' || project.creator_mode === typeFilter.value) &&
        (!query || projectName(project).toLowerCase().includes(query))
    );
    return result.sort((a, b) => {
      if (sortBy.value === 'name') return projectName(a).localeCompare(projectName(b));
      const key = sortBy.value === 'created' ? 'inserted_at' : 'updated_at';
      return toDate(b[key]).getTime() - toDate(a[key]).getTime();
    });
  });

  const groupDate = computed(() => {
    if (sortBy.value === 'name') return undefined;
    const key = sortBy.value === 'created' ? 'inserted_at' : 'updated_at';
    return (project: AIImageSessionSummary) => project[key];
  });

  onMounted(loadProjects);

  async function loadProjects() {
    isLoadingSessions.value = true;
    try {
      sessions.value = await listSessions();
    } finally {
      isLoadingSessions.value = false;
    }
  }

  function resetFilters() {
    searchQuery.value = '';
    typeFilter.value = 'all';
  }

  function projectName(project: AIImageSessionSummary) {
    return project.name || (project.creator_mode === 'image' ? 'Untitled image' : 'Untitled thumbnail');
  }

  function relativeTime(value: string) {
    return getRelativeTime(toDate(value).getTime());
  }

  async function confirmCreate(payload: {
    name: string;
    creator_mode: 'image' | 'thumbnail';
    generation_mode: 'editable' | 'quick';
  }) {
    isCreatingProject.value = true;
    try {
      if (payload.creator_mode === 'image') {
        const created = await createSession(payload.name);
        showCreateDialog.value = false;
        await router.push({
          path: '/ai-image/session',
          query: { session: String(created.id) },
        });
      } else {
        const created = await createThumbnailSession({
          name: payload.name,
          generation_mode: payload.generation_mode,
        });
        showCreateDialog.value = false;
        await router.push({
          path: '/ai-image/thumbnail',
          query: { session: String(created.id) },
        });
      }
    } catch (cause) {
      console.error('[AIImageGenerator] create failed:', cause);
      useToast().error('Could not create project', 'Please try again.');
    } finally {
      isCreatingProject.value = false;
    }
  }

  async function openProject(project: AIImageSessionSummary) {
    if (project.creator_mode === 'thumbnail') {
      await router.push({
        path: '/ai-image/thumbnail',
        query: { session: String(project.id) },
      });
      return;
    }
    await router.push({
      path: '/ai-image/session',
      query: { session: String(project.id) },
    });
  }

  function confirmRemove(project: AIImageSessionSummary) {
    projectToDelete.value = project;
  }

  async function removeProject() {
    const project = projectToDelete.value;
    projectToDelete.value = null;
    if (!project) return;
    await deleteSession(project.id);
    sessions.value = sessions.value.filter((item) => item.id !== project.id);
  }

  function formatStatus(status: string) {
    return (
      (
        {
          discovery: 'Planning',
          generating: 'Generating',
          generated: 'Ready',
          completed: 'Ready',
        } as Record<string, string>
      )[status] || status
    );
  }
</script>
