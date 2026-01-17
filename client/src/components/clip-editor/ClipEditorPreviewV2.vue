<template>
  <div
    ref="fullscreenContainerRef"
    class="flex-1 w-full flex flex-col min-h-0 min-w-0 relative items-center justify-center"
    :class="isFullscreen ? 'p-0 bg-black' : 'p-0'"
  >
    <!-- Video Container -->
    <div
      ref="videoContainerRef"
      class="flex items-center justify-center bg-black overflow-hidden relative"
      :class="isFullscreen ? 'rounded-none' : 'rounded-lg'"
      :style="{
        aspectRatio: previewAspectRatio.replace(':', '/'),
        maxHeight: '100%',
        maxWidth: '100%',
        width: '100%',
        height: 'auto',
      }"
    >
      <!-- Video Compositor (new playback engine) -->
      <VideoCompositor
        ref="compositorRef"
        :current-time="playback.currentTime.value"
        :is-playing="playback.isPlaying.value"
        :active-source="playback.activeSource.value"
        :next-source="playback.nextSource.value"
        :active-transition="null"
        :is-in-gap="playback.isInGap.value"
        :video-server-port="videoServerPort"
        :video-muted="computedVideoMuted"
        :playback-rate="playback.playbackRate.value"
        @video-element-ready="onVideoElementReady"
        @error="onVideoError"
      />

      <!-- Black screen overlay for gaps -->
      <div
        v-if="playback.isInGap.value"
        class="absolute inset-0 bg-black z-10"
      />

      <!-- Overlay Container (text, stickers, watermarks, subtitles) -->
      <div
        ref="overlayContainerRef"
        class="absolute inset-0 pointer-events-none z-20"
        :style="getOverlayContainerStyle()"
      >
        <!-- Text Overlays -->
        <div
          v-for="overlay in visibleTextOverlays"
          :key="overlay.id"
          class="absolute pointer-events-auto cursor-move"
          :style="getTextOverlayStyle(overlay)"
          @mousedown="(e) => startDrag(e, 'text', overlay.id, getOverlayPosition(overlay))"
        >
          <div
            class="text-overlay-content"
            :style="getTextOverlayContentStyle(overlay)"
          >
            {{ overlay.text }}
          </div>
        </div>

        <!-- Stickers -->
        <div
          v-for="sticker in visibleStickers"
          :key="sticker.id"
          class="absolute pointer-events-auto cursor-move"
          :style="getStickerStyle(sticker)"
          @mousedown="(e) => startDrag(e, 'sticker', sticker.id, getStickerPosition(sticker))"
        >
          <img
            :src="sticker.stickerPath"
            :alt="'Sticker'"
            class="max-w-full max-h-full object-contain"
            draggable="false"
          />
        </div>

        <!-- Watermarks -->
        <div
          v-for="watermark in visibleWatermarks"
          :key="watermark.id"
          class="absolute pointer-events-auto cursor-move"
          :style="getWatermarkStyle(watermark)"
          @mousedown="(e) => startDrag(e, 'watermark', watermark.id, getWatermarkPosition(watermark))"
        >
          <img
            :src="watermark.previewUrl"
            :alt="'Watermark'"
            class="max-w-full max-h-full object-contain"
            :style="{ opacity: watermark.opacity ?? 1 }"
            draggable="false"
          />
        </div>

        <!-- Subtitles -->
        <div
          v-if="currentSubtitle"
          class="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none"
          :style="getSubtitleStyle()"
        >
          <span
            class="subtitle-text px-2 py-1"
            :style="getSubtitleTextStyle()"
          >
            {{ currentSubtitle }}
          </span>
        </div>
      </div>

      <!-- Loading indicator -->
      <div
        v-if="isLoading"
        class="absolute inset-0 flex items-center justify-center bg-black/50 z-30"
      >
        <div class="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    </div>

    <!-- Controls Bar -->
    <div
      class="bg-black/40 backdrop-blur-sm rounded-lg border border-white/[0.04] mt-2"
      :style="containerSize.width > 0 ? { width: containerSize.width + 'px' } : undefined"
    >
      <div class="flex items-center justify-between px-1 py-1">
        <!-- Left Controls -->
        <div class="flex items-center gap-1">
          <!-- Go to Beginning -->
          <button
            @click="playback.goToStart()"
            class="p-2 hover:bg-white/[0.08] rounded-lg transition-all duration-200 group"
            title="Go to Beginning"
          >
            <SkipBack class="h-3.5 w-3.5 text-white/60 group-hover:text-white transition-colors" />
          </button>

          <!-- Play/Pause -->
          <button
            @click="playback.togglePlay()"
            class="p-2 hover:bg-white/[0.08] rounded-lg transition-all duration-200 group"
            title="Play/Pause (Space)"
          >
            <Play v-if="!playback.isPlaying.value" class="h-3.5 w-3.5 text-white/60 group-hover:text-white transition-colors" />
            <Pause v-else class="h-3.5 w-3.5 text-white/60 group-hover:text-white transition-colors" />
          </button>

          <!-- Time Display -->
          <div class="text-white/80 text-[11px] font-mono bg-white/[0.04] px-2.5 py-1.5 rounded-lg ml-1 tabular-nums tracking-tight">
            <span class="text-white/90">{{ formatTime(playback.currentTime.value) }}</span>
            <span class="text-white/40 mx-1">/</span>
            <span class="text-white/50">{{ formatTime(playback.duration.value) }}</span>
          </div>
        </div>

        <!-- Right Controls -->
        <div class="flex items-center gap-2 pr-1">
          <!-- Playback Speed -->
          <div class="relative">
            <button
              @click="showSpeedMenu = !showSpeedMenu"
              class="flex items-center gap-1 px-2 py-1.5 rounded-md hover:bg-white/[0.08] transition-all duration-200 group text-[11px] font-medium text-white/80"
              title="Playback Speed"
            >
              <span>{{ playback.playbackRate.value }}x</span>
            </button>

            <div
              v-if="showSpeedMenu"
              class="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl overflow-hidden min-w-[60px] flex flex-col z-50 py-1"
            >
              <button
                v-for="rate in [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]"
                :key="rate"
                @click="setPlaybackRate(rate)"
                class="px-3 py-1.5 text-[11px] hover:bg-white/10 transition-colors text-left flex items-center justify-between gap-2"
                :class="playback.playbackRate.value === rate ? 'text-sky-400 font-bold bg-sky-500/10' : 'text-white/70'"
              >
                <span>{{ rate }}x</span>
                <Check v-if="playback.playbackRate.value === rate" :size="10" />
              </button>
            </div>

            <div v-if="showSpeedMenu" class="fixed inset-0 z-40" @click="showSpeedMenu = false" />
          </div>

          <!-- Volume -->
          <div class="flex items-center gap-2 px-1.5 py-1">
            <button
              @click="toggleMute"
              class="p-1.5 rounded-md hover:bg-white/[0.08] transition-all duration-200 group"
              title="Mute/Unmute"
            >
              <VolumeX
                v-if="playback.isMuted.value || volume === 0"
                class="h-3.5 w-3.5 text-white/50 group-hover:text-white/80 transition-colors"
              />
              <Volume2 v-else class="h-3.5 w-3.5 text-white/60 group-hover:text-white/90 transition-colors" />
            </button>
            <div class="relative w-20 h-1 bg-white/10 rounded-full">
              <div
                class="absolute left-0 top-0 h-full bg-white/40 rounded-full transition-all duration-150"
                :style="{ width: `${volume * 100}%` }"
              />
              <input
                :value="volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                class="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                @input="onVolumeChange"
              />
            </div>
          </div>

          <!-- Fullscreen -->
          <button
            @click="toggleFullscreen"
            class="p-1.5 rounded-md hover:bg-white/[0.08] transition-all duration-200 group"
            title="Toggle Fullscreen"
          >
            <Minimize2
              v-if="isFullscreen"
              class="h-3.5 w-3.5 text-white/60 group-hover:text-white/90 transition-colors"
            />
            <Maximize2 v-else class="h-3.5 w-3.5 text-white/60 group-hover:text-white/90 transition-colors" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, toRef } from 'vue';
