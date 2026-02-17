<template>
  <div class="admin-customer-service">
    <PageLayout
      title="Customer Service"
      description="Manage support conversations and tickets"
      :show-header="true"
      :icon="Headset"
      :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Customer Service' }]"
    >
      <div class="admin-customer-service__container">
        <!-- Conversations List -->
        <div class="admin-customer-service__sidebar">
          <div class="admin-customer-service__sidebar-header">
            <div class="admin-customer-service__tabs">
              <button
                @click="statusFilter = 'open'"
                :class="['admin-customer-service__tab', { 'admin-customer-service__tab--active': statusFilter === 'open' }]"
              >
                Open
                <span v-if="openCount > 0" class="admin-customer-service__badge">{{ openCount }}</span>
              </button>
              <button
                @click="statusFilter = 'archived'"
                :class="['admin-customer-service__tab', { 'admin-customer-service__tab--active': statusFilter === 'archived' }]"
              >
                Archived
              </button>
            </div>
          </div>
          
          <div v-if="loadingConversations" class="admin-customer-service__loading">
            <Loader2 class="admin-customer-service__spinner" />
          </div>
          
          <div v-else-if="conversations.length === 0" class="admin-customer-service__empty">
            <Inbox class="admin-customer-service__empty-icon" />
            <p>No {{ statusFilter }} tickets</p>
          </div>
          
          <div v-else class="admin-customer-service__conversations">
            <div
              v-for="conv in conversations"
              :key="conv.id"
              @click="selectConversation(conv)"
              :class="[
                'admin-customer-service__conversation',
                { 'admin-customer-service__conversation--active': selectedConversation?.id === conv.id },
                { 'admin-customer-service__conversation--unread': hasUnreadMessages(conv) }
              ]"
            >
              <div class="admin-customer-service__conversation-header">
                <h4>{{ getUserName(conv) }}</h4>
                <span class="admin-customer-service__conversation-time">{{ formatTime(conv.last_message_at) }}</span>
              </div>
              <p class="admin-customer-service__conversation-preview">{{ conv.last_message_preview || 'No messages yet' }}</p>
            </div>
          </div>
        </div>

        <!-- Messages Panel -->
        <div class="admin-customer-service__main">
          <div v-if="!selectedConversation" class="admin-customer-service__placeholder">
            <Headset class="admin-customer-service__placeholder-icon" />
            <h3>Select a conversation</h3>
            <p>Choose a support ticket from the list to view and respond</p>
          </div>
          
          <div v-else class="admin-customer-service__chat">
            <div class="admin-customer-service__chat-header">
              <div class="admin-customer-service__chat-user">
                <User class="admin-customer-service__user-icon" />
                <div>
                  <h3>{{ getUserName(selectedConversation) }}</h3>
                  <p>{{ getUserEmail(selectedConversation) }}</p>
                </div>
              </div>
              <div class="admin-customer-service__chat-actions">
                <Button
                  v-if="selectedConversation.status === 'open'"
                  @click="archiveConversation"
                  variant="outline"
                  size="sm"
                >
                  <Archive class="admin-customer-service__button-icon" />
                  Archive
                </Button>
              </div>
            </div>
            
            <div class="admin-customer-service__messages" ref="messagesContainer">
              <div v-if="loadingMessages" class="admin-customer-service__loading">
                <Loader2 class="admin-customer-service__spinner" />
              </div>
              
              <div v-else class="admin-customer-service__messages-list">
                <div
                  v-for="message in messages"
                  :key="message.id"
                  :class="[
                    'admin-customer-service__message',
                    { 'admin-customer-service__message--system': message.message_type === 'system' },
                    { 'admin-customer-service__message--staff': isStaffMessage(message) }
                  ]"
                >
                  <div v-if="message.message_type === 'system'" class="admin-customer-service__message-system">
                    <p>{{ message.content }}</p>
                  </div>
                  <div v-else class="admin-customer-service__message-content">
                    <div class="admin-customer-service__message-header">
                      <span class="admin-customer-service__message-sender">
                        {{ getSenderName(message) }}
                      </span>
                      <span class="admin-customer-service__message-time">
                        {{ formatTime(message.inserted_at) }}
                      </span>
                    </div>
                    <p class="admin-customer-service__message-text">{{ message.content }}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div v-if="selectedConversation.status === 'open'" class="admin-customer-service__input">
              <textarea
                v-model="newMessage"
                @keydown.enter.prevent="sendMessage"
                placeholder="Type your response..."
                rows="3"
              ></textarea>
              <Button @click="sendMessage" :disabled="!newMessage.trim()">
                <Send class="admin-customer-service__button-icon" />
                Send
              </Button>
            </div>
            
            <div v-else class="admin-customer-service__archived-notice">
              <Archive class="admin-customer-service__archived-icon" />
              <p>This conversation is archived</p>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue';
