<script setup lang="ts">
  /**
   * Label / value row inside <ChatPlanCard>. Pass `value` for text, `tags` for
   * pill values, `colors` for palette swatches, or use the default slot.
   */
  withDefaults(defineProps<{ label: string; value?: string | number | null; tags?: string[]; colors?: string[] }>(), {
    value: null,
    tags: () => [],
    colors: () => [],
  });
</script>

<template>
  <div class="grid grid-cols-[76px_minmax(0,1fr)] items-start gap-2 text-xs">
    <dt class="pt-px text-fg-subtle">{{ label }}</dt>
    <dd class="min-w-0 text-fg">
      <slot>
        <div v-if="colors.length" class="flex flex-wrap gap-1">
          <span
            v-for="(color, i) in colors"
            :key="i"
            class="size-4 rounded border border-line-strong"
            :style="{ background: color }"
            :title="color"
          />
        </div>
        <div v-else-if="tags.length" class="flex flex-wrap gap-1">
          <span v-for="(tag, i) in tags" :key="i" class="rounded-md bg-surface-active px-1.5 text-2xs leading-[18px] text-fg">
            {{ tag }}
          </span>
        </div>
        <span v-else class="break-words">{{ value }}</span>
      </slot>
    </dd>
  </div>
</template>