import { Play, Pause, Volume2, VolumeX, SkipBack, Maximize2, Minimize2, Check } from 'lucide-vue-next';
import VideoCompositor from './VideoCompositor.vue';
import { useEditorPlayback, type VideoEditorSource, type EditorAudioTrack } from '@/composables/useEditorPlayback';
import type { TextOverlay, Sticker, ClipWatermark, ClipSubtitleSettings, WhisperSegment, WordInfo } from '@/types';

const props = withDefaults(
  defineProps<{
    videoServerPort: number | null;
    videoSources: VideoEditorSource[];
    audioTracks: EditorAudioTrack[];
    textOverlays: TextOverlay[];
    stickers: Sticker[];
    watermarks: ClipWatermark[];
    subtitleSettings?: ClipSubtitleSettings | null;
    transcriptWords?: WordInfo[];
    transcriptSegments?: WhisperSegment[];
    previewAspectRatio: string;
    isVideoMuted?: boolean;
  }>(),
  {
    subtitleSettings: null,
    transcriptWords: () => [],
    transcriptSegments: () => [],
    isVideoMuted: false,
  }
);

const emit = defineEmits<{
  (e: 'timeUpdate', time: number): void;
  (e: 'playStateChange', isPlaying: boolean): void;
  (e: 'videoElementReady', element: HTMLVideoElement): void;
  (e: 'updateOverlayPosition', type: 'text' | 'sticker' | 'watermark', id: string, position: { x: number; y: number }): void;
}>();

