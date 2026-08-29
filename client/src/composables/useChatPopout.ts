import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMessagingStore } from '@/stores/messaging';
import { useAuthStore } from '@/stores/auth';

const MAX_OPEN_WINDOWS = 1; // Only one chat bubble at a time

// Shared singleton state (persists across component mounts)
const isPopoverOpen = ref(false);
const openChatWindowIds = ref<number[]>([]);
const hasNewMessagePulse = ref(false);
let pulseTimeout: ReturnType<typeof setTimeout> | null = null;

// Track the active conversation ID for automatic switching
const activeConversationId = ref<number | null>(null);

export function useChatPopout() {
  const route = useRoute();
  const messagingStore = useMessagingStore();
  const authStore = useAuthStore();

  // Hide floating chat on certain pages
  const isVisible = computed(() => {
    if (!authStore.isAuthenticated) return false;
    const path = route.path;
    // Hide on messages page (redundant) and PIP window
    if (path === '/messages') return false;
    if (path === '/pip-controls') return false;
    return true;
  });

  // Hide FAB on pages that have their own ChatFab in the header
  const showFab = computed(() => {
    const path = route.path;
    // OpenCut editor has ChatFab in header, so hide the floating FAB
    if (path === '/editor' || path.startsWith('/design-studio/edit')) return false;
    return true;
  });

  function togglePopover() {
    // If chat windows are open, close them and open the conversation list in one click
    if (openChatWindowIds.value.length > 0) {
      openChatWindowIds.value = [];
      isPopoverOpen.value = true;
      hasNewMessagePulse.value = false;
      return;
    }

    isPopoverOpen.value = !isPopoverOpen.value;
    // Clear pulse when user opens popover
    if (isPopoverOpen.value) {
      hasNewMessagePulse.value = false;
    }
  }

  function closePopover() {
    isPopoverOpen.value = false;
  }

  function openChat(conversationId: number) {
    // Only one chat at a time - replace the current one
    openChatWindowIds.value = [conversationId];
    activeConversationId.value = conversationId;
    // Close popover when opening a chat
    isPopoverOpen.value = false;
  }

  function switchToConversation(conversationId: number) {
    // Switch to a new conversation (when new message arrives)
    openChatWindowIds.value = [conversationId];
    activeConversationId.value = conversationId;
  }

  function closeChat(conversationId: number) {
    const idx = openChatWindowIds.value.indexOf(conversationId);
    if (idx !== -1) {
      // Leave the conversation channel
      messagingStore.setActiveConversation(null);
      openChatWindowIds.value.splice(idx, 1);
    }
  }

  function isChatOpen(conversationId: number): boolean {
    return openChatWindowIds.value.includes(conversationId);
  }

  // Trigger pulse animation on new message
  function triggerPulse() {
    hasNewMessagePulse.value = true;
    if (pulseTimeout) clearTimeout(pulseTimeout);
    pulseTimeout = setTimeout(() => {
      hasNewMessagePulse.value = false;
    }, 3000);
  }

  // Watch for new messages to switch conversation if minimized
  watch(
    () => messagingStore.conversations,
    (conversations) => {
      // If there's a chat window open and minimized, check for new messages
      if (openChatWindowIds.value.length > 0) {
        const currentConvId = openChatWindowIds.value[0];
        
        // Find conversation with most recent message that's not the current one
        let mostRecentConv: any = null;
        let mostRecentTime = 0;
        
        conversations.forEach((conv: any) => {
          const lastMessageAt = conv.lastMessageAt || conv.last_message_at;
          if (lastMessageAt) {
            const time = new Date(lastMessageAt).getTime();
            if (time > mostRecentTime && conv.id !== currentConvId) {
              mostRecentTime = time;
              mostRecentConv = conv;
            }
          }
        });
        
        // If there's a newer conversation, switch to it
        if (mostRecentConv) {
          switchToConversation(mostRecentConv.id);
        }
      }
    },
    { deep: true }
  );

  // Watch for unread count changes to trigger pulse
  watch(
    () => messagingStore.totalUnread,
    (newCount, oldCount) => {
      if (newCount > (oldCount ?? 0)) {
        triggerPulse();
      }
    }
  );

  return {
    // State
    isPopoverOpen,
    openChatWindowIds,
    hasNewMessagePulse,
    isVisible,
    showFab,
    activeConversationId,

    // Actions
    togglePopover,
    closePopover,
    openChat,
    closeChat,
    isChatOpen,
    triggerPulse,
    switchToConversation,
  };
}
