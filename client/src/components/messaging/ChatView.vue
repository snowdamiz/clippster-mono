<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue';
import { useMessagingStore } from '@/stores/messaging';
import type { Conversation, Message } from '@/services/messagingApi';
import MessageBubble from './MessageBubble.vue';
import TypingIndicator from './TypingIndicator.vue';
import ChatHeader from './ChatHeader.vue';

const props = defineProps<{
  conversation: Conversation;
  messages: Message[];
  currentUserId?: number;
  typingUsers: Set<number>;
  isLoading: boolean;
}>();

const messagingStore = useMessagingStore();

const messageInput = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const isAtBottom = ref(true);
const editingMessageId = ref<number | null>(null);
const editContent = ref('');

// Typing indicator debounce
let typingTimeout: number | null = null;

const sortedMessages = computed(() => {
  return [...props.messages].sort((a, b) => 
    new Date(a.insertedAt).getTime() - new Date(b.insertedAt).getTime()
  );
});

const typingUserNames = computed(() => {
  const names: string[] = [];
  props.typingUsers.forEach(userId => {
    const participant = props.conversation.participants.find(p => p.userId === userId);
    if (participant?.user?.displayName) {
      names.push(participant.user.displayName);
    }
  });
  return names;
});

function scrollToBottom(smooth = true) {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTo({
        top: messagesContainer.value.scrollHeight,
        behavior: smooth ? 'smooth' : 'auto'
      });
    }
  });
}

function handleScroll() {
  if (!messagesContainer.value) return;
  const { scrollTop, scrollHeight, clientHeight } = messagesContainer.value;
  isAtBottom.value = scrollHeight - scrollTop - clientHeight < 50;
}

watch(() => props.messages.length, () => {
  if (isAtBottom.value) {
    scrollToBottom();
  }
});

watch(() => props.conversation.id, () => {
  scrollToBottom(false);
});

onMounted(() => {
  scrollToBottom(false);
});

async function handleSendMessage() {
  const content = messageInput.value.trim();
  if (!content) return;

  messageInput.value = '';
  
  try {
    await messagingStore.sendMessage(content);
    scrollToBottom();
  } catch (error) {
    console.error('Failed to send message:', error);
    messageInput.value = content; // Restore on error
  }
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (editingMessageId.value) {
      handleSaveEdit();
    } else {
      handleSendMessage();
    }
  }
}

function handleTyping() {
  if (typingTimeout) {
    clearTimeout(typingTimeout);
  }
  
  messagingStore.sendTyping();
  
  typingTimeout = window.setTimeout(() => {
    typingTimeout = null;
  }, 2000);
}

function handleEditMessage(message: Message) {
  editingMessageId.value = message.id;
  editContent.value = message.content;
}

async function handleSaveEdit() {
  if (!editingMessageId.value || !editContent.value.trim()) return;

  try {
    await messagingStore.editMessage(editingMessageId.value, editContent.value.trim());
    editingMessageId.value = null;
    editContent.value = '';
  } catch (error) {
    console.error('Failed to edit message:', error);
  }
}

function handleCancelEdit() {
  editingMessageId.value = null;
  editContent.value = '';
}

async function handleDeleteMessage(messageId: number) {
  if (!confirm('Are you sure you want to delete this message?')) return;

  try {
    await messagingStore.deleteMessage(messageId);
  } catch (error) {
    console.error('Failed to delete message:', error);
  }
}
</script>

<template>
  <div class="chat-view">
    <!-- Header -->
    <ChatHeader :conversation="conversation" :current-user-id="currentUserId" />

    <!-- Messages -->
    <div 
      ref="messagesContainer"
      class="messages-container"
      @scroll="handleScroll"
    >
      <!-- Loading indicator -->
      <div v-if="isLoading" class="loading-messages">
        <div class="spinner"></div>
        <span>Loading messages...</span>
      </div>

      <!-- Messages list -->
      <div class="messages-list">
        <MessageBubble
          v-for="message in sortedMessages"
          :key="message.id"
          :message="message"
          :is-own-message="message.senderId === currentUserId"
          :is-editing="editingMessageId === message.id"
          :edit-content="editContent"
          @edit="handleEditMessage(message)"
          @delete="handleDeleteMessage(message.id)"
          @update:edit-content="editContent = $event"
          @save-edit="handleSaveEdit"
          @cancel-edit="handleCancelEdit"
        />
      </div>

      <!-- Typing indicator -->
      <TypingIndicator 
        v-if="typingUserNames.length > 0"
        :user-names="typingUserNames"
      />
    </div>

    <!-- Input area -->
    <div class="input-area">
      <div class="input-wrapper">
        <textarea
          v-model="messageInput"
          placeholder="Type a message..."
          rows="1"
          @keydown="handleInputKeydown"
          @input="handleTyping"
        ></textarea>
        <button 
          class="send-btn"
          :disabled="!messageInput.trim()"
          @click="handleSendMessage"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-view {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.loading-messages {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px;
  color: var(--text-secondary, #888);
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid var(--border-color, #333);
  border-top-color: var(--accent-color, #7c3aed);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-area {
  padding: 16px;
  border-top: 1px solid var(--border-color, #333);
  background: var(--bg-secondary, #222);
}

.input-wrapper {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  background: var(--bg-tertiary, #2a2a2a);
  border-radius: 12px;
  padding: 8px 12px;
}

.input-wrapper textarea {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary, #fff);
  font-size: 14px;
  line-height: 1.5;
  resize: none;
  max-height: 120px;
  font-family: inherit;
}

.input-wrapper textarea::placeholder {
  color: var(--text-tertiary, #666);
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--accent-color, #7c3aed);
  color: white;
  cursor: pointer;
  transition: background 0.2s, opacity 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-hover, #6d28d9);
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
