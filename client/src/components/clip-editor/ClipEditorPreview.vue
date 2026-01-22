<template>
  <div ref="previewContainerRef" class="editor-preview">
    <!-- Video Container -->
    <div class="editor-preview__video-wrapper">
      <div class="editor-preview__video-container">
        <video
          ref="videoRef"
          class="editor-preview__video"
          :class="{
            'editor-preview__video--hidden': showCropOverlay || isAfterVideoEnd,
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
          class="editor-preview__black-screen"
        ></div>

        <!-- Crop Region Overlay -->
        <div v-if="showCropOverlay" class="editor-preview__crop-overlay">
          <div class="editor-preview__crop-region"></div>
        </div>

        <!-- Overlays (text, stickers, watermarks) -->
        <div class="editor-preview__overlays" @click="handleOverlayClick">
          <!-- Text Overlays -->
          <div
            v-for="textOverlay in activeTextOverlays"
            :key="textOverlay.id"
            class="editor-preview__text-overlay"
            :style="getTextOverlayStyle(textOverlay)"
          >
            {{ textOverlay.text }}
          </div>

          <!-- Stickers -->
          <div
            v-for="sticker in activeStickers"
            :key="sticker.id"
            class="editor-preview__sticker"
            :style="getStickerStyle(sticker)"
          >
            {{ sticker.sticker_path }}
          </div>

          <!-- Watermark -->
          <div
            v-if="activeWatermark && watermarkSettings"
            class="editor-preview__watermark"
            :style="getWatermarkStyle()"
          >
            <img
              v-if="activeWatermark.preview_url"
              :src="activeWatermark.preview_url"
              alt="Watermark"
              class="editor-preview__watermark-image"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Controls -->
    <div class="editor-preview__controls">
      <button
        class="editor-preview__control-button"
        @click="togglePlayPause"
      >
        <Play v-if="!isPlaying" :size="20" />
        <Pause v-else :size="20" />
      </button>

      <!-- Volume Control -->
      <div class="editor-preview__volume-control">
        <button
          class="editor-preview__control-button"
          @click="toggleMute"
          title="Mute/Unmute"
        >
          <VolumeX v-if="isMuted || volume === 0" :size="20" />
          <Volume2 v-else :size="20" />
        </button>
        <div class="editor-preview__volume-slider-container">
          <div
            class="editor-preview__volume-slider-fill"
            :style="{ width: `${volume * 100}%` }"
          ></div>
          <input
            v-model="volume"
            type="range"
            min="0"
            max="1"
            step="0.05"
            class="editor-preview__volume-slider"
            @input="updateVolume"
          />
        </div>
      </div>

      <div class="editor-preview__spacer"></div>

      <!-- Progress Bar (shown in fullscreen) -->
      <div
        v-if="isFullscreen"
        class="editor-preview__progress-bar-wrapper"
      >
        <div
          ref="progressBarRef"
          class="editor-preview__progress-bar"
          @mousedown="startDragging"
          @mousemove="handleProgressHover"
          @mouseleave="hoverTime = null"
        >
          <!-- Progress fill -->
          <div
            class="editor-preview__progress-fill"
            :style="{ width: `${progressPercent}%` }"
          ></div>
          <!-- Playhead -->
          <div
            class="editor-preview__playhead"
            :class="{ 'editor-preview__playhead--dragging': isDraggingProgress }"
            :style="{ left: `${progressPercent}%` }"
            @mousedown.stop="startDraggingPlayhead"
          ></div>
          <!-- Hover preview -->
          <div
            v-if="hoverTime !== null && !isDraggingProgress"
            class="editor-preview__progress-tooltip"
            :style="{ left: `${hoverPosition}%` }"
          >
            {{ formatTime(hoverTime) }}
          </div>
          <!-- Dragging tooltip -->
          <div
            v-if="isDraggingProgress"
            class="editor-preview__progress-tooltip"
            :style="{ left: `${progressPercent}%` }"
          >
            {{ formatTime(props.currentTime) }}
          </div>
        </div>
      </div>

      <div class="editor-preview__spacer"></div>

      <!-- Aspect Ratio Selector -->
      <div class="editor-preview__aspect-selector">
        <button
          v-for="ratio in aspectRatios"
          :key="ratio"
          class="editor-preview__aspect-button"
          :class="{ 'editor-preview__aspect-button--active': aspectRatio === ratio }"
          @click="selectAspectRatio(ratio)"
        >
          {{ ratio }}
        </button>
      </div>

      <!-- Fullscreen Button -->
      <button
        class="editor-preview__control-button"
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-vue-next';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';
import { useAudioMixer } from '@/composables/useAudioMixer';
import { useTimelineRenderer } from '@/composables/useTimelineRenderer';
import { convertFileSrc } from '@tauri-apps/api/core';

