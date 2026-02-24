<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import {
  MessageSquare,
  Search,
  Send,
  Loader2,
  Headset,
  Archive,
  X,
} from 'lucide-vue-next';

const authStore = useAuthStore();

// State
const conversations = ref<any[]>([]);
const activeConversation = ref<any>(null);
const messages = ref<any[]>([]);
const messageInput = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const isLoading = ref(false);
const isLoadingMessages = ref(false);
const searchQuery = ref('');
const statusFilter = ref<'open' | 'archived'>('open');
const showArchiveDialog = ref(false);

// Computed
const filteredConversations = computed(() => {
  // Filter out blank conversations (no messages ever sent)
  const nonEmpty = conversations.value.filter((conv: any) => {
    return conv.last_message_at || conv.lastMessageAt;
  });
  if (!searchQuery.value) return nonEmpty;
  const query = searchQuery.value.toLowerCase();
  return nonEmpty.filter((conv: any) => {
    const userName = getUserName(conv).toLowerCase();
    return userName.includes(query);
  });
});

const sortedMessages = computed(() => {
  return [...messages.value].sort((a, b) => {
    const aTime = a.insertedAt || a.inserted_at;
    const bTime = b.insertedAt || b.inserted_at;
    return new Date(aTime).getTime() - new Date(bTime).getTime();
  });
});

// Functions
async function loadConversations() {
  isLoading.value = true;
  try {
    console.log('Loading support conversations with status:', statusFilter.value);
    const response = await api.get('/admin/support/conversations', {
      params: { status: statusFilter.value }
    });
    console.log('Support conversations response:', response.data);
    conversations.value = response.data.conversations || [];
    console.log('Conversations set to:', conversations.value);
  } catch (error: any) {
    console.error('Failed to load conversations:', error);
    console.error('Error details:', error.response?.data);
  } finally {
    isLoading.value = false;
  }
}

async function selectConversation(conv: any) {
  const conversationId = conv.id;
  console.log('Selecting conversation:', conv);
  console.log('Conversation status:', conv.status);
  activeConversation.value = conv;
  await loadMessages(conversationId);
  await markAsRead(conversationId);
}

async function loadMessages(conversationId: number) {
  isLoadingMessages.value = true;
  try {
    const response = await api.get(`/admin/support/conversations/${conversationId}/messages`);
    messages.value = response.data.messages || [];
    await nextTick();
    scrollToBottom();
  } catch (error) {
    console.error('Failed to load messages:', error);
  } finally {
    isLoadingMessages.value = false;
  }
}

async function sendMessage() {
  if (!messageInput.value.trim() || !activeConversation.value) return;
  
  try {
    const response = await api.post(
      `/admin/support/conversations/${activeConversation.value.id}/messages`,
      { content: messageInput.value }
    );
    messages.value.push(response.data.message);
    messageInput.value = '';
    await nextTick();
    scrollToBottom();
  } catch (error) {
    console.error('Failed to send message:', error);
  }
}

async function archiveConversation() {
  if (!activeConversation.value) return;
  
  try {
    await api.post(`/admin/support/conversations/${activeConversation.value.id}/archive`);
    showArchiveDialog.value = false;
    activeConversation.value = null;
    messages.value = [];
    loadConversations();
  } catch (error) {
    console.error('Failed to archive conversation:', error);
  }
}

async function markAsRead(conversationId: number) {
  try {
    await api.post(`/admin/support/conversations/${conversationId}/read`);
  } catch (error) {
    console.error('Failed to mark as read:', error);
  }
}

function getUserName(conv: any) {
  const createdByUserId = conv.created_by_user_id || conv.createdByUserId;
  const participants = conv.participants || [];
  const customerParticipant = participants.find((p: any) => (p.user_id || p.userId) === createdByUserId);
  const user = customerParticipant?.user;
  return user?.name || user?.display_name || user?.displayName || user?.email || 'Unknown User';
}

function getUserEmail(conv: any) {
  const createdByUserId = conv.created_by_user_id || conv.createdByUserId;
  const participants = conv.participants || [];
  const customerParticipant = participants.find((p: any) => (p.user_id || p.userId) === createdByUserId);
  return customerParticipant?.user?.email || '';
}

