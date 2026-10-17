<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-panel">
    <EmptyState
      v-if="!isDesktop"
      :icon="ImagePlus"
      title="Desktop app required"
      description="The thumbnail workflow uses local video libraries and frame extraction. Open Clippster on desktop to continue."
    >
      <Button variant="secondary" @click="backToHome">Back to projects</Button>
    </EmptyState>

    <template v-else>
      <AIImageCreatorHeader
        :title="session?.name || 'Untitled Thumbnail'"
        mode="thumbnail"
        :can-export="Boolean(workingImageUrl)"
        :busy="exportBusy || isAccepting"
        :status-label="formatStatus(status)"
        :status-variant="statusBadgeVariant(status)"
        @back="backToHome"
        @rename="onRename"
        @change-mode="onChangeMode"
        @export="onExportAction"
      >
        <template #actions-before>
          <SegmentedControl
            size="sm"
            class="mr-1"
            :model-value="generationMode"
            :options="generationModeOptions"
            @update:model-value="changeMode"
          />
        </template>
      </AIImageCreatorHeader>

      <div v-if="!session" class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <Loader2 class="size-6 animate-spin text-fg-subtle" />
        <p class="text-sm text-fg-muted">Opening thumbnail project…</p>
      </div>

      <div v-else class="aithumb-workspace flex min-h-0 flex-1 overflow-hidden">
        <!-- Left rail: sources + chat -->
        <aside class="flex min-h-0 w-[clamp(300px,34vw,400px)] shrink-0 flex-col border-r border-line-subtle bg-surface">
          <div class="flex max-h-[50%] shrink-0 flex-col gap-5 overflow-y-auto border-b border-line-subtle p-4">
            <!-- Video -->
            <section class="flex flex-col gap-2">
              <SectionHeader title="Video" variant="eyebrow" class="min-h-5">
                <Button
                  v-if="attachedVideo"
                  variant="link"
                  size="xs"
                  :disabled="isLoading || isAttachingVideo"
                  @click="showVideoPicker = true"
                >
                  Change
                </Button>
              </SectionHeader>

              <div v-if="attachedVideo" class="overflow-hidden rounded-lg border border-line-subtle bg-panel">
                <div class="flex items-center gap-2.5 p-2.5">
                  <div class="size-10 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
                    <img
                      v-if="attachedVideo.thumbnailUrl"
                      :src="attachedVideo.thumbnailUrl"
                      :alt="attachedVideo.name"
                      class="size-full object-cover"
                    />
                    <div v-else class="grid size-full place-items-center text-fg-subtle">
                      <Film class="size-4" />
                    </div>
                  </div>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-fg">{{ attachedVideo.name }}</p>
                    <p class="truncate text-xs text-fg-subtle">
                      {{ sourceLabel(attachedVideo.type) }}
                      · {{ attachedKeyFrames.length }} frames
                      <template v-if="session.transcript_source">· {{ session.transcript_source }}</template>
                    </p>
                  </div>
                </div>
                <div v-if="attachedKeyFrames.length" class="flex gap-1 overflow-x-auto border-t border-line-subtle px-2.5 py-2">
                  <img
                    v-for="frame in attachedKeyFrames.slice(0, 8)"
                    :key="frame.index"
                    :src="frame.url"
                    :alt="`Frame ${frame.index + 1}`"
                    class="size-9 shrink-0 rounded border border-line-subtle object-cover"
                  />
                </div>
              </div>

              <button
                v-else
                type="button"
                class="flex w-full flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong px-3 py-4 text-center transition-colors hover:border-brand-line hover:bg-brand-soft focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
                :disabled="isAttachingVideo"
                @click="showVideoPicker = true"
              >
                <Loader2 v-if="isAttachingVideo" class="size-4 animate-spin text-brand" />
                <Film v-else class="size-4 text-fg-muted" />
                <span class="text-xs font-medium text-fg">Attach video</span>
                <span class="text-2xs text-fg-subtle">Library, clip, YouTube, or upload</span>
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

              <div v-if="hasVideoContext && isDiscovery" class="mt-1 flex flex-col gap-2 border-t border-line-subtle pt-3">
                <span class="eyebrow">From video</span>
                <div class="flex gap-2">
                  <div class="min-w-0 flex-1">
                    <CustomDropdown v-model="variantCount" :options="variantCountOptions" size="sm" />
                  </div>
                  <Button variant="brand" size="sm" :disabled="isGenerating || isLoading" @click="runGenerateFromVideo">
                    <Sparkles /> Generate
                  </Button>
                </div>
                <Input v-model="fromVideoInstructions" class="h-[var(--control-sm)] text-xs" placeholder="Optional creative direction…" />
              </div>
            </section>

            <!-- Reference -->
            <section class="flex flex-col gap-2">
              <SectionHeader title="Base image (edit)" variant="eyebrow" class="min-h-5">
                <Button
                  v-if="session.reference_image_url"
                  variant="link"
                  size="xs"
                  :disabled="isLoading"
                  @click="clearReference"
                >
                  Clear
                </Button>
              </SectionHeader>

              <div
                v-if="session.reference_image_url"
                class="flex items-center gap-2.5 rounded-lg border border-line-subtle bg-panel p-2.5"
              >
                <div class="size-10 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
                  <img :src="session.reference_image_url" alt="Reference" class="size-full object-cover" />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-fg">Uploaded base image</p>
                  <p class="text-xs text-fg-subtle">AI image edit · 2 credits without a transcript</p>
                </div>
              </div>

              <div class="flex gap-1.5">
                <Input
                  v-model="referenceUrl"
                  placeholder="https://… image URL"
                  class="min-w-0 flex-1 text-xs"
                  :disabled="isLoading"
                  @keyup.enter="applyReference"
                />
                <Button
                  variant="secondary"
                  size="icon"
                  title="Paste from clipboard"
                  aria-label="Paste from clipboard"
                  :disabled="isLoading"
                  @click="pasteReference"
                >
                  <ClipboardPaste />
                </Button>
                <label
                  :class="buttonVariants({ variant: 'secondary', size: 'icon' })"
                  class="cursor-pointer"
                  title="Upload image"
                  aria-label="Upload image"
                >
                  <Upload />
                  <input type="file" accept="image/*" class="hidden" @change="uploadReference" />
                </label>
              </div>
              <Button
                v-if="referenceUrl.trim() && referenceUrl.trim() !== session.reference_image_url"
                variant="link"
                size="xs"
                class="self-start"
                :disabled="isLoading"
                @click="applyReference"
              >
                Set reference
              </Button>
            </section>
          </div>

          <!-- Chat -->
          <div class="flex min-h-0 flex-1 flex-col">
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

        <!-- Results -->
        <main class="relative flex min-w-0 flex-1 flex-col overflow-hidden">
          <!-- Keyed by view so each state change (generating → results, quick ↔ editable) eases in -->
          <div :key="resultsView" class="flex min-h-0 flex-1 animate-enter flex-col">
            <div v-if="resultsView === 'loading'" class="flex flex-1 items-center justify-center">
              <Loader2 class="size-6 animate-spin text-fg-subtle" />
            </div>
            <EmptyState
              v-else-if="resultsView === 'generating'"
              title="Generating thumbnail…"
              :description="generationMode === 'quick' ? 'Creating candidates' : 'Building plate + recipe'"
            >
              <template #icon>
                <IconTile :icon="Loader2" tone="brand" size="lg" class="mb-1 [&_svg]:animate-spin" />
              </template>
            </EmptyState>
            <EmptyState
              v-else-if="resultsView === 'empty'"
              :icon="ImagePlus"
              title="No results yet"
              description="Results appear here after you generate."
            />

            <!-- Quick -->
            <div v-else-if="resultsView === 'quick'" class="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
              <SectionHeader title="Candidates" description="Feed preview at ~200px">
                <Button
                  v-if="selectedCandidate"
                  variant="primary"
                  size="sm"
                  :disabled="isAccepting || isCompleted"
                  @click="handleAccept(selectedCandidateIndex)"
                >
                  <Check />
                  {{ isCompleted ? 'Accepted' : 'Accept & save to library' }}
                </Button>
              </SectionHeader>
              <div class="flex flex-wrap gap-3">
                <button
                  v-for="(c, i) in session.candidates"
                  :key="i"
                  type="button"
                  class="overflow-hidden rounded-lg border transition focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
                  :class="selectedCandidateIndex === i ? 'border-brand ring-1 ring-brand' : 'border-line hover:border-line-strong'"
                  :aria-pressed="selectedCandidateIndex === i"
                  @click="selectedCandidateIndex = i"
                >
                  <img :src="c.url" :alt="`Candidate ${i + 1}`" class="h-auto w-[200px] object-cover" />
                </button>
              </div>
              <div v-if="selectedCandidate">
                <p class="eyebrow mb-2">Full preview</p>
                <img
                  :key="selectedCandidate.url"
                  :src="selectedCandidate.url"
                  alt="Full preview"
                  class="max-h-[55vh] max-w-full animate-fade-in rounded-lg border border-line object-contain"
                />
              </div>
              <div v-if="session.composition?.mode === 'from_video' && !isCompleted">
                <Button variant="secondary" size="sm" :disabled="isGenerating" @click="handleContinueEditable">
                  Continue as editable
                </Button>
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
            <div v-else class="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
              <SectionHeader title="Plate + recipe layers">
                <Button v-if="editorProjectId" variant="secondary" size="sm" @click="openInEditor">
                  <ExternalLink /> Open in Image Editor
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  :disabled="isAccepting || isCompleted || !session.plate_url"
                  @click="handleAccept(0)"
                >
                  <Check />
                  {{ isCompleted ? 'Accepted' : 'Accept editable' }}
                </Button>
              </SectionHeader>

              <div v-if="editableFeedPreviewUrl || isBuildingFeedPreview">
                <p class="eyebrow mb-2">Feed preview (~200px) — postage-stamp test</p>
                <div class="inline-flex overflow-hidden rounded-lg border border-brand-line bg-surface-sunken">
                  <img
                    v-if="editableFeedPreviewUrl"
                    :src="editableFeedPreviewUrl"
                    alt="Editable feed preview"
                    class="h-auto w-[200px] object-cover"
                  />
                  <div v-else class="flex h-[112px] w-[200px] items-center justify-center gap-1 text-xs text-fg-subtle">
                    <Loader2 class="size-3 animate-spin" />
                    Composing…
                  </div>
                </div>
              </div>

              <div class="grid gap-5 lg:grid-cols-2">
                <div>
                  <p class="eyebrow mb-2">Background plate</p>
                  <img
                    v-if="session.plate_url"
                    :src="session.plate_url"
                    alt="Plate"
                    class="w-full max-w-xl rounded-lg border border-line object-contain"
                  />
                  <p v-else class="text-sm text-fg-subtle">No plate yet</p>
                </div>
                <div>
                  <p class="eyebrow mb-2">Text layers</p>
                  <ul
                    v-if="recipeTextLayers.length"
                    class="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle bg-surface"
                  >
                    <li v-for="(layer, i) in recipeTextLayers" :key="layerKey(layer, i)" class="px-3 py-2">
                      <p class="text-sm font-medium text-fg">{{ layerContent(layer) }}</p>
                      <p class="mt-0.5 text-xs text-fg-subtle">{{ layerMeta(layer) }}</p>
                    </li>
                  </ul>
                  <p v-else class="text-sm text-fg-subtle">No text layers in recipe</p>
                </div>
                <div v-if="recipeShapeLayers.length">
                  <p class="eyebrow mb-2">Shape layers</p>
                  <ul class="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle bg-surface">
                    <li v-for="(shape, i) in recipeShapeLayers" :key="String(shape.id ?? i)" class="px-3 py-2">
                      <p class="text-sm font-medium text-fg">{{ shapeLabel(shape) }}</p>
                      <p class="mt-0.5 text-xs text-fg-subtle">{{ shapeMeta(shape) }}</p>
                    </li>
                  </ul>
                </div>
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
          </div>
        </main>
      </div>
    </template>

    <ThumbnailVideoPicker v-model="showVideoPicker" @attach="handleVideoAttach" />
  </div>
