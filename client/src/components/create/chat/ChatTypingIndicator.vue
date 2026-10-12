<script setup lang="ts">
  /** "Assistant is typing" row for the AI chat panels: avatar + three bouncing dots (+ optional label). */
  import { Sparkles } from 'lucide-vue-next';
  import { Avatar } from '@/components/ui/avatar';

  defineProps<{ label?: string }>();
</script>

<template>
  <div class="flex animate-fade-in items-center gap-2 py-1" role="status" :aria-label="label || 'Assistant is typing'">
    <Avatar :icon="Sparkles" tone="ai" size="sm" aria-hidden="true" />
    <div class="flex h-7 items-center gap-1 rounded-2xl rounded-tl-md border border-line-subtle bg-surface-raised px-3">
      <span v-for="i in 3" :key="i" class="typing-dot size-1.5 rounded-full bg-fg-subtle" :style="{ animationDelay: `${(i - 1) * 0.15}s` }" />
    </div>
    <span v-if="label" class="text-xs text-fg-subtle">{{ label }}</span>
  </div>
</template>

<style scoped>
  .typing-dot {
    animation: typing-bounce 1.2s infinite ease-in-out;
  }

  @keyframes typing-bounce {
    0%,
    80%,
    100% {
      transform: translateY(0);
      opacity: 0.5;
    }
    40% {
      transform: translateY(-3px);
      opacity: 1;
    }
  }
</style>
