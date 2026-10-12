<script setup lang="ts">
  /**
   * A picked / uploaded file — icon tile, name, meta line and a remove
   * button. The companion of `Dropzone`: show the zone until a file is
   * picked, then this row.
   *
   *   <Dropzone v-if="!file" title="Choose a file" @select="pick" />
   *   <FileRow v-else :name="file.name" :meta="`${ext} file`" :icon="Film" @remove="file = null" />
   */
  import type { Component } from 'vue';
  import { File as FileIcon, X } from 'lucide-vue-next';
  import { Button } from '../button';
  import { IconTile } from '../icon-tile';

  withDefaults(
    defineProps<{
      name: string;
      meta?: string;
      icon?: Component;
      removeLabel?: string;
    }>(),
    { icon: () => FileIcon, removeLabel: 'Remove file' }
  );

  const emit = defineEmits<{ remove: [] }>();
</script>

<template>
  <div class="flex items-center gap-3 rounded-lg border border-line-subtle bg-surface px-3 py-2.5">
    <IconTile :icon="icon" size="md" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium text-fg" :title="name">{{ name }}</p>
      <p v-if="meta" class="tabular truncate text-xs text-fg-subtle">{{ meta }}</p>
    </div>
    <Button variant="ghost" size="icon-sm" :title="removeLabel" :aria-label="removeLabel" @click="emit('remove')">
      <X />
    </Button>
  </div>
</template>
