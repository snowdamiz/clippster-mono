<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { useMessagingStore } from '@/stores/messaging';
import { useAuthStore } from '@/stores/auth';
import { useChatPopout } from '@/composables/useChatPopout';
import { formatConversationTime } from '@/utils/dateTimeUtils';
import type { Conversation } from '@/services/messagingApi';
import { MessageSquare, Maximize2, SearchX, X } from 'lucide-vue-next';
import ConversationRow from '@/components/messaging/ConversationRow.vue';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { SearchField } from '@/components/ui/search-field';

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
  <div
    class="flex max-h-[min(520px,calc(100vh-var(--titlebar-height)-24px))] w-[340px] flex-col overflow-hidden rounded-xl bg-surface-raised shadow-[var(--shadow-lg)]"
    role="dialog"
    aria-label="Messages"
  >
    <!-- Header -->
    <div class="flex h-11 shrink-0 items-center gap-1 border-b border-line-subtle pl-3.5 pr-1.5">
      <h3 class="flex-1 text-sm font-semibold text-fg">Messages</h3>
      <Button variant="ghost" size="icon-sm" aria-label="Open messages page" title="Open messages page" @click="goToMessagesPage">
        <Maximize2 />
      </Button>
      <Button variant="ghost" size="icon-sm" aria-label="Close" title="Close" @click="closePopover">
        <X />
      </Button>
    </div>

    <!-- Search -->
    <div class="shrink-0 px-2.5 pb-1.5 pt-2.5">
      <SearchField v-model="searchQuery" placeholder="Search conversations" size="sm" />
    </div>

    <!-- Conversation list -->
    <div class="min-h-0 flex-1 overflow-y-auto px-1.5 pb-1.5">
      <!-- First load only; re-initialising keeps the list on screen -->
      <div v-if="messagingStore.isLoading && messagingStore.conversationList.length === 0" class="flex flex-col">
        <div v-for="i in 4" :key="i" class="flex items-center gap-2.5 px-2 py-1.5">
          <div class="skeleton size-7 shrink-0 !rounded-full" />
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <div class="skeleton h-2.5 w-2/5" />
            <div class="skeleton h-2 w-4/5" />
          </div>
        </div>
      </div>

      <EmptyState
        v-else-if="filteredConversations.length === 0"
        size="sm"
        :icon="searchQuery ? SearchX : MessageSquare"
        :title="searchQuery ? 'No matches' : 'No conversations yet'"
        :description="searchQuery ? undefined : 'Start a conversation from the Messages page.'"
      >
        <Button v-if="!searchQuery" variant="secondary" size="sm" @click="goToMessagesPage">Open messages</Button>
      </EmptyState>

      <div v-else class="flex animate-fade-in flex-col gap-0.5">
        <ConversationRow
          v-for="conv in filteredConversations"
          :key="conv.id"
          size="sm"
          :name="getConversationName(conv)"
          :type="conv.type"
          :avatar-url="getConversationAvatar(conv)"
          :preview="conv.lastMessagePreview"
          :time="conv.lastMessageAt ? formatConversationTime(conv.lastMessageAt) : ''"
          :unread="getUnreadCount(conv.id)"
          :muted="conv.muted"
          @select="handleSelectConversation(conv.id)"
        />
      </div>
    </div>
  </div>
</template>
