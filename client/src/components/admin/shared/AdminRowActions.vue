<script setup lang="ts">
  /**
   * Row-end "⋯" actions menu for admin tables and lists. Put
   * <AdminActionItem> (or any DropdownMenuItem / DropdownMenuSeparator)
   * children inside. Clicks never bubble to a clickable row.
   *
   *   <AdminRowActions label="Actions for Jane">
   *     <AdminActionItem :icon="Pencil" @select="edit(row)">Edit</AdminActionItem>
   *     <DropdownMenuSeparator />
   *     <AdminActionItem :icon="Trash2" destructive @select="remove(row)">Delete</AdminActionItem>
   *   </AdminRowActions>
   *
   * `loading` swaps the trigger icon for a spinner while an action runs.
   */
  import type { HTMLAttributes } from 'vue';
  import { Loader2, MoreHorizontal } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

  withDefaults(
    defineProps<{
      /** Accessible label / tooltip for the trigger. */
      label?: string;
      loading?: boolean;
      disabled?: boolean;
      align?: 'start' | 'center' | 'end';
      contentClass?: HTMLAttributes['class'];
    }>(),
    { label: 'Actions', align: 'end' }
  );
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child :disabled="disabled || loading">
      <Button
        variant="ghost"
        size="icon-sm"
        :title="label"
        :aria-label="label"
        data-row-action
        class="data-[state=open]:bg-surface-active data-[state=open]:text-fg"
        @click.stop
      >
        <Loader2 v-if="loading" class="animate-spin" />
        <MoreHorizontal v-else />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent :align="align" :class="['min-w-48', contentClass]">
      <slot />
    </DropdownMenuContent>
  </DropdownMenu>
</template>
