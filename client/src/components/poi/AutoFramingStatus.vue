<template>
  <div class="space-y-2 border-b border-line-subtle bg-surface px-4 py-3" aria-live="polite">
    <div class="flex items-center justify-between gap-3">
      <p class="text-xs text-fg-muted">
        <template v-if="busy">Analyzing faces on your device… {{ progress }}%</template>
        <template v-else-if="error">{{ error }}</template>
        <template v-else>
          Play or scrub to review the moving crop. Drag a source region to replace its tracking with a fixed crop.
        </template>
      </p>
      <Button v-if="busy" size="sm" variant="ghost" @click="$emit('cancel')">Cancel analysis</Button>
      <Button v-else size="sm" variant="ghost" @click="$emit('regenerate')">
        {{ error ? 'Retry' : 'Regenerate framing' }}
      </Button>
    </div>
    <progress
      v-if="busy"
      class="h-1 w-full accent-brand"
      :value="progress"
      max="100"
      aria-label="Auto framing progress"
    />
    <p v-for="warning in warnings" :key="warning" class="text-xs text-warning">{{ warning }}</p>
  </div>
</template>
<script setup lang="ts">
  import { Button } from '@/components/ui/button';
  defineProps<{ busy: boolean; progress: number; error: string; warnings: string[] }>();
  defineEmits<{ cancel: []; regenerate: [] }>();
</script>
