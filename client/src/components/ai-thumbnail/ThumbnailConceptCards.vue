<template>
  <div v-if="concepts.length" class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <p class="text-xs font-semibold uppercase tracking-wide text-zinc-500">Thumbnail concepts</p>
      <button
        v-if="!analyzing"
        type="button"
        class="text-[11px] text-sky-400 hover:text-sky-300"
        :disabled="disabled"
        @click="$emit('reanalyze')"
      >
        Re-analyze
      </button>
    </div>
    <p v-if="summary" class="text-xs text-zinc-500 line-clamp-3">{{ summary }}</p>
    <div class="grid gap-2">
      <button
        v-for="c in concepts"
        :key="c.id"
        type="button"
        class="rounded-lg border p-3 text-left transition-colors"
        :class="
          selectedId === c.id
            ? 'border-sky-500 bg-sky-500/10 ring-1 ring-sky-500/30'
            : 'border-white/10 bg-zinc-900/50 hover:border-white/20'
        "
        :disabled="disabled"
        @click="$emit('select', c.id)"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-zinc-100">{{ c.title }}</p>
          <span
            v-if="selectedId === c.id"
            class="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-semibold text-white"
          >
            Selected
          </span>
        </div>
        <p v-if="c.hook_text" class="mt-1 text-xs font-semibold text-sky-300">“{{ c.hook_text }}”</p>
        <p class="mt-1 text-xs text-zinc-500 line-clamp-2">{{ c.description || c.prompt }}</p>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ThumbnailConcept } from '@/services/aiThumbnailApi';

defineProps<{
  concepts: ThumbnailConcept[];
  selectedId?: string | null;
  summary?: string | null;
  analyzing?: boolean;
  disabled?: boolean;
}>();

defineEmits<{
  (e: 'select', id: string): void;
  (e: 'reanalyze'): void;
}>();
</script>
