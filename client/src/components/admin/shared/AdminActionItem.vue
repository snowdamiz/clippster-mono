<script setup lang="ts">
  /**
   * One entry in an <AdminRowActions> menu (or any DropdownMenuContent):
   * icon + label, optional destructive tone and in-flight spinner.
   *
   *   <AdminActionItem :icon="CreditCard" :loading="saving" @select="openCredits(row)">
   *     Add credits
   *   </AdminActionItem>
   */
  import type { Component } from 'vue';
  import { Loader2 } from 'lucide-vue-next';
  import { DropdownMenuItem } from '@/components/ui/dropdown-menu';

  defineProps<{
    icon?: Component;
    destructive?: boolean;
    loading?: boolean;
    disabled?: boolean;
  }>();

  const emit = defineEmits<{ select: [event: Event] }>();
</script>

<template>
  <DropdownMenuItem
    :disabled="disabled || loading"
    :class="destructive ? 'text-danger focus:bg-danger-soft focus:text-danger [&>svg]:!text-danger' : ''"
    @select="emit('select', $event)"
  >
    <Loader2 v-if="loading" class="animate-spin" />
    <component :is="icon" v-else-if="icon" />
    <span class="truncate"><slot /></span>
  </DropdownMenuItem>
</template>
