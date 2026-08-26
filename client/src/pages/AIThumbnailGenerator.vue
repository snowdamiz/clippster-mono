<template>
  <PageLayout
    title="AI Thumbnail Generator"
    description="Create AI thumbnails with Quick or Editable workflows"
    :show-header="true"
    :icon="ImagePlus"
  >
    <template #actions>
      <button type="button" class="btn-accent h-8 px-3.5 text-xs" @click="openCreateDialog">
        <Plus :size="16" /> New Project
      </button>
    </template>

    <!-- Desktop guard -->
    <div v-if="!isDesktop" class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <ImagePlus :size="48" class="text-zinc-600" />
      <h3 class="text-lg font-medium text-zinc-200">Desktop app required</h3>
      <p class="max-w-md text-sm text-zinc-500">
        AI Thumbnail Generator uses local video libraries and frame extraction. Open Clippster on desktop to use this feature.
      </p>
    </div>

    <!-- Home -->
    <div
      v-else-if="!session"
      class="flex flex-1 flex-col gap-6 p-6"
      :class="{ 'items-center justify-center': !isLoadingSessions && sessions.length === 0 }"
    >
      <div v-if="sessions.length || isLoadingSessions">
        <h1 class="text-2xl font-bold tracking-tight text-[var(--sidebar-text)]">Thumbnail Projects</h1>
        <p class="mt-1 text-sm text-[var(--sidebar-text-muted)]">
          Chat a brief, attach video context, then generate Quick or Editable thumbnails
        </p>
      </div>

      <div v-if="isLoadingSessions" class="home-grid">
        <div v-for="i in 6" :key="i" class="aspect-video animate-pulse rounded-[10px] border border-[var(--sidebar-border)] bg-[var(--sidebar-surface)]" />
      </div>

      <div v-else-if="sessions.length" class="home-grid">
        <div
          v-for="s in sessions"
          :key="s.id"
          class="group relative aspect-video cursor-pointer overflow-hidden rounded-[10px] border border-[var(--sidebar-border)] bg-[var(--sidebar-surface)] transition-all hover:scale-[1.02] hover:border-white/15"
          @click="openSession(s.id)"
        >
          <div class="absolute left-2 top-2 z-10 flex gap-1.5">
            <span class="badge" :class="statusBadgeClass(s.status)">{{ formatStatus(s.status) }}</span>
            <span class="badge" :class="s.generation_mode === 'quick' ? 'bg-sky-500/20 text-sky-300' : 'bg-purple-500/20 text-purple-300'">
              {{ s.generation_mode === 'quick' ? 'Quick' : 'Editable' }}
            </span>
          </div>
          <img v-if="s.thumbnail_url" :src="s.thumbnail_url" :alt="s.name || 'Thumbnail'" class="h-full w-full object-cover" />
          <div v-else class="flex h-full w-full items-center justify-center bg-gradient-to-br from-purple-600/20 to-zinc-900">
            <ImagePlus class="text-purple-400/40" :size="48" />
          </div>
          <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pt-10">
            <h3 class="truncate text-sm font-semibold text-zinc-100">{{ s.name || 'Untitled Project' }}</h3>
            <p class="mt-0.5 text-xs text-zinc-400">{{ formatDate(s.updated_at) }}</p>
          </div>
          <div class="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" class="hover-action hover:bg-purple-600" title="Open" @click.stop="openSession(s.id)">
              <Play :size="16" />
            </button>
            <button type="button" class="hover-action hover:bg-red-600" title="Delete" @click.stop="removeSession(s.id)">
              <Trash2 :size="16" />
            </button>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-col items-center text-center">
        <div class="flex size-20 items-center justify-center rounded-full bg-white/5">
          <ImagePlus class="text-zinc-600" :size="40" />
        </div>
        <h3 class="mt-4 text-lg font-medium text-zinc-200">No thumbnail projects yet</h3>
        <p class="mt-1 text-sm text-zinc-500">Create your first AI thumbnail project to get started</p>
        <button type="button" class="btn-purple mt-6" @click="openCreateDialog">
          <Plus :size="16" /> Create Your First Project
        </button>
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
              <ImagePlus :size="18" class="shrink-0 text-purple-400" />
              <span class="truncate text-sm font-semibold text-zinc-100">{{ session.name || 'Untitled Project' }}</span>
              <span class="badge bg-purple-500/20 text-purple-300">{{ formatStatus(status) }}</span>
            </div>
            <div class="flex items-center gap-3">
              <RefinementBadge
                v-if="isGenerated"
                :round="refinementRound"
                :max-rounds="maxRefinementRounds"
                :messages-remaining="refinementMessagesRemaining"
              />
              <div class="flex rounded-lg border border-white/10 p-0.5">
                <button
                  v-for="m in modeOptions"
                  :key="m"
                  type="button"
                  class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
                  :class="generationMode === m ? 'bg-purple-600 text-white' : 'text-zinc-400 hover:text-zinc-200'"
                  :disabled="isLoading || isGenerating"
                  @click="changeMode(m)"
                >
                  {{ m === 'editable' ? 'Editable' : 'Quick' }}
                </button>
              </div>
            </div>
          </header>

          <div class="flex min-h-0 flex-1">
            <aside class="flex w-[420px] shrink-0 flex-col border-r border-white/10 bg-zinc-950/80">
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
                    class="btn-purple mt-3 px-3 py-1.5 text-xs"
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
                <div v-if="showAdvancedMedia" class="rounded-lg border border-white/10 bg-zinc-900/40 p-2">
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

              <div ref="messagesEl" class="custom-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
                <div v-if="!messages.length" class="rounded-lg border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
                  Describe the thumbnail you want — hook, emotion, text, layout.
                </div>
                <div
                  v-for="msg in messages"
                  :key="msg.id"
                  class="rounded-lg px-3 py-2 text-sm leading-relaxed"
                  :class="msgBubbleClass(msg.role)"
                >
                  <p class="whitespace-pre-wrap">{{ msg.content }}</p>
                </div>
                <div v-if="isSending || isRefining || isGenerating" class="flex items-center gap-2 text-xs text-zinc-500">
                  <Loader2 :size="14" class="animate-spin" />
                  {{ isGenerating ? 'Generating…' : isRefining ? 'Refining…' : 'Thinking…' }}
                </div>
                <p v-if="error" class="rounded-md bg-red-500/10 px-3 py-2 text-xs text-red-400">{{ error }}</p>
              </div>

              <div class="space-y-2 border-t border-white/10 p-3">
                <button
                  v-if="readyToGenerate && isDiscovery"
                  type="button"
                  class="btn-purple w-full py-2.5"
                  :disabled="isGenerating"
                  @click="runGenerate"
                >
                  <Sparkles :size="16" />
                  Generate {{ generationMode === 'quick' ? 'Quick' : 'Editable' }} Thumbnail
                </button>
                <div class="flex gap-2">
                  <textarea
                    v-model="draft"
                    rows="2"
                    class="field-input flex-1 resize-none"
                    :placeholder="isGenerated ? 'Describe a refinement…' : 'Message the assistant…'"
                    :disabled="isSending || isRefining || isCompleted"
                    @keydown.enter.exact.prevent="submitChat"
                  />
                  <button
                    type="button"
                    class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-zinc-200 hover:bg-purple-600 disabled:opacity-40"
                    :disabled="!draft.trim() || isSending || isRefining || isCompleted"
                    @click="submitChat"
                  >
                    <Send :size="16" />
                  </button>
                </div>
              </div>
            </aside>

            <main class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
              <div v-if="isLoading && !isGenerating" class="flex flex-1 items-center justify-center">
                <Loader2 :size="32" class="animate-spin text-zinc-500" />
              </div>
              <div v-else-if="isGenerating" class="flex flex-1 flex-col items-center justify-center gap-3">
                <Loader2 :size="48" class="animate-spin text-purple-400" />
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
                    class="btn-purple px-3 py-1.5 text-xs"
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
                    :class="selectedCandidateIndex === i ? 'border-purple-500 ring-2 ring-purple-500/40' : 'border-white/10 hover:border-white/25'"
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
                      class="flex items-center gap-2 rounded-lg border border-purple-500/40 px-3 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-600/20"
                      @click="openInEditor"
                    >
                      <ExternalLink :size="14" /> Open in Image Editor
                    </button>
                    <button
                      type="button"
                      class="btn-purple px-3 py-1.5 text-xs"
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
                    class="inline-flex overflow-hidden rounded-lg border border-purple-500/40 bg-black ring-2 ring-purple-500/20"
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
            <div class="mb-4 flex size-12 items-center justify-center rounded-full bg-purple-600/20">
              <ImagePlus :size="24" class="text-purple-400" />
            </div>
            <h3 class="text-lg font-semibold text-zinc-100">New Thumbnail Project</h3>
            <p class="mt-1 text-sm text-zinc-500">Choose a workflow, then name your project</p>

            <div class="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                class="rounded-lg border px-3 py-3 text-left transition-all"
                :class="createMode === 'editable' ? 'border-purple-500 bg-purple-600/15 ring-1 ring-purple-500/40' : 'border-white/10 hover:border-white/20'"
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
              <button type="button" class="btn-purple flex-1" @click="confirmCreate">
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
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  ImagePlus, Plus, Play, Trash2, ArrowLeft, Loader2, Send, Sparkles,
  Check, Upload, ClipboardPaste, ExternalLink, Film,
} from 'lucide-vue-next';
import PageLayout from '@/components/PageLayout.vue';
import RefinementBadge from '@/components/ai-video/RefinementBadge.vue';
import ThumbnailVideoPicker from '@/components/ai-thumbnail/ThumbnailVideoPicker.vue';
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
} = useAIThumbnailSession();

