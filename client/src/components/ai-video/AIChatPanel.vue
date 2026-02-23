<template>
  <div class="chat-panel">
    <div ref="messagesContainer" class="chat-panel__messages custom-scrollbar">
      <div v-if="mediaItems.length > 0" class="chat-panel__media-strip custom-scrollbar">
        <div v-for="item in mediaItems" :key="item.id" class="media-pill">
          <component :is="getMediaIcon(item.type)" :size="12" />
          <span class="media-pill__name" :title="item.name">{{ item.name }}</span>
          <span v-if="item.intendedParts?.length" class="media-pill__tag">{{ item.intendedParts[0] }}</span>
          <span v-else class="media-pill__tag media-pill__tag--pending">AI will tag</span>
          <span v-if="transcriptGenerationStatus.has(item.id)" class="media-pill__state">
            <Loader2 :size="10" class="animate-spin" />
          </span>
          <button class="media-pill__remove" @click="$emit('remove-media', item.id)">
            <X :size="10" />
          </button>
        </div>
      </div>

      <template v-for="msg in messages" :key="msg.id">
        <ChatMessage :message="msg" />
        <ChatSummaryCard
          v-if="msg.role === 'assistant' && msg.metadata?.summary && msg.metadata?.ready_to_generate"
          :summary="msg.metadata.summary"
        />

        <div v-if="msg.role === 'assistant' && requestFor(msg.id)" class="chat-panel__media-request">
          <div class="media-request__head">
            <Upload :size="12" />
            <span>{{ requestFor(msg.id)?.required ? 'Media required' : 'Media request' }}</span>
          </div>
          <p class="media-request__prompt">{{ requestFor(msg.id)?.prompt }}</p>
          <div v-if="(requestFor(msg.id)?.parts || []).length > 0" class="media-request__parts">
            <span
              v-for="part in requestFor(msg.id)?.parts || []"
              :key="`req-${msg.id}-${part}`"
              class="media-request__part"
            >
              {{ part }}
            </span>
          </div>
          <div class="media-request__actions">
            <button class="media-request__btn media-request__btn--primary" @click="$emit('upload-media')">
              <Upload :size="12" />
              <span>Upload Media</span>
            </button>
            <button class="media-request__btn" @click="$emit('open-clip-picker')">
              <Video :size="12" />
              <span>Clips</span>
            </button>
            <button class="media-request__btn" @click="$emit('open-asset-picker')">
              <ImageIcon :size="12" />
              <span>Assets</span>
            </button>
          </div>
        </div>
      </template>

      <div v-if="isGenerating" class="chat-panel__generating">
        <div class="gen-progress-bar">
          <div class="gen-progress-fill" :style="{ width: generationProgress + '%' }"></div>
        </div>
        <div v-if="generationPhase === 'planning'" class="gen-phase">
          <div class="gen-pulse"></div>
          <span>Planning scenes...</span>
        </div>
        <div v-else-if="scenes.length > 0" class="gen-scene-list">
          <div class="gen-scene-header">{{ completedScenes }}/{{ scenes.length }} scenes</div>
          <div
            v-for="scene in scenes"
            :key="scene.index"
            class="gen-scene-item"
            :class="`gen-scene-item--${scene.status}`"
          >
            <Loader2 v-if="scene.status === 'generating'" :size="12" class="animate-spin" />
            <Check v-else-if="scene.status === 'complete'" :size="12" />
            <AlertCircle v-else-if="scene.status === 'error'" :size="12" />
            <div v-else class="gen-scene-dot"></div>
            <span class="gen-scene-name">Scene {{ scene.index + 1 }}</span>
            <span class="gen-scene-desc">{{ scene.description }}</span>
          </div>
        </div>
        <div v-else class="gen-phase">
          <div class="gen-pulse"></div>
          <span>Generating...</span>
        </div>
      </div>

      <div v-if="isSending" class="chat-panel__typing">
        <div class="typing-avatar"><Sparkles :size="14" /></div>
        <div class="typing-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>
    </div>

    <ReferenceAnalysisCard
      v-if="referenceAnalysis || isAnalyzingReference"
      :analysis="referenceAnalysis"
      :is-analyzing="isAnalyzingReference"
      :error="referenceError"
      @remove="$emit('remove-reference')"
    />

    <RefinementBadge
      v-if="isRefinementMode"
      :round="refinementRound"
      :max-rounds="maxRefinementRounds"
      :messages-remaining="refinementMessagesRemaining"
    />

    <div v-if="error" class="chat-panel__error">
      <AlertCircle :size="14" />
      <span>{{ error }}</span>
      <button @click="$emit('clear-error')" class="chat-panel__error-close"><X :size="12" /></button>
    </div>

    <div class="chat-panel__input">
      <div ref="mediaMenuEl" class="chat-media-menu-wrap">
        <button
          class="chat-media-btn"
          title="Add media"
          aria-label="Add media"
          :disabled="isGenerating"
          @click="toggleMediaMenu"
        >
          <Paperclip :size="16" />
          <span v-if="mediaItems.length > 0" class="chat-media-btn__badge">
            {{ mediaItems.length > 99 ? '99+' : mediaItems.length }}
          </span>
        </button>

        <div v-if="showMediaMenu" class="chat-media-menu">
          <button class="chat-media-menu__item" @click="handleMediaMenuAction('upload')">
            <Upload :size="13" />
            <span>Upload Files</span>
          </button>
          <button class="chat-media-menu__item" @click="handleMediaMenuAction('clips')">
            <Video :size="13" />
            <span>Select Clips</span>
          </button>
          <button class="chat-media-menu__item" @click="handleMediaMenuAction('assets')">
            <ImageIcon :size="13" />
            <span>Select Assets</span>
          </button>
        </div>
      </div>
      <button
        v-if="!isRefinementMode"
        class="chat-media-btn"
        title="Add reference"
        aria-label="Add reference"
        :disabled="isGenerating || isAnalyzingReference"
        @click="openReferenceDialog"
      >
        <LinkIcon :size="16" />
      </button>

      <textarea
        ref="inputEl"
        v-model="inputText"
        :placeholder="inputPlaceholder"
        class="chat-input"
        rows="1"
        :disabled="isGenerating"
        @keydown.enter.exact.prevent="handleSend"
        @input="autoResize"
      />
      <button class="chat-send-btn" :disabled="!inputText.trim() || isSending || isGenerating" @click="handleSend">
        <Send :size="16" />
      </button>
    </div>

    <Teleport to="body">
      <Transition name="chat-ref-fade">
        <div v-if="showReferenceDialog" class="chat-ref-overlay" @click.self="showReferenceDialog = false">
          <div class="chat-ref-dialog" role="dialog" aria-modal="true" aria-label="Add reference">
            <div class="chat-ref-dialog__accent"></div>
            <button
              class="chat-ref-dialog__close"
              aria-label="Close reference dialog"
              @click="showReferenceDialog = false"
            >
              <X :size="16" />
            </button>
            <div class="chat-ref-dialog__header">
              <div class="chat-ref-dialog__icon">
                <LinkIcon :size="20" />
              </div>
              <h3 class="chat-ref-dialog__title">Add Reference</h3>
              <p class="chat-ref-dialog__description">
                Paste a public image URL to guide style, framing, or look for this project.
              </p>
            </div>

            <div class="chat-ref-dialog__content">
              <div class="chat-ref-dialog__field">
                <input
                  ref="referenceInputEl"
                  v-model="refUrl"
                  type="url"
                  placeholder="https://example.com/reference-image.jpg"
                  class="chat-ref-dialog__input"
                  @keydown.enter.prevent="handleAnalyzeReference"
                />
              </div>
            </div>

            <div class="chat-ref-dialog__footer">
              <button class="chat-ref-dialog__btn chat-ref-dialog__btn--secondary" @click="showReferenceDialog = false">
                Cancel
              </button>
              <button
                class="chat-ref-dialog__btn chat-ref-dialog__btn--primary"
                :disabled="!refUrl.trim() || isAnalyzingReference"
                @click="handleAnalyzeReference"
              >
                <Loader2 v-if="isAnalyzingReference" :size="14" class="animate-spin" />
                <Search v-else :size="14" />
                <span>Analyze</span>
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue';
  import {
    Sparkles,
    Send,
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
  } from 'lucide-vue-next';
  import ChatMessage from './ChatMessage.vue';
  import ChatSummaryCard from './ChatSummaryCard.vue';
  import RefinementBadge from './RefinementBadge.vue';
  import ReferenceAnalysisCard from './ReferenceAnalysisCard.vue';
  import type { AIChatMessage, AIVideoMediaItem, ReferenceStyleProfile } from '@/types/ai-video';

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
    referenceAnalysis: ReferenceStyleProfile | null;
    isAnalyzingReference: boolean;
    referenceError: string | null;
    draftMessage: string;
    mediaItems: AIVideoMediaItem[];
    transcriptGenerationStatus: Map<string, { status: 'generating' | 'complete' | 'error'; progress?: string }>;
  }>();

  const emit = defineEmits<{
    send: [message: string];
    'update:draft-message': [message: string];
    'clear-error': [];
    'analyze-reference': [url: string];
    'remove-reference': [];
    'upload-media': [];
    'open-clip-picker': [];
    'open-asset-picker': [];
    'remove-media': [mediaId: string];
  }>();

  const inputEl = ref<HTMLTextAreaElement | null>(null);
  const referenceInputEl = ref<HTMLInputElement | null>(null);
  const messagesContainer = ref<HTMLDivElement | null>(null);
  const mediaMenuEl = ref<HTMLDivElement | null>(null);
  const showReferenceDialog = ref(false);
  const showMediaMenu = ref(false);
  const refUrl = ref('');

  const inputText = computed({
    get: () => props.draftMessage ?? '',
    set: (value: string) => emit('update:draft-message', value),
  });

  const generationProgress = computed(() => {
    if (props.scenes.length === 0) return 0;
    return Math.round((props.completedScenes / props.scenes.length) * 100);
  });

  const inputPlaceholder = computed(() => {
    if (props.isGenerating) return 'Generating...';
    if (props.isRefinementMode) return 'Describe what to change...';
    return 'Describe your video or ask a question...';
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
    nextTick(() => autoResize());
  }

  function autoResize() {
    const el = inputEl.value;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  }

  function handleAnalyzeReference() {
    const url = refUrl.value.trim();
    if (!url) return;
    emit('analyze-reference', url);
    showReferenceDialog.value = false;
    refUrl.value = '';
  }

  function openReferenceDialog() {
    if (props.isGenerating || props.isAnalyzingReference) return;
    showMediaMenu.value = false;
    showReferenceDialog.value = true;
  }

  function toggleMediaMenu() {
    showMediaMenu.value = !showMediaMenu.value;
  }

  function handleMediaMenuAction(action: 'upload' | 'clips' | 'assets') {
    showMediaMenu.value = false;
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

  function handleDocumentClick(event: MouseEvent) {
    if (!showMediaMenu.value) return;
    const target = event.target as Node | null;
    if (!target) return;
    if (mediaMenuEl.value?.contains(target)) return;
    showMediaMenu.value = false;
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
  watch(showReferenceDialog, (isOpen) => {
    if (!isOpen) return;
    nextTick(() => {
      referenceInputEl.value?.focus();
    });
  });
  watch(
    () => props.draftMessage,
    () => nextTick(() => autoResize())
  );

  onMounted(() => {
    document.addEventListener('click', handleDocumentClick);
    scrollToBottom();
    autoResize();
  });

  onBeforeUnmount(() => {
    document.removeEventListener('click', handleDocumentClick);
  });
</script>

<style scoped>
  .chat-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    gap: 0.5rem;
  }

  .chat-panel__media-strip {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.15rem 0.05rem 0.25rem;
    overflow-x: auto;
    overflow-y: hidden;
  }

  .media-pill {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.2rem 0.35rem;
    border-radius: 999px;
    border: 1px solid rgba(14, 165, 233, 0.34);
    background: rgba(14, 165, 233, 0.1);
    color: rgba(255, 255, 255, 0.85);
    font-size: 0.62rem;
    flex-shrink: 0;
    max-width: 260px;
  }

  .media-pill__name {
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 600;
  }

  .media-pill__tag {
    padding: 0.04rem 0.28rem;
    border-radius: 999px;
    background: rgba(14, 165, 233, 0.24);
    border: 1px solid rgba(14, 165, 233, 0.42);
    color: #bae6fd;
    font-size: 0.56rem;
    max-width: 92px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .media-pill__tag--pending {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(255, 255, 255, 0.18);
    color: rgba(255, 255, 255, 0.65);
  }

  .media-pill__state {
    display: inline-flex;
    align-items: center;
    color: #7dd3fc;
  }

  .media-pill__remove {
    width: 16px;
    height: 16px;
    border-radius: 999px;
    border: none;
    background: rgba(255, 255, 255, 0.12);
    color: rgba(255, 255, 255, 0.78);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0;
  }

  .media-pill__remove:hover {
    background: rgba(248, 113, 113, 0.26);
    color: #fee2e2;
  }

  .chat-panel__messages {
    flex: 1;
    overflow-y: auto;
    padding: 0.25rem 0.2rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .chat-panel__media-request {
    padding: 0.48rem 0.56rem;
    border-radius: 8px;
    border: 1px solid rgba(14, 165, 233, 0.34);
    background: rgba(14, 165, 233, 0.12);
    margin: 0.2rem 0 0.35rem;
    display: flex;
    flex-direction: column;
    gap: 0.38rem;
  }

  .media-request__head {
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    font-weight: 700;
    color: #7dd3fc;
  }

  .media-request__prompt {
    margin: 0;
    font-size: 0.71rem;
    color: rgba(255, 255, 255, 0.86);
    line-height: 1.35;
  }

  .media-request__parts {
    display: flex;
    flex-wrap: wrap;
    gap: 0.24rem;
  }

  .media-request__part {
    padding: 0.1rem 0.34rem;
    border-radius: 999px;
    font-size: 0.6rem;
    font-weight: 600;
    border: 1px solid rgba(125, 211, 252, 0.45);
    background: rgba(125, 211, 252, 0.18);
    color: #dbeafe;
  }

  .media-request__actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
  }

  .media-request__btn {
    display: inline-flex;
    align-items: center;
    gap: 0.26rem;
    padding: 0.23rem 0.45rem;
    border-radius: 6px;
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.86);
    font-size: 0.63rem;
    font-weight: 600;
    cursor: pointer;
  }

  .media-request__btn--primary {
    border-color: rgba(14, 165, 233, 0.5);
    background: rgba(14, 165, 233, 0.24);
    color: #e0f2fe;
  }

  .media-request__btn:hover {
    border-color: rgba(14, 165, 233, 0.52);
    background: rgba(14, 165, 233, 0.2);
  }

  .chat-panel__generating {
    padding: 8px;
    background: rgba(14, 165, 233, 0.06);
    border-radius: 8px;
    margin: 4px 0;
  }

  .gen-progress-bar {
    height: 3px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 2px;
    overflow: hidden;
    margin-bottom: 8px;
  }

  .gen-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #0ea5e9, #38bdf8);
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .gen-phase {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: rgba(255, 255, 255, 0.6);
  }

  .gen-pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #0ea5e9;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 0.4;
      transform: scale(0.8);
    }
    50% {
      opacity: 1;
      transform: scale(1.2);
    }
  }

  .gen-scene-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .gen-scene-header {
    font-size: 11px;
    color: rgba(255, 255, 255, 0.4);
    margin-bottom: 2px;
  }

  .gen-scene-item {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 11px;
    padding: 3px 0;
    color: rgba(255, 255, 255, 0.5);
  }

  .gen-scene-item--complete {
    color: #4ade80;
  }
  .gen-scene-item--generating {
    color: #38bdf8;
  }
  .gen-scene-item--error {
    color: #f87171;
  }

  .gen-scene-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.15);
  }

  .gen-scene-name {
    font-weight: 600;
    flex-shrink: 0;
  }

  .gen-scene-desc {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
    background: rgba(14, 165, 233, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #38bdf8;
  }

  .typing-dots {
    display: flex;
    gap: 3px;
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.06);
    border-radius: 12px;
  }

  .typing-dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.3);
    animation: typing-bounce 1.4s ease-in-out infinite;
  }

  .typing-dots span:nth-child(2) {
    animation-delay: 0.2s;
  }

  .typing-dots span:nth-child(3) {
    animation-delay: 0.4s;
  }

  @keyframes typing-bounce {
    0%,
    60%,
    100% {
      transform: translateY(0);
    }
    30% {
      transform: translateY(-4px);
    }
  }

  .chat-panel__error {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    border-radius: 6px;
    font-size: 12px;
    color: #f87171;
    margin: 4px 0;
  }

  .chat-panel__error-close {
    margin-left: auto;
    background: none;
    border: none;
    color: rgba(255, 255, 255, 0.3);
    cursor: pointer;
    padding: 2px;
  }

  .chat-panel__input {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    padding: 8px 0 0;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    position: relative;
  }

  .chat-media-menu-wrap {
    position: relative;
    flex-shrink: 0;
  }

  .chat-media-btn {
    position: relative;
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 255, 255, 0.8);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .chat-media-btn__badge {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 17px;
    height: 17px;
    padding: 0 0.3rem;
    border-radius: 999px;
    border: 1px solid rgba(14, 165, 233, 0.7);
    background: #0284c7;
    color: #f0f9ff;
    font-size: 0.58rem;
    font-weight: 700;
    line-height: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }

  .chat-media-btn:hover:not(:disabled) {
    border-color: rgba(14, 165, 233, 0.5);
    background: rgba(14, 165, 233, 0.2);
    color: #7dd3fc;
  }

  .chat-media-btn:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  .chat-media-menu {
    position: absolute;
    left: 0;
    bottom: calc(100% + 8px);
    min-width: 150px;
    padding: 0.3rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.16);
    background: #1a1a1f;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
    z-index: 20;
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .chat-media-menu__item {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    width: 100%;
    border: none;
    border-radius: 6px;
    padding: 0.35rem 0.45rem;
    background: transparent;
    color: rgba(255, 255, 255, 0.86);
    font-size: 0.68rem;
    text-align: left;
    cursor: pointer;
  }

  .chat-media-menu__item:hover {
    background: rgba(14, 165, 233, 0.2);
    color: #bae6fd;
  }

  .chat-input {
    flex: 1;
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    padding: 8px 12px;
    color: rgba(255, 255, 255, 0.9);
    font-size: 13px;
    font-family: inherit;
    resize: none;
    outline: none;
    min-height: 36px;
    max-height: 120px;
    transition: border-color 0.15s;
  }

  .chat-input:focus {
    border-color: rgba(14, 165, 233, 0.4);
  }

  .chat-input::placeholder {
    color: rgba(255, 255, 255, 0.25);
  }

  .chat-input:disabled {
    opacity: 0.4;
  }

  .chat-send-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: rgba(14, 165, 233, 0.3);
    border: none;
    color: #7dd3fc;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s;
    flex-shrink: 0;
  }

  .chat-send-btn:hover:not(:disabled) {
    background: rgba(14, 165, 233, 0.5);
  }

  .chat-send-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .chat-ref-overlay {
    position: fixed;
    inset: 0;
    z-index: 10001;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
  }

  .chat-ref-dialog {
    position: relative;
    z-index: 10002;
    width: min(560px, 94vw);
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-surface);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .chat-ref-dialog__accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  .chat-ref-dialog__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--sidebar-text-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .chat-ref-dialog__close:hover {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .chat-ref-dialog__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .chat-ref-dialog__icon {
    width: 52px;
    height: 52px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 0.35rem;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .chat-ref-dialog__title {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    letter-spacing: -0.02em;
  }

  .chat-ref-dialog__description {
    margin: 0;
    font-size: 0.8125rem;
    line-height: 1.45;
    color: var(--sidebar-text-muted);
  }

  .chat-ref-dialog__content {
    padding: 0.5rem 1.5rem 1rem;
  }

  .chat-ref-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .chat-ref-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    outline: none;
    transition: all 150ms ease;
  }

  .chat-ref-dialog__input:focus {
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .chat-ref-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .chat-ref-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .chat-ref-dialog__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: none;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .chat-ref-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .chat-ref-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .chat-ref-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
  }

  .chat-ref-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .chat-ref-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .chat-ref-fade-enter-active,
  .chat-ref-fade-leave-active {
    transition: opacity 0.16s ease;
  }

  .chat-ref-fade-enter-from,
  .chat-ref-fade-leave-to {
    opacity: 0;
  }

  @media (max-width: 980px) {
    .media-pill {
      max-width: 220px;
    }
  }
</style>
