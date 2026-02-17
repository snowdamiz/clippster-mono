<template>
  <div class="admin-staff-messages">
    <PageLayout
      title="Staff Messages"
      description="Internal messaging for admins and moderators"
      :show-header="true"
      :icon="MessagesSquare"
      :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Staff Messages' }]"
    >
      <template #actions>
        <button @click="showNewConversationDialog = true" class="admin-staff-messages-header__new-btn">
          <Plus class="admin-staff-messages-header__new-btn-icon" />
          New Conversation
        </button>
      </template>

      <div class="admin-staff-messages__content">
        <!-- Page Heading -->
        <div class="admin-staff-messages__heading">
          <h1 class="admin-staff-messages__title">Staff Messages</h1>
          <p class="admin-staff-messages__subtitle">Internal messaging for admins and moderators</p>
        </div>

        <!-- Main Messages Container -->
        <div class="admin-staff-messages__main">
          <!-- Conversations Panel (Left) -->
          <div class="admin-staff-messages-panel">
            <div class="admin-staff-messages-panel__inner">
              <!-- Panel Header -->
              <div class="admin-staff-messages-panel__header">
                <div class="admin-staff-messages-panel__header-left">
                  <div class="admin-staff-messages-panel__header-icon">
                    <MessagesSquare />
                  </div>
                  <div class="admin-staff-messages-panel__header-text">
                    <h2 class="admin-staff-messages-panel__title">Conversations</h2>
                    <p class="admin-staff-messages-panel__subtitle">
                      {{ conversations.length }} {{ conversations.length === 1 ? 'chat' : 'chats' }}
                    </p>
                  </div>
                </div>
                <button @click="showNewConversationDialog = true" class="admin-staff-messages-panel__new-btn" title="New conversation">
                  <Plus class="admin-staff-messages-panel__new-btn-icon" />
                </button>
              </div>

              <!-- Conversations List -->
              <div class="admin-staff-messages-panel__list">
                <!-- Loading Skeleton -->
                <template v-if="loadingConversations">
                  <div v-for="i in 4" :key="i" class="admin-staff-messages-conv-skeleton">
                    <div class="admin-staff-messages-conv-skeleton__avatar"></div>
                    <div class="admin-staff-messages-conv-skeleton__content">
                      <div class="admin-staff-messages-conv-skeleton__line admin-staff-messages-conv-skeleton__line--name"></div>
                      <div class="admin-staff-messages-conv-skeleton__line admin-staff-messages-conv-skeleton__line--preview"></div>
                    </div>
                  </div>
                </template>

                <!-- Conversations -->
                <template v-else>
                  <div
                    v-for="conv in conversations"
                    :key="conv.id"
                    class="admin-staff-messages-conv"
                    :class="{ 'admin-staff-messages-conv--active': conv.id === selectedConversation?.id }"
                    @click="selectConversation(conv)"
                  >
                    <div
                      class="admin-staff-messages-conv__indicator"
                      :class="{ 'admin-staff-messages-conv__indicator--active': conv.id === selectedConversation?.id }"
                    ></div>
                    <div class="admin-staff-messages-conv__inner">
                      <!-- Avatar -->
                      <div class="admin-staff-messages-conv__avatar-wrapper">
                        <div
                          class="admin-staff-messages-conv__avatar"
                          :class="{
                            'admin-staff-messages-conv__avatar--direct': conv.type === 'direct',
                            'admin-staff-messages-conv__avatar--group': conv.type === 'group',
                          }"
                        >
                          <Users v-if="conv.type === 'group'" class="admin-staff-messages-conv__avatar-icon" />
                          <span v-else class="admin-staff-messages-conv__avatar-initial">
                            {{ getConversationName(conv).charAt(0).toUpperCase() }}
                          </span>
                        </div>
                      </div>

                      <!-- Content -->
                      <div class="admin-staff-messages-conv__content">
                        <div class="admin-staff-messages-conv__header">
                          <span class="admin-staff-messages-conv__name">{{ getConversationName(conv) }}</span>
                          <span class="admin-staff-messages-conv__time">{{ formatTime(conv.last_message_at) }}</span>
                        </div>
                        <div class="admin-staff-messages-conv__footer">
                          <span class="admin-staff-messages-conv__preview">{{ conv.last_message_preview || 'No messages yet' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Empty State -->
                  <div v-if="conversations.length === 0" class="admin-staff-messages-panel__empty">
                    <div class="admin-staff-messages-panel__empty-icon">
                      <MessageSquare />
                    </div>
                    <p class="admin-staff-messages-panel__empty-title">No conversations yet</p>
                    <p class="admin-staff-messages-panel__empty-text">Start chatting with staff members</p>
                    <button @click="showNewConversationDialog = true" class="admin-staff-messages-panel__empty-btn">
                      <Plus class="admin-staff-messages-panel__empty-btn-icon" />
                      New Conversation
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Chat Panel (Right) -->
          <div class="admin-staff-messages-chat">
            <div class="admin-staff-messages-chat__inner">
              <template v-if="selectedConversation">
                <!-- Chat Header -->
                <div class="admin-staff-messages-chat__header">
                  <div class="admin-staff-messages-chat__header-left">
                    <div
                      class="admin-staff-messages-chat__avatar"
                      :class="{
                        'admin-staff-messages-chat__avatar--direct': selectedConversation.type === 'direct',
                        'admin-staff-messages-chat__avatar--group': selectedConversation.type === 'group',
                      }"
                    >
                      <Users v-if="selectedConversation.type === 'group'" class="admin-staff-messages-chat__avatar-icon" />
                      <span v-else class="admin-staff-messages-chat__avatar-initial">
                        {{ getConversationName(selectedConversation).charAt(0).toUpperCase() }}
                      </span>
                    </div>
                    <div class="admin-staff-messages-chat__header-info">
                      <h3 class="admin-staff-messages-chat__name">{{ getConversationName(selectedConversation) }}</h3>
                      <p class="admin-staff-messages-chat__meta">
                        {{ selectedConversation.type === 'direct' ? 'Direct message' : `${selectedConversation.participants?.length || 0} members` }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Messages Container -->
                <div ref="messagesContainer" class="admin-staff-messages-chat__messages">
                  <!-- Loading Messages -->
                  <div v-if="loadingMessages" class="admin-staff-messages-chat__loading">
                    <Loader2 class="admin-staff-messages-chat__loading-spinner" />
                  </div>

                  <!-- Messages List -->
                  <div
                    v-for="message in messages"
                    :key="message.id"
                    class="message-row"
                    :class="{ 'message-row--sent': message.sender_id === currentUserId }"
                  >
                    <div
                      class="message-bubble"
                      :class="{
                        'message-bubble--sent': message.sender_id === currentUserId,
                        'message-bubble--received': message.sender_id !== currentUserId,
                      }"
                    >
                      <!-- Sender Name -->
                      <div v-if="message.sender_id !== currentUserId" class="message-bubble__sender">
                        {{ getSenderName(message) }}
                      </div>

                      <!-- Message Content -->
                      <p class="message-bubble__content">{{ message.content }}</p>

                      <!-- Meta Info -->
                      <div class="message-bubble__meta">
                        <span class="message-bubble__time">{{ formatMessageTime(message.inserted_at) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Message Input -->
                <div class="admin-staff-messages-chat__input-area">
                  <textarea
                    v-model="newMessage"
                    placeholder="Write a message..."
                    rows="1"
                    @keydown.enter.prevent="sendMessage"
                    class="admin-staff-messages-chat__input"
                  ></textarea>
                  <button
                    class="admin-staff-messages-chat__send-btn"
                    :class="{ 'admin-staff-messages-chat__send-btn--disabled': !newMessage.trim() }"
                    :disabled="!newMessage.trim()"
                    @click="sendMessage"
                  >
                    <Send class="admin-staff-messages-chat__send-icon" />
                  </button>
                </div>
              </template>

              <!-- No Conversation Selected -->
              <div v-else class="admin-staff-messages-chat__empty">
                <div class="admin-staff-messages-chat__empty-icon">
                  <MessageSquare />
                </div>
                <h2 class="admin-staff-messages-chat__empty-title">Select a conversation</h2>
                <p class="admin-staff-messages-chat__empty-text">Choose from your existing conversations or start a new one</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- New Conversation Dialog -->
    <Teleport to="body">
      <Transition name="staff-modal">
        <div v-if="showNewConversationDialog" class="staff-modal__overlay" @click.self="showNewConversationDialog = false">
          <Transition name="staff-dialog" appear>
            <div class="staff-modal">
              <!-- Accent Bar -->
              <div class="staff-modal__accent" />

              <!-- Header -->
              <div class="staff-modal__header">
                <button class="staff-modal__close" @click="showNewConversationDialog = false" title="Close">
                  <X :size="18" />
                </button>
                <div class="staff-modal__icon">
                  <MessagesSquare :size="24" />
                </div>
                <h2 class="staff-modal__title">New Staff Conversation</h2>
                <p class="staff-modal__subtitle">Start a conversation with staff members</p>
              </div>

              <!-- Content -->
              <div class="staff-content">
                <!-- Conversation Type -->
                <div class="staff-section">
                  <h3 class="staff-section__title">Conversation Type</h3>
                  <div class="staff-field">
                    <label class="staff-field__label">
                      Type
                      <span class="staff-field__required">*</span>
                    </label>
                    <CustomDropdown
                      v-model="newConversationType"
                      :options="conversationTypeOptions"
                      placeholder="Select type"
                      trigger-class="staff-field__dropdown-trigger"
                    />
                  </div>
                </div>

                <!-- Group Name (if group type) -->
                <div v-if="newConversationType === 'group'" class="staff-section">
                  <h3 class="staff-section__title">Group Details</h3>
                  <div class="staff-field">
                    <label for="group-name" class="staff-field__label">
                      Group Name
                      <span class="staff-field__required">*</span>
                    </label>
                    <input
                      id="group-name"
                      v-model="newConversationName"
                      type="text"
                      placeholder="Enter group name"
                      class="staff-field__input"
                    />
                  </div>
                </div>

                <!-- Recipient/Participants -->
                <div class="staff-section">
                  <h3 class="staff-section__title">{{ newConversationType === 'direct' ? 'Recipient' : 'Participants' }}</h3>
                  <div class="staff-field">
                    <label class="staff-field__label">
                      {{ newConversationType === 'direct' ? 'Select Recipient' : 'Select Participants' }}
                      <span class="staff-field__required">*</span>
                    </label>
                    <CustomDropdown
                      v-model="selectedStaffMembers"
                      :options="staffMemberOptions"
                      :placeholder="newConversationType === 'direct' ? 'Select recipient' : 'Select participants'"
                      trigger-class="staff-field__dropdown-trigger"
                    />
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="staff-modal__footer">
                <button
                  type="button"
                  @click="showNewConversationDialog = false"
                  class="staff-btn staff-btn--secondary"
                >
                  Cancel
                </button>
                <button
                  @click="createConversation"
                  :disabled="!canCreateConversation"
                  class="staff-btn staff-btn--primary"
                >
                  Create Conversation
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { MessagesSquare, Plus, Send, Loader2, Users, MessageSquare, X } from 'lucide-vue-next';
import CustomDropdown from '@/components/CustomDropdown.vue';
import PageLayout from '@/components/PageLayout.vue';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';

const authStore = useAuthStore();
const currentUserId = computed(() => authStore.user?.id);

const conversationTypeOptions = [
  { label: 'Direct Message', value: 'direct' },
  { label: 'Group Chat', value: 'group' },
];

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
const selectedStaffMembers = ref<number | number[]>(0);
const staffMembers = ref<any[]>([]);

const staffMemberOptions = computed(() => 
  staffMembers.value.map(staff => ({
    label: staff.name || staff.email,
    value: staff.id
  }))
);

const canCreateConversation = computed(() => {
  if (newConversationType.value === 'direct') {
    return typeof selectedStaffMembers.value === 'number' && selectedStaffMembers.value > 0;
  } else {
    return newConversationName.value.trim() && Array.isArray(selectedStaffMembers.value) && selectedStaffMembers.value.length > 0;
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
        target_user_id: selectedStaffMembers.value
      });
    } else {
      response = await api.post('/staff/conversations/group', {
        name: newConversationName.value,
        participant_ids: Array.isArray(selectedStaffMembers.value) ? selectedStaffMembers.value : [selectedStaffMembers.value]
      });
    }
    
    conversations.value.unshift(response.data.conversation);
    showNewConversationDialog.value = false;
    newConversationType.value = 'direct';
    newConversationName.value = '';
    selectedStaffMembers.value = 0;
    
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
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
};

const formatMessageTime = (timestamp: string) => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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
/* ===== Header Actions ===== */
.admin-staff-messages-header__new-btn {
  height: 32px;
  padding: 0 0.75rem;
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  background-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
  border: none;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.admin-staff-messages-header__new-btn:hover {
  opacity: 0.9;
}

.admin-staff-messages-header__new-btn-icon {
  width: 14px;
  height: 14px;
}

/* ===== Page Container ===== */
.admin-staff-messages {
  width: 100%;
  height: 100%;
}

.admin-staff-messages__content {
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

/* ===== Page Heading ===== */
.admin-staff-messages__heading {
  flex-shrink: 0;
}

.admin-staff-messages__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0 0 0.2rem;
  letter-spacing: -0.02em;
}

.admin-staff-messages__subtitle {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  line-height: 1.5;
}

/* ===== Main Container ===== */
.admin-staff-messages__main {
  display: flex;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  margin-top: 0.8rem;
  overflow: hidden;
}

/* ===== Conversations Panel ===== */
.admin-staff-messages-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  background-color: var(--sidebar-surface);
  border-radius: 10px;
  overflow: hidden;
}

.admin-staff-messages-panel__inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.admin-staff-messages-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.875rem;
  padding: 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.admin-staff-messages-panel__header-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.admin-staff-messages-panel__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: rgba(6, 182, 212, 0.15);
  flex-shrink: 0;
}

.admin-staff-messages-panel__header-icon svg {
  width: 20px;
  height: 20px;
  color: var(--sidebar-accent);
  stroke: var(--sidebar-accent);
}

.admin-staff-messages-panel__title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.admin-staff-messages-panel__subtitle {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0.125rem 0 0;
}

.admin-staff-messages-panel__new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
}

