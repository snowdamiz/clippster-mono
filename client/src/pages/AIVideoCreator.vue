<template>
  <PageLayout title="AI Video Editor" description="Make a video like any example, from your own clips" :show-header="true" :icon="Wand2">
    <template #actions>
      <Button variant="primary" @click="createProject"><Plus /> New project</Button>
    </template>

    <template v-if="sessions.length > 0" #toolbar>
      <SelectionBar v-if="selected.size > 0" :count="selected.size" :total="filteredSessions.length" @clear="clearSelection" @select-all="selectAll">
        <Button variant="destructive-soft" size="sm" @click="confirmDelete([...selected])"><Trash2 /> Delete</Button>
      </SelectionBar>
      <template v-else>
        <SearchField v-model="searchQuery" placeholder="Search projects…" class="min-w-[120px] max-w-64 flex-1" />
        <div class="w-40 shrink-0">
          <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort by" />
        </div>
      </template>
    </template>

    <ProjectGrid
      v-if="(loadingSessions && !sessions.length) || filteredSessions.length > 0"
      :items="filteredSessions"
      :loading="loadingSessions"
      :item-key="(s) => s.id"
      :group-date="groupDate"
    >
      <template #tile="{ item: s }">
        <MediaTile
          :title="s.name || 'Untitled project'"
          :thumbnail="s.thumbnail_url"
          :icon="Wand2"
          :meta="[STATUS_LABELS[s.status], formatRelative(s.updated_at)]"
          selectable
          :selected="selected.has(s.id)"
          @open="openProject(s.id)"
          @toggle-select="toggleSelected(s.id)"
        >
          <template v-if="s.status === 'working'" #badges>
            <MediaChip><Loader2 class="animate-spin" /> Working</MediaChip>
          </template>
          <template #actions>
            <Button
              variant="secondary"
              size="icon-xs"
              class="hover:text-danger"
              title="Delete"
              aria-label="Delete"
              @click.stop="confirmDelete([s.id])"
            >
              <Trash2 />
            </Button>
          </template>
        </MediaTile>
      </template>
    </ProjectGrid>

    <EmptyState v-else-if="sessions.length > 0" :icon="SearchX" title="No matching projects" description="Try a different search.">
      <Button variant="secondary" @click="searchQuery = ''">Clear search</Button>
    </EmptyState>

    <EmptyState
      v-else
      :icon="Wand2"
      title="No AI video projects yet"
      description="Drop in your clips, show an example video, and the AI edits them the same way."
    >
      <Button variant="secondary" @click="createProject"><Plus /> New project</Button>
    </EmptyState>

    <Teleport to="body">
      <div
        v-if="editorOpen"
        class="fixed inset-x-0 bottom-0 top-[var(--titlebar-height)] z-[10000] flex animate-fade-in flex-col overflow-hidden bg-panel text-fg"
      >
        <SessionHeader :title="project.session.value?.name || 'Untitled project'" :icon="Wand2" back-label="Back to projects" @back="requestClose">
          <template #badge>
            <Badge variant="brand">Beta</Badge>
          </template>
          <template #actions>
            <Button v-if="project.stage.value === 'result'" variant="ghost" size="sm" :disabled="!!project.running.value" @click="project.editingSetup.value = true">
              Change clips or example
            </Button>
            <Button variant="ghost" size="icon-sm" title="Close" aria-label="Close" @click="requestClose">
              <X />
            </Button>
          </template>
        </SessionHeader>

        <div class="min-h-0 flex-1 overflow-y-auto">
          <div v-if="project.loading.value || !project.session.value" class="grid h-full place-items-center">
            <Loader2 class="size-6 animate-spin text-fg-subtle" />
          </div>
          <StartStage v-else-if="project.stage.value === 'start'" />
          <WorkingStage v-else-if="project.stage.value === 'working'" />
          <ResultStage v-else />
        </div>
      </div>
    </Teleport>

    <ConfirmationModal
      :show="!!deleteTarget"
      title="Delete project"
      :message="deleteTarget?.message || ''"
      suffix=""
      confirm-text="Delete"
      variant="destructive"
      @close="deleteTarget = null"
      @confirm="performDelete"
    />

    <ConfirmationModal
      :show="confirmLeave"
      title="Stop the AI?"
      message="The AI is still working on this video. If you leave now it stops, and you aren't charged for the unfinished edit."
      suffix=""
      confirm-text="Stop and leave"
      variant="destructive"
      @close="confirmLeave = false"
      @confirm="closeProject"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
  import { Loader2, Plus, SearchX, Trash2, Wand2, X } from 'lucide-vue-next';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import PageLayout from '@/components/PageLayout.vue';
  import ProjectGrid from '@/components/create/ProjectGrid.vue';
  import SessionHeader from '@/components/create/SessionHeader.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { MediaChip, MediaTile } from '@/components/ui/media-tile';
  import { SearchField } from '@/components/ui/search-field';
  import { SelectionBar } from '@/components/ui/selection-bar';
  import { useToast } from '@/composables/useToast';
  import { toDate } from '@/utils/dateTimeUtils';
  import * as videoApi from '@/ai-video/api';
  import ResultStage from '@/ai-video/components/ResultStage.vue';
  import StartStage from '@/ai-video/components/StartStage.vue';
  import WorkingStage from '@/ai-video/components/WorkingStage.vue';
  import { provideProject } from '@/ai-video/projectContext';
  import type { SessionStatus, SessionSummary } from '@/ai-video/types';
  import { useAIVideoProject } from '@/ai-video/useAIVideoProject';

  const STATUS_LABELS: Record<SessionStatus, string> = { draft: 'Draft', working: 'Working', ready: 'Ready' };

  const toast = useToast();
  const project = useAIVideoProject();
  provideProject(project);

  const sessions = ref<SessionSummary[]>([]);
  const loadingSessions = ref(true);
  const editorOpen = ref(false);
  const confirmLeave = ref(false);
  const selected = ref(new Set<number>());
  const deleteTarget = ref<{ ids: number[]; message: string } | null>(null);

  // -- Project list ------------------------------------------------------------------------

  const searchQuery = ref('');
  const sortBy = ref<'updated' | 'created' | 'name'>('updated');
  const sortOptions = [
    { value: 'updated', label: 'Last updated' },
    { value: 'created', label: 'Date created' },
    { value: 'name', label: 'Name' },
  ];

  const filteredSessions = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    return sessions.value
      .filter((s) => !query || (s.name || 'Untitled project').toLowerCase().includes(query))
      .sort((a, b) => {
        if (sortBy.value === 'name') return (a.name || '').localeCompare(b.name || '');
        const key = sortBy.value === 'created' ? 'inserted_at' : 'updated_at';
        return toDate(b[key]).getTime() - toDate(a[key]).getTime();
      });
  });

  const groupDate = computed(() => {
    if (sortBy.value === 'name') return undefined;
    const key = sortBy.value === 'created' ? 'inserted_at' : 'updated_at';
    return (s: SessionSummary) => s[key];
  });

  function formatRelative(value: string): string {
    const date = toDate(value);
    const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return days < 7 ? `${days}d ago` : date.toLocaleDateString();
  }

  function toggleSelected(id: number) {
    const next = new Set(selected.value);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    selected.value = next;
  }

  function clearSelection() {
    selected.value = new Set();
  }

  function selectAll() {
    selected.value = new Set(filteredSessions.value.map((s) => s.id));
  }

  async function loadSessions() {
    loadingSessions.value = true;
    try {
      sessions.value = await videoApi.listSessions();
    } catch (error) {
      toast.error("Couldn't load your projects", videoApi.apiErrorMessage(error));
      sessions.value = [];
    } finally {
      loadingSessions.value = false;
    }
  }

  function confirmDelete(ids: number[]) {
    if (!ids.length) return;
    const message =
      ids.length === 1
        ? `Are you sure you want to delete "${sessions.value.find((s) => s.id === ids[0])?.name || 'Untitled project'}"?`
        : `Are you sure you want to delete ${ids.length} projects?`;
    deleteTarget.value = { ids, message };
  }

  async function performDelete() {
    const target = deleteTarget.value;
    deleteTarget.value = null;
    if (!target) return;
    const results = await Promise.allSettled(target.ids.map((id) => videoApi.deleteSession(id)));
    const deleted = new Set(target.ids.filter((_, index) => results[index].status === 'fulfilled'));
    sessions.value = sessions.value.filter((s) => !deleted.has(s.id));
    clearSelection();
    if (deleted.size < target.ids.length) toast.error("Couldn't delete every project", 'Please try again.');
  }

  // -- Editor ----------------------------------------------------------------------------

  async function openProject(id: number) {
    editorOpen.value = true;
    await project.open(id);
    if (!project.session.value) editorOpen.value = false;
  }

  async function createProject() {
    if (await project.create()) editorOpen.value = true;
  }

  function requestClose() {
    if (project.running.value) confirmLeave.value = true;
    else closeProject();
  }

  function closeProject() {
    confirmLeave.value = false;
    project.close();
    editorOpen.value = false;
    void loadSessions();
  }

  onMounted(loadSessions);
  onBeforeUnmount(() => project.close());
</script>
