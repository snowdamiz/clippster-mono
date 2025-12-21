<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="!hidden"
        class="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100]"
        @click.self="handleClose"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl max-w-md w-full mx-4 border border-white/10 overflow-hidden"
          >
            <!-- Decorative top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />

            <div class="p-6">
              <!-- Header -->
              <div class="flex items-center justify-between mb-6">
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/20 border border-violet-500/30 flex items-center justify-center"
                  >
                    <Scissors class="w-5 h-5 text-violet-400" />
                  </div>
                  <div>
                    <h3 class="text-lg font-semibold text-white">Create Clip</h3>
                    <p class="text-xs text-zinc-400">Capture the last {{ selectedDuration }}s of the stream</p>
                  </div>
                </div>
                <button
                  @click="handleClose"
                  class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                  :disabled="isCreating"
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
                    class="px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
                  >
                    <ExternalLink class="w-4 h-4" />
                    View Clip
                  </button>
                  <button
                    @click="handleClose"
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
                <!-- Duration Selection -->
                <div class="mb-6">
                  <label class="block text-sm font-medium text-zinc-300 mb-3">Clip Duration</label>
                  <div class="grid grid-cols-5 gap-2">
                    <button
                      v-for="duration in durationOptions"
                      :key="duration"
                      @click="selectedDuration = duration"
                      :disabled="duration > availableDuration"
                      :class="[
                        'relative py-3 rounded-lg text-sm font-medium transition-all',
                        selectedDuration === duration
                          ? 'bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-lg shadow-violet-500/25'
                          : duration > availableDuration
                            ? 'bg-zinc-800/50 text-zinc-600 cursor-not-allowed'
                            : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white',
                      ]"
                      :title="
                        duration > availableDuration ? `Only ${Math.floor(availableDuration)}s available` : undefined
                      "
                    >
                      {{ duration }}s
                      <span
                        v-if="duration > availableDuration"
                        class="absolute -top-1 -right-1 w-4 h-4 bg-zinc-700 rounded-full flex items-center justify-center"
                      >
                        <Lock class="w-2.5 h-2.5 text-zinc-500" />
                      </span>
                    </button>
                  </div>
                  <p v-if="availableDuration < 90" class="text-xs text-zinc-500 mt-2">
                    Only {{ Math.floor(availableDuration) }}s of recording available at current position
                  </p>
                </div>

                <!-- Clip Name -->
                <div class="mb-6">
                  <label class="block text-sm font-medium text-zinc-300 mb-2">Clip Name (optional)</label>
                  <input
                    v-model="clipName"
                    type="text"
                    :placeholder="defaultClipName"
                    class="w-full px-4 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                  />
                </div>

                <!-- Save Location Info -->
                <div class="mb-6 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
                  <div class="flex items-start gap-3">
                    <FolderOpen class="w-5 h-5 text-violet-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <template v-if="isTempRecording && !projectId">
                        <p class="text-sm text-zinc-300">A new project folder will be created</p>
                        <p class="text-xs text-zinc-500 mt-0.5">
                          {{ displayName }} - {{ new Date().toISOString().split('T')[0] }}
                        </p>
                      </template>
                      <template v-else>
                        <p class="text-sm text-zinc-300">Clip will be saved to livestream project</p>
                        <p class="text-xs text-zinc-500 mt-0.5">Projects → Livestream folder</p>
                      </template>
                    </div>
                  </div>
                </div>

                <!-- Actions -->
                <div class="flex gap-3">
                  <button
                    @click="handleClose"
                    class="flex-1 px-4 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    @click="createClip"
                    :disabled="selectedDuration > availableDuration"
                    class="flex-1 px-4 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Scissors class="w-4 h-4" />
                    Create Clip
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
  import { ref, computed, watch } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { Scissors, X, Lock, FolderOpen, Check, AlertCircle, ExternalLink } from 'lucide-vue-next';
  import { useRouter } from 'vue-router';
  import { createLivestreamClipProject, createClip } from '@/services/database';

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
    tempSessionId?: string | null; // For temp recording mode
    playbackPosition: number;
    watermarkSettings?: Record<string, any> | null;
    watermarkId?: string | null;
    segments: SegmentInfo[];
    // For creating project on first clip (temp recording mode)
    displayName?: string;
    mintId?: string; // Also used as session identifier for DVR mode
    isTempRecording?: boolean;
  }

  interface Emits {
    (e: 'close'): void;
    (e: 'clip-created', clipPath: string, projectId: string): void;
  }

  const props = defineProps<Props>();
  const emit = defineEmits<Emits>();

  const router = useRouter();

  // State
  const hidden = ref(false);
  const selectedDuration = ref(30);
  const clipName = ref('');
  const isCreating = ref(false);
  const progress = ref(0);
  const progressMessage = ref('Preparing...');
  const clipCreated = ref(false);
  const createdClipPath = ref<string | null>(null);
  const error = ref<string | null>(null);

  // Duration options
  const durationOptions = [10, 20, 30, 60, 90];

  // Computed
  const defaultClipName = computed(() => {
    const date = new Date();
    const timestamp = date
      .toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      .replace(/:/g, '-');
    return `Clip - ${timestamp}`;
  });

  // Select appropriate default duration based on available
  watch(
    () => props.availableDuration,
    (available) => {
      if (selectedDuration.value > available) {
        // Find the largest available duration option
        const validOptions = durationOptions.filter((d) => d <= available);
        selectedDuration.value = validOptions.length > 0 ? validOptions[validOptions.length - 1] : 10;
      }
    },
    { immediate: true }
  );

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

  // State for dynamically created project
  const createdProjectId = ref<string | null>(null);

  // Create clip
  async function createClip() {
    // Determine which session ID to use:
    // 1. Persistent recording session ID (from monitoring)
    // 2. Temp session ID (for temp recording mode)
    // 3. Mint ID (for DVR mode - used as session identifier)
    const effectiveSessionId = props.sessionId || props.tempSessionId || props.mintId;

    if (!effectiveSessionId) {
      error.value = 'Session not available. Please try again.';
      return;
    }

    // Validate we have segments to extract from
    if (!props.segments || props.segments.length === 0) {
      error.value = 'No recorded segments available. Please wait for more content.';
      return;
    }

    // Determine project ID - create one if needed (for temp/DVR recording)
    let effectiveProjectId = props.projectId;

    if (!effectiveProjectId && (props.isTempRecording || !props.sessionId) && props.displayName && props.mintId) {
      // Create a new project for this clip (first clip from temp/DVR recording)
      try {
        progressMessage.value = 'Creating project folder...';
        effectiveProjectId = await createLivestreamClipProject(props.displayName, props.mintId);
        createdProjectId.value = effectiveProjectId;
        console.log('[ClipModal] Created project for DVR/temp recording clip:', effectiveProjectId);
      } catch (err) {
        console.error('[ClipModal] Failed to create project:', err);
        error.value = 'Failed to create project folder. Please try again.';
        return;
      }
    }

    if (!effectiveProjectId) {
      error.value = 'Unable to determine project for clip. Please try again.';
      return;
    }

    isCreating.value = true;
    progress.value = 0;
    progressMessage.value = 'Preparing clip extraction...';
    error.value = null;

    try {
      await setupProgressListener();

      const finalClipName = clipName.value || defaultClipName.value;
      const clipStartTime = props.playbackPosition - selectedDuration.value;
      const clipEndTime = props.playbackPosition;

      console.log('[ClipModal] Extracting clip:', {
        sessionId: effectiveSessionId,
        clipStartTime,
        clipEndTime,
        duration: selectedDuration.value,
        segmentsCount: props.segments.length,
        projectId: effectiveProjectId,
      });

      // Call Tauri command to extract clip
      // Use effective values (which may have been created for temp/DVR recording)
      const result = await invoke<string>('extract_livestream_clip', {
        sessionId: effectiveSessionId,
        clipEndTime: props.playbackPosition,
        clipDuration: selectedDuration.value,
        clipName: finalClipName,
        segments: props.segments,
        projectId: effectiveProjectId,
        watermarkId: props.watermarkId || null,
        watermarkSettings: props.watermarkSettings ? JSON.stringify(props.watermarkSettings) : null,
      });

      console.log('[ClipModal] Clip extracted successfully:', result);

      // Save clip to database
      try {
        await createClip(effectiveProjectId, result, {
          name: finalClipName,
          duration: selectedDuration.value,
          startTime: clipStartTime,
          endTime: clipEndTime,
        });
        console.log('[ClipModal] Clip saved to database');
      } catch (dbErr) {
        console.warn('[ClipModal] Failed to save clip to database (clip file still created):', dbErr);
        // Don't fail the whole operation if DB save fails - clip file was created
      }

      createdClipPath.value = result;
      clipCreated.value = true;
      clipName.value = finalClipName;

      emit('clip-created', result, effectiveProjectId);
    } catch (err) {
      console.error('[ClipModal] Failed to create clip:', err);
      error.value = err instanceof Error ? err.message : 'Failed to create clip';
    } finally {
      isCreating.value = false;
      cleanupProgressListener();
    }
  }

  // Navigate to clip in projects
  function handleViewClip() {
    // Use created project ID if available (for temp recording), otherwise use props
    const projectId = createdProjectId.value || props.projectId;
    if (projectId) {
      router.push({ name: 'projects', query: { projectId } });
      handleClose();
    }
  }

  // Reset state for retry
  function resetState() {
    isCreating.value = false;
    progress.value = 0;
    progressMessage.value = '';
    clipCreated.value = false;
    createdClipPath.value = null;
    error.value = null;
  }

  // Close modal
  function handleClose() {
    if (isCreating.value) return;
    cleanupProgressListener();
    emit('close');
  }
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
