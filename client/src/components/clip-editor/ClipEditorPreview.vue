<template>
  <div class="flex-1 flex flex-col min-h-0 p-4">
    <!-- Video Container -->
    <div class="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden relative">
      <video
        ref="videoRef"
        :src="videoSrc || ''"
        class="max-w-full max-h-full object-contain"
        @loadedmetadata="onLoadedMetadata"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
        @play="onPlay"
        @pause="onPause"
      />

      <!-- Overlay Container -->
      <div
        ref="overlayContainerRef"
        class="absolute inset-0 pointer-events-none overflow-hidden"
        :style="overlayContainerStyle"
      >
        <!-- Text Overlays -->
        <div
          v-for="overlay in visibleTextOverlays"
          :key="overlay.id"
          class="absolute text-overlay"
          :style="getTextOverlayStyle(overlay)"
          :class="getTextOverlayClass(overlay)"
        >
          {{ overlay.text }}
        </div>

        <!-- Stickers -->
        <div
          v-for="sticker in visibleStickers"
          :key="sticker.id"
          class="absolute sticker-overlay"
          :style="getStickerStyle(sticker)"
          :class="getStickerClass(sticker)"
        >
          <span v-if="sticker.stickerType === 'emoji'" class="text-4xl">
            {{ sticker.stickerPath }}
          </span>
          <img v-else :src="sticker.stickerPath" class="w-full h-full object-contain" alt="Sticker" />
        </div>
      </div>

      <!-- Filter Overlay -->
      <div v-if="filterSettings" class="absolute inset-0 pointer-events-none" :style="getFilterStyle()" />

      <!-- Play Button Overlay -->
      <button
        v-if="!isPlaying"
        @click="emit('togglePlay')"
        class="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors pointer-events-auto"
      >
        <div class="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
          <Play class="w-8 h-8 text-white ml-1" />
        </div>
      </button>
    </div>

    <!-- Controls Bar -->
    <div class="mt-3 flex items-center gap-3">
      <button @click="emit('togglePlay')" class="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
        <Play v-if="!isPlaying" class="w-5 h-5 text-white" />
        <Pause v-else class="w-5 h-5 text-white" />
      </button>

      <!-- Time Display -->
      <div class="text-sm text-white/70 font-mono min-w-[100px]">
        {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
      </div>

      <!-- Progress Bar -->
      <div
        class="flex-1 h-1 bg-white/10 rounded-full cursor-pointer relative group"
        @click="onProgressClick"
        @mousedown="startProgressDrag"
      >
        <div class="absolute inset-y-0 left-0 bg-violet-500 rounded-full" :style="{ width: `${progressPercent}%` }" />
        <div
          class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          :style="{ left: `calc(${progressPercent}% - 6px)` }"
        />
      </div>

      <!-- Volume Control -->
      <div class="flex items-center gap-2">
        <button @click="toggleMute" class="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
          <VolumeX v-if="isMuted" class="w-5 h-5 text-white/50" />
          <Volume2 v-else class="w-5 h-5 text-white" />
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          :value="volume"
          @input="onVolumeChange"
          class="w-20 accent-violet-500"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import { Play, Pause, Volume2, VolumeX } from 'lucide-vue-next';
  import type { TextOverlay, Sticker, FilterSettings } from '@/types';

  interface SegmentInput {
    start_time: number;
    end_time: number;
  }

  const props = defineProps<{
    videoSrc: string | null;
    currentTime: number;
    isPlaying: boolean;
    clipStart: number;
    clipEnd: number;
    textOverlays: TextOverlay[];
    stickers: Sticker[];
    filterSettings: FilterSettings | null;
    segments?: SegmentInput[];
  }>();

  const emit = defineEmits<{
    (e: 'timeUpdate', time: number): void;
    (e: 'togglePlay'): void;
    (e: 'videoElementReady', element: HTMLVideoElement): void;
  }>();

  // Refs
  const videoRef = ref<HTMLVideoElement | null>(null);
  const overlayContainerRef = ref<HTMLElement | null>(null);
  const duration = ref(0);
  const volume = ref(1);
  const isMuted = ref(false);
  const isDraggingProgress = ref(false);

  // Computed
  const clipDuration = computed(() => props.clipEnd - props.clipStart);

  // Get sorted segments for playback control
  const sortedSegments = computed(() => {
    if (!props.segments || props.segments.length === 0) {
      // Default to single segment if no segments provided
      return [{ start_time: props.clipStart, end_time: props.clipEnd }];
    }
    return [...props.segments].sort((a, b) => a.start_time - b.start_time);
  });

  const progressPercent = computed(() => {
    if (clipDuration.value <= 0) return 0;
    return ((props.currentTime - props.clipStart) / clipDuration.value) * 100;
  });

  const visibleTextOverlays = computed(() => {
    const relativeTime = props.currentTime - props.clipStart;
    return props.textOverlays.filter((o) => relativeTime >= o.startTime && relativeTime <= o.endTime);
  });

  const visibleStickers = computed(() => {
    const relativeTime = props.currentTime - props.clipStart;
    return props.stickers.filter((s) => relativeTime >= s.startTime && relativeTime <= s.endTime);
  });

  const overlayContainerStyle = computed(() => {
    // Match the video element's dimensions
    if (!videoRef.value) return {};
    return {};
  });

  // Methods
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function onLoadedMetadata() {
    if (videoRef.value) {
      duration.value = videoRef.value.duration;
      // Start at the first segment
      const firstSegment = sortedSegments.value[0];
      videoRef.value.currentTime = firstSegment?.start_time || props.clipStart;
      emit('videoElementReady', videoRef.value);
    }
  }

  function onTimeUpdate() {
    if (videoRef.value && !isDraggingProgress.value) {
      const currentVideoTime = videoRef.value.currentTime;
      const segments = sortedSegments.value;

      // Find which segment we should be in
      let currentSegmentIndex = -1;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (currentVideoTime >= seg.start_time && currentVideoTime <= seg.end_time) {
          currentSegmentIndex = i;
          break;
        }
      }

      // If we're in a valid segment, emit the time
      if (currentSegmentIndex >= 0) {
        emit('timeUpdate', currentVideoTime);
        return;
      }

      // We're not in any segment - find where we should be
      // Check if we've passed the end of a segment and need to jump to the next
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        // If we're past this segment's end but before the next segment's start
        if (currentVideoTime > seg.end_time) {
          const nextSegment = segments[i + 1];

          if (nextSegment) {
            // Check if we're in the gap between segments
            if (currentVideoTime < nextSegment.start_time) {
              // Jump to the start of the next segment
              videoRef.value.currentTime = nextSegment.start_time;
              emit('timeUpdate', nextSegment.start_time);
              return;
            }
          } else {
            // No more segments - we've reached the end
            // Go back to the first segment and pause
            videoRef.value.currentTime = segments[0].start_time;
            videoRef.value.pause();
            emit('timeUpdate', segments[0].start_time);
            return;
          }
        }
      }

      // If we're before the first segment, jump to the first segment
      if (currentVideoTime < segments[0].start_time) {
        videoRef.value.currentTime = segments[0].start_time;
        emit('timeUpdate', segments[0].start_time);
        return;
      }

      // Fallback - emit current time
      emit('timeUpdate', currentVideoTime);
    }
  }

  function onEnded() {
    if (videoRef.value) {
      // Go back to the first segment
      const firstSegment = sortedSegments.value[0];
      videoRef.value.currentTime = firstSegment?.start_time || props.clipStart;
    }
  }

  function onPlay() {
    // Already handled via isPlaying prop
  }

  function onPause() {
    // Already handled via isPlaying prop
  }

  function onProgressClick(e: MouseEvent) {
    if (!videoRef.value) return;
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const newTime = props.clipStart + percent * clipDuration.value;
    videoRef.value.currentTime = newTime;
    emit('timeUpdate', newTime);
  }

  function startProgressDrag(e: MouseEvent) {
    isDraggingProgress.value = true;
    const onMove = (moveEvent: MouseEvent) => {
      if (!videoRef.value) return;
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const percent = Math.max(0, Math.min(1, (moveEvent.clientX - rect.left) / rect.width));
      const newTime = props.clipStart + percent * clipDuration.value;
      videoRef.value.currentTime = newTime;
      emit('timeUpdate', newTime);
    };

    const onUp = () => {
      isDraggingProgress.value = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function toggleMute() {
    if (videoRef.value) {
      isMuted.value = !isMuted.value;
      videoRef.value.muted = isMuted.value;
    }
  }

  function onVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    volume.value = parseFloat(target.value);
    if (videoRef.value) {
      videoRef.value.volume = volume.value;
      isMuted.value = volume.value === 0;
    }
  }

  function getTextOverlayStyle(overlay: TextOverlay): Record<string, string> {
    const style: Record<string, string> = {
      left: `${overlay.position.x}%`,
      top: `${overlay.position.y}%`,
      transform: 'translate(-50%, -50%)',
      fontFamily: overlay.style?.fontFamily || 'sans-serif',
      fontSize: `${overlay.style?.fontSize || 24}px`,
      fontWeight: String(overlay.style?.fontWeight || 600),
      color: overlay.style?.color || '#ffffff',
    };

    if (overlay.style?.backgroundEnabled && overlay.style?.backgroundColor) {
      style.backgroundColor = overlay.style.backgroundColor;
      style.padding = `${overlay.style.padding || 8}px`;
      style.borderRadius = `${overlay.style.borderRadius || 4}px`;
    }

    if (overlay.style?.shadowEnabled) {
      style.textShadow = `${overlay.style.shadowOffsetX || 2}px ${overlay.style.shadowOffsetY || 2}px ${overlay.style.shadowBlur || 4}px ${overlay.style.shadowColor || '#000000'}`;
    }

    if (overlay.style?.strokeEnabled) {
      style.webkitTextStroke = `${overlay.style.strokeWidth || 1}px ${overlay.style.strokeColor || '#000000'}`;
    }

    return style;
  }

  function getTextOverlayClass(overlay: TextOverlay): string[] {
    const classes: string[] = [];
    if (overlay.animation && overlay.animation !== 'none') {
      classes.push(`animate-${overlay.animation}`);
    }
    return classes;
  }

  function getStickerStyle(sticker: Sticker): Record<string, string> {
    return {
      left: `${sticker.position.x}%`,
      top: `${sticker.position.y}%`,
      transform: `translate(-50%, -50%) scale(${sticker.scale}) rotate(${sticker.rotation}deg)`,
    };
  }

  function getStickerClass(sticker: Sticker): string[] {
    const classes: string[] = [];
    if (sticker.animation && sticker.animation !== 'none') {
      classes.push(`animate-${sticker.animation}`);
    }
    return classes;
  }

  function getFilterStyle(): Record<string, string> {
    if (!props.filterSettings) return {};

    const filters: string[] = [];

    if (props.filterSettings.brightness !== 0) {
      filters.push(`brightness(${100 + props.filterSettings.brightness}%)`);
    }
    if (props.filterSettings.contrast !== 0) {
      filters.push(`contrast(${100 + props.filterSettings.contrast}%)`);
    }
    if (props.filterSettings.saturation !== 0) {
      filters.push(`saturate(${100 + props.filterSettings.saturation}%)`);
    }
    if (props.filterSettings.hue !== 0) {
      filters.push(`hue-rotate(${props.filterSettings.hue}deg)`);
    }

    return {
      filter: filters.join(' '),
      mixBlendMode: 'normal',
    };
  }

  // Initialize video element
  onMounted(() => {
    if (videoRef.value) {
      emit('videoElementReady', videoRef.value);
    }
  });
</script>

<style scoped>
  /* Text overlay animations */
  .animate-fade {
    animation: fadeIn 0.3s ease-out;
  }

  .animate-slide-up {
    animation: slideUp 0.3s ease-out;
  }

  .animate-slide-down {
    animation: slideDown 0.3s ease-out;
  }

  .animate-typewriter {
    overflow: hidden;
    white-space: nowrap;
    animation: typewriter 0.5s steps(20);
  }

  .animate-bounce {
    animation: bounce 0.5s ease-out;
  }

  .animate-zoom {
    animation: zoomIn 0.3s ease-out;
  }

  .animate-pop {
    animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  /* Sticker animations */
  .animate-spin {
    animation: spin 2s linear infinite;
  }

  .animate-pulse {
    animation: pulse 1s ease-in-out infinite;
  }

  .animate-shake {
    animation: shake 0.5s ease-in-out infinite;
  }

  .animate-float {
    animation: float 2s ease-in-out infinite;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translate(-50%, calc(-50% + 20px));
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%);
      opacity: 1;
    }
  }

  @keyframes slideDown {
    from {
      transform: translate(-50%, calc(-50% - 20px));
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%);
      opacity: 1;
    }
  }

  @keyframes typewriter {
    from {
      width: 0;
    }
    to {
      width: 100%;
    }
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translate(-50%, -50%);
    }
    50% {
      transform: translate(-50%, calc(-50% - 10px));
    }
  }

  @keyframes zoomIn {
    from {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
  }

  @keyframes pop {
    0% {
      transform: translate(-50%, -50%) scale(0);
    }
    70% {
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @keyframes spin {
    from {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }

  @keyframes pulse {
    0%,
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  @keyframes shake {
    0%,
    100% {
      transform: translate(-50%, -50%) translateX(0);
    }
    25% {
      transform: translate(-50%, -50%) translateX(-5px);
    }
    75% {
      transform: translate(-50%, -50%) translateX(5px);
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translate(-50%, -50%) translateY(0);
    }
    50% {
      transform: translate(-50%, -50%) translateY(-10px);
    }
  }
</style>
