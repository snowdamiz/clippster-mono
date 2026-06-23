<template>
  <div class="poi-target-panel flex flex-col h-full">
    <!-- Header - single row -->
    <div class="flex items-center gap-2 px-2 py-1.5 border-b border-zinc-700/50">
      <!-- Output Preview label + aspect ratio -->
      <div class="flex items-center gap-1.5 shrink-0">
        <span class="text-xs font-medium text-zinc-300">Output Preview</span>
        <span class="text-[10px] text-zinc-500 font-mono">{{ targetAspectRatio }}</span>
      </div>

      <!-- Scale 16:9 checkbox (not wrapped in <label> — Reka Checkbox is a button and double-fires inside labels) -->
      <div
        class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded transition-all shrink-0"
        :class="showSourceFrame
          ? 'bg-purple-500/20 text-purple-300'
          : 'text-zinc-400'"
      >
        <Checkbox
          :model-value="showSourceFrame"
          aria-label="Enable Scale 16:9"
          class="h-3.5 w-3.5 rounded border-white/45 bg-white/10 text-white hover:border-purple-300/80 data-[state=checked]:border-purple-300 data-[state=checked]:bg-purple-500 focus-visible:ring-purple-400/50"
          @update:model-value="onToggleScale16"
        >
          <CheckIcon class="h-3 w-3" />
        </Checkbox>
        <span>Scale 16:9</span>
      </div>

      <!-- Use 16:9 checkbox -->
      <div
        class="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded transition-all shrink-0"
        :class="use16x9Mode
          ? 'bg-cyan-500/20 text-cyan-300'
          : 'text-zinc-400'"
      >
        <Checkbox
          :model-value="use16x9Mode"
          aria-label="Enable Use 16:9"
          class="h-3.5 w-3.5 rounded border-white/45 bg-white/10 text-white hover:border-cyan-300/80 data-[state=checked]:border-cyan-300 data-[state=checked]:bg-cyan-500 focus-visible:ring-cyan-400/50"
          @update:model-value="onToggleUse16x9"
        >
          <CheckIcon class="h-3 w-3" />
        </Checkbox>
        <span>Use 16:9</span>
      </div>

      <!-- Blur dropdown (when Scale or Use 16:9 is enabled) -->
      <div
        v-if="showSourceFrame || use16x9Mode"
        class="relative shrink-0"
        ref="blurDropdownRef"
      >
        <button
          @click="showBlurDropdown = !showBlurDropdown"
          class="flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded transition-all"
          :class="blurEnabled 
            ? 'bg-purple-500/20 text-purple-300' 
            : 'text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-700/50'"
        >
          <span>Blur{{ blurEnabled ? `: ${blurAmount}` : '' }}</span>
          <svg 
            class="w-3 h-3 transition-transform" 
            :class="{ 'rotate-180': showBlurDropdown }"
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <!-- Dropdown panel -->
        <div
          v-if="showBlurDropdown"
          class="absolute top-full left-0 mt-1 p-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 min-w-[140px]"
          @click.stop
        >
          <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] text-zinc-400">Blur</span>
            <span class="text-[10px] text-zinc-300 font-mono">{{ blurAmount }}</span>
          </div>
          <input
            v-model.number="blurAmount"
            type="range"
            min="0"
            max="30"
            step="1"
            class="w-full h-1.5 accent-purple-500 cursor-pointer"
          />
          <div class="flex justify-between mt-1 text-[9px] text-zinc-500">
            <span>Off</span>
            <span>Max</span>
          </div>
        </div>
      </div>

      <!-- Spacer -->
      <div class="flex-1"></div>

      <!-- Stack button -->
      <button
        @click="autoArrangeVertical"
        class="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-zinc-400 hover:text-zinc-200 bg-zinc-800/50 hover:bg-zinc-700/50 rounded transition-colors shrink-0"
        title="Stack regions vertically"
        :disabled="regions.length === 0"
      >
        <LayoutGridIcon class="w-3 h-3" />
        Stack
      </button>
    </div>

    <!-- Canvas Area -->
    <div class="flex-1 px-2 py-2 flex items-center justify-center bg-zinc-950/50">
      <div
        ref="containerRef"
        class="relative bg-black rounded-lg overflow-hidden shadow-lg border border-zinc-800"
        :style="containerStyle"
      >
        <!-- Background fill -->
        <div class="absolute inset-0 bg-zinc-900" />

        <!-- Single decoder for all source-video previews in this panel -->
        <video
          v-if="videoUrl"
          ref="masterVideoRef"
          :src="videoUrl"
          class="absolute w-px h-px opacity-0 pointer-events-none"
          preload="auto"
          muted
          playsinline
          @loadedmetadata="onMasterVideoLoaded"
        />

        <!-- Transparent click-catcher to deselect regions when clicking empty space -->
        <div
          class="absolute inset-0 z-[4]"
          @click="emit('selectRegion', null)"
        />

        <!-- Grid lines for visual guidance -->
        <div class="absolute inset-0 pointer-events-none">
          <!-- Horizontal thirds -->
          <div class="absolute w-full border-t border-white/5" style="top: 33.33%" />
          <div class="absolute w-full border-t border-white/5" style="top: 66.66%" />
          <!-- Vertical thirds -->
          <div class="absolute h-full border-l border-white/5" style="left: 33.33%" />
          <div class="absolute h-full border-l border-white/5" style="left: 66.66%" />
        </div>

        <!-- Center alignment guides (show when element is near center) -->
        <div class="absolute inset-0 pointer-events-none z-[100]">
          <!-- Vertical center line -->
          <div 
            v-if="showVerticalCenterGuide"
            class="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-[2px] bg-yellow-400/80"
          />
          <!-- Horizontal center line -->
          <div 
            v-if="showHorizontalCenterGuide"
            class="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-yellow-400/80"
          />
        </div>

        <!-- Use 16:9: blurred full-frame background (scale cover) -->
        <div
          v-if="use16x9Mode"
          class="absolute inset-0 overflow-hidden z-[0]"
        >
          <canvas
            v-if="videoUrl"
            ref="use16x9BgCanvasRef"
            class="absolute inset-0 w-full h-full pointer-events-none scale-[1.08]"
            :style="{ filter: `blur(${use16x9BgBlurPx}px)` }"
          />
          <img
            v-else-if="thumbnailUrl"
            :src="thumbnailUrl"
            class="absolute inset-0 w-full h-full object-cover scale-[1.08] pointer-events-none"
            :style="{ filter: `blur(${use16x9BgBlurPx}px)` }"
            alt=""
            draggable="false"
          />
        </div>

        <!-- Use 16:9: sharp letterboxed 16:9 foreground (draggable / resizable) -->
        <div
          v-if="use16x9Mode"
          class="absolute border-2 border-cyan-400 cursor-move z-[4]"
          :style="sourceFrameStyle"
          @mousedown="startDragSourceFrame"
        >
          <canvas
            v-if="videoUrl"
            ref="use16x9SharpCanvasRef"
            class="absolute inset-0 w-full h-full pointer-events-none"
          />
          <img
            v-else-if="thumbnailUrl"
            :src="thumbnailUrl"
            class="absolute inset-0 w-full h-full object-contain pointer-events-none"
            alt=""
            draggable="false"
          />
          <div class="absolute top-0 left-0 -translate-y-full px-2 py-1 bg-cyan-600 text-white text-[10px] font-medium rounded-t whitespace-nowrap">
            16:9 (sharp) — drag / corners to scale
          </div>
          <div
            v-for="corner in ['nw', 'ne', 'sw', 'se']"
            :key="`u9-${corner}`"
            class="absolute w-3 h-3 bg-cyan-500 border border-white pointer-events-auto"
            :class="{
              'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize': corner === 'nw',
              'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize': corner === 'ne',
              'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize': corner === 'sw',
              'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize': corner === 'se',
            }"
            @mousedown.stop="(e) => startResizeSourceFrame(e, corner)"
          />
        </div>

        <!-- 16:9 Source Frame Overlay (when Scale 16:9 is enabled)
             Must stay above the full-canvas click-catcher (z-[4]) or drag/corner scale never receives events.
             Use z-[5] to align with region preview layer; region nodes after this in the DOM still stack above. -->
        <div
          v-if="showSourceFrame"
          class="absolute border-2 border-purple-500 cursor-move z-[5]"
          :style="sourceFrameStyle"
          @mousedown="startDragSourceFrame"
        >
          <!-- Source video/thumbnail preview -->
          <canvas
            v-if="videoUrl"
            ref="sourceFrameCanvasRef"
            class="absolute inset-0 w-full h-full pointer-events-none opacity-50"
            :style="scaleSourceBlurStyle"
          />
          <img
            v-else-if="thumbnailUrl"
            :src="thumbnailUrl"
            class="absolute inset-0 w-full h-full object-cover pointer-events-none opacity-50"
            :style="scaleSourceBlurStyle"
            alt="Source frame"
            draggable="false"
          />
          
          <!-- Label -->
          <div class="absolute top-0 left-0 -translate-y-full px-2 py-1 bg-purple-500 text-white text-[10px] font-medium rounded-t whitespace-nowrap">
            16:9 Source Frame — drag · corners to scale
          </div>

          <!-- Corner resize handles -->
          <div
            v-for="corner in ['nw', 'ne', 'sw', 'se']"
            :key="corner"
            class="absolute w-3 h-3 bg-purple-500 border border-white pointer-events-auto"
            :class="{
              'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize': corner === 'nw',
              'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize': corner === 'ne',
              'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize': corner === 'sw',
              'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize': corner === 'se',
            }"
            @mousedown.stop="(e) => startResizeSourceFrame(e, corner)"
          />
        </div>

        <!-- Layout overlay previews (behind region content) -->
        <template v-if="overlayPreviews?.length">
          <div
            v-for="overlay in overlayPreviews"
            :key="overlay.id"
            class="absolute pointer-events-none z-[1]"
            :style="getOverlayStyle(overlay)"
          >
            <MediaPreview
              :src="overlay.dataUrl"
              class-name="w-full h-full object-contain"
              :style="{ opacity: overlay.opacity / 100 }"
            />
          </div>
        </template>

        <!-- Region previews (showing source content in output position) -->
        <div
          v-for="region in regions"
          v-show="!use16x9Mode"
          :key="region.id"
          class="absolute overflow-hidden z-[5]"
          :style="getRegionPreviewStyle(region)"
        >
          <!-- Uploaded image media -->
          <img
            v-if="region.mediaAssetId && region.mediaType === 'image'"
            :src="regionMediaSrc(region.mediaAssetId)"
            class="absolute inset-0 w-full h-full object-cover pointer-events-none"
            alt=""
            draggable="false"
          />
          <!-- Uploaded video media -->
          <video
            v-else-if="region.mediaAssetId && region.mediaType === 'video'"
            :ref="(el) => setUploadedMediaVideoRef(region.id, el as HTMLVideoElement)"
            :src="regionMediaSrc(region.mediaAssetId)"
            class="absolute inset-0 w-full h-full object-cover pointer-events-none"
            preload="metadata"
            muted
            playsinline
            loop
            @loadedmetadata="(e) => onUploadedMediaVideoLoaded(e.target as HTMLVideoElement)"
          />
          <!-- Video crop preview (canvas fed from shared master decoder) -->
          <canvas
            v-else-if="videoUrl"
            :ref="(el) => setRegionCanvasRef(region.id, el as HTMLCanvasElement)"
            class="absolute inset-0 w-full h-full pointer-events-none"
          />
          <!-- Thumbnail crop preview (fallback) -->
          <img
            v-else-if="thumbnailUrl"
            :src="thumbnailUrl"
            class="absolute max-w-none pointer-events-none"
            :style="getCroppedImageStyle(region)"
            alt=""
            draggable="false"
          />
          <!-- Placeholder when no thumbnail -->
          <div
            v-else
            class="absolute inset-0 flex items-center justify-center"
            :style="{ backgroundColor: region.color + '20' }"
          >
            <span class="text-[9px] text-zinc-500">{{ regionLabel(region) }}</span>
          </div>
        </div>

        <!-- Draggable output regions (on top of previews) - hidden while playing -->
        <POIRegion
          v-for="region in regions"
          v-show="!isPlaying && !use16x9Mode"
          :key="`output-${region.id}`"
          :rect="region.output"
          :color="region.color"
          :label="regionLabel(region)"
          :is-selected="selectedRegionId === region.id"
          :container-width="containerWidth"
          :container-height="containerHeight"
          :resizable="true"
          :draggable="true"
          :show-controls="false"
          :show-resize-handles="true"
          :aspect-ratio-locked="region.aspectRatioLocked !== false"
          :snap-to-center="true"
          :snap-threshold="SNAP_THRESHOLD"
          :corner-radius-px="getScaledCornerRadius(region)"
          @update="(rect) => updateRegionOutput(region.id, rect)"
          @select="selectRegion(region.id)"
          @drag-start="onDragStart"
          @drag-end="onDragEnd"
          @center-guide="onCenterGuide"
        />

        <!-- Watermark preview overlay -->
        <div
          v-if="watermarkPreview"
          class="absolute pointer-events-none z-10"
          :style="watermarkPreviewStyle"
        >
          <!-- Watermark indicator (simple preview representation) -->
          <div 
            class="w-full h-full border-2 border-dashed border-amber-500/50 rounded bg-amber-500/10 flex items-center justify-center"
            :style="{ opacity: watermarkPreview.opacity / 100 }"
          >
            <span class="text-[8px] text-amber-500/80 font-medium">WATERMARK</span>
          </div>
        </div>

        <!-- Subtitle draggable/resizable box -->
        <div
          v-if="subtitleSettings && subtitlePositioningEnabled"
          class="absolute z-20 pointer-events-auto"
          :style="subtitleBoxStyle"
        >
          <!-- Drag body -->
          <div
            class="w-full h-full flex items-center justify-center cursor-move select-none"
            :class="[
              isDraggingSubtitles ? 'ring-2 ring-purple-400' : 'ring-1 ring-purple-500/60 hover:ring-purple-400',
              subtitleSettings?.animationStyle === 'single-word' ? 'overflow-visible' : 'overflow-hidden',
            ]"
            style="border-radius: 4px; background: rgba(88,28,135,0.15);"
            @mousedown.prevent="startDragSubtitles"
          >
            <!-- Actual transcript words (when available) -->
            <div
              v-if="visibleWords.length > 0"
              :class="subtitleSettings?.animationStyle === 'single-word'
                ? 'flex items-center justify-center pointer-events-none'
                : 'flex flex-wrap items-center justify-center gap-x-2 gap-y-1 px-2 py-0.5 pointer-events-none'"
            >
              <template v-if="subtitleSettings">
                <span
                  v-for="(wordInfo, index) in visibleWords"
                  :key="`subtitle-word-${wordInfo.start}-${index}`"
                  class="relative inline-block shrink-0 transition-transform duration-150"
                  :style="subtitleWordPreviewMotionStyle(wordInfo)"
                >
                  <!-- Use SVG for proper border rendering -->
                  <!-- For single-word, add horizontal padding so stroke isn't clipped at edges -->
                  <span
                    class="invisible select-none"
                    :style="subtitleSettings.animationStyle === 'single-word'
                      ? { ...subtitleTextStyle, paddingLeft: '0.2em', paddingRight: '0.2em' }
                      : subtitleTextStyle"
                  >{{ subtitleSettings.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}</span>
                  <svg class="absolute inset-0 w-full h-full overflow-visible" style="pointer-events: none">
                    <!-- Border 2 (Outer) -->
                    <text
                      v-if="subtitleSettings.border2Width > 0"
                      x="50%"
                      y="55%"
                      dominant-baseline="middle"
                      text-anchor="middle"
                      :style="{
                        fontFamily: subtitleSettings.fontFamily,
                        fontWeight: subtitleSettings.fontWeight,
                        fontSize: subtitleTextStyle.fontSize,
                        stroke: subtitleSettings.border2Color,
                        strokeWidth: (subtitleSettings.border1Width + subtitleSettings.border2Width) * 2 + 'px',
                        strokeLinejoin: 'round',
                        strokeLinecap: 'round',
                        fill: 'none',
                      }"
                    >
                      {{ subtitleSettings.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}
                    </text>

                    <!-- Border 1 (Inner) -->
                    <text
                      v-if="subtitleSettings.border1Width > 0"
                      x="50%"
                      y="55%"
                      dominant-baseline="middle"
                      text-anchor="middle"
                      :style="{
                        fontFamily: subtitleSettings.fontFamily,
                        fontWeight: subtitleSettings.fontWeight,
                        fontSize: subtitleTextStyle.fontSize,
                        stroke: subtitleSettings.border1Color,
                        strokeWidth: subtitleSettings.border1Width * 2 + 'px',
                        strokeLinejoin: 'round',
                        strokeLinecap: 'round',
                        fill: 'none',
                      }"
                    >
                      {{ subtitleSettings.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}
                    </text>

                    <!-- Fill Text -->
                    <text
                      x="50%"
                      y="55%"
                      dominant-baseline="middle"
                      text-anchor="middle"
                      :style="subtitleWordSvgFillStyle(wordInfo)"
                    >
                      {{ subtitleSettings.animationStyle === 'single-word' ? wordInfo.word.toUpperCase() : wordInfo.word }}
                    </text>
                  </svg>
                </span>
              </template>
            </div>

            <!-- Sample text (when no transcript) -->
            <div
              v-else
              class="text-center font-medium pointer-events-none px-2"
              :style="subtitleTextStyle"
            >
              {{ subtitlePreviewFallbackText }}
            </div>

          </div>

          <!-- Corner resize handles (hidden for single-word style since width is auto) -->
          <div
            v-if="subtitleSettings?.animationStyle !== 'single-word'"
            v-for="corner in ['nw','ne','sw','se']"
            :key="corner"
            class="absolute w-2.5 h-2.5 bg-purple-500 border border-white pointer-events-auto z-30"
            :class="{
              'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize': corner === 'nw',
              'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize': corner === 'ne',
              'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize': corner === 'sw',
              'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize': corner === 'se',
            }"
            @mousedown.stop.prevent="(e) => startResizeSubtitles(e, corner)"
          />
        </div>

        <!-- Clip text box (pill) — POI target preview -->
        <div
          v-if="showClipTextBoxOverlay"
          class="absolute z-[21] pointer-events-auto"
          :style="clipTextBoxContainerStyle"
        >
          <div
            class="inline-flex items-center justify-center select-none overflow-hidden relative"
            :class="[
              isDraggingClipText || isResizingClipText ? 'ring-2 ring-blue-500' : 'ring-1 ring-blue-500/60 hover:ring-blue-400',
              clipTextBoxPositioningEnabled ? 'cursor-move' : 'cursor-default',
            ]"
            :style="clipTextPillStyle"
            @mousedown.prevent="clipTextBoxPositioningEnabled ? startDragClipText($event) : undefined"
          >
            <div
              class="text-center pointer-events-none inline-block max-w-full whitespace-pre-wrap break-words"
              :style="clipTextPillTextStyle"
            >
              {{ clipTextDisplayText }}
            </div>
          </div>
          <template v-if="clipTextBoxPositioningEnabled">
            <div
              v-for="corner in ['nw', 'ne', 'sw', 'se']"
              :key="`ct-${corner}`"
              class="absolute w-2.5 h-2.5 bg-blue-500 border border-white pointer-events-auto z-30"
              :class="{
                'top-0 left-0 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize': corner === 'nw',
                'top-0 right-0 translate-x-1/2 -translate-y-1/2 cursor-nesw-resize': corner === 'ne',
                'bottom-0 left-0 -translate-x-1/2 translate-y-1/2 cursor-nesw-resize': corner === 'sw',
                'bottom-0 right-0 translate-x-1/2 translate-y-1/2 cursor-nwse-resize': corner === 'se',
              }"
              @mousedown.stop.prevent="(e) => startClipTextResize(e, corner)"
            />
          </template>
        </div>

        <!-- Social platform chrome (TikTok / Reels / Shorts) — preview only, 9:16; toggle lives on source panel -->
        <div
          v-if="socialOverlayPreset && isTarget916"
          class="absolute inset-0 z-[100] pointer-events-none select-none overflow-hidden rounded-lg"
        >
          <SocialOverlay
            :preset="socialOverlayPreset"
            :canvas-width="9"
            :canvas-height="16"
          />
        </div>

        <!-- Empty state -->
        <div v-if="regions.length === 0 && !use16x9Mode" class="absolute inset-0 flex items-center justify-center">
          <div class="text-center">
            <LayoutIcon class="w-6 h-6 text-zinc-600 mx-auto mb-1" />
            <p class="text-[10px] text-zinc-500">Add regions in the source panel</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { convertFileSrc } from '@tauri-apps/api/core';
  import { CheckIcon, LayoutGridIcon, LayoutIcon } from 'lucide-vue-next';
  import POIRegion from './POIRegion.vue';
  import MediaPreview from '@/components/MediaPreview.vue';
  import SocialOverlay from '@/editor/components/preview/SocialOverlay.vue';
  import { Checkbox } from '@/components/ui/checkbox';
  import type { SocialOverlayPreset } from '@/editor/types/social-overlays';
  import type { ManualRegion, ManualRegionRect, SubtitleSettings, ManualSourceFramingPayload } from '@/types';
  import type { ClipTextBoxState } from '@/utils/clipTextBox';
  import { getRegionDisplayLabel } from '@/utils/poiRegionNumbering';
  import { scaleUse169BlurForPoiPreview, use169BlurSliderToCssPx } from '@/utils/use169Blur';
  import { getVisibleSubtitleWordsForClipTime } from '@/utils/subtitleVisibleWords';

  interface WatermarkPreview {
    filePath?: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
  }

  interface OverlayPreview {
    id: string;
    dataUrl: string;
    x: number;
    y: number;
    scale: number;
    opacity: number;
    isFullFrame: boolean;
    label?: string;
  }

  interface WordInfo {
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }

  interface WhisperSegment {
    text: string;
    start: number;
    end: number;
    words?: WordInfo[];
  }

  interface Props {
    regions: ManualRegion[];
    selectedRegionId: string | null;
    thumbnailUrl?: string | null;
    targetAspectRatio: string;
    sourceAspectRatio?: string;
    videoUrl?: string | null;
    videoTime?: number;
    clipStartTime?: number; // For converting absolute time to clip-relative for subtitle matching
    isPlaying?: boolean;
    // Optional watermark preview overlay
    watermarkPreview?: WatermarkPreview | null;
    // Optional layout overlay previews
    overlayPreviews?: OverlayPreview[];
    // Optional subtitle settings for preview
    subtitleSettings?: SubtitleSettings | null;
    // Optional subtitle position for preview
    subtitlePosition?: { x: number; y: number; width?: number } | null;
    subtitlePositioningEnabled?: boolean;
    // Optional transcript data for subtitle rendering
    transcriptWords?: WordInfo[];
    transcriptSegments?: WhisperSegment[];
    /** Hydrate Scale / Use 16:9 / blur from saved config (normalized x,y) */
    initialSourceFraming?: ManualSourceFramingPayload | null;
    /** Merged clip text state for current target ratio (preview + drag) */
    clipTextBoxDisplay?: ClipTextBoxState | null;
    clipTextBoxPositioningEnabled?: boolean;
    /** Preview-only social chrome; controlled from Manual POI source toolbar when export is 9:16 */
    socialOverlayPreset?: SocialOverlayPreset | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    targetAspectRatio: '9:16',
    sourceAspectRatio: '16:9',
    videoTime: 0,
    clipStartTime: 0,
    isPlaying: false,
    watermarkPreview: null,
    subtitleSettings: null,
    subtitlePosition: null,
    subtitlePositioningEnabled: false,
    transcriptWords: () => [],
    transcriptSegments: () => [],
    initialSourceFraming: null,
    clipTextBoxDisplay: null,
    clipTextBoxPositioningEnabled: false,
    socialOverlayPreset: null,
  });

  const emit = defineEmits<{
    updateRegion: [id: string, region: Partial<ManualRegion>];
    selectRegion: [id: string | null];
    updateSourceTransform: [payload: ManualSourceFramingPayload];
    subtitlePositionChange: [position: { x: number; y: number; width?: number }];
    subtitleSettingsChange: [settings: SubtitleSettings];
    clipTextBoxPositionChange: [payload: { x: number; y: number; widthPct: number; fontSize?: number }];
  }>();

  const containerRef = ref<HTMLElement | null>(null);
  const containerWidth = ref(0);
  const containerHeight = ref(0);

  const isTarget916 = computed(() => props.targetAspectRatio === '9:16');

  // Source frame scaling state
  const showSourceFrame = ref(false);
  const use16x9Mode = ref(false);
  const blurAmount = ref(12);
  const showBlurDropdown = ref(false);
  const blurDropdownRef = ref<HTMLElement | null>(null);
  // Blur is enabled when amount > 0
  const blurEnabled = computed(() => blurAmount.value > 0);

  /** Same slider→CSS mapping as VideoPlayer; then scale for small modal preview panel. */
  function poiPreviewBgBlurPx(sliderVal: number): number {
    const cssPx = use169BlurSliderToCssPx(sliderVal);
    const minSide = Math.min(containerWidth.value, containerHeight.value);
    return scaleUse169BlurForPoiPreview(cssPx, minSide);
  }

  const sourceFrameTransform = ref({
    scale: 1,
    x: 0,
    y: 0,
  });
  let lastHydratedFramingJson = '';
  const isDraggingSourceFrame = ref(false);
  const dragStartPos = ref({ x: 0, y: 0 });
  const dragStartTransform = ref({ x: 0, y: 0 });

  // Center alignment guides state
  const showVerticalCenterGuide = ref(false);
  const showHorizontalCenterGuide = ref(false);
  const SNAP_THRESHOLD = 8; // pixels within which to snap to center

  // Close blur dropdown when clicking outside
  function handleClickOutsideBlur(e: MouseEvent) {
    const target = e.target as Node;
    if (showBlurDropdown.value && blurDropdownRef.value && !blurDropdownRef.value.contains(target)) {
      showBlurDropdown.value = false;
    }
  }

  // Subtitle dragging state
  const isDraggingSubtitles = ref(false);
  const isResizingSubtitles = ref(false);
  const subtitleDragOffset = ref({ x: 0, y: 0 });
  const localSubtitlePosition = ref<{ x: number; y: number; width?: number }>(
    props.subtitlePosition ? { ...props.subtitlePosition } : { x: 50, y: 85, width: 80 }
  );
  const subtitleContainerRef = ref<HTMLElement | null>(null);

  // Sync local subtitle position when prop changes (e.g. switching aspect ratios)
  watch(
    () => props.subtitlePosition,
    (pos) => {
      if (pos) localSubtitlePosition.value = { ...pos };
    },
    { deep: true }
  );

  // Clip text box drag/resize (matches VideoPlayer scaling)
  const isDraggingClipText = ref(false);
  const isResizingClipText = ref(false);
  const localClipTextPosition = ref({ x: 50, y: 50, widthPct: 72 });
  const localClipTextFontSize = ref(28);
  const clipTextDragOffset = ref({ x: 0, y: 0 });
  const clipTextResizeStartX = ref(0);
  const clipTextResizeStartY = ref(0);
  const clipTextResizeStartFontSize = ref(28);
  const clipTextResizeCorner = ref<'nw' | 'ne' | 'sw' | 'se'>('se');

  watch(
    () => props.clipTextBoxDisplay,
    (d) => {
      if (!d) return;
      localClipTextPosition.value = {
        x: d.positionX,
        y: d.positionY,
        widthPct: d.widthPct,
      };
      localClipTextFontSize.value = d.style?.fontSize ?? 28;
    },
    { immediate: true, deep: true }
  );

  const clipTextRelativeTime = computed(() => {
    const absoluteTime = props.videoTime || 0;
    return absoluteTime - (props.clipStartTime || 0);
  });

  const showClipTextBoxOverlay = computed(() => {
    const d = props.clipTextBoxDisplay;
    if (!d?.enabled) return false;
    const t = clipTextRelativeTime.value;
    return t >= d.startTime && t < d.endTime;
  });

  const clipTextBoxPreviewScale = computed(() => {
    const ph = props.clipTextBoxDisplay?.previewHeight || 1080;
    const videoScaleFactor = containerHeight.value > 0 ? containerHeight.value / ph : 0.12;
    const aspect = parseAspectRatio(props.targetAspectRatio);
    const aspectRatioValue = aspect.width / aspect.height;
    let fontSizeScale = 1;
    if (aspectRatioValue <= 0.9) fontSizeScale = 0.65;
    else if (aspectRatioValue > 0.9 && aspectRatioValue <= 1.1) fontSizeScale = 0.78;
    return fontSizeScale * videoScaleFactor;
  });

  const clipTextDisplayText = computed(() => props.clipTextBoxDisplay?.text ?? '');

  const clipTextBoxContainerStyle = computed(() => {
    const pos = localClipTextPosition.value;
    const cap = Math.min(100, Math.max(12, pos.widthPct));
    return {
      position: 'absolute' as const,
      top: `${pos.y}%`,
      left: `${pos.x}%`,
      transform: 'translate(-50%, -50%)',
      width: 'max-content',
      maxWidth: `${cap}%`,
      boxSizing: 'border-box' as const,
    };
  });

  const clipTextPillStyle = computed(() => {
    const s = props.clipTextBoxDisplay?.style;
    if (!s) return {};
    const pad = Math.round((s.padding || 16) * clipTextBoxPreviewScale.value);
    const rad = Math.round((s.borderRadius || 24) * clipTextBoxPreviewScale.value);
    const st: Record<string, string> = {
      borderRadius: `${rad}px`,
      padding: `${pad}px`,
      boxSizing: 'border-box',
      width: 'auto',
      maxWidth: '100%',
    };
    if (s.backgroundEnabled) {
      st.backgroundColor = s.backgroundColor || '#FFFFFF';
    }
    return st;
  });

  const clipTextPillTextStyle = computed(() => {
    const s = props.clipTextBoxDisplay?.style;
    if (!s) return {};
    const baseFs = localClipTextFontSize.value ?? s.fontSize ?? 28;
    const fs = Math.round(baseFs * clipTextBoxPreviewScale.value);
    const tt = s.textTransform || 'none';
    return {
      fontFamily: `"${s.fontFamily}", Arial, sans-serif`,
      fontWeight: String(s.fontWeight ?? 700),
      fontSize: `${fs}px`,
      color: s.color || '#000000',
      textTransform: tt as string,
      lineHeight: String(s.lineHeight ?? 1.2),
      letterSpacing: `${(s.letterSpacing || 0) * clipTextBoxPreviewScale.value}px`,
    };
  });

  function startDragClipText(event: MouseEvent) {
    if (!containerRef.value || !props.clipTextBoxPositioningEnabled) return;
    isDraggingClipText.value = true;
    const rect = containerRef.value.getBoundingClientRect();
    const centerX = rect.left + (rect.width * localClipTextPosition.value.x) / 100;
    const centerY = rect.top + (rect.height * localClipTextPosition.value.y) / 100;
    clipTextDragOffset.value = {
      x: event.clientX - centerX,
      y: event.clientY - centerY,
    };
    document.addEventListener('mousemove', onClipTextDragMove);
    document.addEventListener('mouseup', onClipTextDragEnd);
    event.preventDefault();
  }

  function onClipTextDragMove(event: MouseEvent) {
    if (!isDraggingClipText.value || !containerRef.value) return;
    const rect = containerRef.value.getBoundingClientRect();
    let newX =
      ((event.clientX - clipTextDragOffset.value.x - rect.left) / rect.width) * 100;
    let newY =
      ((event.clientY - clipTextDragOffset.value.y - rect.top) / rect.height) * 100;
    const halfW = localClipTextPosition.value.widthPct / 2;
    newX = Math.max(halfW + 1, Math.min(100 - halfW - 1, newX));
    newY = Math.max(4, Math.min(96, newY));
    localClipTextPosition.value = {
      ...localClipTextPosition.value,
      x: newX,
      y: newY,
    };
  }

  function onClipTextDragEnd() {
    if (!isDraggingClipText.value) return;
    isDraggingClipText.value = false;
    document.removeEventListener('mousemove', onClipTextDragMove);
    document.removeEventListener('mouseup', onClipTextDragEnd);
    emit('clipTextBoxPositionChange', {
      x: localClipTextPosition.value.x,
      y: localClipTextPosition.value.y,
      widthPct: localClipTextPosition.value.widthPct,
      fontSize: localClipTextFontSize.value,
    });
  }

  function startClipTextResize(event: MouseEvent, corner: string) {
    if (!containerRef.value || !props.clipTextBoxPositioningEnabled) return;
    isResizingClipText.value = true;
    clipTextResizeStartX.value = event.clientX;
    clipTextResizeStartY.value = event.clientY;
    clipTextResizeStartFontSize.value = localClipTextFontSize.value;
    clipTextResizeCorner.value = corner as 'nw' | 'ne' | 'sw' | 'se';
    document.addEventListener('mousemove', onClipTextResizeMove);
    document.addEventListener('mouseup', onClipTextResizeEnd);
    event.preventDefault();
  }

  function onClipTextResizeMove(event: MouseEvent) {
    if (!isResizingClipText.value || !containerRef.value) return;
    const rect = containerRef.value.getBoundingClientRect();
    const dx = event.clientX - clipTextResizeStartX.value;
    const dy = event.clientY - clipTextResizeStartY.value;
    const c = clipTextResizeCorner.value;
    const signX = c === 'ne' || c === 'se' ? 1 : -1;
    const signY = c === 'sw' || c === 'se' ? 1 : -1;
    const delta = (dx * signX + dy * signY) / 2;
    const scaledDelta = (delta / rect.height) * 200;
    const newSize = Math.max(10, Math.min(120, clipTextResizeStartFontSize.value + scaledDelta));
    localClipTextFontSize.value = Math.round(newSize);
  }

  function onClipTextResizeEnd() {
    if (!isResizingClipText.value) return;
    isResizingClipText.value = false;
    document.removeEventListener('mousemove', onClipTextResizeMove);
    document.removeEventListener('mouseup', onClipTextResizeEnd);
    emit('clipTextBoxPositionChange', {
      x: localClipTextPosition.value.x,
      y: localClipTextPosition.value.y,
      widthPct: localClipTextPosition.value.widthPct,
      fontSize: localClipTextFontSize.value,
    });
  }

  function resetSourceFrameToCentered() {
    sourceFrameTransform.value.scale = 1.0;
    sourceFrameTransform.value.x = 0;
    sourceFrameTransform.value.y = 0;
  }

  function onToggleScale16(checked: boolean | 'indeterminate') {
    showSourceFrame.value = checked === true;
    if (checked === true) {
      use16x9Mode.value = false;
      resetSourceFrameToCentered();
    }
    emitSourceFraming();
  }

  function onToggleUse16x9(checked: boolean | 'indeterminate') {
    use16x9Mode.value = checked === true;
    if (checked === true) {
      showSourceFrame.value = false;
      resetSourceFrameToCentered();
    }
    emitSourceFraming();
  }

  const use16x9BgBlurPx = computed(() => {
    if (!use16x9Mode.value) return 0;
    return poiPreviewBgBlurPx(blurAmount.value);
  });

  const scaleSourceBlurStyle = computed(() => {
    if (!showSourceFrame.value || !blurEnabled.value) return {};
    return { filter: `blur(${poiPreviewBgBlurPx(blurAmount.value)}px)` };
  });

  function regionMediaSrc(assetId?: string | null): string {
    if (!assetId) return '';
    if (
      assetId.startsWith('blob:') ||
      assetId.startsWith('http://') ||
      assetId.startsWith('https://') ||
      assetId.startsWith('asset:')
    ) {
      return assetId;
    }
    try {
      return convertFileSrc(assetId);
    } catch {
      return assetId;
    }
  }

  function emitSourceFraming() {
    if (containerWidth.value <= 0 || containerHeight.value <= 0) return;
    const mode = use16x9Mode.value ? 'use16x9' : showSourceFrame.value ? 'scale' : 'none';
    const t = sourceFrameTransform.value;
    emit('updateSourceTransform', {
      mode,
      blurEnabled: blurEnabled.value,
      blurAmount: blurAmount.value,
      scale: t.scale,
      x: t.x / containerWidth.value,
      y: t.y / containerHeight.value,
    });
  }

  watch(
    () => props.initialSourceFraming,
    (v) => {
      if (v == null) lastHydratedFramingJson = '';
    }
  );

  watch(
    [() => props.initialSourceFraming, containerWidth, containerHeight],
    () => {
      const init = props.initialSourceFraming;
      if (!init || containerWidth.value <= 0 || containerHeight.value <= 0) return;
      const sig = JSON.stringify(init);
      if (sig === lastHydratedFramingJson) return;
      lastHydratedFramingJson = sig;
      use16x9Mode.value = init.mode === 'use16x9';
      showSourceFrame.value = init.mode === 'scale';
      // Set blur amount based on enabled state (0 = disabled, >0 = enabled)
      blurAmount.value = init.blurEnabled ? init.blurAmount : 0;
      sourceFrameTransform.value = {
        scale: init.scale,
        x: init.x * containerWidth.value,
        y: init.y * containerHeight.value,
      };
    },
    { deep: true }
  );

  watch(
    [showSourceFrame, use16x9Mode, blurEnabled, blurAmount, sourceFrameTransform],
    () => emitSourceFraming(),
    { deep: true }
  );

  watch([containerWidth, containerHeight], () => {
    emitSourceFraming();
    redrawSourcePreviews();
  });

  const masterVideoRef = ref<HTMLVideoElement | null>(null);
  const regionCanvasRefs = ref<Map<string, HTMLCanvasElement>>(new Map());
  const uploadedMediaVideoRefs = ref<Map<string, HTMLVideoElement>>(new Map());
  const use16x9BgCanvasRef = ref<HTMLCanvasElement | null>(null);
  const use16x9SharpCanvasRef = ref<HTMLCanvasElement | null>(null);
  const sourceFrameCanvasRef = ref<HTMLCanvasElement | null>(null);

  let previewRafId: number | null = null;

  function regionLabel(region: ManualRegion): string {
    return getRegionDisplayLabel(region, getRegionIndex(region.id));
  }

  function setRegionCanvasRef(regionId: string, el: HTMLCanvasElement | null) {
    if (el) {
      regionCanvasRefs.value.set(regionId, el);
    } else {
      regionCanvasRefs.value.delete(regionId);
    }
  }

  function setUploadedMediaVideoRef(regionId: string, el: HTMLVideoElement | null) {
    if (el) {
      uploadedMediaVideoRefs.value.set(regionId, el);
    } else {
      uploadedMediaVideoRefs.value.delete(regionId);
    }
  }

  function setupCanvasPixels(canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(1, Math.round(rect.width * dpr));
    const h = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return { w, h };
  }

  function drawVideoCover(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    cw: number,
    ch: number,
  ) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.max(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.drawImage(video, dx, dy, dw, dh);
  }

  function drawVideoContain(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    cw: number,
    ch: number,
  ) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return;
    const scale = Math.min(cw / vw, ch / vh);
    const dw = vw * scale;
    const dh = vh * scale;
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.drawImage(video, dx, dy, dw, dh);
  }

  function drawRegionCrop(
    ctx: CanvasRenderingContext2D,
    video: HTMLVideoElement,
    region: ManualRegion,
    cw: number,
    ch: number,
  ) {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh || !region.source.width || !region.source.height) return;
    const sx = region.source.x * vw;
    const sy = region.source.y * vh;
    const sw = region.source.width * vw;
    const sh = region.source.height * vh;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, cw, ch);
  }

  function redrawSourcePreviews() {
    const video = masterVideoRef.value;
    if (!video || video.readyState < 2) return;

    if (use16x9Mode.value && use16x9BgCanvasRef.value) {
      const canvas = use16x9BgCanvasRef.value;
      const { w, h } = setupCanvasPixels(canvas);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        drawVideoCover(ctx, video, w, h);
      }
    }

    if (use16x9Mode.value && use16x9SharpCanvasRef.value) {
      const canvas = use16x9SharpCanvasRef.value;
      const { w, h } = setupCanvasPixels(canvas);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        drawVideoContain(ctx, video, w, h);
      }
    }

    if (showSourceFrame.value && sourceFrameCanvasRef.value) {
      const canvas = sourceFrameCanvasRef.value;
      const { w, h } = setupCanvasPixels(canvas);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        drawVideoCover(ctx, video, w, h);
      }
    }

    for (const region of props.regions) {
      if (region.mediaAssetId) continue;
      const canvas = regionCanvasRefs.value.get(region.id);
      if (!canvas || !props.videoUrl) continue;
      const { w, h } = setupCanvasPixels(canvas);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, w, h);
        drawRegionCrop(ctx, video, region, w, h);
      }
    }
  }

  function syncVideoElementTime(video: HTMLVideoElement, time: number) {
    if (Math.abs(video.currentTime - time) > 0.1) {
      video.currentTime = time;
      if (props.isPlaying) {
        video.play().catch(() => {});
      }
    }
  }

  function syncAllVideoTimes(time: number) {
    if (masterVideoRef.value) {
      syncVideoElementTime(masterVideoRef.value, time);
    }
    uploadedMediaVideoRefs.value.forEach((video) => {
      syncVideoElementTime(video, time);
    });
  }

  function onMasterVideoLoaded() {
    syncAllVideoTimes(props.videoTime ?? 0);
    redrawSourcePreviews();
    if (props.isPlaying) {
      masterVideoRef.value?.play().catch(() => {});
      startPreviewLoop();
    }
  }

  function onUploadedMediaVideoLoaded(video: HTMLVideoElement) {
    syncVideoElementTime(video, props.videoTime ?? 0);
    if (props.isPlaying) {
      video.play().catch(() => {});
    }
  }

  function startPreviewLoop() {
    if (previewRafId !== null) return;
    const tick = () => {
      redrawSourcePreviews();
      if (props.isPlaying) {
        previewRafId = requestAnimationFrame(tick);
      } else {
        previewRafId = null;
      }
    };
    previewRafId = requestAnimationFrame(tick);
  }

  function stopPreviewLoop() {
    if (previewRafId !== null) {
      cancelAnimationFrame(previewRafId);
      previewRafId = null;
    }
  }

  watch(
    () => props.isPlaying,
    (playing) => {
      if (masterVideoRef.value) {
        if (playing) {
          masterVideoRef.value.play().catch(() => {});
          startPreviewLoop();
        } else {
          masterVideoRef.value.pause();
          stopPreviewLoop();
          redrawSourcePreviews();
        }
      }
      uploadedMediaVideoRefs.value.forEach((video) => {
        if (playing) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
  );

  watch(
    () => props.videoTime,
    (time) => {
      syncAllVideoTimes(time);
      redrawSourcePreviews();
    },
    { immediate: true },
  );

  watch(
    () => props.regions,
    () => {
      redrawSourcePreviews();
    },
    { deep: true },
  );

  watch([showSourceFrame, use16x9Mode, () => props.videoUrl], () => {
    redrawSourcePreviews();
  });

  // Compute source frame style (16:9 frame positioned in 9:16 container)
  const sourceFrameStyle = computed(() => {
    const transform = sourceFrameTransform.value;
    
    // For 16:9 source in 9:16 container:
    // - 16:9 is wider (aspect ~1.78)
    // - 9:16 is taller (aspect ~0.56)
    // - Base size: fit 16:9 to container WIDTH (so entire frame is visible, letterboxed)
    // - Then apply scale to zoom in/out
    
    const sourceAspect = 16 / 9;
    
    // Fit to WIDTH for 16:9 in portrait container (letterbox effect)
    // Base dimensions at scale 1.0
    const baseWidth = containerWidth.value;
    const baseHeight = baseWidth / sourceAspect;
    
    // Apply scale
    const width = baseWidth * transform.scale;
    const height = baseHeight * transform.scale;
    
    // Center by default, then apply transform offset
    const left = (containerWidth.value - width) / 2 + transform.x;
    const top = (containerHeight.value - height) / 2 + transform.y;
    
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  });

  // Start dragging source frame
  function startDragSourceFrame(e: MouseEvent) {
    e.preventDefault();
    isDraggingSourceFrame.value = true;
    dragStartPos.value = { x: e.clientX, y: e.clientY };
    dragStartTransform.value = { x: sourceFrameTransform.value.x, y: sourceFrameTransform.value.y };
    
    document.addEventListener('mousemove', onDragSourceFrame);
    document.addEventListener('mouseup', stopDragSourceFrame);
  }

  // Handle source frame drag with snap-to-center
  function onDragSourceFrame(e: MouseEvent) {
    if (!isDraggingSourceFrame.value) return;
    
    const deltaX = e.clientX - dragStartPos.value.x;
    const deltaY = e.clientY - dragStartPos.value.y;
    
    let newX = dragStartTransform.value.x + deltaX;
    let newY = dragStartTransform.value.y + deltaY;
    
    // Check for center snap (x=0 means horizontally centered, y=0 means vertically centered)
    const nearVerticalCenter = Math.abs(newX) < SNAP_THRESHOLD;
    const nearHorizontalCenter = Math.abs(newY) < SNAP_THRESHOLD;
    
    // Snap to center if close
    if (nearVerticalCenter) newX = 0;
    if (nearHorizontalCenter) newY = 0;
    
    // Show/hide center guides
    showVerticalCenterGuide.value = nearVerticalCenter;
    showHorizontalCenterGuide.value = nearHorizontalCenter;
    
    sourceFrameTransform.value.x = newX;
    sourceFrameTransform.value.y = newY;
  }

  // Stop dragging source frame
  function stopDragSourceFrame() {
    isDraggingSourceFrame.value = false;
    showVerticalCenterGuide.value = false;
    showHorizontalCenterGuide.value = false;
    document.removeEventListener('mousemove', onDragSourceFrame);
    document.removeEventListener('mouseup', stopDragSourceFrame);
  }

  // Start resizing source frame (corner drag)
  function startResizeSourceFrame(e: MouseEvent, corner: string) {
    e.preventDefault();
    e.stopPropagation();
    
    const startScale = sourceFrameTransform.value.scale;
    const startX = e.clientX;
    const startY = e.clientY;
    
    const onResize = (e: MouseEvent) => {
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      
      // Calculate direction based on corner
      // For all corners, dragging outward (positive delta) should increase scale
      let scaleDelta = 0;
      if (corner === 'se' || corner === 'ne') {
        // Right corners: positive X = scale up
        scaleDelta = deltaX / 200;
      } else {
        // Left corners: negative X = scale up
        scaleDelta = -deltaX / 200;
      }
      
      sourceFrameTransform.value.scale = Math.max(0.5, Math.min(5, startScale + scaleDelta));
    };
    
    const stopResize = () => {
      document.removeEventListener('mousemove', onResize);
      document.removeEventListener('mouseup', stopResize);
    };
    
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
  }

  // Parse aspect ratio string to numbers
  function parseAspectRatio(ratio: string): { width: number; height: number } {
    const [w, h] = ratio.split(':').map(Number);
    return { width: w || 16, height: h || 9 };
  }

  // Calculate watermark preview style (positioned at percentage-based coordinates)
  const watermarkPreviewStyle = computed(() => {
    if (!props.watermarkPreview) return {};
    
    const { x, y, scale } = props.watermarkPreview;
    
    // Watermark size as percentage of container width
    const sizePercent = scale;
    
    // Position is center-point based (like CSS transform: translate(-50%, -50%))
    return {
      width: `${sizePercent}%`,
      height: 'auto',
      aspectRatio: '3/1', // Approximate watermark aspect ratio for preview
      left: `${x}%`,
      top: `${y}%`,
      transform: 'translate(-50%, -50%)',
    };
  });

  // Calculate appropriate box width based on animation style
  const computedSubtitleBoxWidth = computed(() => {
    const baseWidth = localSubtitlePosition.value.width ?? 80;
    
    if (!props.subtitleSettings) return baseWidth;
    
    // For single-word style, use a smaller width to fit just one word
    if (props.subtitleSettings.animationStyle === 'single-word') {
      // Single word boxes should be narrower - around 35-45% depending on font size
      // Larger fonts need slightly wider boxes
      const fontSize = props.subtitleSettings.fontSize || 65;
      const singleWordWidth = Math.min(50, Math.max(30, 25 + (fontSize / 10)));
      return singleWordWidth;
    }
    
    return baseWidth;
  });

  /** Taller box when multiple transcript words so flex-wrap / two lines are not clipped (fixed 10% hid words). */
  const subtitlePreviewBoxHeightPct = computed(() => {
    if (props.subtitleSettings?.animationStyle === 'single-word') return 10;
    const n = props.transcriptWords?.length ?? 0;
    return n > 1 ? 18 : 10;
  });

  // Subtitle box — positioned as absolute rect using x/y as center, width as %
  const subtitleBoxStyle = computed(() => {
    const pos = localSubtitlePosition.value;
    const w = computedSubtitleBoxWidth.value;
    const h = subtitlePreviewBoxHeightPct.value;
    // x/y are center percentages → convert to left/top
    const left = pos.x - w / 2;
    const top = pos.y - h / 2;
    return {
      left: `${left}%`,
      top: `${top}%`,
      width: `${w}%`,
      height: `${h}%`,
    };
  });

  // Subtitle text style — scaled for the POI preview canvas
  // Container is ~214px wide for 9:16, ~240px for 16:9
  const subtitleTextStyle = computed(() => {
    if (!props.subtitleSettings) return {};
    const settings = props.subtitleSettings;
    const aspect = parseAspectRatio(props.targetAspectRatio);
    const ar = aspect.width / aspect.height;
    // Scale font for preview canvas
    // For portrait (9:16): container ~214px wide, output 1080px → scale ~0.20
    // For landscape (16:9): container ~240px wide, output 1920px → scale ~0.125
    // For square (1:1): container ~240px wide, output 1080px → scale ~0.22
    const scale = ar < 0.9 ? 0.20 : ar < 1.2 ? 0.22 : 0.125;
    // Do not floor too high: preview canvas is small (fontSize*scale is often 6–20px);
    // a high min hid real font size changes when resizing the subtitle box in POI.
    const fs = Math.max(1, Math.round(settings.fontSize * scale));
    const stroke = settings.border1Width > 0
      ? `${settings.border1Color} 0 0 0 ${settings.border1Width * scale}px`
      : undefined;
    
    const styles: any = {
      fontSize: `${fs}px`,
      fontFamily: settings.fontFamily,
      fontWeight: String(settings.fontWeight),
      color: settings.textColor,
      WebkitTextStroke: stroke,
      lineHeight: String(settings.lineHeight || 1.2),
      letterSpacing: `${settings.letterSpacing}px`,
    };
    
    // Add uppercase for single-word style (CapCut-style)
    if (settings.animationStyle === 'single-word') {
      styles.textTransform = 'uppercase';
    }
    
    // Add background if enabled
    if (settings.backgroundEnabled && settings.backgroundColor !== 'transparent') {
      styles.backgroundColor = settings.backgroundColor;
      styles.padding = '2px 6px';
      styles.borderRadius = '2px';
    }
    
    // Add shadow if configured
    if (settings.shadowBlur > 0) {
      styles.textShadow = `${settings.shadowOffsetX}px ${settings.shadowOffsetY}px ${settings.shadowBlur}px ${settings.shadowColor}`;
    }
    
    return styles;
  });
  
  // Compute visible words — same rules as VideoPlayer (no ±20s window, no full-segment dump on gaps)
  const visibleWords = computed((): WordInfo[] => {
    if (!props.subtitleSettings) return [];
    const absoluteTime = props.videoTime || 0;
    const clipRelativeTime = absoluteTime - (props.clipStartTime || 0);
    return getVisibleSubtitleWordsForClipTime(
      clipRelativeTime,
      props.transcriptWords,
      props.transcriptSegments,
      props.subtitleSettings.animationStyle,
      props.targetAspectRatio
    );
  });

  /** Placeholder copy only when there is no transcript — never join the full transcript on silence/gaps */
  const subtitlePreviewFallbackText = computed(() => {
    if (!props.subtitleSettings) return 'Sample Text';
    if (visibleWords.value.length > 0) return '';

    if (props.transcriptWords && props.transcriptWords.length > 0) {
      return '';
    }

    const style = props.subtitleSettings.animationStyle;
    if (style === 'single-word') return 'WORD';
    return 'Sample subtitle text';
  });

  // Check if a word is currently being spoken (highlight / motion)
  function isCurrentWord(word: WordInfo): boolean {
    const animationStyle = props.subtitleSettings?.animationStyle;
    if (animationStyle === 'single-word') {
      return visibleWords.value.some(
        (w) => w.start === word.start && w.end === word.end && w.word === word.word
      );
    }

    const absoluteTime = props.videoTime || 0;
    const clipRelativeTime = absoluteTime - (props.clipStartTime || 0);

    if (clipRelativeTime >= word.start && clipRelativeTime < word.end) {
      return true;
    }

    const LOOK_BACK_TOLERANCE = 0.05;
    const timeSinceWordStart = clipRelativeTime - word.start;

    if (timeSinceWordStart > 0 && timeSinceWordStart <= LOOK_BACK_TOLERANCE) {
      if (clipRelativeTime < word.end) {
        return true;
      }
    }

    return false;
  }

  // Get word color for multi-color mode
  function getWordColor(wordIndex: number): string {
    if (!props.subtitleSettings?.multiColorEnabled) {
      return props.subtitleSettings?.textColor || '#FFFFFF';
    }

    const palette = props.subtitleSettings.colorPalette && props.subtitleSettings.colorPalette.length > 0
      ? props.subtitleSettings.colorPalette
      : ['#04F827', '#0ea5e9', '#FFFD03', '#FFFFFF']; // Default: Green, Cyan, Yellow, White
    
    return palette[wordIndex % palette.length];
  }

  // Get word index in full transcript (for color rotation)
  function getWordIndexInTranscript(word: WordInfo): number {
    return props.transcriptWords?.findIndex(w => w.start === word.start && w.end === word.end) || 0;
  }

  function subtitleWordPreviewMotionStyle(wordInfo: WordInfo): Record<string, string> {
    if (!props.subtitleSettings || !isCurrentWord(wordInfo)) return {};
    const style = props.subtitleSettings.animationStyle;
    if (style === 'zoom') return { transform: 'scale(1.14)', transformOrigin: 'bottom center' };
    if (style === 'pop') return { transform: 'scale(1.1)', transformOrigin: 'bottom center' };
    if (style === 'wave') return { transform: 'translateY(-3px)' };
    return {};
  }

  function subtitleWordSvgFillStyle(wordInfo: WordInfo): Record<string, string> {
    if (!props.subtitleSettings) return {};
    const s = props.subtitleSettings;
    const active = isCurrentWord(wordInfo);
    const hl = s.highlightColor || '#0ea5e9';
    const base = s.textColor || '#FFFFFF';

    let fill = base;
    if (s.animationStyle === 'single-word') {
      fill = getWordColor(getWordIndexInTranscript(wordInfo));
    } else if (active && (s.animationStyle === 'karaoke' || s.animationStyle === 'glow')) {
      fill = hl;
    }

    const fs = subtitleTextStyle.value.fontSize ?? '12px';
    const st: Record<string, string> = {
      fontFamily: s.fontFamily,
      fontWeight: String(s.fontWeight),
      fontSize: typeof fs === 'number' ? `${fs}px` : String(fs),
      fill,
    };

    if (active && s.animationStyle === 'glow') {
      st.filter = `drop-shadow(0 0 6px ${hl})`;
    }

    return st;
  }

  // Calculate overlay preview style
  function getOverlayStyle(overlay: OverlayPreview) {
    if (overlay.isFullFrame) {
      return {
        left: '0%',
        top: '0%',
        width: '100%',
        height: '100%',
      };
    }
    return {
      left: `${overlay.x}%`,
      top: `${overlay.y}%`,
      transform: 'translate(-50%, -50%)',
      width: `${overlay.scale}%`,
      height: 'auto',
    };
  }

  // Calculate container style to maintain target aspect ratio
  // Sized to fit well within the panel while being large enough for accurate preview
  const containerStyle = computed(() => {
    const aspect = parseAspectRatio(props.targetAspectRatio);
    const aspectRatio = aspect.width / aspect.height;

    // Balanced sizes - large enough for accurate preview, small enough to fit
    const maxWidth = 240;
    const maxHeight = 380;

    let width: number;
    let height: number;

    if (aspectRatio < 1) {
      // Portrait - height constrained
      height = maxHeight;
      width = height * aspectRatio;
      if (width > maxWidth) {
        width = maxWidth;
        height = width / aspectRatio;
      }
    } else {
      // Landscape or square
      width = maxWidth;
      height = width / aspectRatio;
      if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
      }
    }

    return {
      width: `${width}px`,
      height: `${height}px`,
    };
  });

  // Get region index for labeling
  function getRegionIndex(id: string): number {
    return props.regions.findIndex((r) => r.id === id);
  }

  // Scale a design-space corner radius (px at 1080px output width) to preview CSS pixels.
  function getScaledCornerRadius(region: ManualRegion): number {
    if (!region.cornerRadiusEnabled || !region.cornerRadiusPx) return 0;
    const previewWidthPx = containerWidth.value * region.output.width;
    const scaleFactor = previewWidthPx / 1080;
    return Math.max(1, Math.round(region.cornerRadiusPx * scaleFactor));
  }

  // Get style for region preview container
  function getRegionPreviewStyle(region: ManualRegion) {
    const style: Record<string, string> = {
      left: `${region.output.x * 100}%`,
      top: `${region.output.y * 100}%`,
      width: `${region.output.width * 100}%`,
      height: `${region.output.height * 100}%`,
    };
    const scaledRadius = getScaledCornerRadius(region);
    if (scaledRadius > 0) {
      style.borderRadius = `${scaledRadius}px`;
      style.overflow = 'hidden';
      // translateZ(0) forces a GPU compositing layer so Chromium/WebView
      // correctly clips <video> children to the parent's border-radius
      style.transform = 'translateZ(0)';
    }
    return style;
  }

  // Calculate the cropped image/video style to show only the source selection
  // The media is scaled up so the source crop fills the output container,
  // then positioned so the crop area aligns with the container's top-left
  function getCroppedImageStyle(region: ManualRegion) {
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
      objectFit: 'fill' as const, // Force video/image to fill exact dimensions, ignoring aspect ratio
    };
  }

  // Update a region's output rect
  function updateRegionOutput(id: string, rect: ManualRegionRect) {
    emit('updateRegion', id, { output: rect });
  }

  // Select a region
  function selectRegion(id: string) {
    emit('selectRegion', id);
  }

  // Auto-arrange regions vertically (stack them)
  function autoArrangeVertical() {
    if (props.regions.length === 0) return;

    const regionCount = props.regions.length;
    const heightPerRegion = 1 / regionCount;

    props.regions.forEach((region, index) => {
      emit('updateRegion', region.id, {
        output: {
          x: 0,
          y: index * heightPerRegion,
          width: 1,
          height: heightPerRegion,
        },
      });
    });
  }

  // Track drag state
  const isDragging = ref(false);

  function onDragStart() {
    isDragging.value = true;
  }

  function onDragEnd() {
    isDragging.value = false;
  }

  // Handle center guide visibility from child components
  function onCenterGuide(guide: { vertical: boolean; horizontal: boolean }) {
    showVerticalCenterGuide.value = guide.vertical;
    showHorizontalCenterGuide.value = guide.horizontal;
  }

  // Subtitle dragging functions
  function startDragSubtitles(event: MouseEvent) {
    if (!containerRef.value) return;

    isDraggingSubtitles.value = true;
    const rect = containerRef.value.getBoundingClientRect();
    
    // Calculate the drag offset from the subtitle center
    const centerX = rect.left + (rect.width * localSubtitlePosition.value.x / 100);
    const centerY = rect.top + (rect.height * localSubtitlePosition.value.y / 100);
    
    subtitleDragOffset.value = {
      x: event.clientX - centerX,
      y: event.clientY - centerY,
    };

    // Add global mouse listeners
    document.addEventListener('mousemove', onSubtitleDragMove);
    document.addEventListener('mouseup', onSubtitleDragEnd);
    
    event.preventDefault();
  }

  function onSubtitleDragMove(event: MouseEvent) {
    if (!isDraggingSubtitles.value || !containerRef.value) return;

    const rect = containerRef.value.getBoundingClientRect();
    
    // Calculate new position as percentage
    let newX = ((event.clientX - subtitleDragOffset.value.x - rect.left) / rect.width) * 100;
    let newY = ((event.clientY - subtitleDragOffset.value.y - rect.top) / rect.height) * 100;
    
    // Use computed box width (accounts for animation style)
    const boxWidth = computedSubtitleBoxWidth.value;
    const halfBoxWidth = boxWidth / 2;
    
    // Constrain X so the text box doesn't extend past canvas edges
    // The box is centered at x, so ensure x - halfWidth >= 0 and x + halfWidth <= 100
    const minX = halfBoxWidth + 1; // 1% padding from edge
    const maxX = 100 - halfBoxWidth - 1;
    
    // Constrain Y with reasonable bounds
    const minY = 6;
    const maxY = 94;
    
    let constrainedX = Math.max(minX, Math.min(maxX, newX));
    let constrainedY = Math.max(minY, Math.min(maxY, newY));
    
    // Snap to center (50% for subtitles)
    const snapThresholdPercent = (SNAP_THRESHOLD / rect.width) * 100;
    const nearVerticalCenter = Math.abs(constrainedX - 50) < snapThresholdPercent;
    const nearHorizontalCenter = Math.abs(constrainedY - 50) < snapThresholdPercent;
    
    if (nearVerticalCenter) constrainedX = 50;
    if (nearHorizontalCenter) constrainedY = 50;
    
    // Show/hide center guides
    showVerticalCenterGuide.value = nearVerticalCenter;
    showHorizontalCenterGuide.value = nearHorizontalCenter;
    
    localSubtitlePosition.value = {
      ...localSubtitlePosition.value,
      x: constrainedX,
      y: constrainedY,
    };
    
    // Emit position change
    emit('subtitlePositionChange', { ...localSubtitlePosition.value });
  }

  function onSubtitleDragEnd() {
    isDraggingSubtitles.value = false;
    showVerticalCenterGuide.value = false;
    showHorizontalCenterGuide.value = false;
    document.removeEventListener('mousemove', onSubtitleDragMove);
    document.removeEventListener('mouseup', onSubtitleDragEnd);
  }

  // Resize subtitle box by dragging corners
  function startResizeSubtitles(event: MouseEvent, corner: string) {
    console.log('[POITargetPanel] startResizeSubtitles called:', { corner, containerExists: !!containerRef.value });
    const subtitleSettingsSnapshot = props.subtitleSettings;
    if (!containerRef.value || !subtitleSettingsSnapshot) return;
    isResizingSubtitles.value = true;

    const rect = containerRef.value.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = localSubtitlePosition.value.width ?? 80;
    const startCenterX = localSubtitlePosition.value.x;
    const startFontSize = subtitleSettingsSnapshot.fontSize || 32;

    console.log('[POITargetPanel] Resize started:', {
      corner,
      startWidth,
      startFontSize,
      startCenterX
    });

    const onMove = (e: MouseEvent) => {
      // Combine X and Y so corner drags (mostly vertical or diagonal) still resize, like the clip
      // text box. In screen space, y grows downward.
      const deltaXPct = ((e.clientX - startX) / rect.width) * 100;
      const deltaYPct = ((e.clientY - startY) / rect.height) * 100;
      // Positive deltaExpand = drag “outward” from center for each corner
      let deltaExpand = 0;
      if (corner === 'se') deltaExpand = deltaXPct + deltaYPct;
      else if (corner === 'ne') deltaExpand = deltaXPct - deltaYPct;
      else if (corner === 'sw') deltaExpand = -deltaXPct + deltaYPct;
      else if (corner === 'nw') deltaExpand = -deltaXPct - deltaYPct;

      const newWidth = Math.max(20, Math.min(100, startWidth + deltaExpand * 2));
      const newCenterX = startCenterX;

      // Calculate font size directly from box width ratio
      // This creates a 1:1 correlation between box size and font size
      const widthRatio = newWidth / startWidth;
      const newFontSize = Math.round(Math.max(12, Math.min(120, startFontSize * widthRatio)));

      // Clamp width to leave margin at edges (max 96% to leave 2% on each side)
      const clampedWidth = Math.min(newWidth, 96);
      const halfWidth = clampedWidth / 2;
      
      localSubtitlePosition.value = {
        ...localSubtitlePosition.value,
        x: Math.max(halfWidth + 2, Math.min(100 - halfWidth - 2, newCenterX)),
        width: clampedWidth,
      };
      
      // Emit both position and settings changes
      emit('subtitlePositionChange', { ...localSubtitlePosition.value });
      
      const base = props.subtitleSettings ?? subtitleSettingsSnapshot;
      emit('subtitleSettingsChange', { ...base, fontSize: newFontSize });
    };

    const onUp = () => {
      isResizingSubtitles.value = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    event.preventDefault();
  }

  // Update container dimensions
  function updateContainerDimensions() {
    if (containerRef.value) {
      containerWidth.value = containerRef.value.offsetWidth;
      containerHeight.value = containerRef.value.offsetHeight;
    }
  }

  // ResizeObserver for responsive sizing
  let resizeObserver: ResizeObserver | null = null;

  onMounted(() => {
    updateContainerDimensions();

    if (containerRef.value) {
      resizeObserver = new ResizeObserver(updateContainerDimensions);
      resizeObserver.observe(containerRef.value);
    }

    // Click outside handler for blur dropdown
    document.addEventListener('click', handleClickOutsideBlur);
  });

  onUnmounted(() => {
    stopPreviewLoop();
    if (resizeObserver) {
      resizeObserver.disconnect();
    }
    // Clean up subtitle drag listeners
    document.removeEventListener('mousemove', onSubtitleDragMove);
    document.removeEventListener('mouseup', onSubtitleDragEnd);
    document.removeEventListener('mousemove', onClipTextDragMove);
    document.removeEventListener('mouseup', onClipTextDragEnd);
    document.removeEventListener('mousemove', onClipTextResizeMove);
    document.removeEventListener('mouseup', onClipTextResizeEnd);
    // Clean up blur dropdown click handler
    document.removeEventListener('click', handleClickOutsideBlur);
  });

  // Watch for subtitle position prop changes
  watch(
    () => props.subtitlePosition,
    (newPosition) => {
      if (newPosition) {
        localSubtitlePosition.value = { ...newPosition };
      }
    },
    { immediate: true }
  );

  // Watch for aspect ratio changes
  watch(
    () => props.targetAspectRatio,
    () => {
      setTimeout(updateContainerDimensions, 0);
    }
  );
</script>

<style scoped>
  .poi-target-panel {
    background: linear-gradient(to bottom, rgb(24 24 27 / 0.8), rgb(24 24 27 / 0.95));
  }

  /* Subtitle dragging styles */
  .subtitle-selection-box {
    position: relative;
    border: 2px dashed rgba(147, 51, 234, 0.5);
    border-radius: 8px;
    padding: 4px;
    transition: all 0.2s ease;
  }

  .subtitle-selection-box:hover {
    border-color: rgba(147, 51, 234, 0.8);
    background: rgba(147, 51, 234, 0.05);
  }

  .subtitle-selection-box.is-active {
    border-color: rgba(147, 51, 234, 1);
    background: rgba(147, 51, 234, 0.1);
  }

  .subtitle-drag-bar {
    position: absolute;
    top: -12px;
    left: 0;
    right: 0;
    height: 12px;
    background: rgba(147, 51, 234, 0.8);
    border-radius: 4px 4px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: grab;
  }

  .subtitle-drag-bar:hover {
    background: rgba(147, 51, 234, 1);
  }

  .subtitle-drag-label {
    font-size: 8px;
    color: white;
    font-weight: 500;
    user-select: none;
  }

  .subtitle-text-container {
    user-select: none;
  }

</style>
