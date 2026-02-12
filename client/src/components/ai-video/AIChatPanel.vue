<template>
  <div class="chat-panel">
    <!-- Messages area -->
    <div ref="messagesContainer" class="chat-panel__messages custom-scrollbar">
      <template v-for="msg in messages" :key="msg.id">
        <!-- Render summary card inline after assistant message that has summary -->
        <ChatMessage :message="msg" />
        <ChatSummaryCard
          v-if="msg.role === 'assistant' && msg.metadata?.summary && msg.metadata?.ready_to_generate"
          :summary="msg.metadata.summary"
          :disabled="isGenerating"
          @generate="$emit('generate')"
        />
      </template>

      <!-- Generation progress -->
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

      <!-- Typing indicator -->
      <div v-if="isSending" class="chat-panel__typing">
        <div class="typing-avatar"><Sparkles :size="14" /></div>
        <div class="typing-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>

    <!-- Reference analysis card -->
    <ReferenceAnalysisCard
      v-if="referenceAnalysis || isAnalyzingReference"
      :analysis="referenceAnalysis"
      :is-analyzing="isAnalyzingReference"
      :error="referenceError"
      @remove="$emit('remove-reference')"
    />

    <!-- Refinement badge -->
    <RefinementBadge
      v-if="isRefinementMode"
      :round="refinementRound"
      :max-rounds="maxRefinementRounds"
      :messages-remaining="refinementMessagesRemaining"
    />

    <!-- Error display -->
    <div v-if="error" class="chat-panel__error">
      <AlertCircle :size="14" />
      <span>{{ error }}</span>
      <button @click="$emit('clear-error')" class="chat-panel__error-close"><X :size="12" /></button>
    </div>

    <!-- Input area -->
    <div class="chat-panel__input">
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
      <button
        class="chat-send-btn"
        :disabled="!inputText.trim() || isSending || isGenerating"
        @click="handleSend"
      >
        <Send :size="16" />
      </button>
    </div>

    <!-- Reference URL input (collapsible) -->
    <div v-if="!isRefinementMode" class="chat-panel__ref-input">
      <button class="ref-toggle" @click="showRefInput = !showRefInput">
        <LinkIcon :size="12" />
        <span>{{ showRefInput ? 'Hide' : 'Add' }} Reference</span>
      </button>
      <div v-if="showRefInput" class="ref-url-row">
        <input
          v-model="refUrl"
          type="url"
          placeholder="Paste image URL for style reference..."
          class="ref-url-input"
          @keydown.enter.prevent="handleAnalyzeReference"
        />
        <button
          class="ref-url-btn"
          :disabled="!refUrl.trim() || isAnalyzingReference"
          @click="handleAnalyzeReference"
        >
          <Loader2 v-if="isAnalyzingReference" :size="14" class="animate-spin" />
          <Search v-else :size="14" />
        </button>
      </div>
    </div>

    <!-- Fallback generate button (when AI doesn't set ready_to_generate) -->
    <div v-if="!isRefinementMode && !isGenerating && showFallbackGenerate" class="chat-panel__fallback-generate">
      <button 
        class="fallback-generate-btn"
        @click="$emit('generate')"
        :disabled="isGenerating"
      >
        <Sparkles :size="16" />
        <span>Generate Video</span>
      </button>
      <div class="fallback-generate-hint">Ready to create your video</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue';
import { Sparkles, Send, Loader2, Check, AlertCircle, X, Link as LinkIcon, Search } from 'lucide-vue-next';
import ChatMessage from './ChatMessage.vue';
import ChatSummaryCard from './ChatSummaryCard.vue';
import RefinementBadge from './RefinementBadge.vue';
import ReferenceAnalysisCard from './ReferenceAnalysisCard.vue';
import type { AIChatMessage, ReferenceStyleProfile } from '@/types/ai-video';

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
}>();

const emit = defineEmits<{
  send: [message: string];
  generate: [];
  'clear-error': [];
  'analyze-reference': [url: string];
  'remove-reference': [];
}>();

const inputText = ref('');
const inputEl = ref<HTMLTextAreaElement | null>(null);
const messagesContainer = ref<HTMLDivElement | null>(null);
const showRefInput = ref(false);
const refUrl = ref('');