// Refs
const fullscreenContainerRef = ref<HTMLElement | null>(null);
const videoContainerRef = ref<HTMLElement | null>(null);
const overlayContainerRef = ref<HTMLElement | null>(null);
const compositorRef = ref<InstanceType<typeof VideoCompositor> | null>(null);

// State
const isFullscreen = ref(false);
const isLoading = ref(false);
const volume = ref(1);
const showSpeedMenu = ref(false);
const containerSize = ref({ width: 0, height: 0 });

// Calculate overlay scale factor based on container height
// All overlay sizes are defined relative to a 1920x1080 reference resolution
// This ensures the preview matches what the export will look like
const overlayScaleFactor = computed(() => {
  const { width: containerWidth, height: containerHeight } = containerSize.value;
  if (containerWidth === 0 || containerHeight === 0) return 1;

  // Parse the preview aspect ratio
  const [ratioW, ratioH] = props.previewAspectRatio.split(':').map(Number);
  const targetAspect = ratioW / ratioH;
  const containerAspect = containerWidth / containerHeight;

  let overlayHeight: number;
  
  // Calculate the actual display height of the video content
  // The video uses object-contain, so it fits within container while maintaining aspect ratio
  if (containerAspect > targetAspect) {
    // Container is wider - video is constrained by height
    overlayHeight = containerHeight;
  } else {
    // Container is taller - video is constrained by width
    overlayHeight = containerWidth / targetAspect;
  }

  // Scale relative to 1080p reference height
  // When overlay container is 1080px tall, scale is 1.0
  // When overlay container is 540px tall, scale is 0.5
  return overlayHeight / 1080;
});

// Initialize playback engine
const playback = useEditorPlayback({
  videoServerPort: toRef(props, 'videoServerPort'),
  videoSources: toRef(props, 'videoSources'),
  audioTracks: toRef(props, 'audioTracks'),
  onTimeUpdate: (time) => emit('timeUpdate', time),
  onPlayStateChange: (playing) => emit('playStateChange', playing),
});

// Computed: visible overlays at current time
const visibleTextOverlays = computed(() => {
  const time = playback.currentTime.value;
  return props.textOverlays.filter((o) => time >= o.startTime && time < o.endTime);
});

const visibleStickers = computed(() => {
  const time = playback.currentTime.value;
  return props.stickers.filter((s) => time >= s.startTime && time < s.endTime);
});

const visibleWatermarks = computed(() => {
  const time = playback.currentTime.value;
  return props.watermarks.filter((w) => time >= (w.startTime ?? 0) && time < (w.endTime ?? Infinity));
});

// Computed: current subtitle
const currentSubtitle = computed(() => {
  if (!props.subtitleSettings?.enabled) return null;

  const time = playback.currentTime.value;
  const words = props.transcriptWords;

  if (!words || words.length === 0) return null;

  // Find words that should be displayed at current time
  const activeWords = words.filter((w) => time >= w.start && time < w.end);
  if (activeWords.length === 0) return null;

  return activeWords.map((w) => w.word).join(' ');
});

// Computed: video muted state (combine playback engine's shouldMuteVideo with user's isVideoMuted)
const computedVideoMuted = computed(() => {
  const shouldMute = playback.shouldMuteVideo.value || props.isVideoMuted;
  console.log('[ClipEditorPreviewV2] computedVideoMuted:', shouldMute, 'shouldMuteVideo:', playback.shouldMuteVideo.value, 'isVideoMuted:', props.isVideoMuted);
  return shouldMute;
});

