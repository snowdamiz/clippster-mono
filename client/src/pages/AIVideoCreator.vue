<template>
  <PageLayout
    title="AI Video Editor"
    description="Create and manage your AI video projects"
    :show-header="true"
    :icon="Wand2"
  >
    <template #actions>
      <Button variant="primary" @click="createNewProject"><Plus /> New project</Button>
    </template>

    <template v-if="savedSessions.length > 0" #toolbar>
      <SelectionBar
        v-if="selectedProjects.size > 0"
        :count="selectedProjects.size"
        :total="filteredSessions.length"
        @clear="clearSelection"
        @select-all="selectAllProjects"
      >
        <Button variant="destructive-soft" size="sm" @click="confirmBulkDelete"><Trash2 /> Delete</Button>
      </SelectionBar>
      <template v-else>
        <SearchField v-model="searchQuery" placeholder="Search projects…" class="min-w-[120px] max-w-64 flex-1" />
        <div class="w-40 shrink-0">
          <CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort by" />
        </div>
      </template>
    </template>

    <!-- Project list -->
    <ProjectGrid
      v-if="(isLoadingSessions && !savedSessions.length) || filteredSessions.length > 0"
      :items="filteredSessions"
      :loading="isLoadingSessions"
      :item-key="(s) => s.id"
      :group-date="groupDate"
    >
      <template #tile="{ item: s }">
        <MediaTile
          :title="s.name || 'Untitled project'"
          :thumbnail="s.thumbnail_url"
          :icon="Wand2"
          :meta="[formatStatus(s.status), formatDate(s.updated_at)]"
          selectable
          :selected="isProjectSelected(s.id)"
          @open="openProject(s.id)"
          @toggle-select="toggleProjectSelection(s.id)"
        >
          <template v-if="s.status === 'generating' || s.status === 'refining'" #badges>
            <MediaChip><Loader2 class="animate-spin" /> {{ formatStatus(s.status) }}</MediaChip>
          </template>
          <template #actions>
            <Button
              variant="secondary"
              size="icon-xs"
              class="hover:text-danger"
              title="Delete"
              aria-label="Delete"
              @click.stop="deleteProject(s.id)"
            >
              <Trash2 />
            </Button>
          </template>
        </MediaTile>
      </template>
    </ProjectGrid>

    <EmptyState
      v-else-if="savedSessions.length > 0"
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
      description="Create AI-generated videos from your media with a natural language workflow."
    >
      <Button variant="secondary" @click="createNewProject"><Plus /> New project</Button>
    </EmptyState>

    <!-- Editor overlay — shown when a project is open (eases in; closes instantly) -->
    <Teleport to="body">
      <div
        v-if="!showProjectPicker"
        class="fixed inset-x-0 bottom-0 top-[var(--titlebar-height)] z-[10000] flex animate-fade-in flex-col overflow-hidden bg-panel text-fg"
      >
        <SessionHeader
          :title="chatSession.session.value?.name || 'Untitled project'"
          :icon="Wand2"
          back-label="Back to projects"
          @back="backToProjects"
        >
          <template #badge>
            <Badge variant="brand">Beta</Badge>
          </template>
          <template #actions>
            <Button v-if="composition" variant="primary" size="sm" @click="openExport"><Download /> Export</Button>
            <Button variant="ghost" size="icon-sm" title="Close" aria-label="Close" @click="router.back()">
              <X />
            </Button>
          </template>
        </SessionHeader>

        <div class="flex min-h-0 flex-1 overflow-hidden">
          <!-- Left: AI chat + source media -->
          <aside class="flex w-[clamp(300px,34vw,400px)] shrink-0 flex-col border-r border-line-subtle bg-surface">
            <AIChatPanel
              :messages="chatSession.messages.value"
              :is-sending="chatSession.isSending.value"
              :is-generating="chatSession.isGenerating.value"
              :is-refinement-mode="chatSession.isGenerated.value"
              :refinement-round="chatSession.refinementRound.value"
              :max-refinement-rounds="chatSession.maxRefinementRounds.value"
              :refinement-messages-remaining="chatSession.refinementMessagesRemaining.value"
              :error="chatSession.error.value"
              :generation-phase="chatSession.generationPhase.value"
              :scenes="chatSession.scenes.value"
              :completed-scenes="chatSession.completedScenes.value"
              :reference-analysis="chatSession.referenceAnalysis.value"
              :is-analyzing-reference="isAnalyzingReference"
              :reference-progress="referenceProgress"
              :reference-error="referenceError"
              :style-pack-id="selectedStylePackId"
              :draft-message="chatDraftMessage"
              :media-items="mediaItems"
              :transcript-generation-status="transcriptGenerationStatus"
              @send="handleChatSend"
              @update:draft-message="handleDraftMessageUpdate"
              @clear-error="chatSession.clearError"
              @analyze-reference="handleAnalyzeReference"
              @upload-reference="handleUploadReference"
              @remove-reference="handleRemoveReference"
              @cancel-reference="cancelReferenceAnalysis"
              @retry-reference="retryReferenceAnalysis"
              @select-style-pack="handleSelectStylePack"
              @upload-media="handleUpload"
              @open-clip-picker="openClipPicker"
              @open-asset-picker="openAssetPicker"
              @remove-media="removeMedia"
            />
          </aside>

          <!-- Center: preview + playback -->
          <section class="flex min-w-0 flex-1 flex-col">
            <div class="relative min-h-0 flex-1 bg-surface-sunken">
              <RemotionPlayerMount
                v-if="composition"
                class="animate-fade-in"
                :composition="composition"
                :current-time="currentTime"
                :is-playing="isPlaying"
                @time-update="handleTimeUpdate"
                @duration-change="handleDurationChange"
                @playing-change="handlePlayingChange"
              />

              <!-- Generating -->
              <div v-else-if="isGenerating" class="absolute inset-0 grid animate-enter place-items-center overflow-y-auto p-6">
                <div class="flex w-full max-w-[360px] flex-col items-center gap-4 text-center">
                  <IconTile :icon="Loader2" tone="brand" size="lg" class="[&_svg]:animate-spin" />
                  <div>
                    <h3 class="text-sm font-semibold text-fg">Generating your video</h3>
                    <p class="mt-0.5 text-xs text-fg-muted">
                      <template v-if="chatSession.generationPhase.value === 'planning'">Planning scenes…</template>
                      <template v-else-if="chatSession.scenes.value.length > 0">
                        {{ chatSession.completedScenes.value }}/{{ chatSession.scenes.value.length }} scenes complete
                      </template>
                      <template v-else>Processing…</template>
                    </p>
                  </div>
                  <div class="flex w-full items-center gap-2">
                    <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-active">
                      <div
                        class="h-full rounded-full bg-brand transition-[width] duration-300"
                        :style="{ width: generatingProgress + '%' }"
                      />
                    </div>
                    <span class="tabular w-9 text-right text-xs text-fg-muted">{{ generatingProgress }}%</span>
                  </div>
                  <div v-if="chatSession.scenes.value.length > 0" class="flex flex-wrap justify-center gap-1.5">
                    <Badge
                      v-for="scene in chatSession.scenes.value"
                      :key="scene.index"
                      size="md"
                      :variant="scene.status === 'complete' ? 'success' : scene.status === 'generating' ? 'brand' : 'neutral'"
                    >
                      <Loader2 v-if="scene.status === 'generating'" class="animate-spin" />
                      <Check v-else-if="scene.status === 'complete'" />
                      Scene {{ scene.index + 1 }}
                    </Badge>
                  </div>
                  <Button variant="secondary" size="sm" @click="chatSession.cancelGeneration">Cancel generation</Button>
                </div>
              </div>

              <!-- Empty -->
              <EmptyState
                v-else
                :icon="Wand2"
                title="Plan your video with AI"
                :description="
                  mediaItems.length === 0
                    ? 'Add source media, then chat with AI to plan and generate your video.'
                    : 'Now chat with AI to plan and generate your video.'
                "
                class="absolute inset-0"
              >
                <ol class="flex flex-wrap items-center justify-center gap-1.5 text-xs">
                  <template v-for="(step, index) in placeholderSteps" :key="step.label">
                    <li
                      class="flex h-7 items-center gap-1.5 rounded-full border px-2.5"
                      :class="step.done ? 'border-[var(--success-line)] bg-success-soft text-fg' : 'border-line text-fg-muted'"
                    >
                      <Check v-if="step.done" class="size-3.5 text-success" />
                      <span v-else class="tabular text-2xs font-semibold text-fg-subtle">{{ index + 1 }}</span>
                      {{ step.label }}
                    </li>
                    <ChevronRight v-if="index < placeholderSteps.length - 1" class="size-3.5 text-fg-disabled" />
                  </template>
                </ol>
              </EmptyState>
            </div>

            <div
              v-if="composition?.styleMatch"
              class="flex min-w-0 items-center gap-2 border-t border-line-subtle bg-surface px-3 py-1.5 text-xs text-fg-muted"
            >
              <Sparkles class="size-3.5 shrink-0 text-ai" />
              <span class="min-w-0 flex-1 truncate">{{ composition.styleMatch.summary }}</span>
              <Badge variant="ai">{{ Math.round(composition.styleMatch.confidence * 100) }}% match</Badge>
            </div>

            <!-- Playback controls -->
            <div v-if="composition" class="flex animate-fade-in items-center gap-1 border-t border-line-subtle bg-surface px-3 py-2">
              <Button variant="ghost" size="icon-sm" title="Restart" aria-label="Restart" @click="seekTo(0)">
                <SkipBack />
              </Button>
              <Button
                variant="subtle"
                size="icon"
                :title="isPlaying ? 'Pause' : 'Play'"
                :aria-label="isPlaying ? 'Pause' : 'Play'"
                @click="togglePlayback"
              >
                <component :is="isPlaying ? Pause : Play" />
              </Button>
              <Button variant="ghost" size="icon-sm" title="End" aria-label="Go to end" @click="seekTo(duration)">
                <SkipForward />
              </Button>
              <span class="tabular ml-1.5 shrink-0 text-xs text-fg-muted">
                <span class="text-fg">{{ formatTime(currentTime) }}</span> / {{ formatTime(duration) }}
              </span>
              <input
                type="range"
                :value="currentTime"
                :max="duration || 1"
                step="0.1"
                class="ml-2 min-w-0 flex-1"
                aria-label="Seek"
                @input="(e: Event) => seekTo(parseFloat((e.target as HTMLInputElement).value))"
              />
            </div>
          </section>
        </div>

        <!-- Bottom: timeline -->
        <div
          v-if="composition"
          class="flex h-[clamp(150px,30vh,220px)] shrink-0 animate-fade-in flex-col border-t border-line-subtle bg-surface"
        >
          <div class="flex h-9 shrink-0 items-center justify-between border-b border-line-subtle px-3">
            <span class="eyebrow flex items-center gap-1.5"><ListMusic class="size-3.5" /> Timeline</span>
            <span class="text-2xs text-fg-subtle">{{ composition.tracks.length }} tracks</span>
          </div>
          <div class="relative min-h-0 flex-1 overflow-hidden">
            <AITimeline :composition="composition" :current-time="currentTime" />
          </div>
        </div>

        <!-- Modals (inside overlay so they share stacking context) -->
        <ClipPickerDialog v-model="showClipPicker" @select="handleClipsSelected" />
        <AssetPickerDialog v-model="showAssetPicker" @select="handleAssetsSelected" />
        <ExportDialog v-model="showExportDialog" :composition="composition" @exported="handleExported" />
      </div>
    </Teleport>

    <!-- Project name dialog -->
    <Modal
      :open="showProjectNameDialog"
      title="New AI video project"
      description="Give your AI video project a memorable name."
      :icon="Wand2"
      size="sm"
      @close="showProjectNameDialog = false"
    >
      <Field label="Project name" :error="projectNameError">
        <Input
          v-model="projectNameInput"
          placeholder="e.g. Product launch video"
          maxlength="100"
          autofocus
          :aria-invalid="!!projectNameError"
          @keyup.enter="confirmCreateProject"
        />
      </Field>
      <template #footer>
        <Button variant="ghost" @click="showProjectNameDialog = false">Cancel</Button>
        <Button variant="primary" @click="confirmCreateProject"><Plus /> Create project</Button>
      </template>
    </Modal>

    <!-- Credit confirmation dialog -->
    <Modal
      :open="creditConfirm.show"
      :title="creditConfirm.title"
      :description="creditConfirm.description"
      :icon="Sparkles"
      tone="ai"
      size="sm"
      @close="creditConfirm.show = false"
    >
      <div class="flex items-center justify-between rounded-lg border border-line-subtle bg-surface px-3 py-2.5">
        <span class="text-sm text-fg-muted">Cost</span>
        <span class="text-sm text-fg">
          <span class="tabular text-base font-semibold">{{ creditConfirm.cost }}</span> credits
        </span>
      </div>
      <template #footer>
        <Button variant="ghost" @click="creditConfirm.show = false">Cancel</Button>
        <Button variant="primary" @click="confirmCreditAction"><Sparkles /> {{ creditConfirm.confirmLabel }}</Button>
      </template>
    </Modal>

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
  import { useToast } from '@/composables/useToast';
  import { ref, computed, onMounted, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    Wand2,
    X,
    Play,
    Pause,
    Loader2,
    Download,
    Sparkles,
    ListMusic,
    Check,
    SkipBack,
    SkipForward,
    Trash2,
    Plus,
    ChevronRight,
    SearchX,
  } from 'lucide-vue-next';
  import { open } from '@tauri-apps/plugin-dialog';
  import { invoke } from '@tauri-apps/api/core';
  import PageLayout from '@/components/PageLayout.vue';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import ConfirmationModal from '@/components/ConfirmationModal.vue';
  import { MediaChip, MediaTile } from '@/components/ui/media-tile';
  import { SelectionBar } from '@/components/ui/selection-bar';
  import ProjectGrid from '@/components/create/ProjectGrid.vue';
  import SessionHeader from '@/components/create/SessionHeader.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Field } from '@/components/ui/field';
  import { IconTile } from '@/components/ui/icon-tile';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SearchField } from '@/components/ui/search-field';
  import { toDate } from '@/utils/dateTimeUtils';
  import RemotionPlayerMount from '@/components/ai-video/RemotionPlayerMount.vue';
  import AITimeline from '@/components/ai-video/AITimeline.vue';
  import ClipPickerDialog from '@/components/ai-video/pickers/ClipPickerDialog.vue';
  import AssetPickerDialog from '@/components/ai-video/pickers/AssetPickerDialog.vue';
  import ExportDialog from '@/components/ai-video/ExportDialog.vue';
  import AIChatPanel from '@/components/ai-video/AIChatPanel.vue';
  import { useAIChatSession } from '@/composables/useAIChatSession';
  import type {
    AIVideoMediaItem,
    ReferenceAnalysisProgress,
    StylePackId,
  } from '@/types/ai-video';
  import { getAIStylePack } from '@/data/ai-video-style-packs';
  import { analyzeReferenceVideo, type ReferenceInput } from '@/services/referenceVideo';
  import api from '@/services/api';

  const router = useRouter();

  // Media library state
  const mediaItems = ref<AIVideoMediaItem[]>([]);
  const transcriptGenerationStatus = ref<
    Map<string, { status: 'generating' | 'complete' | 'error'; progress?: string }>
  >(new Map());

  // Dialog state
  const showClipPicker = ref(false);
  const showAssetPicker = ref(false);
  const showExportDialog = ref(false);
  const showProjectNameDialog = ref(false);
  const projectNameInput = ref('');
  const projectNameError = ref('');

  // Credit confirmation dialog
  const creditConfirm = ref<{
    show: boolean;
    title: string;
    description: string;
    cost: number;
    confirmLabel: string;
    action: 'generate' | 'refine';
    refineMessage?: string;
  }>({
    show: false,
    title: '',
    description: '',
    cost: 0,
    confirmLabel: '',
    action: 'generate',
  });

  const chatDraftMessage = ref('');
  const lastReadyPromptMessageId = ref<number | null>(null);
  const lastAssistantMetadataMessageId = ref<number | null>(null);
  const defaultAutoTagParts = ['Hook', 'Problem', 'Solution', 'Proof', 'CTA'];

  // AI Chat session
  const chatSession = useAIChatSession();

  // Project picker state
  const savedSessions = ref<Array<{ id: number; name: string | null; status: string; updated_at: string; inserted_at: string; thumbnail_url?: string | null }>>([]);
  // Starts true so the first paint is the (delayed) skeleton, never the empty state
  const isLoadingSessions = ref(true);
  const showProjectPicker = computed(() => !chatSession.session.value);
  const selectedProjects = ref<Set<number>>(new Set());

  function isProjectSelected(id: number): boolean {
    return selectedProjects.value.has(id);
  }

  function toggleProjectSelection(id: number) {
    if (selectedProjects.value.has(id)) {
      selectedProjects.value.delete(id);
    } else {
      selectedProjects.value.add(id);
    }
    selectedProjects.value = new Set(selectedProjects.value);
  }

  function clearSelection() {
    selectedProjects.value = new Set();
  }

  function selectAllProjects() {
    selectedProjects.value = new Set(filteredSessions.value.map((s) => s.id));
  }

  // Search / sort for the project list
  const searchQuery = ref('');
  const sortBy = ref<'updated' | 'created' | 'name'>('updated');
  const sortOptions = [
    { value: 'updated', label: 'Last updated' },
    { value: 'created', label: 'Date created' },
    { value: 'name', label: 'Name' },
  ];

  type SavedSession = (typeof savedSessions.value)[number];

  const filteredSessions = computed(() => {
    const query = searchQuery.value.trim().toLowerCase();
    const result = savedSessions.value.filter(
      (s) => !query || (s.name || 'Untitled project').toLowerCase().includes(query)
    );
    return result.sort((a, b) => {
      if (sortBy.value === 'name') return (a.name || '').localeCompare(b.name || '');
      const key = sortBy.value === 'created' ? 'inserted_at' : 'updated_at';
      return toDate(b[key]).getTime() - toDate(a[key]).getTime();
    });
  });

  // Date sections follow the active sort (none when sorting by name)
  const groupDate = computed(() => {
    if (sortBy.value === 'name') return undefined;
    const key = sortBy.value === 'created' ? 'inserted_at' : 'updated_at';
    return (s: SavedSession) => s[key];
  });

  // Delete confirmation (single project or the current selection)
  const deleteTarget = ref<{ ids: number[]; bulk: boolean; message: string } | null>(null);

  function confirmBulkDelete() {
    const count = selectedProjects.value.size;
    if (count === 0) return;
    deleteTarget.value = {
      ids: Array.from(selectedProjects.value),
      bulk: true,
      message: `Are you sure you want to delete ${count} project${count > 1 ? 's' : ''}?`,
    };
  }

  async function performDelete() {
    const target = deleteTarget.value;
    deleteTarget.value = null;
    if (!target) return;

    if (!target.bulk) {
      const id = target.ids[0];
      try {
        await chatSession.deleteSession(id);
        savedSessions.value = savedSessions.value.filter((s) => s.id !== id);
      } catch (e) {
        console.error('[AIVideoCreator] Failed to delete project:', e);
        useToast().error('Could not delete project', 'Please try again.');
      }
      return;
    }

    for (const id of target.ids) {
      try {
        await chatSession.deleteSession(id);
        savedSessions.value = savedSessions.value.filter((s) => s.id !== id);
      } catch (e) {
        console.error('[AIVideoCreator] Failed to delete project:', id, e);
      }
    }
    clearSelection();
  }

  function formatStatus(status: string): string {
    const map: Record<string, string> = {
      discovery: 'Planning',
      generating: 'Generating',
      generated: 'Ready',
      refining: 'Refining',
      completed: 'Completed',
    };
    return map[status] || status;
  }

  function formatDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      const diffHours = Math.floor(diffMins / 60);
      if (diffHours < 24) return `${diffHours}h ago`;
      const diffDays = Math.floor(diffHours / 24);
      if (diffDays < 7) return `${diffDays}d ago`;
      return d.toLocaleDateString();
    } catch {
      return '';
    }
  }

  async function loadSessions() {
    isLoadingSessions.value = true;
    try {
      savedSessions.value = await chatSession.listSessions();
    } catch (e) {
      console.error('[AIVideoCreator] Failed to load sessions:', e);
      savedSessions.value = [];
    } finally {
      isLoadingSessions.value = false;
    }
  }

  async function openProject(id: number) {
    try {
      await chatSession.loadSession(id);
      // Restore media items from session
      if (chatSession.session.value?.media_items) {
        mediaItems.value = chatSession.session.value.media_items;
      }
    } catch (e) {
      console.error('[AIVideoCreator] Failed to open project:', e);
    }
  }

  function createNewProject() {
    projectNameInput.value = '';
    projectNameError.value = '';
    showProjectNameDialog.value = true;
  }

  async function confirmCreateProject() {
    const name = projectNameInput.value.trim();
    if (!name) {
      projectNameError.value = 'Project name is required';
      return;
    }
    if (name.length > 100) {
      projectNameError.value = 'Project name must be 100 characters or less';
      return;
    }

    try {
      await chatSession.createSession(mediaItems.value);
      if (chatSession.session.value) {
        await chatSession.renameSession(chatSession.session.value.id, name);
      }
      showProjectNameDialog.value = false;
    } catch (e) {
      console.error('[AIVideoCreator] Failed to create project:', e);
      projectNameError.value = 'Failed to create project. Please try again.';
    }
  }

  function deleteProject(id: number) {
    const project = savedSessions.value.find((s) => s.id === id);
    const projectName = project?.name || 'Untitled project';
    deleteTarget.value = { ids: [id], bulk: false, message: `Are you sure you want to delete "${projectName}"?` };
  }

  function backToProjects() {
    chatSession.closeSession();
    mediaItems.value = [];
    loadSessions();
  }

  function handleDraftMessageUpdate(value: string) {
    chatDraftMessage.value = value;
  }

  // AI generation — composition is driven by chat session
  const composition = computed(() => chatSession.composition.value);
  const isGenerating = computed(() => chatSession.isGenerating.value);
  const placeholderSteps = computed(() => [
    { label: 'Add media', done: mediaItems.value.length > 0 },
    { label: 'Chat with AI', done: chatSession.messages.value.length > 1 },
    { label: 'AI generates', done: false },
  ]);

  const generatingProgress = computed(() => {
    const total = chatSession.scenes.value.length;
    if (total === 0) return 0;
    return Math.round((chatSession.completedScenes.value / total) * 100);
  });

  // Detect aspect ratio from the primary video media's dimensions
  const detectedAspectRatio = computed<'16:9' | '9:16' | '1:1' | '4:5'>(() => {
    // Find the first video media item with dimensions
    const videoItem = mediaItems.value.find((item) => item.type === 'video' && item.dimensions);
    if (!videoItem?.dimensions) return '16:9'; // fallback only if no dimensions available

    const { width, height } = videoItem.dimensions;
    const ratio = width / height;

    // Match to closest standard aspect ratio
    if (Math.abs(ratio - 9 / 16) < 0.15) return '9:16'; // Portrait (0.5625)
    if (Math.abs(ratio - 1) < 0.15) return '1:1'; // Square (1.0)
    if (Math.abs(ratio - 4 / 5) < 0.15) return '4:5'; // Portrait-ish (0.8)
    if (Math.abs(ratio - 16 / 9) < 0.15) return '16:9'; // Landscape (1.778)

    // If no close match, decide based on orientation
    if (height > width) return '9:16';
    return '16:9';
  });

  // Playback state
  const currentTime = ref(0);
  const duration = ref(0);
  const isPlaying = ref(false);

  function togglePlayback() {
    isPlaying.value = !isPlaying.value;
  }

  function seekTo(time: number) {
    currentTime.value = Math.max(0, Math.min(time, duration.value));
    isPlaying.value = false;
  }

  function handleTimeUpdate(time: number) {
    currentTime.value = time;
  }

  function handleDurationChange(dur: number) {
    console.log('[AIVideoCreator] Duration change:', dur);
    duration.value = dur;
  }

  function handlePlayingChange(playing: boolean) {
    isPlaying.value = playing;
  }

  // Reference analysis state
  const isAnalyzingReference = ref(false);
  const referenceError = ref<string | null>(null);
  const referenceProgress = ref<ReferenceAnalysisProgress | null>(null);
  const referenceController = ref<AbortController | null>(null);
  const lastReferenceInput = ref<ReferenceInput | null>(null);
  const selectedStylePackId = computed<StylePackId | null>(() => {
    const id = chatSession.session.value?.style_context?.stylePack?.id;
    return getAIStylePack(id as StylePackId)?.id ?? null;
  });

  async function handleAnalyzeReference(url: string) {
    await startReferenceAnalysis({ kind: 'url', value: url });
  }

  async function handleUploadReference() {
    const path = await open({
      multiple: false,
      filters: [{ name: 'Reference Video', extensions: ['mp4', 'mov', 'webm', 'mkv', 'avi', 'm4v'] }],
    });
    if (typeof path === 'string') await startReferenceAnalysis({ kind: 'upload', value: path });
  }

  async function startReferenceAnalysis(input: ReferenceInput) {
    if (!chatSession.session.value) return;
    referenceController.value?.abort();
    referenceController.value = new AbortController();
    lastReferenceInput.value = input;
    isAnalyzingReference.value = true;
    referenceError.value = null;
    referenceProgress.value = { stage: 'validating', progress: 0, message: 'Starting reference analysis' };
    try {
      const recipe = await analyzeReferenceVideo(input, (progress) => {
        referenceProgress.value = progress;
      }, referenceController.value.signal);
      await chatSession.uploadReference(recipe, recipe.metadata.sourceUrl ?? null);
    } catch (e: any) {
      if (e?.name !== 'AbortError' && !String(e).toLowerCase().includes('cancel')) {
        referenceError.value = e?.response?.data?.error || e.message || String(e) || 'Failed to analyze reference';
        console.error('[AIVideoCreator] Reference analysis failed:', e);
      }
    } finally {
      isAnalyzingReference.value = false;
      referenceController.value = null;
    }
  }

  function cancelReferenceAnalysis() {
    referenceController.value?.abort();
  }

  async function retryReferenceAnalysis() {
    if (lastReferenceInput.value) await startReferenceAnalysis(lastReferenceInput.value);
  }

  async function handleRemoveReference() {
    await chatSession.uploadReference(null, null);
    referenceError.value = null;
    referenceProgress.value = null;
  }

  async function handleSelectStylePack(id: StylePackId) {
    const pack = getAIStylePack(id);
    if (pack) await chatSession.updateStylePack(pack);
  }

  function normalizeMediaPartLabel(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return trimmed.replace(/\s+/g, ' ').replace(/^scene\s+(\d+)\s*[:\-]?\s*/i, 'Scene $1: ');
  }

  function normalizeMediaName(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/\.[a-z0-9]+$/i, '');
  }

  function getRequestedMediaParts(metadata: Record<string, any>): string[] {
    const mediaRequest = metadata?.media_request;
    if (!mediaRequest || typeof mediaRequest !== 'object') return [];
    if (!Array.isArray(mediaRequest.parts)) return [];

    return mediaRequest.parts
      .filter((part: unknown): part is string => typeof part === 'string')
      .map((part: string) => normalizeMediaPartLabel(part))
      .filter((part: string) => part.length > 0);
  }

  function getSummarySceneLabels(metadata: Record<string, any>): string[] {
    const scenes = metadata?.summary?.scenes;
    if (!Array.isArray(scenes)) return [];

    return scenes
      .map((scene: any, index: number) => {
        const desc = typeof scene?.description === 'string' ? scene.description.trim() : '';
        const base = desc || `Scene ${index + 1}`;
        return normalizeMediaPartLabel(`Scene ${index + 1}: ${base}`);
      })
      .filter((label: string) => label.length > 0);
  }

  function addMediaPartTag(item: AIVideoMediaItem, part: string) {
    const normalized = normalizeMediaPartLabel(part);
    if (!normalized) return;

    const existing = item.intendedParts || [];
    const exists = existing.some((tag) => tag.toLowerCase() === normalized.toLowerCase());
    if (exists) return;

    item.intendedParts = [...existing, normalized];
  }

  function incrementPartUsage(partUsage: Map<string, number>, part: string) {
    const normalized = normalizeMediaPartLabel(part);
    if (!normalized) return;
    partUsage.set(normalized, (partUsage.get(normalized) || 0) + 1);
  }

  function buildAutoTagPartPool(metadata: Record<string, any>) {
    const options = new Set<string>(defaultAutoTagParts.map((part) => normalizeMediaPartLabel(part)));
    const requestedParts = getRequestedMediaParts(metadata);
    const summarySceneLabels = getSummarySceneLabels(metadata);

    requestedParts.forEach((part) => options.add(part));
    summarySceneLabels.forEach((part) => options.add(part));

    return Array.from(options).filter((part) => part.length > 0);
  }

  function findPartByKeywords(partPool: string[], keywords: string[]): string | null {
    for (const part of partPool) {
      const partLower = part.toLowerCase();
      if (keywords.some((keyword) => partLower.includes(keyword))) {
        return part;
      }
    }
    return null;
  }

  function inferPartForMedia(
    item: AIVideoMediaItem,
    partPool: string[],
    partUsage: Map<string, number>
  ): string | null {
    if (partPool.length === 0) return null;

    const searchable = `${item.name} ${item.transcript || ''}`.toLowerCase();

    const partHintDefinitions = [
      {
        mediaKeywords: ['hook', 'intro', 'opening', 'teaser', 'headline'],
        partKeywords: ['hook', 'intro', 'opening'],
      },
      {
        mediaKeywords: ['problem', 'pain', 'challenge', 'issue'],
        partKeywords: ['problem', 'pain', 'challenge'],
      },
      {
        mediaKeywords: ['solution', 'demo', 'feature', 'walkthrough', 'product'],
        partKeywords: ['solution', 'demo', 'feature'],
      },
      {
        mediaKeywords: ['proof', 'result', 'testimonial', 'review', 'case', 'before', 'after'],
        partKeywords: ['proof', 'result', 'testimonial', 'review', 'case'],
      },
      {
        mediaKeywords: ['cta', 'call to action', 'subscribe', 'buy', 'signup', 'sign up', 'follow'],
        partKeywords: ['cta', 'call to action', 'subscribe', 'outro'],
      },
    ];

    for (const definition of partHintDefinitions) {
      if (!definition.mediaKeywords.some((keyword) => searchable.includes(keyword))) continue;
      const part = findPartByKeywords(partPool, definition.partKeywords);
      if (part) return part;
    }

    const sorted = [...partPool].sort((a, b) => (partUsage.get(a) || 0) - (partUsage.get(b) || 0));
    return sorted[0] || null;
  }

  function findMediaByReferenceName(mediaName: string): AIVideoMediaItem | null {
    const normalizedTarget = normalizeMediaName(mediaName);
    if (!normalizedTarget) return null;

    return (
      mediaItems.value.find((item) => normalizeMediaName(item.name) === normalizedTarget) ||
      mediaItems.value.find((item) => normalizeMediaName(item.name).includes(normalizedTarget)) ||
      mediaItems.value.find((item) => normalizedTarget.includes(normalizeMediaName(item.name))) ||
      null
    );
  }

  function applyAssistantMediaMetadata() {
    if (mediaItems.value.length === 0) return;

    const latestAssistant = [...chatSession.messages.value].reverse().find((msg) => msg.role === 'assistant');
    if (!latestAssistant || !latestAssistant.metadata) return;

    const summaryScenes = Array.isArray(latestAssistant.metadata?.summary?.scenes)
      ? latestAssistant.metadata.summary.scenes
      : [];
    const partPool = buildAutoTagPartPool(latestAssistant.metadata);

    const partUsage = new Map<string, number>();
    for (const mediaItem of mediaItems.value) {
      for (const part of mediaItem.intendedParts || []) {
        incrementPartUsage(partUsage, part);
      }
    }

    for (let i = 0; i < summaryScenes.length; i++) {
      const scene = summaryScenes[i];
      const sceneDescription = typeof scene?.description === 'string' ? scene.description : '';
      const sceneLabel = normalizeMediaPartLabel(`Scene ${i + 1}: ${sceneDescription || 'Planned section'}`);
      const mediaNames = Array.isArray(scene?.mediaNames) ? scene.mediaNames : [];

      for (const mediaName of mediaNames) {
        if (typeof mediaName !== 'string') continue;
        const mediaItem = findMediaByReferenceName(mediaName);
        if (mediaItem) {
          addMediaPartTag(mediaItem, sceneLabel);
          incrementPartUsage(partUsage, sceneLabel);
        }
      }
    }

    for (const mediaItem of mediaItems.value) {
      if ((mediaItem.intendedParts || []).length > 0) continue;
      const inferredPart = inferPartForMedia(mediaItem, partPool, partUsage);
      if (!inferredPart) continue;
      addMediaPartTag(mediaItem, inferredPart);
      incrementPartUsage(partUsage, inferredPart);
    }
  }

  // Chat handlers
  async function handleChatSend(message: string) {
    if (chatSession.isGenerated.value) {
      showRefineConfirmation(message);
      return;
    }

    await chatSession.sendMessage(message);
    maybePromptGenerationConfirmation();
  }

  function maybePromptGenerationConfirmation() {
    if (chatSession.isGenerated.value || chatSession.isGenerating.value || creditConfirm.value.show) {
      return;
    }

    const lastAssistantReadyMessage = [...chatSession.messages.value]
      .reverse()
      .find((msg) => msg.role === 'assistant' && msg.metadata?.ready_to_generate === true);

    if (!lastAssistantReadyMessage) return;
    if (lastAssistantReadyMessage.id === lastReadyPromptMessageId.value) return;

    lastReadyPromptMessageId.value = lastAssistantReadyMessage.id;
    showGenerateConfirmation();
  }

  function showGenerateConfirmation() {
    creditConfirm.value = {
      show: true,
      title: 'Generate video',
      description:
        'AI will create a video composition based on your conversation. This will use credits from your balance.',
      cost: 10,
      confirmLabel: 'Generate',
      action: 'generate',
    };
  }

  function showRefineConfirmation(message: string) {
    creditConfirm.value = {
      show: true,
      title: 'Refine video',
      description: 'AI will modify your video based on your feedback. This will use credits from your balance.',
      cost: 5,
      confirmLabel: 'Refine',
      action: 'refine',
      refineMessage: message,
    };
  }

  async function confirmCreditAction() {
    const action = creditConfirm.value.action;
    const refineMessage = creditConfirm.value.refineMessage;
    creditConfirm.value.show = false;

    if (action === 'generate') {
      await executeGenerate();
    } else if (action === 'refine' && refineMessage) {
      await chatSession.refine(refineMessage);
    }
  }

  async function executeGenerate() {
    // Ensure session exists
    if (!chatSession.session.value) {
      console.error('[AIVideoCreator] No session — creating one first');
      try {
        await chatSession.createSession(mediaItems.value);
      } catch (e) {
        console.error('[AIVideoCreator] Failed to create session:', e);
        return;
      }
    }

    // Sync media items to session before generating
    try {
      await chatSession.syncMedia(mediaItems.value);
    } catch (e) {
      console.warn('[AIVideoCreator] Failed to sync media:', e);
    }

    console.log('[AIVideoCreator] Starting generation with session:', chatSession.session.value?.id);
    try {
      await chatSession.generate({
        aspectRatio: detectedAspectRatio.value,
      });
      console.log('[AIVideoCreator] Generation complete!');
    } catch (error: any) {
      console.error('[AIVideoCreator] Generation failed:', error?.message || error);
    }
  }

  async function handleUpload() {
    try {
      const files = await open({
        multiple: true,
        filters: [
          {
            name: 'Media Files',
            extensions: [
              'mp4',
              'mov',
              'webm',
              'avi',
              'mkv',
              'png',
              'jpg',
              'jpeg',
              'gif',
              'webp',
              'svg',
              'mp3',
              'wav',
              'ogg',
              'aac',
              'm4a',
              'flac',
            ],
          },
        ],
      });

      if (!files) return;
      const fileArray = Array.isArray(files) ? files : [files];

      for (const filePath of fileArray) {
        try {
          await processUploadedFile(filePath);
        } catch (err) {
          console.error(`Failed to process file ${filePath}:`, err);
        }
      }
    } catch (error) {
      console.error('Failed to upload files:', error);
    }
  }

  async function processUploadedFile(filePath: string) {
    const fileInfo = await invoke<{ name: string; size: number; extension: string }>('get_file_info', {
      path: filePath,
    });
    const fileType = getFileType(fileInfo.extension);

    let metadata: any = {};
    let thumbnailPath: string | undefined;

    if (fileType === 'video' || fileType === 'audio') {
      try {
        metadata = await invoke<any>('get_media_metadata', { path: filePath });
      } catch (e) {}
    }

    if (fileType === 'image') {
      try {
        metadata = await invoke<any>('get_image_metadata', { path: filePath });
      } catch (e) {}
    }

    if (fileType === 'video') {
      try {
        thumbnailPath = await invoke<string>('generate_video_thumbnail', { videoPath: filePath, timestamp: 0 });
      } catch (e) {}
    }

    const mediaItem: AIVideoMediaItem = {
      id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: fileInfo.name,
      type: fileType,
      source: { type: 'local', path: filePath },
      thumbnailUrl: thumbnailPath ? `asset://localhost/${thumbnailPath}` : undefined,
      duration: metadata.duration || 0,
      dimensions: metadata.width && metadata.height ? { width: metadata.width, height: metadata.height } : undefined,
      transcript: '',
      intendedParts: [],
      addedAt: new Date(),
    };

    mediaItems.value.push(mediaItem);

    if (fileType === 'video') {
      generateTranscriptForUploadedFile(mediaItem, filePath);
    }
  }

  function getFileType(extension: string): 'video' | 'audio' | 'image' {
    const ext = extension.toLowerCase();
    if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac'].includes(ext)) return 'audio';
    return 'image';
  }

  // Initialize: load saved sessions on mount
  onMounted(async () => {
    await loadSessions();
  });

  // Sync media items to chat session when they change
  watch(
    mediaItems,
    (items) => {
      chatSession.syncMedia(items);
      applyAssistantMediaMetadata();
    },
    { deep: true }
  );

  watch(
    () => chatSession.messages.value.length,
    () => {
      maybePromptGenerationConfirmation();

      const latestAssistantMessage = [...chatSession.messages.value].reverse().find((msg) => msg.role === 'assistant');
      if (!latestAssistantMessage) return;
      if (latestAssistantMessage.id === lastAssistantMetadataMessageId.value) return;

      lastAssistantMetadataMessageId.value = latestAssistantMessage.id;
      applyAssistantMediaMetadata();
    }
  );

  async function handleClipsSelected(clips: any[]) {
    console.log(`[AIVideoCreator] handleClipsSelected called with ${clips.length} clips`);
    clips.forEach((clip, idx) => {
      console.log(`[AIVideoCreator] Clip[${idx}]:`, {
        id: clip.id,
        name: clip.name,
        videoPath: clip.videoPath,
        builtFilePath: clip.builtFilePath,
        duration: clip.duration,
      });
    });

    const items: AIVideoMediaItem[] = [];
    for (const clip of clips) {
      const videoPath = clip.videoPath || clip.builtFilePath || '';
      let dimensions: { width: number; height: number } | undefined;

      // Probe video dimensions so we can detect aspect ratio
      if (videoPath) {
        try {
          const metadata = await invoke<any>('get_media_metadata', { path: videoPath });
          if (metadata?.width && metadata?.height) {
            dimensions = { width: metadata.width, height: metadata.height };
          }
        } catch (e) {
          console.warn(`[AIVideoCreator] Failed to get dimensions for clip ${clip.name}:`, e);
        }
      }

      items.push({
        id: clip.id,
        name: clip.name || 'Untitled Clip',
        type: 'video' as const,
        source: { type: 'clip', clipId: clip.id, path: videoPath },
        thumbnailUrl: clip.thumbnailPath,
        duration: clip.duration || 0,
        dimensions,
        transcript: '',
        intendedParts: [],
        addedAt: new Date(),
      });
    }

    mediaItems.value.push(...items);
    showClipPicker.value = false;

    // Fetch transcripts and audio peaks from clip segments for built clips
    for (const item of items) {
      fetchClipTranscript(item);
    }
  }

  function handleAssetsSelected(assets: AIVideoMediaItem[]) {
    mediaItems.value.push(
      ...assets.map((asset) => ({
        ...asset,
        intendedParts: asset.intendedParts || [],
      }))
    );
  }

  async function fetchClipTranscript(item: AIVideoMediaItem) {
    console.log(`[AIVideoCreator] Fetching transcript for clip: ${item.name} (${item.id})`);
    console.log(`[AIVideoCreator] Item source:`, item.source);

    try {
      transcriptGenerationStatus.value.set(item.id, { status: 'generating', progress: 'Loading...' });

      // Import the database service
      const { getClipSegmentsByClipId } = await import('../services/database/clip-segments');
      console.log(`[AIVideoCreator] Database service imported`);

      // Extract actual clip ID from composite ID (format: clipId_buildId_aspectRatio)
      const actualClipId = item.source?.clipId || item.id.split('_')[0];
      console.log(`[AIVideoCreator] Using clip ID: ${actualClipId} (from composite: ${item.id})`);

      // Get the video path for audio peak detection
      let videoPath = item.source?.path;
      console.log(`[AIVideoCreator] Initial video path: ${videoPath}`);

      // If no video path from source, try to get it from the clip database
      if (!videoPath || videoPath === '') {
        console.log(`[AIVideoCreator] No video path in source, fetching from database...`);
        try {
          const { getClip } = await import('../services/database/clips');
          const clip = await getClip(actualClipId);
          if (clip) {
            videoPath = clip.built_file_path || clip.file_path;
            console.log(`[AIVideoCreator] Got video path from database: ${videoPath}`);
          }
        } catch (e) {
          console.warn(`[AIVideoCreator] Failed to get clip from database:`, e);
        }
      }

      // Fetch clip segments which contain the transcript
      const segments = await getClipSegmentsByClipId(actualClipId);
      console.log(`[AIVideoCreator] Found ${segments?.length || 0} segments for clip ${item.name}`);

      // If no segments, try to get transcript from the clip's project
      if (!segments || segments.length === 0) {
        console.log(`[AIVideoCreator] No segments found, trying to get transcript from project level`);

        const { getClip } = await import('../services/database/clips');
        const { getTranscriptByProjectId } = await import('../services/database/transcripts');

        const clip = await getClip(actualClipId);
        if (clip?.project_id) {
          console.log(`[AIVideoCreator] Found project ID: ${clip.project_id}`);
          const transcript = await getTranscriptByProjectId(clip.project_id);

          if (transcript?.text) {
            console.log(`[AIVideoCreator] Found project-level transcript: ${transcript.text.length} characters`);
            const m = mediaItems.value.find((x) => x.id === item.id);
            if (m) {
              m.transcript = transcript.text;

              // Try to calculate audio peaks from the video file
              try {
                const videoPath = clip.built_file_path || clip.file_path;
                if (videoPath) {
                  const peaks = await invoke<Array<{ time: number; amplitude: number }>>('detect_audio_peaks', {
                    videoPath,
                    threshold: 0.3,
                    minInterval: 0.5,
                  });

                  if (peaks && peaks.length > 0) {
                    m.audioPeaks = peaks;
                    console.log(`[AIVideoCreator] ✅ Calculated ${peaks.length} audio peaks from video`);
                  }
                }
              } catch (e) {
                console.warn(`[AIVideoCreator] Failed to calculate audio peaks:`, e);
              }

              console.log(
                `[AIVideoCreator] ✅ Loaded project transcript for ${item.name}: ${transcript.text.substring(0, 100)}...`
              );
            }
            transcriptGenerationStatus.value.delete(item.id);
            return;
          } else {
            console.log(`[AIVideoCreator] No transcript found at project level`);
          }
        } else {
          console.log(`[AIVideoCreator] Clip has no project_id`);
        }
      }

      if (segments && segments.length > 0) {
        // Log first segment to see what we have
        console.log(`[AIVideoCreator] First segment transcript:`, segments[0].transcript?.substring(0, 100));

        // Combine all segment transcripts
        const fullTranscript = segments
          .map((seg) => {
            if (!seg.transcript) return '';

            // Handle JSON transcript format
            try {
              const parsed = JSON.parse(seg.transcript);
              if (parsed.words && Array.isArray(parsed.words)) {
                return parsed.words.map((w: any) => w.word || w.text || '').join(' ');
              } else if (parsed.segments && Array.isArray(parsed.segments)) {
                return parsed.segments.map((s: any) => s.text || '').join(' ');
              } else if (Array.isArray(parsed)) {
                return parsed.map((w: any) => w.word || w.text || '').join(' ');
              }
              return String(parsed);
            } catch {
              // Plain text transcript
              return seg.transcript;
            }
          })
          .filter((t) => t)
          .join(' ');

        console.log(`[AIVideoCreator] Combined transcript length: ${fullTranscript.length} characters`);
        console.log(`[AIVideoCreator] FULL TRANSCRIPT:`, fullTranscript);

        const m = mediaItems.value.find((x) => x.id === item.id);
        if (m) {
          m.transcript = fullTranscript;

          // Extract audio peaks from segments if available
          const audioPeaks: Array<{ time: number; amplitude: number }> = [];
          for (const seg of segments) {
            if (seg.audio_peaks) {
              try {
                const peaks = JSON.parse(seg.audio_peaks);
                if (Array.isArray(peaks)) {
                  audioPeaks.push(...peaks);
                }
              } catch (e) {
                console.warn(`[AIVideoCreator] Failed to parse audio peaks:`, e);
              }
            }
          }

          if (audioPeaks.length > 0) {
            m.audioPeaks = audioPeaks;
            console.log(`[AIVideoCreator] ✅ Loaded ${audioPeaks.length} audio peaks from segments`);
          } else if (videoPath) {
            // No audio peaks in segments, calculate from video file
            console.log(`[AIVideoCreator] No audio peaks in segments, calculating from video file...`);
            try {
              const peaks = await invoke<Array<{ time: number; amplitude: number }>>('detect_audio_peaks', {
                videoPath,
                threshold: 0.3,
                minInterval: 0.5,
              });

              if (peaks && peaks.length > 0) {
                m.audioPeaks = peaks;
                console.log(`[AIVideoCreator] ✅ Calculated ${peaks.length} audio peaks from video`);
              }
            } catch (peakErr) {
              console.warn(`[AIVideoCreator] Failed to calculate audio peaks:`, peakErr);
            }
          }

          console.log(`[AIVideoCreator] ✅ Loaded transcript for ${item.name}: ${fullTranscript.substring(0, 100)}...`);
        } else {
          console.warn(`[AIVideoCreator] Could not find media item ${item.id} to update transcript`);
        }
      } else {
        console.warn(`[AIVideoCreator] No segments found for clip ${item.name}`);
      }

      // Final fallback: If we still don't have audio peaks, try to calculate them
      const finalItem = mediaItems.value.find((x) => x.id === item.id);
      if (finalItem && (!finalItem.audioPeaks || finalItem.audioPeaks.length === 0) && videoPath) {
        console.log(`[AIVideoCreator] Final fallback: calculating audio peaks for ${item.name}...`);
        try {
          const peaks = await invoke<Array<{ time: number; amplitude: number }>>('detect_audio_peaks', {
            videoPath,
            threshold: 0.3,
            minInterval: 0.5,
          });

          if (peaks && peaks.length > 0) {
            finalItem.audioPeaks = peaks;
            console.log(`[AIVideoCreator] ✅ Final fallback: calculated ${peaks.length} audio peaks`);
          }
        } catch (peakErr) {
          console.warn(`[AIVideoCreator] Final fallback failed to calculate audio peaks:`, peakErr);
        }
      }

      transcriptGenerationStatus.value.delete(item.id);
    } catch (e) {
      console.error(`[AIVideoCreator] ❌ Failed to fetch transcript for clip ${item.id}:`, e);
      transcriptGenerationStatus.value.delete(item.id);
    }
  }

  async function generateTranscriptForUploadedFile(item: AIVideoMediaItem, path: string) {
    try {
      transcriptGenerationStatus.value.set(item.id, { status: 'generating' });
      const audioPath = path.replace(/\.[^.]+$/, '_audio.mp3');
      await invoke('extract_audio_from_video', { videoPath: path, audioPath });
      const audioData = await invoke<number[]>('read_file_binary', { path: audioPath });

      const formData = new FormData();
      formData.append('audio', new Blob([new Uint8Array(audioData)], { type: 'audio/mpeg' }), 'audio.mp3');

      const res = await api.post('/clips/transcribe', formData, {
        params: { project_id: 'ai-creator' },
        headers: { 'Content-Type': undefined },
      });

      const m = mediaItems.value.find((x) => x.id === item.id);
      if (m && res.data.transcript) {
        m.transcript = res.data.transcript.text || '';
        transcriptGenerationStatus.value.delete(item.id);
      }
    } catch (e) {
      transcriptGenerationStatus.value.set(item.id, { status: 'error' });
    }
  }

  function openAssetPicker() {
    showAssetPicker.value = true;
  }
  function openClipPicker() {
    showClipPicker.value = true;
  }
  function openExport() {
    if (composition.value) showExportDialog.value = true;
  }

  async function handleExported(data: { outputPath: string; composition: import('@/types/ai-video').AIVideoComposition }) {
    console.log('[AIVideoCreator] Export completed, saving as built clip:', data.outputPath);
    try {
      const { createClip } = await import('@/services/database/clips');
      const { updateClipBuildStatus } = await import('@/services/database/clip-build');

      // Get file metadata for the exported video
      let fileDuration: number | undefined;
      let fileSize: number | undefined;
      try {
        const metadata = await invoke<any>('get_media_metadata', { path: data.outputPath });
        fileDuration = metadata?.duration;
      } catch (e) {
        console.warn('[AIVideoCreator] Failed to get exported video metadata:', e);
      }
      try {
        const { stat } = await import('@tauri-apps/plugin-fs');
        const fileInfo = await stat(data.outputPath);
        fileSize = fileInfo.size;
      } catch (e) {
        console.warn('[AIVideoCreator] Failed to get file size:', e);
      }

      // Generate a thumbnail for the exported video
      let thumbnailPath: string | undefined;
      try {
        const outputFileName = data.outputPath.split(/[/\\]/).pop()?.replace(/\.[^.]+$/, '') || 'ai-video';
        thumbnailPath = await invoke<string>('generate_thumbnail_at_timestamp', {
          videoPath: data.outputPath,
          timestampSeconds: 1.0,
          outputFilename: `${outputFileName}_thumb`,
        });
        console.log('[AIVideoCreator] Generated thumbnail:', thumbnailPath);
      } catch (e) {
        console.warn('[AIVideoCreator] Failed to generate thumbnail:', e);
      }

      const clipName = chatSession.session.value?.name || data.composition.name || 'AI Video';

      // Create a clip record in the local database
      const clipId = await createClip(
        null as any, // no project_id for AI video exports
        data.outputPath,
        {
          name: clipName,
          duration: fileDuration || data.composition.duration,
          thumbnailPath,
        }
      );

      // Mark it as built/completed immediately
      await updateClipBuildStatus(clipId, 'completed', {
        builtFilePath: data.outputPath,
        builtThumbnailPath: thumbnailPath,
        builtDuration: fileDuration || data.composition.duration,
        builtFileSize: fileSize,
        progress: 100,
      });

      console.log('[AIVideoCreator] ✅ Saved exported video as built clip:', clipId);

      // Also auto-name the session if it doesn't have a name yet
      if (chatSession.session.value && !chatSession.session.value.name) {
        try {
          await chatSession.renameSession(chatSession.session.value.id, clipName);
        } catch (e) {
          console.warn('[AIVideoCreator] Failed to auto-name session:', e);
        }
      }
    } catch (e) {
      console.error('[AIVideoCreator] Failed to save exported video as built clip:', e);
    }
  }
  function removeMedia(id: string) {
    mediaItems.value = mediaItems.value.filter((x) => x.id !== id);
  }
  function formatDuration(s?: number) {
    if (!s) return '0:00';
    const m = Math.floor(s / 60);
    return `${m}:${Math.floor(s % 60)
      .toString()
      .padStart(2, '0')}`;
  }
  function formatTime(s: number) {
    return formatDuration(s);
  }
</script>

