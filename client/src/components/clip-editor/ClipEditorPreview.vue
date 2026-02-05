<template>
  <div ref="previewContainerRef" class="flex flex-col h-full" 
       style="background: repeating-conic-gradient(#0a0a0b 0% 25%, #111113 0% 50%) 50% / 20px 20px;">
    <!-- Video Container -->
    <div class="flex-1 flex items-center justify-center p-8 min-h-0 relative">
      <div class="relative w-full h-full max-w-full max-h-full flex items-center justify-center bg-black rounded-xl overflow-hidden" 
           style="box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(14, 165, 233, 0.1);">
        <!-- Canvas for WebCodecs hardware-accelerated playback -->
        <canvas
          ref="canvasRef"
          class="w-full h-full object-contain"
          :class="{
            'hidden': showCropOverlay || isAfterVideoEnd,
          }"
          :style="{ filter: appliedCSSFilters }"
        />

        <!-- Hidden audio element for WebCodecs playback -->
        <audio
          ref="audioRef"
          class="hidden"
          :muted="isMuted"
          :volume="volume"
        />

        <!-- Loading Overlay -->
        <div
          v-if="isLoadingVideo"
          class="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50"
        >
          <div class="w-12 h-12 border-[3px] border-sky-500/30 border-t-sky-500 rounded-full animate-spin mb-4"/>
          <div class="text-white/80 text-sm font-medium">{{ loadingMessage }}</div>
          <div class="w-48 h-1.5 bg-white/10 rounded-full mt-3 overflow-hidden">
            <div
              class="h-full bg-gradient-to-r from-cyan-500 to-sky-500 transition-all duration-150"
              :style="{ width: `${loadingProgress}%` }"
            />
          </div>
        </div>

        <!-- Black screen when video ends but audio continues -->
        <div
          v-if="isAfterVideoEnd"
          class="absolute top-0 left-0 w-full h-full bg-black z-[1]"
        ></div>

        <!-- Crop Region Overlay -->
        <div v-if="showCropOverlay" class="absolute top-0 left-0 w-full h-full pointer-events-none bg-black/40">
          <div class="absolute border-2 border-dashed" style="border-color: rgba(14, 165, 233, 0.8); box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, 0.4);"></div>
        </div>

        <!-- Overlays (text, stickers, watermarks) -->
        <div class="absolute top-0 left-0 w-full h-full pointer-events-auto cursor-crosshair" @click="handleOverlayClick">
          <!-- Text Overlays -->
          <div
            v-for="textOverlay in activeTextOverlays"
            :key="textOverlay.id"
            class="absolute text-white text-[2rem] font-bold pointer-events-none whitespace-pre-wrap max-w-[80%]"
            style="text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);"
            :style="getTextOverlayStyle(textOverlay)"
          >
            {{ textOverlay.text }}
          </div>

          <!-- Stickers -->
          <div
            v-for="sticker in activeStickers"
            :key="sticker.id"
            class="absolute pointer-events-none text-[3rem]"
            :style="getStickerStyle(sticker)"
          >
            {{ sticker.sticker_path }}
          </div>

          <!-- Watermark -->
          <div
            v-if="activeWatermark && watermarkSettings"
            class="absolute pointer-events-none"
            :style="getWatermarkStyle()"
          >
            <img
              v-if="activeWatermark.preview_url"
              :src="activeWatermark.preview_url"
              alt="Watermark"
              class="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex items-center gap-4 px-6 py-4 relative z-[100] border-t backdrop-blur-sm"
         style="background: linear-gradient(180deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.85) 100%); border-color: var(--editor-border);">
      <!-- Pill-shaped play button -->
      <button
        class="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur text-[var(--editor-accent)] cursor-pointer transition-all duration-150 hover:bg-sky-500/20 hover:ring-2 hover:ring-sky-500/30"
        @click="togglePlayPause"
      >
        <Play v-if="!isPlaying" :size="20" />
        <Pause v-else :size="20" />
      </button>

      <!-- Volume Control -->
      <div class="flex items-center gap-3">
        <button
          class="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur text-[var(--editor-accent)] cursor-pointer transition-all duration-150 hover:bg-sky-500/20 hover:ring-2 hover:ring-sky-500/30"
          @click="toggleMute"
          title="Mute/Unmute"
        >
          <VolumeX v-if="isMuted || volume === 0" :size="20" />
          <Volume2 v-else :size="20" />
        </button>
        <div class="relative w-24 h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            class="absolute left-0 top-0 h-full rounded-full transition-[width] duration-150 pointer-events-none bg-gradient-to-r from-cyan-500 to-sky-500"
            :style="{ width: `${volume * 100}%` }"
          ></div>
          <input
            v-model="volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="absolute top-0 left-0 w-full h-full opacity-0 cursor-pointer z-10"
            @input="updateVolume"
          />
        </div>
      </div>

      <div class="flex-1"></div>

      <!-- Progress Bar (shown in fullscreen) -->
      <div
        v-if="isFullscreen"
        class="flex-[0_0_400px] flex items-center"
      >
        <div
          ref="progressBarRef"
          class="relative w-full h-1.5 bg-gray-600/40 rounded cursor-pointer transition-[height] duration-150 hover:h-2"
          @mousedown="startDragging"
          @mousemove="handleProgressHover"
          @mouseleave="clearProgressHover"
        >
          <!-- Progress fill -->
          <div
            class="absolute left-0 top-0 h-full rounded transition-[width] duration-100 pointer-events-none bg-gradient-to-r from-cyan-500 to-sky-500"
            :style="{ width: `${progressPercent}%` }"
          ></div>
          <!-- Playhead -->
          <div
            class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 border-sky-500 rounded-full cursor-grab transition-all duration-150 z-10 hover:scale-110"
            :class="{ 'cursor-grabbing !scale-125': isDraggingProgress }"
            :style="{ left: `${progressPercent}%`, boxShadow: isDraggingProgress ? '0 4px 16px rgba(14, 165, 233, 0.5)' : '0 2px 8px rgba(0, 0, 0, 0.3)' }"
            @mousedown.stop="startDraggingPlayhead"
          ></div>
          <!-- Hover preview -->
          <div
            v-if="hoverTime !== null && !isDraggingProgress"
            class="absolute bottom-[150%] -translate-x-1/2 bg-black/95 backdrop-blur-sm text-white px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap pointer-events-none tabular-nums"
            style="box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);"
            :style="{ left: `${hoverPosition}%` }"
          >
            {{ formatTime(hoverTime) }}
          </div>
          <!-- Dragging tooltip -->
          <div
            v-if="isDraggingProgress"
            class="absolute bottom-[150%] -translate-x-1/2 bg-black/95 backdrop-blur-sm text-white px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap pointer-events-none tabular-nums"
            style="box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);"
            :style="{ left: `${progressPercent}%` }"
          >
            {{ formatTime(props.currentTime) }}
          </div>
        </div>
      </div>

      <div class="flex-1"></div>


      <!-- Aspect Ratio Selector -->
      <div class="flex gap-1 p-1 rounded-md border" 
           style="background-color: var(--editor-surface-elevated); border-color: var(--editor-border);">
        <button
          v-for="ratio in aspectRatios"
          :key="ratio"
          class="px-3 py-1.5 bg-transparent border-none rounded text-[0.8125rem] font-medium cursor-pointer transition-all duration-150 hover:bg-white/8"
          :class="{ '!bg-sky-500/15 shadow-[inset_0_0_0_1px_rgba(14,165,233,0.3)]': aspectRatio === ratio }"
          :style="aspectRatio === ratio ? 'color: var(--editor-accent);' : 'color: var(--editor-text-muted);'"
          @click="selectAspectRatio(ratio)"
        >
          {{ ratio }}
        </button>
      </div>

      <!-- Fullscreen Button -->
      <button
        class="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 backdrop-blur text-[var(--editor-accent)] cursor-pointer transition-all duration-150 hover:bg-sky-500/20 hover:ring-2 hover:ring-sky-500/30"
        @click="toggleFullscreen"
        :title="isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'"
      >
        <Minimize2 v-if="isFullscreen" :size="20" />
        <Maximize2 v-else :size="20" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, toRef, provide } from 'vue';
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-vue-next';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';
import { useAudioMixer } from '@/composables/useAudioMixer';
import { useTimelineRenderer } from '@/composables/useTimelineRenderer';
import { convertFileSrc } from '@tauri-apps/api/core';
import {
  formatTime,
  useTimelineItems,
  useVideoEffects,
  useVideoSourceTime,
  usePlayheadDrag,
  useOverlayStyles,
  useVideoSync,
  useTimelineAudioTransform,
  type VideoSource,
} from '@/composables/clip-editor';
import { useWebCodecsPlayback } from '@/composables/clip-editor/useWebCodecsPlayback';
import { useProxyWorkflow } from '@/composables/useProxyWorkflow';

