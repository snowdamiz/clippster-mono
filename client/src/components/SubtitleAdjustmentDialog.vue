<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="modelValue"
        class="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[70]"
      >
        <Transition name="dialog" appear>
          <div
            class="bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-2xl w-full max-w-3xl mx-4 border border-white/10 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          >
            <!-- Top accent -->
            <div class="h-1 w-full bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 flex-shrink-0" />

            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/50">
              <div class="flex items-center gap-3">
                <div
                  class="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-500/20 flex items-center justify-center border border-purple-500/30"
                >
                  <Type class="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <h2 class="text-lg font-semibold text-white">Subtitle Adjustment</h2>
                  <p class="text-xs text-zinc-400">Adjust subtitle size and position for {{ aspectRatio }} output</p>
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

            <!-- Main Content -->
            <div class="flex-1 overflow-hidden flex flex-col">
              <!-- Video Preview with Subtitle Overlay -->
              <div class="flex items-center justify-center p-4 bg-zinc-950/50 min-h-[280px] max-h-[350px]">
                <div
                  ref="previewContainer"
                  class="relative bg-black rounded-lg overflow-hidden shadow-2xl"
                  :style="previewContainerStyle"
                >
                  <!-- Video Element -->
                  <video
                    v-if="videoUrl"
                    ref="videoElement"
                    :src="videoUrl"
                    class="w-full h-full object-cover"
                    crossorigin="anonymous"
                    @timeupdate="onTimeUpdate"
                    @loadedmetadata="onVideoLoaded"
                    @error="onVideoError"
                  />

                  <!-- Fallback thumbnail -->
                  <img v-else-if="thumbnailUrl" :src="thumbnailUrl" class="w-full h-full object-cover" alt="Preview" />

                  <!-- Loading state -->
                  <div v-else class="absolute inset-0 flex items-center justify-center bg-zinc-900">
                    <div class="text-zinc-500 text-sm">Loading preview...</div>
                  </div>

                  <!-- Subtitle Overlay Preview -->
                  <div
                    v-if="subtitleSettings"
                    class="absolute inset-0 pointer-events-none flex items-center justify-center"
                    :style="subtitleContainerStyle"
                  >
                    <div class="subtitle-preview" :style="subtitleTextStyle">Sample Subtitle Text</div>
                  </div>

                  <!-- Position Guide Lines -->
                  <div class="absolute inset-0 pointer-events-none">
                    <!-- Horizontal line showing current position -->
                    <div
                      class="absolute left-0 right-0 border-t border-dashed border-purple-500/50 transition-all duration-150"
                      :style="{ top: `${localOverride.positionPercentage}%` }"
                    />
                    <!-- Center vertical line -->
                    <div class="absolute top-0 bottom-0 left-1/2 border-l border-dashed border-purple-500/20" />
                  </div>
                </div>
              </div>

              <!-- Video Playback Controls -->
              <div v-if="clipDuration > 0" class="px-5 py-3 border-t border-zinc-800 bg-zinc-900/70">
                <div class="flex items-center gap-4">
                  <!-- Play/Pause button -->
                  <button
                    @click="togglePlayback"
                    class="w-9 h-9 rounded-full bg-purple-600 hover:bg-purple-500 flex items-center justify-center text-white transition-colors shadow-lg"
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
                        class="h-full bg-gradient-to-r from-purple-500 to-indigo-500 transition-all duration-100"
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
                    @click="resetPlayback"
                    class="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                    title="Reset to start"
                  >
                    <RotateCcwIcon class="w-4 h-4" />
                  </button>
                </div>
              </div>

              <!-- Adjustment Controls -->
              <div class="px-5 py-4 border-t border-zinc-800 bg-zinc-900/50 space-y-4 flex-shrink-0">
                <!-- Font Size -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-sm font-medium text-zinc-300">Font Size</label>
                    <span class="text-sm font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                      {{ localOverride.fontSize }}px
                    </span>
                  </div>
                  <input
                    type="range"
                    v-model.number="localOverride.fontSize"
                    min="12"
                    max="150"
                    step="2"
                    class="subtitle-slider"
                  />
                  <div class="flex justify-between text-[10px] text-zinc-500">
                    <span>12px</span>
                    <span>150px</span>
                  </div>
                </div>

                <!-- Vertical Position -->
                <div class="space-y-2">
                  <div class="flex items-center justify-between">
                    <label class="text-sm font-medium text-zinc-300">Vertical Position</label>
                    <span class="text-sm font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                      {{ localOverride.positionPercentage }}%
                    </span>
                  </div>
                  <input
                    type="range"
                    v-model.number="localOverride.positionPercentage"
                    min="5"
                    max="95"
                    step="1"
                    class="subtitle-slider"
                  />
                  <div class="flex justify-between text-[10px] text-zinc-500">
                    <span>Top (5%)</span>
                    <span>Bottom (95%)</span>
                  </div>
                </div>

                <!-- Reset to defaults button -->
                <button @click="resetToDefaults" class="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
                  Reset to project defaults
                </button>
              </div>
            </div>

            <!-- Footer -->
            <div class="flex items-center justify-between px-5 py-4 border-t border-zinc-800 bg-zinc-900/50">
              <div class="text-sm text-zinc-500">Changes will only apply to the {{ aspectRatio }} export</div>
              <div class="flex items-center gap-3">
                <button
                  @click="close"
                  class="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  @click="confirmChanges"
                  class="flex items-center gap-2 px-5 py-2 text-sm font-semibold rounded-lg transition-all relative overflow-hidden group bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500"
                >
                  <div
                    class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"
                  />
                  <CheckIcon class="h-4 w-4 relative" />
                  <span class="relative">Apply</span>
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
  import { Type, XIcon, CheckIcon, PlayIcon, PauseIcon, RotateCcwIcon } from 'lucide-vue-next';
  import type { SubtitleSettings, SubtitleOverride } from '@/types';
  import { utf8ToBase64 } from '@/utils/encoding';

  interface Props {
    modelValue: boolean;
    aspectRatio: string;
    subtitleSettings?: SubtitleSettings | null;
    initialOverride?: SubtitleOverride | null;
    thumbnailUrl?: string | null;
    videoPath?: string | null;
    clipStartTime?: number;
    clipEndTime?: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    subtitleSettings: null,
    initialOverride: null,
    thumbnailUrl: null,
    videoPath: null,
    clipStartTime: 0,
    clipEndTime: 0,
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [override: SubtitleOverride];
  }>();

  // Local state for the override
  const localOverride = ref<SubtitleOverride>({
    fontSize: 32,
    positionPercentage: 85,
  });

  // Video playback state
  const isPlaying = ref(false);
  const currentTime = ref(0);
  const videoUrl = ref<string | null>(null);
  const videoElement = ref<HTMLVideoElement | null>(null);
  const previewContainer = ref<HTMLElement | null>(null);

  // Computed clip duration
  const clipDuration = computed(() => {
    if (props.clipEndTime && props.clipStartTime) {
      return props.clipEndTime - props.clipStartTime;
    }
    return 0;
  });

  // Parse aspect ratio
  const parsedAspectRatio = computed(() => {
    const parts = props.aspectRatio.split(':');
    if (parts.length === 2) {
      return { width: parseInt(parts[0]), height: parseInt(parts[1]) };
    }
    return { width: 16, height: 9 };
  });

  // Preview container style
  const previewContainerStyle = computed(() => {
    const maxWidth = 400;
    const maxHeight = 300;
    const ratio = parsedAspectRatio.value.width / parsedAspectRatio.value.height;

    let width = maxWidth;
    let height = width / ratio;

    if (height > maxHeight) {
      height = maxHeight;
      width = height * ratio;
    }

    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  });

  // Subtitle container positioning style
  const subtitleContainerStyle = computed(() => {
    return {
      top: `${localOverride.value.positionPercentage}%`,
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: `${props.subtitleSettings?.maxWidth || 90}%`,
      position: 'absolute' as const,
    };
  });

  // Subtitle text style for preview
  const subtitleTextStyle = computed(() => {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;
    // Calculate scale based on aspect ratio (similar to VideoPlayer.vue)
    const aspectRatioValue = parsedAspectRatio.value.width / parsedAspectRatio.value.height;
    let fontSizeScale = 1;

    if (aspectRatioValue <= 0.9) {
      fontSizeScale = 0.65; // Vertical formats
    } else if (aspectRatioValue > 0.9 && aspectRatioValue <= 1.1) {
      fontSizeScale = 0.78; // Square format
    }

    // Scale down further for preview (preview is smaller than actual video)
    const previewScale = 0.4;
    const adjustedFontSize = Math.round(localOverride.value.fontSize * fontSizeScale * previewScale);

    const style: Record<string, string> = {
      color: settings.textColor || '#FFFFFF',
      fontFamily: `"${settings.fontFamily}", Arial, sans-serif`,
      fontWeight: String(settings.fontWeight || 700),
      fontSize: `${adjustedFontSize}px`,
      textAlign: 'center',
      textShadow: `${settings.shadowOffsetX * previewScale}px ${settings.shadowOffsetY * previewScale}px ${settings.shadowBlur * previewScale}px ${settings.shadowColor}`,
    };

    // Add text stroke for borders
    if (settings.border1Width > 0 || settings.border2Width > 0) {
      const strokeWidth = (settings.border1Width + settings.border2Width) * previewScale;
      style.webkitTextStroke = `${strokeWidth}px ${settings.border2Color || '#000000'}`;
      style.paintOrder = 'stroke fill';
    }

    return style;
  });

  // Format time as MM:SS
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Load video URL
  async function loadVideoUrl() {
    if (!props.videoPath) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const port = await invoke<number>('get_video_server_port');
      const encodedPath = utf8ToBase64(props.videoPath);
      const timestamp = Date.now();
      videoUrl.value = `http://localhost:${port}/video/${encodedPath}?t=${timestamp}`;
    } catch (error) {
      console.error('[SubtitleAdjustment] Failed to load video:', error);
    }
  }

  // Video event handlers
  function onTimeUpdate() {
    if (videoElement.value) {
      currentTime.value = videoElement.value.currentTime - props.clipStartTime;

      // Loop back to start if we've reached the end
      if (currentTime.value >= clipDuration.value && isPlaying.value) {
        videoElement.value.currentTime = props.clipStartTime;
        currentTime.value = 0;
      }
    }
  }

  function onVideoLoaded() {
    if (videoElement.value && props.clipStartTime > 0) {
      videoElement.value.currentTime = props.clipStartTime;
    }
  }

  function onVideoError() {
    console.error('[SubtitleAdjustment] Video error');
  }

  // Playback controls
  function togglePlayback() {
    if (!videoElement.value) return;

    if (isPlaying.value) {
      videoElement.value.pause();
    } else {
      videoElement.value.play();
    }
    isPlaying.value = !isPlaying.value;
  }

  function resetPlayback() {
    if (videoElement.value) {
      videoElement.value.currentTime = props.clipStartTime;
      videoElement.value.pause();
    }
    currentTime.value = 0;
    isPlaying.value = false;
  }

  function onSeekClick(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const position = (event.clientX - rect.left) / rect.width;
    const newTime = Math.max(0, Math.min(clipDuration.value, position * clipDuration.value));
    currentTime.value = newTime;

    if (videoElement.value) {
      videoElement.value.currentTime = props.clipStartTime + newTime;
    }
  }

  // Reset to project defaults
  function resetToDefaults() {
    localOverride.value = {
      fontSize: props.subtitleSettings?.fontSize ?? 32,
      positionPercentage: props.subtitleSettings?.positionPercentage ?? 85,
    };
  }

  // Initialize when dialog opens
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        // Initialize override values
        if (props.initialOverride) {
          localOverride.value = { ...props.initialOverride };
        } else {
          resetToDefaults();
        }

        // Reset playback state
        isPlaying.value = false;
        currentTime.value = 0;

        // Load video
        await loadVideoUrl();
      } else {
        // Cleanup when closing
        isPlaying.value = false;
        if (videoElement.value) {
          videoElement.value.pause();
        }
        videoUrl.value = null;
      }
    },
    { immediate: true }
  );

  // Close the dialog
  function close() {
    emit('update:modelValue', false);
  }

  // Confirm and emit the override
  function confirmChanges() {
    emit('confirm', { ...localOverride.value });
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

  /* Subtitle preview styling */
  .subtitle-preview {
    text-align: center;
    white-space: nowrap;
  }

  /* Range input styling */
  .subtitle-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 8px;
    background: rgb(63 63 70);
    border-radius: 4px;
    outline: none;
    cursor: pointer;
  }

  .subtitle-slider::-webkit-slider-runnable-track {
    height: 8px;
    border-radius: 4px;
    background: rgb(63 63 70);
  }

  .subtitle-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgb(168 85 247);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    margin-top: -5px;
    transition: transform 0.15s ease;
  }

  .subtitle-slider::-webkit-slider-thumb:hover {
    background: rgb(147 51 234);
    transform: scale(1.1);
  }

  .subtitle-slider::-moz-range-track {
    height: 8px;
    border-radius: 4px;
    background: rgb(63 63 70);
  }

  .subtitle-slider::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: rgb(168 85 247);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
  }
</style>
