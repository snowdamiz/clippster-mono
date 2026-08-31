<template>
  <PageLayout
    title="AI Thumbnail Creator"
    description="Create AI thumbnails with Quick or Editable workflows"
    :show-header="true"
    :icon="ImagePlus"
  >
    <template #actions>
      <button type="button" class="aithumb-create-btn" @click="openCreateDialog">
        <Plus class="aithumb-create-btn__icon" />
        New Project
      </button>
    </template>

    <!-- Desktop guard -->
    <div v-if="!isDesktop" class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <ImagePlus :size="48" class="text-zinc-600" />
      <h3 class="text-lg font-medium text-zinc-200">Desktop app required</h3>
      <p class="max-w-md text-sm text-zinc-500">
        AI Thumbnail Creator uses local video libraries and frame extraction. Open Clippster on desktop to use this feature.
      </p>
    </div>

    <!-- Home -->
    <div
      v-else-if="!session"
      class="aithumb__content"
      :class="{ 'aithumb__content--empty': !isLoadingSessions && sessions.length === 0 }"
    >
      <div v-if="sessions.length || isLoadingSessions" class="aithumb__heading">
        <h1 class="aithumb__title">Thumbnail Projects</h1>
        <p class="aithumb__subtitle">
          Chat a brief, attach video context, then generate Quick or Editable thumbnails
        </p>
      </div>

      <div v-if="isLoadingSessions" class="aithumb__grid">
        <div v-for="i in 6" :key="i" class="aithumb-card aithumb-card--skeleton">
          <div class="aithumb-card__skeleton-bg"></div>
          <div class="aithumb-card__bottom">
            <div class="aithumb-skeleton__title"></div>
            <div class="aithumb-skeleton__meta"></div>
          </div>
        </div>
      </div>

      <div v-else-if="sessions.length" class="aithumb__main">
        <Transition name="selection-bar">
          <div v-if="selectedProjects.size > 0" class="aithumb__selection-bar">
            <div class="aithumb__selection-info">
              <Check class="aithumb__selection-icon" />
              <span>{{ selectedProjects.size }} selected</span>
              <button
                v-if="selectedProjects.size < sessions.length"
                type="button"
                class="aithumb__selection-select-all"
                @click="selectAllProjects"
              >
                Select all
              </button>
            </div>
            <div class="aithumb__selection-actions">
              <button type="button" class="aithumb__selection-clear" @click="clearSelection">Clear</button>
              <button type="button" class="aithumb__selection-delete" @click="confirmBulkDelete">
                <Trash2 class="aithumb__selection-delete-icon" />
                Delete Selected
              </button>
            </div>
          </div>
        </Transition>

        <div class="aithumb__grid">
          <div
            v-for="s in sessions"
            :key="s.id"
            class="aithumb-card"
            :class="{ 'aithumb-card--selected': isProjectSelected(s.id) }"
            @click="openSession(s.id)"
          >
            <div
              class="aithumb-card__checkbox"
              :class="{ 'aithumb-card__checkbox--visible': isProjectSelected(s.id) }"
              @click.stop="toggleProjectSelection(s.id)"
            >
              <div
                class="aithumb-card__checkbox-inner"
                :class="{ 'aithumb-card__checkbox-inner--checked': isProjectSelected(s.id) }"
              >
                <Check v-if="isProjectSelected(s.id)" class="aithumb-card__checkbox-icon" />
              </div>
            </div>

            <div class="aithumb-card__badges">
              <div class="aithumb-card__badge" :class="`aithumb-card__badge--${s.status}`">
                {{ formatStatus(s.status) }}
              </div>
              <div
                class="aithumb-card__mode-badge"
                :class="s.generation_mode === 'quick' ? 'aithumb-card__mode-badge--quick' : 'aithumb-card__mode-badge--editable'"
              >
                {{ s.generation_mode === 'quick' ? 'Quick' : 'Editable' }}
              </div>
            </div>

            <div
              v-if="s.thumbnail_url"
              class="aithumb-card__thumbnail"
              :style="{ backgroundImage: `url(${s.thumbnail_url})` }"
            >
              <div class="aithumb-card__vignette"></div>
            </div>
            <div v-else class="aithumb-card__thumbnail aithumb-card__thumbnail--empty">
              <div class="aithumb-card__thumbnail-gradient"></div>
              <div class="aithumb-card__empty-icon">
                <ImagePlus class="aithumb-card__folder-icon" />
              </div>
            </div>

            <div class="aithumb-card__bottom">
              <h3 class="aithumb-card__title" :title="s.name || 'Untitled Project'">
                {{ s.name || 'Untitled Project' }}
              </h3>
              <div class="aithumb-card__meta">
                <span class="aithumb-card__meta-text">{{ formatDate(s.updated_at) }}</span>
              </div>
            </div>

            <div class="aithumb-card__hover-actions">
              <button type="button" class="aithumb-card__action-btn" title="Open" @click.stop="openSession(s.id)">
                <Play class="aithumb-card__action-icon" />
              </button>
              <button type="button" class="aithumb-card__action-btn" title="Delete" @click.stop="removeSession(s.id)">
                <Trash2 class="aithumb-card__action-icon" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div v-else class="aithumb__empty">
        <div class="aithumb__empty-icon-wrapper">
          <ImagePlus class="aithumb__empty-icon" />
        </div>
        <h3 class="aithumb__empty-title">No projects found</h3>
        <p class="aithumb__empty-description">Create a new project to get started</p>
      </div>
    </div>

    <!-- Workspace -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="session" class="fixed inset-0 z-50 flex flex-col bg-[#0e0e10]">
          <header class="flex h-14 shrink-0 items-center justify-between border-b border-white/10 px-4">
            <div class="flex min-w-0 items-center gap-3">
              <button type="button" class="icon-ghost" title="Back to projects" @click="backToHome">
                <ArrowLeft :size="16" />
              </button>
              <ImagePlus :size="18" class="shrink-0 text-sky-400" />
              <span class="truncate text-sm font-semibold text-zinc-100">{{ session.name || 'Untitled Project' }}</span>
              <span class="badge bg-sky-500/20 text-sky-300">{{ formatStatus(status) }}</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="flex rounded-lg border border-white/10 p-0.5">
                <button
                  v-for="m in modeOptions"
                  :key="m"
                  type="button"
                  class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                  :class="generationMode === m ? 'bg-sky-600 text-white' : 'text-zinc-400 hover:text-zinc-200'"
                  :disabled="isLoading || isGenerating"
                  @click="changeMode(m)"
                >
                  {{ m === 'editable' ? 'Editable' : 'Quick' }}
                </button>
              </div>
            </div>
          </header>

          <div class="flex min-h-0 flex-1">
            <aside class="flex w-[420px] shrink-0 flex-col min-h-0 border-r border-white/10 bg-zinc-950/80">
              <div class="space-y-3 border-b border-white/10 p-3">
                <div class="flex items-center justify-between gap-2">
                  <p class="section-label">Video context</p>
                  <button
                    type="button"
                    class="link-action"
                    :disabled="isLoading || isAttachingVideo"
                    @click="showVideoPicker = true"
                  >
                    {{ attachedVideo ? 'Change' : 'Pick video' }}
                  </button>
                </div>

                <div
                  v-if="attachedVideo"
                  class="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/60"
                >
                  <div class="flex items-center gap-2 p-2">
                    <div class="size-12 shrink-0 overflow-hidden rounded bg-zinc-800">
                      <img
                        v-if="attachedVideo.thumbnailUrl"
                        :src="attachedVideo.thumbnailUrl"
                        :alt="attachedVideo.name"
                        class="size-full object-cover"
                      />
                      <div v-else class="flex size-full items-center justify-center">
                        <Film :size="16" class="text-zinc-600" />
                      </div>
                    </div>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-zinc-100">{{ attachedVideo.name }}</p>
                      <p class="text-[11px] text-zinc-500">
                        {{ attachedVideo.type === 'project' ? 'Video Library' : 'Built Clip' }}
                        · {{ attachedKeyFrames.length }} keyframes
                      </p>
                    </div>
                  </div>
                  <div v-if="attachedKeyFrames.length" class="flex gap-1 overflow-x-auto border-t border-white/10 p-2">
                    <img
                      v-for="frame in attachedKeyFrames.slice(0, 8)"
                      :key="frame.index"
                      :src="frame.url"
                      :alt="`Frame ${frame.index + 1}`"
                      class="size-10 shrink-0 rounded object-cover ring-1 ring-white/10"
                    />
                  </div>
                </div>

                <div
                  v-else
                  class="rounded-lg border border-dashed border-white/10 p-4 text-center"
                >
                  <Film :size="24" class="mx-auto text-zinc-600" />
                  <p class="mt-2 text-xs text-zinc-500">Attach a library project or built clip</p>
                  <button
                    type="button"
                    class="btn-primary mt-3 px-3 py-1.5 text-xs"
                    :disabled="isAttachingVideo"
                    @click="showVideoPicker = true"
                  >
                    <Loader2 v-if="isAttachingVideo" :size="14" class="animate-spin" />
                    <Film v-else :size="14" />
                    Pick from library
                  </button>
                </div>

                <button
                  type="button"
                  class="text-[11px] text-zinc-600 hover:text-zinc-400"
                  @click="showAdvancedMedia = !showAdvancedMedia"
                >
                  {{ showAdvancedMedia ? 'Hide manual override' : 'Manual override' }}
                </button>
                <div v-if="showAdvancedMedia" class="space-y-2 rounded-lg border border-white/10 bg-zinc-900/40 p-2">
                  <div class="flex gap-2">
                    <input v-model="mediaName" type="text" placeholder="Video name" class="field-input flex-1" />
                    <input v-model="mediaId" type="text" placeholder="Video id" class="field-input w-28" />
                  </div>
                  <textarea
                    v-model="keyFramesInput"
                    rows="2"
                    placeholder="Key frames: JSON array or one URL per line"
                    class="field-input w-full resize-none"
                  />
                  <button type="button" class="link-action" :disabled="!mediaId.trim() || isLoading" @click="saveMedia">
                    Save media manually
                  </button>
                </div>
              </div>

              <div class="space-y-2 border-b border-white/10 p-3">
                <p class="section-label">Reference image</p>
                <div class="flex gap-2">
                  <input v-model="referenceUrl" type="text" placeholder="https://… or paste / upload" class="field-input flex-1" />
                  <button type="button" class="icon-btn" title="Paste from clipboard" @click="pasteReference">
                    <ClipboardPaste :size="14" />
                  </button>
                  <label class="icon-btn cursor-pointer" title="Upload image">
                    <Upload :size="14" />
                    <input type="file" accept="image/*" class="hidden" @change="uploadReference" />
                  </label>
                </div>
                <div class="flex items-center gap-2">
                  <button type="button" class="link-action" :disabled="!referenceUrl.trim() || isLoading" @click="applyReference">
                    Set reference
                  </button>
                  <img
                    v-if="session.reference_image_url"
                    :src="session.reference_image_url"
                    alt="Reference"
                    class="ml-auto h-8 w-12 rounded object-cover ring-1 ring-white/10"
                  />
                </div>
              </div>

              <div class="flex min-h-0 flex-1 flex-col">
                <ThumbnailChatPanel
                  :messages="messages"
                  :is-sending="isSending"
                  :is-generating="isGenerating"
                  :is-refining="isRefining"
                  :is-refinement-mode="isGenerated"
                  :is-discovery="isDiscovery"
                  :ready-to-generate="readyToGenerate"
                  :generation-mode="generationMode"
                  :is-completed="isCompleted"
                  :refinement-round="refinementRound"
                  :max-refinement-rounds="maxRefinementRounds"
                  :refinement-messages-remaining="refinementMessagesRemaining"
                  :error="error"
                  :draft-message="draft"
                  :attached-video-name="attachedVideo?.name"
                  :key-frame-count="attachedKeyFrames.length"
                  @send="handleChatSend"
                  @update:draft-message="draft = $event"
                  @clear-error="clearError"
                  @generate="runGenerate"
                />
              </div>
            </aside>

            <main class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
              <div v-if="isLoading && !isGenerating" class="flex flex-1 items-center justify-center">
                <Loader2 :size="32" class="animate-spin text-zinc-500" />
              </div>
              <div v-else-if="isGenerating" class="flex flex-1 flex-col items-center justify-center gap-3">
                <Loader2 :size="48" class="animate-spin text-sky-400" />
                <h3 class="text-lg font-medium text-zinc-100">Generating thumbnail…</h3>
                <p class="text-sm text-zinc-500">
                  {{ generationMode === 'quick' ? 'Creating candidates' : 'Building plate + recipe' }}
                </p>
              </div>
              <div v-else-if="!isGenerated && !isCompleted" class="flex flex-1 flex-col items-center justify-center gap-2">
                <ImagePlus :size="48" class="text-zinc-700" />
                <p class="text-sm text-zinc-500">Results appear here after you generate</p>
              </div>

              <!-- Quick -->
              <div v-else-if="generationMode === 'quick'" class="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
                <div class="flex items-center justify-between">
                  <h2 class="text-sm font-semibold text-zinc-200">Candidates (feed preview ~200px)</h2>
                  <button
                    v-if="selectedCandidate"
                    type="button"
                    class="btn-primary px-3 py-1.5 text-xs"
                    :disabled="isAccepting || isCompleted"
                    @click="handleAccept(selectedCandidateIndex)"
                  >
                    <Check :size="14" /> {{ isCompleted ? 'Accepted' : 'Accept & save to library' }}
                  </button>
                </div>
                <div class="flex flex-wrap gap-4">
                  <button
                    v-for="(c, i) in session.candidates"
                    :key="i"
                    type="button"
                    class="overflow-hidden rounded-lg border transition-all"
                    :class="selectedCandidateIndex === i ? 'border-sky-500 ring-2 ring-sky-500/40' : 'border-white/10 hover:border-white/25'"
                    @click="selectedCandidateIndex = i"
                  >
                    <img :src="c.url" :alt="`Candidate ${i + 1}`" class="h-auto w-[200px] object-cover" />
                  </button>
                </div>
                <div v-if="selectedCandidate" class="mt-2">
                  <p class="mb-2 text-xs text-zinc-500">Full preview</p>
                  <img
                    :src="selectedCandidate.url"
                    alt="Full preview"
                    class="max-h-[55vh] max-w-full rounded-lg border border-white/10 object-contain"
                  />
                </div>
              </div>

              <!-- Editable -->
              <div v-else class="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
                <div class="flex items-center justify-between gap-3">
                  <h2 class="text-sm font-semibold text-zinc-200">Plate + recipe layers</h2>
                  <div class="flex items-center gap-2">
                    <button
                      v-if="editorProjectId"
                      type="button"
                      class="flex items-center gap-2 rounded-lg border border-sky-500/40 px-3 py-1.5 text-xs font-semibold text-sky-300 hover:bg-sky-600/20"
                      @click="openInEditor"
                    >
                      <ExternalLink :size="14" /> Open in Image Editor
                    </button>
                    <button
                      type="button"
                      class="btn-primary px-3 py-1.5 text-xs"
                      :disabled="isAccepting || isCompleted || !session.plate_url"
                      @click="handleAccept(0)"
                    >
                      <Check :size="14" /> {{ isCompleted ? 'Accepted' : 'Accept editable' }}
                    </button>
                  </div>
                </div>

                <div v-if="editableFeedPreviewUrl || isBuildingFeedPreview" class="mb-2">
                  <p class="mb-2 text-xs text-zinc-500">Feed preview (~200px) — postage-stamp test</p>
                  <div
                    class="inline-flex overflow-hidden rounded-lg border border-sky-500/40 bg-black ring-2 ring-sky-500/20"
                  >
                    <img
                      v-if="editableFeedPreviewUrl"
                      :src="editableFeedPreviewUrl"
                      alt="Editable feed preview"
                      class="h-auto w-[200px] object-cover"
                    />
                    <div
                      v-else
                      class="flex h-[112px] w-[200px] items-center justify-center text-[11px] text-zinc-500"
                    >
                      <Loader2 class="mr-1 size-3 animate-spin" /> Composing…
                    </div>
                  </div>
                </div>

                <div class="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p class="mb-2 text-xs text-zinc-500">Background plate</p>
                    <img
                      v-if="session.plate_url"
                      :src="session.plate_url"
                      alt="Plate"
                      class="w-full max-w-xl rounded-lg border border-white/10 object-contain"
                    />
                    <p v-else class="text-sm text-zinc-600">No plate yet</p>
                  </div>
                  <div>
                    <p class="mb-2 text-xs text-zinc-500">Text layers</p>
                    <ul v-if="recipeTextLayers.length" class="space-y-2">
                      <li
                        v-for="(layer, i) in recipeTextLayers"
                        :key="layerKey(layer, i)"
                        class="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2"
                      >
                        <p class="text-sm font-medium text-zinc-100">{{ layerContent(layer) }}</p>
                        <p class="mt-1 text-[11px] text-zinc-500">{{ layerMeta(layer) }}</p>
                      </li>
                    </ul>
                    <p v-else class="text-sm text-zinc-600">No text layers in recipe</p>
                  </div>
                  <div v-if="recipeShapeLayers.length">
                    <p class="mb-2 text-xs text-zinc-500">Shape layers</p>
                    <ul class="space-y-2">
                      <li
                        v-for="(shape, i) in recipeShapeLayers"
                        :key="String(shape.id ?? i)"
                        class="rounded-lg border border-white/10 bg-zinc-900/60 px-3 py-2"
                      >
                        <p class="text-sm font-medium text-zinc-100">{{ shapeLabel(shape) }}</p>
                        <p class="mt-1 text-[11px] text-zinc-500">{{ shapeMeta(shape) }}</p>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </main>
          </div>
        </div>
      </Transition>
    </Teleport>

    <Teleport to="body">
      <Transition name="modal">
        <div
          v-if="showCreateDialog"
          class="fixed inset-0 z-[60] flex items-center justify-center bg-black/60"
          @click.self="showCreateDialog = false"
        >
          <div class="w-full max-w-md rounded-lg border border-white/10 bg-zinc-900 p-6 shadow-xl">
            <div class="mb-4 flex size-12 items-center justify-center rounded-full bg-sky-600/20">
              <ImagePlus :size="24" class="text-sky-400" />
            </div>
            <h3 class="text-lg font-semibold text-zinc-100">New Thumbnail Project</h3>
            <p class="mt-1 text-sm text-zinc-500">Choose a workflow, then name your project</p>

            <div class="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                class="rounded-lg border px-3 py-3 text-left transition-all"
                :class="createMode === 'editable' ? 'border-sky-500 bg-sky-600/15 ring-1 ring-sky-500/40' : 'border-white/10 hover:border-white/20'"
                @click="createMode = 'editable'"
              >
                <p class="text-sm font-semibold text-zinc-100">Editable</p>
                <p class="mt-1 text-[11px] leading-relaxed text-zinc-500">Text-free plate + live text layers in Image Editor</p>
              </button>
              <button
                type="button"
                class="rounded-lg border px-3 py-3 text-left transition-all"
                :class="createMode === 'quick' ? 'border-sky-500 bg-sky-600/15 ring-1 ring-sky-500/40' : 'border-white/10 hover:border-white/20'"
                @click="createMode = 'quick'"
              >
                <p class="text-sm font-semibold text-zinc-100">Quick</p>
                <p class="mt-1 text-[11px] leading-relaxed text-zinc-500">Finished flat thumbnail with baked hook text</p>
              </button>
            </div>

            <input
              v-model="projectNameInput"
              type="text"
              maxlength="100"
              placeholder="e.g., Episode 12 Thumbnail"
              class="field-input mt-4 w-full"
              autofocus
              @keyup.enter="confirmCreate"
            />
            <p v-if="projectNameError" class="mt-2 text-xs text-red-400">{{ projectNameError }}</p>
            <div class="mt-6 flex gap-2">
              <button type="button" class="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm text-zinc-300 hover:bg-white/5" @click="showCreateDialog = false">
                Cancel
              </button>
              <button type="button" class="btn-primary flex-1" @click="confirmCreate">
                <Plus :size="14" /> Create
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <ThumbnailVideoPicker v-model="showVideoPicker" @attach="handleVideoAttach" />
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  ImagePlus, Plus, Play, Trash2, ArrowLeft, Loader2, Sparkles,
  Check, Upload, ClipboardPaste, ExternalLink, Film,
} from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import ThumbnailVideoPicker from '@/components/ai-thumbnail/ThumbnailVideoPicker.vue';
import ThumbnailChatPanel from '@/components/ai-thumbnail/ThumbnailChatPanel.vue';
import { useAIThumbnailSession } from '@/composables/useAIThumbnailSession';
import { acceptQuickThumbnail, acceptEditableThumbnail, composeEditableFeedPreview } from '@/services/thumbnailRecipeAssemble';
import type { ThumbnailGenerationMode, ThumbnailSessionSummary } from '@/services/aiThumbnailApi';
import type { ThumbnailKeyFrame, ThumbnailVideoSelection } from '@/composables/useThumbnailVideoContext';
import type { ThumbnailVideoAttachPayload } from '@/composables/useThumbnailVideoContext';

