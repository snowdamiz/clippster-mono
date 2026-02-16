<template>
  <div class="admin-staff-messages">
    <PageLayout
      title="Staff Messages"
      description="Internal messaging for admins and moderators"
      :show-header="true"
      :icon="MessagesSquare"
    >
      <div class="admin-staff-messages__container">
        <!-- Conversations List -->
        <div class="admin-staff-messages__sidebar">
          <div class="admin-staff-messages__sidebar-header">
            <h3>Conversations</h3>
            <Button @click="showNewConversationDialog = true" size="sm">
              <Plus class="admin-staff-messages__button-icon" />
              New
            </Button>
          </div>
          
          <div v-if="loadingConversations" class="admin-staff-messages__loading">
            <Loader2 class="admin-staff-messages__spinner" />
          </div>
          
          <div v-else-if="conversations.length === 0" class="admin-staff-messages__empty">
            <MessagesSquare class="admin-staff-messages__empty-icon" />
            <p>No conversations yet</p>
          </div>
          
          <div v-else class="admin-staff-messages__conversations">
            <div
              v-for="conv in conversations"
              :key="conv.id"
              @click="selectConversation(conv)"
              :class="[
                'admin-staff-messages__conversation',
                { 'admin-staff-messages__conversation--active': selectedConversation?.id === conv.id }
              ]"
            >
              <div class="admin-staff-messages__conversation-info">
                <h4>{{ getConversationName(conv) }}</h4>
                <p>{{ conv.last_message_preview || 'No messages yet' }}</p>
              </div>
              <div class="admin-staff-messages__conversation-meta">
                <span v-if="conv.last_message_at">{{ formatTime(conv.last_message_at) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Messages Panel -->
        <div class="admin-staff-messages__main">
          <div v-if="!selectedConversation" class="admin-staff-messages__placeholder">
            <MessagesSquare class="admin-staff-messages__placeholder-icon" />
            <h3>Select a conversation</h3>
            <p>Choose a conversation from the list to view messages</p>
          </div>
          
          <div v-else class="admin-staff-messages__chat">
            <div class="admin-staff-messages__chat-header">
              <h3>{{ getConversationName(selectedConversation) }}</h3>
              <p>{{ getParticipantNames(selectedConversation) }}</p>
            </div>
            
            <div class="admin-staff-messages__messages" ref="messagesContainer">
              <div v-if="loadingMessages" class="admin-staff-messages__loading">
                <Loader2 class="admin-staff-messages__spinner" />
              </div>
              
              <div v-else-if="messages.length === 0" class="admin-staff-messages__no-messages">
                <p>No messages yet. Start the conversation!</p>
              </div>
              
              <div v-else class="admin-staff-messages__messages-list">
                <div
                  v-for="message in messages"
                  :key="message.id"
                  :class="[
                    'admin-staff-messages__message',
                    { 'admin-staff-messages__message--own': message.sender_id === currentUserId }
                  ]"
                >
                  <div class="admin-staff-messages__message-content">
                    <div class="admin-staff-messages__message-header">
                      <span class="admin-staff-messages__message-sender">
                        {{ getSenderName(message) }}
                      </span>
                      <span class="admin-staff-messages__message-time">
                        {{ formatTime(message.inserted_at) }}
                      </span>
                    </div>
                    <p class="admin-staff-messages__message-text">{{ message.content }}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div class="admin-staff-messages__input">
              <textarea
                v-model="newMessage"
                @keydown.enter.prevent="sendMessage"
                placeholder="Type a message..."
                rows="3"
              ></textarea>
              <Button @click="sendMessage" :disabled="!newMessage.trim()">
                <Send class="admin-staff-messages__button-icon" />
                Send
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- New Conversation Dialog -->
    <Dialog v-model:open="showNewConversationDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Staff Conversation</DialogTitle>
        </DialogHeader>
        <div class="admin-staff-messages__dialog-content">
          <div class="admin-staff-messages__dialog-field">
            <label>Type</label>
            <select v-model="newConversationType">
              <option value="direct">Direct Message</option>
              <option value="group">Group Chat</option>
            </select>
          </div>
          
          <div v-if="newConversationType === 'group'" class="admin-staff-messages__dialog-field">
            <label>Group Name</label>
            <input v-model="newConversationName" type="text" placeholder="Enter group name" />
          </div>
          
          <div class="admin-staff-messages__dialog-field">
            <label>{{ newConversationType === 'direct' ? 'Recipient' : 'Participants' }}</label>
            <select v-model="selectedStaffMembers" :multiple="newConversationType === 'group'">
              <option v-for="staff in staffMembers" :key="staff.id" :value="staff.id">
                {{ staff.name || staff.email }}
              </option>
            </select>
          </div>
          
          <div class="admin-staff-messages__dialog-actions">
            <Button @click="showNewConversationDialog = false" variant="outline">Cancel</Button>
            <Button @click="createConversation" :disabled="!canCreateConversation">Create</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { MessagesSquare, Plus, Send, Loader2 } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PageLayout from '@/components/PageLayout.vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);

const conversations = ref<any[]>([]);
const selectedConversation = ref<any>(null);
const messages = ref<any[]>([]);
const newMessage = ref('');
const loadingConversations = ref(false);
const loadingMessages = ref(false);
const messagesContainer = ref<HTMLElement | null>(null);

const showNewConversationDialog = ref(false);
const newConversationType = ref<'direct' | 'group'>('direct');
const newConversationName = ref('');
const selectedStaffMembers = ref<number[]>([]);
const staffMembers = ref<any[]>([]);

const canCreateConversation = computed(() => {
  if (newConversationType.value === 'direct') {
    return selectedStaffMembers.value.length === 1;
  } else {
    return newConversationName.value.trim() && selectedStaffMembers.value.length > 0;
  }
});

const loadConversations = async () => {
  loadingConversations.value = true;
  try {
    const response = await api.get('/staff/conversations');
    conversations.value = response.data.conversations || [];
  } catch (error) {
    console.error('Failed to load conversations:', error);
  } finally {
    loadingConversations.value = false;
  }
};

const loadStaffMembers = async () => {
  try {
    const response = await api.get('/admin/users');
    staffMembers.value = (response.data.users || []).filter(
      (u: any) => (u.is_admin || u.is_moderator) && u.id !== currentUserId.value
    );
  } catch (error) {
    console.error('Failed to load staff members:', error);
  }
};

const selectConversation = async (conv: any) => {
  selectedConversation.value = conv;
  await loadMessages(conv.id);
};

const loadMessages = async (conversationId: number) => {
  loadingMessages.value = true;
  try {
    const response = await api.get(`/staff/conversations/${conversationId}/messages`);
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
      `/staff/conversations/${selectedConversation.value.id}/messages`,
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

const createConversation = async () => {
  try {
    let response;
    if (newConversationType.value === 'direct') {
      response = await api.post('/staff/conversations/direct', {
        target_user_id: selectedStaffMembers.value[0]
      });
    } else {
      response = await api.post('/staff/conversations/group', {
        name: newConversationName.value,
        participant_ids: selectedStaffMembers.value
      });
    }
    
    conversations.value.unshift(response.data.conversation);
    showNewConversationDialog.value = false;
    newConversationType.value = 'direct';
    newConversationName.value = '';
    selectedStaffMembers.value = [];
    
    selectConversation(response.data.conversation);
  } catch (error) {
    console.error('Failed to create conversation:', error);
  }
};

const getConversationName = (conv: any) => {
  if (conv.name) return conv.name;
  if (conv.type === 'direct') {
    const otherParticipant = conv.participants?.find((p: any) => p.user_id !== currentUserId.value);
    return otherParticipant?.user?.name || otherParticipant?.user?.email || 'Unknown';
  }
  return 'Group Chat';
};

const getParticipantNames = (conv: any) => {
  if (!conv.participants) return '';
  return conv.participants
    .map((p: any) => p.user?.name || p.user?.email)
    .filter(Boolean)
    .join(', ');
};

const getSenderName = (message: any) => {
  const sender = selectedConversation.value?.participants?.find(
    (p: any) => p.user_id === message.sender_id
  );
  return sender?.user?.name || sender?.user?.email || 'Unknown';
};

const formatTime = (timestamp: string) => {
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

onMounted(() => {
  loadConversations();
  loadStaffMembers();
});
</script>

<style scoped>
.admin-staff-messages {
  width: 100%;
  min-height: 100%;
}

.admin-staff-messages__container {
  display: grid;
  grid-template-columns: 300px 1fr;
  height: calc(100vh - 200px);
  gap: 1px;
  background: var(--border);
}

.admin-staff-messages__sidebar {
  background: var(--background);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-staff-messages__sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.admin-staff-messages__conversations {
  flex: 1;
  overflow-y: auto;
}

.admin-staff-messages__conversation {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  transition: background 0.2s;
}

.admin-staff-messages__conversation:hover {
  background: var(--accent);
}

.admin-staff-messages__conversation--active {
  background: var(--accent);
  border-left: 3px solid var(--primary);
}

.admin-staff-messages__conversation-info h4 {
  font-size: 0.875rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
}

.admin-staff-messages__conversation-info p {
  font-size: 0.75rem;
  color: var(--muted-foreground);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-staff-messages__main {
  background: var(--background);
  display: flex;
  flex-direction: column;
}

.admin-staff-messages__placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: var(--muted-foreground);
}

.admin-staff-messages__placeholder-icon {
  width: 4rem;
  height: 4rem;
  opacity: 0.5;
}

.admin-staff-messages__chat {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.admin-staff-messages__chat-header {
  padding: 1rem;
  border-bottom: 1px solid var(--border);
}

.admin-staff-messages__chat-header h3 {
  font-size: 1rem;
  font-weight: 600;
}

.admin-staff-messages__chat-header p {
  font-size: 0.75rem;
  color: var(--muted-foreground);
}

.admin-staff-messages__messages {
  flex: 1;
  overflow-y: auto;
  padding: 1rem;
}

.admin-staff-messages__messages-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.admin-staff-messages__message {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.admin-staff-messages__message--own {
  align-items: flex-end;
}

.admin-staff-messages__message-content {
  max-width: 70%;
  background: var(--accent);
  padding: 0.75rem;
  border-radius: 0.5rem;
}

.admin-staff-messages__message--own .admin-staff-messages__message-content {
  background: var(--primary);
  color: var(--primary-foreground);
}

.admin-staff-messages__message-header {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
  font-size: 0.75rem;
}

.admin-staff-messages__message-sender {
  font-weight: 600;
}

.admin-staff-messages__message-time {
  opacity: 0.7;
}

.admin-staff-messages__message-text {
  font-size: 0.875rem;
  white-space: pre-wrap;
  word-break: break-word;
}

.admin-staff-messages__input {
  padding: 1rem;
  border-top: 1px solid var(--border);
  display: flex;
  gap: 0.5rem;
}

.admin-staff-messages__input textarea {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
  resize: none;
  font-family: inherit;
}

.admin-staff-messages__loading,
.admin-staff-messages__empty,
.admin-staff-messages__no-messages {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  color: var(--muted-foreground);
}

.admin-staff-messages__spinner {
  width: 2rem;
  height: 2rem;
  animation: spin 1s linear infinite;
}

.admin-staff-messages__empty-icon {
  width: 3rem;
  height: 3rem;
  opacity: 0.5;
  margin-bottom: 0.5rem;
}

.admin-staff-messages__button-icon {
  width: 1rem;
  height: 1rem;
  margin-right: 0.5rem;
}

.admin-staff-messages__dialog-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.admin-staff-messages__dialog-field label {
  display: block;
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.admin-staff-messages__dialog-field input,
.admin-staff-messages__dialog-field select {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid var(--border);
  border-radius: 0.375rem;
}

.admin-staff-messages__dialog-field select[multiple] {
  min-height: 150px;
}

.admin-staff-messages__dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  margin-top: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
