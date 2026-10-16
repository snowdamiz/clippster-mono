<script setup lang="ts">
  /**
   * Selectable member row (checkbox · avatar · name/email · role) used by the
   * organization assignment and recipient pickers. The whole row toggles.
   */
  import { Badge } from '@/components/ui/badge';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Avatar } from '@/components/ui/avatar';
  import { roleBadgeVariant } from './helpers';

  withDefaults(
    defineProps<{
      name: string;
      email?: string | null;
      avatarUrl?: string | null;
      role?: string | null;
      checked: boolean;
      disabled?: boolean;
      /** Denser row without the avatar, for inline recipient lists. */
      compact?: boolean;
    }>(),
    { compact: false }
  );

  const emit = defineEmits<{ toggle: [] }>();
</script>

<template>
  <label
    class="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2.5 transition-colors hover:bg-surface-hover"
    :class="[
      compact ? 'py-1.5' : 'py-2',
      checked && !compact ? 'bg-brand-soft hover:bg-[var(--brand-soft-hover)]' : '',
      disabled ? 'pointer-events-none opacity-50' : '',
    ]"
  >
    <Checkbox :model-value="checked" :disabled="disabled" @update:model-value="emit('toggle')" />
    <Avatar v-if="!compact" :src="avatarUrl" :name="name" size="md" />
    <span class="min-w-0 flex-1">
      <span class="block truncate text-sm text-fg">{{ name }}</span>
      <span v-if="email && email !== name && !compact" class="block truncate text-xs text-fg-subtle">{{ email }}</span>
    </span>
    <Badge v-if="role" :variant="roleBadgeVariant(role)" class="capitalize">{{ role }}</Badge>
  </label>
</template>
