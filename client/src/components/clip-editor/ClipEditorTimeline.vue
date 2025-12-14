<template>
  <div class="bg-gradient-to-t from-[#0a0a0a]/50 to-[#0a0a0a]/20 transition-all duration-300 ease-in-out">
    <div class="pt-3 px-4 pb-3 flex flex-col">
      <!-- Timeline Header -->
      <div class="flex items-center justify-between mb-3 pr-1 flex-shrink-0">
        <div class="flex items-center gap-2">
          <!-- Timeline Toolbar -->
          <!-- Zoom Slider -->
          <div
            class="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-2 border border-white/[0.04]"
          >
            <ZoomIn :size="14" class="text-white/40" />
            <input
              type="range"
              :min="1"
              :max="5"
              :step="0.1"
              v-model.number="zoomLevel"
              class="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer slider-zoom"
            />
            <span class="text-[10px] text-white/50 text-right font-mono tabular-nums w-8">
              {{ Math.round(zoomLevel * 100) }}%
            </span>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <!-- Show segment count if multiple segments -->
          <span
            v-if="sortedTrimSegments.length > 1"
            class="text-[10px] text-violet-400/70 bg-violet-500/10 px-2 py-1 rounded-md"
          >
            {{ sortedTrimSegments.length }} segments
          </span>
          <span class="text-[10px] text-white/40 bg-white/[0.04] px-2 py-1 rounded-md">
            {{ formatTime(totalDuration) }}
          </span>
        </div>
      </div>

      <!-- Timeline Tracks Container -->
      <div
        ref="timelineScrollContainer"
        class="pr-1 bg-[#101010] border border-white/[0.04] rounded-lg relative overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800 backdrop-blur-sm"
        @mousemove="onTimelineMouseMove"
        @mouseleave="onTimelineMouseLeave"
      >
        <!-- Timeline Content Wrapper - handles zoom width -->
        <div
          ref="contentWrapperRef"
          class="timeline-content-wrapper relative"
          :class="{ dragging: isDragging || isResizing }"
          :style="{ width: `${100 * zoomLevel}%`, minHeight: '100%' }"
        >
          <!-- Segmented Timestamp Ruler -->
          <div
            class="h-8 border-b border-border/30 flex items-center bg-[#0a0a0a]/40 sticky top-0 z-50 backdrop-blur-sm timeline-ruler"
            @wheel="onRulerWheel"
            title="Scroll to zoom"
          >
            <!-- Track label spacer -->
            <div
              class="w-16 h-7 pr-2 mr-0.5 flex items-center justify-center flex-shrink-0 sticky left-0 z-[70] bg-[#0a0a0a]"
            >
              <span class="text-xs text-muted-foreground/50 font-medium">Time</span>
            </div>
            <!-- Segmented timestamp ruler -->
            <div
              ref="rulerContentRef"
              class="flex-1 relative h-full flex items-center cursor-pointer"
              @click="onRulerClick"
            >
              <!-- Render each segment region in the ruler -->
              <template v-for="(segmentLayout, index) in segmentLayouts" :key="segmentLayout.segment.id">
                <!-- Segment region with ticks -->
                <div
                  class="absolute h-full"
                  :style="{
                    left: `${segmentLayout.startPercent}%`,
                    width: `${segmentLayout.widthPercent}%`,
                  }"
                >
                  <!-- Segment start time (always shown) -->
                  <div
                    class="absolute flex flex-col items-center"
                    :style="{ left: '0%', transform: 'translateX(-50%)', bottom: '0' }"
                  >
                    <div class="w-px bg-violet-400/60 h-4"></div>
                    <span class="text-[10px] text-violet-400/80 whitespace-nowrap font-medium mt-0.5 ml-4">
                      {{ formatTime(segmentLayout.effectiveStartTime) }}
                    </span>
                  </div>

                  <!-- Intermediate tick marks within segment -->
                  <div
                    v-for="tick in segmentLayout.ticks"
                    :key="tick.time"
                    class="absolute flex flex-col items-center"
                    :style="{ left: `${tick.positionInSegment}%`, transform: 'translateX(-50%)', bottom: '0' }"
                  >
                    <div class="w-px bg-foreground/20 timeline-tick" :class="tick.isMajor ? 'h-4' : 'h-2'"></div>
                    <span
                      v-if="tick.isMajor"
                      class="text-[10px] text-foreground/40 whitespace-nowrap font-normal mt-0.5"
                    >
                      {{ formatTime(tick.time) }}
                    </span>
                  </div>

                  <!-- Segment end time (only shown for last segment to avoid duplicate labels) -->
                  <div
                    v-if="index === segmentLayouts.length - 1"
                    class="absolute flex flex-col items-center"
                    :style="{ left: '100%', transform: 'translateX(-50%)', bottom: '0' }"
                  >
                    <div class="w-px bg-violet-400/60 h-4"></div>
                    <span class="text-[10px] text-violet-400/80 whitespace-nowrap font-medium mt-0.5 -ml-6">
                      {{ formatTime(segmentLayout.effectiveEndTime) }}
                    </span>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Video Track -->
          <div class="flex items-center h-12 border-b border-border/20 relative">
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-0 z-[70] bg-[#101010] flex-shrink-0"
            >
              <div>
                <div class="font-medium flex items-center gap-1">
                  <Film :size="12" />
                  Video
                </div>
              </div>
            </div>
            <div
              ref="videoTrackContentRef"
              class="flex-1 h-8 relative"
              @click="onTrackContentClick"
              @dragover.prevent="onTimelineDragOver"
              @drop.prevent="onTimelineDrop"
            >
              <!-- Background -->
              <div class="absolute inset-0 bg-[#0a0a0a]/50 rounded-md cursor-pointer"></div>

              <!-- Editor Mode: Video Sources -->
              <template v-if="editorMode">
                <!-- Empty state drop zone -->
                <div
                  v-if="videoSources.length === 0"
                  class="absolute inset-0 flex items-center justify-center border-2 border-dashed border-white/10 rounded-md"
                  :class="{ 'border-violet-500/50 bg-violet-500/5': isDragOverTimeline }"
                >
                  <span class="text-xs text-white/30">Drop sources here</span>
                </div>

                <!-- Video source segments -->
                <div
                  v-for="source in videoSources"
                  :key="source.id"
                  :ref="(el) => setSegmentRef(el, 'source', source.id)"
                  class="clip-segment absolute top-1 bottom-1 rounded-md overflow-hidden group cursor-pointer"
                  :class="getSegmentClasses('source', source.id)"
                  :style="getVideoSourceStyle(source)"
                  @mousedown="(e) => onSourceMouseDown(e, source)"
                  @click.stop="(e) => onSourceClick(e, source)"
                >
                  <!-- Source background gradient -->
                  <div class="absolute inset-0 bg-gradient-to-r from-violet-900/30 to-indigo-900/20"></div>

                  <!-- Thumbnail preview - thumbnails would need to be pre-loaded as data URLs -->
                  <!-- For now, showing gradient background only -->

                  <!-- Source label -->
                  <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <span
                      class="text-xs text-white font-medium drop-shadow-md bg-black/60 px-1.5 py-0.5 rounded truncate max-w-full"
                    >
                      {{ source.source_name || 'Untitled' }}
                    </span>
                  </div>

                  <!-- Left resize handle -->
                  <div
                    class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onSourceResizeMouseDown(e, source, 'left')"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                  <!-- Right resize handle -->
                  <div
                    class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onSourceResizeMouseDown(e, source, 'right')"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>

                  <!-- Delete button -->
                  <button
                    class="absolute top-0.5 right-0.5 p-0.5 bg-red-500/80 rounded opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-auto"
                    @click.stop="emit('deleteSource', source.id)"
                    title="Remove source"
                  >
                    <X :size="10" class="text-white" />
                  </button>
                </div>

                <!-- Transition zones (crossfade overlays) -->
                <div
                  v-for="transition in sourceTransitions"
                  :key="transition.id"
                  class="transition-zone absolute top-1 bottom-1 pointer-events-none z-30"
                  :style="getTransitionZoneStyle(transition)"
                >
                  <!-- Crossfade gradient background -->
                  <div class="absolute inset-0 rounded-md overflow-hidden transition-zone-bg">
                    <!-- Left fade (from source A) -->
                    <div
                      class="absolute inset-y-0 left-0 w-1/2 bg-gradient-to-r from-violet-500/60 to-transparent"
                    ></div>
                    <!-- Right fade (to source B) -->
                    <div
                      class="absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l from-indigo-500/60 to-transparent"
                    ></div>
                    <!-- Center blend indicator -->
                    <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"></div>
                    <!-- Diagonal stripes pattern for visual distinction -->
                    <div class="absolute inset-0 transition-zone-stripes opacity-30"></div>
                  </div>
                  <!-- Crossfade icon and duration label -->
                  <div class="absolute inset-0 flex items-center justify-center">
                    <div
                      class="flex items-center gap-1 bg-black/70 backdrop-blur-sm px-1.5 py-0.5 rounded-full border border-white/20"
                    >
                      <Blend :size="10" class="text-white/90" />
                      <span class="text-[9px] text-white/90 font-medium">{{ transition.duration.toFixed(1) }}s</span>
                    </div>
                  </div>
                  <!-- Edge indicators -->
                  <div class="absolute left-0 top-0 bottom-0 w-0.5 bg-violet-400/80 rounded-l-full"></div>
                  <div class="absolute right-0 top-0 bottom-0 w-0.5 bg-indigo-400/80 rounded-r-full"></div>
                </div>
              </template>

              <!-- Clip Mode: Trim Segments -->
              <template v-else>
                <template v-for="(segmentLayout, index) in segmentLayouts" :key="segmentLayout.segment.id">
                  <!-- Segment with waveform -->
                  <div
                    :ref="(el) => setSegmentRef(el, 'trim', segmentLayout.segment.id)"
                    class="clip-segment absolute top-1 bottom-1 rounded-md overflow-hidden group cursor-pointer"
                    :class="getSegmentClasses('trim', segmentLayout.segment.id, segmentLayout.segment.isDeleted)"
                    :style="getSegmentLayoutStyle(segmentLayout, 'violet', 'trim', segmentLayout.segment.id)"
                    @mousedown="(e) => onSegmentMouseDown(e, 'trim', segmentLayout.segment.id, segmentLayout.segment)"
                    @click.stop="(e) => onSegmentClick(e, segmentLayout.segment)"
                  >
                    <!-- Segment background gradient -->
                    <div class="absolute inset-0 bg-gradient-to-r from-violet-900/30 to-indigo-900/20"></div>

                    <!-- Waveform canvas for this segment -->
                    <canvas
                      :ref="(el) => setWaveformCanvasRef(el, segmentLayout.segment.id)"
                      class="absolute inset-0 w-full h-full pointer-events-none"
                      style="mix-blend-mode: normal; z-index: 5"
                    ></canvas>

                    <!-- Segment label (shows effective timeline times) -->
                    <div class="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <span class="text-xs text-white font-medium drop-shadow-md bg-black/60 px-1.5 py-0.5 rounded">
                        {{ formatTime(segmentLayout.effectiveStartTime) }} -
                        {{ formatTime(segmentLayout.effectiveEndTime) }}
                      </span>
                    </div>

                    <!-- Left resize handle -->
                    <div
                      class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                      @mousedown.stop="
                        (e) => onResizeMouseDown(e, 'trim', segmentLayout.segment.id, 'left', segmentLayout.segment)
                      "
                    >
                      <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                    </div>
                    <!-- Right resize handle -->
                    <div
                      class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                      @mousedown.stop="
                        (e) => onResizeMouseDown(e, 'trim', segmentLayout.segment.id, 'right', segmentLayout.segment)
                      "
                    >
                      <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                    </div>
                  </div>
                </template>
              </template>
            </div>
          </div>

          <!-- Audio Tracks -->
          <div
            v-for="track in audioTracks"
            :key="track.id"
            class="flex items-center h-12 px-2 border-b border-border/20 relative"
          >
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-2 z-[70] bg-[#101010] flex-shrink-0"
            >
              <div class="font-medium flex items-center gap-1 truncate">
                <Music :size="12" />
                <span class="truncate max-w-[40px]">{{ track.name }}</span>
              </div>
            </div>
            <div
              :ref="(el) => setSegmentRef(el, 'audio', track.id)"
              class="flex-1 h-8 relative"
              @click="onTrackContentClick"
            >
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md cursor-pointer"></div>

              <!-- Render audio track as visual segments that split at video segment boundaries -->
              <template v-for="(visualSeg, segIdx) in getAudioVisualSegments(track)" :key="`${track.id}-vis-${segIdx}`">
                <!-- Audio visual segment -->
                <div
                  class="clip-segment absolute top-1 bottom-1 rounded-md overflow-hidden group cursor-pointer"
                  :class="getSegmentClasses('audio', track.id)"
                  :style="getAudioVisualSegmentStyle(track, visualSeg)"
                  @mousedown="(e) => onSegmentMouseDown(e, 'audio', track.id, track)"
                  @click.stop="selectItem('audio', track.id)"
                >
                  <!-- Audio track background gradient -->
                  <div class="absolute inset-0 bg-gradient-to-r from-emerald-900/30 to-teal-900/20"></div>

                  <!-- Waveform canvas for this visual segment -->
                  <canvas
                    :ref="(el) => setAudioSegmentCanvasRef(el, track.id, segIdx)"
                    class="absolute inset-0 w-full h-full pointer-events-none"
                    style="mix-blend-mode: normal; z-index: 5"
                  ></canvas>

                  <!-- Track label (only show on hover in first segment) -->
                  <div
                    v-if="visualSeg.isFirst"
                    class="absolute inset-0 flex items-center justify-center pointer-events-none z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
                  >
                    <span
                      class="text-xs text-white font-medium truncate drop-shadow-md bg-black/60 px-1.5 py-0.5 rounded"
                    >
                      {{ track.name }}
                    </span>
                  </div>

                  <!-- Left resize handle (only on first segment) -->
                  <div
                    v-if="visualSeg.isFirst"
                    class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onResizeMouseDown(e, 'audio', track.id, 'left', track)"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                  <!-- Right resize handle (only on last segment) -->
                  <div
                    v-if="visualSeg.isLast"
                    class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onResizeMouseDown(e, 'audio', track.id, 'right', track)"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Text Overlays Track -->
          <div v-if="textOverlays.length > 0" class="flex items-center h-12 px-2 border-b border-border/20 relative">
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-2 z-[70] bg-[#101010] flex-shrink-0"
            >
              <div class="font-medium flex items-center gap-1">
                <Type :size="12" />
                Text
              </div>
            </div>
            <div class="flex-1 h-8 relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md cursor-pointer"></div>
              <div
                v-for="overlay in textOverlays"
                :key="overlay.id"
                :ref="(el) => setSegmentRef(el, 'text', overlay.id)"
                class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center px-2 group"
                :class="getSegmentClasses('text', overlay.id)"
                :style="getSegmentStyle(overlay.startTime, overlay.endTime, 'amber', 'text', overlay.id)"
                @mousedown="(e) => onSegmentMouseDown(e, 'text', overlay.id, overlay)"
                @click.stop="selectItem('text', overlay.id)"
              >
                <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm pointer-events-none">
                  {{ overlay.text }}
                </span>
                <!-- Left resize handle -->
                <div
                  class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'text', overlay.id, 'left', overlay)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
                <!-- Right resize handle -->
                <div
                  class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'text', overlay.id, 'right', overlay)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Stickers Track -->
          <div v-if="stickers.length > 0" class="flex items-center h-12 px-2 border-b border-border/20 relative">
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-2 z-[70] bg-[#101010] flex-shrink-0"
            >
              <div class="font-medium flex items-center gap-1">
                <Smile :size="12" />
                Stickers
              </div>
            </div>
            <div class="flex-1 h-8 relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md cursor-pointer"></div>
              <div
                v-for="sticker in stickers"
                :key="sticker.id"
                :ref="(el) => setSegmentRef(el, 'sticker', sticker.id)"
                class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center justify-center group"
                :class="getSegmentClasses('sticker', sticker.id)"
                :style="getSegmentStyle(sticker.startTime, sticker.endTime, 'pink', 'sticker', sticker.id)"
                @mousedown="(e) => onSegmentMouseDown(e, 'sticker', sticker.id, sticker)"
                @click.stop="selectItem('sticker', sticker.id)"
              >
                <span v-if="sticker.stickerType === 'emoji'" class="text-sm pointer-events-none">
                  {{ sticker.stickerPath }}
                </span>
                <span v-else class="text-xs text-white/90 font-medium truncate px-1 drop-shadow-sm pointer-events-none">
                  Sticker
                </span>
                <!-- Left resize handle -->
                <div
                  class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'sticker', sticker.id, 'left', sticker)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
                <!-- Right resize handle -->
                <div
                  class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'sticker', sticker.id, 'right', sticker)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Watermarks Track -->
          <div v-if="watermarks.length > 0" class="flex items-center h-12 px-2 border-b border-border/20 relative">
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-2 z-[70] bg-[#101010] flex-shrink-0"
            >
              <div class="font-medium flex items-center gap-1">
                <Droplet :size="12" />
                Watermark
              </div>
            </div>
            <div class="flex-1 h-8 relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md cursor-pointer"></div>
              <div
                v-for="watermark in watermarks"
                :key="watermark.id"
                :ref="(el) => setSegmentRef(el, 'watermark', watermark.id)"
                class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center px-2 group"
                :class="getSegmentClasses('watermark', watermark.id)"
                :style="getSegmentStyle(watermark.startTime, watermark.endTime, 'cyan', 'watermark', watermark.id)"
                @mousedown="(e) => onSegmentMouseDown(e, 'watermark', watermark.id, watermark)"
                @click.stop="selectItem('watermark', watermark.id)"
              >
                <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm pointer-events-none">
                  Watermark
                </span>
                <!-- Left resize handle -->
                <div
                  class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'watermark', watermark.id, 'left', watermark)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
                <!-- Right resize handle -->
                <div
                  class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'watermark', watermark.id, 'right', watermark)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Effects Track -->
          <div v-if="effects.length > 0" class="flex items-center h-12 px-2 border-b border-border/20 relative">
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-2 z-[70] bg-[#101010] flex-shrink-0"
            >
              <div class="font-medium flex items-center gap-1">
                <Sparkles :size="12" />
                Effects
              </div>
            </div>
            <div class="flex-1 h-8 relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md cursor-pointer"></div>
              <div
                v-for="effect in effects"
                :key="effect.id"
                :ref="(el) => setSegmentRef(el, 'effect', effect.id)"
                class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center px-2 group"
                :class="getSegmentClasses('effect', effect.id)"
                :style="getSegmentStyle(effect.startTime, effect.endTime, 'cyan', 'effect', effect.id)"
                @mousedown="(e) => onSegmentMouseDown(e, 'effect', effect.id, effect)"
                @click.stop="selectItem('effect', effect.id)"
              >
                <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm capitalize pointer-events-none">
                  {{ effect.type }}
                </span>
                <!-- Left resize handle -->
                <div
                  class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'effect', effect.id, 'left', effect)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
                <!-- Right resize handle -->
                <div
                  class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'effect', effect.id, 'right', effect)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Filters Track -->
          <div v-if="filterSegments.length > 0" class="flex items-center h-12 px-2 border-b border-border/20 relative">
            <div
              class="w-16 h-8 flex items-center justify-center text-xs text-center text-muted-foreground/60 sticky left-2 z-[70] bg-[#101010] flex-shrink-0"
            >
              <div class="font-medium flex items-center gap-1">
                <Palette :size="12" />
                Filters
              </div>
            </div>
            <div class="flex-1 h-8 relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#1a1a1a]/30 rounded-md cursor-pointer"></div>
              <div
                v-for="filterSeg in filterSegments"
                :key="filterSeg.id"
                :ref="(el) => setSegmentRef(el, 'filter', filterSeg.id)"
                class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center px-2 group"
                :class="getSegmentClasses('filter', filterSeg.id)"
                :style="getFilterSegmentStyle(filterSeg)"
                @mousedown="(e) => onSegmentMouseDown(e, 'filter', filterSeg.id, filterSeg)"
                @click.stop="selectItem('filter', filterSeg.id)"
              >
                <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm capitalize pointer-events-none">
                  {{ getFilterPresetName(filterSeg.settings.preset) }}
                </span>
                <!-- Left resize handle -->
                <div
                  class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'filter', filterSeg.id, 'left', filterSeg)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
                <!-- Right resize handle -->
                <div
                  class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto"
                  @mousedown.stop="(e) => onResizeMouseDown(e, 'filter', filterSeg.id, 'right', filterSeg)"
                >
                  <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                </div>
              </div>
            </div>
          </div>

          <!-- Playhead Line (inside content wrapper so it scrolls with content) -->
          <div
            v-if="totalDuration > 0"
            class="absolute top-0 bottom-0 z-[60] cursor-ew-resize group playhead-line"
            :class="{
              'cursor-grabbing': isDraggingPlayhead,
              'playhead-dragging': isDraggingPlayhead,
              'playhead-playing': props.isPlaying && !isDraggingPlayhead,
            }"
            :style="{
              '--playhead-position': effectivePlayheadPosition,
              width: '12px',
              marginLeft: '-6px',
            }"
            @mousedown="onPlayheadMouseDown"
          >
            <div class="absolute inset-x-[5px] inset-y-0 bg-white/80 shadow-lg group-hover:bg-white transition-colors">
              <!-- Top circle -->
              <div
                class="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white rounded-full shadow-md group-hover:scale-110 transition-transform"
              ></div>
              <!-- Bottom circle -->
              <div
                class="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-white/80 rounded-full shadow-md group-hover:scale-110 transition-transform"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
  import { ZoomIn, Film, Music, Type, Smile, Sparkles, Palette, Droplet, X, Blend } from 'lucide-vue-next';
  import { useAudioWaveform } from '@/composables/useAudioWaveform';
  import type {
    TrimSegment,
    AudioTrack,
    TextOverlay,
    Sticker,
    Effect,
    FilterSegment,
    ClipWatermark,
    VideoEditorSource,
    SourceItem,
    VideoEditorTransition,
  } from '@/types';
  import { detectSourceTransitions } from '@/types';

  type ItemType = 'trim' | 'audio' | 'text' | 'sticker' | 'watermark' | 'effect' | 'filter' | 'source';

  interface DragInfo {
    type: ItemType;
    id: string;
    item: any;
    startX: number;
    originalStartTime: number;
    originalEndTime: number;
    trackContentWidth: number;
  }

  interface ResizeInfo {
    type: ItemType;
    id: string;
    handle: 'left' | 'right';
    item: any;
    startX: number;
    originalStartTime: number;
    originalEndTime: number;
    trackContentWidth: number;
  }

  interface SegmentTick {
    time: number;
    positionInSegment: number;
    isMajor: boolean;
  }

  interface SegmentLayout {
    segment: TrimSegment;
    startPercent: number;
    widthPercent: number;
    ticks: SegmentTick[];
    effectiveStartTime: number; // Cumulative time from start of timeline
    effectiveEndTime: number; // Cumulative time at end of this segment
  }

  // Gap percentage between segments (0 = segments are butted up against each other)
  const GAP_PERCENT = 0;

  const props = withDefaults(
    defineProps<{
      duration: number;
      currentTime: number;
      clipStart: number;
      clipEnd: number;
      trimSegments: TrimSegment[];
      audioTracks: AudioTrack[];
      textOverlays: TextOverlay[];
      stickers: Sticker[];
      watermarks: ClipWatermark[];
      effects: Effect[];
      filterSegments: FilterSegment[];
      videoSrc?: string;
      audioGainDb?: number; // dB gain (-20 to +20) to apply to main video waveform visualization
      trackDbValues?: Record<string, number>; // Per-track dB values for audio track waveforms
      isPlaying?: boolean; // Whether video is currently playing (for smooth playhead animation)
      // Video editor mode props
      editorMode?: boolean;
      videoSources?: VideoEditorSource[];
    }>(),
    {
      audioGainDb: 0,
      trackDbValues: () => ({}),
      filterSegments: () => [],
      watermarks: () => [],
      isPlaying: false,
      editorMode: false,
      videoSources: () => [],
    }
  );

  const emit = defineEmits<{
    (e: 'seek', time: number): void;
    (e: 'updateTrimSegment', segmentId: string, startTime: number, endTime: number): void;
    (e: 'updateAudioTrack', trackId: string, updates: Partial<AudioTrack>): void;
    (e: 'updateTextOverlay', overlayId: string, updates: Partial<TextOverlay>): void;
    (e: 'updateSticker', stickerId: string, updates: Partial<Sticker>): void;
    (e: 'updateWatermark', watermarkId: string, updates: Partial<ClipWatermark>): void;
    (e: 'updateEffect', effectId: string, updates: Partial<Effect>): void;
    (e: 'updateFilterSegment', segmentId: string, updates: Partial<FilterSegment>): void;
    // Video editor mode events
    (e: 'updateSource', sourceId: string, updates: Partial<VideoEditorSource>): void;
    (e: 'deleteSource', sourceId: string): void;
    (e: 'dropSource', data: { source: SourceItem; position: number }): void;
    (e: 'transitionsDetected', transitions: VideoEditorTransition[]): void;
  }>();

  // Computed: detect transitions between overlapping sources in editor mode
  const sourceTransitions = computed<VideoEditorTransition[]>(() => {
    if (!props.editorMode || props.videoSources.length < 2) {
      return [];
    }
    return detectSourceTransitions(props.videoSources);
  });

  // Emit transitions whenever they change so parent can use for playback
  watch(
    sourceTransitions,
    (transitions) => {
      if (props.editorMode) {
        emit('transitionsDetected', transitions);
      }
    },
    { immediate: true, deep: true }
  );

  // Refs
  const timelineScrollContainer = ref<HTMLElement | null>(null);
  const contentWrapperRef = ref<HTMLElement | null>(null);
  const rulerContentRef = ref<HTMLElement | null>(null);
  const videoTrackContentRef = ref<HTMLElement | null>(null);
  const segmentRefs = ref<Map<string, HTMLElement>>(new Map());
  const waveformCanvasRefs = ref<Map<string, HTMLCanvasElement>>(new Map());
  const audioWaveformCanvasRefs = ref<Map<string, HTMLCanvasElement>>(new Map());
  const audioSegmentCanvasRefs = ref<Map<string, HTMLCanvasElement>>(new Map()); // key: `${trackId}-${segmentIndex}`
  const audioWaveformData = ref<Map<string, { peaks: { min: number; max: number }[]; duration: number }>>(new Map());
  const zoomLevel = ref(1);

  // Video editor mode state
  const isDragOverTimeline = ref(false);
  const isDraggingSource = ref(false);
  const dragSourceInfo = ref<{
    sourceId: string;
    startX: number;
    originalStartTime: number;
    originalEndTime: number;
  } | null>(null);
  const isResizingSource = ref(false);
  const resizeSourceInfo = ref<{
    sourceId: string;
    handle: 'left' | 'right';
    startX: number;
    originalStartTime: number;
    originalEndTime: number;
  } | null>(null);

  // Selection state
  const selectedItemKey = ref<string | null>(null);

  // Drag state
  const isDragging = ref(false);
  const dragInfo = ref<DragInfo | null>(null);

  // Resize state
  const isResizing = ref(false);
  const resizeInfo = ref<ResizeInfo | null>(null);

  // Preview state for optimistic updates (local-only during drag/resize)
  const dragPreview = ref<{ type: ItemType; id: string; startTime: number; endTime: number } | null>(null);

  // Playhead drag state
  const isDraggingPlayhead = ref(false);

  // Smooth playhead animation state
  const smoothPlayheadPosition = ref(0);
  let animationFrameId: number | null = null;
  let lastUpdateTime = 0;
  let targetPosition = 0;

  // Audio waveform
  const { waveformData, isLoaded: isWaveformLoaded, loadWaveformFromVideo } = useAudioWaveform();

  // Resize observer for waveform canvases
  let resizeObserver: ResizeObserver | null = null;

  // Convert dB to linear gain multiplier
  function dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  // Color mappings
  const colorMap: Record<string, { bg: string; border: string }> = {
    violet: { bg: 'rgba(139, 92, 246, 0.4), rgba(139, 92, 246, 0.5)', border: 'rgba(139, 92, 246, 0.6)' },
    emerald: { bg: 'rgba(16, 185, 129, 0.4), rgba(16, 185, 129, 0.5)', border: 'rgba(16, 185, 129, 0.6)' },
    amber: { bg: 'rgba(245, 158, 11, 0.4), rgba(245, 158, 11, 0.5)', border: 'rgba(245, 158, 11, 0.6)' },
    pink: { bg: 'rgba(236, 72, 153, 0.4), rgba(236, 72, 153, 0.5)', border: 'rgba(236, 72, 153, 0.6)' },
    cyan: { bg: 'rgba(6, 182, 212, 0.4), rgba(6, 182, 212, 0.5)', border: 'rgba(6, 182, 212, 0.6)' },
    rose: { bg: 'rgba(244, 63, 94, 0.4), rgba(244, 63, 94, 0.5)', border: 'rgba(244, 63, 94, 0.6)' },
  };

  // Sorted trim segments by start time - creates a default segment if none exist
  const sortedTrimSegments = computed(() => {
    const existingSegments = [...props.trimSegments]
      .filter((s) => !s.isDeleted)
      .sort((a, b) => a.startTime - b.startTime);

    // If no segments exist, create a default segment spanning the full clip duration
    // Note: Timeline works with relative times (0 to duration), not absolute source times
    if (existingSegments.length === 0 && props.duration > 0) {
      return [
        {
          id: 'default-segment',
          startTime: 0,
          endTime: props.duration,
          isDeleted: false,
        },
      ];
    }

    return existingSegments;
  });

  // Calculate total duration of video segments only
  const videoSegmentDuration = computed(() => {
    return sortedTrimSegments.value.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0);
  });

  // Calculate total duration including audio tracks (use the longest)
  const totalDuration = computed(() => {
    const segmentDuration = videoSegmentDuration.value;

    // Find the longest audio track
    const maxAudioDuration = props.audioTracks.reduce((max, track) => {
      const trackDuration = track.endTime - track.startTime;
      return Math.max(max, trackDuration);
    }, 0);

    // Use the max of video segment duration and longest audio track
    const maxDuration = Math.max(segmentDuration, maxAudioDuration);

    // Fallback to prop duration if nothing else
    return maxDuration > 0 ? maxDuration : props.duration;
  });

  // Calculate segment layouts (segments are butted up against each other)
  const segmentLayouts = computed((): SegmentLayout[] => {
    const segments = sortedTrimSegments.value;
    if (segments.length === 0) return [];

    const totalSegmentDuration = totalDuration.value;
    if (totalSegmentDuration <= 0) return [];

    // Calculate total gap percentage
    const totalGapPercent = (segments.length - 1) * GAP_PERCENT;
    const availablePercent = 100 - totalGapPercent;

    // Determine optimal intervals based on TOTAL duration and zoom (consistent for all segments)
    // This ensures the ruler has the same scale throughout
    const effectiveDurationForZoom = totalSegmentDuration / zoomLevel.value;
    let majorInterval: number;
    let minorInterval: number;

    if (effectiveDurationForZoom < 2) {
      // Very short: major every 0.5s, minor every 0.1s
      majorInterval = 0.5;
      minorInterval = 0.1;
    } else if (effectiveDurationForZoom < 5) {
      // Short: major every 1s, minor every 0.25s
      majorInterval = 1;
      minorInterval = 0.25;
    } else if (effectiveDurationForZoom < 10) {
      // Medium-short: major every 1s, minor every 0.5s
      majorInterval = 1;
      minorInterval = 0.5;
    } else if (effectiveDurationForZoom < 30) {
      // Medium: major every 5s, minor every 1s
      majorInterval = 5;
      minorInterval = 1;
    } else if (effectiveDurationForZoom < 60) {
      // Medium-long: major every 10s, minor every 2s
      majorInterval = 10;
      minorInterval = 2;
    } else if (effectiveDurationForZoom < 120) {
      // Long: major every 15s, minor every 5s
      majorInterval = 15;
      minorInterval = 5;
    } else if (effectiveDurationForZoom < 600) {
      // Very long: major every 30s, minor every 10s
      majorInterval = 30;
      minorInterval = 10;
    } else {
      // Extra long: major every 60s, minor every 20s
      majorInterval = 60;
      minorInterval = 20;
    }

    const layouts: SegmentLayout[] = [];
    let currentPercent = 0;
    let cumulativeTime = 0; // Track cumulative effective time

    segments.forEach((segment, index) => {
      const segmentDuration = segment.endTime - segment.startTime;
      const widthPercent = (segmentDuration / totalSegmentDuration) * availablePercent;

      // Calculate effective times (cumulative from start of timeline)
      const effectiveStartTime = cumulativeTime;
      const effectiveEndTime = cumulativeTime + segmentDuration;

      // Generate ticks for this segment using the consistent intervals
      const ticks: SegmentTick[] = [];

      // Generate intermediate ticks using effective times
      // Start from the first interval after effectiveStartTime
      const startTick = Math.ceil(effectiveStartTime / minorInterval) * minorInterval;

      // Calculate minimum distance from edges based on duration (shorter clips = tighter margins)
      const edgeMargin = Math.min(0.3, segmentDuration * 0.05);

      for (let t = startTick; t < effectiveEndTime; t += minorInterval) {
        // Skip if too close to start or end
        if (Math.abs(t - effectiveStartTime) < edgeMargin || Math.abs(t - effectiveEndTime) < edgeMargin) {
          continue;
        }

        const posInSegment = ((t - effectiveStartTime) / segmentDuration) * 100;
        // Only include ticks in the middle of the segment (not at edges)
        if (posInSegment > 1 && posInSegment < 99) {
          // Use a small epsilon for floating point comparison
          const isMajor = Math.abs(t % majorInterval) < 0.001 || Math.abs((t % majorInterval) - majorInterval) < 0.001;
          ticks.push({
            time: t, // This is now the effective time
            positionInSegment: posInSegment,
            isMajor,
          });
        }
      }

      layouts.push({
        segment,
        startPercent: currentPercent,
        widthPercent,
        ticks,
        effectiveStartTime,
        effectiveEndTime,
      });

      currentPercent += widthPercent;
      cumulativeTime += segmentDuration;
      if (index < segments.length - 1) {
        currentPercent += GAP_PERCENT;
      }
    });

    return layouts;
  });

  // Calculate visual segments for an audio track based on video segment overlaps
  interface AudioVisualSegment {
    videoSegmentIndex: number;
    audioStartTime: number; // Time within the audio track
    audioEndTime: number;
    leftPercent: number;
    widthPercent: number;
    isFirst: boolean;
    isLast: boolean;
  }

  function getAudioVisualSegments(track: AudioTrack): AudioVisualSegment[] {
    const segments = sortedTrimSegments.value;
    if (segments.length === 0) return [];

    // Use preview position during drag/resize
    const preview = dragPreview.value;
    const usePreview = preview && preview.type === 'audio' && preview.id === track.id;

    const audioStart = usePreview ? preview.startTime : track.startTime;
    const audioEnd = usePreview ? preview.endTime : track.endTime;
    const audioDuration = audioEnd - audioStart;

    if (audioDuration <= 0) return [];

    const visualSegments: AudioVisualSegment[] = [];

    // Calculate cumulative video time to map to timeline position
    let cumulativeVideoTime = 0;
    const totalGapPercent = (segments.length - 1) * GAP_PERCENT;
    const availablePercent = 100 - totalGapPercent;
    const totalVideoDuration = videoSegmentDuration.value;

    let audioTimeUsed = 0; // Track how much audio time has been "used" across segments

    segments.forEach((segment, index) => {
      const segmentDuration = segment.endTime - segment.startTime;
      const segmentStartInTimeline = cumulativeVideoTime;
      const segmentEndInTimeline = cumulativeVideoTime + segmentDuration;

      // Check if audio overlaps with this video segment (in virtual timeline time)
      if (audioStart < segmentEndInTimeline && audioEnd > segmentStartInTimeline) {
        // Calculate the overlap
        const overlapStart = Math.max(audioStart, segmentStartInTimeline);
        const overlapEnd = Math.min(audioEnd, segmentEndInTimeline);
        const overlapDuration = overlapEnd - overlapStart;

        if (overlapDuration > 0) {
          // Calculate position within this video segment
          const segmentLayoutIndex = segmentLayouts.value.findIndex((l) => l.segment.id === segment.id);
          if (segmentLayoutIndex >= 0) {
            const segmentLayout = segmentLayouts.value[segmentLayoutIndex];

            // Position within the segment
            const startWithinSegment = (overlapStart - segmentStartInTimeline) / segmentDuration;
            const endWithinSegment = (overlapEnd - segmentStartInTimeline) / segmentDuration;

            const leftPercent = segmentLayout.startPercent + startWithinSegment * segmentLayout.widthPercent;
            const widthPercent = (endWithinSegment - startWithinSegment) * segmentLayout.widthPercent;

            visualSegments.push({
              videoSegmentIndex: index,
              audioStartTime: audioTimeUsed,
              audioEndTime: audioTimeUsed + overlapDuration,
              leftPercent,
              widthPercent,
              isFirst: visualSegments.length === 0,
              isLast: false, // Will be updated after loop
            });

            audioTimeUsed += overlapDuration;
          }
        }
      }

      cumulativeVideoTime += segmentDuration;
    });

    // Mark the last segment
    if (visualSegments.length > 0) {
      visualSegments[visualSegments.length - 1].isLast = true;
    }

    return visualSegments;
  }

  // Convert current time to playhead position (0-1)
  const playheadPosition = computed(() => {
    // Editor mode: simple linear mapping
    if (props.editorMode) {
      const duration = props.duration || 300;
      if (duration <= 0) return 0;
      return Math.min(1, Math.max(0, props.currentTime / duration));
    }

    // Clip mode: segment-based mapping
    if (totalDuration.value <= 0) return 0;

    // Find which segment the current time falls into
    let accumulatedTime = 0;
    let accumulatedPercent = 0;
    const totalGapPercent = (sortedTrimSegments.value.length - 1) * GAP_PERCENT;
    const availablePercent = 100 - totalGapPercent;

    for (let i = 0; i < sortedTrimSegments.value.length; i++) {
      const segment = sortedTrimSegments.value[i];
      const segmentDuration = segment.endTime - segment.startTime;
      const segmentWidthPercent = (segmentDuration / totalDuration.value) * availablePercent;

      if (props.currentTime >= segment.startTime && props.currentTime <= segment.endTime) {
        // Current time is within this segment
        const timeIntoSegment = props.currentTime - segment.startTime;
        const percentIntoSegment = (timeIntoSegment / segmentDuration) * segmentWidthPercent;
        return (accumulatedPercent + percentIntoSegment) / 100;
      }

      accumulatedPercent += segmentWidthPercent;
      if (i < sortedTrimSegments.value.length - 1) {
        accumulatedPercent += GAP_PERCENT;
      }
      accumulatedTime += segmentDuration;
    }

    // If not in any segment, clamp to end
    return 1;
  });

  // Calculate height based on number of tracks
  const calculatedHeight = computed(() => {
    const headerHeight = 44; // Timeline header with toolbar
    const rulerHeight = 32; // Timestamp ruler
    const videoTrackHeight = 48; // Video track
    const otherTrackHeight = 48; // Other tracks (audio, text, etc.)
    const padding = 16; // Bottom padding

    const otherTracksCount =
      props.audioTracks.length +
      (props.textOverlays.length > 0 ? 1 : 0) +
      (props.stickers.length > 0 ? 1 : 0) +
      (props.watermarks.length > 0 ? 1 : 0) +
      (props.effects.length > 0 ? 1 : 0);

    return headerHeight + rulerHeight + videoTrackHeight + otherTracksCount * otherTrackHeight + padding;
  });

  // Methods
  function formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    // For short durations (< 60s total), show decimal precision if there's a fractional part
    if (totalDuration.value < 60 && secs % 1 !== 0) {
      // Show one decimal place
      return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
    }

    return `${mins}:${Math.floor(secs).toString().padStart(2, '0')}`;
  }

  function setSegmentRef(el: any, type: ItemType, id: string) {
    if (el) {
      segmentRefs.value.set(`${type}_${id}`, el);
    }
  }

  function setWaveformCanvasRef(el: any, segmentId: string) {
    if (el) {
      waveformCanvasRefs.value.set(segmentId, el as HTMLCanvasElement);
    }
  }

  function setAudioWaveformCanvasRef(el: any, trackId: string) {
    if (el) {
      audioWaveformCanvasRefs.value.set(trackId, el as HTMLCanvasElement);
    }
  }

  function setAudioSegmentCanvasRef(el: any, trackId: string, segmentIndex: number) {
    const key = `${trackId}-${segmentIndex}`;
    if (el) {
      audioSegmentCanvasRefs.value.set(key, el as HTMLCanvasElement);
    } else {
      // Clean up ref when element is unmounted
      audioSegmentCanvasRefs.value.delete(key);
    }
  }

  function getAudioVisualSegmentStyle(track: AudioTrack, visualSeg: AudioVisualSegment): Record<string, string> {
    const colors = colorMap.emerald;
    const isSelected = selectedItemKey.value === `audio_${track.id}`;

    return {
      left: `${visualSeg.leftPercent}%`,
      width: `${Math.max(visualSeg.widthPercent, 0.5)}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
    };
  }

  function getAudioSegmentStyle(layout: SegmentLayout, trackId: string): Record<string, string> {
    const colors = colorMap.emerald;
    const isSelected = selectedItemKey.value === `audio_${trackId}`;

    return {
      left: `${layout.startPercent}%`,
      width: `${layout.widthPercent}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
    };
  }

  function getAudioTrackStyle(track: AudioTrack): Record<string, string> {
    const colors = colorMap.emerald;
    const isSelected = selectedItemKey.value === `audio_${track.id}`;

    // Use preview position during drag/resize, otherwise use actual track position
    const preview = dragPreview.value;
    const usePreview = preview && preview.type === 'audio' && preview.id === track.id;

    const startTime = usePreview ? preview.startTime : track.startTime;
    const endTime = usePreview ? preview.endTime : track.endTime;

    // Calculate position based on track's startTime and duration
    const trackDuration = endTime - startTime;
    const effectiveDuration = totalDuration.value;

    // Position based on track's startTime, width based on duration
    const leftPercent = (startTime / effectiveDuration) * 100;
    const widthPercent = (trackDuration / effectiveDuration) * 100;

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(widthPercent, 1)}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
    };
  }

  function selectItem(type: ItemType, id: string) {
    selectedItemKey.value = `${type}_${id}`;
  }

  function getSegmentClasses(type: ItemType, id: string, isDeleted?: boolean): string[] {
    const classes: string[] = [];
    const key = `${type}_${id}`;

    if (isDragging.value && dragInfo.value?.type === type && dragInfo.value?.id === id) {
      classes.push('cursor-grabbing', 'z-30', 'shadow-2xl', 'border-2', 'border-blue-400', 'dragging');
    } else if (isResizing.value && resizeInfo.value?.type === type && resizeInfo.value?.id === id) {
      classes.push('cursor-ew-resize', 'z-30', 'shadow-2xl', 'border-2', 'border-green-400', 'resizing');
    } else {
      classes.push('cursor-grab', 'hover:cursor-grab', 'transition-all', 'duration-200', 'ease-out');
    }

    if (isDeleted) {
      classes.push('opacity-30');
    }

    if (selectedItemKey.value === key) {
      classes.push('selected-segment');
    }

    return classes;
  }

  function getSegmentLayoutStyle(
    layout: SegmentLayout,
    color: string,
    type: ItemType,
    id: string
  ): Record<string, string> {
    const colors = colorMap[color] || colorMap.violet;
    const isSelected = selectedItemKey.value === `${type}_${id}`;

    return {
      left: `${layout.startPercent}%`,
      width: `${layout.widthPercent}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
    };
  }

  // Convert effective time to visual percentage position (accounting for segment gaps)
  function effectiveTimeToVisualPercent(effectiveTime: number): number {
    const segments = sortedTrimSegments.value;
    if (segments.length === 0 || totalDuration.value <= 0) {
      return (effectiveTime / (totalDuration.value || 1)) * 100;
    }

    const totalGapPercent = (segments.length - 1) * GAP_PERCENT;
    const availablePercent = 100 - totalGapPercent;

    let accumulatedEffectiveTime = 0;
    let accumulatedPercent = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentDuration = segment.endTime - segment.startTime;
      const segmentWidthPercent = (segmentDuration / totalDuration.value) * availablePercent;

      // Check if effective time falls within this segment's effective range
      if (effectiveTime < accumulatedEffectiveTime + segmentDuration) {
        // Time is within this segment
        const timeIntoSegment = effectiveTime - accumulatedEffectiveTime;
        const percentIntoSegment = (timeIntoSegment / segmentDuration) * segmentWidthPercent;
        return accumulatedPercent + percentIntoSegment;
      }

      accumulatedPercent += segmentWidthPercent;
      if (i < segments.length - 1) {
        accumulatedPercent += GAP_PERCENT;
      }
      accumulatedEffectiveTime += segmentDuration;
    }

    // Time is past all segments, clamp to end
    return Math.min(100, accumulatedPercent);
  }

  // Convert visual percentage position to effective time (inverse of effectiveTimeToVisualPercent)
  function visualPercentToEffectiveTime(percent: number): number {
    const segments = sortedTrimSegments.value;
    if (segments.length === 0 || totalDuration.value <= 0) {
      return (percent / 100) * (totalDuration.value || 1);
    }

    const totalGapPercent = (segments.length - 1) * GAP_PERCENT;
    const availablePercent = 100 - totalGapPercent;

    let accumulatedEffectiveTime = 0;
    let accumulatedPercent = 0;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentDuration = segment.endTime - segment.startTime;
      const segmentWidthPercent = (segmentDuration / totalDuration.value) * availablePercent;

      const segmentEndPercent = accumulatedPercent + segmentWidthPercent;

      if (percent >= accumulatedPercent && percent <= segmentEndPercent) {
        // Position is within this segment
        const percentIntoSegment = percent - accumulatedPercent;
        const timeIntoSegment = (percentIntoSegment / segmentWidthPercent) * segmentDuration;
        return accumulatedEffectiveTime + timeIntoSegment;
      }

      // Check if position is in gap
      if (i < segments.length - 1) {
        const gapEndPercent = segmentEndPercent + GAP_PERCENT;
        if (percent > segmentEndPercent && percent < gapEndPercent) {
          // Position is in gap, return end of current segment's effective time
          return accumulatedEffectiveTime + segmentDuration;
        }
      }

      accumulatedPercent = segmentEndPercent + (i < segments.length - 1 ? GAP_PERCENT : 0);
      accumulatedEffectiveTime += segmentDuration;
    }

    // Position is past all segments, return total duration
    return totalDuration.value;
  }

  function getSegmentStyle(
    startTime: number,
    endTime: number,
    color: string,
    type: ItemType,
    id: string
  ): Record<string, string> {
    const colors = colorMap[color] || colorMap.violet;
    const isSelected = selectedItemKey.value === `${type}_${id}`;

    // Use preview position during drag/resize
    const preview = dragPreview.value;
    const usePreview = preview && preview.type === type && preview.id === id;

    const actualStartTime = usePreview ? preview.startTime : startTime;
    const actualEndTime = usePreview ? preview.endTime : endTime;

    // Convert effective times to visual positions (accounting for gaps)
    const leftPercent = effectiveTimeToVisualPercent(actualStartTime);
    const rightPercent = effectiveTimeToVisualPercent(actualEndTime);
    const widthPercent = Math.max(rightPercent - leftPercent, 1);

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
    };
  }

  function getFilterSegmentStyle(filterSeg: FilterSegment): Record<string, string> {
    const colors = colorMap.rose; // Use rose/pink for filters
    const isSelected = selectedItemKey.value === `filter_${filterSeg.id}`;

    // Use preview position during drag/resize
    const preview = dragPreview.value;
    const usePreview = preview && preview.type === 'filter' && preview.id === filterSeg.id;

    const startTime = usePreview ? preview.startTime : filterSeg.startTime;
    const endTime = usePreview ? preview.endTime : filterSeg.endTime;

    // Convert effective times to visual positions (accounting for gaps)
    const leftPercent = effectiveTimeToVisualPercent(startTime);
    const rightPercent = effectiveTimeToVisualPercent(endTime);
    const widthPercent = Math.max(rightPercent - leftPercent, 1);

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
    };
  }

  function getFilterPresetName(preset: string | null): string {
    if (!preset || preset === 'none') return 'Custom';
    const presetNames: Record<string, string> = {
      warm: 'Warm',
      cool: 'Cool',
      vintage: 'Vintage',
      bw: 'B&W',
      sepia: 'Sepia',
      dramatic: 'Dramatic',
      vivid: 'Vivid',
      muted: 'Muted',
      cinematic: 'Cinematic',
      retro: 'Retro',
      noir: 'Noir',
    };
    return presetNames[preset] || 'Custom';
  }

  function getTrackContentWidth(): number {
    if (rulerContentRef.value) {
      return rulerContentRef.value.getBoundingClientRect().width;
    }
    if (videoTrackContentRef.value) {
      return videoTrackContentRef.value.getBoundingClientRect().width;
    }
    if (contentWrapperRef.value) {
      return contentWrapperRef.value.getBoundingClientRect().width - 64 - 16;
    }
    return 500;
  }

  // Convert click position to source time
  function clickPositionToTime(percent: number): number {
    // Editor mode: simple linear mapping
    if (props.editorMode) {
      const duration = props.duration || 300;
      return percent * duration;
    }

    // Clip mode: segment-based mapping
    const totalGapPercent = (sortedTrimSegments.value.length - 1) * GAP_PERCENT;
    const availablePercent = 100 - totalGapPercent;

    let accumulatedPercent = 0;

    for (let i = 0; i < sortedTrimSegments.value.length; i++) {
      const segment = sortedTrimSegments.value[i];
      const segmentDuration = segment.endTime - segment.startTime;
      const segmentWidthPercent = (segmentDuration / totalDuration.value) * availablePercent;

      const segmentEndPercent = accumulatedPercent + segmentWidthPercent;

      if (percent * 100 >= accumulatedPercent && percent * 100 <= segmentEndPercent) {
        // Click is within this segment
        const percentIntoSegment = (percent * 100 - accumulatedPercent) / segmentWidthPercent;
        return segment.startTime + percentIntoSegment * segmentDuration;
      }

      // Check if click is in gap
      if (i < sortedTrimSegments.value.length - 1) {
        const gapEndPercent = segmentEndPercent + GAP_PERCENT;
        if (percent * 100 > segmentEndPercent && percent * 100 < gapEndPercent) {
          // Click is in gap, return end of current segment
          return segment.endTime;
        }
      }

      accumulatedPercent = segmentEndPercent + (i < sortedTrimSegments.value.length - 1 ? GAP_PERCENT : 0);
    }

    // Default to last segment end
    const lastSegment = sortedTrimSegments.value[sortedTrimSegments.value.length - 1];
    return lastSegment?.endTime || 0;
  }

  function onTrackContentClick(e: MouseEvent) {
    selectedItemKey.value = null;

    const trackContent = e.currentTarget as HTMLElement;
    const rect = trackContent.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = clickPositionToTime(percent);

    emit('seek', Math.max(0, time));
  }

  function onRulerClick(e: MouseEvent) {
    const ruler = e.currentTarget as HTMLElement;
    const rect = ruler.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const percent = x / rect.width;
    const time = clickPositionToTime(percent);

    emit('seek', Math.max(0, time));
  }

  function onSegmentClick(e: MouseEvent, segment: TrimSegment) {
    // Select the segment
    selectItem('trim', segment.id);

    // Also seek to the clicked position within the segment
    const segmentEl = e.currentTarget as HTMLElement;
    const rect = segmentEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentInSegment = x / rect.width;

    // Calculate time within this segment
    const segmentDuration = segment.endTime - segment.startTime;
    const time = segment.startTime + percentInSegment * segmentDuration;

    emit('seek', Math.max(segment.startTime, Math.min(segment.endTime, time)));
  }

  // Playhead dragging
  function onPlayheadMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    isDraggingPlayhead.value = true;

    document.addEventListener('mousemove', onPlayheadDragMove);
    document.addEventListener('mouseup', onPlayheadDragEnd);
  }

  function onPlayheadDragMove(e: MouseEvent) {
    if (!isDraggingPlayhead.value || totalDuration.value <= 0) return;

    if (!videoTrackContentRef.value || !timelineScrollContainer.value) return;

    const scrollContainer = timelineScrollContainer.value;
    const containerRect = scrollContainer.getBoundingClientRect();
    const trackRect = videoTrackContentRef.value.getBoundingClientRect();

    // The label area width (sticky labels take up this space: w-16 = 64px + padding)
    const labelAreaWidth = 72;

    // Left edge of the visible track area (where content can appear, past the labels)
    const visibleTrackLeft = containerRect.left + labelAreaWidth;
    const visibleTrackRight = containerRect.right;

    // Cursor position in viewport coords
    const cursorX = e.clientX;

    // Auto-scroll when cursor is near/past edges
    if (cursorX < visibleTrackLeft) {
      // Cursor is in or past the label area - auto-scroll left
      const distance = visibleTrackLeft - cursorX;
      const speed = Math.min(30, Math.max(5, distance * 0.3));
      scrollContainer.scrollLeft = Math.max(0, scrollContainer.scrollLeft - speed);

      // Set playhead to the time at the left edge of visible track
      const leftEdgeX = visibleTrackLeft - trackRect.left;
      const percent = Math.max(0, Math.min(1, leftEdgeX / trackRect.width));
      const time = clickPositionToTime(percent);
      emit('seek', Math.max(0, time));
      return;
    }

    if (cursorX > visibleTrackRight) {
      // Cursor is past the right edge - auto-scroll right
      const distance = cursorX - visibleTrackRight;
      const speed = Math.min(30, Math.max(5, distance * 0.3));
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      scrollContainer.scrollLeft = Math.min(maxScroll, scrollContainer.scrollLeft + speed);

      // Set playhead to the time at the right edge of visible track
      const rightEdgeX = visibleTrackRight - trackRect.left;
      const percent = Math.max(0, Math.min(1, rightEdgeX / trackRect.width));
      const time = clickPositionToTime(percent);
      emit('seek', time);
      return;
    }

    // Cursor is within the visible track area - normal behavior
    const x = cursorX - trackRect.left;
    const percent = Math.max(0, Math.min(1, x / trackRect.width));
    const time = clickPositionToTime(percent);
    emit('seek', Math.max(0, time));
  }

  function onPlayheadDragEnd() {
    isDraggingPlayhead.value = false;

    document.removeEventListener('mousemove', onPlayheadDragMove);
    document.removeEventListener('mouseup', onPlayheadDragEnd);
  }

  // Video source functions (editor mode)
  function getVideoSourceStyle(source: VideoEditorSource): Record<string, string> {
    const colors = colorMap.violet;
    const isSelected = selectedItemKey.value === `source_${source.id}`;
    const duration = props.duration || 600;

    const left = (source.start_time / duration) * 100;
    const width = ((source.end_time - source.start_time) / duration) * 100;

    return {
      left: `${left}%`,
      width: `${Math.max(width, 1)}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
    };
  }

  // Get style for transition zone overlay (crossfade indicator)
  function getTransitionZoneStyle(transition: VideoEditorTransition): Record<string, string> {
    const duration = props.duration || 600;
    const left = (transition.startTime / duration) * 100;
    const width = ((transition.endTime - transition.startTime) / duration) * 100;

    return {
      left: `${left}%`,
      width: `${Math.max(width, 0.5)}%`,
    };
  }

  function onSourceClick(e: MouseEvent, source: VideoEditorSource) {
    // Select the source
    selectItem('source', source.id);

    // Calculate the clicked position within the source and seek there
    const sourceEl = e.currentTarget as HTMLElement;
    const rect = sourceEl.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentInSource = x / rect.width;

    // Calculate time position: start_time + relative position within the source
    const sourceDuration = source.end_time - source.start_time;
    const time = source.start_time + percentInSource * sourceDuration;

    emit('seek', Math.max(source.start_time, Math.min(source.end_time - 0.01, time)));
  }

  function onSourceMouseDown(e: MouseEvent, source: VideoEditorSource) {
    if (e.button !== 0) return;
    e.preventDefault();

    selectItem('source', source.id);

    isDraggingSource.value = true;
    dragSourceInfo.value = {
      sourceId: source.id,
      startX: e.clientX,
      originalStartTime: source.start_time,
      originalEndTime: source.end_time,
    };

    document.addEventListener('mousemove', onSourceDragMove);
    document.addEventListener('mouseup', onSourceDragEnd);
  }

  function onSourceDragMove(e: MouseEvent) {
    if (!isDraggingSource.value || !dragSourceInfo.value || !videoTrackContentRef.value) return;

    const rect = videoTrackContentRef.value.getBoundingClientRect();
    const deltaX = e.clientX - dragSourceInfo.value.startX;
    const deltaTime = (deltaX / rect.width) * props.duration;

    const duration = dragSourceInfo.value.originalEndTime - dragSourceInfo.value.originalStartTime;
    let newStartTime = dragSourceInfo.value.originalStartTime + deltaTime;
    let newEndTime = newStartTime + duration;

    // Clamp to timeline bounds
    if (newStartTime < 0) {
      newStartTime = 0;
      newEndTime = duration;
    }
    if (newEndTime > props.duration) {
      newEndTime = props.duration;
      newStartTime = props.duration - duration;
    }

    emit('updateSource', dragSourceInfo.value.sourceId, {
      start_time: newStartTime,
      end_time: newEndTime,
    });
  }

  function onSourceDragEnd() {
    isDraggingSource.value = false;
    dragSourceInfo.value = null;
    document.removeEventListener('mousemove', onSourceDragMove);
    document.removeEventListener('mouseup', onSourceDragEnd);
  }

  function onSourceResizeMouseDown(e: MouseEvent, source: VideoEditorSource, handle: 'left' | 'right') {
    if (e.button !== 0) return;
    e.preventDefault();

    isResizingSource.value = true;
    resizeSourceInfo.value = {
      sourceId: source.id,
      handle,
      startX: e.clientX,
      originalStartTime: source.start_time,
      originalEndTime: source.end_time,
    };

    document.addEventListener('mousemove', onSourceResizeDragMove);
    document.addEventListener('mouseup', onSourceResizeDragEnd);
  }

  function onSourceResizeDragMove(e: MouseEvent) {
    if (!isResizingSource.value || !resizeSourceInfo.value || !videoTrackContentRef.value) return;

    const rect = videoTrackContentRef.value.getBoundingClientRect();
    const deltaX = e.clientX - resizeSourceInfo.value.startX;
    const deltaTime = (deltaX / rect.width) * props.duration;

    let newStartTime = resizeSourceInfo.value.originalStartTime;
    let newEndTime = resizeSourceInfo.value.originalEndTime;

    if (resizeSourceInfo.value.handle === 'left') {
      newStartTime = Math.max(0, resizeSourceInfo.value.originalStartTime + deltaTime);
      if (newEndTime - newStartTime < 0.5) {
        newStartTime = newEndTime - 0.5;
      }
    } else {
      newEndTime = Math.min(props.duration, resizeSourceInfo.value.originalEndTime + deltaTime);
      if (newEndTime - newStartTime < 0.5) {
        newEndTime = newStartTime + 0.5;
      }
    }

    emit('updateSource', resizeSourceInfo.value.sourceId, {
      start_time: newStartTime,
      end_time: newEndTime,
    });
  }

  function onSourceResizeDragEnd() {
    isResizingSource.value = false;
    resizeSourceInfo.value = null;
    document.removeEventListener('mousemove', onSourceResizeDragMove);
    document.removeEventListener('mouseup', onSourceResizeDragEnd);
  }

  function onTimelineDragOver(_e: DragEvent) {
    isDragOverTimeline.value = true;
  }

  function onTimelineDrop(e: DragEvent) {
    isDragOverTimeline.value = false;

    if (!e.dataTransfer) return;

    try {
      const data = JSON.parse(e.dataTransfer.getData('application/json'));
      if (data && data.source) {
        // Calculate drop position
        let position = 0;
        if (videoTrackContentRef.value) {
          const rect = videoTrackContentRef.value.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          position = percent * props.duration;
        }

        emit('dropSource', { source: data.source, position });
      }
    } catch (err) {
      console.error('[ClipEditorTimeline] Failed to parse drop data:', err);
    }
  }

  function onTimelineMouseMove(_e: MouseEvent) {
    // Could be used for hover effects
  }

  function onTimelineMouseLeave() {
    // Could be used for hover effects
  }

  function onRulerWheel(event: WheelEvent) {
    event.preventDefault();

    if (!timelineScrollContainer.value) return;

    const scrollContainer = timelineScrollContainer.value;
    const containerRect = scrollContainer.getBoundingClientRect();

    // Cursor position relative to the scroll container's viewport
    const cursorXInContainer = event.clientX - containerRect.left;

    // Current scroll position and content width
    const scrollLeft = scrollContainer.scrollLeft;
    const contentWidth = scrollContainer.scrollWidth;

    // Position in the full content (scroll + cursor offset)
    const contentX = scrollLeft + cursorXInContainer;

    // Calculate the "logical" position (0-1 range, independent of zoom)
    const logicalPosition = contentX / contentWidth;

    // Apply zoom
    const oldZoom = zoomLevel.value;
    const delta = event.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(1, Math.min(5, oldZoom + delta));

    if (newZoom === oldZoom) return;

    zoomLevel.value = newZoom;

    // After zoom, adjust scroll to keep cursor position stable AND ensure playhead is visible
    nextTick(() => {
      const newContentWidth = scrollContainer.scrollWidth;
      const newContentX = logicalPosition * newContentWidth;
      let newScrollLeft = newContentX - cursorXInContainer;

      // Label area width (sticky labels)
      const labelAreaWidth = 72;

      // Calculate playhead position in content
      // From the style: left: calc(64px + (100% - 64px) * playheadPosition)
      // 100% = newContentWidth
      const playheadInContent = 64 + (newContentWidth - 64) * playheadPosition.value;

      // Playhead position in viewport after the proposed scroll
      const playheadInViewport = playheadInContent - newScrollLeft;

      // If playhead would be in or behind the label area, scroll to bring it visible
      if (playheadInViewport < labelAreaWidth) {
        // Scroll so playhead is just past the label area
        newScrollLeft = playheadInContent - labelAreaWidth - 5;
      }

      scrollContainer.scrollLeft = Math.max(0, newScrollLeft);
    });
  }

  // Segment dragging
  function onSegmentMouseDown(e: MouseEvent, type: ItemType, id: string, item: any) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const trackContentWidth = getTrackContentWidth();

    isDragging.value = true;
    dragInfo.value = {
      type,
      id,
      item,
      startX: e.clientX,
      originalStartTime: item.startTime,
      originalEndTime: item.endTime,
      trackContentWidth,
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    if (!isDragging.value || !dragInfo.value) return;

    const itemDuration = dragInfo.value.originalEndTime - dragInfo.value.originalStartTime;
    const deltaX = e.clientX - dragInfo.value.startX;
    const deltaPercent = (deltaX / dragInfo.value.trackContentWidth) * 100;

    let newStartTime: number;
    let newEndTime: number;

    // For trim segments and audio, use linear calculation (they have different coordinate systems)
    if (dragInfo.value.type === 'trim') {
      const deltaTime = (deltaX / dragInfo.value.trackContentWidth) * props.duration;
      newStartTime = dragInfo.value.originalStartTime + deltaTime;
      newEndTime = newStartTime + itemDuration;

      if (newStartTime < 0) {
        newStartTime = 0;
        newEndTime = itemDuration;
      }
      if (newEndTime > props.duration) {
        newEndTime = props.duration;
        newStartTime = props.duration - itemDuration;
      }
    } else if (dragInfo.value.type === 'audio') {
      // Audio uses simple linear positioning
      const deltaTime = (deltaX / dragInfo.value.trackContentWidth) * totalDuration.value;
      newStartTime = dragInfo.value.originalStartTime + deltaTime;
      newEndTime = newStartTime + itemDuration;

      if (newStartTime < 0) {
        newStartTime = 0;
        newEndTime = itemDuration;
      }
    } else {
      // For text, sticker, effect, filter - use gap-aware positioning
      // Calculate original visual position and new visual position
      const originalStartPercent = effectiveTimeToVisualPercent(dragInfo.value.originalStartTime);
      const newStartPercent = Math.max(0, Math.min(100, originalStartPercent + deltaPercent));

      // Convert new visual position back to effective time
      newStartTime = visualPercentToEffectiveTime(newStartPercent);
      newEndTime = newStartTime + itemDuration;

      // Constrain to timeline bounds
      if (newStartTime < 0) {
        newStartTime = 0;
        newEndTime = itemDuration;
      }
      if (newEndTime > totalDuration.value) {
        newEndTime = totalDuration.value;
        newStartTime = totalDuration.value - itemDuration;
      }
    }

    // Update local preview state (no database call)
    dragPreview.value = {
      type: dragInfo.value.type,
      id: dragInfo.value.id,
      startTime: newStartTime,
      endTime: newEndTime,
    };
  }

  function onDragEnd() {
    // Commit the final position to database
    if (dragPreview.value) {
      emitUpdate(dragPreview.value.type, dragPreview.value.id, dragPreview.value.startTime, dragPreview.value.endTime);
    }

    isDragging.value = false;
    dragInfo.value = null;
    dragPreview.value = null;

    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  // Segment resizing
  function onResizeMouseDown(e: MouseEvent, type: ItemType, id: string, handle: 'left' | 'right', item: any) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const trackContentWidth = getTrackContentWidth();

    isResizing.value = true;
    resizeInfo.value = {
      type,
      id,
      handle,
      item,
      startX: e.clientX,
      originalStartTime: item.startTime,
      originalEndTime: item.endTime,
      trackContentWidth,
    };

    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    if (!isResizing.value || !resizeInfo.value) return;

    const deltaX = e.clientX - resizeInfo.value.startX;
    const deltaPercent = (deltaX / resizeInfo.value.trackContentWidth) * 100;
    const minDuration = 0.1;

    let newStartTime = resizeInfo.value.originalStartTime;
    let newEndTime = resizeInfo.value.originalEndTime;

    // For trim segments and audio, use linear calculation
    if (resizeInfo.value.type === 'trim') {
      const deltaTime = (deltaX / resizeInfo.value.trackContentWidth) * props.duration;
      if (resizeInfo.value.handle === 'left') {
        newStartTime = Math.max(0, resizeInfo.value.originalStartTime + deltaTime);
        if (newEndTime - newStartTime < minDuration) {
          newStartTime = newEndTime - minDuration;
        }
      } else {
        newEndTime = Math.min(props.duration, resizeInfo.value.originalEndTime + deltaTime);
        if (newEndTime - newStartTime < minDuration) {
          newEndTime = newStartTime + minDuration;
        }
      }
    } else if (resizeInfo.value.type === 'audio') {
      const deltaTime = (deltaX / resizeInfo.value.trackContentWidth) * totalDuration.value;
      if (resizeInfo.value.handle === 'left') {
        newStartTime = Math.max(0, resizeInfo.value.originalStartTime + deltaTime);
        if (newEndTime - newStartTime < minDuration) {
          newStartTime = newEndTime - minDuration;
        }
      } else {
        newEndTime = resizeInfo.value.originalEndTime + deltaTime;
        if (newEndTime - newStartTime < minDuration) {
          newEndTime = newStartTime + minDuration;
        }
      }
    } else {
      // For text, sticker, effect, filter - use gap-aware positioning
      if (resizeInfo.value.handle === 'left') {
        const originalStartPercent = effectiveTimeToVisualPercent(resizeInfo.value.originalStartTime);
        const newStartPercent = Math.max(0, originalStartPercent + deltaPercent);
        newStartTime = visualPercentToEffectiveTime(newStartPercent);
        if (newEndTime - newStartTime < minDuration) {
          newStartTime = newEndTime - minDuration;
        }
      } else {
        const originalEndPercent = effectiveTimeToVisualPercent(resizeInfo.value.originalEndTime);
        const newEndPercent = Math.min(100, originalEndPercent + deltaPercent);
        newEndTime = visualPercentToEffectiveTime(newEndPercent);
        if (newEndTime - newStartTime < minDuration) {
          newEndTime = newStartTime + minDuration;
        }
        // Constrain to total duration
        if (newEndTime > totalDuration.value) {
          newEndTime = totalDuration.value;
        }
      }
    }

    // Update local preview state (no database call)
    dragPreview.value = {
      type: resizeInfo.value.type,
      id: resizeInfo.value.id,
      startTime: newStartTime,
      endTime: newEndTime,
    };
  }

  function onResizeEnd() {
    // Commit the final position to database
    if (dragPreview.value) {
      emitUpdate(dragPreview.value.type, dragPreview.value.id, dragPreview.value.startTime, dragPreview.value.endTime);
    }

    isResizing.value = false;
    resizeInfo.value = null;
    dragPreview.value = null;

    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  }

  function emitUpdate(type: ItemType, id: string, startTime: number, endTime: number) {
    switch (type) {
      case 'trim':
        emit('updateTrimSegment', id, startTime, endTime);
        break;
      case 'audio':
        emit('updateAudioTrack', id, { startTime, endTime });
        break;
      case 'text':
        emit('updateTextOverlay', id, { startTime, endTime });
        break;
      case 'sticker':
        emit('updateSticker', id, { startTime, endTime });
        break;
      case 'watermark':
        emit('updateWatermark', id, { startTime, endTime });
        break;
      case 'effect':
        emit('updateEffect', id, { startTime, endTime });
        break;
      case 'filter':
        emit('updateFilterSegment', id, { startTime, endTime });
        break;
    }
  }

  // Waveform rendering
  function renderWaveformForSegment(segmentId: string, segment: TrimSegment) {
    const canvas = waveformCanvasRefs.value.get(segmentId);
    if (!canvas || !waveformData.value || !isWaveformLoaded.value) return;

    try {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Set canvas actual size (account for device pixel ratio)
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      // Scale context for device pixel ratio
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);

      // Segment times are relative to the clip (0 to duration)
      // Convert to absolute source video times for waveform extraction
      const absoluteStartTime = props.clipStart + segment.startTime;
      const absoluteEndTime = props.clipStart + segment.endTime;
      const segmentDuration = segment.endTime - segment.startTime;

      // Get the highest resolution waveform data available for maximum detail
      // For segments, we need more peaks because we're showing a smaller portion of the video
      const { duration, resolutions } = waveformData.value;

      // Try resolutions in order of detail (highest first)
      const resolutionOrder = ['extreme', 'ultra', 'high', 'medium', 'low'];
      let peaks: any[] = [];
      let usedResolution = 'high';

      for (const res of resolutionOrder) {
        if (resolutions[res]?.peaks?.length > 0) {
          peaks = resolutions[res].peaks;
          usedResolution = res;
          break;
        }
      }

      if (peaks.length === 0) return;

      // Extract peaks for this segment's time range
      const startRatio = absoluteStartTime / duration;
      const endRatio = absoluteEndTime / duration;
      const startIndex = Math.floor(startRatio * peaks.length);
      const endIndex = Math.ceil(endRatio * peaks.length);
      const segmentPeaks = peaks.slice(startIndex, endIndex);

      if (segmentPeaks.length === 0) return;

      // Calculate how to best display the peaks across the canvas width
      const canvasWidth = rect.width;
      const numPeaks = segmentPeaks.length;

      // Target: thin bars (1-2px) with no/minimal spacing for detailed waveform
      // If we have more peaks than pixels, downsample
      // If we have fewer peaks than pixels, make bars wider
      let displayPeaks = segmentPeaks;
      let barWidth: number;
      let barSpacing: number;

      if (numPeaks > canvasWidth) {
        // More peaks than pixels - downsample to 1 bar per pixel
        const step = numPeaks / canvasWidth;
        displayPeaks = [];
        for (let i = 0; i < canvasWidth; i++) {
          const idx = Math.floor(i * step);
          if (idx < numPeaks) {
            displayPeaks.push(segmentPeaks[idx]);
          }
        }
        barWidth = 1;
        barSpacing = 0;
      } else {
        // Fewer peaks than pixels - spread bars across canvas
        // Use bar width of 2px with spacing calculated to fill canvas
        barWidth = 2;
        const totalBarSpace = numPeaks * barWidth;
        const remainingSpace = canvasWidth - totalBarSpace;
        barSpacing = numPeaks > 1 ? remainingSpace / (numPeaks - 1) : 0;

        // If spacing is too large, increase bar width instead
        if (barSpacing > barWidth * 2) {
          const totalWidth = canvasWidth / numPeaks;
          barWidth = Math.floor(totalWidth * 0.7); // 70% bar, 30% spacing
          barSpacing = totalWidth - barWidth;
        }
      }

      // Normalize peaks to use full available height (find max peak value)
      let maxPeakValue = 0;
      displayPeaks.forEach((peak: any) => {
        const absMax = Math.abs(peak.max);
        const absMin = Math.abs(peak.min);
        if (absMax > maxPeakValue) maxPeakValue = absMax;
        if (absMin > maxPeakValue) maxPeakValue = absMin;
      });

      // Normalize peaks if they're not already at full scale
      const normalizer = maxPeakValue > 0 ? maxPeakValue : 1;
      const normalizedPeaks = displayPeaks.map((peak: any) => ({
        min: peak.min / normalizer,
        max: peak.max / normalizer,
      }));

      // Apply audio gain to peaks
      const gainMultiplier = dbToLinear(props.audioGainDb ?? 0);
      const gainedPeaks = normalizedPeaks.map((peak: any) => ({
        min: Math.max(-1, peak.min * gainMultiplier), // Clamp to prevent overdrive
        max: Math.min(1, peak.max * gainMultiplier),
      }));

      renderSegmentWaveform(canvas, {
        width: rect.width,
        height: rect.height,
        peaks: gainedPeaks,
        segmentDuration,
        currentTime: props.currentTime,
        segmentStartTime: segment.startTime,
        segmentEndTime: segment.endTime,
        barWidth,
        barSpacing,
        amplitude: 0.8,
      });
    } catch (error) {
      console.error('[ClipEditorTimeline] Error rendering waveform:', error);
    }
  }

  function renderSegmentWaveform(
    canvas: HTMLCanvasElement,
    options: {
      width: number;
      height: number;
      peaks: any[];
      segmentDuration: number;
      currentTime: number;
      segmentStartTime: number;
      segmentEndTime: number;
      barWidth: number;
      barSpacing: number;
      amplitude: number;
    }
  ): void {
    const ctx = canvas.getContext('2d');
    if (!ctx || options.peaks.length === 0) return;

    const { width, height, peaks, currentTime, segmentStartTime, segmentEndTime, barWidth, barSpacing, amplitude } =
      options;
    const totalBarWidth = barWidth + barSpacing;
    const centerY = height / 2;
    const maxBarHeight = height * amplitude;

    // Calculate playhead position within segment
    const isWithinSegment = currentTime >= segmentStartTime && currentTime <= segmentEndTime;
    const playheadRatio = isWithinSegment
      ? (currentTime - segmentStartTime) / (segmentEndTime - segmentStartTime)
      : currentTime < segmentStartTime
        ? 0
        : 1;
    const playheadPixel = playheadRatio * width;

    canvas.width = width;
    canvas.height = height;

    ctx.clearRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1.0;

    peaks.forEach((peak, index) => {
      const x = index * totalBarWidth;
      if (x >= width) return;

      const barCenter = x + barWidth / 2;
      const isBeforePlayhead = barCenter < playheadPixel;
      const color = isBeforePlayhead ? '#e4e4e7' : '#a78bfa';

      ctx.fillStyle = color;
      ctx.globalAlpha = 1.0;

      const positiveHeight = Math.abs(peak.max) * maxBarHeight;
      const negativeHeight = Math.abs(peak.min) * maxBarHeight;
      const actualBarWidth = Math.min(barWidth, width - x);

      if (positiveHeight > 0 && actualBarWidth > 0) {
        ctx.fillRect(x, centerY - positiveHeight, actualBarWidth, positiveHeight);
      }
      if (negativeHeight > 0 && actualBarWidth > 0) {
        ctx.fillRect(x, centerY, actualBarWidth, negativeHeight);
      }
    });

    ctx.globalAlpha = 1.0;
  }

  function renderAllWaveforms() {
    if (!isWaveformLoaded.value || !waveformData.value) return;

    sortedTrimSegments.value.forEach((segment) => {
      renderWaveformForSegment(segment.id, segment);
    });
  }

  // Audio track waveform functions
  async function loadAudioWaveform(trackId: string, audioSrc: string): Promise<void> {
    // Skip if already loaded
    if (audioWaveformData.value.has(trackId)) return;

    // Check URL type
    const isDataUrl = audioSrc.startsWith('data:');
    const isBlobUrl = audioSrc.startsWith('blob:');

    // For blob URLs (legacy/invalid), use simulated waveform
    if (isBlobUrl) {
      // Blob URLs from previous sessions are invalid - use simulated waveform
      generateSimulatedAudioWaveform(trackId);
      return;
    }

    try {
      let arrayBuffer: ArrayBuffer;

      if (isDataUrl) {
        // Convert data URL to ArrayBuffer
        arrayBuffer = dataUrlToArrayBuffer(audioSrc);
      } else {
        // Fetch from URL
        const response = await fetch(audioSrc);
        arrayBuffer = await response.arrayBuffer();
      }

      const audioContext = new AudioContext();

      // Decode the audio
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Get raw audio data (use first channel)
      const channelData = audioBuffer.getChannelData(0);
      const duration = audioBuffer.duration;

      // Generate peaks - aim for about 1000 peaks
      const targetPeaks = 1000;
      const samplesPerPeak = Math.floor(channelData.length / targetPeaks);
      const peaks: { min: number; max: number }[] = [];

      for (let i = 0; i < targetPeaks; i++) {
        const start = i * samplesPerPeak;
        const end = Math.min(start + samplesPerPeak, channelData.length);

        let min = 0;
        let max = 0;

        for (let j = start; j < end; j++) {
          const value = channelData[j];
          if (value < min) min = value;
          if (value > max) max = value;
        }

        peaks.push({ min, max });
      }

      audioWaveformData.value.set(trackId, { peaks, duration });
      audioContext.close();

      // Render the waveform
      renderAudioWaveform(trackId);
    } catch (err) {
      // Silently fall back to simulated waveform
      generateSimulatedAudioWaveform(trackId);
    }
  }

  // Convert a data URL to ArrayBuffer
  function dataUrlToArrayBuffer(dataUrl: string): ArrayBuffer {
    // Extract base64 data from data URL
    const base64 = dataUrl.split(',')[1];
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function generateSimulatedAudioWaveform(trackId: string): void {
    const track = props.audioTracks.find((t) => t.id === trackId);
    if (!track) return;

    const duration = track.endTime - track.startTime;
    const peakCount = Math.max(100, Math.min(1000, Math.floor(duration * 50)));
    const peaks: { min: number; max: number }[] = [];

    for (let i = 0; i < peakCount; i++) {
      const t = i / peakCount;
      const baseAmplitude = 0.3 + Math.random() * 0.3;
      const variation = Math.sin(t * Math.PI * 6) * 0.15 + Math.random() * 0.1;

      peaks.push({
        min: -(baseAmplitude + Math.abs(variation)),
        max: baseAmplitude + Math.abs(variation),
      });
    }

    audioWaveformData.value.set(trackId, { peaks, duration });
    renderAudioWaveform(trackId);
  }

  function renderAudioWaveform(trackId: string): void {
    const data = audioWaveformData.value.get(trackId);
    const track = props.audioTracks.find((t) => t.id === trackId);

    if (!data || !track) return;

    // Get visual segments for this track
    const visualSegments = getAudioVisualSegments(track);

    // Render each visual segment
    visualSegments.forEach((visualSeg, segIdx) => {
      renderAudioVisualSegmentWaveform(trackId, segIdx, visualSeg, data, track);
    });
  }

  function renderAudioVisualSegmentWaveform(
    trackId: string,
    segIdx: number,
    visualSeg: AudioVisualSegment,
    data: { peaks: { min: number; max: number }[]; duration: number },
    track: AudioTrack
  ): void {
    const canvas = audioSegmentCanvasRefs.value.get(`${trackId}-${segIdx}`);
    if (!canvas) return;

    try {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.scale(dpr, dpr);

      const { peaks } = data;
      const width = rect.width;
      const height = rect.height;
      const centerY = height / 2;
      const maxBarHeight = height * 0.8;

      // Calculate which portion of the waveform to show for this visual segment
      const audioDuration = track.endTime - track.startTime;
      const segmentStartRatio = visualSeg.audioStartTime / audioDuration;
      const segmentEndRatio = visualSeg.audioEndTime / audioDuration;

      const startPeakIndex = Math.floor(segmentStartRatio * peaks.length);
      const endPeakIndex = Math.ceil(segmentEndRatio * peaks.length);
      const segmentPeaks = peaks.slice(startPeakIndex, Math.max(startPeakIndex + 1, endPeakIndex));

      if (segmentPeaks.length === 0) return;

      // Normalize peaks
      let maxPeakValue = 0;
      segmentPeaks.forEach((peak) => {
        if (Math.abs(peak.max) > maxPeakValue) maxPeakValue = Math.abs(peak.max);
        if (Math.abs(peak.min) > maxPeakValue) maxPeakValue = Math.abs(peak.min);
      });
      const normalizer = maxPeakValue > 0 ? maxPeakValue : 1;

      // Apply per-track volume and dB gain (matching audio playback behavior)
      const trackDbGain = props.trackDbValues?.[trackId] ?? 0;
      const dbGainMultiplier = dbToLinear(trackDbGain);
      // Combine volume (0-1) with dB gain for waveform visualization
      const gainMultiplier = track.volume * dbGainMultiplier;

      // Calculate bar dimensions
      const numPeaks = segmentPeaks.length;
      let displayPeaks = segmentPeaks;
      let barWidth: number;
      let barSpacing: number;

      if (numPeaks > width) {
        const step = numPeaks / width;
        displayPeaks = [];
        for (let i = 0; i < width; i++) {
          const idx = Math.floor(i * step);
          if (idx < numPeaks) {
            displayPeaks.push(segmentPeaks[idx]);
          }
        }
        barWidth = 1;
        barSpacing = 0;
      } else {
        barWidth = 2;
        const totalBarSpace = numPeaks * barWidth;
        const remainingSpace = width - totalBarSpace;
        barSpacing = numPeaks > 1 ? remainingSpace / (numPeaks - 1) : 0;
        if (barSpacing > barWidth * 2) {
          const totalWidth = width / numPeaks;
          barWidth = Math.floor(totalWidth * 0.7);
          barSpacing = totalWidth - barWidth;
        }
      }

      const totalBarWidth = barWidth + barSpacing;

      // Calculate playhead position for this segment
      let accumulatedAudioTime = 0;
      const currentVideoTime = props.currentTime;

      for (const segment of sortedTrimSegments.value) {
        if (currentVideoTime < segment.startTime) {
          break;
        } else if (currentVideoTime <= segment.endTime) {
          accumulatedAudioTime += currentVideoTime - segment.startTime;
          break;
        } else {
          accumulatedAudioTime += segment.endTime - segment.startTime;
        }
      }

      // Calculate playhead position within this visual segment
      const segmentDuration = visualSeg.audioEndTime - visualSeg.audioStartTime;
      const playheadInSegment = accumulatedAudioTime - visualSeg.audioStartTime;
      const playheadRatio = Math.max(0, Math.min(1, playheadInSegment / segmentDuration));
      const playheadPixel = playheadRatio * width;

      ctx.clearRect(0, 0, width, height);

      displayPeaks.forEach((peak, index) => {
        const x = index * totalBarWidth;
        if (x >= width) return;

        const barCenter = x + barWidth / 2;
        const isBeforePlayhead = barCenter < playheadPixel;
        const color = isBeforePlayhead ? '#e4e4e7' : '#34d399'; // Gray for played, emerald for remaining

        ctx.fillStyle = color;

        // Apply gain and clamp to prevent overdrive
        const gainedMax = Math.min(1, Math.abs(peak.max / normalizer) * gainMultiplier);
        const gainedMin = Math.min(1, Math.abs(peak.min / normalizer) * gainMultiplier);
        const positiveHeight = gainedMax * maxBarHeight;
        const negativeHeight = gainedMin * maxBarHeight;
        const actualBarWidth = Math.min(barWidth, width - x);

        if (positiveHeight > 0 && actualBarWidth > 0) {
          ctx.fillRect(x, centerY - positiveHeight, actualBarWidth, positiveHeight);
        }
        if (negativeHeight > 0 && actualBarWidth > 0) {
          ctx.fillRect(x, centerY, actualBarWidth, negativeHeight);
        }
      });
    } catch (error) {
      console.error('[ClipEditorTimeline] Error rendering audio segment waveform:', error);
    }
  }

  function renderAllAudioWaveforms(): void {
    props.audioTracks.forEach((track) => {
      renderAudioWaveform(track.id);
    });
  }

  async function loadAllAudioWaveforms(): Promise<void> {
    for (const track of props.audioTracks) {
      if (track.filePath) {
        await loadAudioWaveform(track.id, track.filePath);
      }
    }
  }

  // Setup resize observer for waveform canvases
  function setupResizeObserver() {
    resizeObserver = new ResizeObserver(() => {
      renderAllWaveforms();
      renderAllAudioWaveforms();
    });

    waveformCanvasRefs.value.forEach((canvas) => {
      if (canvas && resizeObserver) {
        resizeObserver.observe(canvas);
      }
    });

    audioWaveformCanvasRefs.value.forEach((canvas) => {
      if (canvas && resizeObserver) {
        resizeObserver.observe(canvas);
      }
    });

    audioSegmentCanvasRefs.value.forEach((canvas) => {
      if (canvas && resizeObserver) {
        resizeObserver.observe(canvas);
      }
    });
  }

  function cleanupResizeObserver() {
    if (resizeObserver) {
      resizeObserver.disconnect();
      resizeObserver = null;
    }
  }

  // Watch for video source changes
  watch(
    () => props.videoSrc,
    async (newVideoSrc) => {
      if (newVideoSrc) {
        await loadWaveformFromVideo(newVideoSrc);
      }
    },
    { immediate: true }
  );

  // Watch for waveform and segment changes
  watch(
    [waveformData, isWaveformLoaded, () => props.currentTime, zoomLevel, sortedTrimSegments],
    () => {
      if (isWaveformLoaded.value && waveformData.value) {
        nextTick(() => {
          renderAllWaveforms();
        });
      }
    },
    { immediate: true }
  );

  // Watch specifically for audio gain changes to ensure waveform updates
  watch(
    () => props.audioGainDb,
    () => {
      if (isWaveformLoaded.value && waveformData.value) {
        nextTick(() => {
          renderAllWaveforms();
        });
      }
    }
  );

  // Watch for per-track dB value changes to re-render audio track waveforms
  watch(
    () => props.trackDbValues,
    () => {
      nextTick(() => {
        renderAllAudioWaveforms();
      });
    },
    { deep: true }
  );

  // Watch for audio track changes (including volume, mute, etc.)
  watch(
    () => props.audioTracks,
    async (newTracks) => {
      // Load waveforms for new tracks
      for (const track of newTracks) {
        if (track.filePath && !audioWaveformData.value.has(track.id)) {
          await loadAudioWaveform(track.id, track.filePath);
        }
      }

      // Clean up data for removed tracks
      const trackIds = new Set(newTracks.map((t) => t.id));
      audioWaveformData.value.forEach((_, id) => {
        if (!trackIds.has(id)) {
          audioWaveformData.value.delete(id);
          audioWaveformCanvasRefs.value.delete(id);
        }
      });

      // Re-render all audio waveforms to reflect any property changes (volume, etc.)
      nextTick(() => {
        renderAllAudioWaveforms();
      });
    },
    { deep: true, immediate: true }
  );

  // Watch for current time changes to update audio waveforms
  watch(
    () => props.currentTime,
    () => {
      nextTick(() => {
        renderAllAudioWaveforms();
      });
    }
  );

  // Watch for drag preview changes to re-render audio waveforms when segments split/merge
  watch(
    dragPreview,
    () => {
      // Use nextTick + requestAnimationFrame to ensure canvas refs are set up after DOM update
      nextTick(() => {
        requestAnimationFrame(() => {
          renderAllAudioWaveforms();
        });
      });
    },
    { deep: true }
  );

  // Smooth playhead animation functions
  function startPlayheadAnimation() {
    if (animationFrameId !== null) return;

    lastUpdateTime = performance.now();
    targetPosition = playheadPosition.value;
    smoothPlayheadPosition.value = playheadPosition.value;

    function animate(currentTime: number) {
      if (!props.isPlaying || isDraggingPlayhead.value) {
        animationFrameId = null;
        return;
      }

      // Calculate time elapsed since last frame
      const deltaTime = currentTime - lastUpdateTime;

      // Snap playhead to target position immediately
      // This ensures playhead stays perfectly in sync with crossfade visual
      // The Math.min(1, ...) ensures we never overshoot even with variable frame rates
      const interpolationSpeed = 10.0; // High value = essentially instant (clamped to 1.0)
      const diff = targetPosition - smoothPlayheadPosition.value;

      if (Math.abs(diff) > 0.0001) {
        // With high speed, this effectively snaps to position each frame
        smoothPlayheadPosition.value += diff * Math.min(1, (interpolationSpeed * deltaTime) / 16);
      } else {
        smoothPlayheadPosition.value = targetPosition;
      }

      lastUpdateTime = currentTime;
      animationFrameId = requestAnimationFrame(animate);
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  function stopPlayheadAnimation() {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    // Snap to exact position when stopping
    smoothPlayheadPosition.value = playheadPosition.value;
  }

  // The effective playhead position used in the template
  const effectivePlayheadPosition = computed(() => {
    // During dragging, always use computed position directly (no animation)
    if (isDraggingPlayhead.value) {
      return playheadPosition.value;
    }
    // During playback, use smooth animated position
    if (props.isPlaying) {
      return smoothPlayheadPosition.value;
    }
    // When paused, use exact computed position
    return playheadPosition.value;
  });

  // Watch for playback state changes
  watch(
    () => props.isPlaying,
    (isPlaying) => {
      if (isPlaying) {
        startPlayheadAnimation();
      } else {
        stopPlayheadAnimation();
      }
    }
  );

  // Update target position when currentTime changes (during playback)
  watch(playheadPosition, (newPosition) => {
    targetPosition = newPosition;
    // If not playing, sync immediately
    if (!props.isPlaying) {
      smoothPlayheadPosition.value = newPosition;
    }
  });

  // Lifecycle
  onMounted(() => {
    nextTick(async () => {
      setupResizeObserver();
      if (props.videoSrc) {
        loadWaveformFromVideo(props.videoSrc);
      }
      // Load audio waveforms for existing tracks
      await loadAllAudioWaveforms();
    });
  });

  onUnmounted(() => {
    cleanupResizeObserver();
    stopPlayheadAnimation();
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.removeEventListener('mousemove', onPlayheadDragMove);
    document.removeEventListener('mouseup', onPlayheadDragEnd);
  });
</script>

<style scoped>
  /* Timeline ruler styling */
  .timeline-ruler {
    background: rgba(10, 10, 10, 0.6);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    user-select: none;
  }

  /* Sticky track labels - prevent sub-pixel jitter during scroll */
  :deep(.sticky) {
    transform: translateZ(0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  .timeline-tick {
    transition: all 0.2s ease;
  }

  /* Clip segment animations */
  .clip-segment {
    transition:
      transform 0.2s ease-out,
      box-shadow 0.2s ease-out,
      border-color 0.15s ease;
    will-change: transform, box-shadow;
  }

  /* No transitions during drag for smoother performance */
  .clip-segment.dragging,
  .clip-segment.resizing {
    transition: none !important;
  }

  /* Enhanced hover state for clip segments */
  .clip-segment:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  /* Ensure resize handles are visible on segment hover */
  .clip-segment:hover .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
  }

  /* Enhanced cursor states */
  .clip-segment:not(.dragging):hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  }

  /* Selected segment styling */
  .clip-segment.selected-segment {
    z-index: 15;
    border-color: #3b82f6 !important;
  }

  /* Active resize handle styling */
  .clip-segment.resizing .resize-handle {
    opacity: 1 !important;
    pointer-events: auto !important;
    background: rgba(255, 255, 255, 0.8) !important;
  }

  .clip-segment.dragging {
    cursor: grabbing !important;
  }

  /* Smooth transitions for non-dragging states */
  .clip-segment:not(.dragging) {
    transition:
      transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
      border-color 0.15s ease;
  }

  /* Timeline content wrapper */
  .timeline-content-wrapper.dragging {
    cursor: grabbing;
  }

  /* Zoom slider styling */
  .slider-zoom {
    -webkit-appearance: none;
    appearance: none;
    outline: none;
    transition: opacity 0.2s;
  }

  .slider-zoom::-webkit-slider-track {
    width: 100%;
    height: 3px;
    border-radius: 4px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.15);
  }

  .slider-zoom::-moz-range-track {
    width: 100%;
    height: 3px;
    border-radius: 4px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.15);
  }

  .slider-zoom::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 10px;
    height: 10px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: all 0.15s ease;
  }

  .slider-zoom::-moz-range-thumb {
    width: 10px;
    height: 10px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
    transition: all 0.15s ease;
  }

  .slider-zoom:hover::-webkit-slider-thumb {
    transform: scale(1.2);
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
  }

  .slider-zoom:hover::-moz-range-thumb {
    transform: scale(1.2);
    box-shadow: 0 2px 8px rgba(139, 92, 246, 0.4);
  }

  /* Playhead positioning using CSS custom property */
  /* Label width is w-16 = 64px, track content is the remaining width */
  .playhead-line {
    --playhead-position: 0;
    left: calc(64px + (100% - 64px) * var(--playhead-position));
    will-change: left;
    /* Smooth transition for seeks (when paused) */
    transition: left 100ms ease-out;
  }

  /* During playback, use requestAnimationFrame - disable CSS transition */
  .playhead-line.playhead-playing {
    transition: none;
  }

  /* Disable transition when dragging for immediate response */
  .playhead-line.playhead-dragging {
    transition: none !important;
  }

  /* Transition zone (crossfade) styling */
  .transition-zone {
    /* Pulsing animation to draw attention */
    animation: transition-pulse 2s ease-in-out infinite;
  }

  @keyframes transition-pulse {
    0%,
    100% {
      opacity: 0.9;
    }
    50% {
      opacity: 1;
    }
  }

  .transition-zone-bg {
    border: 1px dashed rgba(255, 255, 255, 0.3);
    border-radius: 4px;
  }

  /* Diagonal stripes pattern for transition zone */
  .transition-zone-stripes {
    background: repeating-linear-gradient(
      -45deg,
      transparent,
      transparent 3px,
      rgba(255, 255, 255, 0.15) 3px,
      rgba(255, 255, 255, 0.15) 6px
    );
  }

  /* Hover effect for transition zones */
  .transition-zone:hover .transition-zone-bg {
    border-color: rgba(255, 255, 255, 0.5);
  }
</style>