</template>

<script setup lang="ts">
  import { useToast } from '@/composables/useToast';
  import { ref, computed, watch, onMounted } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import {
    ImagePlus,
    Loader2,
    Check,
    Upload,
    ClipboardPaste,
    ExternalLink,
    Film,
    Sparkles,
  } from 'lucide-vue-next';
  import CustomDropdown from '@/components/CustomDropdown.vue';
  import type { BadgeVariants } from '@/components/ui/badge';
  import { Button, buttonVariants } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { IconTile } from '@/components/ui/icon-tile';
  import { Input } from '@/components/ui/input';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl } from '@/components/ui/segmented-control';
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
  const variantCountOptions = [
    { value: 4, label: '4 variants' },
    { value: 8, label: '8 variants' },
    { value: 12, label: '12 variants' },
  ];

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

  const generationModeOptions = computed(() =>
    modeOptions.map((m) => ({
      value: m,
      label: m === 'editable' ? 'Editable' : 'Quick',
      disabled: isLoading.value || isGenerating.value,
    }))
  );

  /** Which results panel is showing; keys the panel so each switch eases in. */
  const resultsView = computed<'loading' | 'generating' | 'empty' | ThumbnailGenerationMode>(() => {
    if (isGenerating.value) return 'generating';
    const hasResults = isGenerated.value || isCompleted.value;
    // Spinner only before there is anything to show — reloads (post-gen tools, re-analyze) keep the results
    if (isLoading.value && !hasResults) return 'loading';
    if (!hasResults) return 'empty';
    return generationMode.value;
  });

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

  // This route renders outside DashboardLayout, so a link to another `?session=`
  // reuses this page instead of remounting it: load the new session.
  watch(
    () => route.query.session,
    (next, prev) => {
      if (next === prev || route.name !== 'ai-image-thumbnail') return;
      const id = Number(Array.isArray(next) ? next[0] : next);
      if (session.value && session.value.id === id) return;
      void openFromRoute();
    }
  );

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
    useToast().error('Generation failed', message);
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
      useToast().error('Export failed', 'Please try again.');
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
  function statusBadgeVariant(s: string): BadgeVariants['variant'] {
    if (s === 'completed' || s === 'generated') return 'success';
    if (s === 'generating' || s === 'refining') return 'warning';
    return 'neutral';
  }
</script>
