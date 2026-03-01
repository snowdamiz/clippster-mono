<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useMessagingStore } from '@/stores/messaging';
import { useAuthStore } from '@/stores/auth';
import ConversationList from './ConversationList.vue';
import ChatView from './ChatView.vue';
import NewConversationDialog from './NewConversationDialog.vue';

const props = defineProps<{
  organizationId: number;
}>();

const messagingStore = useMessagingStore();
const authStore = useAuthStore();

const showNewConversationDialog = ref(false);

const isInitialized = computed(() => messagingStore.currentOrgId === props.organizationId);

onMounted(async () => {
  if (props.organizationId && authStore.isAuthenticated) {
    await messagingStore.initialize(props.organizationId);
  }
});

onUnmounted(() => {
  messagingStore.cleanupPageOnly();
});

watch(() => props.organizationId, async (newOrgId) => {
  if (newOrgId && authStore.isAuthenticated) {
    messagingStore.cleanupPageOnly();
    await messagingStore.initialize(newOrgId);
  }
});

function handleConversationSelect(conversationId: number) {
  messagingStore.setActiveConversation(conversationId);
}

function handleNewConversation() {
  showNewConversationDialog.value = true;
}

async function handleConversationCreated(conversationId: number) {
  showNewConversationDialog.value = false;
  await messagingStore.setActiveConversation(conversationId);
}
</script>

<template>
  <div class="messaging-panel">
    <!-- Loading state -->
    <div v-if="messagingStore.isLoading" class="loading-state">
      <div class="spinner"></div>
      <span>Loading messages...</span>
    </div>

    <!-- Main content -->
    <template v-else>
      <!-- Conversation list sidebar -->
      <div class="conversation-sidebar">
        <div class="sidebar-header">
          <h2>Messages</h2>
          <button 
            class="new-conversation-btn"
            @click="handleNewConversation"
            title="New conversation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
        
        <ConversationList
          :conversations="messagingStore.conversationList"
          :active-conversation-id="messagingStore.activeConversationId"
          :unread-counts="messagingStore.unreadCounts"
          :current-user-id="authStore.user?.id"
          @select="handleConversationSelect"
        />
      </div>

      <!-- Chat view -->
      <div class="chat-area">
        <ChatView
          v-if="messagingStore.activeConversation"
          :conversation="messagingStore.activeConversation"
          :messages="messagingStore.activeMessages"
          :current-user-id="authStore.user?.id"
          :typing-users="messagingStore.activeTypingUsers"
          :is-loading="messagingStore.isLoadingMessages"
        />
        <div v-else class="no-conversation-selected">
          <div class="empty-state">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <h3>Select a conversation</h3>
            <p>Choose a conversation from the list or start a new one</p>
          </div>
        </div>
      </div>
    </template>

    <!-- New conversation dialog -->
    <NewConversationDialog
      v-if="showNewConversationDialog"
      :organization-id="organizationId"
      @close="showNewConversationDialog = false"
      @created="handleConversationCreated"
    />
  </div>
</template>

<style scoped>
.messaging-panel {
  display: flex;
  height: 100%;
  background: var(--bg-primary, #1a1a1a);
  border-radius: 8px;
  overflow: hidden;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  gap: 12px;
  color: var(--text-secondary, #888);
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--border-color, #333);
  border-top-color: var(--accent-color, #7c3aed);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.conversation-sidebar {
  width: 320px;
  min-width: 280px;
  border-right: 1px solid var(--border-color, #333);
  display: flex;
  flex-direction: column;
  background: var(--bg-secondary, #222);
}

.sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-color, #333);
}

.sidebar-header h2 {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.new-conversation-btn {
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
  transition: background 0.2s;
}

.new-conversation-btn:hover {
  background: var(--accent-hover, #6d28d9);
}

.chat-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.no-conversation-selected {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.empty-state {
  text-align: center;
  color: var(--text-secondary, #888);
}

.empty-state svg {
  margin-bottom: 16px;
  opacity: 0.5;
}

.empty-state h3 {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}
</style>
