<template>
  <div ref="previewContainerRef" class="flex flex-col h-full" 
       style="background: repeating-conic-gradient(#0a0a0b 0% 25%, #111113 0% 50%) 50% / 20px 20px;">
    <!-- Video Container -->
    <div class="flex-1 flex items-center justify-center p-8 min-h-0 relative">
      <div class="relative w-full h-full max-w-full max-h-full flex items-center justify-center bg-black rounded-xl overflow-hidden" 
           style="box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(14, 165, 233, 0.1);">
        <!-- Canvas for professional playback engine (frame-by-frame rendering) -->
        <canvas
          ref="canvasRef"
          class="w-full h-full object-contain"
          :class="{
            'hidden': !useCanvasPlayback || showCropOverlay || isAfterVideoEnd,
          }"
          :style="{ filter: appliedCSSFilters }"
        />

        <!-- Video element (legacy fallback) -->
        <video
          ref="videoRef"
          class="w-full h-full object-contain"
          :class="{
            'hidden': useCanvasPlayback || showCropOverlay || isAfterVideoEnd,
          }"
          :src="videoSrc || undefined"
          :style="{ filter: appliedCSSFilters }"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @play="onPlay"
          @pause="onPause"
          @ended="onEnded"
        />

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
import { useCanvasPlaybackEngine } from '@/composables/clip-editor/useCanvasPlaybackEngine';

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
}>();

const videoRef = ref<HTMLVideoElement | null>(null);
const canvasRef = ref<HTMLCanvasElement | null>(null);
const videoDuration = ref(0);
const aspectRatios = ['16:9', '9:16', '1:1', '4:5'];
const showCropOverlay = ref(false);
const volume = ref(1);
const isMuted = ref(false);
const isFullscreen = ref(false);
const previewContainerRef = ref<HTMLElement | null>(null);
const progressBarRef = ref<HTMLElement | null>(null);

// Canvas playback engine - professional frame-level decoding
// Note: FFmpeg errors are due to file being opened multiple times, not architectural issue
const useCanvasPlayback = ref(true);

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

// Video event handlers
function onLoadedMetadata() {
  if (videoRef.value) {
    videoDuration.value = videoRef.value.duration;
    
    // Perform initial seek to correct position based on trim_start
    // This prevents showing frame 0 when the clip starts at a different position
    const videoSourceTime = getVideoSourceTime(props.currentTime);
    if (Math.abs(videoRef.value.currentTime - videoSourceTime) > 0.05) {
      console.log(`[ClipEditorPreview] Initial seek on loadedmetadata: timeline=${props.currentTime.toFixed(2)}s -> source=${videoSourceTime.toFixed(2)}s`);
      videoRef.value.currentTime = videoSourceTime;
    }
  }
}

function onTimeUpdate() {
  // NOTE: We intentionally do NOT emit the video element's currentTime here.
  // The playback engine is the master clock, and the video element follows it.
  // The video element's currentTime has trim_start offset applied, so emitting it
  // would cause sync issues with the timeline time.
  // 
  // The parent (ClipEditorDialog) uses the playback engine's currentTime directly.
}

function onPlay() {
  emit('play');
}

function onPause() {
  // Don't emit pause if we're past the video content duration
  // The video element is paused intentionally, but timeline should keep playing
  const videoDuration = props.videoContentDuration || props.duration || 0;
  if (props.currentTime <= videoDuration) {
    emit('pause');
  }
  // Otherwise, ignore the pause event - timeline should continue with audio only
}

function onEnded() {
  // Don't pause if we're past the video content duration - audio should continue
  const videoDuration = props.videoContentDuration || props.duration || 0;
  if (props.currentTime < videoDuration) {
    // Only pause if we're actually at the end of the timeline
    emit('pause');
  }
  // Otherwise, let playback continue with audio only (black screen already showing)
}

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
  console.log('[ClipEditorPreview] Aspect ratio selected:', ratio);
}

// Volume controls
function toggleMute() {
  isMuted.value = !isMuted.value;
  if (videoRef.value) {
    videoRef.value.muted = isMuted.value;
  }
  // Also toggle audio mixer mute
  audioMixer.setMuted(isMuted.value);
}

function updateVolume() {
  if (videoRef.value) {
    videoRef.value.volume = volume.value;
    if (volume.value > 0 && isMuted.value) {
      isMuted.value = false;
      videoRef.value.muted = false;
      audioMixer.setMuted(false);
    }
  }
  // Also update audio mixer volume
  audioMixer.setMasterVolume(volume.value);
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
  
  console.log(`[ClipEditorPreview] Overlay clicked at: ${x.toFixed(2)}%, ${y.toFixed(2)}%`);
  // This will be used for click-to-place mode in future steps
}

