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
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3.5 w-3.5 group-hover:rotate-180 transition-transform duration-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
        <span>Detect More</span>
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <!-- Progress State -->
      <div v-if="isGenerating" class="h-full flex items-center justify-center px-4">
        <div class="text-center text-foreground w-full max-w-md">
          <!-- Stage Icon -->
          <div class="mb-6 flex justify-center">
            <div
              class="w-20 h-20 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-lg"
              :class="
                stageIconClass.replace('text-', 'from-') +
                '/10 via-' +
                stageIconClass.replace('text-', '') +
                '/5 to-transparent border-2 border-' +
                stageIconClass.replace('text-', '') +
                '/30'
              "
            >
              <component :is="stageIcon" :class="stageIconClass" class="h-9 w-9" />
            </div>
          </div>
          <!-- Stage Title -->
          <h4 class="font-semibold text-foreground mb-2 text-lg">{{ stageTitle }}</h4>

          <p class="text-sm text-foreground/70 mb-10 leading-relaxed">{{ stageDescription }}</p>
          <!-- Loading Spinner with Time Estimate -->
          <div class="mb-6">
            <div class="flex justify-center mb-5">
              <!-- Large spinner -->
              <div class="relative w-14 h-14">
                <div class="absolute inset-0 border-4 border-muted/30 rounded-full"></div>
                <div
                  class="absolute inset-0 border-4 border-transparent rounded-full animate-spin"
                  :class="stageIconClass.replace('text-', 'border-t-')"
                  style="animation-duration: 0.8s"
                ></div>
              </div>
            </div>

            <!-- Time estimate -->
            <div class="text-center mb-4">
              <p class="text-sm font-medium text-foreground mb-1.5">
                {{ getLoadingMessage() }}
              </p>
              <p class="text-xs text-muted-foreground">
                {{ getTimeEstimate() }}
              </p>
            </div>
          </div>
          <!-- Status Message -->
          <div
            v-if="generationMessage"
            class="text-sm text-foreground/80 bg-muted/50 rounded-lg p-4 mb-4 border border-border/60"
          >
            {{ generationMessage }}
          </div>
          <!-- Error State -->
          <div v-if="generationError" class="bg-red-500/10 border-2 border-red-500/30 rounded-lg p-4 mb-4">
            <div class="flex items-start gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div class="text-left flex-1">
                <h4 class="font-semibold text-red-400 text-sm mb-1">Error</h4>
                <p class="text-xs text-red-400/90 leading-relaxed">{{ generationError }}</p>
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

            <div class="flex flex-col p-3.5 pl-4">
              <!-- Main Content Row -->
              <div class="flex items-start justify-between gap-3">
                <!-- Left: Number + Content -->
                <div class="flex items-start gap-2.5 flex-1 min-w-0">
                  <!-- Number Badge -->
                  <span class="text-xs font-bold text-foreground/30 mt-0.5 flex-shrink-0 tabular-nums select-none">
                    #{{ index + 1 }}
                  </span>

                  <!-- Content Column -->
                  <div class="flex-1 min-w-0 space-y-2">
                    <!-- Title -->
                    <h5 class="text-[15px] font-semibold text-foreground leading-tight line-clamp-2">
                      {{ clip.current_version_name || clip.name || 'Untitled Clip' }}
                    </h5>

                    <!-- Primary Info Row: Duration + Time Range -->
                    <div class="flex items-center gap-2.5 flex-wrap text-xs">
                      <!-- Duration Badge -->
                      <span
                        class="inline-flex items-center gap-1.5 text-foreground font-semibold bg-muted/60 px-2 py-0.5 rounded-md tabular-nums"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-3 w-3 text-foreground/70"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {{
                          formatDuration((clip.current_version_end_time || 0) - (clip.current_version_start_time || 0))
                        }}
                      </span>

                      <!-- Time Range -->
                      <span class="font-mono text-muted-foreground/80 text-[11px] tabular-nums">
                        {{ formatTime(clip.current_version_start_time || 0) }} →
                        {{ formatTime(clip.current_version_end_time || 0) }}
                      </span>

                      <!-- Build Status (when completed) -->
                      <span
                        v-if="clip.build_status === 'completed'"
                        class="inline-flex items-center gap-1 text-green-400 text-[11px] font-medium"
                        :title="`Built: ${clip.built_file_size ? formatFileSize(clip.built_file_size) : 'Complete'}`"
                      >
                        <CheckIcon class="h-3 w-3" />
                        Built
                        <span v-if="clip.built_file_size" class="text-green-400/70">
                          ({{ formatFileSize(clip.built_file_size) }})
                        </span>
                      </span>

                      <!-- Build Progress -->
                      <span
                        v-else-if="clip.build_status === 'building'"
                        class="inline-flex items-center gap-1.5 text-blue-400 text-[11px] font-medium"
                      >
                        <LoaderIcon class="h-3 w-3 animate-spin" />
                        Building {{ Math.round(clip.build_progress || 0) }}%
                      </span>

                      <!-- Playing Indicator -->
                      <span
                        v-if="props.isPlayingSegments && props.playingClipId === clip.id"
                        class="inline-flex items-center gap-1.5 text-green-400 text-[11px] font-semibold"
                      >
                        <div class="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></div>
                        Playing
                      </span>
                    </div>

                    <!-- Secondary Info Row: Run + Prompt + Timestamp -->
                    <div class="flex items-center gap-2 flex-wrap text-[11px]">
                      <!-- Run Number Badge -->
                      <span
                        v-if="clip.run_number"
                        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium bg-muted/40"
                        :style="{
                          color: clip.session_run_color || '#A78BFA',
                          backgroundColor: clip.session_run_color ? `${clip.session_run_color}15` : undefined,
                        }"
                        :title="`Detection run ${clip.run_number}`"
                      >
                        <div
                          class="w-1.5 h-1.5 rounded-full"
                          :style="{ backgroundColor: clip.session_run_color || '#8B5CF6' }"
                        ></div>
                        Run {{ clip.run_number }}
                      </span>

                      <!-- Prompt Badge -->
                      <span
                        v-if="clip.session_prompt"
                        class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md font-medium bg-purple-500/10 text-purple-400"
                        :title="`Used prompt: ${getPromptName(clip.session_prompt)}`"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-2.5 w-2.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                          />
                        </svg>
                        <span class="truncate max-w-32">{{ getPromptName(clip.session_prompt) }}</span>
                      </span>

                      <!-- Timestamp -->
                      <span v-if="clip.session_created_at" class="text-muted-foreground/60 flex items-center gap-1">
                        <ClockIcon class="h-3 w-3" />
                        {{ formatTimestamp(clip.session_created_at) }}
                      </span>

                      <!-- Confidence Score (hover to see) -->
                      <span
                        v-if="clip.current_version_confidence_score"
                        class="inline-flex items-center gap-1 text-blue-400/70 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Confidence score"
                      >
                        <TrendingUpIcon class="h-3 w-3" />
                        {{ Math.round((clip.current_version_confidence_score || 0) * 100) }}%
                      </span>
                    </div>
                  </div>
                </div>

                <!-- Right: Action Buttons -->
                <div
                  class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0"
                >
                  <button
                    class="p-2 hover:bg-blue-500/15 rounded-md transition-all duration-150 text-foreground/60 hover:text-blue-400 hover:scale-105 active:scale-95"
                    title="Play clip"
                    @click.stop="onPlayClip(clip)"
                  >
                    <PlayIcon class="h-4 w-4" />
                  </button>

                  <!-- Build/Download Button -->
                  <button
                    v-if="!clip.build_status || clip.build_status === 'pending' || clip.build_status === 'failed'"
                    class="p-2 hover:bg-green-500/15 rounded-md transition-all duration-150 text-foreground/60 hover:text-green-400 hover:scale-105 active:scale-95"
                    title="Build clip"
                    @click.stop="onBuildClip(clip)"
                  >
                    <WrenchIcon class="h-4 w-4" />
                  </button>
                  <button
                    v-else-if="clip.build_status === 'completed' && clip.built_file_path"
                    class="p-2 hover:bg-green-500/15 rounded-md transition-all duration-150 text-green-500/80 hover:text-green-400 hover:scale-105 active:scale-95"
                    title="Open built clip"
                    @click.stop="onOpenBuiltClip(clip)"
                  >
                    <DownloadIcon class="h-4 w-4" />
                  </button>

                  <button
                    class="p-2 hover:bg-red-500/15 rounded-md transition-all duration-150 text-foreground/60 hover:text-red-400 hover:scale-105 active:scale-95"
                    title="Delete clip"
                    @click.stop="onDeleteClip(clip.id)"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
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
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-12 w-12 text-purple-400/80"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-4 w-4 group-hover:rotate-180 transition-transform duration-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
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
    TrendingUpIcon,
    WrenchIcon,
    DownloadIcon,
    LoaderIcon,
    CheckIcon,
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

  // Computed property to match session prompt content to prompt names
  const promptNameMap = computed(() => {
    const map = new Map<string, string>();
    props.prompts.forEach((prompt) => {
      map.set(prompt.content, prompt.name);
    });
    return map;
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

  function formatTimestamp(timestamp: number): string {
    return new Date(timestamp * 1000).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getPromptName(sessionPrompt?: string): string {
    if (!sessionPrompt) return 'Unknown Prompt';
    return promptNameMap.value.get(sessionPrompt) || 'Custom Prompt';
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
