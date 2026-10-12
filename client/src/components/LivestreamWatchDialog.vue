<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-active-class="transition-opacity duration-200"
      leave-to-class="opacity-0"
    >
      <!-- Keep component alive during PiP mode to maintain video element -->
      <div
        v-if="modelValue || isInPipMode || props.isPipModeExternal"
        :class="[
          'fixed inset-0 z-[10040] flex items-center justify-center bg-[var(--overlay)] backdrop-blur-sm outline-none',
          // Hide dialog visually when in PiP mode but keep video element alive
          (isInPipMode || props.isPipModeExternal) && !modelValue ? 'pointer-events-none opacity-0' : '',
        ]"
        @keydown="handleKeydown"
        tabindex="0"
        ref="dialogRef"
      >
        <Transition
          appear
          enter-active-class="transition duration-200 ease-out"
          enter-from-class="scale-[0.97] opacity-0"
          leave-active-class="transition duration-150"
          leave-to-class="scale-[0.97] opacity-0"
        >
          <div
            ref="containerRef"
            :class="[
              'relative overflow-hidden bg-black transition-all duration-300',
              isFullscreen
                ? 'h-screen w-screen rounded-none'
                : 'mx-4 max-h-[90vh] w-full max-w-6xl rounded-[var(--radius-modal)] shadow-[var(--shadow-lg)]',
            ]"
          >
            <!-- Header bar (auto-hides with the controls) -->
            <div
              :class="[
                'absolute top-0 right-0 left-0 z-30 transition-all duration-300 ease-in-out',
                showControls ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-full opacity-0',
              ]"
              @click.stop
            >
              <div class="bg-gradient-to-b from-black/80 to-transparent px-4 pt-3.5 pb-8">
                <div class="flex items-center justify-between gap-3">
                  <!-- Streamer info -->
                  <div class="flex min-w-0 items-center gap-3">
                    <div class="relative shrink-0">
                      <Avatar
                        :src="streamerInfo.profileImageUrl"
                        :name="streamerInfo.displayName"
                        size="md"
                        class="ring-2 ring-live"
                      />
                      <span
                        v-if="viewer.isLive.value"
                        class="absolute -right-0.5 -bottom-0.5 size-3 animate-pulse rounded-full border-2 border-black bg-live"
                      />
                    </div>
                    <div class="min-w-0">
                      <h3 class="truncate text-sm font-semibold text-white">{{ streamerInfo.displayName }}</h3>
                      <div class="flex items-center gap-1 text-xs text-white/60">
                        <Users class="size-3" />
                        <span class="tabular">{{ viewer.state.value.viewerCount }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Right side actions -->
                  <div class="flex shrink-0 items-center gap-1.5">
                    <button
                      v-if="viewer.state.value.streamQuality"
                      type="button"
                      :class="mediaChipClass"
                      title="Stream stats"
                      @click="showStatsPopup = !showStatsPopup"
                    >
                      <Signal class="size-3" :class="connectionQualityColor" />
                      {{ viewer.state.value.streamQuality }}
                    </button>
                    <button type="button" :class="mediaIconButtonClass" title="Close" aria-label="Close" @click="handleClose">
                      <X class="size-[18px]" />
                    </button>
                  </div>
                </div>
              </div>

              <!-- Stats popup -->
              <div
                v-if="showStatsPopup"
                class="absolute top-14 right-4 flex min-w-[220px] flex-col gap-1.5 rounded-lg bg-surface-raised p-3 text-xs shadow-[var(--shadow-md)]"
              >
                <div class="flex justify-between gap-4">
                  <span class="text-fg-muted">Resolution</span>
                  <span class="text-fg">{{ viewer.state.value.streamQuality || 'Unknown' }}</span>
                </div>
                <div class="flex justify-between gap-4">
                  <span class="text-fg-muted">Playback mode</span>
                  <span :class="viewer.state.value.playbackMode === 'webrtc' ? 'text-success' : 'text-fg'">
                    {{ playbackModeDisplay }}
                  </span>
                </div>
                <div class="flex justify-between gap-4">
                  <span class="text-fg-muted">Connection</span>
                  <span :class="connectionStatusTextColor">{{ connectionStatusText }}</span>
                </div>
                <div class="flex justify-between gap-4">
                  <span class="text-fg-muted">Recorded</span>
                  <span class="tabular text-fg">{{ formatTime(viewer.state.value.totalRecordedDuration) }}</span>
                </div>
                <div class="flex justify-between gap-4">
                  <span class="text-fg-muted">At live edge</span>
                  <span :class="viewer.state.value.isAtLiveEdge ? 'text-success' : 'text-warning'">
                    {{ viewer.state.value.isAtLiveEdge ? 'Yes' : 'No' }}
                  </span>
                </div>
              </div>
            </div>

            <!-- Video container -->
            <div
              ref="videoContainerRef"
              class="relative aspect-video w-full bg-black"
              @mousemove="handleMouseMove"
              @mouseleave="handleMouseLeave"
              @click="handleVideoClick"
            >
              <!-- HLS Video Playback (always visible - HLS-only mode) -->
              <video
                ref="hlsVideoRef"
                class="h-full w-full object-contain"
                playsinline
                :muted="viewer.state.value.isMuted"
              />

              <!-- Hidden WebRTC video element (needed for track reception, not displayed) -->
              <video ref="liveVideoRef" class="hidden" playsinline autoplay muted />

              <!-- Watermark Overlay -->
              <div
                v-if="showWatermark && watermarkUrl"
                class="pointer-events-none absolute inset-0 z-10"
                :style="watermarkStyle"
              >
                <img :src="watermarkUrl" alt="Watermark" class="h-full w-full object-contain" />
              </div>

              <!-- Buffering Indicator (HLS loading or buffering) -->
              <div
                v-if="viewer.state.value.isBuffering && viewer.state.value.connectionState === 'connected'"
                class="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
              >
                <div class="flex flex-col items-center gap-3">
                  <Loader2 class="size-10 animate-spin text-white/80" />
                  <span class="text-sm font-medium text-white">
                    {{ viewer.state.value.totalRecordedDuration < 12 ? 'Building buffer…' : 'Buffering…' }}
                  </span>
                </div>
              </div>

              <!-- Connection Status Overlays -->
              <div
                v-if="viewer.state.value.connectionState === 'connecting'"
                class="absolute inset-0 z-20 flex items-center justify-center bg-black/80"
              >
                <div class="flex flex-col items-center gap-2">
                  <Loader2 class="mb-1 size-10 animate-spin text-white/80" />
                  <span class="text-sm font-medium text-white">Connecting to stream…</span>
                  <span class="text-xs text-white/60">{{ props.displayName }}</span>
                </div>
              </div>

              <div
                v-if="viewer.state.value.connectionState === 'reconnecting'"
                class="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
              >
                <div class="flex flex-col items-center gap-3">
                  <WifiOff class="size-10 animate-pulse text-warning" />
                  <span class="text-sm text-white">Reconnecting…</span>
                </div>
              </div>

              <!-- Only show connection failed overlay if NO DVR content is available -->
              <!-- If DVR content exists, user can continue watching the recorded stream -->
              <div
                v-if="viewer.state.value.connectionState === 'failed' && viewer.state.value.availableSegments.length === 0"
                class="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
              >
                <div class="flex flex-col items-center gap-3">
                  <AlertCircle class="size-10 text-danger" />
                  <span class="max-w-xs text-center text-sm text-white">
                    {{ viewer.state.value.connectionError || 'Connection failed' }}
                  </span>
                  <Button variant="primary" size="sm" @click="reconnect">Retry</Button>
                </div>
              </div>

              <!-- Play overlay when paused -->
              <div
                v-if="
                  !viewer.state.value.isPlaying &&
                  viewer.state.value.connectionState === 'connected' &&
                  !viewer.state.value.isBuffering
                "
                class="absolute inset-0 z-[15] flex cursor-pointer items-center justify-center bg-black/40"
                @click.stop="viewer.play"
              >
                <div class="grid size-16 place-items-center rounded-full bg-white/15 backdrop-blur-sm">
                  <Play class="ml-1 size-8 text-white" />
                </div>
              </div>

              <!-- Controls Overlay -->
              <div
                :class="[
                  'absolute right-0 bottom-0 left-0 z-30 transition-all duration-300 ease-in-out',
                  showControls || !viewer.state.value.isPlaying
                    ? 'translate-y-0 opacity-100'
                    : 'pointer-events-none translate-y-full opacity-0',
                ]"
                @click.stop
              >
                <div class="bg-gradient-to-t from-black/90 via-black/60 to-transparent px-4 pt-14 pb-3">
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
                  <div class="mt-2.5 flex items-center justify-between">
                    <!-- Left Controls -->
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        :class="mediaIconButtonClass"
                        :title="viewer.state.value.isPlaying ? 'Pause' : 'Play'"
                        @click="viewer.togglePlayPause"
                      >
                        <Pause v-if="viewer.state.value.isPlaying" class="size-5" />
                        <Play v-else class="size-5" />
                      </button>

                      <!-- Volume -->
                      <div class="group flex items-center gap-1.5">
                        <button
                          type="button"
                          :class="mediaIconButtonClass"
                          :title="viewer.state.value.isMuted ? 'Unmute' : 'Mute'"
                          @click="viewer.toggleMute"
                        >
                          <VolumeX
                            v-if="viewer.state.value.isMuted || viewer.state.value.volume === 0"
                            class="size-[18px]"
                          />
                          <Volume1 v-else-if="viewer.state.value.volume < 0.5" class="size-[18px]" />
                          <Volume2 v-else class="size-[18px]" />
                        </button>
                        <div class="w-0 overflow-hidden transition-all duration-200 group-hover:w-24">
                          <MediaVolumeSlider
                            :value="viewer.state.value.volume"
                            step="0.01"
                            class="w-24"
                            @input="handleVolumeChange"
                          />
                        </div>
                      </div>
                    </div>

                    <!-- Right Controls -->
                    <div class="flex items-center gap-1">
                      <Button
                        variant="primary"
                        size="sm"
                        class="mr-1"
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
                        @click="openClipModal"
                      >
                        <Scissors />
                        Clip
                      </Button>

                      <button
                        v-if="isPipSupported"
                        type="button"
                        :class="mediaIconButtonClass"
                        title="Picture-in-picture (P)"
                        @click="togglePip"
                      >
                        <PictureInPicture2 class="size-[18px]" />
                      </button>

                      <button
                        type="button"
                        :class="mediaIconButtonClass"
                        :title="isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'"
                        @click="toggleFullscreen"
                      >
                        <Minimize v-if="isFullscreen" class="size-[18px]" />
                        <Maximize v-else class="size-[18px]" />
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

            <!-- Quick Publish Wizard (unified build + publish flow) -->
            <QuickPublishWizard
              v-if="publishClipData && currentClipForPublish"
              :show="showQuickPublishWizard"
              :clip="currentClipForPublish"
              :clip-path="publishClipData.clipPath"
              :project-id="publishClipData.projectId"
              :watermark-settings="(viewer.state.value.watermarkSettings as any) || null"
              :thumbnail-url="publishClipThumbnailPath || currentClipForPublish.thumbnail_path || null"
              :platform="props.platform"
              :creator-profile-server-id="null"
              @published="handlePublishComplete"
              @close="handleQuickPublishClose"
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
  import MediaVolumeSlider from './streams/MediaVolumeSlider.vue';
  import { Avatar } from '@/components/ui/avatar';
  import { Button } from '@/components/ui/button';
  import LivestreamClipSelector from './LivestreamClipSelector.vue';
  import QuickPublishWizard from './QuickPublishWizard.vue';
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
    platform?: 'PumpFun' | 'Kick' | 'Twitch' | 'YouTube' | 'Rumble' | 'Twitter' | 'Tokend';
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
  const showQuickPublishWizard = ref(false);
  const publishClipData = ref<{ clipId: string; clipPath: string; projectId: string } | null>(null);
  const currentClipForPublish = ref<any>(null);
  const publishClipThumbnailPath = ref<string | null>(null);

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
      ? 'text-success'
      : state === 'reconnecting'
        ? 'text-warning'
        : state === 'failed'
          ? 'text-danger'
          : 'text-fg-muted';
  });

  const connectionQualityColor = computed(() => {
    const latency = viewer.state.value.latencyMs;
    if (!latency) return 'text-white/60';
    if (latency < 1000) return 'text-success';
    if (latency < 2000) return 'text-warning';
    return 'text-danger';
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

  // Translucent controls drawn over the video.
  const mediaIconButtonClass =
    'grid size-9 place-items-center rounded-lg text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)]';
  const mediaChipClass =
    'inline-flex h-7 items-center gap-1.5 rounded-md bg-white/10 px-2 text-xs font-medium text-white/90 transition-colors hover:bg-white/20';

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

    // Snapshot the frozen segments: take the 3 minutes ending at the current playhead position
    const allSegments = viewer.state.value.availableSegments;
    const playheadPosition = viewer.state.value.playbackPosition;
    const maxClipWindow = 180; // 3 minutes

    // Use the playhead position as the end of the clip window (not the live edge)
    const windowEnd = playheadPosition;
    const windowStart = Math.max(0, windowEnd - maxClipWindow);
    const windowDuration = windowEnd - windowStart;

    if (windowDuration > 0) {
      // Filter to segments that overlap with the window around the playhead
      const relevantSegments = allSegments.filter((s: SegmentInfo) => s.endTime > windowStart && s.startTime < windowEnd);

      // Re-base segment times to start from 0 within the window
      frozenSegments.value = relevantSegments.map((s: SegmentInfo) => ({
        ...s,
        startTime: Math.max(0, s.startTime - windowStart),
        endTime: Math.min(windowDuration, s.endTime - windowStart),
      }));
      frozenClipDuration.value = windowDuration;
    } else {
      // No valid window, use all segments as-is
      frozenSegments.value = [...allSegments];
      frozenClipDuration.value = viewer.state.value.totalRecordedDuration;
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
        const clipId = await createClipRecord(effectiveProjectId, clipFilePath, {
          name: clipName,
          duration: QUICK_CLIP_DURATION,
          startTime: clipStartTime,
          endTime: clipEndTime,
          thumbnailPath: thumbnailFilePath || undefined,
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

  async function handlePublishClip(clipId: string, clipPath: string, projectId: string, thumbnailPath: string | null = null) {
    publishClipThumbnailPath.value = thumbnailPath;
    console.log('[WatchDialog] handlePublishClip called:', { clipId, clipPath, projectId });
    
    // Close the clip selector modal
    showClipModal.value = false;

    // Track the project and clip count for this session
    if (projectId) {
      sessionProjectId.value = projectId;
      clipsCreatedCount.value++;
    }

    // Store clip data for publish workflow
    publishClipData.value = { clipId, clipPath, projectId };
    console.log('[WatchDialog] publishClipData set:', publishClipData.value);

    // Load clip data from database
    try {
      const { getClip } = await import('@/services/database/clips');
      const clip = await getClip(clipId);
      console.log('[WatchDialog] Loaded clip from database:', clip);
      
      if (clip) {
        currentClipForPublish.value = clip;
        console.log('[WatchDialog] currentClipForPublish set:', currentClipForPublish.value);
        // Open the unified QuickPublishWizard
        showQuickPublishWizard.value = true;
        console.log('[WatchDialog] showQuickPublishWizard set to true');
      } else {
        console.error('[WatchDialog] Clip not found in database');
        showError('Error', 'Failed to load clip data');
      }
    } catch (err) {
      console.error('[WatchDialog] Failed to load clip for publishing:', err);
      showError('Error', 'Failed to load clip data');
    }
  }

  function handlePublishComplete() {
    // Publishing was initiated (dialog closes immediately, publish happens in background)
    showSuccess('Publishing', 'Your clip is being published in the background');
    handleQuickPublishClose();
  }

  function handleQuickPublishClose() {
    showQuickPublishWizard.value = false;
    publishClipData.value = null;
    currentClipForPublish.value = null;
    publishClipThumbnailPath.value = null;
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

    // Listen for play/pause from PIP (PIP applies playback locally; main syncs state)
    pipEventListeners.push(
      await listen<{ playing: boolean }>('pip-set-play-state', async (event) => {
        if (event.payload.playing) {
          await viewer.play();
        } else {
          viewer.pause();
        }
        sendPipStateUpdate();
      })
    );

    // Legacy event — keep for older PIP builds
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
