<template>
  <div class="framed-thumbnail relative w-full h-full">
    <!-- Hidden video element for frame extraction -->
    <video
      ref="videoRef"
      :src="videoSrc"
      class="hidden"
      crossorigin="anonymous"
      @loadeddata="onVideoLoaded"
      @error="onVideoError"
    />
    
    <!-- Canvas for rendering framed output -->
    <canvas
      ref="canvasRef"
      class="w-full h-full object-cover"
      :class="{ 'opacity-0': !isReady }"
    />
    
    <!-- Loading state -->
    <div v-if="!isReady && !hasError" class="absolute inset-0 flex items-center justify-center bg-black/30">
      <div class="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
    </div>
    
    <!-- Error state -->
    <div v-if="hasError" class="absolute inset-0 flex items-center justify-center bg-black/30">
      <div class="text-white/40 text-xs">Failed to load</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import type { ManualRegion } from '@/types';

interface Props {
  videoSrc: string;
  framingRegions: ManualRegion[];
  aspectRatio: { width: number; height: number };
  seekTime?: number; // Time in seconds to seek to for thumbnail
}

const props = withDefaults(defineProps<Props>(), {
  seekTime: 0,
});

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const isReady = ref(false);
const hasError = ref(false);

function onVideoLoaded() {
  const video = videoRef.value;
  if (!video) return;
  
  // Seek to the desired time for thumbnail
  video.currentTime = props.seekTime;
  
  // Wait for seek to complete
  video.addEventListener('seeked', renderFrame, { once: true });
}

function renderFrame() {
  const video = videoRef.value;
  const canvas = canvasRef.value;
  const regions = props.framingRegions;
  
  if (!video || !canvas || !regions || regions.length === 0) {
    hasError.value = true;
    return;
  }
  
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  
  if (vw === 0 || vh === 0) {
    hasError.value = true;
    return;
  }
  
  // Calculate canvas size based on aspect ratio
  const targetRatio = props.aspectRatio.width / props.aspectRatio.height;
  const canvasWidth = 320; // Fixed width for thumbnails
  const canvasHeight = Math.round(canvasWidth / targetRatio);
  
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    hasError.value = true;
    return;
  }
  
  // Fill with black background
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  
  // Draw each framing region
  for (const region of regions) {
    const sx = region.source.x * vw;
    const sy = region.source.y * vh;
    const sw = region.source.width * vw;
    const sh = region.source.height * vh;
    
    const dx = region.output.x * canvasWidth;
    const dy = region.output.y * canvasHeight;
    const dw = region.output.width * canvasWidth;
    const dh = region.output.height * canvasHeight;
    
    ctx.drawImage(video, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  
  isReady.value = true;
}

function onVideoError() {
  hasError.value = true;
}

// Watch for prop changes and re-render
watch(() => [props.videoSrc, props.framingRegions, props.seekTime], () => {
  isReady.value = false;
  hasError.value = false;
}, { deep: true });

onUnmounted(() => {
  // Clean up video element
  if (videoRef.value) {
    videoRef.value.src = '';
  }
});
</script>

<style scoped>
.framed-thumbnail {
  background: #000;
}
</style>
