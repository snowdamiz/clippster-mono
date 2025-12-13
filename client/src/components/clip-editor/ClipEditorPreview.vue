<template>
  <div class="flex-1 flex flex-col min-h-0 p-4">
    <!-- Video Container -->
    <div
      ref="videoContainerRef"
      class="flex-1 flex items-center justify-center bg-black rounded-lg overflow-hidden relative"
    >
      <!-- Single region mode: Main video with CSS transforms applied directly (no extra decoding) -->
      <div
        v-if="showFramedPreview && isSingleRegion"
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black overflow-hidden cursor-pointer"
        :style="getFramedContainerStyle()"
        @click="onVideoClick"
      >
        <video
          ref="videoRef"
          :src="videoSrc || ''"
          class="absolute max-w-none"
          :style="getSingleRegionVideoStyle()"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @ended="onEnded"
          @play="onPlay"
          @pause="onPause"
        />
      </div>

      <!-- Multi-region framed container (for manually configured multiple regions) -->
      <div
        v-else-if="showFramedPreview"
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-black overflow-hidden"
        :style="getFramedContainerStyle()"
      >
        <!-- Hidden main video for audio/control -->
        <video
          ref="videoRef"
          :src="videoSrc || ''"
          class="sr-only"
          @loadedmetadata="onLoadedMetadata"
          @timeupdate="onTimeUpdate"
          @ended="onEnded"
          @play="onPlay"
          @pause="onPause"
        />

        <!-- Render each region from the framing config -->
        <div
          v-for="(region, idx) in currentFramingConfig?.regions || []"
          :key="region.id"
          class="absolute overflow-hidden"
          :style="getRegionOutputStyle(region)"
        >
          <!-- Video crop preview - matches POI editor exactly -->
          <video
            :ref="(el) => setRegionVideoRef(idx, el as HTMLVideoElement)"
            :src="videoSrc || ''"
            class="absolute max-w-none pointer-events-none"
            :style="getCroppedVideoStyle(region)"
            muted
            playsinline
            @loadedmetadata="onRegionVideoLoaded"
          />
        </div>

        <!-- Click handler overlay -->
        <div class="absolute inset-0 cursor-pointer" @click="onVideoClick" />
      </div>

      <!-- Default 16:9 mode: Normal video display -->
      <video
        v-else
        ref="videoRef"
        :src="videoSrc || ''"
        class="max-w-full max-h-full object-contain cursor-pointer"
        :style="getVideoFilterStyle()"
        @loadedmetadata="onLoadedMetadata"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
        @play="onPlay"
        @pause="onPause"
        @click="onVideoClick"
      />

      <!-- Overlay Container - matches video dimensions -->
      <div
        ref="overlayContainerRef"
        class="absolute overflow-hidden"
        :style="getOverlayContainerPositionStyle()"
        @click.self="onOverlayContainerClick"
      >
        <!-- Aspect ratio indicator for framed mode -->
        <div
          v-if="showFramedPreview"
          class="absolute top-2 right-2 px-2 py-1 bg-black/80 rounded text-[10px] text-white font-medium pointer-events-none z-20"
        >
          {{ previewAspectRatio }}
        </div>

        <!-- Text Overlays (Draggable with Resize Handles) -->
        <div
          v-for="overlay in visibleTextOverlays"
          :key="overlay.id"
          :data-overlay-id="overlay.id"
          class="absolute text-overlay select-none group"
          :class="[
            getTextOverlayClass(overlay),
            {
              'cursor-move pointer-events-auto': true,
              'ring-2 ring-violet-500 ring-offset-2 ring-offset-transparent':
                (dragState.type === 'text' && dragState.id === overlay.id) || resizeState.id === overlay.id,
              'hover:ring-2 hover:ring-violet-400/50': dragState.id !== overlay.id && resizeState.id !== overlay.id,
            },
          ]"
          :style="getTextOverlayStyle(overlay)"
          @mousedown="(e) => startDrag(e, 'text', overlay.id, getOverlayConfigForRatio(overlay).position)"
        >
          <!-- Left Resize Handle -->
          <div
            class="absolute left-0 top-0 bottom-0 w-2 -ml-1 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
            @mousedown.stop="(e) => startResize(e, overlay.id, 'left')"
          >
            <div class="w-1 h-8 bg-violet-500 rounded-full shadow-lg"></div>
          </div>

          <!-- Text Content -->
          <span class="pointer-events-none">{{ overlay.text }}</span>

          <!-- Right Resize Handle -->
          <div
            class="absolute right-0 top-0 bottom-0 w-2 -mr-1 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10"
            @mousedown.stop="(e) => startResize(e, overlay.id, 'right')"
          >
            <div class="w-1 h-8 bg-violet-500 rounded-full shadow-lg"></div>
          </div>
        </div>

        <!-- Stickers (Draggable with Resize and Rotate Handles) -->
        <!-- Wrapper element for positioning (handles stay fixed size) -->
        <div
          v-for="sticker in visibleStickers"
          :key="sticker.id"
          :data-sticker-id="sticker.id"
          class="absolute sticker-overlay select-none group pointer-events-auto"
          :style="getStickerWrapperStyle(sticker)"
        >
          <!-- Sticker Content (scaled and rotated) -->
          <div
            :class="[getStickerClass(sticker), 'cursor-move']"
            :style="getStickerContentStyle(sticker)"
            @mousedown="(e) => startStickerDrag(e, sticker)"
          >
            <span v-if="sticker.stickerType === 'emoji'" class="sticker-emoji pointer-events-none select-none">
              {{ sticker.stickerPath }}
            </span>
            <img
              v-else
              :src="sticker.stickerPath"
              class="max-w-none pointer-events-none select-none"
              :style="getStickerImageStyle(sticker)"
              draggable="false"
              alt="Sticker"
              @load="(e) => onStickerImageLoad(sticker.id, e)"
            />
          </div>

          <!-- Selection border (dashed, like POI regions) -->
          <div
            class="absolute inset-0 border border-dashed rounded-sm pointer-events-none transition-opacity"
            :class="[
              (dragState.type === 'sticker' && dragState.id === sticker.id) ||
              stickerResizeState.id === sticker.id ||
              stickerRotateState.id === sticker.id
                ? 'border-violet-400 opacity-100'
                : 'border-white/40 opacity-0 group-hover:opacity-100',
            ]"
            :style="getStickerBoundsStyle(sticker)"
          />

          <!-- Rotation Handle (positioned above sticker, rotates with it) -->
          <div
            class="absolute w-5 h-5 rounded-full bg-violet-500 hover:bg-violet-400 cursor-grab active:cursor-grabbing flex items-center justify-center transition-colors shadow-sm opacity-0 group-hover:opacity-100 z-20"
            :class="{ '!opacity-100': stickerRotateState.id === sticker.id }"
            :style="getRotationHandleStyle(sticker)"
            @mousedown.stop="
              (e) =>
                startStickerRotate(
                  e,
                  sticker.id,
                  (e.target as HTMLElement).closest('[data-sticker-id]') as HTMLElement,
                  getStickerConfigForRatio(sticker).rotation
                )
            "
          >
            <RotateCw class="w-2.5 h-2.5 text-white" />
          </div>

          <!-- Corner Resize Handles (like POI regions) -->
          <div
            class="absolute w-2.5 h-2.5 rounded-full bg-violet-500 hover:bg-violet-400 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
            :class="{ '!opacity-100': stickerResizeState.id === sticker.id }"
            :style="getResizeHandleStyle(sticker, 'se')"
            @mousedown.stop="(e) => startStickerResize(e, sticker)"
          />
          <div
            class="absolute w-2.5 h-2.5 rounded-full bg-violet-500 hover:bg-violet-400 cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
            :class="{ '!opacity-100': stickerResizeState.id === sticker.id }"
            :style="getResizeHandleStyle(sticker, 'sw')"
            @mousedown.stop="(e) => startStickerResize(e, sticker)"
          />
          <div
            class="absolute w-2.5 h-2.5 rounded-full bg-violet-500 hover:bg-violet-400 cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
            :class="{ '!opacity-100': stickerResizeState.id === sticker.id }"
            :style="getResizeHandleStyle(sticker, 'ne')"
            @mousedown.stop="(e) => startStickerResize(e, sticker)"
          />
          <div
            class="absolute w-2.5 h-2.5 rounded-full bg-violet-500 hover:bg-violet-400 cursor-nw-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
            :class="{ '!opacity-100': stickerResizeState.id === sticker.id }"
            :style="getResizeHandleStyle(sticker, 'nw')"
            @mousedown.stop="(e) => startStickerResize(e, sticker)"
          />
        </div>

        <!-- Watermarks (Draggable with Resize Handles - like stickers) -->
        <div
          v-for="watermark in visibleWatermarks"
          :key="watermark.id"
          :data-watermark-id="watermark.id"
          class="absolute watermark-overlay select-none group pointer-events-auto"
          :style="getWatermarkWrapperStyle(watermark)"
        >
          <!-- Watermark Content (scaled) -->
          <div
            class="cursor-move"
            :style="getWatermarkContentStyle(watermark)"
            @mousedown="(e) => startWatermarkDrag(e, watermark)"
          >
            <img
              :src="watermark.watermarkPath"
              class="max-w-none pointer-events-none select-none"
              :style="getWatermarkImageStyle(watermark)"
              draggable="false"
              alt="Watermark"
              @load="(e) => onWatermarkImageLoad(watermark.id, e)"
            />
          </div>

          <!-- Selection border (dashed, like stickers) -->
          <div
            class="absolute inset-0 border border-dashed rounded-sm pointer-events-none transition-opacity"
            :class="[
              (dragState.type === 'watermark' && dragState.id === watermark.id) ||
              watermarkResizeState.id === watermark.id
                ? 'border-violet-400 opacity-100'
                : 'border-white/40 opacity-0 group-hover:opacity-100',
            ]"
            :style="getWatermarkBoundsStyle(watermark)"
          />

          <!-- Corner Resize Handles (like stickers) -->
          <div
            class="absolute w-2.5 h-2.5 rounded-full bg-violet-500 hover:bg-violet-400 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
            :class="{ '!opacity-100': watermarkResizeState.id === watermark.id }"
            :style="getWatermarkResizeHandleStyle(watermark, 'se')"
            @mousedown.stop="(e) => startWatermarkResize(e, watermark)"
          />
          <div
            class="absolute w-2.5 h-2.5 rounded-full bg-violet-500 hover:bg-violet-400 cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
            :class="{ '!opacity-100': watermarkResizeState.id === watermark.id }"
            :style="getWatermarkResizeHandleStyle(watermark, 'sw')"
            @mousedown.stop="(e) => startWatermarkResize(e, watermark)"
          />
          <div
            class="absolute w-2.5 h-2.5 rounded-full bg-violet-500 hover:bg-violet-400 cursor-nesw-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
            :class="{ '!opacity-100': watermarkResizeState.id === watermark.id }"
            :style="getWatermarkResizeHandleStyle(watermark, 'ne')"
            @mousedown.stop="(e) => startWatermarkResize(e, watermark)"
          />
          <div
            class="absolute w-2.5 h-2.5 rounded-full bg-violet-500 hover:bg-violet-400 cursor-nw-resize opacity-0 group-hover:opacity-100 transition-opacity z-20 shadow-sm"
            :class="{ '!opacity-100': watermarkResizeState.id === watermark.id }"
            :style="getWatermarkResizeHandleStyle(watermark, 'nw')"
            @mousedown.stop="(e) => startWatermarkResize(e, watermark)"
          />
        </div>

        <!-- Subtitles (Draggable with Resize Handles) -->
        <div
          v-if="subtitleSettings?.enabled && visibleSubtitleWords.length > 0"
          class="absolute subtitle-overlay select-none cursor-move group pointer-events-auto"
          :class="{
            'ring-2 ring-purple-500 ring-offset-2 ring-offset-transparent':
              dragState.type === 'subtitle' || subtitleResizeState.isResizing,
            'hover:ring-2 hover:ring-purple-400/50': dragState.type !== 'subtitle' && !subtitleResizeState.isResizing,
          }"
          :style="getSubtitleContainerStyle()"
          @mousedown="startSubtitleDrag"
        >
          <!-- Left Resize Handle -->
          <div
            class="absolute left-0 top-0 bottom-0 w-2 -ml-1 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-auto"
            @mousedown.stop="(e) => startSubtitleResize(e, 'left')"
          >
            <div class="w-1 h-8 bg-purple-500 rounded-full shadow-lg"></div>
          </div>

          <div class="subtitle-text-container pointer-events-none" :style="getSubtitleTextContainerStyle()">
            <span
              v-for="(wordInfo, index) in visibleSubtitleWords"
              :key="`subtitle-word-${wordInfo.start}-${index}`"
              class="subtitle-word-stack"
              :class="getSubtitleAnimationClass"
              :style="{
                transitionDuration: `${getWordAnimationDuration(wordInfo)}s`,
                ...getTypewriterStyle(wordInfo),
              }"
            >
              <!-- Hidden span for sizing -->
              <span
                class="invisible pointer-events-none select-none"
                :class="{ 'current-word': isCurrentWord(wordInfo) }"
                :style="getWordTextStyle"
              >
                {{ wordInfo.word }}
              </span>

              <!-- SVG-based text rendering for proper borders -->
              <svg class="absolute inset-0 w-full h-full overflow-visible" style="pointer-events: none">
                <defs>
                  <filter :id="`clip-shadow-${index}`" x="-50%" y="-50%" width="200%" height="200%">
                    <feDropShadow
                      v-if="subtitleSettings?.shadowBlur > 0"
                      :dx="subtitleSettings.shadowOffsetX * overlayScaleFactor"
                      :dy="subtitleSettings.shadowOffsetY * overlayScaleFactor"
                      :stdDeviation="subtitleSettings.shadowBlur * overlayScaleFactor"
                      :flood-color="subtitleSettings.shadowColor"
                    />
                  </filter>
                </defs>

                <g :style="{ transformOrigin: 'center', transformBox: 'fill-box' }">
                  <!-- Layer 1: Outer border (Border 2) with shadow -->
                  <text
                    v-if="subtitleSettings && (subtitleSettings.border2Width > 0 || subtitleSettings.border1Width > 0)"
                    x="50%"
                    y="55%"
                    dominant-baseline="middle"
                    text-anchor="middle"
                    :style="{
                      fontFamily: subtitleSettings.fontFamily,
                      fontWeight: subtitleSettings.fontWeight,
                      fontSize: scaledFontSize + 'px',
                      letterSpacing: scaledLetterSpacing + 'px',
                      stroke: subtitleSettings.border2Color,
                      strokeWidth:
                        (subtitleSettings.border1Width + subtitleSettings.border2Width) * 2 * overlayScaleFactor + 'px',
                      strokeLinejoin: 'round',
                      strokeLinecap: 'round',
                      fill: 'none',
                      filter: `url(#clip-shadow-${index})`,
                    }"
                  >
                    {{ wordInfo.word }}
                  </text>

                  <!-- Layer 2: Inner border (Border 1) -->
                  <text
                    v-if="subtitleSettings && subtitleSettings.border1Width > 0"
                    x="50%"
                    y="55%"
                    dominant-baseline="middle"
                    text-anchor="middle"
                    :style="{
                      fontFamily: subtitleSettings.fontFamily,
                      fontWeight: subtitleSettings.fontWeight,
                      fontSize: scaledFontSize + 'px',
                      letterSpacing: scaledLetterSpacing + 'px',
                      stroke: subtitleSettings.border1Color,
                      strokeWidth: subtitleSettings.border1Width * 2 * overlayScaleFactor + 'px',
                      strokeLinejoin: 'round',
                      strokeLinecap: 'round',
                      fill: 'none',
                    }"
                  >
                    {{ wordInfo.word }}
                  </text>

                  <!-- Layer 3: Fill text -->
                  <text
                    x="50%"
                    y="55%"
                    dominant-baseline="middle"
                    text-anchor="middle"
                    :class="{ 'current-word-text': isCurrentWord(wordInfo) }"
                    :style="{
                      fontFamily: subtitleSettings.fontFamily,
                      fontWeight: subtitleSettings.fontWeight,
                      fontSize: scaledFontSize + 'px',
                      letterSpacing: scaledLetterSpacing + 'px',
                      fill:
                        isCurrentWord(wordInfo) && subtitleSettings?.animationStyle === 'karaoke'
                          ? subtitleSettings?.highlightColor || '#FFFF00'
                          : subtitleSettings?.textColor || '#FFFFFF',
                    }"
                  >
                    {{ wordInfo.word }}
                  </text>

                  <!-- Box highlight background -->
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

          <!-- Right Resize Handle -->
          <div
            class="absolute right-0 top-0 bottom-0 w-2 -mr-1 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10 pointer-events-auto"
            @mousedown.stop="(e) => startSubtitleResize(e, 'right')"
          >
            <div class="w-1 h-8 bg-purple-500 rounded-full shadow-lg"></div>
          </div>
        </div>
      </div>

      <!-- Vignette Overlay (applied as overlay since it's a radial gradient effect) -->
      <div
        v-if="filterSettings?.vignette && filterSettings.vignette > 0"
        class="absolute inset-0 pointer-events-none"
        :style="getVignetteStyle()"
      />

      <!-- Temperature Overlay (warm/cool color tint) -->
      <div
        v-if="filterSettings?.temperature && filterSettings.temperature !== 0"
        class="absolute inset-0 pointer-events-none"
        :style="getTemperatureStyle()"
      />

      <!-- Play Button (centered, doesn't block overlay interactions) -->
      <button
        v-if="!isPlaying"
        @click.stop="emit('togglePlay')"
        class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur-sm flex items-center justify-center transition-colors pointer-events-auto z-10"
      >
        <Play class="w-8 h-8 text-white ml-1" />
      </button>
    </div>

    <!-- Controls Bar -->
    <div class="mt-2 bg-black/40 backdrop-blur-sm rounded-lg border border-white/[0.04]">
      <div class="flex items-center justify-between px-1.5 py-1.5">
        <!-- Left Controls -->
        <div class="flex items-center gap-1">
          <!-- Go to Beginning Button -->
          <button
            @click="goToBeginning"
            class="p-2.5 hover:bg-white/[0.08] rounded-lg transition-all duration-200 group"
            title="Go to Beginning"
          >
            <SkipBack class="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
          </button>
          <!-- Play/Pause Button -->
          <button
            @click="emit('togglePlay')"
            class="p-2.5 hover:bg-white/[0.08] rounded-lg transition-all duration-200 group"
            title="Play/Pause (Space)"
          >
            <Play v-if="!isPlaying" class="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
            <Pause v-else class="h-4 w-4 text-white/60 group-hover:text-white transition-colors" />
          </button>
          <!-- Time Display -->
          <div
            class="text-white/80 text-xs font-mono bg-white/[0.04] px-3 py-2 rounded-lg ml-1 tabular-nums tracking-tight"
          >
            <span class="text-white/90">{{ formatDuration(currentTime) }}</span>
            <span class="text-white/40 mx-1">/</span>
            <span class="text-white/50">{{ formatDuration(duration) }}</span>
          </div>
        </div>
        <!-- Right Controls -->
        <div class="flex items-center gap-2 pr-1">
          <!-- Volume Control -->
          <div class="flex items-center gap-2 px-2 py-1.5">
            <button
              @click="toggleMute"
              class="p-1.5 rounded-md hover:bg-white/[0.08] transition-all duration-200 group"
              title="Mute/Unmute"
            >
              <VolumeX
                v-if="isMuted || volume === 0"
                class="h-4 w-4 text-white/50 group-hover:text-white/80 transition-colors"
              />
              <Volume2 v-else class="h-4 w-4 text-white/60 group-hover:text-white/90 transition-colors" />
            </button>
            <div class="relative w-24 h-1 bg-white/10 rounded-full">
              <div
                class="absolute left-0 top-0 h-full bg-white/40 rounded-full transition-all duration-150"
                :style="{ width: `${volume * 100}%` }"
              ></div>
              <input
                :value="volume"
                type="range"
                min="0"
                max="1"
                step="0.05"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10 pt-0.5"
                @input="onVolumeChange"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, onUnmounted, watch } from 'vue';
  import { Play, Pause, Volume2, VolumeX, RotateCw, SkipBack } from 'lucide-vue-next';
  import type {
    TextOverlay,
    Sticker,
    FilterSettings,
    ManualFramingConfigs,
    ClipWatermark,
    WatermarkRatioConfig,
    ClipSubtitleSettings,
    WordInfo,
    WhisperSegment,
  } from '@/types';

  interface SegmentInput {
    start_time: number;
    end_time: number;
  }

  interface DragState {
    isDragging: boolean;
    type: 'text' | 'sticker' | 'watermark' | 'subtitle' | null;
    id: string | null;
    startX: number;
    startY: number;
    startPosition: { x: number; y: number };
  }

  interface WatermarkResizeState {
    isResizing: boolean;
    id: string | null;
    centerX: number;
    centerY: number;
    startDistance: number;
    startScale: number;
  }

  interface ResizeState {
    isResizing: boolean;
    id: string | null;
    side: 'left' | 'right' | null;
    startX: number;
    startWidth: number; // Width as percentage
    startPositionX: number; // Position X as percentage
  }

  interface StickerResizeState {
    isResizing: boolean;
    id: string | null;
    centerX: number;
    centerY: number;
    startDistance: number;
    startScale: number;
  }

  interface StickerRotateState {
    isRotating: boolean;
    id: string | null;
    startAngle: number;
    startRotation: number;
    centerX: number;
    centerY: number;
  }

  interface SubtitleResizeState {
    isResizing: boolean;
    side: 'left' | 'right' | null;
    startX: number;
    startWidth: number; // Width as percentage (maxWidth)
  }

  const props = withDefaults(
    defineProps<{
      videoSrc: string | null;
      currentTime: number;
      effectiveTime: number; // Time position accounting for segment cuts
      isPlaying: boolean;
      clipStart: number;
      clipEnd: number;
      textOverlays: TextOverlay[];
      stickers: Sticker[];
      watermarks?: ClipWatermark[];
      filterSettings: FilterSettings | null;
      segments?: SegmentInput[];
      previewAspectRatio: string; // Currently previewed aspect ratio (e.g., "16:9")
      selectedAspectRatios: string[]; // All selected aspect ratios
      framingConfigs: ManualFramingConfigs; // Framing configurations per aspect ratio
      // Subtitle settings
      subtitleSettings?: ClipSubtitleSettings | null;
      transcriptWords?: WordInfo[]; // Words from transcript for subtitle display
      transcriptSegments?: WhisperSegment[]; // Segments from transcript for word grouping
    }>(),
    {
      watermarks: () => [],
      subtitleSettings: null,
      transcriptWords: () => [],
      transcriptSegments: () => [],
    }
  );

  const emit = defineEmits<{
    (e: 'timeUpdate', time: number): void;
    (e: 'togglePlay'): void;
    (e: 'videoElementReady', element: HTMLVideoElement): void;
    (
      e: 'updateOverlayPosition',
      type: 'text' | 'sticker' | 'watermark',
      id: string,
      position: { x: number; y: number }
    ): void;
    (e: 'updateOverlayWidth', id: string, width: number): void;
    (e: 'updateStickerScale', id: string, scale: number): void;
    (e: 'updateStickerRotation', id: string, rotation: number): void;
    (e: 'updateWatermarkScale', id: string, scale: number): void;
    (e: 'update:previewAspectRatio', ratio: string): void;
    (e: 'updateSubtitlePosition', position: { x: number; y: number }): void;
    (e: 'updateSubtitleMaxWidth', maxWidth: number): void;
  }>();

  // Refs
  const videoRef = ref<HTMLVideoElement | null>(null);
  const videoContainerRef = ref<HTMLElement | null>(null);
  const overlayContainerRef = ref<HTMLElement | null>(null);
  const regionVideoRefs = ref<(HTMLVideoElement | null)[]>([]);
  const duration = ref(0);
  const volume = ref(1);
  const isMuted = ref(false);
  const isDraggingProgress = ref(false);
  const containerSize = ref({ width: 0, height: 0 });

  // Track actual image dimensions for stickers (stickerId -> {width, height})
  const stickerImageDimensions = ref<Record<string, { width: number; height: number }>>({});

  // Store time to restore after aspect ratio switch
  const pendingSeekTime = ref<number | null>(null);

  // Set region video ref
  function setRegionVideoRef(index: number, el: HTMLVideoElement | null) {
    if (el) {
      regionVideoRefs.value[index] = el;
      // Set initial time to match main video
      if (videoRef.value) {
        el.currentTime = videoRef.value.currentTime;
      }
    }
  }

  // Handle region video loaded - sync time and play state
  function onRegionVideoLoaded(event: Event) {
    const regionVideo = event.target as HTMLVideoElement;
    if (!regionVideo || !videoRef.value) return;

    // Sync time with main video
    regionVideo.currentTime = videoRef.value.currentTime;

    // If main video is playing, start playing this region video too
    if (!videoRef.value.paused) {
      regionVideo.play().catch(() => {});
    }
  }

  // Get style for single region video (uses main video element directly - no sync needed)
  function getSingleRegionVideoStyle(): Record<string, string> {
    const region = currentFramingConfig.value?.regions?.[0];
    if (!region) return { display: 'none' };

    const filterStyle = getVideoFilterStyle();

    // Guard against invalid dimensions
    if (!region.source.width || !region.source.height) {
      return { display: 'none' };
    }

    // Same calculation as getCroppedVideoStyle
    const scaleX = 100 / region.source.width;
    const scaleY = 100 / region.source.height;
    const offsetX = -region.source.x * scaleX;
    const offsetY = -region.source.y * scaleY;

    return {
      width: `${scaleX}%`,
      height: `${scaleY}%`,
      left: `${offsetX}%`,
      top: `${offsetY}%`,
      objectFit: 'fill',
      filter: filterStyle.filter || 'none',
    };
  }

  // Sync region videos with main video - only called on seek/play/pause, not continuously
  // Continuous syncing causes lag due to multiple video decoding
  function syncRegionVideos(forceTimeSync: boolean = false) {
    if (!videoRef.value) return;
    const mainVideo = videoRef.value;
    const currentTime = mainVideo.currentTime;
    const isPaused = mainVideo.paused;

    regionVideoRefs.value.forEach((regionVideo) => {
      if (regionVideo && regionVideo.readyState >= 1) {
        // Only sync time when explicitly requested (on seek) or if significantly out of sync
        const timeDiff = Math.abs(regionVideo.currentTime - currentTime);
        if (forceTimeSync || timeDiff > 0.5) {
          regionVideo.currentTime = currentTime;
        }

        // Sync play state
        if (isPaused) {
          if (!regionVideo.paused) {
            regionVideo.pause();
          }
        } else {
          if (regionVideo.paused) {
            regionVideo.play().catch(() => {});
          }
        }
      }
    });
  }

  // Unified sync function - only needed for multi-region mode now
  // Single region uses the main video directly, no sync needed
  function syncAllPreviewVideos(forceTimeSync: boolean = false) {
    if (!showFramedPreview.value || !videoRef.value) return;

    // Only sync if multi-region mode (single region uses main video directly)
    if (!isSingleRegion.value) {
      syncRegionVideos(forceTimeSync);
    }
  }

  // No longer using animation frame loop - too expensive with multiple videos
  function startSyncLoop() {
    // Just do an initial sync, don't start continuous loop
    syncAllPreviewVideos(true);
  }

  function stopSyncLoop() {
    // No-op now, kept for compatibility
  }

  // Drag state
  const dragState = reactive<DragState>({
    isDragging: false,
    type: null,
    id: null,
    startX: 0,
    startY: 0,
    startPosition: { x: 0, y: 0 },
  });

  // Resize state for text overlay width handles
  const resizeState = reactive<ResizeState>({
    isResizing: false,
    id: null,
    side: null,
    startX: 0,
    startWidth: 0,
    startPositionX: 0,
  });

  // Sticker resize state (for scale)
  const stickerResizeState = reactive<StickerResizeState>({
    isResizing: false,
    id: null,
    centerX: 0,
    centerY: 0,
    startDistance: 0,
    startScale: 1,
  });

  // Sticker rotate state
  const stickerRotateState = reactive<StickerRotateState>({
    isRotating: false,
    id: null,
    startAngle: 0,
    startRotation: 0,
    centerX: 0,
    centerY: 0,
  });

  // Local sticker scale/rotation tracking for instant feedback during drag
  const localStickerScales = ref<Record<string, number>>({});
  const localStickerRotations = ref<Record<string, number>>({});

  // Watermark resize state (for scale)
  const watermarkResizeState = reactive<WatermarkResizeState>({
    isResizing: false,
    id: null,
    centerX: 0,
    centerY: 0,
    startDistance: 0,
    startScale: 1,
  });

  // Track actual image dimensions for watermarks (watermarkId -> {width, height})
  const watermarkImageDimensions = ref<Record<string, { width: number; height: number }>>({});

  // Local watermark scale tracking for instant feedback during drag
  const localWatermarkScales = ref<Record<string, number>>({});

  // Subtitle resize state (for maxWidth)
  const subtitleResizeState = reactive<SubtitleResizeState>({
    isResizing: false,
    side: null,
    startX: 0,
    startWidth: 90,
  });

  // Local subtitle maxWidth tracking for instant feedback during resize
  const localSubtitleMaxWidth = ref<number | null>(null);

  // Local width tracking to prevent reflow during drag (before Vue updates)
  const localDragWidths = ref<Record<string, number>>({});

  // Computed
  // Get sorted segments for playback control
  const sortedSegments = computed(() => {
    if (!props.segments || props.segments.length === 0) {
      return [{ start_time: props.clipStart, end_time: props.clipEnd }];
    }
    return [...props.segments].sort((a, b) => a.start_time - b.start_time);
  });

  const visibleTextOverlays = computed(() => {
    // Use effective time (accounts for segment cuts) for visibility
    const effectiveTime = props.effectiveTime;
    return props.textOverlays.filter((o) => effectiveTime >= o.startTime && effectiveTime <= o.endTime);
  });

  const visibleStickers = computed(() => {
    // Use effective time (accounts for segment cuts) for visibility
    const effectiveTime = props.effectiveTime;
    return props.stickers.filter((s) => effectiveTime >= s.startTime && effectiveTime <= s.endTime);
  });

  // Get visible watermarks for current time
  const visibleWatermarks = computed(() => {
    // Use effective time (accounts for segment cuts) for visibility
    const effectiveTime = props.effectiveTime;
    return (props.watermarks || []).filter((w) => effectiveTime >= w.startTime && effectiveTime <= w.endTime);
  });

  // Calculate max words based on aspect ratio (matches VideoPlayer)
  const maxWordsForAspectRatio = computed(() => {
    // Parse preview aspect ratio (e.g., "16:9" -> 16/9)
    const parts = props.previewAspectRatio.split(':').map(Number);
    const aspectRatioValue = parts.length === 2 && parts[1] !== 0 ? parts[0] / parts[1] : 16 / 9;

    if (aspectRatioValue > 1.5) {
      return 6; // wide formats (16:9, 21:9)
    } else if (aspectRatioValue > 0.9) {
      return 4; // squarish (1:1, 4:3)
    } else {
      return 3; // vertical (9:16, 4:5)
    }
  });

  // Find the current whisper segment (matches VideoPlayer)
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

  // Get all words from the current segment (matches VideoPlayer)
  const segmentWords = computed((): WordInfo[] => {
    if (!currentSegment.value) return [];

    // If segment has words attached, use those
    if (currentSegment.value.words && currentSegment.value.words.length > 0) {
      return currentSegment.value.words;
    }

    // Otherwise, filter from all transcript words
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

  // Get visible words (chunked display - matches VideoPlayer)
  const visibleSubtitleWords = computed((): WordInfo[] => {
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
  function isCurrentWord(word: { start: number; end: number }): boolean {
    const time = props.currentTime || 0;
    return time >= word.start && time <= word.end;
  }

  // Get the animation class based on animation style
  const getSubtitleAnimationClass = computed(() => {
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
  function getTypewriterStyle(word: { start: number; end: number }): Record<string, string> {
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
  function getWordAnimationDuration(word: { start: number; end: number }): number {
    const wordDuration = word.end - word.start;

    // For very short words (under 50ms), use instant transition
    if (wordDuration < 0.05) return 0;
    // For short words (50-100ms), use 30% of duration
    if (wordDuration < 0.1) return wordDuration * 0.3;
    // For medium words (100-200ms), use 35% of duration
    if (wordDuration < 0.2) return wordDuration * 0.35;
    // For normal words (200-400ms), use 40% of duration
    if (wordDuration < 0.4) return wordDuration * 0.4;
    // For longer words (400ms+), use 45% but cap at 200ms
    const calculatedDuration = wordDuration * 0.45;
    return Math.min(0.2, calculatedDuration);
  }

  // Calculate word gap (spacing between words) - matches VideoPlayer implementation
  const wordGapStyle = computed(() => {
    if (!props.subtitleSettings) return '0.35em';
    const wordSpacing = props.subtitleSettings.wordSpacing || 0.35;
    return `${wordSpacing}em`;
  });

  // Scaled font size for SVG text
  const scaledFontSize = computed(() => {
    const fontSize = subtitleFontSizeForRatio.value;
    return Math.round(fontSize * overlayScaleFactor.value);
  });

  // Scaled letter spacing for SVG text
  const scaledLetterSpacing = computed(() => {
    if (!props.subtitleSettings) return 0;
    return (props.subtitleSettings.letterSpacing || 0) * overlayScaleFactor.value;
  });

  // Style for hidden sizing span
  const getWordTextStyle = computed(() => {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;

    return {
      color: settings.textColor,
      fontFamily: `"${settings.fontFamily}", Arial, sans-serif`,
      fontWeight: String(settings.fontWeight),
      fontSize: `${scaledFontSize.value}px`,
      letterSpacing: `${scaledLetterSpacing.value}px`,
    };
  });

  // Get subtitle container style (position, width, background)
  function getSubtitleContainerStyle(): Record<string, string> {
    if (!props.subtitleSettings) return {};

    const settings = props.subtitleSettings;
    const position = subtitlePositionForRatio.value;
    const scale = overlayScaleFactor.value;

    // Calculate scaled values
    const scaledPadding = Math.round((settings.padding || 0) * scale);
    const scaledBorderRadius = Math.round((settings.borderRadius || 0) * scale);
    const scaledLineHeight = settings.lineHeight || 1.2;

    // Use local maxWidth during resize for instant feedback, otherwise use per-ratio config
    const maxWidth = localSubtitleMaxWidth.value ?? subtitleMaxWidthForRatio.value;

    // Determine text alignment for flex justify-content
    let justifyContent = 'center';
    if (settings.textAlign === 'left') justifyContent = 'flex-start';
    else if (settings.textAlign === 'right') justifyContent = 'flex-end';

    const baseStyles: Record<string, string> = {
      top: `${position.y}%`,
      left: `${position.x}%`,
      transform: 'translate(-50%, -50%)',
      width: `${maxWidth}%`,
      display: 'flex',
      justifyContent,
      alignItems: 'center',
      lineHeight: String(scaledLineHeight),
      textAlign: settings.textAlign,
    };

    // Add background styles if enabled
    if (settings.backgroundEnabled) {
      baseStyles.backgroundColor = settings.backgroundColor || '#000000';
      baseStyles.padding = `${scaledPadding}px`;
      baseStyles.borderRadius = `${scaledBorderRadius}px`;
    }

    return baseStyles;
  }

  // Get subtitle text container style (inner flex container for word alignment)
  function getSubtitleTextContainerStyle(): Record<string, string> {
    if (!props.subtitleSettings) return { gap: wordGapStyle.value };

    const settings = props.subtitleSettings;

    // Determine text alignment for flex justify-content
    let justifyContent = 'center';
    if (settings.textAlign === 'left') justifyContent = 'flex-start';
    else if (settings.textAlign === 'right') justifyContent = 'flex-end';

    return {
      gap: wordGapStyle.value,
      justifyContent,
    };
  }

  // Get subtitle position for current aspect ratio
  const subtitlePositionForRatio = computed(() => {
    if (!props.subtitleSettings) {
      return { x: 50, y: 85 };
    }

    const ratio = props.previewAspectRatio;
    const ratioConfig = props.subtitleSettings.perRatioConfigs?.[ratio];

    if (ratioConfig?.position) {
      return ratioConfig.position;
    }

    return {
      x: props.subtitleSettings.positionX,
      y: props.subtitleSettings.positionY,
    };
  });

  // Get subtitle font size for current aspect ratio
  const subtitleFontSizeForRatio = computed(() => {
    if (!props.subtitleSettings) {
      return 32;
    }

    const ratio = props.previewAspectRatio;
    const ratioConfig = props.subtitleSettings.perRatioConfigs?.[ratio];

    if (ratioConfig?.fontSize) {
      return ratioConfig.fontSize;
    }

    return props.subtitleSettings.fontSize;
  });

  // Get subtitle max width for current aspect ratio
  const subtitleMaxWidthForRatio = computed(() => {
    if (!props.subtitleSettings) {
      return 90;
    }

    const ratio = props.previewAspectRatio;
    const ratioConfig = props.subtitleSettings.perRatioConfigs?.[ratio];

    if (ratioConfig?.maxWidth !== undefined) {
      return ratioConfig.maxWidth;
    }

    return props.subtitleSettings.maxWidth;
  });

  // Get watermark config for current aspect ratio
  function getWatermarkConfigForRatio(watermark: ClipWatermark): WatermarkRatioConfig {
    const ratio = props.previewAspectRatio;
    const perRatioConfig = watermark.perRatioConfigs?.[ratio];

    if (perRatioConfig) {
      return perRatioConfig;
    }

    // Fall back to default values
    return {
      position: watermark.position,
      scale: watermark.scale,
      opacity: watermark.opacity,
    };
  }

  // Handle watermark image load to capture actual dimensions
  function onWatermarkImageLoad(watermarkId: string, event: Event) {
    const img = event.target as HTMLImageElement;
    if (img && img.naturalWidth && img.naturalHeight) {
      watermarkImageDimensions.value[watermarkId] = {
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    }
  }

  // Base width for watermarks = 15% of 1080p height = 162px (matching export default)
  const WATERMARK_BASE_WIDTH = 162;

  // Get the wrapper style for watermark positioning (no scale)
  function getWatermarkWrapperStyle(watermark: ClipWatermark): Record<string, string> {
    const config = getWatermarkConfigForRatio(watermark);
    return {
      left: `${config.position.x}%`,
      top: `${config.position.y}%`,
      transform: 'translate(-50%, -50%)',
      opacity: String(config.opacity / 100),
    };
  }

  // Get the content style for watermark scaling
  function getWatermarkContentStyle(watermark: ClipWatermark): Record<string, string> {
    const config = getWatermarkConfigForRatio(watermark);
    // Use local value during drag for instant feedback
    const watermarkScale = localWatermarkScales.value[watermark.id] ?? config.scale / 15; // Convert from percentage to multiplier

    return {
      transform: `scale(${watermarkScale})`,
    };
  }

  // Get the style for watermark image (scales width to base size, height auto)
  function getWatermarkImageStyle(watermark: ClipWatermark): Record<string, string> {
    const containerScale = overlayScaleFactor.value;
    // Base width at current container scale
    const baseWidth = WATERMARK_BASE_WIDTH * containerScale;

    // Get cached dimensions for this watermark
    const dims = watermarkImageDimensions.value[watermark.id];

    if (dims) {
      // Scale width to baseWidth, calculate height to maintain aspect ratio
      const aspectRatio = dims.width / dims.height;
      const width = baseWidth;
      const height = baseWidth / aspectRatio;

      return {
        width: `${width}px`,
        height: `${height}px`,
      };
    }

    // Fallback before image loads
    return {
      width: `${baseWidth}px`,
      height: 'auto',
    };
  }

  // Calculate the bounding box size in pixels for a watermark
  function getWatermarkBoundsPx(watermark: ClipWatermark): { width: number; height: number } {
    const config = getWatermarkConfigForRatio(watermark);
    const containerScale = overlayScaleFactor.value;
    const watermarkScale = localWatermarkScales.value[watermark.id] ?? config.scale / 15;

    const dims = watermarkImageDimensions.value[watermark.id];
    const baseWidth = WATERMARK_BASE_WIDTH * containerScale;

    if (dims) {
      const aspectRatio = dims.width / dims.height;
      const width = baseWidth * watermarkScale;
      const height = (baseWidth / aspectRatio) * watermarkScale;

      return { width, height };
    }

    // Fallback before image loads (assume square)
    return { width: baseWidth * watermarkScale, height: baseWidth * watermarkScale };
  }

  // Get the style for the selection border that surrounds the scaled watermark
  function getWatermarkBoundsStyle(watermark: ClipWatermark): Record<string, string> {
    const bounds = getWatermarkBoundsPx(watermark);
    const padding = 2; // Tight padding around content

    return {
      width: `${bounds.width + padding * 2}px`,
      height: `${bounds.height + padding * 2}px`,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  // Get the style for corner resize handles
  function getWatermarkResizeHandleStyle(
    watermark: ClipWatermark,
    corner: 'nw' | 'ne' | 'sw' | 'se'
  ): Record<string, string> {
    const bounds = getWatermarkBoundsPx(watermark);
    const halfW = bounds.width / 2;
    const halfH = bounds.height / 2;

    // Corner offsets relative to center
    const cornerOffsets: Record<string, { x: number; y: number }> = {
      nw: { x: -halfW, y: -halfH },
      ne: { x: halfW, y: -halfH },
      sw: { x: -halfW, y: halfH },
      se: { x: halfW, y: halfH },
    };

    const offset = cornerOffsets[corner];

    return {
      left: `calc(50% + ${offset.x}px)`,
      top: `calc(50% + ${offset.y}px)`,
      transform: 'translate(-50%, -50%)',
    };
  }

  // Helper to start watermark drag (position)
  function startWatermarkDrag(e: MouseEvent, watermark: ClipWatermark) {
    const config = getWatermarkConfigForRatio(watermark);
    startDrag(e, 'watermark', watermark.id, config.position);
  }

  // Watermark resize handlers (for scale) - uses distance from center for intuitive resizing
  function startWatermarkResize(e: MouseEvent, watermark: ClipWatermark) {
    e.preventDefault();
    e.stopPropagation();

    // Get the watermark element to find its center
    const watermarkEl = (e.target as HTMLElement).closest('[data-watermark-id]') as HTMLElement;
    if (!watermarkEl) return;

    const rect = watermarkEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate initial distance from center to mouse
    const startDistance = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));

    const config = getWatermarkConfigForRatio(watermark);

    watermarkResizeState.isResizing = true;
    watermarkResizeState.id = watermark.id;
    watermarkResizeState.centerX = centerX;
    watermarkResizeState.centerY = centerY;
    watermarkResizeState.startDistance = startDistance;
    watermarkResizeState.startScale = config.scale / 15; // Convert from percentage to multiplier

    document.addEventListener('mousemove', onWatermarkResizeMove);
    document.addEventListener('mouseup', onWatermarkResizeEnd);
  }

  function onWatermarkResizeMove(e: MouseEvent) {
    if (!watermarkResizeState.isResizing || !watermarkResizeState.id) return;

    // Calculate current distance from center to mouse
    const currentDistance = Math.sqrt(
      Math.pow(e.clientX - watermarkResizeState.centerX, 2) + Math.pow(e.clientY - watermarkResizeState.centerY, 2)
    );

    // Scale is proportional to distance ratio
    const distanceRatio =
      watermarkResizeState.startDistance > 0 ? currentDistance / watermarkResizeState.startDistance : 1;

    let newScaleMultiplier = watermarkResizeState.startScale * distanceRatio;

    // Clamp scale multiplier to reasonable bounds (0.2x to 5x)
    newScaleMultiplier = Math.max(0.2, Math.min(5, newScaleMultiplier));

    // Convert back to percentage for storage (multiply by 15 to get back to percentage scale)
    const newScalePercent = Math.round(newScaleMultiplier * 15);

    // Set local scale immediately for instant feedback
    localWatermarkScales.value[watermarkResizeState.id] = newScaleMultiplier;

    // Emit scale update
    emit('updateWatermarkScale', watermarkResizeState.id, newScalePercent);
  }

  function onWatermarkResizeEnd() {
    if (watermarkResizeState.id) {
      // Clear local scale after emit completes
      delete localWatermarkScales.value[watermarkResizeState.id];
    }

    watermarkResizeState.isResizing = false;
    watermarkResizeState.id = null;

    document.removeEventListener('mousemove', onWatermarkResizeMove);
    document.removeEventListener('mouseup', onWatermarkResizeEnd);
  }

  // Start subtitle drag
  function startSubtitleDrag(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();

    const position = subtitlePositionForRatio.value;

    dragState.isDragging = true;
    dragState.type = 'subtitle';
    dragState.id = 'subtitle';
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    dragState.startPosition = { ...position };

    document.addEventListener('mousemove', onSubtitleDragMove);
    document.addEventListener('mouseup', onSubtitleDragEnd);
  }

  function onSubtitleDragMove(e: MouseEvent) {
    if (!dragState.isDragging || dragState.type !== 'subtitle' || !overlayContainerRef.value) return;

    const container = overlayContainerRef.value;
    const rect = container.getBoundingClientRect();

    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;

    let newX = dragState.startPosition.x + deltaXPercent;
    let newY = dragState.startPosition.y + deltaYPercent;

    // Clamp to bounds
    newX = Math.max(5, Math.min(95, newX));
    newY = Math.max(5, Math.min(95, newY));

    emit('updateSubtitlePosition', { x: newX, y: newY });
  }

  function onSubtitleDragEnd() {
    dragState.isDragging = false;
    dragState.type = null;
    dragState.id = null;

    document.removeEventListener('mousemove', onSubtitleDragMove);
    document.removeEventListener('mouseup', onSubtitleDragEnd);
  }

  // Subtitle resize handlers (for maxWidth)
  function startSubtitleResize(e: MouseEvent, side: 'left' | 'right') {
    e.preventDefault();
    e.stopPropagation();

    if (!props.subtitleSettings) return;

    subtitleResizeState.isResizing = true;
    subtitleResizeState.side = side;
    subtitleResizeState.startX = e.clientX;
    subtitleResizeState.startWidth = localSubtitleMaxWidth.value ?? subtitleMaxWidthForRatio.value;

    document.addEventListener('mousemove', onSubtitleResizeMove);
    document.addEventListener('mouseup', onSubtitleResizeEnd);
  }

  function onSubtitleResizeMove(e: MouseEvent) {
    if (!subtitleResizeState.isResizing || !overlayContainerRef.value) return;

    const container = overlayContainerRef.value;
    const rect = container.getBoundingClientRect();

    // Calculate delta in percentage
    const deltaX = e.clientX - subtitleResizeState.startX;
    const deltaXPercent = (deltaX / rect.width) * 100;

    let newWidth: number;

    if (subtitleResizeState.side === 'right') {
      // Dragging right handle: increase width when moving right
      newWidth = subtitleResizeState.startWidth + deltaXPercent * 2; // *2 because we're resizing from center
    } else {
      // Dragging left handle: increase width when moving left
      newWidth = subtitleResizeState.startWidth - deltaXPercent * 2; // *2 because we're resizing from center
    }

    // Clamp width to reasonable bounds (20% to 100%)
    newWidth = Math.max(20, Math.min(100, newWidth));

    // Set local width immediately for instant feedback
    localSubtitleMaxWidth.value = newWidth;

    // Emit width update
    emit('updateSubtitleMaxWidth', Math.round(newWidth));
  }

  function onSubtitleResizeEnd() {
    // Clear local width after emit completes
    localSubtitleMaxWidth.value = null;

    subtitleResizeState.isResizing = false;
    subtitleResizeState.side = null;

    document.removeEventListener('mousemove', onSubtitleResizeMove);
    document.removeEventListener('mouseup', onSubtitleResizeEnd);
  }

  // Generate a default center-crop region for an aspect ratio
  function generateDefaultCenterCrop(targetRatio: string): {
    source: { x: number; y: number; width: number; height: number };
    output: { x: number; y: number; width: number; height: number };
    id: string;
  } {
    const { width: targetW, height: targetH } = parseAspectRatio(targetRatio);
    const targetAspect = targetW / targetH;

    // Source is 16:9
    const sourceAspect = 16 / 9;

    let sourceWidth: number, sourceHeight: number;

    if (targetAspect > sourceAspect) {
      // Target is wider than source - fit to width, crop top/bottom
      sourceWidth = 1;
      sourceHeight = sourceAspect / targetAspect;
    } else {
      // Target is taller than source - fit to height, crop left/right
      sourceHeight = 1;
      sourceWidth = targetAspect / sourceAspect;
    }

    // Center the crop
    const sourceX = (1 - sourceWidth) / 2;
    const sourceY = (1 - sourceHeight) / 2;

    return {
      id: 'default-center-crop',
      source: {
        x: sourceX,
        y: sourceY,
        width: sourceWidth,
        height: sourceHeight,
      },
      output: {
        x: 0,
        y: 0,
        width: 1,
        height: 1,
      },
    };
  }

  // Get current framing config for the selected aspect ratio
  const currentFramingConfig = computed(() => {
    if (props.previewAspectRatio === '16:9') return null;

    // Check if this aspect ratio is selected
    const isSelected = props.selectedAspectRatios.includes(props.previewAspectRatio);
    if (!isSelected) return null;

    // Check if there's a manual config with regions
    const manualConfig = props.framingConfigs[props.previewAspectRatio as keyof ManualFramingConfigs];
    if (manualConfig && manualConfig.regions && manualConfig.regions.length > 0) {
      return manualConfig;
    }

    // Generate a default center-crop preview for auto mode or unconfigured manual mode
    return {
      mode: 'auto' as const,
      regions: [generateDefaultCenterCrop(props.previewAspectRatio)],
      targetAspectRatio: props.previewAspectRatio,
      sourceAspectRatio: '16:9',
    };
  });

  // Check if we should show framed preview (actual export result)
  const showFramedPreview = computed(() => {
    return (
      currentFramingConfig.value !== null &&
      currentFramingConfig.value.regions &&
      currentFramingConfig.value.regions.length > 0
    );
  });

  // Check if this is a single region layout (can use optimized single video approach)
  const isSingleRegion = computed(() => {
    return currentFramingConfig.value?.regions?.length === 1;
  });

  // Parse aspect ratio string to get width/height ratio
  function parseAspectRatio(ratio: string): { width: number; height: number } {
    const [w, h] = ratio.split(':').map(Number);
    return { width: w || 16, height: h || 9 };
  }

  // Get the framed container style (maintains target aspect ratio)
  function getFramedContainerStyle(): Record<string, string> {
    // Use cached container size to avoid layout thrashing
    const { width: containerWidth, height: containerHeight } = containerSize.value;
    if (containerWidth === 0 || containerHeight === 0) {
      return { width: '100%', height: '100%' };
    }

    const { width: ratioW, height: ratioH } = parseAspectRatio(props.previewAspectRatio);
    const targetAspect = ratioW / ratioH;
    const containerAspect = containerWidth / containerHeight;

    let width: number, height: number;

    if (containerAspect > targetAspect) {
      // Container is wider than target - fit to height
      height = containerHeight;
      width = height * targetAspect;
    } else {
      // Container is taller than target - fit to width
      width = containerWidth;
      height = width / targetAspect;
    }

    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  }

  // Get style for a region's output position in the framed container
  function getRegionOutputStyle(region: {
    output: { x: number; y: number; width: number; height: number };
  }): Record<string, string> {
    return {
      left: `${region.output.x * 100}%`,
      top: `${region.output.y * 100}%`,
      width: `${region.output.width * 100}%`,
      height: `${region.output.height * 100}%`,
    };
  }

  // Calculate the cropped video style to show only the source selection
  // EXACT copy of POI editor's getCroppedImageStyle function
  // The media is scaled up so the source crop fills the output container,
  // then positioned so the crop area aligns with the container's top-left
  function getCroppedVideoStyle(region: {
    source: { x: number; y: number; width: number; height: number };
  }): Record<string, string> {
    const filterStyle = getVideoFilterStyle();

    // Guard against invalid dimensions
    if (!region.source.width || !region.source.height) {
      return { display: 'none' };
    }

    // Calculate scale factors - how much to scale the full media
    // so that the source crop area fills the container (100%)
    const scaleX = 100 / region.source.width;
    const scaleY = 100 / region.source.height;

    // Calculate position - offset the media so the crop area starts at 0,0
    // The offset needs to account for the scaled size
    const offsetX = -region.source.x * scaleX;
    const offsetY = -region.source.y * scaleY;

    return {
      width: `${scaleX}%`,
      height: `${scaleY}%`,
      left: `${offsetX}%`,
      top: `${offsetY}%`,
      objectFit: 'fill', // Force video/image to fill exact dimensions, ignoring aspect ratio
      filter: filterStyle.filter || 'none',
    };
  }

  // Get overlay container position style (matches the framed container or video)
  function getOverlayContainerPositionStyle(): Record<string, string> {
    if (showFramedPreview.value) {
      // Match the framed container dimensions and center it
      const frameStyle = getFramedContainerStyle();
      return {
        ...frameStyle,
        left: '50%',
        top: '50%',
        transform: 'translate(-50%, -50%)',
      };
    }

    // Non-framed mode: Calculate actual video bounds within the container
    // The video uses object-contain, so it fits within container while maintaining aspect ratio
    const { width: containerWidth, height: containerHeight } = containerSize.value;
    if (containerWidth === 0 || containerHeight === 0 || !videoRef.value) {
      return { inset: '0' };
    }

    // Get the video's intrinsic aspect ratio
    const videoWidth = videoRef.value.videoWidth || 1920;
    const videoHeight = videoRef.value.videoHeight || 1080;
    const videoAspect = videoWidth / videoHeight;
    const containerAspect = containerWidth / containerHeight;

    let displayWidth: number, displayHeight: number;

    if (containerAspect > videoAspect) {
      // Container is wider than video - video is constrained by height
      displayHeight = containerHeight;
      displayWidth = displayHeight * videoAspect;
    } else {
      // Container is taller than video - video is constrained by width
      displayWidth = containerWidth;
      displayHeight = displayWidth / videoAspect;
    }

    return {
      width: `${displayWidth}px`,
      height: `${displayHeight}px`,
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
    };
  }

  // Drag methods
  function startDrag(
    e: MouseEvent,
    type: 'text' | 'sticker' | 'watermark',
    id: string,
    position: { x: number; y: number }
  ) {
    e.preventDefault();
    e.stopPropagation();

    // For text overlays, capture and lock the current width to prevent auto-resizing during drag
    if (type === 'text' && overlayContainerRef.value) {
      const overlay = props.textOverlays.find((o) => o.id === id);
      if (overlay) {
        const config = getOverlayConfigForRatio(overlay);
        // Only capture width if not already explicitly set
        if (config.style?.width === undefined || config.style.width <= 0) {
          const overlayEl = overlayContainerRef.value.querySelector(`[data-overlay-id="${id}"]`) as HTMLElement;
          if (overlayEl) {
            const containerRect = overlayContainerRef.value.getBoundingClientRect();
            const capturedWidth = (overlayEl.offsetWidth / containerRect.width) * 100;
            // Set local width immediately to prevent reflow during drag
            localDragWidths.value[id] = capturedWidth;
            // Also emit width update to persist it
            emit('updateOverlayWidth', id, capturedWidth);
          }
        }
      }
    }

    dragState.isDragging = true;
    dragState.type = type;
    dragState.id = id;
    dragState.startX = e.clientX;
    dragState.startY = e.clientY;
    dragState.startPosition = { ...position };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    if (!dragState.isDragging || !overlayContainerRef.value) return;

    const container = overlayContainerRef.value;
    const rect = container.getBoundingClientRect();

    // Calculate delta in pixels
    const deltaX = e.clientX - dragState.startX;
    const deltaY = e.clientY - dragState.startY;

    // Convert to percentage
    const deltaXPercent = (deltaX / rect.width) * 100;
    const deltaYPercent = (deltaY / rect.height) * 100;

    // Calculate new position
    let newX = dragState.startPosition.x + deltaXPercent;
    let newY = dragState.startPosition.y + deltaYPercent;

    // Clamp to bounds (allow some overflow for edge positioning)
    newX = Math.max(-10, Math.min(110, newX));
    newY = Math.max(-10, Math.min(110, newY));

    // Emit position update (only for text, sticker, watermark - subtitle has its own handler)
    if (dragState.type && dragState.id && dragState.type !== 'subtitle') {
      emit('updateOverlayPosition', dragState.type, dragState.id, { x: newX, y: newY });
    }
  }

  function onDragEnd() {
    dragState.isDragging = false;
    dragState.type = null;
    dragState.id = null;

    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  // Resize handlers for text overlay width
  function startResize(e: MouseEvent, overlayId: string, side: 'left' | 'right') {
    e.preventDefault();
    e.stopPropagation();

    const overlay = props.textOverlays.find((o) => o.id === overlayId);
    if (!overlay || !overlayContainerRef.value) return;

    const config = getOverlayConfigForRatio(overlay);
    const currentStyle = config.style;

    // Get current width - use explicit width or calculate from element
    let currentWidth = currentStyle?.width;
    if (currentWidth === undefined || currentWidth <= 0) {
      // Calculate initial width from the element's actual rendered size
      const overlayEl = overlayContainerRef.value.querySelector(`[data-overlay-id="${overlayId}"]`) as HTMLElement;
      if (overlayEl) {
        const containerRect = overlayContainerRef.value.getBoundingClientRect();
        currentWidth = (overlayEl.offsetWidth / containerRect.width) * 100;
      } else {
        currentWidth = 30; // Default starting width
      }
    }

    resizeState.isResizing = true;
    resizeState.id = overlayId;
    resizeState.side = side;
    resizeState.startX = e.clientX;
    resizeState.startWidth = currentWidth;
    resizeState.startPositionX = config.position.x;

    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    if (!resizeState.isResizing || !overlayContainerRef.value || !resizeState.id) return;

    const container = overlayContainerRef.value;
    const rect = container.getBoundingClientRect();

    // Calculate delta in percentage
    const deltaX = e.clientX - resizeState.startX;
    const deltaXPercent = (deltaX / rect.width) * 100;

    let newWidth: number;

    if (resizeState.side === 'right') {
      // Dragging right handle: increase width when moving right
      newWidth = resizeState.startWidth + deltaXPercent * 2; // *2 because we're resizing from center
    } else {
      // Dragging left handle: increase width when moving left
      newWidth = resizeState.startWidth - deltaXPercent * 2; // *2 because we're resizing from center
    }

    // Clamp width to reasonable bounds (10% to 100%)
    newWidth = Math.max(10, Math.min(100, newWidth));

    // Set local width immediately for instant feedback
    localDragWidths.value[resizeState.id] = newWidth;

    // Emit width update to persist it
    emit('updateOverlayWidth', resizeState.id, newWidth);
  }

  function onResizeEnd() {
    resizeState.isResizing = false;
    resizeState.id = null;
    resizeState.side = null;

    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }

  // Helper to start sticker drag (position)
  function startStickerDrag(e: MouseEvent, sticker: Sticker) {
    const config = getStickerConfigForRatio(sticker);
    startDrag(e, 'sticker', sticker.id, config.position);
  }

  // Sticker resize handlers (for scale) - uses distance from center for intuitive resizing
  function startStickerResize(e: MouseEvent, sticker: Sticker) {
    e.preventDefault();
    e.stopPropagation();

    // Get the sticker element to find its center
    const stickerEl = (e.target as HTMLElement).closest('[data-sticker-id]') as HTMLElement;
    if (!stickerEl) return;

    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate initial distance from center to mouse
    const startDistance = Math.sqrt(Math.pow(e.clientX - centerX, 2) + Math.pow(e.clientY - centerY, 2));

    const config = getStickerConfigForRatio(sticker);

    stickerResizeState.isResizing = true;
    stickerResizeState.id = sticker.id;
    stickerResizeState.centerX = centerX;
    stickerResizeState.centerY = centerY;
    stickerResizeState.startDistance = startDistance;
    stickerResizeState.startScale = config.scale;

    document.addEventListener('mousemove', onStickerResizeMove);
    document.addEventListener('mouseup', onStickerResizeEnd);
  }

  function onStickerResizeMove(e: MouseEvent) {
    if (!stickerResizeState.isResizing || !stickerResizeState.id) return;

    // Calculate current distance from center to mouse
    const currentDistance = Math.sqrt(
      Math.pow(e.clientX - stickerResizeState.centerX, 2) + Math.pow(e.clientY - stickerResizeState.centerY, 2)
    );

    // Scale is proportional to distance ratio
    // When mouse moves further from center, scale increases
    const distanceRatio = stickerResizeState.startDistance > 0 ? currentDistance / stickerResizeState.startDistance : 1;

    let newScale = stickerResizeState.startScale * distanceRatio;

    // Only enforce minimum scale (0.1x), no maximum limit
    newScale = Math.max(0.1, newScale);

    // Set local scale immediately for instant feedback
    localStickerScales.value[stickerResizeState.id] = newScale;

    // Emit scale update
    emit('updateStickerScale', stickerResizeState.id, newScale);
  }

  function onStickerResizeEnd() {
    if (stickerResizeState.id) {
      // Clear local scale after emit completes
      delete localStickerScales.value[stickerResizeState.id];
    }

    stickerResizeState.isResizing = false;
    stickerResizeState.id = null;

    document.removeEventListener('mousemove', onStickerResizeMove);
    document.removeEventListener('mouseup', onStickerResizeEnd);
  }

  // Sticker rotation handlers
  function startStickerRotate(e: MouseEvent, stickerId: string, stickerEl: HTMLElement, currentRotation: number) {
    e.preventDefault();
    e.stopPropagation();

    // Get the center of the sticker element
    const rect = stickerEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate initial angle from center to mouse
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);

    stickerRotateState.isRotating = true;
    stickerRotateState.id = stickerId;
    stickerRotateState.startAngle = startAngle;
    stickerRotateState.startRotation = currentRotation;
    stickerRotateState.centerX = centerX;
    stickerRotateState.centerY = centerY;

    document.addEventListener('mousemove', onStickerRotateMove);
    document.addEventListener('mouseup', onStickerRotateEnd);
  }

  function onStickerRotateMove(e: MouseEvent) {
    if (!stickerRotateState.isRotating || !stickerRotateState.id) return;

    // Calculate current angle from center to mouse
    const currentAngle =
      Math.atan2(e.clientY - stickerRotateState.centerY, e.clientX - stickerRotateState.centerX) * (180 / Math.PI);

    // Calculate rotation delta
    const angleDelta = currentAngle - stickerRotateState.startAngle;
    // Apply delta - sticker rotates to follow the mouse movement
    let newRotation = stickerRotateState.startRotation + angleDelta;

    // Normalize rotation to -180 to 180 range
    while (newRotation > 180) newRotation -= 360;
    while (newRotation < -180) newRotation += 360;

    // Set local rotation immediately for instant feedback
    localStickerRotations.value[stickerRotateState.id] = newRotation;

    // Emit rotation update
    emit('updateStickerRotation', stickerRotateState.id, Math.round(newRotation));
  }

  function onStickerRotateEnd() {
    if (stickerRotateState.id) {
      // Clear local rotation after emit completes
      delete localStickerRotations.value[stickerRotateState.id];
    }

    stickerRotateState.isRotating = false;
    stickerRotateState.id = null;

    document.removeEventListener('mousemove', onStickerRotateMove);
    document.removeEventListener('mouseup', onStickerRotateEnd);
  }

  // Methods
  function formatDuration(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';

    const totalSeconds = Math.floor(seconds);

    if (totalSeconds < 60) {
      return `0:${totalSeconds.toString().padStart(2, '0')}`;
    } else if (totalSeconds < 3600) {
      const minutes = Math.floor(totalSeconds / 60);
      const remainingSeconds = totalSeconds % 60;
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const remainingSeconds = totalSeconds % 60;
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  function goToBeginning() {
    if (videoRef.value) {
      const firstSegment = sortedSegments.value[0];
      videoRef.value.currentTime = firstSegment?.start_time || props.clipStart;
      emit('timeUpdate', videoRef.value.currentTime);
      syncAllPreviewVideos(true);
    }
  }

  function onLoadedMetadata() {
    if (videoRef.value) {
      duration.value = videoRef.value.duration;

      // Check if we have a pending seek time from aspect ratio switch
      if (pendingSeekTime.value !== null) {
        videoRef.value.currentTime = pendingSeekTime.value;
        pendingSeekTime.value = null;
      } else {
        const firstSegment = sortedSegments.value[0];
        videoRef.value.currentTime = firstSegment?.start_time || props.clipStart;
      }

      // Update container size now that we know the video dimensions
      // This ensures the overlay container matches the video bounds
      updateContainerSize();

      emit('videoElementReady', videoRef.value);
    }
  }

  function onTimeUpdate() {
    if (videoRef.value && !isDraggingProgress.value) {
      const currentVideoTime = videoRef.value.currentTime;
      const segments = sortedSegments.value;

      let currentSegmentIndex = -1;
      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        if (currentVideoTime >= seg.start_time && currentVideoTime <= seg.end_time) {
          currentSegmentIndex = i;
          break;
        }
      }

      if (currentSegmentIndex >= 0) {
        emit('timeUpdate', currentVideoTime);
        // Note: sync is handled by the animation frame loop during playback
        return;
      }

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];

        if (currentVideoTime > seg.end_time) {
          const nextSegment = segments[i + 1];

          if (nextSegment) {
            if (currentVideoTime < nextSegment.start_time) {
              videoRef.value.currentTime = nextSegment.start_time;
              emit('timeUpdate', nextSegment.start_time);
              // Sync after segment jump
              syncAllPreviewVideos(true);
              return;
            }
          } else {
            videoRef.value.currentTime = segments[0].start_time;
            videoRef.value.pause();
            emit('timeUpdate', segments[0].start_time);
            // Sync after segment jump
            syncAllPreviewVideos(true);
            return;
          }
        }
      }

      if (currentVideoTime < segments[0].start_time) {
        videoRef.value.currentTime = segments[0].start_time;
        emit('timeUpdate', segments[0].start_time);
        // Sync after segment jump
        syncAllPreviewVideos(true);
        return;
      }

      emit('timeUpdate', currentVideoTime);
    }
  }

  function onEnded() {
    if (videoRef.value) {
      const firstSegment = sortedSegments.value[0];
      videoRef.value.currentTime = firstSegment?.start_time || props.clipStart;
    }
    // Sync after loop back
    syncAllPreviewVideos(true);
  }

  function onPlay() {
    // Sync region videos when main video plays (only for multi-region mode)
    // Single region uses main video directly, no sync needed
    if (showFramedPreview.value && !isSingleRegion.value) {
      syncRegionVideos(true);
    }
  }

  function onPause() {
    // Pause region videos when main video pauses (only for multi-region mode)
    if (showFramedPreview.value && !isSingleRegion.value) {
      syncRegionVideos(false);
    }
  }

  function onVideoClick() {
    // Only toggle play if we're not dragging an overlay
    if (!dragState.isDragging) {
      emit('togglePlay');
    }
  }

  function onOverlayContainerClick() {
    // Toggle play when clicking on empty space in overlay container
    if (!dragState.isDragging) {
      emit('togglePlay');
    }
  }

  function toggleMute() {
    if (videoRef.value) {
      isMuted.value = !isMuted.value;
      videoRef.value.muted = isMuted.value;
    }
  }

  function onVolumeChange(e: Event) {
    const target = e.target as HTMLInputElement;
    volume.value = parseFloat(target.value);
    if (videoRef.value) {
      videoRef.value.volume = volume.value;
      isMuted.value = volume.value === 0;
    }
  }

  // Get the position and style for a text overlay, respecting per-ratio configs
  function getOverlayConfigForRatio(overlay: TextOverlay): {
    position: { x: number; y: number };
    style: typeof overlay.style;
  } {
    const ratio = props.previewAspectRatio;
    const ratioConfig = overlay.perRatioConfigs?.[ratio];

    if (ratioConfig) {
      return {
        position: ratioConfig.position,
        style: ratioConfig.style,
      };
    }

    // Fallback to default position/style
    return {
      position: overlay.position,
      style: overlay.style,
    };
  }

  // Calculate overlay scale factor based on container height
  // All text overlay sizes are defined relative to a 1080p reference height
  // This ensures the preview matches what the export will look like
  const overlayScaleFactor = computed(() => {
    const { width: containerWidth, height: containerHeight } = containerSize.value;
    if (containerWidth === 0 || containerHeight === 0) return 1;

    let overlayHeight: number;

    if (showFramedPreview.value) {
      // In framed mode, use the framed container height
      const { width: ratioW, height: ratioH } = parseAspectRatio(props.previewAspectRatio);
      const targetAspect = ratioW / ratioH;
      const containerAspect = containerWidth / containerHeight;

      if (containerAspect > targetAspect) {
        overlayHeight = containerHeight;
      } else {
        overlayHeight = containerWidth / targetAspect;
      }
    } else {
      // In non-framed mode, calculate actual video display height
      const videoWidth = videoRef.value?.videoWidth || 1920;
      const videoHeight = videoRef.value?.videoHeight || 1080;
      const videoAspect = videoWidth / videoHeight;
      const containerAspect = containerWidth / containerHeight;

      if (containerAspect > videoAspect) {
        overlayHeight = containerHeight;
      } else {
        overlayHeight = containerWidth / videoAspect;
      }
    }

    // Scale relative to 1080p reference (same as subtitle scaling)
    // When overlay container is 1080px tall, scale is 1.0
    // When overlay container is 540px tall, scale is 0.5 (font appears half size)
    return overlayHeight / 1080;
  });

  function getTextOverlayStyle(overlay: TextOverlay): Record<string, string> {
    const config = getOverlayConfigForRatio(overlay);
    const overlayStyle = config.style;

    // Get the scale factor for this container size
    const scale = overlayScaleFactor.value;

    // Scale all size-related properties
    const scaledFontSize = Math.round((overlayStyle?.fontSize || 24) * scale);
    const scaledLetterSpacing = (overlayStyle?.letterSpacing || 0) * scale;
    const scaledPadding = Math.round((overlayStyle?.padding || 8) * scale);
    const scaledBorderRadius = Math.round((overlayStyle?.borderRadius || 4) * scale);
    const scaledBorderWidth = (overlayStyle?.border1Width || 0) * scale;
    const scaledShadowOffsetX = (overlayStyle?.shadowOffsetX || 2) * scale;
    const scaledShadowOffsetY = (overlayStyle?.shadowOffsetY || 2) * scale;
    const scaledShadowBlur = (overlayStyle?.shadowBlur || 4) * scale;
    const scaledStrokeWidth = (overlayStyle?.strokeWidth || 1) * scale;

    const style: Record<string, string> = {
      left: `${config.position.x}%`,
      top: `${config.position.y}%`,
      transform: 'translate(-50%, -50%)',
      fontFamily: overlayStyle?.fontFamily || 'sans-serif',
      fontSize: `${scaledFontSize}px`,
      fontWeight: String(overlayStyle?.fontWeight || 600),
      color: overlayStyle?.color || '#ffffff',
      textAlign: overlayStyle?.textAlign || 'center',
      lineHeight: String(overlayStyle?.lineHeight || 1.2),
      letterSpacing: `${scaledLetterSpacing}px`,
    };

    // Check for local drag width first (immediately applied to prevent reflow)
    const localWidth = localDragWidths.value[overlay.id];

    // Use explicit width if set (from style or local drag), otherwise use maxWidth for auto-sizing
    // When width is set, it prevents the text from resizing during drag
    if (localWidth !== undefined && localWidth > 0) {
      style.width = `${localWidth}%`;
      style.maxWidth = `${localWidth}%`;
    } else if (overlayStyle?.width !== undefined && overlayStyle.width > 0) {
      style.width = `${overlayStyle.width}%`;
      style.maxWidth = `${overlayStyle.width}%`;
    } else {
      style.maxWidth = `${overlayStyle?.maxWidth || 90}%`;
      // Use fit-content for auto-sizing when no explicit width is set
      style.width = 'fit-content';
    }

    if (overlayStyle?.backgroundEnabled && overlayStyle?.backgroundColor) {
      style.backgroundColor = overlayStyle.backgroundColor;
      style.padding = `${scaledPadding}px`;
      style.borderRadius = `${scaledBorderRadius}px`;
    }

    // Apply shadow (scaled)
    if (overlayStyle?.shadowEnabled) {
      style.textShadow = `${scaledShadowOffsetX}px ${scaledShadowOffsetY}px ${scaledShadowBlur}px ${overlayStyle.shadowColor || '#000000'}`;
    }

    // Apply border using text-stroke (scaled)
    if (overlayStyle?.border1Width && overlayStyle.border1Width > 0) {
      style.webkitTextStroke = `${scaledBorderWidth}px ${overlayStyle.border1Color || '#000000'}`;
      style.paintOrder = 'stroke fill';
    } else if (overlayStyle?.strokeEnabled) {
      style.webkitTextStroke = `${scaledStrokeWidth}px ${overlayStyle.strokeColor || '#000000'}`;
      style.paintOrder = 'stroke fill';
    }

    return style;
  }

  function getTextOverlayClass(overlay: TextOverlay): string[] {
    const classes: string[] = [];
    if (overlay.animation && overlay.animation !== 'none') {
      classes.push(`animate-${overlay.animation}`);
    }
    return classes;
  }

  // Get the position, scale, and rotation for a sticker, respecting per-ratio configs
  function getStickerConfigForRatio(sticker: Sticker): {
    position: { x: number; y: number };
    scale: number;
    rotation: number;
  } {
    const ratio = props.previewAspectRatio;
    const ratioConfig = sticker.perRatioConfigs?.[ratio];

    if (ratioConfig) {
      return {
        position: ratioConfig.position,
        scale: ratioConfig.scale,
        rotation: ratioConfig.rotation,
      };
    }

    // Fallback to default position/scale/rotation
    return {
      position: sticker.position,
      scale: sticker.scale,
      rotation: sticker.rotation,
    };
  }

  // Get the wrapper style for sticker positioning (no scale/rotation)
  function getStickerWrapperStyle(sticker: Sticker): Record<string, string> {
    const config = getStickerConfigForRatio(sticker);
    return {
      left: `${config.position.x}%`,
      top: `${config.position.y}%`,
      transform: 'translate(-50%, -50%)',
    };
  }

  // Base sizes for different sticker types at 1080p reference
  const EMOJI_BASE_SIZE = 48;
  // Image base width = 10% of 1080p height = 108px (matches export: video_height * 0.1)
  const IMAGE_BASE_WIDTH = 108;

  // Handle image sticker load to capture actual dimensions
  function onStickerImageLoad(stickerId: string, event: Event) {
    const img = event.target as HTMLImageElement;
    if (img && img.naturalWidth && img.naturalHeight) {
      stickerImageDimensions.value[stickerId] = {
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    }
  }

  // Get the style for image stickers (scales width to base size, height auto - matches export)
  function getStickerImageStyle(sticker: Sticker): Record<string, string> {
    const containerScale = overlayScaleFactor.value;
    // Base width at current container scale (export uses video_height * 0.1 for width)
    const baseWidth = IMAGE_BASE_WIDTH * containerScale;

    // Get cached dimensions for this sticker
    const dims = stickerImageDimensions.value[sticker.id];

    if (dims) {
      // Scale width to baseWidth, calculate height to maintain aspect ratio
      // This matches FFmpeg's scale=width:-1 behavior
      const aspectRatio = dims.width / dims.height;
      const width = baseWidth;
      const height = baseWidth / aspectRatio;

      return {
        width: `${width}px`,
        height: `${height}px`,
      };
    }

    // Fallback before image loads
    return {
      width: `${baseWidth}px`,
      height: 'auto',
    };
  }

  // Get the content style for sticker scaling and rotation
  function getStickerContentStyle(sticker: Sticker): Record<string, string> {
    const config = getStickerConfigForRatio(sticker);

    // Get the scale factor for this container size (same as text overlays)
    const containerScale = overlayScaleFactor.value;

    // Use local values during drag for instant feedback, otherwise use config values
    const stickerScale = localStickerScales.value[sticker.id] ?? config.scale;
    const stickerRotation = localStickerRotations.value[sticker.id] ?? config.rotation;

    // Base size for emojis
    const baseSize = EMOJI_BASE_SIZE * containerScale;

    return {
      transform: `scale(${stickerScale}) rotate(${stickerRotation}deg)`,
      fontSize: `${baseSize}px`,
    };
  }

  // Calculate the bounding box size in pixels for a sticker
  function getStickerBoundsPx(sticker: Sticker): { width: number; height: number } {
    const config = getStickerConfigForRatio(sticker);
    const containerScale = overlayScaleFactor.value;
    const stickerScale = localStickerScales.value[sticker.id] ?? config.scale;

    const isEmoji = sticker.stickerType === 'emoji';

    if (isEmoji) {
      // Emojis use font-size based dimensions
      const baseSize = EMOJI_BASE_SIZE * containerScale;
      const scaledSize = baseSize * stickerScale;
      return { width: scaledSize, height: scaledSize };
    }

    // For images, use actual dimensions if available
    const dims = stickerImageDimensions.value[sticker.id];
    const baseWidth = IMAGE_BASE_WIDTH * containerScale;

    if (dims) {
      // Scale width to baseWidth, calculate height to maintain aspect ratio
      // This matches FFmpeg's scale=width:-1 behavior and the export
      const aspectRatio = dims.width / dims.height;
      const width = baseWidth * stickerScale;
      const height = (baseWidth / aspectRatio) * stickerScale;

      return { width, height };
    }

    // Fallback before image loads (assume square)
    return { width: baseWidth * stickerScale, height: baseWidth * stickerScale };
  }

  // Get the current rotation for a sticker
  function getStickerRotation(sticker: Sticker): number {
    const config = getStickerConfigForRatio(sticker);
    return localStickerRotations.value[sticker.id] ?? config.rotation;
  }

  // Get the style for the selection border that surrounds the scaled sticker
  function getStickerBoundsStyle(sticker: Sticker): Record<string, string> {
    const bounds = getStickerBoundsPx(sticker);
    const rotation = getStickerRotation(sticker);
    const padding = 2; // Tight padding around content

    return {
      width: `${bounds.width + padding * 2}px`,
      height: `${bounds.height + padding * 2}px`,
      left: '50%',
      top: '50%',
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    };
  }

  // Get the style for rotation handle positioning (above the sticker)
  function getRotationHandleStyle(sticker: Sticker): Record<string, string> {
    const bounds = getStickerBoundsPx(sticker);
    const rotation = getStickerRotation(sticker);
    const offset = bounds.height / 2 + 2; // Position just above the sticker

    // Calculate rotated position for the handle
    // CSS rotation is clockwise for positive angles
    const angleRad = (rotation * Math.PI) / 180;
    const handleDistance = offset + 20; // Distance from center to handle
    // At 0°: handle at top (x=0, y=-distance)
    // At 90° (clockwise): handle at right (x=+distance, y=0)
    const x = Math.sin(angleRad) * handleDistance;
    const y = -Math.cos(angleRad) * handleDistance;

    return {
      left: `calc(50% + ${x}px)`,
      top: `calc(50% + ${y}px)`,
      transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
    };
  }

  // Get the style for corner resize handles (rotated with sticker)
  function getResizeHandleStyle(sticker: Sticker, corner: 'nw' | 'ne' | 'sw' | 'se'): Record<string, string> {
    const bounds = getStickerBoundsPx(sticker);
    const rotation = getStickerRotation(sticker);
    const halfW = bounds.width / 2;
    const halfH = bounds.height / 2;

    // Corner offsets relative to center (before rotation)
    const cornerOffsets: Record<string, { x: number; y: number }> = {
      nw: { x: -halfW, y: -halfH },
      ne: { x: halfW, y: -halfH },
      sw: { x: -halfW, y: halfH },
      se: { x: halfW, y: halfH },
    };

    const offset = cornerOffsets[corner];
    const angleRad = (rotation * Math.PI) / 180;

    // Rotate the corner position (standard 2D rotation for CSS clockwise convention)
    const rotatedX = offset.x * Math.cos(angleRad) - offset.y * Math.sin(angleRad);
    const rotatedY = offset.x * Math.sin(angleRad) + offset.y * Math.cos(angleRad);

    return {
      left: `calc(50% + ${rotatedX}px)`,
      top: `calc(50% + ${rotatedY}px)`,
      transform: 'translate(-50%, -50%)',
    };
  }

  function getStickerClass(sticker: Sticker): string[] {
    const classes: string[] = [];
    if (sticker.animation && sticker.animation !== 'none') {
      classes.push(`animate-${sticker.animation}`);
    }
    return classes;
  }

  function getVideoFilterStyle(): Record<string, string> {
    if (!props.filterSettings) return {};

    const filters: string[] = [];

    const brightness = props.filterSettings.brightness || 0;
    if (brightness !== 0) {
      const brightnessValue = 1 + brightness / 100;
      filters.push(`brightness(${brightnessValue})`);
    }

    const contrast = props.filterSettings.contrast || 0;
    if (contrast !== 0) {
      const contrastValue = 1 + contrast / 100;
      filters.push(`contrast(${contrastValue})`);
    }

    const saturation = props.filterSettings.saturation || 0;
    if (saturation !== 0) {
      const saturationValue = 1 + saturation / 100;
      filters.push(`saturate(${saturationValue})`);
    }

    const hue = props.filterSettings.hue || 0;
    if (hue !== 0) {
      filters.push(`hue-rotate(${hue}deg)`);
    }

    const sharpen = props.filterSettings.sharpen || 0;
    if (sharpen > 0) {
      const sharpenBoost = 1 + sharpen / 1000;
      filters.push(`contrast(${sharpenBoost})`);
    }

    const fade = props.filterSettings.fade || 0;
    if (fade > 0) {
      const fadeContrast = 1 - fade / 333;
      const fadeSaturation = 1 - fade / 500;
      filters.push(`contrast(${fadeContrast})`);
      filters.push(`saturate(${fadeSaturation})`);
    }

    if (filters.length === 0) return {};

    return {
      filter: filters.join(' '),
    };
  }

  function getVignetteStyle(): Record<string, string> {
    const vignette = props.filterSettings?.vignette || 0;
    if (vignette === 0) {
      return { display: 'none' };
    }

    const intensity = vignette / 100;
    const innerStop = 70 - intensity * 50;
    const opacity = 0.3 + intensity * 0.6;

    return {
      background: `radial-gradient(ellipse at center, transparent ${innerStop}%, rgba(0,0,0,${opacity}) 100%)`,
      pointerEvents: 'none',
    };
  }

  function getTemperatureStyle(): Record<string, string> {
    const temp = props.filterSettings?.temperature || 0;
    if (temp === 0) {
      return { display: 'none' };
    }

    const intensity = Math.abs(temp) / 100;
    const opacity = intensity * 0.25;

    if (temp > 0) {
      return {
        backgroundColor: `rgba(255, 140, 50, ${opacity})`,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      };
    } else {
      return {
        backgroundColor: `rgba(80, 140, 255, ${opacity})`,
        mixBlendMode: 'overlay',
        pointerEvents: 'none',
      };
    }
  }

  // ResizeObserver for container size tracking
  let resizeObserver: ResizeObserver | null = null;

  function updateContainerSize() {
    if (videoContainerRef.value) {
      const rect = videoContainerRef.value.getBoundingClientRect();
      containerSize.value = { width: rect.width, height: rect.height };
    }
  }

  // Watch for framed preview mode changes
  watch(showFramedPreview, (isFramed) => {
    if (isFramed) {
      startSyncLoop();
      // Clear old refs when switching modes
      regionVideoRefs.value = [];
    } else {
      stopSyncLoop();
    }
  });

  // Watch for text overlay changes to clear local drag widths when the parent updates
  watch(
    () => props.textOverlays,
    () => {
      // Clear local widths that now have real values from parent
      // This prevents stale local values from overriding parent updates
      if (!dragState.isDragging && !resizeState.isResizing) {
        localDragWidths.value = {};
      }
    },
    { deep: true }
  );

  // Watch for aspect ratio changes to update container size and preserve time
  watch(
    () => props.previewAspectRatio,
    () => {
      // Store current video time before aspect ratio change causes video element swap
      if (videoRef.value && !isNaN(videoRef.value.currentTime)) {
        pendingSeekTime.value = videoRef.value.currentTime;
      }

      // Force container size update when aspect ratio changes
      updateContainerSize();
      // Clear old refs when aspect ratio changes
      regionVideoRefs.value = [];
    }
  );

  // Cleanup on unmount
  onUnmounted(() => {
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.removeEventListener('mousemove', onStickerResizeMove);
    document.removeEventListener('mouseup', onStickerResizeEnd);
    document.removeEventListener('mousemove', onStickerRotateMove);
    document.removeEventListener('mouseup', onStickerRotateEnd);
    document.removeEventListener('mousemove', onWatermarkResizeMove);
    document.removeEventListener('mouseup', onWatermarkResizeEnd);
    document.removeEventListener('mousemove', onSubtitleDragMove);
    document.removeEventListener('mouseup', onSubtitleDragEnd);
    document.removeEventListener('mousemove', onSubtitleResizeMove);
    document.removeEventListener('mouseup', onSubtitleResizeEnd);
    stopSyncLoop();
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
  });

  onMounted(() => {
    if (videoRef.value) {
      emit('videoElementReady', videoRef.value);
    }

    // Set up resize observer to track container size changes
    if (videoContainerRef.value) {
      updateContainerSize();
      resizeObserver = new ResizeObserver(() => {
        updateContainerSize();
      });
      resizeObserver.observe(videoContainerRef.value);
    }

    // Start sync loop if in framed preview mode
    if (showFramedPreview.value) {
      startSyncLoop();
    }
  });

  // Get the current overlay container height for font scaling calculations
  function getOverlayContainerHeight(): number {
    if (!overlayContainerRef.value) return 400; // Fallback
    const rect = overlayContainerRef.value.getBoundingClientRect();
    return rect.height;
  }

  // Expose functions for parent component access
  defineExpose({
    getOverlayContainerHeight,
  });
</script>

<style scoped>
  /* Text overlay animations */
  .animate-fade {
    animation: fadeIn 0.3s ease-out;
  }

  .animate-slide-up {
    animation: slideUp 0.3s ease-out;
  }

  .animate-slide-down {
    animation: slideDown 0.3s ease-out;
  }

  .animate-typewriter {
    overflow: hidden;
    white-space: nowrap;
    animation: typewriter 0.5s steps(20);
  }

  .animate-bounce {
    animation: bounce 0.5s ease-out;
  }

  .animate-zoom {
    animation: zoomIn 0.3s ease-out;
  }

  .animate-pop {
    animation: pop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }

  /* Sticker animations */
  .animate-spin {
    animation: spin 2s linear infinite;
  }

  .animate-pulse {
    animation: pulse 1s ease-in-out infinite;
  }

  .animate-shake {
    animation: shake 0.5s ease-in-out infinite;
  }

  .animate-float {
    animation: float 2s ease-in-out infinite;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  @keyframes slideUp {
    from {
      transform: translate(-50%, calc(-50% + 20px));
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%);
      opacity: 1;
    }
  }

  @keyframes slideDown {
    from {
      transform: translate(-50%, calc(-50% - 20px));
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%);
      opacity: 1;
    }
  }

  @keyframes typewriter {
    from {
      width: 0;
    }
    to {
      width: 100%;
    }
  }

  @keyframes bounce {
    0%,
    100% {
      transform: translate(-50%, -50%);
    }
    50% {
      transform: translate(-50%, calc(-50% - 10px));
    }
  }

  @keyframes zoomIn {
    from {
      transform: translate(-50%, -50%) scale(0.5);
      opacity: 0;
    }
    to {
      transform: translate(-50%, -50%) scale(1);
      opacity: 1;
    }
  }

  @keyframes pop {
    0% {
      transform: translate(-50%, -50%) scale(0);
    }
    70% {
      transform: translate(-50%, -50%) scale(1.1);
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
  }

  @keyframes spin {
    from {
      transform: translate(-50%, -50%) rotate(0deg);
    }
    to {
      transform: translate(-50%, -50%) rotate(360deg);
    }
  }

  @keyframes pulse {
    0%,
    100% {
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      transform: translate(-50%, -50%) scale(1.1);
    }
  }

  @keyframes shake {
    0%,
    100% {
      transform: translate(-50%, -50%) translateX(0);
    }
    25% {
      transform: translate(-50%, -50%) translateX(-5px);
    }
    75% {
      transform: translate(-50%, -50%) translateX(5px);
    }
  }

  @keyframes float {
    0%,
    100% {
      transform: translate(-50%, -50%) translateY(0);
    }
    50% {
      transform: translate(-50%, -50%) translateY(-10px);
    }
  }

  /* Sticker overlay styling */
  .sticker-overlay {
    z-index: 10;
  }

  .sticker-overlay:hover {
    z-index: 20;
  }

  /* Watermark overlay styling */
  .watermark-overlay {
    z-index: 10;
  }

  .watermark-overlay:hover {
    z-index: 20;
  }

  /* Subtitle overlay styling */
  .subtitle-overlay {
    z-index: 30;
  }

  .subtitle-overlay:hover {
    z-index: 40;
  }

  /* Subtitle text container - matches VideoPlayer implementation */
  .subtitle-text-container {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  /* Subtitle word stack - layered SVG rendering */
  .subtitle-word-stack {
    position: relative;
    display: inline-block;
    transition-property: transform, opacity, filter;
    transition-timing-function: cubic-bezier(0.33, 1, 0.68, 1);
    transform-origin: center;
    will-change: transform, opacity, filter;
  }

  /* ===== ANIMATION STYLES (matches VideoPlayer) ===== */

  /* Zoom animation - scale up current word */
  .subtitle-word-stack.animation-zoom:has(.current-word) {
    transform: scale(1.15);
  }

  /* Karaoke animation - color change handled via SVG fill, subtle scale */
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

  /* Custom range input styling */
  input[type='range'].slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    margin: 0;
  }

  input[type='range'].slider::-webkit-slider-track {
    background: transparent;
    height: 4px;
    border-radius: 2px;
  }

  input[type='range'].slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    background: white;
    height: 10px;
    width: 10px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
    margin-top: -3px;
  }

  input[type='range'].slider::-webkit-slider-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.15);
    box-shadow: 0 3px 8px rgba(139, 92, 246, 0.4);
  }

  input[type='range'].slider::-moz-range-track {
    background: transparent;
    height: 4px;
    border-radius: 2px;
  }

  input[type='range'].slider::-moz-range-thumb {
    border: none;
    background: white;
    height: 10px;
    width: 10px;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.15s ease;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  input[type='range'].slider::-moz-range-thumb:hover {
    background: #f3f4f6;
    transform: scale(1.15);
    box-shadow: 0 3px 8px rgba(139, 92, 246, 0.4);
  }

  /* Backdrop blur effects */
  .backdrop-blur-sm {
    backdrop-filter: blur(8px);
  }
</style>
