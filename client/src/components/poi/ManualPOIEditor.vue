<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[70]">
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl w-full max-w-4xl mx-4 border border-white/10 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <!-- Top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-blue-500 via-violet-500 to-purple-500 flex-shrink-0" />

            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-violet-500/20 flex items-center justify-center border border-blue-500/30"
                >
                  <LayoutDashboardIcon class="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-white">Manual Framing Editor</h2>
                  <p class="text-xs text-zinc-400">
                    Define crop regions on the source and arrange them in the {{ targetAspectRatio }} output
                  </p>
                </div>
              </div>
              <button
                @click="close"
                class="p-2 hover:bg-zinc-800 rounded-xl transition-colors border border-zinc-800"
                title="Close"
              >
                <XIcon class="h-5 w-5 text-zinc-400 hover:text-white" />
              </button>
            </div>

            <!-- Main Content - Side by Side Panels -->
            <div class="flex-1 overflow-hidden flex flex-col">
              <div class="flex-1 flex overflow-hidden">
                <!-- Source Panel (Left) -->
                <div class="flex-1 border-r border-zinc-800">
                  <POISourcePanel
                    :regions="regions"
                    :selected-region-id="selectedRegionId"
                    :thumbnail-url="thumbnailUrl"
                    :source-aspect-ratio="sourceAspectRatio"
                    :video-url="videoUrl"
                    :video-time="absoluteVideoTime"
                    :is-playing="isPlaying"
                    @add-region="addRegion"
                    @update-region="updateRegion"
                    @delete-region="deleteRegion"
                    @select-region="selectRegion"
                    @time-update="onTimeUpdate"
                  />
                </div>

                <!-- Arrow indicator -->
                <div class="flex items-center justify-center w-12 bg-zinc-900/50">
                  <div class="flex flex-col items-center gap-2">
                    <ArrowRightIcon class="w-5 h-5 text-zinc-500" />
                    <span class="text-[9px] text-zinc-600 font-medium tracking-wider rotate-90 whitespace-nowrap">
                      EXPORT
                    </span>
                  </div>
                </div>

                <!-- Target Panel (Right) -->
                <div class="flex-1">
                  <POITargetPanel
                    :regions="regions"
                    :selected-region-id="selectedRegionId"
                    :thumbnail-url="thumbnailUrl"
                    :target-aspect-ratio="targetAspectRatio"
                    :source-aspect-ratio="sourceAspectRatio"
                    :video-url="videoUrl"
                    :video-time="absoluteVideoTime"
                    :is-playing="isPlaying"
                    :watermark-preview="resolvedWatermark"
                    @update-region="updateRegion"
                    @select-region="selectRegion"
                  />
                </div>
              </div>

              <!-- Video Playback Controls -->
              <div v-if="clipDuration > 0" class="px-5 py-3 border-t border-zinc-800 bg-zinc-900/70">
                <div class="flex items-center gap-4">
                  <!-- Play/Pause button -->
                  <button
                    @click="togglePlayback"
                    class="w-9 h-9 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white transition-colors shadow-lg"
                    :disabled="!videoUrl"
                    :class="{ 'opacity-50 cursor-not-allowed': !videoUrl }"
                  >
                    <PlayIcon v-if="!isPlaying" class="w-4 h-4 ml-0.5" />
                    <PauseIcon v-else class="w-4 h-4" />
                  </button>

                  <!-- Time display -->
                  <span class="text-xs text-zinc-400 font-mono w-20">
                    {{ formatTime(currentTime) }} / {{ formatTime(clipDuration) }}
                  </span>

                  <!-- Progress bar -->
                  <div class="flex-1 relative group">
                    <div class="h-1.5 bg-zinc-700 rounded-full overflow-hidden cursor-pointer" @click="onSeekClick">
                      <div
                        class="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-100"
                        :style="{ width: `${(currentTime / clipDuration) * 100}%` }"
                      />
                    </div>
                    <!-- Seek handle -->
                    <div
                      class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                      :style="{ left: `calc(${(currentTime / clipDuration) * 100}% - 6px)` }"
                    />
                  </div>

                  <!-- Reset button -->
                  <button
                    @click="
                      currentTime = 0;
                      isPlaying = false;
                    "
                    class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Reset to start"
                  >
                    <RotateCcwIcon class="w-4 h-4" />
                  </button>
                </div>

                <!-- Loading/Error state -->
                <div v-if="videoLoading" class="text-[10px] text-zinc-500 mt-2">Loading video preview...</div>
                <div v-else-if="videoError" class="text-[10px] text-amber-400 mt-2">
                  {{ videoError }}
                </div>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between px-5 py-4 border-t border-zinc-800 bg-zinc-900/50">
              <div class="text-sm text-zinc-400">
                <span v-if="regions.length === 0" class="text-amber-400">
                  <AlertCircleIcon class="w-4 h-4 inline mr-1" />
                  Add at least one region to continue
                </span>
                <span v-else class="text-zinc-500">
                  {{ regions.length }} region{{ regions.length !== 1 ? 's' : '' }} configured
                </span>
              </div>
              <div class="flex items-center gap-3">
                <button
                  @click="resetRegions"
                  class="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                  :disabled="regions.length === 0"
                  :class="{ 'opacity-50 cursor-not-allowed': regions.length === 0 }"
                >
                  Reset
                </button>
                <button
                  @click="close"
                  class="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="confirmConfig"
                  :disabled="regions.length === 0"
                  class="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all relative overflow-hidden group"
                  :class="
                    regions.length === 0
                      ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-violet-600 text-white hover:from-blue-500 hover:to-violet-500'
                  "
                >
                  <div
                    v-if="regions.length > 0"
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <CheckIcon class="h-4 w-4 relative" />
                  <span class="relative">Apply Configuration</span>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, watch, computed } from 'vue';
  import {
    LayoutDashboardIcon,
    XIcon,
    ArrowRightIcon,
    CheckIcon,
    AlertCircleIcon,
    PlayIcon,
    PauseIcon,
    RotateCcwIcon,
  } from 'lucide-vue-next';
  import POISourcePanel from './POISourcePanel.vue';
  import POITargetPanel from './POITargetPanel.vue';
  import type { ManualRegion, ManualFramingConfig, WatermarkSettings } from '@/types';
  import { utf8ToBase64 } from '@/utils/encoding';

  interface WatermarkPreview {
    filePath: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
  }

  interface Props {
    modelValue: boolean;
    initialConfig?: ManualFramingConfig | null;
    targetAspectRatio: string;
    sourceAspectRatio?: string;
    thumbnailUrl?: string | null;
    videoPath?: string | null;
    clipStartTime?: number;
    clipEndTime?: number;
    // Optional watermark preview for the target aspect ratio
    watermarkSettings?: WatermarkSettings | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    sourceAspectRatio: '16:9',
    clipStartTime: 0,
    clipEndTime: 0,
    watermarkSettings: null,
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [config: ManualFramingConfig];
  }>();

  // Local state
  const regions = ref<ManualRegion[]>([]);
  const selectedRegionId = ref<string | null>(null);

  // Video playback state
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const videoUrl = ref<string | null>(null);
  const videoLoading = ref(false);
  const videoError = ref<string | null>(null);

  // Computed clip duration
  const clipDuration = computed(() => {
    if (props.clipEndTime && props.clipStartTime) {
      return props.clipEndTime - props.clipStartTime;
    }
    return 0;
  });

  // Format time as MM:SS
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Load video URL using the app's video server
  async function loadVideoUrl() {
    if (!props.videoPath) return;

    videoLoading.value = true;
    videoError.value = null;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      // Get the video server port
      const port = await invoke<number>('get_video_server_port');
      // Encode the file path as base64 (using utf8ToBase64 to handle Unicode characters)
      const encodedPath = utf8ToBase64(props.videoPath);
      // Create the video URL with timestamp to prevent caching
      const timestamp = Date.now();
      videoUrl.value = `http://localhost:${port}/video/${encodedPath}?t=${timestamp}`;
      console.log('[POIEditor] Video URL loaded:', videoUrl.value);
    } catch (error) {
      console.error('[POIEditor] Failed to load video:', error);
      videoError.value = 'Failed to load video preview';
    } finally {
      videoLoading.value = false;
    }
  }

  // Play/Pause toggle
  function togglePlayback() {
    isPlaying.value = !isPlaying.value;
  }

  // Handle time update from video
  function onTimeUpdate(time: number) {
    // Convert absolute time to clip-relative time
    currentTime.value = time - props.clipStartTime;

    // Loop back to start if we've reached the end (while still playing)
    if (currentTime.value >= clipDuration.value && isPlaying.value) {
      currentTime.value = 0;
      // The video will be seeked back to start via the watch on absoluteVideoTime
    }
  }

  // Get absolute video time from clip-relative time
  const absoluteVideoTime = computed(() => {
    return props.clipStartTime + currentTime.value;
  });

  // Resolve watermark settings for the target aspect ratio
  const resolvedWatermark = computed((): WatermarkPreview | null => {
    if (!props.watermarkSettings?.enabled) return null;

    const ratioKey = props.targetAspectRatio as '16:9' | '9:16' | '1:1' | '4:5';
    const perRatioConfig = props.watermarkSettings.perRatioSettings?.[ratioKey];

    // If config is explicitly null, watermark is disabled for this ratio
    if (perRatioConfig === null) return null;

    // Use per-ratio position if available, otherwise default
    const position = perRatioConfig?.position;

    return {
      filePath: '', // Will be loaded by POITargetPanel
      x: position?.x ?? props.watermarkSettings.positionX,
      y: position?.y ?? props.watermarkSettings.positionY,
      scale: position?.scale ?? props.watermarkSettings.scale,
      opacity: position?.opacity ?? props.watermarkSettings.opacity,
    };
  });

  // Handle seek bar click
  function onSeekClick(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const position = (event.clientX - rect.left) / rect.width;
    currentTime.value = Math.max(0, Math.min(clipDuration.value, position * clipDuration.value));
  }

  // Initialize from initial config when dialog opens
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        if (props.initialConfig && props.initialConfig.regions.length > 0) {
          // Deep clone the regions
          regions.value = JSON.parse(JSON.stringify(props.initialConfig.regions));
        } else {
          regions.value = [];
        }
        selectedRegionId.value = regions.value.length > 0 ? regions.value[0].id : null;

        // Reset playback state
        isPlaying.value = false;
        currentTime.value = 0;

        // Load video URL
        await loadVideoUrl();
      } else {
        // Cleanup when closing
        isPlaying.value = false;
        videoUrl.value = null;
      }
    },
    { immediate: true }
  );

  // Add a new region
  function addRegion(region: ManualRegion) {
    regions.value.push(region);
  }

  // Update a region
  function updateRegion(id: string, update: Partial<ManualRegion>) {
    const index = regions.value.findIndex((r) => r.id === id);
    if (index !== -1) {
      regions.value[index] = { ...regions.value[index], ...update };
    }
  }

  // Delete a region
  function deleteRegion(id: string) {
    const index = regions.value.findIndex((r) => r.id === id);
    if (index !== -1) {
      regions.value.splice(index, 1);
    }
    if (selectedRegionId.value === id) {
      selectedRegionId.value = regions.value.length > 0 ? regions.value[0].id : null;
    }
  }

  // Select a region
  function selectRegion(id: string | null) {
    selectedRegionId.value = id;
  }

  // Reset all regions
  function resetRegions() {
    regions.value = [];
    selectedRegionId.value = null;
  }

  // Close the dialog
  function close() {
    emit('update:modelValue', false);
  }

  // Confirm and emit the configuration
  function confirmConfig() {
    if (regions.value.length === 0) return;

    const config: ManualFramingConfig = {
      mode: 'manual',
      regions: JSON.parse(JSON.stringify(regions.value)),
      targetAspectRatio: props.targetAspectRatio,
      sourceAspectRatio: props.sourceAspectRatio,
    };

    emit('confirm', config);
    close();
  }
</script>

<style scoped>
  /* Modal backdrop transition */
  .modal-enter-active,
  .modal-leave-active {
    transition: opacity 0.3s ease;
  }

  .modal-enter-from,
  .modal-leave-to {
    opacity: 0;
  }

  /* Dialog transition */
  .dialog-enter-active {
    transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .dialog-leave-active {
    transition: all 0.2s ease-in;
  }

  .dialog-enter-from {
    opacity: 0;
    transform: scale(0.95) translateY(10px);
  }

  .dialog-leave-to {
    opacity: 0;
    transform: scale(0.98);
  }
</style>
