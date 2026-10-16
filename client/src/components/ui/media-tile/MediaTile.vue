<script setup lang="ts">
  /**
   * Grid tile for media grids — libraries (Clips, Images, Assets, Circles,
   * Recordings, AI videos), pickers and build lists: a 16:9 thumbnail well
   * with an optional selection checkbox (top-left), hover actions
   * (top-right) and badges (bottom-left), then title + meta.
   *
   *   <MediaTile :title="img.name" :thumbnail="url" :meta="['1280×720', 'Today']"
   *              selectable :selected="isSelected" @open="edit" @toggle-select="toggle">
   *     <template #actions><Button variant="secondary" size="icon-xs">…</Button></template>
   *   </MediaTile>
   */
  import type { Component } from 'vue';
  import { computed } from 'vue';
  import { Check, Image as ImageIcon } from 'lucide-vue-next';

  const props = withDefaults(
    defineProps<{
      title: string;
      thumbnail?: string | null;
      /** `contain` for logos/watermarks so the whole image is visible. */
      fit?: 'cover' | 'contain';
      /** Placeholder icon when there is no thumbnail. */
      icon?: Component;
      meta?: Array<string | number | null | undefined | false>;
      selectable?: boolean;
      selected?: boolean;
      /** Keep the hover actions visible (e.g. while audio is playing). */
      actionsVisible?: boolean;
    }>(),
    { fit: 'cover', icon: () => ImageIcon, selectable: false, selected: false, actionsVisible: false }
  );

  const emit = defineEmits<{ open: []; 'toggle-select': [] }>();

  const metaItems = computed(() => (props.meta || []).filter((m) => m !== null && m !== undefined && m !== false && m !== ''));
</script>

<template>
  <div
    class="media-tile group relative flex min-w-0 cursor-pointer flex-col overflow-hidden rounded-xl border bg-surface outline-none transition-colors focus-visible:shadow-[var(--focus-ring)]"
    :class="selected ? 'border-brand-line ring-1 ring-brand-line' : 'border-line-subtle hover:border-line-strong'"
    role="button"
    tabindex="0"
    @click="emit('open')"
    @keydown.enter.self="emit('open')"
    @keydown.space.self.prevent="emit('open')"
  >
    <div class="relative aspect-video overflow-hidden bg-surface-sunken">
      <div
        v-if="thumbnail"
        class="absolute bg-center bg-no-repeat"
        :class="fit === 'contain' ? 'inset-3 bg-contain' : 'inset-0 bg-cover'"
        :style="{ backgroundImage: `url(${thumbnail})` }"
      />
      <div v-else class="absolute inset-0 grid place-items-center text-fg-subtle">
        <slot name="placeholder">
          <component :is="icon" class="size-6" :stroke-width="1.5" />
        </slot>
      </div>

      <slot name="overlay" />

      <button
        v-if="selectable"
        type="button"
        class="absolute left-2 top-2 z-10 grid size-5 place-items-center rounded-[5px] border transition-[opacity,background-color,border-color] focus-visible:opacity-100 focus-visible:shadow-[var(--focus-ring)]"
        :class="
          selected
            ? 'border-brand bg-brand text-brand-fg opacity-100'
            : 'border-white/50 bg-black/45 text-transparent opacity-0 hover:border-white/80 group-hover:opacity-100'
        "
        :aria-pressed="selected"
        :aria-label="selected ? 'Deselect' : 'Select'"
        :title="selected ? 'Deselect' : 'Select'"
        @click.stop="emit('toggle-select')"
      >
        <Check class="size-3.5" :stroke-width="3" />
      </button>

      <div
        v-if="$slots.actions"
        class="absolute right-2 top-2 z-10 flex items-center gap-1 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
        :class="actionsVisible ? 'opacity-100' : 'opacity-0'"
        @click.stop
      >
        <slot name="actions" />
      </div>

      <div v-if="$slots.badges" class="absolute bottom-2 left-2 z-10 flex max-w-[calc(100%-1rem)] items-center gap-1">
        <slot name="badges" />
      </div>
    </div>

    <div class="flex min-w-0 flex-col gap-0.5 px-3 py-2.5">
      <h3 class="truncate text-sm font-medium text-fg" :title="title">{{ title }}</h3>
      <div v-if="metaItems.length || $slots.meta" class="flex min-w-0 items-center gap-1.5 text-xs text-fg-subtle">
        <slot name="meta">
          <template v-for="(item, index) in metaItems" :key="index">
            <span v-if="index > 0" aria-hidden="true" class="text-fg-disabled">·</span>
            <span class="truncate">{{ item }}</span>
          </template>
        </slot>
      </div>
    </div>
  </div>
</template>
