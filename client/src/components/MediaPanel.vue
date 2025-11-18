<template>
  <div class="px-4 flex flex-col flex-1 h-full" data-media-panel>
    <!-- Tabs Header -->
    <div class="flex items-center border-b border-border/60 -mx-4 gap-1">
      <button
        @click="activeTab = 'clips'"
        :class="[
          'px-4 py-2.5 text-sm font-medium transition-all relative',
          activeTab === 'clips'
            ? 'text-foreground bg-muted/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/20',
        ]"
      >
        Clips
        <div v-if="activeTab === 'clips'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
      </button>
      <button
        @click="activeTab = 'audio'"
        :class="[
          'px-4 py-2.5 text-sm font-medium transition-all relative',
          activeTab === 'audio'
            ? 'text-foreground bg-muted/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/20',
        ]"
      >
        Audio
        <div v-if="activeTab === 'audio'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"></div>
      </button>
      <button
        @click="activeTab = 'transcript'"
        :class="[
          'px-4 py-2.5 text-sm font-medium transition-all relative',
          activeTab === 'transcript'
            ? 'text-foreground bg-muted/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/20',
        ]"
      >
        Transcript
        <div
          v-if="activeTab === 'transcript'"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
        ></div>
      </button>
      <button
        @click="activeTab = 'subtitles'"
        :class="[
          'px-4 py-2.5 text-sm font-medium transition-all relative',
          activeTab === 'subtitles'
            ? 'text-foreground bg-muted/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/20',
        ]"
      >
        Subtitles
        <div
          v-if="activeTab === 'subtitles'"
          class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
        ></div>
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
      :video-duration="videoDuration"
      :prompts="prompts"
      :transcript-data="transcriptData"
      :subtitle-settings="subtitleSettings"
      :max-words-for-aspect-ratio="maxWordsForAspectRatio"
      @detect-clips="handleDetectClips"
      @delete-clip="onDeleteClip"
      @play-clip="onPlayClip"
      @clip-hover="onClipHover"
      @seek-video="onSeekVideo"
      @scroll-to-timeline="onScrollToTimeline"
      @refresh-clips="refreshClips"
    />

    <!-- Audio Tab Content -->
    <AudioTab v-if="activeTab === 'audio'" :project-id="projectId" />

    <!-- Transcript Tab Content -->
    <TranscriptPanel
      v-if="activeTab === 'transcript'"
      :project-id="projectId"
      :current-time="currentTime"
      :duration="videoDuration"
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
  </div>
</template>

<script setup lang="ts">
  import { ref, onMounted, computed, watch, onUnmounted } from 'vue';
  import { listen } from '@tauri-apps/api/event';
  import {
    getClipDetectionSessionsByProjectId,
    getAllPrompts,
    getClipsWithBuildStatus,
    updateClipBuildStatus,
    type ClipWithVersion,
    type ClipDetectionSession,
    type Prompt,
  } from '@/services/database';
  import type { MediaPanelProps, MediaPanelEmits, SubtitleSettings } from '../types';
  import ClipsTab from './ClipsTab.vue';
  import AudioTab from './AudioTab.vue';
  import TranscriptPanel from './TranscriptPanel.vue';
  import SubtitlesTab from './SubtitlesTab.vue';
  import { useTranscriptData } from '@/composables/useTranscriptData';

  const props = withDefaults(defineProps<MediaPanelProps>(), {
    isGenerating: false,
    generationProgress: 0,
    generationStage: '',
    generationMessage: '',
    generationError: '',
    playingClipId: null,
    isPlayingSegments: false,
    videoDuration: 0,
    currentTime: 0,
    aspectRatio: () => ({ width: 16, height: 9 }),
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
    outlineWidth: 3,
    outlineColor: '#000000',
    shadowOffsetX: 2,
    shadowOffsetY: 2,
    shadowBlur: 4,
    shadowColor: '#000000',
    position: 'bottom',
    positionPercentage: 85,
    maxWidth: 90,
    animationStyle: 'none',
    lineHeight: 1.2,
    letterSpacing: 0,
    textAlign: 'center',
    textOffsetX: 0,
    textOffsetY: 0,
    padding: 16,
    borderRadius: 8,
    wordSpacing: 0.35,
  });

  const subtitleSettings = ref<SubtitleSettings>(getDefaultSubtitleSettings());

  onMounted(async () => {
    // Load prompts for name matching
    await loadPrompts();

    // Load subtitle settings from localStorage
    try {
      const saved = localStorage.getItem('subtitle-settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Restore all settings from localStorage but always default subtitles to off
        subtitleSettings.value = { ...getDefaultSubtitleSettings(), ...parsed, enabled: false };
        // Emit to sync with VideoPlayer
        emit('subtitleSettingsChanged', subtitleSettings.value);
      }
    } catch (error) {
      console.error('[MediaPanel] Failed to load subtitle settings:', error);
    }

    // Add event listener for refresh events
    document.addEventListener('refresh-clips', handleRefreshEvent as EventListener);

    // Add event listeners for clip build events using Tauri API
    try {
      await listen('clip-build-progress', handleClipBuildProgress);
      await listen('clip-build-complete', handleClipBuildComplete);
      console.log('[MediaPanel] Tauri event listeners for clip build events set up successfully');
    } catch (error) {
      console.error('[MediaPanel] Failed to set up Tauri event listeners:', error);
    }
  });

  onUnmounted(() => {
    // Remove event listener to prevent memory leaks
    document.removeEventListener('refresh-clips', handleRefreshEvent as EventListener);
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

  // Event listener for fallback refresh mechanism
  function handleRefreshEvent(event: CustomEvent) {
    if (event.detail?.projectId === props.projectId) {
      refreshClips();
    }
  }

  // Handle clip build progress events
  function handleClipBuildProgress(event: any) {
    const payload = event.payload || event.detail;
    const { clip_id, progress, stage, message } = payload;

    console.log(`[MediaPanel] Received clip build progress event for: ${clip_id}`);

    const clip = clips.value.find((c) => c.id === clip_id);
    if (clip) {
      console.log(`[MediaPanel] Clip build progress: ${clip_id} - ${progress}% - ${stage}`);
      clip.build_status = 'building';
      clip.build_progress = progress;
    }

    updateClipBuildStatus(clip_id, 'building', {
      progress,
      error: stage === 'error' ? message : undefined,
    }).catch((error) => {
      console.error('[MediaPanel] Failed to update clip build progress:', error);
    });

    refreshClips();
  }

  // Handle clip build completion events
  function handleClipBuildComplete(event: any) {
    const payload = event.payload || event.detail;
    const { clip_id, success, output_path, thumbnail_path, duration, file_size, error } = payload;

    console.log(`[MediaPanel] Received clip build complete event for: ${clip_id}`);

    if (success) {
      console.log(`[MediaPanel] Clip build SUCCEEDED: ${clip_id}`);

      updateClipBuildStatus(clip_id, 'completed', {
        progress: 100,
        builtFilePath: output_path,
        builtThumbnailPath: thumbnail_path,
        builtDuration: duration,
        builtFileSize: file_size,
        error: undefined,
      })
        .then(() => {
          console.log(`[MediaPanel] Database updated successfully for clip: ${clip_id}`);
          refreshClips();
        })
        .catch((dbError) => {
          console.error('[MediaPanel] Failed to update clip build completion:', dbError);
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
        });
    }
  }

  // Expose methods for external access
  defineExpose({
    refreshClips,
    scrollClipIntoView: (clipId: string) => {
      clipsTabRef.value?.scrollClipIntoView(clipId);
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
