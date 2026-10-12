<script setup lang="ts">
  /**
   * One conversation in a list: avatar, name, last-message preview, time and
   * unread count. Used by the Messages page list pane, the title-bar chat
   * popover and the admin messaging pages.
   */
  import { BellOff, Pin } from 'lucide-vue-next';
  import ConversationAvatar from './ConversationAvatar.vue';

  withDefaults(
    defineProps<{
      name: string;
      preview?: string | null;
      time?: string;
      unread?: number;
      active?: boolean;
      muted?: boolean;
      pinned?: boolean;
      type?: 'direct' | 'group' | 'announcement' | 'support';
      avatarUrl?: string | null;
      /** `sm` for the popover, `md` for the Messages page. */
      size?: 'sm' | 'md';
    }>(),
    { preview: null, time: '', unread: 0, type: 'direct', avatarUrl: null, size: 'md' }
  );

  defineEmits<{ select: [] }>();
</script>

<template>
  <button
    type="button"
    class="group flex w-full min-w-0 items-center gap-2.5 rounded-lg text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
    :class="[
      size === 'sm' ? 'px-2 py-1.5' : 'px-2.5 py-2',
      active ? 'bg-surface-active' : 'hover:bg-surface-hover',
    ]"
    :aria-current="active ? 'true' : undefined"
    @click="$emit('select')"
  >
    <ConversationAvatar :name="name" :src="avatarUrl" :type="type" :size="size === 'sm' ? 'sm' : 'md'" />
    <span class="flex min-w-0 flex-1 flex-col">
      <span class="flex min-w-0 items-center gap-1.5">
        <span class="min-w-0 flex-1 truncate text-sm" :class="unread > 0 ? 'font-semibold text-fg' : 'font-medium text-fg'">
          {{ name }}
        </span>
        <Pin v-if="pinned" class="size-3 shrink-0 text-fg-subtle" aria-label="Pinned" />
        <BellOff v-if="muted" class="size-3 shrink-0 text-fg-subtle" aria-label="Muted" />
        <span v-if="time" class="tabular shrink-0 text-2xs" :class="unread > 0 ? 'text-brand' : 'text-fg-subtle'">
          {{ time }}
        </span>
      </span>
      <span class="flex min-w-0 items-center gap-2">
        <span class="min-w-0 flex-1 truncate text-xs" :class="unread > 0 ? 'text-fg' : 'text-fg-muted'">
          <slot name="preview">{{ preview || 'No messages yet' }}</slot>
        </span>
        <span
          v-if="unread > 0"
          class="tabular grid h-4 min-w-4 shrink-0 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold leading-none text-brand-fg"
        >
          {{ unread > 99 ? '99+' : unread }}
        </span>
      </span>
    </span>
  </button>
</template>
