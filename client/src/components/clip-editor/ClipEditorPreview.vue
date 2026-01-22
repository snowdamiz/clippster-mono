<template>
  <div ref="previewContainerRef" class="flex flex-col h-full" 
       style="background: repeating-conic-gradient(#0a0a0b 0% 25%, #111113 0% 50%) 50% / 20px 20px;">
    <!-- Video Container -->
    <div class="flex-1 flex items-center justify-center p-8 min-h-0 relative">
      <div class="relative w-full h-full max-w-full max-h-full flex items-center justify-center bg-black rounded-xl overflow-hidden" 
           style="box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(14, 165, 233, 0.1);">
        <video
          ref="videoRef"
          class="w-full h-full object-contain"
          :class="{
            'hidden': showCropOverlay || isAfterVideoEnd,
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
    <div class="flex items-center gap-4 px-6 py-4 relative z-[100] border-t backdrop-blur-[12px]" 
         style="background: linear-gradient(180deg, rgba(0, 0, 0, 0.8) 0%, rgba(0, 0, 0, 0.9) 100%); border-color: var(--editor-border);">
      <button
        class="flex items-center justify-center w-10 h-10 rounded-lg border cursor-pointer transition-all duration-150 hover:border-sky-500/50"
        style="background-color: rgba(14, 165, 233, 0.15); border-color: rgba(14, 165, 233, 0.3); color: var(--editor-accent);"
        @click="togglePlayPause"
      >
        <Play v-if="!isPlaying" :size="20" />
        <Pause v-else :size="20" />
      </button>

      <!-- Volume Control -->
      <div class="flex items-center gap-3">
        <button
          class="flex items-center justify-center w-10 h-10 rounded-lg border cursor-pointer transition-all duration-150 hover:border-sky-500/50"
          style="background-color: rgba(14, 165, 233, 0.15); border-color: rgba(14, 165, 233, 0.3); color: var(--editor-accent);"
          @click="toggleMute"
          title="Mute/Unmute"
        >
          <VolumeX v-if="isMuted || volume === 0" :size="20" />
          <Volume2 v-else :size="20" />
        </button>
        <div class="relative w-24 h-1.5 bg-white/10 rounded">
          <div
            class="absolute left-0 top-0 h-full rounded transition-[width] duration-150 pointer-events-none"
            style="background: linear-gradient(90deg, rgba(14, 165, 233, 0.8), rgba(14, 165, 233, 1));"
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
          @mouseleave="hoverTime = null"
        >
          <!-- Progress fill -->
          <div
            class="absolute left-0 top-0 h-full rounded transition-[width] duration-100 pointer-events-none"
            style="background: linear-gradient(90deg, #8b5cf6, #a78bfa);"
            :style="{ width: `${progressPercent}%` }"
          ></div>
          <!-- Playhead -->
          <div
            class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-white border-2 rounded-full cursor-grab transition-all duration-150 z-10 hover:scale-110"
            :class="{ 'cursor-grabbing !scale-125': isDraggingProgress }"
            style="border-color: #8b5cf6; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);"
            :style="{ left: `${progressPercent}%`, boxShadow: isDraggingProgress ? '0 4px 16px rgba(139, 92, 246, 0.5)' : '0 2px 8px rgba(0, 0, 0, 0.3)' }"
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
        class="flex items-center justify-center w-10 h-10 rounded-lg border cursor-pointer transition-all duration-150 hover:border-sky-500/50"
        style="background-color: rgba(14, 165, 233, 0.15); border-color: rgba(14, 165, 233, 0.3); color: var(--editor-accent);"
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



