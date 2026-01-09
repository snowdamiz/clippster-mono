<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useMessagingStore } from '@/stores/messaging';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';
import type { Conversation, Message } from '@/services/messagingApi';

const messagingStore = useMessagingStore();
const authStore = useAuthStore();

const messageInput = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const isAtBottom = ref(true);
const editingMessageId = ref<number | null>(null);
const editContent = ref('');
const searchQuery = ref('');
const showNewConversationDialog = ref(false);
const newConversationType = ref<'direct' | 'group'>('direct');
const newGroupName = ref('');
const selectedUserIds = ref<number[]>([]);
const memberSearchQuery = ref('');
const members = ref<Array<{ id: number; orgId: number; userId: number; displayName: string; avatarUrl: string | null; orgName: string }>>([]);
const isLoadingMembers = ref(false);
const organizations = ref<Array<{ id: number; name: string }>>([]);

let typingTimeout: number | null = null;

const filteredConversations = computed(() => {
  if (!searchQuery.value) return messagingStore.conversationList;
  const query = searchQuery.value.toLowerCase();
  return messagingStore.conversationList.filter(conv => {
    const name = getConversationName(conv).toLowerCase();
    return name.includes(query);
  });
});

const sortedMessages = computed(() => {
  return [...messagingStore.activeMessages].sort((a, b) => 
    new Date(a.insertedAt).getTime() - new Date(b.insertedAt).getTime()
  );
});

const typingUserNames = computed(() => {
  const names: string[] = [];
  messagingStore.activeTypingUsers.forEach(userId => {
    const participant = messagingStore.activeConversation?.participants.find(p => p.userId === userId);
    if (participant?.user?.displayName) {
      names.push(participant.user.displayName);
    }
  });
  return names;
});

const filteredMembers = computed(() => {
  if (!memberSearchQuery.value) return members.value;
  const query = memberSearchQuery.value.toLowerCase();
  return members.value.filter(m => m.displayName.toLowerCase().includes(query));
});

const canCreateConversation = computed(() => {
  if (newConversationType.value === 'direct') {
    return selectedUserIds.value.length === 1;
  }
  return newGroupName.value.trim() && selectedUserIds.value.length >= 1;
});

onMounted(async () => {
  if (authStore.isAuthenticated) {
    await loadOrganizationsAndMembers();
  }
});

onUnmounted(() => {
  messagingStore.cleanup();
});

watch(() => authStore.isAuthenticated, async (isAuth) => {
  if (isAuth) {
    await loadOrganizationsAndMembers();
  }
});

watch(() => messagingStore.activeMessages.length, () => {
  if (isAtBottom.value) {
    scrollToBottom();
  }
});

watch(() => messagingStore.activeConversationId, () => {
  scrollToBottom(false);
});

async function loadOrganizationsAndMembers() {
  try {
    const orgsResponse = await api.get<{ data: Array<{ id: number; name: string }> }>('/organizations');
    organizations.value = orgsResponse.data.data || [];
    
    // Load members from all organizations
    isLoadingMembers.value = true;
    members.value = [];
    
    for (const org of organizations.value) {
      try {
        const membersResponse = await api.get<{ data: Array<{ id: number; user_id: number; user: { display_name: string; avatar_url: string | null }; role: string }> }>(
          `/organizations/${org.id}/members`
        );
        const orgMembers = (membersResponse.data.data || []).map(m => ({
          id: m.id,
          orgId: org.id,
          userId: m.user_id,
          displayName: m.user?.display_name || 'Unknown',
          avatarUrl: m.user?.avatar_url || null,
          orgName: org.name
        })).filter(m => m.userId !== authStore.user?.id); // Exclude self
        
        members.value.push(...orgMembers);
        
        // Initialize messaging for first org
        if (org === organizations.value[0]) {
          await messagingStore.initialize(org.id);
        }
      } catch (e) {
        console.error(`Failed to load members for org ${org.id}:`, e);
      }
    }
  } catch (error) {
    console.error('Failed to load organizations:', error);
  } finally {
    isLoadingMembers.value = false;
  }
}

