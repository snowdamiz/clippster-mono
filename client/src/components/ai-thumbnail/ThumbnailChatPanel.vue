<template>
  <div class="chat-panel">
    <div ref="messagesContainer" class="chat-panel__messages custom-scrollbar">
      <div v-if="attachedVideoName" class="chat-panel__media-strip custom-scrollbar">
        <div class="media-pill">
          <Film :size="12" />
          <span class="media-pill__name" :title="attachedVideoName">{{ attachedVideoName }}</span>
          <span v-if="(keyFrameCount ?? 0) > 0" class="media-pill__tag">{{ keyFrameCount }} frames</span>
        </div>
      </div>

      <div v-if="!messages.length" class="chat-panel__empty">
        Describe the thumbnail — hook, emotion, text placement, and what viewers should feel.
      </div>

      <template v-for="msg in chatMessages" :key="msg.id">
        <ChatMessage :message="msg" />
        <ThumbnailSummaryCard
          v-if="
            msg.role === 'assistant' &&
            msg.metadata?.ready_to_generate === true &&
            msg.metadata?.summary
          "
          :summary="(msg.metadata.summary as ThumbnailBriefSummary)"
        />
      </template>

      <div v-if="isGenerating" class="chat-panel__generating">
        <div class="gen-pulse" />
        <span>
          {{ generationMode === 'quick' ? 'Creating thumbnail candidates…' : 'Building plate + recipe…' }}
        </span>
      </div>

      <div v-if="isSending || isRefining" class="chat-panel__typing">
        <div class="typing-avatar"><Sparkles :size="14" /></div>
        <div class="typing-dots">
          <span /><span /><span />
        </div>
      </div>
    </div>

    <RefinementBadge
      v-if="isRefinementMode"
      :round="refinementRound"
      :max-rounds="maxRefinementRounds"
      :messages-remaining="refinementMessagesRemaining"
    />

    <div v-if="error" class="chat-panel__error">
      <AlertCircle :size="14" />
      <span>{{ error }}</span>
      <button type="button" class="chat-panel__error-close" @click="$emit('clear-error')">
        <X :size="12" />
      </button>
    </div>

    <button
      v-if="readyToGenerate && isDiscovery"
      type="button"
      class="chat-panel__generate"
      :disabled="isGenerating"
      @click="$emit('generate')"
    >
      <Sparkles :size="16" />
      Generate {{ generationMode === 'quick' ? 'Quick' : 'Editable' }} Thumbnail
    </button>

    <div class="chat-panel__input">
      <textarea
        ref="inputEl"
        v-model="inputText"
        :placeholder="inputPlaceholder"
        class="chat-input"
        rows="1"
        :disabled="isGenerating || isCompleted"
        @keydown.enter.exact.prevent="handleSend"
        @input="autoResize"
      />
      <button
        type="button"
        class="chat-send-btn"
        :disabled="!inputText.trim() || isSending || isRefining || isGenerating || isCompleted"
        @click="handleSend"
      >
        <Send :size="16" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import {
  Sparkles,
  Send,
  AlertCircle,
  X,
  Film,
} from 'lucide-vue-next';
import ChatMessage from '@/components/ai-video/ChatMessage.vue';
import RefinementBadge from '@/components/ai-video/RefinementBadge.vue';
import ThumbnailSummaryCard, { type ThumbnailBriefSummary } from './ThumbnailSummaryCard.vue';
import type { ThumbnailGenerationMode, ThumbnailMessage } from '@/services/aiThumbnailApi';
import type { AIChatMessage } from '@/types/ai-video';

const props = defineProps<{
  messages: ThumbnailMessage[];
  isSending: boolean;
  isGenerating: boolean;
  isRefining: boolean;
  isRefinementMode: boolean;
  isDiscovery: boolean;
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
}>();

const emit = defineEmits<{
  send: [message: string];
  'update:draft-message': [message: string];
  'clear-error': [];
  generate: [];
}>();

const messagesContainer = ref<HTMLDivElement | null>(null);
const inputEl = ref<HTMLTextAreaElement | null>(null);

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
  })),
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

function autoResize() {
  const el = inputEl.value;
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
}

function handleSend() {
  const text = inputText.value.trim();
  if (!text || props.isSending || props.isGenerating || props.isCompleted) return;
  emit('send', text);
  emit('update:draft-message', '');
  nextTick(autoResize);
}

watch(
  () => props.messages.length,
  () => scrollToBottom(),
);

watch(
  () => props.isSending,
  (v) => {
    if (!v) scrollToBottom();
  },
);

onMounted(() => {
  scrollToBottom();
  autoResize();
});
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 0.5rem;
  padding: 0.75rem;
}

.chat-panel__messages {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
}

.chat-panel__empty {
  border: 1px dashed rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
  text-align: center;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.45);
}

.chat-panel__media-strip {
  display: flex;
  gap: 0.35rem;
  padding-bottom: 0.5rem;
  overflow-x: auto;
}

.media-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.5rem;
  border-radius: 999px;
  border: 1px solid rgba(168, 85, 247, 0.35);
  background: rgba(168, 85, 247, 0.1);
  color: rgba(255, 255, 255, 0.85);
  font-size: 0.65rem;
  flex-shrink: 0;
}

.media-pill__name {
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-weight: 600;
}

.media-pill__tag {
  padding: 0.04rem 0.35rem;
  border-radius: 999px;
  background: rgba(168, 85, 247, 0.25);
  font-size: 0.6rem;
}

.chat-panel__generating {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
}

.gen-pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #a855f7;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.4;
    transform: scale(0.9);
  }
  50% {
    opacity: 1;
    transform: scale(1.1);
  }
}

.chat-panel__typing {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.typing-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(168, 85, 247, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #c084fc;
}

.typing-dots {
  display: flex;
  gap: 4px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.35);
  animation: bounce 1.2s infinite;
}

.typing-dots span:nth-child(2) {
  animation-delay: 0.15s;
}
.typing-dots span:nth-child(3) {
  animation-delay: 0.3s;
}

@keyframes bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-4px);
  }
}

.chat-panel__error {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.25);
  font-size: 12px;
  color: #fca5a5;
}

.chat-panel__error-close {
  margin-left: auto;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
}

.chat-panel__generate {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.65rem 1rem;
  border-radius: 8px;
  border: 0;
  background: linear-gradient(135deg, #7c3aed, #a855f7);
  color: white;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.chat-panel__generate:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.chat-panel__input {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
  padding-top: 0.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.chat-input {
  flex: 1;
  min-height: 36px;
  max-height: 120px;
  resize: none;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.9);
  font-size: 13px;
  padding: 8px 10px;
  outline: none;
}

.chat-input:focus {
  border-color: rgba(168, 85, 247, 0.5);
}

.chat-send-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: 0;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.85);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.chat-send-btn:hover:not(:disabled) {
  background: #7c3aed;
}

.chat-send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