interface VideoSource {
  id: string;
  file_path: string;
  start_time: number;
  end_time: number;
  trim_start: number;
  trim_end: number | null;
  original_duration: number;
}

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
const videoDuration = ref(0);
const aspectRatios = ['16:9', '9:16', '1:1', '4:5'];
const showCropOverlay = ref(false);
const volume = ref(1);
const isMuted = ref(false);
const isFullscreen = ref(false);
const previewContainerRef = ref<HTMLElement | null>(null);
const progressBarRef = ref<HTMLElement | null>(null);
const isDraggingProgress = ref(false);
const hoverTime = ref<number | null>(null);
const hoverPosition = ref(0);

// Audio mixer for playing audio tracks
const audioMixer = useAudioMixer();

// Timeline renderer to get active audio tracks
const timelineState = computed(() => {
  const audioTracks = props.editorEdit?.audioTracks.map(track => ({
    id: track.id,
    filePath: track.file_path,
    startTime: track.start_time,
    endTime: track.end_time,
    volume: track.volume,
    isMuted: track.is_muted === 1,
    fadeInDuration: track.fade_in,
    fadeOutDuration: track.fade_out,
  })) || [];
  
  console.log('[ClipEditorPreview] Timeline state updated with', audioTracks.length, 'audio tracks:', audioTracks);
  
  return {
    duration: props.duration || 0,
    videoSources: [],
    audioTracks,
  };
});

const timelineRenderer = useTimelineRenderer(timelineState);

// Active overlays based on current time
const activeTextOverlays = computed(() => {
  if (!props.editorEdit) return [];
  return props.editorEdit.textOverlays.filter(
    (overlay) =>
      props.currentTime >= overlay.start_time && props.currentTime <= overlay.end_time
  );
});

const activeStickers = computed(() => {
  if (!props.editorEdit) return [];
  return props.editorEdit.stickers.filter(
    (sticker) =>
      props.currentTime >= sticker.start_time && props.currentTime <= sticker.end_time
  );
});

const activeWatermark = computed(() => {
  if (!props.editorEdit) return null;
  const watermarks = props.editorEdit.watermarks.filter(
    (wm) => props.currentTime >= wm.start_time && props.currentTime <= wm.end_time
  );
  return watermarks.length > 0 ? watermarks[0] : null;
});

// CSS filters from effects
const appliedCSSFilters = computed(() => {
  if (!props.editorEdit) return '';
  
  const activeEffects = props.editorEdit.effects.filter(
    (effect) =>
      props.currentTime >= effect.start_time && props.currentTime <= effect.end_time
  );

  if (activeEffects.length === 0) return '';

  const filters: string[] = [];
  activeEffects.forEach((effect) => {
    const settings = JSON.parse(effect.settings || '{}');
    
    if (effect.effect_type === 'filter') {
      // Apply filter settings
      if (settings.brightness !== undefined) {
        filters.push(`brightness(${settings.brightness}%)`);
      }
      if (settings.contrast !== undefined) {
        filters.push(`contrast(${settings.contrast}%)`);
      }
      if (settings.saturation !== undefined) {
        filters.push(`saturate(${settings.saturation}%)`);
      }
      if (settings.blur !== undefined) {
        filters.push(`blur(${settings.blur}px)`);
      }
    }
  });

  return filters.join(' ');
});