// Watch for video source changes
watch(() => props.videoSrc, async (newSrc, oldSrc) => {
  console.log('[ClipEditorPreview] Video src changed to:', newSrc);
  if (videoRef.value && newSrc && newSrc !== oldSrc) {
    const wasPlaying = props.isPlaying;
    const currentSourceTime = getVideoSourceTime(props.currentTime);
    
    // Pause during reload to prevent audio glitches
    if (wasPlaying) {
      videoRef.value.pause();
    }
    
    // Load new source
    videoRef.value.src = newSrc;
    videoRef.value.load();
    
    // Wait for metadata to load (with timeout)
    await new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        videoRef.value?.removeEventListener('loadedmetadata', onLoaded);
        console.warn('[ClipEditorPreview] Metadata load timeout, proceeding anyway');
        resolve();
      }, 3000);
      
      const onLoaded = () => {
        clearTimeout(timeout);
        videoRef.value?.removeEventListener('loadedmetadata', onLoaded);
        resolve();
      };
      
      if (videoRef.value && videoRef.value.readyState >= 1) {
        // Already loaded
        clearTimeout(timeout);
        resolve();
      } else {
        videoRef.value?.addEventListener('loadedmetadata', onLoaded);
      }
    });
    
    // Restore volume and muted state
    if (videoRef.value) {
      videoRef.value.volume = volume.value;
      videoRef.value.muted = false; // Never mute the video element itself
      
      // Seek to correct position
      videoRef.value.currentTime = currentSourceTime;
      
      // Resume playback if it was playing
      if (wasPlaying) {
        try {
          await videoRef.value.play();
        } catch (err) {
          console.error('[ClipEditorPreview] Failed to resume playback after source change:', err);
        }
      }
    }
  }
}, { immediate: true });

// Watch for videoSources changes to perform initial seek
// This handles the case where videoSources load after the video element is ready
watch(() => props.videoSources, (newSources) => {
  if (newSources && newSources.length > 0 && videoRef.value && videoRef.value.readyState >= 1) {
    const videoSourceTime = getVideoSourceTime(props.currentTime);
    if (Math.abs(videoRef.value.currentTime - videoSourceTime) > 0.05) {
      console.log(`[ClipEditorPreview] Seeking on videoSources change: timeline=${props.currentTime.toFixed(2)}s -> source=${videoSourceTime.toFixed(2)}s`);
      videoRef.value.currentTime = videoSourceTime;
    }
  }
}, { immediate: true });

// Video synchronization via composable
const { isAfterVideoEnd } = useVideoSync({
  videoRef,
  currentTime: toRef(props, 'currentTime'),
  isPlaying: toRef(props, 'isPlaying'),
  videoContentDuration: computed(() => props.videoContentDuration || 0),
  duration: computed(() => props.duration || 0),
  videoSources: videoSourcesRef,
  getVideoSourceTime,
  audioMixer,
  timelineRenderer,
});

// Professional canvas playback engine (eliminates black screens)
const canvasEngine = useCanvasPlaybackEngine({
  canvasRef,
  currentTime: toRef(props, 'currentTime'),
  isPlaying: toRef(props, 'isPlaying'),
  videoSources: videoSourcesRef,
  onError: (error) => {
    console.error('[ClipEditorPreview] Canvas engine error:', error);
    // Fallback to video element on error
    useCanvasPlayback.value = false;
  },
});

onMounted(async () => {
  console.log('[ClipEditorPreview] Mounted with playback mode:', useCanvasPlayback.value ? 'Canvas (Professional)' : 'Video Element (Legacy)');
  
  // Set initial volume
  if (videoRef.value) {
    videoRef.value.volume = volume.value;
  }
  
  // Initialize canvas playback engine if enabled
  if (useCanvasPlayback.value && canvasRef.value) {
    const initialized = canvasEngine.initialize();
    if (initialized) {
      console.log('[ClipEditorPreview] Canvas playback engine initialized');
    } else {
      console.warn('[ClipEditorPreview] Canvas initialization failed, falling back to video element');
      useCanvasPlayback.value = false;
    }
  }
  
  // Initialize audio mixer (requires user interaction)
  try {
    await audioMixer.initialize();
    console.log('[ClipEditorPreview] Audio mixer initialized');
    // Note: Video element plays its own audio directly (not through mixer)
    // to avoid CORS issues with Web Audio API MediaElementAudioSource
  } catch (error) {
    console.error('[ClipEditorPreview] Failed to initialize audio mixer:', error);
  }
  
  // Listen for fullscreen changes
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
  if (videoRef.value) {
    videoRef.value.pause();
  }
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  
  // Dispose audio mixer
  audioMixer.dispose();
});

// Expose audio mixer to parent component
defineExpose({
  audioMixer,
});
</script>