.admin-staff-messages-panel__new-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.admin-staff-messages-panel__new-btn-icon {
  width: 18px;
  height: 18px;
}

/* Conversations List */
.admin-staff-messages-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.admin-staff-messages-panel__list::-webkit-scrollbar {
  width: 6px;
}

.admin-staff-messages-panel__list::-webkit-scrollbar-track {
  background: transparent;
}

.admin-staff-messages-panel__list::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

/* Conversation Item */
.admin-staff-messages-conv {
  display: flex;
  margin-bottom: 0.375rem;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 150ms ease;
}

.admin-staff-messages-conv:hover {
  background-color: var(--sidebar-hover);
}

.admin-staff-messages-conv--active {
  background-color: var(--sidebar-active);
}

.admin-staff-messages-conv__indicator {
  width: 3px;
  flex-shrink: 0;
  background-color: transparent;
  border-radius: 3px 0 0 3px;
}

.admin-staff-messages-conv__indicator--active {
  background-color: var(--sidebar-accent);
}

.admin-staff-messages-conv__inner {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
}

.admin-staff-messages-conv__avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.admin-staff-messages-conv__avatar {
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

.admin-staff-messages-conv__avatar--direct {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
}

.admin-staff-messages-conv__avatar--group {
  background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
}

.admin-staff-messages-conv__avatar-icon {
  width: 20px;
  height: 20px;
}

.admin-staff-messages-conv__avatar-initial {
  font-size: 1rem;
  font-weight: 600;
}

.admin-staff-messages-conv__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.admin-staff-messages-conv__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.admin-staff-messages-conv__name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-staff-messages-conv__time {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  flex-shrink: 0;
}

.admin-staff-messages-conv__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.admin-staff-messages-conv__preview {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* Empty State */
.admin-staff-messages-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
}

.admin-staff-messages-panel__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background-color: var(--sidebar-hover);
  border-radius: 12px;
  margin-bottom: 1rem;
  color: var(--sidebar-text-muted);
}

