<template>
  <div ref="mountPoint" class="remotion-player-mount" />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, toRaw } from 'vue';
import type { AIVideoComposition } from '@/types/ai-video';

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
let root: any = null;
let React: any = null;
let cachedVideoServerPort: number = 0;
let isInternalUpdate = false;

async function renderPlayer() {
  if (!mountPoint.value || !root) return;
  
  const { RemotionPlayerWrapper } = await import('@/remotion/bridge/RemotionPlayerWrapper');
  
  root.render(
    React.createElement(RemotionPlayerWrapper, {
      composition: toRaw(props.composition),
      currentFrame: Math.floor(props.currentTime * (props.composition?.fps || 30)),
      isPlaying: props.isPlaying,
      videoServerPort: cachedVideoServerPort,
      onFrameUpdate: (frame: number) => {
        const time = frame / (props.composition?.fps || 30);
        isInternalUpdate = true;
        emit('timeUpdate', time);
      },
      onDurationChange: (dur: number) => emit('durationChange', dur),
      onPlayingChange: (playing: boolean) => emit('playingChange', playing),
    })
  );
}

async function getVideoServerPort(): Promise<number> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<number>('get_video_server_port');
  } catch {
    return 0;
  }
}

onMounted(async () => {
  if (mountPoint.value) {
    const ReactModule = await import('react');
    const ReactDOMClient = await import('react-dom/client');
    React = ReactModule;
    cachedVideoServerPort = await getVideoServerPort();
    root = ReactDOMClient.createRoot(mountPoint.value);
    renderPlayer();
  }
});

// Only re-render when composition changes (deep) or isPlaying changes
// Do NOT re-render on currentTime changes — Remotion handles its own playback clock
// and the polling sends frame updates back to Vue via onFrameUpdate
watch(
  () => props.composition,
  () => renderPlayer(),
  { deep: true }
);

watch(
  () => props.isPlaying,
  () => renderPlayer()
);

// When user seeks via the Vue scrub bar, forward the seek to Remotion
// but only if it's not an internal update from the polling
watch(
  () => props.currentTime,
  () => {
    if (isInternalUpdate) {
      isInternalUpdate = false;
      return;
    }
    renderPlayer();
  }
);

onUnmounted(() => {
  root?.unmount();
});
</script>

<style scoped>
.remotion-player-mount {
  width: 100%;
  height: 100%;
  background: var(--background);
  border-radius: 12px;
  overflow: hidden;
}
</style>
