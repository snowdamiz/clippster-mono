<script setup lang="ts">
  /**
   * Dashed drop / pick area for choosing files: icon tile, title and hint.
   *
   * Two ways to pick:
   * - **Native dialog** (Tauri `open()` etc.): leave `accept` unset and handle
   *   `select` — clicking only emits it.
   *     <Dropzone :icon="FolderOpen" title="Choose a file" hint="Video, image or audio" @select="pickFile" />
   * - **Browser file input**: set `accept` (and `multiple`). Clicking opens a
   *   hidden `<input type="file">`; files arrive via `files` (also from
   *   drag & drop onto the zone) and the input's native `change` event is
   *   re-emitted as `change` for callers that validate `event.target.files`.
   *     <Dropzone accept="video/*" title="Choose a video" hint="MP4, MOV" @files="(f) => (file = f[0])" />
   *
   * `compact` renders a one-line row (for forms); pass `file` + `fileIcon` +
   * `fileMeta` to show the picked file there with a "Change" affordance.
   * `loading` swaps the icon for a spinner and disables the zone.
   * Exposes `open()` to trigger the file input programmatically.
   */
  import type { Component, HTMLAttributes } from 'vue';
  import { computed, ref } from 'vue';
  import { Loader2, Upload } from 'lucide-vue-next';
  import { cn } from '@/lib/utils';
  import { IconTile } from '../icon-tile';

  const props = withDefaults(
    defineProps<{
      title: string;
      hint?: string;
      icon?: Component;
      /** Icon tile tone while nothing is picked. */
      tone?: 'neutral' | 'brand';
      /** File types for the browser input (`accept` attribute). Unset = native-dialog mode (`select` only). */
      accept?: string;
      multiple?: boolean;
      loading?: boolean;
      disabled?: boolean;
      /** One-line row instead of the stacked box. */
      compact?: boolean;
      /** Picked file to show in place of the title (compact forms). */
      file?: { name: string } | null;
      /** Icon shown next to a picked file. */
      fileIcon?: Component;
      /** Secondary line for the picked file (size, duration, ...). */
      fileMeta?: string;
      class?: HTMLAttributes['class'];
    }>(),
    { icon: () => Upload, tone: 'neutral', file: null }
  );

  const emit = defineEmits<{
    select: [];
    files: [files: File[]];
    change: [event: Event];
  }>();

  const input = ref<HTMLInputElement | null>(null);
  const dragging = ref(false);
  const inputMode = computed(() => props.accept !== undefined);
  const inactive = computed(() => props.disabled || props.loading);

  function open() {
    if (inactive.value) return;
    emit('select');
    if (inputMode.value) input.value?.click();
  }

  function onChange(event: Event) {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    emit('change', event);
    if (files.length) emit('files', files);
  }

  function onDragOver(event: DragEvent) {
    if (!inputMode.value || inactive.value) return;
    event.preventDefault();
    dragging.value = true;
  }

  function onDrop(event: DragEvent) {
    dragging.value = false;
    if (!inputMode.value || inactive.value) return;
    event.preventDefault();
    const files = Array.from(event.dataTransfer?.files ?? []);
    if (files.length) emit('files', props.multiple ? files : files.slice(0, 1));
  }

  defineExpose({ open });
</script>

<template>
  <div :class="cn('w-full', props.class)">
    <input
      v-if="inputMode"
      ref="input"
      type="file"
      :accept="accept"
      :multiple="multiple"
      class="hidden"
      @change="onChange"
    />
    <button
      type="button"
      :disabled="inactive"
      :class="
        cn(
          'flex w-full rounded-xl border border-dashed transition-colors focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none disabled:pointer-events-none disabled:opacity-60',
          compact
            ? 'items-center gap-3 px-3.5 py-3 text-left'
            : 'flex-col items-center justify-center gap-2 px-4 py-8 text-center',
          dragging
            ? 'border-brand bg-brand-soft'
            : file
              ? 'border-line bg-surface hover:border-line-strong'
              : 'border-line-strong bg-surface hover:border-brand-line hover:bg-brand-soft'
        )
      "
      @click="open"
      @dragover="onDragOver"
      @dragleave="dragging = false"
      @drop="onDrop"
    >
      <IconTile v-if="loading" tone="neutral" size="lg">
        <Loader2 class="animate-spin" />
      </IconTile>
      <IconTile v-else :icon="file && fileIcon ? fileIcon : icon" :tone="file ? 'brand' : tone" size="lg" />
      <span :class="compact ? 'min-w-0 flex-1' : 'flex min-w-0 max-w-full flex-col items-center gap-1'">
        <span class="block truncate text-sm font-medium text-fg">{{ file ? file.name : title }}</span>
        <span v-if="file ? fileMeta : hint" class="block truncate text-xs text-fg-subtle">
          {{ file ? fileMeta : hint }}
        </span>
      </span>
      <span v-if="file" class="shrink-0 text-xs font-medium text-fg-muted">Change</span>
    </button>
  </div>
</template>
