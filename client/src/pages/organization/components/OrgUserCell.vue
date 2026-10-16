<script setup lang="ts">
  /**
   * Avatar + name + email for an organization member, used in member lists,
   * allocation tables and confirmation dialogs.
   */
  import { computed } from 'vue';
  import { Avatar } from '@/components/ui/avatar';

  const props = withDefaults(
    defineProps<{
      user?: { name?: string | null; email?: string | null; avatar_url?: string | null } | null;
      size?: 'sm' | 'md';
      /** Hide the email line. */
      hideEmail?: boolean;
    }>(),
    { user: null, size: 'sm', hideEmail: false }
  );

  const displayName = computed(() => props.user?.name || props.user?.email || 'Unknown user');
  const showEmail = computed(() => !props.hideEmail && !!props.user?.name && !!props.user?.email);
</script>

<template>
  <div class="flex min-w-0 items-center gap-2.5">
    <Avatar :src="user?.avatar_url" :name="user?.name || user?.email" :size="size" />
    <div class="min-w-0">
      <p class="truncate text-sm font-medium text-fg">
        <slot name="name">{{ displayName }}</slot>
      </p>
      <p v-if="showEmail" class="truncate text-xs text-fg-subtle">{{ user?.email }}</p>
    </div>
    <slot />
  </div>
</template>