function getConversationName(conversation: Conversation): string {
  if (conversation.name) return conversation.name;
  
  if (conversation.type === 'direct') {
    const otherParticipant = conversation.participants.find(p => p.userId !== authStore.user?.id);
    return otherParticipant?.user?.displayName || 'Unknown User';
  }
  
  if (conversation.type === 'announcement') return 'Announcement';
  return 'Group Chat';
}

function getConversationAvatar(conversation: Conversation): string | null {
  if (conversation.type === 'direct') {
    const otherParticipant = conversation.participants.find(p => p.userId !== authStore.user?.id);
    return otherParticipant?.user?.avatarUrl || null;
  }
  return null;
}

function formatTime(dateString: string | null): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function formatMessageTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

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

async function selectConversation(conversationId: number) {
  await messagingStore.setActiveConversation(conversationId);
}

async function sendMessage() {
  const content = messageInput.value.trim();
  if (!content) return;

  messageInput.value = '';
  
  try {
    await messagingStore.sendMessage(content);
    scrollToBottom();
  } catch (error) {
    console.error('Failed to send message:', error);
    messageInput.value = content;
  }
}

function handleInputKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    if (editingMessageId.value) {
      saveEdit();
    } else {
      sendMessage();
    }
  }
}

function handleTyping() {
  if (typingTimeout) clearTimeout(typingTimeout);
  messagingStore.sendTyping();
  typingTimeout = window.setTimeout(() => { typingTimeout = null; }, 2000);
}

function startEdit(message: Message) {
  editingMessageId.value = message.id;
  editContent.value = message.content;
}

async function saveEdit() {
  if (!editingMessageId.value || !editContent.value.trim()) return;
  try {
    await messagingStore.editMessage(editingMessageId.value, editContent.value.trim());
    cancelEdit();
  } catch (error) {
    console.error('Failed to edit message:', error);
  }
}

function cancelEdit() {
  editingMessageId.value = null;
  editContent.value = '';
}

async function deleteMessage(messageId: number) {
  if (!confirm('Delete this message?')) return;
  try {
    await messagingStore.deleteMessage(messageId);
  } catch (error) {
    console.error('Failed to delete message:', error);
  }
}

function toggleUserSelection(userId: number) {
  if (newConversationType.value === 'direct') {
    selectedUserIds.value = [userId];
  } else {
    const index = selectedUserIds.value.indexOf(userId);
    if (index === -1) {
      selectedUserIds.value.push(userId);
    } else {
      selectedUserIds.value.splice(index, 1);
    }
  }
}

async function createConversation() {
  if (!canCreateConversation.value) return;

  try {
    // Find the org for the selected user
    const selectedMember = members.value.find(m => m.userId === selectedUserIds.value[0]);
    if (!selectedMember) return;

    // Make sure we're initialized for that org
    if (messagingStore.currentOrgId !== selectedMember.orgId) {
      await messagingStore.initialize(selectedMember.orgId);
    }

    let conversation;
    if (newConversationType.value === 'direct') {
      conversation = await messagingStore.startDirectConversation(selectedUserIds.value[0]);
    } else {
      conversation = await messagingStore.startGroupConversation(newGroupName.value.trim(), selectedUserIds.value);
    }

    if (conversation) {
      await selectConversation(conversation.id);
      closeNewConversationDialog();
    }
  } catch (error) {
    console.error('Failed to create conversation:', error);
  }
}

function openNewConversationDialog() {
  showNewConversationDialog.value = true;
  newConversationType.value = 'direct';
  newGroupName.value = '';
  selectedUserIds.value = [];
  memberSearchQuery.value = '';
}

function closeNewConversationDialog() {
  showNewConversationDialog.value = false;
}

function getUnreadCount(conversationId: number): number {
  return messagingStore.unreadCounts.get(conversationId) || 0;
}
</script>

