import { ref, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { useMessagingStore } from '@/stores/messaging';
import { useAuthStore } from '@/stores/auth';

const MAX_OPEN_WINDOWS = 3;

// Shared singleton state (persists across component mounts)
const isPopoverOpen = ref(false);
const openChatWindowIds = ref<number[]>([]);
const hasNewMessagePulse = ref(false);
let pulseTimeout: ReturnType<typeof setTimeout> | null = null;

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
    // If already open, just focus it (move to front)
    const idx = openChatWindowIds.value.indexOf(conversationId);
    if (idx !== -1) {
      // Move to end (rightmost = most recently opened)
      openChatWindowIds.value.splice(idx, 1);
      openChatWindowIds.value.push(conversationId);
      return;
    }

    // If at max, close the oldest (leftmost)
    if (openChatWindowIds.value.length >= MAX_OPEN_WINDOWS) {
      openChatWindowIds.value.shift();
    }

    openChatWindowIds.value.push(conversationId);
    // Close popover when opening a chat
    isPopoverOpen.value = false;
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

    // Actions
    togglePopover,
    closePopover,
    openChat,
    closeChat,
    isChatOpen,
    triggerPulse,
  };
}
