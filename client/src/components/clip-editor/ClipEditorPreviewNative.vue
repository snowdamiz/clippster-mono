<template>
  <div class="native-preview-container" :style="containerStyle">
    <!-- Video Canvas -->
    <canvas
      ref="canvasRef"
      class="video-canvas"
      :style="canvasStyle"
      @click="$emit('toggle-play')"
    />

    <!-- Overlay Layer (Text, Stickers, Watermarks) -->
    <div class="overlay-layer" :style="overlayLayerStyle">
      <TrackRenderer
        v-for="track in overlayTracks"
        :key="track.id"
        :track="track"
        :current-time="rendererTime"
        :is-playing="rendererPlaying"
        :selected-item-ids="selectedItemIdsSet"
        :canvas-size="{ width: previewWidth, height: previewHeight }"
        @item-select="$emit('track-item-select', $event)"
      />
    </div>

    <!-- Playback Controls Overlay -->
    <div v-if="!isPlaying" class="play-button-overlay" @click="$emit('toggle-play')">
      <div class="play-button">
        <svg width="64" height="64" viewBox="0 0 24 24" fill="white">
          <path d="M8 5v14l11-7z"/>
        </svg>
      </div>
    </div>

    <!-- Loading Indicator -->
    <div v-if="isLoading" class="loading-overlay">
      <div class="loading-spinner"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { useNativeVideoRenderer } from '@/composables/useNativeVideoRenderer'
import TrackRenderer from './TrackRenderer.vue'
import type { Track } from '@/types/timeline-model'

const props = defineProps<{
  videoSources: any[]
  currentTime: number | string
  isPlaying: boolean
  previewAspectRatio: number | string
  textOverlays?: any[]
  stickers?: any[]
  watermarks?: any[]
  audioTracks?: any[]
  tracks?: any[]
  selectedItemIds?: any
  editorMode?: boolean
  editorTotalDuration?: number
}>()

