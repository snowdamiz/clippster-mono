<script setup lang="ts">
import { computed } from 'vue';
import type { Conversation } from '@/services/messagingApi';
import { formatConversationTime } from '@/utils/dateTimeUtils';

const props = defineProps<{
  conversations: Conversation[];
  activeConversationId: number | null;
  unreadCounts: Map<number, number>;
  currentUserId?: number;
}>();

const emit = defineEmits<{
  select: [conversationId: number];
}>();

function getConversationName(conversation: Conversation): string {
  if (conversation.name) {
    return conversation.name;
  }
  
  if (conversation.type === 'direct') {
    const otherParticipant = conversation.participants.find(
      p => p.userId !== props.currentUserId
    );
    return otherParticipant?.user?.displayName || 'Unknown User';
  }
  
  if (conversation.type === 'announcement') {
    return 'Announcement';
  }
  
  return 'Group Chat';
}

function getConversationIcon(conversation: Conversation): string {
  switch (conversation.type) {
    case 'direct':
      return 'user';
    case 'group':
      return 'users';
    case 'announcement':
      return 'megaphone';
    default:
      return 'message';
  }
}

function formatTime(dateString: string | null): string {
  if (!dateString) return '';
  return formatConversationTime(dateString);
}

function getUnreadCount(conversationId: number): number {
  return props.unreadCounts.get(conversationId) || 0;
}
</script>

<template>
  <div class="conversation-list">
    <div
      v-for="conversation in conversations"
      :key="conversation.id"
      class="conversation-item"
      :class="{ 
        active: conversation.id === activeConversationId,
        unread: getUnreadCount(conversation.id) > 0
      }"
      @click="emit('select', conversation.id)"
    >
      <!-- Avatar/Icon -->
      <div class="conversation-avatar" :class="conversation.type">
        <svg v-if="getConversationIcon(conversation) === 'user'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <svg v-else-if="getConversationIcon(conversation) === 'users'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <svg v-else-if="getConversationIcon(conversation) === 'megaphone'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 11 18-5v12L3 13v-2z"/>
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
        </svg>
      </div>

      <!-- Content -->
      <div class="conversation-content">
        <div class="conversation-header">
          <span class="conversation-name">{{ getConversationName(conversation) }}</span>
          <span class="conversation-time">{{ formatTime(conversation.lastMessageAt) }}</span>
        </div>
        <div class="conversation-preview">
          <span class="preview-text">{{ conversation.lastMessagePreview || 'No messages yet' }}</span>
          <span v-if="getUnreadCount(conversation.id) > 0" class="unread-badge">
            {{ getUnreadCount(conversation.id) > 99 ? '99+' : getUnreadCount(conversation.id) }}
          </span>
        </div>
      </div>

      <!-- Muted indicator -->
      <div v-if="conversation.muted" class="muted-indicator" title="Muted">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18.36 6.64A9 9 0 0 1 20.77 15"/>
          <path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"/>
          <path d="M12 2v4"/>
          <path d="m2 2 20 20"/>
        </svg>
      </div>
    </div>

    <!-- Empty state -->
    <div v-if="conversations.length === 0" class="empty-list">
      <p>No conversations yet</p>
      <p class="hint">Start a new conversation to begin messaging</p>
    </div>
  </div>
</template>

<style scoped>
.conversation-list {
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
  border-bottom: 1px solid var(--border-color, #333);
}

.conversation-item:hover {
  background: var(--bg-hover, #2a2a2a);
}

.conversation-item.active {
  background: var(--bg-active, #333);
}

.conversation-item.unread .conversation-name {
  font-weight: 600;
}

.conversation-item.unread .preview-text {
  color: var(--text-primary, #fff);
}

.conversation-avatar {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-tertiary, #333);
  color: var(--text-secondary, #888);
}

.conversation-avatar.direct {
  background: var(--accent-color, #7c3aed);
  color: white;
}

.conversation-avatar.group {
  background: #2563eb;
  color: white;
}

.conversation-avatar.announcement {
  background: #dc2626;
  color: white;
}

.conversation-content {
  flex: 1;
  min-width: 0;
}

.conversation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.conversation-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary, #fff);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.conversation-time {
  font-size: 12px;
  color: var(--text-tertiary, #666);
  flex-shrink: 0;
  margin-left: 8px;
}

.conversation-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-text {
  font-size: 13px;
  color: var(--text-secondary, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}

.unread-badge {
  background: var(--accent-color, #7c3aed);
  color: white;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 10px;
  flex-shrink: 0;
}

.muted-indicator {
  color: var(--text-tertiary, #666);
  flex-shrink: 0;
}

.empty-list {
  padding: 32px 16px;
  text-align: center;
  color: var(--text-secondary, #888);
}

.empty-list p {
  margin: 0;
}

.empty-list .hint {
  font-size: 13px;
  margin-top: 8px;
  color: var(--text-tertiary, #666);
}
</style>
