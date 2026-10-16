<template>
  <!--
    Shared body for the timeline's floating readouts (hover, move, trim):
    styled like the system tooltip, with an optional transcript peek where the
    word under the cursor is highlighted.
  -->
  <div
    class="max-w-xs rounded-md bg-surface-raised px-2.5 py-1.5 text-xs text-fg shadow-[var(--shadow-md)]"
  >
    <div class="flex items-baseline justify-center gap-2 whitespace-nowrap">
      <span v-if="label" class="text-2xs font-medium text-fg-muted">{{ label }}</span>
      <span class="tabular font-medium">{{ primary }}</span>
      <span v-if="secondary" class="tabular text-2xs text-fg-subtle">{{ secondary }}</span>
    </div>
    <div class="mt-1 border-t border-line-subtle pt-1 text-center leading-snug">
      <template v-if="words.length > 0">
        <span
          v-for="(word, index) in words"
          :key="index"
          class="mx-[2px] inline-block"
          :class="index === centerIndex ? 'font-semibold text-brand' : 'text-fg-muted'"
        >
          {{ word.word }}
        </span>
      </template>
      <span v-else class="text-2xs text-fg-subtle">{{ emptyText }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  defineProps<{
    label?: string;
    primary: string;
    secondary?: string;
    words: Array<{ word: string }>;
    centerIndex: number;
    emptyText: string;
  }>();
</script>
