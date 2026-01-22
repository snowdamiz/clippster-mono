<template>
  <div ref="mountPoint" class="remotion-player-mount" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRaw, nextTick } from 'vue';
import type { AIVideoComposition } from '@/types/ai-video';
import { useResizeObserver } from '@vueuse/core';

const props = defineProps<{
  composition: AIVideoComposition | null;
  currentTime: number;
  isPlaying: boolean;
}>();

const emit = defineEmits<{
  (e: 'timeUpdate', time: number): void;
  (e: 'durationChange', duration: number): void;
  (e: 'playingChange', playing: boolean): void;
}>();

const mountPoint = ref<HTMLElement | null>(null);
const containerWidth = ref(640);
const containerHeight = ref(360);
let root: any = null;
let React: any = null;

// Watch container size
useResizeObserver(mountPoint, (entries) => {
  const entry = entries[0];
  if (entry) {
    containerWidth.value = entry.contentRect.width;
    containerHeight.value = entry.contentRect.height;
    console.log('[RemotionPlayerMount] Container resized:', {
      width: containerWidth.value,
      height: containerHeight.value,
      element: mountPoint.value,
      boundingRect: mountPoint.value?.getBoundingClientRect()
    });
    renderPlayer();
  }
});

async function renderPlayer() {
  if (!mountPoint.value || !root) {
    console.log('[RemotionPlayerMount] renderPlayer skipped:', { hasMountPoint: !!mountPoint.value, hasRoot: !!root });
    return;
  }
  
  console.log('[RemotionPlayerMount] Rendering player with props:', {
    containerWidth: containerWidth.value,
    containerHeight: containerHeight.value,
    compositionWidth: props.composition?.width,
    compositionHeight: props.composition?.height,
    aspectRatio: props.composition ? `${props.composition.width}:${props.composition.height}` : 'N/A'
  });
  
  const { RemotionPlayerWrapper } = await import('@/remotion/bridge/RemotionPlayerWrapper');
  
  root.render(
    React.createElement(RemotionPlayerWrapper, {
      composition: toRaw(props.composition),
      currentFrame: Math.floor(props.currentTime * (props.composition?.fps || 30)),
      isPlaying: props.isPlaying,
      videoServerPort: await getVideoServerPort(),
      containerWidth: containerWidth.value,
      containerHeight: containerHeight.value,
      onFrameUpdate: (frame: number) => {
        emit('timeUpdate', frame / (props.composition?.fps || 30));
      },
      onDurationChange: (dur: number) => emit('durationChange', dur),
      onPlayingChange: (playing: boolean) => emit('playingChange', playing),
    })
  );
}

async function getVideoServerPort(): Promise<number> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<number>('get_video_server_port');
}

onMounted(async () => {
  if (mountPoint.value) {
    console.log('[RemotionPlayerMount] Component mounted:', {
      mountPoint: mountPoint.value,
      initialWidth: containerWidth.value,
      initialHeight: containerHeight.value,
      actualBounds: mountPoint.value.getBoundingClientRect()
    });
    const ReactModule = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    React = ReactModule;
    root = ReactDOMClient.createRoot(mountPoint.value);
    renderPlayer();
  }
});

watch(
  () => [props.composition, props.currentTime, props.isPlaying],
  () => renderPlayer(),
  { deep: true }
);

onUnmounted(() => {
  root?.unmount();
});
</script>

<style scoped>
.remotion-player-mount {
  position: absolute;
  inset: 0;
  background: #000;
  overflow: hidden;
}
</style>

<style>
/* Force Remotion Player to respect container bounds */
.remotion-player-mount > div {
  width: 100% !important;
  height: 100% !important;
  max-width: 100% !important;
  max-height: 100% !important;
}

/* Target the Remotion Player's internal container */
.remotion-player-mount [data-remotion-player-container] {
  width: 100% !important;
  height: 100% !important;
}

/* Force the player content to scale */
.remotion-player-mount iframe,
.remotion-player-mount video,
.remotion-player-mount canvas {
  max-width: 100% !important;
  max-height: 100% !important;
  object-fit: contain !important;
}
</style>
