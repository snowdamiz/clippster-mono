<template>
  <div class="bg-[#0c0c0c] transition-all duration-300 ease-in-out">
    <div class="pt-2 px-3 pb-2 flex flex-col max-h-[55vh] gap-2">
      <!-- Timeline Header (compact, CapCut-like) -->
      <div class="flex items-center justify-between pr-2 flex-shrink-0 text-white/70 text-[12px]">
        <div class="flex items-center gap-1.5">
          <!-- Timeline Toolbar -->
          <div class="flex items-center gap-1 bg-[#121212] rounded-md px-2 py-1 border border-white/[0.02]">
            <button
              @click="performCutAtPlayhead"
              class="p-1.5 rounded-md transition-colors duration-150 text-white/60 hover:text-orange-300 hover:bg-orange-500/10"
              title="Split at playhead (X key)"
            >
              <Scissors :size="14" />
            </button>
            <div class="w-px h-5 bg-white/10 mx-1"></div>
            <button
              @click="emit('undo')"
              :disabled="!canUndo"
              class="p-1.5 rounded-md transition-colors duration-150 text-white/60 hover:text-blue-300 hover:bg-blue-500/10 disabled:text-white/20 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 :size="14" />
            </button>
            <button
              @click="emit('redo')"
              :disabled="!canRedo"
              class="p-1.5 rounded-md transition-colors duration-150 text-white/60 hover:text-blue-300 hover:bg-blue-500/10 disabled:text-white/20 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 :size="14" />
            </button>
            <div class="w-px h-5 bg-white/10 mx-1"></div>
            <button
              @mousedown="startContinuousSeeking('reverse')"
              @mouseup="stopContinuousSeeking"
              @mouseleave="stopContinuousSeeking"
              @touchstart="startContinuousSeeking('reverse')"
              @touchend="stopContinuousSeeking"
              :class="[
                'p-1.5 rounded-md transition-colors duration-150',
                isSeeking && seekDirection === 'reverse'
                  ? 'text-amber-300 bg-amber-500/20'
                  : 'text-white/60 hover:text-amber-300 hover:bg-amber-500/10',
              ]"
              :title="'Seek backward (← arrow key)'"
            >
              <Rewind :size="14" />
            </button>
            <button
              @mousedown="startContinuousSeeking('forward')"
              @mouseup="stopContinuousSeeking"
              @mouseleave="stopContinuousSeeking"
              @touchstart="startContinuousSeeking('forward')"
              @touchend="stopContinuousSeeking"
              :class="[
                'p-1.5 rounded-md transition-colors duration-150',
                isSeeking && seekDirection === 'forward'
                  ? 'text-amber-300 bg-amber-500/20'
                  : 'text-white/60 hover:text-amber-300 hover:bg-amber-500/10',
              ]"
              :title="'Seek forward (→ arrow key)'"
            >
              <FastForward :size="14" />
            </button>
          </div>
          <!-- Zoom Controls -->
          <div class="flex items-center gap-1 bg-[#121212] rounded-md px-2 py-1 border border-white/[0.02]">
            <button
              @click="zoomOut"
              :disabled="zoomLevel <= MIN_ZOOM"
              class="p-1 rounded-md transition-colors duration-150 text-white/60 hover:text-white hover:bg-white/10 disabled:text-white/20 disabled:cursor-not-allowed"
              title="Zoom out"
            >
              <Minus :size="13" />
            </button>
            <span class="text-[11px] text-white/60 font-mono tabular-nums min-w-[46px] text-center select-none px-1">
              {{ Math.round(zoomLevel * 100) }}%
            </span>
            <button
              @click="zoomIn"
              class="p-1 rounded-md transition-colors duration-150 text-white/60 hover:text-white hover:bg-white/10"
              title="Zoom in"
            >
              <Plus :size="13" />
            </button>
          </div>
        </div>
        <div class="flex items-center gap-1.5">
          <label class="flex items-center gap-1.5 text-[11px] text-white/60 bg-white/[0.04] px-2 py-1 rounded-md border border-white/10">
            <input type="checkbox" v-model="snapEnabled" class="accent-violet-500 h-3 w-3" />
            <span>Snap</span>
          </label>
          <span
            v-if="sortedTrimSegments.length > 1"
            class="text-[11px] text-violet-300/80 bg-violet-500/10 px-2.5 py-1 rounded-md"
          >
            {{ sortedTrimSegments.length }} segments
          </span>
          <span class="text-[11px] text-white/50 bg-white/[0.04] px-2 py-1 rounded-md">
            {{ formatTime(totalDuration) }}
          </span>
        </div>
      </div>

      <!-- Timeline Tracks Container -->
      <div
        ref="timelineScrollContainer"
        class="bg-[#0c0c0c] rounded-md relative overflow-y-auto overflow-x-hidden flex-1 min-h-0 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-[#0c0c0c]"
        @mousemove="onTimelineMouseMove"
        @mouseleave="onTimelineMouseLeave"
        @click="onTimelineContainerClick"
      >
        <!-- Horizontal scroller for ruler + tracks -->
        <div class="overflow-x-auto pb-2">
          <!-- Timeline Content Wrapper - handles zoom width -->
          <div
            ref="contentWrapperRef"
            class="timeline-content-wrapper relative"
            :class="{ dragging: isDragging || isResizing }"
            :style="{ width: `${Math.max(1, zoomLevel) * 100}%`, minHeight: '100%' }"
          >
          <!-- Full-width Timestamp Ruler -->
          <div
            class="h-7 border-b border-white/[0.06] flex items-center bg-[#0c0c0c] sticky top-0 z-50 timeline-ruler"
            @wheel="onRulerWheel"
            title="Scroll to zoom"
          >
            <!-- Track label spacer - matches track header width -->
            <div
              class="w-[100px] h-full flex items-center justify-start flex-shrink-0 sticky left-0 z-[70] bg-[#0c0c0c] border-r border-white/[0.08]"
            >
            </div>
            <!-- Continuous ruler ticks across full duration -->
            <div
              ref="rulerContentRef"
              class="flex-1 relative h-full flex items-center cursor-pointer"
              @click="onRulerClick"
            >
              <div class="absolute inset-0">
                <div
                  v-for="tick in rulerTicks"
                  :key="tick.key"
                  class="absolute flex flex-col items-center"
                  :style="{ left: `${tick.percent}%`, transform: 'translateX(-50%)', bottom: '0' }"
                >
                  <div class="w-px bg-foreground/20 timeline-tick" :class="tick.isMajor ? 'h-4' : 'h-2'"></div>
                  <span
                    v-if="tick.isMajor"
                    class="text-[10px] text-foreground/40 whitespace-nowrap font-normal mt-0.5"
                  >
                    {{ formatTime(tick.time) }}
                  </span>
                </div>
              </div>

              <!-- Timeline Markers -->
              <div
                v-for="marker in visibleMarkers"
                :key="marker.id"
                class="absolute top-0 bottom-0 flex flex-col items-center cursor-pointer z-[60] group"
                :class="{
                  'opacity-100': props.selectedMarkerId === marker.id,
                  'opacity-80 hover:opacity-100': props.selectedMarkerId !== marker.id,
                }"
                :style="{ left: `${marker.leftPercent}%`, transform: 'translateX(-50%)' }"
                @click.stop="emit('markerClick', marker.id)"
                :title="marker.label || 'Marker'"
              >
                <!-- Marker flag icon -->
                <div
                  class="w-6 h-6 flex items-center justify-center rounded-full transition-all duration-150"
                  :class="
                    props.selectedMarkerId === marker.id
                      ? 'bg-yellow-500 shadow-lg shadow-yellow-500/50'
                      : 'bg-yellow-500/80 group-hover:bg-yellow-500'
                  "
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="white"
                    stroke="none"
                  >
                    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                    <line x1="4" y1="22" x2="4" y2="15" stroke="white" stroke-width="2" />
                  </svg>
                </div>
                <!-- Marker line -->
                <div
                  class="w-0.5 h-full transition-all duration-150"
                  :class="
                    props.selectedMarkerId === marker.id
                      ? 'bg-yellow-500'
                      : 'bg-yellow-500/60 group-hover:bg-yellow-500/80'
                  "
                ></div>
              </div>
            </div>
          </div>

          <!-- Placeholder tracks above primary video -->
          <div
            v-for="n in PLACEHOLDER_TOP_COUNT"
            :key="'placeholder-top-'+n"
            class="flex items-center h-10 relative"
          >
            <div class="track-label w-[100px] h-full sticky left-0 z-[70] bg-[#0c0c0c] flex-shrink-0 border-r border-white/[0.08]"></div>
            <div class="flex-1 h-full relative bg-[#111]"></div>
          </div>

          <!-- Unified Layer tracks (can contain video sources, text, stickers, watermarks) -->
          <div
            v-for="layerGroup in visualLayers"
            :key="`layer-${layerGroup.layer}`"
            :data-layer-track="layerGroup.layer"
            class="flex items-center h-10 relative"
            :class="{
              'bg-purple-500/10 ring-2 ring-purple-500/50': (isDragging && dragInfo?.type && ['text', 'sticker', 'watermark'].includes(dragInfo.type) && dragInfo?.targetLayer === layerGroup.layer) || (isDraggingSource && dragSourceInfo?.targetTrackIndex === layerGroup.layer)
            }"
          >
            <div
              class="track-label w-[100px] h-full pl-2 flex items-center justify-start text-xs text-white/50 sticky left-0 z-[70] bg-[#0c0c0c] flex-shrink-0 border-r border-white/[0.08]"
            >
              <div class="font-medium">Layer {{ layerGroup.layer }}</div>
            </div>
            <div class="flex-1 h-full relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#111] cursor-pointer"></div>
              
              <!-- Render all items in this layer -->
              <template v-for="overlayItem in layerGroup.items" :key="`${overlayItem.type}-${overlayItem.item.id}`">
                <!-- Video Source (in layer) -->
                <div
                  v-if="overlayItem.type === 'source'"
                  :ref="(el) => setSegmentRef(el, 'source', overlayItem.item.id)"
                  class="clip-segment absolute top-1 bottom-1 rounded-md overflow-hidden group border-2 border-cyan-500"
                  :class="getSegmentClasses('source', overlayItem.item.id)"
                  :style="getVideoSourceStyle(overlayItem.item, sourcePreview)"
                  @mousedown="(e) => onSourceMouseDown(e, overlayItem.item)"
                  @click.stop="selectItem('source', overlayItem.item.id)"
                >
                  <div class="absolute inset-0 bg-[#1a1a1a]"></div>
                  <span class="relative z-10 text-xs text-cyan-400 font-medium truncate px-1 drop-shadow-sm pointer-events-none">
                    {{ overlayItem.item.source_name || 'Video' }}
                  </span>
                </div>
                
                <!-- Sticker -->
                <div
                  v-if="overlayItem.type === 'sticker'"
                  :ref="(el) => setSegmentRef(el, 'sticker', overlayItem.item.id)"
                  class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center justify-center group"
                  :class="getSegmentClasses('sticker', overlayItem.item.id)"
                  :style="getSegmentStyle(overlayItem.item.startTime, overlayItem.item.endTime, 'pink', 'sticker', overlayItem.item.id)"
                  @mousedown="(e) => onSegmentMouseDown(e, 'sticker', overlayItem.item.id, overlayItem.item)"
                  @click.stop="selectItem('sticker', overlayItem.item.id)"
                >
                  <span v-if="overlayItem.item.stickerType === 'emoji'" class="text-sm pointer-events-none">
                    {{ overlayItem.item.stickerPath }}
                  </span>
                  <span v-else class="text-xs text-white/90 font-medium truncate px-1 drop-shadow-sm pointer-events-none">
                    Sticker
                  </span>
                  <!-- Left resize handle -->
                  <div
                    class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onResizeMouseDown(e, 'sticker', overlayItem.item.id, 'left', overlayItem.item)"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                  <!-- Right resize handle -->
                  <div
                    class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onResizeMouseDown(e, 'sticker', overlayItem.item.id, 'right', overlayItem.item)"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                </div>
                
                <!-- Text Overlay -->
                <div
                  v-if="overlayItem.type === 'text'"
                  :ref="(el) => setSegmentRef(el, 'text', overlayItem.item.id)"
                  class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center px-2 group"
                  :class="getSegmentClasses('text', overlayItem.item.id)"
                  :style="getSegmentStyle(overlayItem.item.startTime, overlayItem.item.endTime, 'amber', 'text', overlayItem.item.id)"
                  @mousedown="(e) => onSegmentMouseDown(e, 'text', overlayItem.item.id, overlayItem.item)"
                  @click.stop="selectItem('text', overlayItem.item.id)"
                >
                  <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm pointer-events-none">
                    {{ overlayItem.item.text }}
                  </span>
                  <!-- Left resize handle -->
                  <div
                    class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onResizeMouseDown(e, 'text', overlayItem.item.id, 'left', overlayItem.item)"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                  <!-- Right resize handle -->
                  <div
                    class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onResizeMouseDown(e, 'text', overlayItem.item.id, 'right', overlayItem.item)"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                </div>
                
                <!-- Watermark -->
                <div
                  v-if="overlayItem.type === 'watermark'"
                  :ref="(el) => setSegmentRef(el, 'watermark', overlayItem.item.id)"
                  class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center px-2 group"
                  :class="getSegmentClasses('watermark', overlayItem.item.id)"
                  :style="getSegmentStyle(overlayItem.item.startTime, overlayItem.item.endTime, 'cyan', 'watermark', overlayItem.item.id)"
                  @mousedown="(e) => onSegmentMouseDown(e, 'watermark', overlayItem.item.id, overlayItem.item)"
                  @click.stop="selectItem('watermark', overlayItem.item.id)"
                >
                  <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm pointer-events-none">
                    Watermark
                  </span>
                  <!-- Left resize handle -->
                  <div
                    class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onResizeMouseDown(e, 'watermark', overlayItem.item.id, 'left', overlayItem.item)"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                  <!-- Right resize handle -->
                  <div
                    class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onResizeMouseDown(e, 'watermark', overlayItem.item.id, 'right', overlayItem.item)"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Legacy single tracks (kept for backward compatibility if no layers defined) -->
          <div v-if="textOverlays.length > 0 && visualOverlayLayers.length === 0" class="flex items-center h-12 relative">
            <div
              class="track-label w-[100px] h-full pl-2 flex items-center justify-start text-xs text-white/50 sticky left-0 z-[70] bg-[#0c0c0c] flex-shrink-0 border-r border-white/[0.08]"
            >
              <div class="font-medium flex items-center gap-1">
                <Type :size="12" />
                Text
              </div>
            </div>
            <div class="flex-1 h-full relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#111] cursor-pointer"></div>
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

          <div v-if="effects.length > 0" class="flex items-center h-12 relative">
            <div
              class="track-label w-[100px] h-full pl-2 flex items-center justify-start text-xs text-white/50 sticky left-0 z-[70] bg-[#0c0c0c] flex-shrink-0 border-r border-white/[0.08]"
            >
              <div class="font-medium flex items-center gap-1">
                <Sparkles :size="12" />
                Effects
              </div>
            </div>
            <div class="flex-1 h-full relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#111] cursor-pointer"></div>
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

          <div v-if="filterSegments.length > 0" class="flex items-center h-12 relative">
            <div
              class="track-label w-[100px] h-full pl-2 flex items-center justify-start text-xs text-white/50 sticky left-0 z-[70] bg-[#0c0c0c] flex-shrink-0 border-r border-white/[0.08]"
            >
              <div class="font-medium flex items-center gap-1">
                <Palette :size="12" />
                Filters
              </div>
            </div>
            <div class="flex-1 h-full relative" @click="onTrackContentClick">
              <div class="absolute inset-0 bg-[#111] cursor-pointer"></div>
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

          <!-- Source Track (Primary Video - Editor Mode) -->
          <template v-if="editorMode">
            <div class="flex items-center h-[72px] relative">
              <div
                class="track-label w-[100px] h-full pl-2 pr-2 flex flex-col justify-center text-[11px] sticky left-0 z-[70] bg-[#0c0c0c] flex-shrink-0 border-r border-white/[0.08]"
              >
                <!-- Track controls row (CapCut style: icons in a row) -->
                <div class="flex items-center gap-1 text-white/50 mb-1">
                  <button @click.stop="toggleVideoTrackState('isLocked')" class="p-0.5 hover:text-white" :title="videoTrackState.isLocked ? 'Unlock' : 'Lock'" :class="{ 'text-cyan-400': videoTrackState.isLocked }">
                    <Lock v-if="videoTrackState.isLocked" :size="13" />
                    <Unlock v-else :size="13" />
                  </button>
                  <button @click.stop="toggleVideoTrackState('isHidden')" class="p-0.5 hover:text-white" :title="videoTrackState.isHidden ? 'Show' : 'Hide'" :class="{ 'text-cyan-400': videoTrackState.isHidden }">
                    <EyeOff v-if="videoTrackState.isHidden" :size="13" />
                    <Eye v-else :size="13" />
                  </button>
                  <button @click.stop="toggleVideoTrackState('isMuted')" class="p-0.5 hover:text-white" :title="videoTrackState.isMuted ? 'Unmute' : 'Mute'" :class="{ 'text-cyan-400': videoTrackState.isMuted }">
                    <VolumeX v-if="videoTrackState.isMuted" :size="13" />
                    <Volume2 v-else :size="13" />
                  </button>
                </div>
                <!-- Track label -->
                <span class="text-[11px] text-white/60 truncate">Source</span>
              </div>
              <div
                ref="videoTrackContentRef"
                class="flex-1 h-full relative"
                @click="onTrackContentClick"
                @dragover.prevent="onTimelineDragOver"
                @drop.prevent="onTimelineDrop"
              >
                <!-- Background -->
                <div class="absolute inset-0 bg-[#111] cursor-pointer"></div>

                <!-- Empty state drop zone -->
                <div
                  v-if="primaryVideoSources.length === 0"
                  class="absolute inset-0 flex items-center justify-center border-2 border-dashed border-white/12 rounded-md"
                  :class="{ 'border-violet-500/50 bg-violet-500/5': isDragOverTimeline }"
                >
                  <span class="text-xs text-white/30">Drop sources here</span>
                </div>

                <!-- Primary video source segments -->
                <div
                  v-for="source in primaryVideoSources"
                  :key="source.id"
                  :ref="(el) => setSegmentRef(el, 'source', source.id)"
                  class="clip-segment absolute top-0 bottom-0 overflow-hidden group border-2"
                  :class="[
                    getSegmentClasses('source', source.id),
                    isCutToolActive && cutHoverInfo?.segmentId === source.id
                      ? 'cursor-crosshair z-65 shadow-xl border-orange-400 ring-2 ring-orange-400/50'
                      : isCutToolActive
                        ? 'cursor-crosshair z-62 border-cyan-500'
                        : 'cursor-pointer border-cyan-500',
                  ]"
                  :style="getVideoSourceStyle(source, sourcePreview)"
                  @mouseenter="isCutToolActive && onSourceHoverForCut($event, source)"
                  @mousemove="isCutToolActive && onSourceHoverForCut($event, source)"
                  @mouseleave="isCutToolActive && (cutHoverInfo = null)"
                  @mousedown="isCutToolActive ? onSourceClickForCut($event, source) : onSourceMouseDown($event, source)"
                  @click.stop="!isCutToolActive && onSourceClick($event, source)"
                  @contextmenu.prevent="onSourceContextMenu($event, source)"
                >
                  <!-- Video thumbnails background -->
                  <div class="absolute inset-0 bg-[#1a1a1a] flex overflow-hidden">
                  </div>

                  <!-- Remaining duration overlay -->
                  <div
                    class="absolute top-0 bottom-0 right-0 bg-white/6 pointer-events-none"
                    :style="{ left: `${((source.end_time - source.start_time) / (clipEnd - clipStart)) * 100}%` }"
                  ></div>

                  <!-- Waveform canvas overlay -->
                  <canvas
                    :ref="(el) => setSourceWaveformCanvasRef(el, source.id)"
                    class="absolute inset-0 w-full h-full pointer-events-none opacity-60"
                    style="mix-blend-mode: screen; z-index: 5"
                  ></canvas>

                  <!-- Source label (CapCut style - cyan text at top left) -->
                  <div
                    class="absolute top-0 left-0 right-0 z-10 flex items-start justify-start pointer-events-none px-2 py-1"
                  >
                    <span
                      class="text-[11px] text-cyan-400 font-medium truncate"
                    >
                      {{ source.source_name || 'Untitled' }} {{ formatTime(source.end_time - source.start_time) }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Single Video Track (Clip Mode) -->
          <template v-else>
            <div class="flex items-center h-[72px] relative">
              <div
                class="track-label w-[100px] h-full pl-2 pr-2 flex flex-col justify-center text-[11px] sticky left-0 z-[70] bg-[#0c0c0c] flex-shrink-0 border-r border-white/[0.08]"
              >
                <!-- Track controls row (CapCut style: icons in a row) -->
                <div class="flex items-center gap-1 text-white/50 mb-1">
                  <button @click.stop="toggleVideoTrackState('isLocked')" class="p-0.5 hover:text-white" :title="videoTrackState.isLocked ? 'Unlock' : 'Lock'" :class="{ 'text-cyan-400': videoTrackState.isLocked }">
                    <Lock v-if="videoTrackState.isLocked" :size="13" />
                    <Unlock v-else :size="13" />
                  </button>
                  <button @click.stop="toggleVideoTrackState('isHidden')" class="p-0.5 hover:text-white" :title="videoTrackState.isHidden ? 'Show' : 'Hide'" :class="{ 'text-cyan-400': videoTrackState.isHidden }">
                    <EyeOff v-if="videoTrackState.isHidden" :size="13" />
                    <Eye v-else :size="13" />
                  </button>
                  <button @click.stop="toggleVideoTrackState('isMuted')" class="p-0.5 hover:text-white" :title="videoTrackState.isMuted ? 'Unmute' : 'Mute'" :class="{ 'text-cyan-400': videoTrackState.isMuted }">
                    <VolumeX v-if="videoTrackState.isMuted" :size="13" />
                    <Volume2 v-else :size="13" />
                  </button>
                </div>
                <!-- Track label -->
                <span class="text-[11px] text-white/60 truncate">Cover</span>
              </div>
              <div
                ref="videoTrackContentRef"
                class="flex-1 h-full relative"
                @click="onTrackContentClick"
              >
                <!-- Background -->
                <div class="absolute inset-0 bg-[#111] cursor-pointer"></div>

                <!-- Clip Mode: Trim Segments -->
                <template v-for="(segmentLayout, _index) in segmentLayouts" :key="segmentLayout.segment.id">
                  <div
                    :ref="(el) => setSegmentRef(el, 'trim', segmentLayout.segment.id)"
                    class="clip-segment absolute top-1 bottom-1 rounded-md overflow-hidden group"
                    :class="[
                      getSegmentClasses('trim', segmentLayout.segment.id, segmentLayout.segment.isDeleted),
                      props.selectedSegmentIds?.has(segmentLayout.segment.id)
                        ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-black shadow-lg shadow-blue-400/30'
                        : '',
                      isCutToolActive && cutHoverInfo?.segmentId === segmentLayout.segment.id
                        ? 'cursor-crosshair z-65 shadow-xl border-2 border-orange-400 ring-2 ring-orange-400/50 ring-offset-1 ring-offset-transparent'
                        : isCutToolActive
                          ? 'cursor-crosshair z-62'
                          : 'cursor-pointer',
                    ]"
                    :style="getSegmentLayoutStyle(segmentLayout, 'violet', 'trim', segmentLayout.segment.id)"
                    @mouseenter="isCutToolActive && onSegmentHoverForCut($event, segmentLayout.segment)"
                    @mousemove="isCutToolActive && onSegmentHoverForCut($event, segmentLayout.segment)"
                    @mouseleave="isCutToolActive && (cutHoverInfo = null)"
                    @mousedown="
                      isCutToolActive
                        ? onSegmentClickForCut($event, segmentLayout.segment)
                        : onSegmentMouseDown($event, 'trim', segmentLayout.segment.id, segmentLayout.segment)
                    "
                    @click.stop="!isCutToolActive && onSegmentClick($event, segmentLayout.segment)"
                  >
                    <div class="absolute inset-0 bg-black flex overflow-hidden">
                      <div class="absolute inset-0 bg-gradient-to-r from-violet-900/20 to-indigo-900/10"></div>
                      <div class="absolute inset-0 bg-[#1a1a1a]"></div>
                    </div>
                    <canvas
                      :ref="(el) => setWaveformCanvasRef(el, segmentLayout.segment.id)"
                      class="absolute inset-0 w-full h-full pointer-events-none opacity-60"
                      style="mix-blend-mode: screen; z-index: 5"
                    ></canvas>
                  </div>
                </template>
              </div>
            </div>
          </template>

          <!-- Audio Tracks (BELOW primary video) -->
          <div
            v-for="track in audioTracks"
            :key="track.id"
            class="flex items-center h-12 relative"
            :class="{
              'bg-blue-500/10 ring-2 ring-blue-500/50': isDragging && dragInfo?.type === 'audio' && dragInfo?.targetTrackOrder === track.trackOrder
            }"
          >
            <div
              class="track-label w-[100px] h-full pl-2 pr-2 flex flex-col justify-center text-[11px] sticky left-0 z-[70] bg-[#0c0c0c] flex-shrink-0 border-r border-white/[0.08]"
            >
              <!-- Track controls row -->
              <div class="flex items-center gap-1 text-white/50 mb-1">
                <button @click.stop="emit('toggleAudioLock', track.id)" class="p-0.5 hover:text-white" :title="track.isLocked ? 'Unlock' : 'Lock'" :class="{ 'text-cyan-400': track.isLocked }">
                  <Lock v-if="track.isLocked" :size="13" />
                  <Unlock v-else :size="13" />
                </button>
                <button @click.stop="emit('toggleAudioHidden', track.id)" class="p-0.5 hover:text-white" :title="track.isHidden ? 'Show' : 'Hide'" :class="{ 'text-cyan-400': track.isHidden }">
                  <EyeOff v-if="track.isHidden" :size="13" />
                  <Eye v-else :size="13" />
                </button>
                <button @click.stop="emit('toggleAudioMute', track.id)" class="p-0.5 hover:text-white" :title="track.isMuted ? 'Unmute' : 'Mute'" :class="{ 'text-cyan-400': track.isMuted }">
                  <VolumeX v-if="track.isMuted" :size="13" />
                  <Volume2 v-else :size="13" />
                </button>
              </div>
              <!-- Track label -->
              <span class="text-[11px] text-white/60 truncate">{{ track.name }}</span>
            </div>
            <div
              :ref="(el) => setSegmentRef(el, 'audio', track.id)"
              class="flex-1 h-full relative"
              @click="onTrackContentClick"
            >
              <div class="absolute inset-0 bg-[#111] cursor-pointer"></div>

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

                  <!-- Left resize handle (only on first segment, disabled in editor mode) -->
                  <div
                    v-if="visualSeg.isFirst && !editorMode"
                    class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onResizeMouseDown(e, 'audio', track.id, 'left', track)"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                  <!-- Right resize handle (only on last segment, disabled in editor mode) -->
                  <div
                    v-if="visualSeg.isLast && !editorMode"
                    class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                    @mousedown.stop="(e) => onResizeMouseDown(e, 'audio', track.id, 'right', track)"
                  >
                    <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                  </div>
                </div>
              </template>
            </div>
          </div>

          <!-- Placeholder tracks below -->
          <div
            v-for="n in PLACEHOLDER_BOTTOM_COUNT"
            :key="'placeholder-bottom-'+n"
            class="flex items-center h-10 relative"
          >
            <div class="track-label w-[100px] h-full sticky left-0 z-[70] bg-[#0c0c0c] flex-shrink-0 border-r border-white/[0.08]"></div>
            <div class="flex-1 h-full relative bg-[#111]"></div>
          </div>

          <!-- Playhead Line (CapCut style - orange/amber thin line) -->
          <div
            v-if="totalDuration > 0"
            class="absolute top-0 bottom-0 z-[60] cursor-ew-resize group playhead-line flex flex-col items-center"
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
            <!-- Top handle (CapCut style - small rectangle) -->
            <div
              class="sticky -top-[1px] z-10 flex-shrink-0 w-3 h-3 bg-amber-500 rounded-sm shadow-md playhead-child"
            ></div>
            <!-- The line (CapCut style - thin amber/orange line) -->
            <div
              class="flex-1 bg-amber-500 group-hover:bg-amber-400 playhead-line-inner playhead-child"
              style="width: 2px;"
            ></div>
          </div>

          <!-- Snap Indicator Line (shows when segment edge is snapping to another edge) -->
          <div
            v-if="snapIndicatorPosition !== null"
            class="snap-indicator-line absolute top-0 bottom-0 z-[55] pointer-events-none"
            :style="{
              '--snap-position': snapIndicatorPosition,
            }"
          >
            <div class="absolute inset-0 w-0.5 bg-blue-400 shadow-lg shadow-blue-400/50"></div>
          </div>
          </div> <!-- end contentWrapper -->
        </div> <!-- end horizontal scroller -->
      </div> <!-- end scroll container -->
    </div> <!-- end inner container -->

    <!-- Timeline Hover Line -->
    <TimelineHoverLine
      :showLine="showHoverLine"
      :position="hoverLinePosition"
      :timelineBoundsTop="timelineBounds.top"
      :timelineBoundsBottom="timelineBounds.bottom"
      :timelineBoundsLeft="timelineBounds.left"
      :isPanning="false"
      :isDragging="isDragging || isResizing || isDraggingPlayhead"
      :isCutToolActive="isCutToolActive"
    />

    <!-- Source Context Menu -->
    <Teleport to="body">
      <div
        v-if="sourceContextMenu.visible"
        class="fixed z-[9999] bg-[#1a1a1a] border border-white/10 rounded-lg shadow-xl py-1 min-w-[180px]"
        :style="{ left: `${sourceContextMenu.x}px`, top: `${sourceContextMenu.y}px` }"
        @click.stop
      >
        <button
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
          @click="extractAudioFromSource"
          :disabled="isExtractingAudio"
        >
          <Music :size="14" />
          <span>{{ isExtractingAudio ? 'Extracting...' : 'Extract Audio' }}</span>
        </button>
        <div class="h-px bg-white/10 my-1"></div>
        <button
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
          @click="deleteSourceFromContextMenu"
        >
          <X :size="14" />
          <span>Delete</span>
        </button>
      </div>
    </Teleport>

    <!-- Click outside to close context menu -->
    <div
      v-if="sourceContextMenu.visible"
      class="fixed inset-0 z-[9998]"
      @click="closeSourceContextMenu"
      @contextmenu.prevent="closeSourceContextMenu"
    ></div>
  </div> <!-- end outer bg container -->
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch, nextTick, reactive } from 'vue';
  import {
    Minus,
    Plus,
    Film,
    Music,
    Type,
    Smile,
    Sparkles,
    Palette,
    Droplet,
    X,
    Blend,
    Scissors,
    Rewind,
    FastForward,
    Undo2,
    Redo2,
    Lock,
    Unlock,
    Eye,
    EyeOff,
    Volume2,
    VolumeX,
    Settings,
  } from 'lucide-vue-next';
  import { useAudioWaveform, type WaveformData } from '@/composables/useAudioWaveform';
  import { invoke } from '@tauri-apps/api/core';
  import TimelineHoverLine from '@/components/TimelineHoverLine.vue';
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
  import { SEEK_CONFIG } from '@/constants/timelineConstants';

  type ItemType = 'trim' | 'audio' | 'text' | 'sticker' | 'watermark' | 'effect' | 'filter' | 'source';

  interface DragInfo {
    type: ItemType;
    id: string;
    item: any;
    startX: number;
    startY: number;
    originalStartTime: number;
    originalEndTime: number;
    originalTrackOrder?: number;
    originalLayer?: number;
    originalTrackIndex?: number;
    trackContentWidth: number;
    targetTrackOrder?: number;
    targetLayer?: number;
    targetTrackIndex?: number;
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

  interface CutHoverInfo {
    segmentId: string;
    cutTime: number; // Relative time within the segment where the cut will happen
    cutPosition: number; // Percentage position within the segment (0-100)
  }

  // Minimum segment duration after a split (in seconds)
  const MIN_SEGMENT_DURATION = 0.1;

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
  // Balance placeholder lanes above/below primary video track
  const PLACEHOLDER_TOP_COUNT = 2;
  const PLACEHOLDER_BOTTOM_COUNT = 2;

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
      // Undo/Redo props
      canUndo?: boolean;
      canRedo?: boolean;
      // Multi-select props
      selectedSegmentIds?: Set<string>;
      // Marker props
      markers?: Array<{ id: string; time: number; label?: string }>;
      selectedMarkerId?: string | null;
    }>(),
    {
      audioGainDb: 0,
      trackDbValues: () => ({}),
      filterSegments: () => [],
      watermarks: () => [],
      isPlaying: false,
      editorMode: false,
      videoSources: () => [],
      canUndo: false,
      canRedo: false,
      selectedSegmentIds: () => new Set(),
      markers: () => [],
      selectedMarkerId: null,
    }
  );

  const emit = defineEmits<{
    (e: 'seek', time: number): void;
    (e: 'updateTrimSegment', segmentId: string, startTime: number, endTime: number): void;
    (e: 'splitTrimSegment', segmentId: string, cutTime: number): void;
    (e: 'deleteTrimSegment', segmentId: string): void;
    (e: 'undo'): void;
    (e: 'redo'): void;
    (e: 'segmentSelect', segmentId: string, modifiers: { shift: boolean; ctrl: boolean }): void;
    (e: 'markerClick', markerId: string): void;
    (e: 'updateAudioTrack', trackId: string, updates: Partial<AudioTrack>): void;
    (e: 'deleteAudioTrack', trackId: string): void;
    (e: 'splitAudioTrack', trackId: string, cutTime: number): void;
    (e: 'updateTextOverlay', overlayId: string, updates: Partial<TextOverlay>): void;
    (e: 'deleteTextOverlay', overlayId: string): void;
    (e: 'splitTextOverlay', overlayId: string, cutTime: number): void;
    (e: 'updateSticker', stickerId: string, updates: Partial<Sticker>): void;
    (e: 'deleteSticker', stickerId: string): void;
    (e: 'splitSticker', stickerId: string, cutTime: number): void;
    (e: 'updateFilterSegment', id: string, newValues: Partial<FilterSegment>): void;
    (e: 'splitFilter', filterId: string, cutTime: number): void;
    (e: 'updateWatermark', id: string, newValues: Partial<ClipWatermark>): void;
    (e: 'deleteWatermark', watermarkId: string): void;
    (e: 'splitWatermark', watermarkId: string, cutTime: number): void;
    (e: 'updateEffect', effectId: string, updates: Partial<Effect>): void;
    (e: 'splitEffect', effectId: string, cutTime: number): void;
    (e: 'moveTrack', data: { type: ItemType; id: string; originalStartTime: number; originalEndTime: number; newStartTime: number; newEndTime: number }): void;
    (e: 'toggleVideoMute', id: string): void;
    (e: 'toggleVideoLock', id: string): void;
    (e: 'toggleVideoHidden', id: string): void;
    (e: 'toggleAudioMute', id: string): void;
    (e: 'toggleAudioLock', id: string): void;
    (e: 'toggleAudioHidden', id: string): void;
    // Video editor mode events
    (e: 'updateSource', sourceId: string, updates: Partial<VideoEditorSource>): void;
    (e: 'deleteSource', sourceId: string): void;
    (e: 'dropSource', data: { source: SourceItem; position: number }): void;
    (e: 'transitionsDetected', transitions: VideoEditorTransition[]): void;
    (e: 'splitSource', sourceId: string, cutTimelinePosition: number, cutSourceTime: number): void;
    (e: 'extractedAudio', data: { sourceId: string; filePath: string; filename: string; duration: number; startTime: number; endTime: number; sourceName: string | null }): void;
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
  // Video source waveform data and canvas refs for editor mode
  const sourceWaveformCanvasRefs = ref<Map<string, HTMLCanvasElement>>(new Map());
  const sourceWaveformData = ref<Map<string, WaveformData>>(new Map());
  const sourceWaveformLoading = ref<Set<string>>(new Set());

const videoTrackState = reactive({
  isMuted: false,
  isLocked: false,
  isHidden: false,
});

function toggleVideoTrackState(prop: keyof typeof videoTrackState) {
  videoTrackState[prop] = !videoTrackState[prop];
  // Optionally, emit an event to notify the parent component
  // emit('videoTrackStateChanged', videoTrackState);
}

  // CapCut-style zoom: Start more zoomed out, especially for short videos
  const MIN_ZOOM = 0.2; // Allow zooming out to 20%
  const zoomLevel = ref(0.5); // Start at 50% zoom by default (CapCut-like)

  // Calculate dynamic zoom step based on current zoom level
  // Lower zoom = smaller steps, higher zoom = larger steps
  function getZoomStep(): number {
    if (zoomLevel.value < 1) return 0.05; // Fine control for zoomed-out views
    if (zoomLevel.value < 2) return 0.1;
    if (zoomLevel.value < 5) return 0.25;
    if (zoomLevel.value < 10) return 0.5;
    if (zoomLevel.value < 50) return 1;
    if (zoomLevel.value < 100) return 5;
    return 10;
  }

  function zoomIn() {
    const step = getZoomStep();
    zoomLevel.value = zoomLevel.value + step;
  }

  function zoomOut() {
    const step = getZoomStep();
    zoomLevel.value = Math.max(MIN_ZOOM, zoomLevel.value - step);
  }

  // Calculate appropriate initial zoom based on video duration (CapCut-style)
  function calculateInitialZoom(duration: number): number {
    // For very short videos (< 10s), start zoomed out
    if (duration < 10) return 0.3;
    // For short videos (< 30s), start moderately zoomed out
    if (duration < 30) return 0.4;
    // For medium videos (< 60s), start at 50%
    if (duration < 60) return 0.5;
    // For longer videos, start at 60-80%
    if (duration < 180) return 0.6;
    // For very long videos, start at 100% (fill screen)
    return 1.0;
  }

  // Continuous seeking state
  const isSeeking = ref(false);
  const seekDirection = ref<'forward' | 'reverse' | null>(null);
  const seekInterval = ref<ReturnType<typeof setInterval> | null>(null);
  const currentSeekTime = ref(0); // Track our current seek position for continuous seeking

  // Video editor mode state
  const isDragOverTimeline = ref(false);
  const isDraggingSource = ref(false);
  const dragSourceInfo = ref<{
    sourceId: string;
    startX: number;
    startY: number;
    originalStartTime: number;
    originalEndTime: number;
    originalTrackIndex: number;
    targetTrackIndex: number;
  } | null>(null);

  // Source context menu state
  const sourceContextMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    source: null as VideoEditorSource | null,
  });
  const isExtractingAudio = ref(false);

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

  // Preview state for video source drag/resize (local-only during drag/resize)
  const sourcePreview = ref<{ sourceId: string; startTime: number; endTime: number } | null>(null);

  // Playhead drag state
  const isDraggingPlayhead = ref(false);

  // Cut tool state
  const isCutToolActive = ref(false);
  const cutHoverInfo = ref<CutHoverInfo | null>(null);

  // Smooth playhead animation state
  const smoothPlayheadPosition = ref(0);
  // Hover line state
  const showHoverLine = ref(false);
  const hoverLinePosition = ref(0);
  const timelineBounds = ref({ top: 0, bottom: 0, left: 0 });

  // Track label width constant (matches the w-[100px] class = 100px)
  const TRACK_LABEL_WIDTH = 100;

  // Snap configuration
  const SNAP_THRESHOLD_PX = 8; // Pixels distance to trigger snapping
  const snapEnabled = ref(true);

  // Snap state for visual indicator
  const activeSnapTime = ref<number | null>(null); // Time position where snap is occurring

  // Auto-scroll configuration for keeping playhead visible during playback
  // Stepping approach: scroll when playhead reaches threshold, jump to target position
  const AUTO_SCROLL_TRIGGER_PERCENT = 0.85; // Scroll when playhead reaches 85% of visible track area
  const AUTO_SCROLL_TARGET_PERCENT = 0.15; // After scroll, put playhead at 15% from left of visible area

  // Animation state for smooth playhead motion
  let animationFrameId: number | null = null;
  let lastSyncTime = 0; // performance.now() when we last synced with actual video time
  let lastSyncPosition = 0; // playhead position (0-1) at sync time
  let lastKnownPosition = 0; // For seek detection

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
    // Editor mode: don't use trim segments, return empty array
    // The timeline layout is handled differently in editor mode
    if (props.editorMode) {
      return [];
    }

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
    if (props.editorMode) {
      if (props.videoSources.length === 0) return props.duration || 300;
      return Math.max(...props.videoSources.map((s) => s.end_time));
    }
    return sortedTrimSegments.value.reduce((sum, seg) => sum + (seg.endTime - seg.startTime), 0);
  });

  const totalDuration = computed(() => {
    if (props.editorMode) {
      if (!props.videoSources || props.videoSources.length === 0) {
        return 300; // Default to 5 minutes if no sources
      }
      const maxEndTime = props.videoSources.reduce((max, s) => Math.max(max, s.end_time), 0);
      if (props.videoSources.length === 1) {
        return Math.max(maxEndTime, props.videoSources[0].source_duration || 0);
      }
      return maxEndTime;
    }

    const clipSpan = (props.clipEnd ?? 0) - (props.clipStart ?? 0);
    const segmentDuration = videoSegmentDuration.value;
    const maxAudioDuration = props.audioTracks.reduce((max, track) => {
      const trackDuration = track.endTime - track.startTime;
      return Math.max(max, trackDuration);
    }, 0);
    const requestedDuration = props.duration || 0;
    const maxDuration = Math.max(segmentDuration, maxAudioDuration, clipSpan, requestedDuration);
    return maxDuration > 0 ? maxDuration : props.duration;
  });

  // Primary video sources (track_index = 0 or undefined) - shown in Source track
  const primaryVideoSources = computed(() => {
    if (!props.editorMode) return [];
    return props.videoSources.filter(source => (source.track_index ?? 0) === 0);
  });

  // Group ALL visual content by layer for unified layer display above Source
  // Layers can contain: video sources (track_index > 0), text, stickers, watermarks
  interface LayerItem {
    type: 'source' | 'text' | 'sticker' | 'watermark';
    item: any;
  }
  
  interface VisualLayer {
    layer: number;
    items: LayerItem[];
  }

  const visualLayers = computed<VisualLayer[]>(() => {
    const layerMap = new Map<number, LayerItem[]>();
    
    // Add video sources with track_index > 0 (these go to layers above Source)
    // Map track_index to layer: track_index 1 → layer 0, track_index 2 → layer 1, etc.
    if (props.editorMode) {
      props.videoSources.forEach(source => {
        const trackIndex = source.track_index ?? 0;
        if (trackIndex > 0) { // Only sources above the primary track
          const layer = trackIndex - 1; // Map: track_index 1 → layer 0, 2 → layer 1, etc.
          if (!layerMap.has(layer)) layerMap.set(layer, []);
          layerMap.get(layer)!.push({ type: 'source', item: source });
        }
      });
    }
    
    // Add text overlays
    props.textOverlays.forEach(item => {
      const layer = item.layer ?? 0;
      if (!layerMap.has(layer)) layerMap.set(layer, []);
      layerMap.get(layer)!.push({ type: 'text', item });
    });
    
    // Add stickers
    props.stickers.forEach(item => {
      const layer = item.layer ?? 0;
      if (!layerMap.has(layer)) layerMap.set(layer, []);
      layerMap.get(layer)!.push({ type: 'sticker', item });
    });
    
    // Add watermarks
    props.watermarks.forEach(item => {
      const layer = item.layer ?? 0;
      if (!layerMap.has(layer)) layerMap.set(layer, []);
      layerMap.get(layer)!.push({ type: 'watermark', item });
    });
    
    // Also ensure target layer exists during drag (for visual feedback)
    // Access the full dragSourceInfo to ensure Vue tracks it reactively
    const sourceDragInfo = dragSourceInfo.value;
    const overlayDragInfo = dragInfo.value;
    const isDraggingToLayer = (isDragging.value && overlayDragInfo?.targetLayer !== undefined) ||
                              (isDraggingSource.value && sourceDragInfo?.targetTrackIndex !== undefined && sourceDragInfo.targetTrackIndex > 0);
    if (isDraggingToLayer) {
      const targetLayer = isDraggingSource.value ? sourceDragInfo?.targetTrackIndex : overlayDragInfo?.targetLayer;
      console.log('[visualLayers] Creating empty layer for drag target:', targetLayer);
      if (targetLayer !== undefined && targetLayer > 0 && !layerMap.has(targetLayer)) {
        layerMap.set(targetLayer, []);
      }
    }
    
    // Convert to array and sort by layer (higher layers on top, rendered first)
    return Array.from(layerMap.entries())
      .map(([layer, items]) => ({ layer, items }))
      .sort((a, b) => b.layer - a.layer); // Higher layers first (render on top)
  });

  // Keep old visualOverlayLayers for backward compatibility (used in some places)
  const visualOverlayLayers = visualLayers;

  // Calculate visible markers with correct positioning
  const visibleMarkers = computed(() => {
    if (!props.markers || props.markers.length === 0) return [];

    const visibleStart = props.clipStart;
    const visibleEnd = props.clipEnd;
    const visibleDuration = visibleEnd - visibleStart;

    return props.markers
      .filter((marker) => marker.time >= visibleStart && marker.time <= visibleEnd)
      .map((marker) => {
        const relativeTime = marker.time - visibleStart;
        const leftPercent = (relativeTime / visibleDuration) * 100;
        return {
          ...marker,
          leftPercent,
        };
      });
  });

  // Ruler ticks spanning full timeline
  const rulerTicks = computed(() => {
    const timelineDuration = totalDuration.value;
    if (timelineDuration <= 0) return [];

    // Determine optimal intervals based on visible duration (duration / zoom)
    const visibleDuration = timelineDuration / zoomLevel.value;
    let majorInterval: number;
    let minorInterval: number;

    if (visibleDuration < 0.5) {
      majorInterval = 0.1;
      minorInterval = 0.02;
    } else if (visibleDuration < 1) {
      majorInterval = 0.25;
      minorInterval = 0.05;
    } else if (visibleDuration < 2) {
      majorInterval = 0.5;
      minorInterval = 0.1;
    } else if (visibleDuration < 5) {
      majorInterval = 1;
      minorInterval = 0.2;
    } else if (visibleDuration < 10) {
      majorInterval = 2;
      minorInterval = 0.5;
    } else if (visibleDuration < 20) {
      majorInterval = 5;
      minorInterval = 1;
    } else if (visibleDuration < 45) {
      majorInterval = 10;
      minorInterval = 2;
    } else if (visibleDuration < 90) {
      majorInterval = 15;
      minorInterval = 5;
    } else if (visibleDuration < 180) {
      majorInterval = 30;
      minorInterval = 10;
    } else if (visibleDuration < 600) {
      majorInterval = 60;
      minorInterval = 15;
    } else if (visibleDuration < 1800) {
      majorInterval = 120;
      minorInterval = 30;
    } else {
      majorInterval = 300;
      minorInterval = 60;
    }

    const ticks: { key: string; time: number; percent: number; isMajor: boolean }[] = [];
    for (let t = 0; t <= timelineDuration + 0.0001; t += minorInterval) {
      const percent = (t / timelineDuration) * 100;
      if (percent < -0.1 || percent > 100.1) continue;
      const isMajor =
        Math.abs(t % majorInterval) < 0.001 || Math.abs((t % majorInterval) - majorInterval) < 0.001;
      ticks.push({
        key: `${t.toFixed(3)}`,
        time: t,
        percent,
        isMajor,
      });
    }

    return ticks;
  });

  // Calculate segment layouts (segments are butted up against each other)
  const segmentLayouts = computed((): SegmentLayout[] => {
    const timelineDuration = totalDuration.value;
    if (timelineDuration <= 0) return [];

    // Determine optimal intervals based on visible duration (duration / zoom)
    // More zoom = smaller visible duration = more granular ticks for precise editing
    const visibleDuration = timelineDuration / zoomLevel.value;
    let majorInterval: number;
    let minorInterval: number;

    // The thresholds are based on what's comfortable to read on screen
    // More granular intervals when zoomed in for precise frame-level editing
    if (visibleDuration < 0.5) {
      // Extremely zoomed: major every 0.1s, minor every 0.02s (frame-level precision)
      majorInterval = 0.1;
      minorInterval = 0.02;
    } else if (visibleDuration < 1) {
      // Very zoomed: major every 0.25s, minor every 0.05s
      majorInterval = 0.25;
      minorInterval = 0.05;
    } else if (visibleDuration < 2) {
      // Highly zoomed: major every 0.5s, minor every 0.1s
      majorInterval = 0.5;
      minorInterval = 0.1;
    } else if (visibleDuration < 5) {
      // Zoomed: major every 1s, minor every 0.2s
      majorInterval = 1;
      minorInterval = 0.2;
    } else if (visibleDuration < 10) {
      // Moderately zoomed: major every 2s, minor every 0.5s
      majorInterval = 2;
      minorInterval = 0.5;
    } else if (visibleDuration < 20) {
      // Slightly zoomed: major every 5s, minor every 1s
      majorInterval = 5;
      minorInterval = 1;
    } else if (visibleDuration < 45) {
      // Normal view: major every 10s, minor every 2s
      majorInterval = 10;
      minorInterval = 2;
    } else if (visibleDuration < 90) {
      // Slightly zoomed out: major every 15s, minor every 5s
      majorInterval = 15;
      minorInterval = 5;
    } else if (visibleDuration < 180) {
      // Zoomed out: major every 30s, minor every 10s
      majorInterval = 30;
      minorInterval = 10;
    } else if (visibleDuration < 600) {
      // Very zoomed out: major every 60s (1 min), minor every 15s
      majorInterval = 60;
      minorInterval = 15;
    } else if (visibleDuration < 1800) {
      // Long timeline: major every 2 min, minor every 30s
      majorInterval = 120;
      minorInterval = 30;
    } else {
      // Very long timeline: major every 5 min, minor every 1 min
      majorInterval = 300;
      minorInterval = 60;
    }

    // Editor mode: create a single linear timeline layout (no segment gaps)
    if (props.editorMode) {
      const ticks: SegmentTick[] = [];
      for (let t = minorInterval; t < timelineDuration; t += minorInterval) {
        const posInSegment = (t / timelineDuration) * 100;
        if (posInSegment > 0.5 && posInSegment < 99.5) {
          const isMajor = Math.abs(t % majorInterval) < 0.001 || Math.abs((t % majorInterval) - majorInterval) < 0.001;
          ticks.push({
            time: t,
            positionInSegment: posInSegment,
            isMajor,
          });
        }
      }

      return [
        {
          segment: {
            id: 'editor-timeline',
            startTime: 0,
            endTime: timelineDuration,
            isDeleted: false,
          },
          startPercent: 0,
          widthPercent: 100,
          ticks,
          effectiveStartTime: 0,
          effectiveEndTime: timelineDuration,
        },
      ];
    }

    // Clip mode: segment-based layout with gaps
    const segments = sortedTrimSegments.value;
    if (segments.length === 0) return [];

    // Calculate total gap percentage
    const totalGapPercent = (segments.length - 1) * GAP_PERCENT;
    const availablePercent = 100 - totalGapPercent;

    const layouts: SegmentLayout[] = [];
    let currentPercent = 0;
    let cumulativeTime = 0; // Track cumulative effective time

    segments.forEach((segment, index) => {
      const segmentDuration = segment.endTime - segment.startTime;
      const widthPercent = (segmentDuration / timelineDuration) * availablePercent;

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
    // Use preview position during drag/resize
    const preview = dragPreview.value;
    const usePreview = preview && preview.type === 'audio' && preview.id === track.id;

    const audioStart = usePreview ? preview.startTime : track.startTime;
    const audioEnd = usePreview ? preview.endTime : track.endTime;
    const audioDuration = audioEnd - audioStart;

    if (audioDuration <= 0) return [];

    // Editor mode: simple linear layout (no video segments to align with)
    if (props.editorMode) {
      const duration = props.duration || 300;
      if (duration <= 0) return [];

      const leftPercent = (audioStart / duration) * 100;
      const widthPercent = (audioDuration / duration) * 100;

      return [
        {
          videoSegmentIndex: 0,
          audioStartTime: 0,
          audioEndTime: audioDuration,
          leftPercent,
          widthPercent,
          isFirst: true,
          isLast: true,
        },
      ];
    }

    // Clip mode: align with video segments
    const segments = sortedTrimSegments.value;
    if (segments.length === 0) return [];

    const visualSegments: AudioVisualSegment[] = [];

    // Calculate cumulative video time to map to timeline position
    let cumulativeVideoTime = 0;

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
    // Editor mode: simple linear mapping using totalDuration for consistency
    if (props.editorMode) {
      const duration = totalDuration.value;
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

  // Calculate height based on number of tracks (may be used in future)
  const _calculatedHeight = computed(() => {
    const headerHeight = 44; // Timeline header with toolbar
    const rulerHeight = 32; // Timestamp ruler
    const videoTrackHeight = 96; // Video track (CapCut-style - taller for thumbnails)
    const otherTrackHeight = 64; // Other tracks (audio, text, etc.) - increased for less cramped feel
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

    // Calculate visible duration to determine precision needed
    const visibleDuration = totalDuration.value / zoomLevel.value;

    // For very zoomed in states, show high precision (useful for precise editing)
    if (visibleDuration < 2) {
      // Show 2 decimal places for frame-level precision
      if (mins === 0) {
        return secs.toFixed(2) + 's';
      }
      return `${mins}:${secs.toFixed(2).padStart(5, '0')}`;
    } else if (visibleDuration < 10) {
      // Show 1 decimal place
      if (mins === 0 && secs < 10) {
        return secs.toFixed(1) + 's';
      }
      return `${mins}:${secs.toFixed(1).padStart(4, '0')}`;
    }

    // Standard format: M:SS
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

  function _setAudioWaveformCanvasRef(el: any, trackId: string) {
    if (el) {
      audioWaveformCanvasRefs.value.set(trackId, el as HTMLCanvasElement);
    }
  }

  function setAudioSegmentCanvasRef(el: any, trackId: string, segmentIndex: number) {
    const key = `${trackId}-${segmentIndex}`;
    if (el) {
      audioSegmentCanvasRefs.value.set(key, el as HTMLCanvasElement);
    }
  }

  function setSourceWaveformCanvasRef(el: any, sourceId: string) {
    if (el) {
      sourceWaveformCanvasRefs.value.set(sourceId, el as HTMLCanvasElement);
    } else {
      // Clean up ref when element is unmounted
      sourceWaveformCanvasRefs.value.delete(sourceId);
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

  function _getAudioSegmentStyle(layout: SegmentLayout, trackId: string): Record<string, string> {
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

  function _getAudioTrackStyle(track: AudioTrack): Record<string, string> {
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
    const leftPercent = (startTime / totalDuration.value) * 100;
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

  // Check if a track type has an active/selected item (may be used in future)
  function _isTrackActive(type: ItemType): boolean {
    if (!selectedItemKey.value) return false;
    return selectedItemKey.value.startsWith(`${type}_`);
  }

  function getSegmentClasses(type: ItemType, id: string, isDeleted?: boolean): string[] {
    const classes: string[] = [];
    const key = `${type}_${id}`;

    // Check if this is a video source being dragged
    const isSourceDragging = type === 'source' && isDraggingSource.value && dragSourceInfo.value?.sourceId === id;

    if (isDragging.value && dragInfo.value?.type === type && dragInfo.value?.id === id) {
      classes.push('cursor-grabbing', 'z-30', 'shadow-2xl', 'border-2', 'border-blue-400', 'dragging');
    } else if (isResizing.value && resizeInfo.value?.type === type && resizeInfo.value?.id === id) {
      classes.push('cursor-ew-resize', 'z-30', 'shadow-2xl', 'border-2', 'border-green-400', 'resizing');
    } else if (isSourceDragging) {
      classes.push('cursor-grabbing', 'z-30', 'shadow-2xl', 'border-2', 'border-blue-400', 'dragging');
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

  // Convert effective time to visual percentage position (accounting for segment gaps in clip mode)
  function effectiveTimeToVisualPercent(effectiveTime: number): number {
    // Editor mode: simple linear mapping (no segment gaps)
    if (props.editorMode) {
      const duration = props.duration || 300;
      if (duration <= 0) return 0;
      return (effectiveTime / duration) * 100;
    }

    // Clip mode: segment-based mapping with gaps
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
    // Editor mode: simple linear mapping (no segment gaps)
    if (props.editorMode) {
      const duration = props.duration || 300;
      return (percent / 100) * duration;
    }

    // Clip mode: segment-based mapping with gaps
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

  // Snap-to-edge utility functions
  interface SnapTarget {
    time: number;
    type: 'segment-start' | 'segment-end' | 'playhead';
  }

  interface SnapResult {
    time: number;
    didSnap: boolean;
    snapTarget?: SnapTarget;
  }

  /**
   * Get all snap targets (segment edges) excluding the segment being dragged/resized
   */
  function getSnapTargets(excludeId?: string): SnapTarget[] {
    const targets: SnapTarget[] = [];

    if (props.editorMode) {
      // Editor mode: collect video source edges
      for (const source of props.videoSources) {
        if (source.id === excludeId) continue;

        // Use preview position if this source is being dragged/resized
        const preview = sourcePreview.value;
        const startTime = preview && preview.sourceId === source.id ? preview.startTime : source.start_time;
        const endTime = preview && preview.sourceId === source.id ? preview.endTime : source.end_time;

        targets.push({ time: startTime, type: 'segment-start' });
        targets.push({ time: endTime, type: 'segment-end' });
      }
    } else {
      // Clip mode: collect trim segment edges
      for (const segment of sortedTrimSegments.value) {
        if (segment.id === excludeId) continue;

        // Use preview position if this segment is being dragged/resized
        const preview = dragPreview.value;
        const startTime =
          preview && preview.type === 'trim' && preview.id === segment.id ? preview.startTime : segment.startTime;
        const endTime =
          preview && preview.type === 'trim' && preview.id === segment.id ? preview.endTime : segment.endTime;

        targets.push({ time: startTime, type: 'segment-start' });
        targets.push({ time: endTime, type: 'segment-end' });
      }
    }

    // Always add playhead as a snap target
    targets.push({ time: props.currentTime, type: 'playhead' });

    // Add timeline boundaries
    targets.push({ time: 0, type: 'segment-start' });
    const maxDuration = props.editorMode ? props.duration : totalDuration.value;
    if (maxDuration > 0) {
      targets.push({ time: maxDuration, type: 'segment-end' });
    }

    return targets;
  }

  /**
   * Convert time to pixel position for snap distance calculation
   */
  function timeToPixelPosition(time: number): number {
    const trackWidth = getTrackContentWidth();
    const duration = props.editorMode ? props.duration : totalDuration.value;
    if (duration <= 0) return 0;
    return (time / duration) * trackWidth;
  }

  /**
   * Check if a time should snap to any target and return the snapped time
   */
  function applySnapToTime(targetTime: number, excludeId?: string): SnapResult {
    if (!snapEnabled.value) {
      return { time: targetTime, didSnap: false };
    }

    const targets = getSnapTargets(excludeId);
    const targetPixel = timeToPixelPosition(targetTime);

    let closestTarget: SnapTarget | null = null;
    let closestDistance = Infinity;

    for (const target of targets) {
      const targetTimePixel = timeToPixelPosition(target.time);
      const distance = Math.abs(targetPixel - targetTimePixel);

      if (distance <= SNAP_THRESHOLD_PX && distance < closestDistance) {
        closestTarget = target;
        closestDistance = distance;
      }
    }

    if (closestTarget) {
      return {
        time: closestTarget.time,
        didSnap: true,
        snapTarget: closestTarget,
      };
    }

    return { time: targetTime, didSnap: false };
  }

  /**
   * Apply snapping to both edges of a segment during drag operations
   * Returns snapped start/end times while preserving segment duration
   */
  function applySnapToSegment(
    startTime: number,
    endTime: number,
    excludeId?: string
  ): { startTime: number; endTime: number; didSnap: boolean; snapTime: number | null } {
    if (!snapEnabled.value) {
      return { startTime, endTime, didSnap: false, snapTime: null };
    }

    const duration = endTime - startTime;

    // Check start edge for snapping
    const startSnap = applySnapToTime(startTime, excludeId);
    if (startSnap.didSnap) {
      return {
        startTime: startSnap.time,
        endTime: startSnap.time + duration,
        didSnap: true,
        snapTime: startSnap.time,
      };
    }

    // Check end edge for snapping
    const endSnap = applySnapToTime(endTime, excludeId);
    if (endSnap.didSnap) {
      return {
        startTime: endSnap.time - duration,
        endTime: endSnap.time,
        didSnap: true,
        snapTime: endSnap.time,
      };
    }

    return { startTime, endTime, didSnap: false, snapTime: null };
  }

  // Convert click position to source time
  function clickPositionToTime(percent: number): number {
    // Editor mode: simple linear mapping using totalDuration for consistency
    if (props.editorMode) {
      const duration = totalDuration.value;
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

    if (!contentWrapperRef.value) return;

    const contentRect = contentWrapperRef.value.getBoundingClientRect();
    // Account for the track label width - timeline content starts after labels
    const timelineLeft = contentRect.left + TRACK_LABEL_WIDTH;
    const timelineWidth = contentRect.width - TRACK_LABEL_WIDTH;
    const x = e.clientX - timelineLeft;
    const percent = Math.max(0, Math.min(1, x / timelineWidth));
    const time = clickPositionToTime(percent);

    emit('seek', Math.max(0, time));
  }

  function onTimelineContainerClick(e: MouseEvent) {
    // Only handle clicks that weren't already handled by child elements
    if (!contentWrapperRef.value) return;

    const contentRect = contentWrapperRef.value.getBoundingClientRect();
    // Account for the track label width - timeline content starts after labels
    const timelineLeft = contentRect.left + TRACK_LABEL_WIDTH;
    const timelineWidth = contentRect.width - TRACK_LABEL_WIDTH;
    
    // If click is in the label area, ignore
    if (e.clientX < timelineLeft) return;
    
    const x = e.clientX - timelineLeft;
    const percent = Math.max(0, Math.min(1, x / timelineWidth));
    const time = clickPositionToTime(percent);

    emit('seek', Math.max(0, time));
  }

  function onRulerClick(e: MouseEvent) {
    if (!contentWrapperRef.value) return;

    const contentRect = contentWrapperRef.value.getBoundingClientRect();
    // Account for the track label width - timeline content starts after labels
    const timelineLeft = contentRect.left + TRACK_LABEL_WIDTH;
    const timelineWidth = contentRect.width - TRACK_LABEL_WIDTH;
    const x = e.clientX - timelineLeft;
    const percent = Math.max(0, Math.min(1, x / timelineWidth));
    const time = clickPositionToTime(percent);

    emit('seek', Math.max(0, time));
  }

  function onSegmentClick(e: MouseEvent, segment: TrimSegment) {
    // Emit multi-select event with modifier keys
    emit('segmentSelect', segment.id, {
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
    });

    // Select the segment (for internal timeline state)
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

  // Delete selected item
  function deleteSelectedItem() {
    if (!selectedItemKey.value) return;

    const [type, id] = selectedItemKey.value.split('_');

    if (type === 'trim') {
      // For trim segments, we need at least one segment remaining
      if (sortedTrimSegments.value.length <= 1) {
        console.warn('Cannot delete the last remaining segment');
        return;
      }
      emit('deleteTrimSegment', id);
    } else if (type === 'audio') {
      emit('deleteAudioTrack', id);
    } else if (type === 'text') {
      emit('deleteTextOverlay', id);
    } else if (type === 'sticker') {
      emit('deleteSticker', id);
    } else if (type === 'watermark') {
      emit('deleteWatermark', id);
    }

    // Clear selection after deletion
    selectedItemKey.value = null;
  }

  // Cut at playhead (CapCut style)
  function performCutAtPlayhead() {
    const currentTime = props.currentTime;
    console.log('[Timeline] ========== SPLIT OPERATION STARTED ==========');
    console.log('[Timeline] performCutAtPlayhead called at time:', currentTime);
    console.log('[Timeline] Selected item:', selectedItemKey.value);

    // If a specific track is selected, split that track at the playhead
    if (selectedItemKey.value) {
      const [type, id] = selectedItemKey.value.split('_');
      console.log('[Timeline] Splitting selected track:', { type, id, currentTime });

      // Split based on track type
      switch (type) {
        case 'watermark':
          emit('splitWatermark', id, currentTime);
          return;
        case 'text':
          emit('splitTextOverlay', id, currentTime);
          return;
        case 'sticker':
          emit('splitSticker', id, currentTime);
          return;
        case 'effect':
          emit('splitEffect', id, currentTime);
          return;
        case 'filter':
          emit('splitFilter', id, currentTime);
          return;
        case 'audio':
          emit('splitAudioTrack', id, currentTime);
          return;
        case 'source':
          // For video sources in editor mode
          if (props.editorMode && props.videoSources) {
            const source = props.videoSources.find(s => s.id === id);
            if (source) {
              const cutTime = currentTime - source.start_time;
              emit('splitSource', source.id, currentTime, cutTime);
            }
          }
          return;
        case 'trim':
          // For trim segments in clip mode
          emit('splitTrimSegment', id, currentTime);
          return;
      }
    }

    // No selection - auto-detect what to split based on playhead position
    console.log('[Timeline] No selection - auto-detecting track to split');

    // In editor mode, find which source contains the current time
    if (props.editorMode && props.videoSources) {
      console.log('[Timeline] Checking video sources:', props.videoSources);
      for (const source of props.videoSources) {
        if (currentTime >= source.start_time && currentTime < source.end_time) {
          const cutTime = currentTime - source.start_time;
          console.log('[Timeline] Found source to cut:', source.id, 'at time:', cutTime);
          emit('splitSource', source.id, currentTime, cutTime);
          return;
        }
      }
      console.warn('[Timeline] No source found at current playhead position');
      return;
    }

    // In clip mode, find which segment contains the current time
    const segment = sortedTrimSegments.value.find((s) => currentTime >= s.startTime && currentTime < s.endTime);

    if (!segment) {
      console.warn('[Timeline] No segment found at current playhead position');
      return;
    }

    // Don't allow cutting too close to segment edges (minimum 0.1s from each edge)
    const minDistanceFromEdge = 0.1;
    if (currentTime - segment.startTime < minDistanceFromEdge || segment.endTime - currentTime < minDistanceFromEdge) {
      console.warn('[Timeline] Cut position too close to segment edge');
      return;
    }

    console.log('[Timeline] Emitting splitTrimSegment event:', { segmentId: segment.id, cutTime: currentTime });
    emit('splitTrimSegment', segment.id, currentTime);
    console.log('[Timeline] ========== SPLIT OPERATION EMITTED ==========');
  }

  function onSegmentHoverForCut(event: MouseEvent, segment: TrimSegment) {
    if (!isCutToolActive.value) return;

    // Find the segment element
    let segmentElement = event.target as HTMLElement;
    while (segmentElement && !segmentElement.classList.contains('clip-segment')) {
      segmentElement = segmentElement.parentElement as HTMLElement;
    }

    if (!segmentElement) return;

    const rect = segmentElement.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const segmentWidth = rect.width;

    // Calculate the cut position as a percentage within the segment
    const cutPositionPercent = (relativeX / segmentWidth) * 100;

    // Calculate the actual cut time within the segment
    const segmentDuration = segment.endTime - segment.startTime;
    const cutTime = segment.startTime + (segmentDuration * cutPositionPercent) / 100;

    // Validate minimum segment durations after potential cut
    const leftDuration = cutTime - segment.startTime;
    const rightDuration = segment.endTime - cutTime;

    if (leftDuration >= MIN_SEGMENT_DURATION && rightDuration >= MIN_SEGMENT_DURATION) {
      cutHoverInfo.value = {
        segmentId: segment.id,
        cutTime,
        cutPosition: cutPositionPercent,
      };
    } else {
      // Not enough space for a valid cut
      cutHoverInfo.value = null;
    }
  }

  function onSegmentClickForCut(event: MouseEvent, segment: TrimSegment) {
    if (!isCutToolActive.value || !cutHoverInfo.value) return;

    event.preventDefault();
    event.stopPropagation();

    // Emit the split event with the segment ID and cut time
    emit('splitTrimSegment', segment.id, cutHoverInfo.value.cutTime);

    // Keep cut tool active (like CapCut) - just clear hover info for next cut
    // User can press X again to deactivate when done
    cutHoverInfo.value = null;
  }

  // Video source cut functions (editor mode)
  function onSourceHoverForCut(event: MouseEvent, source: VideoEditorSource) {
    if (!isCutToolActive.value) return;

    // Find the source element
    let sourceElement = event.target as HTMLElement;
    while (sourceElement && !sourceElement.classList.contains('clip-segment')) {
      sourceElement = sourceElement.parentElement as HTMLElement;
    }

    if (!sourceElement) return;

    const rect = sourceElement.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;
    const sourceWidth = rect.width;

    // Calculate the cut position as a percentage within the source
    const cutPositionPercent = (relativeX / sourceWidth) * 100;

    // Calculate the actual cut time (both timeline position and source time)
    const sourceDuration = source.end_time - source.start_time;
    const cutTimelinePosition = source.start_time + (sourceDuration * cutPositionPercent) / 100;

    // Calculate the cut time in the source video
    const trimStart = source.trim_start;
    const trimEnd = source.trim_end ?? trimStart + sourceDuration;
    const sourceMediaDuration = trimEnd - trimStart;
    const cutSourceTime = trimStart + (sourceMediaDuration * cutPositionPercent) / 100;

    // Validate minimum segment durations after potential cut
    const leftDuration = cutTimelinePosition - source.start_time;
    const rightDuration = source.end_time - cutTimelinePosition;

    if (leftDuration >= MIN_SEGMENT_DURATION && rightDuration >= MIN_SEGMENT_DURATION) {
      cutHoverInfo.value = {
        segmentId: source.id,
        cutTime: cutSourceTime, // Store source time for the split operation
        cutPosition: cutPositionPercent,
      };
    } else {
      // Not enough space for a valid cut
      cutHoverInfo.value = null;
    }
  }

  function onSourceClickForCut(event: MouseEvent, source: VideoEditorSource) {
    if (!isCutToolActive.value || !cutHoverInfo.value) return;

    event.preventDefault();
    event.stopPropagation();

    // Calculate the timeline cut position
    const sourceDuration = source.end_time - source.start_time;
    const cutTimelinePosition = source.start_time + (sourceDuration * cutHoverInfo.value.cutPosition) / 100;

    // Emit the split event with source ID, timeline position, and source time
    emit('splitSource', source.id, cutTimelinePosition, cutHoverInfo.value.cutTime);

    // Keep cut tool active (like CapCut) - just clear hover info for next cut
    // User can press X again to deactivate when done
    cutHoverInfo.value = null;
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

    if (!contentWrapperRef.value || !timelineScrollContainer.value) return;

    const scrollContainer = timelineScrollContainer.value;
    const containerRect = scrollContainer.getBoundingClientRect();
    const contentRect = contentWrapperRef.value.getBoundingClientRect();

    // Timeline content starts after the label area
    const timelineLeft = contentRect.left + TRACK_LABEL_WIDTH;
    const timelineWidth = contentRect.width - TRACK_LABEL_WIDTH;

    // Left edge of the visible track area (where content can appear, past the labels)
    const visibleTrackLeft = containerRect.left + TRACK_LABEL_WIDTH;
    const visibleTrackRight = containerRect.right;

    // Cursor position in viewport coords
    const cursorX = e.clientX;

    // Handle cursor in label area (left of track content) - seek to 0
    if (cursorX < visibleTrackLeft) {
      emit('seek', 0);
      return;
    }

    if (cursorX > visibleTrackRight) {
      // Cursor is past the right edge - seek to end
      emit('seek', totalDuration.value);
      return;
    }

    // Cursor is within the visible track area - calculate position
    const x = cursorX - timelineLeft;
    const percent = Math.max(0, Math.min(1, x / timelineWidth));
    const time = clickPositionToTime(percent);
    emit('seek', Math.max(0, time));
  }

  function onPlayheadDragEnd() {
    isDraggingPlayhead.value = false;

    document.removeEventListener('mousemove', onPlayheadDragMove);
    document.removeEventListener('mouseup', onPlayheadDragEnd);
  }

  // Video source functions (editor mode)
  function getVideoSourceStyle(source: VideoEditorSource, _preview?: { sourceId: string; startTime: number; endTime: number } | null): Record<string, string> {
    const colors = colorMap.violet;
    const isSelected = selectedItemKey.value === `source_${source.id}`;
    const duration = totalDuration.value;

    // Use preview position during drag/resize for smooth updates
    // Note: _preview param is passed to ensure Vue reactivity tracks sourcePreview changes
    const preview = sourcePreview.value;
    const startTime = preview && preview.sourceId === source.id ? preview.startTime : source.start_time;
    const endTime = preview && preview.sourceId === source.id ? preview.endTime : source.end_time;

    const left = (startTime / duration) * 100;
    const width = ((endTime - startTime) / duration) * 100;

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

    // Use exact percentage width for accuracy - CSS min-width ensures visibility for tiny crossfades
    return {
      left: `${left}%`,
      width: `${width}%`,
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
      startY: e.clientY,
      originalStartTime: source.start_time,
      originalEndTime: source.end_time,
      originalTrackIndex: source.track_index ?? 0,
      targetTrackIndex: source.track_index ?? 0,
    };

    document.addEventListener('mousemove', onSourceDragMove);
    document.addEventListener('mouseup', onSourceDragEnd);
  }

  function onSourceDragMove(e: MouseEvent) {
    if (!isDraggingSource.value || !dragSourceInfo.value || !videoTrackContentRef.value) return;

    const rect = videoTrackContentRef.value.getBoundingClientRect();
    const deltaX = e.clientX - dragSourceInfo.value.startX;
    const deltaTime = (deltaX / rect.width) * props.duration;

    // Detect which layer the mouse is currently over by checking all layer elements
    let targetTrackIndex = dragSourceInfo.value.originalTrackIndex;
    let foundLayer = false;
    
    // Get all layer track elements
    const layerElements = document.querySelectorAll('[data-layer-track]');
    
    for (const layerEl of layerElements) {
      const layerRect = layerEl.getBoundingClientRect();
      // Check if mouse Y position is within this layer's bounds
      if (e.clientY >= layerRect.top && e.clientY <= layerRect.bottom) {
        const layerIndex = parseInt(layerEl.getAttribute('data-layer-track') || '0');
        // For video sources, layer 0 in the overlay system should map to track_index 1
        // because track_index 0 is reserved for the Source track
        targetTrackIndex = layerIndex === 0 ? 1 : layerIndex;
        foundLayer = true;
        break;
      }
    }
    
    // If not over any layer, check if over Source track
    const sourceTrackRect = rect;
    if (e.clientY >= sourceTrackRect.top && e.clientY <= sourceTrackRect.bottom) {
      targetTrackIndex = 0; // Source track
      foundLayer = true;
    }
    
    // Fallback: If no existing layers found or not over any track, use pixel-based calculation
    if (!foundLayer) {
      const deltaY = e.clientY - dragSourceInfo.value.startY;
      const LAYER_HEIGHT = 40;
      const trackOffset = Math.round(-deltaY / LAYER_HEIGHT);
      targetTrackIndex = Math.max(0, dragSourceInfo.value.originalTrackIndex + trackOffset);
    }
    
    // Replace entire object to trigger Vue reactivity for computed properties
    dragSourceInfo.value = {
      ...dragSourceInfo.value,
      targetTrackIndex,
    };

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

    // Apply snapping for video sources
    // Source track (track_index 0): ALWAYS snap to nearest segment edge, no free positioning
    // Layers (track_index > 0): Optional snap within threshold
    if (targetTrackIndex === 0) {
      // Source track: Force snap to nearest segment edge
      const snapResult = applySnapToSegment(newStartTime, newEndTime, dragSourceInfo.value.sourceId);
      if (snapResult.didSnap) {
        newStartTime = snapResult.startTime;
        newEndTime = snapResult.endTime;
        activeSnapTime.value = snapResult.snapTime;
      } else {
        // If no snap found, find the closest segment edge and snap to it
        const targets = getSnapTargets(dragSourceInfo.value.sourceId);
        let closestTarget: { time: number; distance: number } | null = null;
        
        // Check both start and end edges
        for (const target of targets) {
          if (target.type === 'segment-start' || target.type === 'segment-end') {
            const distanceToStart = Math.abs(newStartTime - target.time);
            const distanceToEnd = Math.abs(newEndTime - target.time);
            
            if (!closestTarget || distanceToStart < closestTarget.distance) {
              closestTarget = { time: target.time, distance: distanceToStart };
            }
            if (distanceToEnd < closestTarget.distance) {
              closestTarget = { time: target.time, distance: distanceToEnd };
            }
          }
        }
        
        // Snap to closest edge
        if (closestTarget) {
          // Determine if we should snap start or end
          const distanceToStart = Math.abs(newStartTime - closestTarget.time);
          const distanceToEnd = Math.abs(newEndTime - closestTarget.time);
          
          if (distanceToStart < distanceToEnd) {
            // Snap start edge
            newStartTime = closestTarget.time;
            newEndTime = newStartTime + duration;
          } else {
            // Snap end edge
            newEndTime = closestTarget.time;
            newStartTime = newEndTime - duration;
          }
          activeSnapTime.value = closestTarget.time;
        }
      }
    } else {
      // Layers: Optional snap within threshold (existing behavior)
      const snapResult = applySnapToSegment(newStartTime, newEndTime, dragSourceInfo.value.sourceId);
      if (snapResult.didSnap) {
        newStartTime = snapResult.startTime;
        newEndTime = snapResult.endTime;
        activeSnapTime.value = snapResult.snapTime;
      } else {
        activeSnapTime.value = null;
      }
    }

    // Update local preview state (no database call) for smooth dragging
    sourcePreview.value = {
      sourceId: dragSourceInfo.value.sourceId,
      startTime: newStartTime,
      endTime: newEndTime,
    };
  }

  function onSourceDragEnd() {
    // Commit the final position to database only on drag end
    if (sourcePreview.value && dragSourceInfo.value) {
      let finalStartTime = sourcePreview.value.startTime;
      let finalEndTime = sourcePreview.value.endTime;
      
      console.log('[onSourceDragEnd] Initial position:', finalStartTime, '-', finalEndTime, 'targetTrackIndex:', dragSourceInfo.value.targetTrackIndex);
      
      // Source track (track_index 0): Force final snap to nearest segment edge (ignore threshold)
      if (dragSourceInfo.value.targetTrackIndex === 0) {
        const duration = finalEndTime - finalStartTime;
        const targets = getSnapTargets(dragSourceInfo.value.sourceId);
        console.log('[onSourceDragEnd] Source track - finding closest from', targets.length, 'targets');
        let closestTarget: { time: number; distance: number; edge: 'start' | 'end' } | null = null;
        
        // Find the absolute closest segment edge (no threshold)
        for (const target of targets) {
          if (target.type === 'segment-start' || target.type === 'segment-end') {
            const distanceToStart = Math.abs(finalStartTime - target.time);
            const distanceToEnd = Math.abs(finalEndTime - target.time);
            
            if (!closestTarget || distanceToStart < closestTarget.distance) {
              closestTarget = { time: target.time, distance: distanceToStart, edge: 'start' };
            }
            if (distanceToEnd < closestTarget.distance) {
              closestTarget = { time: target.time, distance: distanceToEnd, edge: 'end' };
            }
          }
        }
        
        console.log('[onSourceDragEnd] Closest target:', closestTarget);
        
        if (closestTarget) {
          if (closestTarget.edge === 'start') {
            // Snap our start edge to the target
            finalStartTime = closestTarget.time;
            finalEndTime = finalStartTime + duration;
            console.log('[onSourceDragEnd] Snapped START to', closestTarget.time, 'new position:', finalStartTime, '-', finalEndTime);
          } else {
            // Snap our end edge to the target
            finalEndTime = closestTarget.time;
            finalStartTime = finalEndTime - duration;
            console.log('[onSourceDragEnd] Snapped END to', closestTarget.time, 'new position:', finalStartTime, '-', finalEndTime);
          }
        } else {
          console.log('[onSourceDragEnd] NO TARGETS FOUND - keeping position:', finalStartTime, '-', finalEndTime);
        }
      }
      
      const updates: Partial<VideoEditorSource> = {
        start_time: finalStartTime,
        end_time: finalEndTime,
      };
      
      // Include track_index if it changed
      if (dragSourceInfo.value.targetTrackIndex !== dragSourceInfo.value.originalTrackIndex) {
        updates.track_index = dragSourceInfo.value.targetTrackIndex;
      }
      
      emit('updateSource', dragSourceInfo.value.sourceId, updates);
    }

    isDraggingSource.value = false;
    dragSourceInfo.value = null;
    sourcePreview.value = null;
    activeSnapTime.value = null;
    document.removeEventListener('mousemove', onSourceDragMove);
    document.removeEventListener('mouseup', onSourceDragEnd);
  }

  // Source context menu handlers
  function onSourceContextMenu(e: MouseEvent, source: VideoEditorSource) {
    sourceContextMenu.visible = true;
    sourceContextMenu.x = e.clientX;
    sourceContextMenu.y = e.clientY;
    sourceContextMenu.source = source;
  }

  function closeSourceContextMenu() {
    sourceContextMenu.visible = false;
    sourceContextMenu.source = null;
  }

  async function extractAudioFromSource() {
    if (!sourceContextMenu.source) return;
    
    const source = sourceContextMenu.source;
    closeSourceContextMenu();
    
    isExtractingAudio.value = true;
    
    try {
      console.log('[ClipEditorTimeline] Extracting audio from source:', source.id);
      
      // Calculate the trim parameters based on the segment's trim settings
      // trim_start is how far into the source video to start
      // The segment duration is (end_time - start_time) on the timeline
      const trimStart = source.trim_start || 0;
      const segmentDuration = source.end_time - source.start_time;
      
      console.log('[ClipEditorTimeline] Extraction params:', {
        trimStart,
        segmentDuration,
        sourceStartTime: source.start_time,
        sourceEndTime: source.end_time,
      });
      
      // Call Rust command to extract audio from the specific segment
      const result = await invoke<{ file_path: string; filename: string; duration: number }>('extract_audio_to_file', {
        videoPath: source.source_path,
        sourceId: source.id,
        trimStart: trimStart,
        trimDuration: segmentDuration,
      });
      
      console.log('[ClipEditorTimeline] Audio extraction complete:', result);
      
      // Emit event to create audio track with the extracted audio
      // The audio track should start at the same position as the video source on the timeline
      emit('extractedAudio', {
        sourceId: source.id,
        filePath: result.file_path,
        filename: result.filename,
        duration: result.duration,
        startTime: source.start_time,
        endTime: source.end_time,
        sourceName: source.source_name,
      });
      
    } catch (error) {
      console.error('[ClipEditorTimeline] Failed to extract audio:', error);
    } finally {
      isExtractingAudio.value = false;
    }
  }

  function deleteSourceFromContextMenu() {
    if (!sourceContextMenu.source) return;
    
    const sourceId = sourceContextMenu.source.id;
    closeSourceContextMenu();
    
    emit('deleteSource', sourceId);
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

  function onTimelineMouseMove(event: MouseEvent) {
    // Don't show hover line during drag/resize operations or when cut tool is active
    if (
      isDragging.value ||
      isResizing.value ||
      isDraggingPlayhead.value ||
      isDraggingSource.value ||
      isCutToolActive.value
    ) {
      showHoverLine.value = false;
      return;
    }

    const container = timelineScrollContainer.value;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const relativeX = event.clientX - rect.left;

    // Update timeline bounds
    // Use clientHeight to exclude horizontal scrollbar height from the bottom bound
    timelineBounds.value = {
      top: rect.top,
      bottom: rect.top + container.clientHeight,
      left: rect.left + TRACK_LABEL_WIDTH,
    };

    // Only show hover line if we're in the timeline content area (after track labels)
    if (relativeX >= TRACK_LABEL_WIDTH) {
      showHoverLine.value = true;
      // Position the line exactly where the cursor is (absolute viewport position)
      hoverLinePosition.value = event.clientX;
    } else {
      showHoverLine.value = false;
    }
  }

  function onTimelineMouseLeave() {
    showHoverLine.value = false;
  }

  function onRulerWheel(event: WheelEvent) {
    event.preventDefault();

    if (!timelineScrollContainer.value || !rulerContentRef.value) return;

    const scrollContainer = timelineScrollContainer.value;
    const rulerContent = rulerContentRef.value;
    const containerRect = scrollContainer.getBoundingClientRect();

    // Get ruler content bounds to calculate hover position for seeking
    const rulerRect = rulerContent.getBoundingClientRect();
    const cursorXInRuler = event.clientX - rulerRect.left;

    // Seek playhead to cursor position if cursor is over the ruler content area
    // Offset slightly to the left so the playhead doesn't block further scroll events
    const playheadOffset = 15; // pixels to the left of cursor
    if (cursorXInRuler >= 0 && cursorXInRuler <= rulerRect.width) {
      const offsetX = Math.max(0, cursorXInRuler - playheadOffset);
      const percent = offsetX / rulerRect.width;
      const time = clickPositionToTime(percent);
      emit('seek', Math.max(0, time));
    }

    // Cursor position relative to the scroll container's viewport
    const cursorXInContainer = event.clientX - containerRect.left;

    // Current scroll position and content width
    const scrollLeft = scrollContainer.scrollLeft;
    const contentWidth = scrollContainer.scrollWidth;

    // Position in the full content (scroll + cursor offset)
    const contentX = scrollLeft + cursorXInContainer;

    // Calculate the "logical" position (0-1 range, independent of zoom)
    const logicalPosition = contentX / contentWidth;

    // Apply zoom with dynamic step based on current zoom level
    const oldZoom = zoomLevel.value;
    const step = getZoomStep();
    const delta = event.deltaY > 0 ? -step : step;
    const newZoom = Math.max(MIN_ZOOM, oldZoom + delta);

    if (newZoom === oldZoom) return;

    zoomLevel.value = newZoom;

    // After zoom, adjust scroll to keep cursor position stable (playhead is now at cursor)
    nextTick(() => {
      const newContentWidth = scrollContainer.scrollWidth;
      const newContentX = logicalPosition * newContentWidth;
      const newScrollLeft = newContentX - cursorXInContainer;

      scrollContainer.scrollLeft = Math.max(0, newScrollLeft);
    });
  }

  // Segment dragging
  function onSegmentMouseDown(e: MouseEvent, type: ItemType, id: string, item: any) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const trackContentWidth = getTrackContentWidth();
    const originalLayer = ['text', 'sticker', 'watermark'].includes(type) ? (item.layer ?? 0) : undefined;
    const originalTrackIndex = type === 'source' ? (item.track_index ?? 0) : undefined;

    isDragging.value = true;
    dragInfo.value = {
      type,
      id,
      item,
      startX: e.clientX,
      startY: e.clientY,
      originalStartTime: item.startTime,
      originalEndTime: item.endTime,
      originalTrackOrder: type === 'audio' ? item.trackOrder : undefined,
      originalLayer,
      originalTrackIndex,
      trackContentWidth,
    };

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e: MouseEvent) {
    if (!isDragging.value || !dragInfo.value) return;

    const itemDuration = dragInfo.value.originalEndTime - dragInfo.value.originalStartTime;
    const deltaX = e.clientX - dragInfo.value.startX;
    const deltaY = e.clientY - dragInfo.value.startY;
    const deltaPercent = (deltaX / dragInfo.value.trackContentWidth) * 100;

    // For audio tracks, detect which track row the mouse is over
    if (dragInfo.value.type === 'audio' && dragInfo.value.originalTrackOrder !== undefined) {
      // Calculate which audio track the mouse is currently over based on vertical position
      const TRACK_HEIGHT = 48; // 12 * 4px (h-12 in Tailwind)
      const trackOffset = Math.round(deltaY / TRACK_HEIGHT);
      const targetTrackOrder = dragInfo.value.originalTrackOrder + trackOffset;
      
      // Clamp to valid track range
      const maxTrackOrder = Math.max(...props.audioTracks.map(t => t.trackOrder));
      const minTrackOrder = Math.min(...props.audioTracks.map(t => t.trackOrder));
      dragInfo.value.targetTrackOrder = Math.max(minTrackOrder, Math.min(maxTrackOrder, targetTrackOrder));
    }
    
    // For video sources, detect which video track the mouse is over
    if (dragInfo.value.type === 'source' && dragInfo.value.originalTrackIndex !== undefined) {
      const TRACK_HEIGHT = 72; // Video track height in pixels (h-[72px])
      const trackOffset = Math.round(deltaY / TRACK_HEIGHT);
      const targetTrackIndex = dragInfo.value.originalTrackIndex + trackOffset;
      
      // Allow creating new video tracks - minimum is 0
      dragInfo.value.targetTrackIndex = Math.max(0, targetTrackIndex);
    }
    
    // For visual overlays, detect which layer the mouse is over
    if (['text', 'sticker', 'watermark'].includes(dragInfo.value.type) && dragInfo.value.originalLayer !== undefined) {
      const TRACK_HEIGHT = 40; // 10 * 4px (h-10 in Tailwind)
      const trackOffset = Math.round(deltaY / TRACK_HEIGHT);
      const targetLayer = dragInfo.value.originalLayer - trackOffset; // Negative because layers are rendered top-to-bottom
      
      // Allow creating new layers - don't clamp to existing layers
      // Minimum layer is 0, maximum can be any positive number
      dragInfo.value.targetLayer = Math.max(0, targetLayer);
    }

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

      // Apply snapping for trim segments
      const snapResult = applySnapToSegment(newStartTime, newEndTime, dragInfo.value.id);
      if (snapResult.didSnap) {
        // Re-apply bounds after snapping
        if (snapResult.startTime < 0) {
          newStartTime = 0;
          newEndTime = itemDuration;
        } else if (snapResult.endTime > props.duration) {
          newEndTime = props.duration;
          newStartTime = props.duration - itemDuration;
        } else {
          newStartTime = snapResult.startTime;
          newEndTime = snapResult.endTime;
        }
        activeSnapTime.value = snapResult.snapTime;
      } else {
        activeSnapTime.value = null;
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

      // Apply snapping for audio tracks
      const snapResult = applySnapToSegment(newStartTime, newEndTime, dragInfo.value.id);
      if (snapResult.didSnap) {
        if (snapResult.startTime >= 0) {
          newStartTime = snapResult.startTime;
          newEndTime = snapResult.endTime;
        }
        activeSnapTime.value = snapResult.snapTime;
      } else {
        activeSnapTime.value = null;
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

      // Apply snapping for overlay items
      const snapResult = applySnapToSegment(newStartTime, newEndTime, dragInfo.value.id);
      if (snapResult.didSnap) {
        if (snapResult.startTime >= 0 && snapResult.endTime <= totalDuration.value) {
          newStartTime = snapResult.startTime;
          newEndTime = snapResult.endTime;
        }
        activeSnapTime.value = snapResult.snapTime;
      } else {
        activeSnapTime.value = null;
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
    // Commit the final position to database with undo/redo support
    if (dragPreview.value && dragInfo.value) {
      const type = dragPreview.value.type;
      
      // For video sources with cross-track dragging
      if (type === 'source' && dragInfo.value.targetTrackIndex !== undefined && dragInfo.value.targetTrackIndex !== dragInfo.value.originalTrackIndex) {
        // Video source was dragged to a different track
        emit('updateSource', dragPreview.value.id, {
          start_time: dragPreview.value.startTime,
          end_time: dragPreview.value.endTime,
          track_index: dragInfo.value.targetTrackIndex,
        });
      } else if (type === 'audio' && dragInfo.value.targetTrackOrder !== undefined && dragInfo.value.targetTrackOrder !== dragInfo.value.originalTrackOrder) {
        // Audio was dragged to a different track
        emit('updateAudioTrack', dragPreview.value.id, {
          startTime: dragPreview.value.startTime,
          endTime: dragPreview.value.endTime,
          trackOrder: dragInfo.value.targetTrackOrder,
        });
      } else if (['text', 'sticker', 'watermark'].includes(type)) {
        // Visual overlays always use direct update to preserve layer property
        const currentLayer = dragInfo.value.targetLayer ?? dragInfo.value.originalLayer ?? 0;
        const updateData: any = {
          startTime: dragPreview.value.startTime,
          endTime: dragPreview.value.endTime,
          layer: currentLayer,
        };
        
        if (type === 'text') {
          emit('updateTextOverlay', dragPreview.value.id, updateData);
        } else if (type === 'sticker') {
          emit('updateSticker', dragPreview.value.id, updateData);
        } else if (type === 'watermark') {
          emit('updateWatermark', dragPreview.value.id, updateData);
        }
      } else if (['effect', 'audio', 'filter'].includes(type)) {
        // For track types that support undo/redo, emit moveTrack event
        emit('moveTrack', {
          type,
          id: dragPreview.value.id,
          originalStartTime: dragInfo.value.originalStartTime,
          originalEndTime: dragInfo.value.originalEndTime,
          newStartTime: dragPreview.value.startTime,
          newEndTime: dragPreview.value.endTime,
        });
      } else {
        // For other types (trim, source), use direct update
        emitUpdate(dragPreview.value.type, dragPreview.value.id, dragPreview.value.startTime, dragPreview.value.endTime);
      }
    }

    isDragging.value = false;
    dragInfo.value = null;
    dragPreview.value = null;
    activeSnapTime.value = null;

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

        // Apply snapping to the left edge
        const snapResult = applySnapToTime(newStartTime, resizeInfo.value.id);
        if (snapResult.didSnap && snapResult.time >= 0) {
          newStartTime = snapResult.time;
          activeSnapTime.value = snapResult.time;
        } else {
          activeSnapTime.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newStartTime = newEndTime - minDuration;
          activeSnapTime.value = null;
        }
      } else {
        newEndTime = Math.min(props.duration, resizeInfo.value.originalEndTime + deltaTime);

        // Apply snapping to the right edge
        const snapResult = applySnapToTime(newEndTime, resizeInfo.value.id);
        if (snapResult.didSnap && snapResult.time <= props.duration) {
          newEndTime = snapResult.time;
          activeSnapTime.value = snapResult.time;
        } else {
          activeSnapTime.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newEndTime = newStartTime + minDuration;
          activeSnapTime.value = null;
        }
      }
    } else if (resizeInfo.value.type === 'audio') {
      const deltaTime = (deltaX / resizeInfo.value.trackContentWidth) * totalDuration.value;
      if (resizeInfo.value.handle === 'left') {
        newStartTime = Math.max(0, resizeInfo.value.originalStartTime + deltaTime);

        // Apply snapping to the left edge
        const snapResult = applySnapToTime(newStartTime, resizeInfo.value.id);
        if (snapResult.didSnap && snapResult.time >= 0) {
          newStartTime = snapResult.time;
          activeSnapTime.value = snapResult.time;
        } else {
          activeSnapTime.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newStartTime = newEndTime - minDuration;
          activeSnapTime.value = null;
        }
      } else {
        newEndTime = resizeInfo.value.originalEndTime + deltaTime;

        // Apply snapping to the right edge
        const snapResult = applySnapToTime(newEndTime, resizeInfo.value.id);
        if (snapResult.didSnap) {
          newEndTime = snapResult.time;
          activeSnapTime.value = snapResult.time;
        } else {
          activeSnapTime.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newEndTime = newStartTime + minDuration;
          activeSnapTime.value = null;
        }
      }
    } else {
      // For text, sticker, effect, filter - use gap-aware positioning
      if (resizeInfo.value.handle === 'left') {
        const originalStartPercent = effectiveTimeToVisualPercent(resizeInfo.value.originalStartTime);
        const newStartPercent = Math.max(0, originalStartPercent + deltaPercent);
        newStartTime = visualPercentToEffectiveTime(newStartPercent);

        // Apply snapping to the left edge
        const snapResult = applySnapToTime(newStartTime, resizeInfo.value.id);
        if (snapResult.didSnap && snapResult.time >= 0) {
          newStartTime = snapResult.time;
          activeSnapTime.value = snapResult.time;
        } else {
          activeSnapTime.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newStartTime = newEndTime - minDuration;
          activeSnapTime.value = null;
        }
      } else {
        const originalEndPercent = effectiveTimeToVisualPercent(resizeInfo.value.originalEndTime);
        const newEndPercent = Math.min(100, originalEndPercent + deltaPercent);
        newEndTime = visualPercentToEffectiveTime(newEndPercent);

        // Apply snapping to the right edge
        const snapResult = applySnapToTime(newEndTime, resizeInfo.value.id);
        if (snapResult.didSnap && snapResult.time <= totalDuration.value) {
          newEndTime = snapResult.time;
          activeSnapTime.value = snapResult.time;
        } else {
          activeSnapTime.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newEndTime = newStartTime + minDuration;
          activeSnapTime.value = null;
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
    activeSnapTime.value = null;

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
      const { duration, peaks } = waveformData.value;

      // Try resolutions in order of detail (highest first)
      const resolutionOrder = ['extreme', 'ultra', 'high', 'medium', 'low'];
      let peaksData: any[] = [];

      for (const res of resolutionOrder) {
        const peaks = waveformData.value.peaks;
        if (peaks.length > 0) {
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
        amplitude: 0.7,
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
    const barW = Math.max(1, barWidth * 0.7); // thinner bars
    const barS = Math.max(0.5, barSpacing * 0.6); // tighter spacing
    const totalBarWidth = barW + barS;
    const maxBarHeight = height * (amplitude * 0.9); // slightly shorter to avoid touching top
    const baselineY = height - 1; // keep a small gap at bottom

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

      const barCenter = x + barW / 2;
      const isBeforePlayhead = barCenter < playheadPixel;
      const color = '#e5e7eb';

      ctx.fillStyle = color;
      ctx.globalAlpha = 1.0;

      const magnitude = Math.max(Math.abs(peak.max), Math.abs(peak.min));
      const barHeight = Math.max(1, magnitude * maxBarHeight);
      const actualBarWidth = Math.max(1, Math.min(barW, width - x));

      if (barHeight > 0 && actualBarWidth > 0) {
        ctx.fillRect(x, baselineY - barHeight, actualBarWidth, barHeight);
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

  // Video source waveform functions (editor mode)

  // Generate cache key from source path (same logic as useAudioWaveform)
  function getSourceCacheKey(sourcePath: string): string {
    let hash = 0;
    for (let i = 0; i < sourcePath.length; i++) {
      const char = sourcePath.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString();
  }

  // Get cached waveform from database
  async function getCachedSourceWaveform(cacheKey: string): Promise<WaveformData | null> {
    try {
      const { getDatabase } = await import('@/services/database');
      const db = await getDatabase();

      const result = await db.select<
        {
          sample_rate: number;
          duration: number;
          resolutions: string;
        }[]
      >(`SELECT sample_rate, duration, resolutions FROM waveform_data WHERE video_path_hash = ?1`, [cacheKey]);

      if (result.length === 0) return null;

      const cached = result[0];
      const parsed = JSON.parse(cached.resolutions);

      // Handle both old multi-resolution format and new single-array format
      let peaks: { min: number; max: number }[] = [];

      if (Array.isArray(parsed)) {
        // New format: direct peaks array
        peaks = parsed;
      } else if (parsed.peaks && Array.isArray(parsed.peaks)) {
        // New format with wrapper object
        peaks = parsed.peaks;
      } else {
        // Old multi-resolution format - extract highest resolution available
        const resolutionOrder = ['maximum', 'extreme', 'ultra', 'high', 'medium', 'low'];
        for (const level of resolutionOrder) {
          if (parsed[level]?.peaks) {
            peaks = parsed[level].peaks.map((p: any) => ({ min: p.min, max: p.max }));
            break;
          }
        }
        if (peaks.length === 0) {
          const firstKey = Object.keys(parsed)[0];
          if (firstKey && parsed[firstKey]?.peaks) {
            peaks = parsed[firstKey].peaks.map((p: any) => ({ min: p.min, max: p.max }));
          }
        }
      }

      return {
        sampleRate: cached.sample_rate,
        duration: cached.duration,
        peaks,
        peakCount: peaks.length,
      };
    } catch (err) {
      console.error('[ClipEditorTimeline] Error loading cached waveform:', err);
      return null;
    }
  }

  async function loadSourceWaveform(sourceId: string, sourcePath: string): Promise<void> {
    // Skip if already loaded or currently loading
    if (sourceWaveformData.value.has(sourceId) || sourceWaveformLoading.value.has(sourceId)) {
      return;
    }

    sourceWaveformLoading.value.add(sourceId);

    try {
      const cacheKey = getSourceCacheKey(sourcePath);

      // Check database cache first
      const cachedData = await getCachedSourceWaveform(cacheKey);
      if (cachedData) {
        console.log('[ClipEditorTimeline] Using cached waveform for source:', sourceId);
        sourceWaveformData.value.set(sourceId, cachedData);
        nextTick(() => {
          renderSourceWaveform(sourceId);
        });
        return;
      }

      console.log('[ClipEditorTimeline] No cached waveform, extracting for source:', sourceId);

      // Call Rust function to extract real audio waveform from the source file
      const rustWaveform = await invoke<any>('extract_audio_waveform', {
        videoPath: sourcePath,
      });

      // Convert Rust data structure to our TypeScript interface (simplified single-resolution)
      const data: WaveformData = {
        sampleRate: rustWaveform.sample_rate,
        duration: rustWaveform.duration,
        peaks: rustWaveform.peaks.map((peak: any) => ({
          min: peak.min,
          max: peak.max,
        })),
        peakCount: rustWaveform.peak_count,
      };

      sourceWaveformData.value.set(sourceId, data);

      // Render the waveform after loading
      nextTick(() => {
        renderSourceWaveform(sourceId);
      });
    } catch (err) {
      console.error('[ClipEditorTimeline] Failed to load waveform for source:', sourceId, err);
    } finally {
      sourceWaveformLoading.value.delete(sourceId);
    }
  }

  function renderSourceWaveform(sourceId: string): void {
    const canvas = sourceWaveformCanvasRefs.value.get(sourceId);
    const data = sourceWaveformData.value.get(sourceId);
    const source = props.videoSources.find((s) => s.id === sourceId);

    if (!canvas || !data || !source) return;

    try {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Get the trim range for this source (portion of the original video being shown)
      // This is equivalent to absoluteStartTime/absoluteEndTime in clip mode
      const trimStart = source.trim_start;
      const trimEnd = source.trim_end ?? trimStart + (source.end_time - source.start_time);

      // Get the waveform peaks (now using simplified single-resolution structure)
      const { duration, peaks } = data;

      if (duration <= 0 || peaks.length === 0) return;

      // Extract peaks for this segment's time range
      const startRatio = trimStart / duration;
      const endRatio = trimEnd / duration;
      const startIndex = Math.floor(startRatio * peaks.length);
      const endIndex = Math.ceil(endRatio * peaks.length);
      const segmentPeaks = peaks.slice(startIndex, endIndex);

      if (segmentPeaks.length === 0) return;

      // Calculate how to best display the peaks across the canvas width
      const canvasWidth = rect.width;
      const numPeaks = segmentPeaks.length;

      let displayPeaks = segmentPeaks;
      let barWidth: number;
      let barSpacing: number;

      // Target a specific number of bars for consistent appearance
      const targetBars = Math.min(numPeaks, Math.floor(canvasWidth / 3)); // ~3px per bar slot
      
      if (numPeaks > targetBars) {
        // Downsample to target number of bars
        const step = numPeaks / targetBars;
        displayPeaks = [];
        for (let i = 0; i < targetBars; i++) {
          const idx = Math.floor(i * step);
          if (idx < numPeaks) {
            displayPeaks.push(segmentPeaks[idx]);
          }
        }
      }
      
      // Calculate bar dimensions for visible vertical bars
      const numBars = displayPeaks.length;
      const totalWidth = canvasWidth / numBars;
      barWidth = Math.max(2, Math.floor(totalWidth * 0.6));
      barSpacing = totalWidth - barWidth;

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
        min: Math.max(-1, peak.min * gainMultiplier),
        max: Math.min(1, peak.max * gainMultiplier),
      }));

      // Render directly (same as renderSegmentWaveform but without resetting canvas)
      const width = rect.width;
      const height = rect.height;
      const amplitude = 0.7;
      const barW = Math.max(1, barWidth * 0.9);
      const barS = Math.max(0.5, barSpacing * 0.9);
      const totalBarWidth = barW + barS;
      const maxBarHeight = height * amplitude;
      const baselineY = height;

      // Calculate playhead position within segment
      const segmentStartTime = source.start_time;
      const segmentEndTime = source.end_time;
      const isWithinSegment = props.currentTime >= segmentStartTime && props.currentTime <= segmentEndTime;
      const playheadRatio = isWithinSegment
        ? (props.currentTime - segmentStartTime) / (segmentEndTime - segmentStartTime)
        : props.currentTime < segmentStartTime
          ? 0
          : 1;
      const playheadPixel = playheadRatio * width;

      // Set canvas size and clear
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1.0;

      // Draw waveform bars
      gainedPeaks.forEach((peak: any, index: number) => {
        const x = index * totalBarWidth;
        if (x >= width) return;

        const barCenter = x + barW / 2;
        const isBeforePlayhead = barCenter < playheadPixel;
        const color = '#e5e7eb';

        ctx.fillStyle = color;
        ctx.globalAlpha = 1.0;

        const magnitude = Math.max(Math.abs(peak.max), Math.abs(peak.min));
        const barHeight = Math.max(1, magnitude * maxBarHeight);
        const actualBarWidth = Math.max(1, Math.min(barW, width - x));

        if (barHeight > 0 && actualBarWidth > 0) {
          ctx.fillRect(x, baselineY - barHeight, actualBarWidth, barHeight);
        }
      });

      ctx.globalAlpha = 1.0;
    } catch (err) {
      console.error('[ClipEditorTimeline] Error rendering source waveform:', sourceId, err);
    }
  }

  function renderAllSourceWaveforms(): void {
    if (!props.editorMode) return;

    props.videoSources.forEach((source) => {
      if (sourceWaveformData.value.has(source.id)) {
        renderSourceWaveform(source.id);
      }
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

      if (props.editorMode) {
        // Editor mode: currentTime is directly the timeline time
        accumulatedAudioTime = currentVideoTime;
      } else {
        // Clip mode: calculate accumulated time based on video segments
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

  async function loadAllSourceWaveforms(): Promise<void> {
    if (!props.editorMode) return;
    for (const source of props.videoSources) {
      if (source.source_path) {
        await loadSourceWaveform(source.id, source.source_path);
      }
    }
  }

  // Setup resize observer for waveform canvases
  function setupResizeObserver() {
    resizeObserver = new ResizeObserver(() => {
      renderAllWaveforms();
      renderAllAudioWaveforms();
      renderAllSourceWaveforms();
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

    sourceWaveformCanvasRefs.value.forEach((canvas) => {
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

  // Watch for current time and zoom level changes to update audio waveforms
  watch([() => props.currentTime, zoomLevel], () => {
    nextTick(() => {
      renderAllAudioWaveforms();
    });
  });

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

  // Watch for video source changes in editor mode (load waveforms for new sources)
  watch(
    () => props.videoSources,
    async (newSources) => {
      if (!props.editorMode) return;

      // Load waveforms for new sources
      for (const source of newSources) {
        if (source.source_path && !sourceWaveformData.value.has(source.id)) {
          await loadSourceWaveform(source.id, source.source_path);
        }
      }

      // Clean up data for removed sources
      const sourceIds = new Set(newSources.map((s) => s.id));
      sourceWaveformData.value.forEach((_, id) => {
        if (!sourceIds.has(id)) {
          sourceWaveformData.value.delete(id);
          sourceWaveformCanvasRefs.value.delete(id);
        }
      });

      // Re-render all source waveforms after DOM updates
      nextTick(() => {
        renderAllSourceWaveforms();
      });
    },
    { deep: true, immediate: true }
  );

  // Watch for current time and zoom changes to update source waveforms (for playhead position)
  watch([() => props.currentTime, zoomLevel], () => {
    if (props.editorMode) {
      nextTick(() => {
        renderAllSourceWaveforms();
      });
    }
  });

  // Auto-scroll to keep playhead visible during playback (stepping approach)
  // Scrolls the timeline when playhead reaches the right edge of visible area
  function autoScrollToPlayhead(playheadRatio: number) {
    const scrollContainer = timelineScrollContainer.value;
    const contentWrapper = contentWrapperRef.value;
    if (!scrollContainer || !contentWrapper) return;

    // Don't auto-scroll if not zoomed in (content fits in view)
    if (zoomLevel.value <= 1) return;

    const containerWidth = scrollContainer.clientWidth;
    const contentWidth = contentWrapper.offsetWidth;

    // Calculate playhead pixel position within content
    // This matches the CSS: left: calc(80px + (100% - 80px) * position)
    const trackAreaWidth = contentWidth - TRACK_LABEL_WIDTH;
    const playheadX = TRACK_LABEL_WIDTH + trackAreaWidth * playheadRatio;

    // Current scroll and visible area
    const scrollLeft = scrollContainer.scrollLeft;
    const visibleTrackWidth = containerWidth - TRACK_LABEL_WIDTH;

    // Calculate the threshold X position (when playhead reaches here, scroll)
    const rightThresholdX = scrollLeft + TRACK_LABEL_WIDTH + visibleTrackWidth * AUTO_SCROLL_TRIGGER_PERCENT;

    // Check if playhead has crossed the right threshold
    if (playheadX > rightThresholdX) {
      // Step scroll: jump so playhead is at TARGET_PERCENT from left of visible area
      const targetPositionFromLeft = TRACK_LABEL_WIDTH + visibleTrackWidth * AUTO_SCROLL_TARGET_PERCENT;
      const newScrollLeft = playheadX - targetPositionFromLeft;

      // Clamp to valid scroll range
      const maxScroll = contentWidth - containerWidth;
      scrollContainer.scrollLeft = Math.max(0, Math.min(newScrollLeft, maxScroll));
    }
  }

  // Ensure playhead is visible (used after seeks)
  function ensurePlayheadVisible(playheadRatio: number) {
    const scrollContainer = timelineScrollContainer.value;
    const contentWrapper = contentWrapperRef.value;
    if (!scrollContainer || !contentWrapper) return;

    // Don't adjust scroll if not zoomed in
    if (zoomLevel.value <= 1) return;

    const containerWidth = scrollContainer.clientWidth;
    const contentWidth = contentWrapper.offsetWidth;

    // Calculate playhead pixel position
    const trackAreaWidth = contentWidth - TRACK_LABEL_WIDTH;
    const playheadX = TRACK_LABEL_WIDTH + trackAreaWidth * playheadRatio;

    // Current visible boundaries
    const scrollLeft = scrollContainer.scrollLeft;
    const visibleLeft = scrollLeft + TRACK_LABEL_WIDTH;
    const visibleRight = scrollLeft + containerWidth;
    const visibleTrackWidth = containerWidth - TRACK_LABEL_WIDTH;

    // Check if playhead is outside visible area
    if (playheadX < visibleLeft || playheadX > visibleRight) {
      // Center the playhead in the visible area
      const targetPositionFromLeft = TRACK_LABEL_WIDTH + visibleTrackWidth * 0.5;
      const newScrollLeft = playheadX - targetPositionFromLeft;

      // Clamp to valid scroll range
      const maxScroll = contentWidth - containerWidth;
      scrollContainer.scrollLeft = Math.max(0, Math.min(newScrollLeft, maxScroll));
    }
  }

  // Smooth playhead animation functions
  // Uses linear extrapolation based on real elapsed time for perfectly smooth motion
  function startPlayheadAnimation() {
    if (animationFrameId !== null) return;

    // Sync to current state
    lastSyncTime = performance.now();
    lastSyncPosition = playheadPosition.value;
    lastKnownPosition = lastSyncPosition;
    smoothPlayheadPosition.value = lastSyncPosition;

    function animate(currentTime: number) {
      if (!props.isPlaying || isDraggingPlayhead.value) {
        animationFrameId = null;
        return;
      }

      // Calculate elapsed time since last sync (in seconds)
      const elapsedSeconds = (currentTime - lastSyncTime) / 1000;

      // Calculate expected position change using linear extrapolation
      // Position is 0-1, moving 1 unit over totalDuration seconds
      // This gives perfectly smooth motion regardless of zoom or duration
      const duration = totalDuration.value;
      if (duration > 0) {
        const positionDelta = elapsedSeconds / duration;
        const newPosition = lastSyncPosition + positionDelta;
        smoothPlayheadPosition.value = Math.min(1, Math.max(0, newPosition));

        // Auto-scroll to keep playhead visible during playback
        autoScrollToPlayhead(smoothPlayheadPosition.value);
      }

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
    lastSyncPosition = playheadPosition.value;
    lastSyncTime = performance.now();
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

  // Computed position for snap indicator line (0-1 range like playhead)
  const snapIndicatorPosition = computed(() => {
    if (activeSnapTime.value === null) return null;
    const duration = props.editorMode ? props.duration : totalDuration.value;
    if (duration <= 0) return null;
    return activeSnapTime.value / duration;
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

  // Resync animation to actual video position when it updates
  // Only resyncs on seeks or significant drift - lets extrapolation handle smooth motion otherwise
  watch(playheadPosition, (newPosition) => {
    // Detect if this is a seek (large position change) vs normal playback update
    const positionChange = Math.abs(newPosition - lastKnownPosition);
    // Threshold: if position changed by more than 2% of timeline, consider it a seek
    const isSeek = positionChange > 0.02;

    if (!props.isPlaying) {
      // Not playing - always sync immediately
      smoothPlayheadPosition.value = newPosition;
      lastSyncTime = performance.now();
      lastSyncPosition = newPosition;

      // When seeking while paused, ensure playhead is visible
      if (isSeek) {
        nextTick(() => ensurePlayheadVisible(newPosition));
      }
    } else if (isSeek) {
      // Seek during playback - snap and resync
      smoothPlayheadPosition.value = newPosition;
      lastSyncTime = performance.now();
      lastSyncPosition = newPosition;

      // Ensure playhead is visible after seeking during playback
      nextTick(() => ensurePlayheadVisible(newPosition));
    } else {
      // Normal playback update - check for drift between extrapolated and actual position
      const drift = Math.abs(newPosition - smoothPlayheadPosition.value);
      // Only resync if drift exceeds 1% (handles buffering, stuttering, etc.)
      // Otherwise, let the smooth extrapolation continue uninterrupted
      if (drift > 0.01) {
        // Resync to correct drift, but don't snap the visual position
        // The animation will smoothly catch up from the new sync point
        lastSyncTime = performance.now();
        lastSyncPosition = newPosition;
      }
      // If drift is small, do nothing - extrapolation continues smoothly
    }

    lastKnownPosition = newPosition;
  });

  // Continuous seeking functions
  function startContinuousSeeking(direction: 'forward' | 'reverse') {
    const maxDuration = props.editorMode ? props.duration : totalDuration.value;
    if (maxDuration <= 0) {
      return;
    }

    isSeeking.value = true;
    seekDirection.value = direction;

    // Initialize our seek position from the current video time
    currentSeekTime.value = props.currentTime;

    // Start continuous seeking at high speed immediately (no initial jump)
    seekInterval.value = setInterval(() => {
      const seekAmount =
        seekDirection.value === 'forward' ? SEEK_CONFIG.SECONDS_PER_INTERVAL : -SEEK_CONFIG.SECONDS_PER_INTERVAL;

      // Update our tracked seek position
      currentSeekTime.value += seekAmount;
      currentSeekTime.value = Math.max(0, Math.min(maxDuration, currentSeekTime.value));

      emit('seek', currentSeekTime.value);
    }, SEEK_CONFIG.INTERVAL_MS);
  }

  function stopContinuousSeeking() {
    if (seekInterval.value) {
      clearInterval(seekInterval.value);
      seekInterval.value = null;
    }

    isSeeking.value = false;
    seekDirection.value = null;
  }

  // Keyboard handler for cut tool and seeking
  function handleKeyDown(event: KeyboardEvent) {
    // Don't handle keyboard events if user is typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Delete selected item with Delete or Backspace key
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      deleteSelectedItem();
      return;
    }

    // Perform cut at playhead with X key
    if (event.key === 'x' || event.key === 'X') {
      event.preventDefault();
      performCutAtPlayhead();
    }

    // Deactivate cut tool with Escape key
    if (event.key === 'Escape' && isCutToolActive.value) {
      event.preventDefault();
      isCutToolActive.value = false;
      cutHoverInfo.value = null;
    }

    // Handle arrow keys for seeking
    const maxDuration = props.editorMode ? props.duration : totalDuration.value;
    if (!isCutToolActive.value && maxDuration > 0) {
      if (event.key === 'ArrowLeft' && !isSeeking.value) {
        event.preventDefault();
        startContinuousSeeking('reverse');
      } else if (event.key === 'ArrowRight' && !isSeeking.value) {
        event.preventDefault();
        startContinuousSeeking('forward');
      }
    }
  }

  // Handle keyboard key up events
  function handleKeyUp(event: KeyboardEvent) {
    // Don't handle keyboard events if user is typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Stop continuous seeking when arrow keys are released
    if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && isSeeking.value) {
      event.preventDefault();
      stopContinuousSeeking();
    }
  }

  // Lifecycle
  onMounted(() => {
    nextTick(async () => {
      setupResizeObserver();
      if (props.videoSrc) {
        loadWaveformFromVideo(props.videoSrc);
      }
      // Load audio waveforms for existing tracks
      await loadAllAudioWaveforms();
      // Load source waveforms for editor mode
      await loadAllSourceWaveforms();
    });

    // Add keyboard listeners for cut tool and seeking
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
  });

  onUnmounted(() => {
    cleanupResizeObserver();
    stopPlayheadAnimation();
    // Clean up continuous seeking
    stopContinuousSeeking();
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
    document.removeEventListener('mousemove', onPlayheadDragMove);
    document.removeEventListener('mouseup', onPlayheadDragEnd);
    // Remove keyboard listeners
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
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

  /* Track label active state styling */
  .track-label-active {
    color: rgba(139, 92, 246, 0.9) !important;
    background: linear-gradient(to right, rgba(139, 92, 246, 0.15), #101010) !important;
  }

  .track-label-active svg {
    color: rgba(139, 92, 246, 0.9);
  }

  /* Playhead positioning using CSS custom property */
  /* Label width is w-[100px] = 100px, track content is the remaining width */
  .playhead-line {
    --playhead-position: 0;
    left: calc(100px + (100% - 100px) * var(--playhead-position));
    will-change: left;
    /* Smooth transition for seeks (when paused) */
    transition: left 100ms ease-out;
    /* Force single compositing layer for all children */
    contain: layout style;
  }

  /* Inner line - fills space between sticky circles */
  .playhead-line-inner {
    transition: background-color 0.15s ease;
  }

  /* Circles */
  .playhead-circle {
    transition: transform 0.15s ease;
  }

  .playhead-circle:hover {
    transform: scale(1.1);
  }

  /* During playback, use requestAnimationFrame - disable ALL transitions and force single layer */
  .playhead-line.playhead-playing {
    transition: none;
    /* Force GPU layer that includes all children */
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  /* Disable all child transitions during playback to prevent timing differences */
  .playhead-line.playhead-playing .playhead-child {
    transition: none !important;
    /* Inherit the parent's compositing layer */
    transform: translateZ(0);
    backface-visibility: hidden;
  }

  .playhead-line.playhead-playing .playhead-circle {
    transform: translateZ(0) !important;
  }

  /* Disable transition when dragging for immediate response */
  .playhead-line.playhead-dragging {
    transition: none !important;
  }

  .playhead-line.playhead-dragging .playhead-child {
    transition: none !important;
  }

  /* Transition zone (crossfade) styling */
  .transition-zone {
    /* Minimum width ensures visibility for very small crossfades while percentage width remains accurate */
    min-width: 4px;
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

  /* Cut line animations */
  @keyframes cut-line-pulse {
    0%,
    100% {
      opacity: 0.9;
      box-shadow: 0 0 10px rgba(251, 146, 60, 0.8);
    }
    50% {
      opacity: 1;
      box-shadow: 0 0 20px rgba(251, 146, 60, 1);
    }
  }

  .cut-line {
    animation: cut-line-pulse 1.5s ease-in-out infinite;
  }

  /* Cut indicator styling */
  .cut-indicator {
    transform: translateZ(0); /* Force hardware acceleration */
    backface-visibility: hidden;
  }

  /* Snap indicator line positioning - uses same calculation as playhead */
  .snap-indicator-line {
    --snap-position: 0;
    left: calc(80px + (100% - 80px) * var(--snap-position));
    will-change: left;
    animation: snap-pulse 0.8s ease-in-out infinite;
  }

  @keyframes snap-pulse {
    0%,
    100% {
      opacity: 0.7;
    }
    50% {
      opacity: 1;
    }
  }
</style>