.admin-staff-messages-panel__empty-icon svg {
  width: 24px;
  height: 24px;
}

.admin-staff-messages-panel__empty-title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--sidebar-text);
  margin: 0 0 0.25rem;
}

.admin-staff-messages-panel__empty-text {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0 0 1.25rem;
}

.admin-staff-messages-panel__empty-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.625rem 1rem;
  background-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.admin-staff-messages-panel__empty-btn:hover {
  opacity: 0.9;
}

.admin-staff-messages-panel__empty-btn-icon {
  width: 14px;
  height: 14px;
}

/* Skeleton Loading */
.admin-staff-messages-conv-skeleton {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.375rem;
}

.admin-staff-messages-conv-skeleton__avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.admin-staff-messages-conv-skeleton__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.admin-staff-messages-conv-skeleton__line {
  background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.admin-staff-messages-conv-skeleton__line--name {
  height: 14px;
  width: 60%;
}

.admin-staff-messages-conv-skeleton__line--preview {
  height: 12px;
  width: 80%;
}

/* ===== Chat Panel ===== */
.admin-staff-messages-chat {
  flex: 1;
  display: flex;
  background-color: var(--sidebar-surface);
  border-radius: 10px;
  overflow: hidden;
}

.admin-staff-messages-chat__inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Chat Header */
.admin-staff-messages-chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
  background-color: rgba(0, 0, 0, 0.15);
}

