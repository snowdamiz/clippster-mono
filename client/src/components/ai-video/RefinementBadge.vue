<template>
  <!-- Refinement budget line shown above the chat composer (AI Video + AI Thumbnail) — plain text, no box. -->
  <div class="flex items-center gap-2.5 px-1 text-xs text-fg-subtle">
    <span class="flex items-center gap-1">
      Round <span class="tabular font-medium text-fg">{{ round }}/{{ maxRounds }}</span>
    </span>
    <span class="h-3 w-px bg-line" aria-hidden="true" />
    <span class="flex items-center gap-1">
      <span class="tabular font-medium" :class="messagesRemaining > 0 ? 'text-fg' : 'text-warning'">
        {{ messagesRemaining }}
      </span>
      {{ messagesRemaining === 1 ? 'message' : 'messages' }} left
    </span>
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    round: number;
    maxRounds: number;
    messagesRemaining: number;
  }>();
</script>
