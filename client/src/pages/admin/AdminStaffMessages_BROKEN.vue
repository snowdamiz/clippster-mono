<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { formatDate as fmtDate, formatTime as fmtTime } from '@/utils/dateTimeUtils';
import { MessagesSquare, Plus, Send, Loader2, MessageSquare, Search, Users, User, X, Check } from 'lucide-vue-next';
import { Button } from '@/components/ui/button';
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
const searchQuery = ref('');

const showNewConversationDialog = ref(false);
const newConversationType = ref<'direct' | 'group'>('direct');
const newGroupName = ref('');
const selectedUserIds = ref<number[]>([]);
const memberSearchQuery = ref('');
const staffMembers = ref<any[]>([]);
const isLoadingMembers = ref(false);

const filteredConversations = computed(() => {
  if (!searchQuery.value) return conversations.value;
  const query = searchQuery.value.toLowerCase();
  return conversations.value.filter((conv) => {
    const name = getConversationName(conv).toLowerCase();
    return name.includes(query);
  });
});

const filteredMembers = computed(() => {
  // Filter out current user
  let filtered = staffMembers.value.filter((m) => m.id !== currentUserId.value);
  if (!memberSearchQuery.value) return filtered;
  const query = memberSearchQuery.value.toLowerCase();
  return filtered.filter((m) => {
    const name = (m.name || m.email).toLowerCase();
    return name.includes(query);
  });
});

