<script setup lang="ts">
  /**
   * "Plan" card the assistant posts when a brief is ready (AI Video generation
   * plan, AI Thumbnail plan). Rows go in the default slot as <ChatPlanRow>;
   * extra sections (e.g. a scene list) in #footer.
   */
  import type { Component } from 'vue';
  import { ClipboardList } from 'lucide-vue-next';

  withDefaults(defineProps<{ title: string; icon?: Component }>(), { icon: () => ClipboardList });
</script>

<template>
  <div class="my-1 ml-8 shrink-0 animate-enter overflow-hidden rounded-xl border border-line-subtle bg-surface">
    <div class="flex items-center gap-1.5 border-b border-line-subtle px-3 py-2 text-xs font-semibold text-fg">
      <component :is="icon" class="size-3.5 text-fg-muted" />
      <span>{{ title }}</span>
    </div>
    <dl class="flex flex-col gap-1.5 px-3 py-2.5">
      <slot />
    </dl>
    <div v-if="$slots.footer" class="border-t border-line-subtle px-3 py-2.5">
      <slot name="footer" />
    </div>
  </div>
</template>
