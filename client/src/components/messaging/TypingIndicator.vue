<script setup lang="ts">
  /** Subtle "… is typing" line with three pulsing dots, shown under the last message. */
  defineProps<{
    userNames: string[];
  }>();

  function formatTypingText(names: string[]): string {
    if (names.length === 0) return '';
    if (names.length === 1) return `${names[0]} is typing…`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing…`;
    return `${names[0]} and ${names.length - 1} others are typing…`;
  }
</script>

<template>
  <div class="flex items-center gap-2 px-1 py-1 text-2xs text-fg-subtle" role="status" aria-live="polite">
    <span class="inline-flex items-center gap-[3px] rounded-full bg-surface-raised px-2 py-1.5">
      <span class="typing-dot" />
      <span class="typing-dot [animation-delay:150ms]" />
      <span class="typing-dot [animation-delay:300ms]" />
    </span>
    <span class="truncate">{{ formatTypingText(userNames) }}</span>
  </div>
</template>

<style scoped>
  .typing-dot {
    width: 4px;
    height: 4px;
    border-radius: 999px;
    background: var(--fg-subtle);
    animation: typing-bounce 1.2s ease-in-out infinite;
  }

  @keyframes typing-bounce {
    0%,
    60%,
    100% {
      opacity: 0.4;
      transform: translateY(0);
    }
    30% {
      opacity: 1;
      transform: translateY(-2px);
    }
  }
</style>