const props = defineProps<{
  videoSrc: string | null | undefined;
  currentTime: number;
  isPlaying: boolean;
  aspectRatio: string;
  editorEdit: FullVideoEditorEdit | null;
  watermarkSettings: any;
  duration?: number;
  videoContentDuration?: number;
  videoSources?: VideoSource[];
}>();

const emit = defineEmits<{
  (e: 'play'): void;
  (e: 'pause'): void;
  (e: 'seek', time: number): void;
  (e: 'timeUpdate', time: number): void;
  (e: 'error', error: { title: string; message: string }): void;
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null); // Audio element for WebCodecs playback
const videoDuration = ref(0);
const aspectRatios = ['16:9', '9:16', '1:1', '4:5'];
const showCropOverlay = ref(false);
const volume = ref(1);
const isMuted = ref(false);
const isFullscreen = ref(false);
const previewContainerRef = ref<HTMLElement | null>(null);
const progressBarRef = ref<HTMLElement | null>(null);


// Proxy workflow for using proxy files instead of original large files
const { getEffectivePath, getEffectivePathWithOffset } = useProxyWorkflow();

// Audio mixer for playing audio tracks
const audioMixer = useAudioMixer();

// Timeline audio transformation (from composable)
const { timelineState } = useTimelineAudioTransform({
  audioTracks: computed(() => props.editorEdit?.audioTracks),
  duration: computed(() => props.duration || 0),
});

