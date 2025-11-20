<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header with Detect More button and count -->
    <div v-if="clips.length > 0 && !isGenerating" class="flex items-center justify-between py-3 px-1 mt-2">
      <div class="flex items-center gap-2">
        <span class="text-sm font-medium text-foreground/90">
          {{ clips.length }} Clip{{ clips.length !== 1 ? 's' : '' }}
        </span>
        <span class="text-xs text-muted-foreground">•</span>
        <span class="text-xs text-muted-foreground">Click to preview on timeline</span>
      </div>
      <button
        @click="handleDetectClips"
        class="group flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 border border-border hover:border-foreground/40 rounded-md transition-all duration-200"
        title="Run clip detection again to find more clips"
      >
        <RefreshCw class="h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-500" />
        <span>Detect More</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- Progress State -->
      <div v-if="isGenerating" class="h-full flex flex-col items-center justify-center px-8">
        <div class="w-full max-w-xs space-y-6">
          <!-- Icon & Status -->
          <div class="text-center space-y-3">
            <div class="relative mx-auto w-12 h-12">
              <div class="absolute inset-0 rounded-full bg-primary/5 animate-ping duration-1000"></div>
              <div
                class="relative w-12 h-12 rounded-full bg-background border border-border/50 shadow-sm flex items-center justify-center"
              >
                <component :is="stageIcon" class="w-5 h-5 transition-colors duration-300" :class="stageIconClass" />
              </div>
            </div>

            <div class="space-y-1">
              <h4 class="font-medium text-foreground text-sm tracking-wide uppercase opacity-90">{{ stageTitle }}</h4>
              <p class="text-sm text-muted-foreground leading-relaxed max-w-[260px] mx-auto">{{ stageDescription }}</p>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="space-y-2">
            <div class="h-1 w-full bg-secondary/30 rounded-full overflow-hidden">
              <div
                class="h-full bg-primary transition-all duration-500 ease-out"
                :class="{ 'animate-pulse': generationProgress === 0 }"
                :style="{ width: `${Math.max(generationProgress, 5)}%` }"
              ></div>
            </div>
            <div class="flex justify-between items-center text-[11px] text-muted-foreground font-medium px-0.5">
              <span class="flex items-center gap-1.5">
                <LoaderIcon class="w-3 h-3 animate-spin opacity-70" />
                {{ getLoadingMessage() }}
              </span>
              <span class="font-mono">{{ Math.round(generationProgress) }}%</span>
            </div>
          </div>

          <!-- Time Estimate -->
          <div class="flex justify-center">
            <div
              class="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/70 bg-secondary/20 px-2.5 py-1 rounded-full border border-border/10"
            >
              <ClockIcon class="w-3 h-3" />
              {{ getTimeEstimate() }}
            </div>
          </div>

          <!-- Status Message (if extra details) -->
          <div
            v-if="generationMessage && generationMessage !== getLoadingMessage()"
            class="text-xs text-center text-muted-foreground/80 bg-muted/20 rounded px-3 py-2 border border-border/20"
          >
            {{ generationMessage }}
          </div>

          <!-- Error State -->
          <div v-if="generationError" class="bg-red-500/5 border border-red-500/20 rounded-md p-3">
            <div class="flex items-start gap-2.5">
              <AlertTriangle class="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              <div class="text-left">
                <h4 class="font-medium text-red-400 text-xs mb-0.5">Error</h4>
                <p class="text-[11px] text-red-400/80 leading-snug">{{ generationError }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Clips List State -->
      <div
        v-else-if="clips.length > 0 && !isGenerating"
        class="w-full flex-1 overflow-y-auto pr-2 custom-scrollbar"
        ref="clipsScrollContainer"
      >
        <!-- Clips Grid -->
        <div class="space-y-3 pb-4">
          <div
            v-for="(clip, index) in clips"
            :key="clip.id"
            :ref="(el) => setClipRef(el, clip.id)"
            :class="[
              'group relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-lg cursor-pointer transition-all duration-200 overflow-hidden',
              // Playing clip gets green styling
              props.isPlayingSegments && props.playingClipId === clip.id
                ? 'ring-1 ring-green-500/50 bg-green-500/[0.04] border-green-500/50 shadow-lg shadow-green-500/10'
                : 'hover:border-border/80 hover:bg-card/70 hover:shadow-lg hover:shadow-black/10',
            ]"
            :style="{
              // Prioritize playing state over all other states
              borderColor:
                props.isPlayingSegments && props.playingClipId === clip.id
                  ? undefined
                  : !props.isPlayingSegments && (hoveredTimelineClipId === clip.id || hoveredClipId === clip.id)
                    ? clip.session_run_color || '#8B5CF6'
                    : undefined,
              borderWidth:
                !props.isPlayingSegments && (hoveredTimelineClipId === clip.id || hoveredClipId === clip.id)
                  ? '1px'
                  : undefined,
            }"
            @click="onClipClick(clip.id)"
          >
            <!-- Left accent bar -->
            <div
              v-if="clip.run_number"
              class="absolute left-0 top-0 bottom-0 w-1 transition-all duration-200"
              :style="{
                backgroundColor: clip.session_run_color || '#8B5CF6',
                opacity: props.isPlayingSegments && props.playingClipId === clip.id ? '1' : '0.6',
              }"
            ></div>

            <div class="flex flex-col p-3 pl-4">
              <!-- Header: Title & Actions -->
              <div class="flex items-start justify-between gap-3 mb-2">
                <div class="flex items-start gap-2 min-w-0">
                  <span class="text-xs font-bold text-foreground/30 mt-1 tabular-nums select-none">
                    #{{ index + 1 }}
                  </span>
                  <h5 class="text-[15px] font-semibold text-foreground leading-snug line-clamp-2">
                    {{ clip.current_version_name || clip.name || 'Untitled Clip' }}
                  </h5>
                </div>

                <!-- Actions (visible on hover or if active) -->
                <div
                  class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0 -mr-1 -mt-1"
                  :class="{ 'opacity-100': showBuildSettingsDialog && clipToBuild?.id === clip.id }"
                >
                  <button
                    class="p-1.5 hover:bg-blue-500/15 rounded-md transition-colors text-foreground/60 hover:text-blue-400"
                    title="Play clip"
                    @click.stop="onPlayClip(clip)"
                  >
                    <PlayIcon class="h-4 w-4" />
                  </button>
                  <button
                    v-if="!clip.build_status || clip.build_status === 'pending' || clip.build_status === 'failed'"
                    class="p-1.5 hover:bg-green-500/15 rounded-md transition-colors text-foreground/60 hover:text-green-400"
                    title="Build clip"
                    @click.stop="onBuildClip(clip)"
                  >
                    <WrenchIcon class="h-4 w-4" />
                  </button>
                  <button
                    v-else-if="clip.build_status === 'completed' && clip.built_file_path"
                    class="p-1.5 hover:bg-green-500/15 rounded-md transition-colors text-green-500/80 hover:text-green-400"
                    title="Open built clip"
                    @click.stop="onOpenBuiltClip(clip)"
                  >
                    <DownloadIcon class="h-4 w-4" />
                  </button>
                  <button
                    class="p-1.5 hover:bg-red-500/15 rounded-md transition-colors text-foreground/60 hover:text-red-400"
                    title="Delete clip"
                    @click.stop="onDeleteClip(clip.id)"
                  >
                    <Trash2 class="h-4 w-4" />
                  </button>
                </div>
              </div>

              <!-- Metrics Row -->
              <div class="flex items-center flex-wrap gap-2 mb-2.5">
                <!-- Virality Score -->
                <div
                  v-if="
                    clip.current_version_virality_score !== undefined && clip.current_version_virality_score !== null
                  "
                  class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium transition-colors"
                  :class="getViralityColorClass(clip.current_version_virality_score)"
                  title="Predicted Virality Score"
                >
                  <Flame class="h-3 w-3" />
                  <span>{{ Math.round(clip.current_version_virality_score) }}% Viral</span>
                </div>

                <!-- Duration -->
                <div
                  class="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 bg-secondary/40 px-2 py-0.5 rounded-md"
                >
                  <ClockIcon class="h-3 w-3 opacity-70" />
                  <span>
                    {{ formatDuration((clip.current_version_end_time || 0) - (clip.current_version_start_time || 0)) }}
                  </span>
                </div>

                <!-- Confidence (Subtle) -->
                <div
                  v-if="clip.current_version_confidence_score"
                  class="inline-flex items-center gap-1 text-[11px] font-medium px-1.5"
                  :class="getConfidenceColorClass(clip.current_version_confidence_score)"
                  title="AI Confidence Score"
                >
                  <BrainIcon class="h-3 w-3" />
                  <span>{{ Math.round((clip.current_version_confidence_score || 0) * 100) }}%</span>
                </div>
              </div>

              <!-- Description (if avail) -->
              <p
                v-if="clip.current_version_detection_reason"
                class="text-xs text-muted-foreground/80 line-clamp-2 mb-2.5 leading-relaxed italic"
              >
                "{{ clip.current_version_detection_reason }}"
              </p>

              <!-- Footer Info -->
              <div
                class="flex items-center justify-between text-[10px] text-muted-foreground/60 border-t border-border/30 pt-2 mt-auto"
              >
                <div class="flex items-center gap-2">
                  <span class="font-mono">
                    {{ formatTime(clip.current_version_start_time || 0) }} -
                    {{ formatTime(clip.current_version_end_time || 0) }}
                  </span>

                  <!-- Build Status -->
                  <span v-if="clip.build_status === 'building'" class="text-blue-400 flex items-center gap-1">
                    <LoaderIcon class="h-2.5 w-2.5 animate-spin" />
                    Building...
                  </span>
                  <span v-else-if="clip.build_status === 'completed'" class="text-green-400 flex items-center gap-1">
                    <CheckIcon class="h-2.5 w-2.5" />
                    Built
                  </span>
                </div>

                <!-- Run Info -->
                <div class="flex items-center gap-2">
                  <span v-if="clip.run_number" class="flex items-center gap-1">
                    <div
                      class="w-1 h-1 rounded-full"
                      :style="{ backgroundColor: clip.session_run_color || '#8B5CF6' }"
                    ></div>
                    Run {{ clip.run_number }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <!-- Default State -->
      <div v-else class="h-full flex items-center justify-center px-4">
        <div class="text-center text-muted-foreground max-w-sm">
          <div class="mb-8 flex flex-col items-center">
            <div
              class="w-24 h-24 bg-gradient-to-br from-purple-500/10 via-indigo-500/10 to-blue-500/10 rounded-lg flex items-center justify-center mb-6 border border-purple-500/20 shadow-lg shadow-purple-500/5"
            >
              <Video class="h-12 w-12 text-purple-400/80" />
            </div>
            <h4 class="text-lg font-semibold text-foreground mb-2">No Clips Yet</h4>
            <p class="text-sm text-muted-foreground/80 mb-8 leading-relaxed">
              Start detecting clips from your video using AI-powered analysis
            </p>
          </div>
          <button
            @click="handleDetectClips"
            class="group inline-flex items-center gap-2.5 px-5 py-2.5 text-sm font-medium text-foreground bg-muted/40 hover:bg-muted/60 border border-border hover:border-foreground/50 rounded-md transition-all hover:shadow-lg hover:scale-105 active:scale-100"
            title="Detect Clips"
          >
            <RefreshCw class="h-4 w-4 group-hover:rotate-180 transition-transform duration-500" />
            <span>Detect Clips</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Build Settings Dialog -->
    <ClipBuildSettingsDialog v-model="showBuildSettingsDialog" :clip="clipToBuild" @confirm="onBuildConfirm" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import type { ClipWithVersion, Prompt } from '@/services/database';
  import {
    PlayIcon,
    BrainIcon,
    CheckCircleIcon,
    XCircleIcon,
    ActivityIcon,
    MicIcon,
    ClockIcon,
    WrenchIcon,
    DownloadIcon,
    LoaderIcon,
    CheckIcon,
    RefreshCw,
    AlertTriangle,
    Trash2,
    Video,
    Flame,
  } from 'lucide-vue-next';
  import ClipBuildSettingsDialog, { type BuildSettings } from './ClipBuildSettingsDialog.vue';
  import type { SubtitleSettings } from '@/types';

  // Props
  interface ClipsTabProps {
    projectId: string | null;
    clips: ClipWithVersion[];
    isGenerating: boolean;
    generationProgress: number;
    generationStage: string;
    generationMessage: string;
    generationError: string;
    playingClipId: string | null;
    isPlayingSegments: boolean;
    hoveredTimelineClipId: string | null;
    videoDuration: number;
    prompts: Prompt[];
    transcriptData: any;
    subtitleSettings: SubtitleSettings;
    maxWordsForAspectRatio: number;
  }

  const props = withDefaults(defineProps<ClipsTabProps>(), {
    projectId: null,
    clips: () => [],
    isGenerating: false,
    generationProgress: 0,
    generationStage: '',
    generationMessage: '',
    generationError: '',
    playingClipId: null,
    isPlayingSegments: false,
    hoveredTimelineClipId: null,
    videoDuration: 0,
    prompts: () => [],
    maxWordsForAspectRatio: 3,
  });

  // Emits
  const emit = defineEmits<{
    detectClips: [];
    deleteClip: [clipId: string];
    playClip: [clip: ClipWithVersion];
    clipHover: [clipId: string];
    seekVideo: [time: number];
    scrollToTimeline: [];
    refreshClips: [];
  }>();

  // State
  const hoveredClipId = ref<string | null>(null);
  const clipsScrollContainer = ref<HTMLElement | null>(null);
  const clipElements = ref<Map<string, HTMLElement>>(new Map());
  const showBuildSettingsDialog = ref(false);
  const clipToBuild = ref<ClipWithVersion | null>(null);

  // Computed properties for progress display
  const stageIcon = computed(() => {
    switch (props.generationStage) {
      case 'starting':
        return PlayIcon;
      case 'transcribing':
        return MicIcon;
      case 'analyzing':
        return BrainIcon;
      case 'validating':
        return ActivityIcon;
      case 'completed':
        return CheckCircleIcon;
      case 'error':
        return XCircleIcon;
      default:
        return PlayIcon;
    }
  });

  const stageIconClass = computed(() => {
    switch (props.generationStage) {
      case 'starting':
        return 'text-blue-500';
      case 'transcribing':
        return 'text-yellow-500';
      case 'analyzing':
        return 'text-purple-500';
      case 'validating':
        return 'text-orange-500';
      case 'completed':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      default:
        return 'text-blue-500';
    }
  });

  const stageTitle = computed(() => {
    switch (props.generationStage) {
      case 'starting':
        return 'Separating Audio';
      case 'transcribing':
        return 'Transcribing Audio';
      case 'analyzing':
        return 'Detecting Clips';
      case 'validating':
        return 'Validating Results';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Separating Audio';
    }
  });

  const stageDescription = computed(() => {
    switch (props.generationStage) {
      case 'starting':
        return 'Separating audio from vidoe...';
      case 'transcribing':
        return 'Converting audio to text using AI...';
      case 'analyzing':
        return 'Analyzing transcript for clip-worthy moments...';
      case 'validating':
        return 'Validating timestamps and refining clips...';
      case 'completed':
        return 'Clips have been successfully generated!';
      case 'error':
        return 'An error occurred during processing.';
      default:
        return 'Separating audio from vidoe...';
    }
  });

  // Watch for timeline hover changes to clear internal hover state
  watch(
    () => props.hoveredTimelineClipId,
    (newTimelineHoverId) => {
      if (newTimelineHoverId) {
        hoveredClipId.value = null;
      }
    }
  );

  // Watch for playing clip changes to clear hover state when playback starts
  watch(
    () => props.playingClipId,
    (newPlayingId) => {
      if (newPlayingId) {
        hoveredClipId.value = null;
      }
    }
  );

  // Functions
  function formatDuration(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatTime(seconds: number): string {
    if (!seconds) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function getLoadingMessage(): string {
    switch (props.generationStage) {
      case 'starting':
        return 'Initializing detection...';
      case 'transcribing':
        return 'Transcribing audio...';
      case 'analyzing':
        return 'Analyzing for clips...';
      case 'validating':
        return 'Validating results...';
      case 'completed':
        return 'Finalizing results...';
      case 'error':
        return 'Something went wrong';
      default:
        return 'Processing...';
    }
  }

  function getViralityColorClass(score: number | null | undefined): string {
    if (!score) return 'bg-muted/50 text-muted-foreground';
    if (score >= 90)
      return 'bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30 shadow-[0_0_8px_rgba(244,63,94,0.15)]';
    if (score >= 80) return 'bg-orange-500/15 text-orange-400 ring-1 ring-orange-500/30';
    if (score >= 60) return 'bg-yellow-500/15 text-yellow-400 ring-1 ring-yellow-500/30';
    return 'bg-muted/50 text-muted-foreground';
  }

  function getConfidenceColorClass(score: number | null | undefined): string {
    if (!score) return 'text-muted-foreground';
    if (score >= 0.8) return 'text-green-400';
    if (score >= 0.6) return 'text-yellow-400';
    return 'text-muted-foreground';
  }

  function getTimeEstimate(): string {
    const estimates = {
      starting: 'This usually takes about 30 seconds',
      transcribing: getTranscriptionEstimate(),
      analyzing: 'This typically takes 1-2 minutes',
      validating: 'Almost done... 30 seconds remaining',
      completed: 'Finishing up...',
      error: 'Please try again',
      default: 'This may take a few minutes depending on video length',
    };

    return estimates[props.generationStage as keyof typeof estimates] || estimates.default;
  }

  function getTranscriptionEstimate(): string {
    if (!props.videoDuration || props.videoDuration === 0) {
      return 'This typically takes 2-10 minutes depending on video length';
    }

    const durationInMinutes = Math.round(props.videoDuration / 60);

    if (durationInMinutes <= 5) {
      return 'less than 2 minutes';
    } else if (durationInMinutes <= 15) {
      return '2-5 minutes';
    } else if (durationInMinutes <= 30) {
      return '5-10 minutes';
    } else if (durationInMinutes <= 60) {
      return '10-20 minutes';
    } else {
      return '15-30 minutes';
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

  function onClipClick(clipId: string) {
    const clip = props.clips.find((c) => c.id === clipId);

    if (clip?.current_version_segments && clip.current_version_segments.length > 0) {
      const sortedSegments = [...clip.current_version_segments].sort((a, b) => a.start_time - b.start_time);
      const firstSegment = sortedSegments[0];
      emit('seekVideo', firstSegment.start_time);
    }

    hoveredClipId.value = hoveredClipId.value === clipId ? null : clipId;
    emit('clipHover', clipId);
    emit('scrollToTimeline');
  }

  function setClipRef(el: any, clipId: string) {
    if (el && el instanceof HTMLElement) {
      clipElements.value.set(clipId, el);
    } else {
      clipElements.value.delete(clipId);
    }
  }

  function scrollClipIntoView(clipId: string) {
    const clipElement = clipElements.value.get(clipId);
    const container = clipsScrollContainer.value;

    if (clipElement && container) {
      clipElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }

  // Clip building functions
  async function onBuildClip(clip: ClipWithVersion) {
    if (!props.projectId) {
      console.error('[ClipsTab] No project ID available for clip build');
      return;
    }

    if (!clip.current_version_segments || clip.current_version_segments.length === 0) {
      console.error('[ClipsTab] No segments found for clip build');
      return;
    }

    clipToBuild.value = clip;
    showBuildSettingsDialog.value = true;
  }

  async function onBuildConfirm(settings: BuildSettings) {
    const clip = clipToBuild.value;
    if (!clip || !props.projectId) {
      console.error('[ClipsTab] No clip or project ID available for build');
      return;
    }

    try {
      console.log('[ClipsTab] Starting clip build for:', clip.id, 'with settings:', settings);

      const { updateClipBuildStatus, getRawVideosByProjectId } = await import('@/services/database');

      // Update database status to building
      await updateClipBuildStatus(clip.id, 'building', { progress: 0 });

      // Get the project video file path
      const rawVideos = await getRawVideosByProjectId(props.projectId);
      if (rawVideos.length === 0) {
        throw new Error('No project video found');
      }

      const projectVideo = rawVideos[0];

      // Prepare segments for the Rust backend
      const segments = (clip.current_version_segments || []).map((segment) => ({
        id: segment.id,
        start_time: segment.start_time,
        end_time: segment.end_time,
        duration: segment.duration,
        transcript: segment.transcript,
      }));

      // Call the Tauri clip building command
      const { invoke } = await import('@tauri-apps/api/core');

      // Get transcript data
      const transcriptWords = props.transcriptData?.words || [];
      const transcriptSegments = props.transcriptData?.whisperSegments || [];

      // Pass all build settings to the backend
      await invoke('build_clip_from_segments', {
        projectId: props.projectId,
        clipId: clip.id,
        clipName: clip.current_version_name || clip.name || 'Untitled',
        videoPath: projectVideo.file_path,
        segments: segments,
        subtitleSettings: settings.includeSubtitles
          ? props.subtitleSettings
          : { ...props.subtitleSettings, enabled: false },
        transcriptWords: transcriptWords,
        transcriptSegments: transcriptSegments,
        maxWords: props.maxWordsForAspectRatio,
        aspectRatios: settings.aspectRatios,
        quality: settings.quality,
        frameRate: settings.frameRate,
        outputFormat: settings.format,
        runNumber: clip.run_number || null,
        introPath: settings.intro?.file_path || null,
        introDuration: settings.intro?.duration || null,
        outroPath: settings.outro?.file_path || null,
        outroDuration: settings.outro?.duration || null,
      });

      console.log('[ClipsTab] Clip build started successfully');

      // Refresh clips to show building status
      emit('refreshClips');
    } catch (error) {
      console.error('[ClipsTab] Failed to start clip build:', error);

      const { updateClipBuildStatus } = await import('@/services/database');

      // Update database status to failed
      await updateClipBuildStatus(clip.id, 'failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Refresh clips to show failed status
      emit('refreshClips');

      // Show error via event
      showError('Build Failed', `Failed to build clip: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function onOpenBuiltClip(clip: ClipWithVersion) {
    if (!clip.built_file_path) {
      console.error('[ClipsTab] No built file path available');
      return;
    }

    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(clip.built_file_path);
      console.log('[ClipsTab] Opened built clip:', clip.built_file_path);
    } catch (error) {
      console.error('[ClipsTab] Failed to open built clip:', error);
      showError('Failed to Open', 'Could not open the built clip file. Please check if the file still exists.');
    }
  }

  async function showError(title: string, message: string) {
    try {
      const toastComposable = await import('@/composables/useToast');
      const { error: showErrorToast } = toastComposable.useToast();
      showErrorToast(title, message, 8000);
    } catch (error) {
      console.error('[ClipsTab] Failed to show error message:', error);
      alert(`${title}: ${message}`);
    }
  }

  // Expose methods
  defineExpose({
    scrollClipIntoView,
  });
</script>

<style scoped>
  /* Custom scrollbar styling */
  .custom-scrollbar::-webkit-scrollbar {
    width: 8px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
    margin: 4px 0;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.3);
    border-radius: 4px;
    border: 2px solid transparent;
    background-clip: padding-box;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.5);
    background-clip: padding-box;
  }

  /* Firefox scrollbar */
  .custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: hsl(var(--muted-foreground) / 0.3) transparent;
  }
</style>