.admin-staff-messages-chat__header-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.admin-staff-messages-chat__avatar {
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

.admin-staff-messages-chat__avatar--direct {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
}

.admin-staff-messages-chat__avatar--group {
  background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
}

.admin-staff-messages-chat__avatar-icon {
  width: 20px;
  height: 20px;
}

.admin-staff-messages-chat__avatar-initial {
  font-size: 1rem;
  font-weight: 600;
}

.admin-staff-messages-chat__header-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.admin-staff-messages-chat__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.admin-staff-messages-chat__meta {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

/* Messages Container */
.admin-staff-messages-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.admin-staff-messages-chat__messages::-webkit-scrollbar {
  width: 6px;
}

.admin-staff-messages-chat__messages::-webkit-scrollbar-track {
  background: transparent;
}

.admin-staff-messages-chat__messages::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.admin-staff-messages-chat__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.admin-staff-messages-chat__loading-spinner {
  width: 24px;
  height: 24px;
  color: var(--sidebar-accent);
  animation: spin 0.8s linear infinite;
}

/* Message Row */
.message-row {
  display: flex;
  justify-content: flex-start;
}

.message-row--sent {
  justify-content: flex-end;
}

/* Message Bubble */
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

.message-bubble__sender {
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--sidebar-accent);
  margin-bottom: 0.375rem;
}

.message-bubble__content {
  font-size: 0.875rem;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}

.message-bubble__meta {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  margin-top: 0.375rem;
}

.message-bubble__time {
  font-size: 0.625rem;
  opacity: 0.7;
}

.message-bubble--sent .message-bubble__time {
  color: white;
  opacity: 1;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

/* Input Area */
.admin-staff-messages-chat__input-area {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--sidebar-border);
  background-color: rgba(0, 0, 0, 0.15);
}

.admin-staff-messages-chat__input {
  flex: 1;
  padding: 0.75rem 1rem;
  background-color: var(--sidebar-hover);
  border: 1px solid transparent;
  border-radius: 12px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  resize: none;
  max-height: 120px;
  transition: all 150ms ease;
}

.admin-staff-messages-chat__input::placeholder {
  color: var(--sidebar-text-muted);
}

.admin-staff-messages-chat__input:hover {
  border-color: var(--sidebar-border);
}

.admin-staff-messages-chat__input:focus {
  outline: none;
  border-color: var(--sidebar-border);
  background-color: var(--sidebar-surface);
}

.admin-staff-messages-chat__send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: all 150ms ease;
  flex-shrink: 0;
}