const isDesktop = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);

const router = useRouter();
const modeOptions: ThumbnailGenerationMode[] = ['editable', 'quick'];

const {
  session, messages, isLoading, isSending, isGenerating, isRefining, isAccepting, error,
  status, generationMode, isDiscovery, isGenerated, isCompleted,
  refinementRound, maxRefinementRounds, refinementMessagesRemaining, readyToGenerate,
  listSessions, createSession, loadSession, deleteSession, renameSession,
  setMode, updateMedia, setReference, sendMessage, generate, refine, accept, closeSession,
  clearError,
} = useAIThumbnailSession();

const sessions = ref<ThumbnailSessionSummary[]>([]);
const isLoadingSessions = ref(false);
const selectedProjects = ref<Set<number>>(new Set());
const showCreateDialog = ref(false);
const createMode = ref<ThumbnailGenerationMode>('editable');
const showVideoPicker = ref(false);
const showAdvancedMedia = ref(false);
const isAttachingVideo = ref(false);
const attachedVideo = ref<ThumbnailVideoSelection | null>(null);
const attachedKeyFrames = ref<ThumbnailKeyFrame[]>([]);
const projectNameInput = ref('');
const projectNameError = ref('');
const draft = ref('');
const mediaName = ref('');
const mediaId = ref('');
const keyFramesInput = ref('');
const referenceUrl = ref('');
const selectedCandidateIndex = ref(0);
const editorProjectId = ref<number | null>(null);
const editableFeedPreviewUrl = ref<string | null>(null);
const isBuildingFeedPreview = ref(false);

