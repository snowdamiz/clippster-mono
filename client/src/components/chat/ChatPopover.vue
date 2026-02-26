<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMessagingStore } from '@/stores/messaging';
import { useAuthStore } from '@/stores/auth';
import { useChatPopout } from '@/composables/useChatPopout';
import { formatConversationTime } from '@/utils/dateTimeUtils';
import type { Conversation } from '@/services/messagingApi';
import {
  Search,
  Plus,
  X,
  Users,
  User,
  Megaphone,
  Headset,
  Maximize2,
} from 'lucide-vue-next';

const messagingStore = useMessagingStore();
const authStore = useAuthStore();
const router = useRouter();
const { openChat, closePopover } = useChatPopout();

const searchQuery = ref('');

const filteredConversations = computed(() => {
  const all = messagingStore.conversationList;
  if (!searchQuery.value) return all;
  const query = searchQuery.value.toLowerCase();
  return all.filter((conv) => {
    const name = getConversationName(conv).toLowerCase();
    return name.includes(query);
  });
});

function getConversationName(conversation: Conversation): string {
  if (conversation.name) return conversation.name;
  if (conversation.type === 'support') return 'Clippster Customer Support';
  if (conversation.type === 'direct') {
    const otherParticipant = conversation.participants.find((p) => {
      const pUserId = (p as any).userId ?? (p as any).user_id;
      return pUserId !== authStore.user?.id;
    });
    if (!otherParticipant?.user) return 'Unknown User';
    return otherParticipant.user.displayName || (otherParticipant.user as any).display_name || 'Unknown User';
  }
  if (conversation.type === 'announcement') return 'Announcement';
  return 'Group Chat';
}

function getConversationAvatar(conversation: Conversation): string | null {
  if (conversation.type === 'direct') {
    const otherParticipant = conversation.participants.find((p) => {
      const pUserId = (p as any).userId ?? (p as any).user_id;
      return pUserId !== authStore.user?.id;
    });
    if (!otherParticipant?.user) return null;
    return otherParticipant.user.avatarUrl || (otherParticipant.user as any).avatar_url || null;
  }
  return null;
}

function getUnreadCount(conversationId: number): number {
  return messagingStore.unreadCounts.get(conversationId) || 0;
}

function handleSelectConversation(conversationId: number) {
  openChat(conversationId);
}

function goToMessagesPage() {
  closePopover();
  router.push('/messages');
}
</script>