// Drag state
interface DragState {
  isDragging: boolean;
  type: 'text' | 'sticker' | 'watermark' | null;
  id: string | null;
  startX: number;
  startY: number;
  startPosition: { x: number; y: number };
}

const dragState: DragState = {
  isDragging: false,
  type: null,
  id: null,
  startX: 0,
  startY: 0,
  startPosition: { x: 0, y: 0 },
};

// Format time as MM:SS.ms
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

// Event handlers
function onVideoElementReady(video: HTMLVideoElement) {
  playback.setVideoElement(video);
  emit('videoElementReady', video);
}

function onVideoError(error: string) {
  console.error('[ClipEditorPreviewV2] Video error:', error);
  isLoading.value = false;
}

function setPlaybackRate(rate: number) {
  playback.setPlaybackRate(rate);
  showSpeedMenu.value = false;
}

function toggleMute() {
  playback.setMuted(!playback.isMuted.value);
}

function onVolumeChange(e: Event) {
  const target = e.target as HTMLInputElement;
  volume.value = parseFloat(target.value);
  playback.setMasterVolume(volume.value);
}

function toggleFullscreen() {
  if (!fullscreenContainerRef.value) return;

  if (isFullscreen.value) {
    document.exitFullscreen?.();
  } else {
    fullscreenContainerRef.value.requestFullscreen?.();
  }
}

// Style helpers
function getOverlayContainerStyle(): Record<string, string> {
  return {
    position: 'absolute',
    inset: '0',
  };
}

function getOverlayPosition(overlay: TextOverlay): { x: number; y: number } {
  const config = overlay.perRatioConfigs?.[props.previewAspectRatio];
  return config?.position ?? overlay.position ?? { x: 50, y: 50 };
}

function getTextOverlayStyle(overlay: TextOverlay): Record<string, string> {
  const pos = getOverlayPosition(overlay);
  const scale = overlayScaleFactor.value;
  
  return {
    left: `${pos.x}%`,
    top: `${pos.y}%`,
    transform: 'translate(-50%, -50%)',
  };
}

function getTextOverlayContentStyle(overlay: TextOverlay): Record<string, string> {
  const config = overlay.perRatioConfigs?.[props.previewAspectRatio];
  const style = config?.style ?? overlay.style ?? {};
  const scale = overlayScaleFactor.value;

  // Scale font size based on container size relative to 1080p reference
  const baseFontSize = style.fontSize || 24;
  const scaledFontSize = Math.round(baseFontSize * scale);

  return {
    fontFamily: style.fontFamily || 'sans-serif',
    fontSize: `${scaledFontSize}px`,
    fontWeight: String(style.fontWeight || 400),
    color: style.color || '#ffffff',
    textAlign: style.textAlign || 'center',
  };
}

function getStickerPosition(sticker: Sticker): { x: number; y: number } {
  const config = sticker.perRatioConfigs?.[props.previewAspectRatio];
  return config?.position ?? sticker.position ?? { x: 50, y: 50 };
}

function getStickerStyle(sticker: Sticker): Record<string, string> {
  const pos = getStickerPosition(sticker);
  const config = sticker.perRatioConfigs?.[props.previewAspectRatio];
  const baseScale = config?.scale ?? sticker.scale ?? 1;
  const containerScale = overlayScaleFactor.value;
  
  // Base width at current container scale (matching export: video_height * 0.1)
  const baseWidth = 108 * containerScale;

  return {
    left: `${pos.x}%`,
    top: `${pos.y}%`,
    transform: `translate(-50%, -50%)`,
    width: `${baseWidth * baseScale}px`,
  };
}

function getWatermarkPosition(watermark: ClipWatermark): { x: number; y: number } {
  const config = watermark.perRatioConfigs?.[props.previewAspectRatio];
  return config?.position ?? watermark.position ?? { x: 50, y: 50 };
}

