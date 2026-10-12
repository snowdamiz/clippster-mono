<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-panel">
    <AIImageCreatorHeader
      :title="projectTitle"
      mode="image"
      :can-export="Boolean(generatedImageUrl)"
      :busy="exportBusy"
      :status-label="statusLabel"
      :status-variant="statusVariant"
      @back="backToProjects"
      @rename="onRename"
      @change-mode="onChangeMode"
      @export="onExportAction"
    />

    <EmptyState
      v-if="bootError"
      :icon="AlertTriangle"
      tone="danger"
      title="Couldn't open this project"
      :description="bootError"
    >
      <Button variant="secondary" @click="backToProjects">Back to projects</Button>
    </EmptyState>

    <div v-else-if="isLoading && !session" class="flex flex-1 items-center justify-center">
      <Loader2 class="size-6 animate-spin text-fg-subtle" />
    </div>

    <div v-else class="flex min-h-0 flex-1 overflow-hidden">
      <!-- Chat rail -->
      <aside class="flex w-[clamp(300px,34vw,400px)] shrink-0 flex-col border-r border-line-subtle bg-surface">
        <div class="flex h-9 shrink-0 items-center gap-1.5 border-b border-line-subtle px-4 text-xs text-fg-muted">
          <Sparkles class="size-3.5 shrink-0 text-ai" />
          <span class="truncate">
            <template v-if="hasGeneratedImage">
              Revisions · {{ IMAGE_EDIT_CREDIT_COST }} credits each · chat is free
            </template>
            <template v-else>True image creation · {{ IMAGE_CREATION_CREDIT_COST }} credits</template>
          </span>
        </div>

        <div ref="messagesEl" class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-3">
          <ChatMessage v-for="message in chatMessages" :key="message.id" :message="message" />

          <ChatTypingIndicator v-if="isSending" label="Thinking…" />

          <ChatStatusCard
            v-if="isGeneratingPrompt"
            class="mt-1"
            :title="hasGeneratedImage ? 'Preparing edit' : 'Generating prompt'"
            :description="
              hasGeneratedImage
                ? 'Turning your feedback into a precise edit instruction…'
                : 'Locking in your production-ready image brief…'
            "
          />
          <ChatStatusCard
            v-else-if="isGenerating"
            class="mt-1"
            :title="hasGeneratedImage ? 'Improving image' : 'Creating image'"
            :description="
              hasGeneratedImage ? 'Editing from your current image…' : 'Usually takes 1–3 minutes at high quality…'
            "
          />
        </div>

        <div class="flex shrink-0 flex-col gap-2 border-t border-line-subtle p-3">
          <ChatNotice v-if="error">{{ error }}</ChatNotice>
          <ChatNotice v-if="exportMessage" tone="success" dismissible @dismiss="exportMessage = null">
            {{ exportMessage }}
          </ChatNotice>
          <Button
            v-if="readyToGenerate"
            variant="primary"
            block
            :disabled="isSending || isGeneratingPrompt || isGenerating"
            @click="onGenerate"
          >
            <Sparkles />
            {{
              session?.status === 'generating'
                ? `Retry create · ${IMAGE_CREATION_CREDIT_COST} credits`
                : `Create image · ${IMAGE_CREATION_CREDIT_COST} credits`
            }}
          </Button>
          <Button
            v-else-if="readyToEdit"
            variant="primary"
            block
            :disabled="isSending || isGeneratingPrompt || isGenerating"
            @click="onRevise"
          >
            <Sparkles />
            Apply changes · {{ IMAGE_EDIT_CREDIT_COST }} credits
          </Button>
          <ChatComposer
            ref="inputEl"
            v-model="draft"
            :placeholder="hasGeneratedImage ? 'Describe changes to this image…' : 'Describe the image you want…'"
            :disabled="isSending || isGeneratingPrompt || isGenerating"
            :sending="isSending"
            @send="send"
          />
        </div>
      </aside>

      <!-- Stage -->
      <main class="flex min-w-0 flex-1 flex-col items-center justify-center overflow-auto bg-surface-sunken p-6">
        <EmptyState
          v-if="isGeneratingPrompt"
          :icon="Sparkles"
          tone="brand"
          :title="hasGeneratedImage ? 'Preparing edit' : 'Generating prompt'"
          :description="
            hasGeneratedImage
              ? 'Locking in what to change and what to keep from your current image.'
              : 'Using your ready brief — no second rewrite — then generating variants.'
          "
        />
        <EmptyState
          v-else-if="isGenerating"
          :title="hasGeneratedImage ? 'Improving your image' : 'Creating your image'"
          :description="
            hasGeneratedImage
              ? 'Applying your revision to the existing image. This is usually faster than a fresh create.'
              : 'Creating several high-quality variants. This usually takes 1–3 minutes.'
          "
        >
          <template #icon>
            <IconTile :icon="Loader2" tone="brand" size="lg" class="mb-1 [&_svg]:animate-spin" />
          </template>
        </EmptyState>
        <div v-else-if="generatedImageUrl" class="flex size-full min-h-0 animate-enter flex-col items-center justify-center gap-4">
          <div class="flex min-h-0 w-full flex-1 items-center justify-center">
            <!-- Keyed so each new result / picked variant eases in -->
            <img
              :key="generatedImageUrl"
              :src="generatedImageUrl"
              alt="AI generated result"
              class="max-h-full max-w-full animate-fade-in rounded-xl border border-line object-contain"
              @error="onImageError"
            />
          </div>
          <div v-if="candidates.length > 1" class="flex max-w-full shrink-0 items-center gap-2 overflow-x-auto p-0.5">
            <button
              v-for="(candidate, index) in candidates"
              :key="candidate.id || index"
              type="button"
              class="shrink-0 overflow-hidden rounded-lg border transition focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
              :class="
                index === selectedCandidateIndex
                  ? 'border-brand ring-1 ring-brand'
                  : 'border-line opacity-70 hover:opacity-100'
              "
              :title="`Variant ${index + 1}`"
              :aria-pressed="index === selectedCandidateIndex"
              @click="onSelectCandidate(index)"
            >
              <img :src="candidate.url" :alt="`Variant ${index + 1}`" class="h-14 w-auto max-w-24 object-cover" />
            </button>
          </div>
          <p v-if="imageLoadError" class="shrink-0 text-center text-xs text-danger">
            Image finished generating but failed to load. Try Export → Save locally, or describe a revision.
          </p>
          <p v-else class="shrink-0 text-center text-xs text-fg-muted">
            {{
              candidates.length > 1
                ? 'Pick your favorite variant, then tell the assistant what to change.'
                : 'Tell the assistant what to change, then apply when ready.'
            }}
          </p>
        </div>
        <EmptyState
          v-else
          :icon="Images"
          title="Your image will appear here"
          description="Chat through the idea. When the prompt is ready, creation starts only after the detailed prompt is generated."
        />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { useToast } from '@/composables/useToast';
  import { computed, nextTick, onMounted, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { AlertTriangle, Images, Loader2, Sparkles } from 'lucide-vue-next';
  import AIImageCreatorHeader from '@/components/ai-image/AIImageCreatorHeader.vue';
  import type { AIImageExportAction } from '@/components/ai-image/AIImageCreatorHeader.vue';
  import ChatMessage from '@/components/ai-video/ChatMessage.vue';
  import ChatComposer from '@/components/create/chat/ChatComposer.vue';
  import ChatNotice from '@/components/create/chat/ChatNotice.vue';
  import ChatStatusCard from '@/components/create/chat/ChatStatusCard.vue';
  import ChatTypingIndicator from '@/components/create/chat/ChatTypingIndicator.vue';
  import { Button } from '@/components/ui/button';
  import type { BadgeVariants } from '@/components/ui/badge';
  import { EmptyState } from '@/components/ui/empty-state';
  import { IconTile } from '@/components/ui/icon-tile';
  import { useAIImageSession } from '@/composables/useAIImageSession';
  import type { AIChatMessage } from '@/types/ai-video';
  import {
    IMAGE_CREATION_CREDIT_COST,
    IMAGE_EDIT_CREDIT_COST,
  } from '@/utils/imageGenerationPolicy';
  import {
    createWorkableImageProject,
    exportImageToDisk,
    saveImageLocally,
    saveWorkableImageFile,
  } from '@/utils/aiImageExport';

  const route = useRoute();
  const router = useRouter();

  const {
    session,
    messages,
    isLoading,
    isSending,
    isGeneratingPrompt,
    isGenerating,
    error,
    readyToGenerate,
    readyToEdit,
    candidates,
    selectedCandidateIndex,
    generatedImageUrl,
    loadSession,
    renameSession,
    sendMessage,
    generate,
    revise,
    selectCandidate,
    closeSession,
  } = useAIImageSession();

  const bootError = ref<string | null>(null);
  const draft = ref('');
  const messagesEl = ref<HTMLElement | null>(null);
  const inputEl = ref<{ focus: () => void } | null>(null);
  const exportBusy = ref(false);
  const exportMessage = ref<string | null>(null);
  const imageLoadError = ref(false);

  const projectTitle = computed(() => session.value?.name || 'Untitled Image');
  const hasGeneratedImage = computed(
    () => Boolean(generatedImageUrl.value) || session.value?.status === 'generated'
  );
  const statusLabel = computed(() => formatStatus(session.value?.status || ''));
  const statusVariant = computed<BadgeVariants['variant']>(() => {
    const status = session.value?.status;
    if (status === 'generated' || status === 'completed') return 'success';
    if (status === 'generating') return 'warning';
    return 'neutral';
  });

  const chatMessages = computed<AIChatMessage[]>(() =>
    messages.value.map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      metadata: message.metadata ?? null,
      inserted_at: message.inserted_at,
    }))
  );

  onMounted(() => void boot());

  watch(
    () => generatedImageUrl.value,
    () => {
      imageLoadError.value = false;
    }
  );

  watch(
    () => [messages.value.length, isSending.value, isGeneratingPrompt.value, isGenerating.value],
    () =>
      nextTick(() => {
        const element = messagesEl.value;
        if (element) element.scrollTo({ top: element.scrollHeight });
      })
  );

  async function boot() {
    bootError.value = null;
    const raw = route.query.session;
    const sessionId = Number(Array.isArray(raw) ? raw[0] : raw);
    if (!Number.isFinite(sessionId) || sessionId <= 0) {
      await router.replace('/ai-image');
      return;
    }
    try {
      await loadSession(sessionId);
    } catch (cause) {
      console.error('[AIImageCreatorSession] boot failed:', cause);
      bootError.value = 'Failed to load image project.';
    }
  }

  function backToProjects() {
    closeSession();
    void router.push('/ai-image');
  }

  async function onRename(name: string) {
    if (!session.value) return;
    try {
      await renameSession(session.value.id, name);
    } catch (cause) {
      console.error('[AIImageCreatorSession] rename failed:', cause);
    }
  }

  function onChangeMode(mode: 'image' | 'thumbnail') {
    if (mode === 'image') return;
    void router.push('/ai-image');
  }

  async function send() {
    const message = draft.value.trim();
    if (!message) return;
    draft.value = '';
    const result = await sendMessage(message);
    if (!result) draft.value = message;
    await nextTick();
    inputEl.value?.focus();
  }

  async function onGenerate() {
    await generate();
  }

  async function onRevise() {
    await revise();
  }

  async function onSelectCandidate(index: number) {
    if (index === selectedCandidateIndex.value) return;
    await selectCandidate(index);
  }

  async function onExportAction(action: AIImageExportAction) {
    if (!generatedImageUrl.value || !session.value) return;
    exportBusy.value = true;
    exportMessage.value = null;
    try {
      const name = session.value.name || 'AI Image';
      const width = session.value.canvas_width || 1024;
      const height = session.value.canvas_height || 1024;

      if (action === 'export') {
        await exportImageToDisk({ imageUrl: generatedImageUrl.value, name });
        exportMessage.value = 'Image exported.';
      } else if (action === 'save-local') {
        await saveImageLocally({
          imageUrl: generatedImageUrl.value,
          name,
          canvasWidth: width,
          canvasHeight: height,
        });
        exportMessage.value = 'Saved to your Image library.';
      } else if (action === 'save-workable') {
        const result = await saveWorkableImageFile({
          imageUrl: generatedImageUrl.value,
          name,
          canvasWidth: width,
          canvasHeight: height,
        });
        exportMessage.value = result.filePath
          ? 'Workable file saved. You can reopen it in Image Editor.'
          : 'Editable project saved. Open it from Image Editor anytime.';
      } else if (action === 'open-editor') {
        const result = await createWorkableImageProject({
          imageUrl: generatedImageUrl.value,
          name,
          canvasWidth: width,
          canvasHeight: height,
        });
        await router.push({
          path: '/design-studio/edit',
          query: { projectId: String(result.backendProjectId) },
        });
      }
    } catch (cause) {
      console.error('[AIImageCreatorSession] export failed:', cause);
      exportMessage.value = null;
      useToast().error('Export failed', 'Please try again.');
    } finally {
      exportBusy.value = false;
    }
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

  function onImageError() {
    imageLoadError.value = true;
  }
</script>
