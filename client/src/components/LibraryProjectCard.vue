<template>
  <!--
    Video library project tile (grid) / row (list). Shared with apps/web, so it
    only uses plain elements + token utilities (no ui primitives, no reka).
    Slots:
      #thumbnail  custom media inside the thumbnail well (e.g. a <video>)
      #badges     overlay content: grid → positioned inside the thumbnail,
                  list → in-flow at the start of the row
      #meta       secondary line (grid) / trailing columns (list)
      #actions    icon buttons, revealed on hover/focus (grid: on a dark pill
                  over the thumbnail; list: at the end of the row)
  -->
  <div
    class="project-card group relative min-w-0 cursor-pointer outline-none transition-[background-color,border-color,box-shadow] duration-150 focus-visible:shadow-[var(--focus-ring)]"
    :class="
      list
        ? ['flex h-11 items-center gap-3 rounded-lg px-2', selected ? 'bg-brand-soft' : 'hover:bg-surface-hover']
        : [
            'flex flex-col overflow-hidden rounded-xl border bg-surface',
            selected
              ? 'border-brand-line shadow-[0_0_0_1px_var(--brand-line)]'
              : 'border-line-subtle hover:border-line-strong',
          ]
    "
    tabindex="0"
    role="button"
    :aria-label="`Open workspace: ${name}`"
    @click="emit('open')"
    @keydown.enter.self="emit('open')"
    @keydown.space.self.prevent="emit('open')"
  >
    <slot v-if="list" name="badges" />

    <!-- Thumbnail well -->
    <div
      class="relative shrink-0 overflow-hidden bg-surface-sunken bg-cover bg-center"
      :class="list ? 'h-8 w-14 rounded-md' : 'aspect-video w-full border-b border-line-subtle'"
      :style="thumbnail ? { backgroundImage: `url(${thumbnail})` } : undefined"
    >
      <slot name="thumbnail" />
      <div
        v-if="!thumbnail && !$slots.thumbnail"
        class="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-fg-disabled"
      >
        <template v-if="live">
          <span class="relative flex" :class="list ? 'size-3.5' : 'size-6'">
            <span class="absolute inset-0 animate-ping rounded-full bg-live/30" />
            <Radio class="relative size-full text-live" />
          </span>
          <span v-if="!list" class="text-2xs font-medium uppercase tracking-[0.06em] text-fg-subtle">Monitoring</span>
        </template>
        <Folder v-else :class="list ? 'size-4' : 'size-7'" />
      </div>
      <slot v-if="!list" name="badges" />
      <div
        v-if="!list && $slots.actions"
        class="absolute right-2 top-2 z-20 flex items-center gap-0.5 rounded-lg bg-black/65 p-0.5 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <slot name="actions" />
      </div>
    </div>

    <!-- Title + meta -->
    <div :class="list ? 'flex min-w-0 flex-1 items-center gap-3' : 'flex min-w-0 flex-col gap-1 px-3 pb-2.5 pt-2'">
      <h3 class="min-w-0 truncate text-sm font-medium text-fg" :class="list && 'flex-1'" :title="name">{{ name }}</h3>
      <div
        class="flex min-w-0 items-center gap-1.5 text-xs text-fg-muted"
        :class="list ? 'shrink-0' : 'h-[18px]'"
      >
        <slot name="meta" />
      </div>
    </div>

    <div
      v-if="list && $slots.actions"
      class="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      <slot name="actions" />
    </div>
  </div>
</template>
<script setup lang="ts">
  import { Folder, Radio } from 'lucide-vue-next';
  defineProps<{ name: string; thumbnail?: string | null; live?: boolean; selected?: boolean; list?: boolean }>();
  const emit = defineEmits<{ open: [] }>();
</script>
