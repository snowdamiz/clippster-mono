<script setup lang="ts">
  /**
   * Message list for admin chats: day dividers, sender names only at the start
   * of a run, and a read-only messaging `MessageBubble` for each message.
   * Render it inside the page's own scroll container (the page keeps the
   * scroll ref). With `loading` and no messages yet it draws placeholder
   * bubbles (delayed `.skeleton` blocks, so fast loads never flash); key it
   * by conversation so each thread eases in.
   *
   *   <div ref="messagesContainer" class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
   *     <AdminChatThread :key="conversation.id" :messages="threadMessages" :loading="loadingMessages" />
   *   </div>
   */
  import type { AdminChatMessage } from './types';
  import MessageBubble from '@/components/messaging/MessageBubble.vue';

  const props = defineProps<{ messages: AdminChatMessage[]; loading?: boolean }>();

  /** Placeholder bubble widths / sides while the first messages load. */
  const placeholders = [
    { own: false, width: 'w-56' },
    { own: false, width: 'w-40' },
    { own: true, width: 'w-64' },
    { own: false, width: 'w-48' },
  ];

  function dayKey(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toDateString();
  }

  function dayDividerLabel(index: number): string | null {
    const current = props.messages[index]?.time;
    const key = dayKey(current);
    if (!key) return null;
    if (index > 0 && dayKey(props.messages[index - 1]?.time) === key) return null;
    const date = new Date(current!);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (key === today.toDateString()) return 'Today';
    if (key === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== today.getFullYear() ? { year: 'numeric' } : {}),
    });
  }

  function showSender(index: number): boolean {
    const message = props.messages[index];
    const previous = props.messages[index - 1];
    if (!previous || previous.system || dayDividerLabel(index)) return true;
    return previous.own !== message.own || previous.senderId !== message.senderId;
  }
</script>

<template>
  <div v-if="loading && !messages.length" class="mx-auto flex max-w-[860px] flex-col gap-3" aria-busy="true">
    <div
      v-for="(bubble, index) in placeholders"
      :key="index"
      :class="['skeleton h-9 rounded-2xl', bubble.width, bubble.own ? 'self-end' : 'self-start']"
    />
  </div>
  <div v-else class="mx-auto flex max-w-[860px] animate-fade-in flex-col gap-2">
    <template v-for="(message, index) in messages" :key="message.id">
      <div v-if="dayDividerLabel(index)" class="flex items-center gap-3 py-2">
        <div class="h-px flex-1 bg-line-subtle" />
        <span class="text-2xs font-medium text-fg-subtle">{{ dayDividerLabel(index) }}</span>
        <div class="h-px flex-1 bg-line-subtle" />
      </div>
      <MessageBubble
        :message="{
          content: message.content,
          messageType: message.system ? 'system' : 'text',
          insertedAt: message.time,
          sender: message.senderName ? { displayName: message.senderName } : null,
        }"
        :is-own-message="message.own"
        :show-sender="showSender(index)"
        :show-status="false"
        readonly
      />
    </template>
  </div>
</template>
