<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="!hidden" class="clip-selector__overlay" @click.self="() => handleClose(true)">
        <Transition name="dialog" appear>
          <div v-if="!hidden" class="clip-selector" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="clip-selector__accent"></div>

            <!-- Header -->
            <div class="clip-selector__header">
              <button class="clip-selector__close" @click="handleClose(true)" :disabled="isCreating" title="Close">
                <X :size="18" />
              </button>
              <div class="clip-selector__icon">
                <Scissors :size="24" />
              </div>
              <h2 class="clip-selector__title">Create Clip</h2>
              <p class="clip-selector__subtitle">Select a range from the last {{ formatTime(maxDuration) }}</p>
            </div>

            <!-- Content -->
            <div class="clip-selector__content">
              <!-- Progress State -->
              <div v-if="isCreating" class="clip-selector__state-panel">
                <div class="clip-selector__progress-ring">
                  <svg class="clip-selector__progress-svg">
                    <circle cx="32" cy="32" r="28" stroke-width="6" stroke="var(--sidebar-hover)" fill="none" />
                    <circle
                      cx="32" cy="32" r="28" stroke-width="6"
                      stroke="var(--sidebar-accent)" fill="none"
                      :stroke-dasharray="176"
                      :stroke-dashoffset="176 - (176 * progress) / 100"
                      stroke-linecap="round"
                      class="clip-selector__progress-circle"
                    />
                  </svg>
                  <div class="clip-selector__progress-text">{{ Math.round(progress) }}%</div>
                </div>
                <p class="clip-selector__state-title">Creating clip...</p>
                <p class="clip-selector__state-subtitle">{{ progressMessage }}</p>
              </div>

              <!-- Success State -->
              <div v-else-if="clipCreated" class="clip-selector__state-panel">
                <div class="clip-selector__success-icon">
                  <Check :size="32" />
                </div>
                <p class="clip-selector__state-title">Clip created successfully!</p>
                <p class="clip-selector__state-subtitle">{{ clipName }}</p>
              </div>

              <!-- Error State -->
              <div v-else-if="error" class="clip-selector__state-panel">
                <div class="clip-selector__error-icon">
                  <AlertCircle :size="32" />
                </div>
                <p class="clip-selector__state-title">Failed to create clip</p>
                <p class="clip-selector__state-subtitle clip-selector__state-subtitle--error">{{ error }}</p>
                <button @click="resetState" class="clip-selector__btn clip-selector__btn--secondary" style="margin-top: 1rem;">
                  Try Again
                </button>
              </div>

              <!-- Selection State -->
              <template v-else>
                <!-- Video Preview -->
                <div class="clip-selector__preview" @click="togglePlayPause">
                  <video
                    ref="previewVideoRef"
                    class="clip-selector__video"
                    @timeupdate="onVideoTimeUpdate"
                    @ended="onVideoEnded"
                  />
                  <!-- Play/Pause overlay -->
                  <div class="clip-selector__play-overlay" :class="{ 'clip-selector__play-overlay--playing': isPreviewPlaying }">
                    <div class="clip-selector__play-btn">
                      <Play v-if="!isPreviewPlaying" :size="24" style="margin-left: 2px;" />
                      <Pause v-else :size="24" />
                    </div>
                  </div>
                  <!-- Loading indicator -->
                  <div v-if="isLoadingPreview" class="clip-selector__loading">
                    <svg class="clip-selector__spinner" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
                    Loading preview...
                  </div>
                  <!-- Time badge -->
                  <div class="clip-selector__time-badge">
                    {{ formatTime(currentPlaybackTime) }} / {{ formatTime(maxDuration) }}
                  </div>
                </div>

                <!-- Clip Name -->
                <div class="clip-selector__field">
                  <input
                    v-model="clipName"
                    type="text"
                    :placeholder="defaultClipName"
                    maxlength="50"
                    class="clip-selector__input"
                  />
                  <div class="clip-selector__char-count">{{ clipName.length }}/50</div>
                </div>

                <!-- Timeline -->
                <div class="clip-selector__field">
                  <div
                    ref="timelineRef"
                    class="clip-selector__timeline"
                    @mousedown="handleTimelineMouseDown"
                    @mousemove="handleTimelineMouseMove"
                    @mouseleave="isTimelineHovering = false"
                    @mouseenter="isTimelineHovering = true"
                  >
                    <!-- Selected Range -->
                    <div
                      class="clip-selector__range"
                      :style="{ left: `${startPercentage}%`, width: `${endPercentage - startPercentage}%` }"
                    />
                    <!-- Start Handle -->
                    <div
                      class="clip-selector__handle"
                      :style="{ left: `calc(${startPercentage}% - 6px)` }"
                      @mousedown.stop="handleStartHandleMouseDown"
                    ><div class="clip-selector__handle-grip" /></div>
                    <!-- End Handle -->
                    <div
                      class="clip-selector__handle"
                      :style="{ left: `calc(${endPercentage}% - 6px)` }"
                      @mousedown.stop="handleEndHandleMouseDown"
                    ><div class="clip-selector__handle-grip" /></div>
                    <!-- Playhead -->
                    <div class="clip-selector__playhead" :style="{ left: `${playheadPercentage}%` }" />
                    <!-- Hover indicator -->
                    <div
                      v-if="isTimelineHovering && !isDragging"
                      class="clip-selector__hover-line"
                      :style="{ left: `${hoverPercentage}%` }"
                    />
                  </div>
                  <!-- Time Labels -->
                  <div class="clip-selector__time-labels">
                    <span>{{ formatTime(startTime) }}</span>
                    <span class="clip-selector__duration-label">{{ formatTime(endTime - startTime) }}</span>
                    <span>{{ formatTime(endTime) }}</span>
                  </div>
                  <div class="clip-selector__range-info">0:00 - {{ formatTime(maxDuration) }}</div>
                </div>

                <!-- Presets -->
                <div class="clip-selector__presets">
                  <button
                    v-for="preset in [30, 60, 90]"
                    :key="preset"
                    @click="applyPreset(preset)"
                    :disabled="preset > maxDuration"
                    class="clip-selector__preset-btn"
                  >
                    {{ preset }}s
                  </button>
                </div>
              </template>
            </div>

            <!-- Footer -->
            <div class="clip-selector__footer">
              <template v-if="clipCreated">
                <button @click="() => handleClose()" class="clip-selector__btn clip-selector__btn--secondary">
                  Not Now
                </button>
                <button @click="handlePublishNow" class="clip-selector__btn clip-selector__btn--primary">
                  <Share2 :size="16" />
                  Publish Now
                </button>
              </template>
              <template v-else-if="!isCreating && !error">
                <button @click="() => handleClose()" class="clip-selector__btn clip-selector__btn--secondary">
                  Cancel
                </button>
                <button
                  @click="handleCreateClip"
                  :disabled="!isValidSelection"
                  class="clip-selector__btn clip-selector__btn--primary"
                >
                  <Scissors :size="16" />
                  Clip
                </button>
              </template>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import { formatTime as formatTimeUtil } from '@/utils/dateTimeUtils';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { Scissors, X, Check, AlertCircle, Share2, Play, Pause } from 'lucide-vue-next';
  import { createLivestreamClipProject, createClip as createClipRecord } from '@/services/database';
  import { createClipVersion } from '@/services/database/clip-versions';
  import { updateClip } from '@/services/database/clips';
  import { getOrCreateManualSession } from '@/services/database/clip-detection-sessions';
  import { useLivestreamStore } from '@/stores/livestream';
  import { useToast } from '@/composables/useToast';
  import Hls from 'hls.js';
  import { TauriHlsLoader, getTauriHlsUrl } from '@/composables/useTauriHlsLoader';

  interface SegmentInfo {
    segmentNumber: number;
    filePath: string;
    startTime: number;
    duration: number;
    endTime: number;
  }

  interface Props {
    availableDuration: number;
    projectId: string | null;
    sessionId: string | null;
    tempSessionId?: string | null;
    playbackPosition: number;
    watermarkSettings?: Record<string, any> | null;
    watermarkId?: string | null;
    segments: SegmentInfo[];
    displayName?: string;
    mintId?: string;
    isTempRecording?: boolean;
    streamerId?: string;
    platform?: 'PumpFun' | 'Kick' | 'YouTube' | 'Twitch' | 'Rumble' | 'Twitter' | 'Manual';
    hlsOutputDir?: string | null;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'clip-created', clipPath: string, projectId: string): void;
    (e: 'publish-clip', clipId: string, clipPath: string, projectId: string): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const livestreamStore = useLivestreamStore();

  // State
  const hidden = ref(false);
  const clipName = ref('');
  const isCreating = ref(false);
  const progress = ref(0);
  const progressMessage = ref('Preparing...');
  const clipCreated = ref(false);
  const createdClipPath = ref<string | null>(null);
  const createdClipId = ref<string | null>(null);
  const createdProjectId = ref<string | null>(null);
  const error = ref<string | null>(null);

  // Timeline interaction state
  const timelineRef = ref<HTMLDivElement | null>(null);
  const previewVideoRef = ref<HTMLVideoElement | null>(null);
  const isTimelineHovering = ref(false);
  const isDragging = ref(false);
  const dragTarget = ref<'start' | 'end' | null>(null);
  const hoverPercentage = ref(0);

  // VOD preview playback state
  const isPreviewPlaying = ref(false);
  const isLoadingPreview = ref(true);
  const currentPlaybackTime = ref(0);
  const vodPlaylistPath = ref<string | null>(null);
  let hlsInstance: Hls | null = null;

  // Clip selection (in seconds from start of the 3-minute window)
  // These will be initialized in onMounted to default to the last 30 seconds
  const startTime = ref(0);
  const endTime = ref(30);

  // Max duration (3 minutes or available duration, whichever is less)
  const maxDuration = computed(() => Math.min(180, props.availableDuration));

  // Computed
  const defaultClipName = computed(() => {
    const timestamp = formatTimeUtil(new Date()).replace(/:/g, '-').replace(/\s*(AM|PM)/i, '');
    return `Clip - ${timestamp}`;
  });

  const startPercentage = computed(() => {
    if (maxDuration.value <= 0) return 0;
    return (startTime.value / maxDuration.value) * 100;
  });

  const endPercentage = computed(() => {
    if (maxDuration.value <= 0) return 100;
    return (endTime.value / maxDuration.value) * 100;
  });

  const playheadPercentage = computed(() => {
    if (maxDuration.value <= 0) return 0;
    return (currentPlaybackTime.value / maxDuration.value) * 100;
  });

  const isValidSelection = computed(() => {
    return endTime.value > startTime.value && endTime.value <= maxDuration.value;
  });

  // Initialize end time based on available duration
  watch(
    () => maxDuration.value,
    (newMax) => {
      if (endTime.value > newMax) {
        endTime.value = Math.min(30, newMax);
      }
      if (startTime.value >= endTime.value) {
        startTime.value = Math.max(0, endTime.value - 30);
      }
    },
    { immediate: true }
  );

  // Initialize VOD preview playback
  onMounted(async () => {
    // Safety check: ensure availableDuration is a valid number
    if (!props.availableDuration || !isFinite(props.availableDuration) || props.availableDuration <= 0) {
      console.warn('[ClipSelector] Invalid availableDuration:', props.availableDuration);
      isLoadingPreview.value = false;
      return;
    }

    // Initialize selection to the LAST 30 seconds of available buffer
    const availableDur = maxDuration.value;
    if (availableDur > 30) {
      startTime.value = availableDur - 30;
      endTime.value = availableDur;
    } else {
      startTime.value = 0;
      endTime.value = Math.max(0, availableDur);
    }

    // Create VOD playlist and initialize HLS playback
    await initializeVodPlayback();
  });

  async function initializeVodPlayback() {
    if (!props.hlsOutputDir || !props.segments || props.segments.length === 0) {
      console.warn('[ClipSelector] No hlsOutputDir or segments for VOD playback');
      isLoadingPreview.value = false;
      return;
    }

    try {
      // Build segment list for VOD playlist (extract filenames from full paths)
      const vodSegments = props.segments.map((seg) => {
        const filename = seg.filePath.split(/[/\\]/).pop() || '';
        return { filename, duration: seg.duration };
      });

      // Create static VOD playlist via Tauri
      const playlistFilename = 'clip_preview.m3u8';
      const playlistPath = await invoke<string>('create_vod_playlist', {
        outputDir: props.hlsOutputDir,
        segments: vodSegments,
        filename: playlistFilename,
      });
      vodPlaylistPath.value = playlistPath;

      console.log('[ClipSelector] VOD playlist created:', playlistPath, `(${vodSegments.length} segments)`);

      // Initialize hls.js in VOD mode
      if (!previewVideoRef.value) {
        console.warn('[ClipSelector] No video element available');
        isLoadingPreview.value = false;
        return;
      }

      const hlsUrl = getTauriHlsUrl(props.hlsOutputDir, playlistFilename);

      hlsInstance = new Hls({
        loader: TauriHlsLoader,
        liveDurationInfinity: false,
        enableWorker: false,
        maxBufferLength: 60,
        backBufferLength: 300,
      });

      hlsInstance.loadSource(hlsUrl);
      hlsInstance.attachMedia(previewVideoRef.value);

      hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('[ClipSelector] VOD manifest parsed, starting playback');
        isLoadingPreview.value = false;

        // Seek to the start of the selected range and auto-play
        if (previewVideoRef.value) {
          previewVideoRef.value.currentTime = startTime.value;
          previewVideoRef.value.play().then(() => {
            isPreviewPlaying.value = true;
          }).catch((err) => {
            console.warn('[ClipSelector] Auto-play failed:', err);
            isPreviewPlaying.value = false;
          });
        }
      });

      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        console.error('[ClipSelector] HLS error:', data.type, data.details);
        if (data.fatal) {
          isLoadingPreview.value = false;
        }
      });
    } catch (err) {
      console.error('[ClipSelector] Failed to initialize VOD playback:', err);
      isLoadingPreview.value = false;
    }
  }

  // Video playback controls
  function togglePlayPause() {
    if (!previewVideoRef.value) return;

    if (isPreviewPlaying.value) {
      previewVideoRef.value.pause();
      isPreviewPlaying.value = false;
    } else {
      // If playhead is outside selected range, seek to startTime first
      const ct = previewVideoRef.value.currentTime;
      if (ct < startTime.value || ct >= endTime.value) {
        previewVideoRef.value.currentTime = startTime.value;
      }
      previewVideoRef.value.play().then(() => {
        isPreviewPlaying.value = true;
      }).catch(() => {
        isPreviewPlaying.value = false;
      });
    }
  }

  function onVideoTimeUpdate() {
    if (!previewVideoRef.value) return;
    currentPlaybackTime.value = previewVideoRef.value.currentTime;

    // Stop/loop at endTime boundary
    if (isPreviewPlaying.value && previewVideoRef.value.currentTime >= endTime.value) {
      previewVideoRef.value.currentTime = startTime.value;
    }
  }

  function onVideoEnded() {
    // If video element fires ended, loop back to startTime
    if (previewVideoRef.value) {
      previewVideoRef.value.currentTime = startTime.value;
      isPreviewPlaying.value = false;
    }
  }

  function seekPreviewTo(time: number) {
    if (previewVideoRef.value && isFinite(time) && time >= 0) {
      previewVideoRef.value.currentTime = Math.min(time, maxDuration.value);
      currentPlaybackTime.value = previewVideoRef.value.currentTime;
    }
  }

  // Format time helper
  function formatTime(seconds: number): string {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Timeline interaction handlers
  function getPercentageFromEvent(event: MouseEvent): number {
    if (!timelineRef.value) return 0;
    const rect = timelineRef.value.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const percentage = (x / rect.width) * 100;
    return Math.max(0, Math.min(100, percentage));
  }

  function getTimeFromPercentage(percentage: number): number {
    return (percentage / 100) * maxDuration.value;
  }

  function handleTimelineMouseMove(event: MouseEvent) {
    if (!isDragging.value) {
      hoverPercentage.value = getPercentageFromEvent(event);
    }
  }

  function handleTimelineMouseDown(event: MouseEvent) {
    // Click on timeline to scrub/seek the preview video
    const percentage = getPercentageFromEvent(event);
    const time = getTimeFromPercentage(percentage);
    seekPreviewTo(time);
  }

  function handleStartHandleMouseDown(event: MouseEvent) {
    event.preventDefault();
    isDragging.value = true;
    dragTarget.value = 'start';
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  }

  function handleEndHandleMouseDown(event: MouseEvent) {
    event.preventDefault();
    isDragging.value = true;
    dragTarget.value = 'end';
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);
  }

  function handleDocumentMouseMove(event: MouseEvent) {
    if (!isDragging.value || !timelineRef.value) return;

    const percentage = getPercentageFromEvent(event);
    const time = getTimeFromPercentage(percentage);

    if (dragTarget.value === 'start') {
      startTime.value = Math.max(0, Math.min(time, endTime.value - 1));
    } else if (dragTarget.value === 'end') {
      endTime.value = Math.max(startTime.value + 1, Math.min(time, maxDuration.value));
    }
  }

  function handleDocumentMouseUp() {
    const wasDragging = dragTarget.value;
    isDragging.value = false;
    dragTarget.value = null;
    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);

    // After releasing handle, seek and auto-play from new position
    if (wasDragging === 'start') {
      seekPreviewTo(startTime.value);
      autoPlayFromRange();
    } else if (wasDragging === 'end') {
      if (currentPlaybackTime.value > endTime.value) {
        seekPreviewTo(startTime.value);
      }
      autoPlayFromRange();
    }
  }

  function autoPlayFromRange() {
    if (!previewVideoRef.value) return;
    previewVideoRef.value.play().then(() => {
      isPreviewPlaying.value = true;
    }).catch(() => {
      isPreviewPlaying.value = false;
    });
  }

  // Apply preset duration — selects the most recent N seconds of the window
  function applyPreset(duration: number) {
    if (duration > maxDuration.value) return;

    endTime.value = maxDuration.value;
    startTime.value = maxDuration.value - duration;

    // Seek preview to start of selected range
    seekPreviewTo(startTime.value);
  }

  // Progress event listener
  let progressUnlisten: UnlistenFn | null = null;

  async function setupProgressListener() {
    progressUnlisten = await listen<{ progress: number; message: string }>('clip-extraction-progress', (event) => {
      progress.value = event.payload.progress;
      progressMessage.value = event.payload.message;
    });
  }

  function cleanupProgressListener() {
    if (progressUnlisten) {
      progressUnlisten();
      progressUnlisten = null;
    }
  }

  // Cleanup HLS instance and VOD playlist
  async function cleanupVodPlayback() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    if (vodPlaylistPath.value) {
      try {
        await invoke('delete_vod_playlist', { playlistPath: vodPlaylistPath.value });
        console.log('[ClipSelector] VOD playlist cleaned up');
      } catch (err) {
        console.warn('[ClipSelector] Failed to cleanup VOD playlist:', err);
      }
      vodPlaylistPath.value = null;
    }
  }

  // Create clip
  async function handleCreateClip() {
    if (isCreating.value || !isValidSelection.value) return;

    // Pause preview during clip creation
    if (previewVideoRef.value && isPreviewPlaying.value) {
      previewVideoRef.value.pause();
      isPreviewPlaying.value = false;
    }

    const clipDuration = endTime.value - startTime.value;
    const clipStartTime = startTime.value;
    const clipEndTime = endTime.value;

    // Validate
    if (clipDuration <= 0) {
      error.value = 'Invalid clip duration';
      return;
    }

    if (clipEndTime > props.availableDuration) {
      error.value = `Only ${Math.floor(props.availableDuration)}s recorded so far`;
      return;
    }

    const effectiveSessionId = props.sessionId || props.tempSessionId || props.mintId;
    if (!effectiveSessionId) {
      error.value = 'Session not available. Please try again.';
      return;
    }

    if (!props.segments || props.segments.length === 0) {
      error.value = 'No recorded segments available';
      return;
    }

    isCreating.value = true;
    progress.value = 0;
    progressMessage.value = 'Preparing clip extraction...';
    error.value = null;

    let effectiveProjectId = createdProjectId.value || props.projectId;

    if (!effectiveProjectId && props.displayName && props.mintId) {
      try {
        progressMessage.value = 'Creating project folder...';
        effectiveProjectId = await createLivestreamClipProject(props.displayName, props.mintId, props.platform);
        createdProjectId.value = effectiveProjectId;
      } catch (err) {
        console.error('[ClipSelector] Failed to create project:', err);
        error.value = 'Failed to create project folder';
        isCreating.value = false;
        return;
      }
    }

    if (!effectiveProjectId) {
      error.value = 'Unable to determine project for clip';
      isCreating.value = false;
      return;
    }

    try {
      await setupProgressListener();

      const finalClipName = clipName.value || defaultClipName.value;

      const resultJson = await invoke<string>('extract_livestream_clip', {
        sessionId: effectiveSessionId,
        clipEndTime: clipEndTime,
        clipDuration: clipDuration,
        clipName: finalClipName,
        segments: props.segments,
        projectId: effectiveProjectId,
        watermarkId: null,
        watermarkSettings: null,
      });

      const extractionResult = JSON.parse(resultJson) as { clipPath: string; thumbnailPath: string | null };
      const clipFilePath = extractionResult.clipPath;
      const thumbnailFilePath = extractionResult.thumbnailPath;

      // Save clip to database
      try {
        const clipId = await createClipRecord(effectiveProjectId, clipFilePath, {
          name: finalClipName,
          duration: clipDuration,
          startTime: clipStartTime,
          endTime: clipEndTime,
          thumbnailPath: thumbnailFilePath || undefined,
        });

        createdClipId.value = clipId;

        const manualSessionId = await getOrCreateManualSession(effectiveProjectId);
        const versionId = await createClipVersion(
          clipId,
          manualSessionId,
          1,
          {
            name: finalClipName,
            startTime: clipStartTime,
            endTime: clipEndTime,
          },
          'detected'
        );
        await updateClip(clipId, { current_version_id: versionId, detection_session_id: manualSessionId });

        if (thumbnailFilePath) {
          const { getProject, updateProject } = await import('@/services/database/projects');
          const project = await getProject(effectiveProjectId);
          if (project && !project.thumbnail_path) {
            await updateProject(effectiveProjectId, undefined, undefined, thumbnailFilePath);
          }
        }
      } catch (dbErr) {
        console.warn('[ClipSelector] Failed to save clip to database:', dbErr);
      }

      createdClipPath.value = clipFilePath;
      clipCreated.value = true;
      clipName.value = finalClipName;

      emit('clip-created', clipFilePath, effectiveProjectId);
    } catch (err) {
      console.error('[ClipSelector] Failed to create clip:', err);
      error.value = err instanceof Error ? err.message : 'Failed to create clip';
    } finally {
      isCreating.value = false;
      cleanupProgressListener();
    }
  }

  // Publish now
  function handlePublishNow() {
    const projectId = createdProjectId.value || props.projectId;
    if (createdClipId.value && createdClipPath.value && projectId) {
      emit('publish-clip', createdClipId.value, createdClipPath.value, projectId);
    }
  }

  // Reset state for retry
  function resetState() {
    isCreating.value = false;
    progress.value = 0;
    progressMessage.value = '';
    clipCreated.value = false;
    createdClipPath.value = null;
    createdClipId.value = null;
    error.value = null;
  }

  // Close modal
  function handleClose(force = false) {
    if (isCreating.value && !force) {
      console.warn('[ClipSelector] Force closing while clip creation in progress');
    }
    
    // Show toast notification if clip was successfully created
    if (clipCreated.value && clipName.value) {
      const { success } = useToast();
      success('Clip Saved', `"${clipName.value}" has been saved to VOD Library`, undefined, 'clips');
    }
    
    cleanupProgressListener();
    cleanupVodPlayback();
    isCreating.value = false;
    emit('close');
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanupProgressListener();
    cleanupVodPlayback();
    if (isDragging.value) {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    }
  });
