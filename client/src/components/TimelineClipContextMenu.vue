<template>
  <TimelineFloatingMenu :show="show" :x="info?.x" :y="info?.y" :width="200" :height="120" @close="emit('close')">
    <template #header>
      <div class="truncate text-xs font-medium text-fg-muted">{{ clipTitle }}</div>
    </template>

    <TimelineMenuItem :icon="Play" label="Play clip" @click="handlePlayClip" />
    <TimelineMenuItem v-if="allowEditor !== false" :icon="Pencil" label="Edit clip" @click="handleEditClip" />
  </TimelineFloatingMenu>
</template>

<script setup lang="ts">
  import { computed } from 'vue';
  import { Play, Pencil } from 'lucide-vue-next';
  import type { ClipContextMenuInfo } from '../types';
  import TimelineFloatingMenu from './TimelineFloatingMenu.vue';
  import TimelineMenuItem from './TimelineMenuItem.vue';

  const props = defineProps<{
    allowEditor?: boolean;
    show: boolean;
    info: ClipContextMenuInfo | null;
  }>();

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'playClip', clipId: string): void;
    (e: 'editClip', clipId: string): void;
  }>();

  // Extract info for display
  const clipTitle = computed(() => props.info?.clipTitle || 'Clip');

  // Handle play clip action
  function handlePlayClip() {
    if (!props.info) return;
    emit('playClip', props.info.clipId);
    emit('close');
  }

  // Handle edit clip action
  function handleEditClip() {
    if (!props.info) return;
    emit('editClip', props.info.clipId);
    emit('close');
  }
</script>
