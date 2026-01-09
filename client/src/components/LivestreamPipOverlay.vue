<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      ref="pipContainer"
      class="fixed z-[9999] rounded-xl overflow-hidden shadow-2xl border border-white/20 bg-black"
      :style="containerStyle"
      @mousedown="startDrag"
    >
      <!-- Video Container -->
      <div class="relative w-full h-full">
        <video
          ref="videoRef"
          class="w-full h-full object-contain bg-black"
          autoplay
          playsinline
          :muted="isMuted"
        />

        <!-- Controls Overlay (show on hover) -->
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 opacity-0 hover:opacity-100 transition-opacity duration-200 flex flex-col justify-between p-2"
          @mousedown.stop
        >
          <!-- Top Bar -->
          <div class="flex items-center justify-between">
            <!-- Drag Handle -->
            <div class="flex items-center gap-1 text-white/60 text-xs cursor-move" @mousedown="startDrag">
              <GripVertical class="w-3 h-3" />
              <span>LIVE</span>
            </div>

            <!-- Close Button -->
            <button
              @click="handleClose"
              class="p-1 rounded bg-black/50 hover:bg-red-600/80 text-white transition-colors"
              title="Close PIP"
            >
              <X class="w-3 h-3" />
            </button>
          </div>

          <!-- Bottom Controls -->
          <div class="flex items-center justify-between gap-2">
            <!-- Left: Play/Pause + Volume -->
            <div class="flex items-center gap-1">
              <!-- Play/Pause -->
              <button
                @click="togglePlayPause"
                class="p-1.5 rounded bg-black/50 hover:bg-white/20 text-white transition-colors"
                :title="isPlaying ? 'Pause' : 'Play'"
              >
                <Pause v-if="isPlaying" class="w-4 h-4" />
                <Play v-else class="w-4 h-4" />
              </button>

              <!-- Volume -->
              <div class="flex items-center gap-1 group">
                <button
                  @click="toggleMute"
                  class="p-1.5 rounded bg-black/50 hover:bg-white/20 text-white transition-colors"
                  :title="isMuted ? 'Unmute' : 'Mute'"
                >
                  <VolumeX v-if="isMuted || volume === 0" class="w-4 h-4" />
                  <Volume1 v-else-if="volume < 0.5" class="w-4 h-4" />
                  <Volume2 v-else class="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  :value="volume"
                  @input="handleVolumeChange"
                  class="w-16 h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity"
                  :style="{ '--value': `${volume * 100}%` }"
                />
              </div>
            </div>

            <!-- Right: Clip Button -->
            <button
              @click="handleClip"
              class="p-1.5 rounded bg-violet-600 hover:bg-violet-500 text-white transition-colors flex items-center gap-1"
              title="Create Clip (C)"
            >
              <Scissors class="w-4 h-4" />
            </button>
          </div>
        </div>

        <!-- Resize Handle -->
        <div
          class="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
          @mousedown.stop="startResize"
        >
          <div class="absolute bottom-1 right-1 w-2 h-2 border-r-2 border-b-2 border-white/50" />
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { X, Play, Pause, Volume2, Volume1, VolumeX, Scissors, GripVertical } from 'lucide-vue-next';

interface Props {
  modelValue: boolean;
  videoElement?: HTMLVideoElement | null;
  isPlaying?: boolean;
  volume?: number;
  isMuted?: boolean;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'play'): void;
  (e: 'pause'): void;
  (e: 'volume-change', volume: number): void;
  (e: 'mute-toggle'): void;
  (e: 'clip'): void;
  (e: 'close'): void;
}

const props = withDefaults(defineProps<Props>(), {
  videoElement: null,
  isPlaying: false,
  volume: 1,
  isMuted: false,
});

const emit = defineEmits<Emits>();

const pipContainer = ref<HTMLDivElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);

// Position and size state
const position = ref({ x: window.innerWidth - 340, y: window.innerHeight - 230 });
const size = ref({ width: 320, height: 180 });

// Drag state
const isDragging = ref(false);
const dragOffset = ref({ x: 0, y: 0 });

// Resize state
const isResizing = ref(false);
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 });

// Min/max constraints
const MIN_WIDTH = 240;
const MIN_HEIGHT = 135;
const MAX_WIDTH = 640;
const MAX_HEIGHT = 360;

const containerStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`,
  width: `${size.value.width}px`,
  height: `${size.value.height}px`,
}));

// Sync video source when video element changes
watch(
  () => props.videoElement,
  async (newVideo) => {
    if (newVideo && videoRef.value && props.modelValue) {
      await nextTick();
      // Clone the video stream to our PIP video element
      if (newVideo.srcObject) {
        videoRef.value.srcObject = newVideo.srcObject;
      } else if (newVideo.src) {
        videoRef.value.src = newVideo.src;
      }
      // Sync playback state
      videoRef.value.currentTime = newVideo.currentTime;
      videoRef.value.volume = props.volume;
      videoRef.value.muted = props.isMuted;
      if (props.isPlaying) {
        videoRef.value.play().catch(() => {});
      }
    }
  },
  { immediate: true }
);

// Sync volume
watch(
  () => props.volume,
  (newVolume) => {
    if (videoRef.value) {
      videoRef.value.volume = newVolume;
    }
  }
);

// Sync muted state
watch(
  () => props.isMuted,
  (newMuted) => {
    if (videoRef.value) {
      videoRef.value.muted = newMuted;
    }
  }
);

// Sync play state
watch(
  () => props.isPlaying,
  (newPlaying) => {
    if (videoRef.value) {
      if (newPlaying) {
        videoRef.value.play().catch(() => {});
      } else {
        videoRef.value.pause();
      }
    }
  }
);

function togglePlayPause() {
  if (props.isPlaying) {
    emit('pause');
  } else {
    emit('play');
  }
}

function toggleMute() {
  emit('mute-toggle');
}

function handleVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('volume-change', parseFloat(target.value));
}

function handleClip() {
  emit('clip');
}

function handleClose() {
  emit('close');
  emit('update:modelValue', false);
}

// Drag handling
function startDrag(event: MouseEvent) {
  if (isResizing.value) return;
  isDragging.value = true;
  dragOffset.value = {
    x: event.clientX - position.value.x,
    y: event.clientY - position.value.y,
  };
  document.addEventListener('mousemove', onDrag);
  document.addEventListener('mouseup', stopDrag);
}

function onDrag(event: MouseEvent) {
  if (!isDragging.value) return;
  const newX = Math.max(0, Math.min(window.innerWidth - size.value.width, event.clientX - dragOffset.value.x));
  const newY = Math.max(0, Math.min(window.innerHeight - size.value.height, event.clientY - dragOffset.value.y));
  position.value = { x: newX, y: newY };
}

function stopDrag() {
  isDragging.value = false;
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
}

// Resize handling
function startResize(event: MouseEvent) {
  isResizing.value = true;
  resizeStart.value = {
    x: event.clientX,
    y: event.clientY,
    width: size.value.width,
    height: size.value.height,
  };
  document.addEventListener('mousemove', onResize);
  document.addEventListener('mouseup', stopResize);
}

function onResize(event: MouseEvent) {
  if (!isResizing.value) return;
  const deltaX = event.clientX - resizeStart.value.x;
  const deltaY = event.clientY - resizeStart.value.y;
  
  // Maintain 16:9 aspect ratio
  let newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, resizeStart.value.width + deltaX));
  let newHeight = newWidth * (9 / 16);
  
  // Clamp height
  if (newHeight < MIN_HEIGHT) {
    newHeight = MIN_HEIGHT;
    newWidth = newHeight * (16 / 9);
  } else if (newHeight > MAX_HEIGHT) {
    newHeight = MAX_HEIGHT;
    newWidth = newHeight * (16 / 9);
  }
  
  size.value = { width: newWidth, height: newHeight };
}

function stopResize() {
  isResizing.value = false;
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
}

// Keyboard shortcut for clip
function handleKeydown(event: KeyboardEvent) {
  if (event.key.toLowerCase() === 'c' && props.modelValue) {
    event.preventDefault();
    handleClip();
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  document.removeEventListener('mousemove', onDrag);
  document.removeEventListener('mouseup', stopDrag);
  document.removeEventListener('mousemove', onResize);
  document.removeEventListener('mouseup', stopResize);
});
</script>

<style scoped>
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  background: transparent;
}

input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  background: linear-gradient(
    to right,
    #8b5cf6 0%,
    #8b5cf6 var(--value, 50%),
    #52525b var(--value, 50%),
    #52525b 100%
  );
  border-radius: 2px;
}

input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
  margin-top: -3px;
  cursor: pointer;
}

input[type='range']::-moz-range-track {
  height: 4px;
  background: #52525b;
  border-radius: 2px;
}

input[type='range']::-moz-range-thumb {
  width: 10px;
  height: 10px;
  background: white;
  border-radius: 50%;
  border: none;
  cursor: pointer;
}
</style>
