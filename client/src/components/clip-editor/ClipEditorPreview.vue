<template>
  <div class="editor-preview">
    <!-- Video Container -->
    <div class="editor-preview__video-wrapper">
      <div 
        class="editor-preview__video-container"
        :style="videoContainerStyle"
      >
        <video
          ref="videoRef"
          class="editor-preview__video"
          :src="videoSrc || undefined"
          :style="{ filter: appliedCSSFilters }"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @play="onPlay"
          @pause="onPause"
          @ended="onEnded"
        />

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

      <div class="editor-preview__time">
        {{ formatTime(currentTime) }} / {{ formatTime(videoDuration) }}
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { Play, Pause } from 'lucide-vue-next';
import type { FullVideoEditorEdit } from '@/services/database/video-editor-edits';

const props = defineProps<{
  videoSrc: string | null | undefined;
  currentTime: number;
  isPlaying: boolean;
  aspectRatio: string;
  editorEdit: FullVideoEditorEdit | null;
  watermarkSettings: any;
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

// Computed aspect ratio styles
const videoContainerStyle = computed(() => {
  const ratios: Record<string, string> = {
    '16:9': '56.25%', // 9/16 * 100
    '9:16': '177.78%', // 16/9 * 100
    '1:1': '100%',
    '4:5': '125%', // 5/4 * 100
  };

  return {
    paddingBottom: ratios[props.aspectRatio] || ratios['16:9'],
  };
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
  }
}

function onTimeUpdate() {
  if (videoRef.value) {
    emit('timeUpdate', videoRef.value.currentTime);
  }
}

function onPlay() {
  emit('play');
}

function onPause() {
  emit('pause');
}

function onEnded() {
  emit('pause');
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

// Sync video element with props
watch(() => props.currentTime, (newTime) => {
  if (videoRef.value && Math.abs(videoRef.value.currentTime - newTime) > 0.1) {
    videoRef.value.currentTime = newTime;
  }
});

watch(() => props.isPlaying, (playing) => {
  if (!videoRef.value) return;
  
  if (playing) {
    videoRef.value.play().catch(err => {
      console.error('[ClipEditorPreview] Failed to play:', err);
    });
  } else {
    videoRef.value.pause();
  }
});

onMounted(() => {
  console.log('[ClipEditorPreview] Mounted with video:', props.videoSrc);
});

onUnmounted(() => {
  if (videoRef.value) {
    videoRef.value.pause();
  }
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
}

.editor-preview__video-container {
  position: relative;
  width: 100%;
  max-width: 100%;
  max-height: 100%;
  background-color: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 
    0 20px 60px rgba(0, 0, 0, 0.8),
    0 0 0 1px rgba(14, 165, 233, 0.1);
}

.editor-preview__video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
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

.editor-preview__time {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--editor-text);
  font-variant-numeric: tabular-nums;
  padding: 0.375rem 0.75rem;
  background-color: var(--editor-surface-elevated);
  border-radius: 6px;
  border: 1px solid var(--editor-border);
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
</style>

