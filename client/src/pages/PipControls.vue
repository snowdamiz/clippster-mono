<template>
  <div 
    class="h-full w-full bg-black overflow-hidden select-none relative"
    @mousemove="handleMouseMove"
    @mouseleave="handleMouseLeave"
  >
    <!-- Video fills entire container -->
    <video
      ref="videoRef"
      class="w-full h-full object-contain"
      autoplay
      playsinline
      :muted="isMuted"
      @mousedown="startDrag"
      @dblclick="closeWindow"
    />
    
    <!-- Live Badge - auto-hide -->
    <Transition name="fade">
      <div 
        v-if="showControls"
        class="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-red-600/90 rounded text-white text-xs font-medium pointer-events-none"
      >
        <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        LIVE
      </div>
    </Transition>

    <!-- Streamer Name - auto-hide -->
    <Transition name="fade">
      <div 
        v-if="showControls"
        class="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-white text-xs font-medium truncate max-w-[150px] pointer-events-none"
      >
        {{ streamerName }}
      </div>
    </Transition>

    <!-- Toast Notification -->
    <Transition name="toast">
      <div 
        v-if="toastMessage"
        class="absolute top-10 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded text-white text-xs font-medium pointer-events-none z-50"
        :class="toastType === 'success' ? 'bg-green-600/90' : 'bg-red-600/90'"
      >
        {{ toastMessage }}
      </div>
    </Transition>

    <!-- Controls Overlay - appears on hover -->
    <div 
      class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-8 pb-2 px-2 transition-opacity duration-200"
      :class="showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'"
    >
      <div class="flex items-center gap-1">
      <!-- Play/Pause Button -->
      <button
        @click="togglePlayPause"
        class="p-1.5 rounded text-white hover:bg-white/10 transition-colors"
        :title="isPlaying ? 'Pause' : 'Play'"
      >
        <Pause v-if="isPlaying" class="w-4 h-4" />
        <Play v-else class="w-4 h-4" />
      </button>

      <!-- Volume Control -->
      <div class="flex items-center gap-1 flex-1">
        <button
          @click="toggleMute"
          class="p-1.5 rounded text-white hover:bg-white/10 transition-colors"
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
          class="w-16 h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer"
          :style="{ '--value': `${volume * 100}%` }"
        />
      </div>

      <!-- Clip Button -->
      <button
        @click="createClip"
        :disabled="!canClip"
        class="p-1.5 rounded bg-[var(--sidebar-accent)] hover:opacity-90 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white transition-colors"
        title="Create Clip (Alt+C)"
      >
        <Scissors class="w-4 h-4" />
      </button>

      <!-- Close Button -->
      <button
        @click="closeWindow"
        class="p-1.5 rounded text-white hover:bg-red-600/80 transition-colors"
        title="Close (Double-click video)"
      >
        <X class="w-4 h-4" />
      </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { listen, emitTo, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';
import { Play, Pause, Volume2, Volume1, VolumeX, Scissors, X } from 'lucide-vue-next';
import Hls from 'hls.js';

const videoRef = ref<HTMLVideoElement | null>(null);
const showControls = ref(false);
let controlsTimeout: ReturnType<typeof setTimeout> | null = null;
const CONTROLS_HIDE_DELAY = 2000; // 2 seconds

// Aspect ratio tracking (used for initial window sizing when video loads)
let videoAspectRatio: number | null = null;

// State synced from main window
const streamerName = ref('Stream');
const isPlaying = ref(true);
const volume = ref(1);
const isMuted = ref(false);
const canClip = ref(false);
const hlsUrl = ref<string | null>(null);

// Toast state
const toastMessage = ref<string | null>(null);
const toastType = ref<'success' | 'error'>('success');
let toastTimeout: ReturnType<typeof setTimeout> | null = null;

function showToast(message: string, type: 'success' | 'error' = 'success') {
  if (toastTimeout) clearTimeout(toastTimeout);
  toastMessage.value = message;
  toastType.value = type;
  toastTimeout = setTimeout(() => {
    toastMessage.value = null;
  }, 3000);
}

let hls: Hls | null = null;
let unlistenFns: UnlistenFn[] = [];

onMounted(async () => {
  console.log('[PIP] Component mounted, setting up listeners...');
  // Note: Aspect ratio is enforced at the OS level via WM_SIZING subclass in Rust.
  // No need for a reactive onResized listener here.
  
  // Listen for state updates from main window
  unlistenFns.push(
    await listen<{ 
      streamerName: string; 
      isPlaying: boolean; 
      volume: number; 
      isMuted: boolean; 
      canClip: boolean;
      hlsUrl?: string;
    }>(
      'pip-state-update',
      (event) => {
        console.log('[PIP] Received state update:', event.payload);
        streamerName.value = event.payload.streamerName;
        isPlaying.value = event.payload.isPlaying;
        volume.value = event.payload.volume;
        isMuted.value = event.payload.isMuted;
        canClip.value = event.payload.canClip;
        
        // Initialize HLS if URL provided and changed
        if (event.payload.hlsUrl && event.payload.hlsUrl !== hlsUrl.value) {
          console.log('[PIP] New HLS URL received:', event.payload.hlsUrl);
          hlsUrl.value = event.payload.hlsUrl;
          initHls(event.payload.hlsUrl);
        } else if (!event.payload.hlsUrl) {
          console.warn('[PIP] No HLS URL in state update');
        }
      }
    )
  );

  // Listen for clip creation result
  unlistenFns.push(
    await listen<{ success: boolean; message: string }>('pip-clip-result', (event) => {
      console.log('[PIP] Clip result:', event.payload);
      showToast(event.payload.message, event.payload.success ? 'success' : 'error');
    })
  );

  // Request initial state from main window
  console.log('[PIP] Requesting initial state...');
  await emitTo('main', 'pip-request-state');
});

onUnmounted(() => {
  unlistenFns.forEach((fn) => fn());
  if (hls) {
    hls.destroy();
    hls = null;
  }
  if (toastTimeout) clearTimeout(toastTimeout);
  if (controlsTimeout) clearTimeout(controlsTimeout);
});

// Watch for volume/mute changes
watch([volume, isMuted], () => {
  if (videoRef.value) {
    videoRef.value.volume = volume.value;
    videoRef.value.muted = isMuted.value;
  }
});

// Watch for play state changes
watch(isPlaying, async (playing) => {
  if (!videoRef.value) return;
  
  console.log('[PIP] Play state changed to:', playing);
  
  if (playing) {
    try {
      await videoRef.value.play();
      console.log('[PIP] Video playback started successfully');
    } catch (error) {
      console.error('[PIP] Failed to start playback:', error);
      // Retry after a short delay
      setTimeout(async () => {
        try {
          await videoRef.value?.play();
          console.log('[PIP] Video playback started on retry');
        } catch (retryError) {
          console.error('[PIP] Retry play failed:', retryError);
        }
      }, 100);
    }
  } else {
    videoRef.value.pause();
    console.log('[PIP] Video paused (HLS continues loading)');
  }
});

// HLS recovery state
let networkErrorRetries = 0;
let lastHlsUrl: string | null = null;

function initHls(url: string) {
  console.log('[PIP] initHls called with URL:', url);
  
  if (!videoRef.value) {
    console.error('[PIP] No video element ref');
    return;
  }

  // Destroy existing HLS instance
  if (hls) {
    console.log('[PIP] Destroying existing HLS instance');
    hls.destroy();
  }

  lastHlsUrl = url;

  if (Hls.isSupported()) {
    console.log('[PIP] HLS.js is supported, initializing...');
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: false, // More reliable for long streams
      backBufferLength: 90,
      liveSyncDurationCount: 5,
      liveMaxLatencyDurationCount: Infinity,
      liveDurationInfinity: true,
      fragLoadingTimeOut: 20000,
      fragLoadingMaxRetry: 6,
      manifestLoadingMaxRetry: 6,
    });

    hls.loadSource(url);
    hls.attachMedia(videoRef.value);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      console.log('[PIP] HLS manifest parsed, starting playback');
      networkErrorRetries = 0; // Reset on successful load
      if (videoRef.value && isPlaying.value) {
        videoRef.value.play().catch((e) => console.error('[PIP] Play error:', e));
      }

      // Detect video aspect ratio once metadata is available
      if (videoRef.value) {
        const onMeta = async () => {
          const v = videoRef.value;
          if (!v || !v.videoWidth || !v.videoHeight) return;
          videoAspectRatio = v.videoWidth / v.videoHeight;
          console.log(`[PIP] Video aspect ratio detected: ${v.videoWidth}x${v.videoHeight} = ${videoAspectRatio.toFixed(4)}`);
          // Resize window to match video aspect ratio
          try {
            const win = getCurrentWindow();
            const factor = await win.scaleFactor();
            const physSize = await win.innerSize();
            const currentWidth = physSize.width / factor;
            const newHeight = Math.round(currentWidth / videoAspectRatio);
            await win.setSize(new LogicalSize(Math.round(currentWidth), newHeight));
            console.log(`[PIP] Window resized to ${Math.round(currentWidth)}x${newHeight}`);
          } catch (e) {
            console.warn('[PIP] Failed to resize window for aspect ratio:', e);
          }
        };
        if (videoRef.value.videoWidth && videoRef.value.videoHeight) {
          onMeta();
        } else {
          videoRef.value.addEventListener('loadedmetadata', onMeta, { once: true });
        }
      }
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      console.error('[PIP] HLS error:', data.type, data.details, data.fatal);
      
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            networkErrorRetries++;
            console.log(`[PIP] Network error, retry ${networkErrorRetries}/10`);
            if (networkErrorRetries < 10) {
              setTimeout(() => hls?.startLoad(), 2000 * networkErrorRetries);
            } else {
              // Try full reinit
              networkErrorRetries = 0;
              setTimeout(() => initHls(url), 3000);
            }
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.log('[PIP] Attempting media error recovery');
            hls?.recoverMediaError();
            break;
          default:
            console.log('[PIP] Fatal error, attempting reinit');
            setTimeout(() => initHls(url), 3000);
        }
      } else if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls?.startLoad();
      }
    });
  } else if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    console.log('[PIP] Using native HLS');
    videoRef.value.src = url;
    if (isPlaying.value) {
      videoRef.value.play().catch((e) => console.error('[PIP] Play error:', e));
    }
  } else {
    console.error('[PIP] HLS not supported');
  }

  // Apply initial volume
  if (videoRef.value) {
    videoRef.value.volume = volume.value;
    videoRef.value.muted = isMuted.value;
  }
}

function handleMouseMove() {
  showControls.value = true;
  
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  
  controlsTimeout = setTimeout(() => {
    showControls.value = false;
  }, CONTROLS_HIDE_DELAY);
}

function handleMouseLeave() {
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  showControls.value = false;
}

function startDrag(event: MouseEvent) {
  // Only drag if not clicking a button
  if ((event.target as HTMLElement).closest('button')) return;
  getCurrentWindow().startDragging();
}

function togglePlayPause() {
  emitTo('main', 'pip-toggle-play-pause');
}

function toggleMute() {
  emitTo('main', 'pip-toggle-mute');
}

function handleVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emitTo('main', 'pip-volume-change', parseFloat(target.value));
}

function createClip() {
  emitTo('main', 'pip-create-clip');
}

async function closeWindow() {
  await emitTo('main', 'pip-close');
  getCurrentWindow().close();
}
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
    var(--sidebar-accent) 0%,
    var(--sidebar-accent) var(--value, 50%),
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

/* Fade transition for controls and badges */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Toast transition */
.toast-enter-active,
.toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -10px);
}
</style>