function getSenderName(message: any) {
  const sender = message.sender;
  if (sender) {
    return sender.name || sender.display_name || sender.displayName || sender.email || 'Unknown';
  }
  return 'Unknown';
}

function isStaffMessage(message: any) {
  const senderId = message.sender_id || message.senderId;
  const createdByUserId = activeConversation.value?.created_by_user_id || activeConversation.value?.createdByUserId;
  if (!senderId || !createdByUserId) return false;
  return senderId !== createdByUserId;
}

function formatTime(timestamp: string | null): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return fmtDate(date);
}

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
}

watch(statusFilter, () => {
  loadConversations();
  activeConversation.value = null;
  messages.value = [];
});

onMounted(() => {
  console.log('AdminCustomerService mounted');
  console.log('Current user:', authStore.user);
  console.log('Is authenticated:', authStore.isAuthenticated);
  console.log('Auth token exists:', !!authStore.token);
  loadConversations();
});
</script>

<template>
  <div class="messages">
    <PageLayout
      title="Customer Service"
      description="Manage support conversations and tickets"
      :show-header="true"
      :icon="Headset"
    >
      <div class="messages__content">
        <!-- Page Heading -->
        <div class="messages__heading">
          <h1 class="messages__title">Customer Service</h1>
          <p class="messages__subtitle">Manage support conversations and tickets</p>
        </div>

        <!-- Main Messages Container -->
        <div class="messages__main">
          <!-- Conversations Panel (Left) -->
          <div class="messages-panel">
            <div class="messages-panel__inner">
              <!-- Panel Header -->
              <div class="messages-panel__header">
                <div class="messages-panel__header-left">
                  <div class="messages-panel__header-icon">
                    <Headset />
                  </div>
                  <div class="messages-panel__header-text">
                    <h2 class="messages-panel__title">Support Tickets</h2>
                    <p class="messages-panel__subtitle">
                      {{ filteredConversations.length }} {{ filteredConversations.length === 1 ? 'ticket' : 'tickets' }}
                    </p>
                  </div>
                </div>
                <div class="messages-panel__tabs">
                  <button
                    @click="statusFilter = 'open'"
                    :class="['messages-panel__tab', { 'messages-panel__tab--active': statusFilter === 'open' }]"
                  >
                    Open
                  </button>
                  <button
                    @click="statusFilter = 'archived'"
                    :class="['messages-panel__tab', { 'messages-panel__tab--active': statusFilter === 'archived' }]"
                  >
                    Archived
                  </button>
                </div>
              </div>

              <!-- Search Box -->
              <div class="messages-panel__search">
                <Search class="messages-panel__search-icon" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search tickets..."
                  class="messages-panel__search-input"
                />
              </div>

              <!-- Conversations List -->
              <div class="messages-panel__list">
                <!-- Loading Skeleton -->
                <template v-if="isLoading">
                  <div v-for="i in 4" :key="i" class="messages-conv-skeleton">
                    <div class="messages-conv-skeleton__avatar"></div>
                    <div class="messages-conv-skeleton__content">
                      <div class="messages-conv-skeleton__line messages-conv-skeleton__line--name"></div>
                      <div class="messages-conv-skeleton__line messages-conv-skeleton__line--preview"></div>
                    </div>
                  </div>
                </template>

                <!-- Conversations -->
                <template v-else>
                  <div
                    v-for="conv in filteredConversations"
                    :key="conv.id"
                    class="messages-conv"
                    :class="{
                      'messages-conv--active': conv.id === activeConversation?.id,
                    }"
                    @click="selectConversation(conv)"
                  >
                    <div
                      class="messages-conv__indicator"
                      :class="{
                        'messages-conv__indicator--active': conv.id === activeConversation?.id,
                      }"
                    ></div>
                    <div class="messages-conv__inner">
                      <!-- Avatar -->
                      <div class="messages-conv__avatar-wrapper">
                        <div class="messages-conv__avatar messages-conv__avatar--support">
                          <Headset class="messages-conv__avatar-icon" />
                        </div>
                      </div>

                      <!-- Content -->
                      <div class="messages-conv__content">
                        <div class="messages-conv__header">
                          <span class="messages-conv__name">{{ getUserName(conv) }}</span>
                          <span class="messages-conv__time">{{ formatTime(conv.lastMessageAt || conv.last_message_at) }}</span>
                        </div>
                        <div class="messages-conv__footer">
                          <span class="messages-conv__preview">{{ conv.lastMessagePreview || conv.last_message_preview || 'No messages yet' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Chat Panel (Right) -->
          <div class="messages-chat">
            <div class="messages-chat__inner">
              <template v-if="activeConversation">
                <!-- Chat Header -->
                <div class="messages-chat__header">
                  <div class="messages-chat__header-left">
                    <div class="messages-chat__avatar messages-chat__avatar--support">
                      <Headset class="messages-chat__avatar-icon" />
                    </div>
                    <div class="messages-chat__header-info">
                      <h3 class="messages-chat__name">
                        {{ getUserName(activeConversation) }}
                      </h3>
                      <p class="messages-chat__meta">
                        {{ getUserEmail(activeConversation) }}
                      </p>
                    </div>
                  </div>

                  <div class="messages-chat__header-actions">
                    <button
                      v-if="activeConversation.status === 'open'"
                      @click="showArchiveDialog = true"
                      class="messages-chat__action-btn"
                      title="Close Ticket"
                    >
                      <Archive class="messages-chat__action-icon" />
                    </button>
                  </div>
                </div>

                <!-- Messages Container -->
                <div ref="messagesContainer" class="messages-chat__messages">
                  <!-- Loading Messages -->
                  <div v-if="isLoadingMessages" class="messages-chat__loading">
                    <Loader2 class="messages-chat__loading-spinner" />
                  </div>

                  <!-- Messages List -->
                  <div
                    v-for="message in sortedMessages"
                    :key="message.id"
                    class="message-row"
                    :class="{ 'message-row--sent': isStaffMessage(message) }"
                  >
                    <div
                      class="message-bubble"
                      :class="{
                        'message-bubble--sent': isStaffMessage(message),
                        'message-bubble--received': !isStaffMessage(message),
                        'message-bubble--system': message.messageType === 'system' || message.message_type === 'system',
                      }"
                    >
                      <!-- Sender Name -->
                      <div
                        v-if="!isStaffMessage(message) && message.messageType !== 'system' && message.message_type !== 'system'"
                        class="message-bubble__sender"
                      >
                        {{ getSenderName(message) }}
                      </div>

                      <!-- Message Content -->
                      <div class="message-bubble__text">
                        {{ message.content }}
                      </div>

                      <!-- Timestamp -->
                      <div class="message-bubble__time">
                        {{ formatTime(message.insertedAt || message.inserted_at) }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Message Input -->
                <div v-if="activeConversation.status === 'open'" class="messages-chat__input">
                  <textarea
                    v-model="messageInput"
                    @keydown="handleKeydown"
                    placeholder="Type your response..."
                    class="messages-chat__textarea"
                    rows="3"
                  ></textarea>
                  <button
                    @click="sendMessage"
                    :disabled="!messageInput.trim()"
                    class="messages-chat__send-btn"
                    :class="{ 'messages-chat__send-btn--disabled': !messageInput.trim() }"
                  >
                    <Send class="messages-chat__send-icon" />
                  </button>
                </div>

                <!-- Archived Notice -->
                <div v-else class="messages-chat__archived">
                  <Archive class="messages-chat__archived-icon" />
                  <span>This ticket is archived</span>
                </div>
              </template>

              <!-- Empty State -->
              <template v-else>
                <div class="messages-chat__empty">
                  <Headset class="messages-chat__empty-icon" />
                  <h3 class="messages-chat__empty-title">Select a ticket</h3>
                  <p class="messages-chat__empty-text">Choose a support ticket from the list to view and respond</p>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- Archive Confirmation Dialog -->
    <div v-if="showArchiveDialog" class="dialog-overlay" @click="showArchiveDialog = false">
      <div class="dialog" @click.stop>
        <div class="dialog__header">
          <h3 class="dialog__title">Close Ticket</h3>
          <button @click="showArchiveDialog = false" class="dialog__close">
            <X />
          </button>
        </div>
        <p class="dialog__message">
          Are you sure you want to close this support ticket? The conversation will be archived for admins/mods and will be cleared from the user's view after 24 hours.
        </p>
        <div class="dialog__actions">
          <button @click="showArchiveDialog = false" class="dialog__btn dialog__btn--secondary">Cancel</button>
          <button @click="archiveConversation" class="dialog__btn dialog__btn--danger">Close Ticket</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Base styles from Messages.vue */
.messages {
  width: 100%;
  height: 100%;
}

.messages__content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  padding-bottom: 2rem;
  max-width: 1600px;
  margin: 0 auto;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}

.messages__heading {
  flex-shrink: 0;
}

.messages__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0 0 0.2rem;
  letter-spacing: -0.02em;
}

