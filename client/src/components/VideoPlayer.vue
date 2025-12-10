<template>
  <div
    class="flex-1 min-h-0 rounded-xl bg-black/40 border border-white/3 relative overflow-hidden flex items-center justify-center group/player"
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
      <div v-if="videoLoading" class="absolute inset-0 flex items-center justify-center bg-zinc-950 z-10">
        <div class="flex flex-col items-center gap-4">
          <!-- Animated Loading Ring -->
          <div class="relative">
            <div class="loading-ring"></div>
            <div class="loading-ring-inner"></div>
            <Film class="h-6 w-6 text-white/60 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <div class="flex flex-col items-center gap-1">
            <span class="text-white/90 text-sm font-medium tracking-wide">Loading video</span>
            <span class="text-white/40 text-xs">Please wait...</span>
          </div>
        </div>
      </div>

      <!-- No Video State -->
      <div v-else-if="!videoSrc && !videoError" class="absolute inset-0 flex items-center justify-center">
        <div class="text-center group/empty">
          <div class="relative inline-block">
            <!-- Decorative rings -->
            <div class="absolute inset-0 -m-4 rounded-full border border-white/5 animate-pulse-slow" />
            <div class="absolute inset-0 -m-8 rounded-full border border-white/[0.03]" />
            <div
              class="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm transition-all duration-300 group-hover/empty:bg-white/[0.05] group-hover/empty:border-white/[0.1]"
            >
              <Video
                class="h-10 w-10 text-white/30 transition-colors group-hover/empty:text-white/50"
                strokeWidth="{1.5}"
              />
            </div>
          </div>
          <p class="text-white/40 text-sm mt-5 font-medium">No video assigned</p>
          <p class="text-white/20 text-xs mt-1">Select a clip to preview</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="videoError" class="absolute inset-0 flex items-center justify-center bg-zinc-950/90">
        <div class="text-center p-6 max-w-xs">
          <div class="relative inline-block mb-4">
            <div class="absolute inset-0 -m-2 rounded-full bg-red-500/20 animate-pulse-slow" />
            <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
              <AlertTriangle class="h-8 w-8 text-red-400" strokeWidth="{1.5}" />
            </div>
          </div>
          <p class="text-white/90 text-sm font-semibold">Failed to load video</p>
          <p class="text-white/40 text-xs mt-2 leading-relaxed">{{ videoError }}</p>
          <button
            @click="$emit('retryLoad')"
            class="mt-5 px-5 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 hover:border-red-500/50 rounded-lg text-sm text-red-300 transition-all duration-200 flex items-center gap-2 mx-auto group/retry"
          >
            <RotateCcw class="h-3.5 w-3.5 transition-transform group-hover/retry:-rotate-45" />
            <span>Try again</span>
          </button>
        </div>
      </div>
      <!-- Video Element -->
      <video
        v-else
        ref="videoElementRef"
        :src="videoSrc || undefined"
        crossorigin="anonymous"
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
        <div class="subtitle-text-container" :style="{ ...getSubtitleContainerStyle, gap: wordGapStyle }">
          <span
            v-for="(wordInfo, index) in visibleWords"
            :key="`subtitle-word-${wordInfo.start}-${index}`"
            class="subtitle-word-stack"
            :class="getAnimationClass"
            :style="{
              transitionDuration: `${getWordAnimationDuration(wordInfo)}s`,
              ...getTypewriterStyle(wordInfo, index),
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
                    letterSpacing: svgLetterSpacing,
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
                    letterSpacing: svgLetterSpacing,
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
                  :class="{ 'current-word-text': isCurrentWord(wordInfo) }"
                  :style="{
                    fontFamily: subtitleSettings.fontFamily,
                    fontWeight: subtitleSettings.fontWeight,
                    fontSize: getTextStyle.fontSize,
                    letterSpacing: svgLetterSpacing,
                    fill: subtitleSettings?.textColor || '#FFFFFF',
                  }"
                >
                  {{ wordInfo.word }}
                </text>

                <!-- Box highlight background (rendered behind text) -->
                <rect
                  v-if="subtitleSettings?.animationStyle === 'box-highlight' && isCurrentWord(wordInfo)"
                  x="0"
                  y="15%"
                  width="100%"
                  height="80%"
                  rx="4"
                  :fill="subtitleSettings?.highlightColor || '#FFFF00'"
                  :style="{ opacity: 0.3 }"
                />
              </g>
            </svg>
          </span>
        </div>
      </div>

      <!-- Watermark Overlay -->
      <div
        v-if="shouldShowWatermark && videoSrc && !videoLoading"
        class="absolute pointer-events-none z-15 transition-opacity duration-300"
        :style="getWatermarkOverlayStyle"
      >
        <img
          :src="getWatermarkSrc"
          alt="Watermark"
          class="max-w-full max-h-full object-contain watermark-image"
          :style="{ opacity: getWatermarkOpacity }"
        />
      </div>

      <!-- Center Play/Pause Overlay -->
      <button
        v-if="videoSrc && !videoLoading"
        @click="$emit('togglePlayPause')"
        class="absolute inset-0 flex items-center justify-center play-overlay"
        :class="{ 'is-paused': !isPlaying }"
        title="Play/Pause (Space)"
      >
        <!-- Gradient vignette for better visibility -->
        <div
          class="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 opacity-0 group-hover/player:opacity-100 transition-opacity duration-300"
        />

        <!-- Play/Pause Button -->
        <div class="play-button-container" :class="{ 'show-button': !isPlaying }">
          <div class="play-button">
            <Play v-if="!isPlaying" class="h-10 w-10 text-white ml-1" fill="white" />
            <Pause v-else class="h-10 w-10 text-white" fill="white" />
          </div>
        </div>

        <!-- Keyboard hint -->
        <div
          class="absolute bottom-4 left-1/2 -translate-x-1/2 opacity-0 group-hover/player:opacity-100 transition-all duration-300 translate-y-2 group-hover/player:translate-y-0"
        >
          <div
            class="flex items-center gap-1.5 px-2.5 py-1 bg-black/60 backdrop-blur-sm rounded-md border border-white/10"
          >
            <kbd class="text-[10px] text-white/50 font-mono bg-white/10 px-1.5 py-0.5 rounded">Space</kbd>
            <span class="text-[10px] text-white/40">to {{ isPlaying ? 'pause' : 'play' }}</span>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
  import { Video, AlertTriangle, Play, Pause, Film, RotateCcw } from 'lucide-vue-next';

  import type { WhisperSegment, WatermarkSettings } from '@/types';

  interface WatermarkData {
    dataUrl: string; // Data URL for display
    width?: number;
    height?: number;
  }

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
    watermarkSettings?: WatermarkSettings;
    watermarkData?: WatermarkData | null;
    audioGainDb?: number; // dB gain (-20 to +20) for audio playback preview
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
    animationStyle: 'none' | 'karaoke' | 'zoom' | 'pop' | 'glow' | 'box-highlight' | 'typewriter' | 'wave';
    highlightColor: string;
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
      positionPercentage: 97,
      maxWidth: 90,
      animationStyle: 'none',
      highlightColor: '#FFFF00',
      lineHeight: 1.2,
      letterSpacing: 0,
      textAlign: 'center',
      padding: 16,
      borderRadius: 8,
      textOffsetX: 0,
      textOffsetY: 0,
      wordSpacing: 0.35,
    }),
    transcriptWords: () => [],
    transcriptSegments: () => [],
    currentTime: 0,
    watermarkSettings: () => ({
      enabled: false,
      watermarkId: null,
      positionX: 8,
      positionY: 95,
      opacity: 80,
      scale: 15,
    }),
    watermarkData: null,
    audioGainDb: 0,
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

  // Web Audio API refs for gain control
  const audioContext = ref<AudioContext | null>(null);
  const gainNode = ref<GainNode | null>(null);
  const mediaSource = ref<MediaElementAudioSourceNode | null>(null);
  const isAudioSetup = ref(false);

  // Convert dB to linear gain multiplier
  function dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  // Setup Web Audio API for gain control
  async function setupAudioGain(videoElement: HTMLVideoElement) {
    // Only setup once per video element
    if (isAudioSetup.value) return;

    // Don't setup if gain is 0 dB (no change needed)
    // This allows normal playback when no gain adjustment is required
    const currentGainDb = props.audioGainDb ?? 0;
    if (currentGainDb === 0 && !audioContext.value) {
      console.log('[VideoPlayer] Skipping audio gain setup (0 dB, no adjustment needed)');
      return;
    }

    try {
      // Create audio context if not exists
      if (!audioContext.value) {
        audioContext.value = new AudioContext();
        console.log('[VideoPlayer] Created new AudioContext, state:', audioContext.value.state);
      }

      // Resume context if suspended (required for user gesture)
      if (audioContext.value.state === 'suspended') {
        console.log('[VideoPlayer] Resuming suspended AudioContext...');
        await audioContext.value.resume();
        console.log('[VideoPlayer] AudioContext resumed, state:', audioContext.value.state);
      }

      // Create media source from video element
      mediaSource.value = audioContext.value.createMediaElementSource(videoElement);
      console.log('[VideoPlayer] Created MediaElementSourceNode');

      // Create gain node
      gainNode.value = audioContext.value.createGain();

      // Set initial gain
      const linearGain = dbToLinear(currentGainDb);
      gainNode.value.gain.value = linearGain;
      console.log('[VideoPlayer] Created GainNode with initial gain:', linearGain);

      // Connect: video -> gain -> destination (speakers)
      mediaSource.value.connect(gainNode.value);
      gainNode.value.connect(audioContext.value.destination);
      console.log('[VideoPlayer] Audio routing connected: video -> gain -> destination');

      isAudioSetup.value = true;
      console.log('[VideoPlayer] Audio gain setup complete, gain:', linearGain, '(', currentGainDb, 'dB)');
    } catch (error) {
      console.error('[VideoPlayer] Failed to setup audio gain:', error);
      // Reset state so we can try again if needed
      isAudioSetup.value = false;
    }
  }

  // Update gain value when prop changes
  function updateAudioGain() {
    if (gainNode.value && audioContext.value) {
      const linearGain = dbToLinear(props.audioGainDb ?? 0);
      // Use setValueAtTime for smooth transition
      gainNode.value.gain.setTargetAtTime(linearGain, audioContext.value.currentTime, 0.05);
    }
  }

  // Cleanup audio resources
  function cleanupAudio() {
    if (mediaSource.value) {
      try {
        mediaSource.value.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      mediaSource.value = null;
    }
    if (gainNode.value) {
      try {
        gainNode.value.disconnect();
      } catch (e) {
        // Ignore disconnect errors
      }
      gainNode.value = null;
    }
    if (audioContext.value) {
      try {
        audioContext.value.close();
      } catch (e) {
        // Ignore close errors
      }
      audioContext.value = null;
    }
    isAudioSetup.value = false;
  }

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

  // Get the animation class based on animation style
  const getAnimationClass = computed(() => {
    const style = props.subtitleSettings?.animationStyle;
    if (!style || style === 'none') return {};

    return {
      'animation-zoom': style === 'zoom',
      'animation-karaoke': style === 'karaoke',
      'animation-pop': style === 'pop',
      'animation-glow': style === 'glow',
      'animation-box-highlight': style === 'box-highlight',
      'animation-typewriter': style === 'typewriter',
      'animation-wave': style === 'wave',
    };
  });

  // Get typewriter style (controls visibility for typewriter effect)
  function getTypewriterStyle(word: WordInfo, _index: number): Record<string, string> {
    const style = props.subtitleSettings?.animationStyle;
    if (style !== 'typewriter') return {};

    const time = props.currentTime || 0;
    const isVisible = time >= word.start;

    return {
      opacity: isVisible ? '1' : '0',
      transform: isVisible ? 'translateY(0)' : 'translateY(10px)',
    };
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

    // Calculate scaled values for advanced settings
    const scaledPadding = Math.round((settings.padding || 0) * finalFontSizeScale.value);
    const scaledBorderRadius = Math.round((settings.borderRadius || 0) * finalFontSizeScale.value);
    const scaledLineHeight = settings.lineHeight || 1.2;

    // Base styles
    const baseStyles: Record<string, string> = {
      top: topPosition,
      left: '50%',
      transform: `translate(calc(-50% + ${leftOffset}%), calc(-50% + ${topOffset}%))`,
      width: settings.maxWidth + '%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      lineHeight: String(scaledLineHeight),
    };

    // Add background styles if enabled
    if (settings.backgroundEnabled) {
      baseStyles.backgroundColor = settings.backgroundColor || '#000000';
      baseStyles.padding = `${scaledPadding}px`;
      baseStyles.borderRadius = `${scaledBorderRadius}px`;
    }

    return baseStyles;
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

  // Style for text layer (top layer)
  const getTextStyle = computed(() => {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;
    const adjustedFontSize = Math.round(settings.fontSize * finalFontSizeScale.value);
    const adjustedLetterSpacing = (settings.letterSpacing || 0) * finalFontSizeScale.value;

    return {
      color: settings.textColor,
      fontFamily: `"${settings.fontFamily}", Arial, sans-serif`,
      fontWeight: settings.fontWeight,
      fontSize: `${adjustedFontSize}px`,
      letterSpacing: `${adjustedLetterSpacing}px`,
    };
  });

  // Calculate word gap (spacing between words)
  const wordGapStyle = computed(() => {
    if (!props.subtitleSettings) return '0.35em';

    const settings = props.subtitleSettings;
    // wordSpacing is a multiplier (0.1 to 1), convert to em units
    const wordSpacing = settings.wordSpacing || 0.35;
    return `${wordSpacing}em`;
  });

  // Get letter spacing for SVG elements
  const svgLetterSpacing = computed(() => {
    if (!props.subtitleSettings) return '0px';

    const settings = props.subtitleSettings;
    const adjustedLetterSpacing = (settings.letterSpacing || 0) * finalFontSizeScale.value;
    return `${adjustedLetterSpacing}px`;
  });

  // Watermark overlay computed properties
  const getWatermarkSrc = computed(() => {
    return props.watermarkData?.dataUrl || '';
  });

  // Get the aspect ratio string for looking up per-ratio settings
  const aspectRatioString = computed(() => {
    const { width, height } = props.aspectRatio;
    // Normalize common aspect ratios
    const ratio = width / height;
    if (Math.abs(ratio - 16/9) < 0.01) return '16:9';
    if (Math.abs(ratio - 9/16) < 0.01) return '9:16';
    if (Math.abs(ratio - 1) < 0.01) return '1:1';
    if (Math.abs(ratio - 4/5) < 0.01) return '4:5';
    return `${width}:${height}`;
  });

  // Check if watermark should be shown for current aspect ratio
  const shouldShowWatermark = computed(() => {
    if (!props.watermarkSettings?.enabled) return false;
    if (!props.watermarkData) return false;
    
    const perRatio = props.watermarkSettings.perRatioSettings;
    if (perRatio) {
      const ratioKey = aspectRatioString.value as keyof typeof perRatio;
      // If perRatioSettings exists and the specific ratio is null, watermark is disabled for this ratio
      if (ratioKey in perRatio && perRatio[ratioKey] === null) {
        return false;
      }
    }
    return true;
  });

  const getWatermarkOverlayStyle = computed(() => {
    if (!props.watermarkSettings) return {};

    const settings = props.watermarkSettings;
    
    // Check if we have per-ratio settings and use them if available
    let positionX = settings.positionX;
    let positionY = settings.positionY;
    let scale = settings.scale || 15;
    let opacity = settings.opacity;
    
    const perRatio = settings.perRatioSettings;
    if (perRatio) {
      const ratioKey = aspectRatioString.value as keyof typeof perRatio;
      const ratioSettings = perRatio[ratioKey];
      if (ratioSettings) {
        positionX = ratioSettings.x;
        positionY = ratioSettings.y;
        scale = ratioSettings.scale;
        opacity = ratioSettings.opacity;
      }
    }

    return {
      width: `${scale}%`,
      left: `${positionX}%`,
      top: `${positionY}%`,
      transform: 'translate(-50%, -50%)',
    };
  });

  // Get watermark opacity based on aspect ratio
  const getWatermarkOpacity = computed(() => {
    if (!props.watermarkSettings) return 1;
    
    const settings = props.watermarkSettings;
    let opacity = settings.opacity || 100;
    
    const perRatio = settings.perRatioSettings;
    if (perRatio) {
      const ratioKey = aspectRatioString.value as keyof typeof perRatio;
      const ratioSettings = perRatio[ratioKey];
      if (ratioSettings) {
        opacity = ratioSettings.opacity;
      }
    }
    
    return opacity / 100;
  });

  // Expose the video element ref to parent
  defineExpose({
    videoElement: videoElementRef,
  });

  // Watch for video element changes and notify parent
  watch(videoElementRef, (newElement) => {
    if (newElement) {
      emit('videoElementReady', newElement);
      // Don't setup audio immediately - wait for gain change or canPlay
    }
  });

  // Watch for audioGainDb changes
  watch(
    () => props.audioGainDb,
    async (newGainDb) => {
      // If audio is already setup, just update the gain
      if (isAudioSetup.value) {
        updateAudioGain();
        // Also ensure AudioContext is running
        if (audioContext.value?.state === 'suspended') {
          await audioContext.value.resume();
        }
      } else if (newGainDb !== 0 && videoElementRef.value) {
        // Setup audio when user changes gain from 0 to something else
        await setupAudioGain(videoElementRef.value);
      }
    }
  );

  // Watch for play state to ensure AudioContext is running
  watch(
    () => props.isPlaying,
    async (playing) => {
      if (playing && audioContext.value?.state === 'suspended') {
        console.log('[VideoPlayer] Video playing, resuming AudioContext');
        await audioContext.value.resume();
      }
    }
  );

  // Note: We do NOT cleanup audio when video source changes because
  // MediaElementAudioSourceNode can only be created once per video element.
  // The audio routing remains valid even when the video src changes.

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
    // Cleanup audio resources
    cleanupAudio();
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
    border-radius: 0.5rem;
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

  /* Loading Animation */
  .loading-ring {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: rgba(139, 92, 246, 0.8);
    border-right-color: rgba(6, 182, 212, 0.4);
    animation: loading-spin 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  }

  .loading-ring-inner {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 40px;
    height: 40px;
    margin: -20px 0 0 -20px;
    border-radius: 50%;
    border: 2px solid transparent;
    border-top-color: rgba(6, 182, 212, 0.6);
    border-left-color: rgba(139, 92, 246, 0.3);
    animation: loading-spin 0.8s cubic-bezier(0.5, 0, 0.5, 1) infinite reverse;
  }

  @keyframes loading-spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  /* Slow pulse animation */
  @keyframes pulse-slow {
    0%,
    100% {
      opacity: 0.5;
      transform: scale(1);
    }
    50% {
      opacity: 0.3;
      transform: scale(1.05);
    }
  }

  .animate-pulse-slow {
    animation: pulse-slow 3s ease-in-out infinite;
  }

  /* Play/Pause Overlay */
  .play-overlay {
    cursor: pointer;
  }

  .play-button-container {
    opacity: 0;
    transform: scale(0.8);
    transition: all 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .play-overlay:hover .play-button-container,
  .play-button-container.show-button {
    opacity: 1;
    transform: scale(1);
  }

  .play-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    box-shadow:
      0 8px 32px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
    transition: all 0.2s ease;
  }

  .play-button:hover {
    background: rgba(0, 0, 0, 0.7);
    border-color: rgba(255, 255, 255, 0.25);
    transform: scale(1.05);
  }

  .play-button:active {
    transform: scale(0.95);
  }

  /* Paused state shows play button more prominently */
  .is-paused .play-button-container {
    opacity: 0.9;
    transform: scale(1);
  }

  /* Focal Point Indicator */
  .focal-point-indicator {
    animation: focal-pulse 2s ease-in-out infinite;
  }

  @keyframes focal-pulse {
    0%,
    100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
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
    /* justify-content is set dynamically via inline style based on textAlign */
    align-items: center;
  }

  /* Subtitle layering for crisp borders */
  .subtitle-word-stack {
    position: relative;
    display: inline-block;
    transition-property: transform, opacity, filter;
    transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    transform-origin: center;
    will-change: transform, opacity, filter;
  }

  /* ===== ANIMATION STYLES ===== */

  /* Zoom animation - scale up current word */
  .subtitle-word-stack.animation-zoom:has(.current-word) {
    transform: scale(1.15);
  }

  /* Karaoke animation - color change handled via JS, subtle scale */
  .subtitle-word-stack.animation-karaoke:has(.current-word) {
    transform: scale(1.05);
  }

  /* Pop/Bounce animation - bouncy scale effect */
  .subtitle-word-stack.animation-pop:has(.current-word) {
    animation: pop-bounce 0.3s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards;
  }

  @keyframes pop-bounce {
    0% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.25);
    }
    100% {
      transform: scale(1.1);
    }
  }

  /* Glow animation - glowing emphasis */
  .subtitle-word-stack.animation-glow:has(.current-word) {
    filter: drop-shadow(0 0 8px currentColor) drop-shadow(0 0 16px currentColor);
    transform: scale(1.05);
  }

  /* Box highlight - background box (rendered via SVG rect) */
  .subtitle-word-stack.animation-box-highlight:has(.current-word) {
    transform: scale(1.02);
  }

  /* Typewriter animation - words appear as spoken */
  .subtitle-word-stack.animation-typewriter {
    transition-property: transform, opacity;
    transition-duration: 0.15s;
    transition-timing-function: ease-out;
  }

  /* Wave animation - wave effect across words */
  .subtitle-word-stack.animation-wave:has(.current-word) {
    animation: wave-float 0.4s ease-in-out;
  }

  @keyframes wave-float {
    0% {
      transform: translateY(0) scale(1);
    }
    25% {
      transform: translateY(-8px) scale(1.08);
    }
    50% {
      transform: translateY(-4px) scale(1.05);
    }
    75% {
      transform: translateY(-6px) scale(1.06);
    }
    100% {
      transform: translateY(0) scale(1.03);
    }
  }

  /* Watermark styling */
  .watermark-image {
    filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.3));
    transition: opacity 0.3s ease;
  }

  /* Video element styling */
  video {
    background: #09090b;
  }

  /* Keyboard hint styling */
  kbd {
    font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, monospace;
  }
</style>
