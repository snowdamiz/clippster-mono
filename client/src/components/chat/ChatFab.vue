<script setup lang="ts">
import { useMessagingStore } from '@/stores/messaging';
import { useChatPopout } from '@/composables/useChatPopout';
import { MessageSquare } from 'lucide-vue-next';

const messagingStore = useMessagingStore();
const { togglePopover, hasNewMessagePulse, isPopoverOpen } = useChatPopout();
</script>

<template>
  <button
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
  width: 52px;
  height: 52px;
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
  width: 24px;
  height: 24px;
}

.chat-fab__badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
  background: #ef4444;
  color: white;
  border-radius: 10px;
  border: 2px solid #0a0a0b;
  line-height: 1;
}
</style>