.messages__subtitle {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  line-height: 1.5;
}

.messages__main {
  display: flex;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  margin-top: 0.8rem;
  overflow: hidden;
}

/* Conversations Panel */
.messages-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  background-color: var(--sidebar-surface);
  border-radius: 10px;
  overflow: hidden;
}

.messages-panel__inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.875rem;
  padding: 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.messages-panel__header-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  flex: 1;
}

.messages-panel__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: rgba(139, 92, 246, 0.15);
  flex-shrink: 0;
}

.messages-panel__header-icon svg {
  width: 20px;
  height: 20px;
  color: #a855f7;
  stroke: #a855f7;
}

.messages-panel__header-text {
  flex: 1;
}

.messages-panel__title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.messages-panel__subtitle {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0.125rem 0 0;
}

.messages-panel__search {
  position: relative;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.messages-panel__search-icon {
  position: absolute;
  left: 1.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--sidebar-text-muted);
  pointer-events: none;
}

.messages-panel__search-input {
  width: 100%;
  height: 36px;
  padding-left: 2rem;
  padding-right: 0.75rem;
  background-color: var(--sidebar-hover);
  border: 1px solid transparent;
  border-radius: 8px;
  font-size: 0.8125rem;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.messages-panel__search-input::placeholder {
  color: var(--sidebar-text-muted);
}

.messages-panel__search-input:hover {
  border-color: var(--sidebar-border);
}

.messages-panel__search-input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  background-color: var(--sidebar-surface);
}

