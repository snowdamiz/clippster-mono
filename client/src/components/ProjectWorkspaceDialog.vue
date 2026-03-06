<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="workspace-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="workspace-dialog" role="dialog" aria-modal="true">
            <!-- Header -->
            <div class="workspace-dialog__header">
              <div class="workspace-dialog__header-left">
                <div class="workspace-dialog__header-icon">
                  <Film :size="14" />
                </div>
                <h2 class="workspace-dialog__title" :title="project?.name || 'New Project'">
                  {{ project?.name || 'New Project' }}
                </h2>
                <span
                  v-if="vodPresetConfig"
                  class="workspace-dialog__vod-badge"
                  :title="`VOD Pre-Edit: ${vodPresetConfig.targetAspectRatio}`"
                >
                  {{ vodPresetConfig.targetAspectRatio }} Pre-Edit
                </span>
              </div>
              <button class="workspace-dialog__close" @click="close" title="Close (Esc)">
                <X :size="16" />
              </button>
            </div>

            <!-- Main Content Area -->
            <div class="workspace-dialog__content">
              <!-- Left Column: Video Player & Controls -->
              <div
                ref="videoPlayerSectionRef"
                class="workspace-dialog__player-column"
                :class="{ 'workspace-dialog__player-column--fullscreen': isFullscreen }"
              >
                <!-- Video Player Container -->
                <div class="workspace-dialog__video-wrapper">
                  <VideoPlayer
                    :video-src="videoSrc"
                    :video-loading="videoLoading"
                    :video-error="videoError"
                    :is-playing="isPlaying"
                    :aspect-ratio="selectedAspectRatio"
                    :focal-point="effectiveFocalPoint"
                    :framing-regions="vodPresetConfig?.framingConfig?.regions"
                    :watermark-settings="watermarkSettings"
                    :watermark-data="currentWatermarkData"
                    @togglePlayPause="togglePlayPause"
                    @timeUpdate="onTimeUpdate"
                    @loadedMetadata="onLoadedMetadata"
                    @videoEnded="onVideoEnded"
                    @videoError="onVideoError"
                    @loadStart="onLoadStart"
                    @canPlay="onCanPlay"
                    @retryLoad="loadVideoForProject"
                    @videoElementReady="onVideoElementReady"
                    @watermarkIdChange="onWatermarkIdChange"
                  />
                </div>

                <!-- Video Controls Bar -->
                <VideoControls
                  :video-src="videoSrc"
                  :video-loading="videoLoading"
                  :is-playing="isPlaying"
                  :current-time="currentTime"
                  :duration="duration"
                  :volume="volume"
                  :is-muted="isMuted"
                  :is-fullscreen="isFullscreen"
                  @togglePlayPause="togglePlayPause"
                  @toggleMute="toggleMute"
                  @updateVolume="updateVolume"
                  @goToBeginning="goToBeginning"
                  @toggleFullscreen="toggleFullscreen"
                  @seekTo="seekToTime"
                />
              </div>

              <!-- Right Column: Tabs (Clips / Transcript) -->
              <div class="workspace-dialog__media-column">
                <!-- Tab Bar -->
                <div class="workspace-dialog__tab-bar">
                  <button
                    class="workspace-dialog__tab"
                    :class="{ 'workspace-dialog__tab--active': rightPanelTab === 'clips' }"
                    @click="rightPanelTab = 'clips'"
                  >
                    Clips
                  </button>
                  <button
                    class="workspace-dialog__tab"
                    :class="{
                      'workspace-dialog__tab--active': rightPanelTab === 'transcript',
                      'workspace-dialog__tab--has-transcript': isTranscribed,
                    }"
                    @click="rightPanelTab = 'transcript'"
                  >
                    Transcript
                    <span v-if="isTranscribed" class="workspace-dialog__tab-badge">✓</span>
                  </button>
                </div>

                <!-- Clips Tab -->
                <MediaPanel
                  v-show="rightPanelTab === 'clips'"
                  ref="mediaPanelRef"
                  :is-generating="clipGenerationInProgress"
                  :generation-progress="clipProgress"
                  :generation-stage="clipStage"
                  :generation-message="clipMessage"
                  :generation-error="clipError"
                  :project-id="project?.id"
                  :hovered-timeline-clip-id="hoveredTimelineClipId"
                  :is-playing-segments="isPlayingSegments"
                  :playing-clip-id="currentlyPlayingClipId"
                  :video-duration="duration"
                  :current-time="currentTime"
                  :aspect-ratio="selectedAspectRatio"
                  :creator-default-intro="creatorDefaultIntro"
                  :creator-default-outro="creatorDefaultOutro"
                  :creator-profile-server-id="creatorProfileServerId"
                  :is-transcribing="isTranscribing"
                  :transcribe-progress="transcribeProgressValue"
                  :transcribe-stage="transcribeStage"
                  :transcribe-message="transcribeMessage"
                  :vod-preset-config="vodPresetConfig"
                  @detectClips="onDetectClips"
                  @cancelDetection="onCancelDetection"
                  @clipHover="onClipHover"
                  @scrollToTimeline="onScrollToTimeline"
                  @deleteClip="onDeleteClip"
                  @playClip="onPlayClip"
                  @seekVideo="onSeekVideo"
                  @watermarkSettingsChanged="onWatermarkSettingsChanged"
                  @editClip="onEditClip"
                  @addClip="onAddClip"
                  @transcribeProject="onTranscribeProject"
                  @cancelTranscription="onCancelTranscription"
                  @viewTranscript="rightPanelTab = 'transcript'"
                />

                <!-- Transcript Tab -->
                <div v-show="rightPanelTab === 'transcript'" class="flex flex-col flex-1 h-full min-h-0 px-4">
                  <TranscriptPanel
                    :project-id="project?.id"
                    :current-time="currentTime"
                    :duration="duration"
                    :hide-header="false"
                    @seekTo="seekToTime"
                    @createClipFromTranscript="onCreateClipFromTranscript"
                    @deleteTimeRange="onDeleteTimeRange"
                    @splitAtTime="onSplitAtTime"
                  />
                </div>
              </div>
            </div>

            <!-- Timeline Section -->
            <div class="workspace-dialog__timeline">
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
                @seekTimeline="seekTimeline"
                @timelineTrackHover="onTimelineTrackHover"
                @timelineMouseLeave="onTimelineMouseLeave"
                @timelineClipHover="onTimelineClipHover"
                @timelineSegmentClick="onTimelineSegmentClick"
                @scrollToMediaPanel="onScrollToMediaPanel"
                @zoomChanged="handleTimelineZoomChanged"
                @segmentUpdated="onSegmentUpdated"
                @refreshClipsData="onRefreshClipsData"
                @playFromTime="onPlayFromTime"
                @editClip="onEditClip"
              />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
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
    variant="destructive"
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

  <!-- Transcription Confirmation Dialog -->
  <TranscriptionConfirmDialog
    :model-value="showTranscribeConfirmDialog"
    :video-duration="duration"
    :is-transcribed="isTranscribed"
    @update:model-value="showTranscribeConfirmDialog = $event"
    @confirm="onTranscribeConfirmed"
  />


  <!-- Existing Project Dialog -->
  <ExistingProjectDialog
    :show="showExistingProjectDialog"
    :existing-project="existingProjectForClip"
    @open-existing="onOpenExistingProject"
    @create-new="onCreateNewProject"
    @cancel="onExistingProjectCancel"
  />
</template>