const selectedCandidate = computed(() => session.value?.candidates?.[selectedCandidateIndex.value] ?? null);
const recipeTextLayers = computed(() => {
  const recipe = session.value?.recipe;
  if (!recipe) return [] as Array<Record<string, unknown>>;
  if (Array.isArray(recipe.text_layers)) return recipe.text_layers as Array<Record<string, unknown>>;
  if (Array.isArray(recipe.layers)) {
    return recipe.layers.filter((l) => l.type === 'text') as Array<Record<string, unknown>>;
  }
  return [];
});

const recipeShapeLayers = computed(() => {
  const recipe = session.value?.recipe;
  if (!recipe) return [] as Array<Record<string, unknown>>;
  if (Array.isArray(recipe.shapes)) return recipe.shapes as Array<Record<string, unknown>>;
  if (Array.isArray(recipe.layers)) {
    return recipe.layers.filter((l) => l.type === 'shape') as Array<Record<string, unknown>>;
  }
  return [];
});

onMounted(() => void loadHome());

watch(
  () => [session.value?.plate_url, session.value?.recipe, session.value?.generation_mode] as const,
  async ([plateUrl, recipe, mode]) => {
    if (mode !== 'editable' || !plateUrl) {
      editableFeedPreviewUrl.value = null;
      return;
    }
    isBuildingFeedPreview.value = true;
    try {
      editableFeedPreviewUrl.value = await composeEditableFeedPreview({
        plateUrl: String(plateUrl),
        recipe: recipe || null,
        canvasWidth: session.value?.canvas_width,
        canvasHeight: session.value?.canvas_height,
      });
    } catch (e) {
      console.warn('[AIThumbnail] Feed preview failed:', e);
      editableFeedPreviewUrl.value = String(plateUrl);
    } finally {
      isBuildingFeedPreview.value = false;
    }
  },
  { immediate: true },
);