<template>
  <div class="messages-page">
    <!-- Conversation List (Left Panel) -->
    <div class="conversations-panel">
      <div class="panel-header">
        <h1>Messages</h1>
        <button class="new-chat-btn" @click="openNewConversationDialog" title="New conversation">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 5v14M5 12h14"/>
          </svg>
        </button>
      </div>

      <!-- Search -->
      <div class="search-box">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input v-model="searchQuery" type="text" placeholder="Search conversations..." />
      </div>

      <!-- Conversations List -->
      <div class="conversations-list">
        <div
          v-for="conv in filteredConversations"
          :key="conv.id"
          class="conversation-item"
          :class="{ active: conv.id === messagingStore.activeConversationId }"
          @click="selectConversation(conv.id)"
        >
          <div class="conv-avatar" :class="conv.type">
            <img v-if="getConversationAvatar(conv)" :src="getConversationAvatar(conv)!" alt="" />
            <span v-else>{{ getConversationName(conv).charAt(0).toUpperCase() }}</span>
          </div>
          <div class="conv-content">
            <div class="conv-header">
              <span class="conv-name">{{ getConversationName(conv) }}</span>
              <span class="conv-time">{{ formatTime(conv.lastMessageAt) }}</span>
            </div>
            <div class="conv-preview">
              <span class="preview-text">{{ conv.lastMessagePreview || 'No messages yet' }}</span>
              <span v-if="getUnreadCount(conv.id) > 0" class="unread-badge">
                {{ getUnreadCount(conv.id) > 99 ? '99+' : getUnreadCount(conv.id) }}
              </span>
            </div>
          </div>
        </div>

        <div v-if="filteredConversations.length === 0 && !messagingStore.isLoading" class="empty-conversations">
          <p>No conversations yet</p>
          <button @click="openNewConversationDialog">Start a conversation</button>
        </div>

        <div v-if="messagingStore.isLoading" class="loading-conversations">
          <div class="spinner"></div>
        </div>
      </div>
    </div>

    <!-- Divider -->
    <div class="panel-divider"></div>

    <!-- Chat Panel (Right) -->
    <div class="chat-panel">
      <template v-if="messagingStore.activeConversation">
        <!-- Chat Header -->
        <div class="chat-header">
          <div class="chat-header-info">
            <div class="chat-avatar" :class="messagingStore.activeConversation.type">
              <img v-if="getConversationAvatar(messagingStore.activeConversation)" :src="getConversationAvatar(messagingStore.activeConversation)!" alt="" />
              <span v-else>{{ getConversationName(messagingStore.activeConversation).charAt(0).toUpperCase() }}</span>
            </div>
            <div class="chat-header-text">
              <h2>{{ getConversationName(messagingStore.activeConversation) }}</h2>
              <span class="chat-subtitle">
                {{ messagingStore.activeConversation.type === 'direct' ? 'Direct message' : 
                   messagingStore.activeConversation.type === 'group' ? `${messagingStore.activeConversation.participants.length} members` : 
                   'Announcement' }}
              </span>
            </div>
          </div>
          <div class="chat-header-actions">
            <button 
              class="header-action-btn"
              :class="{ active: messagingStore.activeConversation.muted }"
              @click="messagingStore.toggleMute(messagingStore.activeConversation.id)"
              :title="messagingStore.activeConversation.muted ? 'Unmute' : 'Mute'"
            >
              <svg v-if="messagingStore.activeConversation.muted" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m2 2 20 20"/>
                <path d="M18.36 6.64A9 9 0 0 1 20.77 15"/>
                <path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"/>
                <path d="M12 2v4"/>
              </svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Messages -->
        <div ref="messagesContainer" class="messages-container" @scroll="handleScroll">
          <div v-if="messagingStore.isLoadingMessages" class="loading-messages">
            <div class="spinner"></div>
          </div>

          <div class="messages-list">
            <div
              v-for="message in sortedMessages"
              :key="message.id"
              class="message"
              :class="{ 
                own: message.senderId === authStore.user?.id,
                deleted: !!message.deletedAt
              }"
            >
              <div class="message-bubble">
                <div v-if="message.senderId !== authStore.user?.id && message.sender" class="message-sender">
                  {{ message.sender.displayName }}
                </div>
                
                <template v-if="editingMessageId === message.id">
                  <textarea
                    v-model="editContent"
                    @keydown.enter.prevent="saveEdit"
                    @keydown.escape="cancelEdit"
                    class="edit-textarea"
                    rows="2"
                  ></textarea>
                  <div class="edit-actions">
                    <button @click="saveEdit">Save</button>
                    <button @click="cancelEdit">Cancel</button>
                  </div>
                </template>
                <template v-else>
                  <p v-if="message.deletedAt" class="deleted-text">Message deleted</p>
                  <p v-else class="message-text">{{ message.content }}</p>
                </template>

                <div class="message-meta">
                  <span class="message-time">{{ formatMessageTime(message.insertedAt) }}</span>
                  <span v-if="message.editedAt && !message.deletedAt" class="edited-label">edited</span>
                </div>

                <div v-if="message.senderId === authStore.user?.id && !message.deletedAt && editingMessageId !== message.id" class="message-actions">
                  <button @click="startEdit(message)" title="Edit">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                  </button>
                  <button @click="deleteMessage(message.id)" title="Delete">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="3 6 5 6 21 6"/>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- Typing indicator -->
          <div v-if="typingUserNames.length > 0" class="typing-indicator">
            <div class="typing-dots">
              <span></span><span></span><span></span>
            </div>
            <span>{{ typingUserNames.join(', ') }} {{ typingUserNames.length === 1 ? 'is' : 'are' }} typing...</span>
          </div>
        </div>

        <!-- Input -->
        <div class="message-input-area">
          <textarea
            v-model="messageInput"
            placeholder="Write a message..."
            rows="1"
            @keydown="handleInputKeydown"
            @input="handleTyping"
          ></textarea>
          <button class="send-btn" :disabled="!messageInput.trim()" @click="sendMessage">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/>
              <polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        </div>
      </template>

      <!-- No conversation selected -->
      <div v-else class="no-chat-selected">
        <div class="empty-chat-icon">
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        </div>
        <h2>Select a conversation</h2>
        <p>Choose from your existing conversations or start a new one</p>
      </div>
    </div>

    <!-- New Conversation Dialog -->
    <div v-if="showNewConversationDialog" class="dialog-overlay" @click.self="closeNewConversationDialog">
      <div class="dialog">
        <div class="dialog-header">
          <h2>New Conversation</h2>
          <button class="close-btn" @click="closeNewConversationDialog">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div class="dialog-content">
          <div class="type-tabs">
            <button :class="{ active: newConversationType === 'direct' }" @click="newConversationType = 'direct'; selectedUserIds = []">
              Direct Message
            </button>
            <button :class="{ active: newConversationType === 'group' }" @click="newConversationType = 'group'; selectedUserIds = []">
              Group Chat
            </button>
          </div>

          <div v-if="newConversationType === 'group'" class="group-name-input">
            <input v-model="newGroupName" type="text" placeholder="Group name..." />
          </div>

          <div class="member-search">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input v-model="memberSearchQuery" type="text" placeholder="Search members..." />
          </div>

          <div class="members-list">
            <div
              v-for="member in filteredMembers"
              :key="`${member.orgId}-${member.userId}`"
              class="member-item"
              :class="{ selected: selectedUserIds.includes(member.userId) }"
              @click="toggleUserSelection(member.userId)"
            >
              <div class="member-avatar">
                <img v-if="member.avatarUrl" :src="member.avatarUrl" alt="" />
                <span v-else>{{ member.displayName.charAt(0).toUpperCase() }}</span>
              </div>
              <div class="member-info">
                <span class="member-name">{{ member.displayName }}</span>
                <span class="member-org">{{ member.orgName }}</span>
              </div>
              <div v-if="selectedUserIds.includes(member.userId)" class="check-icon">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </div>
            </div>

            <div v-if="filteredMembers.length === 0 && !isLoadingMembers" class="no-members">
              No members found
            </div>

            <div v-if="isLoadingMembers" class="loading-members">
              <div class="spinner"></div>
            </div>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="cancel-btn" @click="closeNewConversationDialog">Cancel</button>
          <button class="create-btn" :disabled="!canCreateConversation" @click="createConversation">
            Create
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.messages-page {
  display: flex;
  height: calc(100vh - 2rem);
  background: hsl(var(--background));
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid hsl(var(--border));
}

