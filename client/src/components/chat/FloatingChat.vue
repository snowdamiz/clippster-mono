<script setup lang="ts">
import { useChatPopout } from '@/composables/useChatPopout';
import ChatFab from './ChatFab.vue';
import ChatPopover from './ChatPopover.vue';
import ChatWindow from './ChatWindow.vue';

const { isVisible, showFab, isPopoverOpen, openChatWindowIds } = useChatPopout();
</script>

<template>
  <div v-if="isVisible" class="floating-chat">
    <!-- Chat Windows (stacked from right to left) -->
    <ChatWindow
      v-for="(convId, idx) in openChatWindowIds"
      :key="convId"
      :conversation-id="convId"
      :index="idx"
    />

    <!-- Popover (above FAB) -->
    <Transition name="popover">
      <ChatPopover v-if="isPopoverOpen" class="floating-chat__popover" />
    </Transition>

    <!-- FAB (only show if not on a page with header FAB) -->
    <ChatFab v-if="showFab" class="floating-chat__fab" />
  </div>
</template>

<style scoped>
.floating-chat {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 10001;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  pointer-events: none;
}

.floating-chat > * {
  pointer-events: auto;
}

.floating-chat__popover {
  margin-bottom: 4px;
}

/* Popover transition */
.popover-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.popover-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.popover-enter-from {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}

.popover-leave-to {
  opacity: 0;
  transform: translateY(8px) scale(0.95);
}
</style>