const timelineRenderer = useTimelineRenderer(timelineState);

// ===== Composables for timeline items, effects, and time conversion =====
const editorEditRef = toRef(props, 'editorEdit');
const currentTimeRef = toRef(props, 'currentTime');
const videoSourcesRef = computed(() => props.videoSources || []);

// Timeline items from composable
const { getActiveTextOverlays, getActiveStickers, getActiveWatermark } = useTimelineItems(editorEditRef);

// Active overlays based on current time (computed for reactivity)
const activeTextOverlays = computed(() => getActiveTextOverlays(props.currentTime));
const activeStickers = computed(() => getActiveStickers(props.currentTime));
const activeWatermark = computed(() => getActiveWatermark(props.currentTime));

// CSS filters from composable
const { appliedCSSFilters } = useVideoEffects({
  editorEdit: editorEditRef,
  currentTime: currentTimeRef,
});

// Video source time conversion from composable
const { getVideoSourceTime } = useVideoSourceTime(videoSourcesRef);

// formatTime is imported from composable


// Playback controls
function togglePlayPause() {
  if (props.isPlaying) {
    emit('pause');
  } else {
    emit('play');
  }
}

function selectAspectRatio(ratio: string) {
  // Will be handled by parent to update aspectRatio prop
}

// Volume controls
function toggleMute() {
  isMuted.value = !isMuted.value;
  // Toggle audio mixer mute
  audioMixer.setMuted(isMuted.value);
}

