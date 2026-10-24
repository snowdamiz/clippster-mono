<script setup lang="ts">
  /** Thumbnail card from the setup screen: 16:9 well with a corner label, name row and optional remove. */
  import { X } from 'lucide-vue-next';

  defineProps<{ label: string; sub: string; thumbnail?: string | null; removable?: boolean }>();
  const emit = defineEmits<{ remove: [] }>();
</script>

<template>
  <div class="min-w-0 overflow-hidden rounded-md border border-line-subtle bg-surface-raised">
    <div class="relative aspect-video bg-surface-hover">
      <img v-if="thumbnail" :src="thumbnail" alt="" class="absolute inset-0 size-full object-cover" />
      <slot name="preview" />
      <span class="tabular absolute bottom-1 right-1 rounded-[3px] bg-panel px-1 py-px text-2xs text-fg-muted">
        {{ sub }}
      </span>
    </div>
    <div class="flex items-center gap-1 px-1.5 py-1">
      <span class="min-w-0 flex-1 truncate text-xs text-fg" :title="label">{{ label }}</span>
      <button
        v-if="removable"
        type="button"
        class="grid size-5 shrink-0 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg [&_svg]:size-3.5"
        title="Remove"
        :aria-label="`Remove ${label}`"
        @click="emit('remove')"
      >
        <X />
      </button>
    </div>
  </div>
</template>
