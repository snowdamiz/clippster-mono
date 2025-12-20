<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50"
        @keydown="handleKeydown"
        tabindex="0"
        ref="dialogRef"
      >
        <Transition name="dialog" appear>
          <div
            ref="containerRef"
            :class="[
              'relative bg-zinc-950 overflow-hidden transition-all duration-300',
              isFullscreen
                ? 'w-screen h-screen rounded-none'
                : 'rounded-2xl max-w-6xl w-full mx-4 border border-white/10 max-h-[90vh]',
            ]"
          >
            <!-- Header Bar (hidden in fullscreen unless hovered) -->
            <div
              :class="[
                'absolute top-0 left-0 right-0 z-30 transition-opacity duration-300',
                isFullscreen && !showControls ? 'opacity-0 pointer-events-none' : 'opacity-100',
              ]"
            >
              <div class="bg-gradient-to-b from-black/80 to-transparent p-4">
                <div class="flex items-center justify-between">
                  <!-- Streamer Info -->
                  <div class="flex items-center gap-3">
                    <div class="relative">
                      <img
                        v-if="streamerInfo.profileImageUrl"
                        :src="streamerInfo.profileImageUrl"
                        :alt="streamerInfo.displayName"
                        class="w-10 h-10 rounded-full object-cover border-2 border-red-500"
                      />
                      <div
                        v-else
                        class="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold border-2 border-red-500"
                      >
                        {{ streamerInfo.displayName?.charAt(0)?.toUpperCase() || '?' }}
                      </div>
                      <!-- Live indicator -->
                      <div
                        v-if="viewer.isLive.value"
                        class="absolute -bottom-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-zinc-950 animate-pulse"
                      />
                    </div>
                    <div>
                      <h3 class="text-white font-semibold">{{ streamerInfo.displayName }}</h3>
                      <div class="flex items-center gap-2 text-xs text-zinc-400">
                        <span class="flex items-center gap-1">
                          <Users class="w-3 h-3" />
                          {{ viewer.state.value.viewerCount }}
                        </span>
                        <span v-if="viewer.isLive.value" class="text-red-400 font-medium">LIVE</span>
                        <span v-else class="text-yellow-400">{{ viewer.behindLiveFormatted.value }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Right side actions -->
                  <div class="flex items-center gap-2">
                    <!-- Quality Badge -->
                    <button
                      v-if="viewer.state.value.streamQuality"
                      @click="showStatsPopup = !showStatsPopup"
                      class="px-2 py-1 rounded bg-zinc-800/80 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors flex items-center gap-1"
                    >
                      <Signal class="w-3 h-3" :class="connectionQualityColor" />
                      {{ viewer.state.value.streamQuality }}
                    </button>

                    <!-- Close button -->
                    <button
                      @click="handleClose"
                      class="p-2 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
                    >
                      <X class="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Stats Popup -->
              <div
                v-if="showStatsPopup"
                class="absolute top-16 right-4 bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-sm space-y-2 min-w-[200px]"
              >
                <div class="flex justify-between">
                  <span class="text-zinc-400">Resolution</span>
                  <span class="text-white">{{ viewer.state.value.streamQuality || 'Unknown' }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">Latency</span>
                  <span class="text-white">~{{ viewer.state.value.latencyMs || '?' }}ms</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">Connection</span>
                  <span :class="connectionStatusTextColor">{{ connectionStatusText }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">Playback Mode</span>
                  <span class="text-white capitalize">{{ viewer.state.value.playbackMode }}</span>
                </div>
              </div>
            </div>

            <!-- Video Container -->
            <div
              ref="videoContainerRef"
              class="relative bg-black aspect-video w-full"
              @mousemove="handleMouseMove"
              @mouseleave="handleMouseLeave"
            >
              <!-- Live Video (LiveKit) -->
              <video
                ref="liveVideoRef"
                :class="[
                  'w-full h-full object-contain transition-opacity duration-200',
                  viewer.state.value.playbackMode === 'live' ? 'opacity-100' : 'opacity-0 absolute inset-0',
                ]"
                autoplay
                playsinline
                muted
              />

              <!-- DVR Video (Segment Playback) -->
              <video
                ref="dvrVideoRef"
                :class="[
                  'w-full h-full object-contain transition-opacity duration-200',
                  viewer.state.value.playbackMode === 'dvr' ? 'opacity-100' : 'opacity-0 absolute inset-0',
                ]"
                playsinline
              />

              <!-- Watermark Overlay -->
              <div
                v-if="showWatermark && watermarkUrl"
                class="absolute inset-0 pointer-events-none z-10"
                :style="watermarkStyle"
              >
                <img :src="watermarkUrl" alt="Watermark" class="w-full h-full object-contain" />
              </div>

              <!-- Buffering Indicator -->
              <div
                v-if="viewer.state.value.isBuffering"
                class="absolute inset-0 flex items-center justify-center bg-black/40 z-20"
              >
                <div class="flex flex-col items-center gap-3">
                  <Loader2 class="w-12 h-12 text-white animate-spin" />
                  <span class="text-white text-sm">Loading...</span>
                </div>
              </div>

              <!-- Connection Status Overlays -->
              <div
                v-if="viewer.state.value.connectionState === 'connecting'"
                class="absolute inset-0 flex items-center justify-center bg-black/80 z-20"
              >
                <div class="flex flex-col items-center gap-3">
                  <Loader2 class="w-12 h-12 text-violet-500 animate-spin" />
                  <span class="text-white text-sm font-medium">Connecting to stream...</span>
                  <span class="text-zinc-400 text-xs">{{ props.displayName }}</span>
                </div>
              </div>

              <div
                v-if="viewer.state.value.connectionState === 'reconnecting'"
                class="absolute inset-0 flex items-center justify-center bg-black/60 z-20"
              >
                <div class="flex flex-col items-center gap-3">
                  <WifiOff class="w-12 h-12 text-yellow-500 animate-pulse" />
                  <span class="text-white text-sm">Reconnecting...</span>
                </div>
              </div>

              <div
                v-if="viewer.state.value.connectionState === 'failed'"
                class="absolute inset-0 flex items-center justify-center bg-black/60 z-20"
              >
                <div class="flex flex-col items-center gap-3">
                  <AlertCircle class="w-12 h-12 text-red-500" />
                  <span class="text-white text-sm text-center max-w-xs">{{ viewer.state.value.connectionError || 'Connection failed' }}</span>
                  <button
                    @click="reconnect"
                    class="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>

              <!-- Controls Overlay -->
              <div
                :class="[
                  'absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300',
                  showControls || !viewer.state.value.isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none',
                ]"
              >
                <div class="bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-4 px-4">
                  <!-- DVR Timeline -->
                  <LivestreamTimeline
                    :playback-position="viewer.state.value.playbackPosition"
                    :live-edge-time="viewer.state.value.liveEdgeTime"
                    :total-recorded-duration="viewer.state.value.totalRecordedDuration"
                    :is-at-live-edge="viewer.state.value.isAtLiveEdge"
                    :available-segments="viewer.state.value.availableSegments"
                    @seek="handleSeek"
                    @go-live="handleGoLive"
                  />

                  <!-- Control Bar -->
                  <div class="flex items-center justify-between mt-3">
                    <!-- Left Controls -->
                    <div class="flex items-center gap-3">
                      <!-- Play/Pause -->
                      <button
                        @click="viewer.togglePlayPause"
                        class="p-2 rounded-lg text-white hover:bg-white/20 transition-colors"
                      >
                        <Pause v-if="viewer.state.value.isPlaying" class="w-6 h-6" />
                        <Play v-else class="w-6 h-6" />
                      </button>

                      <!-- Volume -->
                      <div class="flex items-center gap-2 group">
                        <button
                          @click="viewer.toggleMute"
                          class="p-2 rounded-lg text-white hover:bg-white/20 transition-colors"
                        >
                          <VolumeX v-if="viewer.state.value.isMuted || viewer.state.value.volume === 0" class="w-5 h-5" />
                          <Volume1 v-else-if="viewer.state.value.volume < 0.5" class="w-5 h-5" />
                          <Volume2 v-else class="w-5 h-5" />
                        </button>
                        <div class="w-0 overflow-hidden group-hover:w-24 transition-all duration-200">
                          <input
                            type="range"
                            min="0"
                            max="1"
                            step="0.01"
                            :value="viewer.state.value.volume"
                            @input="handleVolumeChange"
                            class="w-24 h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                          />
                        </div>
                      </div>

                      <!-- Time Display -->
                      <div class="text-white text-sm font-mono">
                        {{ formatTime(viewer.state.value.playbackPosition) }}
                        /
                        {{ formatTime(viewer.state.value.liveEdgeTime) }}
                      </div>

                      <!-- Behind Live Indicator -->
                      <button
                        v-if="!viewer.state.value.isAtLiveEdge"
                        @click="handleGoLive"
                        class="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs font-medium rounded-full transition-colors flex items-center gap-1"
                      >
                        <Radio class="w-3 h-3" />
                        Go Live
                      </button>
                    </div>

                    <!-- Right Controls -->
                    <div class="flex items-center gap-2">
                      <!-- Playback Speed (DVR only) -->
                      <div v-if="!viewer.state.value.isAtLiveEdge" class="relative">
                        <button
                          @click="showSpeedMenu = !showSpeedMenu"
                          class="px-2 py-1 rounded bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
                        >
                          {{ viewer.state.value.playbackSpeed }}x
                        </button>
                        <div
                          v-if="showSpeedMenu"
                          class="absolute bottom-full mb-2 right-0 bg-zinc-900 border border-zinc-700 rounded-lg py-1 min-w-[80px]"
                        >
                          <button
                            v-for="speed in [1, 1.25, 1.5, 2]"
                            :key="speed"
                            @click="setPlaybackSpeed(speed)"
                            :class="[
                              'w-full px-3 py-1 text-sm text-left hover:bg-zinc-700 transition-colors',
                              viewer.state.value.playbackSpeed === speed ? 'text-violet-400' : 'text-white',
                            ]"
                          >
                            {{ speed }}x
                          </button>
                        </div>
                      </div>

                      <!-- Clip Button -->
                      <button
                        @click="openClipModal"
                        class="px-3 py-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                        :disabled="viewer.state.value.totalRecordedDuration < 5"
                        :title="viewer.state.value.totalRecordedDuration < 5 ? 'Wait for more content to be recorded' : 'Create clip (C)'"
                      >
                        <Scissors class="w-4 h-4" />
                        Clip
                      </button>

                      <!-- PiP Button -->
                      <button
                        v-if="isPipSupported"
                        @click="togglePip"
                        class="p-2 rounded-lg text-white hover:bg-white/20 transition-colors"
                        title="Picture-in-Picture (P)"
                      >
                        <PictureInPicture2 class="w-5 h-5" />
                      </button>

                      <!-- Fullscreen Button -->
                      <button
                        @click="toggleFullscreen"
                        class="p-2 rounded-lg text-white hover:bg-white/20 transition-colors"
                        title="Fullscreen (F)"
                      >
                        <Minimize v-if="isFullscreen" class="w-5 h-5" />
                        <Maximize v-else class="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Clip Modal -->
            <ClipDurationModal
              v-if="showClipModal"
              :available-duration="viewer.availableClipDuration.value"
              :project-id="viewer.state.value.projectId"
              :session-id="viewer.state.value.sessionId"
              :temp-session-id="viewer.state.value.tempSessionId"
              :playback-position="viewer.state.value.playbackPosition"
              :watermark-settings="viewer.state.value.watermarkSettings"
              :watermark-id="viewer.state.value.watermarkId"
              :segments="viewer.state.value.availableSegments"
              :display-name="props.displayName"
              :mint-id="props.mintId"
              :is-temp-recording="viewer.state.value.isTempRecording"
              :hls-playlist-path="viewer.state.value.hlsPlaylistPath"
              @close="showClipModal = false"
              @clip-created="handleClipCreated"
            />
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import {
  X,
  Users,
  Signal,
  Loader2,
  WifiOff,
  AlertCircle,
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Radio,
  Scissors,
  PictureInPicture2,
  Maximize,
  Minimize,
} from 'lucide-vue-next';
import { invoke } from '@tauri-apps/api/core';
import { useLivestreamViewer } from '@/composables/useLivestreamViewer';
import LivestreamTimeline from './LivestreamTimeline.vue';
import ClipDurationModal from './ClipDurationModal.vue';
import { getWatermarkImage, resolveWatermarkById } from '@/services/database';

