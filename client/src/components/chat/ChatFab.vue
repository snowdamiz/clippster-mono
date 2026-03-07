<script setup lang="ts">
import { useMessagingStore } from '@/stores/messaging';
import { useChatPopout } from '@/composables/useChatPopout';
import { MessageSquare } from 'lucide-vue-next';

defineProps<{ compact?: boolean }>();

const messagingStore = useMessagingStore();
const { togglePopover, hasNewMessagePulse, isPopoverOpen } = useChatPopout();
</script>

<template>
  <!-- Compact header variant -->
  <button
    v-if="compact"
    class="relative flex size-8 items-center justify-center rounded-md bg-zinc-800 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
    :class="{ 'bg-zinc-700 text-white': isPopoverOpen }"
    @click="togglePopover"
    title="Messages"
  >
    <MessageSquare class="size-4" />
    <span
      v-if="messagingStore.totalUnread > 0"
      class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[#0e0e10] bg-red-500 px-1 text-[10px] font-bold text-white"
    >
      {{ messagingStore.totalUnread > 99 ? '99+' : messagingStore.totalUnread }}
    </span>
  </button>

  <!-- Full floating FAB variant -->
  <button
    v-else
    class="chat-fab"
    :class="{ 'chat-fab--pulse': hasNewMessagePulse, 'chat-fab--active': isPopoverOpen }"
    @click="togglePopover"
    title="Messages"
  >
    <MessageSquare class="chat-fab__icon" />
    <span
      v-if="messagingStore.totalUnread > 0"
      class="chat-fab__badge"
    >
      {{ messagingStore.totalUnread > 99 ? '99+' : messagingStore.totalUnread }}
    </span>
  </button>
</template>

<style scoped>
.chat-fab {
  position: relative;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: none;
  background: var(--sidebar-accent, #0ea5e9);
  color: white;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  transition: background 0.2s, transform 0.2s, box-shadow 0.2s;
  z-index: 9999;
}

.chat-fab:hover {
  background: #0284c7;
  transform: scale(1.05);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
}

.chat-fab--active {
  background: #0284c7;
  transform: scale(0.95);
}

.chat-fab--pulse {
  animation: fab-pulse 1.5s ease-in-out infinite;
}

@keyframes fab-pulse {
  0%, 100% {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
  }
  50% {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 0 0 8px rgba(14, 165, 233, 0.3);
  }
}

.chat-fab__icon {
  width: 20px;
  height: 20px;
}

.chat-fab__badge {
  position: absolute;
  top: -3px;
  right: -3px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  background: #ef4444;
  color: white;
  border-radius: 9px;
  border: 2px solid #0a0a0b;
  line-height: 1;
}
</style>
