<script setup lang="ts">
  /**
   * One layout-overlay row: checkerboard thumbnail, inline-editable label,
   * a meta line (slot) and trailing actions (slot). Used in the creator
   * profile dialog and the VOD pre-edit dialog.
   */
  import { Layers } from 'lucide-vue-next';

  defineProps<{
    label: string | undefined;
    previewUrl?: string;
    placeholder?: string;
    readonly?: boolean;
  }>();

  const emit = defineEmits<{ 'update:label': [value: string] }>();
</script>

<template>
  <div class="flex items-center gap-2.5 px-2.5 py-2">
    <div
      class="transparency-checkerboard grid size-9 shrink-0 place-items-center overflow-hidden rounded-md border border-line-subtle"
    >
      <img v-if="previewUrl" :src="previewUrl" alt="" class="size-full object-contain" />
      <Layers v-else class="size-3.5 text-fg-muted" />
    </div>
    <div class="min-w-0 flex-1">
      <input
        :value="label"
        :readonly="readonly"
        class="w-full rounded bg-transparent text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
        :placeholder="placeholder"
        @input="emit('update:label', ($event.target as HTMLInputElement).value)"
      />
      <p class="tabular truncate text-2xs text-fg-subtle"><slot name="meta" /></p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-0.5">
      <slot name="actions" />
    </div>
  </div>
</template>
