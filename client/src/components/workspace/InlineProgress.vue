<script setup lang="ts">
  /**
   * Compact progress readout for toolbars: thin bar, stage label, percentage and
   * an optional cancel button (clip detection, transcription).
   */
  import { Loader2, X } from 'lucide-vue-next';

  withDefaults(
    defineProps<{
      label: string;
      progress: number;
      cancelTitle?: string;
      cancellable?: boolean;
    }>(),
    { cancellable: true, cancelTitle: 'Cancel' }
  );

  defineEmits<{ cancel: [] }>();
</script>

<template>
  <div class="flex min-w-[120px] max-w-[220px] flex-1 items-center gap-1.5">
    <div class="min-w-0 flex-1">
      <div class="flex items-center justify-between gap-2 text-2xs text-fg-muted">
        <span class="flex min-w-0 items-center gap-1">
          <Loader2 class="size-3 shrink-0 animate-spin text-brand" />
          <span class="truncate first-letter:uppercase">{{ label }}</span>
        </span>
        <span class="tabular shrink-0">{{ Math.round(progress) }}%</span>
      </div>
      <div class="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-hover">
        <div
          class="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
          :class="{ 'animate-pulse': progress === 0 }"
          :style="{ width: `${Math.max(progress, 5)}%` }"
        ></div>
      </div>
    </div>
    <button
      v-if="cancellable"
      type="button"
      class="grid size-6 shrink-0 place-items-center rounded-md text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
      :title="cancelTitle"
      :aria-label="cancelTitle"
      @click="$emit('cancel')"
    >
      <X class="size-3.5" />
    </button>
  </div>
</template>