function updateVolume() {
  // Update audio mixer volume
  audioMixer.setMasterVolume(volume.value);
  if (volume.value > 0 && isMuted.value) {
    isMuted.value = false;
    audioMixer.setMuted(false);
  }
}

// Fullscreen controls
function toggleFullscreen() {
  if (!previewContainerRef.value) return;

  if (!isFullscreen.value) {
    // Enter fullscreen
    if (previewContainerRef.value.requestFullscreen) {
      previewContainerRef.value.requestFullscreen();
    }
  } else {
    // Exit fullscreen
    if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  }
}

// Listen for fullscreen changes
function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

// Use timeline duration from parent (ClipEditorDialog)
const timelineDuration = computed(() => {
  return props.duration || videoDuration.value || 0;
});

// Progress bar drag handling via composable
const {
  isDragging: isDraggingProgress,
  hoverTime,
  hoverPosition,
  startDragging,
  startDraggingPlayhead,
  handleHover: handleProgressHover,
  clearHover: clearProgressHover,
} = usePlayheadDrag({
  containerRef: progressBarRef,
  duration: timelineDuration,
  onSeek: (time) => emit('seek', time),
});

// Progress bar visual position
const progressPercent = computed(() => {
  const duration = timelineDuration.value;
  if (duration === 0) return 0;
  return (props.currentTime / duration) * 100;
});

// Overlay styles from composable
const {
  getTextOverlayStyle,
  getStickerStyle,
  getWatermarkStyle: getWatermarkStyleBase,
} = useOverlayStyles();

// Wrapper for watermark style to use active watermark
function getWatermarkStyle() {
  return getWatermarkStyleBase(activeWatermark.value);
}

// Handle overlay click (for placement mode)
function handleOverlayClick(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 100;
  const y = ((event.clientY - rect.top) / rect.height) * 100;
  
  // This will be used for click-to-place mode in future steps
}


// Video synchronization via composable (WebCodecs only, no video element)
const { isAfterVideoEnd: syncIsAfterVideoEnd } = useVideoSync({
  videoRef: ref(null), // No video element in WebCodecs mode
  currentTime: toRef(props, 'currentTime'),
  isPlaying: toRef(props, 'isPlaying'),
  videoContentDuration: computed(() => props.videoContentDuration || 0),
  duration: computed(() => props.duration || 0),
  videoSources: videoSourcesRef,
  getVideoSourceTime,
  currentVideoSrc: computed(() => props.videoSrc || null),
  audioMixer,
  timelineRenderer,
});

// Disable isAfterVideoEnd for WebCodecs - duration from props may be wrong
const isAfterVideoEnd = computed(() => false);

// WebCodecs playback engine - hardware-accelerated decoding for smooth 60fps playback
// Uses browser's native GPU decoders (NVDEC/VideoToolbox/VAAPI) for instant frame decoding
const webCodecsEngine = useWebCodecsPlayback({
  canvasRef,
  currentTime: toRef(props, 'currentTime'),
  isPlaying: toRef(props, 'isPlaying'),
  videoSources: videoSourcesRef,
  getEffectivePathWithOffset,
  onError: (error) => {
    console.error('[ClipEditorPreview] WebCodecs engine error:', error);
    // Show error modal instead of falling back
    emit('error', {
      title: 'Playback Error',
      message: `Video playback failed: ${error}`,
    });
  },
});