// Format time as MM:SS
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

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
}

function updateVolume() {
  if (videoRef.value) {
    videoRef.value.volume = volume.value;
    if (volume.value > 0 && isMuted.value) {
      isMuted.value = false;
      videoRef.value.muted = false;
    }
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

// Progress bar controls
const progressPercent = computed(() => {
  const duration = timelineDuration.value;
  if (duration === 0) return 0;
  return (props.currentTime / duration) * 100;
});

function startDragging(event: MouseEvent) {
  // Only start dragging if clicking on the bar itself, not the playhead
  if ((event.target as HTMLElement).classList.contains('editor-preview__playhead')) {
    return;
  }
  
  isDraggingProgress.value = true;
  seekToPosition(event);
  
  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingProgress.value) {
      seekToPositionFromEvent(e);
    }
  };
  
  const handleMouseUp = () => {
    isDraggingProgress.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function startDraggingPlayhead(event: MouseEvent) {
  event.preventDefault();
  isDraggingProgress.value = true;
  
  const handleMouseMove = (e: MouseEvent) => {
    if (isDraggingProgress.value) {
      seekToPositionFromEvent(e);
    }
  };
  
  const handleMouseUp = () => {
    isDraggingProgress.value = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
  
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);
}

function seekToPosition(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  const time = (percent / 100) * timelineDuration.value;
  emit('seek', time);
}

function seekToPositionFromEvent(event: MouseEvent) {
  if (!progressBarRef.value) return;
  
  const rect = progressBarRef.value.getBoundingClientRect();
  const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  const time = (percent / 100) * timelineDuration.value;
  emit('seek', time);
}

function handleProgressHover(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  const percent = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  hoverPosition.value = percent;
  hoverTime.value = (percent / 100) * timelineDuration.value;
}

// Get text overlay styles
function getTextOverlayStyle(textOverlay: any) {
  return {
    left: `${textOverlay.position_x}%`,
    top: `${textOverlay.position_y}%`,
    transform: 'translate(-50%, -50%)',
  };
}

// Get sticker styles
function getStickerStyle(sticker: any) {
  return {
    left: `${sticker.position_x}%`,
    top: `${sticker.position_y}%`,
    transform: `translate(-50%, -50%) scale(${sticker.scale}) rotate(${sticker.rotation}deg)`,
  };
}

// Get watermark styles
function getWatermarkStyle() {
  if (!activeWatermark.value) return {};
  
  const wm = activeWatermark.value;
  return {
    left: `${wm.position_x}%`,
    top: `${wm.position_y}%`,
    transform: `translate(-50%, -50%) scale(${wm.scale / 100})`,
    opacity: wm.opacity / 100,
  };
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
watch(() => props.videoSrc, (newSrc) => {
  console.log('[ClipEditorPreview] Video src changed to:', newSrc);
  if (videoRef.value && newSrc) {
    videoRef.value.src = newSrc;
    videoRef.value.load();
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

// Check if current time is beyond video content
const isAfterVideoEnd = computed(() => {
  const videoDuration = props.videoContentDuration || props.duration || 0;
  return props.currentTime > videoDuration;
});

/**
 * Calculate the actual video element time from timeline time.
 * This accounts for the trim_start offset - the video file may start at a different
 * position than the beginning of the file.
 * 
 * Timeline time: 0-30s (what the user sees)
 * Video source time: trim_start to trim_start+30s (actual position in video file)
 */
function getVideoSourceTime(timelineTime: number): number {
  if (!props.videoSources || props.videoSources.length === 0) {
    return timelineTime;
  }
  
  // Find the video source that contains this timeline time
  for (const source of props.videoSources) {
    if (timelineTime >= source.start_time && timelineTime < source.end_time) {
      // Calculate offset within this source
      const offsetInSource = timelineTime - source.start_time;
      // Add trim_start to get actual video file position
      return source.trim_start + offsetInSource;
    }
  }
  
  // If we're past all sources, use the last source's end position
  const lastSource = props.videoSources[props.videoSources.length - 1];
  if (lastSource && timelineTime >= lastSource.end_time) {
    const offsetInSource = lastSource.end_time - lastSource.start_time;
    return lastSource.trim_start + offsetInSource;
  }
  
  return timelineTime;
}

// Sync video element with props
watch(() => props.currentTime, (newTime) => {
  if (videoRef.value) {
    const videoDuration = props.videoContentDuration || props.duration || 0;
    
    // If we're past the video content, just pause and don't touch currentTime
    if (newTime > videoDuration) {
      if (!videoRef.value.paused) {
        videoRef.value.pause();
      }
      // Don't set currentTime - let it stay wherever it naturally ended
      // This prevents the seek loop
    } else {
      // Calculate the actual video source time with trim offset
      const videoSourceTime = getVideoSourceTime(newTime);
      
      // Normal video sync when within video duration
      if (Math.abs(videoRef.value.currentTime - videoSourceTime) > 0.1) {
        console.log(`[ClipEditorPreview] Seeking video: timeline=${newTime.toFixed(2)}s -> source=${videoSourceTime.toFixed(2)}s`);
        videoRef.value.currentTime = videoSourceTime;
      }
    }
  }
  
  // Sync audio mixer with current time
  const activeTracks = timelineRenderer.getActiveAudioTracks(newTime);
  audioMixer.syncToTime(newTime, activeTracks, props.isPlaying);
});

watch(() => props.isPlaying, (playing) => {
  if (!videoRef.value) return;
  
  const videoDuration = props.videoContentDuration || props.duration || 0;
  
  // Only play video if we're within the video content duration
  if (playing && props.currentTime <= videoDuration) {
    // Ensure video is at correct source time before playing
    const videoSourceTime = getVideoSourceTime(props.currentTime);
    if (Math.abs(videoRef.value.currentTime - videoSourceTime) > 0.1) {
      console.log(`[ClipEditorPreview] Pre-play seek: timeline=${props.currentTime.toFixed(2)}s -> source=${videoSourceTime.toFixed(2)}s`);
      videoRef.value.currentTime = videoSourceTime;
    }
    
    videoRef.value.play().catch(err => {
      console.error('[ClipEditorPreview] Failed to play:', err);
    });
  } else {
    videoRef.value.pause();
  }
  
  // Sync audio playback state
  const activeTracks = timelineRenderer.getActiveAudioTracks(props.currentTime);
  audioMixer.syncToTime(props.currentTime, activeTracks, playing);
});

onMounted(async () => {
  console.log('[ClipEditorPreview] Mounted with video:', props.videoSrc);
  
  // Set initial volume
  if (videoRef.value) {
    videoRef.value.volume = volume.value;
  }
  
  // Initialize audio mixer (requires user interaction)
  try {
    await audioMixer.initialize();
    console.log('[ClipEditorPreview] Audio mixer initialized');
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
</script>

<style scoped>
.editor-preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: 
    repeating-conic-gradient(#0a0a0b 0% 25%, #111113 0% 50%) 
    50% / 20px 20px;
}

.editor-preview__video-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  min-height: 0;
  position: relative;
}

.editor-preview__video-container {
  position: relative;
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(14, 165, 233, 0.1);
}

.editor-preview__video {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.editor-preview__black-screen {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: #000;
  z-index: 1;
}

.editor-preview__overlays {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: auto;
  cursor: crosshair;
}

.editor-preview__crop-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  background-color: rgba(0, 0, 0, 0.4);
}

.editor-preview__crop-region {
  position: absolute;
  border: 2px dashed rgba(14, 165, 233, 0.8);
  box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, 0.4);
}

.editor-preview__text-overlay {
  position: absolute;
  color: white;
  font-size: 2rem;
  font-weight: 700;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  white-space: pre-wrap;
  max-width: 80%;
}

.editor-preview__sticker {
  position: absolute;
  pointer-events: none;
  font-size: 3rem;
}

.editor-preview__watermark {
  position: absolute;
  pointer-events: none;
}

.editor-preview__watermark-image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.editor-preview__controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.5rem;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%);
  border-top: 1px solid var(--editor-border);
  backdrop-filter: blur(12px);
  position: relative;
  z-index: 100;
}

.editor-preview__control-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  background-color: rgba(14, 165, 233, 0.15);
  border: 1px solid rgba(14, 165, 233, 0.3);
  border-radius: 8px;
  color: var(--editor-accent);
  cursor: pointer;
  transition: all 150ms ease;
}

.editor-preview__control-button:hover {
  background-color: rgba(14, 165, 233, 0.25);
  border-color: rgba(14, 165, 233, 0.5);
  color: var(--editor-accent-hover);
}

.editor-preview__volume-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.editor-preview__volume-slider-container {
  position: relative;
  width: 96px;
  height: 6px;
  background-color: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.editor-preview__volume-slider-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, rgba(14, 165, 233, 0.8), rgba(14, 165, 233, 1));
  border-radius: 3px;
  transition: width 150ms ease;
  pointer-events: none;
}

.editor-preview__volume-slider {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  z-index: 10;
}

.editor-preview__spacer {
  flex: 1;
}

.editor-preview__aspect-selector {
  display: flex;
  gap: 0.25rem;
  padding: 0.25rem;
  background-color: var(--editor-surface-elevated);
  border-radius: 6px;
  border: 1px solid var(--editor-border);
}

.editor-preview__aspect-button {
  padding: 0.375rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--editor-text-muted);
  cursor: pointer;
  transition: all 150ms ease;
  font-size: 0.8125rem;
  font-weight: 500;
}

.editor-preview__aspect-button:hover {
  background-color: rgba(255, 255, 255, 0.08);
  color: var(--editor-text);
}

.editor-preview__aspect-button--active {
  background-color: rgba(14, 165, 233, 0.15);
  color: var(--editor-accent);
  box-shadow: inset 0 0 0 1px rgba(14, 165, 233, 0.3);
}

.editor-preview__progress-bar-wrapper {
  flex: 0 0 400px;
  display: flex;
  align-items: center;
}

.editor-preview__progress-bar {
  position: relative;
  width: 100%;
  height: 6px;
  background-color: rgba(100, 100, 100, 0.4);
  border-radius: 3px;
  cursor: pointer;
  transition: height 150ms ease;
}

.editor-preview__progress-bar:hover {
  height: 8px;
}


.editor-preview__progress-fill {
  position: absolute;
  left: 0;
  top: 0;
  height: 100%;
  background: linear-gradient(90deg, #8b5cf6, #a78bfa);
  border-radius: 3px;
  transition: width 100ms linear;
  pointer-events: none;
}

.editor-preview__playhead {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  height: 14px;
  background: white;
  border: 2px solid #8b5cf6;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  cursor: grab;
  transition: all 150ms ease;
  z-index: 10;
}

.editor-preview__playhead:hover {
  transform: translate(-50%, -50%) scale(1.15);
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.4);
}

.editor-preview__playhead--dragging {
  cursor: grabbing;
  transform: translate(-50%, -50%) scale(1.2);
  box-shadow: 0 4px 16px rgba(139, 92, 246, 0.5);
}

.editor-preview__progress-tooltip {
  position: absolute;
  bottom: 150%;
  transform: translateX(-50%);
  background-color: rgba(0, 0, 0, 0.95);
  backdrop-filter: blur(8px);
  color: white;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  font-size: 0.875rem;
  font-weight: 500;
  white-space: nowrap;
  pointer-events: none;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}
</style>