function getWatermarkStyle(watermark: ClipWatermark): Record<string, string> {
  const pos = getWatermarkPosition(watermark);
  const config = watermark.perRatioConfigs?.[props.previewAspectRatio];
  const baseScale = config?.scale ?? watermark.scale ?? 1;
  const containerScale = overlayScaleFactor.value;
  
  // Check if this is a full-frame overlay (1920x1080 watermark)
  const isFullFrame = config?.isFullFrameOverlay ?? false;
  
  if (isFullFrame) {
    // Full-frame watermarks fill the entire container
    return {
      left: '0',
      top: '0',
      width: '100%',
      height: '100%',
      transform: 'none',
    };
  }
  
  // Regular watermarks: scale is percentage of video width (0-100)
  // Convert to actual pixel width based on container scale
  // At 1080p: scale 20 = 20% of 1920px = 384px width
  const baseWidth = (1920 * baseScale / 100) * containerScale;

  return {
    left: `${pos.x}%`,
    top: `${pos.y}%`,
    transform: `translate(-50%, -50%)`,
    width: `${baseWidth}px`,
  };
}

function getSubtitleStyle(): Record<string, string> {
  const settings = props.subtitleSettings;
  if (!settings) return {};

  return {
    bottom: `${100 - (settings.positionY ?? 85)}%`,
    maxWidth: `${settings.maxWidth ?? 90}%`,
  };
}

function getSubtitleTextStyle(): Record<string, string> {
  const settings = props.subtitleSettings;
  if (!settings) return {};
  
  const scale = overlayScaleFactor.value;
  const scaledFontSize = Math.round((settings.fontSize || 24) * scale);
  const scaledPadding = Math.round((settings.padding || 8) * scale);
  const scaledBorderRadius = Math.round((settings.borderRadius || 4) * scale);

  return {
    fontFamily: settings.fontFamily || 'sans-serif',
    fontSize: `${scaledFontSize}px`,
    fontWeight: String(settings.fontWeight || 700),
    color: settings.textColor || '#ffffff',
    backgroundColor: settings.backgroundEnabled ? settings.backgroundColor : 'transparent',
    padding: `${scaledPadding}px`,
    borderRadius: `${scaledBorderRadius}px`,
  };
}

// Drag handlers
function startDrag(e: MouseEvent, type: 'text' | 'sticker' | 'watermark', id: string, position: { x: number; y: number }) {
  e.preventDefault();
  e.stopPropagation();

  dragState.isDragging = true;
  dragState.type = type;
  dragState.id = id;
  dragState.startX = e.clientX;
  dragState.startY = e.clientY;
  dragState.startPosition = { ...position };

  document.addEventListener('mousemove', onDragMove);
  document.addEventListener('mouseup', onDragEnd);
}

function onDragMove(e: MouseEvent) {
  if (!dragState.isDragging || !overlayContainerRef.value) return;

  const container = overlayContainerRef.value;
  const rect = container.getBoundingClientRect();

  const deltaX = e.clientX - dragState.startX;
  const deltaY = e.clientY - dragState.startY;

  const deltaXPercent = (deltaX / rect.width) * 100;
  const deltaYPercent = (deltaY / rect.height) * 100;

  const newX = Math.max(0, Math.min(100, dragState.startPosition.x + deltaXPercent));
  const newY = Math.max(0, Math.min(100, dragState.startPosition.y + deltaYPercent));

  if (dragState.type && dragState.id) {
    emit('updateOverlayPosition', dragState.type, dragState.id, { x: newX, y: newY });
  }
}

function onDragEnd() {
  dragState.isDragging = false;
  dragState.type = null;
  dragState.id = null;

  document.removeEventListener('mousemove', onDragMove);
  document.removeEventListener('mouseup', onDragEnd);
}

// Container size observer
let resizeObserver: ResizeObserver | null = null;

onMounted(async () => {
  // Initialize audio
  await playback.initializeAudio();

  // Observe container size
  if (videoContainerRef.value) {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        containerSize.value = {
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        };
      }
    });
    resizeObserver.observe(videoContainerRef.value);
  }

  // Fullscreen change listener
  document.addEventListener('fullscreenchange', onFullscreenChange);
});

onUnmounted(() => {
  resizeObserver?.disconnect();
  document.removeEventListener('fullscreenchange', onFullscreenChange);
  playback.dispose();
});

function onFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

// Expose methods for parent component
defineExpose({
  play: playback.play,
  pause: playback.pause,
  togglePlay: playback.togglePlay,
  seek: playback.seek,
  getCurrentTime: () => playback.currentTime.value,
  isPlaying: () => playback.isPlaying.value,
  getVideoElement: () => compositorRef.value?.getActiveVideo?.(),
});
</script>

<style scoped>
.subtitle-text {
  display: inline-block;
  white-space: pre-wrap;
  word-wrap: break-word;
}
</style>
