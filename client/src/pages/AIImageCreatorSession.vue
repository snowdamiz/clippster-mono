<template>
  <div class="flex h-full w-full flex-col overflow-hidden bg-[#0e0e10]">
    <AIImageCreatorHeader
      :title="projectTitle"
      mode="image"
      :can-export="Boolean(generatedImageUrl)"
      :busy="exportBusy"
      :status-label="statusLabel"
      :status-class="statusClass"
      @back="backToProjects"
      @rename="onRename"
      @change-mode="onChangeMode"
      @export="onExportAction"
    />

    <div v-if="bootError" class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p class="text-sm text-red-300">{{ bootError }}</p>
      <button type="button" class="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white" @click="backToProjects">
        Back to projects
      </button>
    </div>

    <div v-else-if="isLoading && !session" class="flex flex-1 items-center justify-center">
      <Loader2 :size="36" class="animate-spin text-zinc-500" />
    </div>

    <div v-else class="flex min-h-0 flex-1 overflow-hidden">
      <aside class="flex w-[380px] shrink-0 flex-col border-r border-white/10 bg-[#121214]">
        <div class="border-b border-white/10 px-4 py-3">
          <p class="text-[11px] text-zinc-500">
            <template v-if="hasGeneratedImage">
              Revisions · {{ IMAGE_EDIT_CREDIT_COST }} credits each · chat is free
            </template>
            <template v-else> True image creation · {{ IMAGE_CREATION_CREDIT_COST }} credits </template>
          </p>
        </div>

        <div ref="messagesEl" class="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <ChatMessage v-for="message in chatMessages" :key="message.id" :message="message" />

          <div
            v-if="isSending"
            class="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] p-3"
          >
            <Loader2 :size="16" class="animate-spin text-zinc-400" />
            <p class="text-xs text-zinc-400">Assistant is thinking…</p>
          </div>

          <div
            v-if="isGeneratingPrompt"
            class="flex items-center gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3"
          >
            <Loader2 :size="18" class="animate-spin text-sky-400" />
            <div>
              <p class="text-sm font-semibold text-zinc-100">
                {{ hasGeneratedImage ? 'Preparing edit' : 'Generating prompt' }}
              </p>
              <p class="text-xs text-zinc-500">
                {{
                  hasGeneratedImage
                    ? 'Turning your feedback into a precise edit instruction…'
                    : 'Locking in your production-ready image brief…'
                }}
              </p>
            </div>
          </div>

          <div
            v-else-if="isGenerating"
            class="flex items-center gap-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3"
          >
            <Loader2 :size="18" class="animate-spin text-sky-400" />
            <div>
              <p class="text-sm font-semibold text-zinc-100">
                {{ hasGeneratedImage ? 'Improving image' : 'Creating image' }}
              </p>
              <p class="text-xs text-zinc-500">
                {{
                  hasGeneratedImage
                    ? 'Editing from your current image…'
                    : 'Usually takes 1–3 minutes at high quality…'
                }}
              </p>
            </div>
          </div>
        </div>

        <div class="shrink-0 space-y-2 border-t border-white/10 p-3">
          <div v-if="error" class="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {{ error }}
          </div>
          <div v-if="exportMessage" class="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            {{ exportMessage }}
          </div>
          <button
            v-if="readyToGenerate"
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--sidebar-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90"
            :disabled="isSending || isGeneratingPrompt || isGenerating"
            @click="onGenerate"
          >
            <Sparkles :size="16" />
            {{
              session?.status === 'generating'
                ? `Retry Create · ${IMAGE_CREATION_CREDIT_COST} credits`
                : `Create Image · ${IMAGE_CREATION_CREDIT_COST} credits`
            }}
          </button>
          <button
            v-else-if="readyToEdit"
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-lg bg-[var(--sidebar-accent)] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 hover:opacity-90"
            :disabled="isSending || isGeneratingPrompt || isGenerating"
            @click="onRevise"
          >
            <Sparkles :size="16" />
            Apply changes · {{ IMAGE_EDIT_CREDIT_COST }} credits
          </button>
          <div class="flex items-end gap-2">
            <textarea
              ref="inputEl"
              v-model="draft"
              rows="1"
              class="min-h-10 flex-1 resize-none rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-sky-500"
              :placeholder="
                hasGeneratedImage
                  ? 'Describe changes to this image…'
                  : 'Describe the image you want…'
              "
              :disabled="isSending || isGeneratingPrompt || isGenerating"
              @keydown.enter.exact.prevent="send"
            />
            <button
              type="button"
              class="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white disabled:opacity-40"
              :disabled="!draft.trim() || isSending || isGeneratingPrompt || isGenerating"
              @click="send"
            >
              <Loader2 v-if="isSending" :size="16" class="animate-spin" />
              <Send v-else :size="16" />
            </button>
          </div>
        </div>
      </aside>

      <main class="flex min-w-0 flex-1 flex-col items-center justify-center overflow-auto p-8">
        <div v-if="isGeneratingPrompt" class="flex flex-col items-center gap-3 text-center">
          <Sparkles :size="44" class="animate-pulse text-sky-400" />
          <h2 class="text-xl font-semibold text-zinc-100">
            {{ hasGeneratedImage ? 'Preparing edit' : 'Generating prompt' }}
          </h2>
          <p class="max-w-md text-sm text-zinc-500">
            {{
              hasGeneratedImage
                ? 'Locking in what to change and what to keep from your current image.'
                : 'Using your ready brief — no second rewrite — then generating variants.'
            }}
          </p>
        </div>
        <div v-else-if="isGenerating" class="flex flex-col items-center gap-3 text-center">
          <Loader2 :size="44" class="animate-spin text-sky-400" />
          <h2 class="text-xl font-semibold text-zinc-100">
            {{ hasGeneratedImage ? 'Improving your image' : 'Creating your image' }}
          </h2>
          <p class="max-w-md text-sm text-zinc-500">
            {{
              hasGeneratedImage
                ? 'Applying your revision to the existing image. This is usually faster than a fresh create.'
                  : 'Creating several high-quality variants. This usually takes 1–3 minutes.'
            }}
          </p>
        </div>
        <div v-else-if="generatedImageUrl" class="flex size-full flex-col items-center justify-center gap-4">
          <img
            :src="generatedImageUrl"
            alt="AI generated result"
            class="max-h-[70vh] max-w-full rounded-xl border border-white/10 object-contain shadow-2xl"
            @error="onImageError"
          />
          <div
            v-if="candidates.length > 1"
            class="flex max-w-full items-center gap-2 overflow-x-auto px-2"
          >
            <button
              v-for="(candidate, index) in candidates"
              :key="candidate.id || index"
              type="button"
              class="shrink-0 overflow-hidden rounded-lg border-2 transition"
              :class="
                index === selectedCandidateIndex
                  ? 'border-[var(--sidebar-accent)]'
                  : 'border-white/10 opacity-70 hover:opacity-100'
              "
              :title="`Variant ${index + 1}`"
              @click="onSelectCandidate(index)"
            >
              <img
                :src="candidate.url"
                :alt="`Variant ${index + 1}`"
                class="h-16 w-16 object-cover"
              />
            </button>
          </div>
          <p v-if="imageLoadError" class="text-sm text-red-300">
            Image finished generating but failed to load. Try Export → Save locally, or describe a revision.
          </p>
          <p v-else class="text-sm text-zinc-500">
            {{
              candidates.length > 1
                ? 'Pick your favorite variant, then tell the assistant what to change.'
                : 'Tell the assistant what to change, then apply when ready.'
            }}
          </p>
        </div>
        <div v-else class="flex flex-col items-center gap-3 text-center">
          <Images :size="56" class="text-zinc-700" />
          <h2 class="text-lg font-semibold text-zinc-300">Your image will appear here</h2>
          <p class="max-w-md text-sm text-zinc-600">
            Chat through the idea. When the prompt is ready, creation starts only after the detailed prompt is generated.
          </p>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, nextTick, onMounted, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { Images, Loader2, Send, Sparkles } from 'lucide-vue-next';
  import AIImageCreatorHeader from '@/components/ai-image/AIImageCreatorHeader.vue';
  import type { AIImageExportAction } from '@/components/ai-image/AIImageCreatorHeader.vue';
  import ChatMessage from '@/components/ai-video/ChatMessage.vue';
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
  const inputEl = ref<HTMLTextAreaElement | null>(null);
  const exportBusy = ref(false);
  const exportMessage = ref<string | null>(null);
  const imageLoadError = ref(false);

  const projectTitle = computed(() => session.value?.name || 'Untitled Image');
  const hasGeneratedImage = computed(
    () => Boolean(generatedImageUrl.value) || session.value?.status === 'generated'
  );
  const statusLabel = computed(() => formatStatus(session.value?.status || ''));
  const statusClass = computed(() => {
    const status = session.value?.status;
    if (status === 'generated' || status === 'completed') return 'bg-emerald-500/20 text-emerald-300';
    if (status === 'generating') return 'bg-amber-500/20 text-amber-300';
    return 'bg-zinc-500/30 text-zinc-300';
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
      alert('Export failed. Please try again.');
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
