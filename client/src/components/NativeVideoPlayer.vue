<template>
  <div class="native-video-player">
    <canvas ref="canvasRef" class="video-canvas" />
    
    <div class="controls">
      <button @click="togglePlayPause">
        {{ isPlaying ? 'Pause' : 'Play' }}
      </button>
      
      <input
        type="range"
        :value="currentTime"
        :max="duration"
        step="0.01"
        @input="handleSeek"
        class="timeline"
      />
      
      <span class="time-display">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </span>
      
      <select v-model="selectedRate" @change="handleRateChange">
        <option :value="0.25">0.25x</option>
        <option :value="0.5">0.5x</option>
        <option :value="1">1x</option>
        <option :value="1.5">1.5x</option>
        <option :value="2">2x</option>
      </select>
      
      <button @click="clearCache">Clear Cache</button>
      
      <span v-if="cacheStats" class="cache-stats">
        Cached: {{ cacheStats.cached_frames }} frames
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useNativeVideoRenderer } from '@/composables/useNativeVideoRenderer'

const props = defineProps<{
  videoPath: string
  videoDuration?: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const selectedRate = ref(1)
const cacheStats = ref<{ cached_frames: number; is_empty: boolean } | null>(null)

const {
  isPlaying,
  currentTime,
  duration,
  dimensions,
  playbackRate,
  loadVideo,
  play,
  pause,
  seek,
  setPlaybackRate,
  setDuration,
  clearCache: clearRendererCache,
  getCacheStats
} = useNativeVideoRenderer(canvasRef)

onMounted(async () => {
  if (props.videoPath) {
    await loadVideo(props.videoPath)
    if (props.videoDuration) {
      setDuration(props.videoDuration)
    }
    updateCacheStats()
  }
})

function togglePlayPause() {
  if (isPlaying.value) {
    pause()
  } else {
    play()
  }
}

function handleSeek(event: Event) {
  const target = event.target as HTMLInputElement
  seek(parseFloat(target.value))
}

function handleRateChange() {
  setPlaybackRate(selectedRate.value)
}

async function clearCache() {
  await clearRendererCache()
  await updateCacheStats()
}

async function updateCacheStats() {
  cacheStats.value = await getCacheStats()
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

setInterval(updateCacheStats, 2000)
</script>

<style scoped>
.native-video-player {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
}

.video-canvas {
  width: 100%;
  height: auto;
  background: #000;
  border-radius: 8px;
}

.controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem;
  background: rgba(0, 0, 0, 0.05);
  border-radius: 8px;
}

.timeline {
  flex: 1;
}

.time-display {
  font-family: monospace;
  font-size: 0.875rem;
}

.cache-stats {
  font-size: 0.75rem;
  color: #666;
}

button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  border: 1px solid #ddd;
  background: white;
  cursor: pointer;
}

button:hover {
  background: #f5f5f5;
}

select {
  padding: 0.5rem;
  border-radius: 4px;
  border: 1px solid #ddd;
}
</style>
