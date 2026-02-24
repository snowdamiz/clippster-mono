<template>
  <video
    v-if="isVideo"
    :src="src"
    autoplay
    loop
    muted
    playsinline
    :class="className"
    :style="style"
    @error="handleError"
  />
  <img
    v-else
    :src="src"
    :class="className"
    :style="style"
    draggable="false"
    @dragstart.prevent
    @error="handleError"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  src: string;
  fileType?: 'image' | 'video';
  className?: string | string[] | Record<string, boolean>;
  style?: any;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: 'error', event: Event): void;
}>();

const isVideo = computed(() => {
  // Explicit file type takes precedence
  if (props.fileType === 'video') return true;
  if (props.fileType === 'image') return false;
  
  // Fallback: detect from data URL MIME type
  if (props.src.startsWith('data:video/')) return true;
  
  // Default to image
  return false;
});

function handleError(event: Event) {
  emit('error', event);
}
</script>