watch(session, (s) => {
  if (!s) {
    attachedVideo.value = null;
    attachedKeyFrames.value = [];
    return;
  }
  const first = s.media_items?.[0] as {
    id?: string;
    name?: string;
    type?: string;
    source?: string;
    sourcePath?: string;
    duration?: number | null;
    thumbnailUrl?: string;
    projectId?: string;
  } | undefined;

  if (first?.id && first?.sourcePath) {
    attachedVideo.value = {
      id: String(first.id),
      name: String(first.name || first.id),
      type: first.source === 'clip' ? 'clip' : 'project',
      sourcePath: String(first.sourcePath),
      duration: first.duration ?? null,
      thumbnailUrl: first.thumbnailUrl,
      projectId: first.projectId,
    };
  } else if (first?.id) {
    attachedVideo.value = {
      id: String(first.id),
      name: String(first.name || first.id),
      type: 'project',
      sourcePath: '',
      duration: null,
    };
  } else {
    attachedVideo.value = null;
  }

  attachedKeyFrames.value = (s.key_frames || [])
    .map((f, index) => ({
      url: String((f as { url?: string }).url || ''),
      timestamp: Number((f as { timestamp?: number }).timestamp || 0),
      index: Number((f as { index?: number }).index ?? index),
    }))
    .filter((f) => f.url);

  mediaId.value = first?.id ? String(first.id) : '';
  mediaName.value = first?.name ? String(first.name) : '';
  keyFramesInput.value = s.key_frames?.length ? JSON.stringify(s.key_frames, null, 2) : '';
  referenceUrl.value = s.reference_image_url || '';
  selectedCandidateIndex.value = 0;
  if (s.status !== 'completed') editorProjectId.value = null;
});

