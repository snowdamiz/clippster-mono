<template>
  <div class="px-4 flex flex-col flex-1 h-full" data-media-panel>
    <!-- Tabs Header -->
    <div
      class="flex items-center border-b border-border/40 -mx-4 bg-gradient-to-r from-transparent via-white/[0.01] to-transparent"
    >
      <button
        v-for="tab in tabs"
        :key="tab.id"
        @click="activeTab = tab.id"
        :class="[
          'relative px-4 py-3 text-xs font-medium transition-all duration-200 flex items-center gap-1.5 group',
          activeTab === tab.id ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80',
        ]"
      >
        {{ tab.label }}
        <div v-if="activeTab === tab.id" class="absolute bottom-0 left-2 right-2 h-0.5 bg-white/70 rounded-full"></div>
      </button>
    </div>

    <!-- Clips Tab Content -->
    <ClipsTab
      v-if="activeTab === 'clips'"
      ref="clipsTabRef"
      :project-id="projectId"
      :clips="clips"
      :is-generating="isGenerating"
      :generation-progress="generationProgress"
      :generation-stage="generationStage"
      :generation-message="generationMessage"
      :generation-error="generationError"
      :playing-clip-id="playingClipId"
      :is-playing-segments="isPlayingSegments"
      :hovered-timeline-clip-id="hoveredTimelineClipId"
      :video-duration="videoDuration || 0"
      :prompts="prompts"
      :transcript-data="transcriptData"
      :subtitle-settings="subtitleSettings"
      :max-words-for-aspect-ratio="maxWordsForAspectRatio"
      :watermark-settings="watermarkSettings"
      :creator-default-intro="creatorDefaultIntro"
      :creator-default-outro="creatorDefaultOutro"
      @detect-clips="handleDetectClips"
      @cancel-detection="handleCancelDetection"
      @delete-clip="onDeleteClip"
      @play-clip="onPlayClip"
      @clip-hover="onClipHover"
      @seek-video="onSeekVideo"
      @scroll-to-timeline="onScrollToTimeline"
      @refresh-clips="refreshClips"
    />

    <!-- Audio Tab Content -->
    <AudioTab v-if="activeTab === 'audio'" :project-id="projectId" @settings-changed="onAudioSettingsChanged" />

    <!-- Transcript Tab Content - use v-show to keep mounted so it receives events -->
    <TranscriptPanel
      v-show="activeTab === 'transcript'"
      ref="transcriptPanelRef"
      :project-id="projectId"
      :current-time="currentTime || undefined"
      :duration="videoDuration || undefined"
      @seekVideo="onSeekVideo"
    />

    <!-- Subtitles Tab Content -->
    <SubtitlesTab
      v-if="activeTab === 'subtitles'"
      :project-id="projectId"
      :settings="subtitleSettings"
      :aspect-ratio="aspectRatio"
      @settings-changed="onSubtitleSettingsChanged"
    />

    <!-- Watermark Tab Content -->
    <WatermarkTab
      v-if="activeTab === 'watermark'"
      ref="watermarkTabRef"
      :project-id="projectId"
      :settings="watermarkSettings"
      :aspect-ratio="aspectRatio"
      @settings-changed="onWatermarkSettingsChanged"
    />
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, computed, watch, onUnmounted, markRaw } from 'vue';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import {
    getClipDetectionSessionsByProjectId,
    getAllPrompts,
    getClipsWithBuildStatus,
    updateClipBuildStatus,
    createClipBuild,
    updateClipBuild,
    getClipBuilds,
    type ClipWithVersion,
    type ClipDetectionSession,
    type Prompt,
  } from '@/services/database';
  import type { MediaPanelProps, MediaPanelEmits, SubtitleSettings, WatermarkSettings, AudioSettings } from '../types';
  import ClipsTab from './ClipsTab.vue';
  import AudioTab from './AudioTab.vue';
  import TranscriptPanel from './TranscriptPanel.vue';
  import SubtitlesTab from './SubtitlesTab.vue';
  import WatermarkTab from './WatermarkTab.vue';
  import { useTranscriptData } from '@/composables/useTranscriptData';
  import { Video, Volume2, FileText, Type, Image } from 'lucide-vue-next';

  // Tab configuration
  const tabs = [
    { id: 'clips', label: 'Clips', icon: markRaw(Video) },
    { id: 'audio', label: 'Audio', icon: markRaw(Volume2) },
    { id: 'transcript', label: 'Transcript', icon: markRaw(FileText) },
    { id: 'subtitles', label: 'Subtitles', icon: markRaw(Type) },
    { id: 'watermark', label: 'Watermark', icon: markRaw(Image) },
  ];

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
    creatorDefaultIntro: null,
    creatorDefaultOutro: null,
  });

  const emit = defineEmits<MediaPanelEmits>();

  // Tab state
  const activeTab = ref('clips');

  // Prompts state for matching prompt names to session prompts
  const prompts = ref<Prompt[]>([]);

  // Clips state
  const clips = ref<ClipWithVersion[]>([]);
  const detectionSessions = ref<ClipDetectionSession[]>([]);
  const loadingClips = ref(false);

  // Ref for ClipsTab component
  const clipsTabRef = ref<InstanceType<typeof ClipsTab> | null>(null);

  // Ref for TranscriptPanel component
  const transcriptPanelRef = ref<InstanceType<typeof TranscriptPanel> | null>(null);

  // Ref for WatermarkTab component
  const watermarkTabRef = ref<InstanceType<typeof WatermarkTab> | null>(null);

  // Store unlisten functions for cleanup
  const unlistenFunctions = ref<UnlistenFn[]>([]);

  // Use transcript data composable
  const { transcriptData } = useTranscriptData(computed(() => props.projectId || null));

  // Calculate max words based on aspect ratio (matches VideoPlayer.vue logic)
  const maxWordsForAspectRatio = computed(() => {
    const aspectRatioValue = props.aspectRatio.width / props.aspectRatio.height;

    if (aspectRatioValue > 1.5) {
      return 6; // wide formats (16:9, 21:9)
    } else if (aspectRatioValue > 0.9) {
      return 4; // squarish (1:1, 4:3)
    } else {
      return 3; // vertical (9:16, 4:5)
    }
  });

  // Subtitle state
  const getDefaultSubtitleSettings = (): SubtitleSettings => ({
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
    selectedPresetId: null,
  });

  const subtitleSettings = ref<SubtitleSettings>(getDefaultSubtitleSettings());

  // Watermark state
  const getDefaultWatermarkSettings = (): WatermarkSettings => ({
    enabled: false,
    watermarkId: null,
    positionX: 8,
    positionY: 92,
    opacity: 80,
    scale: 15,
  });

  const watermarkSettings = ref<WatermarkSettings>(getDefaultWatermarkSettings());

  onMounted(async () => {
    // Load prompts for name matching
    await loadPrompts();

    // Load subtitle settings from localStorage
    try {
      const saved = localStorage.getItem('subtitle-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Restore all settings from localStorage but always default subtitles to off
        // Preserve selectedPresetId if it exists in localStorage
        const { selectedPresetId: savedPresetId } = parsed;
        subtitleSettings.value = {
          ...getDefaultSubtitleSettings(),
          ...parsed,
          enabled: false,
          selectedPresetId: savedPresetId || null,
        };
        // Emit to sync with VideoPlayer
        emit('subtitleSettingsChanged', subtitleSettings.value);
      }
    } catch (error) {
      console.error('[MediaPanel] Failed to load subtitle settings:', error);
    }

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

  // Watch for subtitle settings changes and save to localStorage
  watch(
    subtitleSettings,
    (newSettings) => {
      try {
        localStorage.setItem('subtitle-settings', JSON.stringify(newSettings));
      } catch (error) {
        console.error('[MediaPanel] Failed to save subtitle settings:', error);
      }
    },
    { deep: true }
  );

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

  function onSubtitleSettingsChanged(settings: SubtitleSettings) {
    subtitleSettings.value = settings;
    emit('subtitleSettingsChanged', settings);
  }

  function onWatermarkSettingsChanged(settings: WatermarkSettings) {
    watermarkSettings.value = settings;
    emit('watermarkSettingsChanged', settings);
  }

  function onAudioSettingsChanged(settings: AudioSettings) {
    emit('audioSettingsChanged', settings);
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

    console.log(`[MediaPanel] Received clip build complete event for: ${clip_id}`, {
      success,
      output_path,
      all_output_paths,
    });

    // Immediately update local state for instant UI feedback
    const clip = clips.value.find((c) => c.id === clip_id);
    const isCancelled = error && (error.includes('cancelled') || error.includes('Cancelled'));

    if (clip) {
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
    } else {
      console.warn(`[MediaPanel] Clip ${clip_id} not found in local state, will refresh from database`);
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
              // Fallback: create a new build record if none found (for backwards compatibility)
              const buildId = await createClipBuild(clip_id, {});
              await updateClipBuild(buildId, {
                status: 'completed',
                filePath: output_path,
                outputPaths: all_output_paths || (output_path ? [output_path] : []),
                thumbnailPath: finalThumbnailPath,
                fileSize: file_size,
                duration: duration,
              });
              console.log(`[MediaPanel] Created fallback build record ${buildId} for clip: ${clip_id}`);
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
      const isCancelled = error && (error.includes('cancelled') || error.includes('Cancelled'));

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
    scrollClipIntoView: (clipId: string) => {
      clipsTabRef.value?.scrollClipIntoView(clipId);
    },
    getWatermarkSettings: () => watermarkSettings.value,
    setWatermarkSettings: (settings: WatermarkSettings) => {
      watermarkSettings.value = settings;
      emit('watermarkSettingsChanged', settings);
    },
    getWatermarkTabRef: () => watermarkTabRef.value,
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
