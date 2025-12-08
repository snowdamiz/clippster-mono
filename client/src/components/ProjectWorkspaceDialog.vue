<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
      @click.self="close"
    >
      <div
        ref="dialogElementRef"
        class="bg-card rounded-md w-full h-full border border-border shadow-2xl"
        style="margin: 30px; margin-top: 60px; max-height: calc(100vh - 80px); max-width: calc(100vw - 60px)"
      >
        <!-- Header -->
        <div
          class="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-gradient-to-r from-[#0a0a0a] via-[#0d0d0d] to-[#0a0a0a] rounded-t-lg"
        >
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-6 h-6 rounded-sm bg-gradient-to-br from-violet-500/20 to-purple-600/20 border border-violet-500/30 flex items-center justify-center"
            >
              <Film class="h-3 w-3 text-violet-400" />
            </div>
            <div class="flex flex-col">
              <h2 class="text-sm font-semibold text-foreground tracking-tight truncate">
                {{ project?.name || 'New Project' }}
              </h2>
            </div>
          </div>
          <button
            @click="close"
            class="p-2 hover:bg-white/5 rounded-lg transition-all duration-200 group"
            title="Close (Esc)"
          >
            <X class="h-4 w-4 text-foreground/50 group-hover:text-foreground/90 transition-colors" />
          </button>
        </div>
        <!-- Main Content Area -->
        <div class="flex flex-col" style="height: calc(100% - 22px); min-height: 0">
          <!-- Top Row: Video Player, Transcript, and Clips -->
          <div
            class="flex min-h-0 border-b border-border"
            style="flex: 1; overflow: hidden; max-height: calc(100% - 170px)"
          >
            <!-- Video Player Section -->
            <div
              class="w-3/5 min-w-0 p-5 border-r border-border/40 flex flex-col bg-gradient-to-br from-black/20 to-transparent"
            >
              <!-- Video Player Container -->
              <VideoPlayer
                :video-src="videoSrc"
                :video-loading="videoLoading"
                :video-error="videoError"
                :is-playing="isPlaying"
                :aspect-ratio="selectedAspectRatio"
                :focal-point="currentFocalPoint"
                :subtitle-settings="subtitleSettings"
                :transcript-words="transcriptData?.words || []"
                :transcript-segments="transcriptData?.whisperSegments || []"
                :current-time="currentTime"
                :watermark-settings="watermarkSettings"
                :watermark-data="currentWatermarkData"
                :audio-gain-db="audioGainDb"
                @togglePlayPause="togglePlayPause"
                @timeUpdate="onTimeUpdate"
                @loadedMetadata="onLoadedMetadata"
                @videoEnded="onVideoEnded"
                @videoError="onVideoError"
                @loadStart="onLoadStart"
                @canPlay="onCanPlay"
                @retryLoad="loadVideoForProject"
                @videoElementReady="onVideoElementReady"
              />
              <!-- Video Controls Bar -->
              <VideoControls
                :video-src="videoSrc"
                :video-loading="videoLoading"
                :is-playing="isPlaying"
                :current-time="currentTime"
                :duration="duration"
                :volume="volume"
                :is-muted="isMuted"
                @togglePlayPause="togglePlayPause"
                @toggleMute="toggleMute"
                @updateVolume="updateVolume"
                @goToBeginning="goToBeginning"
              />
            </div>
            <!-- Right Side: Media Section -->
            <div class="w-2/5 min-w-0 flex flex-col flex-1 bg-gradient-to-b from-transparent to-black/10">
              <!-- Media Section -->
              <MediaPanel
                ref="mediaPanelRef"
                :transcript-collapsed="transcriptCollapsed"
                :clips-collapsed="clipsCollapsed"
                :is-generating="clipGenerationInProgress"
                :generation-progress="clipProgress"
                :generation-stage="clipStage"
                :generation-message="clipMessage"
                :generation-error="clipError"
                :project-id="project?.id"
                :hovered-timeline-clip-id="hoveredTimelineClipId"
                :is-playing-segments="isPlayingSegments"
                :playing-clip-id="getCurrentPlayingClipId()"
                :video-duration="duration"
                :current-time="currentTime"
                :aspect-ratio="selectedAspectRatio"
                :creator-default-intro="creatorDefaultIntro"
                :creator-default-outro="creatorDefaultOutro"
                @detectClips="onDetectClips"
                @cancelDetection="onCancelDetection"
                @clipHover="onClipHover"
                @scrollToTimeline="onScrollToTimeline"
                @deleteClip="onDeleteClip"
                @playClip="onPlayClip"
                @seekVideo="onSeekVideo"
                @subtitleSettingsChanged="onSubtitleSettingsChanged"
                @watermarkSettingsChanged="onWatermarkSettingsChanged"
                @audioSettingsChanged="onAudioSettingsChanged"
              />
            </div>
          </div>
          <!-- Bottom Row: Timeline -->
          <Timeline
            ref="timelineRef"
            :video-src="videoSrc"
            :current-time="currentTime"
            :duration="duration"
            :timeline-hover-time="timelineHoverTime"
            :timeline-hover-position="timelineHoverPosition"
            :clips="timelineClips"
            :hovered-clip-id="hoveredClipId"
            :hovered-timeline-clip-id="hoveredTimelineClipId"
            :currently-playing-clip-id="currentlyPlayingClipId"
            :project-id="project?.id"
            :dialog-height="dialogHeight"
            :audio-gain-db="audioGainDb"
            @seekTimeline="seekTimeline"
            @timelineTrackHover="onTimelineTrackHover"
            @timelineMouseLeave="onTimelineMouseLeave"
            @timelineClipHover="onTimelineClipHover"
            @timelineSegmentClick="onTimelineSegmentClick"
            @scrollToMediaPanel="onScrollToMediaPanel"
            @zoomChanged="handleTimelineZoomChanged"
            @segmentUpdated="onSegmentUpdated"
            @refreshClipsData="onRefreshClipsData"
          />
        </div>
      </div>
    </div>
  </Teleport>
  <!-- Progress Modal (for error states or detailed view) -->
  <ClipGenerationProgress
    :visible="showProgress"
    :progress="clipProgress"
    :stage="clipStage"
    :message="clipMessage"
    :error="clipError"
    :is-connected="progressConnected"
    :can-close="!clipGenerationInProgress"
    @close="closeProgress"
  />
  <!-- Delete Confirmation Modal -->
  <ConfirmationModal
    :show="showDeleteDialog"
    title="Delete Clip"
    message="Are you sure you want to delete this clip?"
    suffix="This action cannot be undone."
    confirm-text="Delete"
    @close="handleDeleteDialogClose"
    @confirm="deleteClipConfirmed"
  />
  <!-- Clip Detection Confirmation Dialog -->
  <ClipDetectionConfirmDialog
    :model-value="showDetectConfirmDialog"
    :video-duration="duration"
    :is-transcribed="isTranscribed"
    @update:model-value="showDetectConfirmDialog = $event"
    @confirm="onDetectClipsConfirmed"
  />