const canCreateConversation = computed(() => {
  if (newConversationType.value === 'direct') {
    return selectedUserIds.value.length === 1;
  }
  return newGroupName.value.trim() && selectedUserIds.value.length >= 1;
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
  isLoadingMembers.value = true;
  try {
    const response = await api.get('/admin/users');
    // Filter to only admins and moderators
    staffMembers.value = (response.data.users || []).filter(
      (u: any) => (u.is_admin || u.is_moderator) && u.id !== currentUserId.value
    );
  } catch (error) {
    console.error('Failed to load staff members:', error);
  } finally {
    isLoadingMembers.value = false;
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

const handleInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    sendMessage();
  }
};

const openNewConversationDialog = async () => {
  showNewConversationDialog.value = true;
  await loadStaffMembers();
};

const closeNewConversationDialog = () => {
  showNewConversationDialog.value = false;
  newConversationType.value = 'direct';
  newGroupName.value = '';
  selectedUserIds.value = [];
  memberSearchQuery.value = '';
};

const toggleUserSelection = (userId: number) => {
  if (newConversationType.value === 'direct') {
    selectedUserIds.value = [userId];
  } else {
    const index = selectedUserIds.value.indexOf(userId);
    if (index > -1) {
      selectedUserIds.value.splice(index, 1);
    } else {
      selectedUserIds.value.push(userId);
    }
  }
};

const createConversation = async () => {
  try {
    let response;
    if (newConversationType.value === 'direct') {
      response = await api.post('/staff/conversations/direct', {
        target_user_id: selectedUserIds.value[0]
      });
    } else {
      response = await api.post('/staff/conversations/group', {
        name: newGroupName.value,
        participant_ids: selectedUserIds.value
      });
    }
    
    conversations.value.unshift(response.data.conversation);
    closeNewConversationDialog();
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
  return fmtDate(date);
};

const formatMessageTime = (timestamp: string) => {
  if (!timestamp) return '';
  return fmtTime(timestamp);
};

const scrollToBottom = () => {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
  }
};

onMounted(() => {
  loadConversations();
});
</script>

<template>
  <div class="staff-messages">
    <PageLayout
      title="Staff Messages"
      description="Internal messaging for admins and moderators"
      :show-header="true"
      :icon="MessagesSquare"
      :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Staff Messages' }]"
    >
      <template #actions>
        <button @click="openNewConversationDialog" class="staff-messages-header__new-btn">
          <Plus class="staff-messages-header__new-btn-icon" />
          New Conversation
        </button>
      </template>

      <div class="staff-messages__content">
        <!-- Page Heading -->
        <div class="staff-messages__heading">
          <h1 class="staff-messages__title">Staff Messages</h1>
          <p class="staff-messages__subtitle">Internal messaging for admins and moderators</p>
        </div>

        <!-- Main Messages Container -->
        <div class="staff-messages__main">
          <!-- Conversations Panel (Left) -->
          <div class="staff-messages-panel">
            <div class="staff-messages-panel__inner">
              <!-- Panel Header -->
              <div class="staff-messages-panel__header">
                <div class="staff-messages-panel__header-left">
                  <div class="staff-messages-panel__header-icon">
                    <MessagesSquare />
                  </div>
                  <div class="staff-messages-panel__header-text">
                    <h2 class="staff-messages-panel__title">Conversations</h2>
                    <p class="staff-messages-panel__subtitle">
                      {{ filteredConversations.length }} {{ filteredConversations.length === 1 ? 'chat' : 'chats' }}
                    </p>
                  </div>
                </div>
                <button @click="openNewConversationDialog" class="staff-messages-panel__new-btn" title="New conversation">
                  <Plus class="staff-messages-panel__new-btn-icon" />
                </button>
              </div>

              <!-- Search Box -->
              <div class="staff-messages-panel__search">
                <Search class="staff-messages-panel__search-icon" />
                <input
                  v-model="searchQuery"
                  type="text"
                  placeholder="Search conversations..."
                  class="staff-messages-panel__search-input"
                />
              </div>

              <!-- Conversations List -->
              <div class="staff-messages-panel__list">
                <!-- Loading Skeleton -->
                <template v-if="loadingConversations">
                  <div v-for="i in 4" :key="i" class="staff-messages-conv-skeleton">
                    <div class="staff-messages-conv-skeleton__avatar"></div>
                    <div class="staff-messages-conv-skeleton__content">
                      <div class="staff-messages-conv-skeleton__line staff-messages-conv-skeleton__line--name"></div>
                      <div class="staff-messages-conv-skeleton__line staff-messages-conv-skeleton__line--preview"></div>
                    </div>
                  </div>
                </template>

                <!-- Conversations -->
                <template v-else>
                  <div
                    v-for="conv in filteredConversations"
                    :key="conv.id"
                    class="staff-messages-conv"
                    :class="{ 'staff-messages-conv--active': conv.id === selectedConversation?.id }"
                    @click="selectConversation(conv)"
                  >
                    <div
                      class="staff-messages-conv__indicator"
                      :class="{ 'staff-messages-conv__indicator--active': conv.id === selectedConversation?.id }"
                    ></div>
                    <div class="staff-messages-conv__inner">
                      <!-- Avatar -->
                      <div class="staff-messages-conv__avatar-wrapper">
                        <div
                          class="staff-messages-conv__avatar"
                          :class="{
                            'staff-messages-conv__avatar--direct': conv.type === 'direct',
                            'staff-messages-conv__avatar--group': conv.type === 'group',
                          }"
                        >
                          <Users v-if="conv.type === 'group'" class="staff-messages-conv__avatar-icon" />
                          <span v-else class="staff-messages-conv__avatar-initial">
                            {{ getConversationName(conv).charAt(0).toUpperCase() }}
                          </span>
                        </div>
                      </div>

                      <!-- Content -->
                      <div class="staff-messages-conv__content">
                        <div class="staff-messages-conv__header">
                          <span class="staff-messages-conv__name">{{ getConversationName(conv) }}</span>
                          <span class="staff-messages-conv__time">{{ formatTime(conv.last_message_at) }}</span>
                        </div>
                        <div class="staff-messages-conv__footer">
                          <span class="staff-messages-conv__preview">{{ conv.last_message_preview || 'No messages yet' }}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Empty State -->
                  <div v-if="filteredConversations.length === 0" class="staff-messages-panel__empty">
                    <div class="staff-messages-panel__empty-icon">
                      <MessageSquare />
                    </div>
                    <p class="staff-messages-panel__empty-title">No conversations yet</p>
                    <p class="staff-messages-panel__empty-text">Start chatting with staff members</p>
                    <button @click="openNewConversationDialog" class="staff-messages-panel__empty-btn">
                      <Plus class="staff-messages-panel__empty-btn-icon" />
                      New Conversation
                    </button>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Chat Panel (Right) -->
          <div class="staff-messages-chat">
            <div class="staff-messages-chat__inner">
              <template v-if="selectedConversation">
                <!-- Chat Header -->
                <div class="staff-messages-chat__header">
                  <div class="staff-messages-chat__header-left">
                    <div
                      class="staff-messages-chat__avatar"
                      :class="{
                        'staff-messages-chat__avatar--direct': selectedConversation.type === 'direct',
                        'staff-messages-chat__avatar--group': selectedConversation.type === 'group',
                      }"
                    >
                      <Users v-if="selectedConversation.type === 'group'" class="staff-messages-chat__avatar-icon" />
                      <span v-else class="staff-messages-chat__avatar-initial">
                        {{ getConversationName(selectedConversation).charAt(0).toUpperCase() }}
                      </span>
                    </div>
                    <div class="staff-messages-chat__header-info">
                      <h3 class="staff-messages-chat__name">{{ getConversationName(selectedConversation) }}</h3>
                      <p class="staff-messages-chat__meta">
                        {{ selectedConversation.type === 'direct' ? 'Direct message' : `${selectedConversation.participants?.length || 0} members` }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Messages Container -->
                <div ref="messagesContainer" class="staff-messages-chat__messages">
                  <!-- Loading Messages -->
                  <div v-if="loadingMessages" class="staff-messages-chat__loading">
                    <Loader2 class="staff-messages-chat__loading-spinner" />
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
                <div class="staff-messages-chat__input-area">
                  <textarea
                    v-model="newMessage"
                    placeholder="Write a message..."
                    rows="1"
                    @keydown="handleInputKeydown"
                    class="staff-messages-chat__input"
                  ></textarea>
                  <button
                    class="staff-messages-chat__send-btn"
                    :class="{ 'staff-messages-chat__send-btn--disabled': !newMessage.trim() }"
                    :disabled="!newMessage.trim()"
                    @click="sendMessage"
                  >
                    <Send class="staff-messages-chat__send-icon" />
                  </button>
                </div>
              </template>

              <!-- No Conversation Selected -->
              <div v-else class="staff-messages-chat__empty">
                <div class="staff-messages-chat__empty-icon">
                  <MessageSquare />
                </div>
                <h2 class="staff-messages-chat__empty-title">Select a conversation</h2>
                <p class="staff-messages-chat__empty-text">Choose from your existing conversations or start a new one</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </PageLayout>

    <!-- New Conversation Dialog -->
    <Teleport to="body">
      <Transition name="modal">
        <div v-if="showNewConversationDialog" class="staff-messages-modal__overlay" @click.self="closeNewConversationDialog">
          <Transition name="dialog" appear>
            <div class="staff-messages-modal staff-messages-modal--new-conversation">
              <div class="staff-messages-modal__accent"></div>

              <!-- Header -->
              <div class="staff-messages-modal__header staff-messages-modal__header--centered">
                <button @click="closeNewConversationDialog" class="staff-messages-modal__close staff-messages-modal__close--corner">
                  <X />
                </button>
                <div class="staff-messages-modal__icon staff-messages-modal__icon--large">
                  <MessageSquare />
                </div>
                <h2 class="staff-messages-modal__title">New Staff Conversation</h2>
              </div>

              <!-- Type Tabs -->
              <div class="staff-messages-modal__tabs-nav">
                <button
                  @click="newConversationType = 'direct'; selectedUserIds = []"
                  class="staff-messages-modal__tabs-item"
                  :class="{ 'staff-messages-modal__tabs-item--active': newConversationType === 'direct' }"
                >
                  <User :size="14" />
                  <span>Direct Message</span>
                </button>
                <button
                  @click="newConversationType = 'group'; selectedUserIds = []"
                  class="staff-messages-modal__tabs-item"
                  :class="{ 'staff-messages-modal__tabs-item--active': newConversationType === 'group' }"
                >
                  <Users :size="14" />
                  <span>Group Chat</span>
                </button>
              </div>

              <!-- Content -->
              <div class="staff-messages-modal__body staff-messages-modal__body--scrollable">
                <!-- Group Name Input -->
                <div v-if="newConversationType === 'group'" class="staff-messages-modal__field">
                  <label class="staff-messages-modal__label">Group Name</label>
                  <input
                    v-model="newGroupName"
                    type="text"
                    placeholder="Enter group name..."
                    class="staff-messages-modal__input"
                  />
                </div>

                <!-- Member Search -->
                <div class="staff-messages-modal__field">
                  <label class="staff-messages-modal__label">
                    {{ newConversationType === 'direct' ? 'Select Staff Member' : 'Select Staff Members' }}
                  </label>
                  <div class="staff-messages-modal__search">
                    <Search class="staff-messages-modal__search-icon" />
                    <input
                      v-model="memberSearchQuery"
                      type="text"
                      placeholder="Search staff members..."
                      class="staff-messages-modal__search-input"
                    />
                  </div>
                </div>

                <!-- Members List -->
                <div class="staff-messages-modal__members">
                  <div
                    v-for="member in filteredMembers"
                    :key="member.id"
                    class="staff-messages-modal__member"
                    :class="{ 'staff-messages-modal__member--selected': selectedUserIds.includes(member.id) }"
                    @click="toggleUserSelection(member.id)"
                  >
                    <div class="staff-messages-modal__member-avatar">
                      <img v-if="member.avatar_url" :src="member.avatar_url" alt="" class="staff-messages-modal__member-img" />
                      <span v-else class="staff-messages-modal__member-initial">
                        {{ (member.name || member.email).charAt(0).toUpperCase() }}
                      </span>
                    </div>
                    <div class="staff-messages-modal__member-info">
                      <p class="staff-messages-modal__member-name">{{ member.name || member.email }}</p>
                      <p class="staff-messages-modal__member-role">{{ member.is_admin ? 'Admin' : 'Moderator' }}</p>
                    </div>
                    <div v-if="selectedUserIds.includes(member.id)" class="staff-messages-modal__member-check">
                      <Check />
                    </div>
                  </div>

                  <!-- No Members -->
                  <div v-if="filteredMembers.length === 0 && !isLoadingMembers" class="staff-messages-modal__members-empty">
                    No staff members found
                  </div>

                  <!-- Loading Members -->
                  <div v-if="isLoadingMembers" class="staff-messages-modal__members-loading">
                    <Loader2 class="staff-messages-modal__members-spinner" />
                  </div>
                </div>
              </div>

              <!-- Footer -->
              <div class="staff-messages-modal__footer">
                <button @click="closeNewConversationDialog" class="staff-messages-modal__btn staff-messages-modal__btn--secondary">
                  Cancel
                </button>
                <button
                  @click="createConversation"
                  :disabled="!canCreateConversation"
                  class="staff-messages-modal__btn staff-messages-modal__btn--primary"
                  :class="{ 'staff-messages-modal__btn--disabled': !canCreateConversation }"
                >
                  Create
                </button>
              </div>
            </div>
          </Transition>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
/* Copy all styles from Messages.vue with staff-messages prefix */
/* ===== Header Actions ===== */
.staff-messages-header__new-btn {
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

.staff-messages-header__new-btn:hover {
  opacity: 0.9;
}

.staff-messages-header__new-btn-icon {
  width: 14px;
  height: 14px;
}

/* ===== Page Container ===== */
.staff-messages {
  width: 100%;
  height: 100%;
}

.staff-messages__content {
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
.staff-messages__heading {
  flex-shrink: 0;
}

.staff-messages__title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0 0 0.2rem;
  letter-spacing: -0.02em;
}

.staff-messages__subtitle {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  line-height: 1.5;
}

/* ===== Main Container ===== */
.staff-messages__main {
  display: flex;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  margin-top: 0.8rem;
  overflow: hidden;
}

/* ===== Conversations Panel ===== */
.staff-messages-panel {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  background-color: var(--sidebar-surface);
  border-radius: 10px;
  overflow: hidden;
}

.staff-messages-panel__inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.staff-messages-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.875rem;
  padding: 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.staff-messages-panel__header-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.staff-messages-panel__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: rgba(6, 182, 212, 0.15);
  flex-shrink: 0;
}

.staff-messages-panel__header-icon svg {
  width: 20px;
  height: 20px;
  color: var(--sidebar-accent);
  stroke: var(--sidebar-accent);
}

.staff-messages-panel__title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.staff-messages-panel__subtitle {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0.125rem 0 0;
}

.staff-messages-panel__new-btn {
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

.staff-messages-panel__new-btn:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.staff-messages-panel__new-btn-icon {
  width: 18px;
  height: 18px;
}

/* Search */
.staff-messages-panel__search {
  position: relative;
  padding: 0.75rem 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.staff-messages-panel__search-icon {
  position: absolute;
  left: 1.75rem;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--sidebar-text-muted);
  pointer-events: none;
}

.staff-messages-panel__search-input {
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

.staff-messages-panel__search-input::placeholder {
  color: var(--sidebar-text-muted);
}

.staff-messages-panel__search-input:hover {
  border-color: var(--sidebar-border);
}

.staff-messages-panel__search-input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  background-color: var(--sidebar-surface);
}

/* Conversations List */
.staff-messages-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
}

.staff-messages-panel__list::-webkit-scrollbar {
  width: 6px;
}

.staff-messages-panel__list::-webkit-scrollbar-track {
  background: transparent;
}

.staff-messages-panel__list::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

/* Conversation Item */
.staff-messages-conv {
  display: flex;
  margin-bottom: 0.375rem;
  background-color: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  transition: all 150ms ease;
}

.staff-messages-conv:hover {
  background-color: var(--sidebar-hover);
}

.staff-messages-conv--active {
  background-color: var(--sidebar-active);
}

.staff-messages-conv__indicator {
  width: 3px;
  flex-shrink: 0;
  background-color: transparent;
  border-radius: 3px 0 0 3px;
}

.staff-messages-conv__indicator--active {
  background-color: var(--sidebar-accent);
}

.staff-messages-conv__inner {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
}

.staff-messages-conv__avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.staff-messages-conv__avatar {
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

.staff-messages-conv__avatar--direct {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
}

.staff-messages-conv__avatar--group {
  background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
}

.staff-messages-conv__avatar-icon {
  width: 20px;
  height: 20px;
}

.staff-messages-conv__avatar-initial {
  font-size: 1rem;
  font-weight: 600;
}

.staff-messages-conv__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.staff-messages-conv__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.staff-messages-conv__name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.staff-messages-conv__time {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  flex-shrink: 0;
}

.staff-messages-conv__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.staff-messages-conv__preview {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

/* Empty State */
.staff-messages-panel__empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1.5rem;
  text-align: center;
}

.staff-messages-panel__empty-icon {
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

.staff-messages-panel__empty-icon svg {
  width: 24px;
  height: 24px;
}

.staff-messages-panel__empty-title {
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--sidebar-text);
  margin: 0 0 0.25rem;
}

.staff-messages-panel__empty-text {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0 0 1.25rem;
}

.staff-messages-panel__empty-btn {
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

.staff-messages-panel__empty-btn:hover {
  opacity: 0.9;
}

.staff-messages-panel__empty-btn-icon {
  width: 14px;
  height: 14px;
}

/* Skeleton Loading */
.staff-messages-conv-skeleton {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  margin-bottom: 0.375rem;
}

.staff-messages-conv-skeleton__avatar {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

.staff-messages-conv-skeleton__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.staff-messages-conv-skeleton__line {
  background: linear-gradient(90deg, var(--sidebar-hover) 25%, var(--sidebar-border) 50%, var(--sidebar-hover) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 4px;
}

.staff-messages-conv-skeleton__line--name {
  height: 14px;
  width: 60%;
}

.staff-messages-conv-skeleton__line--preview {
  height: 12px;
  width: 80%;
}

/* ===== Chat Panel ===== */
.staff-messages-chat {
  flex: 1;
  display: flex;
  background-color: var(--sidebar-surface);
  border-radius: 10px;
  overflow: hidden;
}

.staff-messages-chat__inner {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Chat Header */
.staff-messages-chat__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--sidebar-border);
  background-color: rgba(0, 0, 0, 0.15);
}

.staff-messages-chat__header-left {
  display: flex;
  align-items: center;
  gap: 0.875rem;
}

.staff-messages-chat__avatar {
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

.staff-messages-chat__avatar--direct {
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
}

.staff-messages-chat__avatar--group {
  background: linear-gradient(135deg, #10b981 0%, #14b8a6 100%);
}

.staff-messages-chat__avatar-icon {
  width: 20px;
  height: 20px;
}

.staff-messages-chat__avatar-initial {
  font-size: 1rem;
  font-weight: 600;
}

.staff-messages-chat__header-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.staff-messages-chat__name {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.staff-messages-chat__meta {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

/* Messages Container */
.staff-messages-chat__messages {
  flex: 1;
  overflow-y: auto;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.staff-messages-chat__messages::-webkit-scrollbar {
  width: 6px;
}

.staff-messages-chat__messages::-webkit-scrollbar-track {
  background: transparent;
}

.staff-messages-chat__messages::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.staff-messages-chat__loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.staff-messages-chat__loading-spinner {
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
.staff-messages-chat__input-area {
  display: flex;
  align-items: flex-end;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--sidebar-border);
  background-color: rgba(0, 0, 0, 0.15);
}

.staff-messages-chat__input {
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

.staff-messages-chat__input::placeholder {
  color: var(--sidebar-text-muted);
}

.staff-messages-chat__input:hover {
  border-color: var(--sidebar-border);
}

.staff-messages-chat__input:focus {
  outline: none;
  border-color: var(--sidebar-border);
  background-color: var(--sidebar-surface);
}

.staff-messages-chat__send-btn {
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

.staff-messages-chat__send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
}

.staff-messages-chat__send-btn--disabled {
  background: var(--sidebar-hover);
  color: var(--sidebar-text-muted);
  cursor: not-allowed;
}

.staff-messages-chat__send-icon {
  width: 20px;
  height: 20px;
}

/* Empty State */
.staff-messages-chat__empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
}

.staff-messages-chat__empty-icon {
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

.staff-messages-chat__empty-icon svg {
  width: 32px;
  height: 32px;
}

.staff-messages-chat__empty-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.5rem;
}

.staff-messages-chat__empty-text {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  max-width: 280px;
}

/* ===== Modal Styles ===== */
.staff-messages-modal__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 60;
}

.staff-messages-modal {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  margin: 1rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.staff-messages-modal__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

.staff-messages-modal__header {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 1.25rem 1.5rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.staff-messages-modal__header--centered {
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.staff-messages-modal__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
}

.staff-messages-modal__close--corner {
  position: absolute;
  top: 1rem;
  right: 1rem;
}

.staff-messages-modal__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.staff-messages-modal__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  flex-shrink: 0;
}

.staff-messages-modal__icon--large {
  width: 52px;
  height: 52px;
}

.staff-messages-modal__icon svg {
  width: 20px;
  height: 20px;
}

.staff-messages-modal__title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.staff-messages-modal__tabs-nav {
  display: flex;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  border-bottom: 1px solid var(--sidebar-border);
  background-color: rgba(0, 0, 0, 0.15);
}

.staff-messages-modal__tabs-item {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background-color: transparent;
  color: var(--sidebar-text-muted);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 150ms ease;
}

.staff-messages-modal__tabs-item:hover {
  background-color: var(--sidebar-hover);
  border-color: var(--sidebar-border);
}

.staff-messages-modal__tabs-item--active {
  background-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
  border-color: var(--sidebar-accent);
}

.staff-messages-modal__body {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.staff-messages-modal__body--scrollable {
  max-height: 400px;
}

.staff-messages-modal__body::-webkit-scrollbar {
  width: 6px;
}

.staff-messages-modal__body::-webkit-scrollbar-track {
  background: transparent;
}

.staff-messages-modal__body::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.staff-messages-modal__field {
  margin-bottom: 1.25rem;
}

.staff-messages-modal__label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--sidebar-text);
  margin-bottom: 0.5rem;
}

.staff-messages-modal__input {
  width: 100%;
  padding: 0.75rem 1rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.staff-messages-modal__input::placeholder {
  color: var(--sidebar-text-muted);
}

.staff-messages-modal__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  background-color: var(--sidebar-surface);
}

.staff-messages-modal__search {
  position: relative;
}

.staff-messages-modal__search-icon {
  position: absolute;
  left: 1rem;
  top: 50%;
  transform: translateY(-50%);
  width: 14px;
  height: 14px;
  color: var(--sidebar-text-muted);
  pointer-events: none;
}

.staff-messages-modal__search-input {
  width: 100%;
  padding: 0.75rem 1rem 0.75rem 2.5rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.staff-messages-modal__search-input::placeholder {
  color: var(--sidebar-text-muted);
}

.staff-messages-modal__search-input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  background-color: var(--sidebar-surface);
}

.staff-messages-modal__members {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 300px;
  overflow-y: auto;
}

.staff-messages-modal__members::-webkit-scrollbar {
  width: 6px;
}

.staff-messages-modal__members::-webkit-scrollbar-track {
  background: transparent;
}

.staff-messages-modal__members::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.staff-messages-modal__member {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: var(--sidebar-hover);
  border: 1px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  transition: all 150ms ease;
}

.staff-messages-modal__member:hover {
  background-color: var(--sidebar-active);
  border-color: var(--sidebar-border);
}

.staff-messages-modal__member--selected {
  background-color: rgba(6, 182, 212, 0.15);
  border-color: var(--sidebar-accent);
}

.staff-messages-modal__member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
  color: white;
  font-size: 0.875rem;
  font-weight: 600;
  overflow: hidden;
  flex-shrink: 0;
}

.staff-messages-modal__member-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.staff-messages-modal__member-initial {
  font-size: 1rem;
  font-weight: 600;
}

.staff-messages-modal__member-info {
  flex: 1;
  min-width: 0;
}

.staff-messages-modal__member-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
  margin: 0 0 0.125rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.staff-messages-modal__member-role {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0;
}

.staff-messages-modal__member-check {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background-color: var(--sidebar-accent);
  color: white;
  border-radius: 50%;
  flex-shrink: 0;
}

.staff-messages-modal__member-check svg {
  width: 12px;
  height: 12px;
}

.staff-messages-modal__members-empty,
.staff-messages-modal__members-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
}

.staff-messages-modal__members-spinner {
  width: 20px;
  height: 20px;
  color: var(--sidebar-accent);
  animation: spin 0.8s linear infinite;
}

.staff-messages-modal__footer {
  display: flex;
  gap: 0.75rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

.staff-messages-modal__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
}

.staff-messages-modal__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.staff-messages-modal__btn--secondary:hover {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.staff-messages-modal__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: white;
}

.staff-messages-modal__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.staff-messages-modal__btn--disabled {
  opacity: 0.5;
  cursor: not-allowed;
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

/* ===== Transitions ===== */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active {
  transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-leave-active {
  transition: all 150ms ease-in;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.96) translateY(8px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
