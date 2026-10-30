<template>
  <PageLayout
    title="AI Video Editor"
    description="Motion graphics videos from a description, an example, your clips, or all three"
    :show-header="true"
    :icon="Wand2"
  >
    <template #actions>
      <Button variant="primary" :loading="creating" @click="showCreateDialog = true">
        <Plus v-if="!creating" />
        New project
      </Button>
    </template>

    <template v-if="sessions.length > 0" #toolbar>
      <SelectionBar
        v-if="selected.size > 0"
        :count="selected.size"
        :total="filteredSessions.length"
        @clear="clearSelection"
        @select-all="selectAll"
      >
        <Button variant="destructive-soft" size="sm" @click="confirmDelete([...selected])">
          <Trash2 />
          Delete
        </Button>
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
            <MediaChip>
              <Loader2 class="animate-spin" />
              Working
            </MediaChip>
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

    <EmptyState
      v-else-if="sessions.length > 0"
      :icon="SearchX"
      title="No matching projects"
      description="Try a different search."
    >
      <Button variant="secondary" @click="searchQuery = ''">Clear search</Button>
    </EmptyState>

    <EmptyState
      v-else
      :icon="Wand2"
      title="No AI video projects yet"
      description="Describe a video or show one to copy. Add your clips, images and music, and the AI designs and edits it."
    >
      <Button variant="secondary" @click="showCreateDialog = true">
        <Plus />
        New project
      </Button>
    </EmptyState>

    <CreateAIVideoProjectDialog v-model="showCreateDialog" :is-creating="creating" @confirm="createProject" />

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
  </PageLayout>
</template>

<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import { useRouter } from 'vue-router';
  import { Loader2, Plus, SearchX, Trash2, Wand2 } from 'lucide-vue-next';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import PageLayout from '@/components/PageLayout.vue';
  import ProjectGrid from '@/components/create/ProjectGrid.vue';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { MediaChip, MediaTile } from '@/components/ui/media-tile';
  import { SearchField } from '@/components/ui/search-field';
  import { SelectionBar } from '@/components/ui/selection-bar';
  import { useToast } from '@/composables/useToast';
  import { toDate } from '@/utils/dateTimeUtils';
  import * as videoApi from '@/ai-video/api';
  import CreateAIVideoProjectDialog from '@/ai-video/components/CreateAIVideoProjectDialog.vue';
  import { stashStartingSources, type StartingSources } from '@/ai-video/startingSources';
  import type { SessionStatus, SessionSummary } from '@/ai-video/types';

  const STATUS_LABELS: Record<SessionStatus, string> = { draft: 'Draft', working: 'Working', ready: 'Ready' };

  const toast = useToast();
  const router = useRouter();

  const sessions = ref<SessionSummary[]>([]);
  const loadingSessions = ref(true);
  const showCreateDialog = ref(false);
  const creating = ref(false);
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

  // -- Opening -----------------------------------------------------------------------------

  function openProject(id: number) {
    void router.push({ path: '/ai-video/session', query: { session: String(id) } });
  }

  async function createProject({ name, ...sources }: { name: string } & StartingSources) {
    creating.value = true;
    try {
      const created = await videoApi.createSession(name ? { name } : {});
      if (sources.files.length || sources.example) stashStartingSources(created.id, sources);
      showCreateDialog.value = false;
      openProject(created.id);
    } catch (error) {
      toast.error("Couldn't create the project", videoApi.apiErrorMessage(error));
    } finally {
      creating.value = false;
    }
  }

  onMounted(loadSessions);
</script>