<template>
  <div class="chat-popover">
    <!-- Header -->
    <div class="chat-popover__header">
      <h3 class="chat-popover__title">Messages</h3>
      <div class="chat-popover__header-actions">
        <button class="chat-popover__btn" @click="goToMessagesPage" title="Open full messages">
          <Maximize2 :size="16" />
        </button>
        <button class="chat-popover__btn" @click="closePopover" title="Close">
          <X :size="16" />
        </button>
      </div>
    </div>

    <!-- Search -->
    <div class="chat-popover__search">
      <Search class="chat-popover__search-icon" :size="14" />
      <input
        v-model="searchQuery"
        type="text"
        placeholder="Search conversations..."
        class="chat-popover__search-input"
      />
    </div>

    <!-- Conversation List -->
    <div class="chat-popover__list">
      <!-- Loading -->
      <div v-if="messagingStore.isLoading" class="chat-popover__loading">
        <div class="chat-popover__spinner"></div>
        <span>Loading...</span>
      </div>

      <!-- Empty -->
      <div v-else-if="filteredConversations.length === 0" class="chat-popover__empty">
        <p>No conversations yet</p>
      </div>

      <!-- Conversations -->
      <template v-else>
        <div
          v-for="conv in filteredConversations"
          :key="conv.id"
          class="chat-popover__item"
          :class="{ 'chat-popover__item--unread': getUnreadCount(conv.id) > 0 }"
          @click="handleSelectConversation(conv.id)"
        >
          <!-- Avatar -->
          <div class="chat-popover__avatar" :class="'chat-popover__avatar--' + conv.type">
            <img
              v-if="getConversationAvatar(conv)"
              :src="getConversationAvatar(conv)!"
              :alt="getConversationName(conv)"
              class="chat-popover__avatar-img"
            />
            <template v-else>
              <Headset v-if="conv.type === 'support'" :size="18" />
              <Users v-else-if="conv.type === 'group'" :size="18" />
              <Megaphone v-else-if="conv.type === 'announcement'" :size="18" />
              <span v-else class="chat-popover__avatar-initial">
                {{ getConversationName(conv).charAt(0).toUpperCase() }}
              </span>
            </template>
          </div>

          <!-- Content -->
          <div class="chat-popover__content">
            <div class="chat-popover__item-header">
              <span class="chat-popover__name">{{ getConversationName(conv) }}</span>
              <span class="chat-popover__time">
                {{ conv.lastMessageAt ? formatConversationTime(conv.lastMessageAt) : '' }}
              </span>
            </div>
            <div class="chat-popover__preview-row">
              <span class="chat-popover__preview">
                {{ conv.lastMessagePreview || 'No messages yet' }}
              </span>
              <span v-if="getUnreadCount(conv.id) > 0" class="chat-popover__badge">
                {{ getUnreadCount(conv.id) > 99 ? '99+' : getUnreadCount(conv.id) }}
              </span>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.chat-popover {
  width: 340px;
  max-height: 500px;
  background: var(--sidebar-surface, #141416);
  border: 1px solid var(--sidebar-border, #1f1f23);
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.chat-popover__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--sidebar-border, #1f1f23);
}

.chat-popover__title {
  font-size: 16px;
  font-weight: 600;
  color: var(--sidebar-text, #fafafa);
  margin: 0;
}

.chat-popover__header-actions {
  display: flex;
  gap: 4px;
}

.chat-popover__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--sidebar-text-muted, #71717a);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.chat-popover__btn:hover {
  background: var(--sidebar-hover, rgba(255, 255, 255, 0.05));
  color: var(--sidebar-text, #fafafa);
}

.chat-popover__search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--sidebar-border, #1f1f23);
}

.chat-popover__search-icon {
  color: var(--sidebar-text-muted, #71717a);
  flex-shrink: 0;
}

.chat-popover__search-input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--sidebar-text, #fafafa);
  font-size: 13px;
  font-family: inherit;
}

.chat-popover__search-input::placeholder {
  color: var(--sidebar-text-muted, #71717a);
}

.chat-popover__list {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.chat-popover__loading,
.chat-popover__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 32px 16px;
  color: var(--sidebar-text-muted, #71717a);
  font-size: 13px;
}

.chat-popover__spinner {
  width: 16px;
  height: 16px;
  border: 2px solid var(--sidebar-border, #1f1f23);
  border-top-color: var(--sidebar-accent, #0ea5e9);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.chat-popover__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.chat-popover__item:hover {
  background: var(--sidebar-hover, rgba(255, 255, 255, 0.05));
}

.chat-popover__item--unread .chat-popover__name {
  font-weight: 600;
}

.chat-popover__item--unread .chat-popover__preview {
  color: var(--sidebar-text, #fafafa);
}

.chat-popover__avatar {
  width: 38px;
  height: 38px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.08);
  color: var(--sidebar-text-muted, #71717a);
}

.chat-popover__avatar--direct {
  background: var(--sidebar-accent, #0ea5e9);
  color: white;
}

.chat-popover__avatar--group {
  background: #2563eb;
  color: white;
}

.chat-popover__avatar--announcement {
  background: #dc2626;
  color: white;
}

.chat-popover__avatar--support {
  background: #16a34a;
  color: white;
}

.chat-popover__avatar-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 50%;
}

.chat-popover__avatar-initial {
  font-size: 16px;
  font-weight: 600;
}

.chat-popover__content {
  flex: 1;
  min-width: 0;
}

.chat-popover__item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 2px;
}

.chat-popover__name {
  font-size: 13px;
  font-weight: 500;
  color: var(--sidebar-text, #fafafa);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chat-popover__time {
  font-size: 11px;
  color: var(--sidebar-text-muted, #71717a);
  flex-shrink: 0;
}

.chat-popover__preview-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.chat-popover__preview {
  font-size: 12px;
  color: var(--sidebar-text-muted, #71717a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.chat-popover__badge {
  background: var(--sidebar-accent, #0ea5e9);
  color: white;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 5px;
  border-radius: 8px;
  flex-shrink: 0;
}
</style>
