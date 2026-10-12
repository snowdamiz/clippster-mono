<template>
  <!-- Stock B-roll candidate thumbnail (video previews play on hover via the parent's listeners). -->
  <button
    type="button"
    class="group relative aspect-video overflow-hidden rounded-md border bg-surface-sunken transition-[border-color,box-shadow] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
    :class="selected ? 'border-brand shadow-[0_0_0_1px_var(--brand)]' : 'border-line-subtle hover:border-line-strong'"
    :aria-pressed="selected"
  >
    <img v-if="candidate.previewUrl" :src="candidate.previewUrl" class="size-full object-cover" alt="" />
    <div v-else class="flex size-full items-center justify-center bg-surface-raised">
      <Film class="size-3.5 text-fg-disabled" />
    </div>
    <video
      v-if="candidate.mediaType === 'video'"
      :src="candidate.downloadUrl"
      class="absolute inset-0 size-full object-cover opacity-0 transition-opacity group-hover:opacity-100"
      muted
      loop
      playsinline
      preload="metadata"
    />
    <span
      v-if="showType"
      class="absolute bottom-1 left-1 rounded bg-black/60 px-1 py-0.5 text-[10px] font-medium uppercase leading-none text-white"
    >
      {{ candidate.mediaType }}
    </span>
  </button>
</template>

<script setup lang="ts">
  import { Film } from 'lucide-vue-next';
  import type { AiBrollCandidate } from '@/types/ai-broll';

  defineProps<{
    candidate: AiBrollCandidate;
    selected?: boolean;
    showType?: boolean;
  }>();
</script>
