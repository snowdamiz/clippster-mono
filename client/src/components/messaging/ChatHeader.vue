<script setup lang="ts">
import { computed } from 'vue';
import { useMessagingStore } from '@/stores/messaging';
import type { Conversation } from '@/services/messagingApi';

const props = defineProps<{
  conversation: Conversation;
  currentUserId?: number;
}>();

const messagingStore = useMessagingStore();

const conversationName = computed(() => {
  if (props.conversation.name) {
    return props.conversation.name;
  }
  
  if (props.conversation.type === 'direct') {
    const otherParticipant = props.conversation.participants.find(
      p => p.userId !== props.currentUserId
    );
    return otherParticipant?.user?.displayName || 'Unknown User';
  }
  
  if (props.conversation.type === 'announcement') {
    return 'Announcement';
  }
  
  return 'Group Chat';
});

const participantCount = computed(() => {
  return props.conversation.participants.length;
});

const conversationTypeLabel = computed(() => {
  switch (props.conversation.type) {
    case 'direct':
      return 'Direct Message';
    case 'group':
      return `${participantCount.value} members`;
    case 'announcement':
      return 'Organization Announcement';
    default:
      return '';
  }
});

async function handleToggleMute() {
  try {
    await messagingStore.toggleMute(props.conversation.id);
  } catch (error) {
    console.error('Failed to toggle mute:', error);
  }
}

async function handleLeave() {
  if (!confirm('Are you sure you want to leave this conversation?')) return;
  
  try {
    await messagingStore.leaveConversation(props.conversation.id);
  } catch (error) {
    console.error('Failed to leave conversation:', error);
  }
}
</script>

<template>
  <div class="chat-header">
    <div class="header-info">
      <!-- Icon -->
      <div class="conversation-icon" :class="conversation.type">
        <svg v-if="conversation.type === 'direct'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/>
          <circle cx="12" cy="7" r="4"/>
        </svg>
        <svg v-else-if="conversation.type === 'group'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
          <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="m3 11 18-5v12L3 13v-2z"/>
          <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
        </svg>
      </div>

      <!-- Name and info -->
      <div class="header-text">
        <h3 class="conversation-name">{{ conversationName }}</h3>
        <span class="conversation-type">{{ conversationTypeLabel }}</span>
      </div>
    </div>

    <!-- Actions -->
    <div class="header-actions">
      <!-- Mute toggle -->
      <button 
        class="action-btn"
        :class="{ active: conversation.muted }"
        @click="handleToggleMute"
        :title="conversation.muted ? 'Unmute' : 'Mute'"
      >
        <svg v-if="conversation.muted" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18.36 6.64A9 9 0 0 1 20.77 15"/>
          <path d="M6.16 6.16a9 9 0 1 0 12.68 12.68"/>
          <path d="M12 2v4"/>
          <path d="m2 2 20 20"/>
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
      </button>

      <!-- Leave (for groups only) -->
      <button 
        v-if="conversation.type === 'group'"
        class="action-btn leave"
        @click="handleLeave"
        title="Leave conversation"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-color, #333);
  background: var(--bg-secondary, #222);
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.conversation-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-tertiary, #333);
  color: var(--text-secondary, #888);
}

.conversation-icon.direct {
  background: var(--accent-color, #7c3aed);
  color: white;
}

.conversation-icon.group {
  background: #2563eb;
  color: white;
}

.conversation-icon.announcement {
  background: #dc2626;
  color: white;
}

.header-text {
  display: flex;
  flex-direction: column;
}

.conversation-name {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.conversation-type {
  font-size: 12px;
  color: var(--text-secondary, #888);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 8px;
  background: var(--bg-tertiary, #333);
  color: var(--text-secondary, #888);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}

.action-btn:hover {
  background: var(--bg-hover, #444);
  color: var(--text-primary, #fff);
}

.action-btn.active {
  background: var(--accent-color, #7c3aed);
  color: white;
}

.action-btn.leave:hover {
  background: #dc2626;
  color: white;
}
</style>