.messages-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.messages-panel__list::-webkit-scrollbar {
  width: 6px;
}

.messages-panel__list::-webkit-scrollbar-track {
  background: transparent;
}

.messages-panel__list::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

/* Conversation Item */
.messages-conv {
  display: flex;
  margin-bottom: 0.375rem;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 150ms ease;
}

.messages-conv:hover {
  background-color: var(--sidebar-hover);
}

.messages-conv--active {
  background-color: var(--sidebar-active);
}

.messages-conv__indicator {
  width: 3px;
  flex-shrink: 0;
  background-color: transparent;
  border-radius: 3px 0 0 3px;
}

.messages-conv__indicator--active {
  background-color: var(--sidebar-accent);
}

.messages-conv__inner {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
}

.messages-conv__avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.messages-conv__avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
}

.messages-conv__avatar--support {
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
}

.messages-conv__avatar-icon {
  width: 20px;
  height: 20px;
}

.messages-conv__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.messages-conv__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.messages-conv__name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.messages-conv__time {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  flex-shrink: 0;
}

.messages-conv__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.messages-conv__preview {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* Skeleton Loading */
.messages-conv-skeleton {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.375rem;
}

.messages-conv-skeleton__avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.messages-conv-skeleton__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.messages-conv-skeleton__line {
  background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.messages-conv-skeleton__line--name {
  height: 14px;
  width: 60%;
}

.messages-conv-skeleton__line--preview {
  height: 12px;
  width: 80%;
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

/* Chat Panel */
.messages-chat {
  flex: 1;
  display: flex;
  background-color: var(--sidebar-surface);
  border-radius: 10px;
  overflow: hidden;
}

.messages-chat__inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages-chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
  background-color: rgba(0, 0, 0, 0.15);
}

.messages-chat__header-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.messages-chat__avatar {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 0.875rem;
  font-weight: 600;
  color: white;
  flex-shrink: 0;
}

.messages-chat__avatar--support {
  background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%);
}

.messages-chat__avatar-icon {
  width: 20px;
  height: 20px;
}

.messages-chat__header-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.messages-chat__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.messages-chat__meta {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.messages-chat__header-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.messages-chat__action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text-muted);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
}

