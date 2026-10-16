<script setup lang="ts">
  /**
   * Selectable aspect-ratio tile: ratio label, a proportional frame preview
   * and the platforms that format targets. Used by the quick publish wizard
   * and the aspect ratio picker.
   */
  import { computed } from 'vue';
  import { Check } from 'lucide-vue-next';

  const props = defineProps<{
    ratio: string;
    selected: boolean;
    /** e.g. "TikTok • Reels" */
    platforms?: string;
    /** Small tag next to the ratio, e.g. "Original". */
    tag?: string;
  }>();

  defineEmits<{ select: [] }>();

  /** Frame size inside a 64px-high preview area. */
  const frameStyle = computed(() => {
    const [w, h] = props.ratio.split(':').map(Number);
    if (!w || !h) return { width: '48px', height: '48px' };
    const max = 56;
    return w >= h ? { width: `${max * 1.25}px`, height: `${(max * 1.25 * h) / w}px` } : { width: `${(max * w) / h}px`, height: `${max}px` };
  });
</script>

<template>
  <button
    type="button"
    role="checkbox"
    :aria-checked="selected"
    class="flex min-w-0 flex-col gap-2 rounded-xl border p-3 text-left transition-colors focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]"
    :class="selected ? 'border-brand-line bg-brand-soft' : 'border-line-subtle bg-surface hover:border-line hover:bg-surface-hover'"
    @click="$emit('select')"
  >
    <span class="flex items-center justify-between gap-2">
      <span class="flex min-w-0 items-center gap-1.5">
        <span class="tabular text-sm font-semibold text-fg">{{ ratio }}</span>
        <span v-if="tag" class="truncate rounded bg-surface-hover px-1.5 text-2xs leading-4 text-fg-muted">{{ tag }}</span>
      </span>
      <span
        class="grid size-4 shrink-0 place-items-center rounded-full border transition-colors"
        :class="selected ? 'border-brand bg-brand text-brand-fg' : 'border-line-strong'"
      >
        <Check v-if="selected" class="size-3" :stroke-width="3" />
      </span>
    </span>
    <span class="grid h-16 place-items-center">
      <span
        class="rounded-[3px] border-[1.5px] transition-colors"
        :class="selected ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface-hover'"
        :style="frameStyle"
      />
    </span>
    <span v-if="platforms" class="truncate text-center text-xs text-fg-subtle">{{ platforms }}</span>
  </button>
</template>
