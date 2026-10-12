<template>
  <PageLayout
    title="Customer service"
    description="Manage support conversations and tickets"
    :icon="Headset"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Customer service' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh tickets" :disabled="isLoading" @click="loadConversations">
        <RefreshCw :class="{ 'animate-spin': isLoading }" />
      </Button>
    </template>

    <div class="flex min-h-0 flex-1">
      <!-- ── Ticket list pane ──────────────────────────────────────── -->
      <aside class="flex w-[clamp(220px,32%,320px)] shrink-0 flex-col border-r border-line-subtle">
        <div class="flex shrink-0 flex-col gap-2 px-3 py-2.5">
          <SearchField v-model="searchQuery" placeholder="Search tickets" size="sm" />
          <SegmentedControl v-model="statusFilter" :options="statusOptions" size="sm" block />
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          <!-- Loading skeleton -->
          <AdminChatListSkeleton v-if="isLoading && !conversations.length" :rows="5" />

          <div v-else class="flex animate-fade-in flex-col gap-0.5">
            <ConversationRow
              v-for="conv in filteredConversations"
              :key="conv.id"
              :name="getUserName(conv)"
              type="direct"
              :preview="conv.lastMessagePreview || conv.last_message_preview"
              :time="formatTime(conv.lastMessageAt || conv.last_message_at)"
              :unread="conv.unread_count || conv.unreadCount || 0"
              :active="conv.id === activeConversation?.id"
              @select="selectConversation(conv)"
            />

            <EmptyState
              v-if="filteredConversations.length === 0"
              size="sm"
              :icon="searchQuery ? SearchX : Inbox"
              :title="searchQuery ? 'No matches' : statusFilter === 'open' ? 'No open tickets' : 'No archived tickets'"
              :description="searchQuery ? `No tickets match “${searchQuery}”.` : statusFilter === 'open' ? 'New support requests will show up here.' : undefined"
            />
          </div>
        </div>

        <p class="shrink-0 border-t border-line-subtle px-4 py-2 text-xs text-fg-subtle">
          <span class="tabular">{{ filteredConversations.length }}</span>
          {{ statusFilter === 'open' ? 'open' : 'archived' }} {{ filteredConversations.length === 1 ? 'ticket' : 'tickets' }}
        </p>
      </aside>

      <!-- ── Chat pane ─────────────────────────────────────────────── -->
      <section class="flex min-w-0 flex-1 flex-col">
        <template v-if="activeConversation">
          <AdminChatHeader :title="getUserName(activeConversation)" :subtitle="getUserEmail(activeConversation)" type="user">
            <Badge :variant="activeConversation.status === 'open' ? 'warning' : 'neutral'" class="mr-1.5">
              {{ activeConversation.status === 'open' ? 'Open' : 'Archived' }}
            </Badge>
            <Button
              v-if="activeConversation.status === 'open'"
              variant="ghost"
              size="sm"
              title="Close ticket"
              @click="showArchiveDialog = true"
            >
              <Archive />
              Close ticket
            </Button>
          </AdminChatHeader>

          <!-- Messages -->
          <div ref="messagesContainer" class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            <AdminChatThread :key="activeConversation.id" :messages="threadMessages" :loading="isLoadingMessages" />
          </div>

          <!-- Composer -->
          <MessageComposer
            v-if="activeConversation.status === 'open'"
            v-model="messageInput"
            placeholder="Type your response…"
            hide-attach
            send-on-enter
            centered
            @send="sendMessage"
          />
          <div
            v-else
            class="flex shrink-0 items-center justify-center gap-2 border-t border-line-subtle px-4 py-3 text-xs text-fg-subtle"
          >
            <Archive class="size-3.5" />
            This ticket is archived
          </div>
        </template>

        <!-- No ticket selected -->
        <EmptyState
          v-else
          :icon="Headset"
          title="Select a ticket"
          description="Choose a support ticket from the list to view and respond."
        />
      </section>
    </div>

    <!-- Close ticket -->
    <ConfirmationModal
      :show="showArchiveDialog"
      title="Close ticket"
      message="The conversation will be archived for admins and moderators, and cleared from the user's view after 24 hours."
      suffix=""
      confirm-text="Close ticket"
      :icon="Archive"
      :show-cannot-undone-text="false"
      @close="showArchiveDialog = false"
      @confirm="archiveConversation"
    />
  </PageLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from 'vue';
import { formatDate as fmtDate } from '@/utils/dateTimeUtils';
import { useAuthStore } from '@/stores/auth';
import api from '@/services/api';
import PageLayout from '@/components/PageLayout.vue';
import ConfirmationModal from '@/components/ConfirmationModal.vue';
import ConversationRow from '@/components/messaging/ConversationRow.vue';
import { AdminChatHeader, AdminChatListSkeleton, AdminChatThread, type AdminChatMessage } from '@/components/admin/chat';
import MessageComposer from '@/components/messaging/MessageComposer.vue';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { Headset, Archive, RefreshCw, SearchX, Inbox } from 'lucide-vue-next';

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

const statusOptions: SegmentedOption<'open' | 'archived'>[] = [
  { value: 'open', label: 'Open' },
  { value: 'archived', label: 'Archived' },
];

const threadMessages = computed<AdminChatMessage[]>(() =>
  sortedMessages.value.map((message: any) => {
    const system = message.messageType === 'system' || message.message_type === 'system';
    return {
      id: message.id,
      content: message.content,
      time: message.insertedAt || message.inserted_at || null,
      senderId: message.sender_id || message.senderId,
      senderName: getSenderName(message),
      own: !system && isStaffMessage(message),
      system,
    };
  })
);

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
  messages.value = [];
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
  // A different ticket set: drop the old list so the first-load skeleton shows.
  conversations.value = [];
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