async function loadHome() {
  isLoadingSessions.value = true;
  try {
    sessions.value = await listSessions();
  } finally {
    isLoadingSessions.value = false;
  }
}

function openCreateDialog() {
  projectNameInput.value = '';
  projectNameError.value = '';
  createMode.value = 'editable';
  showCreateDialog.value = true;
}

async function confirmCreate() {
  const name = projectNameInput.value.trim();
  if (!name) {
    projectNameError.value = 'Project name is required';
    return;
  }
  try {
    const data = await createSession({ name, generation_mode: createMode.value });
    await renameSession(data.id, name);
    showCreateDialog.value = false;
  } catch {
    projectNameError.value = 'Failed to create project. Please try again.';
  }
}

async function handleVideoAttach(payload: ThumbnailVideoAttachPayload) {
  if (!session.value) return;
  isAttachingVideo.value = true;
  try {
    attachedVideo.value = payload.selection;
    attachedKeyFrames.value = payload.keyFrames;
    await updateMedia({
      media_items: payload.media_items,
      key_frames: payload.key_frames,
    });
  } catch (e) {
    console.error('[AIThumbnailGenerator] attach video failed:', e);
  } finally {
    isAttachingVideo.value = false;
  }
}

async function openSession(id: number) {
  try {
    await loadSession(id);
  } catch (e) {
    console.error('[AIThumbnailGenerator] open failed:', e);
  }
}

