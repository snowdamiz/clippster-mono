<script setup lang="ts">
  /**
   * One result row in the Built Clips search palette (search results and the
   * "untranscribed" list): thumbnail, clip name, project and a match tag.
   */
  import { ChevronRight, FileText, Video } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';

  defineProps<{
    title: string;
    projectName?: string | null;
    thumbnailUrl?: string | null;
    /** Shows a "no transcript" marker on the thumbnail. */
    untranscribed?: boolean;
    tag?: 'transcript' | 'untranscribed' | null;
  }>();

  defineEmits<{ select: [] }>();
</script>

<template>
  <button
    type="button"
    class="group flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
    @click="$emit('select')"
  >
    <div class="relative aspect-video w-16 shrink-0 overflow-hidden rounded-md bg-surface-sunken">
      <div
        v-if="thumbnailUrl"
        class="absolute inset-0 bg-cover bg-center"
        :style="{ backgroundImage: `url(${thumbnailUrl})` }"
      />
      <div v-else class="absolute inset-0 grid place-items-center text-fg-subtle">
        <Video class="size-4" />
      </div>
      <span
        v-if="untranscribed"
        class="absolute bottom-0.5 right-0.5 grid size-4 place-items-center rounded bg-black/70 text-warning"
        title="No transcript"
      >
        <FileText class="size-2.5" />
      </span>
    </div>

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-fg">{{ title }}</p>
      <div class="mt-0.5 flex min-w-0 items-center gap-1.5">
        <span v-if="projectName" class="truncate text-xs text-fg-muted">{{ projectName }}</span>
        <Badge v-if="tag === 'transcript'" variant="brand">Transcript match</Badge>
        <Badge v-else-if="tag === 'untranscribed'" variant="warning">Needs transcript</Badge>
      </div>
    </div>

    <ChevronRight class="size-4 shrink-0 text-fg-disabled transition-colors group-hover:text-fg-muted" />
  </button>
</template>