import { Headset, Loader2, Inbox, User, Send, Archive } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import PageLayout from '@/components/PageLayout.vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);

const statusFilter = ref<'open' | 'archived'>('open');
const conversations = ref<any[]>([]);
const selectedConversation = ref<any>(null);
const messages = ref<any[]>([]);
const newMessage = ref('');
const loadingConversations = ref(false);
const loadingMessages = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);
const openCount = ref(0);

const loadConversations = async () => {
  loadingConversations.value = true;
  try {
    const response = await api.get('/admin/support/conversations', {
      params: { status: statusFilter.value }
    });
    conversations.value = response.data.conversations || [];
    
    if (statusFilter.value === 'open') {
      openCount.value = response.data.total || conversations.value.length;
    }
  } catch (error) {
    console.error('Failed to load conversations:', error);
  } finally {
    loadingConversations.value = false;
  }
};

const selectConversation = async (conv: any) => {
  selectedConversation.value = conv;
  await loadMessages(conv.id);
  await markAsRead(conv.id);
};

const loadMessages = async (conversationId: number) => {
  loadingMessages.value = true;
  try {
    const response = await api.get(`/admin/support/conversations/${conversationId}/messages`);
    messages.value = response.data.messages || [];
    await nextTick();
    scrollToBottom();
  } catch (error) {
    console.error('Failed to load messages:', error);
  } finally {
    loadingMessages.value = false;
  }
};

const sendMessage = async () => {
  if (!newMessage.value.trim() || !selectedConversation.value) return;
  
  try {
    const response = await api.post(
      `/admin/support/conversations/${selectedConversation.value.id}/messages`,
      { content: newMessage.value }
    );
    messages.value.push(response.data.message);
    newMessage.value = '';
    await nextTick();
    scrollToBottom();
  } catch (error) {
    console.error('Failed to send message:', error);
  }
};

const archiveConversation = async () => {
  if (!selectedConversation.value) return;
  
  try {
    await api.post(`/admin/support/conversations/${selectedConversation.value.id}/archive`);
    selectedConversation.value.status = 'archived';
    loadConversations();
  } catch (error) {
    console.error('Failed to archive conversation:', error);
  }
};

const markAsRead = async (conversationId: number) => {
  try {
    await api.post(`/admin/support/conversations/${conversationId}/read`);
  } catch (error) {
    console.error('Failed to mark as read:', error);
  }
};

const getUserName = (conv: any) => {
  const user = conv.participants?.find((p: any) => !p.user?.is_admin && !p.user?.is_moderator);
  return user?.user?.name || user?.user?.email || 'Unknown User';
};

const getUserEmail = (conv: any) => {
  const user = conv.participants?.find((p: any) => !p.user?.is_admin && !p.user?.is_moderator);
  return user?.user?.email || '';
};

const getSenderName = (message: any) => {
  const sender = selectedConversation.value?.participants?.find(
    (p: any) => p.user_id === message.sender_id
  );
  return sender?.user?.name || sender?.user?.email || 'Unknown';
};

const isStaffMessage = (message: any) => {
  const sender = selectedConversation.value?.participants?.find(
    (p: any) => p.user_id === message.sender_id
  );
  return sender?.user?.is_admin || sender?.user?.is_moderator;
};

const hasUnreadMessages = (conv: any) => {
  // Implement unread logic based on read_status if available
  return false;
};

const formatTime = (timestamp: string) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

watch(statusFilter, () => {
  loadConversations();
  selectedConversation.value = null;
  messages.value = [];
});

onMounted(() => {
  loadConversations();
});
</script>

<style scoped>
.admin-customer-service {
  width: 100%;
  min-height: 100%;
}

.admin-customer-service__container {
  display: grid;
  grid-template-columns: 350px 1fr;
  height: calc(100vh - 200px);
  gap: 1px;
  background: var(--border);
}