</script>

<style scoped>
  /* ===== Overlay ===== */
  .clip-selector__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  /* ===== Dialog Container ===== */
  .clip-selector {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 540px;
    margin: 1rem;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  /* ===== Accent Bar ===== */
  .clip-selector__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .clip-selector__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .clip-selector__close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .clip-selector__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .clip-selector__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .clip-selector__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    margin-bottom: 0.875rem;
  }

  .clip-selector__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .clip-selector__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content ===== */
  .clip-selector__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .clip-selector__content::-webkit-scrollbar {
    width: 6px;
  }

  .clip-selector__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .clip-selector__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== State Panels (progress, success, error) ===== */
  .clip-selector__state-panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 2rem 0;
  }

  .clip-selector__state-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .clip-selector__state-subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .clip-selector__state-subtitle--error {
    color: #f87171;
  }

  .clip-selector__progress-ring {
    position: relative;
    width: 64px;
    height: 64px;
    margin-bottom: 1rem;
  }

  .clip-selector__progress-svg {
    width: 100%;
    height: 100%;
    transform: rotate(-90deg);
  }

  .clip-selector__progress-circle {
    transition: stroke-dashoffset 300ms ease;
  }

  .clip-selector__progress-text {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .clip-selector__success-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background-color: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .clip-selector__error-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background-color: rgba(239, 68, 68, 0.15);
    color: #f87171;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 1rem;
  }

  /* ===== Video Preview ===== */
  .clip-selector__preview {
    position: relative;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    aspect-ratio: 16 / 9;
    overflow: hidden;
    cursor: pointer;
    margin-bottom: 1rem;
  }

  .clip-selector__video {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .clip-selector__play-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: opacity 150ms ease;
  }

  .clip-selector__play-overlay--playing {
    opacity: 0;
  }

  .clip-selector__preview:hover .clip-selector__play-overlay--playing {
    opacity: 1;
  }

  .clip-selector__play-btn {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background-color: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
  }

  .clip-selector__loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text-muted);
    font-size: 0.8125rem;
  }

  .clip-selector__spinner {
    width: 16px;
    height: 16px;
    animation: clip-selector-spin 0.8s linear infinite;
  }

  .clip-selector__time-badge {
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    padding: 0.125rem 0.5rem;
    background-color: rgba(0, 0, 0, 0.7);
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: monospace;
    color: white;
  }

  /* ===== Form Field ===== */
  .clip-selector__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: 1rem;
  }

  .clip-selector__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .clip-selector__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .clip-selector__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .clip-selector__char-count {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    text-align: right;
  }

  /* ===== Timeline ===== */
  .clip-selector__timeline {
    position: relative;
    height: 32px;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    cursor: pointer;
    overflow: hidden;
  }

  .clip-selector__range {
    position: absolute;
    top: 0;
    height: 100%;
    background-color: rgba(6, 182, 212, 0.2);
    border-left: 2px solid var(--sidebar-accent);
    border-right: 2px solid var(--sidebar-accent);
  }

  .clip-selector__handle {
    position: absolute;
    top: 0;
    height: 100%;
    width: 12px;
    background-color: var(--sidebar-accent);
    cursor: ew-resize;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
  }

  .clip-selector__handle-grip {
    width: 2px;
    height: 16px;
    background-color: white;
    border-radius: 1px;
  }

  .clip-selector__playhead {
    position: absolute;
    top: 0;
    height: 100%;
    width: 2px;
    background-color: white;
    pointer-events: none;
    z-index: 3;
  }

  .clip-selector__hover-line {
    position: absolute;
    top: 0;
    height: 100%;
    width: 1px;
    background-color: rgba(255, 255, 255, 0.4);
    pointer-events: none;
  }

  .clip-selector__time-labels {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .clip-selector__duration-label {
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .clip-selector__range-info {
    text-align: center;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  /* ===== Presets ===== */
  .clip-selector__presets {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .clip-selector__preset-btn {
    flex: 1;
    padding: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    border-radius: 8px;
    border: 1px solid var(--sidebar-border);
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .clip-selector__preset-btn:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .clip-selector__preset-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ===== Footer ===== */
  .clip-selector__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .clip-selector__btn {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .clip-selector__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .clip-selector__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .clip-selector__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .clip-selector__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: #000;
  }

  .clip-selector__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  /* ===== Transitions ===== */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 200ms ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  .dialog-enter-active {
    transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  @keyframes clip-selector-spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
