<template>
  <div class="flex h-full min-h-0 flex-col">
    <div ref="messagesContainer" class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-3">
      <!-- Attached source media -->
      <div v-if="mediaItems.length > 0" class="mb-2 flex animate-fade-in flex-wrap gap-1.5">
        <ChatChip
          v-for="item in mediaItems"
          :key="item.id"
          :icon="getMediaIcon(item.type)"
          :label="item.name"
          :tag="item.intendedParts?.length ? item.intendedParts[0] : 'AI will tag'"
          :tag-muted="!item.intendedParts?.length"
          removable
          @remove="$emit('remove-media', item.id)"
        >
          <Loader2
            v-if="transcriptGenerationStatus.has(item.id)"
            class="animate-spin text-fg-subtle"
            aria-label="Generating transcript"
          />
        </ChatChip>
      </div>

      <template v-for="msg in messages" :key="msg.id">
        <ChatMessage :message="msg" />
        <ChatSummaryCard
          v-if="msg.role === 'assistant' && msg.metadata?.summary && msg.metadata?.ready_to_generate"
          :summary="msg.metadata.summary"
        />

        <!-- Assistant asks for media -->
        <div
          v-if="msg.role === 'assistant' && requestFor(msg.id)"
          class="my-1 ml-8 animate-enter rounded-xl border border-line-subtle bg-surface px-3 py-2.5"
        >
          <div class="flex items-center gap-1.5 text-xs font-semibold text-fg">
            <Upload class="size-3.5 text-fg-muted" />
            <span>{{ requestFor(msg.id)?.required ? 'Media required' : 'Media request' }}</span>
          </div>
          <p class="mt-1 text-xs text-fg-muted">{{ requestFor(msg.id)?.prompt }}</p>
          <div v-if="(requestFor(msg.id)?.parts || []).length > 0" class="mt-2 flex flex-wrap gap-1">
            <Badge v-for="part in requestFor(msg.id)?.parts || []" :key="`req-${msg.id}-${part}`">{{ part }}</Badge>
          </div>
          <div class="mt-2.5 flex flex-wrap gap-1.5">
            <Button variant="secondary" size="xs" @click="$emit('upload-media')"><Upload /> Upload media</Button>
            <Button variant="ghost" size="xs" @click="$emit('open-clip-picker')"><Video /> Clips</Button>
            <Button variant="ghost" size="xs" @click="$emit('open-asset-picker')"><ImageIcon /> Assets</Button>
          </div>
        </div>
      </template>

      <!-- Generation progress -->
      <ChatStatusCard v-if="isGenerating" :title="generationTitle" class="mt-1">
        <div class="mt-2 h-1 overflow-hidden rounded-full bg-surface-active">
          <div class="h-full rounded-full bg-brand transition-[width] duration-300" :style="{ width: generationProgress + '%' }" />
        </div>
        <ul v-if="generationPhase !== 'planning' && scenes.length > 0" class="mt-2 flex flex-col gap-1">
          <li v-for="scene in scenes" :key="scene.index" class="flex min-w-0 items-center gap-1.5 text-xs">
            <Loader2 v-if="scene.status === 'generating'" class="size-3 shrink-0 animate-spin text-brand" />
            <Check v-else-if="scene.status === 'complete'" class="size-3 shrink-0 text-success" />
            <AlertCircle v-else-if="scene.status === 'error'" class="size-3 shrink-0 text-danger" />
            <span v-else class="mx-[3px] size-1.5 shrink-0 rounded-full bg-fg-disabled" />
            <span class="shrink-0 font-medium" :class="scene.status === 'pending' ? 'text-fg-subtle' : 'text-fg'">
              Scene {{ scene.index + 1 }}
            </span>
            <span class="min-w-0 truncate text-fg-subtle">{{ scene.description }}</span>
          </li>
        </ul>
      </ChatStatusCard>

      <ChatTypingIndicator v-if="isSending" />
    </div>

    <div class="flex shrink-0 flex-col gap-2 border-t border-line-subtle p-3">
      <ReferenceAnalysisCard
        v-if="referenceAnalysis || isAnalyzingReference || referenceError"
        :analysis="referenceAnalysis"
        :is-analyzing="isAnalyzingReference"
        :progress="referenceProgress"
        :error="referenceError"
        @remove="$emit('remove-reference')"
        @cancel="$emit('cancel-reference')"
        @replace="openReferenceDialog"
        @retry="$emit('retry-reference')"
      />

      <!-- Style packs open above the composer — the option tiles are the only frames -->
      <div v-if="showStylePacks" class="animate-enter">
        <div class="mb-1.5 flex items-center justify-between gap-2">
          <span class="eyebrow">Generation style pack</span>
          <Button
            variant="ghost"
            size="icon-xs"
            title="Close"
            aria-label="Close style packs"
            @click="showStylePacks = false"
          >
            <X />
          </Button>
        </div>
        <StylePresetSelector :model-value="stylePackId" @update:model-value="$emit('select-style-pack', $event)" />
      </div>

      <RefinementBadge
        v-if="isRefinementMode"
        :round="refinementRound"
        :max-rounds="maxRefinementRounds"
        :messages-remaining="refinementMessagesRemaining"
      />

      <ChatNotice v-if="error" dismissible @dismiss="$emit('clear-error')">{{ error }}</ChatNotice>

      <ChatComposer
        v-model="inputText"
        :placeholder="inputPlaceholder"
        :disabled="isGenerating"
        :can-send="!isSending"
        :sending="isSending"
        @send="handleSend"
      >
        <template #tools>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                class="relative"
                title="Add source media"
                aria-label="Add source media"
                :disabled="isGenerating"
              >
                <Paperclip />
                <span
                  v-if="mediaItems.length > 0"
                  class="tabular absolute -right-0.5 -top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-brand px-[3px] text-[9px] font-semibold leading-none text-brand-fg"
                >
                  {{ mediaItems.length > 99 ? '99+' : mediaItems.length }}
                </span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" class="w-52">
              <DropdownMenuItem @click="handleMediaMenuAction('upload')"><Upload /> Upload source media</DropdownMenuItem>
              <DropdownMenuItem @click="handleMediaMenuAction('clips')"><Video /> Select source clips</DropdownMenuItem>
              <DropdownMenuItem @click="handleMediaMenuAction('assets')"><ImageIcon /> Select source assets</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Add reference video"
            aria-label="Add reference video"
            :disabled="isGenerating || isAnalyzingReference"
            @click="openReferenceDialog"
          >
            <LinkIcon />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Choose style pack"
            aria-label="Choose style pack"
            :class="showStylePacks && 'bg-surface-active text-fg'"
            :aria-pressed="showStylePacks"
            :disabled="isGenerating"
            @click="showStylePacks = !showStylePacks"
          >
            <Palette />
          </Button>
        </template>
      </ChatComposer>
    </div>

    <Modal
      :open="showReferenceDialog"
      title="Reference video"
      description="Learn pacing, captions, motion, transitions, grade and layout from one video for 2 credits. Your source media stays separate."
      :icon="LinkIcon"
      size="md"
      @close="showReferenceDialog = false"
    >
      <Field label="Video URL">
        <Input
          v-model="refUrl"
          type="url"
          placeholder="YouTube, TikTok, Vimeo, Rumble, or direct video URL"
          @keydown.enter.prevent="handleAnalyzeReference"
        />
      </Field>
      <template #footer>
        <Button variant="secondary" class="mr-auto" @click="handleUploadReference"><Upload /> Choose video</Button>
        <Button variant="ghost" @click="showReferenceDialog = false">Cancel</Button>
        <Button
          variant="primary"
          :disabled="!refUrl.trim() || isAnalyzingReference"
          :loading="isAnalyzingReference"
          @click="handleAnalyzeReference"
        >
          <Search v-if="!isAnalyzingReference" />
          Analyze
        </Button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, nextTick, watch, onMounted } from 'vue';
  import {
    Loader2,
    Check,
    AlertCircle,
    X,
    Link as LinkIcon,
    Search,
    Upload,
    Paperclip,
    Video,
    Music,
    Image as ImageIcon,
    Palette,
  } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import ChatChip from '@/components/create/chat/ChatChip.vue';
  import ChatComposer from '@/components/create/chat/ChatComposer.vue';
  import ChatNotice from '@/components/create/chat/ChatNotice.vue';
  import ChatStatusCard from '@/components/create/chat/ChatStatusCard.vue';
  import ChatTypingIndicator from '@/components/create/chat/ChatTypingIndicator.vue';
  import ChatMessage from './ChatMessage.vue';
  import ChatSummaryCard from './ChatSummaryCard.vue';
  import RefinementBadge from './RefinementBadge.vue';
  import ReferenceAnalysisCard from './ReferenceAnalysisCard.vue';
  import StylePresetSelector from './StylePresetSelector.vue';
  import type {
    AIChatMessage,
    AIVideoMediaItem,
    ReferenceAnalysisProgress,
    ReferenceEditRecipe,
    StylePackId,
  } from '@/types/ai-video';

  type MediaType = 'video' | 'audio' | 'image';

  interface AssistantMediaRequest {
    prompt: string;
    required: boolean;
    parts: string[];
    acceptedTypes: MediaType[];
  }

  const props = defineProps<{
    messages: AIChatMessage[];
    isSending: boolean;
    isGenerating: boolean;
    isRefinementMode: boolean;
    refinementRound: number;
    maxRefinementRounds: number;
    refinementMessagesRemaining: number;
    error: string | null;
    generationPhase: string;
    scenes: Array<{ index: number; description: string; status: string }>;
    completedScenes: number;
    referenceAnalysis: ReferenceEditRecipe | null;
    isAnalyzingReference: boolean;
    referenceProgress: ReferenceAnalysisProgress | null;
    referenceError: string | null;
    stylePackId: StylePackId | null;
    draftMessage: string;
    mediaItems: AIVideoMediaItem[];
    transcriptGenerationStatus: Map<string, { status: 'generating' | 'complete' | 'error'; progress?: string }>;
  }>();

  const emit = defineEmits<{
    send: [message: string];
    'update:draft-message': [message: string];
    'clear-error': [];
    'analyze-reference': [url: string];
    'upload-reference': [];
    'remove-reference': [];
    'cancel-reference': [];
    'retry-reference': [];
    'select-style-pack': [id: StylePackId];
    'upload-media': [];
    'open-clip-picker': [];
    'open-asset-picker': [];
    'remove-media': [mediaId: string];
  }>();

  const messagesContainer = ref<HTMLDivElement | null>(null);
  const showReferenceDialog = ref(false);
  const showStylePacks = ref(false);
  const refUrl = ref('');

  const inputText = computed({
    get: () => props.draftMessage ?? '',
    set: (value: string) => emit('update:draft-message', value),
  });

  const generationProgress = computed(() => {
    if (props.scenes.length === 0) return 0;
    return Math.round((props.completedScenes / props.scenes.length) * 100);
  });

  const generationTitle = computed(() => {
    if (props.generationPhase === 'planning') return 'Planning scenes…';
    if (props.scenes.length > 0) return `Generating scenes · ${props.completedScenes}/${props.scenes.length}`;
    return 'Generating…';
  });

  const inputPlaceholder = computed(() => {
    if (props.isGenerating) return 'Generating…';
    if (props.isRefinementMode) return 'Describe what to change…';
    return 'Describe your video or ask a question…';
  });

  const assistantMediaRequests = computed(() => {
    const map = new Map<number, AssistantMediaRequest>();

    for (const msg of props.messages) {
      if (msg.role !== 'assistant') continue;
      const request = parseMediaRequest(msg.metadata);
      if (request) {
        map.set(msg.id, request);
      }
    }

    return map;
  });

  function requestFor(messageId: number): AssistantMediaRequest | null {
    return assistantMediaRequests.value.get(messageId) || null;
  }

  function normalizePart(value: string): string {
    const trimmed = value.trim().replace(/\s+/g, ' ');
    return trimmed;
  }

  function parseMediaRequest(metadata: Record<string, any> | null | undefined): AssistantMediaRequest | null {
    if (!metadata || typeof metadata !== 'object') return null;

    const raw = metadata.media_request;
    if (!raw || typeof raw !== 'object') return null;

    const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
    const required = raw.required === true;
    const parts = Array.isArray(raw.parts)
      ? raw.parts
          .filter((value: unknown): value is string => typeof value === 'string')
          .map((part: string) => normalizePart(part))
          .filter((part: string) => part.length > 0)
      : [];

    const acceptedTypes = Array.isArray(raw.accepted_types)
      ? raw.accepted_types.filter(
          (value: unknown): value is MediaType => value === 'video' || value === 'audio' || value === 'image'
        )
      : [];

    if (!prompt && !required && parts.length === 0 && acceptedTypes.length === 0) return null;

    return {
      prompt: prompt || 'Please upload media so I can continue the project plan.',
      required,
      parts,
      acceptedTypes,
    };
  }

  function getMediaIcon(type: MediaType) {
    if (type === 'audio') return Music;
    if (type === 'image') return ImageIcon;
    return Video;
  }

  function handleSend() {
    const text = inputText.value.trim();
    if (!text || props.isSending || props.isGenerating) return;
    emit('send', text);
    inputText.value = '';
  }

  function handleAnalyzeReference() {
    const url = refUrl.value.trim();
    if (!url) return;
    emit('analyze-reference', url);
    showReferenceDialog.value = false;
    refUrl.value = '';
  }

  function handleUploadReference() {
    showReferenceDialog.value = false;
    emit('upload-reference');
  }

  function openReferenceDialog() {
    if (props.isGenerating || props.isAnalyzingReference) return;
    showReferenceDialog.value = true;
  }

  function handleMediaMenuAction(action: 'upload' | 'clips' | 'assets') {
    if (action === 'upload') {
      emit('upload-media');
      return;
    }
    if (action === 'clips') {
      emit('open-clip-picker');
      return;
    }
    emit('open-asset-picker');
  }

  function scrollToBottom() {
    nextTick(() => {
      const container = messagesContainer.value;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    });
  }

  watch(() => props.messages.length, scrollToBottom);
  watch(() => props.isSending, scrollToBottom);
  watch(() => props.completedScenes, scrollToBottom);
  onMounted(() => {
    scrollToBottom();
  });
</script>