// Sync audio element with active video URL (proxy-only)
watch(() => props.videoSrc, async (videoUrl) => {
  if (!audioRef.value || !videoUrl) return;

  console.log('[ClipEditorPreview] Syncing audio element with video URL:', videoUrl);
  console.log('[ClipEditorPreview] Current playing state:', props.isPlaying);

  // Ensure crossOrigin for Web Audio routing
  audioRef.value.crossOrigin = 'anonymous';
  audioRef.value.preload = 'auto';

  // Store playing state before reload
  const wasPlaying = props.isPlaying;

  audioRef.value.src = videoUrl;
  audioRef.value.load();

  // Sync time once metadata is ready, then resume playback if needed
  const onLoadedMetadata = () => {
    audioRef.value?.removeEventListener('loadedmetadata', onLoadedMetadata);
    if (audioRef.value) {
      audioRef.value.currentTime = props.currentTime;
      console.log('[ClipEditorPreview] Audio metadata loaded, seeking to:', props.currentTime);
      
      // Resume playback if it was playing before source change
      if (wasPlaying) {
        console.log('[ClipEditorPreview] Resuming audio playback after source change');
        audioRef.value.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.warn('[ClipEditorPreview] Audio resume failed:', err);
          }
        });
      }
    }
  };
  audioRef.value.addEventListener('loadedmetadata', onLoadedMetadata);
}, { immediate: true });

// Sync audio playback state with WebCodecs
watch(() => props.isPlaying, (playing) => {
  if (!audioRef.value) return;
  
  if (playing) {
    // CRITICAL: Seek audio to correct time BEFORE playing to avoid race condition
    // This prevents AbortError when scrubbing then playing
    const targetTime = props.currentTime;
    if (Math.abs(audioRef.value.currentTime - targetTime) > 0.05) {
      console.log('[ClipEditorPreview] Seeking audio before play:', targetTime);
      audioRef.value.currentTime = targetTime;
    }
    console.log('[ClipEditorPreview] Playing audio');
    audioRef.value.play().catch(err => {
      // Ignore AbortError - it's expected when rapidly toggling play/pause
      if (err.name !== 'AbortError') {
        console.warn('[ClipEditorPreview] Audio play failed:', err);
      }
    });
  } else {
    console.log('[ClipEditorPreview] Pausing audio');
    audioRef.value.pause();
  }
});

// Sync audio time with WebCodecs
watch(() => props.currentTime, (time) => {
  if (!audioRef.value) return;
  
  // CRITICAL: Don't sync time during playback - let audio play naturally
  // Only sync when paused (scrubbing) to avoid interrupting play()
  if (props.isPlaying) return;
  
  // Only sync if difference is significant (> 0.1s) to avoid constant seeking
  const diff = Math.abs(audioRef.value.currentTime - time);
  if (diff > 0.1) {
    audioRef.value.currentTime = time;
  }
});

// Loading state from WebCodecs engine
const isLoadingVideo = computed(() => webCodecsEngine.isLoading.value);
const loadingProgress = computed(() => webCodecsEngine.loadingProgress.value);
const loadingMessage = computed(() => webCodecsEngine.loadingMessage.value);


onMounted(async () => {
  if (!canvasRef.value) {
    emit('error', {
      title: 'Initialization Error',
      message: 'Canvas element not available for video rendering.',
    });
    return;
  }
  
  const initialized = webCodecsEngine.initialize();
  if (!initialized) {
    // Show error modal to user
    emit('error', {
      title: 'Hardware Acceleration Required',
      message: 'Your browser does not support hardware-accelerated video editing. Please use Chrome, Edge, Firefox, or Safari.',
    });
    return;
  }
  
  console.log('[ClipEditorPreview] WebCodecs playback engine initialized');
  
  // Initialize audio mixer
  try {
    await audioMixer.initialize();
    console.log('[ClipEditorPreview] Audio mixer initialized');
    
    // Connect audio element to mixer for WebCodecs playback
    if (audioRef.value) {
      audioMixer.connectVideoElement(audioRef.value);
      console.log('[ClipEditorPreview] Audio element connected to mixer');
    }
  } catch (error) {
    console.error('[ClipEditorPreview] Failed to initialize audio mixer:', error);
  }
  
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  
  // Dispose audio mixer
  audioMixer.dispose();
});

// Expose audio mixer and preloadVideo to parent component
defineExpose({
  audioMixer,
  preloadVideo: webCodecsEngine.preloadVideo,
});
</script>
