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

async function renderPlayer() {
  if (!mountPoint.value || !root) return;
  
  const { RemotionPlayerWrapper } = await import('@/remotion/bridge/RemotionPlayerWrapper');
  
  root.render(
    React.createElement(RemotionPlayerWrapper, {
      composition: toRaw(props.composition),
      currentFrame: Math.floor(props.currentTime * (props.composition?.fps || 30)),
      isPlaying: props.isPlaying,
      videoServerPort: await getVideoServerPort(),
      onFrameUpdate: (frame: number) => {
        emit('timeUpdate', frame / (props.composition?.fps || 30));
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
  width: 100%;
  height: 100%;
  background: var(--background);
  border-radius: 12px;
  overflow: hidden;
}
</style>
