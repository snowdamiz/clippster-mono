<template>
  <div class="h-full w-full bg-black rounded-xl overflow-hidden select-none flex flex-col">
    <!-- Video Container -->
    <div 
      class="flex-1 relative bg-black cursor-move"
      @mousedown="startDrag"
      @dblclick="closeWindow"
    >
      <video
        ref="videoRef"
        class="w-full h-full object-contain"
        autoplay
        playsinline
        :muted="isMuted"
      />
      
      <!-- Live Badge -->
      <div class="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-1 bg-red-600/90 rounded text-white text-xs font-medium">
        <div class="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
        LIVE
      </div>

      <!-- Streamer Name -->
      <div class="absolute top-2 right-2 px-2 py-1 bg-black/60 rounded text-white text-xs font-medium truncate max-w-[150px]">
        {{ streamerName }}
      </div>
    </div>

    <!-- Controls Bar -->
    <div class="flex items-center gap-1 p-2 bg-zinc-900/95">
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
        class="p-1.5 rounded bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white transition-colors"
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
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { listen, emit, type UnlistenFn } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Play, Pause, Volume2, Volume1, VolumeX, Scissors, X } from 'lucide-vue-next';
import Hls from 'hls.js';

const videoRef = ref<HTMLVideoElement | null>(null);

// State synced from main window
const streamerName = ref('Stream');
const isPlaying = ref(true);
const volume = ref(1);
const isMuted = ref(false);
const canClip = ref(false);
const hlsUrl = ref<string | null>(null);

let hls: Hls | null = null;
let unlistenFns: UnlistenFn[] = [];

onMounted(async () => {
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
        streamerName.value = event.payload.streamerName;
        isPlaying.value = event.payload.isPlaying;
        volume.value = event.payload.volume;
        isMuted.value = event.payload.isMuted;
        canClip.value = event.payload.canClip;
        
        // Initialize HLS if URL provided and changed
        if (event.payload.hlsUrl && event.payload.hlsUrl !== hlsUrl.value) {
          hlsUrl.value = event.payload.hlsUrl;
          initHls(event.payload.hlsUrl);
        }
      }
    )
  );

  // Request initial state
  await emit('pip-request-state');
});

onUnmounted(() => {
  unlistenFns.forEach((fn) => fn());
  if (hls) {
    hls.destroy();
    hls = null;
  }
});

// Watch for volume/mute changes
watch([volume, isMuted], () => {
  if (videoRef.value) {
    videoRef.value.volume = volume.value;
    videoRef.value.muted = isMuted.value;
  }
});

// Watch for play state changes
watch(isPlaying, (playing) => {
  if (videoRef.value) {
    if (playing) {
      videoRef.value.play().catch(() => {});
    } else {
      videoRef.value.pause();
    }
  }
});

function initHls(url: string) {
  if (!videoRef.value) return;

  // Destroy existing HLS instance
  if (hls) {
    hls.destroy();
  }

  if (Hls.isSupported()) {
    hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
      backBufferLength: 90,
    });

    hls.loadSource(url);
    hls.attachMedia(videoRef.value);

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      if (videoRef.value && isPlaying.value) {
        videoRef.value.play().catch(() => {});
      }
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        console.error('[PIP] HLS fatal error:', data);
      }
    });
  } else if (videoRef.value.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    videoRef.value.src = url;
    if (isPlaying.value) {
      videoRef.value.play().catch(() => {});
    }
  }

  // Apply initial volume
  if (videoRef.value) {
    videoRef.value.volume = volume.value;
    videoRef.value.muted = isMuted.value;
  }
}

function startDrag(event: MouseEvent) {
  // Only drag if not clicking a button
  if ((event.target as HTMLElement).closest('button')) return;
  getCurrentWindow().startDragging();
}

function togglePlayPause() {
  emit('pip-toggle-play-pause');
}

function toggleMute() {
  emit('pip-toggle-mute');
}

function handleVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement;
  emit('pip-volume-change', parseFloat(target.value));
}

function createClip() {
  emit('pip-create-clip');
}

async function closeWindow() {
  await emit('pip-close');
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
