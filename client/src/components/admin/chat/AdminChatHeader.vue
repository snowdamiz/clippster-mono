<script setup lang="ts">
  /**
   * Header row of an admin chat pane: avatar, title, subtitle and actions,
   * matching the Messages page chat header.
   *
   *   <AdminChatHeader :title="name" subtitle="jane@example.com" type="support">
   *     <Button variant="ghost" size="icon-sm" title="Close ticket"><Archive /></Button>
   *   </AdminChatHeader>
   */
  import ConversationAvatar from '@/components/messaging/ConversationAvatar.vue';

  withDefaults(
    defineProps<{
      title: string;
      subtitle?: string;
      avatarUrl?: string | null;
      type?: 'direct' | 'group' | 'announcement' | 'support' | 'user';
    }>(),
    { subtitle: '', avatarUrl: null, type: 'direct' }
  );
</script>

<template>
  <header class="flex h-14 shrink-0 items-center gap-3 border-b border-line-subtle px-4">
    <ConversationAvatar :name="title" :src="avatarUrl" :type="type" size="md" />
    <div class="min-w-0 flex-1">
      <h2 class="truncate text-sm font-semibold text-fg">{{ title }}</h2>
      <p v-if="subtitle || $slots.subtitle" class="truncate text-xs text-fg-subtle">
        <slot name="subtitle">{{ subtitle }}</slot>
      </p>
    </div>
    <div v-if="$slots.default" class="flex shrink-0 items-center gap-0.5">
      <slot />
    </div>
  </header>
</template>