/* Left Panel - Conversations */
.conversations-panel {
  width: 340px;
  min-width: 280px;
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid hsl(var(--border));
}

.panel-header h1 {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.new-chat-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  transition: opacity 0.2s;
}

.new-chat-btn:hover {
  opacity: 0.9;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 12px 16px;
  padding: 10px 14px;
  background: hsl(var(--muted));
  border-radius: 10px;
}

.search-box svg {
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
}

.search-box input {
  flex: 1;
  border: none;
  background: transparent;
  color: hsl(var(--foreground));
  font-size: 14px;
  outline: none;
}

.search-box input::placeholder {
  color: hsl(var(--muted-foreground));
}

.conversations-list {
  flex: 1;
  overflow-y: auto;
}

.conversation-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
}

.conversation-item:hover {
  background: hsl(var(--muted) / 0.5);
}

.conversation-item.active {
  background: hsl(var(--muted));
}

.conv-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: hsl(var(--primary) / 0.2);
  color: hsl(var(--primary));
  font-weight: 600;
  font-size: 18px;
  overflow: hidden;
}

.conv-avatar.group {
  background: hsl(220 80% 50% / 0.2);
  color: hsl(220 80% 50%);
}

.conv-avatar.announcement {
  background: hsl(0 70% 50% / 0.2);
  color: hsl(0 70% 50%);
}

