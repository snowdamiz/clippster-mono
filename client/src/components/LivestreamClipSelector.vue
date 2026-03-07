<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="!hidden"
        class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]"
        @click.self="() => handleClose(true)"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-2xl w-full mx-4 border border-white/10 overflow-hidden"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

            <div class="p-6">
              <!-- Header -->
              <div class="flex items-center justify-between mb-6">
                <h3 class="text-lg font-semibold text-white">Create Clip</h3>
                <button
                  @click="handleClose(true)"
                  class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  :title="isCreating ? 'Cancel and close' : 'Close'"
                >
                  <X class="w-5 h-5" />
                </button>
              </div>

              <!-- Progress State -->
              <div v-if="isCreating" class="text-center py-8">
                <div class="relative w-16 h-16 mx-auto mb-4">
                  <svg class="w-full h-full -rotate-90">
                    <circle cx="32" cy="32" r="28" stroke-width="6" stroke="rgb(39 39 42)" fill="none" />
                    <circle
                      cx="32"
                      cy="32"
                      r="28"
                      stroke-width="6"
                      stroke="url(#progressGradient)"
                      fill="none"
                      :stroke-dasharray="176"
                      :stroke-dashoffset="176 - (176 * progress) / 100"
                      stroke-linecap="round"
                      class="transition-all duration-300"
                    />
                    <defs>
                      <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stop-color="#8b5cf6" />
                        <stop offset="100%" stop-color="#a855f7" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div class="absolute inset-0 flex items-center justify-center">
                    <span class="text-white font-semibold">{{ Math.round(progress) }}%</span>
                  </div>
                </div>
                <p class="text-white font-medium">Creating clip...</p>
                <p class="text-sm text-zinc-400 mt-1">{{ progressMessage }}</p>
              </div>

              <!-- Success State -->
              <div v-else-if="clipCreated" class="text-center py-8">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 flex items-center justify-center">
                  <Check class="w-8 h-8 text-green-400" />
                </div>
                <p class="text-white font-medium">Clip created successfully!</p>
                <p class="text-sm text-zinc-400 mt-1">{{ clipName }}</p>
                <div class="flex justify-center gap-3 mt-6">
                  <button
                    @click="handleViewClip"
                    class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <ExternalLink class="w-4 h-4" />
                    View Clip
                  </button>
                  <button
                    @click="handlePublishNow"
                    class="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <Share2 class="w-4 h-4" />
                    Publish Now
                  </button>
                  <button
                    @click="() => handleClose()"
                    class="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors"
                  >
                    Done
                  </button>
                </div>
              </div>

              <!-- Error State -->
              <div v-else-if="error" class="text-center py-8">
                <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle class="w-8 h-8 text-red-400" />
                </div>
                <p class="text-white font-medium">Failed to create clip</p>
                <p class="text-sm text-red-400 mt-1">{{ error }}</p>
                <button
                  @click="resetState"
                  class="mt-6 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg transition-colors"
                >
                  Try Again
                </button>
              </div>

              <!-- Selection State -->
              <div v-else>
                <!-- Video Preview -->
                <div class="mb-4 bg-zinc-800 rounded-lg aspect-video overflow-hidden relative">
                  <video
                    v-if="props.videoElement"
                    ref="previewVideoRef"
                    class="w-full h-full object-contain"
                    muted
                  />
                  <div v-else class="w-full h-full flex items-center justify-center">
                    <div class="text-zinc-500 text-sm">Video Preview</div>
                  </div>
                </div>

                <!-- Clip Name -->
                <div class="mb-4">
                  <input
                    v-model="clipName"
                    type="text"
                    :placeholder="defaultClipName"
                    maxlength="50"
                    class="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  />
                  <div class="text-xs text-zinc-500 mt-1">{{ clipName.length }}/50</div>
                </div>

                <!-- Interactive Timeline -->
                <div class="mb-6">
                  <div class="relative">
                    <!-- Waveform-style bars (decorative) -->
                    <div class="flex items-end justify-between h-16 gap-0.5 mb-2">
                      <div
                        v-for="i in 60"
                        :key="i"
                        class="flex-1 bg-zinc-700 rounded-sm transition-all"
                        :style="{ height: `${20 + Math.random() * 80}%` }"
                      />
                    </div>

                    <!-- Timeline Track -->
                    <div
                      ref="timelineRef"
                      class="relative h-8 bg-zinc-800 rounded-lg cursor-pointer"
                      @mousedown="handleTimelineMouseDown"
                      @mousemove="handleTimelineMouseMove"
                      @mouseleave="isTimelineHovering = false"
                      @mouseenter="isTimelineHovering = true"
                    >
                      <!-- Selected Range -->
                      <div
                        class="absolute top-0 h-full bg-violet-500/30 border-l-2 border-r-2 border-violet-500"
                        :style="{
                          left: `${startPercentage}%`,
                          width: `${endPercentage - startPercentage}%`,
                        }"
                      />

                      <!-- Start Handle -->
                      <div
                        class="absolute top-0 h-full w-3 bg-violet-500 cursor-ew-resize flex items-center justify-center"
                        :style="{ left: `calc(${startPercentage}% - 6px)` }"
                        @mousedown.stop="handleStartHandleMouseDown"
                      >
                        <div class="w-0.5 h-4 bg-white rounded-full" />
                      </div>

                      <!-- End Handle -->
                      <div
                        class="absolute top-0 h-full w-3 bg-violet-500 cursor-ew-resize flex items-center justify-center"
                        :style="{ left: `calc(${endPercentage}% - 6px)` }"
                        @mousedown.stop="handleEndHandleMouseDown"
                      >
                        <div class="w-0.5 h-4 bg-white rounded-full" />
                      </div>

                      <!-- Hover indicator -->
                      <div
                        v-if="isTimelineHovering && !isDragging"
                        class="absolute top-0 h-full w-0.5 bg-white/50 pointer-events-none"
                        :style="{ left: `${hoverPercentage}%` }"
                      />
                    </div>

                    <!-- Time Labels -->
                    <div class="flex justify-between items-center mt-2 text-xs text-zinc-400">
                      <div>{{ formatTime(startTime) }}</div>
                      <div class="text-white font-medium">{{ formatTime(endTime - startTime) }}</div>
                      <div>{{ formatTime(endTime) }}</div>
                    </div>
                    <div class="text-center text-xs text-zinc-500 mt-1">
                      0:00 - {{ formatTime(maxDuration) }}
                    </div>
                  </div>
                </div>

                <!-- Quick Presets -->
                <div class="mb-6">
                  <div class="flex gap-2">
                    <button
                      v-for="preset in [30, 60, 90]"
                      :key="preset"
                      @click="applyPreset(preset)"
                      :disabled="preset > maxDuration"
                      class="flex-1 py-2 rounded-lg text-sm font-medium transition-all"
                      :class="
                        preset > maxDuration
                          ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                          : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
                      "
                    >
                      {{ preset }}s
                    </button>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-3">
                  <button
                    @click="() => handleClose()"
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    @click="handleCreateClip"
                    :disabled="!isValidSelection"
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Scissors class="w-4 h-4" />
                    Publish
                  </button>
                </div>
              </div>
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
  import { Scissors, X, Check, AlertCircle, ExternalLink, Share2 } from 'lucide-vue-next';
  import { useRouter } from 'vue-router';
  import { createLivestreamClipProject, createClip as createClipRecord } from '@/services/database';
  import { createClipVersion } from '@/services/database/clip-versions';
  import { updateClip } from '@/services/database/clips';
  import { getOrCreateManualSession } from '@/services/database/clip-detection-sessions';
  import { useLivestreamStore } from '@/stores/livestream';

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
    videoElement?: HTMLVideoElement | null;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'clip-created', clipPath: string, projectId: string): void;
    (e: 'publish-clip', clipId: string, clipPath: string, projectId: string): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const router = useRouter();
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

  // Sync preview video with HLS video element
  onMounted(() => {
    // Safety check: ensure availableDuration is a valid number
    if (!props.availableDuration || !isFinite(props.availableDuration) || props.availableDuration <= 0) {
      console.warn('[ClipSelector] Invalid availableDuration:', props.availableDuration);
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

    if (props.videoElement && previewVideoRef.value && props.videoElement.src) {
      // Copy the video source to the preview
      previewVideoRef.value.src = props.videoElement.src;
      
      // Calculate the offset from the beginning of the DVR buffer
      // availableDuration is total DVR buffer, we want to show the last 3 minutes
      const bufferOffset = Math.max(0, props.availableDuration - maxDuration.value);
      
      // Seek to the selected position within the 3-minute window
      const seekToPosition = () => {
        if (previewVideoRef.value && props.videoElement && isFinite(props.playbackPosition)) {
          // Calculate absolute position in the DVR buffer
          const absolutePosition = bufferOffset + startTime.value;
          // Seek the preview video to that position
          const seekTime = props.videoElement.currentTime - props.playbackPosition + absolutePosition;
          
          // Safety check: ensure seekTime is finite before setting
          if (isFinite(seekTime) && seekTime >= 0) {
            previewVideoRef.value.currentTime = seekTime;
          }
        }
      };
      
      seekToPosition();
    }
  });

  // Update preview video when start time changes
  watch(startTime, () => {
    if (previewVideoRef.value && props.videoElement && isFinite(props.availableDuration) && isFinite(props.playbackPosition)) {
      // Calculate offset for the 3-minute window
      const bufferOffset = Math.max(0, props.availableDuration - maxDuration.value);
      const absolutePosition = bufferOffset + startTime.value;
      const seekTime = props.videoElement.currentTime - props.playbackPosition + absolutePosition;
      
      // Safety check: ensure seekTime is finite before setting
      if (isFinite(seekTime) && seekTime >= 0) {
        previewVideoRef.value.currentTime = seekTime;
      }
    }
  });

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
    // Click on timeline to scrub/preview
    const percentage = getPercentageFromEvent(event);
    const time = getTimeFromPercentage(percentage);
    // TODO: Emit seek event to video player when integrated
    console.log('Scrub to:', time);
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
    isDragging.value = false;
    dragTarget.value = null;
    document.removeEventListener('mousemove', handleDocumentMouseMove);
    document.removeEventListener('mouseup', handleDocumentMouseUp);
  }

  // Apply preset duration
  function applyPreset(duration: number) {
    if (duration > maxDuration.value) return;
    
    // Set end time to current playback position or max duration
    const targetEnd = Math.min(props.playbackPosition, maxDuration.value);
    endTime.value = targetEnd;
    startTime.value = Math.max(0, targetEnd - duration);
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

  // Create clip
  async function handleCreateClip() {
    if (isCreating.value || !isValidSelection.value) return;

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

    if (!effectiveProjectId && (props.isTempRecording || !props.sessionId) && props.displayName && props.mintId) {
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
        const sessionCampaign = props.streamerId ? livestreamStore.getSessionCampaign(props.streamerId) : undefined;
        const campaignId = sessionCampaign?.id;

        const clipId = await createClipRecord(effectiveProjectId, clipFilePath, {
          name: finalClipName,
          duration: clipDuration,
          startTime: clipStartTime,
          endTime: clipEndTime,
          thumbnailPath: thumbnailFilePath || undefined,
          campaignId,
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

  // Navigate to clip in projects
  function handleViewClip() {
    const projectId = createdProjectId.value || props.projectId;
    if (projectId) {
      router.push({ name: 'projects', query: { projectId } });
      handleClose();
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
    cleanupProgressListener();
    isCreating.value = false;
    emit('close');
  }

  // Cleanup on unmount
  onUnmounted(() => {
    cleanupProgressListener();
    if (isDragging.value) {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
    }
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
    transform: scale(0.95) translateY(10px);
    opacity: 0;
  }
  .dialog-leave-to {
    transform: scale(0.95) translateY(10px);
    opacity: 0;
  }
</style>
