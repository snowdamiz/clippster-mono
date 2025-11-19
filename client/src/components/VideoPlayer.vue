<template>
  <div
    class="flex-1 min-h-0 rounded-lg bg-black relative overflow-hidden flex items-center justify-center"
    :style="{ maxWidth: '100%', maxHeight: '100%' }"
  >
    <!-- Video Crop Container -->
    <div
      ref="videoContainerRef"
      class="video-crop-container"
      :style="{
        aspectRatio: `${aspectRatio.width}/${aspectRatio.height}`,
        maxWidth: '100%',
        maxHeight: '100%',
        position: 'relative',
        overflow: 'hidden',
      }"
    >
      <!-- Loading State -->
      <div v-if="videoLoading" class="absolute inset-0 flex items-center justify-center bg-black z-10">
        <div class="flex flex-col items-center gap-3">
          <svg
            class="animate-spin h-8 w-8 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>

            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span class="text-white text-sm">Loading video...</span>
        </div>
      </div>
      <!-- No Video State -->
      <div v-else-if="!videoSrc && !videoError" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center text-muted-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-12 w-12 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <p class="text-sm">No video assigned</p>
        </div>
      </div>
      <!-- Error State -->
      <div v-else-if="videoError" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center text-red-400 p-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-12 w-12 mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="1.5"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z"
            />
          </svg>
          <p class="text-sm font-medium">Video Error</p>

          <p class="text-xs mt-1 text-red-300">{{ videoError }}</p>
          <button
            @click="$emit('retryLoad')"
            class="mt-3 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded text-xs text-red-300 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
      <!-- Video Element -->
      <video
        v-else
        ref="videoElementRef"
        :src="videoSrc || undefined"
        class="w-full h-full object-cover video-with-focal-point"
        :style="{
          objectPosition: `${focalPoint.x * 100}% ${focalPoint.y * 100}%`,
        }"
        @timeupdate="$emit('timeUpdate')"
        @loadedmetadata="$emit('loadedMetadata')"
        @ended="$emit('videoEnded')"
        @click="$emit('togglePlayPause')"
        @error="$emit('videoError', $event)"
        @loadstart="$emit('loadStart')"
        @canplay="$emit('canPlay')"
        data-testid="project-video"
      />

      <!-- Subtitle Overlay -->
      <div
        v-if="subtitleSettings?.enabled && visibleWords.length > 0 && videoSrc && !videoLoading"
        class="absolute subtitle-overlay pointer-events-none z-20"
        :style="getSubtitleContainerStyle"
      >
        <div
          class="subtitle-text-container"
          :style="{
            ...getSubtitleTextStyle,
            gap: `${subtitleSettings?.wordSpacing || 0.35}em`,
          }"
        >
          <span
            v-for="(wordInfo, index) in visibleWords"
            :key="`subtitle-word-${wordInfo.start}-${index}`"
            class="subtitle-word-stack"
            :style="{
              transitionDuration: `${getWordAnimationDuration(wordInfo)}s`,
            }"
          >
            <!-- Render word using SVG to allow rounded line joins -->
            <span
              class="invisible pointer-events-none select-none"
              :class="{ 'current-word': isCurrentWord(wordInfo) }"
              :style="getTextStyle"
            >
              {{ wordInfo.word }}
            </span>

            <svg class="absolute inset-0 w-full h-full overflow-visible" style="pointer-events: none">
              <defs>
                <!-- Filter for drop shadow that can apply to the stroke -->
                <filter :id="`shadow-${index}`" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow
                    v-if="subtitleSettings?.shadowBlur > 0"
                    :dx="subtitleSettings.shadowOffsetX * finalFontSizeScale"
                    :dy="subtitleSettings.shadowOffsetY * finalFontSizeScale"
                    :stdDeviation="subtitleSettings.shadowBlur * finalFontSizeScale"
                    :flood-color="subtitleSettings.shadowColor"
                  />
                </filter>
              </defs>

              <g :style="{ transformOrigin: 'center', transformBox: 'fill-box' }">
                <!-- Layer 1 (bottom): Border 2 (Outer) with Shadow -->
                <text
                  v-if="subtitleSettings && (subtitleSettings.border2Width > 0 || subtitleSettings.border1Width > 0)"
                  x="50%"
                  y="55%"
                  dominant-baseline="middle"
                  text-anchor="middle"
                  :style="{
                    fontFamily: subtitleSettings.fontFamily,
                    fontWeight: subtitleSettings.fontWeight,
                    fontSize: getTextStyle.fontSize,
                    stroke: subtitleSettings.border2Color,
                    strokeWidth:
                      (subtitleSettings.border1Width + subtitleSettings.border2Width) * 2 * finalFontSizeScale + 'px',
                    strokeLinejoin: 'round',
                    strokeLinecap: 'round',
                    fill: 'none', // No fill for border layer
                    filter: `url(#shadow-${index})`,
                  }"
                >
                  {{ wordInfo.word }}
                </text>

                <!-- Layer 2 (middle): Border 1 (Inner) -->
                <text
                  v-if="subtitleSettings && subtitleSettings.border1Width > 0"
                  x="50%"
                  y="55%"
                  dominant-baseline="middle"
                  text-anchor="middle"
                  :style="{
                    fontFamily: subtitleSettings.fontFamily,
                    fontWeight: subtitleSettings.fontWeight,
                    fontSize: getTextStyle.fontSize,
                    stroke: subtitleSettings.border1Color,
                    strokeWidth: subtitleSettings.border1Width * 2 * finalFontSizeScale + 'px',
                    strokeLinejoin: 'round',
                    strokeLinecap: 'round',
                    fill: 'none',
                  }"
                >
                  {{ wordInfo.word }}
                </text>

                <!-- Layer 3 (top): Fill Text -->
                <text
                  x="50%"
                  y="55%"
                  dominant-baseline="middle"
                  text-anchor="middle"
                  :style="{
                    fontFamily: subtitleSettings.fontFamily,
                    fontWeight: subtitleSettings.fontWeight,
                    fontSize: getTextStyle.fontSize,
                    fill: subtitleSettings?.textColor || '#FFFFFF',
                  }"
                >
                  {{ wordInfo.word }}
                </text>
              </g>
            </svg>
          </span>
        </div>
      </div>

      <!-- Focal Point Debug Indicator -->
      <div
        v-if="videoSrc && !videoLoading"
        class="absolute top-2 right-2 z-20 bg-black/70 backdrop-blur-sm text-white text-xs px-2 py-1 rounded pointer-events-none font-mono"
      >
        Focal: {{ (focalPoint.x * 100).toFixed(0) }}%, {{ (focalPoint.y * 100).toFixed(0) }}%
      </div>

      <!-- Focal Point Crosshair (for debugging) -->
      <div
        v-if="videoSrc && !videoLoading && (Math.abs(focalPoint.x - 0.5) > 0.05 || Math.abs(focalPoint.y - 0.5) > 0.05)"
        class="absolute pointer-events-none z-10"
        :style="{
          left: `${focalPoint.x * 100}%`,
          top: `${focalPoint.y * 100}%`,
          transform: 'translate(-50%, -50%)',
        }"
      >
        <div class="relative">
          <div class="absolute w-8 h-0.5 bg-red-500 opacity-70" style="left: -16px; top: 0"></div>
          <div class="absolute w-0.5 h-8 bg-red-500 opacity-70" style="left: 0; top: -16px"></div>
          <div class="w-2 h-2 bg-red-500 rounded-full opacity-70"></div>
        </div>
      </div>

      <!-- Center Play/Pause Overlay -->
      <button
        v-if="videoSrc && !videoLoading"
        @click="$emit('togglePlayPause')"
        class="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/20"
        title="Play/Pause"
      >
        <div class="p-4 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors">
          <svg
            v-if="!isPlaying"
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
            />
          </svg>
          <svg
            v-else
            xmlns="http://www.w3.org/2000/svg"
            class="h-8 w-8 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6" />
          </svg>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted } from 'vue';

  import type { WhisperSegment } from '@/types';

  interface Props {
    videoSrc: string | null;
    videoLoading: boolean;
    videoError: string | null;
    isPlaying: boolean;
    aspectRatio: { width: number; height: number };
    focalPoint?: { x: number; y: number };
    subtitleSettings?: SubtitleSettings;
    transcriptWords?: WordInfo[];
    transcriptSegments?: WhisperSegment[];
    currentTime?: number;
  }

  interface WordInfo {
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }

  interface SubtitleSettings {
    enabled: boolean;
    fontFamily: string;
    fontSize: number;
    fontWeight: number;
    textColor: string;
    backgroundColor: string;
    backgroundEnabled: boolean;
    border1Width: number;
    border1Color: string;
    border2Width: number;
    border2Color: string;
    shadowOffsetX: number;
    shadowOffsetY: number;
    shadowBlur: number;
    shadowColor: string;
    position: 'top' | 'middle' | 'bottom';
    positionPercentage: number;
    maxWidth: number;
    animationStyle: 'none' | 'fade' | 'word-by-word';
    lineHeight: number;
    letterSpacing: number;
    textAlign: 'left' | 'center' | 'right';
    textOffsetX: number;
    textOffsetY: number;
    padding: number;
    borderRadius: number;
    wordSpacing: number;
  }

  const props = withDefaults(defineProps<Props>(), {
    focalPoint: () => ({ x: 0.5, y: 0.5 }),
    subtitleSettings: () => ({
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
      positionPercentage: 85,
      maxWidth: 90,
      animationStyle: 'none',
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: 'center',
      padding: 16,
      borderRadius: 8,
    }),
    transcriptWords: () => [],
    transcriptSegments: () => [],
    currentTime: 0,
  });

  interface Emits {
    (e: 'togglePlayPause'): void;
    (e: 'timeUpdate'): void;
    (e: 'loadedMetadata'): void;
    (e: 'videoEnded'): void;
    (e: 'videoError', event: Event): void;
    (e: 'loadStart'): void;
    (e: 'canPlay'): void;
    (e: 'retryLoad'): void;
    (e: 'videoElementReady', element: HTMLVideoElement): void;
  }

  const emit = defineEmits<Emits>();

  const videoElementRef = ref<HTMLVideoElement | null>(null);
  const videoContainerRef = ref<HTMLElement | null>(null);
  const containerHeight = ref<number>(1080); // Default to 1080p height

  // Calculate max words based on aspect ratio
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

  // Find the current whisper segment
  const currentSegment = computed((): WhisperSegment | null => {
    if (!props.subtitleSettings?.enabled || !props.transcriptSegments || props.transcriptSegments.length === 0) {
      return null;
    }

    const time = props.currentTime || 0;

    // Find segment that contains the current time
    for (const segment of props.transcriptSegments) {
      if (time >= segment.start && time <= segment.end) {
        return segment;
      }
    }

    // Return null if in dead space between segments
    return null;
  });

  // Get all words from the current segment
  const segmentWords = computed((): WordInfo[] => {
    if (!currentSegment.value) return [];

    // If segment has words attached, use those
    if (currentSegment.value.words && currentSegment.value.words.length > 0) {
      return currentSegment.value.words;
    }

    // Otherwise, filter from all transcript words
    // Use a more inclusive filter - word overlaps with segment in any way
    if (!props.transcriptWords || props.transcriptWords.length === 0) return [];

    const segment = currentSegment.value;
    return props.transcriptWords.filter((word) => {
      // Include word if it starts within segment OR ends within segment OR spans the entire segment
      return (
        (word.start >= segment.start && word.start < segment.end) ||
        (word.end > segment.start && word.end <= segment.end) ||
        (word.start <= segment.start && word.end >= segment.end)
      );
    });
  });

  // Get visible words (chunked display - shows X words at a time, then jumps to next X)
  const visibleWords = computed((): WordInfo[] => {
    const allSegmentWords = segmentWords.value;
    if (allSegmentWords.length === 0) return [];

    const maxWords = maxWordsForAspectRatio.value;
    const time = props.currentTime || 0;

    // If segment has fewer words than the limit, show all
    if (allSegmentWords.length <= maxWords) {
      return allSegmentWords;
    }

    // Find the current word being spoken
    let currentWordIndex = -1;
    for (let i = 0; i < allSegmentWords.length; i++) {
      const word = allSegmentWords[i];
      if (time >= word.start && time < word.end) {
        currentWordIndex = i;
        break;
      }
    }

    // If no word is currently being spoken, find the next upcoming word
    if (currentWordIndex === -1) {
      for (let i = 0; i < allSegmentWords.length; i++) {
        if (allSegmentWords[i].start > time) {
          currentWordIndex = i;
          break;
        }
      }
    }

    // If still no match, default to first chunk
    if (currentWordIndex === -1) {
      currentWordIndex = 0;
    }

    // Calculate which "chunk" (page) this word belongs to
    const chunkIndex = Math.floor(currentWordIndex / maxWords);
    const startIndex = chunkIndex * maxWords;
    const endIndex = Math.min(startIndex + maxWords, allSegmentWords.length);

    return allSegmentWords.slice(startIndex, endIndex);
  });

  // Check if a word is currently being spoken
  function isCurrentWord(word: WordInfo): boolean {
    const time = props.currentTime || 0;
    return time >= word.start && time <= word.end;
  }

  // Calculate animation duration for a specific word based on its timing
  function getWordAnimationDuration(word: WordInfo): number {
    // Calculate word duration in seconds
    const wordDuration = word.end - word.start;

    // For very short words (under 50ms), use instant transition
    if (wordDuration < 0.05) {
      return 0;
    }

    // For short words (50-100ms), use 30% of duration for responsive animation
    if (wordDuration < 0.1) {
      return wordDuration * 0.3;
    }

    // For medium words (100-200ms), use 35% of duration
    if (wordDuration < 0.2) {
      return wordDuration * 0.35;
    }

    // For normal words (200-400ms), use 40% of duration
    if (wordDuration < 0.4) {
      return wordDuration * 0.4;
    }

    // For longer words (400ms+), use 45% but cap at 200ms to prevent overly slow animations
    const calculatedDuration = wordDuration * 0.45;
    return Math.min(0.2, calculatedDuration);
  }

  const getSubtitleContainerStyle = computed(() => {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;
    let topPosition = '50%';

    if (settings.position === 'top') {
      topPosition = settings.positionPercentage + '%';
    } else if (settings.position === 'middle') {
      topPosition = settings.positionPercentage + '%';
    } else {
      topPosition = settings.positionPercentage + '%';
    }

    // Apply text offsets (X and Y adjustments in percentage)
    const leftOffset = settings.textOffsetX || 0;
    const topOffset = settings.textOffsetY || 0;

    return {
      top: topPosition,
      left: '50%',
      transform: `translate(calc(-50% + ${leftOffset}%), calc(-50% + ${topOffset}%))`,
      width: settings.maxWidth + '%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
    };
  });

  // Calculate the final font size scale factor
  const finalFontSizeScale = computed(() => {
    if (!props.subtitleSettings) return 1;

    const videoScaleFactor = containerHeight.value / 1080;
    const aspectRatioValue = props.aspectRatio.width / props.aspectRatio.height;
    let fontSizeScale = 1;

    if (aspectRatioValue <= 0.9) {
      fontSizeScale = 0.65; // Vertical formats (9:16, 4:5)
    } else if (aspectRatioValue > 0.9 && aspectRatioValue <= 1.1) {
      fontSizeScale = 0.78; // Square format (1:1)
    }

    return fontSizeScale * videoScaleFactor;
  });

  // Base style for subtitle container
  const getSubtitleTextStyle = computed(() => {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;
    const aspectRatioValue = props.aspectRatio.width / props.aspectRatio.height;
    let lineHeightAdjustment = 0;

    if (aspectRatioValue <= 0.9) {
      lineHeightAdjustment = -0.15;
    } else if (aspectRatioValue > 0.9 && aspectRatioValue <= 1.1) {
      lineHeightAdjustment = -0.1;
    }

    const adjustedFontSize = Math.round(settings.fontSize * finalFontSizeScale.value);
    const adjustedLineHeight = Math.max(0.5, settings.lineHeight + lineHeightAdjustment);
    const adjustedPadding = Math.round(settings.padding * finalFontSizeScale.value);
    const adjustedLetterSpacing = settings.letterSpacing * finalFontSizeScale.value;

    return {
      fontFamily: `"${settings.fontFamily}", Arial, sans-serif`,
      fontSize: `${adjustedFontSize}px`,
      fontWeight: settings.fontWeight,
      backgroundColor: settings.backgroundEnabled ? settings.backgroundColor : 'transparent',
      padding: `${adjustedPadding}px`,
      borderRadius: `${settings.borderRadius}px`,
      lineHeight: adjustedLineHeight,
      letterSpacing: `${adjustedLetterSpacing}px`,
      textAlign: settings.textAlign,
      display: 'flex',
      flexWrap: 'wrap',
      justifyContent:
        settings.textAlign === 'left' ? 'flex-start' : settings.textAlign === 'right' ? 'flex-end' : 'center',
      gap: '0.2em',
      maxWidth: '100%',
    };
  });

  // Style for text layer (top layer)
  const getTextStyle = computed(() => {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;
    const adjustedFontSize = Math.round(settings.fontSize * finalFontSizeScale.value);

    return {
      color: settings.textColor,
      fontFamily: `"${settings.fontFamily}", Arial, sans-serif`,
      fontWeight: settings.fontWeight,
      fontSize: `${adjustedFontSize}px`,
    };
  });

  // Expose the video element ref to parent
  defineExpose({
    videoElement: videoElementRef,
  });

  // Watch for video element changes and notify parent
  watch(videoElementRef, (newElement) => {
    if (newElement) {
      emit('videoElementReady', newElement);
    }
  });

  // Setup ResizeObserver to track container size changes
  let resizeObserver: ResizeObserver | null = null;

  onMounted(() => {
    if (videoContainerRef.value) {
      // Initialize with current height
      containerHeight.value = videoContainerRef.value.clientHeight;

      // Create ResizeObserver to watch for size changes
      resizeObserver = new ResizeObserver((entries) => {
        for (const entry of entries) {
          // Update the reactive containerHeight when size changes
          containerHeight.value = entry.contentRect.height;
        }
      });

      resizeObserver.observe(videoContainerRef.value);
    }

    // Debug: Check if fonts are loaded
    if (props.subtitleSettings?.fontFamily) {
      console.log(
        '[VideoPlayer] Subtitle font:',
        props.subtitleSettings.fontFamily,
        'weight:',
        props.subtitleSettings.fontWeight
      );

      // Check if font is actually loaded
      document.fonts.ready.then(() => {
        const testFont = `${props.subtitleSettings?.fontWeight || 400} 12px "${props.subtitleSettings?.fontFamily}"`;
        const loaded = document.fonts.check(testFont);
        console.log('[VideoPlayer] Font loaded in browser?', loaded, 'test:', testFont);
      });
    }
  });

  onUnmounted(() => {
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });
</script>