const emit = defineEmits<{
  'time-update': [time: number]
  'play-state-change': [playing: boolean]
  'toggle-play': []
  'track-item-select': [itemId: string]
  'update-overlay-position': [data: any]
  'video-element-ready': []
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isLoading = ref(false)
const previewWidth = ref(1920)
const previewHeight = ref(1080)

// Convert selectedItemIds to Set for TrackRenderer
const selectedItemIdsSet = computed(() => {
  if (!props.selectedItemIds) return new Set<string>()
  if (props.selectedItemIds instanceof Set) return props.selectedItemIds
  if (Array.isArray(props.selectedItemIds)) return new Set(props.selectedItemIds)
  return new Set<string>()
})

// Create overlay tracks from text, stickers, watermarks
const overlayTracks = computed<any[]>(() => {
  const tracks: any[] = []
  
  // Text overlays track
  if (props.textOverlays?.length) {
    tracks.push({
      id: 'text-track',
      name: 'Text',
      type: 'text',
      orderIndex: 1,
      items: props.textOverlays.map((text: any) => ({
        id: text.id,
        type: 'text',
        name: text.text || 'Text',
        startTime: text.start_time || 0,
        endTime: text.end_time || 999,
        duration: (text.end_time || 999) - (text.start_time || 0),
        originalData: text
      }))
    })
  }
  
  // Stickers track
  if (props.stickers?.length) {
    tracks.push({
      id: 'sticker-track',
      name: 'Stickers',
      type: 'sticker',
      orderIndex: 2,
      items: props.stickers.map((sticker: any) => ({
        id: sticker.id,
        type: 'sticker',
        name: 'Sticker',
        startTime: sticker.start_time || 0,
        endTime: sticker.end_time || 999,
        duration: (sticker.end_time || 999) - (sticker.start_time || 0),
        originalData: sticker
      }))
    })
  }
  
  // Watermarks track
  if (props.watermarks?.length) {
    tracks.push({
      id: 'watermark-track',
      name: 'Watermarks',
      type: 'watermark',
      orderIndex: 3,
      items: props.watermarks.map((watermark: any) => ({
        id: watermark.id,
        type: 'watermark',
        name: 'Watermark',
        startTime: watermark.start_time || 0,
        endTime: watermark.end_time || 999,
        duration: (watermark.end_time || 999) - (watermark.start_time || 0),
        originalData: watermark
      }))
    })
  }
  
  return tracks
})

const {
  isPlaying: rendererPlaying,
  currentTime: rendererTime,
  loadVideo,
  play,
  pause,
  seek,
  setDuration,
  dimensions
} = useNativeVideoRenderer(canvasRef)

// Container and canvas styling
const containerStyle = computed(() => {
  const ratio = typeof props.previewAspectRatio === 'string' ? props.previewAspectRatio : props.previewAspectRatio.toString()
  return {
    aspectRatio: ratio,
    width: '100%',
    maxHeight: '100%',
    position: 'relative' as const,
    backgroundColor: '#000'
  }
})

const canvasStyle = computed(() => ({
  width: '100%',
  height: '100%',
  objectFit: 'contain' as const
}))

const overlayLayerStyle = computed(() => ({
  position: 'absolute' as const,
  top: 0,
  left: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none' as const
}))

// Note: overlayTracks is already defined above from text/stickers/watermarks props

// Get current video source based on timeline position
const currentVideoSource = computed(() => {
  if (!props.videoSources.length) return null
  
  const currentTime = typeof props.currentTime === 'string' ? parseFloat(props.currentTime) : props.currentTime
  
  // Sources have explicit start_time and end_time on the timeline
  // Find which source contains the current timeline position
  for (const source of props.videoSources) {
    if (currentTime >= source.start_time && currentTime < source.end_time) {
      // Calculate position within this source's timeline range
      const relativeTime = currentTime - source.start_time
      // Map to position in the source video file
      const trimStart = source.trim_start ?? 0
      const localTime = trimStart + relativeTime
      
      return {
        ...source,
        timelineStart: source.start_time,
        localTime
      }
    }
  }
  
  // Return last source if we're past the end
  const lastSource = props.videoSources[props.videoSources.length - 1]
  const trimStart = lastSource.trim_start ?? 0
  const trimEnd = lastSource.trim_end ?? lastSource.duration ?? 0
  
  return {
    ...lastSource,
    timelineStart: lastSource.start_time,
    localTime: trimEnd
  }
})

// Load video when source changes
watch(() => currentVideoSource.value, async (newSource, oldSource) => {
  if (!newSource || newSource.source_path === oldSource?.source_path) return
  
  console.log('[ClipEditorPreviewNative] Loading video:', newSource.source_path)
  isLoading.value = true
  try {
    await loadVideo(newSource.source_path)
    
    // Set dimensions for overlay rendering
    if (dimensions.value) {
      previewWidth.value = dimensions.value.width
      previewHeight.value = dimensions.value.height
      console.log('[ClipEditorPreviewNative] Video dimensions:', dimensions.value)
    }
    
    // Set total duration
    if (props.editorTotalDuration) {
      console.log('[ClipEditorPreviewNative] Setting duration:', props.editorTotalDuration)
      setDuration(props.editorTotalDuration)
    } else {
      console.warn('[ClipEditorPreviewNative] No editorTotalDuration provided!')
    }
    
    // Initialize renderer time to current timeline position
    const currentTime = typeof props.currentTime === 'string' ? parseFloat(props.currentTime) : props.currentTime
    const timeInSource = currentTime - (newSource.start_time ?? 0)
    const localTime = (newSource.trim_start ?? 0) + timeInSource
    console.log('[ClipEditorPreviewNative] Initializing time:', { currentTime, timeInSource, localTime })
    await seek(localTime)
    
    emit('video-element-ready')
  } catch (error) {
    console.error('[ClipEditorPreviewNative] Failed to load video:', newSource.source_path, error)
  } finally {
    isLoading.value = false
  }
}, { immediate: true })

// Check if current video source has extracted audio
const currentSourceHasExtractedAudio = computed(() => {
  const source = currentVideoSource.value
  if (!source) return false
  
  const audioExtractedFlag = (source as any).audio_extracted ?? (source as any).audioExtracted
  return audioExtractedFlag === true || audioExtractedFlag === 1 || audioExtractedFlag === '1'
})

// Watch for changes in extracted audio status and adjust Rust backend volume
watch(currentSourceHasExtractedAudio, async (hasExtractedAudio) => {
  try {
    // If current segment has extracted audio, mute Rust backend (volume = 0)
    // Otherwise, enable Rust backend audio (volume = 100)
    const volume = hasExtractedAudio ? 0 : 100
    console.log('[ClipEditorPreviewNative] Setting Rust audio volume to:', volume)
    await invoke('set_playback_volume', { volume })
  } catch (error) {
    console.error('[ClipEditorPreviewNative] Failed to set playback volume:', error)
  }
}, { immediate: true })

// Sync playback state with Rust engine
watch(() => props.isPlaying, (playing) => {
  console.log('[ClipEditorPreviewNative] isPlaying changed:', playing)
  if (playing) {
    play()
  } else {
    pause()
  }
})

// Watch for currentTime changes and seek the Rust engine
watch(() => props.currentTime, () => {
  // Rust engine handles time updates during playback
  if (props.isPlaying) {
    return;
  }
  
  // Convert timeline time to source video position (localTime)
  // The Rust engine plays the source video file, not timeline time
  const source = currentVideoSource.value
  if (source) {
    seek(source.localTime)
  }
})

// Emit time updates from Rust engine
watch(rendererTime, (time) => {
  emit('time-update', time)
})

function handleOverlayUpdate(data: any) {
  emit('update-overlay-position', data)
}

onMounted(() => {
  // Initial load
  if (currentVideoSource.value) {
    loadVideo(currentVideoSource.value.source_path)
  }
})

onUnmounted(() => {
  pause()
})
</script>

<style scoped>
.native-preview-container {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border-radius: 8px;
}

.video-canvas {
  display: block;
  cursor: pointer;
  position: relative;
  z-index: 1;
}

.overlay-layer {
  pointer-events: none;
}

.play-button-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.3);
  cursor: pointer;
  transition: opacity 0.2s;
}

.play-button-overlay:hover {
  background: rgba(0, 0, 0, 0.4);
}

.play-button {
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 50%;
  transition: transform 0.2s;
}

.play-button:hover {
  transform: scale(1.1);
}

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 4px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