</template>

<style scoped>
  /* Backdrop blur effects */
  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }

  /* Smooth transitions */
  .transition-colors {
    transition-property: color, background-color, border-color, text-decoration-color, fill, stroke;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  /* Ensure proper z-index layering */
  .z-50 {
    z-index: 50;
  }
</style>

<script setup lang="ts">
  import { ref, watch, computed, nextTick } from 'vue';
  import {
    type Project,
    type ClipWithVersion,
    type CreatorProfileWithLinks,
    type IntroOutro,
    getClipsWithVersionsByProjectId,
    deleteClip,
    getWatermarkImage,
    getCreatorProfileByProjectId,
    getIntroOutroById,
    type WatermarkImage,
  } from '@/services/database';
  import { X, Film } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import type { SubtitleSettings, WatermarkSettings, AudioSettings } from '@/types';
  import VideoPlayer from './VideoPlayer.vue';
  import VideoControls from './VideoControls.vue';
  import MediaPanel from './MediaPanel.vue';
  import Timeline from './Timeline.vue';
  import ClipGenerationProgress from './ClipGenerationProgress.vue';
  import ConfirmationModal from './ConfirmationModal.vue';
  import ClipDetectionConfirmDialog from './ClipDetectionConfirmDialog.vue';
  import { useVideoPlayer } from '@/composables/useVideoPlayer';
  import { useProgressSocket } from '@/composables/useProgressSocket';
  import { useToast } from '@/composables/useToast';
  import { useWindowClose } from '@/composables/useWindowClose';
  import { useVideoFocalPoint } from '@/composables/useVideoFocalPoint';
  import { useTranscriptData } from '@/composables/useTranscriptData';
  import { useClipDetectionTracking } from '@/composables/useClipDetectionTracking';
  import { useAuthStore } from '@/stores/auth';
  import { getRawVideosByProjectId } from '@/services/database';

  const authStore = useAuthStore();
  const { error: showError } = useToast();
  const { setClipGenerationInProgress } = useWindowClose();
  const {
    startDetection,
    updateProgress: updateGlobalProgress,
    completeDetection,
    getDetectionState,
    hasAnyActiveDetection,
  } = useClipDetectionTracking();

  const props = defineProps<{
    modelValue: boolean;
    project?: Project | null;
    /** Optional clip ID to preselect and scroll to when dialog opens */
    initialClipId?: string | null;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
  }>();

  // Progress state
  const showProgress = ref(false);
  const clipGenerationInProgress = ref(false);

  // Delete state
  const showDeleteDialog = ref(false);
  const clipToDelete = ref<string | null>(null);

  // Clip detection confirmation state
  const showDetectConfirmDialog = ref(false);

  // Segmented playback tracking
  const currentlyPlayingClipId = ref<string | null>(null);

  // Panel collapse state
  const transcriptCollapsed = ref(false);
  const clipsCollapsed = ref(false);

  // Timeline clips state
  const timelineClips = ref<any[]>([]);

  // Hover state for bidirectional highlighting
  const hoveredClipId = ref<string | null>(null);
  const hoveredTimelineClipId = ref<string | null>(null);

  // Component refs for scrolling
  const mediaPanelRef = ref<InstanceType<typeof MediaPanel> | null>(null);
  const timelineRef = ref<InstanceType<typeof Timeline> | null>(null);

  // Dialog element ref for height tracking
  const dialogElementRef = ref<HTMLElement | null>(null);

  // Aspect ratio state
  const selectedAspectRatio = ref({ width: 16, height: 9 });

  // Subtitle settings state
  const subtitleSettings = ref<SubtitleSettings>({
    enabled: false,
    fontFamily: 'Montserrat',
    fontSize: 32,
    fontWeight: 700,
    textColor: '#FFFFFF',
    backgroundColor: '#000000',
    backgroundEnabled: false,
    border1Width: 2,
    border1Color: '#00FF00',
    border2Width: 4,
    border2Color: '#000000',
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowBlur: 4,
    shadowColor: '#000000',
    position: 'bottom',
    positionPercentage: 97,
    maxWidth: 90,
    animationStyle: 'none',
    highlightColor: '#FFFF00',
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: 'center',
    textOffsetX: 0,
    textOffsetY: 0,
    padding: 16,
    borderRadius: 8,
    wordSpacing: 0.35,
  });

  // Watermark settings state
  const watermarkSettings = ref<WatermarkSettings>({
    enabled: false,
    watermarkId: null,
    positionX: 8,
    positionY: 92,
    opacity: 80,
    scale: 15,
  });

  // Audio gain state (in dB, -20 to +20)
  const audioGainDb = ref(0);

  // Current watermark image data (for VideoPlayer)
  const currentWatermarkData = ref<{ dataUrl: string; width?: number; height?: number } | null>(null);

  // Creator profile associated with this project (for preconfiguring settings)
  const creatorProfile = ref<CreatorProfileWithLinks | null>(null);

  // Creator profile default intro/outro (auto-applied when building clips)
  const creatorDefaultIntro = ref<IntroOutro | null>(null);
  const creatorDefaultOutro = ref<IntroOutro | null>(null);

  // Use video player composable
  const projectRef = computed(() => props.project);

  // Use transcript data composable for subtitles
  const { transcriptData } = useTranscriptData(computed(() => props.project?.id || null));

  const isTranscribed = computed(() => {
    return !!(
      transcriptData.value &&
      transcriptData.value.whisperSegments &&
      transcriptData.value.whisperSegments.length > 0
    );
  });

  // Computed property for dialog height
  const dialogHeight = computed(() => {
    if (!dialogElementRef.value || !props.modelValue) return null;

    const rect = dialogElementRef.value.getBoundingClientRect();
    return rect.height;
  });

  // Initialize progress socket
  const {
    isConnected: progressConnected,
    progress: backendProgress,
    stage: backendStage,
    message: backendMessage,
    error: backendError,
    setProjectId: setProgressProjectId,
    reset: resetProgress,
  } = useProgressSocket(props.project?.id || null);

  // Frontend progress tracking (for chunked detection preparation)
  const frontendProgress = ref(0);
  const frontendStage = ref('');
  const frontendMessage = ref('');
  const frontendError = ref('');

  // Store the cancel function for the current detection
  const cancelDetectionFn = ref<(() => void) | null>(null);

  // Combined progress computed properties
  const clipProgress = computed(() => {
    // If detection is completed, show 100%
    if (frontendStage.value === 'completed' || backendStage.value === 'completed') {
      return 100;
    }

    // If backend has started processing (progress > 0), map it to the 30-100% range
    if (backendProgress.value > 0) {
      return 30 + backendProgress.value * 0.7;
    }

    // Otherwise, show frontend progress mapped to 0-30% range
    // Frontend progress usually goes 0 -> 100 during preparation
    return Math.min(30, frontendProgress.value * 0.3);
  });

  const clipStage = computed(() => {
    // Prefer backend stage if active
    if (backendStage.value && backendStage.value !== 'starting') {
      return backendStage.value;
    }
    return frontendStage.value || backendStage.value;
  });

  const clipMessage = computed(() => {
    // Prefer backend message if active
    if (backendMessage.value) {
      return backendMessage.value;
    }
    return frontendMessage.value;
  });

  const clipError = computed(() => {
    return backendError.value || frontendError.value;
  });

  const {
    videoElement,
    videoSrc,
    videoLoading,
    videoError,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    timelineHoverTime,
    timelineHoverPosition,
    togglePlayPause,
    seekTimeline,
    onTimelineTrackHover,
    onTimelineZoomChanged,
    updateVolume,
    toggleMute,
    goToBeginning,
    onTimeUpdate,
    onLoadedMetadata,
    onVideoEnded,
    onLoadStart,
    onCanPlay,
    onVideoError,
    loadVideos,
    loadVideoForProject,
    resetVideoState,
    playClipSegments,
    stopSegmentedPlayback,
    isPlayingSegments,
    segmentPlaybackEnded,
  } = useVideoPlayer(projectRef);

  // Initialize focal point composable
  const { currentFocalPoint, loadFocalPoints, updateTime, reset: resetFocalPoint } = useVideoFocalPoint();

  // Watch for project changes to load focal points
  watch(
    () => props.project,
    async (newProject) => {
      if (newProject?.id) {
        try {
          const rawVideos = await getRawVideosByProjectId(newProject.id);
          if (rawVideos.length > 0) {
            await loadFocalPoints(rawVideos[0].id);
          }
        } catch (error) {
          console.error('[ProjectWorkspaceDialog] Failed to load focal points:', error);
        }
      } else {
        resetFocalPoint();
      }
    },
    { immediate: true }
  );

  // Watch for time changes to update focal point
  watch(currentTime, (newTime) => {
    updateTime(newTime);
  });

  function close() {
    emit('update:modelValue', false);
  }

  function closeProgress() {
    showProgress.value = false;
    resetProgress();
    if (!clipGenerationInProgress.value) {
      setProgressProjectId(null);
    }
  }

  async function onDetectClips() {
    // Check if user is authenticated before showing clip detection dialog
    if (!authStore.isAuthenticated) {
      // Show auth modal directly without error toast
      window.dispatchEvent(new CustomEvent('show-auth-modal'));
      return;
    }

    // Show confirmation dialog (prompt will be selected within the dialog)
    showDetectConfirmDialog.value = true;
  }

  async function onCancelDetection() {
    console.log('[ProjectWorkspaceDialog] Cancelling clip detection...');

    if (cancelDetectionFn.value) {
      cancelDetectionFn.value();
      cancelDetectionFn.value = null;
    }

    // Update UI state
    if (props.project?.id) {
      completeDetection(props.project.id, 'Cancelled by user');
    }

    clipGenerationInProgress.value = false;
    frontendProgress.value = 0;
    frontendStage.value = 'cancelled';
    frontendMessage.value = 'Detection cancelled';

    // Update window close warning
    setClipGenerationInProgress(hasAnyActiveDetection.value);

    // Also update backend state
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('set_clip_generation_in_progress', { inProgress: hasAnyActiveDetection.value });
    } catch (error) {
      console.error('[ProjectWorkspaceDialog] Failed to update backend clip generation state:', error);
    }

    // Show toast - the cancel function handles server-side refund
    const toastComposable = await import('@/composables/useToast');
    const { success: showSuccessToast } = toastComposable.useToast();
    showSuccessToast('Detection Cancelled', 'Clip detection was cancelled. Any charged credits have been refunded.');
  }

  async function onDetectClipsConfirmed(_promptId: string, promptContent: string) {
    if (!props.project) {
      console.error('[ProjectWorkspaceDialog] No project available');
      return;
    }

    const projectId = props.project.id;

    try {
      // Initialize progress tracking (both local and global)
      clipGenerationInProgress.value = true;
      showProgress.value = false; // Show progress in the clips panel, not modal
      resetProgress();
      frontendProgress.value = 0;
      frontendStage.value = '';
      frontendMessage.value = '';
      frontendError.value = '';
      setProgressProjectId(projectId.toString());

      // Start global tracking for this project
      startDetection(projectId);

      // Notify window close handlers that clip generation is starting
      setClipGenerationInProgress(true);

      // Also set backend state for window close handling
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('set_clip_generation_in_progress', { inProgress: true });
      } catch (error) {
        console.error('[ProjectWorkspaceDialog] Failed to set backend clip generation state:', error);
      }

      console.log('[ProjectWorkspaceDialog] Starting enhanced clip detection with chunking support');

      // Use the new chunked detection system
      const { useChunkedClipDetection } = await import('@/composables/useChunkedClipDetection');
      const { detectClipsWithChunking, cancelDetection, progress: chunkedProgress } = useChunkedClipDetection();

      // Store the cancel function so we can call it from onCancelDetection
      cancelDetectionFn.value = cancelDetection;

      // Watch chunked detection progress and update global state
      // Only update local refs if this is still the active project being viewed
      const stopProgressWatch = watch(
        chunkedProgress,
        (newProgress) => {
          // Always update global tracking (this persists across navigation)
          updateGlobalProgress(
            projectId,
            newProgress.progress,
            newProgress.stage,
            newProgress.message,
            newProgress.error || ''
          );

          // Only update local UI refs if the user is still viewing THIS project
          // This prevents other project's progress from overwriting the current view
          if (props.project?.id === projectId) {
            frontendProgress.value = newProgress.progress;
            frontendStage.value = newProgress.stage;
            frontendMessage.value = newProgress.message;

            if (newProgress.error) {
              frontendError.value = newProgress.error;
            }
          }
        },
        { immediate: true }
      );

      try {
        // Perform enhanced clip detection
        const result = await detectClipsWithChunking(projectId, promptContent, {
          chunkDurationMinutes: 15,
          overlapSeconds: 30,
          forceReprocess: false,
        });

        if (result.success) {
          console.log('[ProjectWorkspaceDialog] Enhanced clip detection successful');

          // Mark detection as complete in global tracking
          completeDetection(projectId);

          // Trigger UI refresh for successful detection
          setTimeout(() => {
            const clipsPanel = document.querySelector('[data-clips-panel]') as any;
            if (clipsPanel && clipsPanel.__vueParentComponent && clipsPanel.__vueParentComponent.exposed) {
              clipsPanel.__vueParentComponent.exposed.refreshClips?.();
            } else {
              const refreshEvent = new CustomEvent('refresh-clips', {
                detail: { projectId },
              });
              document.dispatchEvent(refreshEvent);
            }

            const projectsRefreshEvent = new CustomEvent('refresh-clips-projects', {
              detail: { projectId },
            });
            document.dispatchEvent(projectsRefreshEvent);

            if (timelineRef.value && timelineRef.value.loadTranscriptData) {
              timelineRef.value.loadTranscriptData(projectId);
            }
          }, 1000);

          // Show success completion state only if still viewing this project
          if (props.project?.id === projectId) {
            frontendProgress.value = 100;
            frontendStage.value = 'completed';
            frontendMessage.value = 'Clip detection completed successfully!';
          }
          return;
        }

        // Handle cancellation - don't show error
        if (result.cancelled) {
          console.log('[ProjectWorkspaceDialog] Detection was cancelled');
          completeDetection(projectId, 'Cancelled by user');
          return;
        }

        // If enhanced detection failed, the error handling below will catch it
      } finally {
        stopProgressWatch();
        cancelDetectionFn.value = null;
      }
    } catch (error) {
      console.error('[ProjectWorkspaceDialog] Enhanced detection failed:', error);

      // Show error toast to user
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const isNetworkError =
        errorMessage.includes('TLS') || errorMessage.includes('network') || errorMessage.includes('fetch');

      if (isNetworkError) {
        showError(
          'Network Error',
          'AI service temporarily unavailable. No credits were charged. Please try again in a few moments.',
          8000
        );
      } else if (errorMessage.includes('Server error: 500')) {
        showError('Service Error', 'AI processing failed. No credits were charged. Please try again.', 8000);
      } else {
        showError('Clip Detection Failed', `${errorMessage}. No credits were charged.`, 8000);
      }

      // Mark detection as failed in global tracking
      completeDetection(projectId, errorMessage);

      // Update progress UI to show error only if still viewing this project
      if (props.project?.id === projectId) {
        frontendError.value = errorMessage;
        frontendStage.value = 'error';
      }

      // Keep progress dialog open to show the error
    } finally {
      // Don't immediately hide progress - let the user see the completion/error state
      setTimeout(async () => {
        // Only update local state if still viewing this project
        if (props.project?.id === projectId) {
          clipGenerationInProgress.value = false;
        }

        // Update window close warning based on global tracking
        setClipGenerationInProgress(hasAnyActiveDetection.value);

        // Also update backend state
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          await invoke('set_clip_generation_in_progress', { inProgress: hasAnyActiveDetection.value });
        } catch (error) {
          console.error('[ProjectWorkspaceDialog] Failed to update backend clip generation state:', error);
        }
      }, 1000);
    }
  }

  function onTimelineMouseLeave() {
    timelineHoverTime.value = null;
  }

  function handleTimelineZoomChanged(zoomLevel: number) {
    onTimelineZoomChanged(zoomLevel);
  }

  // Handle segment updates from Timeline
  function onSegmentUpdated(_clipId: string, _segmentIndex: number, _newStartTime: number, _newEndTime: number) {
    // Refresh the MediaPanel data to get the updated segment positions
    if (props.project) {
      // Use both methods to ensure refresh happens reliably
      setTimeout(async () => {
        // Method 1: Direct refresh if MediaPanel ref is available
        if (mediaPanelRef.value) {
          mediaPanelRef.value.refreshClips();
        }

        // Method 2: Event-based refresh as fallback
        const refreshEvent = new CustomEvent('refresh-clips', {
          detail: { projectId: props.project!.id },
        });
        document.dispatchEvent(refreshEvent);

        // Also refresh timeline clips to ensure consistency
        await loadTimelineClips(props.project!.id);
      }, 100);
    }
  }

  // Handle general clips data refresh request from Timeline
  function onRefreshClipsData() {
    if (props.project) {
      setTimeout(async () => {
        // Method 1: Direct refresh if MediaPanel ref is available
        if (mediaPanelRef.value) {
          mediaPanelRef.value.refreshClips();
        }

        // Method 2: Event-based refresh as fallback
        const refreshEvent = new CustomEvent('refresh-clips', {
          detail: { projectId: props.project!.id },
        });
        document.dispatchEvent(refreshEvent);

        // Also refresh timeline clips
        await loadTimelineClips(props.project!.id);
      }, 100);
    }
  }

  // Helper to scroll timeline to a specific clip
  function scrollToClipInTimeline(clipId: string) {
    const isFirstClip = timelineClips.value.length > 0 && timelineClips.value[0].id === clipId;

    if (timelineRef.value) {
      if (isFirstClip) {
        // Scroll timeline to the very top with smooth animation
        const timelineContainer = (timelineRef.value as any).$el?.querySelector('.overflow-y-auto');
        if (timelineContainer) {
          timelineContainer.scrollTo({
            top: 0,
            behavior: 'smooth',
          });
        }
      } else {
        // Scroll to the corresponding timeline clip
        timelineRef.value.scrollTimelineClipIntoView(clipId);
      }
    }
  }

  // Clip hover event handlers
  function onClipHover(clipId: string) {
    // If a clip is currently playing and user selects a different clip, stop playback
    if (currentlyPlayingClipId.value && currentlyPlayingClipId.value !== clipId) {
      stopSegmentedPlayback();
      currentlyPlayingClipId.value = null;
    }

    // Clear both states first to ensure no duplicates
    hoveredClipId.value = null;
    hoveredTimelineClipId.value = null;

    // Then set the new state
    hoveredClipId.value = clipId;

    // Scroll to the clip
    scrollToClipInTimeline(clipId);
  }

  // Timeline clip hover/click event handler
  function onTimelineClipHover(clipId: string) {
    // If a clip is currently playing and user selects a different clip, stop playback
    if (currentlyPlayingClipId.value && currentlyPlayingClipId.value !== clipId) {
      stopSegmentedPlayback();
      currentlyPlayingClipId.value = null;
    }

    // Clear both states first to ensure no duplicates
    hoveredClipId.value = null;
    hoveredTimelineClipId.value = null;

    // Then set the new state
    hoveredTimelineClipId.value = clipId;
  }

  // Timeline segment click event handler
  function onTimelineSegmentClick(clipId: string, segmentIndex: number) {
    // Optional: You can add specific handling for segment selection here
    // For now, we'll just log it for debugging
    console.log(`Segment clicked: Clip ${clipId}, Segment ${segmentIndex}`);

    // You could also:
    // - Update a selected segment state
    // - Show segment-specific details
    // - Start playback from that specific segment
    // etc.
  }

  // Scroll event handlers
  function onScrollToTimeline() {
    // Scroll timeline into view if it's not visible
    if (timelineRef.value) {
      const timelineElement = (timelineRef.value as any).$el as HTMLElement;
      if (timelineElement) {
        timelineElement.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }

  function onScrollToMediaPanel(clipId: string) {
    // Scroll to the specific clip
    if (clipId && mediaPanelRef.value) {
      mediaPanelRef.value.scrollClipIntoView(clipId);
    } else {
      console.log('[ProjectWorkspaceDialog] Cannot scroll - missing clipId or ref');
    }
  }

  // Delete clip handlers
  function onDeleteClip(clipId: string) {
    clipToDelete.value = clipId;
    showDeleteDialog.value = true;
  }

  function handleDeleteDialogClose() {
    showDeleteDialog.value = false;
    clipToDelete.value = null;
  }

  async function deleteClipConfirmed() {
    if (!clipToDelete.value) return;

    try {
      await deleteClip(clipToDelete.value);

      // Refresh clips and timeline
      if (props.project) {
        // Refresh clips panel
        setTimeout(() => {
          const refreshEvent = new CustomEvent('refresh-clips', {
            detail: { projectId: props.project!.id },
          });
          document.dispatchEvent(refreshEvent);
        }, 100);

        // Refresh timeline clips
        await loadTimelineClips(props.project.id);
      }

      // Show success message
      const { success } = useToast();
      success('Clip Deleted', 'The clip has been permanently deleted.');

      // Emit refresh event to update Projects page
      setTimeout(() => {
        const refreshEvent = new CustomEvent('refresh-clips-projects', {
          detail: { projectId: props.project!.id },
        });
        document.dispatchEvent(refreshEvent);
      }, 100);
    } catch (error) {
      console.error('[ProjectWorkspaceDialog] Failed to delete clip:', error);

      // Show error message
      const { error: showError } = useToast();
      showError('Delete Failed', 'Failed to delete the clip. Please try again.');
    } finally {
      handleDeleteDialogClose();
    }
  }

  // Transform ClipWithVersion to Timeline's Clip format
  function transformClipsForTimeline(clipsWithVersion: ClipWithVersion[]): any[] {
    return clipsWithVersion
      .map((clip) => {
        const version = clip.current_version;

        if (!version) {
          console.warn('[ProjectWorkspaceDialog] Clip missing current version:', clip.id);
          return null;
        }

        // Use segments from database if available, otherwise create single segment from version timing
        let segments: any[] = [];
        if (
          clip.current_version_segments &&
          Array.isArray(clip.current_version_segments) &&
          clip.current_version_segments.length > 0
        ) {
          // Use the proper segments from database
          segments = clip.current_version_segments.map((segment: any) => ({
            start_time: segment.start_time,
            end_time: segment.end_time,
            duration: segment.duration || segment.end_time - segment.start_time,
            transcript: segment.transcript || version.description || 'No transcript available',
          }));
        } else {
          // Fallback: create single segment from version timing
          segments = [
            {
              start_time: version.start_time,
              end_time: version.end_time,
              duration: version.end_time - version.start_time,
              transcript: version.description || 'No transcript available',
            },
          ];
        }

        // Determine clip type based on segments
        const clipType = segments.length > 1 ? 'spliced' : 'continuous';

        // Transform to Timeline's Clip interface
        // IMPORTANT: Include current_version_virality_score and session_prompt to match ClipsTab sorting
        return {
          id: clip.id,
          title: version.name || clip.name || 'Untitled Clip',
          filename: clip.file_path || 'clip.mp4',
          type: clipType,
          segments: segments,
          total_duration: version.end_time - version.start_time,
          combined_transcript: version.description || 'No transcript available',
          virality_score: clip.current_version_virality_score || version.virality_score || 0,
          current_version_virality_score: clip.current_version_virality_score || version.virality_score || 0,
          reason: version.detection_reason || 'AI detected clip-worthy moment',
          socialMediaPost: `${version.name || 'Clip'} - ${version.description || 'Interesting moment'}`,
          run_number: clip.run_number,
          run_color: clip.session_run_color,
          session_prompt: clip.session_prompt, // Include for sorting (manual clips detection)
        };
      })
      .filter(Boolean); // Remove any null entries
  }

  // Load clips for timeline
  async function loadTimelineClips(projectId: string) {
    if (!projectId) {
      timelineClips.value = [];
      return;
    }

    try {
      const clipsWithVersion = await getClipsWithVersionsByProjectId(projectId);

      timelineClips.value = transformClipsForTimeline(clipsWithVersion);
    } catch (error) {
      timelineClips.value = [];
    }
  }

  function onVideoElementReady(element: HTMLVideoElement) {
    videoElement.value = element;
  }

  function getCurrentPlayingClipId(): string | null {
    return currentlyPlayingClipId.value;
  }

  // Handle subtitle settings change
  function onSubtitleSettingsChanged(settings: SubtitleSettings) {
    subtitleSettings.value = settings;
  }

  // Handle watermark settings change
  async function onWatermarkSettingsChanged(settings: WatermarkSettings) {
    watermarkSettings.value = settings;

    // Load watermark data if we have a watermark ID
    if (settings.watermarkId && settings.enabled) {
      try {
        const watermark = await getWatermarkImage(settings.watermarkId);
        if (watermark) {
          // Load the image as data URL
          const dataUrl = await invoke<string>('read_file_as_data_url', {
            filePath: watermark.file_path,
          });
          currentWatermarkData.value = {
            dataUrl,
            width: watermark.width || undefined,
            height: watermark.height || undefined,
          };
        }
      } catch (error) {
        console.error('[ProjectWorkspaceDialog] Failed to load watermark:', error);
        currentWatermarkData.value = null;
      }
    } else {
      currentWatermarkData.value = null;
    }
  }

  // Handle audio settings changed from MediaPanel
  function onAudioSettingsChanged(settings: AudioSettings) {
    audioGainDb.value = settings.volume;
  }

  // Load creator profile and apply their default settings
  async function loadCreatorProfileSettings(projectId: string) {
    try {
      const profile = await getCreatorProfileByProjectId(projectId);
      creatorProfile.value = profile;

      // Reset creator defaults
      creatorDefaultIntro.value = null;
      creatorDefaultOutro.value = null;

      if (profile) {
        console.log('[ProjectWorkspaceDialog] Found creator profile:', profile.name);

        // Apply watermark settings from creator profile
        if (profile.watermark_id) {
          console.log('[ProjectWorkspaceDialog] Applying creator watermark:', profile.watermark_id);
          const newSettings = {
            ...watermarkSettings.value,
            enabled: true,
            watermarkId: profile.watermark_id,
          };

          // Wait for next tick to ensure MediaPanel ref is available
          await nextTick();

          // Update MediaPanel's internal state if ref is available
          if (mediaPanelRef.value) {
            mediaPanelRef.value.setWatermarkSettings(newSettings);
          } else {
            // Fallback: just update parent state directly
            await onWatermarkSettingsChanged(newSettings);
          }
        }

        // Load creator's default intro (will be auto-applied when building clips)
        if (profile.intro_id) {
          const intro = await getIntroOutroById(profile.intro_id);
          if (intro) {
            creatorDefaultIntro.value = intro;
            console.log('[ProjectWorkspaceDialog] Loaded creator default intro:', intro.name);
          }
        }

        // Load creator's default outro (will be auto-applied when building clips)
        if (profile.outro_id) {
          const outro = await getIntroOutroById(profile.outro_id);
          if (outro) {
            creatorDefaultOutro.value = outro;
            console.log('[ProjectWorkspaceDialog] Loaded creator default outro:', outro.name);
          }
        }
      }
    } catch (error) {
      console.error('[ProjectWorkspaceDialog] Failed to load creator profile:', error);
      creatorProfile.value = null;
      creatorDefaultIntro.value = null;
      creatorDefaultOutro.value = null;
    }
  }

  // Function to handle clip playback
  function onPlayClip(clip: any) {
    // Clear all previous selection states when starting playback
    hoveredClipId.value = null;
    hoveredTimelineClipId.value = null;

    // Force clear any lingering hover states
    setTimeout(() => {
      hoveredClipId.value = null;
      hoveredTimelineClipId.value = null;
    }, 10);

    // Track the currently playing clip
    currentlyPlayingClipId.value = clip.id;

    // Scroll timeline to the clip
    scrollToClipInTimeline(clip.id);

    // Get segments from the clip
    let segments: any[] = [];

    if (
      clip.current_version_segments &&
      Array.isArray(clip.current_version_segments) &&
      clip.current_version_segments.length > 0
    ) {
      // Use the proper segments from database
      segments = clip.current_version_segments.map((segment: any) => ({
        id: segment.id,
        clip_version_id: segment.clip_version_id,
        segment_index: segment.segment_index,
        start_time: segment.start_time,
        end_time: segment.end_time,
        duration: segment.duration || segment.end_time - segment.start_time,
        transcript: segment.transcript || null,
        created_at: segment.created_at,
      }));
    } else if (clip.current_version) {
      // Fallback: create single segment from version timing
      segments = [
        {
          id: `fallback-${clip.id}`,
          clip_version_id: clip.current_version.id || clip.id,
          segment_index: 0,
          start_time: clip.current_version.start_time || 0,
          end_time: clip.current_version.end_time || 0,
          duration: (clip.current_version.end_time || 0) - (clip.current_version.start_time || 0),
          transcript: clip.current_version.description || null,
          created_at: Date.now(),
        },
      ];
    }

    if (segments.length > 0) {
      playClipSegments(segments);
    } else {
      console.warn('[ProjectWorkspaceDialog] No segments found for clip:', clip.id);
      currentlyPlayingClipId.value = null;
    }
  }

  // Function to handle video seeking from clip clicks
  function onSeekVideo(time: number) {
    if (videoElement.value) {
      // Stop any existing segment playback
      stopSegmentedPlayback();

      // Clear currently playing clip
      currentlyPlayingClipId.value = null;

      // Seek to the specified time
      videoElement.value.currentTime = time;
    }
  }

  // Function to scroll to and highlight a specific clip in both ClipsTab and Timeline
  async function scrollToAndSelectClip(clipId: string) {
    // Wait for DOM to update
    await nextTick();

    // Small delay to ensure components are fully mounted
    setTimeout(() => {
      // Clear any existing hover states first
      hoveredClipId.value = null;
      hoveredTimelineClipId.value = null;

      // Use another nextTick to ensure the clear has propagated
      nextTick(() => {
        // Scroll in MediaPanel/ClipsTab
        if (mediaPanelRef.value) {
          mediaPanelRef.value.scrollClipIntoView(clipId);
        }

        // Scroll in Timeline
        scrollToClipInTimeline(clipId);

        // Set BOTH hover states to highlight the clip in both places
        // hoveredClipId highlights in ClipsTab, hoveredTimelineClipId highlights in Timeline
        hoveredClipId.value = clipId;
        hoveredTimelineClipId.value = clipId;
      });
    }, 300);
  }

  // Watch for dialog open/close
  watch(
    () => props.modelValue,
    async (newValue) => {
      if (newValue) {
        await loadVideos();
        await loadVideoForProject();
        // Load timeline clips when dialog opens
        if (props.project) {
          await loadTimelineClips(props.project.id);

          // Load creator profile and apply their default settings (watermark, etc.)
          await loadCreatorProfileSettings(props.project.id);

          // Check if this project has active detection and restore state
          const detectionState = getDetectionState(props.project.id);
          if (detectionState && detectionState.isActive) {
            clipGenerationInProgress.value = true;
            frontendProgress.value = detectionState.progress;
            frontendStage.value = detectionState.stage;
            frontendMessage.value = detectionState.message;
            frontendError.value = detectionState.error;
          }

          // If an initial clip ID was provided, scroll to and select it
          if (props.initialClipId) {
            await scrollToAndSelectClip(props.initialClipId);
          }
        }
      } else {
        // Reset video state when dialog closes
        resetVideoState();
        showProgress.value = false;
        // Clear timeline clips
        timelineClips.value = [];
        // Reset LOCAL clip generation state (global tracking persists)
        clipGenerationInProgress.value = false;
        // Reset frontend progress tracking
        frontendProgress.value = 0;
        frontendStage.value = '';
        frontendMessage.value = '';
        frontendError.value = '';
        // Reset backend progress tracking
        resetProgress();
        // Clear creator profile
        creatorProfile.value = null;
      }
    }
  );

  // Watch for project changes
  watch(
    () => props.project?.id,
    (newProjectId, oldProjectId) => {
      if (newProjectId) {
        setProgressProjectId(newProjectId.toString());
      } else {
        setProgressProjectId(null);
      }

      // When switching projects, restore state from global tracking if available
      if (newProjectId && newProjectId !== oldProjectId) {
        const detectionState = getDetectionState(newProjectId);
        if (detectionState && detectionState.isActive) {
          // Restore active detection state for this project
          clipGenerationInProgress.value = true;
          frontendProgress.value = detectionState.progress;
          frontendStage.value = detectionState.stage;
          frontendMessage.value = detectionState.message;
          frontendError.value = detectionState.error;
        } else {
          // No active detection - start with clean slate
          clipGenerationInProgress.value = false;
          frontendProgress.value = 0;
          frontendStage.value = '';
          frontendMessage.value = '';
          frontendError.value = '';
          resetProgress();
        }
      }
    }
  );

  // Watch for dialog close to disconnect socket
  watch(
    () => props.modelValue,
    (newValue) => {
      if (!newValue) {
        // Disconnect progress socket when dialog closes
        setProgressProjectId(null);
      }
    }
  );

  // Watch global detection state for this project and sync to local state
  // This ensures UI updates when detection progresses (even if dialog was closed and reopened)
  watch(
    () => (props.project?.id ? getDetectionState(props.project.id) : null),
    (newState) => {
      if (!props.modelValue || !props.project) return; // Only sync when dialog is open

      if (newState && newState.isActive) {
        // Detection is active - sync state
        clipGenerationInProgress.value = true;
        frontendProgress.value = newState.progress;
        frontendStage.value = newState.stage;
        frontendMessage.value = newState.message;
        frontendError.value = newState.error;
      } else if (newState && !newState.isActive && clipGenerationInProgress.value) {
        // Detection just completed - update local state
        clipGenerationInProgress.value = false;
        frontendProgress.value = newState.progress;
        frontendStage.value = newState.stage;
        frontendMessage.value = newState.message;
        frontendError.value = newState.error;
      }
    },
    { deep: true }
  );

  // Watch for progress socket errors and show toasts
  watch(clipError, (newError) => {
    if (newError && clipGenerationInProgress.value) {
      showError(
        'Processing Error',
        newError.includes('No credits were charged') ? newError : `${newError}. No credits were charged.`,
        8000
      );
    }
  });

  // Watch for generation completion to trigger clips refresh
  watch([clipGenerationInProgress, clipProgress], async ([isInProgress, progress]) => {
    if (!isInProgress && progress === 100 && props.project) {
      // Trigger clips refresh with a longer delay to ensure all database operations are complete
      setTimeout(async () => {
        const refreshEvent = new CustomEvent('refresh-clips', {
          detail: { projectId: props.project!.id },
        });
        document.dispatchEvent(refreshEvent);

        // Also refresh Projects page to update clip counts
        const projectsRefreshEvent = new CustomEvent('refresh-clips-projects', {
          detail: { projectId: props.project!.id },
        });
        document.dispatchEvent(projectsRefreshEvent);

        // Also refresh timeline clips
        await loadTimelineClips(props.project!.id);

        // IMPORTANT: Reload transcript data for timeline tooltips
        // This fixes the issue where transcript tooltips don't show on first hover after clip detection
        if (timelineRef.value && timelineRef.value.loadTranscriptData) {
          await timelineRef.value.loadTranscriptData(props.project!.id);
        }
      }, 1500);
    }
  });

  // Watch for segmented playback state changes
  watch([isPlayingSegments, segmentPlaybackEnded], ([isPlaying, ended]) => {
    if (!isPlaying && ended) {
      // Clear the currently playing clip when playback ends
      currentlyPlayingClipId.value = null;
    }
  });

  // Watch for dialog close to reset playback state
  watch(
    () => props.modelValue,
    (newValue) => {
      if (!newValue) {
        currentlyPlayingClipId.value = null;
        stopSegmentedPlayback();
      }
    }
  );
</script>
