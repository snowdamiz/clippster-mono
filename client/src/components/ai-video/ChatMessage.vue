<template>
  <div class="chat-msg" :class="[`chat-msg--${message.role}`, { 'chat-msg--system': message.role === 'system' }]">
    <div v-if="message.role === 'assistant'" class="chat-msg__avatar">
      <Sparkles :size="14" />
    </div>
    <div class="chat-msg__wrap">
      <div class="chat-msg__bubble">
        <div class="chat-msg__content" v-html="renderedContent"></div>
        <div class="chat-msg__time">{{ formatTime(message.inserted_at) }}</div>
      </div>
      <!-- Quick reply buttons (only on the last assistant message) -->
      <div v-if="quickReplies && quickReplies.length > 0 && isLastAssistant" class="chat-msg__quick-replies">
        <button
          v-for="(reply, i) in quickReplies"
          :key="i"
          class="quick-reply-btn"
          @click="$emit('quickReply', reply)"
        >
          {{ reply.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Sparkles } from 'lucide-vue-next';
import type { AIChatMessage, QuickReply } from '@/types/ai-video';

const props = defineProps<{
  message: AIChatMessage;
  isLastAssistant?: boolean;
}>();

defineEmits<{
  quickReply: [reply: QuickReply];
}>();

const quickReplies = computed<QuickReply[]>(() => {
  if (props.message.role !== 'assistant' || !props.message.metadata?.quick_replies) return [];
  return props.message.metadata.quick_replies as QuickReply[];
});

const renderedContent = computed(() => {
  let text = props.message.content || '';
  // Basic markdown: **bold**, *italic*, `code`
  text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
  text = text.replace(/`(.+?)`/g, '<code>$1</code>');
  // Convert newlines to <br>
  text = text.replace(/\n/g, '<br>');
  return text;
});

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
</script>

<style scoped>
.chat-msg {
  display: flex;
  gap: 8px;
  padding: 4px 0;
}

.chat-msg--user {
  flex-direction: row-reverse;
}

.chat-msg--system {
  justify-content: center;
}

.chat-msg__avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #a78bfa;
  flex-shrink: 0;
  margin-top: 2px;
}

.chat-msg__wrap {
  max-width: 85%;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chat-msg--user .chat-msg__wrap {
  align-items: flex-end;
}

.chat-msg__bubble {
  padding: 8px 12px;
  border-radius: 12px;
  font-size: 13px;
  line-height: 1.45;
}

.chat-msg--assistant .chat-msg__bubble {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(255, 255, 255, 0.9);
  border-bottom-left-radius: 4px;
}

.chat-msg--user .chat-msg__bubble {
  background: rgba(139, 92, 246, 0.25);
  color: rgba(255, 255, 255, 0.95);
  border-bottom-right-radius: 4px;
}

.chat-msg--system .chat-msg__bubble {
  background: rgba(255, 255, 255, 0.04);
  color: rgba(255, 255, 255, 0.5);
  font-size: 12px;
  font-style: italic;
  max-width: 100%;
  text-align: center;
}

.chat-msg__content {
  word-break: break-word;
}

.chat-msg__content :deep(strong) {
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
}

.chat-msg__content :deep(em) {
  font-style: italic;
  color: rgba(255, 255, 255, 0.7);
}

.chat-msg__content :deep(code) {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 4px;
  border-radius: 3px;
  font-size: 12px;
}

.chat-msg__time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 4px;
}

.chat-msg--user .chat-msg__time {
  text-align: right;
}

/* Quick Reply Buttons */
.chat-msg__quick-replies {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.quick-reply-btn {
  padding: 6px 14px;
  border: 1px solid rgba(14, 165, 233, 0.3);
  border-radius: 18px;
  background: rgba(14, 165, 233, 0.08);
  color: #38bdf8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.quick-reply-btn:hover {
  background: rgba(14, 165, 233, 0.18);
  border-color: rgba(14, 165, 233, 0.5);
  transform: translateY(-1px);
}

.quick-reply-btn:active {
  transform: translateY(0);
}
</style>
