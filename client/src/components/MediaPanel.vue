<template>
  <div class="px-4 flex flex-col flex-1 h-full min-h-0" data-media-panel>
    <!-- Header -->
    <div class="flex items-center justify-between gap-2 py-2.5 border-b border-white/10 -mx-4 px-4 bg-[#0d0d0d]">
      <!-- Title -->
      <div class="flex flex-col">
        <h3 class="text-sm font-semibold text-foreground">Clips</h3>
        <p class="text-[10px] text-muted-foreground">
          {{ clips.length }} clip{{ clips.length !== 1 ? 's' : '' }} detected
        </p>
      </div>

      <!-- Actions -->
      <div class="flex items-center gap-2">
        <!-- Progress Bar (when detecting) - Hide during finalizing to show centered progress -->
        <div
          v-if="props.isGenerating && clips.length > 0 && props.generationStage !== 'finalizing'"
          class="flex items-center gap-2 min-w-[140px]"
        >
          <div class="flex-1 space-y-0.5">
            <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all duration-500 ease-out"
                :class="{ 'animate-pulse': props.generationProgress === 0 }"
                :style="{ width: `${Math.max(props.generationProgress, 5)}%` }"
              ></div>
            </div>
            <div class="flex justify-between items-center text-[9px] text-muted-foreground/70">
              <span class="flex items-center gap-1">
                <LoaderIcon class="w-2 h-2 animate-spin text-violet-400" />
                <span class="truncate max-w-[60px]">{{ props.generationStage || 'Processing' }}</span>
              </span>
              <span class="font-mono tabular-nums">{{ Math.round(props.generationProgress) }}%</span>
            </div>
          </div>
          <button
            @click="handleCancelDetection"
            class="p-1 hover:bg-red-500/15 rounded transition-colors text-muted-foreground/60 hover:text-red-400"
            title="Cancel detection"
          >
            <XIcon class="h-3 w-3" />
          </button>
        </div>
        <!-- Detect Button (when not detecting and has clips) - Only show if AI is allowed -->
        <button
          v-else-if="clips.length > 0 && isAIAllowed"
          @click="handleDetectClips"
          class="group flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground/80 hover:text-foreground bg-white/[0.03] hover:bg-white/[0.06] rounded-md transition-all border border-white/[0.06] hover:border-white/[0.1]"
          title="Run clip detection again"
        >
          <Sparkles class="h-3 w-3 group-hover:text-violet-400 transition-colors" />
          Detect
        </button>
        <!-- Transcription Progress Bar (when transcribing) -->
        <div
          v-if="props.isTranscribing"
          class="flex items-center gap-2 min-w-[140px]"
        >
          <div class="flex-1 space-y-0.5">
            <div class="h-1 w-full bg-white/5 rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-emerald-500 to-green-500 transition-all duration-500 ease-out"
                :class="{ 'animate-pulse': props.transcribeProgress === 0 }"
                :style="{ width: `${Math.max(props.transcribeProgress, 5)}%` }"
              ></div>
            </div>
            <div class="flex justify-between items-center text-[9px] text-muted-foreground/70">
              <span class="flex items-center gap-1">
                <LoaderIcon class="w-2 h-2 animate-spin text-emerald-400" />
                <span class="truncate max-w-[80px]">{{ props.transcribeStage || 'Transcribing' }}</span>
              </span>
              <span class="font-mono tabular-nums">{{ Math.round(props.transcribeProgress) }}%</span>
            </div>
          </div>
          <button
            @click="handleCancelTranscription"
            class="p-1 hover:bg-red-500/15 rounded transition-colors text-muted-foreground/60 hover:text-red-400"
            title="Cancel transcription"
          >
            <XIcon class="h-3 w-3" />
          </button>
        </div>
        <!-- View Transcript Button (when transcript exists) -->
        <button
          v-else-if="transcriptData && !props.isGenerating"
          @click="handleViewTranscript"
          class="group flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-md transition-all border border-emerald-500/20 hover:border-emerald-500/30"
          title="View transcript"
        >
          <FileText class="h-3 w-3 text-emerald-400" />
          View Transcript
        </button>
        <!-- Transcribe Button (when no transcript and not transcribing) -->
        <button
          v-else-if="!props.isGenerating && isAIAllowed && !transcriptData"
          @click="handleTranscribe"
          class="group flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground/80 hover:text-foreground bg-white/[0.03] hover:bg-white/[0.06] rounded-md transition-all border border-white/[0.06] hover:border-white/[0.1]"
          title="Generate transcript"
        >
          <FileText class="h-3 w-3 group-hover:text-emerald-400 transition-colors" />
          Transcribe
        </button>

        <!-- Add Clip Button (when AI is not allowed and has clips) -->
        <button
          v-else-if="clips.length > 0 && !isAIAllowed"
          @click="handleAddClip"
          class="group flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground/80 hover:text-foreground bg-white/[0.03] hover:bg-white/[0.06] rounded-md transition-all border border-white/[0.06] hover:border-white/[0.1]"
          title="Manually add a new clip"
        >
          <Plus class="h-3 w-3 group-hover:text-emerald-400 transition-colors" />
          Add Clip
        </button>
      </div>
    </div>

    <!-- Clips Content -->
    <ClipsTab
      ref="clipsTabRef"
      class="flex-1 min-h-0"
      :project-id="props.projectId"
      :clips="clips"
      :is-generating="props.isGenerating"
      :generation-progress="props.generationProgress"
      :generation-stage="props.generationStage"
      :generation-message="props.generationMessage"
      :generation-error="props.generationError"
      :playing-clip-id="props.playingClipId"
      :is-playing-segments="props.isPlayingSegments"
      :hovered-timeline-clip-id="props.hoveredTimelineClipId"
      :video-duration="props.videoDuration || 0"
      :prompts="prompts"
      :transcript-data="transcriptData"
      :watermark-settings="watermarkSettings"
      :subtitle-settings="props.subtitleSettings"
      :creator-default-intro="props.creatorDefaultIntro"
      :creator-default-outro="props.creatorDefaultOutro"
      :hide-header="true"
      @detect-clips="handleDetectClips"
      @cancel-detection="handleCancelDetection"
      @delete-clip="onDeleteClip"
      @play-clip="onPlayClip"
      @clip-hover="onClipHover"
      @seek-video="onSeekVideo"
      @scroll-to-timeline="onScrollToTimeline"
      @refresh-clips="refreshClips"
      @edit-clip="onEditClip"
      @adjust-clip="onAdjustClip"
      @add-clip="handleAddClip"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import {
    getClipDetectionSessionsByProjectId,
    getAllPrompts,
    getClipsWithBuildStatus,
    updateClipBuildStatus,
    updateClipBuild,
    getClipBuilds,
    type ClipWithVersion,
    type ClipDetectionSession,
    type Prompt,
  } from '@/services/database';
  import type { MediaPanelProps, MediaPanelEmits, WatermarkSettings } from '../types';
  import ClipsTab from './ClipsTab.vue';
  import { useTranscriptData } from '@/composables/useTranscriptData';
  import { useAIPermission } from '@/composables/useAIPermission';
  import { Sparkles, X as XIcon, Loader as LoaderIcon, Plus, FileText } from 'lucide-vue-next';

  // AI Permission check
  const { isAIAllowed } = useAIPermission();

  const props = withDefaults(defineProps<MediaPanelProps>(), {
    isGenerating: false,
    generationProgress: 0,
    generationStage: '',
    generationMessage: '',
    generationError: '',
    projectId: null,
    hoveredTimelineClipId: null,
    playingClipId: null,
    isPlayingSegments: false,
    videoDuration: null,
    currentTime: null,
    aspectRatio: () => ({ width: 16, height: 9 }),
    subtitleSettings: null,
    creatorDefaultIntro: null,
    creatorDefaultOutro: null,
    isTranscribing: false,
    transcribeProgress: 0,
    transcribeStage: '',
    transcribeMessage: '',
  });

  const emit = defineEmits<MediaPanelEmits>();

  // Prompts state for matching prompt names to session prompts
  const prompts = ref<Prompt[]>([]);

  // Clips state
  const clips = ref<ClipWithVersion[]>([]);
  const detectionSessions = ref<ClipDetectionSession[]>([]);
  const loadingClips = ref(false);

  // Ref for ClipsTab component
  const clipsTabRef = ref<InstanceType<typeof ClipsTab> | null>(null);

  // Store unlisten functions for cleanup
  const unlistenFunctions = ref<UnlistenFn[]>([]);

  // Use transcript data composable
  const { transcriptData } = useTranscriptData(computed(() => props.projectId || null));

  // Watermark state
  const getDefaultWatermarkSettings = (): WatermarkSettings => ({
    enabled: false,
    watermarkId: null,
    positionX: 12,
    positionY: 92,
    opacity: 80,
    scale: 20,
  });

  const watermarkSettings = ref<WatermarkSettings>(getDefaultWatermarkSettings());

  onMounted(async () => {
    // Load prompts for name matching
    await loadPrompts();

    // Load watermark settings from localStorage
    try {
      const savedWatermark = localStorage.getItem('watermark-settings');
      if (savedWatermark) {
        const parsed = JSON.parse(savedWatermark);
        watermarkSettings.value = {
          ...getDefaultWatermarkSettings(),
          ...parsed,
          enabled: false, // Always start with watermark preview off
        };
        emit('watermarkSettingsChanged', watermarkSettings.value);
      }
    } catch (error) {
      console.error('[MediaPanel] Failed to load watermark settings:', error);
    }

    // Add event listener for refresh events
    document.addEventListener('refresh-clips', handleRefreshEvent as EventListener);

    // Add event listeners for clip build events using Tauri API
    try {
      const progressUnlisten = await listen('clip-build-progress', handleClipBuildProgress);
      const completeUnlisten = await listen('clip-build-complete', handleClipBuildComplete);

      // Store unlisten functions for cleanup on unmount
      unlistenFunctions.value = [progressUnlisten, completeUnlisten];

      console.log('[MediaPanel] Tauri event listeners for clip build events set up successfully');
    } catch (error) {
      console.error('[MediaPanel] Failed to set up Tauri event listeners:', error);
    }
  });

  onUnmounted(() => {
    // Remove event listener to prevent memory leaks
    document.removeEventListener('refresh-clips', handleRefreshEvent as EventListener);

    // Clean up Tauri event listeners
    unlistenFunctions.value.forEach((unlisten) => {
      try {
        unlisten();
      } catch (error) {
        console.error('[MediaPanel] Error cleaning up Tauri listener:', error);
      }
    });
    unlistenFunctions.value = [];

    console.log('[MediaPanel] Component unmounted, event listeners cleaned up');
  });

  // Watch for project changes and load clips
  watch(
    () => props.projectId,
    async (projectId) => {
      if (projectId) {
        await loadClipsAndHistory(projectId);
      } else {
        clips.value = [];
        detectionSessions.value = [];
      }
    },
    { immediate: true }
  );

  // Watch for generation state changes to refresh clips when generation completes
  watch([() => props.isGenerating, () => props.generationProgress], async ([isGenerating, progress]) => {
    if (!isGenerating && progress === 100 && props.projectId) {
      // Add a small delay to ensure database writes are committed
      setTimeout(async () => {
        await loadClipsAndHistory(props.projectId!);
      }, 500);
    }
  });

  // Watch for watermark settings changes and save to localStorage
  watch(
    watermarkSettings,
    (newSettings) => {
      try {
        localStorage.setItem('watermark-settings', JSON.stringify(newSettings));
      } catch (error) {
        console.error('[MediaPanel] Failed to save watermark settings:', error);
      }
    },
    { deep: true }
  );

  // Load prompts for name matching
  async function loadPrompts() {
    try {
      prompts.value = await getAllPrompts();
    } catch (error) {
      console.error('[MediaPanel] Failed to load prompts:', error);
    }
  }

  // Load clips and detection history
  async function loadClipsAndHistory(projectId: string) {
    if (!projectId) return;

    loadingClips.value = true;
    try {
      // Load current clips with versions and build status
      clips.value = await getClipsWithBuildStatus(projectId);

      // Reconcile stuck builds (zombies)
      // If a clip is marked as 'building' in DB but not active in backend, reset it
      const buildingClips = clips.value.filter((c) => c.build_status === 'building');
      if (buildingClips.length > 0) {
        console.log(`[MediaPanel] Found ${buildingClips.length} clips in building state. Checking backend status...`);
        const { invoke } = await import('@tauri-apps/api/core');

        for (const clip of buildingClips) {
          try {
            const isActive = await invoke<boolean>('is_clip_build_active', { clipId: clip.id });
            if (!isActive) {
              console.warn(`[MediaPanel] Clip ${clip.id} is 'building' in DB but not active. Resetting to pending.`);

              // Update DB
              await updateClipBuildStatus(clip.id, 'pending', { error: 'Build interrupted or status mismatch' });

              // Update local state
              clip.build_status = 'pending';
              clip.build_progress = 0;
              clip.build_error = 'Build interrupted';
            }
          } catch (err) {
            console.error(`[MediaPanel] Failed to check status for clip ${clip.id}:`, err);
          }
        }
      }

      // Load detection sessions for history
      detectionSessions.value = await getClipDetectionSessionsByProjectId(projectId);
    } catch (error) {
      console.error('[MediaPanel] Failed to load clips:', error);
    } finally {
      loadingClips.value = false;
    }
  }

  async function refreshClips() {
    if (props.projectId) {
      await loadClipsAndHistory(props.projectId);
    }
  }

  function handleDetectClips() {
    emit('detectClips');
  }

  function handleCancelDetection() {
    emit('cancelDetection');
  }

  function handleAddClip() {
    emit('addClip');
  }

  function handleTranscribe() {
    emit('transcribeProject');
  }

  function handleCancelTranscription() {
    emit('cancelTranscription');
  }

  function handleViewTranscript() {
    emit('viewTranscript');
  }

  function onDeleteClip(clipId: string) {
    emit('deleteClip', clipId);
  }

  function onPlayClip(clip: ClipWithVersion) {
    emit('playClip', clip);
  }

  function onClipHover(clipId: string) {
    emit('clipHover', clipId);
  }

  function onSeekVideo(time: number) {
    emit('seekVideo', time);
  }

  function onScrollToTimeline() {
    emit('scrollToTimeline');
  }

  function onEditClip(clipId: string) {
    emit('editClip', clipId);
  }

  function onAdjustClip(clipId: string) {
    emit('adjustClip', clipId);
  }

  // Event listener for fallback refresh mechanism
  function handleRefreshEvent(event: CustomEvent) {
    if (event.detail?.projectId === props.projectId) {
      refreshClips();
    }
  }

  // Handle clip build progress events
  function handleClipBuildProgress(event: any) {
    const payload = event.payload || event.detail;
    const { clip_id, progress, stage } = payload;

    console.log(`[MediaPanel] Received clip build progress event for: ${clip_id} - stage: ${stage}`);

    const clip = clips.value.find((c) => c.id === clip_id);

    // Handle cancellation progress event
    if (stage === 'cancelled') {
      console.log(`[MediaPanel] Clip build cancelled via progress event: ${clip_id}`);
      if (clip) {
        clip.build_status = 'pending';
        clip.build_progress = 0;
        clip.build_error = null;
      }

      updateClipBuildStatus(clip_id, 'pending', {
        progress: 0,
        error: undefined,
      }).catch((error) => {
        console.error('[MediaPanel] Failed to update clip cancellation:', error);
      });

      refreshClips();
      return;
    }

    // Skip 'building' status update if stage is 'completed' - the clip-build-complete
    // event handler will set the final status. This prevents a race condition where
    // the progress event's 'building' status overwrites the 'completed' status.
    if (stage === 'completed') {
      console.log(`[MediaPanel] Skipping progress update for completed stage - will be handled by completion event`);
      if (clip) {
        clip.build_progress = progress;
      }
      return;
    }

    if (clip) {
      console.log(`[MediaPanel] Clip build progress: ${clip_id} - ${progress}% - ${stage}`);
      clip.build_status = 'building';
      clip.build_progress = progress;
    }

    // Only update database periodically, not on every progress event
    // This prevents unnecessary database writes and potential UI refreshes
    // The completion handler will do the final database update
  }

  // Handle clip build completion events
  function handleClipBuildComplete(event: any) {
    const payload = event.payload || event.detail;

    if (!payload) {
      console.error('[MediaPanel] Received clip-build-complete event with no payload');
      return;
    }

    const { clip_id, success, output_path, all_output_paths, thumbnail_path, duration, file_size, error } = payload;

    // Only process clips that belong to this workspace
    // This prevents duplicate processing when multiple components listen to the same event
    const clip = clips.value.find((c) => c.id === clip_id);
    if (!clip) {
      console.log(`[MediaPanel] Clip ${clip_id} not in this workspace, skipping database update`);
      return;
    }

    console.log(`[MediaPanel] Received clip build complete event for: ${clip_id}`, {
      success,
      output_path,
      all_output_paths,
    });

    const isCancelled = error && (error.includes('cancelled') || error.includes('Cancelled'));

    // Update local state immediately for instant UI feedback
    if (success) {
      clip.build_status = 'completed';
      clip.build_progress = 100;
      clip.built_file_path = output_path;
      // Don't overwrite thumbnail - it's set during detection
      if (thumbnail_path) {
        clip.built_thumbnail_path = thumbnail_path;
      }
      clip.built_duration = duration;
      clip.built_file_size = file_size;
      console.log(`[MediaPanel] Local state updated immediately for clip: ${clip_id}`);
    } else if (isCancelled) {
      // Reset to pending for cancelled builds
      clip.build_status = 'pending';
      clip.build_progress = 0;
      clip.build_error = null;
      clip.built_file_path = null;
      clip.built_thumbnail_path = null;
      console.log(`[MediaPanel] Local state reset for cancelled clip: ${clip_id}`);
    } else {
      clip.build_status = 'failed';
      clip.build_error = error || 'Unknown build error';
    }

    if (success) {
      console.log(`[MediaPanel] Clip build SUCCEEDED: ${clip_id}`);

      // Update clip status (legacy support)
      // Note: Don't pass thumbnail_path as it's set during detection, not build
      updateClipBuildStatus(clip_id, 'completed', {
        progress: 100,
        builtFilePath: output_path,
        builtThumbnailPath: thumbnail_path || undefined, // Only update if provided
        builtDuration: duration,
        builtFileSize: file_size,
        error: undefined,
      })
        .then(async () => {
          console.log(`[MediaPanel] Database updated successfully for clip: ${clip_id}`);

          // Generate thumbnails for ALL built output files (one per aspect ratio)
          // Each thumbnail will match the framing/layout of its corresponding video
          const outputPaths = all_output_paths || (output_path ? [output_path] : []);
          const generatedThumbnailPaths: string[] = [];
          let primaryThumbnailPath: string | undefined;

          if (outputPaths.length > 0) {
            const { invoke } = await import('@tauri-apps/api/core');

            for (const videoPath of outputPaths) {
              try {
                // Extract filename without extension for thumbnail naming
                const outputFileName =
                  videoPath
                    .split(/[/\\]/)
                    .pop()
                    ?.replace(/\.[^.]+$/, '') || 'build';
                const thumbnailFilename = `${outputFileName}_thumb`;

                const thumbPath = await invoke<string>('generate_thumbnail_at_timestamp', {
                  videoPath: videoPath,
                  timestampSeconds: 1.0, // 1 second into the video
                  outputFilename: thumbnailFilename,
                });

                generatedThumbnailPaths.push(thumbPath);
                console.log(`[MediaPanel] Generated thumbnail for ${videoPath}: ${thumbPath}`);

                // Use the first generated thumbnail as the primary one for the build record
                if (!primaryThumbnailPath) {
                  primaryThumbnailPath = thumbPath;
                }
              } catch (thumbError) {
                console.warn(`[MediaPanel] Failed to generate thumbnail for ${videoPath}:`, thumbError);
              }
            }

            console.log(
              `[MediaPanel] Generated ${generatedThumbnailPaths.length} thumbnails for ${outputPaths.length} output files`
            );
          }

          // Update the existing build record (created by ClipsTab before build started)
          try {
            const builds = await getClipBuilds(clip_id);
            // Find the build with 'building' status (most recently created)
            const buildingRecord = builds.find((b) => b.status === 'building');

            // Use generated thumbnail if available, otherwise use one from event
            // Note: primaryThumbnailPath is just stored for legacy support -
            // actual per-file thumbnails are derived from video filenames
            const finalThumbnailPath = primaryThumbnailPath || thumbnail_path || undefined;

            if (buildingRecord) {
              await updateClipBuild(buildingRecord.id, {
                status: 'completed',
                filePath: output_path,
                outputPaths: all_output_paths || (output_path ? [output_path] : []),
                thumbnailPath: finalThumbnailPath,
                fileSize: file_size,
                duration: duration,
              });
              console.log(
                `[MediaPanel] Updated build record ${buildingRecord.id} for clip: ${clip_id} with ${all_output_paths?.length || 1} output paths, thumbnail: ${finalThumbnailPath ? 'yes' : 'no'}`
              );
            } else {
              // No 'building' record found - this can happen if another handler already updated it
              // or if the build was started without creating a record (legacy). Just log a warning.
              console.warn(`[MediaPanel] No 'building' record found for clip ${clip_id}, skipping build record update`);
            }
          } catch (buildError) {
            // Don't fail the whole operation if build record update fails
            console.warn('[MediaPanel] Failed to update build record:', buildError);
          }

          refreshClips();
        })
        .catch((dbError) => {
          console.error('[MediaPanel] Failed to update clip build completion:', dbError);
          // Still refresh to try to get consistent state
          refreshClips();
        });
    } else {
      // Check if this was a cancellation vs a real failure
      if (isCancelled) {
        console.log(`[MediaPanel] Clip build CANCELLED: ${clip_id}`);

        // Reset to pending status (not failed) so user can try again
        updateClipBuildStatus(clip_id, 'pending', {
          progress: 0,
          error: undefined,
          // Clear any partial build paths
          builtFilePath: undefined,
          builtThumbnailPath: undefined,
        })
          .then(() => {
            refreshClips();
          })
          .catch((dbError) => {
            console.error('[MediaPanel] Failed to update clip cancellation:', dbError);
            refreshClips();
          });
      } else {
        console.log(`[MediaPanel] Clip build FAILED: ${clip_id} - ${error}`);

        updateClipBuildStatus(clip_id, 'failed', {
          progress: 0,
          error: error || 'Unknown build error',
        })
          .then(() => {
            refreshClips();
          })
          .catch((dbError) => {
            console.error('[MediaPanel] Failed to update clip build failure:', dbError);
            // Still refresh to try to get consistent state
            refreshClips();
          });
      }
    }
  }

  // Expose methods for external access
  defineExpose({
    refreshClips,
    refreshThumbnails: () => clipsTabRef.value?.refreshThumbnails?.(),
    scrollClipIntoView: (clipId: string) => {
      clipsTabRef.value?.scrollClipIntoView(clipId);
    },
    hasClipElement: (clipId: string) => clipsTabRef.value?.hasClipElement?.(clipId) ?? false,
    getWatermarkSettings: () => watermarkSettings.value,
    setWatermarkSettings: (settings: WatermarkSettings) => {
      watermarkSettings.value = settings;
    },
  });
</script>

<style scoped>
  @keyframes shine {
    0% {
      transform: translateX(-100%) skewX(-12deg);
    }
    100% {
      transform: translateX(200%) skewX(-12deg);
    }
  }

  .animate-shine {
    animation: shine 2s infinite;
  }
</style>
