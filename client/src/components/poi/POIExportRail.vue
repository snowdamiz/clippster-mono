<template>
  <!-- Narrow divider between the source and export previews in the framing editors. -->
  <div class="flex w-8 shrink-0 items-center justify-center border-x border-line-subtle bg-surface" aria-hidden="true">
    <div class="flex flex-col items-center gap-2">
      <ArrowRight class="size-4 text-fg-subtle" />
      <span class="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-disabled [writing-mode:vertical-rl]">
        Export
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ArrowRight } from 'lucide-vue-next';
</script>