.messages-chat__action-btn:hover {
  background-color: var(--sidebar-active);
  color: var(--sidebar-text);
}

.messages-chat__action-icon {
  width: 16px;
  height: 16px;
}

.messages-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.messages-chat__messages::-webkit-scrollbar {
  width: 6px;
}

.messages-chat__messages::-webkit-scrollbar-track {
  background: transparent;
}

.messages-chat__messages::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.messages-chat__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.messages-chat__loading-spinner {
  width: 24px;
  height: 24px;
  color: var(--sidebar-accent);
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.message-row {
  display: flex;
  justify-content: flex-start;
}

.message-row--sent {
  justify-content: flex-end;
}

.message-bubble {
  position: relative;
  max-width: 70%;
  padding: 0.75rem 1rem;
  border-radius: 16px;
}

.message-bubble--sent {
  background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
  color: white;
  border-bottom-right-radius: 4px;
}

.message-bubble--received {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border-bottom-left-radius: 4px;
}

.message-bubble--system {
  background-color: var(--sidebar-active);
  color: var(--sidebar-text-muted);
  font-style: italic;
  text-align: center;
  max-width: 80%;
  margin: 0 auto;
}

.message-bubble__sender {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--sidebar-accent);
  margin-bottom: 0.375rem;
}

.message-bubble__text {
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.message-bubble__time {
  font-size: 0.625rem;
  opacity: 0.7;
  margin-top: 0.375rem;
}

.message-bubble--sent .message-bubble__time {
  color: white;
  opacity: 1;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.messages-chat__input {
  display: flex;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--sidebar-border);
  background-color: rgba(0, 0, 0, 0.15);
}

.messages-chat__textarea {
  flex: 1;
  padding: 0.75rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  resize: none;
  font-family: inherit;
  transition: all 150ms ease;
}

.messages-chat__textarea:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  background-color: var(--sidebar-surface);
}

.messages-chat__textarea::placeholder {
  color: var(--sidebar-text-muted);
}

.messages-chat__send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
}

.messages-chat__send-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.messages-chat__send-btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.messages-chat__send-btn--disabled:hover {
  transform: none;
}

.messages-chat__send-icon {
  width: 18px;
  height: 18px;
}

.messages-chat__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 3rem 2rem;
  text-align: center;
}

.messages-chat__empty-icon {
  width: 64px;
  height: 64px;
  color: var(--sidebar-text-muted);
  opacity: 0.5;
}

.messages-chat__empty-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
}

.messages-chat__empty-text {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  max-width: 400px;
}

/* Additional styles for Customer Service page */
.messages-panel__tabs {
  display: flex;
  gap: 0.5rem;
}

.messages-panel__tab {
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid var(--sidebar-border);
  border-radius: 6px;
  background: transparent;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.messages-panel__tab:hover {
  background: var(--sidebar-hover);
}

.messages-panel__tab--active {
  background: var(--sidebar-accent);
  color: var(--sidebar-bg);
  border-color: var(--sidebar-accent);
}

.messages-chat__archived {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem;
  border-top: 1px solid var(--sidebar-border);
  color: var(--sidebar-text-muted);
  font-size: 0.875rem;
}

.messages-chat__archived-icon {
  width: 1.25rem;
  height: 1.25rem;
}

/* Dialog styles */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  padding: 1.5rem;
  max-width: 500px;
  width: 90%;
}

.dialog__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.dialog__title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
}

.dialog__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: transparent;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: all 150ms ease;
}

.dialog__close:hover {
  background: var(--sidebar-hover);
}

.dialog__message {
  color: var(--sidebar-text-muted);
  margin: 0 0 1.5rem;
  line-height: 1.5;
  font-size: 0.875rem;
}

.dialog__actions {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.dialog__btn {
  padding: 0.5rem 1rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
  border: none;
}

.dialog__btn--secondary {
  background: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.dialog__btn--secondary:hover {
  opacity: 0.9;
}

.dialog__btn--danger {
  background: #ef4444;
  color: white;
}

.dialog__btn--danger:hover {
  background: #dc2626;
}
</style>