async function removeSession(id: number) {
  const s = sessions.value.find((x) => x.id === id);
  if (!confirm(`Delete "${s?.name || 'Untitled Project'}"? This cannot be undone.`)) return;
  try {
    await deleteSession(id);
    sessions.value = sessions.value.filter((x) => x.id !== id);
    selectedProjects.value.delete(id);
    selectedProjects.value = new Set(selectedProjects.value);
  } catch {
    alert('Failed to delete project.');
  }
}

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
  selectedProjects.value = new Set(sessions.value.map((s) => s.id));
}

async function confirmBulkDelete() {
  const count = selectedProjects.value.size;
  if (count === 0) return;
  if (!confirm(`Are you sure you want to delete ${count} project${count > 1 ? 's' : ''}? This action cannot be undone.`)) {
    return;
  }
  const ids = Array.from(selectedProjects.value);
  for (const id of ids) {
    try {
      await deleteSession(id);
      sessions.value = sessions.value.filter((x) => x.id !== id);
    } catch (e) {
      console.error('[AIThumbnail] Failed to delete session:', id, e);
    }
  }
  clearSelection();
}

function backToHome() {
  closeSession();
  editorProjectId.value = null;
  draft.value = '';
  attachedVideo.value = null;
  attachedKeyFrames.value = [];
  void loadHome();
}

async function changeMode(mode: ThumbnailGenerationMode) {
  if (!session.value || mode === generationMode.value) return;
  try {
    await setMode(mode);
    selectedCandidateIndex.value = 0;
    editorProjectId.value = null;
  } catch (e) {
    console.error('[AIThumbnailGenerator] setMode failed:', e);
  }
}

function parseKeyFrames(): Array<Record<string, unknown>> {
  const raw = keyFramesInput.value.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
  } catch { /* URL list */ }
  return raw.split(/\n|,/).map((u) => u.trim()).filter(Boolean).map((url) => ({ url }));
}

async function saveMedia() {
  if (!mediaId.value.trim()) return;
  await updateMedia({
    media_items: [{ id: mediaId.value.trim(), name: mediaName.value.trim() || mediaId.value.trim(), type: 'video' }],
    key_frames: parseKeyFrames(),
  });
}

async function applyReference() {
  const url = referenceUrl.value.trim();
  if (url) await setReference(url);
}

async function pasteReference() {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'));
      if (!type) continue;
      const dataUrl = await readAsDataUrl(await item.getType(type));
      referenceUrl.value = dataUrl;
      await setReference(dataUrl, { source: 'clipboard' });
      return;
    }
    const text = (await navigator.clipboard.readText()).trim();
    if (text) {
      referenceUrl.value = text;
      await setReference(text, { source: 'clipboard_url' });
    }
  } catch (e) {
    console.warn('[AIThumbnailGenerator] clipboard paste failed:', e);
  }
}

