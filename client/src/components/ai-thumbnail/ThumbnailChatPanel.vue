<template>
  <div class="flex h-full min-h-0 flex-col">
    <div ref="messagesContainer" class="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4 py-3">
      <div v-if="attachedVideoName" class="mb-2 flex flex-wrap gap-1.5">
        <ChatChip
          :icon="Film"
          :label="attachedVideoName"
          :tag="(keyFrameCount ?? 0) > 0 ? `${keyFrameCount} frames` : undefined"
        />
      </div>

      <p v-if="!messages.length" class="px-3 py-4 text-center text-xs text-fg-subtle">
        Describe the thumbnail — hook, emotion, text placement, and what viewers should feel.
      </p>

      <template v-for="msg in chatMessages" :key="msg.id">
        <ChatMessage :message="msg" />
        <ThumbnailSummaryCard
          v-if="msg.role === 'assistant' && msg.metadata?.ready_to_generate === true && msg.metadata?.summary"
          :summary="msg.metadata.summary as ThumbnailBriefSummary"
        />
      </template>

      <ChatStatusCard
        v-if="isGenerating"
        class="mt-1"
        :title="generationMode === 'quick' ? 'Creating thumbnail candidates…' : 'Building plate + recipe…'"
      />

      <ChatTypingIndicator v-if="isSending || isRefining" />
    </div>

    <div class="flex shrink-0 flex-col gap-2 border-t border-line-subtle p-3">
      <RefinementBadge
        v-if="isRefinementMode"
        :round="refinementRound"
        :max-rounds="maxRefinementRounds"
        :messages-remaining="refinementMessagesRemaining"
      />

      <ChatNotice v-if="error" dismissible @dismiss="$emit('clear-error')">{{ error }}</ChatNotice>

      <Button
        v-if="readyToGenerate && (isDiscovery || isStuckGenerating)"
        variant="primary"
        block
        :disabled="isGenerating"
        @click="$emit('generate')"
      >
        <Sparkles />
        {{
          isStuckGenerating
            ? `Retry ${generationMode === 'quick' ? 'quick' : 'editable'} thumbnail · ${creditCost} credits`
            : `Generate ${generationMode === 'quick' ? 'quick' : 'editable'} thumbnail · ${creditCost} credits`
        }}
      </Button>

      <ChatComposer
        v-model="inputText"
        :placeholder="inputPlaceholder"
        :disabled="isGenerating || isCompleted"
        :can-send="!isSending && !isRefining"
        :sending="isSending || isRefining"
        @send="handleSend"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, nextTick, onMounted } from 'vue';
  import { Sparkles, Film } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import ChatChip from '@/components/create/chat/ChatChip.vue';
  import ChatComposer from '@/components/create/chat/ChatComposer.vue';
  import ChatNotice from '@/components/create/chat/ChatNotice.vue';
  import ChatStatusCard from '@/components/create/chat/ChatStatusCard.vue';
  import ChatTypingIndicator from '@/components/create/chat/ChatTypingIndicator.vue';
  import ChatMessage from '@/components/create/chat/ChatMessage.vue';
  import RefinementBadge from '@/components/create/chat/RefinementBadge.vue';
  import ThumbnailSummaryCard, { type ThumbnailBriefSummary } from './ThumbnailSummaryCard.vue';
  import type { ThumbnailGenerationMode, ThumbnailMessage } from '@/services/aiThumbnailApi';
  import type { AIChatMessage } from '@/types/ai-chat';

  const props = defineProps<{
    messages: ThumbnailMessage[];
    isSending: boolean;
    isGenerating: boolean;
    isRefining: boolean;
    isRefinementMode: boolean;
    isDiscovery: boolean;
    isStuckGenerating?: boolean;
    readyToGenerate: boolean;
    generationMode: ThumbnailGenerationMode;
    isCompleted: boolean;
    refinementRound: number;
    maxRefinementRounds: number;
    refinementMessagesRemaining: number;
    error: string | null;
    draftMessage: string;
    attachedVideoName?: string | null;
    keyFrameCount?: number;
    creditCost: number;
  }>();

  const emit = defineEmits<{
    send: [message: string];
    'update:draft-message': [message: string];
    'clear-error': [];
    generate: [];
  }>();

  const messagesContainer = ref<HTMLDivElement | null>(null);

  const inputText = computed({
    get: () => props.draftMessage ?? '',
    set: (value: string) => emit('update:draft-message', value),
  });

  const chatMessages = computed((): AIChatMessage[] =>
    props.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      metadata: (m.metadata as Record<string, unknown> | null) ?? null,
      inserted_at: m.inserted_at,
    }))
  );

  const inputPlaceholder = computed(() => {
    if (props.isGenerating) return 'Generating…';
    if (props.isRefinementMode) return 'Describe what to change…';
    return 'Describe your thumbnail or ask a question…';
  });

  function scrollToBottom() {
    nextTick(() => {
      const el = messagesContainer.value;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  function handleSend() {
    const text = inputText.value.trim();
    if (!text || props.isSending || props.isGenerating || props.isCompleted) return;
    emit('send', text);
    emit('update:draft-message', '');
  }

  watch(
    () => props.messages.length,
    () => scrollToBottom()
  );

  watch(
    () => props.isSending,
    (v) => {
      if (!v) scrollToBottom();
    }
  );

  onMounted(() => {
    scrollToBottom();
  });
</script>
