<template>
  <div class="chat-msg" :class="[`chat-msg--${message.role}`, { 'chat-msg--system': message.role === 'system' }]">
    <div v-if="message.role === 'assistant'" class="chat-msg__avatar">
      <Sparkles :size="14" />
    </div>
    <div class="chat-msg__bubble">
      <div class="chat-msg__content">{{ message.content }}</div>
      <div class="chat-msg__time">{{ formatTime(message.inserted_at) }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';
import type { AIChatMessage } from '@/types/ai-video';
import { formatTime as fmtTime } from '@/utils/dateTimeUtils';

defineProps<{
  message: AIChatMessage;
}>();

function formatTime(iso: string) {
  return fmtTime(iso);
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

.chat-msg__bubble {
  max-width: 85%;
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
  white-space: pre-wrap;
  word-break: break-word;
}

.chat-msg__time {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.3);
  margin-top: 4px;
}

.chat-msg--user .chat-msg__time {
  text-align: right;
}
</style>
