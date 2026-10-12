<template>
  <Modal
    :open="modelValue"
    title="Subtitle adjustment"
    :description="`Adjust subtitle size and position for ${aspectRatio} output`"
    :icon="Type"
    size="lg"
    flush
    @close="close"
  >
    <!-- Video Preview with Subtitle Overlay -->
    <div class="flex max-h-[350px] min-h-[280px] items-center justify-center bg-surface-sunken p-4">
      <div ref="previewContainer" class="relative overflow-hidden rounded-lg bg-black" :style="previewContainerStyle">
        <!-- Video Element -->
        <video
          v-if="videoUrl"
          ref="videoElement"
          :src="videoUrl"
          class="h-full w-full object-cover"
          crossorigin="anonymous"
          @timeupdate="onTimeUpdate"
          @loadedmetadata="onVideoLoaded"
          @error="onVideoError"
        />

        <!-- Fallback thumbnail -->
        <img v-else-if="thumbnailUrl" :src="thumbnailUrl" class="h-full w-full object-cover" alt="Preview" />

        <!-- Loading state -->
        <div v-else class="absolute inset-0 flex items-center justify-center bg-surface">
          <div class="text-sm text-fg-subtle">Loading preview…</div>
        </div>

        <!-- Subtitle Overlay Preview -->
        <div
          v-if="subtitleSettings"
          class="pointer-events-none absolute inset-0 flex items-center justify-center"
          :style="subtitleContainerStyle"
        >
          <div class="subtitle-preview" :style="subtitleTextStyle">Sample Subtitle Text</div>
        </div>

        <!-- Position Guide Lines -->
        <div class="pointer-events-none absolute inset-0">
          <!-- Horizontal line showing current position -->
          <div
            class="absolute inset-x-0 border-t border-dashed border-brand-line transition-[top] duration-150"
            :style="{ top: `${localOverride.positionPercentage}%` }"
          />
          <!-- Center vertical line -->
          <div class="absolute inset-y-0 left-1/2 border-l border-dashed border-line-strong" />
        </div>
      </div>
    </div>

    <!-- Video Playback Controls -->
    <div v-if="clipDuration > 0" class="flex items-center gap-3 border-t border-line-subtle px-5 py-2.5">
      <Button
        variant="secondary"
        size="icon-sm"
        :disabled="!videoUrl"
        :title="isPlaying ? 'Pause' : 'Play'"
        :aria-label="isPlaying ? 'Pause' : 'Play'"
        @click="togglePlayback"
      >
        <PlayIcon v-if="!isPlaying" class="fill-current" />
        <PauseIcon v-else class="fill-current" />
      </Button>

      <!-- Time display -->
      <span class="tabular w-24 shrink-0 font-mono text-xs text-fg-muted">
        {{ formatTime(currentTime) }} / {{ formatTime(clipDuration) }}
      </span>

      <!-- Progress bar -->
      <div class="group relative flex-1">
        <div class="h-1.5 cursor-pointer overflow-hidden rounded-full bg-line-strong" @click="onSeekClick">
          <div
            class="h-full bg-brand transition-[width] duration-100"
            :style="{ width: `${(currentTime / clipDuration) * 100}%` }"
          />
        </div>
        <!-- Seek handle -->
        <div
          class="pointer-events-none absolute top-1/2 size-3 -translate-y-1/2 rounded-full bg-fg opacity-0 shadow-[var(--shadow-sm)] transition-opacity group-hover:opacity-100"
          :style="{ left: `calc(${(currentTime / clipDuration) * 100}% - 6px)` }"
        />
      </div>

      <!-- Reset button -->
      <Button variant="ghost" size="icon-sm" title="Reset to start" aria-label="Reset to start" @click="resetPlayback">
        <RotateCcwIcon />
      </Button>
    </div>

    <!-- Adjustment Controls -->
    <div class="flex flex-col gap-4 border-t border-line-subtle px-5 py-4">
      <!-- Font Size -->
      <Field>
        <template #label>Font size</template>
        <template #label-end>
          <span class="tabular font-mono text-xs text-fg">{{ localOverride.fontSize }}px</span>
        </template>
        <input v-model.number="localOverride.fontSize" type="range" min="12" max="150" step="2" class="w-full" />
        <div class="flex justify-between text-2xs text-fg-subtle">
          <span>12px</span>
          <span>150px</span>
        </div>
      </Field>

      <!-- Vertical Position -->
      <Field>
        <template #label>Vertical position</template>
        <template #label-end>
          <span class="tabular font-mono text-xs text-fg">{{ localOverride.positionPercentage }}%</span>
        </template>
        <input v-model.number="localOverride.positionPercentage" type="range" min="5" max="95" step="1" class="w-full" />
        <div class="flex justify-between text-2xs text-fg-subtle">
          <span>Top (5%)</span>
          <span>Bottom (95%)</span>
        </div>
      </Field>

      <!-- Reset to defaults button -->
      <div>
        <Button variant="ghost" size="xs" class="-ml-2" @click="resetToDefaults">Reset to project defaults</Button>
      </div>
    </div>

    <template #footer>
      <p class="mr-auto text-xs text-fg-subtle">Changes will only apply to the {{ aspectRatio }} export</p>
      <Button variant="ghost" @click="close">Cancel</Button>
      <Button variant="primary" @click="confirmChanges">
        <CheckIcon />
        Apply
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onUnmounted } from 'vue';
  import { Type, CheckIcon, PlayIcon, PauseIcon, RotateCcwIcon } from 'lucide-vue-next';
  import { Modal } from '@/components/ui/modal';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import Hls from 'hls.js';
  import type { SubtitleSettings, SubtitleOverride } from '@/types';
  import { utf8ToBase64Url } from '@/utils/encoding';

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

  // HLS.js instance for proper MPEG-TS (.ts) file playback with A/V sync
  let hlsInstance: Hls | null = null;

  function isHlsUrl(url: string | null | undefined): boolean {
    return !!url && url.includes('.m3u8');
  }

  function cleanupHls(): void {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
  }

  function setupHlsPlayback(videoEl: HTMLVideoElement, hlsUrl: string): void {
    cleanupHls();
    if (Hls.isSupported()) {
      hlsInstance = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 60,
      });
      hlsInstance.loadSource(hlsUrl);
      hlsInstance.attachMedia(videoEl);
      hlsInstance.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          console.error('[SubtitleAdjustment] HLS fatal error:', data.type, data.details);
          cleanupHls();
        }
      });
    } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      videoEl.src = hlsUrl;
    }
  }

  function constructVideoUrl(filePath: string, port: number): string {
    const encodedPath = utf8ToBase64Url(filePath);
    const isTsFile = filePath.toLowerCase().endsWith('.ts');
    if (isTsFile) {
      return `http://localhost:${port}/ts-hls/${encodedPath}/playlist.m3u8`;
    }
    return `http://localhost:${port}/video/${encodedPath}`;
  }

  onUnmounted(() => {
    cleanupHls();
  });

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
    cleanupHls();
    if (!props.videoPath) return;

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const port = await invoke<number>('get_video_server_port');
      const timestamp = Date.now();
      const baseUrl = constructVideoUrl(props.videoPath, port);
      videoUrl.value = baseUrl.includes('?') ? `${baseUrl}&t=${timestamp}` : `${baseUrl}?t=${timestamp}`;
    } catch (error) {
      console.error('[SubtitleAdjustment] Failed to load video:', error);
    }
  }

  // Watch for video URL changes to setup HLS if needed
  watch(
    () => videoUrl.value,
    (newUrl) => {
      if (newUrl && videoElement.value && isHlsUrl(newUrl)) {
        setupHlsPlayback(videoElement.value, newUrl);
      } else if (!isHlsUrl(newUrl)) {
        cleanupHls();
      }
    }
  );

  // Watch for video element becoming available
  watch(videoElement, (newElement) => {
    if (newElement && videoUrl.value && isHlsUrl(videoUrl.value)) {
      setupHlsPlayback(newElement, videoUrl.value);
    }
  });

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
  /* Subtitle preview styling (colors/size come from the user's subtitle settings) */
  .subtitle-preview {
    text-align: center;
    white-space: nowrap;
  }
</style>
