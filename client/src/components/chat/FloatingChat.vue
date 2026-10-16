<script setup lang="ts">
import { useChatPopout } from '@/composables/useChatPopout';
import ChatPopover from './ChatPopover.vue';
import ChatWindow from './ChatWindow.vue';

// The chat entry point lives in the title bar (and in editor headers), so the
// popover drops down from the top-right instead of floating over page content.
const { isVisible, isPopoverOpen, openChatWindowIds } = useChatPopout();
</script>

<template>
  <template v-if="isVisible">
    <Transition name="popover">
      <ChatPopover v-if="isPopoverOpen" class="fixed right-3 top-[calc(var(--titlebar-height)+6px)] z-[10001]" />
    </Transition>

    <!-- Chat windows (stacked from right to left) -->
    <div class="floating-chat">
      <ChatWindow
        v-for="(convId, idx) in openChatWindowIds"
        :key="convId"
        :conversation-id="convId"
        :index="idx"
      />
    </div>
  </template>
</template>

<style scoped>
.floating-chat {
  position: fixed;
  bottom: 16px;
  right: 16px;
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

.popover-enter-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.popover-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.popover-enter-from,
.popover-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
</style>