const sessions = ref<ThumbnailSessionSummary[]>([]);
const isLoadingSessions = ref(false);
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
const messagesEl = ref<HTMLElement | null>(null);
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

watch(messages, async () => {
  await nextTick();
  if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight;
}, { deep: true });

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
  } catch {
    alert('Failed to delete project.');
  }
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

async function submitChat() {
  const text = draft.value.trim();
  if (!text) return;
  draft.value = '';
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
    router.push({ path: '/design-studio', query: { projectId: String(editorProjectId.value) } });
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
function msgBubbleClass(role: string) {
  if (role === 'user') return 'ml-6 bg-purple-600/20 text-zinc-100';
  if (role === 'assistant') return 'mr-4 bg-zinc-800/80 text-zinc-200';
  return 'bg-amber-500/10 text-amber-200/80';
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
.home-grid {
  display: grid;
  grid-template-columns: repeat(1, minmax(0, 1fr));
  gap: 1.25rem;
}
@media (min-width: 1024px) {
  .home-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 1400px) {
  .home-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
@media (min-width: 1800px) {
  .home-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}
.badge {
  @apply rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide;
}
.field-input {
  @apply rounded-lg border border-white/10 bg-zinc-800 px-2.5 py-1.5 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-purple-500;
}
.icon-btn {
  @apply flex size-9 shrink-0 items-center justify-center rounded-lg border border-white/10 text-zinc-400 hover:bg-white/5 hover:text-zinc-200;
}
.icon-ghost {
  @apply flex size-8 items-center justify-center rounded-lg text-zinc-400 hover:bg-white/5 hover:text-zinc-100;
}
.btn-purple {
  @apply flex items-center justify-center gap-2 rounded-lg bg-purple-600 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50;
}
.btn-accent {
  @apply flex items-center gap-2 rounded-md bg-[var(--sidebar-accent)] font-semibold text-[var(--sidebar-bg)] transition-opacity hover:opacity-90;
}
.link-action {
  @apply text-xs font-medium text-purple-400 hover:text-purple-300 disabled:opacity-40;
}
.section-label {
  @apply text-[11px] font-semibold uppercase tracking-wide text-zinc-500;
}
.hover-action {
  @apply flex size-9 items-center justify-center rounded-lg bg-white/10 text-white backdrop-blur;
}
.modal-enter-active,
.modal-leave-active { transition: opacity 0.15s ease; }
.modal-enter-from,
.modal-leave-to { opacity: 0; }
</style>
