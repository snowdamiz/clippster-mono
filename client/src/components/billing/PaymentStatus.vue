<script setup lang="ts">
  /**
   * Centered status block for the checkout dialog: processing spinner, success or
   * error. Put the follow-up actions in the dialog footer. The dialog keys its
   * steps, so the block eases in when the checkout step changes.
   */
  import { AlertTriangle, Check, Loader2 } from 'lucide-vue-next';
  import { IconTile } from '@/components/ui/icon-tile';

  defineProps<{
    status: 'processing' | 'success' | 'error';
    title: string;
    message?: string;
  }>();
</script>

<template>
  <div class="flex flex-col items-center gap-3 py-3 text-center" role="status" aria-live="polite">
    <span v-if="status === 'processing'" class="grid size-10 place-items-center">
      <Loader2 class="size-6 animate-spin text-brand" />
    </span>
    <IconTile
      v-else
      :icon="status === 'success' ? Check : AlertTriangle"
      :tone="status === 'success' ? 'success' : 'danger'"
      size="lg"
    />
    <div class="max-w-[320px]">
      <h3 class="text-[15px] font-semibold text-fg">{{ title }}</h3>
      <p v-if="message || $slots.default" class="mt-1 text-sm text-fg-muted">
        <slot>{{ message }}</slot>
      </p>
    </div>
  </div>
</template>
