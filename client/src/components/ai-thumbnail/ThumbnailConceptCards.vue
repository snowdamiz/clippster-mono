<template>
  <div v-if="concepts.length" class="flex animate-enter flex-col gap-2">
    <SectionHeader title="Thumbnail concepts" variant="eyebrow" class="min-h-5">
      <Button v-if="!analyzing" variant="link" size="xs" :disabled="disabled" @click="$emit('reanalyze')">
        Re-analyze
      </Button>
    </SectionHeader>
    <p v-if="summary" class="line-clamp-3 text-xs text-fg-muted">{{ summary }}</p>
    <!-- One framed list of concept rows (not a card per concept) -->
    <div class="flex flex-col divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle">
      <button
        v-for="c in concepts"
        :key="c.id"
        type="button"
        class="px-3 py-2.5 text-left transition-colors duration-[var(--duration-fast)] focus-visible:bg-surface-hover focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60"
        :class="selectedId === c.id ? 'bg-brand-soft' : 'hover:bg-surface-hover'"
        :aria-pressed="selectedId === c.id"
        :disabled="disabled"
        @click="$emit('select', c.id)"
      >
        <div class="flex items-start justify-between gap-2">
          <p class="text-sm font-medium text-fg">{{ c.title }}</p>
          <Badge v-if="selectedId === c.id" variant="brand">Selected</Badge>
        </div>
        <p v-if="c.hook_text" class="mt-1 text-xs font-medium text-fg">“{{ c.hook_text }}”</p>
        <p class="mt-1 line-clamp-2 text-xs text-fg-subtle">{{ c.description || c.prompt }}</p>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ThumbnailConcept } from '@/services/aiThumbnailApi';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SectionHeader } from '@/components/ui/section-header';

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
