<template>
  <!-- Header bar for a settings panel embedded in the framing editors' left rail (Cancel / Done). -->
  <div class="flex h-11 shrink-0 items-center justify-between gap-2 border-b border-line-subtle px-3">
    <span class="text-sm font-semibold text-fg">{{ title }}</span>
    <div class="flex items-center gap-1.5">
      <Button variant="ghost" size="sm" @click="emit('cancel')">Cancel</Button>
      <Button variant="secondary" size="sm" @click="emit('done')">Done</Button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { Button } from '@/components/ui/button';

  defineProps<{ title: string }>();
  const emit = defineEmits<{ cancel: []; done: [] }>();
</script>