.admin-staff-messages-chat__send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.admin-staff-messages-chat__send-btn--disabled {
  background: var(--sidebar-hover);
  color: var(--sidebar-text-muted);
  cursor: not-allowed;
}

.admin-staff-messages-chat__send-icon {
  width: 20px;
  height: 20px;
}

/* Empty State */
.admin-staff-messages-chat__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.admin-staff-messages-chat__empty-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 72px;
  background-color: var(--sidebar-hover);
  border-radius: 16px;
  margin-bottom: 1.5rem;
  color: var(--sidebar-text-muted);
}

.admin-staff-messages-chat__empty-icon svg {
  width: 32px;
  height: 32px;
}

.admin-staff-messages-chat__empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.5rem;
}

.admin-staff-messages-chat__empty-text {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  max-width: 280px;
}

/* ===== Modal Overlay & Container ===== */
.staff-modal__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 1rem;
}

.staff-modal {
  position: relative;
  width: 100%;
  max-width: 480px;
  max-height: 90vh;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.staff-modal__accent {
  height: 3px;
  background: linear-gradient(90deg, #06b6d4 0%, #0891b2 100%);
  flex-shrink: 0;
}

/* ===== Modal Header ===== */
.staff-modal__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
  text-align: center;
}

.staff-modal__close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background-color: transparent;
  border: none;
  border-radius: 6px;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.staff-modal__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.staff-modal__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 52px;
  height: 52px;
  border-radius: 12px;
  margin-bottom: 0.875rem;
  background-color: rgba(6, 182, 212, 0.15);
  color: #06b6d4;
}