async function uploadReference(ev: Event) {
  const input = ev.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const dataUrl = await readAsDataUrl(file);
  referenceUrl.value = dataUrl;
  await setReference(dataUrl, { source: 'upload', name: file.name });
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function handleChatSend(text: string) {
  if (isGenerated.value) await refine(text);
  else await sendMessage(text);
}

async function runGenerate() {
  await generate();
}

async function handleAccept(candidateIndex = 0) {
  if (!session.value) return;
  try {
    await accept(candidateIndex);
    const name = session.value.name || 'AI Thumbnail';
    const w = session.value.canvas_width;
    const h = session.value.canvas_height;
    if (generationMode.value === 'quick') {
      const url = session.value.candidates?.[candidateIndex]?.url || session.value.thumbnail_url;
      if (!url) throw new Error('No candidate image URL');
      await acceptQuickThumbnail({ imageUrl: url, name, canvasWidth: w, canvasHeight: h });
    } else {
      const plateUrl = session.value.plate_url;
      if (!plateUrl) throw new Error('No plate URL');
      const result = await acceptEditableThumbnail({
        plateUrl,
        recipe: session.value.recipe,
        name,
        canvasWidth: w,
        canvasHeight: h,
      });
      editorProjectId.value = result.backendProjectId;
    }
  } catch (e) {
    console.error('[AIThumbnailGenerator] accept failed:', e);
  }
}

function openInEditor() {
  if (editorProjectId.value) {
    router.push({ path: '/design-studio/edit', query: { projectId: String(editorProjectId.value) } });
  }
}

function layerKey(layer: Record<string, unknown>, i: number) {
  return String(layer.id ?? i);
}
function layerContent(layer: Record<string, unknown>) {
  return String(layer.content ?? '—');
}
function layerMeta(layer: Record<string, unknown>) {
  const family = layer.font_family || layer.fontFamily || 'Montserrat';
  const size = layer.font_size || layer.fontSize || 72;
  const color = layer.color || '#fff';
  return `${family} · ${size}px · ${color}`;
}
function shapeLabel(shape: Record<string, unknown>) {
  return String(shape.id || shape.type || shape.shape || 'Shape');
}
function shapeMeta(shape: Record<string, unknown>) {
  const type = shape.type || shape.shape || 'rect';
  const fill = shape.fill || shape.color || '#FF6B00';
  const opacity = shape.opacity ?? 1;
  return `${type} · ${fill} · ${Math.round(Number(opacity) * 100)}% opacity`;
}
function formatStatus(s: string) {
  return ({ discovery: 'Planning', generating: 'Generating', generated: 'Ready', refining: 'Refining', completed: 'Completed' } as Record<string, string>)[s] || s;
}
function statusBadgeClass(s: string) {
  if (s === 'completed' || s === 'generated') return 'bg-emerald-500/20 text-emerald-300';
  if (s === 'generating' || s === 'refining') return 'bg-amber-500/20 text-amber-300';
  return 'bg-zinc-500/30 text-zinc-300';
}
function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString();
  } catch {
    return '';
  }
}
</script>

<style scoped>
@reference "../style.css";

.badge {
  @apply rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide;
}
.field-input {
  @apply rounded-lg border border-white/10 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-500;
}
.icon-btn {
  @apply flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-zinc-200;
}
.icon-ghost {
  @apply flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-100;
}
.btn-primary {
  @apply flex items-center justify-center gap-2 rounded-lg bg-[var(--sidebar-accent)] text-sm font-medium text-[var(--sidebar-bg)] hover:opacity-90 disabled:opacity-50;
}
.btn-accent {
  @apply flex items-center gap-2 rounded-md bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-bg)] transition-opacity hover:opacity-90;
}
.link-action {
  @apply text-xs font-medium text-[var(--sidebar-accent)] hover:opacity-80 disabled:opacity-40;
}
.section-label {
  @apply text-[11px] font-semibold uppercase tracking-wide text-zinc-500;
}

.aithumb-create-btn {
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
.aithumb-create-btn:hover {
  opacity: 0.9;
}
.aithumb-create-btn__icon {
  width: 14px;
  height: 14px;
}

.aithumb__content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  width: 100%;
  flex: 1;
}
.aithumb__content--empty {
  justify-content: center;
  align-items: center;
}
.aithumb__heading {
  margin-bottom: 0.5rem;
}
.aithumb__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0 0 0.2rem;
  letter-spacing: -0.02em;
}
.aithumb__subtitle {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  line-height: 1.5;
}
.aithumb__main {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.aithumb__selection-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
}
.aithumb__selection-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  font-weight: 500;
}
.aithumb__selection-icon {
  width: 16px;
  height: 16px;
  color: var(--sidebar-accent);
}
.aithumb__selection-select-all {
  margin-left: 0.25rem;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--sidebar-accent);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}
