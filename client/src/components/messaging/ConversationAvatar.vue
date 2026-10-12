<script setup lang="ts">
  /**
   * Round avatar for a conversation or participant: the shared `Avatar` with
   * the user's photo when available, otherwise initials (people, brand tint)
   * or a type icon (group, announcement, support). Shared by the Messages
   * page, the title-bar chat popover, the floating chat windows and the admin
   * inboxes.
   */
  import { computed } from 'vue';
  import { Headset, Megaphone, Users } from 'lucide-vue-next';
  import { Avatar } from '@/components/ui/avatar';

  const props = withDefaults(
    defineProps<{
      name?: string;
      src?: string | null;
      type?: 'direct' | 'group' | 'announcement' | 'support' | 'user';
      /** xs 20 · sm 28 · md 36 · lg 44 */
      size?: 'xs' | 'sm' | 'md' | 'lg';
    }>(),
    { name: '', type: 'direct', size: 'md' }
  );

  const icon = computed(() => {
    if (props.type === 'support') return Headset;
    if (props.type === 'group') return Users;
    if (props.type === 'announcement') return Megaphone;
    return undefined;
  });
</script>

<template>
  <Avatar :src="src" :name="name" :icon="icon" :size="size" :tone="icon ? 'neutral' : 'brand'" aria-hidden="true" />
</template>
