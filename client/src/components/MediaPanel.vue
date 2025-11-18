<template>
  <div class="px-4 flex flex-col flex-1 h-full" data-media-panel>
    <!-- Tabs Header -->
    <div class="flex items-center border-b border-border -mx-3 px-3">
      <button
        @click="activeTab = 'clips'"
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors relative',
          activeTab === 'clips' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        ]"
      >
        Clips
        <div v-if="activeTab === 'clips'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
      </button>
      <button
        @click="activeTab = 'audio'"
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors relative',
          activeTab === 'audio' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        ]"
      >
        Audio
        <div v-if="activeTab === 'audio'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
      </button>
      <button
        @click="activeTab = 'transcript'"
        :class="[
          'px-4 py-2 text-sm font-medium transition-colors relative',
          activeTab === 'transcript' ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
        ]"
      >
        Transcript
        <div v-if="activeTab === 'transcript'" class="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"></div>
      </button>
    </div>

    <!-- Clips Tab Content -->
    <div v-if="activeTab === 'clips'" class="flex-1 flex flex-col overflow-hidden mt-4">
      <div class="flex items-center mb-3">
        <!-- Redesigned detect more button (only show when not generating and clips exist) -->
        <button
          v-if="!isGenerating && clips.length > 0"
          @click="handleDetectClips"
          class="group flex items-center gap-1.5 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground border border-border hover:border-foreground/30 rounded-md transition-all duration-200"
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
          <span class="font-medium">Detect More</span>
        </button>
      </div>

      <div class="flex-1 overflow-y-auto">
        <!-- Progress State -->
        <div v-if="isGenerating" class="h-full flex items-center justify-center px-4">
          <div class="text-center text-foreground w-full max-w-sm">
            <!-- Stage Icon -->
            <div class="mb-5 flex justify-center">
              <div
                class="w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center"
                :class="
                  stageIconClass.replace('text-', 'from-') +
                  '/10 to-' +
                  stageIconClass.replace('text-', '') +
                  '/5 border border-' +
                  stageIconClass.replace('text-', '') +
                  '/20'
                "
              >
                <component :is="stageIcon" :class="stageIconClass" class="h-8 w-8" />
              </div>
            </div>
            <!-- Stage Title -->
            <h4 class="font-semibold text-foreground mb-2 text-base">{{ stageTitle }}</h4>

            <p class="text-sm text-foreground/60 mb-12 leading-relaxed">{{ stageDescription }}</p>
            <!-- Loading Spinner with Time Estimate -->
            <div class="mb-5">
              <div class="flex justify-center mb-4">
                <!-- Large spinner -->
                <div class="relative w-12 h-12">
                  <div class="absolute inset-0 border-4 border-muted/30 rounded-full"></div>
                  <div
                    class="absolute inset-0 border-4 border-transparent border-t-primary rounded-full animate-spin"
                    :class="stageIconClass.replace('text-', 'border-t-')"
                  ></div>
                </div>
              </div>

              <!-- Time estimate -->
              <div class="text-center mb-4">
                <p class="text-sm font-medium text-foreground mb-1">
                  {{ getLoadingMessage() }}
                </p>
                <p class="text-xs text-foreground/50">
                  {{ getTimeEstimate() }}
                </p>
              </div>
            </div>
            <!-- Status Message -->
            <div
              v-if="generationMessage"
              class="text-sm text-foreground/70 bg-muted/40 rounded-lg p-3 mb-4 border border-muted"
            >
              {{ generationMessage }}
            </div>
            <!-- Error State -->
            <div v-if="generationError" class="bg-destructive/10 border border-destructive/30 rounded-lg p-3.5 mb-4">
              <div class="flex items-start gap-2.5">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5 text-destructive flex-shrink-0 mt-0.5"
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
                <div class="text-left">
                  <h4 class="font-semibold text-destructive text-sm mb-1">Error</h4>

                  <p class="text-xs text-destructive/80 leading-relaxed">{{ generationError }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Clips List State -->
        <div
          v-else-if="clips.length > 0 && !isGenerating"
          class="w-full flex-1 overflow-y-auto pr-1"
          ref="clipsScrollContainer"
        >
          <!-- Clips Grid -->
          <div class="space-y-3">
            <div
              v-for="(clip, index) in clips"
              :key="clip.id"
              :ref="(el) => setClipRef(el, clip.id)"
              :class="[
                'group p-2 bg-muted/20 border rounded-lg cursor-pointer',
                index === clips.length - 1 ? 'mb-4' : '',
                // Only apply transition if not the currently playing clip
                // !(props.isPlayingSegments && props.playingClipId === clip.id)
                //   ? 'transition-all duration-200 ease-out'
                //   : '',
                // Playing clip gets green styling
                props.isPlayingSegments && props.playingClipId === clip.id
                  ? 'ring-1 ring-green-500/60 bg-green-500/5 border-green-500/50 shadow-sm'
                  : 'hover:border-border/80 hover:bg-muted/30 hover:shadow-sm',
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
                    ? '2px'
                    : undefined,
              }"
              @click="onClipClick(clip.id)"
            >
              <div class="flex flex-col gap-2">
                <!-- Header with title and actions -->
                <div class="flex items-start justify-between gap-2">
                  <div class="flex items-start gap-1.5 flex-1 min-w-0">
                    <span class="text-xs font-bold text-foreground/40 mt-0.5 flex-shrink-0">#{{ index + 1 }}</span>
                    <h5
                      class="text-sm font-semibold text-foreground leading-snug flex-1 group-hover:text-foreground transition-colors"
                    >
                      {{ clip.current_version?.name || clip.name || 'Untitled Clip' }}
                    </h5>
                  </div>

                  <!-- Action Buttons (always visible, more subtle) -->
                  <div class="flex items-center gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      class="p-1 hover:bg-muted rounded-md transition-colors text-foreground/60 hover:text-blue-500"
                      title="Play clip"
                      @click.stop="onPlayClip(clip)"
                    >
                      <PlayIcon class="h-3 w-3" />
                    </button>

                    <!-- Build Clip Button -->
                    <button
                      v-if="!clip.build_status || clip.build_status === 'pending' || clip.build_status === 'failed'"
                      class="p-1 hover:bg-muted rounded-md transition-colors text-foreground/60 hover:text-green-500"
                      title="Build clip"
                      @click.stop="onBuildClip(clip)"
                    >
                      <WrenchIcon class="h-3 w-3" />
                    </button>

                    <!-- View Built Clip Button (when completed) -->
                    <button
                      v-else-if="clip.build_status === 'completed' && clip.built_file_path"
                      class="p-1 hover:bg-muted rounded-md transition-colors text-green-500 hover:text-green-600"
                      title="Open built clip"
                      @click.stop="onOpenBuiltClip(clip)"
                    >
                      <DownloadIcon class="h-3 w-3" />
                    </button>

                    <!-- Building Status -->
                    <div
                      v-else-if="clip.build_status === 'building'"
                      class="p-1 text-green-500 animate-pulse"
                      title="Building clip..."
                    >
                      <LoaderIcon class="h-3 w-3 animate-spin" />
                    </div>

                    <!-- Completed Status -->
                    <div
                      v-else-if="clip.build_status === 'completed'"
                      class="p-1 text-green-500"
                      title="Clip built successfully"
                    >
                      <CheckIcon class="h-3 w-3" />
                    </div>

                    <!-- Failed Status -->
                    <button
                      v-else-if="clip.build_status === 'failed'"
                      class="p-1 hover:bg-muted rounded-md transition-colors text-red-500 hover:text-red-600"
                      title="Build failed - click to retry"
                      @click.stop="onBuildClip(clip)"
                    >
                      <AlertCircleIcon class="h-3 w-3" />
                    </button>

                    <button
                      class="p-1 hover:bg-muted rounded-md transition-colors text-foreground/60 hover:text-red-500"
                      title="Delete clip"
                      @click.stop="onDeleteClip(clip.id)"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-3 w-3"
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

                <!-- Info Section -->
                <div class="flex-1 min-w-0 pl-5">
                  <!-- Primary Info Row -->
                  <div class="flex items-center gap-2 text-xs mb-1.5">
                    <span class="font-semibold text-foreground/80 bg-muted/50 px-2 py-0.5 rounded">
                      {{
                        formatDuration((clip.current_version?.end_time || 0) - (clip.current_version?.start_time || 0))
                      }}
                    </span>
                    <span class="text-foreground/30">•</span>
                    <span class="font-mono text-foreground/60 text-[11px] pt-0.5">
                      {{ formatTime(clip.current_version?.start_time || 0) }} -
                      {{ formatTime(clip.current_version?.end_time || 0) }}
                    </span>
                  </div>

                  <!-- Secondary Info Row -->
                  <div class="flex items-center gap-1.5 text-xs flex-wrap">
                    <!-- Run Number (more subtle, inline) -->
                    <span
                      v-if="clip.run_number"
                      class="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded font-medium"
                      :style="{
                        color: clip.session_run_color || '#A78BFA',
                      }"
                      :title="`Detection run ${clip.run_number}`"
                    >
                      <div
                        class="w-1.5 h-1.5 rounded-full"
                        :style="{
                          backgroundColor: clip.session_run_color || '#8B5CF6',
                        }"
                      ></div>
                      Run {{ clip.run_number }}
                    </span>

                    <!-- Prompt Name -->
                    <span
                      v-if="clip.session_prompt"
                      class="flex items-center gap-1 bg-purple-500/15 text-purple-400 px-1.5 py-0.5 rounded-md font-medium text-[10px]"
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
                      <span class="truncate max-w-20">{{ getPromptName(clip.session_prompt) }}</span>
                    </span>

                    <span
                      v-if="clip.current_version?.confidence_score"
                      class="flex items-center gap-1 bg-blue-500/15 text-blue-400 px-1.5 py-0.5 rounded-md font-medium text-[10px]"
                    >
                      <TrendingUpIcon class="h-2.5 w-2.5" />
                      <span>{{ Math.round((clip.current_version.confidence_score || 0) * 100) }}%</span>
                    </span>
                    <span v-if="clip.session_created_at" class="flex items-center gap-1 text-foreground/50">
                      <ClockIcon class="h-3 w-3" />
                      {{ formatTimestamp(clip.session_created_at) }}
                    </span>
                    <span
                      v-if="props.isPlayingSegments && props.playingClipId === clip.id"
                      class="flex items-center gap-1 text-green-500 bg-green-500/15 px-1.5 py-0.5 rounded-md font-semibold text-[10px]"
                    >
                      <div class="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                      Playing
                    </span>

                    <!-- Build Progress Indicator -->
                    <span
                      v-if="clip.build_status === 'building'"
                      class="flex items-center gap-1 text-blue-500 bg-blue-500/15 px-1.5 py-0.5 rounded-md font-medium text-[10px]"
                    >
                      <div class="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                      Building {{ Math.round(clip.build_progress || 0) }}%
                    </span>

                    <!-- Build Completed Status -->
                    <span
                      v-else-if="clip.build_status === 'completed'"
                      class="flex items-center gap-1 text-green-500 bg-green-500/15 px-1.5 py-0.5 rounded-md font-medium text-[10px]"
                      title="Clip built successfully"
                    >
                      <CheckIcon class="h-2.5 w-2.5" />
                      Built
                      <span v-if="clip.built_file_size" class="ml-1">({{ formatFileSize(clip.built_file_size) }})</span>
                    </span>

                    <!-- Build Failed Status -->
                    <span
                      v-else-if="clip.build_status === 'failed'"
                      class="flex items-center gap-1 text-red-500 bg-red-500/15 px-1.5 py-0.5 rounded-md font-medium text-[10px]"
                      :title="clip.build_error || 'Build failed'"
                    >
                      <AlertCircleIcon class="h-2.5 w-2.5" />
                      Failed
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <!-- Default State -->
        <div v-else class="h-full flex items-center justify-center px-4">
          <div class="text-center text-muted-foreground max-w-xs">
            <div class="mb-6 flex flex-col items-center">
              <div
                class="w-20 h-20 bg-gradient-to-br from-purple-500/10 to-indigo-500/10 rounded-2xl flex items-center justify-center mb-5 border border-purple-500/20"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-9 w-9 text-purple-400/70"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h4 class="text-base font-semibold text-foreground mb-2">No Clips Yet</h4>
              <p class="text-sm text-muted-foreground mb-6 leading-relaxed">
                Start detecting clips from your video using AI-powered analysis
              </p>
            </div>
            <button
              @click="handleDetectClips"
              class="group flex items-center gap-2 px-4 py-2 text-sm font-medium text-foreground border-2 border-border hover:border-foreground/40 rounded-md transition-all mx-auto"
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
              Detect Clips
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Audio Tab Content -->
    <div v-if="activeTab === 'audio'" class="flex-1 flex flex-col overflow-hidden">
      <div class="h-full flex items-center justify-center px-4">
        <div class="text-center text-muted-foreground max-w-xs">
          <div class="mb-6 flex flex-col items-center">
            <div
              class="w-20 h-20 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-2xl flex items-center justify-center mb-5 border border-blue-500/20"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-9 w-9 text-blue-400/70"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
                />
              </svg>
            </div>
            <h4 class="text-base font-semibold text-foreground mb-2">Audio Tab</h4>
            <p class="text-sm text-muted-foreground leading-relaxed">Audio functionality will be implemented here</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Transcript Tab Content -->
    <div v-if="activeTab === 'transcript'" class="flex-1 flex flex-col overflow-hidden">
      <TranscriptPanel
        :project-id="projectId"
        :current-time="currentTime"
        :duration="videoDuration"
        @seekVideo="onSeekVideo"
      />
    </div>
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
    getRawVideosByProjectId,
    type ClipWithVersion,
    type ClipDetectionSession,
    type Prompt,
  } from '@/services/database';
  import type { MediaPanelProps, MediaPanelEmits } from '../types';
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
    AlertCircleIcon,
    LoaderIcon,
    CheckIcon,
  } from 'lucide-vue-next';
  import TranscriptPanel from './TranscriptPanel.vue';

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
  const hoveredClipId = ref<string | null>(null);

  // Refs for scroll containers
  const clipsScrollContainer = ref<HTMLElement | null>(null);

  onMounted(async () => {
    // Load prompts for name matching
    await loadPrompts();
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

  // Watch for timeline hover changes to clear internal hover state
  watch(
    () => props.hoveredTimelineClipId,
    (newTimelineHoverId) => {
      if (newTimelineHoverId) {
        // Clear internal hover state when timeline hover is active
        hoveredClipId.value = null;
      }
    }
  );

  // Watch for playing clip changes to clear hover state when playback starts
  watch(
    () => props.playingClipId,
    (newPlayingId) => {
      if (newPlayingId) {
        // Clear all hover states when a clip starts playing
        hoveredClipId.value = null;
      }
    }
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
      if (clips.value.length > 0) {
        // Log all unique run colors for debugging
        const uniqueRuns = new Map<number, string>();
        clips.value.forEach((clip) => {
          if (clip.run_number && clip.session_run_color) {
            uniqueRuns.set(clip.run_number, clip.session_run_color);
          }
        });
      }

      // Load detection sessions for history
      detectionSessions.value = await getClipDetectionSessionsByProjectId(projectId);
    } catch (error) {
      console.error('[MediaPanel] Failed to load clips:', error);
    } finally {
      loadingClips.value = false;
    }
  }

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

  // Clip click event handler
  function onClipClick(clipId: string) {
    // Find the clip from our clips array
    const clip = clips.value.find((c) => c.id === clipId);

    if (clip && clip.current_version_segments && clip.current_version_segments.length > 0) {
      // Sort segments by start_time to find the first one
      const sortedSegments = [...clip.current_version_segments].sort((a, b) => a.start_time - b.start_time);
      const firstSegment = sortedSegments[0];

      // Emit seek event to move video to the start of the first segment
      emit('seekVideo', firstSegment.start_time);
    }

    // Toggle the hovered state - if clicking the same clip, unhighlight it
    hoveredClipId.value = hoveredClipId.value === clipId ? null : clipId;
    emit('clipHover', clipId);
    emit('scrollToTimeline');
  }

  function onSeekVideo(time: number) {
    emit('seekVideo', time);
  }

  // Ref management for clip elements
  const clipElements = ref<Map<string, HTMLElement>>(new Map());

  function setClipRef(el: any, clipId: string) {
    if (el && el instanceof HTMLElement) {
      clipElements.value.set(clipId, el);
    } else {
      clipElements.value.delete(clipId);
    }
  }

  // Function to scroll clip into view
  function scrollClipIntoView(clipId: string) {
    const clipElement = clipElements.value.get(clipId);
    const container = clipsScrollContainer.value;

    if (clipElement && container) {
      // Always force scroll to the bottom-most clip for testing
      clipElement.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
      return;
    } else {
      console.log('[MediaPanel] Cannot scroll - missing elements');
    }
  }

  // Expose function to parent (will be merged with existing defineExpose)

  // Computed property to match session prompt content to prompt names
  const promptNameMap = computed(() => {
    const map = new Map<string, string>();
    prompts.value.forEach((prompt) => {
      map.set(prompt.content, prompt.name);
    });
    return map;
  });

  // Function to get prompt name from session prompt content
  function getPromptName(sessionPrompt?: string): string {
    if (!sessionPrompt) return 'Unknown Prompt';
    return promptNameMap.value.get(sessionPrompt) || 'Custom Prompt';
  }

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

  // Functions for the new spinner UI
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
    // Base time estimates in minutes for different video lengths
    // These are rough estimates to set user expectations
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

    // Convert video duration from seconds to minutes
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

  // ===== CLIP BUILDING FUNCTIONS =====

  // Format file size for display
  function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Handle clip build request
  async function onBuildClip(clip: ClipWithVersion) {
    if (!props.projectId) {
      console.error('[MediaPanel] No project ID available for clip build');
      return;
    }

    if (!clip.current_version_segments || clip.current_version_segments.length === 0) {
      console.error('[MediaPanel] No segments found for clip build');
      return;
    }

    try {
      console.log('[MediaPanel] Starting clip build for:', clip.id);

      // Update database status to building
      await updateClipBuildStatus(clip.id, 'building', { progress: 0 });

      // Get the project video file path
      const rawVideos = await getRawVideosByProjectId(props.projectId);
      if (rawVideos.length === 0) {
        throw new Error('No project video found');
      }

      const projectVideo = rawVideos[0];

      // Prepare segments for the Rust backend
      const segments = clip.current_version_segments.map((segment) => ({
        id: segment.id,
        start_time: segment.start_time,
        end_time: segment.end_time,
        duration: segment.duration,
        transcript: segment.transcript,
      }));

      // Call the Tauri clip building command
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('build_clip_from_segments', {
        projectId: props.projectId,
        clipId: clip.id,
        videoPath: projectVideo.file_path,
        segments: segments,
      });

      console.log('[MediaPanel] Clip build started successfully');

      // Refresh clips to show building status
      await refreshClips();
    } catch (error) {
      console.error('[MediaPanel] Failed to start clip build:', error);

      // Update database status to failed
      await updateClipBuildStatus(clip.id, 'failed', {
        error: error instanceof Error ? error.message : String(error),
      });

      // Refresh clips to show failed status
      await refreshClips();

      // Show user-friendly error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      showErrorMessage(
        'Build Failed',
        `Failed to build clip "${clip.current_version?.name || clip.name || 'Untitled'}": ${errorMessage}`
      );
    }
  }

  // Open/view built clip
  async function onOpenBuiltClip(clip: ClipWithVersion) {
    if (!clip.built_file_path) {
      console.error('[MediaPanel] No built file path available');
      return;
    }

    try {
      const { revealItemInDir } = await import('@tauri-apps/plugin-opener');
      await revealItemInDir(clip.built_file_path);
      console.log('[MediaPanel] Opened built clip:', clip.built_file_path);
    } catch (error) {
      console.error('[MediaPanel] Failed to open built clip:', error);
      showErrorMessage('Failed to Open', 'Could not open the built clip file. Please check if the file still exists.');
    }
  }

  // Show error message to user (using toast)
  async function showErrorMessage(title: string, message: string) {
    try {
      // Import and use toast composable
      const toastComposable = await import('@/composables/useToast');
      const { error: showError } = toastComposable.useToast();
      showError(title, message, 8000);
    } catch (error) {
      console.error('[MediaPanel] Failed to show error message:', error);
      // Fallback to alert if toast is not available
      alert(`${title}: ${message}`);
    }
  }

  // Expose methods for external access
  defineExpose({
    refreshClips,
    scrollClipIntoView,
  });

  // Event listener for fallback refresh mechanism
  function handleRefreshEvent(event: CustomEvent) {
    if (event.detail?.projectId === props.projectId) {
      refreshClips();
    }
  }

  // Handle clip build progress events
  function handleClipBuildProgress(event: any) {
    // Tauri events provide payload in event.payload, not event.detail
    const payload = event.payload || event.detail;
    const { clip_id, progress, stage, message } = payload;

    console.log(`[MediaPanel] Received clip build progress event for: ${clip_id}`);

    // Only process if this clip belongs to our project
    const clip = clips.value.find((c) => c.id === clip_id);
    if (!clip) {
      console.log(`[MediaPanel] Clip ${clip_id} not found in current clips array, updating database anyway`);
      // Still update database even if not in current array
    } else {
      console.log(`[MediaPanel] Clip build progress: ${clip_id} - ${progress}% - ${stage}`);

      // Update local state immediately
      clip.build_status = 'building';
      clip.build_progress = progress;
    }

    // Update the clip's progress in the database
    updateClipBuildStatus(clip_id, 'building', {
      progress,
      error: stage === 'error' ? message : undefined,
    }).catch((error) => {
      console.error('[MediaPanel] Failed to update clip build progress:', error);
    });

    // Refresh clips to show updated progress
    refreshClips();
  }

  // Handle clip build completion events
  function handleClipBuildComplete(event: any) {
    // Tauri events provide payload in event.payload, not event.detail
    const payload = event.payload || event.detail;
    const { clip_id, success, output_path, thumbnail_path, duration, file_size, error } = payload;

    console.log(`[MediaPanel] Received clip build complete event for: ${clip_id}`);

    // Process regardless of whether clip is in current array - update database directly
    if (success) {
      console.log(`[MediaPanel] Clip build SUCCEEDED: ${clip_id}`);

      // Update database with success status and file info
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
          // Find the clip for showing success message
          const clip = clips.value.find((c) => c.id === clip_id);
          if (clip) {
            showSuccessMessage(
              'Clip Built Successfully',
              `Clip "${clip.current_version?.name || clip.name || 'Untitled'}" has been built successfully! (${formatFileSize(file_size || 0)})`
            );
          } else {
            showSuccessMessage(
              'Clip Built Successfully',
              `Clip has been built successfully! (${formatFileSize(file_size || 0)})`
            );
          }
          // Refresh clips to get updated status
          refreshClips();
        })
        .catch((dbError) => {
          console.error('[MediaPanel] Failed to update clip build completion:', dbError);
        });
    } else {
      console.log(`[MediaPanel] Clip build FAILED: ${clip_id} - ${error}`);

      // Update database with failure status
      updateClipBuildStatus(clip_id, 'failed', {
        progress: 0,
        error: error || 'Unknown build error',
      })
        .then(() => {
          // Find the clip for showing error message
          const clip = clips.value.find((c) => c.id === clip_id);
          if (clip) {
            showErrorMessage(
              'Build Failed',
              `Failed to build clip "${clip.current_version?.name || clip.name || 'Untitled'}": ${error || 'Unknown error'}`
            );
          } else {
            showErrorMessage('Build Failed', `Failed to build clip: ${error || 'Unknown error'}`);
          }
          // Refresh clips to get updated status
          refreshClips();
        })
        .catch((dbError) => {
          console.error('[MediaPanel] Failed to update clip build failure:', dbError);
        });
    }
  }

  // Show success message to user (using toast)
  async function showSuccessMessage(title: string, message: string) {
    try {
      // Import and use toast composable
      const toastComposable = await import('@/composables/useToast');
      const { success: showSuccess } = toastComposable.useToast();
      showSuccess(title, message, 6000);
    } catch (error) {
      console.error('[MediaPanel] Failed to show success message:', error);
      // Fallback to console if toast is not available
      console.log(`✅ ${title}: ${message}`);
    }
  }

  onMounted(async () => {
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

    // Note: Tauri event listeners are automatically cleaned up when the component is unmounted
    // so we don't need to manually remove them
    console.log('[MediaPanel] Component unmounted, event listeners cleaned up');
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