.admin-customer-service__sidebar {
  background: var(--background);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-customer-service__sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.admin-customer-service__tabs {
  display: flex;
  gap: 0.5rem;
}

.admin-customer-service__tab {
  flex: 1;
  padding: 0.5rem 1rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  background: transparent;
  cursor: pointer;
  font-size: 0.875rem;
  font-weight: 500;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.admin-customer-service__tab:hover {
  background: var(--accent);
}

.admin-customer-service__tab--active {
  background: var(--primary);
  color: var(--primary-foreground);
  border-color: var(--primary);
}

.admin-customer-service__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.375rem;
  background: var(--primary-foreground);
  color: var(--primary);
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
}

.admin-customer-service__conversations {
  flex: 1;
  overflow-y: auto;
}

.admin-customer-service__conversation {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.2s;
}

.admin-customer-service__conversation:hover {
  background: var(--accent);
}

.admin-customer-service__conversation--active {
  background: var(--accent);
  border-left: 3px solid var(--primary);
}

.admin-customer-service__conversation--unread {
  background: rgba(59, 130, 246, 0.05);
}

.admin-customer-service__conversation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.admin-customer-service__conversation-header h4 {
  font-size: 0.875rem;
  font-weight: 600;
  margin: 0;
}

.admin-customer-service__conversation-time {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.admin-customer-service__conversation-preview {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-customer-service__main {
  background: var(--background);
  display: flex;
  flex-direction: column;
}

.admin-customer-service__placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--muted-foreground);
}

.admin-customer-service__placeholder-icon {
  width: 4rem;
  height: 4rem;
  opacity: 0.5;
}

.admin-customer-service__chat {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.admin-customer-service__chat-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-customer-service__chat-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.admin-customer-service__user-icon {
  width: 2.5rem;
  height: 2.5rem;
  padding: 0.5rem;
  background: var(--accent);
  border-radius: 50%;
}

.admin-customer-service__chat-user h3 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0;
}

.admin-customer-service__chat-user p {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  margin: 0;
}

.admin-customer-service__messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.admin-customer-service__messages-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.admin-customer-service__message {
  display: flex;
  flex-direction: column;
}

.admin-customer-service__message--system {
  align-items: center;
}

.admin-customer-service__message--staff {
  align-items: flex-end;
}

.admin-customer-service__message-system {
  max-width: 80%;
  padding: 0.75rem 1rem;
  background: var(--muted);
  border-radius: 0.5rem;
  text-align: center;
}

.admin-customer-service__message-system p {
  font-size: 0.875rem;
  color: var(--muted-foreground);
  margin: 0;
}

.admin-customer-service__message-content {
  max-width: 70%;
  background: var(--accent);
  padding: 0.75rem;
  border-radius: 0.5rem;
}

.admin-customer-service__message--staff .admin-customer-service__message-content {
  background: var(--primary);
  color: var(--primary-foreground);
}

.admin-customer-service__message-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
}

.admin-customer-service__message-sender {
  font-weight: 600;
}

.admin-customer-service__message-time {
  opacity: 0.7;
}

.admin-customer-service__message-text {
  font-size: 0.875rem;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.admin-customer-service__input {
  padding: 1rem;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 0.5rem;
}

.admin-customer-service__input textarea {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  resize: none;
  font-family: inherit;
}

.admin-customer-service__archived-notice {
  padding: 1rem;
  border-top: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  color: var(--muted-foreground);
}

.admin-customer-service__archived-icon {
  width: 1.25rem;
  height: 1.25rem;
}

.admin-customer-service__loading,
.admin-customer-service__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--muted-foreground);
}

.admin-customer-service__spinner {
  width: 2rem;
  height: 2rem;
  animation: spin 1s linear infinite;
}

.admin-customer-service__empty-icon {
  width: 3rem;
  height: 3rem;
  opacity: 0.5;
  margin-bottom: 0.5rem;
}

.admin-customer-service__button-icon {
  width: 1rem;
  height: 1rem;
  margin-right: 0.5rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.admin-customer-service__content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.admin-customer-service__placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  padding: 4rem 2rem;
  text-align: center;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.admin-customer-service__placeholder-icon {
  width: 4rem;
  height: 4rem;
  color: var(--muted-foreground);
}

.admin-customer-service__placeholder h2 {
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0;
}

.admin-customer-service__placeholder p {
  color: var(--muted-foreground);
  margin: 0;
}

.admin-customer-service__note {
  font-size: 0.875rem;
  max-width: 600px;
  margin-top: 1rem;
  padding: 1rem;
  background: var(--muted);
  border-radius: 6px;
}
</style>