<style scoped>
  /* Video player specific styles */
  .video-container {
    position: relative;
    background: #000;
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .video-crop-container {
    position: relative;
    overflow: hidden;
  }

  .video-element {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  /* Smooth focal point transition */
  .video-with-focal-point {
    transition: object-position 1.5s ease-in-out;
  }

  /* Play overlay animation */
  .play-overlay {
    transition: opacity 0.2s ease;
  }

  .play-overlay:hover {
    opacity: 1 !important;
  }

  /* Loading spinner */
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }

  /* Smooth transitions */
  .transition-opacity {
    transition-property: opacity;
    transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
    transition-duration: 150ms;
  }

  /* Backdrop blur effects */
  .backdrop-blur-sm {
    backdrop-filter: blur(4px);
  }

  /* Subtitle word animation styles */
  .subtitle-text-container {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    align-items: center;
    /* Gap is dynamically set via inline style from subtitleSettings.wordSpacing */
  }

  /* Subtitle layering for crisp borders */
  .subtitle-word-stack {
    position: relative;
    display: inline-block;
    transition-property: transform;
    transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    transform-origin: center;
    will-change: transform;
  }

  .subtitle-word-stack:has(.current-word) {
    /* Animation scale logic is handled via transform on parent or logic in JS if needed */
    /* But here we kept the transform logic on the stack itself? */
    /* The :class="{ 'current-word': isCurrentWord(wordInfo) }" is now on the ghost span? No. */
    /* We need to make sure the transform still works */
    transform: scale(1.15);
  }
</style>
