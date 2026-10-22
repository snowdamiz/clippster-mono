<template>
  <!-- One chat bubble, shared by the AI Video, AI Thumbnail and AI Image chat panels. -->
  <!-- New messages ease in (keyed by id in the thread, so existing ones never replay) -->
  <div v-if="message.role === 'system'" class="animate-enter py-1 text-center text-xs text-fg-subtle">
    <span class="whitespace-pre-wrap break-words">{{ message.content }}</span>
  </div>
  <div v-else class="flex animate-enter gap-2 py-1" :class="message.role === 'user' ? 'flex-row-reverse' : ''">
    <Avatar v-if="message.role === 'assistant'" :icon="Sparkles" tone="ai" size="sm" class="mt-0.5" aria-hidden="true" />
    <div class="flex min-w-0 max-w-[85%] flex-col" :class="message.role === 'user' ? 'items-end' : 'items-start'">
      <div
        class="whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-[1.45] text-fg"
        :class="
          message.role === 'user'
            ? 'rounded-tr-md bg-brand-soft'
            : 'rounded-tl-md border border-line-subtle bg-surface-raised'
        "
      >
        {{ message.content }}
      </div>
      <span class="mt-1 px-1 text-2xs text-fg-subtle">{{ formatTime(message.inserted_at) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import type { AIChatMessage } from '@/types/ai-chat';
  import { formatTime as fmtTime } from '@/utils/dateTimeUtils';
  import { Sparkles } from 'lucide-vue-next';
  import { Avatar } from '@/components/ui/avatar';

  defineProps<{
    message: AIChatMessage;
  }>();

  function formatTime(iso: string) {
    return fmtTime(iso);
  }
</script>