.conv-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.conv-content {
  flex: 1;
  min-width: 0;
}

.conv-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.conv-name {
  font-size: 15px;
  font-weight: 500;
  color: hsl(var(--foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conv-time {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  flex-shrink: 0;
  margin-left: 8px;
}

.conv-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-text {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.unread-badge {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 10px;
  flex-shrink: 0;
}

.empty-conversations,
.loading-conversations {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.empty-conversations button {
  margin-top: 12px;
  padding: 8px 16px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
}

/* Divider */
.panel-divider {
  width: 2px;
  min-width: 2px;
  background: rgba(255, 255, 255, 0.3);
  flex-shrink: 0;
  align-self: stretch;
}

/* Right Panel - Chat */
.chat-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: hsl(var(--background));
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: hsl(var(--card));
  border-bottom: 1px solid hsl(var(--border));
}

.chat-header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.chat-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: hsl(var(--primary) / 0.2);
  color: hsl(var(--primary));
  font-weight: 600;
  font-size: 16px;
  overflow: hidden;
}

.chat-avatar.group {
  background: hsl(220 80% 50% / 0.2);
  color: hsl(220 80% 50%);
}

.chat-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.chat-header-text h2 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.chat-subtitle {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.chat-header-actions {
  display: flex;
  gap: 8px;
}

.header-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  cursor: pointer;
  transition: all 0.15s;
}

.header-action-btn:hover {
  background: hsl(var(--muted) / 0.8);
  color: hsl(var(--foreground));
}

.header-action-btn.active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

/* Messages */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.loading-messages {
  display: flex;
  justify-content: center;
  padding: 20px;
}

.messages-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.message {
  display: flex;
  max-width: 70%;
}

.message.own {
  margin-left: auto;
}

.message-bubble {
  position: relative;
  padding: 10px 14px;
  border-radius: 18px;
  background: hsl(var(--muted));
}

.message.own .message-bubble {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-bottom-right-radius: 4px;
}

.message:not(.own) .message-bubble {
  border-bottom-left-radius: 4px;
}

.message.deleted .message-bubble {
  background: hsl(var(--muted) / 0.5);
}

.message-sender {
  font-size: 12px;
  font-weight: 500;
  color: hsl(var(--primary));
  margin-bottom: 4px;
}

.message-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.deleted-text {
  margin: 0;
  font-size: 14px;
  font-style: italic;
  color: hsl(var(--muted-foreground));
}

.message-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
}

.message-time {
  font-size: 11px;
  opacity: 0.7;
}

.edited-label {
  font-size: 11px;
  opacity: 0.7;
}

.message-actions {
  position: absolute;
  top: 50%;
  left: -50px;
  transform: translateY(-50%);
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.message:hover .message-actions {
  opacity: 1;
}

.message-actions button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.message-actions button:hover {
  background: hsl(var(--destructive));
  color: hsl(var(--destructive-foreground));
}

.edit-textarea {
  width: 100%;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  padding: 8px;
  color: hsl(var(--foreground));
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
}

.edit-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.edit-actions button {
  padding: 4px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
}

.edit-actions button:first-child {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.edit-actions button:last-child {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

/* Typing indicator */
.typing-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  color: hsl(var(--muted-foreground));
  font-size: 13px;
  font-style: italic;
}

.typing-dots {
  display: flex;
  gap: 3px;
}

.typing-dots span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: hsl(var(--muted-foreground));
  animation: bounce 1.4s infinite ease-in-out both;
}

.typing-dots span:nth-child(1) { animation-delay: -0.32s; }
.typing-dots span:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

/* Input area */
.message-input-area {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 16px 20px;
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

.message-input-area textarea {
  flex: 1;
  padding: 12px 16px;
  background: hsl(var(--muted));
  border: none;
  border-radius: 24px;
  color: hsl(var(--foreground));
  font-size: 14px;
  font-family: inherit;
  resize: none;
  max-height: 120px;
  outline: none;
}

.message-input-area textarea::placeholder {
  color: hsl(var(--muted-foreground));
}

.send-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border: none;
  border-radius: 50%;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  cursor: pointer;
  transition: opacity 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.9;
}

.send-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* No chat selected */
.no-chat-selected {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: hsl(var(--muted-foreground));
  text-align: center;
  padding: 40px;
}

.empty-chat-icon {
  margin-bottom: 20px;
  opacity: 0.3;
}

.no-chat-selected h2 {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.no-chat-selected p {
  margin: 0;
  font-size: 14px;
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: hsl(var(--card));
  border-radius: 16px;
  width: 100%;
  max-width: 440px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid hsl(var(--border));
}

.dialog-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  cursor: pointer;
}

.close-btn:hover {
  background: hsl(var(--muted));
}

.dialog-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.type-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.type-tabs button {
  flex: 1;
  padding: 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: transparent;
  color: hsl(var(--muted-foreground));
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.type-tabs button:hover {
  border-color: hsl(var(--primary));
}

.type-tabs button.active {
  background: hsl(var(--primary));
  border-color: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.group-name-input {
  margin-bottom: 16px;
}

.group-name-input input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--muted));
  color: hsl(var(--foreground));
  font-size: 14px;
  outline: none;
}

.group-name-input input:focus {
  border-color: hsl(var(--primary));
}

.member-search {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: hsl(var(--muted));
  border-radius: 8px;
  margin-bottom: 12px;
}

.member-search svg {
  color: hsl(var(--muted-foreground));
}

.member-search input {
  flex: 1;
  border: none;
  background: transparent;
  color: hsl(var(--foreground));
  font-size: 14px;
  outline: none;
}

.members-list {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid hsl(var(--border));
}

.member-item:last-child {
  border-bottom: none;
}

.member-item:hover {
  background: hsl(var(--muted) / 0.5);
}

.member-item.selected {
  background: hsl(var(--primary) / 0.1);
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: hsl(var(--muted));
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-weight: 500;
  color: hsl(var(--muted-foreground));
}

.member-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-info {
  flex: 1;
  min-width: 0;
}

.member-name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: hsl(var(--foreground));
}

.member-org {
  display: block;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.check-icon {
  color: hsl(var(--primary));
}

.no-members,
.loading-members {
  padding: 24px;
  text-align: center;
  color: hsl(var(--muted-foreground));
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid hsl(var(--border));
}

.cancel-btn,
.create-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.cancel-btn {
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
}

.create-btn {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}

.create-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Spinner */
.spinner {
  width: 24px;
  height: 24px;
  border: 2px solid hsl(var(--border));
  border-top-color: hsl(var(--primary));
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