<script setup lang="ts">
  import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue';
  import {
    type Project,
    type ClipWithVersion,
    type CreatorProfileWithLinks,
    type IntroOutro,
    getClipsWithVersionsByProjectId,
    deleteClip,
    getWatermarkByServerId,
    getCreatorProfileByProjectId,
    getIntroOutroById,
    getProject,
    createClipVersion,
    updateClip,
    getOrCreateManualSession,
  } from '@/services/database';
  import { resolveBrandingProfile } from '@/composables/useBrandingProfileSelection';
  import { getWatermarkImage } from '@/services/database/watermarks';
  import { getVideoEditorProjectsForClip, type VideoEditorProject } from '@/services/database';
  import { X, Film } from 'lucide-vue-next';
  import { invoke } from '@tauri-apps/api/core';
  import type { WatermarkSettings } from '@/types';
  import VideoPlayer from './VideoPlayer.vue';
  import VideoControls from './VideoControls.vue';
  import MediaPanel from './MediaPanel.vue';
  import Timeline from './Timeline.vue';
  import ClipGenerationProgress from './ClipGenerationProgress.vue';
  import ConfirmationModal from './ConfirmationModal.vue';
  import ClipDetectionConfirmDialog from './ClipDetectionConfirmDialog.vue';
  import TranscriptionConfirmDialog from './TranscriptionConfirmDialog.vue';
  import TranscriptPanel from './TranscriptPanel.vue';
  import { useTranscriptionOnly } from '@/composables/useTranscriptionOnly';
  import { useRouter } from 'vue-router';
  import ExistingProjectDialog from './clip-editor/ExistingProjectDialog.vue';
  import { createVideoEditorProjectFromClip } from '@/services/video-editor-project-creator';
  import { useInEditorClips } from '@/stores/useInEditorClips';
  import { useVideoPlayer } from '@/composables/useVideoPlayer';
  import { useProgressSocket } from '@/composables/useProgressSocket';
  import { useToast } from '@/composables/useToast';
  import { useWindowClose } from '@/composables/useWindowClose';
  import { useVideoFocalPoint } from '@/composables/useVideoFocalPoint';
  import { useTranscriptData } from '@/composables/useTranscriptData';
  import { getUserOrganizationAssets } from '@/services/organizationAssetsApi';
  import { ensureAssetDownloaded } from '@/services/orgAssetSync';
  import { useClipDetectionTracking } from '@/composables/useClipDetectionTracking';
  import { useAuthStore } from '@/stores/auth';
  import { getRawVideosByProjectId } from '@/services/database';
  import { getProjectVodPresetConfig } from '@/services/database/vod-presets';
  import type { ActiveVodPresetConfig } from '@/types';

  const authStore = useAuthStore();
  const { error: showError } = useToast();
  const { hasAnyActiveDetection, startDetection, updateProgress, completeDetection, getDetectionState } =
    useClipDetectionTracking();
  const { setClipGenerationInProgress } = useWindowClose();
  const inEditorStore = useInEditorClips();
  inEditorStore.hydrate();

  const props = defineProps<{
    modelValue: boolean;
    project?: Project | null;
    /** Optional clip ID to preselect and scroll to when dialog opens */
    initialClipId?: string | null;
  }>();

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
  }>();

  const router = useRouter();

  // Progress state
  const showProgress = ref(false);
  const clipGenerationInProgress = ref(false);

  // Delete state
  const showDeleteDialog = ref(false);
  const clipToDelete = ref<string | null>(null);

  // Clip detection confirmation state
  const showDetectConfirmDialog = ref(false);

  // Transcription confirmation state
  const showTranscribeConfirmDialog = ref(false);

  // Right panel tab state
  const rightPanelTab = ref<'clips' | 'transcript'>('clips');

  // Transcription progress state
  const isTranscribing = ref(false);
  const transcribeProgressValue = ref(0);
  const transcribeStage = ref('');
  const transcribeMessage = ref('');
  const cancelTranscriptionFn = ref<(() => void) | null>(null);

  const isCreatingProject = ref(false);

  // Existing project dialog state (shown when clip has been edited before)
  const showExistingProjectDialog = ref(false);
  const existingProjectForClip = ref<VideoEditorProject | null>(null);
  const pendingClipToEdit = ref<{
    clipId: string;
    startTime: number;
    endTime: number;
    title: string;
    segments: { start_time: number; end_time: number }[];
  } | null>(null);

  // Segmented playback tracking
  const currentlyPlayingClipId = ref<string | null>(null);

  // Timeline clips state
  const timelineClips = ref<any[]>([]);

  // Hover state for bidirectional highlighting
  const hoveredClipId = ref<string | null>(null);
  const hoveredTimelineClipId = ref<string | null>(null);

  // Component refs for scrolling
  const mediaPanelRef = ref<InstanceType<typeof MediaPanel> | null>(null);
  const timelineRef = ref<InstanceType<typeof Timeline> | null>(null);

  // Video player section ref for fullscreen
  const videoPlayerSectionRef = ref<HTMLElement | null>(null);
  const isFullscreen = ref(false);

  // Aspect ratio state
  const selectedAspectRatio = ref({ width: 16, height: 9 });

  // VOD preset config state
  const vodPresetConfig = ref<ActiveVodPresetConfig | null>(null);

  // VOD framing focal point override (computed from framing regions)
  const vodFocalPointOverride = ref<{ x: number; y: number } | null>(null);

  // Watermark settings state
  const watermarkSettings = ref<WatermarkSettings>({
    enabled: false,
    watermarkId: null,
    positionX: 12,
    positionY: 92,
    opacity: 80,
    scale: 20,
  });

  // Current watermark image data (for VideoPlayer)
  const currentWatermarkData = ref<{ dataUrl: string; width?: number; height?: number } | null>(null);
  const currentWatermarkId = ref<string | null>(null);

  // Helper to normalize aspect ratio string
  const normalizedAspectRatio = computed(() => {
    const { width, height } = selectedAspectRatio.value;
    const ratio = width / height;
    if (Math.abs(ratio - 16 / 9) < 0.01) return '16:9';
    if (Math.abs(ratio - 9 / 16) < 0.01) return '9:16';
    if (Math.abs(ratio - 1) < 0.01) return '1:1';
    if (Math.abs(ratio - 4 / 5) < 0.01) return '4:5';
    return `${width}:${height}`;
  });

  // Watch for settings or aspect ratio changes to load correct watermark data
  watch(
    [watermarkSettings, normalizedAspectRatio],
    async ([settings, aspectRatioStr]) => {
      console.log('[ProjectWorkspaceDialog] Watermark watcher triggered:', {
        enabled: settings.enabled,
        watermarkId: settings.watermarkId,
        aspectRatio: aspectRatioStr,
        currentWatermarkData: !!currentWatermarkData.value,
      });
      
      if (!settings.enabled) {
        console.log('[ProjectWorkspaceDialog] Watermark disabled, clearing data');
        currentWatermarkData.value = null;
        currentWatermarkId.value = null;
        return;
      }

      // Determine target watermark ID (may be different per aspect ratio)
      let targetId = settings.watermarkId;
      const perRatio = settings.perRatioSettings;

      // Skip per-ratio watermark ID overrides when the top-level watermark is an org-asset.
      // For org-asset watermarks (e.g. free tier admin branding), per-ratio configs only
      // carry position data — the watermarkId inside them is the admin's local SQLite UUID
      // which free tier users do not have in their database.
      const isOrgAsset = targetId?.startsWith('org-asset-');
      if (!isOrgAsset && perRatio && perRatio[aspectRatioStr as keyof typeof perRatio]) {
        const config = perRatio[aspectRatioStr as keyof typeof perRatio];
        if (config && config.watermarkId) {
          targetId = config.watermarkId;
          console.log('[ProjectWorkspaceDialog] Using per-ratio watermark ID:', targetId, 'for', aspectRatioStr);
        }
      }

      // Only reload if the watermark ID changed
      if (targetId !== currentWatermarkId.value) {
        console.log('[ProjectWorkspaceDialog] Watermark ID changed, loading:', targetId);
        currentWatermarkId.value = targetId;
        // Use loadWatermarkDataById which handles both local and org-asset watermarks
        await loadWatermarkDataById(targetId);
      } else {
        console.log('[ProjectWorkspaceDialog] Watermark ID unchanged, skipping reload');
      }
    },
    { deep: true, immediate: true }
  );

  // Creator profile associated with this project (for preconfiguring settings)
  const creatorProfile = ref<CreatorProfileWithLinks | null>(null);
  const creatorProfileServerId = ref<number | null>(null);

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

  // Initialize progress socket
  const {
    isConnected: progressConnected,
    progress: backendProgress,
    stage: backendStage,
    message: backendMessage,
    error: backendError,
    setProjectId: setProgressProjectId,
    reset: resetProgress,
  } = useProgressSocket(null);

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
    // "finalizing" is a frontend-only stage that occurs AFTER backend completes
    // It must take precedence over backend "completed" stage
    if (frontendStage.value === 'finalizing') {
      return 'finalizing';
    }
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
    seekToTime,
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
    loadVideoFromPath,
    resetVideoState,
    playClipSegments,
    stopSegmentedPlayback,
    isPlayingSegments,
    segmentPlaybackEnded,
  } = useVideoPlayer(projectRef);

  // Initialize focal point composable
  const { currentFocalPoint, loadFocalPoints, updateTime, reset: resetFocalPoint } = useVideoFocalPoint();
  const effectiveFocalPoint = computed(() => vodFocalPointOverride.value || currentFocalPoint.value);

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

  // Toggle fullscreen for video player section
  async function toggleFullscreen() {
    const element = videoPlayerSectionRef.value;
    if (!element) return;

    try {
      if (!document.fullscreenElement) {
        await element.requestFullscreen();
        isFullscreen.value = true;
      } else {
        await document.exitFullscreen();
        isFullscreen.value = false;
      }
    } catch (err) {
      console.error('[ProjectWorkspaceDialog] Fullscreen error:', err);
    }
  }

  // Handle fullscreen change events (e.g., user presses Escape)
  function handleFullscreenChange() {
    isFullscreen.value = !!document.fullscreenElement;
  }

  // Handle keyboard shortcuts for video player
  function handleKeydown(event: KeyboardEvent) {
    // Only handle if dialog is open and not typing in an input
    if (!props.modelValue) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

    // F key for fullscreen
    if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      toggleFullscreen();
    }
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

  /**
   * Handle add clip request (for non-AI users).
   * Activates the add clip mode on the Timeline so users can manually select a time range.
   */
  function onAddClip() {
    if (timelineRef.value && timelineRef.value.toggleAddClipMode) {
      timelineRef.value.toggleAddClipMode();
    }
  }

  function onTranscribeProject() {
    if (!authStore.isAuthenticated) {
      window.dispatchEvent(new CustomEvent('show-auth-modal'));
      return;
    }
    showTranscribeConfirmDialog.value = true;
  }

  async function onTranscribeConfirmed(organizationId: number | null = null) {
    if (!props.project?.id) return;

    const projectId = props.project.id;
    const { transcribeProject, progress: tProgress, cancelTranscription } = useTranscriptionOnly();

    isTranscribing.value = true;
    transcribeProgressValue.value = 0;
    transcribeStage.value = 'initializing';
    transcribeMessage.value = 'Starting transcription...';

    // Store cancel function
    cancelTranscriptionFn.value = cancelTranscription;

    // Watch transcription progress
    const stopWatch = watch(tProgress, (p) => {
      if (props.project?.id === projectId) {
        transcribeProgressValue.value = p.progress;
        transcribeStage.value = p.stage;
        transcribeMessage.value = p.message;
      }
    }, { deep: true });

    try {
      const result = await transcribeProject(projectId, { organizationId });

      if (result.success) {
        const { success: showSuccess } = useToast();
        if (result.alreadyTranscribed) {
          showSuccess('Already Transcribed', 'This video already has a transcript.');
        } else {
          showSuccess('Transcription Complete', 'Transcript is ready for viewing.');
        }
        // Auto-switch to transcript tab after successful transcription
        rightPanelTab.value = 'transcript';
      }
    } catch (err) {
      console.error('[ProjectWorkspaceDialog] Transcription failed:', err);
    } finally {
      stopWatch();
      isTranscribing.value = false;
      transcribeProgressValue.value = 0;
      transcribeStage.value = '';
      transcribeMessage.value = '';
      cancelTranscriptionFn.value = null;
    }
  }

  async function onCreateClipFromTranscript(startTime: number, endTime: number, transcriptText: string) {
    if (!props.project?.id) return;

    try {
      const { createManualClip } = await import('@/services/database/manual-clips');

      // Auto-generate clip name from transcript text (first ~50 chars)
      const clipName = transcriptText.length > 50
        ? transcriptText.substring(0, 50).trim() + '...'
        : transcriptText.trim();

      await createManualClip(props.project.id, {
        name: clipName || 'Transcript Clip',
        startTime,
        endTime,
        description: `Created from transcript selection: "${transcriptText.substring(0, 200)}"`,
      });

      const { success: showSuccess } = useToast();
      showSuccess('Clip Created', `Clip "${clipName}" created from transcript selection.`);

      // Refresh clips in the MediaPanel
      onRefreshClipsData();

      // Switch to clips tab to show the new clip
      rightPanelTab.value = 'clips';
    } catch (err) {
      console.error('[ProjectWorkspaceDialog] Failed to create clip from transcript:', err);
      const { error: showErr } = useToast();
      showErr('Clip Creation Failed', 'Failed to create clip from transcript selection.');
    }
  }

  function onDeleteTimeRange(startTime: number, endTime: number) {
    console.log('[ProjectWorkspaceDialog] Delete time range:', startTime, '-', endTime);
    // In the workspace dialog context, transcript delete removes the time range from clips
    // by adjusting clip boundaries. This is a non-destructive operation on the source video.
    const { success: showSuccess } = useToast();
    showSuccess('Time Range Marked', `Marked ${(endTime - startTime).toFixed(1)}s for removal. Clips will be adjusted.`);
  }

  function onSplitAtTime(time: number) {
    console.log('[ProjectWorkspaceDialog] Split at time:', time);
    // In the workspace dialog context, splitting creates a new clip boundary at the given time
    const { success: showSuccess } = useToast();
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    showSuccess('Split Point', `Split point set at ${mins}:${secs.toString().padStart(2, '0')}.`);
  }

  function onCancelTranscription() {
    if (cancelTranscriptionFn.value) {
      cancelTranscriptionFn.value();
      cancelTranscriptionFn.value = null;
    }
    isTranscribing.value = false;
    transcribeProgressValue.value = 0;
    transcribeStage.value = 'cancelled';
    transcribeMessage.value = 'Transcription cancelled';
    const { success: showSuccess } = useToast();
    showSuccess('Transcription Cancelled', 'Transcription was cancelled.');
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

  async function onDetectClipsConfirmed(
    _promptId: string,
    promptContent: string,
    organizationId: number | null = null,
    multimodal: boolean = false
  ) {
    console.log('[ProjectWorkspaceDialog] === DETECT CLIPS CONFIRMED ===');
    console.log('[ProjectWorkspaceDialog] _promptId:', _promptId);
    console.log('[ProjectWorkspaceDialog] promptContent length:', promptContent?.length);
    console.log('[ProjectWorkspaceDialog] organizationId:', organizationId);
    console.log('[ProjectWorkspaceDialog] multimodal:', multimodal);
    console.log('[ProjectWorkspaceDialog] arguments count:', arguments.length);

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
          updateProgress(projectId, newProgress.progress, newProgress.stage, newProgress.message, newProgress.error || '');

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
          organizationId: organizationId,
          multimodal: multimodal,
        });

        if (result.success) {
          console.log('[ProjectWorkspaceDialog] Enhanced clip detection successful');

          // Show finalizing state while we prepare thumbnails
          if (props.project?.id === projectId) {
            frontendProgress.value = 100;
            frontendStage.value = 'finalizing';
            frontendMessage.value = 'Generating thumbnails...';
            console.log('[ProjectWorkspaceDialog] Set stage to finalizing, clipStage is now:', clipStage.value);
          }

          // Wait for Vue to process the stage update before loading clips
          await nextTick();
          console.log('[ProjectWorkspaceDialog] After nextTick, clipStage:', clipStage.value);

          // Load clips with thumbnails BEFORE clearing the progress state
          // This ensures thumbnails are ready when the clips UI appears
          try {
            // Refresh clips data in MediaPanel
            if (mediaPanelRef.value) {
              console.log('[ProjectWorkspaceDialog] Starting refreshClips...');
              await mediaPanelRef.value.refreshClips();
              console.log('[ProjectWorkspaceDialog] Clips refreshed, starting thumbnail generation...');
              // Pre-load thumbnails (this now generates any missing ones too)
              await mediaPanelRef.value.refreshThumbnails?.();
              console.log('[ProjectWorkspaceDialog] Thumbnails loaded');
            }

            // Also refresh timeline clips
            await loadTimelineClips(projectId);

            // Reload transcript data for timeline tooltips
            if (timelineRef.value && timelineRef.value.loadTranscriptData) {
              await timelineRef.value.loadTranscriptData(projectId);
            }

            // Emit refresh events for other components
            const refreshEvent = new CustomEvent('refresh-clips', {
              detail: { projectId },
            });
            document.dispatchEvent(refreshEvent);

            const projectsRefreshEvent = new CustomEvent('refresh-clips-projects', {
              detail: { projectId },
            });
            document.dispatchEvent(projectsRefreshEvent);
          } catch (refreshError) {
            console.error('[ProjectWorkspaceDialog] Error refreshing clips after detection:', refreshError);
          }

          // Wait for Vue to fully process all reactive updates
          await nextTick();

          // Mark detection as complete in global tracking
          completeDetection(projectId);

          // NOW clear the progress state - clips and thumbnails are ready
          if (props.project?.id === projectId) {
            clipGenerationInProgress.value = false;
            frontendProgress.value = 100;
            frontendStage.value = 'completed';
            frontendMessage.value = 'Clip detection completed!';
          }

          // Update window close warning
          setClipGenerationInProgress(hasAnyActiveDetection.value);

          try {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('set_clip_generation_in_progress', { inProgress: hasAnyActiveDetection.value });
          } catch (backendError) {
            console.error('[ProjectWorkspaceDialog] Failed to update backend state:', backendError);
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
      // Only clear progress state for error cases (success case handles its own cleanup)
      // Check if we're in an error state before clearing
      if (frontendError.value || frontendStage.value === 'error') {
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
        }, 2000); // Longer delay for errors so user can see the error message
      }
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

    // Reveal the clip in the timeline (makes it visible if hidden)
    if (timelineRef.value) {
      timelineRef.value.revealClip(clipId);
    }

    // Scroll to the clip after DOM updates (wait for clip to be rendered)
    nextTick(() => {
      scrollToClipInTimeline(clipId);
    });
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
        let version = clip.current_version;

        // If version is missing but we have repaired data in the clip object, use that
        if (!version && clip.current_version_name) {
          version = {
            id: clip.current_version_id,
            name: clip.current_version_name,
            description: clip.current_version_description || null,
            start_time: clip.current_version_start_time ?? clip.start_time ?? 0,
            end_time: clip.current_version_end_time ?? clip.end_time ?? 10,
            virality_score: clip.current_version_virality_score || null,
            detection_reason: clip.current_version_detection_reason || null,
          } as any;
        }

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

  // Auto-repair clips missing current_version by creating a version from clip data
  async function repairClipsMissingVersion(clips: any[]): Promise<void> {
    for (const clip of clips) {
      // Skip if already has a version
      if (clip.current_version_id && clip.current_version_name) {
        continue;
      }

      // Check if clip has basic data we can use to create a version
      const clipName = clip.name || 'Untitled Clip';
      const startTime = clip.start_time ?? 0;
      const endTime = clip.end_time ?? (clip.duration ? startTime + clip.duration : startTime + 10);

      console.log(`[ProjectWorkspaceDialog] Auto-repairing clip missing version: ${clip.id}`);

      try {
        // Get or create a manual session for this clip's project (needed for FK constraint)
        const sessionId = clip.detection_session_id || (await getOrCreateManualSession(clip.project_id));

        // Create a version for this orphaned clip
        const versionId = await createClipVersion(
          clip.id,
          sessionId,
          1,
          {
            name: clipName,
            description: clip.description || undefined,
            startTime,
            endTime,
            viralityScore: clip.virality_score || undefined,
            detectionReason: 'Auto-repaired: clip was missing version record',
          },
          'detected',
          'Auto-created version for legacy clip'
        );

        // Update the clip to point to this version
        await updateClip(clip.id, { current_version_id: versionId });

        // Update the in-memory clip data so transform works
        clip.current_version_id = versionId;
        clip.current_version_name = clipName;
        clip.current_version_start_time = startTime;
        clip.current_version_end_time = endTime;

        console.log(`[ProjectWorkspaceDialog] Repaired clip ${clip.id} with version ${versionId}`);
      } catch (err) {
        console.error(`[ProjectWorkspaceDialog] Failed to repair clip ${clip.id}:`, err);
      }
    }
  }

  // Load clips for timeline
  async function loadTimelineClips(projectId: string) {
    if (!projectId) {
      timelineClips.value = [];
      return;
    }

    try {
      const clipsWithVersion = await getClipsWithVersionsByProjectId(projectId);

      // Auto-repair any clips missing versions
      await repairClipsMissingVersion(clipsWithVersion);

      timelineClips.value = transformClipsForTimeline(clipsWithVersion);
    } catch (error) {
      timelineClips.value = [];
    }
  }

  function onVideoElementReady(element: HTMLVideoElement) {
    videoElement.value = element;
  }

  // Helper to measure watermark dimensions from file path
  async function measureWatermarkDimensions(
    filePath: string
  ): Promise<{ width: number | null; height: number | null }> {
    try {
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath });
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
          resolve({ width: null, height: null });
        };
        img.src = dataUrl;
      });
    } catch {
      return { width: null, height: null };
    }
  }

  // Handle watermark settings change
  async function onWatermarkSettingsChanged(settings: WatermarkSettings) {
    watermarkSettings.value = settings;

    // Load watermark data if we have a watermark ID
    if (settings.watermarkId && settings.enabled) {
      await loadWatermarkDataById(settings.watermarkId);
    } else {
      currentWatermarkData.value = null;
    }
  }

  // Load watermark data by ID (used for initial load and when aspect ratio changes)
  async function loadWatermarkDataById(watermarkId: string | null) {
    console.log('[ProjectWorkspaceDialog] loadWatermarkDataById called with:', watermarkId);
    if (!watermarkId) {
      currentWatermarkData.value = null;
      return;
    }

    try {
      // Check if this is an organization asset (ID format: org-asset-{serverId})
      if (watermarkId.startsWith('org-asset-')) {
        const serverId = parseInt(watermarkId.replace('org-asset-', ''), 10);
        console.log('[ProjectWorkspaceDialog] Loading org watermark with serverId:', serverId);
        if (!isNaN(serverId)) {
          // First try to load from local cache
          const localWatermark = await getWatermarkByServerId(serverId);
          if (localWatermark) {
            console.log('[ProjectWorkspaceDialog] Found cached org watermark:', localWatermark.name);
            const dataUrl = await invoke<string>('read_file_as_data_url', {
              filePath: localWatermark.file_path,
            });
            const measured =
              !localWatermark.width || !localWatermark.height
                ? await measureWatermarkDimensions(localWatermark.file_path)
                : { width: localWatermark.width, height: localWatermark.height };
            currentWatermarkData.value = {
              dataUrl,
              width: measured.width || localWatermark.width || undefined,
              height: measured.height || localWatermark.height || undefined,
            };
            console.log('[ProjectWorkspaceDialog] Org watermark loaded from cache');
            return;
          }

          // Not cached locally - download through Tauri (bypasses CORS)
          console.log('[ProjectWorkspaceDialog] Org watermark not cached, downloading from server...');
          try {
            const serverResponse = await getUserOrganizationAssets();
            if (serverResponse.success && serverResponse.assets) {
              const serverAsset = serverResponse.assets.find((a) => a.id === serverId && a.asset_type === 'watermark');
              if (serverAsset && serverAsset.url) {
                console.log('[ProjectWorkspaceDialog] Downloading org watermark:', serverAsset.name);
                // Download and cache the asset locally (bypasses CORS)
                const downloadResult = await ensureAssetDownloaded(serverAsset);
                if (downloadResult.success && downloadResult.filePath) {
                  console.log('[ProjectWorkspaceDialog] Org watermark downloaded to:', downloadResult.filePath);
                  const dataUrl = await invoke<string>('read_file_as_data_url', {
                    filePath: downloadResult.filePath,
                  });
                  const dimensions = await measureWatermarkDimensions(downloadResult.filePath);
                  currentWatermarkData.value = {
                    dataUrl,
                    width: dimensions?.width || serverAsset.width || undefined,
                    height: dimensions?.height || serverAsset.height || undefined,
                  };
                  console.log('[ProjectWorkspaceDialog] Org watermark loaded from download:', {
                    width: dimensions?.width,
                    height: dimensions?.height,
                  });
                  return;
                } else {
                  console.error('[ProjectWorkspaceDialog] Failed to download org watermark:', downloadResult.error);
                }
              } else {
                console.log('[ProjectWorkspaceDialog] Server asset not found for serverId:', serverId);
              }
            }
          } catch (fetchError) {
            console.error('[ProjectWorkspaceDialog] Failed to fetch org assets:', fetchError);
          }
        }
        currentWatermarkData.value = null;
        return;
      }

      // Regular watermark lookup by ID
      const watermark = await getWatermarkImage(watermarkId);
      console.log(
        '[ProjectWorkspaceDialog] getWatermarkImage result:',
        watermark ? { id: watermark.id, name: watermark.name, file_path: watermark.file_path } : null
      );

      if (watermark) {
        // Load the image as data URL
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: watermark.file_path,
        });
        console.log('[ProjectWorkspaceDialog] Loaded watermark as data URL, length:', dataUrl?.length);

        // If width/height missing in DB, measure from the actual file so full-frame detection works
        const measured =
          !watermark.width || !watermark.height
            ? await measureWatermarkDimensions(watermark.file_path)
            : { width: watermark.width, height: watermark.height };

        currentWatermarkData.value = {
          dataUrl,
          width: measured.width || watermark.width || undefined,
          height: measured.height || watermark.height || undefined,
        };
        console.log('[ProjectWorkspaceDialog] Watermark data loaded:', {
          width: currentWatermarkData.value.width,
          height: currentWatermarkData.value.height,
        });
      } else {
        console.log('[ProjectWorkspaceDialog] No watermark found in database for ID:', watermarkId);
        currentWatermarkData.value = null;
      }
    } catch (error) {
      console.error('[ProjectWorkspaceDialog] Failed to load watermark:', error);
      currentWatermarkData.value = null;
    }
  }

  // Handle watermark ID change (when aspect ratio changes and per-ratio settings specify a different watermark)
  async function onWatermarkIdChange(watermarkId: string | null) {
    if (watermarkId && watermarkSettings.value?.enabled) {
      console.log('[ProjectWorkspaceDialog] Loading different watermark for aspect ratio:', watermarkId);
      await loadWatermarkDataById(watermarkId);
    }
  }

  // Load creator profile and apply their default settings
  async function loadCreatorProfileSettings(projectId: string) {
    try {
      console.log('[ProjectWorkspaceDialog] Loading creator profile for project:', projectId);

      // Reset creator defaults
      creatorDefaultIntro.value = null;
      creatorDefaultOutro.value = null;

      // First, check if the project has default_watermark_settings stored directly
      // This is used when downloading from CreatorProfiles (especially org profiles)
      const project = await getProject(projectId);
      if (project?.default_watermark_settings) {
        console.log('[ProjectWorkspaceDialog] Found project-level watermark settings');
        try {
          const storedSettings = JSON.parse(project.default_watermark_settings);
          if (storedSettings.watermarkId) {
            console.log('[ProjectWorkspaceDialog] Applying project-level watermark:', storedSettings.watermarkId);

            // Parse the per-ratio watermark settings
            let perRatioSettings: Record<string, any> | null = null;
            let defaultPos = { x: 12, y: 92, opacity: 80, scale: 20 };
            if (storedSettings.watermarkSettings) {
              try {
                perRatioSettings =
                  typeof storedSettings.watermarkSettings === 'string'
                    ? JSON.parse(storedSettings.watermarkSettings)
                    : storedSettings.watermarkSettings;

                // If main watermarkId is an org asset, transform per-ratio watermarkIds
                // This handles legacy data where per-ratio watermarkIds were stored as raw server IDs
                // Handles both numbers (3) and numeric strings ("3")
                if (storedSettings.watermarkId?.startsWith('org-asset-') && perRatioSettings) {
                  for (const [ratio, config] of Object.entries(perRatioSettings)) {
                    if (config && typeof config === 'object') {
                      const ratioConfig = config as { watermarkId?: number | string; position?: any };
                      if (ratioConfig.watermarkId != null) {
                        const wmIdStr = String(ratioConfig.watermarkId);
                        if (!wmIdStr.startsWith('org-asset-')) {
                          perRatioSettings[ratio] = {
                            ...ratioConfig,
                            watermarkId: `org-asset-${ratioConfig.watermarkId}`,
                          };
                        }
                      }
                    }
                  }
                }

                // Use 16:9 as the default display position
                if (perRatioSettings) {
                  const ratioConfig = perRatioSettings['16:9'];
                  if (ratioConfig?.position) {
                    defaultPos = ratioConfig.position;
                  }
                }
              } catch (e) {
                console.warn('[ProjectWorkspaceDialog] Failed to parse project watermark settings:', e);
              }
            }

            const newSettings = {
              ...watermarkSettings.value,
              enabled: true,
              watermarkId: storedSettings.watermarkId,
              positionX: defaultPos.x,
              positionY: defaultPos.y,
              opacity: defaultPos.opacity,
              scale: defaultPos.scale,
              perRatioSettings: perRatioSettings as import('@/types').PerRatioWatermarkSettings | null,
            };

            console.log('[ProjectWorkspaceDialog] Applying project-level watermark settings:', {
              watermarkId: newSettings.watermarkId,
              defaultPos,
              hasPerRatioSettings: !!perRatioSettings,
              perRatioSettings: JSON.stringify(perRatioSettings, null, 2),
            });

            await nextTick();
            if (mediaPanelRef.value) {
              mediaPanelRef.value.setWatermarkSettings(newSettings);
            }
            await onWatermarkSettingsChanged(newSettings);

            // Still try to load creator profile for intro/outro even if we have watermark from project
          }
        } catch (e) {
          console.warn('[ProjectWorkspaceDialog] Failed to parse project default_watermark_settings:', e);
        }
      }

      // Then try to find the branding profile (streamer-specific, global, or user-selected)
      const profile = await resolveBrandingProfile(projectId);
      creatorProfile.value = profile;

      // Extract server ID for campaign lookup (org profiles have numeric string IDs)
      if (profile && profile.context_type === 'organization' && profile.id && !profile.id.startsWith('campaign-')) {
        const serverId = parseInt(profile.id, 10);
        creatorProfileServerId.value = isNaN(serverId) ? null : serverId;
      } else {
        creatorProfileServerId.value = null;
      }

      if (profile) {
        console.log(
          '[ProjectWorkspaceDialog] Found creator profile:',
          profile.name,
          'watermark_id:',
          profile.watermark_id
        );

        // Apply watermark settings from creator profile (if not already applied from project)
        if (profile.watermark_id && !watermarkSettings.value.enabled) {
          console.log('[ProjectWorkspaceDialog] Applying creator watermark:', profile.watermark_id);

          // Parse the creator's per-ratio watermark settings
          let perRatioSettings = null;
          let defaultPos = { x: 12, y: 92, opacity: 80, scale: 20 };
          if (profile.watermark_settings) {
            try {
              perRatioSettings = JSON.parse(profile.watermark_settings);
              // Use 16:9 as the default display position
              // The structure is { '16:9': { watermarkId, position: { x, y, opacity, scale } } }
              const ratioConfig = perRatioSettings['16:9'];
              if (ratioConfig?.position) {
                defaultPos = ratioConfig.position;
              }
            } catch (e) {
              console.warn('[ProjectWorkspaceDialog] Failed to parse creator watermark settings:', e);
            }
          }

          const newSettings = {
            ...watermarkSettings.value,
            enabled: true,
            watermarkId: profile.watermark_id,
            positionX: defaultPos.x,
            positionY: defaultPos.y,
            opacity: defaultPos.opacity,
            scale: defaultPos.scale,
            perRatioSettings: perRatioSettings,
          };

          console.log('[ProjectWorkspaceDialog] Applying creator watermark settings:', {
            watermarkId: newSettings.watermarkId,
            defaultPos,
            hasPerRatioSettings: !!perRatioSettings,
            perRatioSettings,
          });

          // Wait for next tick to ensure MediaPanel ref is available
          await nextTick();

          // Update MediaPanel's internal state if ref is available
          if (mediaPanelRef.value) {
            mediaPanelRef.value.setWatermarkSettings(newSettings);
          }

          // Always ensure parent state gets updated so VideoPlayer receives the watermark immediately
          await onWatermarkSettingsChanged(newSettings);
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
      } else {
        console.log('[ProjectWorkspaceDialog] No creator profile found for project:', projectId);
      }

      // For free tier users, admin-configured branding OVERRIDES any project/creator watermark
      {
        const { useFreeTierBranding } = await import('@/composables/useFreeTierBranding');
        const { getBrandingIfFreeTier } = useFreeTierBranding();
        const adminBranding = await getBrandingIfFreeTier();
        
        console.log('[ProjectWorkspaceDialog] Checking free tier branding:', {
          hasBranding: !!adminBranding,
          watermark_id: adminBranding?.watermark_id,
          watermark_url: adminBranding?.watermark_url,
        });
        
        if (adminBranding) {
          console.log('[ProjectWorkspaceDialog] Free tier user detected, applying admin branding (overrides project/creator watermark)');
          
          // Apply admin watermark settings — overrides any previously set watermark
          if (adminBranding.watermark_id) {
            console.log('[ProjectWorkspaceDialog] Admin watermark ID:', adminBranding.watermark_id);
            
            // Parse per-ratio settings to get default position
            let perRatioSettings = null;
            let defaultPos = { x: 12, y: 92, opacity: 80, scale: 20 };
            if (adminBranding.watermark_settings) {
              try {
                perRatioSettings = typeof adminBranding.watermark_settings === 'string' 
                  ? JSON.parse(adminBranding.watermark_settings)
                  : adminBranding.watermark_settings;
                
                const ratioConfig = perRatioSettings['16:9'];
                if (ratioConfig?.position) {
                  defaultPos = ratioConfig.position;
                }
              } catch (e) {
                console.warn('[ProjectWorkspaceDialog] Failed to parse admin watermark settings:', e);
              }
            }
            
            const newSettings = {
              enabled: true,
              watermarkId: adminBranding.watermark_id,
              positionX: defaultPos.x,
              positionY: defaultPos.y,
              opacity: defaultPos.opacity,
              scale: defaultPos.scale,
              // Pass admin per-ratio settings for position data.
              // The watcher skips per-ratio watermarkId overrides for org-asset IDs,
              // so these only affect position/opacity/scale per ratio — not which image loads.
              perRatioSettings: perRatioSettings,
            };
            
            console.log('[ProjectWorkspaceDialog] Applying admin watermark settings:', {
              watermarkId: newSettings.watermarkId,
            });
            
            // Pre-set currentWatermarkId to the admin watermark ID BEFORE updating
            // watermarkSettings — this ensures the watcher sees no change and skips reload
            currentWatermarkId.value = adminBranding.watermark_id;
            
            if (mediaPanelRef.value) {
              mediaPanelRef.value.setWatermarkSettings(newSettings);
            }
            watermarkSettings.value = newSettings;
            
            // Download watermark via presigned URL (bypasses org-asset system)
            if (adminBranding.watermark_url) {
              console.log('[ProjectWorkspaceDialog] Downloading free tier watermark via presigned URL');
              try {
                const dataUrl = await invoke<string>('download_url_as_data_url', { url: adminBranding.watermark_url });
                const dimensions = await new Promise<{ width: number; height: number } | null>((resolve) => {
                  const img = new Image();
                  img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
                  img.onerror = () => resolve(null);
                  img.src = dataUrl;
                });
                currentWatermarkData.value = {
                  dataUrl,
                  width: dimensions?.width || undefined,
                  height: dimensions?.height || undefined,
                };
                console.log('[ProjectWorkspaceDialog] Free tier watermark loaded:', {
                  width: dimensions?.width,
                  height: dimensions?.height,
                });
              } catch (dlErr) {
                console.error('[ProjectWorkspaceDialog] Failed to download free tier watermark:', dlErr);
                await loadWatermarkDataById(adminBranding.watermark_id);
              }
            } else {
              await loadWatermarkDataById(adminBranding.watermark_id);
            }
          }
          
          // Load admin intro (will be auto-applied when building clips)
          if (adminBranding.intro) {
            creatorDefaultIntro.value = adminBranding.intro as any;
            console.log('[ProjectWorkspaceDialog] Loaded admin default intro:', adminBranding.intro.name);
          }
          
          // Load admin outro (will be auto-applied when building clips)
          if (adminBranding.outro) {
            creatorDefaultOutro.value = adminBranding.outro as any;
            console.log('[ProjectWorkspaceDialog] Loaded admin default outro:', adminBranding.outro.name);
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
  async function onPlayClip(clip: any) {
    console.log('[ProjectWorkspaceDialog] onPlayClip called with clip:', {
      id: clip.id,
      title: clip.title,
      type: clip.type,
      segmentsCount: clip.segments?.length,
      segments: clip.segments,
    });

    // Track the currently playing clip
    currentlyPlayingClipId.value = clip.id;

    // Set guard flag so the segmentPlaybackEnded watcher doesn't clear currentlyPlayingClipId
    skipPlaybackEndedClear = true;

    // Stop any existing playback first
    stopSegmentedPlayback();

    // Set hover states to the playing clip so it highlights in both panel and timeline
    hoveredClipId.value = clip.id;
    hoveredTimelineClipId.value = clip.id;
    console.log('[ProjectWorkspaceDialog] Set currentlyPlayingClipId to:', clip.id);

    // Reveal the clip in the timeline (makes it visible if hidden)
    if (timelineRef.value) {
      timelineRef.value.revealClip(clip.id);
    }

    // Scroll timeline to the clip (after revealing, wait for DOM to update)
    await nextTick();
    scrollToClipInTimeline(clip.id);

    // Check if this is a standalone clip file (DVR/livestream clip without raw video)
    // If no video is loaded but clip has a file path, load the clip's video directly
    const clipFilePath = clip.filename || clip.file_path;
    const hasNoRawVideo = !videoSrc.value;
    const isStandaloneClip = hasNoRawVideo && clipFilePath;

    if (isStandaloneClip) {
      console.log('[ProjectWorkspaceDialog] Loading standalone clip file:', clipFilePath);
      const loaded = await loadVideoFromPath(clipFilePath);
      if (loaded) {
        // For standalone clips, we just play from start - the whole file is the clip
        // Wait for the video element to be ready after loading
        await nextTick();

        // Wait a bit more for the video element to actually render and be accessible
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (videoElement.value) {
          videoElement.value.currentTime = 0;
          videoElement.value.play().catch((err) => {
            console.warn('[ProjectWorkspaceDialog] Autoplay prevented for standalone clip:', err);
          });
        }
        return;
      }
    }

    // Get segments from the clip (for raw video scrubbing)
    // Note: transformed clips have `segments` directly (from transformClipsForTimeline),
    // while raw ClipWithVersion objects have `current_version_segments`
    let segments: any[] = [];

    console.log('[ProjectWorkspaceDialog] Playing clip:', {
      clipId: clip.id,
      hasSegments: !!clip.segments,
      segmentsLength: clip.segments?.length,
      hasCurrentVersionSegments: !!clip.current_version_segments,
      currentVersionSegmentsLength: clip.current_version_segments?.length,
      currentVersion: clip.current_version,
    });

    if (clip.segments && Array.isArray(clip.segments) && clip.segments.length > 0) {
      // Use segments from transformed clip format (Timeline clips)
      console.log('[ProjectWorkspaceDialog] Using clip.segments');
      segments = clip.segments.map((segment: any, index: number) => ({
        id: segment.id || `segment-${clip.id}-${index}`,
        clip_version_id: segment.clip_version_id || clip.id,
        segment_index: segment.segment_index ?? index,
        start_time: segment.start_time,
        end_time: segment.end_time,
        duration: segment.duration || segment.end_time - segment.start_time,
        transcript: segment.transcript || null,
        created_at: segment.created_at || Date.now(),
      }));
    } else if (
      clip.current_version_segments &&
      Array.isArray(clip.current_version_segments) &&
      clip.current_version_segments.length > 0
    ) {
      // Use the proper segments from database (raw ClipWithVersion format)
      console.log('[ProjectWorkspaceDialog] Using clip.current_version_segments:', clip.current_version_segments);
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
      // Fallback: create single segment from version timing (raw format)
      console.log('[ProjectWorkspaceDialog] Using fallback - clip.current_version');
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
    } else if (clip.total_duration > 0) {
      // Last resort: use total_duration from transformed clip
      console.log('[ProjectWorkspaceDialog] Using last resort - clip.total_duration');
      segments = [
        {
          id: `fallback-${clip.id}`,
          clip_version_id: clip.id,
          segment_index: 0,
          start_time: 0,
          end_time: clip.total_duration,
          duration: clip.total_duration,
          transcript: clip.combined_transcript || null,
          created_at: Date.now(),
        },
      ];
    }

    console.log('[ProjectWorkspaceDialog] Final segments to play:', {
      count: segments.length,
      segments: segments.map(s => ({
        start: s.start_time,
        end: s.end_time,
        duration: s.duration,
      })),
    });

    if (segments.length > 0) {
      // Ensure we have valid segments before playing
      const validSegments = segments.filter(s => 
        s.start_time >= 0 && 
        s.end_time > s.start_time && 
        s.end_time <= duration.value
      );

      if (validSegments.length > 0) {
        console.log('[ProjectWorkspaceDialog] Playing', validSegments.length, 'valid segments');
        playClipSegments(validSegments);
      } else {
        console.warn('[ProjectWorkspaceDialog] No valid segments found for clip:', clip.id);
        currentlyPlayingClipId.value = null;
      }
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

  // Function to seek to a time and start playback (used by timeline context menu)
  function onPlayFromTime(time: number) {
    if (videoElement.value) {
      // Stop any existing segment playback
      stopSegmentedPlayback();

      // Clear currently playing clip
      currentlyPlayingClipId.value = null;

      // Seek to the specified time
      videoElement.value.currentTime = time;

      // Start playback and update state
      videoElement.value
        .play()
        .then(() => {
          isPlaying.value = true;
        })
        .catch((error) => {
          console.error('[ProjectWorkspaceDialog] Error playing video:', error);
        });
    }
  }

  // Function to open the clip editor dialog
  async function onEditClip(clipId: string) {
    // Find the clip in our local data
    const clip = timelineClips.value.find((c: any) => c.id === clipId);
    if (!clip) {
      console.warn('[ProjectWorkspaceDialog] Clip not found for editing:', clipId);
      return;
    }

    // Get the clip's start and end times from segments
    let startTime = 0;
    let endTime = duration.value;

    if (clip.segments && clip.segments.length > 0) {
      startTime = Math.min(...clip.segments.map((s: any) => s.start_time));
      endTime = Math.max(...clip.segments.map((s: any) => s.end_time));
    }

    // Build segments array
    let segments: { start_time: number; end_time: number }[];
    if (clip.segments && clip.segments.length > 0) {
      segments = clip.segments.map((s: any) => ({
        start_time: s.start_time,
        end_time: s.end_time,
      }));
    } else {
      segments = [{ start_time: startTime, end_time: endTime }];
    }

    const clipTitle = clip.title || 'Untitled Clip';

    // Check if there are existing video editor projects for this clip
    try {
      const existingProjects = await getVideoEditorProjectsForClip(clipId);

      if (existingProjects.length > 0) {
        // Show the existing project dialog
        existingProjectForClip.value = existingProjects[0]; // Use most recently updated
        pendingClipToEdit.value = {
          clipId,
          startTime,
          endTime,
          title: clipTitle,
          segments,
        };
        showExistingProjectDialog.value = true;
        return;
      }
    } catch (error) {
      console.warn('[ProjectWorkspaceDialog] Failed to check for existing projects:', error);
      // Continue to create a new project
    }

    // No existing project - create a new video editor project
    await openClipInNewProject(clipId, clipTitle, startTime, endTime, segments);
  }

  // Open clip in a new video editor project
  async function openClipInNewProject(
    clipId: string,
    clipTitle: string,
    startTime: number,
    endTime: number,
    segments: { start_time: number; end_time: number }[]
  ) {
    isCreatingProject.value = true;

    try {
      const result = await createVideoEditorProjectFromClip({
        clipId,
        clipTitle,
        videoSrc: videoSrc.value,
        clipStartTime: startTime,
        clipEndTime: endTime,
        clipSegments: segments,
      });

      // Add clip to in-editor tracking
      await inEditorStore.addClip({
        clipId,
        projectId: props.project?.id ?? null,
        projectNameSnapshot: props.project?.name ?? null,
        origin: 'project',
        assetPath: videoSrc.value,
      });

      // Close the workspace dialog first, then navigate to editor
      close();

      // Navigate to the new OpenCut editor
      router.push({ path: '/editor', query: { projectId: result.projectId } });

      console.log(
        `[ProjectWorkspaceDialog] Opening editor for "${clipTitle}" in video project ${result.projectId}`
      );
    } catch (error) {
      console.error('[ProjectWorkspaceDialog] Failed to create video editor project:', error);
      showError('Failed to Open Editor', 'Could not create video editor project. Please try again.');
    } finally {
      isCreatingProject.value = false;
    }
  }

  // Open clip in an existing video editor project
  async function openClipInExistingProject(project: VideoEditorProject) {
    const pending = pendingClipToEdit.value;
    if (!pending) return;

    // Add clip to in-editor tracking (re-opening existing project)
    await inEditorStore.addClip({
      clipId: pending.clipId,
      projectId: props.project?.id ?? null,
      projectNameSnapshot: props.project?.name ?? null,
      origin: 'project',
      assetPath: videoSrc.value,
    });

    // Clear pending state
    pendingClipToEdit.value = null;
    showExistingProjectDialog.value = false;
    existingProjectForClip.value = null;

    // Close the workspace dialog first, then open the clip editor
    close();

    // Navigate to the new OpenCut editor
    router.push({ path: '/editor', query: { projectId: project.id } });

    console.log(
      `[ProjectWorkspaceDialog] Opening editor for "${pending.title}" in existing project ${project.id}`
    );
  }

  // Handle existing project dialog - open existing
  function onOpenExistingProject() {
    if (existingProjectForClip.value) {
      openClipInExistingProject(existingProjectForClip.value);
    }
  }

  // Handle existing project dialog - create new
  async function onCreateNewProject() {
    const pending = pendingClipToEdit.value;
    if (!pending) return;

    showExistingProjectDialog.value = false;
    existingProjectForClip.value = null;

    await openClipInNewProject(pending.clipId, pending.title, pending.startTime, pending.endTime, pending.segments);

    pendingClipToEdit.value = null;
  }

  // Handle existing project dialog - cancel
  function onExistingProjectCancel() {
    showExistingProjectDialog.value = false;
    existingProjectForClip.value = null;
    pendingClipToEdit.value = null;
  }

  // Wait for a clip element to be present in the clips list (MediaPanel -> ClipsTab)
  async function waitForClipElement(clipId: string, attempts = 10, delayMs = 100): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      await nextTick();
      if (mediaPanelRef.value?.hasClipElement?.(clipId)) {
        return true;
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return false;
  }

  // Function to scroll to and highlight a specific clip in both ClipsTab and Timeline
  async function scrollToAndSelectClip(clipId: string) {
    // Wait for DOM to update
    await nextTick();

    // Small delay to ensure components are fully mounted
    setTimeout(() => {
      // Find clip data for snapping playhead/timeline
      const clip = timelineClips.value.find((c) => c.id === clipId);
      const clipStart = clip?.start_time ?? clip?.startTime ?? clip?.segments?.[0]?.start_time ?? 0;

      // Clear any existing hover states first
      hoveredClipId.value = null;
      hoveredTimelineClipId.value = null;

      // Use another nextTick to ensure the clear has propagated
      nextTick(() => {
        // Scroll in MediaPanel/ClipsTab after the element exists
        waitForClipElement(clipId).then((found) => {
          if (found && mediaPanelRef.value) {
            mediaPanelRef.value.scrollClipIntoView(clipId);
          } else {
            console.warn('[ProjectWorkspaceDialog] Clip element not found for scroll:', clipId);
          }
        });

        // Reveal the clip in the timeline (makes it visible if hidden)
        if (timelineRef.value) {
          timelineRef.value.revealClip(clipId);
        }

        // Scroll in Timeline (after revealing, wait for DOM to update)
        nextTick(() => {
          scrollToClipInTimeline(clipId);
        });

        // Snap playhead to the clip start so the segment stays in view
        if (clipStart != null && !Number.isNaN(clipStart)) {
          seekToTime(clipStart);
        }

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

          // Load VOD preset config and apply aspect ratio
          // Check current project first, then fall back to parent project
          try {
            vodPresetConfig.value = await getProjectVodPresetConfig(props.project.id);
            if (!vodPresetConfig.value && props.project.parent_id) {
              vodPresetConfig.value = await getProjectVodPresetConfig(props.project.parent_id);
            }
            if (vodPresetConfig.value?.targetAspectRatio) {
              const parts = vodPresetConfig.value.targetAspectRatio.split(':').map(Number);
              if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
                selectedAspectRatio.value = { width: parts[0], height: parts[1] };
              }
            }
            // Apply focal point from framing regions so the preview crops to the right area
            if (vodPresetConfig.value?.framingConfig?.regions?.length) {
              const regions = vodPresetConfig.value.framingConfig.regions;
              // Compute bounding box center of all source regions
              let minX = 1, minY = 1, maxX = 0, maxY = 0;
              for (const r of regions) {
                minX = Math.min(minX, r.source.x);
                minY = Math.min(minY, r.source.y);
                maxX = Math.max(maxX, r.source.x + r.source.width);
                maxY = Math.max(maxY, r.source.y + r.source.height);
              }
              const focalX = (minX + maxX) / 2;
              const focalY = (minY + maxY) / 2;
              vodFocalPointOverride.value = { x: focalX, y: focalY };
            } else {
              vodFocalPointOverride.value = null;
            }
          } catch (e) {
            console.error('[ProjectWorkspaceDialog] Failed to load VOD preset config:', e);
            vodPresetConfig.value = null;
          }

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
        // Reset right panel tab
        rightPanelTab.value = 'clips';
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

  // When switching projects while dialog is open, reload video, clips, and creator watermark defaults
  watch(
    () => props.project?.id,
    async (newProjectId, oldProjectId) => {
      if (!props.modelValue) return;
      if (!newProjectId || newProjectId === oldProjectId) return;

      // Reset local playback state
      resetVideoState();
      timelineClips.value = [];
      hoveredClipId.value = null;
      hoveredTimelineClipId.value = null;
      currentlyPlayingClipId.value = null;

      // Reload assets for the new project
      await loadVideos();
      await loadVideoForProject();
      await loadTimelineClips(newProjectId);
      await loadCreatorProfileSettings(newProjectId);

      // Load VOD preset config and apply aspect ratio
      // Check current project first, then fall back to parent project
      try {
        vodPresetConfig.value = await getProjectVodPresetConfig(newProjectId);
        if (!vodPresetConfig.value && props.project?.parent_id) {
          vodPresetConfig.value = await getProjectVodPresetConfig(props.project.parent_id);
        }
        if (vodPresetConfig.value?.targetAspectRatio) {
          const parts = vodPresetConfig.value.targetAspectRatio.split(':').map(Number);
          if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
            selectedAspectRatio.value = { width: parts[0], height: parts[1] };
          }
        }
        // Apply focal point from framing regions
        if (vodPresetConfig.value?.framingConfig?.regions?.length) {
          const regions = vodPresetConfig.value.framingConfig.regions;
          let minX = 1, minY = 1, maxX = 0, maxY = 0;
          for (const r of regions) {
            minX = Math.min(minX, r.source.x);
            minY = Math.min(minY, r.source.y);
            maxX = Math.max(maxX, r.source.x + r.source.width);
            maxY = Math.max(maxY, r.source.y + r.source.height);
          }
          vodFocalPointOverride.value = { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
        } else {
          vodFocalPointOverride.value = null;
        }
      } catch {
        vodPresetConfig.value = null;
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

  // Guard flag to prevent the segmented-playback-ended watcher from clearing
  // currentlyPlayingClipId when stopSegmentedPlayback is called inside onPlayClip
  let skipPlaybackEndedClear = false;

  // Watch for segmented playback state changes
  watch([isPlayingSegments, segmentPlaybackEnded], ([isPlaying, ended]) => {
    if (!isPlaying && ended) {
      if (skipPlaybackEndedClear) {
        skipPlaybackEndedClear = false;
        return;
      }
      // Clear the currently playing clip when playback ends naturally
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
        // Exit fullscreen if dialog closes while in fullscreen
        if (isFullscreen.value && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        isFullscreen.value = false;
      }
    }
  );

  // Set up fullscreen change listener and keyboard shortcuts
  onMounted(() => {
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('keydown', handleKeydown);
  });

  onUnmounted(() => {
    document.removeEventListener('fullscreenchange', handleFullscreenChange);
    document.removeEventListener('keydown', handleKeydown);
    // Ensure we exit fullscreen on unmount
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
  });
</script>

<style scoped>
  /* ========================================
     WORKSPACE DIALOG STYLES
     ======================================== */

  /* ===== Overlay ===== */
  .workspace-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  /* ===== Dialog Container ===== */
  .workspace-dialog {
    background-color: var(--sidebar-surface, #0c0c0c);
    border: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    border-radius: 16px;
    width: calc(100% - 60px);
    height: calc(100% - 80px);
    margin: 60px 30px 33px 30px;
    max-width: 1800px;
    max-height: 950px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow:
      0 25px 80px rgba(0, 0, 0, 0.6),
      0 0 1px rgba(255, 255, 255, 0.1);
  }

  /* ===== Header (Condensed) ===== */
  .workspace-dialog__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem;
    background-color: rgba(0, 0, 0, 0.4);
    border-bottom: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    flex-shrink: 0;
  }

  .workspace-dialog__header-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  .workspace-dialog__header-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
    color: #a78bfa;
    flex-shrink: 0;
  }

  .workspace-dialog__title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text, #f4f4f5);
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }

  .workspace-dialog__vod-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.125rem 0.5rem;
    font-size: 0.625rem;
    font-weight: 600;
    border-radius: 0.25rem;
    background-color: rgba(16, 185, 129, 0.15);
    color: #6ee7b7;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .workspace-dialog__close {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    background: transparent;
    border: none;
    border-radius: 6px;
    color: var(--sidebar-text-muted, #71717a);
    cursor: pointer;
    transition: all 150ms ease;
    flex-shrink: 0;
  }

  .workspace-dialog__close:hover {
    background-color: rgba(255, 255, 255, 0.08);
    color: var(--sidebar-text, #f4f4f5);
  }

  /* ===== Main Content Area ===== */
  .workspace-dialog__content {
    display: flex;
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  /* ===== Player Column ===== */
  .workspace-dialog__player-column {
    width: 60%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 0.5rem;
    gap: 0.5rem;
    border-right: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    background: linear-gradient(180deg, rgba(0, 0, 0, 0.2) 0%, transparent 100%);
  }

  .workspace-dialog__player-column--fullscreen {
    position: fixed !important;
    inset: 0 !important;
    width: 100vw !important;
    height: 100vh !important;
    max-width: none !important;
    max-height: none !important;
    z-index: 99999 !important;
    background: #000 !important;
    padding: 1rem !important;
    gap: 1rem !important;
    border: none !important;
    display: flex !important;
    flex-direction: column !important;
    justify-content: center !important;
  }

  .workspace-dialog__video-wrapper {
    flex: 1 1 0;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #000;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .workspace-dialog__player-column--fullscreen .workspace-dialog__video-wrapper {
    max-height: calc(100vh - 6rem);
    border-radius: 0;
  }

  /* ===== Media Column ===== */
  .workspace-dialog__media-column {
    width: 40%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, transparent 0%, rgba(0, 0, 0, 0.15) 100%);
    overflow: hidden;
  }

  /* ===== Tab Bar ===== */
  .workspace-dialog__tab-bar {
    display: flex;
    gap: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
    background-color: rgba(0, 0, 0, 0.2);
  }

  .workspace-dialog__tab {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text-muted, rgba(255, 255, 255, 0.5));
    background: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .workspace-dialog__tab:hover {
    color: var(--sidebar-text, rgba(255, 255, 255, 0.9));
    background-color: rgba(255, 255, 255, 0.03);
  }

  .workspace-dialog__tab--active {
    color: var(--sidebar-text, rgba(255, 255, 255, 0.9));
    border-bottom-color: var(--sidebar-accent, #06b6d4);
  }

  .workspace-dialog__tab--has-transcript {
    color: #4ade80;
  }

  .workspace-dialog__tab--has-transcript.workspace-dialog__tab--active {
    border-bottom-color: #22c55e;
  }

  .workspace-dialog__tab-badge {
    font-size: 0.625rem;
    font-weight: 700;
    color: #22c55e;
  }

  /* ===== Timeline Section ===== */
  .workspace-dialog__timeline {
    flex-shrink: 0;
    border-top: 1px solid var(--sidebar-border, rgba(255, 255, 255, 0.08));
    background-color: rgba(0, 0, 0, 0.25);
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
    transition: all 250ms cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 150ms ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }

  /* ===== Scrollbar Styling ===== */
  .workspace-dialog__media-column :deep(::-webkit-scrollbar) {
    width: 6px;
  }

  .workspace-dialog__media-column :deep(::-webkit-scrollbar-track) {
    background: transparent;
  }

  .workspace-dialog__media-column :deep(::-webkit-scrollbar-thumb) {
    background-color: rgba(255, 255, 255, 0.12);
    border-radius: 3px;
  }

  .workspace-dialog__media-column :deep(::-webkit-scrollbar-thumb:hover) {
    background-color: rgba(255, 255, 255, 0.2);
  }

  /* ===== Responsive Adjustments ===== */
  @media (max-width: 1400px) {
    .workspace-dialog__player-column {
      width: 55%;
    }

    .workspace-dialog__media-column {
      width: 45%;
    }
  }

  @media (max-width: 1200px) {
    .workspace-dialog {
      margin: 20px;
      width: calc(100% - 40px);
      height: calc(100% - 40px);
      border-radius: 12px;
    }

    .workspace-dialog__player-column {
      width: 50%;
      padding: 1rem;
    }

    .workspace-dialog__media-column {
      width: 50%;
    }
  }
</style>
