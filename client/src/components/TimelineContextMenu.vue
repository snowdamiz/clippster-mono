<template>
  <TimelineFloatingMenu :show="show" :x="info?.x" :y="info?.y" :width="220" :height="170" @close="emit('close')">
    <template #header>
      <div class="truncate text-xs font-medium text-fg-muted">{{ clipTitle }}</div>
      <div class="tabular text-2xs text-fg-subtle">{{ formatTime(segmentStart) }} – {{ formatTime(segmentEnd) }}</div>
    </template>

    <TimelineMenuItem
      v-for="item in menuItems"
      :key="item.id"
      :icon="item.icon"
      :label="item.label"
      :shortcut="item.shortcut"
      :danger="item.danger"
      :disabled="item.disabled"
      @click="handleItemClick(item)"
    />

    <div class="-mx-1 my-1 h-px bg-line-subtle" role="separator"></div>

    <TimelineMenuItem :icon="Trash2" label="Delete segment" shortcut="⌫" danger @click="handleDelete" />
  </TimelineFloatingMenu>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Scissors, Play, Trash2 } from 'lucide-vue-next';
  import type { ContextMenuInfo } from '../types';
  import TimelineFloatingMenu from './TimelineFloatingMenu.vue';
  import TimelineMenuItem from './TimelineMenuItem.vue';

  interface MenuItem {
    id: string;
    label: string;
    icon: any;
    shortcut?: string;
    disabled?: boolean;
    danger?: boolean;
  }

  const props = defineProps<{
    show: boolean;
    info: ContextMenuInfo | null;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'action', action: string, info: ContextMenuInfo): void;
  }>();

  // Extract info for display
  const clipTitle = computed(() => props.info?.clipTitle || 'Segment');
  const segmentStart = computed(() => props.info?.segmentStart || 0);
  const segmentEnd = computed(() => props.info?.segmentEnd || 0);

  const menuItems = computed<MenuItem[]>(() => [
    {
      id: 'play',
      label: 'Play segment',
      icon: Play,
      shortcut: 'Space',
    },
    {
      id: 'split',
      label: 'Split at playhead',
      icon: Scissors,
      shortcut: 'X',
    },
  ]);

  // Format time helper
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  }

  // Handle menu item click
  function handleItemClick(item: MenuItem) {
    if (item.disabled || !props.info) return;
    emit('action', item.id, props.info);
    emit('close');
  }

  // Handle delete action
  function handleDelete() {
    if (!props.info) return;
    emit('action', 'delete', props.info);
    emit('close');
  }
</script>