const generationProgress = computed(() => {
  if (props.scenes.length === 0) return 0;
  return Math.round((props.completedScenes / props.scenes.length) * 100);
});

const inputPlaceholder = computed(() => {
  if (props.isGenerating) return 'Generating...';
  if (props.isRefinementMode) return 'Describe what to change...';
  return 'Describe your video or ask a question...';
});

// Show fallback generate button when AI hasn't set ready_to_generate but we have enough context
const showFallbackGenerate = computed(() => {
  if (props.isRefinementMode || props.isGenerating) return false;
  if (!props.messages.length) return false;
  
  // Check if we have at least some conversation and no ready_to_generate flag
  const hasUserMessages = props.messages.some(m => m.role === 'user');
  const hasAssistantMessages = props.messages.some(m => m.role === 'assistant');
  const hasReadyToGenerate = props.messages.some(m => 
    m.role === 'assistant' && m.metadata?.ready_to_generate === true
  );
  
  // Show fallback if we have conversation but AI didn't set the flag
  // Also show after 2 assistant messages regardless
  const assistantMessageCount = props.messages.filter(m => m.role === 'assistant').length;
  const enoughConversation = hasUserMessages && assistantMessageCount >= 1;
  
  return enoughConversation && !hasReadyToGenerate;
});

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
  showRefInput.value = false;
}

function scrollToBottom() {
  nextTick(() => {
    const container = messagesContainer.value;
    if (container) {
      container.scrollTop = container.scrollHeight;
    }
  });
}

// Auto-scroll when messages change
watch(() => props.messages.length, scrollToBottom);
watch(() => props.isSending, scrollToBottom);
watch(() => props.completedScenes, scrollToBottom);

onMounted(scrollToBottom);
</script>

<style scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.chat-panel__messages {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* Generation progress */
.chat-panel__generating {
  padding: 8px;
  background: rgba(139, 92, 246, 0.06);
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
  background: linear-gradient(90deg, #8b5cf6, #a78bfa);
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
  background: #8b5cf6;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 0.4; transform: scale(0.8); }
  50% { opacity: 1; transform: scale(1.2); }
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

.gen-scene-item--complete { color: #4ade80; }
.gen-scene-item--generating { color: #a78bfa; }
.gen-scene-item--error { color: #f87171; }

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

/* Typing indicator */
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
  background: rgba(139, 92, 246, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a78bfa;
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

.typing-dots span:nth-child(2) { animation-delay: 0.2s; }
.typing-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); }
  30% { transform: translateY(-4px); }
}

/* Error */
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

/* Input area */
.chat-panel__input {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  padding: 8px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
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
  border-color: rgba(139, 92, 246, 0.4);
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
  background: rgba(139, 92, 246, 0.3);
  border: none;
  color: #c4b5fd;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: background 0.15s;
  flex-shrink: 0;
}

.chat-send-btn:hover:not(:disabled) {
  background: rgba(139, 92, 246, 0.5);
}

.chat-send-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Reference input */
.chat-panel__ref-input {
  padding: 4px 0 0;
}

.ref-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: rgba(255, 255, 255, 0.35);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 0;
  transition: color 0.15s;
}

.ref-toggle:hover {
  color: rgba(255, 255, 255, 0.6);
}

.ref-url-row {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.ref-url-input {
  flex: 1;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  padding: 5px 8px;
  color: rgba(255, 255, 255, 0.8);
  font-size: 11px;
  font-family: inherit;
  outline: none;
}

.ref-url-input:focus {
  border-color: rgba(59, 130, 246, 0.4);
}

.ref-url-input::placeholder {
  color: rgba(255, 255, 255, 0.2);
}

.ref-url-btn {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: rgba(59, 130, 246, 0.2);
  border: none;
  color: #60a5fa;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  flex-shrink: 0;
}

.ref-url-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.35);
}

.ref-url-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

/* Fallback generate button */
.chat-panel__fallback-generate {
  padding: 12px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  margin-top: 8px;
}

.fallback-generate-btn {
  width: 100%;
  background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
  border: none;
  border-radius: 12px;
  padding: 12px 16px;
  color: white;
  font-size: 14px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  transition: all 0.15s;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.3);
}

.fallback-generate-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(139, 92, 246, 0.4);
}

.fallback-generate-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.fallback-generate-hint {
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 11px;
  margin-top: 6px;
}
</style>
