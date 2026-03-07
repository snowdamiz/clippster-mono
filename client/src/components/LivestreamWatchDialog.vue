<template>
  <Teleport to="body">
    <Transition name="modal">
      <!-- Keep component alive during PiP mode to maintain video element -->
      <div
        v-if="modelValue || isInPipMode || props.isPipModeExternal"
        :class="[
          'fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-50',
          // Hide dialog visually when in PiP mode but keep video element alive
          (isInPipMode || props.isPipModeExternal) && !modelValue ? 'opacity-0 pointer-events-none' : '',
        ]"
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
                'absolute top-0 left-0 right-0 z-30 transition-all duration-300 ease-in-out',
                showControls ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-full pointer-events-none',
              ]"
              @click.stop
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
                        class="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--sidebar-accent)] to-[#0891b2] flex items-center justify-center text-white font-bold border-2 border-red-500"
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
                  <span class="text-zinc-400">Playback Mode</span>
                  <span :class="viewer.state.value.playbackMode === 'webrtc' ? 'text-green-400' : 'text-white'">
                    {{ playbackModeDisplay }}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">Connection</span>
                  <span :class="connectionStatusTextColor">{{ connectionStatusText }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">Recorded</span>
                  <span class="text-white">{{ formatTime(viewer.state.value.totalRecordedDuration) }}</span>
                </div>
                <div class="flex justify-between">
                  <span class="text-zinc-400">At Live Edge</span>
                  <span :class="viewer.state.value.isAtLiveEdge ? 'text-green-400' : 'text-yellow-400'">
                    {{ viewer.state.value.isAtLiveEdge ? 'Yes' : 'No' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Video Container -->
            <div
              ref="videoContainerRef"
              class="relative bg-black aspect-video w-full"
              @mousemove="handleMouseMove"
              @mouseleave="handleMouseLeave"
              @click="handleVideoClick"
            >
              <!-- HLS Video Playback (always visible - HLS-only mode) -->
              <video
                ref="hlsVideoRef"
                class="w-full h-full object-contain"
                playsinline
                :muted="viewer.state.value.isMuted"
              />

              <!-- Hidden WebRTC video element (needed for track reception, not displayed) -->
              <video ref="liveVideoRef" class="hidden" playsinline autoplay muted />

              <!-- Watermark Overlay -->
              <div
                v-if="showWatermark && watermarkUrl"
                class="absolute inset-0 pointer-events-none z-10"
                :style="watermarkStyle"
              >
                <img :src="watermarkUrl" alt="Watermark" class="w-full h-full object-contain" />
              </div>

              <!-- Buffering Indicator (HLS loading or buffering) -->
              <div
                v-if="viewer.state.value.isBuffering && viewer.state.value.connectionState === 'connected'"
                class="absolute inset-0 flex items-center justify-center bg-black/60 z-20"
              >
                <div class="flex flex-col items-center gap-3">
                  <Loader2 class="w-12 h-12 text-[var(--sidebar-accent)] animate-spin" />
                  <span class="text-white text-sm font-medium">
                    {{ viewer.state.value.totalRecordedDuration < 12 ? 'Building buffer...' : 'Buffering...' }}
                  </span>
                </div>
              </div>

              <!-- Connection Status Overlays -->
              <div
                v-if="viewer.state.value.connectionState === 'connecting'"
                class="absolute inset-0 flex items-center justify-center bg-black/80 z-20"
              >
                <div class="flex flex-col items-center gap-3">
                  <Loader2 class="w-12 h-12 text-[var(--sidebar-accent)] animate-spin" />
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

              <!-- Only show connection failed overlay if NO DVR content is available -->
              <!-- If DVR content exists, user can continue watching the recorded stream -->
              <div
                v-if="viewer.state.value.connectionState === 'failed' && viewer.state.value.availableSegments.length === 0"
                class="absolute inset-0 flex items-center justify-center bg-black/60 z-20"
              >
                <div class="flex flex-col items-center gap-3">
                  <AlertCircle class="w-12 h-12 text-red-500" />
                  <span class="text-white text-sm text-center max-w-xs">
                    {{ viewer.state.value.connectionError || 'Connection failed' }}
                  </span>
                  <button
                    @click="reconnect"
                    class="px-4 py-2 bg-[var(--sidebar-accent)] hover:opacity-90 text-white rounded-lg transition-colors"
                  >
                    Retry
                  </button>
                </div>
              </div>

              <!-- Play overlay when paused -->
              <div
                v-if="
                  !viewer.state.value.isPlaying &&
                  viewer.state.value.connectionState === 'connected' &&
                  !viewer.state.value.isBuffering
                "
                class="absolute inset-0 flex items-center justify-center bg-black/40 z-15 cursor-pointer"
                @click.stop="viewer.play"
              >
                <div class="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <Play class="w-10 h-10 text-white ml-1" />
                </div>
              </div>

              <!-- Controls Overlay -->
              <div
                :class="[
                  'absolute bottom-0 left-0 right-0 z-30 transition-all duration-300 ease-in-out',
                  showControls || !viewer.state.value.isPlaying
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-full pointer-events-none',
                ]"
                @click.stop
              >
                <div class="bg-gradient-to-t from-black/90 via-black/60 to-transparent pt-16 pb-4 px-4">
                  <!-- Seek Bar -->
                  <LivestreamSeekBar
                    :current-time="viewer.state.value.playbackPosition"
                    :duration="viewer.state.value.totalRecordedDuration"
                    :live-edge-time="viewer.state.value.liveEdgeTime"
                    :buffered-ranges="viewer.state.value.bufferedRanges"
                    :is-at-live-edge="viewer.state.value.isAtLiveEdge"
                    @seek="handleSeek"
                    @seek-to-live="handleSeekToLive"
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
                          <VolumeX
                            v-if="viewer.state.value.isMuted || viewer.state.value.volume === 0"
                            class="w-5 h-5"
                          />
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
                            :style="volumeGradient"
                            class="w-24 h-1 bg-zinc-600 rounded-full appearance-none cursor-pointer accent-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:rounded-full"
                          />
                        </div>
                      </div>
                    </div>

                    <!-- Right Controls -->
                    <div class="flex items-center gap-2">
                      <!-- Clip Button -->
                      <button
                        @click="openClipModal"
                        class="px-3 py-2 bg-gradient-to-r from-[var(--sidebar-accent)] to-[#0891b2] hover:opacity-90 text-white text-sm font-medium rounded-lg transition-all flex items-center gap-2"
                        :disabled="
                          viewer.state.value.totalRecordedDuration < 180 ||
                          viewer.state.value.availableSegments.length === 0
                        "
                        :title="
                          viewer.state.value.availableSegments.length === 0
                            ? 'Waiting for segments to load...'
                            : viewer.state.value.totalRecordedDuration < 180
                              ? `DVR buffer building... ${formatTime(180 - viewer.state.value.totalRecordedDuration)} remaining`
                              : 'Create clip (C)'
                        "
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
            <LivestreamClipSelector
              v-if="showClipModal"
              :available-duration="frozenClipDuration"
              :project-id="sessionProjectId || viewer.state.value.projectId"
              :session-id="viewer.state.value.sessionId"
              :temp-session-id="viewer.state.value.tempSessionId"
              :playback-position="frozenClipDuration"
              :watermark-settings="viewer.state.value.watermarkSettings"
              :watermark-id="viewer.state.value.watermarkId"
              :segments="frozenSegments"
              :display-name="props.displayName"
              :mint-id="props.mintId"
              :is-temp-recording="viewer.state.value.isTempRecording"
              :streamer-id="props.streamerId"
              :platform="props.platform"
              :hls-output-dir="viewer.hlsOutputDir.value"
              @close="handleClipSelectorClose"
              @clip-created="handleClipCreated"
              @publish-clip="handlePublishClip"
            />

            <!-- Build Settings Dialog (for publish workflow) -->
            <ClipBuildSettingsDialog
              v-if="publishClipData && currentClipForPublish"
              v-model="showBuildDialog"
              :clip="currentClipForPublish"
              :watermark-settings="(viewer.state.value.watermarkSettings as any) || null"
              :thumbnail-url="currentClipForPublish.thumbnail_path || null"
              :publish-mode="true"
              :single-ratio-mode="true"
              @confirm="handleBuildConfirm"
            />

            <!-- Schedule/Publish Dialog (after build completes) -->
            <ScheduleClipDialog
              :open="showScheduleDialog"
              :clip-id="scheduleDialogData?.clipId || ''"
              :clip-name="scheduleDialogData?.clipName || ''"
              :media-url="scheduleDialogData?.mediaUrl || ''"
              :thumbnail-url="scheduleDialogData?.thumbnailUrl"
              :duration="scheduleDialogData?.duration"
              :project-name="props.displayName"
              :selected-date="new Date()"
              :immediate-mode="true"
              @close="showScheduleDialog = false"
              @scheduled="handleScheduleComplete"
            />
          </div>
        </Transition>
      </div>
    </Transition>

  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted, nextTick, type CSSProperties } from 'vue';
  import { formatTime as fmtTime } from '@/utils/dateTimeUtils';
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
    Scissors,
    PictureInPicture2,
    Maximize,
    Minimize,
    Clock,
    Radio,
  } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import { getCurrentWindow, UserAttentionType } from '@tauri-apps/api/window';
  import { listen, emitTo, type UnlistenFn } from '@tauri-apps/api/event';
  import { register, unregister, isRegistered } from '@tauri-apps/plugin-global-shortcut';
  import { useLivestreamViewer } from '@/composables/useLivestreamViewer';
  import { useToast } from '@/composables/useToast';
  import LivestreamSeekBar from './LivestreamSeekBar.vue';
  import LivestreamClipSelector from './LivestreamClipSelector.vue';
  import ClipBuildSettingsDialog from './ClipBuildSettingsDialog.vue';
  import ScheduleClipDialog from './calendar/ScheduleClipDialog.vue';
  import { createLivestreamClipProject, createClip as createClipRecord } from '@/services/database';
  import { getWatermarkImage, resolveWatermarkById } from '@/services/database/watermarks';
  import { createClipVersion } from '@/services/database/clip-versions';
  import { updateClip } from '@/services/database/clips';
  import { getOrCreateManualSession } from '@/services/database/clip-detection-sessions';
  import { useLivestreamStore } from '@/stores/livestream';

  interface Props {
    modelValue: boolean;
    mintId: string;
    streamerId: string;
    displayName: string;
    profileImageUrl?: string;
    /** Platform for the stream (PumpFun, Kick, etc.) */
    platform?: 'PumpFun' | 'Kick' | 'Twitch' | 'YouTube' | 'Rumble' | 'Twitter';
    /** External PIP mode state from global store */
    isPipModeExternal?: boolean;
  }

  interface Emits {
    (e: 'update:modelValue', value: boolean): void;
    (e: 'clip-created', clipPath: string, projectId: string): void;
    (e: 'pip-mode-changed', isPip: boolean): void;
    (e: 'closed'): void; // Emitted when user explicitly closes (not PIP)
  }

  const props = withDefaults(defineProps<Props>(), {
    platform: 'PumpFun',
    isPipModeExternal: false,
  });
  const emit = defineEmits<Emits>();

  // Refs
  const dialogRef = ref<HTMLDivElement | null>(null);
  const containerRef = ref<HTMLDivElement | null>(null);
  const videoContainerRef = ref<HTMLDivElement | null>(null);
  const liveVideoRef = ref<HTMLVideoElement | null>(null); // WebRTC video element
  const hlsVideoRef = ref<HTMLVideoElement | null>(null); // HLS video element for DVR

  // Composable
  const viewer = useLivestreamViewer();
  const livestreamStore = useLivestreamStore();

  interface SegmentInfo {
    segmentNumber: number;
    filePath: string;
    startTime: number;
    duration: number;
    endTime: number;
  }

  // UI State
  const isFullscreen = ref(false);
  const showControls = ref(true);
  const showStatsPopup = ref(false);
  const showClipModal = ref(false);
  const watermarkUrl = ref<string | null>(null);
  const watermarkDimensions = ref<{ width: number; height: number } | null>(null);
  let controlsTimeout: number | null = null;

  // Frozen clip selector state (snapshot at moment user clicks Clip)
  const frozenSegments = ref<SegmentInfo[]>([]);
  const frozenClipDuration = ref(0);
  const wasPlayingBeforeClip = ref(false);

  // Build and publish workflow state
  const showBuildDialog = ref(false);
  const showScheduleDialog = ref(false);
  const publishClipData = ref<{ clipId: string; clipPath: string; projectId: string } | null>(null);
  const currentClipForPublish = ref<any>(null);
  const scheduleDialogData = ref<{
    clipId: string;
    clipName: string;
    mediaUrl: string;
    thumbnailUrl?: string;
    duration?: number;
  } | null>(null);
  let buildCompleteUnlisten: UnlistenFn | null = null;

  // PiP state tracking
  const isInPipMode = ref(false);
  const closingForPip = ref(false);
  const pipListenersSetup = ref(false);
  const globalShortcutRegistered = ref(false);
  const GLOBAL_SHORTCUT = 'Alt+C';

  // Session tracking
  const sessionProjectId = ref<string | null>(null);
  const clipsCreatedCount = ref(0);

  // Quick clip state
  const isCreatingQuickClip = ref(false);
  const { success: showSuccess, error: showError } = useToast();

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

  const watermarkStyle = computed<CSSProperties>(() => {
    const settings = viewer.state.value.watermarkSettings;
    if (!settings) return {};

    const opacityRaw = settings.opacity ?? 100;
    const opacity = Math.max(0, Math.min(100, opacityRaw));

    const dims = watermarkDimensions.value;
    const is16x9 = !!dims && dims.height > 0 ? Math.abs(dims.width / dims.height - 16 / 9) < 0.02 : false;
    const isHd = !!dims && dims.width >= 1600 && dims.height >= 900;
    const isAutoFullFrame = is16x9 && isHd;

    // Full-frame overlay (corner to corner), either explicit flag or auto-detected HD 16:9
    if (settings.isFullFrameOverlay || isAutoFullFrame) {
      return {
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        transform: 'none',
        opacity: opacity / 100,
      };
    }

    const position = settings.position || { x: 50, y: 50 };
    const clamp01 = (val: number | undefined, fallback: number) => {
      const n = Number.isFinite(val) ? (val as number) : fallback;
      return Math.min(100, Math.max(0, n));
    };

    const x = clamp01(position.x, 50);
    const y = clamp01(position.y, 50);

    // Ensure scale/opacity are sane for visibility
    const scaleRaw = settings.scale ?? 100;
    const scale = Math.max(5, Math.min(200, scaleRaw));

    return {
      position: 'absolute',
      left: `${x}%`,
      top: `${y}%`,
      transform: 'translate(-50%, -50%)',
      width: `${scale}%`,
      maxWidth: '100%',
      opacity: opacity / 100,
    };
  });

  const isPipSupported = computed(() => {
    return document.pictureInPictureEnabled;
  });

  // Estimated delay from real-time (HLS-only mode has ~5-10 second latency)
  const estimatedDelay = computed(() => {
    // HLS playback with 4-second segments is typically ~5-10 seconds behind real-time
    if (viewer.state.value.isAtLiveEdge) {
      return '5-10';
    }

    // If seeking back, show how far behind we are
    const behindLive = Math.round(viewer.state.value.liveEdgeTime - viewer.state.value.playbackPosition);
    return behindLive > 0 ? behindLive : '5-10';
  });

  // Playback mode display (always HLS now, but show "Live" when at live edge)
  const playbackModeDisplay = computed(() => {
    return viewer.state.value.isAtLiveEdge ? 'Live' : 'DVR';
  });

  const volumeGradient = computed(() => {
    const pct = Math.min(100, Math.max(0, viewer.state.value.volume * 100));
    // Set CSS variable for the track gradient
    return {
      '--value': `${pct}%`,
    } as Record<string, string>;
  });

  // Load watermark image
  async function loadWatermark() {
    const watermarkId = viewer.state.value.watermarkId;
    const watermarkSettings = viewer.state.value.watermarkSettings;

    console.log('[WatchDialog] loadWatermark called:', { watermarkId, watermarkSettings });

    if (!watermarkId) {
      console.log('[WatchDialog] No watermarkId, skipping watermark load');
      watermarkUrl.value = null;
      return;
    }

    try {
      // Check if this is an org-asset watermark
      if (watermarkId.startsWith('org-asset-')) {
        console.log('[WatchDialog] Loading org-asset watermark:', watermarkId);
        const resolved = await resolveWatermarkById(watermarkId);
        if (resolved?.filePath) {
          const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: resolved.filePath });
          watermarkUrl.value = dataUrl;
          await loadWatermarkDimensions(dataUrl);
          console.log('[WatchDialog] Org-asset watermark loaded successfully');
        } else {
          console.warn('[WatchDialog] Failed to resolve org-asset watermark');
        }
      } else {
        // Regular watermark lookup by ID
        console.log('[WatchDialog] Loading regular watermark:', watermarkId);
        const watermark = await getWatermarkImage(watermarkId);
        if (watermark) {
          const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: watermark.file_path });
          watermarkUrl.value = dataUrl;
          await loadWatermarkDimensions(dataUrl);
          console.log('[WatchDialog] Regular watermark loaded successfully');
        } else {
          console.warn('[WatchDialog] Watermark not found in database:', watermarkId);
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
    // Always show controls when mouse moves
    showControls.value = true;

    // Clear any existing timeout to reset the timer
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }

    // Set a new timeout to hide controls after a period of inactivity
    if (viewer.state.value.isPlaying) {
      controlsTimeout = window.setTimeout(() => {
        showControls.value = false;
      }, 3000); // 3 seconds of inactivity
    }
  }

  function handleMouseLeave() {
    // When the mouse leaves, immediately start the timeout to hide controls
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    if (viewer.state.value.isPlaying) {
      controlsTimeout = window.setTimeout(() => {
        showControls.value = false;
      }, 500); // Hide faster when mouse leaves
    }
  }

  function handleVideoClick() {
    // Toggle play/pause when clicking on video
    if (viewer.state.value.connectionState === 'connected') {
      viewer.togglePlayPause();
    }
  }

  function handleVolumeChange(event: Event) {
    const target = event.target as HTMLInputElement;
    viewer.setVolume(parseFloat(target.value));
  }

  function handleSeek(time: number) {
    viewer.seek(time);
  }

  function handleSeekToLive() {
    viewer.seekToLive();
  }

  function openClipModal() {
    // Prevent opening if already open
    if (showClipModal.value) return;

    // Snapshot the frozen segments: take only the last 3 minutes of available segments
    const allSegments = viewer.state.value.availableSegments;
    const totalDuration = viewer.state.value.totalRecordedDuration;
    const maxClipWindow = 180; // 3 minutes

    if (totalDuration >= maxClipWindow) {
      // Filter to segments that fall within the last 3 minutes
      const cutoffTime = totalDuration - maxClipWindow;
      const relevantSegments = allSegments.filter((s: SegmentInfo) => s.endTime > cutoffTime);

      // Re-base segment times to start from 0 within the 3-minute window
      frozenSegments.value = relevantSegments.map((s: SegmentInfo) => ({
        ...s,
        startTime: Math.max(0, s.startTime - cutoffTime),
        endTime: s.endTime - cutoffTime,
      }));
      frozenClipDuration.value = maxClipWindow;
    } else {
      // Less than 3 minutes available, use all segments as-is
      frozenSegments.value = [...allSegments];
      frozenClipDuration.value = totalDuration;
    }

    // Pause the main HLS video to avoid audio overlap
    wasPlayingBeforeClip.value = viewer.state.value.isPlaying;
    viewer.pause();

    showClipModal.value = true;
  }

  function handleClipSelectorClose() {
    showClipModal.value = false;

    // Resume playback if it was playing before opening the clip selector
    if (wasPlayingBeforeClip.value) {
      viewer.togglePlayPause();
    }

    // Clear frozen state
    frozenSegments.value = [];
    frozenClipDuration.value = 0;
  }

  // Quick clip: Create a 30-second clip without any dialog
  async function performQuickClip() {
    const QUICK_CLIP_DURATION = 30;

    // Prevent multiple quick clips at once
    if (isCreatingQuickClip.value) {
      console.log('[WatchDialog] Quick clip already in progress');
      return;
    }

    // Check if we have enough recorded duration
    if (viewer.state.value.totalRecordedDuration < QUICK_CLIP_DURATION) {
      showError(
        'Not Enough Content',
        `Need at least ${QUICK_CLIP_DURATION}s recorded. Currently: ${Math.floor(viewer.state.value.totalRecordedDuration)}s`
      );
      return;
    }

    // Check if we have segments
    if (!viewer.state.value.availableSegments || viewer.state.value.availableSegments.length === 0) {
      showError('No Segments', 'No recorded segments available yet. Please wait a moment.');
      return;
    }

    // Determine effective session ID
    const effectiveSessionId = viewer.state.value.sessionId || viewer.state.value.tempSessionId || props.mintId;
    if (!effectiveSessionId) {
      showError('Session Error', 'No active session. Please try again.');
      return;
    }

    isCreatingQuickClip.value = true;
    console.log('[WatchDialog] Starting quick clip (30s)');

    let progressUnlisten: UnlistenFn | null = null;

    try {
      // Setup progress listener (optional - for logging)
      progressUnlisten = await listen<{ progress: number; message: string }>('clip-extraction-progress', (event) => {
        console.log(`[QuickClip] ${event.payload.progress}% - ${event.payload.message}`);
      });

      // Determine project ID - use existing or create new
      let effectiveProjectId = sessionProjectId.value || viewer.state.value.projectId;

      if (!effectiveProjectId && props.displayName && props.mintId) {
        // Create a new project for this clip
        try {
          effectiveProjectId = await createLivestreamClipProject(props.displayName, props.mintId, props.platform);
          sessionProjectId.value = effectiveProjectId;
          console.log('[WatchDialog] Created project for quick clip:', effectiveProjectId);
        } catch (err) {
          console.error('[WatchDialog] Failed to create project:', err);
          showError('Project Error', 'Failed to create project folder.');
          return;
        }
      }

      if (!effectiveProjectId) {
        showError('Project Error', 'Unable to determine project for clip.');
        return;
      }

      // Generate clip name
      const timestamp = fmtTime(new Date()).replace(/:/g, '-').replace(/\s*(AM|PM)/i, '');
      const clipName = `Quick Clip - ${timestamp}`;
      const clipEndTime = viewer.state.value.playbackPosition;
      const clipStartTime = clipEndTime - QUICK_CLIP_DURATION;

      console.log('[WatchDialog] Extracting quick clip:', {
        sessionId: effectiveSessionId,
        clipStartTime,
        clipEndTime,
        duration: QUICK_CLIP_DURATION,
        segmentsCount: viewer.state.value.availableSegments.length,
        projectId: effectiveProjectId,
      });

      // Extract the clip
      const resultJson = await invoke<string>('extract_livestream_clip', {
        sessionId: effectiveSessionId,
        clipEndTime: clipEndTime,
        clipDuration: QUICK_CLIP_DURATION,
        clipName: clipName,
        segments: viewer.state.value.availableSegments,
        projectId: effectiveProjectId,
        watermarkId: null,
        watermarkSettings: null,
      });

      // Parse the JSON result containing clipPath and thumbnailPath
      const extractionResult = JSON.parse(resultJson) as { clipPath: string; thumbnailPath: string | null };
      const clipFilePath = extractionResult.clipPath;
      const thumbnailFilePath = extractionResult.thumbnailPath;

      console.log('[WatchDialog] Quick clip extracted:', clipFilePath);
      if (thumbnailFilePath) {
        console.log('[WatchDialog] Thumbnail generated:', thumbnailFilePath);
      }

      // Save clip to database
      try {
        // Get campaign ID from store if this streamer is associated with a campaign
        const sessionCampaign = livestreamStore.getSessionCampaign(props.streamerId);
        const campaignId = sessionCampaign?.id;

        const clipId = await createClipRecord(effectiveProjectId, clipFilePath, {
          name: clipName,
          duration: QUICK_CLIP_DURATION,
          startTime: clipStartTime,
          endTime: clipEndTime,
          thumbnailPath: thumbnailFilePath || undefined,
          campaignId,
        });

        const manualSessionId = await getOrCreateManualSession(effectiveProjectId);
        const versionId = await createClipVersion(
          clipId,
          manualSessionId,
          1,
          {
            name: clipName,
            startTime: clipStartTime,
            endTime: clipEndTime,
          },
          'detected'
        );
        await updateClip(clipId, { current_version_id: versionId, detection_session_id: manualSessionId });
        console.log('[WatchDialog] Quick clip saved to database');

        // Update project thumbnail if it doesn't have one yet
        if (thumbnailFilePath) {
          const { getProject, updateProject } = await import('@/services/database/projects');
          const project = await getProject(effectiveProjectId);
          if (project && !project.thumbnail_path) {
            await updateProject(effectiveProjectId, undefined, undefined, thumbnailFilePath);
            console.log('[WatchDialog] Set project thumbnail from clip:', thumbnailFilePath);
          }
        }
      } catch (dbErr) {
        console.warn('[WatchDialog] Failed to save clip to database:', dbErr);
      }

      clipsCreatedCount.value++;
      showSuccess('Quick Clip Created', `${QUICK_CLIP_DURATION}s clip saved!`);
      
      // Notify PIP window of success
      emitTo('pip-controls', 'pip-clip-result', { success: true, message: '30s clip saved!' });
      
      emit('clip-created', clipFilePath, effectiveProjectId);
    } catch (err) {
      console.error('[WatchDialog] Quick clip failed:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      showError('Clip Failed', errorMessage);
      
      // Notify PIP window of failure
      emitTo('pip-controls', 'pip-clip-result', { success: false, message: 'Clip failed' });
    } finally {
      isCreatingQuickClip.value = false;
      if (progressUnlisten) {
        progressUnlisten();
      }
    }
  }

  function handleClipCreated(clipPath: string, projectId: string) {
    // Don't close modal — let user see success state with Publish Now / Not Now buttons.
    // Modal closes when user clicks "Not Now" (close) or "Publish Now" (publish-clip).

    // Track the project and clip count for this session
    if (projectId) {
      sessionProjectId.value = projectId;
      clipsCreatedCount.value++;
    }

    emit('clip-created', clipPath, projectId);
  }

  async function handlePublishClip(clipId: string, clipPath: string, projectId: string) {
    // Close the clip selector modal
    showClipModal.value = false;

    // Track the project and clip count for this session
    if (projectId) {
      sessionProjectId.value = projectId;
      clipsCreatedCount.value++;
    }

    // Store clip data for publish workflow
    publishClipData.value = { clipId, clipPath, projectId };

    // Load clip data from database
    try {
      const { getClip } = await import('@/services/database/clips');
      const clip = await getClip(clipId);
      
      if (clip) {
        currentClipForPublish.value = clip;
        // Open build dialog in publish mode
        showBuildDialog.value = true;
      } else {
        showError('Error', 'Failed to load clip data');
      }
    } catch (err) {
      console.error('[WatchDialog] Failed to load clip for publishing:', err);
      showError('Error', 'Failed to load clip data');
    }
  }

  async function handleBuildConfirm(settings: any) {
    // Build settings confirmed, trigger the build process
    console.log('[WatchDialog] Build settings confirmed:', settings);
    
    if (!publishClipData.value || !currentClipForPublish.value) return;

    const clipId = publishClipData.value.clipId;
    const clip = currentClipForPublish.value;
    const projectId = publishClipData.value.projectId;

    try {
      const { createClipBuild, getClipBuilds, updateClipBuildStatus } = await import('@/services/database/clip-build');
      const { getClipSegmentsByVersionId } = await import('@/services/database/clip-segments');
      const { resolveWatermarkById } = await import('@/services/database/watermarks');

      // Update database status to building
      await updateClipBuildStatus(clipId, 'building', { progress: 0 });

      // Calculate build number
      let buildNumber = 1;
      try {
        const existingBuilds = await getClipBuilds(clipId);
        buildNumber = existingBuilds.length + 1;
      } catch { buildNumber = 1; }

      // Create build record
      const buildId = await createClipBuild(clipId, {
        aspectRatios: settings.aspectRatios,
        quality: settings.quality,
        frameRate: settings.frameRate,
        outputFormat: settings.format,
      });

      // Video path: livestream clips have file_path set to the extracted clip
      const videoPath = clip.file_path || publishClipData.value.clipPath;

      // Load segments from DB or create synthetic
      let segments: { id: string; start_time: number; end_time: number; duration: number; transcript: string | null }[] = [];
      if (clip.current_version_id) {
        try {
          const dbSegments = await getClipSegmentsByVersionId(clip.current_version_id);
          if (dbSegments.length > 0) {
            segments = dbSegments.map((s: any) => ({
              id: s.id,
              start_time: s.start_time,
              end_time: s.end_time,
              duration: s.duration,
              transcript: s.transcript,
            }));
          }
        } catch (err) {
          console.warn('[WatchDialog] Could not load segments from DB:', err);
        }
      }

      // Create synthetic segment if none found
      if (segments.length === 0) {
        const startTime = clip.start_time ?? 0;
        const endTime = clip.end_time ?? clip.duration ?? 0;
        if (endTime > startTime) {
          segments = [{
            id: `synthetic-${clipId}`,
            start_time: startTime,
            end_time: endTime,
            duration: endTime - startTime,
            transcript: null,
          }];
        }
      }

      // Resolve watermark settings
      let watermarkSettings = null;
      if (settings.watermark?.enabled && settings.watermark?.watermarkId) {
        const defaultWatermark = await resolveWatermarkById(settings.watermark.watermarkId);
        if (defaultWatermark) {
          const buildPerRatioSettings: Record<string, any> = {};
          const allRatios = ['16:9', '9:16', '1:1', '4:5'];
          for (const ratio of allRatios) {
            const perRatioConfig = settings.watermark.perRatioSettings?.[ratio];
            if (perRatioConfig === null) {
              buildPerRatioSettings[ratio] = null;
            } else if (perRatioConfig) {
              let filePath = defaultWatermark.filePath;
              let width = defaultWatermark.width;
              let height = defaultWatermark.height;
              if (perRatioConfig.watermarkId && perRatioConfig.watermarkId !== settings.watermark.watermarkId) {
                const ratioWm = await resolveWatermarkById(perRatioConfig.watermarkId);
                if (ratioWm) { filePath = ratioWm.filePath; width = ratioWm.width; height = ratioWm.height; }
              }
              buildPerRatioSettings[ratio] = {
                watermarkId: perRatioConfig.watermarkId || settings.watermark.watermarkId,
                filePath, width, height,
                position: perRatioConfig.position || {
                  x: settings.watermark.positionX, y: settings.watermark.positionY,
                  opacity: settings.watermark.opacity, scale: settings.watermark.scale,
                },
              };
            } else {
              buildPerRatioSettings[ratio] = {
                watermarkId: settings.watermark.watermarkId,
                filePath: defaultWatermark.filePath, width: defaultWatermark.width, height: defaultWatermark.height,
                position: {
                  x: settings.watermark.positionX, y: settings.watermark.positionY,
                  opacity: settings.watermark.opacity, scale: settings.watermark.scale,
                },
              };
            }
          }
          watermarkSettings = {
            enabled: true,
            watermarkId: settings.watermark.watermarkId,
            filePath: defaultWatermark.filePath,
            width: defaultWatermark.width,
            height: defaultWatermark.height,
            positionX: settings.watermark.positionX,
            positionY: settings.watermark.positionY,
            opacity: settings.watermark.opacity,
            scale: settings.watermark.scale,
            perRatioSettings: buildPerRatioSettings,
          };
        }
      }

      // Resolve intro/outro paths
      let introPath: string | null = null;
      let introDuration: number | null = null;
      let outroPath: string | null = null;
      let outroDuration: number | null = null;
      if (settings.intro) {
        introPath = settings.intro.file_path || null;
        introDuration = settings.intro.duration || null;
      }
      if (settings.outro) {
        outroPath = settings.outro.file_path || null;
        outroDuration = settings.outro.duration || null;
      }

      // Listen for build completion event from Tauri
      if (buildCompleteUnlisten) { buildCompleteUnlisten(); }
      buildCompleteUnlisten = await listen<{
        clip_id: string;
        success: boolean;
        output_path: string | null;
        thumbnail_path: string | null;
        duration: number | null;
        error: string | null;
      }>('clip-build-complete', (event) => {
        const payload = event.payload;
        if (payload.clip_id !== clipId) return;
        if (buildCompleteUnlisten) { buildCompleteUnlisten(); buildCompleteUnlisten = null; }
        if (payload.success && payload.output_path) {
          handleBuildComplete(payload.output_path, payload.thumbnail_path, payload.duration);
        } else {
          showError('Build Failed', payload.error || 'Clip build failed');
          showBuildDialog.value = false;
        }
      });

      // Start the build via the correct Tauri command
      await invoke('build_clip_from_segments', {
        projectId,
        clipId,
        clipName: clip.current_version_name || clip.name || 'Livestream Clip',
        videoPath,
        segments,
        subtitleSettings: null,
        subtitleOverrides: null,
        transcriptWords: [],
        transcriptSegments: [],
        maxWords: 3,
        aspectRatios: settings.aspectRatios,
        quality: settings.quality,
        frameRate: settings.frameRate,
        outputFormat: settings.format,
        runNumber: clip.run_number || null,
        buildNumber,
        buildId,
        introPath,
        introDuration,
        outroPath,
        outroDuration,
        introOutroPerRatio: null,
        watermarkSettings,
        audioSettings: null,
        framingStrategy: null,
        manualFramingConfigs: settings.manualFramingConfigs || null,
        segmentFramingConfigs: null,
        videoFilterSegments: null,
        textOverlays: null,
        stickers: null,
        clipWatermarks: null,
        clipEffects: null,
        audioEffects: null,
        layoutOverlays: null,
      });

    } catch (err) {
      console.error('[WatchDialog] Failed to start build:', err);
      showError('Build Failed', 'Failed to start the build process');
      showBuildDialog.value = false;
      if (buildCompleteUnlisten) { buildCompleteUnlisten(); buildCompleteUnlisten = null; }
    }
  }

  function handleBuildComplete(outputPath: string, thumbnailPath: string | null, duration: number | null) {
    showBuildDialog.value = false;

    // Get clip info for the schedule dialog
    const clip = currentClipForPublish.value;
    const clipName = clip?.name || clip?.current_version_name || 'Livestream Clip';

    // Open the schedule/publish dialog with the built clip
    scheduleDialogData.value = {
      clipId: publishClipData.value?.clipId || '',
      clipName,
      mediaUrl: outputPath,
      thumbnailUrl: thumbnailPath || undefined,
      duration: duration || undefined,
    };
    showScheduleDialog.value = true;
  }

  function handleScheduleComplete() {
    showScheduleDialog.value = false;
    scheduleDialogData.value = null;
    publishClipData.value = null;
    currentClipForPublish.value = null;
    showSuccess('Scheduled', 'Your clip has been scheduled for publishing!');
  }

  async function handleClose() {
    // Do NOT stop temp HLS recording on close; keep it running so users can return and rewind.
    // Recording will be cleaned up when streamer goes offline or by backend retention.

    // If in PiP mode, exit PiP first, then close properly
    if (document.pictureInPictureElement) {
      try {
        await document.exitPictureInPicture();
      } catch (error) {
        console.warn('[WatchDialog] Error exiting PiP:', error);
      }
      isInPipMode.value = false;
      emit('pip-mode-changed', false);
    }

    // Cleanup global shortcut
    await unregisterGlobalShortcut();

    // Cleanup build listener if active
    if (buildCompleteUnlisten) {
      buildCompleteUnlisten();
      buildCompleteUnlisten = null;
    }

    // Stop playback locally to avoid lingering audio when switching streams
    viewer.pause();

    // Reset session tracking state
    sessionProjectId.value = null;
    clipsCreatedCount.value = 0;

    await viewer.disconnect();
    emit('update:modelValue', false);
    emit('closed'); // Signal that dialog was explicitly closed (not for PIP)
  }

  async function reconnect() {
    await viewer.connect(props.mintId, props.streamerId, props.displayName, props.profileImageUrl, true, props.platform);
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
    // Use our custom Tauri PIP window instead of browser's native PIP
    // This gives us full control over the UI with video + controls attached
    try {
      if (isInPipMode.value) {
        // Exit PIP mode
        await exitPipMode();
      } else {
        // Enter PIP mode - trigger the same flow as browser PIP would
        await handlePipEnter();
      }
    } catch (error) {
      console.warn('[WatchDialog] PiP error:', error);
    }
  }

  // PIP window event listeners
  let pipEventListeners: UnlistenFn[] = [];

  async function setupPipEventListeners() {
    // Listen for state request from PIP window
    pipEventListeners.push(
      await listen('pip-request-state', () => {
        sendPipStateUpdate();
      })
    );

    // Listen for play/pause toggle
    pipEventListeners.push(
      await listen('pip-toggle-play-pause', () => {
        viewer.togglePlayPause();
        sendPipStateUpdate();
      })
    );

    // Listen for mute toggle
    pipEventListeners.push(
      await listen('pip-toggle-mute', () => {
        viewer.toggleMute();
        sendPipStateUpdate();
      })
    );

    // Listen for volume change
    pipEventListeners.push(
      await listen<number>('pip-volume-change', (event) => {
        viewer.setVolume(event.payload);
        sendPipStateUpdate();
      })
    );

    // Listen for clip request - use quick clip (30s) like the Alt+C shortcut
    pipEventListeners.push(
      await listen('pip-create-clip', () => {
        performQuickClip();
      })
    );

    // Listen for close request
    pipEventListeners.push(
      await listen('pip-close', async () => {
        await exitPipMode();
      })
    );
  }

  function cleanupPipEventListeners() {
    pipEventListeners.forEach((unlisten) => unlisten());
    pipEventListeners = [];
  }

  function sendPipStateUpdate() {
    // Build HLS URL from output directory
    // The video server expects base64-encoded directory path (URL_SAFE_NO_PAD)
    let hlsUrl: string | undefined;
    console.log('[WatchDialog] sendPipStateUpdate - hlsOutputDir:', viewer.hlsOutputDir.value);
    
    if (viewer.hlsOutputDir.value) {
      // Base64 encode the directory path - use standard base64 as server expects
      // Note: btoa produces standard base64, we need to URL-encode it for the path
      const base64Dir = btoa(viewer.hlsOutputDir.value);
      hlsUrl = `http://localhost:48276/hls/${base64Dir}/playlist.m3u8`;
      console.log('[WatchDialog] Built HLS URL:', hlsUrl, 'from dir:', viewer.hlsOutputDir.value);
    } else {
      console.warn('[WatchDialog] No hlsOutputDir available for PIP');
    }

    const payload = {
      streamerName: props.displayName,
      isPlaying: viewer.state.value.isPlaying,
      volume: viewer.state.value.volume,
      isMuted: viewer.state.value.isMuted,
      canClip: viewer.state.value.totalRecordedDuration >= 5 && viewer.state.value.availableSegments.length > 0,
      hlsUrl,
    };
    console.log('[WatchDialog] Sending PIP state update:', payload);
    // Send to the PIP window specifically
    emitTo('pip-controls', 'pip-state-update', payload);
  }

  // PiP event handlers
  async function handlePipEnter() {
    console.log('[WatchDialog] Entered PiP mode');
    isInPipMode.value = true;
    emit('pip-mode-changed', true);
    // When entering PiP, close the dialog but keep the stream alive
    closingForPip.value = true;
    emit('update:modelValue', false);
    // Setup global key listener for quick clipping
    registerGlobalShortcut();

    // Mute the main window's video element directly to prevent audio echo
    // Don't pause - HLS needs to keep running to maintain live position
    if (hlsVideoRef.value) {
      hlsVideoRef.value.muted = true;
    }

    // Open the always-on-top PIP control window
    try {
      await setupPipEventListeners();
      await invoke('create_pip_control_window');
      // Send initial state after a short delay to ensure window is ready
      setTimeout(() => sendPipStateUpdate(), 500);
    } catch (error) {
      console.warn('[WatchDialog] Failed to create PIP control window:', error);
    }
  }

  // Exit PIP mode programmatically
  async function exitPipMode() {
    // Close our custom Tauri PIP window
    cleanupPipEventListeners();
    try {
      await invoke('close_pip_control_window');
    } catch (error) {
      console.warn('[WatchDialog] Error closing PIP window:', error);
    }

    // Trigger the leave handler
    await handlePipLeave();
  }

  async function handlePipLeave() {
    console.log('[WatchDialog] Left PiP mode');
    
    // Update state
    isInPipMode.value = false;
    closingForPip.value = false;
    
    // Restore the main window's video element mute state from viewer state
    if (hlsVideoRef.value) {
      hlsVideoRef.value.muted = viewer.state.value.isMuted;
    }
    
    // Re-open the dialog when leaving PiP
    emit('update:modelValue', true);
    
    // Wait for dialog to open and state to sync before updating external state
    await nextTick();
    emit('pip-mode-changed', false);
    
    // Cleanup global key listener
    await unregisterGlobalShortcut();

    // Bring main window to front
    const win = getCurrentWindow();
    await win.unminimize();
    await win.setFocus();
    await win.requestUserAttention(UserAttentionType.Critical);
  }

  // Register the Alt+C global shortcut
  async function registerGlobalShortcut() {
    try {
      if (await isRegistered(GLOBAL_SHORTCUT)) {
        console.warn(`[WatchDialog] Shortcut ${GLOBAL_SHORTCUT} already registered.`);
        return;
      }
      await register(GLOBAL_SHORTCUT, performQuickClip);
      globalShortcutRegistered.value = true;
      console.log(`[WatchDialog] Global shortcut ${GLOBAL_SHORTCUT} registered.`);
    } catch (err) {
      console.error(`[WatchDialog] Failed to register global shortcut ${GLOBAL_SHORTCUT}:`, err);
      showError('Shortcut Failed', `Could not register ${GLOBAL_SHORTCUT}. It might be in use by another application.`);
    }
  }

  // Unregister the global shortcut
  async function unregisterGlobalShortcut() {
    try {
      if (await isRegistered(GLOBAL_SHORTCUT)) {
        await unregister(GLOBAL_SHORTCUT);
        console.log(`[WatchDialog] Global shortcut ${GLOBAL_SHORTCUT} unregistered.`);
      }
    } catch (err) {
      console.error(`[WatchDialog] Failed to unregister global shortcut ${GLOBAL_SHORTCUT}:`, err);
    }
    globalShortcutRegistered.value = false;
  }

  // Setup PiP event listeners on video element
  function setupPipListeners(video: HTMLVideoElement) {
    if (pipListenersSetup.value) return; // Prevent duplicate listeners
    video.addEventListener('enterpictureinpicture', handlePipEnter);
    video.addEventListener('leavepictureinpicture', handlePipLeave);
    pipListenersSetup.value = true;
  }

  function cleanupPipListeners(video: HTMLVideoElement) {
    video.removeEventListener('enterpictureinpicture', handlePipEnter);
    video.removeEventListener('leavepictureinpicture', handlePipLeave);
    pipListenersSetup.value = false;
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
        // Quick clip (30s) without dialog
        performQuickClip();
        break;
      case 'l':
        event.preventDefault();
        handleSeekToLive();
        break;
      case 'arrowleft':
        event.preventDefault();
        viewer.seek(Math.max(0, viewer.state.value.playbackPosition - 10));
        break;
      case 'arrowright':
        event.preventDefault();
        viewer.seek(Math.min(viewer.state.value.totalRecordedDuration, viewer.state.value.playbackPosition + 10));
        break;
      case 'escape':
        event.preventDefault();
        if (isFullscreen.value) {
          toggleFullscreen();
        } else {
          handleClose();
        }
        break;
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
      if (isOpen) {
        // Reset closingForPip flag
        closingForPip.value = false;

        // Reset session tracking state when opening dialog (but not if returning from PiP)
        if (!isInPipMode.value) {
          sessionProjectId.value = null;
          clipsCreatedCount.value = 0;
        }

        // Connect when dialog opens (skip if already connected from PiP mode)
        await nextTick();

        // Set video elements first
        if (liveVideoRef.value) {
          viewer.setVideoElement(liveVideoRef.value);
        }
        if (hlsVideoRef.value) {
          viewer.setHlsVideoElement(hlsVideoRef.value);
          // Setup PiP listeners
          setupPipListeners(hlsVideoRef.value);
        }

        // Only connect if not already connected (e.g., returning from PiP)
        if (viewer.state.value.connectionState !== 'connected') {
          // Connect to livestream
          try {
            await viewer.connect(props.mintId, props.streamerId, props.displayName, props.profileImageUrl, true, props.platform);

            // Load watermark from creator profile after connection
            await loadWatermark();
          } catch (error) {
            console.error('[WatchDialog] Connect failed:', error);
          }

          // After connection, ensure video elements are set
          await nextTick();
          if (liveVideoRef.value) {
            viewer.setVideoElement(liveVideoRef.value);
          }
          if (hlsVideoRef.value) {
            viewer.setHlsVideoElement(hlsVideoRef.value);
          }
        }

        // Focus dialog for keyboard events
        dialogRef.value?.focus();

        // If returning from PiP, ensure video continues playing
        if (isInPipMode.value) {
          const video = hlsVideoRef.value;
          if (video && video.paused) {
            video.play().catch(() => {});
          }
        }

        // Reset PiP mode flag after dialog reopens
        isInPipMode.value = false;
      } else {
        // Don't disconnect if closing for PiP mode - keep stream running
        if (!closingForPip.value && !isInPipMode.value) {
          viewer.disconnect();
        }
      }
    },
    { immediate: true }
  );

  // Watch for watermark changes
  watch(
    () => viewer.state.value.watermarkId,
    () => {
      loadWatermark();
    },
    { immediate: true }
  );

  // Track if we've already shown the offline toast to avoid spam
  const hasShownOfflineToast = ref(false);

  // Watch for stream going offline - show toast instead of blocking overlay when DVR is available
  watch(
    () => viewer.state.value.connectionState,
    (newState, oldState) => {
      if (newState === 'failed' && oldState === 'connected') {
        // Stream went offline
        if (viewer.state.value.availableSegments.length > 0 && !hasShownOfflineToast.value) {
          // DVR content available - show toast and allow continued playback
          showError('Stream went offline. You can continue watching the recorded content.');
          hasShownOfflineToast.value = true;
        }
      } else if (newState === 'connected') {
        // Reset toast flag when reconnected
        hasShownOfflineToast.value = false;
      }
    }
  );

  // Lifecycle
  onMounted(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
  });

  async function loadWatermarkDimensions(dataUrl: string) {
    return new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        watermarkDimensions.value = { width: img.naturalWidth, height: img.naturalHeight };
        resolve();
      };
      img.onerror = () => {
        watermarkDimensions.value = null;
        resolve();
      };
      img.src = dataUrl;
    });
  }

  onUnmounted(async () => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    // Clean up PiP listeners
    if (hlsVideoRef.value) {
      cleanupPipListeners(hlsVideoRef.value);
    }
    // Clean up global key listener and shortcut
    await unregisterGlobalShortcut();

    // Exit PiP if active when component unmounts
    if (document.pictureInPictureElement) {
      document.exitPictureInPicture().catch(() => {});
    }
    // Ensure we disconnect when component unmounts
    viewer.disconnect();
  });

  // Watch for external PiP mode changes (from global store)
  watch(
    () => props.isPipModeExternal,
    (isPip) => {
      if (isPip && !isInPipMode.value) {
        // External state says we're in PiP but local state doesn't - sync it
        isInPipMode.value = true;
        registerGlobalShortcut();
      } else if (!isPip && isInPipMode.value) {
        // External state says we're not in PiP - sync and cleanup
        isInPipMode.value = false;
        unregisterGlobalShortcut();
      }
    }
  );
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