interface Props {
  modelValue: boolean;
  mintId: string;
  streamerId: string;
  displayName: string;
  profileImageUrl?: string;
}

interface Emits {
  (e: 'update:modelValue', value: boolean): void;
  (e: 'clip-created', clipPath: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// Refs
const dialogRef = ref<HTMLDivElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const videoContainerRef = ref<HTMLDivElement | null>(null);
const liveVideoRef = ref<HTMLVideoElement | null>(null);
const dvrVideoRef = ref<HTMLVideoElement | null>(null);

// Composable
const viewer = useLivestreamViewer();

// UI State
const isFullscreen = ref(false);
const showControls = ref(true);
const showStatsPopup = ref(false);
const showSpeedMenu = ref(false);
const showClipModal = ref(false);
const watermarkUrl = ref<string | null>(null);
let controlsTimeout: number | null = null;

// Computed
const streamerInfo = computed(() => ({
  displayName: props.displayName,
  profileImageUrl: props.profileImageUrl,
}));

const connectionStatusText = computed(() => {
  const state = viewer.state.value.connectionState;
  return state === 'connected'
    ? 'Connected'
    : state === 'connecting'
      ? 'Connecting...'
      : state === 'reconnecting'
        ? 'Reconnecting...'
        : state === 'failed'
          ? 'Failed'
          : 'Disconnected';
});

const connectionStatusTextColor = computed(() => {
  const state = viewer.state.value.connectionState;
  return state === 'connected'
    ? 'text-green-400'
    : state === 'reconnecting'
      ? 'text-yellow-400'
      : state === 'failed'
        ? 'text-red-400'
        : 'text-zinc-400';
});

const connectionQualityColor = computed(() => {
  const latency = viewer.state.value.latencyMs;
  if (!latency) return 'text-zinc-400';
  if (latency < 1000) return 'text-green-400';
  if (latency < 2000) return 'text-yellow-400';
  return 'text-red-400';
});

const showWatermark = computed(() => {
  return viewer.state.value.watermarkId && viewer.state.value.watermarkSettings;
});

const watermarkStyle = computed(() => {
  const settings = viewer.state.value.watermarkSettings;
  if (!settings) return {};

  // Use settings to position watermark
  const position = settings.position || { x: 50, y: 50 };
  const scale = settings.scale || 100;
  const opacity = settings.opacity ?? 100;

  return {
    position: 'absolute',
    left: `${position.x}%`,
    top: `${position.y}%`,
    transform: 'translate(-50%, -50%)',
    width: `${scale}%`,
    maxWidth: '100%',
    opacity: opacity / 100,
  };
});

const isPipSupported = computed(() => {
  return document.pictureInPictureEnabled;
});

// Load watermark image
async function loadWatermark() {
  const watermarkId = viewer.state.value.watermarkId;
  if (!watermarkId) {
    watermarkUrl.value = null;
    return;
  }

  try {
    // Check if this is an org-asset watermark
    if (watermarkId.startsWith('org-asset-')) {
      const resolved = await resolveWatermarkById(watermarkId);
      if (resolved?.filePath) {
        watermarkUrl.value = await invoke<string>('read_file_as_data_url', { filePath: resolved.filePath });
      }
    } else {
      // Regular watermark lookup by ID
      const watermark = await getWatermarkImage(watermarkId);
      if (watermark) {
        watermarkUrl.value = await invoke<string>('read_file_as_data_url', { filePath: watermark.file_path });
      }
    }
  } catch (error) {
    console.warn('[WatchDialog] Failed to load watermark:', error);
    watermarkUrl.value = null;
  }
}

// Format time helper
function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Event handlers
function handleMouseMove() {
  showControls.value = true;
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  if (viewer.state.value.isPlaying) {
    controlsTimeout = window.setTimeout(() => {
      showControls.value = false;
    }, 3000);
  }
}

function handleMouseLeave() {
  if (viewer.state.value.isPlaying) {
    showControls.value = false;
  }
}

function handleVolumeChange(event: Event) {
  const target = event.target as HTMLInputElement;
  viewer.setVolume(parseFloat(target.value));
}

function handleSeek(position: number) {
  viewer.seek(position);
}

function handleGoLive() {
  viewer.goToLive();
}

function setPlaybackSpeed(speed: number) {
  viewer.setPlaybackSpeed(speed);
  showSpeedMenu.value = false;
}

function openClipModal() {
  showClipModal.value = true;
}

function handleClipCreated(clipPath: string) {
  showClipModal.value = false;
  emit('clip-created', clipPath);
}

function handleClose() {
  viewer.disconnect();
  emit('update:modelValue', false);
}

async function reconnect() {
  await viewer.connect(props.mintId, props.streamerId, props.displayName, props.profileImageUrl);
}

async function toggleFullscreen() {
  if (!containerRef.value) return;

  if (isFullscreen.value) {
    await document.exitFullscreen();
    isFullscreen.value = false;
  } else {
    await containerRef.value.requestFullscreen();
    isFullscreen.value = true;
  }
}

async function togglePip() {
  const video = viewer.state.value.playbackMode === 'live' ? liveVideoRef.value : dvrVideoRef.value;
  if (!video) return;

  try {
    if (document.pictureInPictureElement) {
      await document.exitPictureInPicture();
    } else {
      await video.requestPictureInPicture();
    }
  } catch (error) {
    console.warn('[WatchDialog] PiP error:', error);
  }
}

// Keyboard handling
function handleKeydown(event: KeyboardEvent) {
  // Don't handle if user is typing in an input
  if ((event.target as HTMLElement).tagName === 'INPUT') return;

  switch (event.key.toLowerCase()) {
    case ' ':
      event.preventDefault();
      viewer.togglePlayPause();
      break;
    case 'arrowleft':
      event.preventDefault();
      viewer.seekRelative(-10);
      break;
    case 'arrowright':
      event.preventDefault();
      viewer.seekRelative(10);
      break;
    case 'j':
      event.preventDefault();
      viewer.seekRelative(-30);
      break;
    case 'l':
      event.preventDefault();
      viewer.seekRelative(30);
      break;
    case 'm':
      event.preventDefault();
      viewer.toggleMute();
      break;
    case 'f':
      event.preventDefault();
      toggleFullscreen();
      break;
    case 'p':
      event.preventDefault();
      if (isPipSupported.value) togglePip();
      break;
    case 'c':
      event.preventDefault();
      if (event.shiftKey) {
        // Shift+C opens full modal
        openClipModal();
      } else {
        // Quick 30s clip
        quickClip();
      }
      break;
    case 'home':
      event.preventDefault();
      viewer.seek(0);
      break;
    case 'end':
      event.preventDefault();
      handleGoLive();
      break;
    case 'escape':
      event.preventDefault();
      if (isFullscreen.value) {
        toggleFullscreen();
      } else {
        handleClose();
      }
      break;
    case '<':
    case ',':
      event.preventDefault();
      decreaseSpeed();
      break;
    case '>':
    case '.':
      event.preventDefault();
      increaseSpeed();
      break;
  }
}

function quickClip() {
  // Create a 30-second clip immediately
  if (viewer.state.value.totalRecordedDuration >= 30) {
    // Emit event or call clip creation directly
    // For now, just open modal with 30s preset
    showClipModal.value = true;
  }
}

function decreaseSpeed() {
  const speeds = [1, 1.25, 1.5, 2];
  const current = viewer.state.value.playbackSpeed;
  const index = speeds.indexOf(current);
  if (index > 0) {
    setPlaybackSpeed(speeds[index - 1]);
  }
}

function increaseSpeed() {
  const speeds = [1, 1.25, 1.5, 2];
  const current = viewer.state.value.playbackSpeed;
  const index = speeds.indexOf(current);
  if (index < speeds.length - 1) {
    setPlaybackSpeed(speeds[index + 1]);
  }
}

// Handle fullscreen change events
function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

// Watch for dialog open/close
watch(
  () => props.modelValue,
  async (isOpen) => {
    console.log('[WatchDialog] modelValue changed:', isOpen, 'mintId:', props.mintId);
    if (isOpen) {
      // Connect when dialog opens
      await nextTick();
      
      console.log('[WatchDialog] Setting video elements...');
      console.log('[WatchDialog] liveVideoRef:', !!liveVideoRef.value);
      console.log('[WatchDialog] dvrVideoRef:', !!dvrVideoRef.value);
      
      // Set video elements first
      if (liveVideoRef.value) {
        viewer.setVideoElement(liveVideoRef.value);
      }
      if (dvrVideoRef.value) {
        viewer.setDvrVideoElement(dvrVideoRef.value);
      }
      
      // Connect to livestream
      console.log('[WatchDialog] Calling viewer.connect...');
      try {
        await viewer.connect(props.mintId, props.streamerId, props.displayName, props.profileImageUrl);
        console.log('[WatchDialog] Connect completed, state:', viewer.state.value.connectionState);
      } catch (error) {
        console.error('[WatchDialog] Connect failed:', error);
      }

      // After connection, re-attach video element in case tracks arrived during connect
      await nextTick();
      if (liveVideoRef.value) {
        viewer.setVideoElement(liveVideoRef.value);
        // Try to unmute and play
        liveVideoRef.value.muted = viewer.state.value.isMuted;
        liveVideoRef.value.volume = viewer.state.value.volume;
        liveVideoRef.value.play().catch(() => {
          // Autoplay blocked - user will need to click play
          console.log('[WatchDialog] Autoplay blocked, user needs to click play');
        });
      }

      // Focus dialog for keyboard events
      dialogRef.value?.focus();
    } else {
      // Disconnect when dialog closes
      viewer.disconnect();
    }
  },
  { immediate: true }
);

// Watch for watermark changes
watch(
  () => viewer.state.value.watermarkId,
  () => {
    loadWatermark();
  }
);

// Lifecycle
onMounted(() => {
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  if (controlsTimeout) {
    clearTimeout(controlsTimeout);
  }
  // Ensure we disconnect when component unmounts
  viewer.disconnect();
});
</script>

<style scoped>
/* Transitions */
.modal-enter-active,
.modal-leave-active {
  transition:
    opacity 0.2s ease,
    backdrop-filter 0.2s ease;
}
.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active,
.dialog-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.2s ease;
}
.dialog-enter-from {
  transform: scale(0.95);
  opacity: 0;
}
.dialog-leave-to {
  transform: scale(0.95);
  opacity: 0;
}

/* Volume slider styling */
input[type='range'] {
  -webkit-appearance: none;
  background: transparent;
}

input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  background: linear-gradient(to right, #8b5cf6 0%, #8b5cf6 var(--value, 50%), #52525b var(--value, 50%), #52525b 100%);
  border-radius: 2px;
}

input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  margin-top: -4px;
  cursor: pointer;
}

input[type='range']::-moz-range-track {
  height: 4px;
  background: #52525b;
  border-radius: 2px;
}

input[type='range']::-moz-range-thumb {
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  border: none;
  cursor: pointer;
}
</style>