.staff-modal__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.staff-modal__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

/* ===== Content Area ===== */
.staff-content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.staff-content::-webkit-scrollbar {
  width: 6px;
}

.staff-content::-webkit-scrollbar-track {
  background: transparent;
}

.staff-content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.staff-content::-webkit-scrollbar-thumb:hover {
  background-color: rgba(255, 255, 255, 0.25);
}

/* ===== Sections ===== */
.staff-section {
  margin-bottom: 1.25rem;
}

.staff-section:last-child {
  margin-bottom: 0;
}

.staff-section__title {
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sidebar-text-muted);
  margin: 0 0 0.625rem;
}

/* ===== Form Fields ===== */
.staff-field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.staff-field__label {
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.staff-field__required {
  color: #ef4444;
  margin-left: 0.125rem;
}

.staff-field__input {
  width: 100%;
  padding: 0.625rem 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.staff-field__input::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

.staff-field__input:focus {
  outline: none;
  border-color: transparent;
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
}

/* Dropdown trigger button styling */
:deep(.staff-field__dropdown-trigger) {
  width: 100% !important;
  padding: 0.625rem 0.875rem !important;
  background-color: var(--sidebar-hover) !important;
  border: 1px solid var(--sidebar-border) !important;
  border-radius: 8px !important;
  font-size: 0.875rem !important;
  color: var(--sidebar-text) !important;
  transition: all 150ms ease !important;
  justify-content: space-between !important;
}

:deep(.staff-field__dropdown-trigger:hover) {
  border-color: rgba(255, 255, 255, 0.1) !important;
}

:deep(.staff-field__dropdown-trigger:focus-within) {
  border-color: transparent !important;
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3) !important;
}

:deep(.staff-field__dropdown-trigger span) {
  color: var(--sidebar-text) !important;
}

:deep(.staff-field__dropdown-trigger svg) {
  width: 14px !important;
  height: 14px !important;
  color: var(--sidebar-text-muted) !important;
}

/* ===== Modal Footer ===== */
.staff-modal__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 0.625rem;
  padding: 1rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
  background-color: rgba(0, 0, 0, 0.15);
}

.staff-btn {
  padding: 0.625rem 1.25rem;
  border: none;
  border-radius: 8px;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 150ms ease;
}

.staff-btn--secondary {
  background-color: transparent;
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.staff-btn--secondary:hover {
  background-color: var(--sidebar-hover);
}

.staff-btn--primary {
  background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
  color: white;
}

.staff-btn--primary:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(6, 182, 212, 0.3);
}

.staff-btn--primary:disabled {
  background: var(--sidebar-hover);
  color: var(--sidebar-text-muted);
  cursor: not-allowed;
}

/* ===== Modal Transitions ===== */
.staff-modal-enter-active,
.staff-modal-leave-active {
  transition: opacity 200ms ease;
}

.staff-modal-enter-from,
.staff-modal-leave-to {
  opacity: 0;
}

.staff-dialog-enter-active {
  transition: all 250ms cubic-bezier(0.34, 1.56, 0.64, 1);
}

.staff-dialog-leave-active {
  transition: all 200ms ease;
}

.staff-dialog-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(-10px);
}

.staff-dialog-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* ===== Animations ===== */
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}
</style>
