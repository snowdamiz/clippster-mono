<script setup lang="ts">
  /**
   * Role pill for organization members and invitations (owner / admin / member).
   * Shared by the organization list, hub, members and billing pages.
   */
  import { computed } from 'vue';
  import { Crown, Shield, User } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { roleBadgeVariant } from '@/components/organization/shared/helpers';

  const props = withDefaults(
    defineProps<{
      role?: string | null;
      size?: 'sm' | 'md';
      /** Hide the leading icon (e.g. in dense rows). */
      plain?: boolean;
    }>(),
    { role: 'member', size: 'sm', plain: false }
  );

  const meta = computed(() => {
    const role = props.role || 'member';
    return {
      variant: roleBadgeVariant(role),
      icon: role === 'owner' ? Crown : role === 'admin' ? Shield : User,
      label: role.charAt(0).toUpperCase() + role.slice(1),
    };
  });
</script>

<template>
  <Badge :variant="meta.variant" :size="size">
    <component :is="meta.icon" v-if="!plain" />
    {{ meta.label }}
  </Badge>
</template>
