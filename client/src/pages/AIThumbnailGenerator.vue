<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-[#0e0e10]">
    <div v-if="!isDesktop" class="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <ImagePlus :size="48" class="text-zinc-600" />
      <h3 class="text-lg font-medium text-zinc-200">Desktop app required</h3>
      <p class="max-w-md text-sm text-zinc-500">
        The Thumbnail workflow uses local video libraries and frame extraction. Open Clippster on desktop to continue.
      </p>
      <button type="button" class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white" @click="backToHome">
        Back to projects
      </button>
    </div>

    <template v-else>
      <AIImageCreatorHeader
        :title="session?.name || 'Untitled Thumbnail'"
        mode="thumbnail"
        :can-export="Boolean(workingImageUrl)"
        :busy="exportBusy || isAccepting"
        :status-label="formatStatus(status)"
        :status-class="statusBadgeClass(status)"
        @back="backToHome"
        @rename="onRename"
        @change-mode="onChangeMode"
        @export="onExportAction"
      >
        <template #actions-before>
          <div class="mr-1 flex rounded-lg border border-white/10 p-0.5">
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
        </template>
      </AIImageCreatorHeader>

      <div v-if="!session" class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Loader2 :size="32" class="animate-spin text-zinc-500" />
        <p class="text-sm text-zinc-500">Opening thumbnail project…</p>
      </div>

      <div v-else class="aithumb-workspace flex min-h-0 flex-1 flex-col overflow-hidden">
<div class="flex min-h-0 flex-1">
            <aside class="flex w-[360px] shrink-0 flex-col min-h-0 border-r border-white/10 bg-[#121214]">
              <div class="shrink-0 space-y-5 overflow-y-auto p-4">
                <!-- Video -->
                <section class="space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <p class="section-label">Video</p>
                    <button
                      v-if="attachedVideo"
                      type="button"
                      class="link-action"
                      :disabled="isLoading || isAttachingVideo"
                      @click="showVideoPicker = true"
                    >
                      Change
                    </button>
                  </div>

                  <div v-if="attachedVideo" class="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/50">
                    <div class="flex items-center gap-2.5 p-2.5">
                      <div class="size-11 shrink-0 overflow-hidden rounded-md bg-zinc-800">
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
                        <p class="truncate text-[11px] text-zinc-500">
                          {{ sourceLabel(attachedVideo.type) }}
                          · {{ attachedKeyFrames.length }} frames
                          <template v-if="session.transcript_source">· {{ session.transcript_source }}</template>
                        </p>
                      </div>
                    </div>
                    <div
                      v-if="attachedKeyFrames.length"
                      class="flex gap-1 overflow-x-auto border-t border-white/10 px-2.5 py-2"
                    >
                      <img
                        v-for="frame in attachedKeyFrames.slice(0, 8)"
                        :key="frame.index"
                        :src="frame.url"
                        :alt="`Frame ${frame.index + 1}`"
                        class="size-9 shrink-0 rounded object-cover ring-1 ring-white/10"
                      />
                    </div>
                  </div>

                  <button
                    v-else
                    type="button"
                    class="flex w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/15 bg-zinc-900/30 px-3 py-5 text-center transition-colors hover:border-sky-500/40 hover:bg-sky-500/5"
                    :disabled="isAttachingVideo"
                    @click="showVideoPicker = true"
                  >
                    <Loader2 v-if="isAttachingVideo" :size="20" class="animate-spin text-sky-400" />
                    <Film v-else :size="20" class="text-zinc-500" />
                    <span class="text-xs font-medium text-zinc-300">Attach video</span>
                    <span class="text-[11px] text-zinc-600">Library, clip, YouTube, or upload</span>
                  </button>

                  <ThumbnailConceptCards
                    v-if="session.concepts?.length || isAnalyzing"
                    :concepts="session.concepts || []"
                    :selected-id="session.selected_concept_id"
                    :summary="videoSummaryText"
                    :analyzing="isAnalyzing"
                    :disabled="isLoading || isGenerating"
                    @select="handleSelectConcept"
                    @reanalyze="handleReanalyze"
                  />

                  <div
                    v-if="hasVideoContext && isDiscovery"
                    class="space-y-2 rounded-lg border border-white/10 bg-zinc-900/40 p-2.5"
                  >
                    <p class="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">From video</p>
                    <div class="flex gap-2">
                      <select v-model.number="variantCount" class="field-input flex-1 text-xs">
                        <option :value="4">4 variants</option>
                        <option :value="8">8 variants</option>
                        <option :value="12">12 variants</option>
                      </select>
                      <button
                        type="button"
                        class="btn-primary px-3 py-1.5 text-xs"
                        :disabled="isGenerating || isLoading"
                        @click="runGenerateFromVideo"
                      >
                        Generate
                      </button>
                    </div>
                    <input
                      v-model="fromVideoInstructions"
                      type="text"
                      class="field-input w-full text-xs"
                      placeholder="Optional creative direction…"
                    />
                  </div>
                </section>

                <!-- Reference -->
                <section class="space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <p class="section-label">Base image (edit)</p>
                    <button
                      v-if="session.reference_image_url"
                      type="button"
                      class="link-action"
                      :disabled="isLoading"
                      @click="clearReference"
                    >
                      Clear
                    </button>
                  </div>

                  <div
                    v-if="session.reference_image_url"
                    class="overflow-hidden rounded-lg border border-white/10 bg-zinc-900/50"
                  >
                    <div class="flex items-center gap-2.5 p-2.5">
                      <div class="size-11 shrink-0 overflow-hidden rounded-md bg-zinc-800">
                        <img :src="session.reference_image_url" alt="Reference" class="size-full object-cover" />
                      </div>
                      <div class="min-w-0 flex-1">
                        <p class="truncate text-sm font-medium text-zinc-100">Uploaded base image</p>
                        <p class="text-[11px] text-zinc-500">
                          AI image edit · 2 credits without a transcript
                        </p>
                      </div>
                    </div>
                  </div>

                  <div class="flex gap-1.5">
                    <input
                      v-model="referenceUrl"
                      type="text"
                      placeholder="https://… image URL"
                      class="field-input min-w-0 flex-1 text-xs"
                      :disabled="isLoading"
                      @keyup.enter="applyReference"
                    />
                    <button
                      type="button"
                      class="icon-btn"
                      title="Paste from clipboard"
                      :disabled="isLoading"
                      @click="pasteReference"
                    >
                      <ClipboardPaste :size="14" />
                    </button>
                    <label class="icon-btn cursor-pointer" title="Upload image">
                      <Upload :size="14" />
                      <input type="file" accept="image/*" class="hidden" @change="uploadReference" />
                    </label>
                  </div>
                  <button
                    v-if="referenceUrl.trim() && referenceUrl.trim() !== session.reference_image_url"
                    type="button"
                    class="link-action"
                    :disabled="isLoading"
                    @click="applyReference"
                  >
                    Set reference
                  </button>
                </section>
              </div>

              <!-- Chat -->
              <div class="flex min-h-0 flex-1 flex-col border-t border-white/10">
                <ThumbnailChatPanel
                  :messages="messages"
                  :is-sending="isSending"
                  :is-generating="isGenerating"
                  :is-refining="isRefining"
                  :is-refinement-mode="isGenerated"
                  :is-discovery="isDiscovery"
                  :is-stuck-generating="stuckFailedGeneration"
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
                  :credit-cost="thumbnailCreditCost"
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
              <div
                v-else-if="!isGenerated && !isCompleted"
                class="flex flex-1 flex-col items-center justify-center gap-2"
              >
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
                    <Check :size="14" />
                    {{ isCompleted ? 'Accepted' : 'Accept & save to library' }}
                  </button>
                </div>
                <div class="flex flex-wrap gap-4">
                  <button
                    v-for="(c, i) in session.candidates"
                    :key="i"
                    type="button"
                    class="overflow-hidden rounded-lg border transition-all"
                    :class="
                      selectedCandidateIndex === i
                        ? 'border-sky-500 ring-2 ring-sky-500/40'
                        : 'border-white/10 hover:border-white/25'
                    "
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
                <div v-if="session.composition?.mode === 'from_video' && !isCompleted" class="flex gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
                    :disabled="isGenerating"
                    @click="handleContinueEditable"
                  >
                    Continue as Editable
                  </button>
                </div>
                <ThumbnailPostGenPanel
                  v-if="session.id && workingImageUrl"
                  :session-id="session.id"
                  :image-url="workingImageUrl"
                  :busy="isRefining || isGenerating"
                  @done="handlePostGenDone"
                  @error="handlePostGenError"
                />
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
                      <ExternalLink :size="14" />
                      Open in Image Editor
                    </button>
                    <button
                      type="button"
                      class="btn-primary px-3 py-1.5 text-xs"
                      :disabled="isAccepting || isCompleted || !session.plate_url"
                      @click="handleAccept(0)"
                    >
                      <Check :size="14" />
                      {{ isCompleted ? 'Accepted' : 'Accept editable' }}
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
                    <div v-else class="flex h-[112px] w-[200px] items-center justify-center text-[11px] text-zinc-500">
                      <Loader2 class="mr-1 size-3 animate-spin" />
                      Composing…
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
                <ThumbnailPostGenPanel
                  v-if="session.id && workingImageUrl"
                  class="mt-4"
                  :session-id="session.id"
                  :image-url="workingImageUrl"
                  :busy="isRefining || isGenerating"
                  @done="handlePostGenDone"
                  @error="handlePostGenError"
                />
              </div>
            </main>

          </div>
      </div>
    </template>

    <ThumbnailVideoPicker v-model="showVideoPicker" @attach="handleVideoAttach" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import {
    ImagePlus,
    Trash2,
    Loader2,
    Check,
    Upload,
    ClipboardPaste,
    ExternalLink,
    Film,
  } from 'lucide-vue-next';
  import AIImageCreatorHeader from '@/components/ai-image/AIImageCreatorHeader.vue';
  import type { AIImageExportAction } from '@/components/ai-image/AIImageCreatorHeader.vue';
  import ThumbnailVideoPicker from '@/components/ai-thumbnail/ThumbnailVideoPicker.vue';
  import ThumbnailChatPanel from '@/components/ai-thumbnail/ThumbnailChatPanel.vue';
  import ThumbnailConceptCards from '@/components/ai-thumbnail/ThumbnailConceptCards.vue';
  import ThumbnailPostGenPanel from '@/components/ai-thumbnail/ThumbnailPostGenPanel.vue';
  import { useAIThumbnailSession } from '@/composables/useAIThumbnailSession';
  import {
    acceptQuickThumbnail,
    acceptEditableThumbnail,
    composeEditableFeedPreview,
  } from '@/services/thumbnailRecipeAssemble';
  import type { ThumbnailGenerationMode } from '@/services/aiThumbnailApi';
  import type { ThumbnailKeyFrame, ThumbnailVideoSelection } from '@/composables/useThumbnailVideoContext';
  import type { ThumbnailVideoAttachPayload } from '@/composables/useThumbnailVideoContext';
  import { thumbnailGenerationCreditCost } from '@/utils/imageGenerationPolicy';
  import {
    createWorkableImageProject,
    exportImageToDisk,
    saveImageLocally,
    saveWorkableImageFile,
  } from '@/utils/aiImageExport';

  const isDesktop = typeof window !== 'undefined' && ('__TAURI__' in window || '__TAURI_INTERNALS__' in window);

  const router = useRouter();
  const route = useRoute();
  const modeOptions: ThumbnailGenerationMode[] = ['editable', 'quick'];

  const {
    session,
    messages,
    isLoading,
    isSending,
    isGenerating,
    isRefining,
    isAccepting,
    error,
    status,
    generationMode,
    isDiscovery,
    isGenerated,
    isCompleted,
    refinementRound,
    maxRefinementRounds,
    refinementMessagesRemaining,
    stuckFailedGeneration,
    readyToGenerate,
    loadSession,
    renameSession,
    setMode,
    updateMedia,
    setReference,
    sendMessage,
    generate,
    generateFromVideo,
    continueEditable,
    analyzeVideo,
    applyConcept,
    refine,
    accept,
    closeSession,
    clearError,
  } = useAIThumbnailSession();

  const showVideoPicker = ref(false);
  const isAttachingVideo = ref(false);
  const isAnalyzing = ref(false);
  const variantCount = ref<4 | 8 | 12>(4);
  const fromVideoInstructions = ref('');
  const attachedVideo = ref<ThumbnailVideoSelection | null>(null);
  const attachedKeyFrames = ref<ThumbnailKeyFrame[]>([]);
  const draft = ref('');
  const referenceUrl = ref('');
  const selectedCandidateIndex = ref(0);
  const editorProjectId = ref<number | null>(null);
  const editableFeedPreviewUrl = ref<string | null>(null);
  const isBuildingFeedPreview = ref(false);
  const exportBusy = ref(false);

  const workingImageUrl = computed(
    () => selectedCandidate.value?.url || session.value?.thumbnail_url || session.value?.plate_url || null
  );

  const videoSummaryText = computed(() => {
    const vs = session.value?.video_summary;
    if (!vs) return null;
    return String((vs as any).text || (vs as any).summary || '') || null;
  });

  const hasVideoContext = computed(
    () => !!attachedKeyFrames.value.length && !!(session.value?.transcript && session.value.transcript.length >= 50)
  );

  const thumbnailCreditCost = computed(() => {
    const transcriptBacked =
      session.value?.transcript_backed === true ||
      (!!session.value?.transcript && String(session.value.transcript).trim().length >= 50);
    return thumbnailGenerationCreditCost({
      hasTranscript: transcriptBacked,
      hasBaseImage: !!session.value?.reference_image_url,
    });
  });

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

  onMounted(() => void openFromRoute());

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
    { immediate: true }
  );

  watch(session, (s) => {
    if (!s) {
      attachedVideo.value = null;
      attachedKeyFrames.value = [];
      return;
    }
    const first = s.media_items?.[0] as
      | {
          id?: string;
          name?: string;
          type?: string;
          source?: string;
          sourcePath?: string;
          duration?: number | null;
          thumbnailUrl?: string;
          projectId?: string;
        }
      | undefined;

    if (first?.id && first?.sourcePath) {
      const source = String(first.source || first.type || 'project');
      const type =
        source === 'clip' ? 'clip' : source === 'youtube' ? 'youtube' : source === 'upload' ? 'upload' : 'project';
      attachedVideo.value = {
        id: String(first.id),
        name: String(first.name || first.id),
        type,
        sourcePath: String(first.sourcePath),
        duration: first.duration ?? null,
        thumbnailUrl: first.thumbnailUrl,
        projectId: first.projectId,
        youtubeUrl: (first as any).youtubeUrl || session.value?.youtube_url || undefined,
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

    referenceUrl.value = s.reference_image_url || '';
    selectedCandidateIndex.value = 0;
    if (s.status !== 'completed') editorProjectId.value = null;
  });

  async function openFromRoute() {
    const raw = route.query.session;
    const sessionId = Number(Array.isArray(raw) ? raw[0] : raw);
    if (Number.isFinite(sessionId) && sessionId > 0) {
      try {
        await loadSession(sessionId);
        return;
      } catch (e) {
        console.error('[AIThumbnailGenerator] open from route failed:', e);
      }
    }
    await router.replace('/ai-image');
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
        youtube_url: payload.youtube_url || null,
        video_title: payload.video_title || payload.selection.name,
        transcript: payload.transcript || null,
        transcript_source: payload.transcript_source || null,
        concepts: [],
        selected_concept_id: null,
      });
      if (payload.transcript && payload.transcript.length >= 50) {
        isAnalyzing.value = true;
        try {
          await analyzeVideo();
        } catch (e) {
          console.warn('[AIThumbnailGenerator] auto-analyze failed:', e);
        } finally {
          isAnalyzing.value = false;
        }
      }
    } catch (e) {
      console.error('[AIThumbnailGenerator] attach video failed:', e);
    } finally {
      isAttachingVideo.value = false;
    }
  }

  async function handleSelectConcept(conceptId: string) {
    try {
      await applyConcept(conceptId);
    } catch (e) {
      console.error('[AIThumbnailGenerator] apply concept failed:', e);
    }
  }

  async function handleReanalyze() {
    isAnalyzing.value = true;
    try {
      await analyzeVideo();
    } finally {
      isAnalyzing.value = false;
    }
  }

  async function runGenerateFromVideo() {
    try {
      await generateFromVideo({
        variant_count: variantCount.value,
        custom_instructions: fromVideoInstructions.value.trim() || undefined,
        concept_id: session.value?.selected_concept_id || undefined,
      });
    } catch (e) {
      console.error('[AIThumbnailGenerator] from-video failed:', e);
    }
  }

  async function handleContinueEditable() {
    try {
      await continueEditable(selectedCandidateIndex.value);
    } catch (e) {
      console.error('[AIThumbnailGenerator] continue editable failed:', e);
    }
  }

  function sourceLabel(type: string | undefined) {
    switch (type) {
      case 'clip':
        return 'Built Clip';
      case 'youtube':
        return 'YouTube';
      case 'upload':
        return 'Upload';
      default:
        return 'Video Library';
    }
  }

  async function handlePostGenDone(result: Record<string, unknown>) {
    const s = result.session as { id?: number } | undefined;
    if (s?.id) {
      await loadSession(s.id);
    }
  }

  function handlePostGenError(message: string) {
    console.error('[AIThumbnailGenerator] post-gen:', message);
    alert(message);
  }

  function backToHome() {
    closeSession();
    editorProjectId.value = null;
    draft.value = '';
    attachedVideo.value = null;
    attachedKeyFrames.value = [];
    void router.push('/ai-image');
  }

  async function onRename(name: string) {
    if (!session.value) return;
    try {
      await renameSession(session.value.id, name);
    } catch (e) {
      console.error('[AIThumbnailGenerator] rename failed:', e);
    }
  }

  function onChangeMode(mode: 'image' | 'thumbnail') {
    if (mode === 'thumbnail') return;
    void router.push('/ai-image');
  }

  async function onExportAction(action: AIImageExportAction) {
    const url = workingImageUrl.value;
    if (!url || !session.value) return;
    exportBusy.value = true;
    try {
      const name = session.value.name || 'AI Thumbnail';
      const width = session.value.canvas_width || 1280;
      const height = session.value.canvas_height || 720;
      if (action === 'export') {
        await exportImageToDisk({ imageUrl: url, name });
      } else if (action === 'save-local') {
        await saveImageLocally({ imageUrl: url, name, canvasWidth: width, canvasHeight: height });
      } else if (action === 'save-workable') {
        if (generationMode.value === 'editable') {
          const result = await saveWorkableImageFile({
            imageUrl: session.value.plate_url || url,
            recipe: session.value.recipe || null,
            name,
            canvasWidth: width,
            canvasHeight: height,
          });
          editorProjectId.value = result.backendProjectId;
        } else {
          await saveWorkableImageFile({
            imageUrl: url,
            name,
            canvasWidth: width,
            canvasHeight: height,
          });
        }
      } else if (action === 'open-editor') {
        if (editorProjectId.value) {
          await router.push({
            path: '/design-studio/edit',
            query: { projectId: String(editorProjectId.value) },
          });
          return;
        }
        const result = await createWorkableImageProject({
          imageUrl: session.value.plate_url || url,
          recipe: generationMode.value === 'editable' ? session.value.recipe || null : null,
          name,
          canvasWidth: width,
          canvasHeight: height,
        });
        editorProjectId.value = result.backendProjectId;
        await router.push({
          path: '/design-studio/edit',
          query: { projectId: String(result.backendProjectId) },
        });
      }
    } catch (e) {
      console.error('[AIThumbnailGenerator] export failed:', e);
      alert('Export failed. Please try again.');
    } finally {
      exportBusy.value = false;
    }
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

  async function applyReference() {
    const url = referenceUrl.value.trim();
    if (url) await setReference(url);
  }

  async function clearReference() {
    referenceUrl.value = '';
    await setReference('');
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
    return (
      (
        {
          discovery: 'Planning',
          generating: 'Generating',
          generated: 'Ready',
          refining: 'Refining',
          completed: 'Completed',
        } as Record<string, string>
      )[s] || s
    );
  }
  function statusBadgeClass(s: string) {
    if (s === 'completed' || s === 'generated') return 'bg-emerald-500/20 text-emerald-300';
    if (s === 'generating' || s === 'refining') return 'bg-amber-500/20 text-amber-300';
    return 'bg-zinc-500/30 text-zinc-300';
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
    .aithumb__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (min-width: 1400px) {
    .aithumb__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
  @media (min-width: 1800px) {
    .aithumb__grid {
      grid-template-columns: repeat(4, 1fr);
    }
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
  .modal-leave-active {
    transition: opacity 0.15s ease;
  }
  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }
  .selection-bar-enter-active {
    transition: all 150ms ease;
  }
  .selection-bar-leave-active {
    transition: all 100ms ease;
  }
  .selection-bar-enter-from,
  .selection-bar-leave-to {
    opacity: 0;
    transform: translateY(-4px);
  }
</style>
