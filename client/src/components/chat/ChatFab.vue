<script setup lang="ts">
/**
 * Messages button for the title bar and editor headers: toggles the chat
 * popover and shows the unread count. (The old floating bottom-right FAB
 * variant was retired when chat moved into the title bar; `compact` is kept
 * for API compatibility.)
 */
import { useMessagingStore } from '@/stores/messaging';
import { useChatPopout } from '@/composables/useChatPopout';
import { MessageSquare } from 'lucide-vue-next';

defineProps<{ compact?: boolean }>();

const messagingStore = useMessagingStore();
const { togglePopover, hasNewMessagePulse, isPopoverOpen } = useChatPopout();
</script>

<template>
  <button
    type="button"
    class="relative grid size-7 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg focus-visible:shadow-[var(--focus-ring)]"
    :class="{ 'bg-surface-hover !text-fg': isPopoverOpen, 'chat-fab--pulse': hasNewMessagePulse }"
    title="Messages"
    aria-label="Messages"
    :aria-expanded="isPopoverOpen"
    data-chat-fab
    @click="togglePopover"
  >
    <MessageSquare class="size-[15px]" />
    <span
      v-if="messagingStore.totalUnread > 0"
      class="tabular absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-brand-fg ring-2 ring-canvas"
    >
      {{ messagingStore.totalUnread > 99 ? '99+' : messagingStore.totalUnread }}
    </span>
  </button>
</template>

<style scoped>
.chat-fab--pulse {
  animation: chat-fab-pulse 1.5s ease-in-out infinite;
}

@keyframes chat-fab-pulse {
  0%,
  100% {
    box-shadow: none;
  }
  50% {
    box-shadow: 0 0 0 3px var(--brand-soft-hover);
  }
}
</style>
