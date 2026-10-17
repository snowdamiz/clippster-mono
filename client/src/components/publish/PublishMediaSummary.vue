<script setup lang="ts">
  /**
   * Compact "what am I publishing" row: thumbnail well + title + meta line,
   * with an optional trailing slot for badges.
   */
  import { FileVideo } from 'lucide-vue-next';

  defineProps<{
    thumbnailUrl?: string | null;
    title: string;
    /** Secondary bits joined with a dot separator (project, duration, ...). */
    meta?: Array<string | null | undefined | false>;
  }>();
</script>

<template>
  <div class="flex min-w-0 items-center gap-3 border-b border-line-subtle pb-4">
    <div class="grid aspect-video w-24 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sunken">
      <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="" class="size-full object-contain" />
      <FileVideo v-else class="size-5 text-fg-disabled" />
    </div>
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <p class="truncate text-sm font-medium text-fg" :title="title">{{ title }}</p>
      <p v-if="meta && meta.filter(Boolean).length" class="flex min-w-0 items-center gap-1.5 truncate text-xs text-fg-subtle">
        <template v-for="(item, index) in meta.filter(Boolean)" :key="index">
          <span v-if="index > 0" aria-hidden="true">·</span>
          <span class="truncate">{{ item }}</span>
        </template>
      </p>
      <div v-if="$slots.default" class="flex flex-wrap items-center gap-1">
        <slot />
      </div>
    </div>
  </div>
</template>