.aithumb__selection-select-all:hover {
  background-color: var(--sidebar-hover);
}
.aithumb__selection-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.aithumb__selection-clear {
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
.aithumb__selection-clear:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}
.aithumb__selection-delete {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 6px;
  cursor: pointer;
  transition: all 150ms ease;
}
.aithumb__selection-delete:hover {
  background: rgba(239, 68, 68, 0.25);
}
.aithumb__selection-delete-icon {
  width: 14px;
  height: 14px;
}

.aithumb__grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  gap: 1.25rem;
}
@media (min-width: 1024px) {
  .aithumb__grid { grid-template-columns: repeat(2, 1fr); }
}
@media (min-width: 1400px) {
  .aithumb__grid { grid-template-columns: repeat(3, 1fr); }
}
@media (min-width: 1800px) {
  .aithumb__grid { grid-template-columns: repeat(4, 1fr); }
}

.aithumb-card {
  position: relative;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: all 200ms ease;
  aspect-ratio: 16 / 9;
}
.aithumb-card:hover {
  border-color: rgba(255, 255, 255, 0.15);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
  transform: scale(1.02);
}
.aithumb-card--selected {
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
}
.aithumb-card--selected:hover {
  border-color: var(--sidebar-accent);
}
.aithumb-card--skeleton {
  pointer-events: none;
}
.aithumb-card__skeleton-bg {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, var(--sidebar-hover) 0%, var(--sidebar-surface) 100%);
}
.aithumb-skeleton__title {
  height: 14px;
  width: 65%;
  background: var(--sidebar-hover);
  border-radius: 4px;
  margin-bottom: 6px;
}
.aithumb-skeleton__meta {
  height: 10px;
  width: 40%;
  background: var(--sidebar-hover);
  border-radius: 4px;
}

.aithumb-card__checkbox {
  position: absolute;
  top: 1rem;
  right: 1rem;
  z-index: 30;
  opacity: 0;
  transition: opacity 150ms ease;
}
.aithumb-card:hover .aithumb-card__checkbox,
.aithumb-card__checkbox--visible {
  opacity: 1;
}
.aithumb-card__checkbox-inner {
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
.aithumb-card__checkbox-inner--checked {
  background-color: var(--sidebar-accent);
  border-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
}
.aithumb-card__checkbox-icon {
  width: 16px;
  height: 16px;
}

.aithumb-card__badges {
  position: absolute;
  top: 1rem;
  left: 1rem;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 0.375rem;
}
.aithumb-card__badge {
  display: flex;
  align-items: center;
  padding: 0.3125rem 0.5rem;
  border-radius: 5px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
  background-color: rgba(113, 113, 122, 0.35);
  color: #d4d4d8;
}
.aithumb-card__badge--completed,
.aithumb-card__badge--generated {
  background-color: rgba(34, 197, 94, 0.25);
  color: #86efac;
}
.aithumb-card__badge--generating,
.aithumb-card__badge--refining {
  background-color: rgba(245, 158, 11, 0.25);
  color: #fcd34d;
}
.aithumb-card__badge--discovery {
  background-color: rgba(14, 165, 233, 0.25);
  color: #7dd3fc;
}

.aithumb-card__mode-badge {
  display: flex;
  align-items: center;
  padding: 0.3125rem 0.5rem;
  border-radius: 5px;
  font-size: 0.625rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  backdrop-filter: blur(8px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}
.aithumb-card__mode-badge--quick {
  background-color: rgba(14, 165, 233, 0.25);
  color: #7dd3fc;
}
.aithumb-card__mode-badge--editable {
  background-color: rgba(59, 130, 246, 0.3);
  color: #93c5fd;
}

.aithumb-card__thumbnail {
  position: absolute;
  inset: 0;
  z-index: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
.aithumb-card__vignette {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 40%, transparent 70%);
}
.aithumb-card__thumbnail--empty {
  background-color: var(--sidebar-hover);
}
.aithumb-card__thumbnail-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(0, 0, 0, 0.5) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.5) 100%);
}
.aithumb-card__empty-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.2;
}
.aithumb-card__folder-icon {
  width: 64px;
  height: 64px;
  color: var(--sidebar-text);
}

.aithumb-card__bottom {
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
.aithumb-card__title {
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
.aithumb-card__meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
}
.aithumb-card__meta-text {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aithumb-card__hover-actions {
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
.aithumb-card:hover .aithumb-card__hover-actions {
  opacity: 1;
}
.aithumb-card__action-btn {
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
.aithumb-card__action-btn:hover {
  background-color: white;
  transform: scale(1.1);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.35);
}
.aithumb-card__action-icon {
  width: 20px;
  height: 20px;
}

.aithumb__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.aithumb__empty-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background-color: var(--sidebar-hover);
  border-radius: 16px;
  margin-bottom: 1.5rem;
}
.aithumb__empty-icon {
  width: 36px;
  height: 36px;
  color: var(--sidebar-text-muted);
}
.aithumb__empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.5rem;
}
.aithumb__empty-description {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  max-width: 300px;
}

.modal-enter-active,
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
.selection-bar-enter-active { transition: all 150ms ease; }
.selection-bar-leave-active { transition: all 100ms ease; }
.selection-bar-enter-from,
.selection-bar-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
